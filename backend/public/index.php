<?php

declare(strict_types=1);

// CORS Headers for React Frontend (Vite dev server, PWA & single-origin production)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Device-Id');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$requestPath = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
$requestMethod = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https'
    || (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;
$scheme = $isHttps ? 'https' : 'http';
$host = (string) ($_SERVER['HTTP_HOST'] ?? '127.0.0.1:8000');
$siteOrigin = "{$scheme}://{$host}";

// Helper to serve static files with ETag, 304 Not Modified, and optimal Cache-Control
$serveStaticFile = static function (string $filePath, string $cacheControl): never {
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $mimeMap = [
        'html' => 'text/html; charset=utf-8',
        'js'   => 'application/javascript; charset=utf-8',
        'mjs'  => 'application/javascript; charset=utf-8',
        'css'  => 'text/css; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'xml'  => 'application/xml; charset=utf-8',
        'txt'  => 'text/plain; charset=utf-8',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
        'webp' => 'image/webp',
        'gif'  => 'image/gif',
        'svg'  => 'image/svg+xml',
        'bmp'  => 'image/bmp',
        'avif' => 'image/avif',
        'ico'  => 'image/x-icon',
        'woff2'=> 'font/woff2',
        'woff' => 'font/woff',
    ];
    $contentType = $mimeMap[$ext] ?? (function_exists('mime_content_type') ? (mime_content_type($filePath) ?: 'application/octet-stream') : 'application/octet-stream');
    $mtime = (int) filemtime($filePath);
    $size = (int) filesize($filePath);
    $etag = '"' . md5($filePath . '|' . $mtime . '|' . $size) . '"';

    header('Content-Type: ' . $contentType);
    header('ETag: ' . $etag);
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
    header('Cache-Control: ' . $cacheControl);

    if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
        http_response_code(304);
        exit;
    }

    header('Content-Length: ' . (string) $size);
    readfile($filePath);
    exit;
};

// 1. Uploaded product media under /uploads/*
if (str_starts_with($requestPath, '/uploads/')) {
    $uploadsRoot = realpath(__DIR__ . '/uploads');
    $relativePath = ltrim(substr($requestPath, strlen('/uploads/')), '/\\');
    $candidatePath = $uploadsRoot ? realpath($uploadsRoot . DIRECTORY_SEPARATOR . $relativePath) : false;

    if ($uploadsRoot && $candidatePath && str_starts_with($candidatePath, $uploadsRoot) && is_file($candidatePath)) {
        $serveStaticFile($candidatePath, 'public, max-age=31536000, immutable');
    }

    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Uploaded file not found.']);
    exit;
}

// 2. Dynamic SEO robots.txt & sitemap.xml (auto-adapts to Render, Koyeb, Railway, or custom .co.tz domain)
if ($requestMethod === 'GET' && $requestPath === '/robots.txt') {
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    echo "User-agent: *\n";
    echo "Allow: /\n";
    echo "Disallow: /api/\n\n";
    echo "Sitemap: {$siteOrigin}/sitemap.xml\n";
    exit;
}

if ($requestMethod === 'GET' && $requestPath === '/sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    $today = gmdate('Y-m-d');
    echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    echo "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";
    echo "  <url>\n";
    echo "    <loc>{$siteOrigin}/</loc>\n";
    echo "    <lastmod>{$today}</lastmod>\n";
    echo "    <changefreq>daily</changefreq>\n";
    echo "    <priority>1.0</priority>\n";
    echo "  </url>\n";
    echo "</urlset>\n";
    exit;
}

// 3. Backend REST API under /api/* (and /health shortcut)
if (str_starts_with($requestPath, '/api/') || $requestPath === '/api' || $requestPath === '/health') {
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
    exit;
}

// 4. Built React PWA Frontend (Single-origin production hosting on Render, Koyeb, Railway, cPanel, or Shop PC)
$distRoot = realpath(dirname(__DIR__, 2) . '/frontend/dist');
if ($distRoot && is_dir($distRoot) && ($requestMethod === 'GET' || $requestMethod === 'HEAD')) {
    $relFile = ltrim($requestPath, '/');
    if ($relFile !== '') {
        $candidate = realpath($distRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relFile));
        if ($candidate && str_starts_with($candidate, $distRoot) && is_file($candidate)) {
            $cacheHeader = str_starts_with($requestPath, '/assets/')
                ? 'public, max-age=31536000, immutable'
                : ($relFile === 'sw.js' || $relFile === 'index.html'
                    ? 'no-cache, max-age=0, must-revalidate'
                    : 'public, max-age=86400');
            $serveStaticFile($candidate, $cacheHeader);
        }
    }

    $indexFile = $distRoot . DIRECTORY_SEPARATOR . 'index.html';
    if (is_file($indexFile)) {
        $html = (string) file_get_contents($indexFile);

        // Inject live canonical URL, absolute OpenGraph/JSON-LD origin, and optional Google Search Console verification tag
        $safeOrigin = htmlspecialchars($siteOrigin, ENT_QUOTES, 'UTF-8');
        $html = str_replace('__SITE_ORIGIN__', $safeOrigin, $html);

        $gscToken = trim((string) (getenv('GOOGLE_SITE_VERIFICATION') ?: ($_ENV['GOOGLE_SITE_VERIFICATION'] ?? '')));
        if ($gscToken !== '') {
            $safeToken = htmlspecialchars($gscToken, ENT_QUOTES, 'UTF-8');
            $metaTag = "\n  <meta name=\"google-site-verification\" content=\"{$safeToken}\" />";
            $html = str_replace('</head>', $metaTag . "\n</head>", $html);
        }

        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-cache, max-age=0, must-revalidate');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        echo $html;
        exit;
    }
}

// Fallback to API router if frontend/dist is not present (e.g. local Vite dev mode)
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
