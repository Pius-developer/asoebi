<?php
declare(strict_types=1);

/** Small pure helpers, easy to test. */
final class Util
{
    /** Nigerian phone numbers in any common format → 2348012345678. Null if it isn't one. */
    public static function phone(string $raw): ?string
    {
        $d = preg_replace('/\D+/', '', $raw);
        if (str_starts_with($d, '2340')) $d = '234' . substr($d, 4);
        if (strlen($d) === 11 && $d[0] === '0') $d = '234' . substr($d, 1);
        if (strlen($d) === 10 && in_array($d[0], ['7', '8', '9'], true)) $d = '234' . $d;
        return preg_match('/^234[789][01]\d{8}$/', $d) ? $d : null;
    }

    /** 2348012345678 → 0801 234 5678 */
    public static function phoneLocal(string $p): string
    {
        $l = '0' . substr($p, 3);
        return substr($l, 0, 4) . ' ' . substr($l, 4, 3) . ' ' . substr($l, 7);
    }

    public static function naira(int $n): string
    {
        return '₦' . number_format($n);
    }

    public static function code(int $len, string $chars = 'abcdefghjkmnpqrstuvwxyz23456789'): string
    {
        $out = '';
        for ($i = 0; $i < $len; $i++) $out .= $chars[random_int(0, strlen($chars) - 1)];
        return $out;
    }

    public static function clean(?string $s, int $max): string
    {
        return mb_substr(trim(preg_replace('/\s+/u', ' ', (string) $s)), 0, $max);
    }

    public static function validDate(string $d): bool
    {
        $x = DateTimeImmutable::createFromFormat('!Y-m-d', $d);
        return $x && $x->format('Y-m-d') === $d;
    }

    public static function hex(string $c): string
    {
        return preg_match('/^#[0-9a-fA-F]{6}$/', $c) ? strtoupper($c) : '#7C3AED';
    }

    /** The sides guests can choose from, by event type. */
    public static function defaultSides(string $kind): array
    {
        return match ($kind) {
            'wedding'  => ["Bride's side", "Groom's side", 'Friends'],
            'birthday' => ['Family', 'Friends', 'Colleagues'],
            'burial'   => ['Family', 'Friends', 'Church / Community'],
            default    => ['Family', 'Friends'],
        };
    }
}
