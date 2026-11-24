<?php

namespace App\Database;

use PDO;
use PDOException;

class DatabaseInstaller
{
    private const SCHEMA_VERSION = '2026.11.25.admin-notifications-v1';
    private const PURGE_DEMO_MIGRATION = '2026_11_25_purge_demo_data_v1';
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

            // Ensure inter-shop stock transfer tables and stock_movements transfer ENUM values exist
            $smTypeCol = $pdo->query("SHOW COLUMNS FROM `stock_movements` LIKE 'movement_type'")->fetch();
            if ($smTypeCol && !str_contains(strtolower((string) ($smTypeCol['Type'] ?? '')), "'transfer_out'")) {
                $pdo->exec("
                    ALTER TABLE `stock_movements`
                    MODIFY COLUMN `movement_type` ENUM(
                        'purchase_receipt',
                        'sale',
                        'return_resalable',
                        'adjustment_increase',
                        'adjustment_decrease',
                        'damaged',
                        'missing',
                        'lost',
                        'physical_count',
                        'initial_stock',
                        'transfer_out',
                        'transfer_cancel_return'
                    ) NOT NULL
                ");
            }
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `stock_transfers` (
                  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                  `transfer_number` VARCHAR(50) NOT NULL UNIQUE,
                  `transfer_date` DATE NOT NULL,
                  `from_shop` VARCHAR(160) NOT NULL DEFAULT 'KAMPANGO PHONES AND ELECTRONICS',
                  `destination_shop_name` VARCHAR(160) NOT NULL,
                  `destination_location` VARCHAR(255) NULL,
                  `receiver_name` VARCHAR(150) NOT NULL,
                  `receiver_phone` VARCHAR(50) NULL,
                  `carrier_name` VARCHAR(150) NULL,
                  `carrier_phone` VARCHAR(50) NULL,
                  `vehicle_or_waybill` VARCHAR(120) NULL,
                  `transfer_reason` VARCHAR(180) NOT NULL DEFAULT 'Branch Restock',
                  `status` ENUM('in_transit', 'received', 'cancelled') NOT NULL DEFAULT 'in_transit',
                  `total_items` INT NOT NULL DEFAULT 0,
                  `total_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                  `total_cost_value` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                  `total_retail_value` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                  `notes` TEXT NULL,
                  `transferred_by` BIGINT UNSIGNED NOT NULL,
                  `received_confirmed_by` BIGINT UNSIGNED NULL,
                  `received_at` TIMESTAMP NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  INDEX `idx_st_date` (`transfer_date`),
                  INDEX `idx_st_status` (`status`),
                  CONSTRAINT `fk_st_user` FOREIGN KEY (`transferred_by`) REFERENCES `users`(`id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `stock_transfer_items` (
                  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                  `transfer_id` BIGINT UNSIGNED NOT NULL,
                  `product_id` BIGINT UNSIGNED NOT NULL,
                  `product_name_snapshot` VARCHAR(180) NOT NULL,
                  `sku_snapshot` VARCHAR(80) NOT NULL,
                  `unit_snapshot` VARCHAR(20) NOT NULL DEFAULT 'piece',
                  `quantity` DECIMAL(12,2) NOT NULL,
                  `unit_cost` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                  `unit_selling_price` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                  `line_cost_total` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                  `line_retail_total` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                  `serial_or_imei` VARCHAR(120) NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_sti_transfer` (`transfer_id`),
                  INDEX `idx_sti_product` (`product_id`),
                  CONSTRAINT `fk_sti_transfer` FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers`(`id`) ON DELETE CASCADE,
                  CONSTRAINT `fk_sti_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // Ensure admin notifications table exists (Employee sales, sold-out products & expenses)
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `admin_notifications` (
                  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                  `type` ENUM('employee_sale', 'sold_out', 'employee_expense') NOT NULL,
                  `severity` ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'info',
                  `title` VARCHAR(180) NOT NULL,
                  `message` TEXT NOT NULL,
                  `actor_user_id` BIGINT UNSIGNED NULL,
                  `actor_name` VARCHAR(150) NULL,
                  `entity_type` VARCHAR(60) NULL,
                  `entity_id` BIGINT UNSIGNED NULL,
                  `amount` DECIMAL(15,2) NULL,
                  `meta_json` LONGTEXT NULL,
                  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
                  `read_by` BIGINT UNSIGNED NULL,
                  `read_at` TIMESTAMP NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX `idx_an_read_created` (`is_read`, `created_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // One-time database migration tracker (persisted in MySQL so restarts never re-run one-time purges)
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `system_migrations` (
                  `migration_key` VARCHAR(120) PRIMARY KEY,
                  `applied_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // One-time removal of all demonstration data while preserving Categories, RBAC, Shop Settings & Admin credentials
            $purgeChk = $pdo->prepare("SELECT COUNT(*) FROM `system_migrations` WHERE `migration_key` = ?");
            $purgeChk->execute([self::PURGE_DEMO_MIGRATION]);
            if ((int) $purgeChk->fetchColumn() === 0) {
                self::purgeOperationalAndDemoData($pdo);
                $pdo->prepare("INSERT IGNORE INTO `system_migrations` (`migration_key`) VALUES (?)")
                    ->execute([self::PURGE_DEMO_MIGRATION]);
            }

            // Ensure clean KAMPANGO PHONES AND ELECTRONICS categories remain intact (zero demo products)
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

    /**
     * Permanently removes all demonstration/operational records while preserving:
     * - Admin ('owner') account(s) with their exact existing username, password, profile & active tokens
     * - Categories (all clean product categories)
     * - Roles, Permissions & Role Permissions
     * - Shop Settings (branding & TZS defaults)
     */
    public static function purgeOperationalAndDemoData(PDO $pdo): void
    {
        $ownerRoleId = (int) $pdo->query("SELECT `id` FROM `roles` WHERE `slug` = 'owner' LIMIT 1")->fetchColumn();
        $ownerIds = [];
        if ($ownerRoleId > 0) {
            $ownerIds = array_map(
                'intval',
                $pdo->query("SELECT DISTINCT `user_id` FROM `user_roles` WHERE `role_id` = {$ownerRoleId}")->fetchAll(PDO::FETCH_COLUMN)
            );
        }
        if (empty($ownerIds)) {
            $firstUid = (int) $pdo->query("SELECT `id` FROM `users` ORDER BY `id` ASC LIMIT 1")->fetchColumn();
            if ($firstUid > 0) {
                $ownerIds = [$firstUid];
            }
        }

        $tablesToClear = [
            'warranty_claims',
            'warranties',
            'return_items',
            'returns',
            'customer_payments',
            'sale_items',
            'sales',
            'customers',
            'supplier_payments',
            'purchase_items',
            'purchases',
            'suppliers',
            'stock_transfer_items',
            'stock_transfers',
            'stock_movements',
            'inventories',
            'products',
            'cash_movements',
            'cash_sessions',
            'expenses',
            'audit_logs',
            'sync_records',
            'admin_notifications',
        ];

        $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
        try {
            foreach ($tablesToClear as $table) {
                $exists = $pdo->query("SHOW TABLES LIKE '{$table}'")->fetchAll();
                if (!empty($exists)) {
                    $pdo->exec("DELETE FROM `{$table}`");
                    try {
                        $pdo->exec("ALTER TABLE `{$table}` AUTO_INCREMENT = 1");
                    } catch (\Throwable $ignored) {
                        // Some serverless engines ignore AUTO_INCREMENT reset safely
                    }
                }
            }

            // Remove all non-owner demo accounts (e.g. demo employee 'amina') while strictly keeping Admin credentials
            if (!empty($ownerIds)) {
                $keepList = implode(',', $ownerIds);
                $pdo->exec("DELETE FROM `personal_access_tokens` WHERE `user_id` NOT IN ({$keepList})");
                $pdo->exec("DELETE FROM `user_permissions` WHERE `user_id` NOT IN ({$keepList})");
                $pdo->exec("DELETE FROM `user_roles` WHERE `user_id` NOT IN ({$keepList})");
                $pdo->exec("DELETE FROM `users` WHERE `id` NOT IN ({$keepList})");
            }

            $pdo->exec("UPDATE `shop_settings` SET `last_backup_at` = NULL");
        } finally {
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
        }
    }

    public static function seed(PDO $pdo): void
    {
        // Ensure migrations table exists before opening transaction (DDL auto-commits in MySQL)
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `system_migrations` (
              `migration_key` VARCHAR(120) PRIMARY KEY,
              `applied_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

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

            // 3. Seed Admin Account ONLY (Zero demonstration employees or sample transactions)
            $userStmt = $pdo->prepare("
                INSERT INTO `users` (`employee_code`, `full_name`, `username`, `email`, `phone`, `password_hash`, `status`, `max_discount_percent`, `can_approve_credit`, `last_login_at`)
                VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL)
            ");
            $userRoleStmt = $pdo->prepare("INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES (?, ?)");

            // Default Admin: admin / admin123 (can be customized anytime in Admin Account Settings)
            $userStmt->execute([
                'EMP-001', 'Shop Admin', 'admin', 'admin@kampango.co.tz', null,
                password_hash('admin123', PASSWORD_BCRYPT), 100.00, 1
            ]);
            $ownerId = (int) $pdo->lastInsertId();
            $userRoleStmt->execute([$ownerId, $roleIds['owner']]);

            // 4. Seed Clean Shop Settings (TZS)
            $pdo->exec("
                INSERT INTO `shop_settings` (
                    `shop_name`, `shop_logo`, `shop_address`, `contact_phone`, `contact_email`, `tin_number`,
                    `currency`, `receipt_header`, `receipt_footer`, `default_credit_limit`,
                    `max_cashier_discount_percent`, `default_warranty_months`, `default_low_stock_threshold`,
                    `allow_credit_sales`, `require_credit_approval`, `auto_sync_enabled`, `last_backup_at`
                ) VALUES (
                    'KAMPANGO PHONES AND ELECTRONICS',
                    '/logo.png',
                    'Dar es Salaam, Tanzania',
                    '',
                    '',
                    '',
                    'TZS',
                    'KAMPANGO PHONES AND ELECTRONICS — Genuine Phones, Accessories & Home Electronics',
                    'Asante kwa kununua kwetu! Karibu tena.',
                    2500000.00,
                    5.00,
                    12,
                    5,
                    1,
                    0,
                    1,
                    NULL
                )
            ");

            // 5. Seed Clean Shop Categories ONLY (Zero demonstration products, customers, suppliers, or sales)
            ShopCatalogSeeder::syncCatalog($pdo);

            // Mark demo-purge migration complete on fresh clean installs
            $pdo->prepare("INSERT IGNORE INTO `system_migrations` (`migration_key`) VALUES (?)")
                ->execute([self::PURGE_DEMO_MIGRATION]);

            if ($pdo->inTransaction()) {
                $pdo->commit();
            }
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}
