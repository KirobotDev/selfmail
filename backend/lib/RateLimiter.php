<?php
/**
 * Simple IP-based Rate Limiter using filesystem
 */
class RateLimiter
{
    private int    $maxRequests;
    private int    $windowSeconds;
    private string $storageDir;

    public function __construct(int $maxRequests = 20, int $windowSeconds = 60)
    {
        $this->maxRequests   = $maxRequests;
        $this->windowSeconds = $windowSeconds;
        $this->storageDir    = '/tmp/ratelimit';

        if (!is_dir($this->storageDir)) {
            mkdir($this->storageDir, 0777, true);
        }
    }

    /**
     * Returns true if request is allowed, false if rate limited
     */
    public function check(string $ip): bool
    {
        $key  = $this->storageDir . '/' . md5($ip) . '.json';
        $now  = time();
        $data = ['requests' => [], 'blocked_until' => 0];

        if (file_exists($key)) {
            $raw = file_get_contents($key);
            if ($raw) {
                $data = json_decode($raw, true) ?? $data;
            }
        }

        // Remove old requests outside the window
        $data['requests'] = array_filter(
            $data['requests'],
            fn($t) => ($now - $t) < $this->windowSeconds
        );

        if (count($data['requests']) >= $this->maxRequests) {
            file_put_contents($key, json_encode($data));
            return false;
        }

        $data['requests'][] = $now;
        file_put_contents($key, json_encode($data));

        // Cleanup old files occasionally
        if (rand(1, 50) === 1) {
            $this->cleanup();
        }

        return true;
    }

    private function cleanup(): void
    {
        $files = glob($this->storageDir . '/*.json');
        $now   = time();
        foreach ($files as $file) {
            if (($now - filemtime($file)) > $this->windowSeconds * 2) {
                @unlink($file);
            }
        }
    }
}
