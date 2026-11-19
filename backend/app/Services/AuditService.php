<?php

namespace App\Services;

use PDO;

class AuditService
{
    public static function log(
        PDO $pdo,
        ?int $userId,
        string $action,
        string $entityType,
        string|int|null $entityId = null,
        mixed $previousValues = null,
        mixed $newValues = null,
        ?string $reason = null,
        ?string $deviceId = null
    ): void {
        $stmt = $pdo->prepare("
            INSERT INTO `audit_logs` (
                `user_id`, `action`, `entity_type`, `entity_id`,
                `previous_values`, `new_values`, `reason`, `device_id`, `ip_address`
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $prevJson = $previousValues !== null
            ? (is_string($previousValues) ? $previousValues : json_encode($previousValues))
            : null;
        $newJson = $newValues !== null
            ? (is_string($newValues) ? $newValues : json_encode($newValues))
            : null;

        $stmt->execute([
            $userId,
            $action,
            $entityType,
            $entityId !== null ? (string) $entityId : null,
            $prevJson,
            $newJson,
            $reason,
            $deviceId ?? ($_SERVER['HTTP_X_DEVICE_ID'] ?? 'WEB-CLIENT'),
            $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
        ]);
    }
}
