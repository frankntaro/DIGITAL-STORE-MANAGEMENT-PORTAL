<?php

namespace App\Http\Controllers\Api;

use App\Services\AuditService;
use App\Services\AuthService;
use PDO;

class AuthController extends BaseApiController
{
    public static function login(PDO $pdo): never
    {
        $data = self::input();
        $username = trim((string) ($data['username'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        $deviceId = trim((string) ($data['device_id'] ?? 'WEB-POS-01'));

        if ($username === '' || $password === '') {
            self::error('Username and password are required.', 422);
        }

        $stmt = $pdo->prepare("
            SELECT `id`, `username`, `email`, `password_hash`, `status`
            FROM `users`
            WHERE `username` = ? OR `email` = ?
            LIMIT 1
        ");
        $stmt->execute([$username, $username]);
        $account = $stmt->fetch();

        if (!$account || !password_verify($password, $account['password_hash'])) {
            self::error('Invalid username or password.', 401);
        }

        if ($account['status'] !== 'active') {
            self::error('This employee account has been deactivated. Contact the Shop Owner.', 403);
        }

        $userId = (int) $account['id'];
        $pdo->prepare("UPDATE `users` SET `last_login_at` = NOW() WHERE `id` = ?")->execute([$userId]);

        $token = AuthService::issueToken($pdo, $userId, 'esms-session', $deviceId);
        $user = AuthService::getUserWithRolesAndPermissions($pdo, $userId);
        $settings = $pdo->query("SELECT * FROM `shop_settings` ORDER BY `id` ASC LIMIT 1")->fetch();

        AuditService::log($pdo, $userId, 'auth.login', 'User', $userId, null, ['username' => $user['username']], 'Employee login', $deviceId);

        self::json([
            'success'  => true,
            'token'    => $token,
            'user'     => $user,
            'settings' => $settings,
        ]);
    }

    public static function me(PDO $pdo, array $user): never
    {
        $settings = $pdo->query("SELECT * FROM `shop_settings` ORDER BY `id` ASC LIMIT 1")->fetch();
        self::json([
            'success'  => true,
            'user'     => $user,
            'settings' => $settings,
        ]);
    }

    public static function logout(PDO $pdo, array $user): never
    {
        $hash = self::currentTokenHash();
        if ($hash !== null) {
            $pdo->prepare("DELETE FROM `personal_access_tokens` WHERE `token_hash` = ?")->execute([$hash]);
        }
        AuditService::log($pdo, (int) $user['id'], 'auth.logout', 'User', $user['id'], null, null, 'Employee logout');
        self::json(['success' => true, 'message' => 'Logged out successfully.']);
    }

    private static function currentTokenHash(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (empty($header) && function_exists('getallheaders')) {
            $headers = getallheaders();
            $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        }
        if (preg_match('/Bearer\s+(.+)$/i', $header, $matches)) {
            return hash('sha256', trim($matches[1]));
        }
        return null;
    }

    private static function isAdminOwner(array $user): bool
    {
        return in_array('owner', $user['role_slugs'] ?? [], true);
    }

    public static function getAccount(PDO $pdo, array $user): never
    {
        $userId = (int) $user['id'];
        $currentHash = self::currentTokenHash();

        $stmt = $pdo->prepare("
            SELECT `id`, `name`, `device_id`, `token_hash`, `last_used_at`, `created_at`, `expires_at`
            FROM `personal_access_tokens`
            WHERE `user_id` = ?
              AND (`expires_at` IS NULL OR `expires_at` > NOW())
            ORDER BY COALESCE(`last_used_at`, `created_at`) DESC
        ");
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll();

        $sessions = [];
        foreach ($rows as $row) {
            $sessions[] = [
                'id'           => (int) $row['id'],
                'name'         => $row['name'],
                'device_id'    => $row['device_id'] ?: 'WEB-POS',
                'last_used_at' => $row['last_used_at'],
                'created_at'   => $row['created_at'],
                'expires_at'   => $row['expires_at'],
                'is_current'   => $currentHash !== null && hash_equals($row['token_hash'], $currentHash),
            ];
        }

        self::json([
            'success'               => true,
            'user'                  => AuthService::getUserWithRolesAndPermissions($pdo, $userId),
            'sessions'              => $sessions,
            'active_sessions_count' => count($sessions),
        ]);
    }

    public static function updateAccountProfile(PDO $pdo, array $user): never
    {
        $userId = (int) $user['id'];
        $isAdmin = self::isAdminOwner($user);
        $data = self::input();

        $fullName = trim((string) ($data['full_name'] ?? $user['full_name'] ?? ''));
        $username = trim((string) ($data['username'] ?? ''));
        $email = array_key_exists('email', $data) ? (trim((string) $data['email']) ?: null) : ($user['email'] ?? null);
        $phone = array_key_exists('phone', $data) ? (trim((string) $data['phone']) ?: null) : ($user['phone'] ?? null);

        if ($fullName === '' || $username === '') {
            self::error('Full name and username are required.', 422);
        }
        if (strlen($username) < 3 || preg_match('/\s/', $username)) {
            self::error('Username must be at least 3 characters with no spaces.', 422);
        }
        if ($email !== null && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            self::error('Please enter a valid email address.', 422);
        }

        $chkUser = $pdo->prepare("SELECT COUNT(*) FROM `users` WHERE `username` = ? AND `id` != ?");
        $chkUser->execute([$username, $userId]);
        if ((int) $chkUser->fetchColumn() > 0) {
            self::error('This username is already used by another account.', 422);
        }

        if ($email !== null) {
            $chkEmail = $pdo->prepare("SELECT COUNT(*) FROM `users` WHERE `email` = ? AND `id` != ?");
            $chkEmail->execute([$email, $userId]);
            if ((int) $chkEmail->fetchColumn() > 0) {
                self::error('This email address is already used by another account.', 422);
            }
        }

        $before = [
            'full_name' => $user['full_name'],
            'username'  => $user['username'],
            'email'     => $user['email'],
            'phone'     => $user['phone'],
        ];

        $pdo->prepare("
            UPDATE `users`
            SET `full_name` = ?, `username` = ?, `email` = ?, `phone` = ?
            WHERE `id` = ?
        ")->execute([$fullName, $username, $email, $phone, $userId]);

        $updated = AuthService::getUserWithRolesAndPermissions($pdo, $userId);

        AuditService::log(
            $pdo,
            $userId,
            $isAdmin ? 'admin.account_updated' : 'user.account_updated',
            'User',
            $userId,
            $before,
            [
                'full_name' => $fullName,
                'username'  => $username,
                'email'     => $email,
                'phone'     => $phone,
            ],
            $isAdmin ? 'Admin updated own account profile settings' : 'Employee updated own account profile settings'
        );

        self::json([
            'success' => true,
            'message' => $isAdmin ? 'Admin account profile updated successfully.' : 'Account profile updated successfully.',
            'user'    => $updated,
        ]);
    }

    public static function changeAccountPassword(PDO $pdo, array $user): never
    {
        $userId = (int) $user['id'];
        $isAdmin = self::isAdminOwner($user);
        $data = self::input();

        $currentPassword = (string) ($data['current_password'] ?? '');
        $newPassword = (string) ($data['new_password'] ?? '');
        $confirmPassword = (string) ($data['confirm_password'] ?? '');
        $revokeOthers = !empty($data['revoke_other_sessions']);

        if ($currentPassword === '' || $newPassword === '') {
            self::error('Current password and new password are required.', 422);
        }
        if (strlen($newPassword) < 6) {
            self::error('New password must be at least 6 characters long.', 422);
        }
        if ($confirmPassword !== '' && $newPassword !== $confirmPassword) {
            self::error('New password and confirmation do not match.', 422);
        }

        $stmt = $pdo->prepare("SELECT `password_hash` FROM `users` WHERE `id` = ? LIMIT 1");
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if (!$row || !password_verify($currentPassword, $row['password_hash'])) {
            self::error('Current password is incorrect.', 422);
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare("UPDATE `users` SET `password_hash` = ? WHERE `id` = ?")
                ->execute([password_hash($newPassword, PASSWORD_BCRYPT), $userId]);

            $revoked = 0;
            if ($revokeOthers) {
                $currentHash = self::currentTokenHash();
                if ($currentHash !== null) {
                    $delStmt = $pdo->prepare("DELETE FROM `personal_access_tokens` WHERE `user_id` = ? AND `token_hash` != ?");
                    $delStmt->execute([$userId, $currentHash]);
                    $revoked = $delStmt->rowCount();
                }
            }

            AuditService::log(
                $pdo,
                $userId,
                $isAdmin ? 'admin.password_changed' : 'user.password_changed',
                'User',
                $userId,
                null,
                ['revoked_other_sessions' => $revoked],
                $isAdmin ? 'Admin changed own account password' : 'Employee changed own account password'
            );

            $pdo->commit();
            self::json([
                'success'          => true,
                'message'          => $isAdmin ? 'Admin password updated successfully.' : 'Password updated successfully.',
                'revoked_sessions' => $revoked,
            ]);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            self::error('Failed to update password: ' . $e->getMessage(), 500);
        }
    }

    public static function revokeOtherSessions(PDO $pdo, array $user): never
    {
        $userId = (int) $user['id'];
        $isAdmin = self::isAdminOwner($user);
        $currentHash = self::currentTokenHash();

        $revoked = 0;
        if ($currentHash !== null) {
            $delStmt = $pdo->prepare("DELETE FROM `personal_access_tokens` WHERE `user_id` = ? AND `token_hash` != ?");
            $delStmt->execute([$userId, $currentHash]);
            $revoked = $delStmt->rowCount();
        }

        AuditService::log(
            $pdo,
            $userId,
            $isAdmin ? 'admin.sessions_revoked' : 'user.sessions_revoked',
            'User',
            $userId,
            null,
            ['revoked_sessions' => $revoked],
            $isAdmin ? 'Admin signed out all other active devices' : 'Employee signed out all other active devices'
        );

        self::json([
            'success'          => true,
            'message'          => 'Signed out all other active devices successfully.',
            'revoked_sessions' => $revoked,
        ]);
    }
}
