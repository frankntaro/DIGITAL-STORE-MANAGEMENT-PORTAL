-- ============================================================================
-- ELECTRONICS SHOP MANAGEMENT SYSTEM (ESMS)
-- Complete Relational Database Schema (MySQL / MariaDB)
-- Currency: Tanzanian Shillings (TZS) — DECIMAL(15, 2)
-- Costing Method: Weighted Average Cost
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. ROLES
CREATE TABLE IF NOT EXISTS `roles` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `description` VARCHAR(255) NULL,
  `is_system` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. PERMISSIONS
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(120) NOT NULL,
  `slug` VARCHAR(120) NOT NULL UNIQUE,
  `module` VARCHAR(80) NOT NULL,
  `description` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. ROLE PERMISSIONS
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `role_id` BIGINT UNSIGNED NOT NULL,
  `permission_id` BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY `uq_role_permission` (`role_id`, `permission_id`),
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. USERS (Employees & Shop Owner)
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `employee_code` VARCHAR(30) NOT NULL UNIQUE,
  `full_name` VARCHAR(150) NOT NULL,
  `username` VARCHAR(80) NOT NULL UNIQUE,
  `email` VARCHAR(150) NULL UNIQUE,
  `phone` VARCHAR(40) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `max_discount_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `can_approve_credit` TINYINT(1) NOT NULL DEFAULT 0,
  `last_login_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. USER ROLES (Many-to-Many: an employee may have multiple roles)
CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `role_id` BIGINT UNSIGNED NOT NULL,
  `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_user_role` (`user_id`, `role_id`),
  CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. USER PERMISSIONS (Individual permission overrides)
CREATE TABLE IF NOT EXISTS `user_permissions` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `permission_id` BIGINT UNSIGNED NOT NULL,
  `granted` TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY `uq_user_perm` (`user_id`, `permission_id`),
  CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_up_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. PERSONAL ACCESS TOKENS (API Auth / Sanctum compatible)
CREATE TABLE IF NOT EXISTS `personal_access_tokens` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL UNIQUE,
  `device_id` VARCHAR(100) NULL,
  `last_used_at` TIMESTAMP NULL,
  `expires_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_pat_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. SHOP SETTINGS
CREATE TABLE IF NOT EXISTS `shop_settings` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `shop_name` VARCHAR(150) NOT NULL DEFAULT 'KAMPANGO PHONES AND ELECTRONICS',
  `shop_logo` MEDIUMTEXT NULL,
  `shop_address` VARCHAR(255) NOT NULL DEFAULT 'Kariakoo, Msimbazi Street, Dar es Salaam',
  `contact_phone` VARCHAR(50) NOT NULL DEFAULT '+255 712 345 678',
  `contact_email` VARCHAR(150) NOT NULL DEFAULT 'info@electrohub.co.tz',
  `tin_number` VARCHAR(60) NULL DEFAULT '123-456-789',
  `currency` VARCHAR(10) NOT NULL DEFAULT 'TZS',
  `receipt_header` VARCHAR(255) NULL DEFAULT 'Genuine Phones, Electronics & Accessories',
  `receipt_footer` VARCHAR(255) NULL DEFAULT 'Thank you for shopping with us! Goods once sold are subject to warranty terms.',
  `default_credit_limit` DECIMAL(15,2) NOT NULL DEFAULT 2500000.00,
  `max_cashier_discount_percent` DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  `default_warranty_months` INT NOT NULL DEFAULT 12,
  `default_low_stock_threshold` INT NOT NULL DEFAULT 5,
  `allow_credit_sales` TINYINT(1) NOT NULL DEFAULT 1,
  `require_credit_approval` TINYINT(1) NOT NULL DEFAULT 0,
  `auto_sync_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `last_backup_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. CATEGORIES
CREATE TABLE IF NOT EXISTS `categories` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(120) NOT NULL UNIQUE,
  `slug` VARCHAR(120) NOT NULL UNIQUE,
  `icon` VARCHAR(60) NOT NULL DEFAULT 'Smartphone',
  `description` VARCHAR(255) NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. PRODUCTS
CREATE TABLE IF NOT EXISTS `products` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `sku` VARCHAR(80) NOT NULL UNIQUE,
  `barcode` VARCHAR(100) NULL,
  `name` VARCHAR(180) NOT NULL,
  `category_id` BIGINT UNSIGNED NOT NULL,
  `brand` VARCHAR(100) NULL,
  `model` VARCHAR(100) NULL,
  `description` TEXT NULL,
  `purchase_price` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `selling_price` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `weighted_avg_cost` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `unit` VARCHAR(20) NOT NULL DEFAULT 'piece',
  `min_stock_level` DECIMAL(12,2) NOT NULL DEFAULT 5.00,
  `warranty_months` INT NOT NULL DEFAULT 12,
  `image_url` MEDIUMTEXT NULL,
  `status` ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_products_category` (`category_id`),
  INDEX `idx_products_barcode` (`barcode`),
  INDEX `idx_products_status` (`status`),
  CONSTRAINT `fk_prod_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. INVENTORIES (1-to-1 quantity-based stock state per product, supports pieces & decimal meters)
CREATE TABLE IF NOT EXISTS `inventories` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `product_id` BIGINT UNSIGNED NOT NULL UNIQUE,
  `available_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `reserved_offline_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `damaged_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `under_inspection_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `unit_cost` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `last_counted_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_inv_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. STOCK MOVEMENTS (Immutable stock ledger & manual adjustments)
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(64) NOT NULL UNIQUE,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `movement_type` ENUM(
    'purchase_receipt',
    'sale',
    'return_resalable',
    'adjustment_increase',
    'adjustment_decrease',
    'damaged',
    'missing',
    'lost',
    'physical_count',
    'initial_stock'
  ) NOT NULL,
  `previous_quantity` DECIMAL(12,2) NOT NULL,
  `change_quantity` DECIMAL(12,2) NOT NULL,
  `new_quantity` DECIMAL(12,2) NOT NULL,
  `unit_cost` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `reference_type` VARCHAR(60) NULL,
  `reference_id` BIGINT UNSIGNED NULL,
  `reason` VARCHAR(180) NOT NULL,
  `notes` TEXT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `approved_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sm_product` (`product_id`),
  INDEX `idx_sm_type` (`movement_type`),
  CONSTRAINT `fk_sm_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  CONSTRAINT `fk_sm_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. SUPPLIERS
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `supplier_code` VARCHAR(40) NOT NULL UNIQUE,
  `name` VARCHAR(160) NOT NULL,
  `contact_person` VARCHAR(150) NULL,
  `phone` VARCHAR(50) NOT NULL,
  `email` VARCHAR(150) NULL,
  `address` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `status` ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. PURCHASES
CREATE TABLE IF NOT EXISTS `purchases` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(64) NOT NULL UNIQUE,
  `reference_number` VARCHAR(50) NOT NULL UNIQUE,
  `supplier_id` BIGINT UNSIGNED NOT NULL,
  `purchase_date` DATE NOT NULL,
  `status` ENUM('pending', 'draft', 'partially_received', 'received', 'cancelled') NOT NULL DEFAULT 'pending',
  `subtotal_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `additional_costs` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `amount_paid` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `outstanding_balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `payment_status` ENUM('unpaid', 'partial', 'paid') NOT NULL DEFAULT 'unpaid',
  `payment_method` VARCHAR(40) NOT NULL DEFAULT 'Cash',
  `notes` TEXT NULL,
  `recorded_by` BIGINT UNSIGNED NOT NULL,
  `approved_by` BIGINT UNSIGNED NULL,
  `approved_at` TIMESTAMP NULL,
  `received_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_purchases_supplier` (`supplier_id`),
  CONSTRAINT `fk_pur_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`),
  CONSTRAINT `fk_pur_user` FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. PURCHASE ITEMS
CREATE TABLE IF NOT EXISTS `purchase_items` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `purchase_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `ordered_quantity` DECIMAL(12,2) NOT NULL,
  `received_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `unit_purchase_price` DECIMAL(15,2) NOT NULL,
  `line_total` DECIMAL(15,2) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_pi_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pi_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. CASH SESSIONS (Daily Cash Register Shifts)
CREATE TABLE IF NOT EXISTS `cash_sessions` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `session_code` VARCHAR(50) NOT NULL UNIQUE,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `opened_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `opening_balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `cash_inflows` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `cash_outflows` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `expected_closing_balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `actual_counted_balance` DECIMAL(15,2) NULL,
  `cash_difference` DECIMAL(15,2) NULL,
  `status` ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  `opening_notes` TEXT NULL,
  `closing_notes` TEXT NULL,
  `closed_at` TIMESTAMP NULL,
  `reviewed_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. CASH MOVEMENTS
CREATE TABLE IF NOT EXISTS `cash_movements` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(64) NOT NULL UNIQUE,
  `cash_session_id` BIGINT UNSIGNED NULL,
  `direction` ENUM('inflow', 'outflow') NOT NULL,
  `category` ENUM(
    'sale_payment',
    'debt_repayment',
    'other_receipt',
    'expense',
    'supplier_payment',
    'customer_refund',
    'cash_withdrawal'
  ) NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `reference_type` VARCHAR(60) NULL,
  `reference_id` BIGINT UNSIGNED NULL,
  `description` VARCHAR(255) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cm_session` FOREIGN KEY (`cash_session_id`) REFERENCES `cash_sessions`(`id`),
  CONSTRAINT `fk_cm_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. SUPPLIER PAYMENTS
CREATE TABLE IF NOT EXISTS `supplier_payments` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(64) NOT NULL UNIQUE,
  `reference_number` VARCHAR(50) NOT NULL UNIQUE,
  `supplier_id` BIGINT UNSIGNED NOT NULL,
  `purchase_id` BIGINT UNSIGNED NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method` VARCHAR(40) NOT NULL DEFAULT 'Cash',
  `cash_session_id` BIGINT UNSIGNED NULL,
  `notes` TEXT NULL,
  `recorded_by` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sp_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`),
  CONSTRAINT `fk_sp_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`),
  CONSTRAINT `fk_sp_user` FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. CUSTOMERS
CREATE TABLE IF NOT EXISTS `customers` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `customer_code` VARCHAR(40) NOT NULL UNIQUE,
  `full_name` VARCHAR(160) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `email` VARCHAR(150) NULL,
  `address` VARCHAR(255) NULL,
  `customer_type` ENUM('regular', 'vip', 'wholesale', 'corporate') NOT NULL DEFAULT 'regular',
  `credit_limit` DECIMAL(15,2) NOT NULL DEFAULT 2500000.00,
  `approved_credits` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT NULL,
  `account_status` ENUM('active', 'suspended', 'archived') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_customers_phone` (`phone`),
  INDEX `idx_customers_name` (`full_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. SALES
CREATE TABLE IF NOT EXISTS `sales` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(64) NOT NULL UNIQUE,
  `receipt_number` VARCHAR(50) NOT NULL UNIQUE,
  `customer_id` BIGINT UNSIGNED NULL,
  `cash_session_id` BIGINT UNSIGNED NULL,
  `sale_date` DATETIME NOT NULL,
  `subtotal_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount_type` ENUM('none', 'fixed', 'percentage') NOT NULL DEFAULT 'none',
  `discount_value` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `discount_reason` VARCHAR(255) NULL,
  `discount_approved_by` BIGINT UNSIGNED NULL,
  `total_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `cash_received` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `change_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `outstanding_balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `approved_credit_adjustment` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total_cogs` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `gross_profit` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `payment_scenario` ENUM('full_cash', 'partial_credit', 'zero_deposit_credit') NOT NULL DEFAULT 'full_cash',
  `payment_method` VARCHAR(40) NOT NULL DEFAULT 'Cash',
  `payment_status` ENUM('paid', 'partial', 'unpaid', 'cancelled') NOT NULL DEFAULT 'paid',
  `due_date` DATE NULL,
  `status` ENUM('completed', 'cancelled', 'returned') NOT NULL DEFAULT 'completed',
  `notes` TEXT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `device_id` VARCHAR(100) NULL,
  `synced_from_offline` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sales_customer` (`customer_id`),
  INDEX `idx_sales_date` (`sale_date`),
  INDEX `idx_sales_payment_status` (`payment_status`),
  CONSTRAINT `fk_sales_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
  CONSTRAINT `fk_sales_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. SALE ITEMS (Preserves historical prices, costs, and profit at time of sale)
CREATE TABLE IF NOT EXISTS `sale_items` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `sale_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `product_name_snapshot` VARCHAR(180) NOT NULL,
  `sku_snapshot` VARCHAR(80) NOT NULL,
  `unit_snapshot` VARCHAR(20) NOT NULL DEFAULT 'piece',
  `quantity` DECIMAL(12,2) NOT NULL,
  `returned_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `unit_selling_price` DECIMAL(15,2) NOT NULL,
  `historical_unit_cost` DECIMAL(15,2) NOT NULL,
  `line_discount_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(15,2) NOT NULL,
  `line_cogs` DECIMAL(15,2) NOT NULL,
  `line_profit` DECIMAL(15,2) NOT NULL,
  `warranty_months` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_si_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_si_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. CUSTOMER PAYMENTS (Debt Repayments linked to outstanding sale/account)
CREATE TABLE IF NOT EXISTS `customer_payments` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(64) NOT NULL UNIQUE,
  `receipt_number` VARCHAR(50) NOT NULL UNIQUE,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `sale_id` BIGINT UNSIGNED NOT NULL,
  `cash_session_id` BIGINT UNSIGNED NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `balance_before` DECIMAL(15,2) NOT NULL,
  `balance_after` DECIMAL(15,2) NOT NULL,
  `payment_method` VARCHAR(40) NOT NULL DEFAULT 'Cash',
  `payment_date` DATETIME NOT NULL,
  `notes` TEXT NULL,
  `recorded_by` BIGINT UNSIGNED NOT NULL,
  `device_id` VARCHAR(100) NULL,
  `synced_from_offline` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cp_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
  CONSTRAINT `fk_cp_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`),
  CONSTRAINT `fk_cp_user` FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. EXPENSES (Operating Expenses separated from inventory purchases)
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(64) NOT NULL UNIQUE,
  `reference_number` VARCHAR(50) NOT NULL UNIQUE,
  `title` VARCHAR(180) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `expense_date` DATE NOT NULL,
  `payment_method` VARCHAR(40) NOT NULL DEFAULT 'Cash',
  `cash_session_id` BIGINT UNSIGNED NULL,
  `description` TEXT NULL,
  `attachment_url` VARCHAR(500) NULL,
  `recorded_by` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('active', 'reversed') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_exp_user` FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24. RETURNS
CREATE TABLE IF NOT EXISTS `returns` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(64) NOT NULL UNIQUE,
  `return_number` VARCHAR(50) NOT NULL UNIQUE,
  `sale_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NULL,
  `return_date` DATE NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `resolution` ENUM('exchange', 'cash_refund', 'store_credit', 'no_refund_policy') NOT NULL DEFAULT 'exchange',
  `refund_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `cash_session_id` BIGINT UNSIGNED NULL,
  `status` ENUM('approved', 'pending_inspection', 'rejected') NOT NULL DEFAULT 'approved',
  `notes` TEXT NULL,
  `authorized_by` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ret_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`),
  CONSTRAINT `fk_ret_user` FOREIGN KEY (`authorized_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 25. RETURN ITEMS
CREATE TABLE IF NOT EXISTS `return_items` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `return_id` BIGINT UNSIGNED NOT NULL,
  `sale_item_id` BIGINT UNSIGNED NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL,
  `condition_status` ENUM('resalable', 'damaged', 'under_inspection') NOT NULL DEFAULT 'resalable',
  `restocked` TINYINT(1) NOT NULL DEFAULT 0,
  `unit_refund_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `line_refund_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ri_return` FOREIGN KEY (`return_id`) REFERENCES `returns`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ri_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 26. WARRANTIES
CREATE TABLE IF NOT EXISTS `warranties` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `warranty_number` VARCHAR(50) NOT NULL UNIQUE,
  `sale_id` BIGINT UNSIGNED NOT NULL,
  `sale_item_id` BIGINT UNSIGNED NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NULL,
  `serial_or_imei` VARCHAR(100) NULL,
  `sale_date` DATE NOT NULL,
  `duration_months` INT NOT NULL DEFAULT 12,
  `expiry_date` DATE NOT NULL,
  `status` ENUM('active', 'expired', 'claimed', 'void') NOT NULL DEFAULT 'active',
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_war_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`),
  CONSTRAINT `fk_war_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 27. WARRANTY CLAIMS
CREATE TABLE IF NOT EXISTS `warranty_claims` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `claim_number` VARCHAR(50) NOT NULL UNIQUE,
  `warranty_id` BIGINT UNSIGNED NOT NULL,
  `claim_date` DATE NOT NULL,
  `issue_description` TEXT NOT NULL,
  `resolution` ENUM('pending', 'repaired', 'replaced', 'rejected') NOT NULL DEFAULT 'pending',
  `resolution_notes` TEXT NULL,
  `handled_by` BIGINT UNSIGNED NOT NULL,
  `resolved_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wc_warranty` FOREIGN KEY (`warranty_id`) REFERENCES `warranties`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wc_user` FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 28. AUDIT LOGS
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NULL,
  `action` VARCHAR(120) NOT NULL,
  `entity_type` VARCHAR(80) NOT NULL,
  `entity_id` VARCHAR(80) NULL,
  `previous_values` LONGTEXT NULL,
  `new_values` LONGTEXT NULL,
  `reason` VARCHAR(255) NULL,
  `device_id` VARCHAR(100) NULL,
  `ip_address` VARCHAR(60) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_entity` (`entity_type`, `entity_id`),
  INDEX `idx_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 29. OFFLINE SYNCHRONIZATION RECORDS
CREATE TABLE IF NOT EXISTS `sync_records` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `transaction_uuid` VARCHAR(64) NOT NULL UNIQUE,
  `entity_type` VARCHAR(60) NOT NULL,
  `entity_id` BIGINT UNSIGNED NULL,
  `operation` VARCHAR(60) NOT NULL,
  `payload` LONGTEXT NOT NULL,
  `user_id` BIGINT UNSIGNED NULL,
  `device_id` VARCHAR(100) NULL,
  `client_timestamp` DATETIME NULL,
  `sync_status` ENUM('synced', 'conflict', 'failed', 'duplicate_ignored') NOT NULL DEFAULT 'synced',
  `conflict_notes` TEXT NULL,
  `synced_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
