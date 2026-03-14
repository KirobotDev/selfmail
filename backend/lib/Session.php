<?php
class Session
{
    private string $domain;
    private string $secret;
    private int $ttl = 3600;

    private array $adjectives = [
        'swift', 'cool', 'dark', 'brave', 'silent', 'rapid', 'calm', 'lucky',
        'smart', 'wild', 'fresh', 'bright', 'light', 'quick', 'super', 'ultra',
        'mega', 'hyper', 'turbo', 'cyber', 'pixel', 'neon', 'iron', 'steel',
    ];

    private array $nouns = [
        'fox', 'wolf', 'bear', 'hawk', 'tiger', 'eagle', 'shark', 'panda',
        'ninja', 'comet', 'storm', 'ghost', 'blade', 'flash', 'spark', 'wave',
        'cloud', 'river', 'stone', 'flame', 'frost', 'night', 'dawn', 'dusk',
    ];

    public function __construct(string $domain, string $secret)
    {
        $this->domain = $domain;
        $this->secret = $secret;
    }

    public function generateEmail(): string
    {
        $adj = $this->adjectives[array_rand($this->adjectives)];
        $noun = $this->nouns[array_rand($this->nouns)];
        $number = random_int(100, 9999);
        return "{$adj}.{$noun}{$number}@{$this->domain}";
    }

    public function createToken(string $email): string
    {
        $timestamp = time();
        $emailB64 = base64_encode($email);
        $hmac = $this->sign("{$email}:{$timestamp}");
        return "{$emailB64}:{$timestamp}:{$hmac}";
    }

    public function validateToken(string $token): ?string
    {
        if (empty($token))
            return null;

        $parts = explode(':', $token);
        if (count($parts) !== 3)
            return null;

        [$emailB64, $timestamp, $hmac] = $parts;

        if ((time() - (int) $timestamp) > $this->ttl) {
            return null;
        }

        $email = base64_decode($emailB64);
        $expected = $this->sign("{$email}:{$timestamp}");

        if (!hash_equals($expected, $hmac)) {
            return null;
        }

        return $email;
    }

    private function sign(string $data): string
    {
        return hash_hmac('sha256', $data, $this->secret);
    }
}