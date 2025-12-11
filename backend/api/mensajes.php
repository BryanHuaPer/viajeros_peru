<?php
require_once __DIR__ . '/common.php';
require_once $ruta_base . '/../app/modelos/Mensaje.php';

// ============ NUEVO: FUNCIÓN PARA VERIFICAR TOKEN EN MENSAJES ============
function verificarTokenMensajes() {
    $headers = obtenerHeaders();
    $token = null;
    $tokenSource = 'none';
    
    // 1. Intentar desde header Authorization
    $authHeader = '';
    foreach (['Authorization', 'authorization', 'AUTHORIZATION'] as $key) {
        if (isset($headers[$key])) {
            $authHeader = $headers[$key];
            break;
        }
    }
    
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
    
    error_log("📨 Mensajes - Token recibido desde: $tokenSource");
    
    if (empty($token)) {
        return ['exito' => false, 'error' => 'Token no proporcionado'];
    }
    
    // Validar el token
    $datosToken = JWT::validarToken($token);
    if (!$datosToken) {
        return ['exito' => false, 'error' => 'Token inválido o expirado'];
    }
    
    return ['exito' => true, 'usuario' => (object)$datosToken];
}
// ============ FIN NUEVO CÓDIGO ============

try {
    // TEMPORAL: Debugging - Activar solo para depuración
    error_log("=== MENSAJES.PHP INICIO ===");
    error_log("Método: " . $_SERVER['REQUEST_METHOD']);
    
    $datos = [];
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $datos_json = file_get_contents('php://input');
        if (!empty($datos_json)) {
            $datos = json_decode($datos_json, true);
            error_log("POST Body JSON: " . substr($datos_json, 0, 500));
        } else {
            // También verificar datos POST normales
            $datos = $_POST;
            error_log("POST Form: " . print_r($_POST, true));
        }
    } else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $datos = $_GET;
        error_log("GET: " . print_r($_GET, true));
    }

    $accion = $datos['accion'] ?? '';
    error_log("Acción solicitada: " . $accion);

    // ============ NUEVO: VERIFICAR AUTENTICACIÓN SEGÚN ACCIÓN ============
    $usuarioAutenticado = null;
    
    // Acciones que NO requieren autenticación
    $accionesSinAuth = ['obtener_conversacion']; // Conversaciones son públicas entre usuarios
    
    // Acciones que SÍ requieren autenticación
    $accionesConAuth = [
        'enviar', 'obtener_chats', 'marcar_leidos', 'obtener_no_leidos',
        'verificar_bloqueo', 'bloquear_usuario', 'reportar_mensaje',
        'desbloquear_usuario', 'obtener_estado_mensaje', 'marcar_visto',
        'marcar_conversacion_vista', 'obtener_estados_mensajes'
    ];
    
    // Si la acción requiere autenticación, verificar token
    if (in_array($accion, $accionesConAuth)) {
        $verificacion = verificarTokenMensajes();
        if (!$verificacion['exito']) {
            http_response_code(401);
            echo json_encode($verificacion);
            exit;
        }
        $usuarioAutenticado = $verificacion['usuario'];
        error_log("📨 Mensajes - Usuario autenticado: " . ($usuarioAutenticado->usuario_id ?? 'desconocido') . 
                 " - Email: " . ($usuarioAutenticado->correo ?? 'sin email'));
    } else if (in_array($accion, $accionesSinAuth)) {
        // Acciones sin autenticación - solo log
        error_log("📨 Mensajes - Acción sin autenticación: $accion");
    } else {
        // Acción desconocida - requerir autenticación por defecto
        error_log("📨 Mensajes - Acción desconocida, verificando autenticación: $accion");
        $verificacion = verificarTokenMensajes();
        if (!$verificacion['exito']) {
            http_response_code(401);
            echo json_encode($verificacion);
            exit;
        }
        $usuarioAutenticado = $verificacion['usuario'];
    }
    // ============ FIN VERIFICACIÓN ============
    
    $mensajeModel = new Mensaje($GLOBALS['conexion']);

    switch ($accion) {
        case 'enviar':
            if (empty($datos['remitente_id']) || empty($datos['destinatario_id']) || empty($datos['contenido'])) {
                echo json_encode(['exito' => false, 'error' => 'Datos incompletos para enviar mensaje']);
                return;
            }
            
            // Verificar que el usuario autenticado coincide con remitente_id
            if ($usuarioAutenticado && $usuarioAutenticado->usuario_id != $datos['remitente_id']) {
                error_log("❌ Error: Usuario autenticado " . $usuarioAutenticado->usuario_id . 
                         " no coincide con remitente_id " . $datos['remitente_id']);
                echo json_encode(['exito' => false, 'error' => 'No autorizado para enviar este mensaje']);
                return;
            }
            
            $resultado = $mensajeModel->enviar($datos);
            echo json_encode($resultado);
            break;
        
        case 'obtener_conversacion':
            if (empty($datos['usuario1']) || empty($datos['usuario2'])) {
                echo json_encode(['exito' => false, 'error' => 'IDs de usuarios no especificados']);
                return;
            }
            
            // Convertir "null" string a null real
            $anuncioId = $datos['anuncio_id'] ?? null;
            if ($anuncioId === 'null' || $anuncioId === '') {
                $anuncioId = null;
            }
            
            $pagina = $datos['pagina'] ?? 1;
            $limite = $datos['limite'] ?? 20;
            $solo_recientes = isset($datos['solo_recientes']) && $datos['solo_recientes'] === 'true';
            $solo_nuevos = isset($datos['solo_nuevos']) && $datos['solo_nuevos'] === 'true';
            
            error_log("📨 Obteniendo conversación: usuario1={$datos['usuario1']}, usuario2={$datos['usuario2']}, anuncio_id=" . ($anuncioId ?? 'null'));
            
            $conversacion = $mensajeModel->obtenerConversacion(
                $datos['usuario1'], 
                $datos['usuario2'], 
                $anuncioId,
                $pagina,
                $limite,
                $solo_recientes,
                $solo_nuevos
            );
            echo json_encode(['exito' => true, 'data' => $conversacion]);
            break;
        
        case 'obtener_chats':
            if (empty($datos['usuario_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de usuario no especificado']);
                return;
            }
            
            // Verificar que el usuario autenticado coincide con usuario_id
            if ($usuarioAutenticado && $usuarioAutenticado->usuario_id != $datos['usuario_id']) {
                error_log("❌ Error: Usuario autenticado " . $usuarioAutenticado->usuario_id . 
                         " no coincide con usuario_id " . $datos['usuario_id']);
                echo json_encode(['exito' => false, 'error' => 'No autorizado para ver estos chats']);
                return;
            }
            
            error_log("📨 Obteniendo chats para usuario: " . $datos['usuario_id']);
            
            $chats = $mensajeModel->obtenerChats($datos['usuario_id']);
            echo json_encode(['exito' => true, 'chats' => $chats]);
            break;
        
        case 'marcar_leidos':
            if (empty($datos['remitente_id']) || empty($datos['destinatario_id'])) {
                echo json_encode(['exito' => false, 'error' => 'IDs de usuarios no especificados']);
                return;
            }
            
            $anuncioId = $datos['anuncio_id'] ?? null;
            if ($anuncioId === 'null' || $anuncioId === '') {
                $anuncioId = null;
            }

            // Verificar que el usuario autenticado es el destinatario
            if ($usuarioAutenticado && $usuarioAutenticado->usuario_id != $datos['destinatario_id']) {
                error_log("❌ Error: Usuario autenticado " . $usuarioAutenticado->usuario_id . 
                         " no es el destinatario " . $datos['destinatario_id']);
                echo json_encode(['exito' => false, 'error' => 'No autorizado para marcar estos mensajes como leídos']);
                return;
            }
            
            error_log("📨 Marcando como leídos: remitente={$datos['remitente_id']}, destinatario={$datos['destinatario_id']}, anuncio_id=" . ($anuncioId ?? 'null'));
            
            $resultado = $mensajeModel->marcarLeidos($datos['remitente_id'], $datos['destinatario_id'], $anuncioId);
            echo json_encode($resultado);
            break;
        
        case 'obtener_no_leidos':
            if (empty($datos['usuario_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de usuario no especificado']);
                return;
            }
            
            // Verificar que el usuario autenticado coincide
            if ($usuarioAutenticado && $usuarioAutenticado->usuario_id != $datos['usuario_id']) {
                echo json_encode(['exito' => false, 'error' => 'No autorizado']);
                return;
            }
            
            $totalNoLeidos = $mensajeModel->obtenerTotalNoLeidos($datos['usuario_id']);
            echo json_encode(['exito' => true, 'total_no_leidos' => $totalNoLeidos]);
            break;
        
        case 'verificar_bloqueo':
            if (empty($datos['usuario1']) || empty($datos['usuario2'])) {
                echo json_encode(['exito' => false, 'error' => 'IDs de usuarios no especificados']);
                return;
            }

            // Verificar que el usuario autenticado es uno de los dos usuarios
            if ($usuarioAutenticado && 
                $usuarioAutenticado->usuario_id != $datos['usuario1'] && 
                $usuarioAutenticado->usuario_id != $datos['usuario2']) {
                echo json_encode(['exito' => false, 'error' => 'No autorizado para verificar este bloqueo']);
                return;
            }

            error_log("📨 Verificando bloqueo: usuario1={$datos['usuario1']}, usuario2={$datos['usuario2']}");
            
            // Devolver detalle: si está bloqueado y quién fue el bloqueador
            $detalle = $mensajeModel->obtenerDetalleBloqueo($datos['usuario1'], $datos['usuario2']);
            echo json_encode(array_merge(['exito' => true], $detalle));
            break;
        
        case 'bloquear_usuario':
            if (empty($datos['usuario_bloqueador_id']) || empty($datos['usuario_bloqueado_id'])) {
                echo json_encode(['exito' => false, 'error' => 'IDs de usuarios no especificados']);
                return;
            }
            
            // Verificar que el usuario autenticado es el bloqueador
            if ($usuarioAutenticado && $usuarioAutenticado->usuario_id != $datos['usuario_bloqueador_id']) {
                echo json_encode(['exito' => false, 'error' => 'No autorizado para bloquear a este usuario']);
                return;
            }
            
            error_log("📨 Bloqueando usuario: bloqueador={$datos['usuario_bloqueador_id']}, bloqueado={$datos['usuario_bloqueado_id']}");
            
            $resultado = $mensajeModel->bloquearUsuario($datos['usuario_bloqueador_id'], $datos['usuario_bloqueado_id']);
            echo json_encode($resultado);
            break;
        
        case 'reportar_mensaje':
            if (empty($datos['usuario_reportador_id']) || empty($datos['mensaje_id']) || empty($datos['motivo'])) {
                echo json_encode(['exito' => false, 'error' => 'Datos incompletos para reportar']);
                return;
            }
            
            // Verificar que el usuario autenticado es el reportador
            if ($usuarioAutenticado && $usuarioAutenticado->usuario_id != $datos['usuario_reportador_id']) {
                echo json_encode(['exito' => false, 'error' => 'No autorizado para reportar este mensaje']);
                return;
            }
            
            error_log("📨 Reportando mensaje: reportador={$datos['usuario_reportador_id']}, mensaje_id={$datos['mensaje_id']}");
            
            $resultado = $mensajeModel->reportarMensaje($datos['usuario_reportador_id'], $datos['mensaje_id'], $datos['motivo']);
            echo json_encode($resultado);
            break;
            
        case 'desbloquear_usuario':
            if (empty($datos['usuario_bloqueador_id']) || empty($datos['usuario_bloqueado_id'])) {
                echo json_encode(['exito' => false, 'error' => 'IDs de usuarios no especificados']);
                return;
            }
            
            // Verificar que el usuario autenticado es el que originalmente bloqueó
            if ($usuarioAutenticado && $usuarioAutenticado->usuario_id != $datos['usuario_bloqueador_id']) {
                echo json_encode(['exito' => false, 'error' => 'No autorizado para desbloquear a este usuario']);
                return;
            }
            
            error_log("📨 Desbloqueando usuario: bloqueador={$datos['usuario_bloqueador_id']}, bloqueado={$datos['usuario_bloqueado_id']}");
            
            $resultado = $mensajeModel->desbloquearUsuario($datos['usuario_bloqueador_id'], $datos['usuario_bloqueado_id']);
            echo json_encode($resultado);
            break;

        case 'obtener_estado_mensaje':
            if (empty($datos['mensaje_id']) || empty($datos['usuario_id'])) {
                echo json_encode(['exito' => false, 'error' => 'Datos incompletos']);
                return;
            }
            
            // Verificar que el usuario autenticado es el destinatario
            if ($usuarioAutenticado && $usuarioAutenticado->usuario_id != $datos['usuario_id']) {
                echo json_encode(['exito' => false, 'error' => 'No autorizado para ver el estado de este mensaje']);
                return;
            }
            
            error_log("📨 Obteniendo estado mensaje: mensaje_id={$datos['mensaje_id']}, usuario_id={$datos['usuario_id']}");
            
            $estado = $mensajeModel->obtenerEstadoMensaje($datos['mensaje_id'], $datos['usuario_id']);
            echo json_encode(['exito' => true, 'estado' => $estado]);
            break;

        case 'marcar_visto':
            if (empty($datos['mensaje_id']) || empty($datos['usuario_id'])) {
                echo json_encode(['exito' => false, 'error' => 'Datos incompletos']);
                return;
            }
            
            // Verificar que el usuario autenticado es el destinatario
            if ($usuarioAutenticado && $usuarioAutenticado->usuario_id != $datos['usuario_id']) {
                echo json_encode(['exito' => false, 'error' => 'No autorizado para marcar este mensaje como visto']);
                return;
            }
            
            error_log("📨 Marcando mensaje como visto: mensaje_id={$datos['mensaje_id']}, usuario_id={$datos['usuario_id']}");
            
            $resultado = $mensajeModel->marcarComoVisto($datos['mensaje_id'], $datos['usuario_id']);
            echo json_encode($resultado);
            break;

        case 'marcar_conversacion_vista':
            if (empty($datos['destinatario_id']) || empty($datos['remitente_id'])) {
                echo json_encode(['exito' => false, 'error' => 'IDs de usuarios no especificados']);
                return;
            }
            
            // Verificar que el usuario autenticado es el destinatario
            if ($usuarioAutenticado && $usuarioAutenticado->usuario_id != $datos['destinatario_id']) {
                echo json_encode(['exito' => false, 'error' => 'No autorizado para marcar esta conversación como vista']);
                return;
            }
            
            $anuncioId = $datos['anuncio_id'] ?? null;
            if ($anuncioId === 'null' || $anuncioId === '') {
                $anuncioId = null;
            }
            
            error_log("📨 Marcando conversación como vista: destinatario={$datos['destinatario_id']}, remitente={$datos['remitente_id']}, anuncio_id=" . ($anuncioId ?? 'null'));
            
            $resultado = $mensajeModel->marcarMensajesComoVistos($datos['destinatario_id'], $datos['remitente_id'], $anuncioId);
            echo json_encode($resultado);
            break;

        case 'obtener_estados_mensajes':
            if (empty($datos['usuario_id']) || empty($datos['otro_usuario_id'])) {
                echo json_encode(['exito' => false, 'error' => 'IDs de usuarios no especificados']);
                return;
            }
            
            // Verificar que el usuario autenticado es el que envía los mensajes
            if ($usuarioAutenticado && $usuarioAutenticado->usuario_id != $datos['usuario_id']) {
                echo json_encode(['exito' => false, 'error' => 'No autorizado para ver los estados de estos mensajes']);
                return;
            }
            
            error_log("📨 Obteniendo estados mensajes: usuario_id={$datos['usuario_id']}, otro_usuario_id={$datos['otro_usuario_id']}");
            
            $estados = $mensajeModel->obtenerEstadosMensajes($datos['usuario_id'], $datos['otro_usuario_id']);
            echo json_encode(['exito' => true, 'estados' => $estados]);
            break;
        
        default:
            error_log("❌ Acción no válida: " . $accion);
            echo json_encode([
                'exito' => false, 
                'error' => 'Acción no válida: ' . $accion,
                'acciones_validas' => [
                    'enviar', 
                    'obtener_conversacion', 
                    'obtener_chats', 
                    'marcar_leidos',
                    'obtener_no_leidos',
                    'verificar_bloqueo',
                    'bloquear_usuario',
                    'reportar_mensaje',
                    'desbloquear_usuario',
                    'obtener_estado_mensaje',
                    'marcar_visto',
                    'marcar_conversacion_vista',
                    'obtener_estados_mensajes'
                ]
            ]);
            break;
    }

} catch (Exception $e) {
    error_log("❌ ERROR GENERAL en mensajes.php: " . $e->getMessage());
    error_log("❌ Stack trace: " . $e->getTraceAsString());
    echo json_encode([
        'exito' => false, 
        'error' => 'Error interno del servidor',
        'debug' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}

error_log("=== MENSAJES.PHP FIN ===");
?>