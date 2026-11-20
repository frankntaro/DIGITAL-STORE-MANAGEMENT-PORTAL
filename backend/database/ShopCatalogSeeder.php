<?php

namespace App\Database;

use PDO;

class ShopCatalogSeeder
{
    /**
     * Synchronizes KAMPANGO PHONES AND ELECTRONICS shop branding, removes the Computer/Laptop
     * category & laptop products (keeping only Computer Mouse & Keyboard under Phone Accessories),
     * and seeds all real shop categories and sample products from PRODUCT NAMES.docx idempotently.
     */
    public static function syncCatalog(PDO $pdo): void
    {
        // Fast sentinel check so normal API requests have near-zero overhead once synced
        $hasComputerCat = (int) $pdo->query("
            SELECT COUNT(*) FROM `categories`
            WHERE `slug` = 'laptops-and-computers' OR LOWER(`name`) LIKE '%computer%' OR LOWER(`name`) LIKE '%laptop%'
        ")->fetchColumn();

        $hasDemoLaptop = (int) $pdo->query("
            SELECT COUNT(*) FROM `products`
            WHERE `sku` = 'LAP-HP-G10' OR LOWER(`name`) LIKE '%laptop%' OR LOWER(`name`) LIKE '%probook%'
        ")->fetchColumn();

        $hasSentinel = (int) $pdo->query("
            SELECT COUNT(*) FROM `products`
            WHERE `sku` IN ('KMP-ACC-MSE1', 'KMP-GRO-014')
        ")->fetchColumn();

        if ($hasComputerCat === 0 && $hasDemoLaptop === 0 && $hasSentinel === 2) {
            return;
        }

        $ownerId = (int) $pdo->query("SELECT `id` FROM `users` ORDER BY `id` ASC LIMIT 1")->fetchColumn();
        if ($ownerId <= 0) {
            return;
        }

        // 1. Ensure all real shop categories exist
        $categories = [
            ['Mobile Phones', 'mobile-phones', 'Smartphone', 'Smartphones, used phones, and feature phones (Itel, Samsung, Redmi, Philips, etc.)', 1],
            ['Phone Accessories', 'phone-accessories', 'ShieldCheck', 'Phone covers, tempered glass, casings, phone batteries, plus computer mouse & keyboard', 1],
            ['Chargers and Cables', 'chargers-and-cables', 'Zap', 'Fast chargers, adapters (40W–75W), USB-C & Lightning cables, power cables, and tapes', 1],
            ['Earphones and Headphones', 'earphones-and-headphones', 'Headphones', 'Wireless earbuds, pods (JBL, Oraimo, Awei, NT King), and wireless microphones', 1],
            ['Speakers & Radios', 'speakers', 'Volume2', 'Seapiano, Sundar, Skywood, Alitop speakers, subwoofers (bufa), and portable radios', 1],
            ['Memory Cards and Flash Drives', 'memory-cards-and-flash-drives', 'HardDrive', 'Memory cards (Nokia, SanDisk), USB flash drives, and pen drives', 1],
            ['TVs & Remotes', 'tvs-and-remotes', 'Tv', 'Hisense, Vitron, Alitop, Sundar, and Solar Max TVs plus Azam & Universal remotes', 1],
            ['Fridges & Freezers', 'fridges-and-freezers', 'Snowflake', 'Hisense, Tallman, Boss, ADH, and Solar Max fridges, freezers, and fridge guards', 1],
            ['Solar, Batteries & Power', 'solar-and-power', 'Sun', 'Chloride, Sony & Samsung solar batteries, solar controllers (6A–30A), inverters, and regulators', 1],
            ['Home Appliances & Kitchen', 'home-appliances', 'Flame', 'Rice cookers, water dispensers, deep fryers, gas cookers, fans, irons, kettles, and flasks', 1],
            ['Lighting & Torches', 'lighting-and-torches', 'Lightbulb', 'Rechargeable torches, headlamps, LED bulbs, coil bulbs, and Valight lamps', 1],
            ['Grooming & Household', 'grooming-and-household', 'Scissors', 'Hair clippers (VADER), hair dryers, barber brushes, brooms, and carpets', 1],
        ];

        $findCat = $pdo->prepare("SELECT `id` FROM `categories` WHERE `slug` = ? LIMIT 1");
        $insCat = $pdo->prepare("
            INSERT INTO `categories` (`name`, `slug`, `icon`, `description`, `is_default`, `status`)
            VALUES (?, ?, ?, ?, ?, 'active')
        ");
        $updCat = $pdo->prepare("
            UPDATE `categories` SET `name` = ?, `icon` = ?, `description` = ?, `status` = 'active'
            WHERE `id` = ?
        ");

        $catIds = [];
        foreach ($categories as $c) {
            $findCat->execute([$c[1]]);
            $cid = (int) $findCat->fetchColumn();
            if ($cid > 0) {
                $updCat->execute([$c[0], $c[2], $c[3], $cid]);
                $catIds[$c[1]] = $cid;
            } else {
                $insCat->execute($c);
                $catIds[$c[1]] = (int) $pdo->lastInsertId();
            }
        }

        // 2. Remove the Computer / Laptop category and any laptop/computer products (shop only sells mouse & keyboard)
        $compCats = $pdo->query("
            SELECT `id` FROM `categories`
            WHERE `slug` = 'laptops-and-computers' OR LOWER(`name`) LIKE '%computer%' OR LOWER(`name`) LIKE '%laptop%'
        ")->fetchAll(PDO::FETCH_COLUMN);

        $compProductIds = [];
        if (!empty($compCats)) {
            $inCats = implode(',', array_map('intval', $compCats));
            $compProductIds = $pdo->query("SELECT `id` FROM `products` WHERE `category_id` IN ({$inCats})")->fetchAll(PDO::FETCH_COLUMN);
        }
        $demoLapId = (int) $pdo->query("SELECT `id` FROM `products` WHERE `sku` = 'LAP-HP-G10' LIMIT 1")->fetchColumn();
        if ($demoLapId > 0 && !in_array($demoLapId, $compProductIds)) {
            $compProductIds[] = $demoLapId;
        }

        if (!empty($compProductIds)) {
            $inProds = implode(',', array_map('intval', $compProductIds));

            // Identify seeded demo sales/purchases exclusively tied to the deleted laptop
            $affectedSales = $pdo->query("SELECT DISTINCT `sale_id` FROM `sale_items` WHERE `product_id` IN ({$inProds})")->fetchAll(PDO::FETCH_COLUMN);
            $affectedPurchases = $pdo->query("SELECT DISTINCT `purchase_id` FROM `purchase_items` WHERE `product_id` IN ({$inProds})")->fetchAll(PDO::FETCH_COLUMN);

            $pdo->exec("DELETE FROM `warranty_claims` WHERE `warranty_id` IN (SELECT `id` FROM `warranties` WHERE `product_id` IN ({$inProds}))");
            $pdo->exec("DELETE FROM `warranties` WHERE `product_id` IN ({$inProds})");
            $pdo->exec("DELETE FROM `return_items` WHERE `product_id` IN ({$inProds})");
            $pdo->exec("DELETE FROM `sale_items` WHERE `product_id` IN ({$inProds})");
            $pdo->exec("DELETE FROM `purchase_items` WHERE `product_id` IN ({$inProds})");
            $pdo->exec("DELETE FROM `stock_movements` WHERE `product_id` IN ({$inProds})");
            $pdo->exec("DELETE FROM `inventories` WHERE `product_id` IN ({$inProds})");
            $pdo->exec("DELETE FROM `products` WHERE `id` IN ({$inProds})");

            // Clean up any now-empty seeded sales or purchases
            foreach ($affectedSales as $sid) {
                $sid = (int) $sid;
                $rem = (int) $pdo->query("SELECT COUNT(*) FROM `sale_items` WHERE `sale_id` = {$sid}")->fetchColumn();
                if ($rem === 0) {
                    $pdo->exec("DELETE FROM `warranties` WHERE `sale_id` = {$sid}");
                    $pdo->exec("DELETE FROM `cash_movements` WHERE `reference_type` = 'Sale' AND `reference_id` = {$sid}");
                    $pdo->exec("DELETE FROM `customer_payments` WHERE `sale_id` = {$sid}");
                    $pdo->exec("DELETE FROM `returns` WHERE `sale_id` = {$sid}");
                    $pdo->exec("DELETE FROM `sales` WHERE `id` = {$sid}");
                }
            }
            foreach ($affectedPurchases as $pid) {
                $pid = (int) $pid;
                $rem = (int) $pdo->query("SELECT COUNT(*) FROM `purchase_items` WHERE `purchase_id` = {$pid}")->fetchColumn();
                if ($rem === 0) {
                    $pdo->exec("DELETE FROM `cash_movements` WHERE `reference_type` = 'Purchase' AND `reference_id` = {$pid}");
                    $pdo->exec("DELETE FROM `supplier_payments` WHERE `purchase_id` = {$pid}");
                    $pdo->exec("DELETE FROM `purchases` WHERE `id` = {$pid}");
                }
            }
        }

        if (!empty($compCats)) {
            $inCats = implode(',', array_map('intval', $compCats));
            $pdo->exec("DELETE FROM `categories` WHERE `id` IN ({$inCats})");
        }

        // 3. Category default product images
        $catImages = [
            'mobile-phones'                => 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&q=80',
            'phone-accessories'            => 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=300&q=80',
            'chargers-and-cables'          => 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&q=80',
            'earphones-and-headphones'     => 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=300&q=80',
            'speakers'                     => 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300&q=80',
            'memory-cards-and-flash-drives'=> 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=300&q=80',
            'tvs-and-remotes'              => 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=300&q=80',
            'fridges-and-freezers'         => 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=300&q=80',
            'solar-and-power'              => 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=300&q=80',
            'home-appliances'              => 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=300&q=80',
            'lighting-and-torches'         => 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=300&q=80',
            'grooming-and-household'       => 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=300&q=80',
        ];

        // 4. All unique shop products from PRODUCT NAMES.docx + Computer Mouse & Keyboard
        // Format: [sku, name, cat_slug, brand, model, purchase_price, selling_price, initial_qty, min_stock, warranty_months]
        $products = [
            // ── Mobile Phones: Feature Phones (Simu Ndogo) ──────────────────
            ['KMP-PHN-001', 'Itel 5606', 'mobile-phones', 'Itel', '5606', 32000, 42000, 12, 5, 12],
            ['KMP-PHN-002', 'Itel 2160', 'mobile-phones', 'Itel', '2160', 22000, 30000, 20, 5, 12],
            ['KMP-PHN-003', 'Itel 2161', 'mobile-phones', 'Itel', '2161', 23000, 32000, 15, 5, 12],
            ['KMP-PHN-004', 'Itel 2162', 'mobile-phones', 'Itel', '2162', 24000, 33000, 15, 5, 12],
            ['KMP-PHN-005', 'Itel 2165', 'mobile-phones', 'Itel', '2165', 25000, 35000, 15, 5, 12],
            ['KMP-PHN-006', 'Itel T101', 'mobile-phones', 'Itel', 'T101', 20000, 28000, 14, 5, 12],
            ['KMP-PHN-007', 'Itel T102', 'mobile-phones', 'Itel', 'T102', 21000, 29000, 14, 5, 12],
            ['KMP-PHN-008', 'Itel T210', 'mobile-phones', 'Itel', 'T210', 24000, 32000, 12, 5, 12],
            ['KMP-PHN-009', 'Itel T255', 'mobile-phones', 'Itel', 'T255', 25000, 34000, 12, 5, 12],
            ['KMP-PHN-010', 'Itel T301', 'mobile-phones', 'Itel', 'T301', 26000, 35000, 12, 5, 12],
            ['KMP-PHN-011', 'Itel T302', 'mobile-phones', 'Itel', 'T302', 26000, 35000, 12, 5, 12],
            ['KMP-PHN-012', 'Itel T303', 'mobile-phones', 'Itel', 'T303', 27000, 36000, 12, 5, 12],
            ['KMP-PHN-013', 'Itel T354', 'mobile-phones', 'Itel', 'T354', 28000, 38000, 10, 5, 12],
            ['KMP-PHN-014', 'Itel T455', 'mobile-phones', 'Itel', 'T455', 30000, 40000, 10, 5, 12],
            ['KMP-PHN-015', 'Itel T528 (New)', 'mobile-phones', 'Itel', 'T528 New', 32000, 42000, 10, 5, 12],
            ['KMP-PHN-016', 'Itel T528 (Old)', 'mobile-phones', 'Itel', 'T528 Old', 26000, 35000, 8, 4, 6],
            ['KMP-PHN-017', 'Itel T588 (New)', 'mobile-phones', 'Itel', 'T588 New', 34000, 45000, 10, 5, 12],
            ['KMP-PHN-018', 'Itel T5302', 'mobile-phones', 'Itel', 'T5302', 30000, 40000, 10, 5, 12],
            ['KMP-PHN-019', 'Philips 101', 'mobile-phones', 'Philips', '101', 28000, 38000, 10, 4, 12],
            ['KMP-PHN-020', 'Philips 200', 'mobile-phones', 'Philips', '200', 30000, 40000, 10, 4, 12],
            ['KMP-PHN-021', 'Philips 201', 'mobile-phones', 'Philips', '201', 31000, 42000, 10, 4, 12],
            ['KMP-PHN-022', 'Philips 210', 'mobile-phones', 'Philips', '210', 33000, 45000, 10, 4, 12],
            ['KMP-PHN-023', 'Vitron 101 / 105', 'mobile-phones', 'Vitron', '101/105', 22000, 30000, 12, 5, 12],
            ['KMP-PHN-024', 'Okino 150', 'mobile-phones', 'Okino', '150', 22000, 30000, 10, 4, 6],
            ['KMP-PHN-025', 'Okino 280', 'mobile-phones', 'Okino', '280', 25000, 35000, 10, 4, 6],
            ['KMP-PHN-026', 'Okino 1126', 'mobile-phones', 'Okino', '1126', 24000, 33000, 10, 4, 6],
            ['KMP-PHN-027', 'Okino 20300', 'mobile-phones', 'Okino', '20300', 28000, 38000, 10, 4, 6],
            ['KMP-PHN-028', 'Okang Mixing Phone', 'mobile-phones', 'Okang', 'Mixing', 22000, 30000, 8, 4, 6],
            ['KMP-PHN-029', 'Yilion 211', 'mobile-phones', 'Yilion', '211', 21000, 29000, 10, 4, 6],
            ['KMP-PHN-030', 'Yilion 5066', 'mobile-phones', 'Yilion', '5066', 25000, 34000, 10, 4, 6],
            ['KMP-PHN-031', 'Nuoria 105', 'mobile-phones', 'Nuoria', '105', 20000, 28000, 10, 4, 6],
            ['KMP-PHN-032', 'Nuoria 150', 'mobile-phones', 'Nuoria', '150', 22000, 30000, 10, 4, 6],
            ['KMP-PHN-033', 'Bonet / Bonet Funika', 'mobile-phones', 'Bonet', 'Flip / Funika', 32000, 45000, 8, 4, 6],

            // ── Mobile Phones: Smartphones & Used Phones ────────────────────
            ['KMP-PHN-034', 'Samsung Galaxy A17', 'mobile-phones', 'Samsung', 'Galaxy A17', 420000, 520000, 8, 3, 12],
            ['KMP-PHN-035', 'Samsung Galaxy A16', 'mobile-phones', 'Samsung', 'Galaxy A16', 380000, 460000, 10, 4, 12],
            ['KMP-PHN-036', 'Samsung Galaxy A07 (128GB)', 'mobile-phones', 'Samsung', 'A07 128GB', 290000, 360000, 10, 4, 12],
            ['KMP-PHN-037', 'Samsung Galaxy A06 (64GB)', 'mobile-phones', 'Samsung', 'A06 64GB', 230000, 290000, 12, 4, 12],
            ['KMP-PHN-038', 'Samsung Galaxy A05', 'mobile-phones', 'Samsung', 'Galaxy A05', 210000, 265000, 10, 4, 12],
            ['KMP-PHN-039', 'Samsung X16', 'mobile-phones', 'Samsung', 'X16', 180000, 230000, 8, 3, 12],
            ['KMP-PHN-040', 'Redmi A7', 'mobile-phones', 'Xiaomi', 'Redmi A7', 210000, 270000, 12, 4, 12],
            ['KMP-PHN-041', 'Smart Plus 20 (64GB)', 'mobile-phones', 'Infinix', 'Smart Plus 20', 200000, 255000, 10, 4, 12],
            ['KMP-PHN-042', 'Smart 20 (64GB)', 'mobile-phones', 'Infinix', 'Smart 20', 195000, 250000, 10, 4, 12],
            ['KMP-PHN-043', 'Smart 90', 'mobile-phones', 'Infinix', 'Smart 90', 220000, 280000, 8, 4, 12],
            ['KMP-PHN-044', 'Hot 70', 'mobile-phones', 'Infinix', 'Hot 70', 270000, 340000, 8, 4, 12],
            ['KMP-PHN-045', 'POP 20', 'mobile-phones', 'Tecno', 'POP 20', 185000, 240000, 10, 4, 12],
            ['KMP-PHN-046', 'Philips Essence 12 (64GB)', 'mobile-phones', 'Philips', 'Essence 12', 175000, 225000, 8, 3, 12],
            ['KMP-PHN-047', 'Philips Essence 30', 'mobile-phones', 'Philips', 'Essence 30', 210000, 270000, 8, 3, 12],
            ['KMP-PHN-048', 'Mi House 17 Pro', 'mobile-phones', 'Mi House', '17 Pro', 190000, 250000, 8, 3, 12],
            ['KMP-PHN-049', 'M Horse Smartphone', 'mobile-phones', 'M Horse', 'Smartphone', 140000, 185000, 8, 3, 6],
            ['KMP-PHN-050', 'Vuitton V75', 'mobile-phones', 'Vuitton', 'V75', 150000, 195000, 6, 3, 6],
            ['KMP-PHN-051', 'X17 Smartphone', 'mobile-phones', 'X17', 'X17', 160000, 210000, 8, 3, 6],
            ['KMP-PHN-052', 'Samsung Note 20 Ultra', 'mobile-phones', 'Samsung', 'Note 20 Ultra', 780000, 950000, 5, 2, 6],
            ['KMP-PHN-053', 'Used Samsung S24 Ultra', 'mobile-phones', 'Samsung', 'S24 Ultra (Used)', 1750000, 2100000, 4, 2, 6],
            ['KMP-PHN-054', 'Used Samsung S20 Plus', 'mobile-phones', 'Samsung', 'S20 Plus (Used)', 480000, 600000, 5, 2, 6],
            ['KMP-PHN-055', 'Used Samsung S20 Plain', 'mobile-phones', 'Samsung', 'S20 (Used)', 420000, 530000, 5, 2, 6],
            ['KMP-PHN-056', 'Used Samsung S21 Plain', 'mobile-phones', 'Samsung', 'S21 (Used)', 500000, 620000, 5, 2, 6],
            ['KMP-PHN-057', 'Used Samsung S20 FE', 'mobile-phones', 'Samsung', 'S20 FE (Used)', 380000, 480000, 6, 2, 6],
            ['KMP-PHN-058', 'Used Samsung S10E', 'mobile-phones', 'Samsung', 'S10E (Used)', 280000, 360000, 6, 2, 6],
            ['KMP-PHN-059', 'Used Samsung A41', 'mobile-phones', 'Samsung', 'A41 (Used)', 220000, 290000, 6, 2, 6],
            ['KMP-PHN-060', 'Used Samsung A51', 'mobile-phones', 'Samsung', 'A51 (Used)', 270000, 350000, 6, 2, 6],
            ['KMP-PHN-061', 'Used Sony Smartphone', 'mobile-phones', 'Sony', 'Xperia (Used)', 220000, 295000, 6, 2, 6],
            ['KMP-PHN-062', 'Used Arrows Smartphone', 'mobile-phones', 'Arrows', 'Arrows (Used)', 160000, 220000, 6, 2, 6],
            ['KMP-PHN-063', 'Aquos Wish 3', 'mobile-phones', 'Sharp', 'Aquos Wish 3', 190000, 250000, 6, 2, 6],

            // ── Phone Accessories (incl. Computer Mouse & Keyboard) ─────────
            ['KMP-ACC-001', 'Cover za Kike (Female Cover)', 'phone-accessories', 'Kampango', 'Female Cover', 4000, 10000, 60, 15, 0],
            ['KMP-ACC-002', 'Cover za Lela', 'phone-accessories', 'Kampango', 'Lela Cover', 4500, 10000, 50, 15, 0],
            ['KMP-ACC-003', 'Phone Body / Casing', 'phone-accessories', 'Generic', 'Body / Casing', 8000, 15000, 35, 10, 0],
            ['KMP-ACC-004', 'Glass 2D Screen Protector', 'phone-accessories', 'Generic', '2D Glass', 1500, 5000, 100, 20, 0],
            ['KMP-ACC-005', 'Privacy Tempered Glass', 'phone-accessories', 'Generic', 'Privacy Glass', 4000, 10000, 60, 15, 0],
            ['KMP-ACC-006', 'Tempered Glass 9H', 'phone-accessories', 'Generic', '9H Glass', 2500, 7000, 80, 20, 0],
            ['KMP-ACC-007', 'Ceramic Screen Glass', 'phone-accessories', 'Generic', 'Ceramic Glass', 3500, 8000, 70, 15, 0],
            ['KMP-ACC-008', 'Box za Kioo', 'phone-accessories', 'Generic', 'Glass Box', 12000, 20000, 25, 8, 0],
            ['KMP-ACC-009', 'Easy Phone Battery', 'phone-accessories', 'Easy', 'Betri', 6000, 12000, 40, 10, 3],
            ['KMP-ACC-MSE1', 'USB Optical Computer Mouse', 'phone-accessories', 'Kampango', 'Optical USB Mouse', 8000, 15000, 25, 6, 6],
            ['KMP-ACC-MSE2', 'Wireless Computer Mouse', 'phone-accessories', 'Kampango', '2.4GHz Wireless Mouse', 14000, 25000, 20, 5, 6],
            ['KMP-ACC-KBD1', 'USB Wired Computer Keyboard', 'phone-accessories', 'Kampango', 'Standard USB Keyboard', 18000, 30000, 15, 5, 6],

            // ── Chargers and Cables ─────────────────────────────────────────
            ['KMP-CHG-001', 'Phone Charger (Standard)', 'chargers-and-cables', 'Generic', 'Standard Charger', 5000, 10000, 50, 15, 3],
            ['KMP-CHG-002', 'USB Cable (C to C)', 'chargers-and-cables', 'Generic', 'Type-C to C', 4000, 10000, 60, 15, 3],
            ['KMP-CHG-003', 'Ramo USB-C to Type-C Charger', 'chargers-and-cables', 'Ramo', 'USB-C Charger', 12000, 22000, 30, 10, 6],
            ['KMP-CHG-004', 'Ramo USB-C to C & Lightning (60W)', 'chargers-and-cables', 'Ramo', '60W Dual Cable', 15000, 25000, 25, 8, 6],
            ['KMP-CHG-005', 'Samsung 65W Adapter (C to C)', 'chargers-and-cables', 'Samsung', '65W PD Adapter', 35000, 55000, 20, 6, 6],
            ['KMP-CHG-006', 'Vichua 45W Adapter', 'chargers-and-cables', 'Vichua', '45W Adapter', 18000, 30000, 20, 6, 6],
            ['KMP-CHG-007', 'Charger 75W (Charge W75)', 'chargers-and-cables', 'FastCharge', '75W', 25000, 40000, 18, 6, 6],
            ['KMP-CHG-008', 'Charger 60W (Charge Watts 60)', 'chargers-and-cables', 'FastCharge', '60W', 20000, 32000, 20, 6, 6],
            ['KMP-CHG-009', 'Charger 40W (Charge W40)', 'chargers-and-cables', 'FastCharge', '40W', 15000, 25000, 22, 6, 6],
            ['KMP-CHG-010', 'Waya wa Umeme (Power Cable)', 'chargers-and-cables', 'Generic', 'Power Cable', 4000, 8000, 40, 10, 0],
            ['KMP-CHG-011', 'Tropic Tape', 'chargers-and-cables', 'Tropic', 'Insulation Tape', 1500, 3000, 50, 12, 0],

            // ── Earphones, Pods & Microphones ───────────────────────────────
            ['KMP-EAR-001', 'JBL Wireless Pods (JBL POD)', 'earphones-and-headphones', 'JBL', 'JBL POD', 22000, 35000, 25, 6, 6],
            ['KMP-EAR-002', 'NT King Wireless Pods (NT King POD)', 'earphones-and-headphones', 'NT King', 'POD', 14000, 25000, 25, 6, 3],
            ['KMP-EAR-003', 'F-Sun / F-Sunz Wireless Pods', 'earphones-and-headphones', 'F-Sunz', 'POD', 14000, 24000, 20, 6, 3],
            ['KMP-EAR-004', 'Awei Wireless Pods (White / Pink)', 'earphones-and-headphones', 'Awei', 'Awei Pod', 20000, 35000, 20, 6, 6],
            ['KMP-EAR-005', 'Oraimo Wireless Pods', 'earphones-and-headphones', 'Oraimo', 'FreePods', 32000, 48000, 20, 6, 12],
            ['KMP-EAR-006', 'True Wireless Earbuds (Pod)', 'earphones-and-headphones', 'TWS', 'True Wireless', 12000, 22000, 30, 8, 3],
            ['KMP-EAR-007', 'Wireless Microphone', 'earphones-and-headphones', 'Kampango', 'Wireless Mic', 25000, 42000, 15, 5, 6],

            // ── Speakers & Radios ───────────────────────────────────────────
            ['KMP-SPK-001', 'Speaker Seapiano 8500', 'speakers', 'Seapiano', '8500', 110000, 145000, 8, 3, 12],
            ['KMP-SPK-002', 'Speaker Seapiano 661', 'speakers', 'Seapiano', '661', 65000, 85000, 10, 3, 12],
            ['KMP-SPK-003', 'Speaker Seapiano 1002', 'speakers', 'Seapiano', '1002', 85000, 115000, 8, 3, 12],
            ['KMP-SPK-004', 'Speaker Seapiano 821', 'speakers', 'Seapiano', '821', 75000, 98000, 8, 3, 12],
            ['KMP-SPK-005', 'Speaker Seapiano 877', 'speakers', 'Seapiano', '877', 80000, 105000, 8, 3, 12],
            ['KMP-SPK-006', 'Speaker Seapiano 993', 'speakers', 'Seapiano', '993', 95000, 125000, 8, 3, 12],
            ['KMP-SPK-007', 'Speaker Seapiano 40000W', 'speakers', 'Seapiano', '40000W', 135000, 175000, 6, 2, 12],
            ['KMP-SPK-008', 'Speaker Seapiano 60000W', 'speakers', 'Seapiano', '60000W', 170000, 220000, 6, 2, 12],
            ['KMP-SPK-009', 'Seapiano / Seapland Subwoofer (Bufa)', 'speakers', 'Seapiano', 'Subwoofer', 120000, 160000, 8, 3, 12],
            ['KMP-SPK-010', 'Seapland SP993 Speaker', 'speakers', 'Seapland', 'SP993', 95000, 125000, 8, 3, 12],
            ['KMP-SPK-011', 'Seapland SP8800 Speaker', 'speakers', 'Seapland', 'SP8800', 125000, 165000, 6, 2, 12],
            ['KMP-SPK-012', 'Speaker Sundar SD-3010', 'speakers', 'Sundar', 'SD-3010', 65000, 88000, 10, 3, 12],
            ['KMP-SPK-013', 'Speaker Sundar SD-3012', 'speakers', 'Sundar', 'SD-3012', 75000, 98000, 10, 3, 12],
            ['KMP-SPK-014', 'Sundar Speaker 30000W', 'speakers', 'Sundar', '30000W', 110000, 145000, 6, 2, 12],
            ['KMP-SPK-015', 'Sundar SD-098 BT Speaker', 'speakers', 'Sundar', 'SD-098 BT', 28000, 42000, 12, 4, 6],
            ['KMP-SPK-016', 'Sundar SD-092 BT Speaker', 'speakers', 'Sundar', 'SD-092 BT', 25000, 38000, 12, 4, 6],
            ['KMP-SPK-017', 'Sundar SD-082 BT Speaker', 'speakers', 'Sundar', 'SD-082 BT', 22000, 35000, 12, 4, 6],
            ['KMP-SPK-018', 'Sundar SD-036 BT Speaker', 'speakers', 'Sundar', 'SD-036 BT', 18000, 28000, 14, 4, 6],
            ['KMP-SPK-019', 'Sundar SD-003 BT Speaker', 'speakers', 'Sundar', 'SD-003 BT', 16000, 25000, 14, 4, 6],
            ['KMP-SPK-020', 'Redio za Sundar', 'speakers', 'Sundar', 'Portable Radio', 18000, 28000, 15, 5, 6],
            ['KMP-SPK-021', 'Skywood B01 Speaker', 'speakers', 'Skywood', 'B01', 90000, 120000, 8, 3, 12],
            ['KMP-SPK-022', 'Skywood B10 Speaker', 'speakers', 'Skywood', 'B10', 105000, 138000, 8, 3, 12],
            ['KMP-SPK-023', 'Alitop SP2506 Speaker', 'speakers', 'Alitop', 'SP2506', 85000, 115000, 8, 3, 12],
            ['KMP-SPK-024', 'Alitop 2510 Speaker', 'speakers', 'Alitop', '2510', 95000, 125000, 8, 3, 12],
            ['KMP-SPK-025', 'Speaker 50', 'speakers', 'Generic', 'Model 50', 35000, 50000, 10, 4, 6],
            ['KMP-SPK-026', 'Mur / Mure Subwoofer (Bufa)', 'speakers', 'Mure', 'Bufa Subwoofer', 95000, 130000, 8, 3, 12],
            ['KMP-SPK-027', 'Max Best MB-TM-85 Speaker', 'speakers', 'Max Best', 'MB-TM-85', 45000, 62000, 10, 3, 6],
            ['KMP-SPK-028', 'Max Best MB-TM-42 Speaker', 'speakers', 'Max Best', 'MB-TM-42', 32000, 45000, 10, 3, 6],
            ['KMP-SPK-029', 'Speaker SV2 / SZ-L34', 'speakers', 'Generic', 'SV2 / SZ-L34', 28000, 40000, 10, 3, 6],
            ['KMP-SPK-030', 'Wireless Speaker H@F GU-192', 'speakers', 'H@F', 'GU-192', 24000, 36000, 12, 4, 6],
            ['KMP-SPK-031', 'Wireless Speaker H@F GU-196', 'speakers', 'H@F', 'GU-196', 26000, 38000, 12, 4, 6],
            ['KMP-SPK-032', 'BS-28 Bluetooth Speaker', 'speakers', 'Generic', 'BS-28', 22000, 34000, 12, 4, 6],
            ['KMP-SPK-033', 'XKT V36 Mini Speaker', 'speakers', 'XKT', 'V36 Mini', 18000, 28000, 12, 4, 6],
            ['KMP-SPK-034', 'DV-1103 Good Boy Speaker', 'speakers', 'Good Boy', 'DV-1103', 30000, 45000, 10, 3, 6],
            ['KMP-SPK-035', 'Radio LP V70', 'speakers', 'LP', 'V70', 18000, 28000, 12, 4, 6],
            ['KMP-SPK-036', 'Radio LP V80', 'speakers', 'LP', 'V80', 20000, 30000, 12, 4, 6],
            ['KMP-SPK-037', 'Radio LP V81', 'speakers', 'LP', 'V81', 21000, 32000, 12, 4, 6],
            ['KMP-SPK-038', 'Radio LP V82', 'speakers', 'LP', 'V82', 22000, 33000, 12, 4, 6],
            ['KMP-SPK-039', 'Radio LP V99', 'speakers', 'LP', 'V99', 24000, 36000, 12, 4, 6],
            ['KMP-SPK-040', 'Aborder 142 Speaker', 'speakers', 'Aborder', '142', 45000, 62000, 8, 3, 6],

            // ── Memory Cards and Flash Drives ───────────────────────────────
            ['KMP-MEM-001', 'Nokia Memory Card 2GB', 'memory-cards-and-flash-drives', 'Nokia', '2GB microSD', 4500, 8000, 40, 10, 6],
            ['KMP-MEM-002', 'Citel Pen Drive', 'memory-cards-and-flash-drives', 'Citel', 'USB Pen Drive', 8000, 15000, 30, 10, 6],
            ['KMP-MEM-003', 'USB Pen Drive (Standard)', 'memory-cards-and-flash-drives', 'Generic', 'Pen Drive', 7000, 12000, 35, 10, 6],
            ['KMP-MEM-004', 'USB Flash Drive 2GB', 'memory-cards-and-flash-drives', 'Generic', 'Flash 2GB', 5000, 10000, 35, 10, 6],

            // ── TVs & Remotes ───────────────────────────────────────────────
            ['KMP-TV-001', 'Hisense Smart TV 43-inch', 'tvs-and-remotes', 'Hisense', '43" Smart TV', 620000, 750000, 5, 2, 12],
            ['KMP-TV-002', 'Hisense LED TV 43-inch', 'tvs-and-remotes', 'Hisense', '43" LED TV', 540000, 660000, 5, 2, 12],
            ['KMP-TV-003', 'Vitron TV 43-inch', 'tvs-and-remotes', 'Vitron', '43" TV', 460000, 560000, 5, 2, 12],
            ['KMP-TV-004', 'Alitop LED TV 43-inch', 'tvs-and-remotes', 'Alitop', '43" LED', 430000, 530000, 5, 2, 12],
            ['KMP-TV-005', 'Alitop LED TV 32-inch', 'tvs-and-remotes', 'Alitop', '32" LED', 250000, 320000, 8, 3, 12],
            ['KMP-TV-006', 'Sundar TV 24-inch', 'tvs-and-remotes', 'Sundar', '24" TV', 175000, 230000, 8, 3, 12],
            ['KMP-TV-007', 'Solar Max TV 24-inch', 'tvs-and-remotes', 'Solar Max', '24" Solar TV', 180000, 235000, 8, 3, 12],
            ['KMP-TV-008', 'Solar Max TV 22-inch', 'tvs-and-remotes', 'Solar Max', '22" Solar TV', 160000, 210000, 8, 3, 12],
            ['KMP-TV-009', 'Solar Max TV 19-inch', 'tvs-and-remotes', 'Solar Max', '19" Solar TV', 135000, 180000, 8, 3, 12],
            ['KMP-TV-010', 'Solar Max TV 17-inch', 'tvs-and-remotes', 'Solar Max', '17" Solar TV', 120000, 160000, 8, 3, 12],
            ['KMP-TV-011', 'Remote Azam (Standard)', 'tvs-and-remotes', 'Azam', 'Standard Remote', 4000, 8000, 40, 10, 0],
            ['KMP-TV-012', 'Remote Azam Ndefu', 'tvs-and-remotes', 'Azam', 'Long Remote', 5000, 10000, 35, 10, 0],
            ['KMP-TV-013', 'Remote Azam Fupi', 'tvs-and-remotes', 'Azam', 'Short Remote', 4000, 8000, 35, 10, 0],
            ['KMP-TV-014', 'Universal LED Remote', 'tvs-and-remotes', 'Universal', 'LED Remote', 5000, 10000, 35, 10, 0],
            ['KMP-TV-015', 'Universal RM Remote', 'tvs-and-remotes', 'Universal', 'RM Remote', 4500, 9000, 35, 10, 0],

            // ── Fridges & Freezers ──────────────────────────────────────────
            ['KMP-FRG-001', 'Hisense Fridge RB205', 'fridges-and-freezers', 'Hisense', 'RB205', 560000, 680000, 4, 2, 12],
            ['KMP-FRG-002', 'Hisense Fridge RD16', 'fridges-and-freezers', 'Hisense', 'RD16', 440000, 540000, 4, 2, 12],
            ['KMP-FRG-003', 'Hisense Fridge RT27', 'fridges-and-freezers', 'Hisense', 'RT27', 650000, 790000, 4, 2, 12],
            ['KMP-FRG-004', 'Tallman Fridge TMRF 173 GD', 'fridges-and-freezers', 'Tallman', 'TMRF 173 GD', 480000, 590000, 4, 2, 12],
            ['KMP-FRG-005', 'Tallman Fridge TMRF 189 GD', 'fridges-and-freezers', 'Tallman', 'TMRF 189 GD', 520000, 640000, 4, 2, 12],
            ['KMP-FRG-006', 'ADH Fridge ARF 54 SS', 'fridges-and-freezers', 'ADH', 'ARF 54 SS', 310000, 390000, 5, 2, 12],
            ['KMP-FRG-007', 'Hisense Freezer 200L', 'fridges-and-freezers', 'Hisense', '200L Freezer', 600000, 730000, 4, 2, 12],
            ['KMP-FRG-008', 'Hisense Freezer 150L', 'fridges-and-freezers', 'Hisense', '150L Freezer', 490000, 600000, 4, 2, 12],
            ['KMP-FRG-009', 'Hisense Freezer 100L', 'fridges-and-freezers', 'Hisense', '100L Freezer', 410000, 500000, 4, 2, 12],
            ['KMP-FRG-010', 'Hisense Freezer 65L', 'fridges-and-freezers', 'Hisense', '65L Freezer', 350000, 430000, 4, 2, 12],
            ['KMP-FRG-011', 'Boss Freezer 200L', 'fridges-and-freezers', 'Boss', '200L Freezer', 550000, 670000, 4, 2, 12],
            ['KMP-FRG-012', 'Boss Freezer 150L', 'fridges-and-freezers', 'Boss', '150L Freezer', 460000, 560000, 4, 2, 12],
            ['KMP-FRG-013', 'Solar Max Freezer 200L', 'fridges-and-freezers', 'Solar Max', '200L Solar Freezer', 680000, 820000, 4, 2, 12],
            ['KMP-FRG-014', 'Solar Max Freezer 150L', 'fridges-and-freezers', 'Solar Max', '150L Solar Freezer', 560000, 690000, 4, 2, 12],
            ['KMP-FRG-015', 'Solar Max Freezer MF-100', 'fridges-and-freezers', 'Solar Max', 'MF-100', 450000, 550000, 4, 2, 12],
            ['KMP-FRG-016', 'Fridge Guard', 'fridges-and-freezers', 'Sollatek', 'Fridge Guard', 18000, 28000, 20, 6, 6],

            // ── Solar, Batteries & Power ────────────────────────────────────
            ['KMP-SOL-001', 'Chloride Power Last N70 Battery', 'solar-and-power', 'Chloride Exide', 'N70', 185000, 230000, 8, 3, 12],
            ['KMP-SOL-002', 'Chloride N50 Battery', 'solar-and-power', 'Chloride Exide', 'N50', 145000, 185000, 8, 3, 12],
            ['KMP-SOL-003', 'Chloride N40 Battery', 'solar-and-power', 'Chloride Exide', 'N40', 115000, 150000, 8, 3, 12],
            ['KMP-SOL-004', 'Sony Battery (LM)', 'solar-and-power', 'Sony', 'LM Battery', 38000, 55000, 12, 4, 6],
            ['KMP-SOL-005', 'Pene-Samsung Battery (LM)', 'solar-and-power', 'Samsung', 'Pene LM Battery', 35000, 50000, 12, 4, 6],
            ['KMP-SOL-006', 'Samsung Solar Battery W18', 'solar-and-power', 'Samsung', 'Solar W18', 48000, 65000, 10, 4, 12],
            ['KMP-SOL-007', 'Samsung Solar Battery W12', 'solar-and-power', 'Samsung', 'Solar W12', 36000, 50000, 12, 4, 12],
            ['KMP-SOL-008', 'Samsung Solar Battery W9', 'solar-and-power', 'Samsung', 'Solar W9', 28000, 40000, 12, 4, 12],
            ['KMP-SOL-009', 'Samsung Solar Battery W7', 'solar-and-power', 'Samsung', 'Solar W7', 24000, 35000, 12, 4, 12],
            ['KMP-SOL-010', 'Samsung Solar Battery W4', 'solar-and-power', 'Samsung', 'Solar W4', 18000, 26000, 12, 4, 6],
            ['KMP-SOL-011', 'Solar Controller 30A', 'solar-and-power', 'SolarMax', '30A', 24000, 35000, 15, 5, 6],
            ['KMP-SOL-012', 'Solar Controller 20A', 'solar-and-power', 'SolarMax', '20A', 18000, 28000, 15, 5, 6],
            ['KMP-SOL-013', 'Solar Controller 15A', 'solar-and-power', 'SolarMax', '15A', 15000, 24000, 15, 5, 6],
            ['KMP-SOL-014', 'Solar Controller 10A', 'solar-and-power', 'SolarMax', '10A', 12000, 20000, 15, 5, 6],
            ['KMP-SOL-015', 'Solar Controller 6A', 'solar-and-power', 'SolarMax', '6A', 9000, 15000, 15, 5, 6],
            ['KMP-SOL-016', 'Inverter Box', 'solar-and-power', 'SolarMax', 'Inverter Box', 65000, 90000, 8, 3, 12],
            ['KMP-SOL-017', 'Regulator (Kawaida)', 'solar-and-power', 'Generic', 'Standard Regulator', 14000, 22000, 15, 5, 6],
            ['KMP-SOL-018', 'Regulator (Ndogo)', 'solar-and-power', 'Generic', 'Small Regulator', 10000, 16000, 15, 5, 6],

            // ── Home Appliances & Kitchen ───────────────────────────────────
            ['KMP-APP-001', 'Allpower Rice Cooker', 'home-appliances', 'Allpower', 'Rice Cooker', 48000, 65000, 10, 3, 12],
            ['KMP-APP-002', 'Allpower Water Dispenser', 'home-appliances', 'Allpower', 'Water Dispenser', 165000, 215000, 5, 2, 12],
            ['KMP-APP-003', 'Water Dispenser (Standard)', 'home-appliances', 'Kampango', 'Water Dispenser', 150000, 195000, 5, 2, 12],
            ['KMP-APP-004', 'Deep Fryer 201', 'home-appliances', 'Kampango', 'DF-201', 75000, 98000, 6, 2, 12],
            ['KMP-APP-005', 'Deep Fryer 101', 'home-appliances', 'Kampango', 'DF-101', 58000, 78000, 6, 2, 12],
            ['KMP-APP-006', 'Jiko la Gesi / Umeme', 'home-appliances', 'Kampango', 'Gas / Electric Cooker', 140000, 185000, 6, 2, 12],
            ['KMP-APP-007', 'ADH Gas Jiko', 'home-appliances', 'ADH', 'Gas Cooker', 110000, 145000, 6, 2, 12],
            ['KMP-APP-008', 'Hita za Jagi (Quider Kettle)', 'home-appliances', 'Quider', 'Electric Kettle', 18000, 28000, 15, 5, 6],
            ['KMP-APP-009', 'Pasi ya Philips (Flat Iron)', 'home-appliances', 'Philips', 'Dry Iron', 28000, 42000, 12, 4, 12],
            ['KMP-APP-010', 'Philips Box Iron', 'home-appliances', 'Philips', 'Box Iron', 35000, 50000, 10, 4, 12],
            ['KMP-APP-011', 'Allpower Feni (Stand Fan)', 'home-appliances', 'Allpower', 'Stand Fan', 48000, 65000, 10, 3, 12],
            ['KMP-APP-012', 'Allpower Feni Size 18', 'home-appliances', 'Allpower', 'Size 18 Fan', 58000, 78000, 8, 3, 12],
            ['KMP-APP-013', 'Feni za Mezani (Table Fan)', 'home-appliances', 'Allpower', 'Table Fan', 32000, 45000, 10, 3, 12],
            ['KMP-APP-014', 'Feni ya Juu (Ceiling Fan)', 'home-appliances', 'Allpower', 'Ceiling Fan', 55000, 75000, 8, 3, 12],
            ['KMP-APP-015', 'Bulb Feni (Bulb Fan)', 'home-appliances', 'Generic', 'Bulb Fan', 18000, 28000, 15, 5, 6],
            ['KMP-APP-016', 'Vacuum Office Cup (Double Wall)', 'home-appliances', 'Generic', 'Double Wall Cup', 12000, 20000, 20, 6, 0],
            ['KMP-APP-017', 'Vacuum Flask (Stainless Steel)', 'home-appliances', 'Generic', 'Stainless Flask', 18000, 28000, 20, 6, 0],
            ['KMP-APP-018', 'Stainless Steel Chupa', 'home-appliances', 'Generic', 'Steel Bottle', 14000, 22000, 20, 6, 0],
            ['KMP-APP-019', 'Vacuum Cup (Water Bottle)', 'home-appliances', 'Generic', 'Vacuum Bottle', 13000, 22000, 20, 6, 0],
            ['KMP-APP-020', 'Vacuum Insulated Bottle', 'home-appliances', 'Generic', 'Insulated Bottle', 15000, 25000, 20, 6, 0],
            ['KMP-APP-021', 'Plastic Chupa za Maji', 'home-appliances', 'Generic', 'Water Bottle', 4000, 8000, 35, 10, 0],

            // ── Lighting & Torches ──────────────────────────────────────────
            ['KMP-LGT-001', 'Tochi / Jiko 201', 'lighting-and-torches', 'Kampango', '201', 12000, 20000, 15, 5, 3],
            ['KMP-LGT-002', 'Tochi za Kichwani (Headlamp)', 'lighting-and-torches', 'Generic', 'Headlamp', 8000, 15000, 25, 6, 3],
            ['KMP-LGT-003', 'Tochi za Kundan', 'lighting-and-torches', 'Kundan', 'Torch', 7000, 13000, 25, 6, 3],
            ['KMP-LGT-004', 'Valight W7 / W5', 'lighting-and-torches', 'Valight', 'W7 / W5', 10000, 18000, 20, 6, 6],
            ['KMP-LGT-005', 'LED Bulbs (Assorted Watts)', 'lighting-and-torches', 'Kampango', 'LED Multi-Watt', 2500, 5000, 80, 20, 3],
            ['KMP-LGT-006', 'Bulb za Coil', 'lighting-and-torches', 'Generic', 'Coil Bulb', 3000, 6000, 50, 15, 3],

            // ── Grooming & Household ────────────────────────────────────────
            ['KMP-GRO-001', 'Mashine za Kunyolea (VADER)', 'grooming-and-household', 'VADER', 'Hair Clipper', 24000, 38000, 15, 4, 6],
            ['KMP-GRO-002', 'Mashine za Kunyolea (Ndogo)', 'grooming-and-household', 'Generic', 'Mini Trimmer', 12000, 20000, 18, 5, 3],
            ['KMP-GRO-003', 'Hair Dryer', 'grooming-and-household', 'Kampango', 'Hair Dryer', 22000, 35000, 12, 4, 6],
            ['KMP-GRO-004', 'Stendi za Kunyolea', 'grooming-and-household', 'Generic', 'Clipper Stand', 6000, 12000, 15, 5, 0],
            ['KMP-GRO-005', 'Brum za Kunyolea', 'grooming-and-household', 'Generic', 'Barber Broom', 4000, 8000, 20, 5, 0],
            ['KMP-GRO-006', 'Brush za Kunyolea Chuo', 'grooming-and-household', 'Generic', 'Barber Brush', 3500, 7000, 25, 6, 0],
            ['KMP-GRO-007', 'Fagio za 15K', 'grooming-and-household', 'Generic', 'Broom 15K', 10000, 15000, 15, 5, 0],
            ['KMP-GRO-008', 'Fagio za 4K', 'grooming-and-household', 'Generic', 'Broom 4K', 2500, 4000, 25, 6, 0],
            ['KMP-GRO-009', 'Fagio za 2K', 'grooming-and-household', 'Generic', 'Broom 2K', 1200, 2000, 30, 8, 0],
            ['KMP-GRO-010', 'Kidokoa', 'grooming-and-household', 'Generic', 'Kidokoa', 3000, 6000, 20, 5, 0],
            ['KMP-GRO-011', 'Carpet 240', 'grooming-and-household', 'Kampango', 'Carpet 240', 45000, 65000, 8, 3, 0],
            ['KMP-GRO-012', 'Carpet Myasa', 'grooming-and-household', 'Kampango', 'Carpet Myasa', 38000, 55000, 8, 3, 0],
            ['KMP-GRO-013', 'Alloy Accessory', 'grooming-and-household', 'Alloy', 'Standard', 6000, 12000, 20, 5, 0],
            ['KMP-GRO-014', 'Quider Electronic Item', 'grooming-and-household', 'Quider', 'Standard', 15000, 25000, 15, 5, 6],
        ];

        // Preload existing SKUs and names in a single query (avoids 200+ serial round-trips on remote TiDB/MySQL)
        $existingSkus = [];
        $existingNames = [];
        foreach ($pdo->query("SELECT `sku`, `name` FROM `products`")->fetchAll() as $row) {
            $existingSkus[(string) $row['sku']] = true;
            $existingNames[strtolower((string) $row['name'])] = true;
        }

        $insProd = $pdo->prepare("
            INSERT INTO `products` (
                `sku`, `barcode`, `name`, `category_id`, `brand`, `model`, `description`,
                `purchase_price`, `selling_price`, `weighted_avg_cost`, `unit`, `min_stock_level`,
                `warranty_months`, `image_url`, `status`, `created_by`
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        ");
        $insInv = $pdo->prepare("
            INSERT IGNORE INTO `inventories` (`product_id`, `available_quantity`, `unit_cost`, `last_counted_at`)
            VALUES (?, ?, ?, NOW())
        ");

        $startedTx = false;
        if (!$pdo->inTransaction()) {
            $pdo->beginTransaction();
            $startedTx = true;
        }

        try {
            foreach ($products as $idx => $p) {
                [$sku, $name, $catSlug, $brand, $model, $cost, $sell, $qty, $minStock, $warranty] = $p;
                if (!isset($catIds[$catSlug])) {
                    continue;
                }
                $lowerName = strtolower($name);
                if (isset($existingSkus[$sku]) || isset($existingNames[$lowerName])) {
                    continue;
                }
                $barcode = sprintf('890200%06d', $idx + 1);
                $img = $catImages[$catSlug] ?? $catImages['mobile-phones'];
                $desc = "{$brand} {$name} — KAMPANGO PHONES AND ELECTRONICS";
                $unit = (str_contains($lowerName, 'carpet') || str_contains($lowerName, 'zulia')) ? 'meter' : 'piece';

                $insProd->execute([
                    $sku, $barcode, $name, $catIds[$catSlug], $brand, $model, $desc,
                    $cost, $sell, $cost, $unit, $minStock, $warranty, $img, $ownerId
                ]);
                $pid = (int) $pdo->lastInsertId();
                $insInv->execute([$pid, $qty, $cost]);

                $existingSkus[$sku] = true;
                $existingNames[$lowerName] = true;
            }

            if ($startedTx) {
                $pdo->commit();
            }
        } catch (\Throwable $e) {
            if ($startedTx && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}
