<?php
require_once __DIR__ . '/common.php';

header('Content-Type: application/json');

try {
    // Verificar que sea administrador
    $datosUsuario = verificarAdmin();

    $metodo = $_SERVER['REQUEST_METHOD'];
    
    // Obtener datos según el método
    if ($metodo === 'POST') {
        $input = file_get_contents('php://input');
        $datos = json_decode($input, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $datos = [];
        }
    } else {
        $datos = $_GET;
    }
    
    $accion = $datos['accion'] ?? ($_GET['accion'] ?? '');

    error_log("Acción recibida en admin_verificaciones: " . $accion);

    switch ($accion) {
        case 'obtener_verificaciones_pendientes':
            obtenerVerificacionesPendientes();
            break;
        case 'obtener_todas_verificaciones':
            obtenerTodasLasVerificaciones();
            break;
            
        case 'aprobar_verificacion':
            aprobarVerificacion($datos);
            break;
            
        case 'rechazar_verificacion':
            rechazarVerificacion($datos);
            break;
            
        case 'obtener_detalle_verificacion':
            obtenerDetalleVerificacion($datos);
            break;
            
        default:
            echo json_encode(['exito' => false, 'error' => 'Acción no válida: ' . $accion]);
    }

} catch (Exception $e) {
    error_log("Error en admin_verificaciones: " . $e->getMessage());
    echo json_encode(['exito' => false, 'error' => 'Error interno del servidor: ' . $e->getMessage()]);
}

function obtenerVerificacionesPendientes() {
    $conexion = $GLOBALS['conexion'];
    
    error_log("Obteniendo verificaciones pendientes...");
    
    $sql = "SELECT vi.*, u.nombre, u.apellido, u.correo, p.foto_perfil
            FROM verificaciones_identidad vi
            JOIN usuarios u ON vi.usuario_id = u.id
            LEFT JOIN perfiles p ON u.id = p.usuario_id
            WHERE vi.estado = 'pendiente'
            ORDER BY vi.fecha_solicitud ASC";
    
    try {
        $stmt = $conexion->prepare($sql);
        $stmt->execute();
        
        $verificaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        error_log("Verificaciones encontradas: " . count($verificaciones));
        
        echo json_encode([
            'exito' => true,
            'verificaciones' => $verificaciones,
            'total' => count($verificaciones)
        ]);
        
    } catch (PDOException $e) {
        error_log("Error en consulta SQL: " . $e->getMessage());
        throw new Exception("Error en consulta: " . $e->getMessage());
    }
}

function obtenerTodasLasVerificaciones() {
    $conexion = $GLOBALS['conexion'];
    
    error_log("Obteniendo TODAS las verificaciones...");
    
    $sql = "SELECT vi.*, u.nombre, u.apellido, u.correo, p.foto_perfil
            FROM verificaciones_identidad vi
            JOIN usuarios u ON vi.usuario_id = u.id
            LEFT JOIN perfiles p ON u.id = p.usuario_id
            ORDER BY 
                CASE WHEN vi.estado = 'pendiente' THEN 1
                     WHEN vi.estado = 'verificado' THEN 2
                     WHEN vi.estado = 'rechazado' THEN 3
                     ELSE 4
                END,
                vi.fecha_solicitud DESC";
    
    try {
        $stmt = $conexion->prepare($sql);
        $stmt->execute();
        
        $verificaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        error_log("Total de verificaciones encontradas: " . count($verificaciones));
        
        // Contar por estado
        $pendientes = array_filter($verificaciones, function($v) {
            return $v['estado'] === 'pendiente';
        });
        
        $aprobadas = array_filter($verificaciones, function($v) {
            return $v['estado'] === 'verificado';
        });
        
        $rechazadas = array_filter($verificaciones, function($v) {
            return $v['estado'] === 'rechazado';
        });
        
        echo json_encode([
            'exito' => true,
            'verificaciones' => $verificaciones,
            'total' => count($verificaciones),
            'pendientes' => count($pendientes),
            'aprobadas' => count($aprobadas),
            'rechazadas' => count($rechazadas)
        ]);
        
    } catch (PDOException $e) {
        error_log("Error en consulta SQL: " . $e->getMessage());
        throw new Exception("Error en consulta: " . $e->getMessage());
    }
}


function aprobarVerificacion($datos) {
    if (empty($datos['verificacion_id'])) {
        echo json_encode(['exito' => false, 'error' => 'ID de verificación no especificado']);
        return;
    }
    
    $conexion = $GLOBALS['conexion'];
    
    try {
        $conexion->beginTransaction();
        
        // 1. Actualizar estado de la verificación a 'verificado'
        $sql = "UPDATE verificaciones_identidad 
                SET estado = 'verificado', fecha_revision = NOW() 
                WHERE id = ?";
        $stmt = $conexion->prepare($sql);
        $stmt->execute([$datos['verificacion_id']]);
        
        // 2. Obtener usuario_id para actualizar perfil
        $sqlUsuario = "SELECT usuario_id FROM verificaciones_identidad WHERE id = ?";
        $stmtUsuario = $conexion->prepare($sqlUsuario);
        $stmtUsuario->execute([$datos['verificacion_id']]);
        $verificacion = $stmtUsuario->fetch(PDO::FETCH_ASSOC);
        
        if (!$verificacion) {
            throw new Exception("Verificación no encontrada");
        }
        
        // 3. Actualizar estado en el perfil a 'verificado'
        $sqlPerfil = "UPDATE perfiles SET estado_verificacion = 'verificado' WHERE usuario_id = ?";
        $stmtPerfil = $conexion->prepare($sqlPerfil);
        $stmtPerfil->execute([$verificacion['usuario_id']]);
        
        // 4. Crear notificación para el usuario
        $sqlNotificacion = "INSERT INTO notificaciones (usuario_id, tipo, titulo, contenido) 
                           VALUES (?, 'sistema', 'Verificación aprobada', '¡Felicidades! Tu verificación de identidad ha sido aprobada.')";
        $stmtNotif = $conexion->prepare($sqlNotificacion);
        $stmtNotif->execute([$verificacion['usuario_id']]);
        
        $conexion->commit();
        
        echo json_encode([
            'exito' => true,
            'mensaje' => 'Verificación aprobada correctamente'
        ]);
        
    } catch (Exception $e) {
        $conexion->rollBack();
        throw $e;
    }
}

function rechazarVerificacion($datos) {
    if (empty($datos['verificacion_id'])) {
        echo json_encode(['exito' => false, 'error' => 'ID de verificación no especificado']);
        return;
    }
    
    $conexion = $GLOBALS['conexion'];
    $notas = $datos['notas_admin'] ?? 'Documentación insuficiente o ilegible';
    
    try {
        $conexion->beginTransaction();
        
        // 1. Actualizar estado de la verificación a 'rechazado'
        $sql = "UPDATE verificaciones_identidad 
                SET estado = 'rechazado', fecha_revision = NOW(), notas_admin = ?
                WHERE id = ?";
        $stmt = $conexion->prepare($sql);
        $stmt->execute([$notas, $datos['verificacion_id']]);
        
        // 2. Obtener usuario_id
        $sqlUsuario = "SELECT usuario_id FROM verificaciones_identidad WHERE id = ?";
        $stmtUsuario = $conexion->prepare($sqlUsuario);
        $stmtUsuario->execute([$datos['verificacion_id']]);
        $verificacion = $stmtUsuario->fetch(PDO::FETCH_ASSOC);
        
        if (!$verificacion) {
            throw new Exception("Verificación no encontrada");
        }
        
        // 3. Actualizar estado en el perfil a 'no_verificado' cuando se rechaza
        $sqlPerfil = "UPDATE perfiles SET estado_verificacion = 'no_verificado' WHERE usuario_id = ?";
        $stmtPerfil = $conexion->prepare($sqlPerfil);
        $stmtPerfil->execute([$verificacion['usuario_id']]);
        
        // 4. Crear notificación para el usuario
        $contenidoNotificacion = "Tu verificación ha sido rechazada. Motivo: " . $notas;
        $sqlNotificacion = "INSERT INTO notificaciones (usuario_id, tipo, titulo, contenido) 
                           VALUES (?, 'sistema', 'Verificación rechazada', ?)";
        $stmtNotif = $conexion->prepare($sqlNotificacion);
        $stmtNotif->execute([$verificacion['usuario_id'], $contenidoNotificacion]);
        
        $conexion->commit();
        
        echo json_encode([
            'exito' => true,
            'mensaje' => 'Verificación rechazada correctamente'
        ]);
        
    } catch (Exception $e) {
        $conexion->rollBack();
        throw $e;
    }
}

function obtenerDetalleVerificacion($datos) {
    if (empty($datos['verificacion_id'])) {
        echo json_encode(['exito' => false, 'error' => 'ID de verificación no especificado']);
        return;
    }
    
    $conexion = $GLOBALS['conexion'];
    
    $sql = "SELECT vi.*, u.nombre, u.apellido, u.correo, p.foto_perfil, p.biografia
            FROM verificaciones_identidad vi
            JOIN usuarios u ON vi.usuario_id = u.id
            LEFT JOIN perfiles p ON u.id = p.usuario_id
            WHERE vi.id = ?";
    
    try {
        $stmt = $conexion->prepare($sql);
        $stmt->execute([$datos['verificacion_id']]);
        $verificacion = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($verificacion) {
            echo json_encode([
                'exito' => true,
                'verificacion' => $verificacion
            ]);
        } else {
            echo json_encode([
                'exito' => false,
                'error' => 'Verificación no encontrada'
            ]);
        }
        
    } catch (PDOException $e) {
        throw new Exception("Error en consulta: " . $e->getMessage());
    }
}
?>