<?php

namespace App\Http\Controllers\Api;

use App\Services\AuditService;
use App\Services\FinancialService;
use PDO;

class OperationsSyncController extends BaseApiController
{
    // ========================================================================
    // RETURNS & WARRANTY MANAGEMENT (SRS 3.13 & 3.14 — AT-14, AT-15)
    // ========================================================================
    public static function listReturnsAndWarranties(PDO $pdo, array $user): never
    {
        self::requirePermission($user, ['returns.manage', 'warranties.manage', 'sales.view']);

        $returnsStmt = $pdo->query("
            SELECT r.*,
                   s.`receipt_number` AS sale_receipt_number,
                   COALESCE(c.`full_name`, 'Walk-in Customer') AS customer_name,
                   u.`full_name` AS authorized_by_name
            FROM `returns` r
            INNER JOIN `sales` s ON s.`id` = r.`sale_id`
            LEFT JOIN `customers` c ON c.`id` = r.`customer_id`
            LEFT JOIN `users` u ON u.`id` = r.`authorized_by`
            ORDER BY r.`id` DESC
        ");
        $returns = $returnsStmt->fetchAll();

        $riStmt = $pdo->prepare("
            SELECT ri.*, p.`name` AS product_name, p.`sku`
            FROM `return_items` ri
            INNER JOIN `products` p ON p.`id` = ri.`product_id`
            WHERE ri.`return_id` = ?
        ");
        foreach ($returns as &$ret) {
            $riStmt->execute([$ret['id']]);
            $ret['items'] = $riStmt->fetchAll();
        }

        // Update expired warranties automatically
        $pdo->exec("UPDATE `warranties` SET `status` = 'expired' WHERE `status` = 'active' AND `expiry_date` < CURDATE()");

        $warrantiesStmt = $pdo->query("
            SELECT w.*,
                   s.`receipt_number` AS sale_receipt_number,
                   p.`name` AS product_name,
                   p.`sku`,
                   COALESCE(c.`full_name`, 'Walk-in Customer') AS customer_name,
                   c.`phone` AS customer_phone,
                   DATEDIFF(w.`expiry_date`, CURDATE()) AS days_remaining
            FROM `warranties` w
            INNER JOIN `sales` s ON s.`id` = w.`sale_id`
            INNER JOIN `products` p ON p.`id` = w.`product_id`
            LEFT JOIN `customers` c ON c.`id` = w.`customer_id`
            ORDER BY w.`id` DESC
        ");
        $warranties = $warrantiesStmt->fetchAll();

        $claimsStmt = $pdo->query("
            SELECT wc.*, w.`warranty_number`, w.`serial_or_imei`,
                   p.`name` AS product_name, COALESCE(c.`full_name`, 'Walk-in Customer') AS customer_name,
                   u.`full_name` AS handled_by_name
            FROM `warranty_claims` wc
            INNER JOIN `warranties` w ON w.`id` = wc.`warranty_id`
            INNER JOIN `products` p ON p.`id` = w.`product_id`
            LEFT JOIN `customers` c ON c.`id` = w.`customer_id`
            LEFT JOIN `users` u ON u.`id` = wc.`handled_by`
            ORDER BY wc.`id` DESC
        ");

        self::json([
            'success'    => true,
            'returns'    => $returns,
            'warranties' => $warranties,
            'claims'     => $claimsStmt->fetchAll(),
        ]);
    }

    public static function createReturn(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'returns.manage');
        $data = self::input();

        $saleId = (int) ($data['sale_id'] ?? 0);
        $productId = (int) ($data['product_id'] ?? 0);
        $quantity = round(max(0.01, (float) ($data['quantity'] ?? 1)), 2);
        $rawCondition = $data['condition_status'] ?? 'resalable';
        $conditionStatus = in_array($rawCondition, ['resalable', 'damaged', 'under_inspection'], true)
            ? $rawCondition
            : 'resalable';
        $rawResolution = $data['resolution'] ?? 'exchange';
        $resolution = in_array($rawResolution, ['exchange', 'cash_refund', 'store_credit', 'no_refund_policy'], true)
            ? $rawResolution
            : 'exchange';
        $reason = trim((string) ($data['reason'] ?? ''));
        $notes = trim((string) ($data['notes'] ?? '')) ?: null;

        if ($saleId <= 0 || $productId <= 0 || $reason === '') {
            self::error('Original sale reference, returned product, and return reason are required.', 422);
        }

        $pdo->beginTransaction();
        try {
            $saleStmt = $pdo->prepare("SELECT * FROM `sales` WHERE `id` = ? FOR UPDATE");
            $saleStmt->execute([$saleId]);
            $sale = $saleStmt->fetch();
            if (!$sale) {
                $pdo->rollBack();
                self::error('Referenced original sale transaction not found.', 404);
            }

            $siStmt = $pdo->prepare("SELECT * FROM `sale_items` WHERE `sale_id` = ? AND `product_id` = ? LIMIT 1 FOR UPDATE");
            $siStmt->execute([$saleId, $productId]);
            $saleItem = $siStmt->fetch();
            if (!$saleItem) {
                $pdo->rollBack();
                self::error('The selected product was not part of the referenced original sale.', 422);
            }

            $remainingReturnable = round((float) $saleItem['quantity'] - (float) $saleItem['returned_quantity'], 2);
            if ($quantity > $remainingReturnable + 0.001) {
                $pdo->rollBack();
                self::error("Return quantity ({$quantity}) exceeds remaining sold quantity ({$remainingReturnable}) on {$sale['receipt_number']}.", 422);
            }

            $unitRefund = $resolution === 'cash_refund' || $resolution === 'store_credit'
                ? (float) $saleItem['unit_selling_price']
                : 0.0;
            $refundAmount = isset($data['refund_amount']) && $data['refund_amount'] !== ''
                ? max(0.0, (float) $data['refund_amount'])
                : round($quantity * $unitRefund, 2);

            $returnNumber = self::nextUniqueCode($pdo, 'returns', 'return_number', 'RET-', 4, 1);
            $sessionId = $resolution === 'cash_refund' ? FinancialService::getOpenCashSessionId($pdo) : null;
            $returnStatus = $conditionStatus === 'under_inspection' ? 'pending_inspection' : 'approved';

            $pdo->prepare("
                INSERT INTO `returns` (
                    `uuid`, `return_number`, `sale_id`, `customer_id`, `return_date`,
                    `reason`, `resolution`, `refund_amount`, `cash_session_id`, `status`, `notes`, `authorized_by`
                ) VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?)
            ")->execute([
                self::uuid('ret'), $returnNumber, $saleId, $sale['customer_id'],
                $reason, $resolution, $refundAmount, $sessionId, $returnStatus, $notes, $user['id']
            ]);
            $returnId = (int) $pdo->lastInsertId();

            // SRS 3.13: Only resalable products may automatically return to available stock
            $restocked = $conditionStatus === 'resalable' ? 1 : 0;

            $pdo->prepare("
                INSERT INTO `return_items` (
                    `return_id`, `sale_item_id`, `product_id`, `quantity`,
                    `condition_status`, `restocked`, `unit_refund_amount`, `line_refund_amount`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ")->execute([
                $returnId, $saleItem['id'], $productId, $quantity,
                $conditionStatus, $restocked, $unitRefund, $refundAmount
            ]);

            $pdo->prepare("UPDATE `sale_items` SET `returned_quantity` = `returned_quantity` + ? WHERE `id` = ?")
                ->execute([$quantity, $saleItem['id']]);

            // Update inventory based on condition_status
            $invStmt = $pdo->prepare("SELECT * FROM `inventories` WHERE `product_id` = ? FOR UPDATE");
            $invStmt->execute([$productId]);
            $inv = $invStmt->fetch();
            $prevAvail = round((float) $inv['available_quantity'], 2);

            if ($conditionStatus === 'resalable') {
                $newAvail = round($prevAvail + $quantity, 2);
                $pdo->prepare("UPDATE `inventories` SET `available_quantity` = ? WHERE `product_id` = ?")
                    ->execute([$newAvail, $productId]);

                $pdo->prepare("
                    INSERT INTO `stock_movements` (
                        `uuid`, `product_id`, `movement_type`, `previous_quantity`, `change_quantity`,
                        `new_quantity`, `unit_cost`, `reference_type`, `reference_id`, `reason`, `notes`, `user_id`
                    ) VALUES (?, ?, 'return_resalable', ?, ?, ?, ?, 'Return', ?, ?, ?, ?)
                ")->execute([
                    self::uuid('sm'), $productId, $prevAvail, $quantity, $newAvail,
                    $inv['unit_cost'], $returnId, "Resalable return {$returnNumber} from {$sale['receipt_number']}",
                    $reason, $user['id']
                ]);
            } elseif ($conditionStatus === 'damaged') {
                $pdo->prepare("UPDATE `inventories` SET `damaged_quantity` = `damaged_quantity` + ? WHERE `product_id` = ?")
                    ->execute([$quantity, $productId]);
            } else {
                $pdo->prepare("UPDATE `inventories` SET `under_inspection_quantity` = `under_inspection_quantity` + ? WHERE `product_id` = ?")
                    ->execute([$quantity, $productId]);
            }

            // SRS 3.13: Refunds must be recorded as cash outflows and linked to the original transaction
            if ($resolution === 'cash_refund' && $refundAmount > 0 && $sessionId) {
                $pdo->prepare("
                    INSERT INTO `cash_movements` (
                        `uuid`, `cash_session_id`, `direction`, `category`, `amount`,
                        `reference_type`, `reference_id`, `description`, `user_id`
                    ) VALUES (?, ?, 'outflow', 'customer_refund', ?, 'Return', ?, ?, ?)
                ")->execute([
                    self::uuid('cm'), $sessionId, $refundAmount, $returnId,
                    "Cash refund {$returnNumber} for sale {$sale['receipt_number']}", $user['id']
                ]);
                FinancialService::recalculateCashSession($pdo, $sessionId);
            } elseif ($resolution === 'store_credit' && $refundAmount > 0 && $sale['customer_id']) {
                // Reduce customer debt on the sale if any, or credit customer account
                $newOut = max(0.0, (float) $sale['outstanding_balance'] - $refundAmount);
                $pdo->prepare("
                    UPDATE `sales`
                    SET `outstanding_balance` = ?, `approved_credit_adjustment` = `approved_credit_adjustment` + ?
                    WHERE `id` = ?
                ")->execute([$newOut, $refundAmount, $saleId]);
            }

            AuditService::log(
                $pdo,
                (int) $user['id'],
                'return.processed',
                'Return',
                $returnId,
                ['sale_id' => $saleId, 'receipt_number' => $sale['receipt_number']],
                ['return_number' => $returnNumber, 'condition' => $conditionStatus, 'resolution' => $resolution, 'refund_amount' => $refundAmount, 'restocked' => (bool) $restocked],
                $reason
            );

            $pdo->commit();
            self::json([
                'success'       => true,
                'message'       => "Return {$returnNumber} processed ({$conditionStatus})" . ($restocked ? ' and restocked to available inventory.' : '.'),
                'return_id'     => $returnId,
                'return_number' => $returnNumber,
                'restocked'     => (bool) $restocked,
            ], 201);
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            self::error('Failed to process return: ' . $e->getMessage(), 500);
        }
    }

    public static function registerWarranty(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'warranties.manage');
        $data = self::input();

        $saleId = (int) ($data['sale_id'] ?? 0);
        $productId = (int) ($data['product_id'] ?? 0);
        $durationMonths = max(1, (int) ($data['duration_months'] ?? 12));
        $serialOrImei = trim((string) ($data['serial_or_imei'] ?? '')) ?: null;
        $notes = trim((string) ($data['notes'] ?? '')) ?: null;

        if ($saleId <= 0 || $productId <= 0) {
            self::error('Original sale and product are required to register a warranty.', 422);
        }

        $saleStmt = $pdo->prepare("SELECT * FROM `sales` WHERE `id` = ?");
        $saleStmt->execute([$saleId]);
        $sale = $saleStmt->fetch();
        if (!$sale) {
            self::error('Original sale not found.', 404);
        }

        $saleDate = substr((string) $sale['sale_date'], 0, 10);
        // SRS 3.14 & AT-15: Automatically calculate warranty expiry date
        $expiryDate = date('Y-m-d', strtotime("{$saleDate} +{$durationMonths} months"));
        $status = $expiryDate < date('Y-m-d') ? 'expired' : 'active';

        $warrantyNo = self::nextUniqueCode($pdo, 'warranties', 'warranty_number', 'WAR-' . date('Y') . '-', 3, 1);

        $pdo->prepare("
            INSERT INTO `warranties` (
                `warranty_number`, `sale_id`, `product_id`, `customer_id`,
                `serial_or_imei`, `sale_date`, `duration_months`, `expiry_date`, `status`, `notes`
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([
            $warrantyNo, $saleId, $productId, $sale['customer_id'],
            $serialOrImei, $saleDate, $durationMonths, $expiryDate, $status, $notes
        ]);
        $warrantyId = (int) $pdo->lastInsertId();

        AuditService::log(
            $pdo,
            (int) $user['id'],
            'warranty.registered',
            'Warranty',
            $warrantyId,
            null,
            ['warranty_number' => $warrantyNo, 'sale_date' => $saleDate, 'duration_months' => $durationMonths, 'expiry_date' => $expiryDate],
            'Registered product warranty'
        );

        self::json([
            'success'         => true,
            'message'         => "Warranty {$warrantyNo} registered. Expiry date: {$expiryDate}.",
            'warranty_id'     => $warrantyId,
            'warranty_number' => $warrantyNo,
            'expiry_date'     => $expiryDate,
        ], 201);
    }

    public static function saveWarrantyClaim(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'warranties.manage');
        $data = self::input();

        $warrantyId = (int) ($data['warranty_id'] ?? 0);
        $issueDescription = trim((string) ($data['issue_description'] ?? ''));
        $resolution = (isset($data['resolution']) && in_array($data['resolution'], ['pending', 'repaired', 'replaced', 'rejected'], true))
            ? $data['resolution']
            : 'pending';
        $resolutionNotes = trim((string) ($data['resolution_notes'] ?? '')) ?: null;

        if ($warrantyId <= 0 || $issueDescription === '') {
            self::error('Warranty record and issue description are required.', 422);
        }

        $claimNo = self::nextUniqueCode($pdo, 'warranty_claims', 'claim_number', 'WCL-', 4, 1);

        $pdo->prepare("
            INSERT INTO `warranty_claims` (
                `claim_number`, `warranty_id`, `claim_date`, `issue_description`,
                `resolution`, `resolution_notes`, `handled_by`, `resolved_at`
            ) VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?)
        ")->execute([
            $claimNo, $warrantyId, $issueDescription, $resolution,
            $resolutionNotes, $user['id'], $resolution !== 'pending' ? date('Y-m-d H:i:s') : null
        ]);
        $claimId = (int) $pdo->lastInsertId();

        if ($resolution !== 'pending') {
            $pdo->prepare("UPDATE `warranties` SET `status` = 'claimed' WHERE `id` = ?")->execute([$warrantyId]);
        }

        AuditService::log($pdo, (int) $user['id'], 'warranty_claim.recorded', 'WarrantyClaim', $claimId, null, ['claim_number' => $claimNo, 'resolution' => $resolution]);

        self::json([
            'success'      => true,
            'message'      => "Warranty claim {$claimNo} saved ({$resolution}).",
            'claim_id'     => $claimId,
            'claim_number' => $claimNo,
        ], 201);
    }

    // ========================================================================
    // AUDIT LOGS (SRS 9)
    // ========================================================================
    public static function listAuditLogs(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'audit_logs.view');

        $stmt = $pdo->query("
            SELECT a.*, u.`full_name` AS user_name, u.`username`
            FROM `audit_logs` a
            LEFT JOIN `users` u ON u.`id` = a.`user_id`
            ORDER BY a.`id` DESC
            LIMIT 150
        ");
        self::json(['success' => true, 'audit_logs' => $stmt->fetchAll()]);
    }

    // ========================================================================
    // OFFLINE-FIRST SYNCHRONIZATION (SRS 5.5 & 8 — AT-16, AT-17, AT-18)
    // ========================================================================
    public static function syncBootstrap(PDO $pdo, array $user): never
    {
        $products = $pdo->query("
            SELECT p.*, c.`name` AS category_name, c.`slug` AS category_slug,
                   COALESCE(i.`available_quantity`, 0) AS available_quantity,
                   COALESCE(i.`unit_cost`, p.`purchase_price`) AS inventory_unit_cost
            FROM `products` p
            INNER JOIN `categories` c ON c.`id` = p.`category_id`
            LEFT JOIN `inventories` i ON i.`product_id` = p.`id`
            WHERE p.`status` = 'active'
        ")->fetchAll();

        $isAdmin = in_array('owner', $user['role_slugs'] ?? [], true);
        if (!$isAdmin) {
            foreach ($products as &$pRow) {
                unset($pRow['purchase_price'], $pRow['weighted_avg_cost'], $pRow['inventory_unit_cost']);
            }
            unset($pRow);
        }

        $categories = $pdo->query("SELECT * FROM `categories` WHERE `status` = 'active'")->fetchAll();

        $customers = $pdo->query("
            SELECT c.*,
                   COALESCE(SUM(CASE WHEN s.`status` = 'completed' THEN s.`outstanding_balance` ELSE 0 END), 0) AS outstanding_debt
            FROM `customers` c
            LEFT JOIN `sales` s ON s.`customer_id` = c.`id`
            WHERE c.`account_status` = 'active'
            GROUP BY c.`id`
        ")->fetchAll();

        $openDebts = $pdo->query("
            SELECT s.`id` AS sale_id, s.`receipt_number`, s.`customer_id`,
                   c.`full_name` AS customer_name, s.`total_amount`, s.`outstanding_balance`, s.`due_date`
            FROM `sales` s
            INNER JOIN `customers` c ON c.`id` = s.`customer_id`
            WHERE s.`status` = 'completed' AND s.`outstanding_balance` > 0
        ")->fetchAll();

        $syncLogs = $pdo->query("SELECT * FROM `sync_records` ORDER BY `id` DESC LIMIT 40")->fetchAll();

        self::json([
            'success'       => true,
            'synced_at'     => date('c'),
            'products'      => $products,
            'categories'    => $categories,
            'customers'     => $customers,
            'open_debts'    => $openDebts,
            'sync_records'  => $syncLogs,
        ]);
    }

    public static function syncPushQueue(PDO $pdo, array $user): never
    {
        $data = self::input();
        $transactions = $data['transactions'] ?? [];
        if (!is_array($transactions)) {
            self::error('Invalid offline transactions payload.', 422);
        }

        $results = [];
        foreach ($transactions as $tx) {
            $txUuid = trim((string) ($tx['uuid'] ?? ''));
            $txType = trim((string) ($tx['type'] ?? 'sale'));
            $payload = $tx['payload'] ?? [];
            $deviceId = trim((string) ($tx['device_id'] ?? 'OFFLINE-PWA'));
            $clientTime = $tx['client_timestamp'] ?? date('Y-m-d H:i:s');

            if ($txUuid === '') {
                continue;
            }

            // Check if already in sync_records (AT-18 Duplicate Prevention)
            $chk = $pdo->prepare("SELECT * FROM `sync_records` WHERE `transaction_uuid` = ? LIMIT 1");
            $chk->execute([$txUuid]);
            $existingSync = $chk->fetch();

            if ($existingSync && $existingSync['sync_status'] === 'synced') {
                $results[] = [
                    'uuid'        => $txUuid,
                    'type'        => $txType,
                    'status'      => 'duplicate_ignored',
                    'entity_id'   => (int) $existingSync['entity_id'],
                    'message'     => 'Transaction already synchronized; duplicate prevented.',
                ];
                continue;
            }

            try {
                $payload['uuid'] = $txUuid;
                $payload['device_id'] = $deviceId;
                $payload['synced_from_offline'] = 1;

                if ($txType === 'sale') {
                    $res = PosCustomerDebtController::processSaleTransaction($pdo, $user, $payload);
                    $entityId = $res['sale_id'] ?? null;
                    $syncStatus = !empty($res['duplicate']) ? 'duplicate_ignored' : 'synced';

                    $pdo->prepare("
                        INSERT INTO `sync_records` (
                            `transaction_uuid`, `entity_type`, `entity_id`, `operation`,
                            `payload`, `user_id`, `device_id`, `client_timestamp`, `sync_status`
                        ) VALUES (?, 'Sale', ?, 'create_sale', ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE `sync_status` = VALUES(`sync_status`), `synced_at` = NOW()
                    ")->execute([
                        $txUuid, $entityId, json_encode($payload), $user['id'], $deviceId, $clientTime, $syncStatus
                    ]);

                    $results[] = [
                        'uuid'           => $txUuid,
                        'type'           => 'sale',
                        'status'         => $syncStatus,
                        'entity_id'      => $entityId,
                        'receipt_number' => $res['receipt_number'] ?? null,
                        'message'        => $res['message'] ?? 'Offline sale synchronized.',
                    ];
                } elseif ($txType === 'debt_repayment') {
                    $res = PosCustomerDebtController::processRepaymentTransaction($pdo, $user, $payload);
                    $entityId = $res['repayment_id'] ?? null;
                    $syncStatus = !empty($res['duplicate']) ? 'duplicate_ignored' : 'synced';

                    $pdo->prepare("
                        INSERT INTO `sync_records` (
                            `transaction_uuid`, `entity_type`, `entity_id`, `operation`,
                            `payload`, `user_id`, `device_id`, `client_timestamp`, `sync_status`
                        ) VALUES (?, 'CustomerPayment', ?, 'record_repayment', ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE `sync_status` = VALUES(`sync_status`), `synced_at` = NOW()
                    ")->execute([
                        $txUuid, $entityId, json_encode($payload), $user['id'], $deviceId, $clientTime, $syncStatus
                    ]);

                    $results[] = [
                        'uuid'           => $txUuid,
                        'type'           => 'debt_repayment',
                        'status'         => $syncStatus,
                        'entity_id'      => $entityId,
                        'receipt_number' => $res['receipt_number'] ?? null,
                        'message'        => $res['message'] ?? 'Offline repayment synchronized.',
                    ];
                }
            } catch (\Throwable $e) {
                $pdo->prepare("
                    INSERT INTO `sync_records` (
                        `transaction_uuid`, `entity_type`, `entity_id`, `operation`,
                        `payload`, `user_id`, `device_id`, `client_timestamp`, `sync_status`, `conflict_notes`
                    ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'conflict', ?)
                    ON DUPLICATE KEY UPDATE `sync_status` = 'conflict', `conflict_notes` = VALUES(`conflict_notes`)
                ")->execute([
                    $txUuid, ucfirst($txType), $txType, json_encode($payload), $user['id'], $deviceId, $clientTime, $e->getMessage()
                ]);

                $results[] = [
                    'uuid'    => $txUuid,
                    'type'    => $txType,
                    'status'  => 'conflict',
                    'message' => $e->getMessage(),
                ];
            }
        }

        self::json([
            'success' => true,
            'results' => $results,
        ]);
    }

    // ========================================================================
    // ADMIN REAL-TIME NOTIFICATIONS (Employee Sales, Sold-Out & Expenses)
    // ========================================================================
    private static function requireAdminOwner(array $user): void
    {
        if (!in_array('owner', $user['role_slugs'] ?? [], true)) {
            self::error('Access denied: Admin notifications are reserved for the Shop Admin.', 403);
        }
    }

    public static function listAdminNotifications(PDO $pdo, array $user): never
    {
        self::requireAdminOwner($user);

        $rows = $pdo->query("
            SELECT *
            FROM `admin_notifications`
            WHERE `is_read` = 0
            ORDER BY `id` DESC
            LIMIT 50
        ")->fetchAll();

        $notifications = [];
        foreach ($rows as $row) {
            $notifications[] = [
                'id'            => (int) $row['id'],
                'type'          => $row['type'],
                'severity'      => $row['severity'],
                'title'         => $row['title'],
                'message'       => $row['message'],
                'actor_user_id' => $row['actor_user_id'] !== null ? (int) $row['actor_user_id'] : null,
                'actor_name'    => $row['actor_name'],
                'entity_type'   => $row['entity_type'],
                'entity_id'     => $row['entity_id'] !== null ? (int) $row['entity_id'] : null,
                'amount'        => $row['amount'] !== null ? (float) $row['amount'] : null,
                'meta'          => $row['meta_json'] ? (json_decode((string) $row['meta_json'], true) ?: []) : [],
                'created_at'    => $row['created_at'],
            ];
        }

        self::json([
            'success'       => true,
            'unread_count'  => count($notifications),
            'notifications' => $notifications,
        ]);
    }

    public static function markAdminNotificationRead(PDO $pdo, array $user, int $notificationId): never
    {
        self::requireAdminOwner($user);

        $pdo->prepare("
            UPDATE `admin_notifications`
            SET `is_read` = 1, `read_by` = ?, `read_at` = NOW()
            WHERE `id` = ? AND `is_read` = 0
        ")->execute([(int) $user['id'], $notificationId]);

        $remaining = (int) $pdo->query("SELECT COUNT(*) FROM `admin_notifications` WHERE `is_read` = 0")->fetchColumn();

        self::json([
            'success'      => true,
            'unread_count' => $remaining,
        ]);
    }

    public static function markAllAdminNotificationsRead(PDO $pdo, array $user): never
    {
        self::requireAdminOwner($user);

        $pdo->prepare("
            UPDATE `admin_notifications`
            SET `is_read` = 1, `read_by` = ?, `read_at` = NOW()
            WHERE `is_read` = 0
        ")->execute([(int) $user['id']]);

        self::json([
            'success'      => true,
            'unread_count' => 0,
        ]);
    }
}
