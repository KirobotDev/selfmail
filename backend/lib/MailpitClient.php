<?php
class MailpitClient
{
    private string $baseUrl;

    public function __construct(string $baseUrl)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
    }


    public function getMessages(string $email): array
    {
        $response = $this->request('GET', "/api/v1/messages?query=" . urlencode("to:{$email}") . "&limit=50");
        if (!$response || !isset($response['messages'])) {
            return [];
        }

        return array_map(function ($msg) {
            return [
                'id' => $msg['ID'],
                'subject' => $msg['Subject'] ?? '(Sans objet)',
                'from' => $this->formatAddress($msg['From'] ?? []),
                'date' => $msg['Date'] ?? '',
                'read' => $msg['Read'] ?? false,
                'size' => $msg['Size'] ?? 0,
            ];
        }, $response['messages']);
    }

    public function getMessage(string $id): ?array
    {
        $response = $this->request('GET', "/api/v1/message/{$id}");
        if (!$response)
            return null;

        $html = null;
        $text = null;

        if (!empty($response['HTML'])) {
            $html = $response['HTML'];
        }
        if (!empty($response['Text'])) {
            $text = $response['Text'];
        }

        return [
            'id' => $response['ID'],
            'subject' => $response['Subject'] ?? '(Sans objet)',
            'from' => $this->formatAddress($response['From'] ?? []),
            'to' => array_map([$this, 'formatAddress'], $response['To'] ?? []),
            'date' => $response['Date'] ?? '',
            'html' => $html,
            'text' => $text,
            'attachments' => count($response['Attachments'] ?? []),
        ];
    }

    public function deleteMessage(string $id): bool
    {
        $result = $this->request('DELETE', '/api/v1/messages', ['IDs' => [$id]]);
        return $result !== null;
    }

    public function deleteMessagesByEmail(string $email): int
    {
        $response = $this->request('GET', "/api/v1/messages?query=" . urlencode("to:{$email}") . "&limit=100");
        if (!$response || empty($response['messages'])) {
            return 0;
        }

        $ids = array_column($response['messages'], 'ID');

        if (empty($ids))
            return 0;

        $this->request('DELETE', '/api/v1/messages', ['IDs' => $ids]);

        return count($ids);
    }

    private function request(string $method, string $endpoint, ?array $body = null): ?array
    {
        $url = $this->baseUrl . $endpoint;
        $ch = curl_init($url);

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        ]);

        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($result === false || $httpCode >= 500) {
            return null;
        }

        if (function_exists('mb_convert_encoding')) {
            $result = mb_convert_encoding($result, 'UTF-8', 'UTF-8');
        }

        return json_decode($result, true) ?: null;
    }

    private function formatAddress(array $addr): string
    {
        if (empty($addr))
            return 'Inconnu';
        $name = $addr['Name'] ?? '';
        $address = $addr['Address'] ?? '';
        return $name ? "{$name} <{$address}>" : $address;
    }
}
