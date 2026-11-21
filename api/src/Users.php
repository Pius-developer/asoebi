<?php
declare(strict_types=1);

/** Celebrant accounts. */
final class Users
{
    public function __construct(private PDO $db) {}

    /** @return array{ok: bool, id?: int, error?: string, field?: string} */
    public function create(string $name, string $email, string $phone, string $password): array
    {
        $name = Util::clean($name, 60);
        $email = strtolower(trim($email));
        $p = Util::phone($phone);
        if (mb_strlen($name) < 2) return ['ok' => false, 'field' => 'name', 'error' => 'Enter your name.'];
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return ['ok' => false, 'field' => 'email', 'error' => 'Enter a valid email address.'];
        if (!$p) return ['ok' => false, 'field' => 'phone', 'error' => 'Enter a Nigerian phone number, like 0803 123 4567.'];
        if (strlen($password) < 8) return ['ok' => false, 'field' => 'password', 'error' => 'Use a password of at least 8 characters.'];
        if ($this->findByEmail($email)) return ['ok' => false, 'field' => 'email', 'error' => 'There\'s already an account with that email. Log in instead.'];
        $this->db->prepare('INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)')
            ->execute([$name, $email, $p, password_hash($password, PASSWORD_DEFAULT)]);
        return ['ok' => true, 'id' => (int) $this->db->lastInsertId()];
    }

    public function find(int $id): ?array
    {
        $s = $this->db->prepare('SELECT * FROM users WHERE id = ?');
        $s->execute([$id]);
        return $s->fetch() ?: null;
    }

    public function findByEmail(string $email): ?array
    {
        $s = $this->db->prepare('SELECT * FROM users WHERE email = ?');
        $s->execute([strtolower(trim($email))]);
        return $s->fetch() ?: null;
    }

    public function verify(string $email, string $password): ?array
    {
        $u = $this->findByEmail($email);
        return $u && password_verify($password, $u['password_hash']) ? $u : null;
    }

    /** What the React app is allowed to see about the logged-in user. */
    public static function public(?array $u): ?array
    {
        return $u ? ['id' => (int) $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'phone' => Util::phoneLocal($u['phone'])] : null;
    }
}
