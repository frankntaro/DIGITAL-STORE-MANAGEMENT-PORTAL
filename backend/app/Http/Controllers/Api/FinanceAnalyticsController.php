<?php

namespace App\Http\Controllers\Api;

use App\Services\AuditService;
use App\Services\AuthService;
use App\Services\FinancialService;
use PDO;

class FinanceAnalyticsController extends BaseApiController
{
    // ========================================================================
    // DASHBOARD (SRS 3.1)
    // ========================================================================
    public static function getDashboard(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'dashboard.view');

        $today = date('Y-m-d');
        $todayMetrics = FinancialService::getSummaryMetrics($pdo, $today, $today);
        $allTimeMetrics = FinancialService::getSummaryMetrics($pdo);

        $canSeeFinancials = AuthService::hasPermission($user, 'dashboard.financials');

        $totalCustomers = (int) $pdo->query("SELECT COUNT(*) FROM `customers` WHERE `account_status` = 'active'")->fetchColumn();
        $activeEmployees = (int) $pdo->query("SELECT COUNT(*) FROM `users` WHERE `status` = 'active'")->fetchColumn();

        // Daily Sales Chart (Last 7 days)
        $chartStmt = $pdo->query("
            SELECT DATE(`sale_date`) AS day,
                   COALESCE(SUM(`total_amount`), 0) AS revenue,
                   COALESCE(SUM(`gross_profit`), 0) AS profit,
                   COUNT(*) AS transactions
            FROM `sales`
            WHERE `status` = 'completed'
              AND `sale_date` >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
            GROUP BY DATE(`sale_date`)
            ORDER BY day ASC
        ");
        $salesTrend = $chartStmt->fetchAll();

        // Top Selling Products
        $topProductsStmt = $pdo->query("
            SELECT p.`id`, p.`name`, p.`sku`, p.`image_url`, p.`selling_price`,
                   COALESCE(SUM(si.`quantity`), 0) AS units_sold,
                   COALESCE(SUM(si.`line_total`), 0) AS revenue
            FROM `products` p
            LEFT JOIN `sale_items` si ON si.`product_id` = p.`id`
            LEFT JOIN `sales` s ON s.`id` = si.`sale_id` AND s.`status` = 'completed'
            WHERE p.`status` = 'active'
            GROUP BY p.`id`
            ORDER BY revenue DESC, units_sold DESC
            LIMIT 5
        ");

        // Low-Stock & Out-of-Stock Products (with purchase cost & pending order qty for Admin quick reorder)
        $lowStockStmt = $pdo->query("
            SELECT p.`id`, p.`name`, p.`sku`, p.`unit`, p.`min_stock_level`, p.`image_url`,
                   p.`purchase_price`, p.`selling_price`,
                   c.`name` AS category_name,
                   COALESCE(i.`available_quantity`, 0) AS available_quantity,
                   COALESCE((
                       SELECT SUM(pi.`ordered_quantity`)
                       FROM `purchase_items` pi
                       INNER JOIN `purchases` pu ON pu.`id` = pi.`purchase_id`
                       WHERE pi.`product_id` = p.`id` AND pu.`status` = 'pending'
                   ), 0) AS pending_order_qty
            FROM `products` p
            INNER JOIN `categories` c ON c.`id` = p.`category_id`
            LEFT JOIN `inventories` i ON i.`product_id` = p.`id`
            WHERE p.`status` = 'active' AND COALESCE(i.`available_quantity`, 0) <= p.`min_stock_level`
            ORDER BY i.`available_quantity` ASC
            LIMIT 8
        ");

        // Recent Sales
        $recentSalesStmt = $pdo->query("
            SELECT s.`id`, s.`receipt_number`, s.`sale_date`, s.`total_amount`,
                   s.`payment_status`, s.`payment_method`,
                   COALESCE(c.`full_name`, 'Walk-in Customer') AS customer_name
            FROM `sales` s
            LEFT JOIN `customers` c ON c.`id` = s.`customer_id`
            ORDER BY s.`id` DESC
            LIMIT 6
        ");

        // Recent Purchases & Pending Order Count (Admin-only)
        $canViewPurchases = AuthService::hasPermission($user, 'purchases.view');
        $canManagePurchases = AuthService::hasPermission($user, 'purchases.manage');
        $recentPurchases = [];
        $pendingOrdersCount = 0;
        if ($canViewPurchases) {
            $recentPurchasesStmt = $pdo->query("
                SELECT p.`id`, p.`reference_number`, p.`purchase_date`, p.`total_amount`,
                       p.`status`, p.`payment_status`, s.`name` AS supplier_name
                FROM `purchases` p
                INNER JOIN `suppliers` s ON s.`id` = p.`supplier_id`
                ORDER BY p.`id` DESC
                LIMIT 5
            ");
            $recentPurchases = $recentPurchasesStmt->fetchAll();
        }
        if ($canManagePurchases) {
            $pendingOrdersCount = (int) $pdo->query("SELECT COUNT(*) FROM `purchases` WHERE `status` = 'pending'")->fetchColumn();
        }

        // Newly Purchased & Admin-Approved Products (Immediately visible to Employees upon Admin approval)
        $purchasedProductsStmt = $pdo->query("
            SELECT pi.`id` AS item_id,
                   pr.`id` AS product_id,
                   pr.`name` AS product_name,
                   pr.`sku`,
                   pr.`unit`,
                   pr.`image_url`,
                   pr.`selling_price`,
                   c.`name` AS category_name,
                   COALESCE(i.`available_quantity`, 0) AS available_quantity,
                   pi.`received_quantity`,
                   pu.`reference_number`,
                   pu.`purchase_date`,
                   COALESCE(pu.`approved_at`, pu.`received_at`, CONCAT(pu.`purchase_date`, ' 00:00:00')) AS received_at,
                   ua.`full_name` AS approved_by_name,
                   CASE
                     WHEN COALESCE(pu.`approved_at`, pu.`received_at`, CONCAT(pu.`purchase_date`, ' 00:00:00')) >= DATE_SUB(NOW(), INTERVAL 14 DAY) THEN 1
                     ELSE 0
                   END AS is_new
            FROM `purchase_items` pi
            INNER JOIN `purchases` pu ON pu.`id` = pi.`purchase_id`
            INNER JOIN `products` pr ON pr.`id` = pi.`product_id`
            INNER JOIN `categories` c ON c.`id` = pr.`category_id`
            LEFT JOIN `inventories` i ON i.`product_id` = pr.`id`
            LEFT JOIN `users` ua ON ua.`id` = pu.`approved_by`
            WHERE pu.`status` IN ('received', 'partially_received')
              AND pi.`received_quantity` > 0
              AND pr.`status` = 'active'
            ORDER BY COALESCE(pu.`approved_at`, pu.`received_at`, pu.`created_at`) DESC, pi.`id` DESC
            LIMIT 8
        ");
        $purchasedProducts = $purchasedProductsStmt->fetchAll();

        // Existing / Old Products (Active shop products without a recent Admin-approved purchase)
        $oldProductsStmt = $pdo->query("
            SELECT pr.`id` AS product_id,
                   pr.`name` AS product_name,
                   pr.`sku`,
                   pr.`unit`,
                   pr.`image_url`,
                   pr.`selling_price`,
                   pr.`created_at`,
                   c.`name` AS category_name,
                   COALESCE(i.`available_quantity`, 0) AS available_quantity
            FROM `products` pr
            INNER JOIN `categories` c ON c.`id` = pr.`category_id`
            LEFT JOIN `inventories` i ON i.`product_id` = pr.`id`
            WHERE pr.`status` = 'active'
              AND NOT EXISTS (
                  SELECT 1 FROM `purchase_items` pi2
                  INNER JOIN `purchases` pu2 ON pu2.`id` = pi2.`purchase_id`
                  WHERE pi2.`product_id` = pr.`id`
                    AND pu2.`status` IN ('received', 'partially_received')
                    AND pi2.`received_quantity` > 0
                    AND COALESCE(pu2.`approved_at`, pu2.`received_at`, CONCAT(pu2.`purchase_date`, ' 00:00:00')) >= DATE_SUB(NOW(), INTERVAL 14 DAY)
              )
            ORDER BY COALESCE(i.`available_quantity`, 0) DESC, pr.`id` ASC
            LIMIT 8
        ");
        $oldProducts = $oldProductsStmt->fetchAll();

        // Recent Customer Repayments
        $recentRepaymentsStmt = $pdo->query("
            SELECT cp.`id`, cp.`receipt_number`, cp.`amount`, cp.`payment_date`,
                   c.`full_name` AS customer_name, s.`receipt_number` AS sale_receipt
            FROM `customer_payments` cp
            INNER JOIN `customers` c ON c.`id` = cp.`customer_id`
            INNER JOIN `sales` s ON s.`id` = cp.`sale_id`
            ORDER BY cp.`id` DESC
            LIMIT 5
        ");

        // Recent Expenses
        $recentExpensesStmt = $pdo->query("
            SELECT `id`, `reference_number`, `title`, `category`, `amount`, `expense_date`
            FROM `expenses`
            WHERE `status` = 'active'
            ORDER BY `id` DESC
            LIMIT 5
        ");

        self::json([
            'success' => true,
            'kpis'    => [
                'today_sales'              => $todayMetrics['sales_revenue'],
                'today_cash_collected'     => $todayMetrics['cash_collected'],
                'today_gross_profit'       => $canSeeFinancials ? $todayMetrics['gross_profit'] : null,
                'today_expenses'           => $canSeeFinancials ? $todayMetrics['operating_expenses'] : null,
                'all_time_sales'           => $allTimeMetrics['sales_revenue'],
                'all_time_gross_profit'    => $canSeeFinancials ? $allTimeMetrics['gross_profit'] : null,
                'all_time_net_profit'      => $canSeeFinancials ? $allTimeMetrics['net_profit'] : null,
                'outstanding_customer_debt'=> $allTimeMetrics['accounts_receivable'],
                'outstanding_supplier_debt'=> $canSeeFinancials ? $allTimeMetrics['accounts_payable'] : null,
                'total_products'           => $allTimeMetrics['total_products'],
                'total_available_stock'    => $allTimeMetrics['total_available_stock'],
                'inventory_cost_value'     => $canSeeFinancials ? $allTimeMetrics['inventory_cost_value'] : null,
                'low_stock_count'          => $allTimeMetrics['low_stock_count'],
                'out_of_stock_count'       => $allTimeMetrics['out_of_stock_count'],
                'pending_orders_count'     => $pendingOrdersCount,
                'total_customers'          => $totalCustomers,
                'active_employees'         => $activeEmployees,
                'financials_permitted'     => $canSeeFinancials,
            ],
            'sales_trend'       => $salesTrend,
            'top_products'      => $topProductsStmt->fetchAll(),
            'low_stock'         => $lowStockStmt->fetchAll(),
            'recent_sales'       => $recentSalesStmt->fetchAll(),
            'recent_purchases'   => $recentPurchases,
            'purchased_products' => $purchasedProducts,
            'old_products'       => $oldProducts,
            'recent_repayments'  => $recentRepaymentsStmt->fetchAll(),
            'recent_expenses'    => $canSeeFinancials ? $recentExpensesStmt->fetchAll() : [],
        ]);
    }

    // ========================================================================
    // CASH REGISTER MANAGEMENT (SRS 3.11 — AT-13)
    // ========================================================================
    public static function getCashRegister(PDO $pdo, array $user): never
    {
        self::requirePermission($user, ['cash_register.operate', 'cash_register.review']);

        $openSessionId = FinancialService::getOpenCashSessionId($pdo);
        if ($openSessionId) {
            FinancialService::recalculateCashSession($pdo, $openSessionId);
        }

        $activeStmt = $pdo->query("
            SELECT cs.*, u.`full_name` AS cashier_name
            FROM `cash_sessions` cs
            LEFT JOIN `users` u ON u.`id` = cs.`user_id`
            WHERE cs.`status` = 'open'
            ORDER BY cs.`id` DESC
            LIMIT 1
        ");
        $activeSession = $activeStmt->fetch() ?: null;

        $movements = [];
        if ($activeSession) {
            $mStmt = $pdo->prepare("
                SELECT cm.*, u.`full_name` AS user_name
                FROM `cash_movements` cm
                LEFT JOIN `users` u ON u.`id` = cm.`user_id`
                WHERE cm.`cash_session_id` = ?
                ORDER BY cm.`id` DESC
            ");
            $mStmt->execute([$activeSession['id']]);
            $movements = $mStmt->fetchAll();
        }

        $historyStmt = $pdo->query("
            SELECT cs.*, u.`full_name` AS cashier_name
            FROM `cash_sessions` cs
            LEFT JOIN `users` u ON u.`id` = cs.`user_id`
            ORDER BY cs.`id` DESC
            LIMIT 30
        ");

        self::json([
            'success'        => true,
            'active_session' => $activeSession,
            'movements'      => $movements,
            'history'        => $historyStmt->fetchAll(),
        ]);
    }

    public static function openCashSession(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'cash_register.operate');
        $data = self::input();

        $existingId = FinancialService::getOpenCashSessionId($pdo);
        if ($existingId) {
            self::error('A cash register session is already open. Please close the current shift first.', 422);
        }

        $openingBalance = max(0.0, (float) ($data['opening_balance'] ?? 0));
        $notes = trim((string) ($data['opening_notes'] ?? '')) ?: null;

        $code = self::nextUniqueCode($pdo, 'cash_sessions', 'session_code', 'CS-' . date('Y') . '-', 3, 1);

        $pdo->prepare("
            INSERT INTO `cash_sessions` (
                `session_code`, `user_id`, `opened_at`, `opening_balance`,
                `cash_inflows`, `cash_outflows`, `expected_closing_balance`, `status`, `opening_notes`
            ) VALUES (?, ?, NOW(), ?, 0.00, 0.00, ?, 'open', ?)
        ")->execute([$code, $user['id'], $openingBalance, $openingBalance, $notes]);
        $sessionId = (int) $pdo->lastInsertId();

        AuditService::log(
            $pdo,
            (int) $user['id'],
            'cash_session.opened',
            'CashSession',
            $sessionId,
            null,
            ['session_code' => $code, 'opening_balance' => $openingBalance],
            $notes ?? 'Opened cash register shift'
        );

        self::json([
            'success'      => true,
            'message'      => "Cash session {$code} opened with TZS " . number_format($openingBalance),
            'session_id'   => $sessionId,
            'session_code' => $code,
        ], 201);
    }

    public static function closeCashSession(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'cash_register.operate');
        $data = self::input();

        $sessionId = FinancialService::getOpenCashSessionId($pdo);
        if (!$sessionId) {
            self::error('No open cash register session found to close.', 404);
        }

        if (!isset($data['actual_counted_balance']) || $data['actual_counted_balance'] === '') {
            self::error('Physically counted cash balance is required to close the register.', 422);
        }

        $actualCounted = max(0.0, (float) $data['actual_counted_balance']);
        $closingNotes = trim((string) ($data['closing_notes'] ?? '')) ?: null;

        FinancialService::recalculateCashSession($pdo, $sessionId);

        $stmt = $pdo->prepare("SELECT * FROM `cash_sessions` WHERE `id` = ?");
        $stmt->execute([$sessionId]);
        $session = $stmt->fetch();

        $expected = (float) $session['expected_closing_balance'];
        // Difference = Physically Counted - Expected (positive = surplus, negative = shortage)
        $difference = round($actualCounted - $expected, 2);

        $pdo->prepare("
            UPDATE `cash_sessions`
            SET `actual_counted_balance` = ?,
                `cash_difference` = ?,
                `closing_notes` = ?,
                `status` = 'closed',
                `closed_at` = NOW(),
                `reviewed_by` = ?
            WHERE `id` = ?
        ")->execute([$actualCounted, $difference, $closingNotes, $user['id'], $sessionId]);

        AuditService::log(
            $pdo,
            (int) $user['id'],
            'cash_session.closed',
            'CashSession',
            $sessionId,
            ['expected_closing_balance' => $expected],
            ['actual_counted_balance' => $actualCounted, 'cash_difference' => $difference, 'status' => 'closed'],
            $closingNotes ?? 'Closed daily cash register session'
        );

        self::json([
            'success'                  => true,
            'message'                  => "Cash session {$session['session_code']} closed and reconciled.",
            'expected_closing_balance' => $expected,
            'actual_counted_balance'   => $actualCounted,
            'cash_difference'          => $difference,
        ]);
    }

    // ========================================================================
    // EXPENSES MANAGEMENT (SRS 3.10 — AT-12)
    // ========================================================================
    public static function listExpenses(PDO $pdo, array $user): never
    {
        self::requirePermission($user, ['expenses.view', 'expenses.manage']);

        $stmt = $pdo->query("
            SELECT e.*, u.`full_name` AS recorded_by_name
            FROM `expenses` e
            LEFT JOIN `users` u ON u.`id` = e.`recorded_by`
            ORDER BY e.`id` DESC
        ");
        self::json(['success' => true, 'expenses' => $stmt->fetchAll()]);
    }

    public static function createExpense(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'expenses.manage');
        $data = self::input();

        $title = trim((string) ($data['title'] ?? ''));
        $category = trim((string) ($data['category'] ?? 'Other expenses'));
        $amount = (float) ($data['amount'] ?? 0);
        $expenseDate = trim((string) ($data['expense_date'] ?? date('Y-m-d')));
        $paymentMethod = trim((string) ($data['payment_method'] ?? 'Cash'));
        $description = trim((string) ($data['description'] ?? '')) ?: null;

        if ($title === '' || $amount <= 0) {
            self::error('Expense title and valid amount (> 0 TZS) are required.', 422);
        }

        $pdo->beginTransaction();
        try {
            $refNo = self::nextUniqueCode($pdo, 'expenses', 'reference_number', 'EXP-', 3, 1);
            $sessionId = strtolower($paymentMethod) === 'cash' ? FinancialService::getOpenCashSessionId($pdo) : null;

            $pdo->prepare("
                INSERT INTO `expenses` (
                    `uuid`, `reference_number`, `title`, `category`, `amount`,
                    `expense_date`, `payment_method`, `cash_session_id`, `description`, `recorded_by`, `status`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            ")->execute([
                self::uuid('exp'), $refNo, $title, $category, $amount,
                $expenseDate, $paymentMethod, $sessionId, $description, $user['id']
            ]);
            $expenseId = (int) $pdo->lastInsertId();

            if ($sessionId && strtolower($paymentMethod) === 'cash') {
                $pdo->prepare("
                    INSERT INTO `cash_movements` (
                        `uuid`, `cash_session_id`, `direction`, `category`, `amount`,
                        `reference_type`, `reference_id`, `description`, `user_id`
                    ) VALUES (?, ?, 'outflow', 'expense', ?, 'Expense', ?, ?, ?)
                ")->execute([
                    self::uuid('cm'), $sessionId, $amount, $expenseId,
                    "Expense {$refNo}: {$title}", $user['id']
                ]);
                FinancialService::recalculateCashSession($pdo, $sessionId);
            }

            AuditService::log(
                $pdo,
                (int) $user['id'],
                'expense.created',
                'Expense',
                $expenseId,
                null,
                ['reference_number' => $refNo, 'title' => $title, 'category' => $category, 'amount' => $amount],
                $description ?? 'Recorded operating expense'
            );

            $pdo->commit();
            self::json([
                'success'          => true,
                'message'          => "Expense {$refNo} recorded and reflected in cash register.",
                'expense_id'       => $expenseId,
                'reference_number' => $refNo,
            ], 201);
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            self::error('Failed to record expense: ' . $e->getMessage(), 500);
        }
    }

    // ========================================================================
    // REPORTS & ANALYTICS (SRS 3.16 — AT-19, AT-20)
    // ========================================================================
    public static function getReports(PDO $pdo, array $user): never
    {
        $reportType = $_GET['type'] ?? 'overview';
        $isAdmin = in_array('owner', $user['role_slugs'] ?? [], true);

        if ($reportType === 'financial') {
            // SRS 2.2, 2.3 & AT-19: Attempt unauthorized financial access -> Access is denied
            self::requirePermission($user, 'reports.financial');
        } elseif ($reportType === 'inventory') {
            if (!$isAdmin) {
                self::error('Access denied: Inventory & valuation reports are reserved for the Shop Admin.', 403);
            }
        } else {
            self::requirePermission($user, ['reports.operational', 'reports.financial']);
        }

        $startDate = trim((string) ($_GET['start_date'] ?? date('Y-m-01')));
        $endDate = trim((string) ($_GET['end_date'] ?? date('Y-m-d')));

        $canSeeFinancials = AuthService::hasPermission($user, 'reports.financial');
        $summary = FinancialService::getSummaryMetrics($pdo, $startDate, $endDate);

        if (!$canSeeFinancials) {
            // Strip restricted financial fields if user only has operational report access
            $summary['cogs'] = null;
            $summary['gross_profit'] = null;
            $summary['net_profit'] = null;
            $summary['operating_expenses'] = null;
        }
        if (!$isAdmin) {
            // Inventory & valuation figures on Reports are strictly Admin-only
            $summary['inventory_cost_value'] = null;
            if (array_key_exists('inventory_retail_value', $summary)) {
                $summary['inventory_retail_value'] = null;
            }
        }

        // Sales by Category
        $byCategoryStmt = $pdo->prepare("
            SELECT c.`name` AS category_name,
                   COALESCE(SUM(si.`quantity`), 0) AS units_sold,
                   COALESCE(SUM(si.`line_total`), 0) AS revenue,
                   COALESCE(SUM(si.`line_profit`), 0) AS profit
            FROM `categories` c
            LEFT JOIN `products` p ON p.`category_id` = c.`id`
            LEFT JOIN `sale_items` si ON si.`product_id` = p.`id`
            LEFT JOIN `sales` s ON s.`id` = si.`sale_id`
                AND s.`status` = 'completed'
                AND DATE(s.`sale_date`) BETWEEN ? AND ?
            GROUP BY c.`id`
            ORDER BY revenue DESC
        ");
        $byCategoryStmt->execute([$startDate, $endDate]);

        // Sales by Product
        $byProductStmt = $pdo->prepare("
            SELECT p.`id`, p.`sku`, p.`name`, c.`name` AS category_name,
                   COALESCE(i.`available_quantity`, 0) AS current_stock,
                   COALESCE(SUM(si.`quantity`), 0) AS units_sold,
                   COALESCE(SUM(si.`line_total`), 0) AS revenue,
                   COALESCE(SUM(si.`line_cogs`), 0) AS cogs,
                   COALESCE(SUM(si.`line_profit`), 0) AS profit
            FROM `products` p
            INNER JOIN `categories` c ON c.`id` = p.`category_id`
            LEFT JOIN `inventories` i ON i.`product_id` = p.`id`
            LEFT JOIN `sale_items` si ON si.`product_id` = p.`id`
            LEFT JOIN `sales` s ON s.`id` = si.`sale_id`
                AND s.`status` = 'completed'
                AND DATE(s.`sale_date`) BETWEEN ? AND ?
            WHERE p.`status` = 'active'
            GROUP BY p.`id`
            ORDER BY revenue DESC
        ");
        $byProductStmt->execute([$startDate, $endDate]);

        // Sales by Employee
        $byEmployeeStmt = $pdo->prepare("
            SELECT u.`id`, u.`employee_code`, u.`full_name`,
                   COUNT(s.`id`) AS transactions_count,
                   COALESCE(SUM(s.`total_amount`), 0) AS revenue,
                   COALESCE(SUM(s.`cash_received` - s.`change_amount`), 0) AS cash_collected
            FROM `users` u
            LEFT JOIN `sales` s ON s.`user_id` = u.`id`
                AND s.`status` = 'completed'
                AND DATE(s.`sale_date`) BETWEEN ? AND ?
            GROUP BY u.`id`
            ORDER BY revenue DESC
        ");
        $byEmployeeStmt->execute([$startDate, $endDate]);

        // Expenses breakdown by category
        $expensesByCatStmt = $pdo->prepare("
            SELECT `category`, COUNT(*) AS entries_count, COALESCE(SUM(`amount`), 0) AS total_amount
            FROM `expenses`
            WHERE `status` = 'active' AND `expense_date` BETWEEN ? AND ?
            GROUP BY `category`
            ORDER BY total_amount DESC
        ");
        $expensesByCatStmt->execute([$startDate, $endDate]);

        $productRows = $byProductStmt->fetchAll();
        if (!$isAdmin || !$canSeeFinancials) {
            foreach ($productRows as &$pRow) {
                if (!$isAdmin) {
                    unset($pRow['current_stock']);
                }
                if (!$canSeeFinancials) {
                    unset($pRow['cogs'], $pRow['profit']);
                }
            }
            unset($pRow);
        }

        self::json([
            'success'                       => true,
            'period'                        => ['start_date' => $startDate, 'end_date' => $endDate],
            'financials_permitted'          => $canSeeFinancials,
            'inventory_valuation_permitted' => $isAdmin,
            'summary'                       => $summary,
            'sales_by_category'             => $isAdmin ? $byCategoryStmt->fetchAll() : [],
            'sales_by_product'              => $productRows,
            'sales_by_employee'             => $byEmployeeStmt->fetchAll(),
            'expenses_by_category'          => $canSeeFinancials ? $expensesByCatStmt->fetchAll() : [],
        ]);
    }
}
