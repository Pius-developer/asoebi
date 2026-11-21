<?php
declare(strict_types=1);

function config(string $key): mixed { return $GLOBALS['config'][$key] ?? null; }

function users(): Users { static $u; return $u ??= new Users(Database::connection()); }
function events(): Events { static $e; return $e ??= new Events(Database::connection()); }
function orders(): Orders { static $o; return $o ??= new Orders(Database::connection(), events()); }

/** Today in Nigeria. ASOEBI_TODAY pins the date for demos and tests. */
function today(): string { return getenv('ASOEBI_TODAY') ?: date('Y-m-d'); }

// ---- JSON in, JSON out ------------------------------------------------------

/** The request body. React sends JSON; file uploads arrive as multipart form data. */
function body(): array
{
    static $b;
    if ($b !== null) return $b;
    $type = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_contains($type, 'application/json')) {
        $b = json_decode(file_get_contents('php://input') ?: '[]', true);
        return $b = is_array($b) ? $b : [];
    }
    return $b = $_POST;
}

function json(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/** A failed request. `field` tells React which input to highlight. */
function fail(string $message, int $status = 422, ?string $field = null): never
{
    json(['error' => $message] + ($field ? ['field' => $field] : []), $status);
}

// ---- Sessions, login and CSRF -----------------------------------------------

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_start([
        'cookie_httponly' => true,     // JavaScript can't read the cookie, so an XSS bug can't steal it
        'cookie_samesite' => 'Lax',
        'cookie_secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https',
        'cookie_lifetime' => 60 * 60 * 24 * 30,
        'gc_maxlifetime'  => 60 * 60 * 24 * 30,
    ]);
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

/** React sends the token back in an X-CSRF-Token header on every change. */
function verify_csrf(): void
{
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($sent) || !hash_equals(csrf_token(), $sent)) {
        fail('Your session expired. Refresh the page and try again.', 419);
    }
}

function current_user(): ?array
{
    static $u = false;
    if ($u === false) $u = !empty($_SESSION['user_id']) ? users()->find((int) $_SESSION['user_id']) : null;
    return $u;
}

function require_user(): array
{
    return current_user() ?? fail('Log in to continue.', 401);
}

/** The event, only if the logged-in user owns it. */
function owned_event(string $code): array
{
    $me = require_user();
    $e = events()->byCode($code);
    if (!$e || (int) $e['owner_id'] !== (int) $me['id']) fail('Event not found.', 404);
    return $e;
}

function rate_ok(string $key, int $max, int $seconds): bool
{
    $db = Database::connection();
    $key = hash('sha256', $key);
    $s = $db->prepare('SELECT COUNT(*) FROM hits WHERE key = ? AND created_at > ?');
    $s->execute([$key, time() - $seconds]);
    if ((int) $s->fetchColumn() >= $max) return false;
    $db->prepare('INSERT INTO hits (key, created_at) VALUES (?, ?)')->execute([$key, time()]);
    return true;
}

function client_ip(): string
{
    return $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
}

function base_url(): string
{
    if (config('app_url')) return rtrim(config('app_url'), '/');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
}

function send_image(string $file, string $type, bool $private = false): never
{
    if (!is_file($file)) fail('Not found.', 404);
    header('Content-Type: ' . $type);
    header('Cache-Control: ' . ($private ? 'private' : 'public') . ', max-age=86400');
    readfile($file);
    exit;
}
