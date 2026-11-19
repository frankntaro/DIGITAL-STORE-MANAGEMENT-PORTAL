<?php

namespace App\Services;

use PDO;

class AuthService
{
    public static function getUserWithRolesAndPermissions(PDO $pdo, int $userId): ?array
    {
        $stmt = $pdo->prepare("
            SELECT `id`, `employee_code`, `full_name`, `username`, `email`, `phone`,
                   `status`, `max_discount_percent`, `can_approve_credit`, `last_login_at`, `created_at`
            FROM `users`
            WHERE `id` = ?
        ");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if (!$user) {
            return null;
        }

        // Roles
        $roleStmt = $pdo->prepare("
            SELECT r.`id`, r.`name`, r.`slug`, r.`description`
            FROM `roles` r
            INNER JOIN `user_roles` ur ON ur.`role_id` = r.`id`
            WHERE ur.`user_id` = ?
        ");
        $roleStmt->execute([$userId]);
        $roles = $roleStmt->fetchAll();
        $roleSlugs = array_column($roles, 'slug');

        // Role permissions
        $permStmt = $pdo->prepare("
            SELECT DISTINCT p.`slug`
            FROM `permissions` p
            INNER JOIN `role_permissions` rp ON rp.`permission_id` = p.`id`
            INNER JOIN `user_roles` ur ON ur.`role_id` = rp.`role_id`
            WHERE ur.`user_id` = ?
        ");
        $permStmt->execute([$userId]);
        $permissions = array_fill_keys($permStmt->fetchAll(PDO::FETCH_COLUMN), true);

        // Individual user permission overrides (SRS Section 2.4)
        $overrideStmt = $pdo->prepare("
            SELECT p.`slug`, up.`granted`
            FROM `user_permissions` up
            INNER JOIN `permissions` p ON p.`id` = up.`permission_id`
            WHERE up.`user_id` = ?
        ");
        $overrideStmt->execute([$userId]);
        $overrides = [];
        foreach ($overrideStmt->fetchAll() as $row) {
            $overrides[$row['slug']] = (bool) $row['granted'];
            if ((int) $row['granted'] === 1) {
                $permissions[$row['slug']] = true;
            } else {
                unset($permissions[$row['slug']]);
            }
        }

        // Owner always has full access (SRS Section 2.1)
        if (in_array('owner', $roleSlugs, true)) {
            $allPerms = $pdo->query("SELECT `slug` FROM `permissions`")->fetchAll(PDO::FETCH_COLUMN);
            foreach ($allPerms as $slug) {
                $permissions[$slug] = true;
            }
        }

        $user['max_discount_percent'] = (float) $user['max_discount_percent'];
        $user['can_approve_credit'] = (bool) $user['can_approve_credit'];
        $user['roles'] = $roles;
        $user['role_slugs'] = $roleSlugs;
        $user['primary_role'] = $roles[0]['name'] ?? 'Employee';
        $user['primary_role_slug'] = $roleSlugs[0] ?? 'staff';
        $user['permissions'] = array_keys($permissions);
        $user['permission_overrides'] = $overrides;

        return $user;
    }

    public static function hasPermission(array $user, string $permission): bool
    {
        if (in_array('owner', $user['role_slugs'] ?? [], true)) {
            return true;
        }
        return in_array($permission, $user['permissions'] ?? [], true);
    }

    public static function authenticateRequest(PDO $pdo): ?array
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (empty($header) && function_exists('getallheaders')) {
            $headers = getallheaders();
            $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        }

        if (!preg_match('/Bearer\s+(.+)$/i', $header, $matches)) {
            return null;
        }

        $plainToken = trim($matches[1]);
        $tokenHash = hash('sha256', $plainToken);

        $stmt = $pdo->prepare("
            SELECT `id`, `user_id`
            FROM `personal_access_tokens`
            WHERE `token_hash` = ?
              AND (`expires_at` IS NULL OR `expires_at` > NOW())
            LIMIT 1
        ");
        $stmt->execute([$tokenHash]);
        $tokenRecord = $stmt->fetch();
        if (!$tokenRecord) {
            return null;
        }

        $pdo->prepare("UPDATE `personal_access_tokens` SET `last_used_at` = NOW() WHERE `id` = ?")
            ->execute([$tokenRecord['id']]);

        $user = self::getUserWithRolesAndPermissions($pdo, (int) $tokenRecord['user_id']);
        if (!$user || $user['status'] !== 'active') {
            return null;
        }

        return $user;
    }

    public static function issueToken(PDO $pdo, int $userId, string $tokenName = 'esms-pwa', ?string $deviceId = null): string
    {
        $plainToken = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $plainToken);

        $stmt = $pdo->prepare("
            INSERT INTO `personal_access_tokens` (`user_id`, `name`, `token_hash`, `device_id`, `last_used_at`, `expires_at`)
            VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
        ");
        $stmt->execute([$userId, $tokenName, $tokenHash, $deviceId]);

        return $plainToken;
    }
}
