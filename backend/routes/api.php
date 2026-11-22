<?php

use App\Database\DatabaseInstaller;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CatalogInventoryController;
use App\Http\Controllers\Api\EmployeeSettingsController;
use App\Http\Controllers\Api\FinanceAnalyticsController;
use App\Http\Controllers\Api\OperationsSyncController;
use App\Http\Controllers\Api\PosCustomerDebtController;
use App\Services\AuthService;

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = '/' . trim(preg_replace('#^/api#', '', $uri), '/');

// Fast Public Health Endpoint (supports GET and HEAD for Render/Koyeb probes & UptimeRobot monitors)
if (($method === 'GET' || $method === 'HEAD') && ($path === '/' || $path === '/health')) {
    $cfg = DatabaseInstaller::getConnectionConfig();
    $payload = [
        'success'       => true,
        'status'        => 'ok',
        'app'           => 'KAMPANGO PHONES AND ELECTRONICS — Digital Store Management Portal API',
        'version'       => '1.0.0',
        'db_configured' => !empty($cfg['host']) && !empty($cfg['database']),
        'currency'      => 'TZS',
    ];
    if ($method === 'GET' && ($_GET['db'] ?? '') === '1') {
        $pdoCheck = DatabaseInstaller::connect();
        DatabaseInstaller::ensureInstalled($pdoCheck);
        $payload['database_ready'] = true;
    }
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    if ($method !== 'HEAD') {
        echo json_encode($payload);
    }
    exit;
}

$pdo = DatabaseInstaller::connect();
DatabaseInstaller::ensureInstalled($pdo);

if ($method === 'POST' && $path === '/auth/login') {
    AuthController::login($pdo);
}

// All subsequent routes require authenticated employee token
$user = AuthService::authenticateRequest($pdo);
if (!$user) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Unauthenticated. Please sign in to continue.']);
    exit;
}

// Auth & Admin Account Settings
if ($method === 'GET' && $path === '/auth/me') {
    AuthController::me($pdo, $user);
}
if ($method === 'POST' && $path === '/auth/logout') {
    AuthController::logout($pdo, $user);
}
if ($method === 'GET' && $path === '/auth/account') {
    AuthController::getAccount($pdo, $user);
}
if ($method === 'PUT' && $path === '/auth/account') {
    AuthController::updateAccountProfile($pdo, $user);
}
if ($method === 'POST' && $path === '/auth/account/password') {
    AuthController::changeAccountPassword($pdo, $user);
}
if ($method === 'POST' && $path === '/auth/account/revoke-sessions') {
    AuthController::revokeOtherSessions($pdo, $user);
}

// Dashboard
if ($method === 'GET' && $path === '/dashboard') {
    FinanceAnalyticsController::getDashboard($pdo, $user);
}

// Categories
if ($method === 'GET' && $path === '/categories') {
    CatalogInventoryController::listCategories($pdo, $user);
}
if ($method === 'POST' && $path === '/categories') {
    CatalogInventoryController::saveCategory($pdo, $user);
}
if (($method === 'PUT' || $method === 'PATCH') && preg_match('#^/categories/(\d+)$#', $path, $m)) {
    CatalogInventoryController::saveCategory($pdo, $user, (int) $m[1]);
}

// Products
if ($method === 'GET' && $path === '/products') {
    CatalogInventoryController::listProducts($pdo, $user);
}
if ($method === 'GET' && preg_match('#^/products/(\d+)$#', $path, $m)) {
    CatalogInventoryController::getProductDetails($pdo, $user, (int) $m[1]);
}
if ($method === 'POST' && $path === '/products') {
    CatalogInventoryController::createProduct($pdo, $user);
}
if ($method === 'PUT' && preg_match('#^/products/(\d+)$#', $path, $m)) {
    CatalogInventoryController::updateProduct($pdo, $user, (int) $m[1]);
}
if ($method === 'PATCH' && preg_match('#^/products/(\d+)/status$#', $path, $m)) {
    CatalogInventoryController::archiveOrRestoreProduct($pdo, $user, (int) $m[1]);
}

// Suppliers & Supplier Payments
if ($method === 'GET' && $path === '/suppliers') {
    CatalogInventoryController::listSuppliers($pdo, $user);
}
if ($method === 'GET' && preg_match('#^/suppliers/(\d+)$#', $path, $m)) {
    CatalogInventoryController::getSupplierProfile($pdo, $user, (int) $m[1]);
}
if ($method === 'POST' && $path === '/suppliers') {
    CatalogInventoryController::saveSupplier($pdo, $user);
}
if ($method === 'PUT' && preg_match('#^/suppliers/(\d+)$#', $path, $m)) {
    CatalogInventoryController::saveSupplier($pdo, $user, (int) $m[1]);
}
if ($method === 'POST' && $path === '/supplier-payments') {
    CatalogInventoryController::recordSupplierPayment($pdo, $user);
}

// Purchases & Order Approvals (Admin Only)
if ($method === 'GET' && $path === '/purchases') {
    CatalogInventoryController::listPurchases($pdo, $user);
}
if ($method === 'POST' && $path === '/purchases') {
    CatalogInventoryController::createPurchase($pdo, $user);
}
if ($method === 'POST' && preg_match('#^/purchases/(\d+)/approve$#', $path, $m)) {
    CatalogInventoryController::approvePurchase($pdo, $user, (int) $m[1]);
}
if ($method === 'POST' && preg_match('#^/purchases/(\d+)/cancel$#', $path, $m)) {
    CatalogInventoryController::cancelPurchase($pdo, $user, (int) $m[1]);
}

// Inventory & Stock Adjustments
if ($method === 'GET' && $path === '/inventory') {
    CatalogInventoryController::getInventoryOverview($pdo, $user);
}
if ($method === 'POST' && $path === '/stock-adjustments') {
    CatalogInventoryController::createStockAdjustment($pdo, $user);
}

// POS & Sales
if ($method === 'GET' && $path === '/sales') {
    PosCustomerDebtController::listSales($pdo, $user);
}
if ($method === 'GET' && preg_match('#^/sales/(\d+)$#', $path, $m)) {
    PosCustomerDebtController::getSaleDetails($pdo, $user, (int) $m[1]);
}
if ($method === 'POST' && $path === '/sales') {
    PosCustomerDebtController::createSale($pdo, $user);
}

// Customers
if ($method === 'GET' && $path === '/customers') {
    PosCustomerDebtController::listCustomers($pdo, $user);
}
if ($method === 'GET' && preg_match('#^/customers/(\d+)$#', $path, $m)) {
    PosCustomerDebtController::getCustomerProfile($pdo, $user, (int) $m[1]);
}
if ($method === 'POST' && $path === '/customers') {
    PosCustomerDebtController::saveCustomer($pdo, $user);
}
if ($method === 'PUT' && preg_match('#^/customers/(\d+)$#', $path, $m)) {
    PosCustomerDebtController::saveCustomer($pdo, $user, (int) $m[1]);
}

// Customer Debts & Repayments
if ($method === 'GET' && $path === '/debts') {
    PosCustomerDebtController::listDebts($pdo, $user);
}
if ($method === 'POST' && $path === '/debt-repayments') {
    PosCustomerDebtController::recordDebtRepayment($pdo, $user);
}

// Cash Register
if ($method === 'GET' && $path === '/cash-register') {
    FinanceAnalyticsController::getCashRegister($pdo, $user);
}
if ($method === 'POST' && $path === '/cash-register/open') {
    FinanceAnalyticsController::openCashSession($pdo, $user);
}
if ($method === 'POST' && $path === '/cash-register/close') {
    FinanceAnalyticsController::closeCashSession($pdo, $user);
}

// Expenses
if ($method === 'GET' && $path === '/expenses') {
    FinanceAnalyticsController::listExpenses($pdo, $user);
}
if ($method === 'POST' && $path === '/expenses') {
    FinanceAnalyticsController::createExpense($pdo, $user);
}

// Returns & Warranty
if ($method === 'GET' && $path === '/returns-warranties') {
    OperationsSyncController::listReturnsAndWarranties($pdo, $user);
}
if ($method === 'POST' && $path === '/returns') {
    OperationsSyncController::createReturn($pdo, $user);
}
if ($method === 'POST' && $path === '/warranties') {
    OperationsSyncController::registerWarranty($pdo, $user);
}
if ($method === 'POST' && $path === '/warranty-claims') {
    OperationsSyncController::saveWarrantyClaim($pdo, $user);
}

// Reports & Analytics
if ($method === 'GET' && $path === '/reports') {
    FinanceAnalyticsController::getReports($pdo, $user);
}

// Employees & Permissions
if ($method === 'GET' && $path === '/employees') {
    EmployeeSettingsController::listEmployees($pdo, $user);
}
if ($method === 'POST' && $path === '/employees') {
    EmployeeSettingsController::createEmployee($pdo, $user);
}
if (($method === 'PUT' || $method === 'PATCH') && preg_match('#^/employees/(\d+)$#', $path, $m)) {
    EmployeeSettingsController::updateEmployee($pdo, $user, (int) $m[1]);
}
if ($method === 'DELETE' && preg_match('#^/employees/(\d+)$#', $path, $m)) {
    EmployeeSettingsController::deleteEmployee($pdo, $user, (int) $m[1]);
}
if ($method === 'POST' && preg_match('#^/employees/(\d+)/reset-password$#', $path, $m)) {
    EmployeeSettingsController::resetPassword($pdo, $user, (int) $m[1]);
}

// Media Uploads
if ($method === 'POST' && $path === '/upload') {
    EmployeeSettingsController::uploadFile($pdo, $user);
}

// Audit Logs
if ($method === 'GET' && $path === '/audit-logs') {
    OperationsSyncController::listAuditLogs($pdo, $user);
}

// Settings & Backups
if ($method === 'GET' && $path === '/settings') {
    EmployeeSettingsController::getSettings($pdo, $user);
}
if ($method === 'PUT' && $path === '/settings') {
    EmployeeSettingsController::updateSettings($pdo, $user);
}
if ($method === 'POST' && $path === '/settings/backup') {
    EmployeeSettingsController::exportBackup($pdo, $user);
}

// Offline Sync
if ($method === 'GET' && $path === '/sync/bootstrap') {
    OperationsSyncController::syncBootstrap($pdo, $user);
}
if ($method === 'POST' && $path === '/sync/push') {
    OperationsSyncController::syncPushQueue($pdo, $user);
}

http_response_code(404);
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['success' => false, 'message' => "API endpoint not found: {$method} {$path}"]);
