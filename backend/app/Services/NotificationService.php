<?php

namespace App\Services;

use PDO;

class NotificationService
{
    /**
     * Creates an unread top-of-app notification for the Shop Admin whenever a non-Admin
     * employee completes a sale, sells out a product (stock hits 0), or records an expense.
     */
    public static function notifyAdmin(
        PDO $pdo,
        array $actorUser,
        string $type,
        string $severity,
        string $title,
        string $message,
        ?string $entityType = null,
        ?int $entityId = null,
        ?float $amount = null,
        array $meta = []
    ): void {
        // Do not notify Admin for actions performed by Admin themselves
        if (in_array('owner', $actorUser['role_slugs'] ?? [], true)) {
            return;
        }

        try {
            $stmt = $pdo->prepare("
                INSERT INTO `admin_notifications` (
                    `type`, `severity`, `title`, `message`, `actor_user_id`, `actor_name`,
                    `entity_type`, `entity_id`, `amount`, `meta_json`, `is_read`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            ");
            $stmt->execute([
                $type,
                $severity,
                mb_substr($title, 0, 180),
                $message,
                isset($actorUser['id']) ? (int) $actorUser['id'] : null,
                $actorUser['full_name'] ?? ($actorUser['username'] ?? 'Employee'),
                $entityType,
                $entityId,
                $amount,
                !empty($meta) ? json_encode($meta, JSON_UNESCAPED_UNICODE) : null,
            ]);
        } catch (\Throwable $e) {
            // Never block POS sales or expense recording if notification insert fails
        }
    }
}
