<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $sql = file_get_contents(__DIR__ . '/../schema.sql');
        DB::unprepared($sql);
    }

    public function down(): void
    {
        // Historical financial and inventory records are protected from accidental drop
    }
};
