<?php
// Responder INMEDIATAMENTE a OPTIONS para evitar bloqueos WAF
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');
    http_response_code(200);
    exit(0);
}

require_once __DIR__ . '/common.php';

try {
    // Verificar autenticación con fallback para InfinityFree
    // Primero intentar con header Authorization
    $headers = obtenerHeaders();
    $authHeader = '';
    
    foreach (['Authorization', 'authorization', 'AUTHORIZATION'] as $key) {
        if (isset($headers[$key])) {
            $authHeader = $headers[$key];
            break;
        }
    }
    
    $token = null;
    $tokenSource = 'none';
    
    // 1. Intentar desde header Authorization
    if (!empty($authHeader)) {
        $token = str_replace('Bearer ', '', $authHeader);
        $tokenSource = 'header';
    }
    
    // 2. Si no hay header, buscar en query string (GET)
    if (empty($token) && isset($_GET['token'])) {
        $token = $_GET['token'];
        $tokenSource = 'query';
    }
    
    // 3. Si sigue sin haber token, buscar en body (POST)
    if (empty($token)) {
        $input = file_get_contents('php://input');
        if (!empty($input)) {
            $datosBody = json_decode($input, true);
            if (isset($datosBody['token'])) {
                $token = $datosBody['token'];
                $tokenSource = 'body_json';
            }
        }
    }
    
    // 4. También verificar en $_POST para form-data
    if (empty($token) && isset($_POST['token'])) {
        $token = $_POST['token'];
        $tokenSource = 'post_form';
    }
    
    error_log("📢 Notificaciones - Token recibido desde: $tokenSource");
    
    if (empty($token)) {
        http_response_code(401);
        echo json_encode(['exito' => false, 'error' => 'Token no proporcionado']);
        exit;
    }
    
    // Validar el token
    $datosToken = JWT::validarToken($token);
    if (!$datosToken) {
        http_response_code(401);
        echo json_encode(['exito' => false, 'error' => 'Token inválido o expirado']);
        exit;
    }
    
    $usuario = (object)$datosToken;
    $usuarioId = $usuario->usuario_id;
    
    // Obtener acción
    $datos = [];
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = file_get_contents('php://input');
        if (!empty($input)) {
            $datos = json_decode($input, true);
        }
    } else {
        $datos = $_GET;
    }
    
    $accion = $datos['accion'] ?? '';
    
    error_log("📢 Notificaciones API - Usuario: $usuarioId, Acción: $accion, Token desde: $tokenSource");
    
    switch ($accion) {
        case 'obtener_no_vistas':
            obtenerNotificacionesNoVistas($usuarioId);
            break;
        
        case 'obtener_todas':
            obtenerTodasNotificaciones($usuarioId, $datos);
            break;
        
        case 'marcar_como_visto':
            marcarComoVisto($usuarioId, $datos);
            break;
        
        case 'marcar_multiples_visto':
            marcarMultiplesVisto($usuarioId, $datos);
            break;
        
        case 'contar_no_vistas':
            contarNoVistas($usuarioId);
            break;
        
        default:
            http_response_code(400);
            echo json_encode([
                'exito' => false,
                'error' => 'Acción no especificada o no válida',
                'acciones_validas' => [
                    'obtener_no_vistas',
                    'obtener_todas',
                    'marcar_como_visto',
                    'marcar_multiples_visto',
                    'contar_no_vistas'
                ]
            ]);
    }
    
} catch (Exception $e) {
    error_log("❌ Error en notificaciones.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'exito' => false,
        'error' => 'Error interno del servidor',
        'debug' => $e->getMessage()
    ]);
}

/**
 * Obtener las 5 notificaciones no vistas más recientes
 */
function obtenerNotificacionesNoVistas($usuarioId) {
    global $GLOBALS;
    
    try {
        $sql = "SELECT id, usuario_id, tipo, titulo, contenido, enlace, leido, fecha_creacion
                FROM notificaciones
                WHERE usuario_id = ? AND leido = 0
                ORDER BY fecha_creacion DESC
                LIMIT 5";
        
        $stmt = $GLOBALS['conexion']->prepare($sql);
        $stmt->execute([$usuarioId]);
        
        $notificaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        error_log("📢 Notificaciones no vistas: " . count($notificaciones));
        
        echo json_encode([
            'exito' => true,
            'notificaciones' => $notificaciones,
            'total' => count($notificaciones)
        ]);
        
    } catch (PDOException $e) {
        error_log("❌ Error al obtener notificaciones no vistas: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'exito' => false,
            'error' => 'Error al obtener notificaciones'
        ]);
    }
}

/**
 * Obtener todas las notificaciones del usuario (con paginación opcional)
 */
function obtenerTodasNotificaciones($usuarioId, $datos) {
    global $GLOBALS;
    
    try {
        $pagina = intval($datos['pagina'] ?? 1);
        $limite = intval($datos['limite'] ?? 20);
        $offset = ($pagina - 1) * $limite;
        
        // Obtener notificaciones
        $sql = "SELECT id, usuario_id, tipo, titulo, contenido, enlace, leido, fecha_creacion
                FROM notificaciones
                WHERE usuario_id = ?
                ORDER BY fecha_creacion DESC
                LIMIT ? OFFSET ?";
        
        $stmt = $GLOBALS['conexion']->prepare($sql);
        $stmt->execute([$usuarioId, $limite, $offset]);
        $notificaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Obtener total
        $sqlTotal = "SELECT COUNT(*) as total FROM notificaciones WHERE usuario_id = ?";
        $stmtTotal = $GLOBALS['conexion']->prepare($sqlTotal);
        $stmtTotal->execute([$usuarioId]);
        $resultTotal = $stmtTotal->fetch(PDO::FETCH_ASSOC);
        $total = $resultTotal['total'] ?? 0;
        
        error_log("📢 Obtenidas " . count($notificaciones) . " notificaciones de $total total");
        
        echo json_encode([
            'exito' => true,
            'notificaciones' => $notificaciones,
            'total' => $total,
            'pagina' => $pagina,
            'limite' => $limite,
            'total_paginas' => ceil($total / $limite)
        ]);
        
    } catch (PDOException $e) {
        error_log("❌ Error al obtener todas las notificaciones: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'exito' => false,
            'error' => 'Error al obtener notificaciones'
        ]);
    }
}

/**
 * Marcar una notificación como visto
 */
function marcarComoVisto($usuarioId, $datos) {
    global $GLOBALS;
    
    try {
        if (empty($datos['notificacion_id'])) {
            http_response_code(400);
            echo json_encode(['exito' => false, 'error' => 'ID de notificación requerido']);
            return;
        }
        
        $notificacionId = intval($datos['notificacion_id']);
        
        $sql = "UPDATE notificaciones SET leido = 1 WHERE id = ? AND usuario_id = ?";
        $stmt = $GLOBALS['conexion']->prepare($sql);
        $stmt->execute([$notificacionId, $usuarioId]);
        
        error_log("📢 Notificación $notificacionId marcada como visto");
        
        echo json_encode([
            'exito' => true,
            'mensaje' => 'Notificación marcada como visto'
        ]);
        
    } catch (PDOException $e) {
        error_log("❌ Error al marcar como visto: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'exito' => false,
            'error' => 'Error al actualizar notificación'
        ]);
    }
}

/**
 * Marcar múltiples notificaciones como visto
 */
function marcarMultiplesVisto($usuarioId, $datos) {
    global $GLOBALS;
    
    try {
        if (empty($datos['notificacion_ids']) || !is_array($datos['notificacion_ids'])) {
            http_response_code(400);
            echo json_encode(['exito' => false, 'error' => 'Array de IDs de notificaciones requerido']);
            return;
        }
        
        $ids = $datos['notificacion_ids'];
        
        // Validar y sanear IDs
        $ids = array_filter(array_map('intval', $ids));
        
        if (empty($ids)) {
            http_response_code(400);
            echo json_encode(['exito' => false, 'error' => 'IDs inválidos']);
            return;
        }
        
        // Crear placeholders para la consulta
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $params = array_merge([$usuarioId], $ids);
        
        $sql = "UPDATE notificaciones SET leido = 1 WHERE usuario_id = ? AND id IN ($placeholders)";
        $stmt = $GLOBALS['conexion']->prepare($sql);
        $stmt->execute($params);
        
        $afectadas = $stmt->rowCount();
        error_log("📢 $afectadas notificaciones marcadas como visto");
        
        echo json_encode([
            'exito' => true,
            'mensaje' => "$afectadas notificaciones marcadas como visto",
            'afectadas' => $afectadas
        ]);
        
    } catch (PDOException $e) {
        error_log("❌ Error al marcar múltiples como visto: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'exito' => false,
            'error' => 'Error al actualizar notificaciones'
        ]);
    }
}

/**
 * Contar notificaciones no vistas
 */
function contarNoVistas($usuarioId) {
    global $GLOBALS;
    
    try {
        $sql = "SELECT COUNT(*) as total FROM notificaciones WHERE usuario_id = ? AND leido = 0";
        $stmt = $GLOBALS['conexion']->prepare($sql);
        $stmt->execute([$usuarioId]);
        
        $resultado = $stmt->fetch(PDO::FETCH_ASSOC);
        $total = $resultado['total'] ?? 0;
        
        // Mostrar +5 si hay más de 5
        $mostrar = $total > 5 ? '+5' : $total;
        
        error_log("📢 Total no vistas: $total");
        
        echo json_encode([
            'exito' => true,
            'total' => $total,
            'mostrar' => $mostrar
        ]);
        
    } catch (PDOException $e) {
        error_log("❌ Error al contar no vistas: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'exito' => false,
            'error' => 'Error al contar notificaciones'
        ]);
    }
}
?>
