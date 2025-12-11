<?php
// common.php - encabezados CORS, inicialización de sesión y conexión a la BD
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');
header('Access-Control-Allow-Credentials: true');
// Headers adicionales para evitar bloqueos en shared hosting
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Iniciar sesión si no está iniciada (útil para APIs que usan $_SESSION)
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Ruta base al directorio backend/
$ruta_base = realpath(dirname(__FILE__) . '/../');

// Incluir configuración y conexión centralizada
require_once $ruta_base . '/configuracion.php';
require_once $ruta_base . '/base_datos/conexion.php';
require_once $ruta_base . '/helpers/jwt.php';

/**
 * Función compatible para obtener headers en todos los servidores
 * Reemplaza getallheaders() que no está disponible en algunos hosting
 */
function obtenerHeaders() {
    // Si getallheaders() existe, usarlo (normalmente en Apache)
    if (function_exists('getallheaders')) {
        return getallheaders();
    }
    
    // Alternativa para servidores que no tienen getallheaders() (como Nginx o algunos shared hosting)
    $headers = [];
    foreach ($_SERVER as $name => $value) {
        if (substr($name, 0, 5) == 'HTTP_') {
            // Convertir HTTP_AUTHORIZATION -> Authorization
            $headerName = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
            $headers[$headerName] = $value;
        }
    }
    
    // Headers adicionales que no empiezan con HTTP_
    if (isset($_SERVER['CONTENT_TYPE'])) {
        $headers['Content-Type'] = $_SERVER['CONTENT_TYPE'];
    }
    if (isset($_SERVER['CONTENT_LENGTH'])) {
        $headers['Content-Length'] = $_SERVER['CONTENT_LENGTH'];
    }
    
    return $headers;
}

// Función para verificar autenticación JWT
function verificarAutenticacion() {
    $headers = obtenerHeaders(); // ← USAR LA NUEVA FUNCIÓN
    $token = null;
    
    // Log para debugging
    error_log("[Auth] Headers recibidos: " . print_r($headers, true));
    
    // 1. Buscar Authorization header primero (puede venir en diferentes casos)
    $authHeader = '';
    foreach (['Authorization', 'authorization', 'AUTHORIZATION'] as $key) {
        if (isset($headers[$key])) {
            $authHeader = $headers[$key];
            break;
        }
    }
    
    if (!empty($authHeader)) {
        $token = str_replace('Bearer ', '', $authHeader);
        error_log("[Auth] Token del header Authorization");
    }
    
    // 2. Si no hay header, buscar en query string (GET)
    if (empty($token) && isset($_GET['token'])) {
        $token = $_GET['token'];
        error_log("[Auth] Token del query string (GET)");
    }

    // 3. Si sigue sin haber token, buscar en body (POST form-data o x-www-form-urlencoded)
    if (empty($token) && isset($_POST['token'])) {
        $token = $_POST['token'];
        error_log("[Auth] Token desde \\$_POST (form-data)");
    }

    // 4. Si sigue sin haber token, buscar en body JSON (POST raw)
    if (empty($token)) {
        $input = file_get_contents('php://input');
        if (!empty($input)) {
            $datosBody = json_decode($input, true);
            if (isset($datosBody['token'])) {
                $token = $datosBody['token'];
                error_log("[Auth] Token del body JSON (POST)");
            }
        }
    }
    
    if (empty($token)) {
        http_response_code(401);
        echo json_encode(['exito' => false, 'error' => 'Token no proporcionado']);
        exit;
    }

    error_log("[Auth] Token recibido: " . substr($token, 0, 20) . "..."); // Log parcial por seguridad
    
    // CORRECCIÓN: Usar validarToken() en lugar de decodificar()
    $datos = JWT::validarToken($token);
    
    if (!$datos) {
        http_response_code(401);
        echo json_encode(['exito' => false, 'error' => 'Token inválido o expirado']);
        exit;
    }
    
    error_log("[Auth] Usuario autenticado: " . ($datos['usuario_id'] ?? 'desconocido') . " - " . ($datos['correo'] ?? 'sin email'));
    return (object)$datos; // Convertir a objeto para compatibilidad
}

// Función para verificar autenticación JWT y rol de administrador
function verificarAdmin() {
    $usuario = verificarAutenticacion();
    
    if ($usuario->rol !== 'administrador') {
        http_response_code(403);
        echo json_encode(['exito' => false, 'error' => 'No autorizado. Se requiere rol de administrador']);
        exit;
    }
    
    return $usuario;
}

// Función para manejar errores de base de datos
function manejarErrorDB($error) {
    error_log("Error de base de datos: " . $error);
    return ['exito' => false, 'error' => 'Error interno del servidor'];
}

// Función para validar datos de entrada
function validarDatos($datos, $camposRequeridos) {
    foreach ($camposRequeridos as $campo) {
        if (!isset($datos[$campo]) || empty(trim($datos[$campo]))) {
            return ['exito' => false, 'error' => "Campo requerido faltante: $campo"];
        }
    }
    return ['exito' => true];
}

// Función para sanitizar datos
function sanitizar($dato) {
    if (is_array($dato)) {
        return array_map('sanitizar', $dato);
    }
    return htmlspecialchars(trim($dato), ENT_QUOTES, 'UTF-8');
}

// Función para respuesta JSON estándar
function responderJSON($datos) {
    header('Content-Type: application/json');
    echo json_encode($datos);
    exit;
}

// Ahora $GLOBALS['conexion'] debe estar disponible (establecido por conexion.php)
?>