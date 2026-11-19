<?php

namespace App\Services;

use PDO;

/**
 * Financial & Accounting Calculation Engine
 * Strictly implements SRS Section 6 formulas:
 * 6.1 Sales Revenue = Sum of completed sales after discounts, excluding cancelled sales and excluding repayments
 * 6.2 COGS = Sum of (Quantity Sold * Historical Unit Cost)
 * 6.3 Gross Profit = Net Sales Revenue - COGS
 * 6.4 Net Profit = Gross Profit - Operating Expenses
 * 6.5 Customer Debt = Credit Sales - Payments Received - Approved Credits
 * 6.6 Supplier Debt = Credit Purchases - Supplier Payments - Approved Supplier Credits
 * 6.7 Inventory Valuation = Sum of (Available Quantity * Inventory Unit Cost) using Weighted Average Cost
 * 6.8 Cash Balance = Opening Cash + Cash Inflows - Cash Outflows
 */
class FinancialService
{
    public static function getSummaryMetrics(PDO $pdo, ?string $startDate = null, ?string $endDate = null): array
    {
        $dateWhereSales = "s.`status` = 'completed'";
        $paramsSales = [];
        if ($startDate && $endDate) {
            $dateWhereSales .= " AND DATE(s.`sale_date`) BETWEEN ? AND ?";
            $paramsSales = [$startDate, $endDate];
        }

        // 6.1 Sales Revenue, 6.2 COGS, 6.3 Gross Profit & Cash collected from sales
        $stmt = $pdo->prepare("
            SELECT
                COUNT(*) AS sales_count,
                COALESCE(SUM(s.`subtotal_amount`), 0) AS gross_sales,
                COALESCE(SUM(s.`discount_amount`), 0) AS total_discounts,
                COALESCE(SUM(s.`total_amount`), 0) AS sales_revenue,
                COALESCE(SUM(s.`total_cogs`), 0) AS cogs,
                COALESCE(SUM(s.`gross_profit`), 0) AS gross_profit,
                COALESCE(SUM(s.`cash_received` - s.`change_amount`), 0) AS direct_sale_cash
            FROM `sales` s
            WHERE {$dateWhereSales}
        ");
        $stmt->execute($paramsSales);
        $salesRow = $stmt->fetch();

        // Debt Repayments (increases cash collected, reduces AR, NEVER counted as new sales revenue per SRS 6.8)
        $dateWhereRepay = "1=1";
        $paramsRepay = [];
        if ($startDate && $endDate) {
            $dateWhereRepay = "DATE(`payment_date`) BETWEEN ? AND ?";
            $paramsRepay = [$startDate, $endDate];
        }
        $repayStmt = $pdo->prepare("
            SELECT COALESCE(SUM(`amount`), 0) AS repayment_cash
            FROM `customer_payments`
            WHERE {$dateWhereRepay}
        ");
        $repayStmt->execute($paramsRepay);
        $repaymentCash = (float) $repayStmt->fetchColumn();

        // Operating Expenses (SRS 6.4 — separated from inventory purchases)
        $dateWhereExp = "`status` = 'active'";
        $paramsExp = [];
        if ($startDate && $endDate) {
            $dateWhereExp .= " AND `expense_date` BETWEEN ? AND ?";
            $paramsExp = [$startDate, $endDate];
        }
        $expStmt = $pdo->prepare("
            SELECT COALESCE(SUM(`amount`), 0) AS operating_expenses
            FROM `expenses`
            WHERE {$dateWhereExp}
        ");
        $expStmt->execute($paramsExp);
        $operatingExpenses = (float) $expStmt->fetchColumn();

        // 6.5 Customer Debt (Accounts Receivable across all unpaid/partial sales)
        $arStmt = $pdo->query("
            SELECT COALESCE(SUM(`outstanding_balance`), 0) AS accounts_receivable
            FROM `sales`
            WHERE `status` = 'completed' AND `outstanding_balance` > 0
        ");
        $accountsReceivable = (float) $arStmt->fetchColumn();

        // 6.6 Supplier Debt (Accounts Payable across all received/partial purchases)
        $apStmt = $pdo->query("
            SELECT COALESCE(SUM(`outstanding_balance`), 0) AS accounts_payable
            FROM `purchases`
            WHERE `status` IN ('received', 'partially_received') AND `outstanding_balance` > 0
        ");
        $accountsPayable = (float) $apStmt->fetchColumn();

        // 6.7 Inventory Valuation (Weighted Average Cost)
        $invStmt = $pdo->query("
            SELECT
                COUNT(p.`id`) AS total_products,
                COALESCE(SUM(i.`available_quantity`), 0) AS total_available_stock,
                COALESCE(SUM(i.`available_quantity` * i.`unit_cost`), 0) AS inventory_cost_value,
                COALESCE(SUM(i.`available_quantity` * p.`selling_price`), 0) AS inventory_retail_value,
                SUM(CASE WHEN i.`available_quantity` > 0 AND i.`available_quantity` <= p.`min_stock_level` THEN 1 ELSE 0 END) AS low_stock_count,
                SUM(CASE WHEN i.`available_quantity` <= 0 THEN 1 ELSE 0 END) AS out_of_stock_count
            FROM `products` p
            INNER JOIN `inventories` i ON i.`product_id` = p.`id`
            WHERE p.`status` = 'active'
        ");
        $invRow = $invStmt->fetch();

        $salesRevenue = (float) $salesRow['sales_revenue'];
        $cogs = (float) $salesRow['cogs'];
        $grossProfit = $salesRevenue - $cogs;
        $netProfit = $grossProfit - $operatingExpenses;
        $cashCollected = (float) $salesRow['direct_sale_cash'] + $repaymentCash;

        return [
            'sales_count'             => (int) $salesRow['sales_count'],
            'gross_sales'             => (float) $salesRow['gross_sales'],
            'total_discounts'         => (float) $salesRow['total_discounts'],
            'sales_revenue'           => $salesRevenue,
            'cogs'                    => $cogs,
            'gross_profit'            => $grossProfit,
            'operating_expenses'      => $operatingExpenses,
            'net_profit'              => $netProfit,
            'direct_sale_cash'        => (float) $salesRow['direct_sale_cash'],
            'repayment_cash'          => $repaymentCash,
            'cash_collected'          => $cashCollected,
            'accounts_receivable'     => $accountsReceivable,
            'accounts_payable'        => $accountsPayable,
            'total_products'          => (int) $invRow['total_products'],
            'total_available_stock'   => round((float) $invRow['total_available_stock'], 2),
            'inventory_cost_value'    => (float) $invRow['inventory_cost_value'],
            'inventory_retail_value'  => (float) $invRow['inventory_retail_value'],
            'low_stock_count'         => (int) $invRow['low_stock_count'],
            'out_of_stock_count'      => (int) $invRow['out_of_stock_count'],
        ];
    }

    /**
     * Weighted Average Cost calculation when new stock is received (SRS 6.7)
     */
    public static function calculateWeightedAverageCost(
        float $currentQty,
        float $currentUnitCost,
        float $receivedQty,
        float $receivedUnitCost
    ): float {
        if ($receivedQty <= 0) {
            return $currentUnitCost;
        }
        if ($currentQty <= 0) {
            return round($receivedUnitCost, 2);
        }
        $totalValue = ($currentQty * $currentUnitCost) + ($receivedQty * $receivedUnitCost);
        $totalQty = $currentQty + $receivedQty;
        return round($totalValue / $totalQty, 2);
    }

    /**
     * Recalculate open Cash Session totals (SRS 3.11 & 6.8)
     * Expected closing cash = Opening balance + Cash inflows - Cash outflows
     */
    public static function recalculateCashSession(PDO $pdo, int $sessionId): void
    {
        $stmt = $pdo->prepare("
            SELECT
                COALESCE(SUM(CASE WHEN `direction` = 'inflow' THEN `amount` ELSE 0 END), 0) AS inflows,
                COALESCE(SUM(CASE WHEN `direction` = 'outflow' THEN `amount` ELSE 0 END), 0) AS outflows
            FROM `cash_movements`
            WHERE `cash_session_id` = ?
        ");
        $stmt->execute([$sessionId]);
        $row = $stmt->fetch();

        $inflows = (float) $row['inflows'];
        $outflows = (float) $row['outflows'];

        $pdo->prepare("
            UPDATE `cash_sessions`
            SET `cash_inflows` = ?,
                `cash_outflows` = ?,
                `expected_closing_balance` = `opening_balance` + ? - ?
            WHERE `id` = ?
        ")->execute([$inflows, $outflows, $inflows, $outflows, $sessionId]);
    }

    public static function getOpenCashSessionId(PDO $pdo): ?int
    {
        $stmt = $pdo->query("SELECT `id` FROM `cash_sessions` WHERE `status` = 'open' ORDER BY `id` DESC LIMIT 1");
        $id = $stmt->fetchColumn();
        return $id ? (int) $id : null;
    }
}
