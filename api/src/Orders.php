<?php
declare(strict_types=1);

/**
 * Guest orders. Aso-ebi only keeps the record: guests transfer to the celebrant,
 * tap "I've paid" with a receipt, and the celebrant confirms it.
 */
final class Orders
{
    public const MAX_QTY = 20;

    public function __construct(private PDO $db, private Events $events) {}

    /**
     * Place an order. Stock is checked inside a write lock so two people can't buy the last piece.
     * @param array $items [['fabric_id' => int, 'qty' => int], ...]
     * @return array{ok: bool, order?: array, error?: string, field?: string}
     */
    public function place(array $e, array $in, string $today): array
    {
        if (!Events::isOpen($e, $today)) return ['ok' => false, 'error' => 'Orders for this event are closed.'];
        $name = Util::clean($in['name'] ?? '', 60);
        $phone = Util::phone((string) ($in['phone'] ?? ''));
        $sides = json_decode($e['sides'], true) ?: [];
        $side = in_array($in['side'] ?? null, $sides, true) ? $in['side'] : null;
        $note = Util::clean($in['note'] ?? '', 200) ?: null;
        if (mb_strlen($name) < 2) return ['ok' => false, 'field' => 'name', 'error' => 'Enter your name.'];
        if (!$phone) return ['ok' => false, 'field' => 'phone', 'error' => 'Enter a Nigerian phone number, like 0803 123 4567.'];
        if ($sides && !$side) return ['ok' => false, 'field' => 'side', 'error' => 'Choose whose side you\'re on.'];

        $want = [];
        foreach ((array) ($in['items'] ?? []) as $it) {
            $fid = (int) ($it['fabric_id'] ?? 0); $qty = (int) ($it['qty'] ?? 0);
            if ($fid > 0 && $qty > 0) $want[$fid] = ($want[$fid] ?? 0) + $qty;
        }
        if (!$want) return ['ok' => false, 'field' => 'items', 'error' => 'Pick at least one fabric.'];

        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $fabrics = array_column($this->events->fabrics((int) $e['id']), null, 'id');
            $total = 0; $lines = [];
            foreach ($want as $fid => $qty) {
                $f = $fabrics[$fid] ?? null;
                if (!$f) { $this->db->exec('ROLLBACK'); return ['ok' => false, 'field' => 'items', 'error' => 'One of those fabrics isn\'t available.']; }
                if ($qty > self::MAX_QTY) { $this->db->exec('ROLLBACK'); return ['ok' => false, 'field' => 'items', 'error' => 'You can order at most ' . self::MAX_QTY . ' of each fabric.']; }
                if ($f['left'] !== null && $qty > $f['left']) {
                    $this->db->exec('ROLLBACK');
                    return ['ok' => false, 'field' => 'items', 'error' => $f['left'] === 0 ? $f['name'] . ' just sold out.' : 'Only ' . $f['left'] . ' ' . $f['name'] . ' left.'];
                }
                $total += $qty * (int) $f['price'];
                $lines[] = [$fid, $qty, (int) $f['price']];
            }
            $this->db->prepare('INSERT INTO orders (event_id, token, ref, name, phone, side, note, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$e['id'], bin2hex(random_bytes(12)), 'ASO-' . strtoupper(Util::code(4, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789')), $name, $phone, $side, $note, $total]);
            $id = (int) $this->db->lastInsertId();
            $ins = $this->db->prepare('INSERT INTO order_items (order_id, fabric_id, qty, price) VALUES (?, ?, ?, ?)');
            foreach ($lines as [$fid, $qty, $price]) $ins->execute([$id, $fid, $qty, $price]);
            $this->db->exec('COMMIT');
        } catch (Throwable $t) {
            $this->db->exec('ROLLBACK');
            throw $t;
        }
        $this->events->log((int) $e['id'], $name, 'ordered', 'Ordered ' . Util::naira($total) . ' of fabric');
        return ['ok' => true, 'order' => $this->find($id)];
    }

    public function find(int $id): ?array
    {
        $s = $this->db->prepare('SELECT * FROM orders WHERE id = ?');
        $s->execute([$id]);
        return $s->fetch() ?: null;
    }

    public function byToken(string $token): ?array
    {
        if (!preg_match('/^[a-f0-9]{24}$/', $token)) return null;
        $s = $this->db->prepare('SELECT * FROM orders WHERE token = ?');
        $s->execute([$token]);
        return $s->fetch() ?: null;
    }

    public function items(int $orderId): array
    {
        $s = $this->db->prepare('SELECT i.fabric_id, i.qty, i.price, f.name, f.color, f.photo FROM order_items i JOIN fabrics f ON f.id = i.fabric_id WHERE i.order_id = ?');
        $s->execute([$orderId]);
        return array_map(fn ($r) => ['fabric_id' => (int) $r['fabric_id'], 'name' => $r['name'], 'qty' => (int) $r['qty'], 'price' => (int) $r['price'],
                                    'color' => $r['color'], 'photo' => $r['photo'] ? '/api/img/' . $r['photo'] : null], $s->fetchAll());
    }

    /** Guest says "I've paid", with an optional receipt. */
    public function claim(array $o, ?string $receipt): array
    {
        if (!in_array($o['status'], ['unpaid', 'rejected'], true)) {
            return ['ok' => false, 'error' => $o['status'] === 'paid' ? 'This order is already confirmed as paid.' : 'You\'ve already told the celebrant. They\'ll confirm it soon.'];
        }
        $this->db->prepare("UPDATE orders SET status = 'claimed', receipt = COALESCE(?, receipt), claimed_at = datetime('now') WHERE id = ?")
            ->execute([$receipt, $o['id']]);
        $this->events->log((int) $o['event_id'], $o['name'], 'claimed', 'Said they paid ' . Util::naira((int) $o['total']) . ($receipt ? ' (with receipt)' : ''));
        return ['ok' => true];
    }

    /** Celebrant actions on an order: confirm, reject, collected, uncollect, cancel, paid (cash). */
    public function act(array $o, string $action, string $actor): array
    {
        $set = match ($action) {
            'confirm'   => in_array($o['status'], ['claimed', 'unpaid', 'rejected'], true) ? "status = 'paid', paid_at = datetime('now')" : null,
            'reject'    => $o['status'] === 'claimed' ? "status = 'rejected'" : null,
            'collected' => $o['status'] !== 'cancelled' && !$o['collected_at'] ? "collected_at = datetime('now')" : null,
            'uncollect' => $o['collected_at'] ? 'collected_at = NULL' : null,
            'cancel'    => $o['status'] !== 'paid' && $o['status'] !== 'cancelled' ? "status = 'cancelled'" : null,
            default     => null,
        };
        if (!$set) return ['ok' => false, 'error' => 'That can\'t be done to this order now.'];
        $this->db->prepare("UPDATE orders SET $set WHERE id = ?")->execute([$o['id']]);
        $this->events->log((int) $o['event_id'], $actor, $action, match ($action) {
            'confirm'   => 'Confirmed ' . $o['name'] . '\'s payment of ' . Util::naira((int) $o['total']),
            'reject'    => 'Said they haven\'t received ' . $o['name'] . '\'s payment',
            'collected' => $o['name'] . ' collected their fabric',
            'uncollect' => 'Marked ' . $o['name'] . '\'s fabric as not collected',
            'cancel'    => 'Cancelled ' . $o['name'] . '\'s order',
        });
        return ['ok' => true];
    }

    /** All orders for the dashboard, newest first. */
    public function forEvent(int $eventId): array
    {
        $s = $this->db->prepare('SELECT * FROM orders WHERE event_id = ? ORDER BY id DESC');
        $s->execute([$eventId]);
        $items = [];
        $q = $this->db->prepare('SELECT i.order_id, i.fabric_id, i.qty, f.name FROM order_items i JOIN fabrics f ON f.id = i.fabric_id
                                 WHERE i.order_id IN (SELECT id FROM orders WHERE event_id = ?)');
        $q->execute([$eventId]);
        foreach ($q->fetchAll() as $r) $items[(int) $r['order_id']][] = ['fabric_id' => (int) $r['fabric_id'], 'name' => $r['name'], 'qty' => (int) $r['qty']];
        return array_map(fn ($o) => self::ownerView($o, $items[(int) $o['id']] ?? []), $s->fetchAll());
    }

    public static function ownerView(array $o, array $items): array
    {
        return [
            'id'        => (int) $o['id'],
            'ref'       => $o['ref'],
            'name'      => $o['name'],
            'phone'     => Util::phoneLocal($o['phone']),
            'wa'        => $o['phone'],
            'side'      => $o['side'],
            'note'      => $o['note'],
            'total'     => (int) $o['total'],
            'status'    => $o['status'],
            'receipt'   => $o['receipt'] ? '/api/receipt/' . $o['receipt'] : null,
            'collected' => (bool) $o['collected_at'],
            'items'     => $items,
            'link'      => '/o/' . $o['token'],
            'created_at'=> $o['created_at'],
            'claimed_at'=> $o['claimed_at'],
        ];
    }

    /** What the guest sees on their private order page. */
    public function guestView(array $o): array
    {
        $e = $this->events->find((int) $o['event_id']);
        return [
            'ref'       => $o['ref'],
            'name'      => $o['name'],
            'side'      => $o['side'],
            'note'      => $o['note'],
            'total'     => (int) $o['total'],
            'status'    => $o['status'],
            'has_receipt' => (bool) $o['receipt'],
            'collected' => (bool) $o['collected_at'],
            'items'     => $this->items((int) $o['id']),
            'created_at'=> $o['created_at'],
            'event'     => $this->events->summary($e) + [
                'bank_name'      => $e['bank_name'],
                'account_name'   => $e['account_name'],
                'account_number' => $e['account_number'],
                'collection'     => $e['collection'],
            ],
        ];
    }

    /** CSV for the celebrant's tailor or family WhatsApp group. */
    public function csv(array $e): string
    {
        $fabrics = $this->events->fabrics((int) $e['id']);
        $out = fopen('php://temp', 'r+');
        fputcsv($out, array_merge(['Ref', 'Name', 'Phone', 'Side', 'Note'], array_column($fabrics, 'name'), ['Total (NGN)', 'Status', 'Collected', 'Ordered at']), escape: '');
        foreach ($this->forEvent((int) $e['id']) as $o) {
            if ($o['status'] === 'cancelled') continue;
            $qty = array_column($o['items'], 'qty', 'fabric_id');
            fputcsv($out, array_merge(
                [$o['ref'], $o['name'], $o['phone'], $o['side'] ?? '', $o['note'] ?? ''],
                array_map(fn ($f) => $qty[$f['id']] ?? 0, $fabrics),
                [$o['total'], ['paid' => 'Paid', 'claimed' => 'To confirm', 'unpaid' => 'Not paid', 'rejected' => 'Not received'][$o['status']] ?? $o['status'],
                 $o['collected'] ? 'Yes' : 'No', $o['created_at']]
            ), escape: '');
        }
        rewind($out);
        return stream_get_contents($out);
    }
}
