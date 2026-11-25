<?php

namespace App\Database;

use PDO;

class ShopCatalogSeeder
{
    /**
     * Ensures all clean KAMPANGO PHONES AND ELECTRONICS categories exist
     * without seeding any demonstration products or transactions.
     */
    public static function syncCatalog(PDO $pdo): void
    {
        $categories = [
            ['Used Phones (Simu Used)', 'used-phones', 'Smartphone', 'Pre-owned and refurbished smartphones with RAM and storage specifications', 1],
            ['Full Box Phones (Boxed)', 'boxed-phones', 'Smartphone', 'Brand-new sealed full-box smartphones with RAM and storage specifications', 1],
            ['Feature Phones (Simu Ndogo)', 'feature-phones', 'Smartphone', 'Compact keypad feature phones (simu ndogo)', 1],
            ['Phone Accessories', 'phone-accessories', 'ShieldCheck', 'Phone covers, tempered glass, casings, phone batteries, mouse & keyboard', 1],
            ['Chargers and Cables', 'chargers-and-cables', 'Zap', 'Fast chargers, adapters, USB-C & Lightning cables, and power cables', 1],
            ['Extension Cables', 'extension-cables', 'Plug', 'Power extension cables, surge protectors, and multi-socket power strips', 1],
            ['Earphones and Headphones', 'earphones-and-headphones', 'Headphones', 'Wireless earbuds, pods, headphones, and wireless microphones', 1],
            ['Speakers & Radios', 'speakers', 'Volume2', 'Bluetooth speakers, subwoofers (bufa), and portable radios', 1],
            ['Tablets', 'tablets', 'Tablet', 'iPads, Android tablets, and educational slates', 1],
            ['Smartwatches', 'smartwatches', 'Watch', 'Fitness trackers and smartwatches', 1],
            ['Memory Cards and Flash Drives', 'memory-cards-and-flash-drives', 'HardDrive', 'Memory cards, USB flash drives, and pen drives with storage capacity and box packaging', 1],
            ['TV', 'tv', 'Tv', 'Smart TVs, LED TVs, Solar TVs, and Digital Televisions with screen size (inches)', 1],
            ['TV Remotes', 'tv-remotes', 'Tv', 'Television remotes, decoders, and TV mounting accessories', 1],
            ['Fridges & Freezers', 'fridges-and-freezers', 'Snowflake', 'Fridges, freezers, and fridge guards', 1],
            ['Solar, Batteries & Power', 'solar-and-power', 'Sun', 'Solar batteries, solar controllers, inverters, and voltage regulators', 1],
            ['Home Appliances & Kitchen', 'home-appliances', 'Flame', 'Rice cookers, water dispensers, fryers, gas cookers, fans, irons, kettles, and flasks', 1],
            ['Lighting & Torches', 'lighting-and-torches', 'Lightbulb', 'Rechargeable torches, headlamps, LED bulbs, and lamps', 1],
            ['Grooming & Household', 'grooming-and-household', 'Scissors', 'Hair clippers, hair dryers, barber tools, brooms, and carpets', 1],
            ['Other Electronics', 'other-electronics', 'Cpu', 'Power banks, routers, and general electronic accessories', 1],
        ];

        $findCat = $pdo->prepare("SELECT `id` FROM `categories` WHERE `slug` = ? LIMIT 1");
        $insCat = $pdo->prepare("
            INSERT INTO `categories` (`name`, `slug`, `icon`, `description`, `is_default`, `status`)
            VALUES (?, ?, ?, ?, ?, 'active')
        ");

        $catIdsBySlug = [];
        foreach ($categories as $c) {
            $findCat->execute([$c[1]]);
            $existingId = (int) $findCat->fetchColumn();
            if ($existingId === 0) {
                $insCat->execute($c);
                $existingId = (int) $pdo->lastInsertId();
            }
            $catIdsBySlug[$c[1]] = $existingId;
        }

        // Safely migrate any products from legacy combined 'mobile-phones' category into the 3 phone categories and remove it
        $findCat->execute(['mobile-phones']);
        $legacyMobileCatId = (int) $findCat->fetchColumn();
        if ($legacyMobileCatId > 0) {
            $legacyProds = $pdo->prepare("SELECT `id`, `name` FROM `products` WHERE `category_id` = ?");
            $legacyProds->execute([$legacyMobileCatId]);
            $updateProdCat = $pdo->prepare("UPDATE `products` SET `category_id` = ? WHERE `id` = ?");

            foreach ($legacyProds->fetchAll() as $lp) {
                $lname = strtolower((string) ($lp['name'] ?? ''));
                if (str_contains($lname, 'used') || str_contains($lname, 'refurb')) {
                    $targetCatId = $catIdsBySlug['used-phones'] ?? $legacyMobileCatId;
                } elseif (
                    str_contains($lname, 'ndogo')
                    || str_contains($lname, 'kitochi')
                    || str_contains($lname, 'feature')
                    || str_contains($lname, 'keypad')
                    || str_contains($lname, 'itel 21')
                    || str_contains($lname, 'philips 101')
                    || str_contains($lname, 'vitron')
                ) {
                    $targetCatId = $catIdsBySlug['feature-phones'] ?? $legacyMobileCatId;
                } else {
                    $targetCatId = $catIdsBySlug['boxed-phones'] ?? $legacyMobileCatId;
                }
                if ($targetCatId !== $legacyMobileCatId) {
                    $updateProdCat->execute([$targetCatId, (int) $lp['id']]);
                }
            }

            $remaining = (int) $pdo->query("SELECT COUNT(*) FROM `products` WHERE `category_id` = {$legacyMobileCatId}")->fetchColumn();
            if ($remaining === 0) {
                $pdo->exec("DELETE FROM `categories` WHERE `id` = {$legacyMobileCatId}");
            }
        }

        // Safely migrate any products from legacy combined 'tvs-and-remotes' into dedicated 'tv' and 'tv-remotes' categories
        $findCat->execute(['tvs-and-remotes']);
        $legacyTvCatId = (int) $findCat->fetchColumn();
        if ($legacyTvCatId > 0) {
            $legacyTvProds = $pdo->prepare("SELECT `id`, `name` FROM `products` WHERE `category_id` = ?");
            $legacyTvProds->execute([$legacyTvCatId]);
            $updateTvProdCat = $pdo->prepare("UPDATE `products` SET `category_id` = ? WHERE `id` = ?");

            foreach ($legacyTvProds->fetchAll() as $tp) {
                $tname = strtolower((string) ($tp['name'] ?? ''));
                if (str_contains($tname, 'remote') || str_contains($tname, 'rimoti') || str_contains($tname, 'bracket')) {
                    $targetTvCatId = $catIdsBySlug['tv-remotes'] ?? $legacyTvCatId;
                } else {
                    $targetTvCatId = $catIdsBySlug['tv'] ?? $legacyTvCatId;
                }
                if ($targetTvCatId !== $legacyTvCatId) {
                    $updateTvProdCat->execute([$targetTvCatId, (int) $tp['id']]);
                }
            }

            $remainingTv = (int) $pdo->query("SELECT COUNT(*) FROM `products` WHERE `category_id` = {$legacyTvCatId}")->fetchColumn();
            if ($remainingTv === 0) {
                $pdo->exec("DELETE FROM `categories` WHERE `id` = {$legacyTvCatId}");
            }
        }

        // Remove legacy empty Computer / Laptop category if present and unused
        $compCats = $pdo->query("
            SELECT `id` FROM `categories`
            WHERE `slug` = 'laptops-and-computers'
               OR LOWER(`name`) LIKE '%computer%'
               OR LOWER(`name`) LIKE '%laptop%'
        ")->fetchAll(PDO::FETCH_COLUMN);

        foreach ($compCats as $cid) {
            $cid = (int) $cid;
            $prodCount = (int) $pdo->query("SELECT COUNT(*) FROM `products` WHERE `category_id` = {$cid}")->fetchColumn();
            if ($prodCount === 0) {
                $pdo->exec("DELETE FROM `categories` WHERE `id` = {$cid}");
            }
        }
    }
}
