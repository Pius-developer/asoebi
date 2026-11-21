<?php
declare(strict_types=1);

/** Events (the occasion) and their fabrics. */
final class Events
{
    public const KINDS = ['wedding', 'birthday', 'burial', 'other'];

    public function __construct(private PDO $db) {}

    // ---- Events ----------------------------------------------------------

    /** Check event fields. Returns [clean data, null] or [null, error]. */
    public function validate(array $in, string $today, bool $creating): array
    {
        $d = [
            'title'          => Util::clean($in['title'] ?? '', 80),
            'kind'           => in_array($in['kind'] ?? '', self::KINDS, true) ? $in['kind'] : 'other',
            'event_date'     => (string) ($in['event_date'] ?? ''),
            'venue'          => Util::clean($in['venue'] ?? '', 120),
            'deadline'       => (string) ($in['deadline'] ?? ''),
            'bank_name'      => Util::clean($in['bank_name'] ?? '', 60),
            'account_name'   => Util::clean($in['account_name'] ?? '', 80),
            'account_number' => preg_replace('/\D/', '', (string) ($in['account_number'] ?? '')),
            'collection'     => Util::clean($in['collection'] ?? '', 240),
        ];
        $sides = array_values(array_filter(array_map(fn ($s) => Util::clean((string) $s, 30), (array) ($in['sides'] ?? []))));
        $d['sides'] = $sides ?: Util::defaultSides($d['kind']);
        if (count($d['sides']) > 4) return [null, ['sides', 'Use at most 4 sides.']];

        if (mb_strlen($d['title']) < 3) return [null, ['title', 'Give the event a name, like "Tolu & Femi\'s wedding".']];
        if (!Util::validDate($d['event_date'])) return [null, ['event_date', 'Choose the date of the event.']];
        if ($creating && $d['event_date'] < $today) return [null, ['event_date', 'The event date can\'t be in the past.']];
        if ($d['deadline'] !== '') {
            if (!Util::validDate($d['deadline'])) return [null, ['deadline', 'Choose a valid order deadline, or leave it empty.']];
            if ($d['deadline'] > $d['event_date']) return [null, ['deadline', 'The order deadline should be before the event.']];
        } else {
            $d['deadline'] = null;
        }
        if ($d['account_number'] !== '' && strlen($d['account_number']) !== 10) return [null, ['account_number', 'Nigerian account numbers have 10 digits.']];
        return [$d, null];
    }

    /** @return array{ok: bool, event?: array, error?: string, field?: string} */
    public function create(array $owner, array $in, string $today): array
    {
        [$d, $err] = $this->validate($in, $today, true);
        if ($err) return ['ok' => false, 'field' => $err[0], 'error' => $err[1]];
        $this->db->prepare('INSERT INTO events (code, owner_id, title, kind, event_date, venue, deadline, sides, bank_name, account_name, account_number, collection)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([Util::code(8), $owner['id'], $d['title'], $d['kind'], $d['event_date'], $d['venue'] ?: null, $d['deadline'],
                       json_encode($d['sides']), $d['bank_name'] ?: null, $d['account_name'] ?: null, $d['account_number'] ?: null, $d['collection'] ?: null]);
        $id = (int) $this->db->lastInsertId();
        $this->log($id, $owner['name'], 'created', 'Created the event');
        return ['ok' => true, 'event' => $this->find($id)];
    }

    public function update(array $e, array $in, string $actor, string $today): array
    {
        [$d, $err] = $this->validate($in + ['kind' => $e['kind']], $today, false);
        if ($err) return ['ok' => false, 'field' => $err[0], 'error' => $err[1]];
        $this->db->prepare('UPDATE events SET title = ?, kind = ?, event_date = ?, venue = ?, deadline = ?, sides = ?, bank_name = ?, account_name = ?, account_number = ?, collection = ? WHERE id = ?')
            ->execute([$d['title'], $d['kind'], $d['event_date'], $d['venue'] ?: null, $d['deadline'], json_encode($d['sides']),
                       $d['bank_name'] ?: null, $d['account_name'] ?: null, $d['account_number'] ?: null, $d['collection'] ?: null, $e['id']]);
        $this->log((int) $e['id'], $actor, 'settings', 'Updated the event details');
        return ['ok' => true];
    }

    public function setStatus(array $e, string $status, string $actor): void
    {
        if (!in_array($status, ['open', 'closed'], true)) return;
        $this->db->prepare('UPDATE events SET status = ? WHERE id = ?')->execute([$status, $e['id']]);
        $this->log((int) $e['id'], $actor, 'status', $status === 'open' ? 'Opened orders' : 'Closed orders');
    }

    public function setCover(array $e, string $file): void
    {
        $this->db->prepare('UPDATE events SET cover = ? WHERE id = ?')->execute([$file, $e['id']]);
    }

    public function find(int $id): ?array
    {
        $s = $this->db->prepare('SELECT * FROM events WHERE id = ?');
        $s->execute([$id]);
        return $s->fetch() ?: null;
    }

    public function byCode(string $code): ?array
    {
        if (!preg_match('/^[a-z0-9]{8}$/', $code)) return null;
        $s = $this->db->prepare('SELECT * FROM events WHERE code = ?');
        $s->execute([$code]);
        return $s->fetch() ?: null;
    }

    public function owned(int $userId): array
    {
        $s = $this->db->prepare('SELECT * FROM events WHERE owner_id = ? ORDER BY event_date < date(\'now\'), event_date');
        $s->execute([$userId]);
        return array_map(fn ($e) => $this->summary($e) + ['stats' => $this->stats($e)], $s->fetchAll());
    }

    /** Can guests order right now? */
    public static function isOpen(array $e, string $today): bool
    {
        return $e['status'] === 'open' && $today <= ($e['deadline'] ?: $e['event_date']);
    }

    // ---- Fabrics ---------------------------------------------------------

    public function fabrics(int $eventId): array
    {
        $s = $this->db->prepare('SELECT f.*,
                    (SELECT COALESCE(SUM(i.qty), 0) FROM order_items i JOIN orders o ON o.id = i.order_id
                     WHERE i.fabric_id = f.id AND o.status != \'cancelled\') AS ordered,
                    (SELECT COALESCE(SUM(i.qty), 0) FROM order_items i JOIN orders o ON o.id = i.order_id
                     WHERE i.fabric_id = f.id AND o.status = \'paid\') AS paid
                 FROM fabrics f WHERE f.event_id = ? ORDER BY f.sort, f.id');
        $s->execute([$eventId]);
        return array_map(function ($f) {
            $f['ordered'] = (int) $f['ordered'];
            $f['paid'] = (int) $f['paid'];
            $f['left'] = $f['stock'] === null ? null : max(0, (int) $f['stock'] - $f['ordered']);
            return $f;
        }, $s->fetchAll());
    }

    public function fabric(int $id): ?array
    {
        $s = $this->db->prepare('SELECT * FROM fabrics WHERE id = ?');
        $s->execute([$id]);
        return $s->fetch() ?: null;
    }

    /** Create or update a fabric. @return array{ok: bool, id?: int, error?: string, field?: string} */
    public function saveFabric(array $e, array $in, ?int $id, ?string $photo, string $actor): array
    {
        $name = Util::clean($in['name'] ?? '', 60);
        $price = (int) preg_replace('/\D/', '', (string) ($in['price'] ?? ''));
        $stockRaw = trim((string) ($in['stock'] ?? ''));
        $stock = $stockRaw === '' ? null : (int) $stockRaw;
        if (mb_strlen($name) < 2) return ['ok' => false, 'field' => 'name', 'error' => 'Name the fabric, like "Gele + Ipele".'];
        if ($price < 100 || $price > 5_000_000) return ['ok' => false, 'field' => 'price', 'error' => 'Enter a price between ₦100 and ₦5,000,000.'];
        if ($stock !== null && ($stock < 0 || $stock > 100000)) return ['ok' => false, 'field' => 'stock', 'error' => 'Stock should be a number, or empty for no limit.'];
        $desc = Util::clean($in['description'] ?? '', 200) ?: null;
        $color = Util::hex((string) ($in['color'] ?? ''));

        if ($id) {
            $f = $this->fabric($id);
            if (!$f || (int) $f['event_id'] !== (int) $e['id']) return ['ok' => false, 'error' => 'Fabric not found.'];
            $this->db->prepare('UPDATE fabrics SET name = ?, description = ?, price = ?, stock = ?, color = ?, photo = COALESCE(?, photo) WHERE id = ?')
                ->execute([$name, $desc, $price, $stock, $color, $photo, $id]);
            $this->log((int) $e['id'], $actor, 'fabric', 'Updated ' . $name);
            return ['ok' => true, 'id' => $id];
        }
        $sort = (int) $this->db->query('SELECT COALESCE(MAX(sort), 0) + 1 FROM fabrics WHERE event_id = ' . (int) $e['id'])->fetchColumn();
        $this->db->prepare('INSERT INTO fabrics (event_id, name, description, price, stock, color, photo, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$e['id'], $name, $desc, $price, $stock, $color, $photo, $sort]);
        $newId = (int) $this->db->lastInsertId();   // read it before log() inserts another row
        $this->log((int) $e['id'], $actor, 'fabric', 'Added ' . $name . ' at ' . Util::naira($price));
        return ['ok' => true, 'id' => $newId];
    }

    /** A fabric that people have already ordered can't be deleted (it would break their orders). */
    public function deleteFabric(array $e, int $id, string $actor): array
    {
        $f = $this->fabric($id);
        if (!$f || (int) $f['event_id'] !== (int) $e['id']) return ['ok' => false, 'error' => 'Fabric not found.'];
        $s = $this->db->prepare("SELECT COUNT(*) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.fabric_id = ? AND o.status != 'cancelled'");
        $s->execute([$id]);
        if ((int) $s->fetchColumn() > 0) return ['ok' => false, 'error' => 'People have already ordered this fabric. Set its stock to 0 to stop new orders instead.'];
        $this->db->prepare('DELETE FROM fabrics WHERE id = ?')->execute([$id]);
        $this->log((int) $e['id'], $actor, 'fabric', 'Removed ' . $f['name']);
        return ['ok' => true];
    }

    // ---- Numbers ---------------------------------------------------------

    /** Totals for the dashboard and the public counter. */
    public function stats(array $e): array
    {
        $s = $this->db->prepare("SELECT status, COUNT(*) c, COALESCE(SUM(total), 0) t,
                                        SUM(CASE WHEN collected_at IS NOT NULL THEN 1 ELSE 0 END) col
                                 FROM orders WHERE event_id = ? AND status != 'cancelled' GROUP BY status");
        $s->execute([$e['id']]);
        $by = []; $collected = 0;
        foreach ($s->fetchAll() as $r) { $by[$r['status']] = ['count' => (int) $r['c'], 'total' => (int) $r['t']]; $collected += (int) $r['col']; }
        $get = fn ($k, $f) => $by[$k][$f] ?? 0;

        // "People wearing our colours" counts paid and claimed orders, by side.
        $sideQ = $this->db->prepare("SELECT side, COUNT(*) c FROM orders WHERE event_id = ? AND status IN ('paid', 'claimed') GROUP BY side");
        $sideQ->execute([$e['id']]);
        $sides = array_fill_keys(json_decode($e['sides'], true) ?: [], 0);
        foreach ($sideQ->fetchAll() as $r) if ($r['side'] !== null && array_key_exists($r['side'], $sides)) $sides[$r['side']] = (int) $r['c'];

        return [
            'orders'    => array_sum(array_column($by, 'count')),
            'paid'      => $get('paid', 'count'),
            'to_confirm'=> $get('claimed', 'count'),
            'unpaid'    => $get('unpaid', 'count') + $get('rejected', 'count'),
            'collected' => $collected,
            'raised'    => $get('paid', 'total'),
            'expected'  => array_sum(array_column($by, 'total')),
            'people'    => $get('paid', 'count') + $get('claimed', 'count'),
            'sides'     => $sides,
        ];
    }

    // ---- What the React app receives --------------------------------------

    /** Safe for anyone with the link. Bank details are not included: guests see them after ordering. */
    public function publicView(array $e, string $today): array
    {
        $owner = users()->find((int) $e['owner_id']);
        $stats = $this->stats($e);
        return $this->summary($e) + [
            'host'    => $owner ? explode(' ', $owner['name'])[0] : null,
            'is_open' => self::isOpen($e, $today),
            'fabrics' => array_map(fn ($f) => self::fabricView($f), $this->fabrics((int) $e['id'])),
            'people'  => $stats['people'],
            'tally'   => $stats['sides'],
        ];
    }

    /** Everything the celebrant needs on the dashboard. */
    public function manageView(array $e, string $today): array
    {
        return $this->summary($e) + [
            'is_open'        => self::isOpen($e, $today),
            'bank_name'      => $e['bank_name'],
            'account_name'   => $e['account_name'],
            'account_number' => $e['account_number'],
            'collection'     => $e['collection'],
            'fabrics'        => array_map(fn ($f) => self::fabricView($f, true), $this->fabrics((int) $e['id'])),
            'stats'          => $this->stats($e),
            'orders'         => orders()->forEvent((int) $e['id']),
            'log'            => $this->history((int) $e['id'], 30),
        ];
    }

    public function summary(array $e): array
    {
        return [
            'code'       => $e['code'],
            'title'      => $e['title'],
            'kind'       => $e['kind'],
            'event_date' => $e['event_date'],
            'venue'      => $e['venue'],
            'deadline'   => $e['deadline'],
            'sides'      => json_decode($e['sides'], true) ?: [],
            'cover'      => $e['cover'] ? '/api/img/' . $e['cover'] : null,
            'status'     => $e['status'],
        ];
    }

    public static function fabricView(array $f, bool $owner = false): array
    {
        $v = [
            'id'          => (int) $f['id'],
            'name'        => $f['name'],
            'description' => $f['description'],
            'price'       => (int) $f['price'],
            'color'       => $f['color'],
            'photo'       => $f['photo'] ? '/api/img/' . $f['photo'] : null,
            'left'        => $f['left'],
            'sold_out'    => $f['left'] === 0,
        ];
        if ($owner) $v += ['stock' => $f['stock'] === null ? null : (int) $f['stock'], 'ordered' => $f['ordered'], 'paid' => $f['paid']];
        return $v;
    }

    // ---- History ---------------------------------------------------------

    public function log(int $eventId, string $actor, string $action, string $detail): void
    {
        $this->db->prepare('INSERT INTO log (event_id, actor, action, detail) VALUES (?, ?, ?, ?)')->execute([$eventId, $actor, $action, $detail]);
    }

    public function history(int $eventId, int $limit = 100): array
    {
        $s = $this->db->prepare('SELECT actor, action, detail, created_at FROM log WHERE event_id = ? ORDER BY id DESC LIMIT ' . (int) $limit);
        $s->execute([$eventId]);
        return $s->fetchAll();
    }
}
