<?php

namespace App\Http\Controllers\Api;

use App\Services\AuthService;
use PDO;

abstract class BaseApiController
{
    protected static function json(mixed $data, int $status = 200): never
    {
        $payload = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($payload === false) {
            $payload = '{"success":false,"message":"Failed to encode JSON response."}';
        }

        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Vary: Accept-Encoding');

        $acceptEncoding = (string) ($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '');
        if (
            strlen($payload) >= 1024
            && str_contains($acceptEncoding, 'gzip')
            && function_exists('gzencode')
        ) {
            $compressed = gzencode($payload, 6);
            if ($compressed !== false) {
                header('Content-Encoding: gzip');
                header('Content-Length: ' . (string) strlen($compressed));
                echo $compressed;
                exit;
            }
        }

        header('Content-Length: ' . (string) strlen($payload));
        echo $payload;
        exit;
    }

    protected static function error(string $message, int $status = 400, array $errors = []): never
    {
        $payload = ['success' => false, 'message' => $message];
        if (!empty($errors)) {
            $payload['errors'] = $errors;
        }
        self::json($payload, $status);
    }

    protected static function input(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw !== false && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                return array_merge($_GET, $_POST, $decoded);
            }
        }
        return array_merge($_GET, $_POST);
    }

    protected static function requirePermission(array $user, string|array $permissions): void
    {
        $list = is_array($permissions) ? $permissions : [$permissions];
        foreach ($list as $perm) {
            if (AuthService::hasPermission($user, $perm)) {
                return;
            }
        }
        self::error(
            'Access denied: You do not have permission (' . implode(' or ', $list) . ') to perform this operation.',
            403
        );
    }

    protected static function uuid(string $prefix = 'tx'): string
    {
        return sprintf(
            '%s-%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            $prefix,
            random_int(0, 0xffff),
            random_int(0, 0xffff),
            random_int(0, 0xffff),
            random_int(0, 0x0fff) | 0x4000,
            random_int(0, 0x3fff) | 0x8000,
            random_int(0, 0xffff),
            random_int(0, 0xffff),
            random_int(0, 0xffff)
        );
    }

    /**
     * Collision-safe sequential reference/receipt/code generator (safe even after row deletions).
     */
    protected static function nextUniqueCode(
        PDO $pdo,
        string $table,
        string $column,
        string $prefix,
        int $padWidth,
        int $minStart = 1
    ): string {
        $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
        $safeCol = preg_replace('/[^a-zA-Z0-9_]/', '', $column);

        $stmt = $pdo->prepare("SELECT `{$safeCol}` FROM `{$safeTable}` WHERE `{$safeCol}` LIKE ?");
        $stmt->execute([$prefix . '%']);
        $existing = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $prefixLen = strlen($prefix);
        $maxNum = $minStart - 1;
        foreach ($existing as $code) {
            $suffix = substr((string) $code, $prefixLen);
            if ($suffix !== '' && ctype_digit($suffix)) {
                $num = (int) $suffix;
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }

        $seq = max($minStart, $maxNum + 1);
        $chk = $pdo->prepare("SELECT COUNT(*) FROM `{$safeTable}` WHERE `{$safeCol}` = ?");
        while (true) {
            $candidate = $prefix . str_pad((string) $seq, $padWidth, '0', STR_PAD_LEFT);
            $chk->execute([$candidate]);
            if ((int) $chk->fetchColumn() === 0) {
                return $candidate;
            }
            $seq++;
        }
    }
}
