<?php
declare(strict_types=1);

/*
 | Every request that isn't a real file comes here (see public_html/.htaccess):
 |  - /api/...      → the JSON API that the React app calls with fetch()
 |  - anything else → the React app's index.html (with share tags for event links)
 */

// This file lives in public_html/api/ on the server and in web/public/api/ while developing.
$root = dirname(__DIR__, 2);
if (!is_file("$root/api/bootstrap.php")) $root = dirname(__DIR__, 3);
require "$root/api/bootstrap.php";

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/') ?: '/';
$web = dirname(__DIR__);   // public_html (or web/public in development)

// Local PHP server: let it serve real files directly.
if (PHP_SAPI === 'cli-server' && $path !== '/' && is_file($web . $path)) return false;

if (!str_starts_with($path, '/api/')) {
    serve_app($path, $web);
}

start_session();
if ($method === 'POST') verify_csrf();
$in = body();
$today = today();
$me = current_user();

/** Match "GET /api/events/{code}" style routes. Returns the captured parts or null. */
function route(string $want, string $pattern): ?array
{
    global $method, $path;
    if ($method !== $want) return null;
    $regex = '#^' . preg_replace(['#\{code\}#', '#\{id\}#', '#\{token\}#', '#\{file\}#', '#\{action\}#'],
                                 ['([a-z0-9]{8})', '(\d+)', '([a-f0-9]{24})', '([a-f0-9]{24}\.jpg)', '([a-z]+)'], $pattern) . '$#';
    return preg_match($regex, $path, $m) ? array_slice($m, 1) : null;
}

// ---- Account ----------------------------------------------------------------

if (route('GET', '/api/me') !== null) {
    json(['user' => Users::public($me), 'csrf' => csrf_token()]);
}

if (route('POST', '/api/signup') !== null) {
    if (!rate_ok('signup:' . client_ip(), 5, 3600)) fail('Too many sign-ups from your network. Try again in an hour.', 429);
    $r = users()->create((string) ($in['name'] ?? ''), (string) ($in['email'] ?? ''), (string) ($in['phone'] ?? ''), (string) ($in['password'] ?? ''));
    if (!$r['ok']) fail($r['error'], 422, $r['field']);
    session_regenerate_id(true);
    $_SESSION['user_id'] = $r['id'];
    json(['user' => Users::public(users()->find($r['id']))]);
}

if (route('POST', '/api/login') !== null) {
    if (!rate_ok('login:' . client_ip(), 10, 900)) fail('Too many attempts. Wait 15 minutes and try again.', 429);
    $u = users()->verify((string) ($in['email'] ?? ''), (string) ($in['password'] ?? ''));
    if (!$u) fail('That email and password don\'t match.', 422, 'password');
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $u['id'];
    json(['user' => Users::public($u)]);
}

if (route('POST', '/api/logout') !== null) {
    unset($_SESSION['user_id']);
    session_regenerate_id(true);
    json(['ok' => true]);
}

// ---- Celebrant: events ----------------------------------------------------

if (route('GET', '/api/events') !== null) {
    json(['events' => events()->owned((int) require_user()['id'])]);
}

if (route('POST', '/api/events') !== null) {
    $r = events()->create(require_user(), $in, $today);
    if (!$r['ok']) fail($r['error'], 422, $r['field']);
    json(['code' => $r['event']['code']], 201);
}

if ($m = route('GET', '/api/events/{code}')) {
    json(['event' => events()->manageView(owned_event($m[0]), $today)]);
}

if ($m = route('POST', '/api/events/{code}')) {
    $e = owned_event($m[0]);
    $r = events()->update($e, $in, $me['name'], $today);
    if (!$r['ok']) fail($r['error'], 422, $r['field']);
    json(['event' => events()->manageView(events()->find((int) $e['id']), $today)]);
}

if ($m = route('POST', '/api/events/{code}/status')) {
    $e = owned_event($m[0]);
    events()->setStatus($e, (string) ($in['status'] ?? ''), $me['name']);
    json(['event' => events()->manageView(events()->find((int) $e['id']), $today)]);
}

if ($m = route('POST', '/api/events/{code}/cover')) {
    $e = owned_event($m[0]);
    $p = Photo::store($_FILES['photo'] ?? ['error' => UPLOAD_ERR_NO_FILE], ROOT . '/data/images');
    if (!$p['ok'] || !$p['name']) fail($p['error'] ?? 'Choose a photo.', 422, 'photo');
    events()->setCover($e, $p['name']);
    json(['event' => events()->manageView(events()->find((int) $e['id']), $today)]);
}

if (($m = route('POST', '/api/events/{code}/fabrics')) || ($m = route('POST', '/api/events/{code}/fabrics/{id}'))) {
    $e = owned_event($m[0]);
    $p = Photo::store($_FILES['photo'] ?? ['error' => UPLOAD_ERR_NO_FILE], ROOT . '/data/images');
    if (!$p['ok']) fail($p['error'], 422, 'photo');
    $r = events()->saveFabric($e, $in, isset($m[1]) ? (int) $m[1] : null, $p['name'] ?? null, $me['name']);
    if (!$r['ok']) fail($r['error'], 422, $r['field'] ?? null);
    json(['event' => events()->manageView($e, $today)]);
}

if ($m = route('POST', '/api/events/{code}/fabrics/{id}/delete')) {
    $e = owned_event($m[0]);
    $r = events()->deleteFabric($e, (int) $m[1], $me['name']);
    if (!$r['ok']) fail($r['error']);
    json(['event' => events()->manageView($e, $today)]);
}

if ($m = route('POST', '/api/events/{code}/orders/{id}/{action}')) {
    $e = owned_event($m[0]);
    $o = orders()->find((int) $m[1]);
    if (!$o || (int) $o['event_id'] !== (int) $e['id']) fail('Order not found.', 404);
    $r = orders()->act($o, $m[2], $me['name']);
    if (!$r['ok']) fail($r['error']);
    json(['event' => events()->manageView($e, $today)]);
}

if ($m = route('GET', '/api/events/{code}/export.csv')) {
    $e = owned_event($m[0]);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="aso-ebi-' . $e['code'] . '.csv"');
    echo "\xEF\xBB\xBF" . orders()->csv($e);   // BOM so Excel shows ₦ and names correctly
    exit;
}

// ---- Guests ---------------------------------------------------------------

if ($m = route('GET', '/api/e/{code}')) {
    $e = events()->byCode($m[0]) ?? fail('This event doesn\'t exist.', 404);
    json(['event' => events()->publicView($e, $today)]);
}

if ($m = route('POST', '/api/e/{code}/orders')) {
    $e = events()->byCode($m[0]) ?? fail('This event doesn\'t exist.', 404);
    if (!rate_ok('order:' . client_ip(), 15, 3600)) fail('Too many orders from your network. Try again later.', 429);
    $r = orders()->place($e, $in, $today);
    if (!$r['ok']) fail($r['error'], 422, $r['field'] ?? null);
    json(['token' => $r['order']['token']], 201);
}

if ($m = route('GET', '/api/o/{token}')) {
    $o = orders()->byToken($m[0]) ?? fail('Order not found. Check the link.', 404);
    json(['order' => orders()->guestView($o)]);
}

if ($m = route('POST', '/api/o/{token}/paid')) {
    $o = orders()->byToken($m[0]) ?? fail('Order not found.', 404);
    $p = Photo::store($_FILES['receipt'] ?? ['error' => UPLOAD_ERR_NO_FILE], ROOT . '/data/receipts');
    if (!$p['ok']) fail($p['error'], 422, 'receipt');
    $r = orders()->claim($o, $p['name'] ?? null);
    if (!$r['ok']) fail($r['error']);
    json(['order' => orders()->guestView(orders()->find((int) $o['id']))]);
}

// ---- Images ---------------------------------------------------------------

if ($m = route('GET', '/api/img/{file}')) {
    send_image(ROOT . '/data/images/' . $m[0], 'image/jpeg');
}

if ($m = route('GET', '/api/receipt/{file}')) {
    // Receipts are private: only the celebrant of that event can see them.
    $s = Database::connection()->prepare('SELECT e.owner_id FROM orders o JOIN events e ON e.id = o.event_id WHERE o.receipt = ?');
    $s->execute([$m[0]]);
    $owner = $s->fetchColumn();
    if (!$me || (int) $owner !== (int) $me['id']) fail('Not found.', 404);
    send_image(ROOT . '/data/receipts/' . $m[0], 'image/jpeg', true);
}

if ($m = route('GET', '/api/e/{code}/card.png')) {
    $e = events()->byCode($m[0]) ?? fail('Not found.', 404);
    send_image(Card::path($e, events()->fabrics((int) $e['id'])), 'image/png');
}

fail('Not found.', 404);

/**
 * Send the React app. For event links, put the event's name and share card in the
 * page's <head>, because WhatsApp and X read those tags without running JavaScript.
 */
function serve_app(string $path, string $web): never
{
    $html = @file_get_contents($web . '/index.html');
    if ($html === false) {
        http_response_code(500);
        exit('Build the React app first: cd web && npm run build');
    }
    if (preg_match('#^/e/([a-z0-9]{8})$#', $path, $m) && ($e = events()->byCode($m[1]))) {
        $title = htmlspecialchars($e['title'] . ' · Aso-ebi', ENT_QUOTES);
        $desc = htmlspecialchars('Order your aso-ebi for ' . $e['title'] . ', ' . date('j F Y', strtotime($e['event_date'])) . '.', ENT_QUOTES);
        $img = htmlspecialchars(base_url() . '/api/e/' . $e['code'] . '/card.png', ENT_QUOTES);
        $html = preg_replace('#<title>.*?</title>#s', "<title>$title</title>", $html);
        $html = preg_replace('#<meta property="og:title"[^>]*>#', '<meta property="og:title" content="' . $title . '">', $html);
        $html = preg_replace('#<meta property="og:description"[^>]*>#', '<meta property="og:description" content="' . $desc . '">', $html);
        $html = preg_replace('#<meta property="og:image"[^>]*>#', '<meta property="og:image" content="' . $img . '">', $html);
    }
    header('Content-Type: text/html; charset=utf-8');
    echo $html;
    exit;
}
