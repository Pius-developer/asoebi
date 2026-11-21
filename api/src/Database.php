<?php
declare(strict_types=1);

final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo === null) {
            $dir = dirname(DB_PATH);
            if (!is_dir($dir)) mkdir($dir, 0755, true);
            self::$pdo = new PDO('sqlite:' . DB_PATH, null, null, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            self::$pdo->exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
            self::migrate(self::$pdo);
        }
        return self::$pdo;
    }

    public static function reset(): void { self::$pdo = null; }

    private static function migrate(PDO $db): void
    {
        $db->exec(<<<'SQL'
            -- Celebrants (people who run an aso-ebi) have an account. Guests don't need one.
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT NOT NULL,
                email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
                phone         TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at    TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS events (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                code           TEXT NOT NULL UNIQUE,              -- public link: /e/{code}
                owner_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title          TEXT NOT NULL,
                kind           TEXT NOT NULL DEFAULT 'wedding',   -- wedding | birthday | burial | other
                event_date     TEXT NOT NULL,                     -- Y-m-d
                venue          TEXT,
                deadline       TEXT,                              -- last day to order (Y-m-d), optional
                sides          TEXT NOT NULL,                     -- JSON list, e.g. ["Bride's side","Groom's side","Friends"]
                bank_name      TEXT,
                account_name   TEXT,
                account_number TEXT,
                collection     TEXT,                              -- where/when to pick up the fabric
                cover          TEXT,                              -- image file name
                status         TEXT NOT NULL DEFAULT 'open',      -- open | closed
                created_at     TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS fabrics (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                name        TEXT NOT NULL,
                description TEXT,
                price       INTEGER NOT NULL,                     -- naira
                stock       INTEGER,                              -- NULL = no limit
                color       TEXT NOT NULL DEFAULT '#7C3AED',      -- swatch colour for cards and the share image
                photo       TEXT,
                sort        INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS orders (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                token        TEXT NOT NULL UNIQUE,                -- guest's private link: /o/{token}
                ref          TEXT NOT NULL,                       -- short reference for transfers, e.g. ASO-4K7Q
                name         TEXT NOT NULL,
                phone        TEXT NOT NULL,
                side         TEXT,
                note         TEXT,                                -- size, gele style, "for my mum too"…
                total        INTEGER NOT NULL,
                status       TEXT NOT NULL DEFAULT 'unpaid',      -- unpaid | claimed | paid | rejected | cancelled
                receipt      TEXT,
                claimed_at   TEXT,
                paid_at      TEXT,
                collected_at TEXT,
                created_at   TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_orders_event ON orders(event_id, status);

            CREATE TABLE IF NOT EXISTS order_items (
                order_id  INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                fabric_id INTEGER NOT NULL REFERENCES fabrics(id) ON DELETE CASCADE,
                qty       INTEGER NOT NULL,
                price     INTEGER NOT NULL,                       -- price at the time of ordering
                PRIMARY KEY (order_id, fabric_id)
            );

            CREATE TABLE IF NOT EXISTS log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                actor      TEXT NOT NULL,
                action     TEXT NOT NULL,
                detail     TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS hits (
                key        TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_hits ON hits(key, created_at);
        SQL);
    }
}
