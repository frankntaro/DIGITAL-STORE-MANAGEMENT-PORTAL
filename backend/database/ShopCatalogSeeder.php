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
            ['Mobile Phones', 'mobile-phones', 'Smartphone', 'Smartphones, used phones, and feature phones', 1],
            ['Phone Accessories', 'phone-accessories', 'ShieldCheck', 'Phone covers, tempered glass, casings, phone batteries, mouse & keyboard', 1],
            ['Chargers and Cables', 'chargers-and-cables', 'Zap', 'Fast chargers, adapters, USB-C & Lightning cables, and power cables', 1],
            ['Earphones and Headphones', 'earphones-and-headphones', 'Headphones', 'Wireless earbuds, pods, headphones, and wireless microphones', 1],
            ['Speakers & Radios', 'speakers', 'Volume2', 'Bluetooth speakers, subwoofers (bufa), and portable radios', 1],
            ['Tablets', 'tablets', 'Tablet', 'iPads, Android tablets, and educational slates', 1],
            ['Smartwatches', 'smartwatches', 'Watch', 'Fitness trackers and smartwatches', 1],
            ['Memory Cards and Flash Drives', 'memory-cards-and-flash-drives', 'HardDrive', 'Memory cards, USB flash drives, and pen drives', 1],
            ['TVs & Remotes', 'tvs-and-remotes', 'Tv', 'Smart & LED TVs, solar TVs, and remotes', 1],
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

        foreach ($categories as $c) {
            $findCat->execute([$c[1]]);
            if ((int) $findCat->fetchColumn() === 0) {
                $insCat->execute($c);
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
