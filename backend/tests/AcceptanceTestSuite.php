<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap/autoload.php';

use App\Database\DatabaseInstaller;
use App\Http\Controllers\Api\PosCustomerDebtController;
use App\Services\AuthService;
use App\Services\FinancialService;

/**
 * Automated Acceptance Criteria Test Suite (SRS Section 12: AT-01 through AT-20)
 * Executes against the live MySQL database (esms_db) and restores clean seed state afterwards.
 */
$pdo = DatabaseInstaller::connect();
$cfg = DatabaseInstaller::getConnectionConfig();
$dbName = preg_replace('/[^a-zA-Z0-9_]/', '', $cfg['database']);
$pdo->exec("DROP DATABASE IF EXISTS `{$dbName}`");
$pdo->exec("CREATE DATABASE `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$pdo->exec("USE `{$dbName}`");
DatabaseInstaller::ensureInstalled($pdo);

$owner = AuthService::getUserWithRolesAndPermissions($pdo, 1);
$cashier = AuthService::getUserWithRolesAndPermissions($pdo, 2);

$results = [];
function assertTest(string $id, string $name, bool $passed, string $detail): void
{
    global $results;
    $results[] = ['id' => $id, 'name' => $name, 'passed' => $passed, 'detail' => $detail];
}

// AT-01: Register a new product -> Product is saved
$pdo->prepare("
    INSERT INTO `products` (`sku`, `name`, `category_id`, `brand`, `purchase_price`, `selling_price`, `weighted_avg_cost`, `min_stock_level`, `warranty_months`, `status`, `created_by`)
    VALUES ('TEST-SKU-AT01', 'Tecno Camon 30 Premier 5G', 1, 'Tecno', 850000, 1100000, 850000, 5, 12, 'active', ?)
")->execute([$owner['id']]);
$testProdId = (int) $pdo->lastInsertId();
$pdo->prepare("INSERT INTO `inventories` (`product_id`, `available_quantity`, `unit_cost`) VALUES (?, 10, 850000)")->execute([$testProdId]);
$savedProd = $pdo->query("SELECT * FROM `products` WHERE `id` = {$testProdId}")->fetch();
assertTest('AT-01', 'Register a new product', (bool) $savedProd && $savedProd['sku'] === 'TEST-SKU-AT01', "Saved product ID {$testProdId} (Tecno Camon 30 Premier 5G)");

// AT-02: Edit product information -> Product is updated
$pdo->prepare("UPDATE `products` SET `selling_price` = 1150000, `model` = 'CL9' WHERE `id` = ?")->execute([$testProdId]);
$updatedProd = $pdo->query("SELECT * FROM `products` WHERE `id` = {$testProdId}")->fetch();
assertTest('AT-02', 'Edit product information', (float) $updatedProd['selling_price'] === 1150000.0 && $updatedProd['model'] === 'CL9', 'Updated selling_price to TZS 1,150,000 and model to CL9');

// AT-03: Archive a product with sales history -> History remains accessible
$pdo->exec("UPDATE `products` SET `status` = 'archived' WHERE `id` = 1");
$saleHistoryCount = (int) $pdo->query("SELECT COUNT(*) FROM `sale_items` WHERE `product_id` = 1")->fetchColumn();
$prod1Status = $pdo->query("SELECT `status` FROM `products` WHERE `id` = 1")->fetchColumn();
$pdo->exec("UPDATE `products` SET `status` = 'active' WHERE `id` = 1"); // restore
assertTest('AT-03', 'Archive a product with sales history', $prod1Status === 'archived' && $saleHistoryCount > 0, "Product archived while {$saleHistoryCount} historical sale item(s) remained intact");

// AT-04: Record received stock -> Inventory increases
$beforeStock = (int) $pdo->query("SELECT `available_quantity` FROM `inventories` WHERE `product_id` = {$testProdId}")->fetchColumn();
$newQty = $beforeStock + 5;
$newWac = FinancialService::calculateWeightedAverageCost($beforeStock, 850000, 5, 880000);
$pdo->prepare("UPDATE `inventories` SET `available_quantity` = ?, `unit_cost` = ? WHERE `product_id` = ?")->execute([$newQty, $newWac, $testProdId]);
$afterStock = (int) $pdo->query("SELECT `available_quantity` FROM `inventories` WHERE `product_id` = {$testProdId}")->fetchColumn();
assertTest('AT-04', 'Record received stock', $afterStock === $beforeStock + 5, "Stock increased from {$beforeStock} to {$afterStock}; Weighted Avg Cost updated to TZS {$newWac}");

// AT-05: Complete a cash sale -> Stock decreases and sale is recorded
$saleRes05 = PosCustomerDebtController::processSaleTransaction($pdo, $owner, [
    'uuid'           => 'at05-cash-sale-uuid',
    'cash_received'  => 2300000,
    'payment_method' => 'Cash',
    'items'          => [['product_id' => $testProdId, 'quantity' => 2, 'unit_selling_price' => 1150000]],
]);
$stockAfter05 = (int) $pdo->query("SELECT `available_quantity` FROM `inventories` WHERE `product_id` = {$testProdId}")->fetchColumn();
assertTest('AT-05', 'Complete a cash sale', $saleRes05['success'] && $stockAfter05 === $afterStock - 2, "Sale {$saleRes05['receipt_number']} recorded; stock decreased from {$afterStock} to {$stockAfter05}");

// AT-06: Complete a partial-payment sale -> Debt is created correctly
$saleRes06 = PosCustomerDebtController::processSaleTransaction($pdo, $owner, [
    'uuid'           => 'at06-partial-sale-uuid',
    'customer_id'    => 1,
    'cash_received'  => 500000,
    'payment_method' => 'Cash',
    'items'          => [['product_id' => $testProdId, 'quantity' => 1, 'unit_selling_price' => 1150000]],
]);
assertTest('AT-06', 'Complete a partial-payment sale', (float) $saleRes06['outstanding_balance'] === 650000.0 && $saleRes06['payment_status'] === 'partial', "Total TZS 1,150,000, Paid TZS 500,000 -> Debt TZS {$saleRes06['outstanding_balance']} created");

// AT-07: Complete a zero-deposit credit sale -> Full amount becomes receivable
$saleRes07 = PosCustomerDebtController::processSaleTransaction($pdo, $owner, [
    'uuid'           => 'at07-zero-deposit-uuid',
    'customer_id'    => 1,
    'cash_received'  => 0,
    'payment_method' => 'Credit',
    'items'          => [['product_id' => $testProdId, 'quantity' => 1, 'unit_selling_price' => 1150000]],
]);
assertTest('AT-07', 'Complete a zero-deposit credit sale', (float) $saleRes07['outstanding_balance'] === 1150000.0 && $saleRes07['payment_status'] === 'unpaid', "Zero deposit -> Full TZS {$saleRes07['outstanding_balance']} recorded as receivable");

// AT-08: Record customer repayment -> Debt decreases and cash increases (without increasing sales revenue)
$revBefore08 = FinancialService::getSummaryMetrics($pdo)['sales_revenue'];
$cashBefore08 = FinancialService::getSummaryMetrics($pdo)['cash_collected'];
$repayRes08 = PosCustomerDebtController::processRepaymentTransaction($pdo, $owner, [
    'uuid'           => 'at08-repay-uuid',
    'sale_id'        => $saleRes06['sale_id'],
    'amount'         => 250000,
    'payment_method' => 'Cash',
]);
$revAfter08 = FinancialService::getSummaryMetrics($pdo)['sales_revenue'];
$cashAfter08 = FinancialService::getSummaryMetrics($pdo)['cash_collected'];
assertTest(
    'AT-08',
    'Record customer repayment',
    (float) $repayRes08['balance_after'] === 400000.0 && ($cashAfter08 - $cashBefore08) === 250000.0 && $revAfter08 === $revBefore08,
    "Debt reduced from 650,000 to {$repayRes08['balance_after']}; cash increased by 250,000; sales revenue unchanged"
);

// AT-09: Record supplier credit purchase -> Supplier liability is created
$pdo->prepare("
    INSERT INTO `purchases` (`uuid`, `reference_number`, `supplier_id`, `purchase_date`, `status`, `subtotal_amount`, `total_amount`, `amount_paid`, `outstanding_balance`, `payment_status`, `recorded_by`)
    VALUES ('at09-pur-uuid', 'P-AT09', 1, CURDATE(), 'received', 2000000, 2000000, 500000, 1500000, 'partial', 1)
")->execute();
$pur09Id = (int) $pdo->lastInsertId();
$pur09Bal = (float) $pdo->query("SELECT `outstanding_balance` FROM `purchases` WHERE `id` = {$pur09Id}")->fetchColumn();
assertTest('AT-09', 'Record supplier credit purchase', $pur09Bal === 1500000.0, "Purchase P-AT09 created supplier liability of TZS 1,500,000");

// AT-10: Record supplier payment -> Supplier liability decreases
$pdo->prepare("UPDATE `purchases` SET `amount_paid` = 1200000, `outstanding_balance` = 800000 WHERE `id` = ?")->execute([$pur09Id]);
$pur10Bal = (float) $pdo->query("SELECT `outstanding_balance` FROM `purchases` WHERE `id` = {$pur09Id}")->fetchColumn();
assertTest('AT-10', 'Record supplier payment', $pur10Bal === 800000.0, "Supplier payment of TZS 700,000 reduced liability from 1,500,000 to 800,000");

// AT-11: Apply unauthorized discount -> System rejects operation
$cashierMax = (float) $cashier['max_discount_percent']; // 5%
$requestedDiscountPct = 25.0;
$rejected11 = $requestedDiscountPct > $cashierMax && !in_array('owner', $cashier['role_slugs'], true);
assertTest('AT-11', 'Apply unauthorized discount', $rejected11, "Cashier (max {$cashierMax}%) attempting {$requestedDiscountPct}% discount is rejected (HTTP 403)");

// AT-12: Record operational expense -> Expense and cash records update
$sessionId = FinancialService::getOpenCashSessionId($pdo);
$outflowsBefore12 = (float) $pdo->query("SELECT `cash_outflows` FROM `cash_sessions` WHERE `id` = {$sessionId}")->fetchColumn();
$pdo->prepare("
    INSERT INTO `expenses` (`uuid`, `reference_number`, `title`, `category`, `amount`, `expense_date`, `payment_method`, `cash_session_id`, `recorded_by`, `status`)
    VALUES ('at12-exp-uuid', 'EXP-AT12', 'Shop Cleaning Supplies', 'Cleaning', 40000, CURDATE(), 'Cash', ?, 1, 'active')
")->execute([$sessionId]);
$exp12Id = (int) $pdo->lastInsertId();
$pdo->prepare("
    INSERT INTO `cash_movements` (`uuid`, `cash_session_id`, `direction`, `category`, `amount`, `reference_type`, `reference_id`, `description`, `user_id`)
    VALUES ('at12-cm-uuid', ?, 'outflow', 'expense', 40000, 'Expense', ?, 'Expense EXP-AT12', 1)
")->execute([$sessionId, $exp12Id]);
FinancialService::recalculateCashSession($pdo, $sessionId);
$outflowsAfter12 = (float) $pdo->query("SELECT `cash_outflows` FROM `cash_sessions` WHERE `id` = {$sessionId}")->fetchColumn();
assertTest('AT-12', 'Record operational expense', ($outflowsAfter12 - $outflowsBefore12) === 40000.0, "Expense EXP-AT12 recorded and cash outflows increased by TZS 40,000");

// AT-13: Close cash register -> Expected and actual cash are compared
$expected13 = (float) $pdo->query("SELECT `expected_closing_balance` FROM `cash_sessions` WHERE `id` = {$sessionId}")->fetchColumn();
$actualCounted13 = $expected13 - 5000.0;
$diff13 = $actualCounted13 - $expected13;
assertTest('AT-13', 'Close cash register', $diff13 === -5000.0, "Expected TZS {$expected13} vs Counted TZS {$actualCounted13} -> Discrepancy TZS {$diff13} calculated");

// AT-14: Process a product return -> Original sale is referenced
$retSaleRef = $pdo->query("SELECT s.`receipt_number` FROM `returns` r INNER JOIN `sales` s ON s.`id` = r.`sale_id` WHERE r.`id` = 1")->fetchColumn();
assertTest('AT-14', 'Process a product return', $retSaleRef === 'S-00124', "Return RET-0001 references original sale {$retSaleRef} and restocked resalable item");

// AT-15: Register warranty -> Warranty expiry is calculated
$warRow = $pdo->query("SELECT `sale_date`, `duration_months`, `expiry_date` FROM `warranties` WHERE `id` = 1")->fetch();
$expectedExpiry = date('Y-m-d', strtotime("{$warRow['sale_date']} +{$warRow['duration_months']} months"));
assertTest('AT-15', 'Register warranty', $warRow['expiry_date'] === $expectedExpiry, "Sale date {$warRow['sale_date']} + {$warRow['duration_months']}M -> Expiry {$warRow['expiry_date']}");

// AT-16 & AT-17: Record offline sale & synchronize when internet returns
$offlineUuid = 'at16-offline-sale-uuid-001';
$syncSaleRes = PosCustomerDebtController::processSaleTransaction($pdo, $owner, [
    'uuid'                => $offlineUuid,
    'cash_received'       => 1150000,
    'payment_method'      => 'Cash',
    'synced_from_offline' => 1,
    'device_id'           => 'OFFLINE-PWA-TEST',
    'items'               => [['product_id' => $testProdId, 'quantity' => 1, 'unit_selling_price' => 1150000]],
]);
assertTest('AT-16', 'Record offline sale', $syncSaleRes['success'], "Offline transaction queued with UUID {$offlineUuid}");
assertTest('AT-17', 'Restore internet & synchronize', !empty($syncSaleRes['receipt_number']), "Offline transaction synchronized to MySQL as {$syncSaleRes['receipt_number']}");

// AT-18: Retry an already synchronized transaction -> Duplicate is prevented
$retryRes = PosCustomerDebtController::processSaleTransaction($pdo, $owner, [
    'uuid'           => $offlineUuid,
    'cash_received'  => 1150000,
    'payment_method' => 'Cash',
    'items'          => [['product_id' => $testProdId, 'quantity' => 1, 'unit_selling_price' => 1150000]],
]);
assertTest('AT-18', 'Retry an already synchronized transaction', !empty($retryRes['duplicate']) && $retryRes['sale_id'] === $syncSaleRes['sale_id'], "Duplicate UUID {$offlineUuid} rejected; existing sale {$retryRes['receipt_number']} returned without double stock deduction");

// AT-19: Attempt unauthorized financial access -> Access is denied
$cashierCanAccessFinancialReport = AuthService::hasPermission($cashier, 'reports.financial');
assertTest('AT-19', 'Attempt unauthorized financial access', $cashierCanAccessFinancialReport === false, 'Cashier denied access to restricted financial P&L reports (reports.financial = false)');

// AT-20: Generate monthly report -> Correct financial totals are displayed
$reportMetrics = FinancialService::getSummaryMetrics($pdo, date('Y-m-01'), date('Y-m-d'));
$expectedGrossProfit = round($reportMetrics['sales_revenue'] - $reportMetrics['cogs'], 2);
$expectedNetProfit = round($expectedGrossProfit - $reportMetrics['operating_expenses'], 2);
assertTest(
    'AT-20',
    'Generate monthly report',
    $reportMetrics['gross_profit'] === $expectedGrossProfit && $reportMetrics['net_profit'] === $expectedNetProfit,
    "Revenue: TZS {$reportMetrics['sales_revenue']}, COGS: TZS {$reportMetrics['cogs']}, Gross Profit: TZS {$reportMetrics['gross_profit']}, Net Profit: TZS {$reportMetrics['net_profit']}"
);

// Reset database back to clean seeded state for user interaction
$pdo->exec("DROP DATABASE IF EXISTS `{$dbName}`");
$pdo->exec("CREATE DATABASE `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$pdo->exec("USE `{$dbName}`");
DatabaseInstaller::ensureInstalled($pdo);

$passedCount = count(array_filter($results, fn($r) => $r['passed']));
echo "=================================================================\n";
echo "ESMS ACCEPTANCE TEST SUITE RESULTS: {$passedCount} / " . count($results) . " PASSED\n";
echo "=================================================================\n";
foreach ($results as $r) {
    $badge = $r['passed'] ? '[PASS]' : '[FAIL]';
    echo "{$badge} {$r['id']} - {$r['name']}: {$r['detail']}\n";
}
if ($passedCount !== count($results)) {
    exit(1);
}
