<?php

namespace App\Http\Controllers\Api;

use App\Services\AuditService;
use App\Services\AuthService;
use PDO;

class EmployeeSettingsController extends BaseApiController
{
    public static function listEmployees(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'employees.manage');

        $rows = $pdo->query("SELECT `id` FROM `users` ORDER BY `id` ASC")->fetchAll(PDO::FETCH_COLUMN);
        $employees = [];
        foreach ($rows as $uid) {
            $emp = AuthService::getUserWithRolesAndPermissions($pdo, (int) $uid);
            if ($emp) {
                // Attach sales and session counts for employee activity monitoring (SRS 3.15)
                $sStmt = $pdo->prepare("
                    SELECT COUNT(*) AS sales_count, COALESCE(SUM(`total_amount`), 0) AS sales_total
                    FROM `sales`
                    WHERE `user_id` = ? AND `status` = 'completed'
                ");
                $sStmt->execute([$uid]);
                $salesStats = $sStmt->fetch();

                $csStmt = $pdo->prepare("SELECT COUNT(*) FROM `cash_sessions` WHERE `user_id` = ?");
                $csStmt->execute([$uid]);

                $emp['sales_count'] = (int) $salesStats['sales_count'];
                $emp['sales_total'] = (float) $salesStats['sales_total'];
                $emp['cash_sessions_count'] = (int) $csStmt->fetchColumn();
                $employees[] = $emp;
            }
        }

        $roles = $pdo->query("SELECT * FROM `roles` WHERE `slug` IN ('owner', 'employee') ORDER BY `id` ASC")->fetchAll();
        $permissions = $pdo->query("SELECT * FROM `permissions` ORDER BY `module` ASC, `id` ASC")->fetchAll();

        self::json([
            'success'     => true,
            'employees'   => $employees,
            'roles'       => $roles,
            'permissions' => $permissions,
        ]);
    }

    public static function createEmployee(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'employees.manage');
        $data = self::input();

        $fullName = trim((string) ($data['full_name'] ?? ''));
        $username = trim((string) ($data['username'] ?? ''));
        $email = trim((string) ($data['email'] ?? '')) ?: null;
        $phone = trim((string) ($data['phone'] ?? '')) ?: null;
        $password = (string) ($data['password'] ?? 'staff123');
        $roleIds = $data['role_ids'] ?? [];
        $maxDiscount = (float) ($data['max_discount_percent'] ?? 0);
        $canApproveCredit = !empty($data['can_approve_credit']) ? 1 : 0;

        if ($fullName === '' || $username === '') {
            self::error('Employee full name and username are required.', 422);
        }

        $chk = $pdo->prepare("SELECT COUNT(*) FROM `users` WHERE `username` = ?");
        $chk->execute([$username]);
        if ((int) $chk->fetchColumn() > 0) {
            self::error('Username is already taken. Every employee must have a unique account.', 422);
        }

        $pdo->beginTransaction();
        try {
            $empCode = self::nextUniqueCode($pdo, 'users', 'employee_code', 'EMP-', 3, 1);

            $stmt = $pdo->prepare("
                INSERT INTO `users` (
                    `employee_code`, `full_name`, `username`, `email`, `phone`,
                    `password_hash`, `status`, `max_discount_percent`, `can_approve_credit`
                ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
            ");
            $stmt->execute([
                $empCode, $fullName, $username, $email, $phone,
                password_hash($password, PASSWORD_BCRYPT), $maxDiscount, $canApproveCredit
            ]);
            $newUserId = (int) $pdo->lastInsertId();

            $allowedRoleIds = $pdo->query("SELECT `id` FROM `roles` WHERE `slug` IN ('owner', 'employee')")->fetchAll(PDO::FETCH_COLUMN);
            $allowedRoleIds = array_map('intval', $allowedRoleIds);
            $roleIds = array_values(array_filter(array_map('intval', (array) $roleIds), fn($id) => in_array($id, $allowedRoleIds, true)));

            if (empty($roleIds)) {
                $employeeRoleId = (int) $pdo->query("SELECT `id` FROM `roles` WHERE `slug` = 'employee' LIMIT 1")->fetchColumn();
                $roleIds = [$employeeRoleId];
            }

            $urStmt = $pdo->prepare("INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES (?, ?)");
            foreach ($roleIds as $rid) {
                $urStmt->execute([$newUserId, (int) $rid]);
            }

            AuditService::log(
                $pdo,
                (int) $user['id'],
                'employee.created',
                'User',
                $newUserId,
                null,
                ['employee_code' => $empCode, 'full_name' => $fullName, 'username' => $username, 'role_ids' => $roleIds],
                'Registered new employee account'
            );

            $pdo->commit();
            self::json([
                'success'  => true,
                'message'  => 'Employee registered successfully.',
                'employee' => AuthService::getUserWithRolesAndPermissions($pdo, $newUserId),
            ], 201);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            self::error('Failed to create employee: ' . $e->getMessage(), 500);
        }
    }

    public static function updateEmployee(PDO $pdo, array $user, int $employeeId): never
    {
        self::requirePermission($user, 'employees.manage');
        $data = self::input();

        $before = AuthService::getUserWithRolesAndPermissions($pdo, $employeeId);
        if (!$before) {
            self::error('Employee not found.', 404);
        }

        $pdo->beginTransaction();
        try {
            $fullName = trim((string) ($data['full_name'] ?? $before['full_name']));
            $email = isset($data['email']) ? (trim((string) $data['email']) ?: null) : $before['email'];
            $phone = isset($data['phone']) ? (trim((string) $data['phone']) ?: null) : $before['phone'];
            $status = (isset($data['status']) && in_array($data['status'], ['active', 'inactive'], true))
                ? $data['status']
                : (in_array($before['status'], ['active', 'inactive'], true) ? $before['status'] : 'active');
            $maxDiscount = isset($data['max_discount_percent'])
                ? (float) $data['max_discount_percent']
                : (float) $before['max_discount_percent'];
            $canApproveCredit = isset($data['can_approve_credit'])
                ? (!empty($data['can_approve_credit']) ? 1 : 0)
                : ($before['can_approve_credit'] ? 1 : 0);

            $pdo->prepare("
                UPDATE `users`
                SET `full_name` = ?, `email` = ?, `phone` = ?, `status` = ?,
                    `max_discount_percent` = ?, `can_approve_credit` = ?
                WHERE `id` = ?
            ")->execute([$fullName, $email, $phone, $status, $maxDiscount, $canApproveCredit, $employeeId]);

            if (!empty($data['password'])) {
                $pdo->prepare("UPDATE `users` SET `password_hash` = ? WHERE `id` = ?")
                    ->execute([password_hash((string) $data['password'], PASSWORD_BCRYPT), $employeeId]);
            }

            if (isset($data['role_ids']) && is_array($data['role_ids']) && count($data['role_ids']) > 0) {
                $allowedRoleIds = array_map('intval', $pdo->query("SELECT `id` FROM `roles` WHERE `slug` IN ('owner', 'employee')")->fetchAll(PDO::FETCH_COLUMN));
                $validRoleIds = array_values(array_filter(array_map('intval', $data['role_ids']), fn($id) => in_array($id, $allowedRoleIds, true)));
                if (!empty($validRoleIds)) {
                    $pdo->prepare("DELETE FROM `user_roles` WHERE `user_id` = ?")->execute([$employeeId]);
                    $urStmt = $pdo->prepare("INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES (?, ?)");
                    foreach ($validRoleIds as $rid) {
                        $urStmt->execute([$employeeId, $rid]);
                    }
                }
            }

            if (isset($data['permission_overrides']) && is_array($data['permission_overrides'])) {
                $pdo->prepare("DELETE FROM `user_permissions` WHERE `user_id` = ?")->execute([$employeeId]);
                $pMap = $pdo->query("SELECT `slug`, `id` FROM `permissions`")->fetchAll(PDO::FETCH_KEY_PAIR);
                $upStmt = $pdo->prepare("INSERT INTO `user_permissions` (`user_id`, `permission_id`, `granted`) VALUES (?, ?, ?)");
                foreach ($data['permission_overrides'] as $slug => $granted) {
                    if (isset($pMap[$slug]) && $granted !== null) {
                        $upStmt->execute([$employeeId, (int) $pMap[$slug], $granted ? 1 : 0]);
                    }
                }
            }

            $after = AuthService::getUserWithRolesAndPermissions($pdo, $employeeId);

            AuditService::log(
                $pdo,
                (int) $user['id'],
                'employee.updated_permissions',
                'User',
                $employeeId,
                ['roles' => $before['role_slugs'], 'permissions' => $before['permissions'], 'status' => $before['status']],
                ['roles' => $after['role_slugs'], 'permissions' => $after['permissions'], 'status' => $after['status']],
                $data['reason'] ?? 'Updated employee details, roles, or permissions'
            );

            $pdo->commit();
            self::json([
                'success'  => true,
                'message'  => 'Employee and permissions updated successfully.',
                'employee' => $after,
            ]);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            self::error('Failed to update employee: ' . $e->getMessage(), 500);
        }
    }

    public static function deleteEmployee(PDO $pdo, array $user, int $employeeId): never
    {
        self::requirePermission($user, 'employees.manage');

        if ((int) $user['id'] === $employeeId) {
            self::error('You cannot delete your own account while logged in.', 400);
        }

        $target = AuthService::getUserWithRolesAndPermissions($pdo, $employeeId);
        if (!$target) {
            self::error('Employee not found.', 404);
        }

        if (in_array('owner', $target['role_slugs'] ?? [], true)) {
            self::error('Super Administrator / Shop Owner cannot be deleted.', 403);
        }

        $pdo->beginTransaction();
        try {
            $salesCount = (int) $pdo->query("SELECT COUNT(*) FROM `sales` WHERE `user_id` = {$employeeId}")->fetchColumn();
            $purchaseCount = (int) $pdo->query("SELECT COUNT(*) FROM `purchases` WHERE `recorded_by` = {$employeeId}")->fetchColumn();
            $cashCount = (int) $pdo->query("SELECT COUNT(*) FROM `cash_sessions` WHERE `user_id` = {$employeeId}")->fetchColumn();

            if ($salesCount > 0 || $purchaseCount > 0 || $cashCount > 0) {
                $pdo->prepare("UPDATE `users` SET `status` = 'inactive' WHERE `id` = ?")->execute([$employeeId]);
                $pdo->prepare("DELETE FROM `personal_access_tokens` WHERE `user_id` = ?")->execute([$employeeId]);
                $msg = "Employee account deactivated and tokens revoked (historical transactions preserved for audit compliance).";
            } else {
                $pdo->prepare("DELETE FROM `personal_access_tokens` WHERE `user_id` = ?")->execute([$employeeId]);
                $pdo->prepare("DELETE FROM `user_permissions` WHERE `user_id` = ?")->execute([$employeeId]);
                $pdo->prepare("DELETE FROM `user_roles` WHERE `user_id` = ?")->execute([$employeeId]);
                $pdo->prepare("DELETE FROM `users` WHERE `id` = ?")->execute([$employeeId]);
                $msg = "Employee deleted successfully.";
            }

            AuditService::log(
                $pdo,
                (int) $user['id'],
                'employee.deleted',
                'User',
                $employeeId,
                $target,
                null,
                "Admin deleted employee @{$target['username']} ({$target['full_name']})"
            );

            $pdo->commit();
            self::json(['success' => true, 'message' => $msg]);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            self::error('Failed to delete employee: ' . $e->getMessage(), 500);
        }
    }

    public static function resetPassword(PDO $pdo, array $user, int $employeeId): never
    {
        self::requirePermission($user, 'employees.manage');
        $data = self::input();

        $target = AuthService::getUserWithRolesAndPermissions($pdo, $employeeId);
        if (!$target) {
            self::error('Employee not found.', 404);
        }

        $newPassword = trim((string) ($data['password'] ?? ''));
        if (strlen($newPassword) < 6) {
            self::error('New password must be at least 6 characters long.', 422);
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare("UPDATE `users` SET `password_hash` = ? WHERE `id` = ?")
                ->execute([password_hash($newPassword, PASSWORD_BCRYPT), $employeeId]);

            $pdo->prepare("DELETE FROM `personal_access_tokens` WHERE `user_id` = ?")->execute([$employeeId]);

            AuditService::log(
                $pdo,
                (int) $user['id'],
                'employee.password_reset',
                'User',
                $employeeId,
                null,
                null,
                "Admin reset password for employee @{$target['username']} ({$target['full_name']})"
            );

            $pdo->commit();
            self::json([
                'success' => true,
                'message' => "Password for @{$target['username']} was reset successfully.",
            ]);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            self::error('Failed to reset password: ' . $e->getMessage(), 500);
        }
    }

    public static function uploadFile(PDO $pdo, array $user): never
    {
        $uploadDir = dirname(__DIR__, 4) . '/public/uploads';
        if (!is_dir($uploadDir) && !@mkdir($uploadDir, 0777, true) && !is_dir($uploadDir)) {
            self::error('Failed to prepare uploads directory on server.', 500);
        }

        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? '127.0.0.1:8000';
        $baseUrl = "{$scheme}://{$host}";

        $filename = 'img_' . time() . '_' . bin2hex(random_bytes(4));
        $ext = 'jpg';

        if (!empty($_FILES['image'])) {
            $errCode = (int) ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE);
            if ($errCode !== UPLOAD_ERR_OK) {
                $errMap = [
                    UPLOAD_ERR_INI_SIZE   => 'Image exceeds server upload size limit.',
                    UPLOAD_ERR_FORM_SIZE  => 'Image exceeds maximum allowed form size.',
                    UPLOAD_ERR_PARTIAL    => 'Image upload was interrupted. Please try again.',
                    UPLOAD_ERR_NO_FILE    => 'No image file was received.',
                ];
                self::error($errMap[$errCode] ?? 'Image upload failed on server.', 422);
            }

            $tmpName = $_FILES['image']['tmp_name'] ?? '';
            if ($tmpName !== '' && is_uploaded_file($tmpName)) {
                $origExt = strtolower(pathinfo((string) ($_FILES['image']['name'] ?? ''), PATHINFO_EXTENSION));
                $mimeToExt = [
                    'image/jpeg'    => 'jpg',
                    'image/jpg'     => 'jpg',
                    'image/png'     => 'png',
                    'image/webp'    => 'webp',
                    'image/gif'     => 'gif',
                    'image/svg+xml' => 'svg',
                    'image/bmp'     => 'bmp',
                    'image/avif'    => 'avif',
                ];
                $mime = strtolower((string) ($_FILES['image']['type'] ?? ''));
                if (in_array($origExt, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif'], true)) {
                    $ext = $origExt === 'jpeg' ? 'jpg' : $origExt;
                } elseif (isset($mimeToExt[$mime])) {
                    $ext = $mimeToExt[$mime];
                }

                $targetPath = $uploadDir . '/' . $filename . '.' . $ext;
                if (move_uploaded_file($tmpName, $targetPath)) {
                    $relPath = '/uploads/' . $filename . '.' . $ext;
                    self::json([
                        'success' => true,
                        'path'    => $relPath,
                        'url'     => $baseUrl . $relPath,
                    ]);
                }
                self::error('Failed to save uploaded image on server.', 500);
            }
        }

        $data = self::input();
        if (!empty($data['base64'])) {
            $raw = trim((string) $data['base64']);
            if (preg_match('#^data:image/([a-z0-9.+-]+);base64,(.+)$#is', $raw, $m)) {
                $rawSubtype = strtolower($m[1]);
                $subtypeMap = [
                    'jpeg'    => 'jpg',
                    'jpg'     => 'jpg',
                    'png'     => 'png',
                    'webp'    => 'webp',
                    'gif'     => 'gif',
                    'svg+xml' => 'svg',
                    'bmp'     => 'bmp',
                    'avif'    => 'avif',
                ];
                $ext = $subtypeMap[$rawSubtype] ?? 'jpg';
                $decoded = base64_decode(preg_replace('/\s+/', '', $m[2]), true);
            } else {
                $decoded = base64_decode(preg_replace('/\s+/', '', $raw), true);
            }

            if ($decoded !== false && $decoded !== '') {
                $targetPath = $uploadDir . '/' . $filename . '.' . $ext;
                if (@file_put_contents($targetPath, $decoded) !== false) {
                    $relPath = '/uploads/' . $filename . '.' . $ext;
                    self::json([
                        'success' => true,
                        'path'    => $relPath,
                        'url'     => $baseUrl . $relPath,
                    ]);
                }
                self::error('Failed to write image file on server.', 500);
            }
        }

        self::error('No valid image file or data provided.', 422);
    }

    public static function getSettings(PDO $pdo, array $user): never
    {
        $settings = $pdo->query("SELECT * FROM `shop_settings` ORDER BY `id` ASC LIMIT 1")->fetch();
        self::json(['success' => true, 'settings' => $settings]);
    }

    public static function updateSettings(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'settings.manage');
        $data = self::input();

        $before = $pdo->query("SELECT * FROM `shop_settings` ORDER BY `id` ASC LIMIT 1")->fetch();

        $stmt = $pdo->prepare("
            UPDATE `shop_settings`
            SET `shop_name` = ?,
                `shop_address` = ?,
                `contact_phone` = ?,
                `contact_email` = ?,
                `tin_number` = ?,
                `currency` = ?,
                `receipt_header` = ?,
                `receipt_footer` = ?,
                `default_credit_limit` = ?,
                `max_cashier_discount_percent` = ?,
                `default_warranty_months` = ?,
                `default_low_stock_threshold` = ?,
                `allow_credit_sales` = ?,
                `require_credit_approval` = ?,
                `auto_sync_enabled` = ?
            WHERE `id` = ?
        ");
        $stmt->execute([
            trim((string) ($data['shop_name'] ?? $before['shop_name'])),
            trim((string) ($data['shop_address'] ?? $before['shop_address'])),
            trim((string) ($data['contact_phone'] ?? $before['contact_phone'])),
            trim((string) ($data['contact_email'] ?? $before['contact_email'])),
            trim((string) ($data['tin_number'] ?? $before['tin_number'])),
            trim((string) ($data['currency'] ?? $before['currency'])),
            trim((string) ($data['receipt_header'] ?? $before['receipt_header'])),
            trim((string) ($data['receipt_footer'] ?? $before['receipt_footer'])),
            (float) ($data['default_credit_limit'] ?? $before['default_credit_limit']),
            (float) ($data['max_cashier_discount_percent'] ?? $before['max_cashier_discount_percent']),
            (int) ($data['default_warranty_months'] ?? $before['default_warranty_months']),
            (int) ($data['default_low_stock_threshold'] ?? $before['default_low_stock_threshold']),
            isset($data['allow_credit_sales']) ? (!empty($data['allow_credit_sales']) ? 1 : 0) : $before['allow_credit_sales'],
            isset($data['require_credit_approval']) ? (!empty($data['require_credit_approval']) ? 1 : 0) : $before['require_credit_approval'],
            isset($data['auto_sync_enabled']) ? (!empty($data['auto_sync_enabled']) ? 1 : 0) : $before['auto_sync_enabled'],
            $before['id'],
        ]);

        $after = $pdo->query("SELECT * FROM `shop_settings` ORDER BY `id` ASC LIMIT 1")->fetch();
        AuditService::log($pdo, (int) $user['id'], 'settings.updated', 'ShopSettings', $before['id'], $before, $after, 'Updated shop settings');

        self::json([
            'success'  => true,
            'message'  => 'Shop settings updated successfully.',
            'settings' => $after,
        ]);
    }

    public static function exportBackup(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'settings.manage');

        $tables = [
            'roles', 'permissions', 'role_permissions', 'users', 'user_roles', 'user_permissions',
            'shop_settings', 'categories', 'products', 'inventories', 'stock_movements',
            'suppliers', 'purchases', 'purchase_items', 'supplier_payments',
            'customers', 'sales', 'sale_items', 'customer_payments',
            'cash_sessions', 'cash_movements', 'expenses',
            'returns', 'return_items', 'warranties', 'warranty_claims', 'audit_logs', 'sync_records'
        ];

        $snapshot = [
            'system'      => 'Electronics Shop Management System (ESMS)',
            'version'     => '1.0',
            'currency'    => 'TZS',
            'exported_at' => date('c'),
            'exported_by' => $user['full_name'],
            'tables'      => [],
        ];

        foreach ($tables as $t) {
            $snapshot['tables'][$t] = $pdo->query("SELECT * FROM `{$t}`")->fetchAll();
        }

        $pdo->exec("UPDATE `shop_settings` SET `last_backup_at` = NOW()");
        AuditService::log($pdo, (int) $user['id'], 'backup.exported', 'System', 1, null, ['tables_count' => count($tables)], 'Manual database backup export');

        self::json([
            'success' => true,
            'message' => 'Backup generated and verified successfully.',
            'backup'  => $snapshot,
        ]);
    }
}
