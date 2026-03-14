<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once __DIR__ . '/lib/MailpitClient.php';
require_once __DIR__ . '/lib/RateLimiter.php';
require_once __DIR__ . '/lib/Session.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Token');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$rateLimiter = new RateLimiter(
    (int) getenv('RATE_LIMIT_MAX') ?: 20,
    (int) getenv('RATE_LIMIT_WINDOW') ?: 60
);

$clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$clientIp = explode(',', $clientIp)[0];

if (!$rateLimiter->check($clientIp)) {
    http_response_code(429);
    echo json_encode(['error' => 'Trop de requêtes. Réessayez dans une minute.']);
    exit;
}

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$method = $_SERVER['REQUEST_METHOD'];

$path = parse_url($uri, PHP_URL_PATH);
$path = preg_replace('#^/api#', '', $path);
$path = rtrim($path, '/');

$mailpit = new MailpitClient(getenv('MAILPIT_API_URL') ?: 'http://mailpit:8025');
$session = new Session(getenv('MAIL_DOMAIN') ?: 'tempmail.local', getenv('HMAC_SECRET') ?: 'secret');

if ($method === 'GET' && $path === '/mailbox/generate') {
    $email = $session->generateEmail();
    $token = $session->createToken($email);
    echo json_encode([
        'success' => true,
        'email' => $email,
        'token' => $token,
        'expires' => time() + 3600,
    ]);
    exit;
}

if ($method === 'GET' && $path === '/mailbox/emails') {
    $token = $_GET['token'] ?? $_SERVER['HTTP_X_TOKEN'] ?? '';
    $email = $session->validateToken($token);

    if (!$email) {
        http_response_code(401);
        echo json_encode(['error' => 'Token invalide ou expiré.']);
        exit;
    }

    $messages = $mailpit->getMessages($email);
    echo json_encode(['success' => true, 'emails' => $messages, 'email' => $email]);
    exit;
}

if ($method === 'GET' && preg_match('#^/mailbox/email/([a-zA-Z0-9\-]+)$#', $path, $m)) {
    $token = $_GET['token'] ?? $_SERVER['HTTP_X_TOKEN'] ?? '';
    $email = $session->validateToken($token);

    if (!$email) {
        http_response_code(401);
        echo json_encode(['error' => 'Token invalide ou expiré.']);
        exit;
    }

    $message = $mailpit->getMessage($m[1]);

    if (!$message) {
        http_response_code(404);
        echo json_encode(['error' => 'Email non trouvé.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => $message]);
    exit;
}

if ($method === 'DELETE' && $path === '/mailbox/delete') {
    $input = json_decode(file_get_contents('php://input'), true);
    $token = $input['token'] ?? $_GET['token'] ?? $_SERVER['HTTP_X_TOKEN'] ?? '';
    $email = $session->validateToken($token);

    if (!$email) {
        http_response_code(401);
        echo json_encode(['error' => 'Token invalide ou expiré.']);
        exit;
    }

    $deleted = $mailpit->deleteMessagesByEmail($email);
    echo json_encode(['success' => true, 'deleted' => $deleted]);
    exit;
}

if ($method === 'DELETE' && preg_match('#^/mailbox/email/([a-zA-Z0-9\-]+)$#', $path, $m)) {
    $input = json_decode(file_get_contents('php://input'), true);
    $token = $input['token'] ?? $_GET['token'] ?? $_SERVER['HTTP_X_TOKEN'] ?? '';
    $email = $session->validateToken($token);

    if (!$email) {
        http_response_code(401);
        echo json_encode(['error' => 'Token invalide ou expiré.']);
        exit;
    }

    $ok = $mailpit->deleteMessage($m[1]);
    echo json_encode(['success' => $ok]);
    exit;
}

http_response_code(404);
echo json_encode(['error' => 'Route non trouvée: ' . $path]);
