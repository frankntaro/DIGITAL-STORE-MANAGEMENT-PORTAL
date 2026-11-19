<?php

declare(strict_types=1);

// CORS Headers for React Frontend (Vite dev server & PWA)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Device-Id');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Serve uploaded static media files cleanly under /uploads/* (supports php artisan serve & direct web access)
$requestPath = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
if (str_starts_with($requestPath, '/uploads/')) {
    $uploadsRoot = realpath(__DIR__ . '/uploads');
    $relativePath = ltrim(substr($requestPath, strlen('/uploads/')), '/\\');
    $candidatePath = $uploadsRoot ? realpath($uploadsRoot . DIRECTORY_SEPARATOR . $relativePath) : false;

    if ($uploadsRoot && $candidatePath && str_starts_with($candidatePath, $uploadsRoot) && is_file($candidatePath)) {
        $ext = strtolower(pathinfo($candidatePath, PATHINFO_EXTENSION));
        $mimeMap = [
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png'  => 'image/png',
            'webp' => 'image/webp',
            'gif'  => 'image/gif',
            'svg'  => 'image/svg+xml',
            'bmp'  => 'image/bmp',
            'avif' => 'image/avif',
            'ico'  => 'image/x-icon',
        ];
        $contentType = $mimeMap[$ext] ?? (function_exists('mime_content_type') ? (mime_content_type($candidatePath) ?: 'application/octet-stream') : 'application/octet-stream');
        $mtime = (int) filemtime($candidatePath);
        $size = (int) filesize($candidatePath);
        $etag = '"' . md5($candidatePath . '|' . $mtime . '|' . $size) . '"';

        header('Content-Type: ' . $contentType);
        header('ETag: ' . $etag);
        header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
        header('Cache-Control: public, max-age=31536000, immutable');

        if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
            http_response_code(304);
            exit;
        }

        header('Content-Length: ' . (string) $size);
        readfile($candidatePath);
        exit;
    }

    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Uploaded file not found.']);
    exit;
}

require_once dirname(__DIR__) . '/bootstrap/autoload.php';

try {
    require dirname(__DIR__) . '/routes/api.php';
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'Server Error: ' . $e->getMessage(),
    ]);
}
