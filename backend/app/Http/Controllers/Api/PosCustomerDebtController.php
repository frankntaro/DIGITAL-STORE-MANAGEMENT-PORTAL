<?php

namespace App\Http\Controllers\Api;

use App\Services\AuditService;
use App\Services\AuthService;
use App\Services\FinancialService;
use App\Services\NotificationService;
use PDO;

class PosCustomerDebtController extends BaseApiController
{
    // ========================================================================
    // POS & SALES (SRS 3.6 & 3.12 — AT-05, AT-06, AT-07, AT-11, AT-18)
    // ========================================================================
    public static function listSales(PDO $pdo, array $user): never
    {
        self::requirePermission($user, ['sales.view', 'pos.sell']);

        $search = trim((string) ($_GET['search'] ?? ''));
        $paymentStatus = trim((string) ($_GET['payment_status'] ?? 'all'));
        $startDate = trim((string) ($_GET['start_date'] ?? ''));
        $endDate = trim((string) ($_GET['end_date'] ?? ''));

        $where = ["1=1"];
        $params = [];

        if ($paymentStatus !== '' && $paymentStatus !== 'all') {
            $where[] = "s.`payment_status` = ?";
            $params[] = $paymentStatus;
        }
        if ($startDate !== '') {
            $where[] = "DATE(s.`sale_date`) >= ?";
            $params[] = $startDate;
        }
        if ($endDate !== '') {
            $where[] = "DATE(s.`sale_date`) <= ?";
            $params[] = $endDate;
        }
        if ($search !== '') {
            $where[] = "(s.`receipt_number` LIKE ? OR c.`full_name` LIKE ? OR c.`phone` LIKE ?)";
            $like = "%{$search}%";
            array_push($params, $like, $like, $like);
        }

        $whereSql = implode(' AND ', $where);
        $stmt = $pdo->prepare("
            SELECT s.*,
                   COALESCE(c.`full_name`, 'Walk-in Customer') AS customer_name,
                   c.`phone` AS customer_phone,
                   u.`full_name` AS cashier_name,
                   (SELECT COUNT(*) FROM `sale_items` si WHERE si.`sale_id` = s.`id`) AS items_count
            FROM `sales` s
            LEFT JOIN `customers` c ON c.`id` = s.`customer_id`
            LEFT JOIN `users` u ON u.`id` = s.`user_id`
            WHERE {$whereSql}
            ORDER BY s.`id` DESC
        ");
        $stmt->execute($params);
        $salesRows = $stmt->fetchAll();

        $isAdmin = in_array('owner', $user['role_slugs'] ?? [], true);
        if (!$isAdmin) {
            foreach ($salesRows as &$sRow) {
                unset($sRow['total_cogs'], $sRow['gross_profit']);
            }
            unset($sRow);
        }

        self::json(['success' => true, 'sales' => $salesRows]);
    }

    public static function getSaleDetails(PDO $pdo, array $user, int $saleId): never
    {
        self::requirePermission($user, ['sales.view', 'pos.sell']);

        $stmt = $pdo->prepare("
            SELECT s.*,
                   COALESCE(c.`full_name`, 'Walk-in Customer') AS customer_name,
                   c.`customer_code` AS customer_code,
                   c.`phone` AS customer_phone,
                   c.`email` AS customer_email,
                   c.`address` AS customer_address,
                   u.`full_name` AS cashier_name
            FROM `sales` s
            LEFT JOIN `customers` c ON c.`id` = s.`customer_id`
            LEFT JOIN `users` u ON u.`id` = s.`user_id`
            WHERE s.`id` = ?
        ");
        $stmt->execute([$saleId]);
        $sale = $stmt->fetch();
        if (!$sale) {
            self::error('Sale transaction not found.', 404);
        }

        $itemsStmt = $pdo->prepare("
            SELECT si.*, p.`image_url`, p.`brand`, p.`model`,
                   COALESCE(si.`unit_snapshot`, p.`unit`, 'piece') AS unit
            FROM `sale_items` si
            LEFT JOIN `products` p ON p.`id` = si.`product_id`
            WHERE si.`sale_id` = ?
        ");
        $itemsStmt->execute([$saleId]);
        $saleItems = $itemsStmt->fetchAll();

        $isAdmin = in_array('owner', $user['role_slugs'] ?? [], true);
        if (!$isAdmin) {
            unset($sale['total_cogs'], $sale['gross_profit']);
            foreach ($saleItems as &$siRow) {
                unset($siRow['historical_unit_cost']);
            }
            unset($siRow);
        }

        $repayStmt = $pdo->prepare("
            SELECT cp.*, u.`full_name` AS recorded_by_name
            FROM `customer_payments` cp
            LEFT JOIN `users` u ON u.`id` = cp.`recorded_by`
            WHERE cp.`sale_id` = ?
            ORDER BY cp.`id` ASC
        ");
        $repayStmt->execute([$saleId]);

        $warStmt = $pdo->prepare("SELECT * FROM `warranties` WHERE `sale_id` = ?");
        $warStmt->execute([$saleId]);

        $settings = $pdo->query("SELECT * FROM `shop_settings` ORDER BY `id` ASC LIMIT 1")->fetch();

        self::json([
            'success'    => true,
            'sale'       => $sale,
            'items'      => $saleItems,
            'repayments' => $repayStmt->fetchAll(),
            'warranties' => $warStmt->fetchAll(),
            'settings'   => $settings,
        ]);
    }

    public static function createSale(PDO $pdo, array $user, ?array $overrideInput = null): never
    {
        $result = self::processSaleTransaction($pdo, $user, $overrideInput ?? self::input());
        self::json($result, $result['status_code'] ?? 201);
    }

    /**
     * Admin-only atomic Sale Reversal: reverses a test or mistaken sale, restores all sold
     * product quantities back into available stock, removes linked cash/debt/warranty records,
     * and recalculates affected cash register sessions.
     */
    public static function reverseSale(PDO $pdo, array $user, int $saleId): never
    {
        self::requirePermission($user, 'sales.reverse');
        if (!in_array('owner', $user['role_slugs'] ?? [], true)) {
            self::error('Access denied: Only the Shop Admin can reverse sales and restore stock.', 403);
        }

        $data = self::input();
        $reason = trim((string) ($data['reason'] ?? 'Reversed by Admin and product returned to stock'));

        $pdo->beginTransaction();
        try {
            $saleStmt = $pdo->prepare("SELECT * FROM `sales` WHERE `id` = ? FOR UPDATE");
            $saleStmt->execute([$saleId]);
            $sale = $saleStmt->fetch();
            if (!$sale) {
                $pdo->rollBack();
                self::error('Sale transaction not found.', 404);
            }

            $receiptNo = (string) $sale['receipt_number'];

            $itemsStmt = $pdo->prepare("SELECT * FROM `sale_items` WHERE `sale_id` = ? ORDER BY `id` ASC");
            $itemsStmt->execute([$saleId]);
            $items = $itemsStmt->fetchAll();

            $restoredItems = [];
            $totalUnitsRestored = 0.0;

            foreach ($items as $it) {
                $pid = (int) $it['product_id'];
                $restoreQty = round(max(0.0, (float) $it['quantity'] - (float) ($it['returned_quantity'] ?? 0)), 2);
                if ($pid > 0 && $restoreQty > 0.001) {
                    $invStmt = $pdo->prepare("SELECT * FROM `inventories` WHERE `product_id` = ? FOR UPDATE");
                    $invStmt->execute([$pid]);
                    $inv = $invStmt->fetch();
                    $prevQty = $inv ? round((float) $inv['available_quantity'], 2) : 0.0;
                    $newQty = round($prevQty + $restoreQty, 2);

                    if ($inv) {
                        $pdo->prepare("
                            UPDATE `inventories`
                            SET `available_quantity` = ?, `last_counted_at` = NOW()
                            WHERE `product_id` = ?
                        ")->execute([$newQty, $pid]);
                    } else {
                        $pdo->prepare("
                            INSERT INTO `inventories` (`product_id`, `available_quantity`, `unit_cost`, `last_counted_at`)
                            VALUES (?, ?, ?, NOW())
                        ")->execute([$pid, $newQty, (float) ($it['historical_unit_cost'] ?? 0)]);
                    }

                    $totalUnitsRestored += $restoreQty;
                    $restoredItems[] = [
                        'product_id'        => $pid,
                        'product_name'      => $it['product_name_snapshot'],
                        'restored_quantity' => $restoreQty,
                        'previous_quantity' => $prevQty,
                        'new_quantity'      => $newQty,
                    ];
                }
            }

            // Collect dependent IDs & affected cash sessions
            $cpIds = array_map('intval', $pdo->query("SELECT `id` FROM `customer_payments` WHERE `sale_id` = {$saleId}")->fetchAll(PDO::FETCH_COLUMN));
            $retIds = array_map('intval', $pdo->query("SELECT `id` FROM `returns` WHERE `sale_id` = {$saleId}")->fetchAll(PDO::FETCH_COLUMN));
            $warIds = array_map('intval', $pdo->query("SELECT `id` FROM `warranties` WHERE `sale_id` = {$saleId}")->fetchAll(PDO::FETCH_COLUMN));

            $affectedSessions = [];
            if (!empty($sale['cash_session_id'])) {
                $affectedSessions[(int) $sale['cash_session_id']] = true;
            }
            $cmSessionsStmt = $pdo->prepare("SELECT DISTINCT `cash_session_id` FROM `cash_movements` WHERE `reference_type` = 'Sale' AND `reference_id` = ? AND `cash_session_id` IS NOT NULL");
            $cmSessionsStmt->execute([$saleId]);
            foreach ($cmSessionsStmt->fetchAll(PDO::FETCH_COLUMN) as $sid) {
                $affectedSessions[(int) $sid] = true;
            }
            if (!empty($cpIds)) {
                $cpIn = implode(',', $cpIds);
                foreach ($pdo->query("SELECT DISTINCT `cash_session_id` FROM `cash_movements` WHERE `reference_type` = 'CustomerPayment' AND `reference_id` IN ({$cpIn}) AND `cash_session_id` IS NOT NULL")->fetchAll(PDO::FETCH_COLUMN) as $sid) {
                    $affectedSessions[(int) $sid] = true;
                }
                $pdo->exec("DELETE FROM `cash_movements` WHERE `reference_type` = 'CustomerPayment' AND `reference_id` IN ({$cpIn})");
            }
            if (!empty($retIds)) {
                $retIn = implode(',', $retIds);
                foreach ($pdo->query("SELECT DISTINCT `cash_session_id` FROM `cash_movements` WHERE `reference_type` = 'Return' AND `reference_id` IN ({$retIn}) AND `cash_session_id` IS NOT NULL")->fetchAll(PDO::FETCH_COLUMN) as $sid) {
                    $affectedSessions[(int) $sid] = true;
                }
                $pdo->exec("DELETE FROM `cash_movements` WHERE `reference_type` = 'Return' AND `reference_id` IN ({$retIn})");
                $pdo->exec("DELETE FROM `stock_movements` WHERE `reference_type` = 'Return' AND `reference_id` IN ({$retIn})");
                $pdo->exec("DELETE FROM `return_items` WHERE `return_id` IN ({$retIn})");
                $pdo->exec("DELETE FROM `returns` WHERE `id` IN ({$retIn})");
            }
            if (!empty($warIds)) {
                $warIn = implode(',', $warIds);
                $pdo->exec("DELETE FROM `warranty_claims` WHERE `warranty_id` IN ({$warIn})");
                $pdo->exec("DELETE FROM `warranties` WHERE `id` IN ({$warIn})");
            }

            $pdo->prepare("DELETE FROM `cash_movements` WHERE `reference_type` = 'Sale' AND `reference_id` = ?")->execute([$saleId]);
            $pdo->prepare("DELETE FROM `stock_movements` WHERE `reference_type` = 'Sale' AND `reference_id` = ?")->execute([$saleId]);
            $pdo->prepare("DELETE FROM `customer_payments` WHERE `sale_id` = ?")->execute([$saleId]);
            $pdo->prepare("DELETE FROM `admin_notifications` WHERE `entity_type` = 'Sale' AND `entity_id` = ?")->execute([$saleId]);
            $pdo->prepare("DELETE FROM `sale_items` WHERE `sale_id` = ?")->execute([$saleId]);
            $pdo->prepare("DELETE FROM `sales` WHERE `id` = ?")->execute([$saleId]);

            foreach (array_keys($affectedSessions) as $sid) {
                if ($sid > 0) {
                    FinancialService::recalculateCashSession($pdo, $sid);
                }
            }

            AuditService::log(
                $pdo,
                (int) $user['id'],
                'sale.reversed',
                'Sale',
                $saleId,
                [
                    'receipt_number' => $receiptNo,
                    'total_amount'   => $sale['total_amount'],
                    'items_count'    => count($items),
                ],
                [
                    'reversed'       => true,
                    'restored_items' => $restoredItems,
                ],
                $reason
            );

            $pdo->commit();
            self::json([
                'success'             => true,
                'message'             => "Sale {$receiptNo} reversed and product stock restored successfully.",
                'receipt_number'      => $receiptNo,
                'total_units_restored'=> round($totalUnitsRestored, 2),
                'restored_items'      => $restoredItems,
            ]);
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            self::error('Failed to reverse sale: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Reusable atomic POS sale processor (used by direct POS checkout and offline SyncQueue)
     */
    public static function processSaleTransaction(PDO $pdo, array $user, array $data): array
    {
        if (!AuthService::hasPermission($user, 'pos.sell')) {
            self::error('Access denied: You do not have permission to create sales.', 403);
        }

        $txUuid = trim((string) ($data['uuid'] ?? '')) ?: self::uuid('sale');

        // Idempotency / duplicate transaction prevention (SRS 5.5, 8.3 & AT-18)
        $dupCheck = $pdo->prepare("SELECT `id`, `receipt_number` FROM `sales` WHERE `uuid` = ? LIMIT 1");
        $dupCheck->execute([$txUuid]);
        $existing = $dupCheck->fetch();
        if ($existing) {
            return [
                'success'        => true,
                'duplicate'      => true,
                'status_code'    => 200,
                'message'        => "Transaction {$existing['receipt_number']} was already processed (duplicate prevented).",
                'sale_id'        => (int) $existing['id'],
                'receipt_number' => $existing['receipt_number'],
            ];
        }

        $items = $data['items'] ?? [];
        if (empty($items) || !is_array($items)) {
            self::error('At least one product is required in the shopping cart.', 422);
        }

        $customerId = !empty($data['customer_id']) ? (int) $data['customer_id'] : null;
        $rawDiscountType = $data['discount_type'] ?? 'none';
        $discountType = in_array($rawDiscountType, ['none', 'fixed', 'percentage'], true)
            ? $rawDiscountType
            : 'none';
        $discountValue = max(0.0, (float) ($data['discount_value'] ?? 0));
        $discountReason = trim((string) ($data['discount_reason'] ?? '')) ?: null;
        $paymentMethod = trim((string) ($data['payment_method'] ?? 'Cash'));
        $dueDate = !empty($data['due_date']) ? trim((string) $data['due_date']) : date('Y-m-d', strtotime('+14 days'));
        $notes = trim((string) ($data['notes'] ?? '')) ?: null;
        $deviceId = trim((string) ($data['device_id'] ?? 'POS-WEB-01'));
        $syncedFromOffline = !empty($data['synced_from_offline']) ? 1 : 0;

        $settings = $pdo->query("SELECT * FROM `shop_settings` ORDER BY `id` ASC LIMIT 1")->fetch();

        $pdo->beginTransaction();
        try {
            $subtotal = 0.0;
            $totalCogs = 0.0;
            $preparedItems = [];

            foreach ($items as $cartItem) {
                $pid = (int) ($cartItem['product_id'] ?? 0);
                $rawQty = round((float) ($cartItem['quantity'] ?? 0), 2);
                if ($pid <= 0 || $rawQty <= 0) {
                    $pdo->rollBack();
                    self::error('Invalid product or quantity in cart.', 422);
                }

                // Lock product & inventory row for atomic stock check and deduction
                $prodStmt = $pdo->prepare("
                    SELECT p.*, COALESCE(i.`available_quantity`, 0) AS available_quantity,
                           COALESCE(i.`unit_cost`, p.`purchase_price`) AS unit_cost
                    FROM `products` p
                    LEFT JOIN `inventories` i ON i.`product_id` = p.`id`
                    WHERE p.`id` = ?
                    FOR UPDATE
                ");
                $prodStmt->execute([$pid]);
                $product = $prodStmt->fetch();

                if (!$product || $product['status'] !== 'active') {
                    $pdo->rollBack();
                    self::error("Product ID {$pid} is unavailable or archived.", 422);
                }

                $unit = ($product['unit'] ?? 'piece') === 'meter' ? 'meter' : 'piece';
                $qty = $unit === 'meter' ? round($rawQty, 2) : (float) max(1, (int) round($rawQty));

                $availQty = round((float) $product['available_quantity'], 2);
                // SRS 3.5 & 8.3: Prevent negative inventory
                if ($availQty + 0.0001 < $qty) {
                    $pdo->rollBack();
                    $unitSuffix = $unit === 'meter' ? ' m' : '';
                    self::error(
                        "Insufficient stock for '{$product['name']}'. Available: {$availQty}{$unitSuffix}, Requested: {$qty}{$unitSuffix}.",
                        422
                    );
                }

                $unitPrice = isset($cartItem['unit_selling_price']) && (float) $cartItem['unit_selling_price'] > 0
                    ? (float) $cartItem['unit_selling_price']
                    : (float) $product['selling_price'];
                $historicalCost = (float) $product['unit_cost'];
                $lineTotal = round($qty * $unitPrice, 2);
                $lineCogs = round($qty * $historicalCost, 2);
                $lineProfit = round($lineTotal - $lineCogs, 2);

                $subtotal += $lineTotal;
                $totalCogs += $lineCogs;

                $preparedItems[] = [
                    'product_id'            => $pid,
                    'product_name_snapshot' => $product['name'],
                    'sku_snapshot'          => $product['sku'],
                    'unit_snapshot'         => $unit,
                    'quantity'              => $qty,
                    'previous_stock'        => $availQty,
                    'new_stock'             => max(0.0, round($availQty - $qty, 2)),
                    'unit_selling_price'    => $unitPrice,
                    'historical_unit_cost'  => $historicalCost,
                    'line_total'            => $lineTotal,
                    'line_cogs'             => $lineCogs,
                    'line_profit'           => $lineProfit,
                    'warranty_months'       => (int) ($cartItem['warranty_months'] ?? $product['warranty_months'] ?? 0),
                    'serial_or_imei'        => $cartItem['serial_or_imei'] ?? null,
                ];
            }

            // Discount calculation & authorization enforcement (SRS 3.12 & AT-11)
            $discountAmount = 0.0;
            if ($discountType !== 'none' && $discountValue > 0) {
                if (!AuthService::hasPermission($user, 'pos.discount') && !AuthService::hasPermission($user, 'pos.override_discount')) {
                    $pdo->rollBack();
                    self::error('Access denied: You are not authorized to issue discounts.', 403);
                }

                if ($discountType === 'percentage') {
                    $discountAmount = round($subtotal * ($discountValue / 100.0), 2);
                    $effectivePercent = $discountValue;
                } else {
                    $discountAmount = min($subtotal, round($discountValue, 2));
                    $effectivePercent = $subtotal > 0 ? round(($discountAmount / $subtotal) * 100.0, 2) : 0.0;
                }

                $maxUserDiscount = (float) ($user['max_discount_percent'] ?? 0);
                $shopMaxCashierDiscount = (float) ($settings['max_cashier_discount_percent'] ?? 5.0);
                $allowedMaxPercent = in_array('owner', $user['role_slugs'] ?? [], true)
                    || AuthService::hasPermission($user, 'pos.override_discount')
                    ? 100.0
                    : max($maxUserDiscount, $shopMaxCashierDiscount);

                if ($effectivePercent > $allowedMaxPercent + 0.01) {
                    $pdo->rollBack();
                    self::error(
                        "Unauthorized discount: Requested discount ({$effectivePercent}%) exceeds your maximum authorized limit of {$allowedMaxPercent}%.",
                        403
                    );
                }

                if ($discountReason === null || $discountReason === '') {
                    $discountReason = 'Authorized POS discount';
                }
            } else {
                $discountType = 'none';
                $discountValue = 0.0;
            }

            $totalAmount = max(0.0, round($subtotal - $discountAmount, 2));
            $grossProfit = round($totalAmount - $totalCogs, 2);

            // Cash received & Payment scenario (AT-05 Full Cash, AT-06 Partial Payment, AT-07 Zero-Deposit Credit)
            $cashReceived = isset($data['cash_received']) ? max(0.0, (float) $data['cash_received']) : $totalAmount;

            if ($cashReceived >= $totalAmount - 0.01) {
                $paymentScenario = 'full_cash';
                $paymentStatus = 'paid';
                $changeAmount = max(0.0, round($cashReceived - $totalAmount, 2));
                $outstandingBalance = 0.0;
                $dueDate = null;
            } else {
                // Credit / Partial sale requires a registered customer and credit permission check
                if (!$customerId) {
                    $pdo->rollBack();
                    self::error('A registered customer must be selected for partial-payment or zero-deposit credit sales.', 422);
                }
                if (empty($settings['allow_credit_sales'])) {
                    $pdo->rollBack();
                    self::error('Credit sales are currently disabled in shop settings.', 403);
                }

                $cusStmt = $pdo->prepare("SELECT * FROM `customers` WHERE `id` = ? FOR UPDATE");
                $cusStmt->execute([$customerId]);
                $customer = $cusStmt->fetch();
                if (!$customer || $customer['account_status'] !== 'active') {
                    $pdo->rollBack();
                    self::error('Selected customer account is not active.', 422);
                }

                $outstandingBalance = round($totalAmount - $cashReceived, 2);
                $changeAmount = 0.0;
                $paymentScenario = $cashReceived <= 0.01 ? 'zero_deposit_credit' : 'partial_credit';
                $paymentStatus = $cashReceived <= 0.01 ? 'unpaid' : 'partial';

                // Check customer credit limit
                $curDebtStmt = $pdo->prepare("
                    SELECT COALESCE(SUM(`outstanding_balance`), 0)
                    FROM `sales`
                    WHERE `customer_id` = ? AND `status` = 'completed' AND `outstanding_balance` > 0
                ");
                $curDebtStmt->execute([$customerId]);
                $existingDebt = (float) $curDebtStmt->fetchColumn();
                $creditLimit = (float) $customer['credit_limit'] > 0
                    ? (float) $customer['credit_limit']
                    : (float) ($settings['default_credit_limit'] ?? 2500000);

                if (($existingDebt + $outstandingBalance) > $creditLimit + 0.01 && !$user['can_approve_credit'] && !in_array('owner', $user['role_slugs'] ?? [], true)) {
                    $pdo->rollBack();
                    self::error(
                        'Customer credit limit exceeded: New total debt (TZS ' . number_format($existingDebt + $outstandingBalance) . ') exceeds limit of TZS ' . number_format($creditLimit) . '. Owner approval required.',
                        403
                    );
                }
            }

            $receiptNumber = self::nextUniqueCode($pdo, 'sales', 'receipt_number', 'S-', 5, 121);
            $sessionId = FinancialService::getOpenCashSessionId($pdo);
            $saleDate = !empty($data['sale_date']) ? date('Y-m-d H:i:s', strtotime((string) $data['sale_date'])) : date('Y-m-d H:i:s');

            // Optional walk-in customer info for receipts when no registered customer is selected
            $walkinName = trim((string) ($data['walkin_customer_name'] ?? ''));
            $walkinPhone = trim((string) ($data['walkin_customer_phone'] ?? ''));
            if (!$customerId && ($walkinName !== '' || $walkinPhone !== '')) {
                $walkinTag = trim("Walk-in: {$walkinName}" . ($walkinPhone !== '' ? " ({$walkinPhone})" : ''));
                $notes = $notes ? "{$notes} | {$walkinTag}" : $walkinTag;
            }

            $customerRecord = null;
            if ($customerId) {
                $cStmt = $pdo->prepare("SELECT `id`, `customer_code`, `full_name`, `phone`, `email`, `address` FROM `customers` WHERE `id` = ? LIMIT 1");
                $cStmt->execute([$customerId]);
                $customerRecord = $cStmt->fetch() ?: null;
            }

            $pdo->prepare("
                INSERT INTO `sales` (
                    `uuid`, `receipt_number`, `customer_id`, `cash_session_id`, `sale_date`,
                    `subtotal_amount`, `discount_type`, `discount_value`, `discount_amount`,
                    `discount_reason`, `discount_approved_by`, `total_amount`, `cash_received`,
                    `change_amount`, `outstanding_balance`, `total_cogs`, `gross_profit`,
                    `payment_scenario`, `payment_method`, `payment_status`, `due_date`,
                    `status`, `notes`, `user_id`, `device_id`, `synced_from_offline`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
            ")->execute([
                $txUuid, $receiptNumber, $customerId, $sessionId, $saleDate,
                $subtotal, $discountType, $discountValue, $discountAmount,
                $discountReason, $discountAmount > 0 ? $user['id'] : null, $totalAmount, $cashReceived,
                $changeAmount, $outstandingBalance, $totalCogs, $grossProfit,
                $paymentScenario, $paymentMethod, $paymentStatus, $dueDate,
                $notes, $user['id'], $deviceId, $syncedFromOffline
            ]);
            $saleId = (int) $pdo->lastInsertId();

            // Insert sale items, deduct stock, record stock movements, and register warranties
            $siStmt = $pdo->prepare("
                INSERT INTO `sale_items` (
                    `sale_id`, `product_id`, `product_name_snapshot`, `sku_snapshot`, `unit_snapshot`, `quantity`,
                    `unit_selling_price`, `historical_unit_cost`, `line_discount_amount`,
                    `line_total`, `line_cogs`, `line_profit`, `warranty_months`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, ?)
            ");
            $invUpd = $pdo->prepare("UPDATE `inventories` SET `available_quantity` = ? WHERE `product_id` = ?");
            $smStmt = $pdo->prepare("
                INSERT INTO `stock_movements` (
                    `uuid`, `product_id`, `movement_type`, `previous_quantity`, `change_quantity`,
                    `new_quantity`, `unit_cost`, `reference_type`, `reference_id`, `reason`, `notes`, `user_id`
                ) VALUES (?, ?, 'sale', ?, ?, ?, ?, 'Sale', ?, ?, ?, ?)
            ");
            $warStmt = $pdo->prepare("
                INSERT INTO `warranties` (
                    `warranty_number`, `sale_id`, `sale_item_id`, `product_id`, `customer_id`,
                    `serial_or_imei`, `sale_date`, `duration_months`, `expiry_date`, `status`, `notes`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
            ");

            $createdWarranties = [];
            foreach ($preparedItems as $item) {
                $siStmt->execute([
                    $saleId, $item['product_id'], $item['product_name_snapshot'], $item['sku_snapshot'],
                    $item['unit_snapshot'], $item['quantity'], $item['unit_selling_price'], $item['historical_unit_cost'],
                    $item['line_total'], $item['line_cogs'], $item['line_profit'], $item['warranty_months']
                ]);
                $saleItemId = (int) $pdo->lastInsertId();

                // Deduct stock
                $invUpd->execute([$item['new_stock'], $item['product_id']]);

                // Stock movement
                $smStmt->execute([
                    self::uuid('sm'), $item['product_id'], $item['previous_stock'], -$item['quantity'],
                    $item['new_stock'], $item['historical_unit_cost'], $saleId,
                    "POS Sale {$receiptNumber}", $notes, $user['id']
                ]);

                // Auto-register warranty if warranty_months > 0 (SRS 3.14)
                if ($item['warranty_months'] > 0) {
                    $warNo = self::nextUniqueCode($pdo, 'warranties', 'warranty_number', 'WAR-' . date('Y') . '-', 3, 1);
                    $saleDateOnly = substr($saleDate, 0, 10);
                    $expiryDate = date('Y-m-d', strtotime("{$saleDateOnly} +{$item['warranty_months']} months"));
                    $serialNo = $item['serial_or_imei'] ?: ('SN-' . strtoupper(substr(md5($receiptNumber . '-' . $saleItemId), 0, 10)));
                    $warStmt->execute([
                        $warNo, $saleId, $saleItemId, $item['product_id'], $customerId,
                        $serialNo,
                        $saleDateOnly, $item['warranty_months'], $expiryDate,
                        "{$item['warranty_months']}-Month Store & Manufacturer Warranty"
                    ]);
                    $createdWarranties[] = [
                        'warranty_number' => $warNo,
                        'product_name'    => $item['product_name_snapshot'],
                        'serial_or_imei'  => $serialNo,
                        'duration_months' => $item['warranty_months'],
                        'expiry_date'     => $expiryDate,
                    ];
                }
            }

            // Record Cash Inflow if actual cash received > 0
            $netCashInflow = min($totalAmount, $cashReceived);
            if ($netCashInflow > 0 && $sessionId) {
                $pdo->prepare("
                    INSERT INTO `cash_movements` (
                        `uuid`, `cash_session_id`, `direction`, `category`, `amount`,
                        `reference_type`, `reference_id`, `description`, `user_id`
                    ) VALUES (?, ?, 'inflow', 'sale_payment', ?, 'Sale', ?, ?, ?)
                ")->execute([
                    self::uuid('cm'), $sessionId, $netCashInflow, $saleId,
                    "Sale {$receiptNumber} cash collection", $user['id']
                ]);
                FinancialService::recalculateCashSession($pdo, $sessionId);
            }

            // Audit log for discounts or credit sales
            if ($discountAmount > 0) {
                AuditService::log(
                    $pdo,
                    (int) $user['id'],
                    'sale.discount_applied',
                    'Sale',
                    $saleId,
                    ['subtotal' => $subtotal],
                    ['discount_type' => $discountType, 'discount_value' => $discountValue, 'discount_amount' => $discountAmount, 'total' => $totalAmount],
                    $discountReason,
                    $deviceId
                );
            }

            if ($outstandingBalance > 0) {
                AuditService::log(
                    $pdo,
                    (int) $user['id'],
                    'sale.credit_created',
                    'Sale',
                    $saleId,
                    null,
                    ['receipt_number' => $receiptNumber, 'scenario' => $paymentScenario, 'total' => $totalAmount, 'paid' => $cashReceived, 'debt' => $outstandingBalance],
                    "Credit sale ({$paymentScenario})",
                    $deviceId
                );
            }

            // Notify Shop Admin whenever an Employee makes a sale or sells out a product (stock hits 0)
            $actorName = $user['full_name'] ?? ($user['username'] ?? 'Employee');
            $customerDisplay = $customerRecord['full_name'] ?? ($walkinName !== '' ? $walkinName : 'Walk-in Customer');
            $itemLabels = array_map(
                fn($it) => $it['product_name_snapshot'] . ' × ' . $it['quantity'],
                array_slice($preparedItems, 0, 3)
            );
            $itemsSummary = implode(', ', $itemLabels) . (count($preparedItems) > 3 ? ' +' . (count($preparedItems) - 3) : '');

            NotificationService::notifyAdmin(
                $pdo,
                $user,
                'employee_sale',
                $outstandingBalance > 0 ? 'warning' : 'info',
                "Employee Sale {$receiptNumber}",
                "{$actorName} sold {$itemsSummary} for TZS " . number_format($totalAmount),
                'Sale',
                $saleId,
                $totalAmount,
                [
                    'receipt_number'      => $receiptNumber,
                    'customer_name'       => $customerDisplay,
                    'payment_scenario'    => $paymentScenario,
                    'payment_method'      => $paymentMethod,
                    'items_count'         => count($preparedItems),
                    'items_summary'       => $itemsSummary,
                    'outstanding_balance' => $outstandingBalance,
                ]
            );

            foreach ($preparedItems as $item) {
                if ((float) ($item['new_stock'] ?? 0) <= 0.0001) {
                    NotificationService::notifyAdmin(
                        $pdo,
                        $user,
                        'sold_out',
                        'critical',
                        "Product Sold Out: {$item['product_name_snapshot']}",
                        "{$actorName} sold out {$item['product_name_snapshot']} ({$item['sku_snapshot']}) on receipt {$receiptNumber}. Remaining stock: 0.",
                        'Product',
                        (int) $item['product_id'],
                        (float) $item['line_total'],
                        [
                            'product_name'   => $item['product_name_snapshot'],
                            'sku'            => $item['sku_snapshot'],
                            'receipt_number' => $receiptNumber,
                            'sale_id'        => $saleId,
                            'sold_qty'       => (float) $item['quantity'],
                            'unit'           => $item['unit_snapshot'],
                        ]
                    );
                }
            }

            $pdo->commit();

            $receiptPayload = [
                'sale' => [
                    'id'                  => $saleId,
                    'receipt_number'      => $receiptNumber,
                    'sale_date'           => $saleDate,
                    'customer_id'         => $customerId,
                    'customer_code'       => $customerRecord['customer_code'] ?? null,
                    'customer_name'       => $customerRecord['full_name'] ?? ($walkinName !== '' ? $walkinName : 'Walk-in Customer'),
                    'customer_phone'      => $customerRecord['phone'] ?? ($walkinPhone !== '' ? $walkinPhone : null),
                    'customer_email'      => $customerRecord['email'] ?? null,
                    'customer_address'    => $customerRecord['address'] ?? null,
                    'cashier_name'        => $user['full_name'] ?? $user['username'] ?? 'Staff',
                    'subtotal_amount'     => $subtotal,
                    'discount_amount'     => $discountAmount,
                    'total_amount'        => $totalAmount,
                    'cash_received'       => $cashReceived,
                    'change_amount'       => $changeAmount,
                    'outstanding_balance' => $outstandingBalance,
                    'payment_method'      => $paymentMethod,
                    'payment_status'      => $paymentStatus,
                    'payment_scenario'    => $paymentScenario,
                    'due_date'            => $dueDate,
                    'notes'               => $notes,
                ],
                'items' => array_map(fn($it) => [
                    'product_id'            => $it['product_id'],
                    'product_name_snapshot' => $it['product_name_snapshot'],
                    'sku_snapshot'          => $it['sku_snapshot'],
                    'unit'                  => $it['unit_snapshot'],
                    'unit_snapshot'         => $it['unit_snapshot'],
                    'quantity'              => $it['quantity'],
                    'unit_selling_price'    => $it['unit_selling_price'],
                    'line_total'            => $it['line_total'],
                    'warranty_months'       => $it['warranty_months'],
                ], $preparedItems),
                'warranties' => $createdWarranties,
                'settings'   => $settings ?: [],
            ];

            return [
                'success'             => true,
                'status_code'         => 201,
                'message'             => "Sale {$receiptNumber} completed successfully.",
                'sale_id'             => $saleId,
                'receipt_number'      => $receiptNumber,
                'total_amount'        => $totalAmount,
                'cash_received'       => $cashReceived,
                'change_amount'       => $changeAmount,
                'outstanding_balance' => $outstandingBalance,
                'payment_status'      => $paymentStatus,
                'payment_scenario'    => $paymentScenario,
                'receipt'             => $receiptPayload,
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            self::error('Sale transaction failed: ' . $e->getMessage(), 500);
        }
    }

    // ========================================================================
    // CUSTOMERS (SRS 3.7)
    // ========================================================================
    public static function listCustomers(PDO $pdo, array $user): never
    {
        self::requirePermission($user, ['customers.view', 'pos.sell']);

        $search = trim((string) ($_GET['search'] ?? ''));
        $where = "1=1";
        $params = [];
        if ($search !== '') {
            $where = "(c.`full_name` LIKE ? OR c.`phone` LIKE ? OR c.`customer_code` LIKE ?)";
            $like = "%{$search}%";
            $params = [$like, $like, $like];
        }

        $stmt = $pdo->prepare("
            SELECT c.*,
                   COUNT(DISTINCT CASE WHEN s.`status` = 'completed' THEN s.`id` END) AS sales_count,
                   COALESCE(SUM(CASE WHEN s.`status` = 'completed' THEN s.`total_amount` ELSE 0 END), 0) AS total_purchases,
                   COALESCE(SUM(CASE WHEN s.`status` = 'completed' THEN (s.`total_amount` - s.`outstanding_balance`) ELSE 0 END), 0) AS total_paid,
                   COALESCE(SUM(CASE WHEN s.`status` = 'completed' THEN s.`outstanding_balance` ELSE 0 END), 0) AS outstanding_debt,
                   MIN(CASE WHEN s.`status` = 'completed' AND s.`outstanding_balance` > 0 THEN s.`due_date` END) AS earliest_due_date
            FROM `customers` c
            LEFT JOIN `sales` s ON s.`customer_id` = c.`id`
            WHERE {$where}
            GROUP BY c.`id`
            ORDER BY c.`id` DESC
        ");
        $stmt->execute($params);

        self::json(['success' => true, 'customers' => $stmt->fetchAll()]);
    }

    public static function getCustomerProfile(PDO $pdo, array $user, int $customerId): never
    {
        self::requirePermission($user, 'customers.view');

        $stmt = $pdo->prepare("SELECT * FROM `customers` WHERE `id` = ?");
        $stmt->execute([$customerId]);
        $customer = $stmt->fetch();
        if (!$customer) {
            self::error('Customer not found.', 404);
        }

        $salesStmt = $pdo->prepare("
            SELECT s.*, u.`full_name` AS cashier_name
            FROM `sales` s
            LEFT JOIN `users` u ON u.`id` = s.`user_id`
            WHERE s.`customer_id` = ?
            ORDER BY s.`id` DESC
        ");
        $salesStmt->execute([$customerId]);
        $sales = $salesStmt->fetchAll();

        $payStmt = $pdo->prepare("
            SELECT cp.*, s.`receipt_number` AS sale_receipt_number, u.`full_name` AS recorded_by_name
            FROM `customer_payments` cp
            INNER JOIN `sales` s ON s.`id` = cp.`sale_id`
            LEFT JOIN `users` u ON u.`id` = cp.`recorded_by`
            WHERE cp.`customer_id` = ?
            ORDER BY cp.`id` DESC
        ");
        $payStmt->execute([$customerId]);
        $payments = $payStmt->fetchAll();

        $totalPurchases = 0.0;
        $outstandingDebt = 0.0;
        foreach ($sales as $s) {
            if ($s['status'] === 'completed') {
                $totalPurchases += (float) $s['total_amount'];
                $outstandingDebt += (float) $s['outstanding_balance'];
            }
        }
        $totalPaid = max(0.0, $totalPurchases - $outstandingDebt);

        $customer['total_purchases'] = $totalPurchases;
        $customer['total_paid'] = $totalPaid;
        $customer['outstanding_debt'] = $outstandingDebt;

        self::json([
            'success'  => true,
            'customer' => $customer,
            'sales'    => $sales,
            'payments' => $payments,
        ]);
    }

    public static function saveCustomer(PDO $pdo, array $user, ?int $customerId = null): never
    {
        self::requirePermission($user, ['customers.manage', 'pos.sell']);
        $data = self::input();

        $fullName = trim((string) ($data['full_name'] ?? ''));
        $phone = trim((string) ($data['phone'] ?? ''));
        $email = trim((string) ($data['email'] ?? '')) ?: null;
        $address = trim((string) ($data['address'] ?? '')) ?: null;
        $rawType = $data['customer_type'] ?? 'regular';
        $customerType = in_array($rawType, ['regular', 'vip', 'wholesale', 'corporate'], true)
            ? $rawType
            : 'regular';
        $creditLimit = isset($data['credit_limit']) ? (float) $data['credit_limit'] : 2500000.0;
        $notes = trim((string) ($data['notes'] ?? '')) ?: null;
        $rawAccStatus = $data['account_status'] ?? 'active';
        $accountStatus = in_array($rawAccStatus, ['active', 'suspended', 'archived'], true)
            ? $rawAccStatus
            : 'active';

        if ($fullName === '' || $phone === '') {
            self::error('Customer full name and phone number are required.', 422);
        }

        if ($customerId === null) {
            $code = self::nextUniqueCode($pdo, 'customers', 'customer_code', 'CUS-', 3, 1);
            $stmt = $pdo->prepare("
                INSERT INTO `customers` (`customer_code`, `full_name`, `phone`, `email`, `address`, `customer_type`, `credit_limit`, `notes`, `account_status`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
            ");
            $stmt->execute([$code, $fullName, $phone, $email, $address, $customerType, $creditLimit, $notes]);
            $id = (int) $pdo->lastInsertId();
            AuditService::log($pdo, (int) $user['id'], 'customer.created', 'Customer', $id, null, ['full_name' => $fullName, 'phone' => $phone]);
            self::json(['success' => true, 'message' => 'Customer registered successfully.', 'id' => $id], 201);
        } else {
            $pdo->prepare("
                UPDATE `customers`
                SET `full_name` = ?, `phone` = ?, `email` = ?, `address` = ?,
                    `customer_type` = ?, `credit_limit` = ?, `notes` = ?, `account_status` = ?
                WHERE `id` = ?
            ")->execute([$fullName, $phone, $email, $address, $customerType, $creditLimit, $notes, $accountStatus, $customerId]);
            AuditService::log($pdo, (int) $user['id'], 'customer.updated', 'Customer', $customerId, null, ['full_name' => $fullName]);
            self::json(['success' => true, 'message' => 'Customer updated successfully.']);
        }
    }

    // ========================================================================
    // CUSTOMER DEBT MANAGEMENT & REPAYMENTS (SRS 3.8 — AT-08)
    // ========================================================================
    public static function listDebts(PDO $pdo, array $user): never
    {
        self::requirePermission($user, ['debts.view', 'customers.view']);

        $stmt = $pdo->query("
            SELECT s.`id` AS sale_id,
                   s.`receipt_number`,
                   s.`customer_id`,
                   c.`customer_code`,
                   c.`full_name` AS customer_name,
                   c.`phone` AS customer_phone,
                   s.`sale_date`,
                   s.`total_amount`,
                   (s.`total_amount` - s.`outstanding_balance`) AS total_paid,
                   s.`outstanding_balance`,
                   s.`due_date`,
                   s.`payment_scenario`,
                   DATEDIFF(CURDATE(), COALESCE(s.`due_date`, DATE(s.`sale_date`))) AS days_past_due,
                   CASE
                     WHEN s.`due_date` IS NOT NULL AND s.`due_date` < CURDATE() THEN 'overdue'
                     WHEN s.`due_date` IS NOT NULL AND DATEDIFF(s.`due_date`, CURDATE()) <= 5 THEN 'due_soon'
                     ELSE 'current'
                   END AS aging_status
            FROM `sales` s
            INNER JOIN `customers` c ON c.`id` = s.`customer_id`
            WHERE s.`status` = 'completed' AND s.`outstanding_balance` > 0
            ORDER BY
              CASE
                WHEN s.`due_date` IS NOT NULL AND s.`due_date` < CURDATE() THEN 1
                WHEN s.`due_date` IS NOT NULL AND DATEDIFF(s.`due_date`, CURDATE()) <= 5 THEN 2
                ELSE 3
              END ASC,
              s.`due_date` ASC
        ");
        $debts = $stmt->fetchAll();

        $repaymentsStmt = $pdo->query("
            SELECT cp.*, c.`full_name` AS customer_name, c.`phone` AS customer_phone,
                   s.`receipt_number` AS sale_receipt_number, u.`full_name` AS recorded_by_name
            FROM `customer_payments` cp
            INNER JOIN `customers` c ON c.`id` = cp.`customer_id`
            INNER JOIN `sales` s ON s.`id` = cp.`sale_id`
            LEFT JOIN `users` u ON u.`id` = cp.`recorded_by`
            ORDER BY cp.`id` DESC
            LIMIT 100
        ");

        self::json([
            'success'    => true,
            'debts'      => $debts,
            'repayments' => $repaymentsStmt->fetchAll(),
        ]);
    }

    public static function recordDebtRepayment(PDO $pdo, array $user, ?array $overrideInput = null): never
    {
        $result = self::processRepaymentTransaction($pdo, $user, $overrideInput ?? self::input());
        self::json($result, $result['status_code'] ?? 201);
    }

    public static function processRepaymentTransaction(PDO $pdo, array $user, array $data): array
    {
        if (!AuthService::hasPermission($user, 'debts.repay')) {
            self::error('Access denied: You are not authorized to record customer debt repayments.', 403);
        }

        $txUuid = trim((string) ($data['uuid'] ?? '')) ?: self::uuid('cp');

        // Idempotency check
        $dupStmt = $pdo->prepare("SELECT `id`, `receipt_number` FROM `customer_payments` WHERE `uuid` = ? LIMIT 1");
        $dupStmt->execute([$txUuid]);
        $existing = $dupStmt->fetch();
        if ($existing) {
            return [
                'success'        => true,
                'duplicate'      => true,
                'status_code'    => 200,
                'message'        => "Repayment {$existing['receipt_number']} was already recorded.",
                'repayment_id'   => (int) $existing['id'],
                'receipt_number' => $existing['receipt_number'],
            ];
        }

        $saleId = (int) ($data['sale_id'] ?? 0);
        $amount = (float) ($data['amount'] ?? 0);
        $paymentMethod = trim((string) ($data['payment_method'] ?? 'Cash'));
        $notes = trim((string) ($data['notes'] ?? '')) ?: null;
        $deviceId = trim((string) ($data['device_id'] ?? 'POS-WEB-01'));
        $syncedFromOffline = !empty($data['synced_from_offline']) ? 1 : 0;

        if ($saleId <= 0 || $amount <= 0) {
            self::error('An outstanding sale/invoice and a payment amount (> 0 TZS) are required.', 422);
        }

        $pdo->beginTransaction();
        try {
            $saleStmt = $pdo->prepare("SELECT * FROM `sales` WHERE `id` = ? FOR UPDATE");
            $saleStmt->execute([$saleId]);
            $sale = $saleStmt->fetch();

            if (!$sale || $sale['status'] !== 'completed') {
                $pdo->rollBack();
                self::error('Selected sale invoice was not found or is not active.', 404);
            }

            $balanceBefore = (float) $sale['outstanding_balance'];
            if ($balanceBefore <= 0.01) {
                $pdo->rollBack();
                self::error("Sale {$sale['receipt_number']} is already fully paid.", 422);
            }

            // SRS 3.8: Payments must not exceed the remaining outstanding balance
            if ($amount > $balanceBefore + 0.01) {
                $pdo->rollBack();
                self::error(
                    "Repayment amount (TZS " . number_format($amount) . ") cannot exceed the remaining outstanding balance of TZS " . number_format($balanceBefore) . ".",
                    422
                );
            }

            $balanceAfter = max(0.0, round($balanceBefore - $amount, 2));
            $newPaymentStatus = $balanceAfter <= 0.01 ? 'paid' : 'partial';

            // Update sale outstanding balance (Does NOT increase total_amount / sales revenue per SRS 3.8 & 6.8)
            $pdo->prepare("
                UPDATE `sales`
                SET `outstanding_balance` = ?, `payment_status` = ?
                WHERE `id` = ?
            ")->execute([$balanceAfter, $newPaymentStatus, $saleId]);

            $repayReceiptNo = self::nextUniqueCode($pdo, 'customer_payments', 'receipt_number', 'RP-', 5, 41);
            $sessionId = strtolower($paymentMethod) === 'cash' ? FinancialService::getOpenCashSessionId($pdo) : null;

            $pdo->prepare("
                INSERT INTO `customer_payments` (
                    `uuid`, `receipt_number`, `customer_id`, `sale_id`, `cash_session_id`,
                    `amount`, `balance_before`, `balance_after`, `payment_method`,
                    `payment_date`, `notes`, `recorded_by`, `device_id`, `synced_from_offline`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)
            ")->execute([
                $txUuid, $repayReceiptNo, $sale['customer_id'], $saleId, $sessionId,
                $amount, $balanceBefore, $balanceAfter, $paymentMethod,
                $notes, $user['id'], $deviceId, $syncedFromOffline
            ]);
            $repaymentId = (int) $pdo->lastInsertId();

            if ($sessionId && strtolower($paymentMethod) === 'cash') {
                $pdo->prepare("
                    INSERT INTO `cash_movements` (
                        `uuid`, `cash_session_id`, `direction`, `category`, `amount`,
                        `reference_type`, `reference_id`, `description`, `user_id`
                    ) VALUES (?, ?, 'inflow', 'debt_repayment', ?, 'CustomerPayment', ?, ?, ?)
                ")->execute([
                    self::uuid('cm'), $sessionId, $amount, $repaymentId,
                    "Customer debt repayment {$repayReceiptNo} on {$sale['receipt_number']}", $user['id']
                ]);
                FinancialService::recalculateCashSession($pdo, $sessionId);
            }

            AuditService::log(
                $pdo,
                (int) $user['id'],
                'debt.repayment_recorded',
                'CustomerPayment',
                $repaymentId,
                ['sale_id' => $saleId, 'balance_before' => $balanceBefore],
                ['receipt_number' => $repayReceiptNo, 'amount' => $amount, 'balance_after' => $balanceAfter],
                $notes ?? 'Customer debt repayment',
                $deviceId
            );

            $pdo->commit();

            return [
                'success'          => true,
                'status_code'      => 201,
                'message'          => "Repayment {$repayReceiptNo} recorded. Remaining balance: TZS " . number_format($balanceAfter),
                'repayment_id'     => $repaymentId,
                'receipt_number'   => $repayReceiptNo,
                'balance_before'   => $balanceBefore,
                'balance_after'    => $balanceAfter,
                'payment_status'   => $newPaymentStatus,
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            self::error('Failed to record repayment: ' . $e->getMessage(), 500);
        }
    }
}
