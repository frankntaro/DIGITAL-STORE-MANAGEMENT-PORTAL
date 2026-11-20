<?php

namespace App\Database;

use PDO;
use PDOException;

class DatabaseInstaller
{
    private const SCHEMA_VERSION = '2026.11.20.render-tidb-v2';
    private static ?array $cachedConfig = null;
    private static bool $dbJustCreated = false;

    private static function envVal(array $dotEnv, array $keys, string $default = ''): string
    {
        foreach ($keys as $k) {
            $v = getenv($k);
            if ($v !== false && $v !== '') {
                return trim((string) $v);
            }
            if (isset($_ENV[$k]) && $_ENV[$k] !== '') {
                return trim((string) $_ENV[$k]);
            }
            if (isset($_SERVER[$k]) && $_SERVER[$k] !== '') {
                return trim((string) $_SERVER[$k]);
            }
            if (isset($dotEnv[$k]) && $dotEnv[$k] !== '') {
                return trim((string) $dotEnv[$k]);
            }
        }
        return $default;
    }

    public static function getConnectionConfig(): array
    {
        if (self::$cachedConfig !== null) {
            return self::$cachedConfig;
        }

        $envFile = dirname(__DIR__) . '/.env';
        $env = [];
        if (file_exists($envFile)) {
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) {
                    continue;
                }
                $parts = explode('=', $line, 2);
                if (count($parts) === 2) {
                    $env[trim($parts[0])] = trim($parts[1], " \t\n\r\0\x0B\"'");
                }
            }
        }

        // Optional single DATABASE_URL / MYSQL_URL support (Render / Railway / TiDB)
        $urlStr = self::envVal($env, ['MYSQL_URL', 'DATABASE_URL']);
        $urlParts = $urlStr !== '' ? parse_url($urlStr) : false;

        $host = self::envVal($env, ['DB_HOST', 'MYSQLHOST'], is_array($urlParts) && !empty($urlParts['host']) ? (string) $urlParts['host'] : '127.0.0.1');
        $port = self::envVal($env, ['DB_PORT', 'MYSQLPORT'], is_array($urlParts) && !empty($urlParts['port']) ? (string) $urlParts['port'] : '3306');
        $database = self::envVal($env, ['DB_DATABASE', 'DB_NAME', 'MYSQLDATABASE'], is_array($urlParts) && !empty($urlParts['path']) ? ltrim((string) $urlParts['path'], '/') : 'esms_db');
        $username = self::envVal($env, ['DB_USERNAME', 'DB_USER', 'MYSQLUSER'], is_array($urlParts) && !empty($urlParts['user']) ? rawurldecode((string) $urlParts['user']) : 'root');
        $password = self::envVal($env, ['DB_PASSWORD', 'DB_PASS', 'MYSQLPASSWORD'], is_array($urlParts) && isset($urlParts['pass']) ? rawurldecode((string) $urlParts['pass']) : '');

        $sslRaw = strtolower(self::envVal($env, ['DB_SSL'], ''));
        $isTiDb = str_contains(strtolower($host), 'tidbcloud.com') || $port === '4000';
        $useSsl = in_array($sslRaw, ['1', 'true', 'yes', 'required', 'verify_ca'], true) || ($sslRaw === '' && $isTiDb);
        $sslCa = self::envVal($env, ['DB_SSL_CA'], '');

        self::$cachedConfig = [
            'driver'   => self::envVal($env, ['DB_CONNECTION'], 'mysql'),
            'host'     => $host,
            'port'     => $port,
            'database' => $database,
            'username' => $username,
            'password' => $password,
            'ssl'      => $useSsl,
            'ssl_ca'   => $sslCa,
        ];
        return self::$cachedConfig;
    }

    private static function buildPdoOptions(array $cfg, bool $allowPersistent = true): array
    {
        $isLocal = in_array(strtolower((string) $cfg['host']), ['127.0.0.1', 'localhost', '::1'], true);
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_TIMEOUT            => 10,
        ];
        if ($allowPersistent && $isLocal) {
            $options[PDO::ATTR_PERSISTENT] = true;
        }
        if (!empty($cfg['ssl'])) {
            $caCandidates = array_filter([
                $cfg['ssl_ca'] ?? '',
                '/etc/ssl/certs/ca-certificates.crt',
                '/etc/pki/tls/certs/ca-bundle.crt',
                '/etc/ssl/cert.pem',
            ]);
            $caPath = null;
            foreach ($caCandidates as $candidate) {
                if (is_file($candidate)) {
                    $caPath = $candidate;
                    break;
                }
            }
            if ($caPath !== null && defined('PDO::MYSQL_ATTR_SSL_CA')) {
                $options[PDO::MYSQL_ATTR_SSL_CA] = $caPath;
                if (defined('PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT')) {
                    $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = true;
                }
            } elseif (defined('PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT')) {
                $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
            }
        }
        return $options;
    }

    public static function connect(): PDO
    {
        $cfg = self::getConnectionConfig();
        $dbName = preg_replace('/[^a-zA-Z0-9_-]/', '', $cfg['database']);
        $options = self::buildPdoOptions($cfg, true);

        // Fast path: connect directly to the target database without running CREATE DATABASE / USE on every request
        try {
            $dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$dbName};charset=utf8mb4";
            return new PDO($dsn, $cfg['username'], $cfg['password'], $options);
        } catch (PDOException $e) {
            // Only fall back to creating the database if it doesn't exist yet (Error 1049)
            if ((int) ($e->errorInfo[1] ?? 0) !== 1049 && !str_contains($e->getMessage(), 'Unknown database')) {
                throw $e;
            }
        }

        $dsnNoDb = "mysql:host={$cfg['host']};port={$cfg['port']};charset=utf8mb4";
        $pdo = new PDO($dsnNoDb, $cfg['username'], $cfg['password'], self::buildPdoOptions($cfg, false));
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `{$dbName}`");
        self::$dbJustCreated = true;

        return $pdo;
    }

    private static function executeSchemaFile(PDO $pdo, string $filePath): void
    {
        $rawSql = (string) file_get_contents($filePath);
        // Strip single-line SQL comments safely before splitting statements for MySQL & TiDB Cloud compatibility
        $lines = preg_split('/\R/', $rawSql) ?: [];
        $cleanLines = [];
        foreach ($lines as $line) {
            if (preg_match('/^\s*--/', $line)) {
                continue;
            }
            $cleanLines[] = $line;
        }
        $cleanSql = implode("\n", $cleanLines);
        $statements = array_filter(array_map('trim', explode(';', $cleanSql)));
        foreach ($statements as $statement) {
            if ($statement !== '') {
                $pdo->exec($statement);
            }
        }
    }

    private static function stampPath(): string
    {
        return dirname(__DIR__) . '/storage/schema_stamp.json';
    }

    public static function ensureInstalled(PDO $pdo): void
    {
        $cfg = self::getConnectionConfig();
        $dbName = preg_replace('/[^a-zA-Z0-9_-]/', '', $cfg['database']);
        $stampKey = $cfg['host'] . ':' . $cfg['port'] . '/' . $dbName;
        $stampFile = self::stampPath();

        // Fast path: skip heavy DDL/seeder checks once this schema version has already been applied
        if (!self::$dbJustCreated && is_file($stampFile)) {
            $stamp = json_decode((string) @file_get_contents($stampFile), true);
            if (
                is_array($stamp)
                && ($stamp['version'] ?? '') === self::SCHEMA_VERSION
                && ($stamp['target'] ?? '') === $stampKey
            ) {
                return;
            }
        }

        // Check if roles table exists (use fetchAll instead of rowCount for full TiDB/PDO compatibility)
        $stmt = $pdo->query("SHOW TABLES LIKE 'roles'");
        if (empty($stmt->fetchAll())) {
            self::executeSchemaFile($pdo, __DIR__ . '/schema.sql');
        }

        // Check if seeded
        $count = (int) $pdo->query("SELECT COUNT(*) FROM `roles`")->fetchColumn();
        if ($count === 0) {
            self::seed($pdo);
        }

        // Ensure database migrations, performance indexes, and catalog sync
        self::ensureUpgrades($pdo);

        // Persist schema version stamp so subsequent API requests bypass DDL overhead
        $storageDir = dirname($stampFile);
        if (!is_dir($storageDir)) {
            @mkdir($storageDir, 0777, true);
        }
        @file_put_contents($stampFile, json_encode([
            'version'    => self::SCHEMA_VERSION,
            'database'   => $dbName,
            'target'     => $stampKey,
            'applied_at' => date('c'),
        ], JSON_PRETTY_PRINT));
        self::$dbJustCreated = false;
    }

    public static function ensureUpgrades(PDO $pdo): void
    {
        try {
            // Widen image columns only if needed (skips slow redundant TiDB DDL on fresh installs)
            $imgCol = $pdo->query("SHOW COLUMNS FROM `products` LIKE 'image_url'")->fetch();
            if ($imgCol && !str_contains(strtolower((string) ($imgCol['Type'] ?? '')), 'mediumtext')) {
                $pdo->exec("ALTER TABLE `products` MODIFY COLUMN `image_url` MEDIUMTEXT NULL");
            }
            $logoCol = $pdo->query("SHOW COLUMNS FROM `shop_settings` LIKE 'shop_logo'")->fetch();
            if ($logoCol && !str_contains(strtolower((string) ($logoCol['Type'] ?? '')), 'mediumtext')) {
                $pdo->exec("ALTER TABLE `shop_settings` MODIFY COLUMN `shop_logo` MEDIUMTEXT NULL");
            }

            // Support 'pending' purchase order workflow and approval tracking on purchases table
            $purStatusCol = $pdo->query("SHOW COLUMNS FROM `purchases` LIKE 'status'")->fetch();
            if ($purStatusCol && !str_contains(strtolower((string) ($purStatusCol['Type'] ?? '')), "'pending'")) {
                $pdo->exec("
                    ALTER TABLE `purchases`
                    MODIFY COLUMN `status` ENUM('pending', 'draft', 'partially_received', 'received', 'cancelled') NOT NULL DEFAULT 'pending'
                ");
            }
            $hasApprovedBy = $pdo->query("SHOW COLUMNS FROM `purchases` LIKE 'approved_by'")->fetchAll();
            if (empty($hasApprovedBy)) {
                $pdo->exec("ALTER TABLE `purchases` ADD COLUMN `approved_by` BIGINT UNSIGNED NULL AFTER `recorded_by`");
            }
            $hasApprovedAt = $pdo->query("SHOW COLUMNS FROM `purchases` LIKE 'approved_at'")->fetchAll();
            if (empty($hasApprovedAt)) {
                $pdo->exec("ALTER TABLE `purchases` ADD COLUMN `approved_at` TIMESTAMP NULL AFTER `approved_by`");
            }

            // Update shop branding to KAMPANGO PHONES AND ELECTRONICS and main system logo
            $pdo->exec("
                UPDATE `shop_settings`
                SET `shop_name` = 'KAMPANGO PHONES AND ELECTRONICS',
                    `shop_logo` = '/logo.png',
                    `receipt_header` = 'KAMPANGO PHONES AND ELECTRONICS — Genuine Phones, Accessories & Home Electronics'
                WHERE `shop_name` IN ('ElectroHub Tanzania Ltd', 'ElectroHub TZ', 'KAMPANGO PHONES AND ACCESSORIES')
            ");
            $pdo->exec("
                UPDATE `shop_settings`
                SET `shop_logo` = '/logo.png'
                WHERE `shop_logo` IS NULL OR `shop_logo` = ''
            ");
            $pdo->exec("
                UPDATE `products`
                SET `description` = REPLACE(`description`, 'KAMPANGO PHONES AND ACCESSORIES', 'KAMPANGO PHONES AND ELECTRONICS')
                WHERE `description` LIKE '%KAMPANGO PHONES AND ACCESSORIES%'
            ");

            // Enforce strictly 2 roles: Admin ('owner') and Employee ('employee')
            $pdo->exec("
                UPDATE `roles`
                SET `name` = 'Admin',
                    `description` = 'Full system access, purchases, stock adjustments, financial reports, employee & settings management.'
                WHERE `slug` = 'owner'
            ");

            $empRole = $pdo->query("SELECT `id` FROM `roles` WHERE `slug` = 'employee' LIMIT 1")->fetch();
            if (!$empRole) {
                $pdo->exec("
                    INSERT INTO `roles` (`name`, `slug`, `description`, `is_system`)
                    VALUES ('Employee', 'employee', 'Shop employee role for POS sales, products, customers, debts, cash register, expenses, returns & operational reports (excluding purchases and stock adjustments).', 1)
                ");
                $employeeRoleId = (int) $pdo->lastInsertId();
            } else {
                $employeeRoleId = (int) $empRole['id'];
                $pdo->prepare("
                    UPDATE `roles`
                    SET `name` = 'Employee',
                        `description` = 'Shop employee role for POS sales, products, customers, debts, cash register, expenses, returns & operational reports (excluding purchases and stock adjustments).'
                    WHERE `id` = ?
                ")->execute([$employeeRoleId]);
            }

            // Unified Employee permissions:
            // Purchases module (purchases.view, purchases.manage) and Stock Adjustments (inventory.adjust) are STRICTLY Admin-only.
            $unifiedPerms = [
                'dashboard.view',
                'products.view', 'products.manage', 'products.edit_cost', 'categories.manage',
                'suppliers.view', 'suppliers.manage', 'suppliers.pay',
                'inventory.view',
                'pos.sell', 'pos.discount', 'sales.view',
                'customers.view', 'customers.manage', 'debts.view', 'debts.repay',
                'cash_register.operate', 'cash_register.review',
                'expenses.view', 'expenses.manage',
                'returns.manage', 'warranties.manage',
                'reports.operational'
            ];

            $permMap = $pdo->query("SELECT `slug`, `id` FROM `permissions`")->fetchAll(PDO::FETCH_KEY_PAIR);

            // Reset employee role permissions cleanly to exclude purchases & stock adjustments
            $pdo->prepare("DELETE FROM `role_permissions` WHERE `role_id` = ?")->execute([$employeeRoleId]);
            $insRp = $pdo->prepare("INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) VALUES (?, ?)");
            foreach ($unifiedPerms as $slug) {
                if (isset($permMap[$slug])) {
                    $insRp->execute([$employeeRoleId, (int) $permMap[$slug]]);
                }
            }

            // Reassign all non-owner staff strictly to the single 'employee' role and remove legacy cashier/inventory_manager roles
            $ownerRoleId = (int) $pdo->query("SELECT `id` FROM `roles` WHERE `slug` = 'owner' LIMIT 1")->fetchColumn();
            $nonAdmins = $pdo->query("
                SELECT u.`id` FROM `users` u
                WHERE u.`id` NOT IN (SELECT `user_id` FROM `user_roles` WHERE `role_id` = {$ownerRoleId})
            ")->fetchAll(PDO::FETCH_COLUMN);

            $delOldUr = $pdo->prepare("DELETE FROM `user_roles` WHERE `user_id` = ?");
            $insUr = $pdo->prepare("INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`) VALUES (?, ?)");
            $adminOnlySlugs = ['inventory.adjust', 'purchases.view', 'purchases.manage'];
            $delUp = $pdo->prepare("DELETE FROM `user_permissions` WHERE `user_id` = ? AND `permission_id` = ?");

            foreach ($nonAdmins as $uid) {
                $delOldUr->execute([$uid]);
                $insUr->execute([$uid, $employeeRoleId]);
                foreach ($adminOnlySlugs as $restrictedSlug) {
                    if (isset($permMap[$restrictedSlug])) {
                        $delUp->execute([$uid, (int) $permMap[$restrictedSlug]]);
                    }
                }
            }

            // Permanently remove legacy 'cashier' and 'inventory_manager' roles
            $legacyRoleIds = $pdo->query("SELECT `id` FROM `roles` WHERE `slug` IN ('cashier', 'inventory_manager')")->fetchAll(PDO::FETCH_COLUMN);
            if (!empty($legacyRoleIds)) {
                $inList = implode(',', array_map('intval', $legacyRoleIds));
                $pdo->exec("DELETE FROM `role_permissions` WHERE `role_id` IN ({$inList})");
                $pdo->exec("DELETE FROM `user_roles` WHERE `role_id` IN ({$inList})");
                $pdo->exec("DELETE FROM `roles` WHERE `id` IN ({$inList})");
            }

            // Support selling products by meter ('meter') vs piece ('piece') with decimal quantities (e.g. Carpets)
            $hasProductUnit = $pdo->query("SHOW COLUMNS FROM `products` LIKE 'unit'")->fetchAll();
            if (empty($hasProductUnit)) {
                $pdo->exec("ALTER TABLE `products` ADD COLUMN `unit` VARCHAR(20) NOT NULL DEFAULT 'piece' AFTER `weighted_avg_cost`");
            }
            $hasSaleUnit = $pdo->query("SHOW COLUMNS FROM `sale_items` LIKE 'unit_snapshot'")->fetchAll();
            if (empty($hasSaleUnit)) {
                $pdo->exec("ALTER TABLE `sale_items` ADD COLUMN `unit_snapshot` VARCHAR(20) NOT NULL DEFAULT 'piece' AFTER `sku_snapshot`");
            }
            $invQtyCol = $pdo->query("SHOW COLUMNS FROM `inventories` LIKE 'available_quantity'")->fetch();
            if ($invQtyCol && !str_contains(strtolower((string) ($invQtyCol['Type'] ?? '')), 'decimal')) {
                $pdo->exec("ALTER TABLE `products` MODIFY COLUMN `min_stock_level` DECIMAL(12,2) NOT NULL DEFAULT 5.00");
                $pdo->exec("ALTER TABLE `inventories` MODIFY COLUMN `available_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00, MODIFY COLUMN `reserved_offline_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00, MODIFY COLUMN `damaged_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00, MODIFY COLUMN `under_inspection_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00");
                $pdo->exec("ALTER TABLE `stock_movements` MODIFY COLUMN `previous_quantity` DECIMAL(12,2) NOT NULL, MODIFY COLUMN `change_quantity` DECIMAL(12,2) NOT NULL, MODIFY COLUMN `new_quantity` DECIMAL(12,2) NOT NULL");
                $pdo->exec("ALTER TABLE `purchase_items` MODIFY COLUMN `ordered_quantity` DECIMAL(12,2) NOT NULL, MODIFY COLUMN `received_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00");
                $pdo->exec("ALTER TABLE `sale_items` MODIFY COLUMN `quantity` DECIMAL(12,2) NOT NULL, MODIFY COLUMN `returned_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00");
                $pdo->exec("ALTER TABLE `return_items` MODIFY COLUMN `quantity` DECIMAL(12,2) NOT NULL");
            }
            $pdo->exec("
                UPDATE `products`
                SET `unit` = 'meter'
                WHERE (LOWER(`name`) LIKE '%carpet%' OR LOWER(`name`) LIKE '%zulia%')
                  AND `unit` != 'meter'
            ");

            // Repair any blank ENUM status rows previously cleared by omitted status payload on edit
            $pdo->exec("UPDATE `products` SET `status` = 'active' WHERE `status` = '' OR `status` IS NULL");
            $pdo->exec("UPDATE `users` SET `status` = 'active' WHERE `status` = '' OR `status` IS NULL");

            // Sync real KAMPANGO PHONES AND ELECTRONICS shop categories & products and remove computer/laptop category
            ShopCatalogSeeder::syncCatalog($pdo);

            // Add performance indexes on high-traffic lookup columns (idempotent)
            $indexes = [
                ['products', 'idx_products_status_cat', '(`status`, `category_id`)'],
                ['sales', 'idx_sales_status_date', '(`status`, `sale_date`)'],
                ['sales', 'idx_sales_customer_bal', '(`customer_id`, `outstanding_balance`)'],
                ['purchases', 'idx_purchases_status_date', '(`status`, `purchase_date`)'],
                ['stock_movements', 'idx_sm_product_created', '(`product_id`, `created_at`)'],
                ['personal_access_tokens', 'idx_pat_user_exp', '(`user_id`, `expires_at`)'],
            ];
            foreach ($indexes as [$tbl, $idxName, $cols]) {
                $chkIdx = $pdo->prepare("SHOW INDEX FROM `{$tbl}` WHERE Key_name = ?");
                $chkIdx->execute([$idxName]);
                if (empty($chkIdx->fetchAll())) {
                    $pdo->exec("ALTER TABLE `{$tbl}` ADD INDEX `{$idxName}` {$cols}");
                }
            }
        } catch (\Throwable $e) {
            // Silently continue if tables are still initializing
        }
    }

    public static function seed(PDO $pdo): void
    {
        $pdo->beginTransaction();
        try {
            // 1. Seed Roles: Strictly Admin ('owner') and Employee ('employee')
            $roles = [
                ['Admin', 'owner', 'Full system access, purchases, stock adjustments, financial reports, employee & settings management.', 1],
                ['Employee', 'employee', 'Shop employee role for POS sales, products, customers, debts, cash register, expenses, returns & operational reports (excluding purchases and stock adjustments).', 1],
            ];
            $roleStmt = $pdo->prepare("INSERT INTO `roles` (`name`, `slug`, `description`, `is_system`) VALUES (?, ?, ?, ?)");
            $roleIds = [];
            foreach ($roles as $r) {
                $roleStmt->execute($r);
                $roleIds[$r[1]] = (int) $pdo->lastInsertId();
            }

            // 2. Seed Permissions (SRS Section 2.1 - 2.4)
            $permissions = [
                // Dashboard
                ['View Operational Dashboard', 'dashboard.view', 'Dashboard', 'View daily operational indicators and stock alerts'],
                ['View Financial KPIs & Profit', 'dashboard.financials', 'Dashboard', 'View gross profit, net profit, and cost valuations on dashboard'],
                // Products & Categories
                ['View Products', 'products.view', 'Products', 'Browse and search product catalogue'],
                ['Manage Products', 'products.manage', 'Products', 'Create, edit, archive, and restore products'],
                ['Modify Product Purchase Cost', 'products.edit_cost', 'Products', 'Change product purchase price and cost parameters'],
                ['Manage Categories', 'categories.manage', 'Categories', 'Create, edit, and archive product categories'],
                // Purchases & Suppliers
                ['View Purchases', 'purchases.view', 'Purchases', 'View purchase orders and goods receipt history'],
                ['Record & Receive Purchases', 'purchases.manage', 'Purchases', 'Create purchase orders and confirm received stock'],
                ['View Suppliers', 'suppliers.view', 'Suppliers', 'View supplier directory and purchase history'],
                ['Manage Suppliers', 'suppliers.manage', 'Suppliers', 'Create and edit supplier records'],
                ['Record Supplier Payments', 'suppliers.pay', 'Suppliers', 'Pay supplier balances and record supplier credits'],
                // Inventory
                ['View Inventory', 'inventory.view', 'Inventory', 'Monitor stock levels, low-stock and out-of-stock alerts'],
                ['Record Stock Adjustments', 'inventory.adjust', 'Inventory', 'Record damaged, missing, lost, or physical count adjustments'],
                // POS & Sales
                ['Create POS Sales', 'pos.sell', 'POS', 'Process retail sales and print/share receipts'],
                ['Apply Authorized Discounts', 'pos.discount', 'POS', 'Apply discounts within employee limit'],
                ['Override Discount Limits', 'pos.override_discount', 'POS', 'Approve discounts above standard cashier limit'],
                ['View Sales History', 'sales.view', 'Sales', 'View completed sales transactions and receipts'],
                ['Reverse / Cancel Sales', 'sales.reverse', 'Sales', 'Authorize sales cancellation or reversal'],
                // Customers & Debts
                ['View Customers', 'customers.view', 'Customers', 'Search and view customer profiles and statements'],
                ['Manage Customers', 'customers.manage', 'Customers', 'Register and edit customer records'],
                ['View Customer Debts', 'debts.view', 'Customer Debts', 'View unpaid and partially paid credit sales'],
                ['Record Debt Repayments', 'debts.repay', 'Customer Debts', 'Collect customer debt repayments and issue receipts'],
                ['Approve Credit & Debt Adjustments', 'debts.adjust', 'Customer Debts', 'Configure credit limits and approve debt adjustments'],
                // Cash Register & Expenses
                ['Operate Cash Register', 'cash_register.operate', 'Cash Register', 'Open and close shift cash sessions'],
                ['Review & Audit Cash Sessions', 'cash_register.review', 'Cash Register', 'Review historical cash sessions and discrepancies'],
                ['View Expenses', 'expenses.view', 'Expenses', 'View operating expenses'],
                ['Record & Manage Expenses', 'expenses.manage', 'Expenses', 'Record business operating expenses and withdrawals'],
                // Returns & Warranty
                ['Process Returns & Refunds', 'returns.manage', 'Returns', 'Record product returns, exchanges, and refunds'],
                ['Manage Warranties & Claims', 'warranties.manage', 'Warranty', 'Register warranties and resolve warranty claims'],
                // Reports, Employees, Audit & Settings
                ['View Operational Reports', 'reports.operational', 'Reports', 'View inventory and sales volume reports'],
                ['View Restricted Financial Reports', 'reports.financial', 'Reports', 'Access P&L, COGS, net profit, and cash flow reports'],
                ['Manage Employees & Permissions', 'employees.manage', 'Employees', 'Register employees and assign roles/permissions'],
                ['Access Audit Logs', 'audit_logs.view', 'Audit', 'View sensitive activity audit logs'],
                ['Configure System Settings & Backups', 'settings.manage', 'Settings', 'Modify shop settings, policies, and backups'],
            ];

            $permStmt = $pdo->prepare("INSERT INTO `permissions` (`name`, `slug`, `module`, `description`) VALUES (?, ?, ?, ?)");
            $permIds = [];
            foreach ($permissions as $p) {
                $permStmt->execute($p);
                $permIds[$p[1]] = (int) $pdo->lastInsertId();
            }

            // Map Role Permissions
            $rpStmt = $pdo->prepare("INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES (?, ?)");
            // Owner gets ALL permissions
            foreach ($permIds as $slug => $pid) {
                $rpStmt->execute([$roleIds['owner'], $pid]);
            }
            // Unified Employee permissions (Purchases & Stock Adjustments strictly Admin-only)
            $unifiedEmployeePerms = [
                'dashboard.view',
                'products.view', 'products.manage', 'products.edit_cost', 'categories.manage',
                'suppliers.view', 'suppliers.manage', 'suppliers.pay',
                'inventory.view',
                'pos.sell', 'pos.discount', 'sales.view',
                'customers.view', 'customers.manage', 'debts.view', 'debts.repay',
                'cash_register.operate', 'cash_register.review',
                'expenses.view', 'expenses.manage',
                'returns.manage', 'warranties.manage',
                'reports.operational'
            ];
            foreach ($unifiedEmployeePerms as $slug) {
                if (isset($permIds[$slug])) {
                    $rpStmt->execute([$roleIds['employee'], $permIds[$slug]]);
                }
            }

            // 3. Seed Users (Admin + Sample Employee)
            $userStmt = $pdo->prepare("
                INSERT INTO `users` (`employee_code`, `full_name`, `username`, `email`, `phone`, `password_hash`, `status`, `max_discount_percent`, `can_approve_credit`, `last_login_at`)
                VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, NOW())
            ");
            $userRoleStmt = $pdo->prepare("INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES (?, ?)");

            // Admin: admin / admin123
            $userStmt->execute([
                'EMP-001', 'Neema Tarimo (Admin)', 'admin', 'admin@kampango.co.tz', '+255 712 345 678',
                password_hash('admin123', PASSWORD_BCRYPT), 100.00, 1
            ]);
            $ownerId = (int) $pdo->lastInsertId();
            $userRoleStmt->execute([$ownerId, $roleIds['owner']]);

            // Sample Employee: amina / cashier123
            $userStmt->execute([
                'EMP-002', 'Amina Juma', 'amina', 'amina@kampango.co.tz', '+255 754 210 987',
                password_hash('cashier123', PASSWORD_BCRYPT), 5.00, 0
            ]);
            $cashierId = (int) $pdo->lastInsertId();
            $userRoleStmt->execute([$cashierId, $roleIds['employee']]);

            // Alias for initial stock / purchase seed records (performed by Admin)
            $stockMgrId = $ownerId;

            // 4. Seed Shop Settings (TZS)
            $pdo->exec("
                INSERT INTO `shop_settings` (
                    `shop_name`, `shop_logo`, `shop_address`, `contact_phone`, `contact_email`, `tin_number`,
                    `currency`, `receipt_header`, `receipt_footer`, `default_credit_limit`,
                    `max_cashier_discount_percent`, `default_warranty_months`, `default_low_stock_threshold`,
                    `allow_credit_sales`, `require_credit_approval`, `auto_sync_enabled`, `last_backup_at`
                ) VALUES (
                    'KAMPANGO PHONES AND ELECTRONICS',
                    '/logo.png',
                    'Kariakoo, Msimbazi & Aggrey Street, Dar es Salaam',
                    '+255 712 345 678',
                    'sales@kampango.co.tz',
                    'TIN-142-889-301',
                    'TZS',
                    'KAMPANGO PHONES AND ELECTRONICS — Genuine Phones, Accessories & Home Electronics',
                    'Asante kwa kununua kwetu! Karibu tena kwa bidhaa bora za kielektroniki.',
                    2500000.00,
                    5.00,
                    12,
                    5,
                    1,
                    0,
                    1,
                    NOW()
                )
            ");

            // 5. Seed Default Shop Categories (No Computer/Laptop category — only Computer Mouse & Keyboard under Phone Accessories)
            $defaultCategories = [
                ['Mobile Phones', 'mobile-phones', 'Smartphone', 'Smartphones, used phones, and feature phones (Itel, Samsung, Redmi, Philips, etc.)', 1],
                ['Phone Accessories', 'phone-accessories', 'ShieldCheck', 'Phone covers, tempered glass, casings, phone batteries, plus computer mouse & keyboard', 1],
                ['Chargers and Cables', 'chargers-and-cables', 'Zap', 'Fast chargers, adapters (40W–75W), USB-C & Lightning cables, power cables, and tapes', 1],
                ['Earphones and Headphones', 'earphones-and-headphones', 'Headphones', 'Wireless earbuds, pods (JBL, Oraimo, Awei, NT King), and wireless microphones', 1],
                ['Speakers & Radios', 'speakers', 'Volume2', 'Seapiano, Sundar, Skywood, Alitop speakers, subwoofers (bufa), and portable radios', 1],
                ['Tablets', 'tablets', 'Tablet', 'iPads, Android tablets, and educational slates', 1],
                ['Smartwatches', 'smartwatches', 'Watch', 'Fitness trackers and smartwatches', 1],
                ['Memory Cards and Flash Drives', 'memory-cards-and-flash-drives', 'HardDrive', 'Memory cards (Nokia, SanDisk), USB flash drives, and pen drives', 1],
                ['Other Electronics', 'other-electronics', 'Cpu', 'Power banks, routers, inverters, and smart home gadgets', 1],
            ];
            $catStmt = $pdo->prepare("INSERT INTO `categories` (`name`, `slug`, `icon`, `description`, `is_default`, `status`) VALUES (?, ?, ?, ?, ?, 'active')");
            $catIds = [];
            foreach ($defaultCategories as $c) {
                $catStmt->execute($c);
                $catIds[$c[1]] = (int) $pdo->lastInsertId();
            }

            // 6. Seed Suppliers
            $suppliers = [
                ['SUP-001', 'TechWorld Distributors TZ', 'Farid Kassim', '+255 713 800 111', 'orders@techworld.co.tz', 'Kariakoo Uhuru Towers, Dar es Salaam', 'Authorized Samsung & Apple distributor'],
                ['SUP-002', 'SimuPlus Wholesale Hub', 'Grace Mushi', '+255 755 902 440', 'supply@simuplus.co.tz', 'Samora Avenue, Dar es Salaam', 'Accessories, Oraimo, Anker & audio wholesale'],
                ['SUP-003', 'Kampango Electronics Wholesale', 'Rajesh Patel', '+255 786 112 300', 'sales@kampangowholesale.co.tz', 'Posta Mpya, Dar es Salaam', 'TVs, fridges, solar systems, and storage media'],
            ];
            $supStmt = $pdo->prepare("INSERT INTO `suppliers` (`supplier_code`, `name`, `contact_person`, `phone`, `email`, `address`, `notes`, `status`) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')");
            $supIds = [];
            foreach ($suppliers as $s) {
                $supStmt->execute($s);
                $supIds[$s[0]] = (int) $pdo->lastInsertId();
            }

            // 7. Seed Core Products & Initial Inventory (TZS prices; full shop catalog synced via ShopCatalogSeeder)
            $products = [
                // [sku, barcode, name, cat_slug, brand, model, purchase_price, selling_price, min_stock, warranty_months, initial_qty, image_url, description]
                ['PHN-IP15P-256', '890100100001', 'iPhone 15 Pro 256GB', 'mobile-phones', 'Apple', 'A3102 Titanium', 2450000.00, 2850000.00, 5, 12, 14, 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300&q=80', 'Natural Titanium, 256GB storage, A17 Pro chip, 1-year Apple warranty'],
                ['PHN-S24U-256', '890100100002', 'Samsung Galaxy S24 Ultra 256GB', 'mobile-phones', 'Samsung', 'SM-S928B', 2600000.00, 3050000.00, 5, 12, 10, 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=300&q=80', 'Titanium Gray, 12GB RAM, 256GB storage, built-in S-Pen'],
                ['PHN-A55-128', '890100100003', 'Samsung Galaxy A55 5G 128GB', 'mobile-phones', 'Samsung', 'SM-A556E', 780000.00, 950000.00, 8, 12, 22, 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=300&q=80', 'Awesome Iceblue, 8GB RAM, 128GB storage, 5000mAh battery'],
                ['PHN-RN13-256', '890100100004', 'Xiaomi Redmi Note 13 Pro 256GB', 'mobile-phones', 'Xiaomi', '23117RA68G', 520000.00, 650000.00, 10, 12, 4, 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&q=80', '200MP camera, 67W turbo charging, AMOLED 120Hz display'],
                ['EAR-APP2-USB', '890100100005', 'Apple AirPods Pro (2nd Gen USB-C)', 'earphones-and-headphones', 'Apple', 'MTJV3', 480000.00, 620000.00, 6, 12, 18, 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=300&q=80', 'Active Noise Cancellation, Adaptive Audio, MagSafe Charging Case'],
                ['CHG-ANK-45W', '890100100006', 'Anker 45W Super Fast Type-C Charger', 'chargers-and-cables', 'Anker', 'Nano II 45W', 45000.00, 75000.00, 15, 6, 40, 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&q=80', 'GaN II PPS fast wall charger with 6ft USB-C to USB-C cable'],
                ['ACC-MAG-CASE', '890100100007', 'iPhone 15 Pro MagSafe Silicone Case', 'phone-accessories', 'Apple', 'MT1L3', 25000.00, 45000.00, 15, 3, 65, 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=300&q=80', 'Shockproof MagSafe clear & silicone protective cover'],
                ['WCH-AW9-45', '890100100009', 'Apple Watch Series 9 GPS 45mm', 'smartwatches', 'Apple', 'MR9A3', 820000.00, 1050000.00, 5, 12, 3, 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=300&q=80', 'Midnight Aluminum Case with Midnight Sport Band, S9 SiP'],
                ['SPK-JBL-FL6', '890100100010', 'JBL Flip 6 Waterproof Bluetooth Speaker', 'speakers', 'JBL', 'Flip 6', 240000.00, 320000.00, 6, 12, 12, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300&q=80', 'IP67 waterproof and dustproof, 12 hours playtime, PartyBoost'],
                ['MEM-SD-128', '890100100011', 'SanDisk Extreme 128GB microSDXC U3', 'memory-cards-and-flash-drives', 'SanDisk', 'SDSQXAA-128G', 32000.00, 55000.00, 12, 24, 30, 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=300&q=80', 'Up to 190MB/s read speed, 4K UHD ready, includes SD adapter'],
                ['OTH-ORA-20K', '890100100012', 'Oraimo 20000mAh 22.5W Fast Power Bank', 'other-electronics', 'Oraimo', 'OPB-P204DQ', 55000.00, 85000.00, 10, 12, 0, 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=300&q=80', 'Dual USB + Type-C PD 22.5W fast charging digital display power bank'],
            ];

            $prodStmt = $pdo->prepare("
                INSERT INTO `products` (
                    `sku`, `barcode`, `name`, `category_id`, `brand`, `model`, `description`,
                    `purchase_price`, `selling_price`, `weighted_avg_cost`, `min_stock_level`,
                    `warranty_months`, `image_url`, `status`, `created_by`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
            ");
            $invStmt = $pdo->prepare("
                INSERT INTO `inventories` (`product_id`, `available_quantity`, `unit_cost`, `last_counted_at`)
                VALUES (?, ?, ?, NOW())
            ");
            $smStmt = $pdo->prepare("
                INSERT INTO `stock_movements` (
                    `uuid`, `product_id`, `movement_type`, `previous_quantity`, `change_quantity`,
                    `new_quantity`, `unit_cost`, `reference_type`, `reference_id`, `reason`, `notes`, `user_id`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $prodIds = [];
            foreach ($products as $idx => $p) {
                $catId = $catIds[$p[3]];
                $prodStmt->execute([
                    $p[0], $p[1], $p[2], $catId, $p[4], $p[5], $p[12],
                    $p[6], $p[7], $p[6], $p[8], $p[9], $p[11], $ownerId
                ]);
                $pid = (int) $pdo->lastInsertId();
                $prodIds[$p[0]] = $pid;

                $invStmt->execute([$pid, $p[10], $p[6]]);
                if ($p[10] > 0) {
                    $smStmt->execute([
                        sprintf('sm-init-%04d', $idx + 1),
                        $pid,
                        'purchase_receipt',
                        0,
                        $p[10],
                        $p[10],
                        $p[6],
                        'Purchase',
                        1,
                        'Confirmed purchase goods receipt',
                        'Initial stock received from supplier',
                        $stockMgrId
                    ]);
                }
            }

            // 8. Seed Purchases (Paid + Credit purchases to demonstrate Supplier Balances)
            $purStmt = $pdo->prepare("
                INSERT INTO `purchases` (
                    `uuid`, `reference_number`, `supplier_id`, `purchase_date`, `status`,
                    `subtotal_amount`, `additional_costs`, `total_amount`, `amount_paid`,
                    `outstanding_balance`, `payment_status`, `payment_method`, `notes`, `recorded_by`, `received_at`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ");
            $piStmt = $pdo->prepare("
                INSERT INTO `purchase_items` (`purchase_id`, `product_id`, `ordered_quantity`, `received_quantity`, `unit_purchase_price`, `line_total`)
                VALUES (?, ?, ?, ?, ?, ?)
            ");

            // Purchase 1: P-0016 (Fully Paid)
            $purStmt->execute([
                'pur-uuid-0016', 'P-0016', $supIds['SUP-002'], date('Y-m-d', strtotime('-7 days')), 'received',
                3425000.00, 0.00, 3425000.00, 3425000.00, 0.00, 'paid', 'Bank Transfer',
                'Monthly accessories and chargers restock', $stockMgrId
            ]);
            $pur1Id = (int) $pdo->lastInsertId();
            $piStmt->execute([$pur1Id, $prodIds['CHG-ANK-45W'], 40, 40, 45000.00, 1800000.00]);
            $piStmt->execute([$pur1Id, $prodIds['ACC-MAG-CASE'], 65, 65, 25000.00, 1625000.00]);

            // Purchase 2: P-0017 (Partially Paid — Supplier Credit Liability: Samsung Galaxy S24 Ultra batch)
            $purStmt->execute([
                'pur-uuid-0017', 'P-0017', $supIds['SUP-003'], date('Y-m-d', strtotime('-4 days')), 'received',
                13000000.00, 50000.00, 13050000.00, 8000000.00, 5050000.00, 'partial', 'Cash',
                'Samsung Galaxy S24 Ultra batch + courier insurance', $stockMgrId
            ]);
            $pur2Id = (int) $pdo->lastInsertId();
            $piStmt->execute([$pur2Id, $prodIds['PHN-S24U-256'], 5, 5, 2600000.00, 13000000.00]);

            // Purchase 3: P-0018 (Partially Paid — Flagship Phones)
            $purStmt->execute([
                'pur-uuid-0018', 'P-0018', $supIds['SUP-001'], date('Y-m-d', strtotime('-2 days')), 'received',
                34300000.00, 0.00, 34300000.00, 25000000.00, 9300000.00, 'partial', 'Bank Transfer',
                'iPhone 15 Pro shipment from TechWorld', $ownerId
            ]);
            $pur3Id = (int) $pdo->lastInsertId();
            $piStmt->execute([$pur3Id, $prodIds['PHN-IP15P-256'], 14, 14, 2450000.00, 34300000.00]);

            // Record initial supplier payments
            $spStmt = $pdo->prepare("
                INSERT INTO `supplier_payments` (`uuid`, `reference_number`, `supplier_id`, `purchase_id`, `amount`, `payment_date`, `payment_method`, `notes`, `recorded_by`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $spStmt->execute(['sp-uuid-001', 'SP-0001', $supIds['SUP-002'], $pur1Id, 3425000.00, date('Y-m-d', strtotime('-7 days')), 'Bank Transfer', 'Full settlement for P-0016', $ownerId]);
            $spStmt->execute(['sp-uuid-002', 'SP-0002', $supIds['SUP-003'], $pur2Id, 8000000.00, date('Y-m-d', strtotime('-4 days')), 'Cash', 'Deposit on Samsung S24 Ultra P-0017', $ownerId]);
            $spStmt->execute(['sp-uuid-003', 'SP-0003', $supIds['SUP-001'], $pur3Id, 25000000.00, date('Y-m-d', strtotime('-2 days')), 'Bank Transfer', 'Part payment on P-0018', $ownerId]);

            // 9. Seed Customers
            $customers = [
                ['CUS-001', 'John Mwakalinga', '+255 712 345 678', 'john.mwaka@gmail.com', 'Mikocheni B, Dar es Salaam', 'vip', 5000000.00, 'Loyal corporate buyer'],
                ['CUS-002', 'Mary Kileo', '+255 754 345 678', 'mary.kileo@yahoo.com', 'Sinza Mori, Dar es Salaam', 'regular', 2000000.00, 'Prefers monthly installment credit'],
                ['CUS-003', 'David Kimaro', '+255 765 456 789', 'dkimaro@techfirm.co.tz', 'Upanga East, Dar es Salaam', 'corporate', 4000000.00, 'IT office equipment buyer'],
                ['CUS-004', 'Sarah Lema', '+255 787 889 102', 'sarah.lema@gmail.com', 'Mbezi Beach, Dar es Salaam', 'regular', 1500000.00, 'Regular phone & accessories customer'],
            ];
            $cusStmt = $pdo->prepare("
                INSERT INTO `customers` (`customer_code`, `full_name`, `phone`, `email`, `address`, `customer_type`, `credit_limit`, `notes`, `account_status`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
            ");
            $cusIds = [];
            foreach ($customers as $c) {
                $cusStmt->execute($c);
                $cusIds[$c[0]] = (int) $pdo->lastInsertId();
            }

            // 10. Seed an Open Cash Register Session for today
            // Opening balance: 1,000,000 TZS
            $pdo->prepare("
                INSERT INTO `cash_sessions` (
                    `session_code`, `user_id`, `opened_at`, `opening_balance`,
                    `cash_inflows`, `cash_outflows`, `expected_closing_balance`, `status`, `opening_notes`
                ) VALUES ('CS-2026-001', ?, NOW(), 1000000.00, 4885000.00, 420000.00, 5465000.00, 'open', 'Morning float verified by Owner')
            ")->execute([$ownerId]);
            $sessionId = (int) $pdo->lastInsertId();

            // 11. Seed Sales (Full Cash, Partial Credit, Zero-Deposit Credit)
            $saleStmt = $pdo->prepare("
                INSERT INTO `sales` (
                    `uuid`, `receipt_number`, `customer_id`, `cash_session_id`, `sale_date`,
                    `subtotal_amount`, `discount_type`, `discount_value`, `discount_amount`, `discount_reason`,
                    `total_amount`, `cash_received`, `change_amount`, `outstanding_balance`,
                    `total_cogs`, `gross_profit`, `payment_scenario`, `payment_method`, `payment_status`,
                    `due_date`, `status`, `notes`, `user_id`, `device_id`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, 'POS-DESKTOP-01')
            ");
            $siStmt = $pdo->prepare("
                INSERT INTO `sale_items` (
                    `sale_id`, `product_id`, `product_name_snapshot`, `sku_snapshot`, `quantity`,
                    `unit_selling_price`, `historical_unit_cost`, `line_discount_amount`,
                    `line_total`, `line_cogs`, `line_profit`, `warranty_months`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $cmStmt = $pdo->prepare("
                INSERT INTO `cash_movements` (
                    `uuid`, `cash_session_id`, `direction`, `category`, `amount`,
                    `reference_type`, `reference_id`, `description`, `user_id`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $warStmt = $pdo->prepare("
                INSERT INTO `warranties` (
                    `warranty_number`, `sale_id`, `sale_item_id`, `product_id`, `customer_id`,
                    `serial_or_imei`, `sale_date`, `duration_months`, `expiry_date`, `status`, `notes`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
            ");

            // Sale 1: S-00124 — John Mwakalinga (Full Cash Sale today: iPhone 15 Pro + AirPods Pro + MagSafe Case = 3,515,000 TZS)
            $saleStmt->execute([
                'sale-uuid-0124', 'S-00124', $cusIds['CUS-001'], $sessionId, date('Y-m-d H:i:s', strtotime('-3 hours')),
                3515000.00, 'none', 0.00, 0.00, null,
                3515000.00, 3515000.00, 0.00, 0.00,
                2955000.00, 560000.00, 'full_cash', 'Cash', 'paid',
                null, 'VIP bundle purchase', $ownerId
            ]);
            $sale1Id = (int) $pdo->lastInsertId();
            $siStmt->execute([$sale1Id, $prodIds['PHN-IP15P-256'], 'iPhone 15 Pro 256GB', 'PHN-IP15P-256', 1, 2850000.00, 2450000.00, 0.00, 2850000.00, 2450000.00, 400000.00, 12]);
            $si1_1 = (int) $pdo->lastInsertId();
            $siStmt->execute([$sale1Id, $prodIds['EAR-APP2-USB'], 'Apple AirPods Pro (2nd Gen USB-C)', 'EAR-APP2-USB', 1, 620000.00, 480000.00, 0.00, 620000.00, 480000.00, 140000.00, 12]);
            $si1_2 = (int) $pdo->lastInsertId();
            $siStmt->execute([$sale1Id, $prodIds['ACC-MAG-CASE'], 'iPhone 15 Pro MagSafe Silicone Case', 'ACC-MAG-CASE', 1, 45000.00, 25000.00, 0.00, 45000.00, 25000.00, 20000.00, 3]);
            $cmStmt->execute(['cm-uuid-001', $sessionId, 'inflow', 'sale_payment', 3515000.00, 'Sale', $sale1Id, 'Cash sale S-00124 (John Mwakalinga)', $ownerId]);

            $warStmt->execute(['WAR-2026-001', $sale1Id, $si1_1, $prodIds['PHN-IP15P-256'], $cusIds['CUS-001'], 'IMEI-359821104491021', date('Y-m-d'), 12, date('Y-m-d', strtotime('+12 months')), '12-Month Apple Official Warranty']);
            $warStmt->execute(['WAR-2026-002', $sale1Id, $si1_2, $prodIds['EAR-APP2-USB'], $cusIds['CUS-001'], 'SN-H0YLD281099', date('Y-m-d'), 12, date('Y-m-d', strtotime('+12 months')), '12-Month Apple Audio Warranty']);

            // Sale 2: S-00123 — Mary Kileo (Partial-Payment Credit Sale 12 days ago, OVERDUE! Samsung A55 950,000 TZS, Paid 500,000 initially + 150,000 repayment today = 300,000 remaining)
            $saleStmt->execute([
                'sale-uuid-0123', 'S-00123', $cusIds['CUS-002'], null, date('Y-m-d H:i:s', strtotime('-12 days')),
                950000.00, 'none', 0.00, 0.00, null,
                950000.00, 500000.00, 0.00, 300000.00,
                780000.00, 170000.00, 'partial_credit', 'Cash', 'partial',
                date('Y-m-d', strtotime('-2 days')), 'Partial payment sale - balance overdue', $cashierId
            ]);
            $sale2Id = (int) $pdo->lastInsertId();
            $siStmt->execute([$sale2Id, $prodIds['PHN-A55-128'], 'Samsung Galaxy A55 5G 128GB', 'PHN-A55-128', 1, 950000.00, 780000.00, 0.00, 950000.00, 780000.00, 170000.00, 12]);
            $si2_1 = (int) $pdo->lastInsertId();
            $warStmt->execute(['WAR-2026-003', $sale2Id, $si2_1, $prodIds['PHN-A55-128'], $cusIds['CUS-002'], 'IMEI-354491008271650', date('Y-m-d', strtotime('-12 days')), 12, date('Y-m-d', strtotime('+12 months -12 days')), 'Samsung East Africa 12M Warranty']);
            $war3Id = (int) $pdo->lastInsertId();

            // Repayment on S-00123 today (150,000 TZS)
            $pdo->prepare("
                INSERT INTO `customer_payments` (
                    `uuid`, `receipt_number`, `customer_id`, `sale_id`, `cash_session_id`,
                    `amount`, `balance_before`, `balance_after`, `payment_method`, `payment_date`, `notes`, `recorded_by`
                ) VALUES ('cp-uuid-001', 'RP-00041', ?, ?, ?, 150000.00, 450000.00, 300000.00, 'Cash', NOW(), 'Installment repayment received at counter', ?)
            ")->execute([$cusIds['CUS-002'], $sale2Id, $sessionId, $cashierId]);
            $cp1Id = (int) $pdo->lastInsertId();
            $cmStmt->execute(['cm-uuid-002', $sessionId, 'inflow', 'debt_repayment', 150000.00, 'CustomerPayment', $cp1Id, 'Debt repayment RP-00041 (Mary Kileo)', $cashierId]);

            // Sale 3: S-00122 — David Kimaro (Partial Credit Sale today: Samsung Galaxy S24 Ultra 3,050,000 TZS, Paid 1,220,000 TZS cash today, Remaining balance 1,830,000 TZS due in 5 days)
            $saleStmt->execute([
                'sale-uuid-0122', 'S-00122', $cusIds['CUS-003'], $sessionId, date('Y-m-d H:i:s', strtotime('-2 hours')),
                3050000.00, 'none', 0.00, 0.00, null,
                3050000.00, 1220000.00, 0.00, 1830000.00,
                2600000.00, 450000.00, 'partial_credit', 'Cash', 'partial',
                date('Y-m-d', strtotime('+5 days')), 'Corporate flagship smartphone purchase - balance due next week', $ownerId
            ]);
            $sale3Id = (int) $pdo->lastInsertId();
            $siStmt->execute([$sale3Id, $prodIds['PHN-S24U-256'], 'Samsung Galaxy S24 Ultra 256GB', 'PHN-S24U-256', 1, 3050000.00, 2600000.00, 0.00, 3050000.00, 2600000.00, 450000.00, 12]);
            $si3_1 = (int) $pdo->lastInsertId();
            $cmStmt->execute(['cm-uuid-003', $sessionId, 'inflow', 'sale_payment', 1220000.00, 'Sale', $sale3Id, 'Partial payment on S-00122 (David Kimaro)', $ownerId]);
            $warStmt->execute(['WAR-2026-004', $sale3Id, $si3_1, $prodIds['PHN-S24U-256'], $cusIds['CUS-003'], 'IMEI-359821108841220', date('Y-m-d'), 12, date('Y-m-d', strtotime('+12 months')), 'Samsung 1-Year Official Warranty']);

            // Sale 4: S-00121 — Sarah Lema (Zero-Deposit Credit Sale: JBL Flip 6 Speaker 320,000 TZS, Paid 0, Balance 320,000 TZS due in 14 days)
            $saleStmt->execute([
                'sale-uuid-0121', 'S-00121', $cusIds['CUS-004'], $sessionId, date('Y-m-d H:i:s', strtotime('-1 day')),
                320000.00, 'none', 0.00, 0.00, null,
                320000.00, 0.00, 0.00, 320000.00,
                240000.00, 80000.00, 'zero_deposit_credit', 'Credit', 'unpaid',
                date('Y-m-d', strtotime('+14 days')), 'Approved zero-deposit credit sale', $ownerId
            ]);
            $sale4Id = (int) $pdo->lastInsertId();
            $siStmt->execute([$sale4Id, $prodIds['SPK-JBL-FL6'], 'JBL Flip 6 Waterproof Bluetooth Speaker', 'SPK-JBL-FL6', 1, 320000.00, 240000.00, 0.00, 320000.00, 240000.00, 80000.00, 12]);

            // 12. Seed Operating Expenses (SRS Section 3.10)
            $expStmt = $pdo->prepare("
                INSERT INTO `expenses` (
                    `uuid`, `reference_number`, `title`, `category`, `amount`,
                    `expense_date`, `payment_method`, `cash_session_id`, `description`, `recorded_by`, `status`
                ) VALUES (?, ?, ?, ?, ?, ?, 'Cash', ?, ?, ?, 'active')
            ");
            $expStmt->execute(['exp-uuid-001', 'EXP-001', 'LUKU Electricity Token & DAWASA Water', 'Electricity and water', 180000.00, date('Y-m-d'), $sessionId, 'Monthly shop AC & lighting LUKU meter recharge', $ownerId]);
            $exp1Id = (int) $pdo->lastInsertId();
            $cmStmt->execute(['cm-uuid-004', $sessionId, 'outflow', 'expense', 180000.00, 'Expense', $exp1Id, 'Expense EXP-001: LUKU Electricity & Water', $ownerId]);

            $expStmt->execute(['exp-uuid-002', 'EXP-002', 'Fiber Optic Shop Internet Subscription', 'Internet', 150000.00, date('Y-m-d'), $sessionId, 'High-speed POS & CCTV fiber connection', $ownerId]);
            $exp2Id = (int) $pdo->lastInsertId();
            $cmStmt->execute(['cm-uuid-005', $sessionId, 'outflow', 'expense', 150000.00, 'Expense', $exp2Id, 'Expense EXP-002: Fiber Internet Subscription', $ownerId]);

            $expStmt->execute(['exp-uuid-003', 'EXP-003', 'Kariakoo Cargo Boda & Delivery Fare', 'Transportation', 90000.00, date('Y-m-d'), $sessionId, 'Stock pickup from TechWorld warehouse', $ownerId]);
            $exp3Id = (int) $pdo->lastInsertId();
            $cmStmt->execute(['cm-uuid-006', $sessionId, 'outflow', 'expense', 90000.00, 'Expense', $exp3Id, 'Expense EXP-003: Cargo Delivery Fare', $ownerId]);

            // 13. Seed a Sample Product Return & Warranty Claim (SRS 3.13 & 3.14)
            $pdo->prepare("
                INSERT INTO `returns` (
                    `uuid`, `return_number`, `sale_id`, `customer_id`, `return_date`,
                    `reason`, `resolution`, `refund_amount`, `status`, `notes`, `authorized_by`
                ) VALUES (
                    'ret-uuid-001', 'RET-0001', ?, ?, ?, 'Sealed box exchanged for different color case',
                    'exchange', 0.00, 'approved', 'Unopened MagSafe case returned in resalable condition', ?
                )
            ")->execute([$sale1Id, $cusIds['CUS-001'], date('Y-m-d'), $ownerId]);
            $retId = (int) $pdo->lastInsertId();

            $pdo->prepare("
                INSERT INTO `return_items` (
                    `return_id`, `product_id`, `quantity`, `condition_status`, `restocked`, `unit_refund_amount`, `line_refund_amount`
                ) VALUES (?, ?, 1, 'resalable', 1, 0.00, 0.00)
            ")->execute([$retId, $prodIds['ACC-MAG-CASE']]);

            // Warranty Claim sample (uses actual lastInsertId for TiDB/MySQL AUTO_INCREMENT safety)
            $pdo->prepare("
                INSERT INTO `warranty_claims` (
                    `claim_number`, `warranty_id`, `claim_date`, `issue_description`,
                    `resolution`, `resolution_notes`, `handled_by`, `resolved_at`
                ) VALUES (
                    'WCL-0001', ?, ?, 'Charging port loose connection after 1 week',
                    'repaired', 'Cleaned and tightened USB-C port assembly under warranty at zero cost to customer', ?, NOW()
                )
            ")->execute([$war3Id, date('Y-m-d'), $ownerId]);

            // 14. Seed Initial Audit Log Entries
            $auditStmt = $pdo->prepare("
                INSERT INTO `audit_logs` (`user_id`, `action`, `entity_type`, `entity_id`, `previous_values`, `new_values`, `reason`, `device_id`, `ip_address`)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'POS-DESKTOP-01', '127.0.0.1')
            ");
            $auditStmt->execute([
                $ownerId, 'cash_session.opened', 'CashSession', (string) $sessionId,
                null, json_encode(['opening_balance' => 1000000, 'session_code' => 'CS-2026-001']),
                'Daily morning shift opening'
            ]);
            $auditStmt->execute([
                $ownerId, 'sale.zero_deposit_credit_approved', 'Sale', (string) $sale4Id,
                null, json_encode(['receipt_number' => 'S-00121', 'total_amount' => 320000, 'outstanding_balance' => 320000]),
                'Approved zero-deposit credit sale for regular customer Sarah Lema'
            ]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}
