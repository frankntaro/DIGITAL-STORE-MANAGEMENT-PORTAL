<?php

namespace Database\Seeders;

use App\Database\DatabaseInstaller;

class DatabaseSeeder
{
    public function run(): void
    {
        $pdo = DatabaseInstaller::connect();
        DatabaseInstaller::ensureInstalled($pdo);
    }
}
