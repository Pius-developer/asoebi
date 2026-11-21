<?php
declare(strict_types=1);

/** "We're wearing aso-ebi for …" share card (1200×630), with the fabric colours as swatches. */
final class Card
{
    public static function path(array $e, array $fabrics): string
    {
        $dir = ROOT . '/data/cards';
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        // Name includes a hash of what's drawn, so the card refreshes when the event changes.
        $key = substr(md5($e['title'] . $e['event_date'] . json_encode(array_column($fabrics, 'color'))), 0, 10);
        $file = $dir . '/' . $e['id'] . '-' . $key . '.png';
        if (!is_file($file)) imagepng(self::draw($e, $fabrics), $file, 6);
        return $file;
    }

    public static function draw(array $e, array $fabrics): GdImage
    {
        $W = 1200; $H = 630;
        $f = ROOT . '/api/src/fonts/';
        $xb = $f . 'InterDisplay-ExtraBold.otf'; $b = $f . 'InterDisplay-Bold.otf'; $semi = $f . 'Inter-SemiBold.otf'; $med = $f . 'Inter-Medium.otf';
        $img = imagecreatetruecolor($W, $H);
        imageantialias($img, true);
        $c = fn (string $hex) => imagecolorallocate($img, hexdec(substr($hex, 1, 2)), hexdec(substr($hex, 3, 2)), hexdec(substr($hex, 5, 2)));
        imagefill($img, 0, 0, $c('#FFFFFF'));
        $ink = $c('#1A1523'); $muted = $c('#6E6680'); $purple = $c('#7C3AED');

        // Right: overlapping fabric swatches like folded cloth
        $colors = array_slice(array_values(array_unique(array_column($fabrics, 'color'))), 0, 5) ?: ['#7C3AED'];
        imagefilledellipse($img, 960, 315, 520, 520, $c('#F4EEFF'));
        $n = count($colors);
        foreach ($colors as $i => $hex) {
            $x = 960 + (int) (($i - ($n - 1) / 2) * 70);
            $y = 315 + (int) (($i - ($n - 1) / 2) * 18);
            imagefilledellipse($img, $x + 6, $y + 10, 230, 230, $c('#E4D9FA'));
            imagefilledellipse($img, $x, $y, 230, 230, $c($hex));
        }

        // Left: words
        imagefilledrectangle($img, 64, 70, 64 + 44, 70 + 44, $purple);
        imagettftext($img, 24, 0, 74, 102, $c('#FFFFFF'), $xb, 'A');
        imagettftext($img, 26, 0, 124, 102, $ink, $xb, 'Aso-ebi');

        imagettftext($img, 28, 0, 64, 200, $muted, $semi, "We're wearing aso-ebi for");
        $y = 280; $size = 60;
        $title = $e['title'];
        while (self::width($title, $xb, $size) > 1300 && $size > 36) $size -= 4;
        foreach (self::wrap($title, $xb, $size, 640) as $i => $line) {
            if ($i > 2) break;
            imagettftext($img, $size, 0, 60, $y, $ink, $xb, $line);
            $y += (int) ($size * 1.18);
        }
        $when = date('l j F Y', strtotime($e['event_date'])) . ($e['venue'] ? ' · ' . $e['venue'] : '');
        imagettftext($img, 24, 0, 64, min($y + 20, 520), $purple, $semi, mb_strimwidth($when, 0, 48, '…'));

        $host = preg_replace('#^https?://#', '', base_url());
        imagettftext($img, 20, 0, 64, 585, $muted, $med, 'Get yours at ' . $host . '/e/' . $e['code']);
        return $img;
    }

    private static function width(string $t, string $font, int $size): int
    {
        $b = imagettfbbox($size, 0, $font, $t);
        return $b[2] - $b[0];
    }

    private static function wrap(string $text, string $font, int $size, int $max): array
    {
        $lines = []; $cur = '';
        foreach (preg_split('/\s+/u', trim($text)) as $word) {
            $try = $cur === '' ? $word : "$cur $word";
            if (self::width($try, $font, $size) > $max && $cur !== '') { $lines[] = $cur; $cur = $word; } else { $cur = $try; }
        }
        if ($cur !== '') $lines[] = $cur;
        return $lines;
    }
}
