<?php
require_once __DIR__ . '/common.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $datos = json_decode(file_get_contents('php://input'), true);
    
    $nombre = trim($datos['nombre'] ?? '');
    $email = trim($datos['email'] ?? '');
    $mensaje = trim($datos['mensaje'] ?? '');
    
    // Validaciones básicas
    if (empty($nombre) || empty($email) || empty($mensaje)) {
        echo json_encode(['exito' => false, 'error' => 'Todos los campos son requeridos']);
        exit;
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['exito' => false, 'error' => 'Email inválido']);
        exit;
    }
    
    // Aquí iría el código para enviar el email
    // Por ahora simulamos el envío
    $destinatario = "info@viajerosperu.com";
    $asunto = "Nuevo mensaje de contacto - Viajeros Perú";
    $cuerpo = "
    Nombre: $nombre
    Email: $email
    Mensaje: $mensaje
    
    ---
    Enviado desde el formulario de contacto de Viajeros Perú
    ";
    
    // En un entorno real, usarías mail() o una librería de email
    // mail($destinatario, $asunto, $cuerpo);
    
    // Registrar en base de datos (opcional)
    try {
        $sql = "INSERT INTO mensajes_contacto (nombre, email, mensaje, fecha) VALUES (?, ?, ?, NOW())";
        $stmt = $GLOBALS['conexion']->prepare($sql);
        $stmt->execute([$nombre, $email, $mensaje]);
    } catch (Exception $e) {
        error_log("Error guardando mensaje de contacto: " . $e->getMessage());
    }
    
    echo json_encode(['exito' => true, 'mensaje' => 'Mensaje enviado correctamente']);
    exit;
}

echo json_encode(['exito' => false, 'error' => 'Método no permitido']);
?>