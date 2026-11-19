<?php

namespace App\Http\Controllers\Api;

use App\Services\AuditService;
use App\Services\AuthService;
use App\Services\FinancialService;
use PDO;

class CatalogInventoryController extends BaseApiController
{
    // ========================================================================
    // CATEGORIES (SRS 3.3)
    // ========================================================================
    public static function listCategories(PDO $pdo, array $user): never
    {
        $stmt = $pdo->query("
            SELECT c.*,
                   COUNT(CASE WHEN p.`status` = 'active' THEN 1 END) AS active_products_count,
                   COALESCE(SUM(CASE WHEN p.`status` = 'active' THEN i.`available_quantity` ELSE 0 END), 0) AS total_stock
            FROM `categories` c
            LEFT JOIN `products` p ON p.`category_id` = c.`id`
            LEFT JOIN `inventories` i ON i.`product_id` = p.`id`
            GROUP BY c.`id`
            ORDER BY c.`is_default` DESC, c.`name` ASC
        ");
        self::json(['success' => true, 'categories' => $stmt->fetchAll()]);
    }

    public static function saveCategory(PDO $pdo, array $user, ?int $categoryId = null): never
    {
        self::requirePermission($user, 'categories.manage');
        $data = self::input();

        $name = trim((string) ($data['name'] ?? ''));
        $icon = trim((string) ($data['icon'] ?? 'Smartphone'));
        $description = trim((string) ($data['description'] ?? ''));
        $rawStatus = $data['status'] ?? 'active';
        $status = in_array($rawStatus, ['active', 'archived'], true) ? $rawStatus : 'active';

        if ($name === '') {
            self::error('Category name is required.', 422);
        }

        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $name), '-'));

        if ($categoryId === null) {
            $stmt = $pdo->prepare("
                INSERT INTO `categories` (`name`, `slug`, `icon`, `description`, `is_default`, `status`)
                VALUES (?, ?, ?, ?, 0, 'active')
            ");
            $stmt->execute([$name, $slug, $icon, $description]);
            $newId = (int) $pdo->lastInsertId();
            AuditService::log($pdo, (int) $user['id'], 'category.created', 'Category', $newId, null, ['name' => $name]);
            self::json(['success' => true, 'message' => 'Category created successfully.', 'id' => $newId], 201);
        } else {
            $pdo->prepare("
                UPDATE `categories`
                SET `name` = ?, `icon` = ?, `description` = ?, `status` = ?
                WHERE `id` = ?
            ")->execute([$name, $icon, $description, $status, $categoryId]);
            AuditService::log($pdo, (int) $user['id'], 'category.updated', 'Category', $categoryId, null, ['name' => $name, 'status' => $status]);
            self::json(['success' => true, 'message' => 'Category updated successfully.']);
        }
    }

    // ========================================================================
    // PRODUCTS (SRS 3.2 — AT-01, AT-02, AT-03)
    // ========================================================================
    public static function listProducts(PDO $pdo, array $user): never
    {
        $search = trim((string) ($_GET['search'] ?? ''));
        $categoryId = isset($_GET['category_id']) && $_GET['category_id'] !== '' ? (int) $_GET['category_id'] : null;
        $status = $_GET['status'] ?? 'active';
        $purchaseFilter = trim((string) ($_GET['purchase_filter'] ?? 'all'));

        $where = ["1=1"];
        $params = [];

        if ($status !== 'all') {
            $where[] = "p.`status` = ?";
            $params[] = $status;
        }
        if ($categoryId) {
            $where[] = "p.`category_id` = ?";
            $params[] = $categoryId;
        }
        if ($purchaseFilter === 'new') {
            // Products from Admin-approved purchases (recent 14 days)
            $where[] = "EXISTS (
                SELECT 1 FROM `purchase_items` pi2
                INNER JOIN `purchases` pu2 ON pu2.`id` = pi2.`purchase_id`
                WHERE pi2.`product_id` = p.`id`
                  AND pu2.`status` IN ('received', 'partially_received')
                  AND pi2.`received_quantity` > 0
                  AND COALESCE(pu2.`approved_at`, pu2.`received_at`, CONCAT(pu2.`purchase_date`, ' 00:00:00')) >= DATE_SUB(NOW(), INTERVAL 14 DAY)
            )";
        } elseif ($purchaseFilter === 'old') {
            // Existing / older catalog products without a recent Admin-approved purchase
            $where[] = "NOT EXISTS (
                SELECT 1 FROM `purchase_items` pi2
                INNER JOIN `purchases` pu2 ON pu2.`id` = pi2.`purchase_id`
                WHERE pi2.`product_id` = p.`id`
                  AND pu2.`status` IN ('received', 'partially_received')
                  AND pi2.`received_quantity` > 0
                  AND COALESCE(pu2.`approved_at`, pu2.`received_at`, CONCAT(pu2.`purchase_date`, ' 00:00:00')) >= DATE_SUB(NOW(), INTERVAL 14 DAY)
            )";
        } elseif ($purchaseFilter === 'purchased') {
            $where[] = "EXISTS (
                SELECT 1 FROM `purchase_items` pi2
                INNER JOIN `purchases` pu2 ON pu2.`id` = pi2.`purchase_id`
                WHERE pi2.`product_id` = p.`id`
                  AND pu2.`status` IN ('received', 'partially_received')
                  AND pi2.`received_quantity` > 0
            )";
        }
        if ($search !== '') {
            $where[] = "(p.`name` LIKE ? OR p.`sku` LIKE ? OR p.`barcode` LIKE ? OR p.`brand` LIKE ? OR p.`model` LIKE ?)";
            $like = "%{$search}%";
            array_push($params, $like, $like, $like, $like, $like);
        }

        $whereSql = implode(' AND ', $where);
        $stmt = $pdo->prepare("
            SELECT p.*,
                   c.`name` AS category_name,
                   c.`icon` AS category_icon,
                   COALESCE(i.`available_quantity`, 0) AS available_quantity,
                   COALESCE(i.`reserved_offline_quantity`, 0) AS reserved_offline_quantity,
                   COALESCE(i.`damaged_quantity`, 0) AS damaged_quantity,
                   COALESCE(i.`under_inspection_quantity`, 0) AS under_inspection_quantity,
                   COALESCE(i.`unit_cost`, p.`purchase_price`) AS inventory_unit_cost,
                   CASE
                     WHEN COALESCE(i.`available_quantity`, 0) <= 0 THEN 'out_of_stock'
                     WHEN COALESCE(i.`available_quantity`, 0) <= p.`min_stock_level` THEN 'low_stock'
                     ELSE 'in_stock'
                   END AS stock_status,
                   (SELECT COUNT(*) FROM `sale_items` si WHERE si.`product_id` = p.`id`) AS sales_history_count,
                   (SELECT COUNT(*) FROM `purchase_items` pi WHERE pi.`product_id` = p.`id`) AS purchase_history_count,
                   COALESCE((
                       SELECT SUM(pi.`ordered_quantity`)
                       FROM `purchase_items` pi
                       INNER JOIN `purchases` pu ON pu.`id` = pi.`purchase_id`
                       WHERE pi.`product_id` = p.`id` AND pu.`status` = 'pending'
                   ), 0) AS pending_order_qty,
                   COALESCE((
                       SELECT SUM(pi.`received_quantity`)
                       FROM `purchase_items` pi
                       INNER JOIN `purchases` pu ON pu.`id` = pi.`purchase_id`
                       WHERE pi.`product_id` = p.`id` AND pu.`status` IN ('received', 'partially_received')
                   ), 0) AS total_purchased_qty,
                   COALESCE((
                       SELECT pi.`received_quantity`
                       FROM `purchase_items` pi
                       INNER JOIN `purchases` pu ON pu.`id` = pi.`purchase_id`
                       WHERE pi.`product_id` = p.`id`
                         AND pu.`status` IN ('received', 'partially_received')
                         AND pi.`received_quantity` > 0
                       ORDER BY COALESCE(pu.`approved_at`, pu.`received_at`, pu.`created_at`) DESC, pu.`id` DESC
                       LIMIT 1
                   ), 0) AS last_purchased_qty,
                   (
                       SELECT MAX(COALESCE(pu.`approved_at`, pu.`received_at`, CONCAT(pu.`purchase_date`, ' 00:00:00')))
                       FROM `purchase_items` pi
                       INNER JOIN `purchases` pu ON pu.`id` = pi.`purchase_id`
                       WHERE pi.`product_id` = p.`id`
                         AND pu.`status` IN ('received', 'partially_received')
                         AND pi.`received_quantity` > 0
                   ) AS last_purchased_at,
                   CASE
                     WHEN EXISTS (
                       SELECT 1 FROM `purchase_items` pi
                       INNER JOIN `purchases` pu ON pu.`id` = pi.`purchase_id`
                       WHERE pi.`product_id` = p.`id`
                         AND pu.`status` IN ('received', 'partially_received')
                         AND pi.`received_quantity` > 0
                         AND COALESCE(pu.`approved_at`, pu.`received_at`, CONCAT(pu.`purchase_date`, ' 00:00:00')) >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                     ) THEN 1
                     ELSE 0
                   END AS is_newly_purchased
            FROM `products` p
            INNER JOIN `categories` c ON c.`id` = p.`category_id`
            LEFT JOIN `inventories` i ON i.`product_id` = p.`id`
            WHERE {$whereSql}
            ORDER BY is_newly_purchased DESC, last_purchased_at DESC, p.`id` DESC
        ");
        $stmt->execute($params);

        self::json(['success' => true, 'products' => $stmt->fetchAll()]);
    }

    public static function getProductDetails(PDO $pdo, array $user, int $productId): never
    {
        $stmt = $pdo->prepare("
            SELECT p.*, c.`name` AS category_name,
                   COALESCE(i.`available_quantity`, 0) AS available_quantity,
                   COALESCE(i.`damaged_quantity`, 0) AS damaged_quantity,
                   COALESCE(i.`under_inspection_quantity`, 0) AS under_inspection_quantity,
                   COALESCE(i.`unit_cost`, p.`purchase_price`) AS inventory_unit_cost
            FROM `products` p
            INNER JOIN `categories` c ON c.`id` = p.`category_id`
            LEFT JOIN `inventories` i ON i.`product_id` = p.`id`
            WHERE p.`id` = ?
        ");
        $stmt->execute([$productId]);
        $product = $stmt->fetch();
        if (!$product) {
            self::error('Product not found.', 404);
        }

        $movStmt = $pdo->prepare("
            SELECT sm.*, u.`full_name` AS user_name
            FROM `stock_movements` sm
            LEFT JOIN `users` u ON u.`id` = sm.`user_id`
            WHERE sm.`product_id` = ?
            ORDER BY sm.`id` DESC
            LIMIT 50
        ");
        $movStmt->execute([$productId]);

        self::json([
            'success'   => true,
            'product'   => $product,
            'movements' => $movStmt->fetchAll(),
        ]);
    }

    public static function createProduct(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'products.manage');
        $data = self::input();

        $name = trim((string) ($data['name'] ?? ''));
        $categoryId = (int) ($data['category_id'] ?? 0);
        $sku = strtoupper(trim((string) ($data['sku'] ?? '')));
        $barcode = trim((string) ($data['barcode'] ?? '')) ?: null;
        $brand = trim((string) ($data['brand'] ?? '')) ?: null;
        $model = trim((string) ($data['model'] ?? '')) ?: null;
        $description = trim((string) ($data['description'] ?? '')) ?: null;
        $purchasePrice = (float) ($data['purchase_price'] ?? 0);
        $sellingPrice = (float) ($data['selling_price'] ?? 0);
        $rawUnit = strtolower(trim((string) ($data['unit'] ?? '')));
        $isCarpetName = str_contains(strtolower($name), 'carpet') || str_contains(strtolower($name), 'zulia');
        $unit = in_array($rawUnit, ['piece', 'meter'], true) ? $rawUnit : ($isCarpetName ? 'meter' : 'piece');
        $minStock = round(max(0.0, (float) ($data['min_stock_level'] ?? 5)), 2);
        $warrantyMonths = (int) ($data['warranty_months'] ?? 12);
        $initialQty = $unit === 'meter'
            ? round(max(0.0, (float) ($data['initial_quantity'] ?? 0)), 2)
            : (float) max(0, (int) round((float) ($data['initial_quantity'] ?? 0)));
        $imageUrl = trim((string) ($data['image_url'] ?? '')) ?: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&q=80';

        if ($name === '' || $categoryId <= 0 || $sellingPrice <= 0) {
            self::error('Product name, category, and selling price (> 0 TZS) are required.', 422);
        }

        if ($sku === '') {
            $sku = 'SKU-' . strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name), 0, 4)) . '-' . random_int(1000, 9999);
        }

        $chk = $pdo->prepare("SELECT COUNT(*) FROM `products` WHERE `sku` = ?");
        $chk->execute([$sku]);
        if ((int) $chk->fetchColumn() > 0) {
            self::error("A product with SKU '{$sku}' already exists.", 422);
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("
                INSERT INTO `products` (
                    `sku`, `barcode`, `name`, `category_id`, `brand`, `model`, `description`,
                    `purchase_price`, `selling_price`, `weighted_avg_cost`, `unit`, `min_stock_level`,
                    `warranty_months`, `image_url`, `status`, `created_by`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
            ");
            $stmt->execute([
                $sku, $barcode, $name, $categoryId, $brand, $model, $description,
                $purchasePrice, $sellingPrice, $purchasePrice, $unit, $minStock,
                $warrantyMonths, $imageUrl, $user['id']
            ]);
            $productId = (int) $pdo->lastInsertId();

            $pdo->prepare("
                INSERT INTO `inventories` (`product_id`, `available_quantity`, `unit_cost`, `last_counted_at`)
                VALUES (?, ?, ?, NOW())
            ")->execute([$productId, $initialQty, $purchasePrice]);

            if ($initialQty > 0) {
                $pdo->prepare("
                    INSERT INTO `stock_movements` (
                        `uuid`, `product_id`, `movement_type`, `previous_quantity`, `change_quantity`,
                        `new_quantity`, `unit_cost`, `reference_type`, `reference_id`, `reason`, `notes`, `user_id`
                    ) VALUES (?, ?, 'initial_stock', 0, ?, ?, ?, 'Product', ?, 'Initial opening stock registration', 'Registered during product creation', ?)
                ")->execute([
                    self::uuid('sm'), $productId, $initialQty, $initialQty, $purchasePrice, $productId, $user['id']
                ]);
            }

            AuditService::log(
                $pdo,
                (int) $user['id'],
                'product.created',
                'Product',
                $productId,
                null,
                ['sku' => $sku, 'name' => $name, 'purchase_price' => $purchasePrice, 'selling_price' => $sellingPrice, 'initial_qty' => $initialQty],
                'Registered new product'
            );

            $pdo->commit();
            self::json([
                'success'    => true,
                'message'    => 'Product registered successfully.',
                'product_id' => $productId,
            ], 201);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            self::error('Failed to register product: ' . $e->getMessage(), 500);
        }
    }

    public static function updateProduct(PDO $pdo, array $user, int $productId): never
    {
        self::requirePermission($user, 'products.manage');
        if (!in_array('owner', $user['role_slugs'] ?? [], true)) {
            self::error('Access denied: Only the Shop Admin can edit or archive products.', 403);
        }
        $data = self::input();

        $stmt = $pdo->prepare("SELECT * FROM `products` WHERE `id` = ?");
        $stmt->execute([$productId]);
        $before = $stmt->fetch();
        if (!$before) {
            self::error('Product not found.', 404);
        }

        $newPurchasePrice = isset($data['purchase_price']) ? (float) $data['purchase_price'] : (float) $before['purchase_price'];
        $newSellingPrice = isset($data['selling_price']) ? (float) $data['selling_price'] : (float) $before['selling_price'];

        // SRS 2.2 restriction: Cannot change product purchase prices without authorization
        if (abs($newPurchasePrice - (float) $before['purchase_price']) > 0.01) {
            if (!AuthService::hasPermission($user, 'products.edit_cost')) {
                self::error('Access denied: You are not authorized to change product purchase prices.', 403);
            }
        }

        $pdo->beginTransaction();
        try {
            $newStatus = (isset($data['status']) && in_array($data['status'], ['active', 'archived'], true))
                ? $data['status']
                : (in_array($before['status'], ['active', 'archived'], true) ? $before['status'] : 'active');
            $rawUnit = strtolower(trim((string) ($data['unit'] ?? '')));
            $newUnit = in_array($rawUnit, ['piece', 'meter'], true)
                ? $rawUnit
                : ($before['unit'] ?? 'piece');

            $pdo->prepare("
                UPDATE `products`
                SET `name` = ?,
                    `category_id` = ?,
                    `sku` = ?,
                    `barcode` = ?,
                    `brand` = ?,
                    `model` = ?,
                    `description` = ?,
                    `purchase_price` = ?,
                    `selling_price` = ?,
                    `unit` = ?,
                    `min_stock_level` = ?,
                    `warranty_months` = ?,
                    `image_url` = ?,
                    `status` = ?
                WHERE `id` = ?
            ")->execute([
                trim((string) ($data['name'] ?? $before['name'])),
                (int) ($data['category_id'] ?? $before['category_id']),
                strtoupper(trim((string) ($data['sku'] ?? $before['sku']))),
                isset($data['barcode']) ? (trim((string) $data['barcode']) ?: null) : $before['barcode'],
                isset($data['brand']) ? (trim((string) $data['brand']) ?: null) : $before['brand'],
                isset($data['model']) ? (trim((string) $data['model']) ?: null) : $before['model'],
                isset($data['description']) ? (trim((string) $data['description']) ?: null) : $before['description'],
                $newPurchasePrice,
                $newSellingPrice,
                $newUnit,
                round(max(0.0, (float) ($data['min_stock_level'] ?? $before['min_stock_level'])), 2),
                (int) ($data['warranty_months'] ?? $before['warranty_months']),
                trim((string) ($data['image_url'] ?? $before['image_url'])),
                $newStatus,
                $productId,
            ]);

            $priceChanged = abs($newPurchasePrice - (float) $before['purchase_price']) > 0.01
                || abs($newSellingPrice - (float) $before['selling_price']) > 0.01;

            AuditService::log(
                $pdo,
                (int) $user['id'],
                $priceChanged ? 'product.price_changed' : 'product.updated',
                'Product',
                $productId,
                ['name' => $before['name'], 'purchase_price' => $before['purchase_price'], 'selling_price' => $before['selling_price'], 'status' => $before['status']],
                ['name' => $data['name'] ?? $before['name'], 'purchase_price' => $newPurchasePrice, 'selling_price' => $newSellingPrice, 'status' => $newStatus],
                $data['reason'] ?? 'Updated product information'
            );

            $pdo->commit();
            self::json(['success' => true, 'message' => 'Product updated successfully.']);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            self::error('Failed to update product: ' . $e->getMessage(), 500);
        }
    }

    public static function archiveOrRestoreProduct(PDO $pdo, array $user, int $productId): never
    {
        self::requirePermission($user, 'products.manage');
        if (!in_array('owner', $user['role_slugs'] ?? [], true)) {
            self::error('Access denied: Only the Shop Admin can edit or archive products.', 403);
        }
        $data = self::input();

        $stmt = $pdo->prepare("SELECT * FROM `products` WHERE `id` = ?");
        $stmt->execute([$productId]);
        $product = $stmt->fetch();
        if (!$product) {
            self::error('Product not found.', 404);
        }

        // SRS 3.2 Product deletion rules (AT-03):
        // Products with existing purchase or sales records must not be permanently deleted.
        // The system uses product archiving to preserve historical transactions.
        $newStatus = ($data['status'] ?? '') === 'active'
            ? 'active'
            : ($product['status'] === 'active' ? 'archived' : 'active');

        $pdo->prepare("UPDATE `products` SET `status` = ? WHERE `id` = ?")->execute([$newStatus, $productId]);

        AuditService::log(
            $pdo,
            (int) $user['id'],
            $newStatus === 'archived' ? 'product.archived' : 'product.restored',
            'Product',
            $productId,
            ['status' => $product['status']],
            ['status' => $newStatus],
            'Product archived/restored to preserve historical sales and purchase transactions'
        );

        self::json([
            'success' => true,
            'message' => $newStatus === 'archived'
                ? 'Product archived safely. Historical sales and purchase records remain intact.'
                : 'Product restored to active catalogue.',
            'status'  => $newStatus,
        ]);
    }

    // ========================================================================
    // SUPPLIERS & SUPPLIER PAYMENTS (SRS 3.9 — AT-09, AT-10)
    // ========================================================================
    public static function listSuppliers(PDO $pdo, array $user): never
    {
        self::requirePermission($user, ['suppliers.view', 'purchases.view']);

        $stmt = $pdo->query("
            SELECT s.*,
                   COUNT(DISTINCT p.`id`) AS purchases_count,
                   COALESCE(SUM(CASE WHEN p.`status` IN ('received', 'partially_received') THEN p.`total_amount` ELSE 0 END), 0) AS total_purchases,
                   COALESCE(SUM(CASE WHEN p.`status` IN ('received', 'partially_received') THEN p.`amount_paid` ELSE 0 END), 0) AS total_paid,
                   COALESCE(SUM(CASE WHEN p.`status` IN ('received', 'partially_received') THEN p.`outstanding_balance` ELSE 0 END), 0) AS outstanding_balance
            FROM `suppliers` s
            LEFT JOIN `purchases` p ON p.`supplier_id` = s.`id`
            GROUP BY s.`id`
            ORDER BY s.`id` DESC
        ");
        self::json(['success' => true, 'suppliers' => $stmt->fetchAll()]);
    }

    public static function getSupplierProfile(PDO $pdo, array $user, int $supplierId): never
    {
        self::requirePermission($user, ['suppliers.view', 'purchases.view']);

        $stmt = $pdo->prepare("SELECT * FROM `suppliers` WHERE `id` = ?");
        $stmt->execute([$supplierId]);
        $supplier = $stmt->fetch();
        if (!$supplier) {
            self::error('Supplier not found.', 404);
        }

        $purStmt = $pdo->prepare("
            SELECT p.*, u.`full_name` AS recorded_by_name
            FROM `purchases` p
            LEFT JOIN `users` u ON u.`id` = p.`recorded_by`
            WHERE p.`supplier_id` = ?
            ORDER BY p.`id` DESC
        ");
        $purStmt->execute([$supplierId]);
        $purchases = $purStmt->fetchAll();

        $payStmt = $pdo->prepare("
            SELECT sp.*, p.`reference_number` AS purchase_reference, u.`full_name` AS recorded_by_name
            FROM `supplier_payments` sp
            LEFT JOIN `purchases` p ON p.`id` = sp.`purchase_id`
            LEFT JOIN `users` u ON u.`id` = sp.`recorded_by`
            WHERE sp.`supplier_id` = ?
            ORDER BY sp.`id` DESC
        ");
        $payStmt->execute([$supplierId]);
        $payments = $payStmt->fetchAll();

        $totalPurchases = 0.0;
        $outstandingBalance = 0.0;
        foreach ($purchases as $p) {
            if (in_array($p['status'], ['received', 'partially_received'], true)) {
                $totalPurchases += (float) $p['total_amount'];
                $outstandingBalance += (float) $p['outstanding_balance'];
            }
        }
        $totalPaid = array_sum(array_map(fn($x) => (float) $x['amount'], $payments));

        $supplier['total_purchases'] = $totalPurchases;
        $supplier['total_paid'] = $totalPaid;
        $supplier['outstanding_balance'] = $outstandingBalance;

        self::json([
            'success'   => true,
            'supplier'  => $supplier,
            'purchases' => $purchases,
            'payments'  => $payments,
        ]);
    }

    public static function saveSupplier(PDO $pdo, array $user, ?int $supplierId = null): never
    {
        self::requirePermission($user, 'suppliers.manage');
        $data = self::input();

        $name = trim((string) ($data['name'] ?? ''));
        $contact = trim((string) ($data['contact_person'] ?? '')) ?: null;
        $phone = trim((string) ($data['phone'] ?? ''));
        $email = trim((string) ($data['email'] ?? '')) ?: null;
        $address = trim((string) ($data['address'] ?? '')) ?: null;
        $notes = trim((string) ($data['notes'] ?? '')) ?: null;

        if ($name === '' || $phone === '') {
            self::error('Supplier name and phone number are required.', 422);
        }

        if ($supplierId === null) {
            $code = self::nextUniqueCode($pdo, 'suppliers', 'supplier_code', 'SUP-', 3, 1);
            $stmt = $pdo->prepare("
                INSERT INTO `suppliers` (`supplier_code`, `name`, `contact_person`, `phone`, `email`, `address`, `notes`, `status`)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
            ");
            $stmt->execute([$code, $name, $contact, $phone, $email, $address, $notes]);
            $id = (int) $pdo->lastInsertId();
            AuditService::log($pdo, (int) $user['id'], 'supplier.created', 'Supplier', $id, null, ['name' => $name, 'phone' => $phone]);
            self::json(['success' => true, 'message' => 'Supplier registered successfully.', 'id' => $id], 201);
        } else {
            $pdo->prepare("
                UPDATE `suppliers`
                SET `name` = ?, `contact_person` = ?, `phone` = ?, `email` = ?, `address` = ?, `notes` = ?
                WHERE `id` = ?
            ")->execute([$name, $contact, $phone, $email, $address, $notes, $supplierId]);
            AuditService::log($pdo, (int) $user['id'], 'supplier.updated', 'Supplier', $supplierId, null, ['name' => $name]);
            self::json(['success' => true, 'message' => 'Supplier updated successfully.']);
        }
    }

    public static function recordSupplierPayment(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'suppliers.pay');
        $data = self::input();

        $supplierId = (int) ($data['supplier_id'] ?? 0);
        $purchaseId = !empty($data['purchase_id']) ? (int) $data['purchase_id'] : null;
        $amount = (float) ($data['amount'] ?? 0);
        $paymentMethod = trim((string) ($data['payment_method'] ?? 'Cash'));
        $paymentDate = trim((string) ($data['payment_date'] ?? date('Y-m-d')));
        $notes = trim((string) ($data['notes'] ?? '')) ?: null;

        if ($supplierId <= 0 || $amount <= 0) {
            self::error('Supplier and valid payment amount (> 0 TZS) are required.', 422);
        }

        $pdo->beginTransaction();
        try {
            if ($purchaseId) {
                $purStmt = $pdo->prepare("SELECT * FROM `purchases` WHERE `id` = ? AND `supplier_id` = ? FOR UPDATE");
                $purStmt->execute([$purchaseId, $supplierId]);
                $purchase = $purStmt->fetch();
                if (!$purchase) {
                    $pdo->rollBack();
                    self::error('Selected purchase order not found for this supplier.', 404);
                }
                if ($amount > (float) $purchase['outstanding_balance'] + 0.01) {
                    $pdo->rollBack();
                    self::error('Payment amount cannot exceed the purchase outstanding balance of TZS ' . number_format((float) $purchase['outstanding_balance']), 422);
                }

                $newPaid = (float) $purchase['amount_paid'] + $amount;
                $newBalance = max(0.0, (float) $purchase['outstanding_balance'] - $amount);
                $newPayStatus = $newBalance <= 0.01 ? 'paid' : 'partial';

                $pdo->prepare("
                    UPDATE `purchases`
                    SET `amount_paid` = ?, `outstanding_balance` = ?, `payment_status` = ?
                    WHERE `id` = ?
                ")->execute([$newPaid, $newBalance, $newPayStatus, $purchaseId]);
            } else {
                // Allocate across oldest unpaid purchases for this supplier
                $openPurchases = $pdo->prepare("
                    SELECT * FROM `purchases`
                    WHERE `supplier_id` = ? AND `outstanding_balance` > 0 AND `status` IN ('received', 'partially_received')
                    ORDER BY `id` ASC
                    FOR UPDATE
                ");
                $openPurchases->execute([$supplierId]);
                $rows = $openPurchases->fetchAll();
                $totalPayable = array_sum(array_map(fn($r) => (float) $r['outstanding_balance'], $rows));

                if ($amount > $totalPayable + 0.01) {
                    $pdo->rollBack();
                    self::error('Payment exceeds total supplier outstanding liability of TZS ' . number_format($totalPayable), 422);
                }

                $remainingToAllocate = $amount;
                foreach ($rows as $r) {
                    if ($remainingToAllocate <= 0) {
                        break;
                    }
                    $alloc = min($remainingToAllocate, (float) $r['outstanding_balance']);
                    $newPaid = (float) $r['amount_paid'] + $alloc;
                    $newBal = max(0.0, (float) $r['outstanding_balance'] - $alloc);
                    $newSt = $newBal <= 0.01 ? 'paid' : 'partial';
                    $pdo->prepare("
                        UPDATE `purchases`
                        SET `amount_paid` = ?, `outstanding_balance` = ?, `payment_status` = ?
                        WHERE `id` = ?
                    ")->execute([$newPaid, $newBal, $newSt, $r['id']]);
                    if ($purchaseId === null) {
                        $purchaseId = (int) $r['id'];
                    }
                    $remainingToAllocate -= $alloc;
                }
            }

            $refNo = self::nextSupplierPaymentRef($pdo);
            $sessionId = strtolower($paymentMethod) === 'cash' ? FinancialService::getOpenCashSessionId($pdo) : null;

            $pdo->prepare("
                INSERT INTO `supplier_payments` (
                    `uuid`, `reference_number`, `supplier_id`, `purchase_id`,
                    `amount`, `payment_date`, `payment_method`, `cash_session_id`, `notes`, `recorded_by`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ")->execute([
                self::uuid('sp'), $refNo, $supplierId, $purchaseId,
                $amount, $paymentDate, $paymentMethod, $sessionId, $notes, $user['id']
            ]);
            $paymentId = (int) $pdo->lastInsertId();

            if ($sessionId && strtolower($paymentMethod) === 'cash') {
                $pdo->prepare("
                    INSERT INTO `cash_movements` (
                        `uuid`, `cash_session_id`, `direction`, `category`, `amount`,
                        `reference_type`, `reference_id`, `description`, `user_id`
                    ) VALUES (?, ?, 'outflow', 'supplier_payment', ?, 'SupplierPayment', ?, ?, ?)
                ")->execute([
                    self::uuid('cm'), $sessionId, $amount, $paymentId,
                    "Supplier payment {$refNo}", $user['id']
                ]);
                FinancialService::recalculateCashSession($pdo, $sessionId);
            }

            AuditService::log(
                $pdo,
                (int) $user['id'],
                'supplier_payment.recorded',
                'SupplierPayment',
                $paymentId,
                null,
                ['reference_number' => $refNo, 'supplier_id' => $supplierId, 'purchase_id' => $purchaseId, 'amount' => $amount],
                $notes ?? 'Recorded supplier payment'
            );

            $pdo->commit();
            self::json([
                'success'          => true,
                'message'          => "Supplier payment {$refNo} recorded and supplier liability reduced.",
                'reference_number' => $refNo,
            ], 201);
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            self::error('Failed to record supplier payment: ' . $e->getMessage(), 500);
        }
    }

    // ========================================================================
    // PURCHASES, PENDING ORDERS & ORDER APPROVALS (ADMIN ONLY)
    // ========================================================================
    private static function nextPurchaseRef(PDO $pdo): string
    {
        $maxId = (int) $pdo->query("SELECT COALESCE(MAX(`id`), 0) FROM `purchases`")->fetchColumn();
        $seq = max($maxId + 16, 19);
        $chk = $pdo->prepare("SELECT COUNT(*) FROM `purchases` WHERE `reference_number` = ?");
        while (true) {
            $ref = sprintf('P-%04d', $seq);
            $chk->execute([$ref]);
            if ((int) $chk->fetchColumn() === 0) {
                return $ref;
            }
            $seq++;
        }
    }

    private static function nextSupplierPaymentRef(PDO $pdo): string
    {
        $maxId = (int) $pdo->query("SELECT COALESCE(MAX(`id`), 0) FROM `supplier_payments`")->fetchColumn();
        $seq = $maxId + 1;
        $chk = $pdo->prepare("SELECT COUNT(*) FROM `supplier_payments` WHERE `reference_number` = ?");
        while (true) {
            $ref = sprintf('SP-%04d', $seq);
            $chk->execute([$ref]);
            if ((int) $chk->fetchColumn() === 0) {
                return $ref;
            }
            $seq++;
        }
    }

    public static function listPurchases(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'purchases.view');
        $statusFilter = trim((string) ($_GET['status'] ?? 'all'));

        $whereSql = '1=1';
        $params = [];
        if (in_array($statusFilter, ['pending', 'draft', 'partially_received', 'received', 'cancelled'], true)) {
            $whereSql = "p.`status` = ?";
            $params[] = $statusFilter;
        }

        $stmt = $pdo->prepare("
            SELECT p.*,
                   s.`name` AS supplier_name,
                   s.`phone` AS supplier_phone,
                   u.`full_name` AS recorded_by_name,
                   ua.`full_name` AS approved_by_name
            FROM `purchases` p
            INNER JOIN `suppliers` s ON s.`id` = p.`supplier_id`
            LEFT JOIN `users` u ON u.`id` = p.`recorded_by`
            LEFT JOIN `users` ua ON ua.`id` = p.`approved_by`
            WHERE {$whereSql}
            ORDER BY CASE WHEN p.`status` = 'pending' THEN 0 ELSE 1 END ASC, p.`id` DESC
        ");
        $stmt->execute($params);
        $purchases = $stmt->fetchAll();

        $itemStmt = $pdo->prepare("
            SELECT pi.*,
                   pr.`name` AS product_name,
                   pr.`sku`,
                   pr.`unit`,
                   pr.`min_stock_level`,
                   pr.`image_url`,
                   COALESCE(inv.`available_quantity`, 0) AS current_stock
            FROM `purchase_items` pi
            INNER JOIN `products` pr ON pr.`id` = pi.`product_id`
            LEFT JOIN `inventories` inv ON inv.`product_id` = pi.`product_id`
            WHERE pi.`purchase_id` = ?
        ");
        foreach ($purchases as &$pur) {
            $itemStmt->execute([$pur['id']]);
            $pur['items'] = $itemStmt->fetchAll();
        }
        unset($pur);

        $pendingCount = (int) $pdo->query("SELECT COUNT(*) FROM `purchases` WHERE `status` = 'pending'")->fetchColumn();

        self::json([
            'success'       => true,
            'purchases'     => $purchases,
            'pending_count' => $pendingCount,
        ]);
    }

    public static function createPurchase(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'purchases.manage');
        $data = self::input();

        $supplierId = (int) ($data['supplier_id'] ?? 0);
        $purchaseDate = trim((string) ($data['purchase_date'] ?? date('Y-m-d')));
        $rawPurStatus = $data['status'] ?? 'pending';
        $status = in_array($rawPurStatus, ['pending', 'draft', 'partially_received', 'received'], true)
            ? $rawPurStatus
            : 'pending';
        $isPendingOrDraft = in_array($status, ['pending', 'draft'], true);
        $additionalCosts = max(0.0, (float) ($data['additional_costs'] ?? 0));
        $amountPaid = $isPendingOrDraft ? 0.0 : max(0.0, (float) ($data['amount_paid'] ?? 0));
        $paymentMethod = trim((string) ($data['payment_method'] ?? 'Cash'));
        $notes = trim((string) ($data['notes'] ?? '')) ?: null;
        $items = $data['items'] ?? [];

        if ($supplierId <= 0 || empty($items) || !is_array($items)) {
            self::error('Supplier and at least one product line item are required.', 422);
        }

        $pdo->beginTransaction();
        try {
            $subtotal = 0.0;
            $preparedItems = [];

            foreach ($items as $item) {
                $pid = (int) ($item['product_id'] ?? 0);
                $orderedQty = round(max(0.01, (float) ($item['ordered_quantity'] ?? $item['quantity'] ?? 1)), 2);
                $receivedQty = $isPendingOrDraft
                    ? 0.0
                    : ($status === 'received' ? $orderedQty : round(max(0.0, min($orderedQty, (float) ($item['received_quantity'] ?? $orderedQty))), 2));
                $unitCost = max(0.0, (float) ($item['unit_purchase_price'] ?? 0));

                if ($pid <= 0 || $unitCost <= 0) {
                    $pdo->rollBack();
                    self::error('Every purchase item must specify a valid product and unit purchase price (> 0 TZS).', 422);
                }

                $lineTotal = round($orderedQty * $unitCost, 2);
                $subtotal += $lineTotal;
                $preparedItems[] = [
                    'product_id'          => $pid,
                    'ordered_quantity'    => $orderedQty,
                    'received_quantity'   => $receivedQty,
                    'unit_purchase_price' => $unitCost,
                    'line_total'          => $lineTotal,
                ];
            }

            $totalAmount = round($subtotal + $additionalCosts, 2);
            if ($amountPaid > $totalAmount) {
                $amountPaid = $totalAmount;
            }
            $outstandingBalance = $isPendingOrDraft ? $totalAmount : round($totalAmount - $amountPaid, 2);
            $paymentStatus = $amountPaid <= 0 ? 'unpaid' : ($outstandingBalance <= 0.01 ? 'paid' : 'partial');

            $refNo = self::nextPurchaseRef($pdo);
            $now = date('Y-m-d H:i:s');

            $pdo->prepare("
                INSERT INTO `purchases` (
                    `uuid`, `reference_number`, `supplier_id`, `purchase_date`, `status`,
                    `subtotal_amount`, `additional_costs`, `total_amount`, `amount_paid`,
                    `outstanding_balance`, `payment_status`, `payment_method`, `notes`,
                    `recorded_by`, `approved_by`, `approved_at`, `received_at`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ")->execute([
                self::uuid('pur'), $refNo, $supplierId, $purchaseDate, $status,
                $subtotal, $additionalCosts, $totalAmount, $amountPaid,
                $outstandingBalance, $paymentStatus, $paymentMethod, $notes,
                $user['id'],
                $isPendingOrDraft ? null : $user['id'],
                $isPendingOrDraft ? null : $now,
                $isPendingOrDraft ? null : $now,
            ]);
            $purchaseId = (int) $pdo->lastInsertId();

            $piStmt = $pdo->prepare("
                INSERT INTO `purchase_items` (`purchase_id`, `product_id`, `ordered_quantity`, `received_quantity`, `unit_purchase_price`, `line_total`)
                VALUES (?, ?, ?, ?, ?, ?)
            ");

            // SRS 3.4: Only approved/received quantities increase available stock & update Weighted Average Cost
            foreach ($preparedItems as $pi) {
                $piStmt->execute([
                    $purchaseId, $pi['product_id'], $pi['ordered_quantity'],
                    $pi['received_quantity'], $pi['unit_purchase_price'], $pi['line_total']
                ]);

                if ($pi['received_quantity'] > 0) {
                    $invStmt = $pdo->prepare("SELECT * FROM `inventories` WHERE `product_id` = ? FOR UPDATE");
                    $invStmt->execute([$pi['product_id']]);
                    $inv = $invStmt->fetch();

                    $prevQty = $inv ? round((float) $inv['available_quantity'], 2) : 0.0;
                    $prevCost = $inv ? (float) $inv['unit_cost'] : $pi['unit_purchase_price'];
                    $newQty = round($prevQty + $pi['received_quantity'], 2);
                    $newWeightedCost = FinancialService::calculateWeightedAverageCost(
                        $prevQty,
                        $prevCost,
                        $pi['received_quantity'],
                        $pi['unit_purchase_price']
                    );

                    if ($inv) {
                        $pdo->prepare("
                            UPDATE `inventories`
                            SET `available_quantity` = ?, `unit_cost` = ?, `last_counted_at` = NOW()
                            WHERE `product_id` = ?
                        ")->execute([$newQty, $newWeightedCost, $pi['product_id']]);
                    } else {
                        $pdo->prepare("
                            INSERT INTO `inventories` (`product_id`, `available_quantity`, `unit_cost`, `last_counted_at`)
                            VALUES (?, ?, ?, NOW())
                        ")->execute([$pi['product_id'], $newQty, $newWeightedCost]);
                    }

                    // Update product purchase_price & weighted_avg_cost
                    $pdo->prepare("
                        UPDATE `products`
                        SET `purchase_price` = ?, `weighted_avg_cost` = ?
                        WHERE `id` = ?
                    ")->execute([$pi['unit_purchase_price'], $newWeightedCost, $pi['product_id']]);

                    // Record immutable stock movement
                    $pdo->prepare("
                        INSERT INTO `stock_movements` (
                            `uuid`, `product_id`, `movement_type`, `previous_quantity`, `change_quantity`,
                            `new_quantity`, `unit_cost`, `reference_type`, `reference_id`, `reason`, `notes`, `user_id`, `approved_by`
                        ) VALUES (?, ?, 'purchase_receipt', ?, ?, ?, ?, 'Purchase', ?, ?, ?, ?, ?)
                    ")->execute([
                        self::uuid('sm'), $pi['product_id'], $prevQty, $pi['received_quantity'],
                        $newQty, $pi['unit_purchase_price'], $purchaseId,
                        "Goods received on Purchase {$refNo}", $notes, $user['id'], $user['id']
                    ]);
                }
            }

            // Record associated supplier payment and cash outflow if amountPaid > 0 on immediate receipt
            if ($amountPaid > 0 && !$isPendingOrDraft) {
                $spRef = self::nextSupplierPaymentRef($pdo);
                $sessionId = strtolower($paymentMethod) === 'cash' ? FinancialService::getOpenCashSessionId($pdo) : null;

                $pdo->prepare("
                    INSERT INTO `supplier_payments` (
                        `uuid`, `reference_number`, `supplier_id`, `purchase_id`,
                        `amount`, `payment_date`, `payment_method`, `cash_session_id`, `notes`, `recorded_by`
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ")->execute([
                    self::uuid('sp'), $spRef, $supplierId, $purchaseId,
                    $amountPaid, $purchaseDate, $paymentMethod, $sessionId,
                    "Payment on purchase {$refNo}", $user['id']
                ]);

                if ($sessionId && strtolower($paymentMethod) === 'cash') {
                    $pdo->prepare("
                        INSERT INTO `cash_movements` (
                            `uuid`, `cash_session_id`, `direction`, `category`, `amount`,
                            `reference_type`, `reference_id`, `description`, `user_id`
                        ) VALUES (?, ?, 'outflow', 'supplier_payment', ?, 'Purchase', ?, ?, ?)
                    ")->execute([
                        self::uuid('cm'), $sessionId, $amountPaid, $purchaseId,
                        "Cash payment for purchase {$refNo}", $user['id']
                    ]);
                    FinancialService::recalculateCashSession($pdo, $sessionId);
                }
            }

            AuditService::log(
                $pdo,
                (int) $user['id'],
                $isPendingOrDraft ? 'purchase.order_placed' : 'purchase.created',
                'Purchase',
                $purchaseId,
                null,
                [
                    'reference_number'    => $refNo,
                    'status'              => $status,
                    'total_amount'        => $totalAmount,
                    'amount_paid'         => $amountPaid,
                    'outstanding_balance' => $outstandingBalance,
                ],
                $isPendingOrDraft ? 'Placed pending supplier order awaiting delivery and approval' : 'Recorded purchase transaction'
            );

            $pdo->commit();
            self::json([
                'success'          => true,
                'message'          => $isPendingOrDraft
                    ? "Order {$refNo} placed with Pending status. Approve it in Approve Orders once the stock arrives."
                    : "Purchase {$refNo} saved and stock updated successfully.",
                'purchase_id'      => $purchaseId,
                'reference_number' => $refNo,
                'status'           => $status,
            ], 201);
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            self::error('Failed to record purchase: ' . $e->getMessage(), 500);
        }
    }

    public static function approvePurchase(PDO $pdo, array $user, int $purchaseId): never
    {
        self::requirePermission($user, 'purchases.manage');
        $data = self::input();

        $pdo->beginTransaction();
        try {
            $purStmt = $pdo->prepare("SELECT * FROM `purchases` WHERE `id` = ? FOR UPDATE");
            $purStmt->execute([$purchaseId]);
            $purchase = $purStmt->fetch();
            if (!$purchase) {
                $pdo->rollBack();
                self::error('Purchase order not found.', 404);
            }

            if (!in_array($purchase['status'], ['pending', 'draft'], true)) {
                $pdo->rollBack();
                self::error('This order has already been processed and cannot be approved again.', 422);
            }

            $itemStmt = $pdo->prepare("
                SELECT pi.*, pr.`name` AS product_name
                FROM `purchase_items` pi
                INNER JOIN `products` pr ON pr.`id` = pi.`product_id`
                WHERE pi.`purchase_id` = ?
                ORDER BY pi.`id` ASC
            ");
            $itemStmt->execute([$purchaseId]);
            $orderItems = $itemStmt->fetchAll();

            if (empty($orderItems)) {
                $pdo->rollBack();
                self::error('This purchase order has no product items to approve.', 422);
            }

            // Optional per-item received quantity overrides sent by Admin upon delivery inspection
            $qtyOverrides = [];
            if (!empty($data['items']) && is_array($data['items'])) {
                foreach ($data['items'] as $ov) {
                    if (isset($ov['id'])) {
                        $qtyOverrides[(int) $ov['id']] = round(max(0.0, (float) ($ov['received_quantity'] ?? 0)), 2);
                    }
                }
            }

            $subtotal = 0.0;
            $totalReceivedUnits = 0.0;
            $stockUpdates = [];
            $refNo = $purchase['reference_number'];
            $approvalNotes = trim((string) ($data['approval_notes'] ?? '')) ?: null;

            foreach ($orderItems as $item) {
                $itemId = (int) $item['id'];
                $productId = (int) $item['product_id'];
                $orderedQty = round((float) $item['ordered_quantity'], 2);
                $receivedQty = array_key_exists($itemId, $qtyOverrides)
                    ? $qtyOverrides[$itemId]
                    : $orderedQty;
                $unitCost = (float) $item['unit_purchase_price'];
                $lineTotal = round($receivedQty * $unitCost, 2);

                $subtotal += $lineTotal;
                $totalReceivedUnits += $receivedQty;

                $pdo->prepare("
                    UPDATE `purchase_items`
                    SET `received_quantity` = ?, `line_total` = ?
                    WHERE `id` = ?
                ")->execute([$receivedQty, $lineTotal, $itemId]);

                if ($receivedQty > 0) {
                    $invStmt = $pdo->prepare("SELECT * FROM `inventories` WHERE `product_id` = ? FOR UPDATE");
                    $invStmt->execute([$productId]);
                    $inv = $invStmt->fetch();

                    $prevQty = $inv ? round((float) $inv['available_quantity'], 2) : 0.0;
                    $prevCost = $inv ? (float) $inv['unit_cost'] : $unitCost;
                    $newQty = round($prevQty + $receivedQty, 2);
                    $newWeightedCost = FinancialService::calculateWeightedAverageCost(
                        $prevQty,
                        $prevCost,
                        $receivedQty,
                        $unitCost
                    );

                    if ($inv) {
                        $pdo->prepare("
                            UPDATE `inventories`
                            SET `available_quantity` = ?, `unit_cost` = ?, `last_counted_at` = NOW()
                            WHERE `product_id` = ?
                        ")->execute([$newQty, $newWeightedCost, $productId]);
                    } else {
                        $pdo->prepare("
                            INSERT INTO `inventories` (`product_id`, `available_quantity`, `unit_cost`, `last_counted_at`)
                            VALUES (?, ?, ?, NOW())
                        ")->execute([$productId, $newQty, $newWeightedCost]);
                    }

                    $pdo->prepare("
                        UPDATE `products`
                        SET `purchase_price` = ?, `weighted_avg_cost` = ?
                        WHERE `id` = ?
                    ")->execute([$unitCost, $newWeightedCost, $productId]);

                    $pdo->prepare("
                        INSERT INTO `stock_movements` (
                            `uuid`, `product_id`, `movement_type`, `previous_quantity`, `change_quantity`,
                            `new_quantity`, `unit_cost`, `reference_type`, `reference_id`, `reason`, `notes`, `user_id`, `approved_by`
                        ) VALUES (?, ?, 'purchase_receipt', ?, ?, ?, ?, 'Purchase', ?, ?, ?, ?, ?)
                    ")->execute([
                        self::uuid('sm'), $productId, $prevQty, $receivedQty,
                        $newQty, $unitCost, $purchaseId,
                        "Approved & received order {$refNo}",
                        $approvalNotes ?? $purchase['notes'],
                        $user['id'],
                        $user['id'],
                    ]);

                    $stockUpdates[] = [
                        'product_id'        => $productId,
                        'product_name'      => $item['product_name'],
                        'previous_quantity' => $prevQty,
                        'received_quantity' => $receivedQty,
                        'new_quantity'      => $newQty,
                    ];
                }
            }

            if ($totalReceivedUnits <= 0) {
                $pdo->rollBack();
                self::error('At least one product must have received quantity greater than 0 to approve this order.', 422);
            }

            $additionalCosts = (float) $purchase['additional_costs'];
            $totalAmount = round($subtotal + $additionalCosts, 2);
            $paymentMethod = trim((string) ($data['payment_method'] ?? $purchase['payment_method'] ?? 'Cash'));

            $rawPaid = $data['amount_paid'] ?? null;
            $amountPaid = ($rawPaid === null || $rawPaid === '')
                ? $totalAmount
                : max(0.0, min($totalAmount, (float) $rawPaid));
            $outstandingBalance = round($totalAmount - $amountPaid, 2);
            $paymentStatus = $amountPaid <= 0 ? 'unpaid' : ($outstandingBalance <= 0.01 ? 'paid' : 'partial');

            $combinedNotes = $purchase['notes'];
            if ($approvalNotes) {
                $combinedNotes = trim(($combinedNotes ? $combinedNotes . ' | ' : '') . "Approval: {$approvalNotes}");
            }

            $now = date('Y-m-d H:i:s');
            $pdo->prepare("
                UPDATE `purchases`
                SET `status` = 'received',
                    `subtotal_amount` = ?,
                    `total_amount` = ?,
                    `amount_paid` = ?,
                    `outstanding_balance` = ?,
                    `payment_status` = ?,
                    `payment_method` = ?,
                    `notes` = ?,
                    `approved_by` = ?,
                    `approved_at` = ?,
                    `received_at` = ?
                WHERE `id` = ?
            ")->execute([
                $subtotal, $totalAmount, $amountPaid, $outstandingBalance,
                $paymentStatus, $paymentMethod, $combinedNotes,
                $user['id'], $now, $now, $purchaseId,
            ]);

            if ($amountPaid > 0) {
                $spRef = self::nextSupplierPaymentRef($pdo);
                $sessionId = strtolower($paymentMethod) === 'cash' ? FinancialService::getOpenCashSessionId($pdo) : null;

                $pdo->prepare("
                    INSERT INTO `supplier_payments` (
                        `uuid`, `reference_number`, `supplier_id`, `purchase_id`,
                        `amount`, `payment_date`, `payment_method`, `cash_session_id`, `notes`, `recorded_by`
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ")->execute([
                    self::uuid('sp'), $spRef, (int) $purchase['supplier_id'], $purchaseId,
                    $amountPaid, date('Y-m-d'), $paymentMethod, $sessionId,
                    "Payment upon approval of order {$refNo}", $user['id'],
                ]);

                if ($sessionId && strtolower($paymentMethod) === 'cash') {
                    $pdo->prepare("
                        INSERT INTO `cash_movements` (
                            `uuid`, `cash_session_id`, `direction`, `category`, `amount`,
                            `reference_type`, `reference_id`, `description`, `user_id`
                        ) VALUES (?, ?, 'outflow', 'supplier_payment', ?, 'Purchase', ?, ?, ?)
                    ")->execute([
                        self::uuid('cm'), $sessionId, $amountPaid, $purchaseId,
                        "Cash payment for approved order {$refNo}", $user['id'],
                    ]);
                    FinancialService::recalculateCashSession($pdo, $sessionId);
                }
            }

            AuditService::log(
                $pdo,
                (int) $user['id'],
                'purchase.approved',
                'Purchase',
                $purchaseId,
                ['status' => $purchase['status']],
                [
                    'reference_number'     => $refNo,
                    'status'               => 'received',
                    'total_received_units' => $totalReceivedUnits,
                    'total_amount'         => $totalAmount,
                    'amount_paid'          => $amountPaid,
                ],
                $approvalNotes ?? "Approved pending order {$refNo} and updated stock across system"
            );

            $pdo->commit();
            self::json([
                'success'       => true,
                'message'       => "Order {$refNo} approved! Stock automatically updated across the entire system.",
                'purchase_id'   => $purchaseId,
                'stock_updates' => $stockUpdates,
            ]);
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            self::error('Failed to approve order: ' . $e->getMessage(), 500);
        }
    }

    public static function cancelPurchase(PDO $pdo, array $user, int $purchaseId): never
    {
        self::requirePermission($user, 'purchases.manage');
        $data = self::input();
        $reason = trim((string) ($data['reason'] ?? 'Cancelled pending supplier order'));

        $stmt = $pdo->prepare("SELECT * FROM `purchases` WHERE `id` = ?");
        $stmt->execute([$purchaseId]);
        $purchase = $stmt->fetch();
        if (!$purchase) {
            self::error('Purchase order not found.', 404);
        }
        if (!in_array($purchase['status'], ['pending', 'draft'], true)) {
            self::error('Only pending or draft orders can be cancelled.', 422);
        }

        $pdo->prepare("UPDATE `purchases` SET `status` = 'cancelled', `outstanding_balance` = 0.00 WHERE `id` = ?")
            ->execute([$purchaseId]);

        AuditService::log(
            $pdo,
            (int) $user['id'],
            'purchase.cancelled',
            'Purchase',
            $purchaseId,
            ['status' => $purchase['status']],
            ['status' => 'cancelled'],
            $reason
        );

        self::json([
            'success' => true,
            'message' => "Pending order {$purchase['reference_number']} has been cancelled.",
        ]);
    }

    // ========================================================================
    // INVENTORY & MANUAL STOCK ADJUSTMENTS (SRS 3.5)
    // ========================================================================
    public static function getInventoryOverview(PDO $pdo, array $user): never
    {
        self::requirePermission($user, ['inventory.view', 'products.view']);

        $productsStmt = $pdo->query("
            SELECT p.`id`, p.`sku`, p.`barcode`, p.`name`, p.`brand`, p.`model`, p.`unit`,
                   p.`purchase_price`, p.`selling_price`, p.`weighted_avg_cost`,
                   p.`min_stock_level`, p.`image_url`, p.`status`,
                   c.`name` AS category_name,
                   COALESCE(i.`available_quantity`, 0) AS available_quantity,
                   COALESCE(i.`reserved_offline_quantity`, 0) AS reserved_offline_quantity,
                   COALESCE(i.`damaged_quantity`, 0) AS damaged_quantity,
                   COALESCE(i.`under_inspection_quantity`, 0) AS under_inspection_quantity,
                   COALESCE(i.`unit_cost`, p.`purchase_price`) AS unit_cost,
                   (COALESCE(i.`available_quantity`, 0) * COALESCE(i.`unit_cost`, p.`purchase_price`)) AS stock_cost_valuation,
                   (COALESCE(i.`available_quantity`, 0) * p.`selling_price`) AS stock_retail_valuation,
                   CASE
                     WHEN COALESCE(i.`available_quantity`, 0) <= 0 THEN 'out_of_stock'
                     WHEN COALESCE(i.`available_quantity`, 0) <= p.`min_stock_level` THEN 'low_stock'
                     ELSE 'in_stock'
                   END AS stock_status,
                   COALESCE((
                       SELECT SUM(pi.`ordered_quantity`)
                       FROM `purchase_items` pi
                       INNER JOIN `purchases` pu ON pu.`id` = pi.`purchase_id`
                       WHERE pi.`product_id` = p.`id` AND pu.`status` = 'pending'
                   ), 0) AS pending_order_qty
            FROM `products` p
            INNER JOIN `categories` c ON c.`id` = p.`category_id`
            LEFT JOIN `inventories` i ON i.`product_id` = p.`id`
            WHERE p.`status` = 'active'
            ORDER BY i.`available_quantity` ASC, p.`name` ASC
        ");

        $movementsStmt = $pdo->query("
            SELECT sm.*, p.`name` AS product_name, p.`sku`, u.`full_name` AS user_name
            FROM `stock_movements` sm
            INNER JOIN `products` p ON p.`id` = sm.`product_id`
            LEFT JOIN `users` u ON u.`id` = sm.`user_id`
            ORDER BY sm.`id` DESC
            LIMIT 100
        ");

        $pendingOrdersCount = AuthService::hasPermission($user, 'purchases.manage')
            ? (int) $pdo->query("SELECT COUNT(*) FROM `purchases` WHERE `status` = 'pending'")->fetchColumn()
            : 0;

        self::json([
            'success'              => true,
            'inventory'            => $productsStmt->fetchAll(),
            'movements'            => $movementsStmt->fetchAll(),
            'pending_orders_count' => $pendingOrdersCount,
        ]);
    }

    public static function createStockAdjustment(PDO $pdo, array $user): never
    {
        self::requirePermission($user, 'inventory.adjust');
        $data = self::input();

        $productId = (int) ($data['product_id'] ?? 0);
        $adjustmentType = trim((string) ($data['adjustment_type'] ?? 'adjustment_decrease'));
        $quantity = round((float) ($data['quantity'] ?? 0), 2);
        $reason = trim((string) ($data['reason'] ?? ''));
        $notes = trim((string) ($data['notes'] ?? '')) ?: null;

        $allowedTypes = [
            'adjustment_increase', 'adjustment_decrease',
            'damaged', 'missing', 'lost', 'physical_count'
        ];
        if (!in_array($adjustmentType, $allowedTypes, true)) {
            self::error('Invalid stock adjustment type.', 422);
        }
        if ($productId <= 0 || $quantity <= 0 || $reason === '') {
            self::error('Product, positive quantity, and adjustment reason are mandatory.', 422);
        }

        $pdo->beginTransaction();
        try {
            $invStmt = $pdo->prepare("SELECT * FROM `inventories` WHERE `product_id` = ? FOR UPDATE");
            $invStmt->execute([$productId]);
            $inv = $invStmt->fetch();
            if (!$inv) {
                $pdo->rollBack();
                self::error('Product inventory record not found.', 404);
            }

            $prevQty = round((float) $inv['available_quantity'], 2);
            $damagedQty = round((float) $inv['damaged_quantity'], 2);

            if ($adjustmentType === 'adjustment_increase') {
                $changeQty = $quantity;
                $newQty = round($prevQty + $quantity, 2);
            } elseif ($adjustmentType === 'physical_count') {
                $newQty = $quantity;
                $changeQty = round($newQty - $prevQty, 2);
            } else {
                // decrease, damaged, missing, lost
                $changeQty = -$quantity;
                $newQty = round($prevQty - $quantity, 2);
                if ($adjustmentType === 'damaged') {
                    $damagedQty = round($damagedQty + $quantity, 2);
                }
            }

            // SRS 3.5: The system must prevent negative inventory
            if ($newQty < 0) {
                $pdo->rollBack();
                self::error("Cannot complete stock adjustment: resulting stock ({$newQty}) would be negative. Available stock is {$prevQty}.", 422);
            }

            $pdo->prepare("
                UPDATE `inventories`
                SET `available_quantity` = ?, `damaged_quantity` = ?, `last_counted_at` = NOW()
                WHERE `product_id` = ?
            ")->execute([$newQty, $damagedQty, $productId]);

            $pdo->prepare("
                INSERT INTO `stock_movements` (
                    `uuid`, `product_id`, `movement_type`, `previous_quantity`, `change_quantity`,
                    `new_quantity`, `unit_cost`, `reference_type`, `reference_id`, `reason`, `notes`, `user_id`, `approved_by`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'StockAdjustment', ?, ?, ?, ?, ?)
            ")->execute([
                self::uuid('sm'), $productId, $adjustmentType, $prevQty, $changeQty,
                $newQty, $inv['unit_cost'], $productId, $reason, $notes, $user['id'], $user['id']
            ]);
            $movementId = (int) $pdo->lastInsertId();

            AuditService::log(
                $pdo,
                (int) $user['id'],
                'inventory.adjusted',
                'Product',
                $productId,
                ['available_quantity' => $prevQty],
                ['available_quantity' => $newQty, 'change' => $changeQty, 'type' => $adjustmentType],
                $reason . ($notes ? " ({$notes})" : '')
            );

            $pdo->commit();
            self::json([
                'success'           => true,
                'message'           => "Stock adjustment recorded. Stock changed from {$prevQty} to {$newQty}.",
                'previous_quantity' => $prevQty,
                'new_quantity'      => $newQty,
                'movement_id'       => $movementId,
            ], 201);
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            self::error('Failed to record stock adjustment: ' . $e->getMessage(), 500);
        }
    }
}
