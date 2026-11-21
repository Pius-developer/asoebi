<?php
declare(strict_types=1);

// php tests/run.php  — runs against a throwaway database
$db = sys_get_temp_dir() . '/asoebi-test-' . getmypid() . '.sqlite';
@unlink($db);
define('DB_PATH', $db);
define('PHOTO_TEST', true);
require __DIR__ . '/../api/bootstrap.php';
$_SERVER['HTTP_HOST'] = 'asoebi.ejikepius.dev';

$passed = 0; $failed = 0;
function test(string $name, callable $fn): void
{
    global $passed, $failed;
    try { $fn(); $passed++; echo "  ✓ $name\n"; }
    catch (Throwable $e) { $failed++; echo "  ✗ $name\n    " . $e->getMessage() . ' (line ' . $e->getLine() . ")\n"; }
}
function ok(bool $c, string $m = 'expected true'): void { if (!$c) throw new RuntimeException($m); }
function eq(mixed $a, mixed $b): void { if ($a !== $b) throw new RuntimeException('expected ' . var_export($b, true) . ', got ' . var_export($a, true)); }

$today = '2026-11-21';
$U = users(); $E = events(); $O = orders();
$tolu = $U->find($U->create('Tolu Adebayo', 'tolu@example.com', '0803 111 2222', 'password123')['id']);

echo "Helpers\n";
test('phone numbers', function () {
    eq(Util::phone('0803 123 4567'), '2348031234567');
    eq(Util::phone('+234 (803) 123-4567'), '2348031234567');
    eq(Util::phone('123'), null);
    eq(Util::phoneLocal('2348031234567'), '0803 123 4567');
});
test('default sides by event type', function () {
    eq(Util::defaultSides('wedding'), ["Bride's side", "Groom's side", 'Friends']);
    eq(count(Util::defaultSides('birthday')), 3);
});
test('colours are checked', fn () => eq([Util::hex('#a1b2c3'), Util::hex('red; x')], ['#A1B2C3', '#7C3AED']));

echo "Events\n";
test('event validation', function () use ($E, $tolu, $today) {
    eq($E->create($tolu, ['title' => 'X', 'event_date' => '2026-12-19'], $today)['field'], 'title');
    eq($E->create($tolu, ['title' => 'Our wedding', 'event_date' => '2026-01-01'], $today)['field'], 'event_date');
    eq($E->create($tolu, ['title' => 'Our wedding', 'event_date' => '2026-12-19', 'deadline' => '2026-12-25'], $today)['field'], 'deadline');
    eq($E->create($tolu, ['title' => 'Our wedding', 'event_date' => '2026-12-19', 'account_number' => '12345'], $today)['field'], 'account_number');
});
$e = $E->create($tolu, ['title' => "Tolu & Femi's wedding", 'kind' => 'wedding', 'event_date' => '2026-12-19', 'venue' => 'Lekki, Lagos',
    'deadline' => '2026-12-05', 'bank_name' => 'GTBank', 'account_name' => 'Tolu Adebayo', 'account_number' => '0123456789', 'collection' => 'Pick up at 12 Admiralty Way'], $today)['event'];
test('wedding gets bride/groom sides', fn () => eq(json_decode($e['sides'], true)[1], "Groom's side"));
test('fabric validation', function () use ($E, $e) {
    eq($E->saveFabric($e, ['name' => 'G', 'price' => 1000], null, null, 'Tolu')['field'], 'name');
    eq($E->saveFabric($e, ['name' => 'Gele', 'price' => 50], null, null, 'Tolu')['field'], 'price');
});
$gele = $E->saveFabric($e, ['name' => 'Gele + Ipele', 'price' => '25,000', 'stock' => '3', 'color' => '#7C3AED'], null, null, 'Tolu')['id'];
$men = $E->saveFabric($e, ['name' => "Men's fabric", 'price' => '18000', 'stock' => '', 'color' => '#D4AF37'], null, null, 'Tolu')['id'];
test('stock and unlimited fabrics', function () use ($E, $e) {
    $f = array_column($E->fabrics((int) $e['id']), null, 'name');
    eq($f['Gele + Ipele']['left'], 3); eq($f["Men's fabric"]['left'], null);
});
test('public view hides bank details', function () use ($E, $e, $today) {
    $v = $E->publicView($e, $today);
    ok(!isset($v['account_number']) && !isset($v['bank_name']));
    eq($v['host'], 'Tolu'); eq($v['is_open'], true); eq(count($v['fabrics']), 2);
});

echo "Orders\n";
$order = fn (string $name, string $phone, string $side, array $items) => $O->place($e, ['name' => $name, 'phone' => $phone, 'side' => $side,
    'items' => array_map(fn ($k, $v) => ['fabric_id' => $k, 'qty' => $v], array_keys($items), $items)], $today);
test('order needs a side, phone and items', function () use ($O, $e, $today, $gele) {
    eq($O->place($e, ['name' => 'Ada', 'phone' => '0803', 'side' => 'Friends', 'items' => [['fabric_id' => $gele, 'qty' => 1]]], $today)['field'], 'phone');
    eq($O->place($e, ['name' => 'Ada', 'phone' => '08031234567', 'side' => 'Aliens', 'items' => [['fabric_id' => $gele, 'qty' => 1]]], $today)['field'], 'side');
    eq($O->place($e, ['name' => 'Ada', 'phone' => '08031234567', 'side' => 'Friends', 'items' => []], $today)['field'], 'items');
});
$a = $order('Ada Obi', '08031234567', "Bride's side", [$gele => 2, $men => 1]);
test('order totals and reference', function () use ($a) {
    ok($a['ok']); eq((int) $a['order']['total'], 68000); ok((bool) preg_match('/^ASO-[A-Z0-9]{4}$/', $a['order']['ref']));
});
test('stock can\'t be oversold', function () use ($order, $gele) {
    eq($order('Bisi', '08031234568', 'Friends', [$gele => 2])['error'], 'Only 1 Gele + Ipele left.');
    ok($order('Bisi', '08031234568', 'Friends', [$gele => 1])['ok']);
    eq($order('Chi', '08031234569', 'Friends', [$gele => 1])['error'], 'Gele + Ipele just sold out.');
});
test('unknown fabrics are refused', fn () => ok(!$order('Chi', '08031234569', 'Friends', [99999 => 1])['ok']));
$o = $O->byToken($a['order']['token']);
test('guest sees bank details and items', function () use ($O, $o) {
    $v = $O->guestView($o);
    eq($v['event']['account_number'], '0123456789'); eq(count($v['items']), 2); eq($v['status'], 'unpaid');
});
test('I have paid → confirm', function () use ($O, $o) {
    ok($O->claim($o, null)['ok']);
    $o = $O->find((int) $o['id']); eq($o['status'], 'claimed');
    ok(!$O->claim($o, null)['ok'], 'double claim');
    ok($O->act($o, 'confirm', 'Tolu')['ok']);
    eq($O->find((int) $o['id'])['status'], 'paid');
});
test('paid orders can\'t be cancelled; collected toggles', function () use ($O, $o) {
    $o = $O->find((int) $o['id']);
    ok(!$O->act($o, 'cancel', 'Tolu')['ok']);
    ok($O->act($o, 'collected', 'Tolu')['ok']);
    ok(!$O->act($O->find((int) $o['id']), 'collected', 'Tolu')['ok'], 'twice');
    ok($O->act($O->find((int) $o['id']), 'uncollect', 'Tolu')['ok']);
});
test('cancelling frees stock', function () use ($O, $E, $e, $order, $gele) {
    $bisi = array_values(array_filter($O->forEvent((int) $e['id']), fn ($x) => $x['name'] === 'Bisi'))[0];
    ok($O->act($O->find($bisi['id']), 'cancel', 'Tolu')['ok']);
    eq(array_column($E->fabrics((int) $e['id']), null, 'id')[$gele]['left'], 1);
});
test('rejected payment can be claimed again', function () use ($O, $order, $men) {
    $c = $order('Dayo', '08031234570', "Groom's side", [$men => 1])['order'];
    $O->claim($c, null);
    ok($O->act($O->find((int) $c['id']), 'reject', 'Tolu')['ok']);
    ok($O->claim($O->find((int) $c['id']), null)['ok']);
});
test('stats and side tally', function () use ($E, $e) {
    $s = $E->stats($e);
    eq($s['paid'], 1); eq($s['to_confirm'], 1); eq($s['raised'], 68000); eq($s['people'], 2);
    eq($s['sides'], ["Bride's side" => 1, "Groom's side" => 1, 'Friends' => 0]);
});
test('fabrics with orders can\'t be deleted', fn () => ok(!$E->deleteFabric($e, $gele, 'Tolu')['ok']));
test('closed events take no orders', function () use ($E, $O, $e, $men) {
    $E->setStatus($e, 'closed', 'Tolu');
    ok(!$O->place($E->find((int) $e['id']), ['name' => 'Late', 'phone' => '08031234571', 'side' => 'Friends', 'items' => [['fabric_id' => $men, 'qty' => 1]]], '2026-11-22')['ok']);
    $E->setStatus($e, 'open', 'Tolu');
    ok(!Events::isOpen($E->find((int) $e['id']), '2026-12-06'), 'after deadline');
});
test('CSV export', function () use ($O, $e) {
    $csv = $O->csv($e);
    ok(str_contains($csv, 'Ada Obi')); ok(!str_contains($csv, 'Bisi'), 'cancelled left out');
    ok(str_contains(strtok($csv, "\n"), 'Gele + Ipele'));
});
test('history', fn () => ok(count($E->history((int) $e['id'])) >= 10));

echo "Images\n";
test('share card is 1200×630', function () use ($E, $e) {
    $img = Card::draw($e, $E->fabrics((int) $e['id']));
    eq([imagesx($img), imagesy($img)], [1200, 630]);
});

@unlink($db);
echo "\n" . ($failed ? "✗ $failed failed, $passed passed" : "✓ All $passed tests passed") . "\n";
exit($failed ? 1 : 0);
