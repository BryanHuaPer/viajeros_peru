<?php
$url = 'http://localhost/proyectoWeb/viajeros_peru/backend/api/autenticacion.php';
$payload = json_encode(['accion' => 'login', 'correo' => 'admin@viajerosperu.com', 'contrasena' => 'password']);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

$response = curl_exec($ch);
$err = curl_error($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP_CODE: $code\n";
if ($err) {
    echo "CURL_ERR: $err\n";
}

echo "RESPONSE:\n" . $response . "\n";
?>