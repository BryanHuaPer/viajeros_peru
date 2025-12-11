<?php
// Script de prueba rápido para verificar la conexión a la BD desde CLI
// Enviar cabecera antes de incluir archivos que podrían enviar salida
if (!headers_sent()) {
    header('Content-Type: application/json');
}
require_once __DIR__ . '/base_datos/conexion.php';

if (isset($conexion) && $conexion instanceof PDO) {
    echo json_encode(['exito' => true, 'mensaje' => 'Conexión a BD establecida', 'driver' => $conexion->getAttribute(PDO::ATTR_DRIVER_NAME)]);
    exit(0);
} else {
    echo json_encode(['exito' => false, 'mensaje' => 'No se pudo establecer conexión', 'conexion_variable' => isset($conexion)]);
    exit(1);
}
?>