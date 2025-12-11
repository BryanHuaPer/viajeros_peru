<?php
// viajeros_peru/backend/api/autenticacion.php

// Incluir common.php con la ruta correcta
require_once __DIR__ . '/common.php';

// Verificar que $ruta_base esté definida
if (!isset($ruta_base)) {
    // Definir manualmente si no está definida
    $ruta_base = dirname(__DIR__);
}

// Ahora incluir los otros archivos
require_once $ruta_base . '/../app/modelos/Usuario.php';
require_once $ruta_base . '/../app/helpers/validacion.php';
require_once $ruta_base . '/helpers/jwt.php';

// Log para debugging
error_log("=== PETICIÓN RECIBIDA EN AUTENTICACIÓN ===");
error_log("Método: " . $_SERVER['REQUEST_METHOD']);

try {
    // Determinar el método de obtención de datos
    $datos = [];

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        
        if (!empty($raw)) {
            $maybeJson = json_decode($raw, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($maybeJson)) {
                $datos = $maybeJson;
                error_log("Entrada interpretada como JSON.");
            } else {
                parse_str($raw, $parsed);
                if (!empty($parsed)) {
                    $datos = $parsed;
                    error_log("Entrada interpretada como form-urlencoded.");
                } else {
                    $datos = $_POST;
                    error_log("Entrada tomada desde \$_POST.");
                }
            }
        } else {
            $datos = $_POST;
            error_log("No se recibió raw body; usando \$_POST.");
        }
    } else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode([
            'exito' => true,
            'mensaje' => 'API de autenticación funcionando',
            'instrucciones' => 'Usa POST para registro/login'
        ]);
        exit;
    }

    // Si no hay datos y es POST, error
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($datos)) {
        echo json_encode([
            'exito' => false, 
            'error' => 'No se recibieron datos'
        ]);
        exit;
    }

    $accion = $datos['accion'] ?? '';

    if (empty($accion)) {
        echo json_encode([
            'exito' => false, 
            'error' => 'Acción no especificada',
            'acciones_validas' => ['registro', 'login', 'refresh']
        ]);
        exit;
    }

    switch ($accion) {
        case 'registro':
            manejarRegistro($datos);
            break;
        
        case 'login':
            manejarLogin($datos);
            break;
        
        case 'refresh': 
            manejarRefresh($datos);
            break;
        default:
            echo json_encode([
                'exito' => false, 
                'error' => 'Acción no válida: ' . $accion
            ]);
            exit;
    }

} catch (Exception $e) {
    error_log("ERROR GENERAL en autenticación: " . $e->getMessage());
    echo json_encode([
        'exito' => false, 
        'error' => 'Error interno del servidor',
        'debug' => $e->getMessage()
    ]);
}

function manejarRegistro($datos) {
    error_log("📝 Iniciando registro...");
    
    $camposRequeridos = ['correo', 'contrasena', 'nombre', 'apellido', 'rol'];
    foreach ($camposRequeridos as $campo) {
        if (empty($datos[$campo])) {
            http_response_code(400);
            echo json_encode([
                'exito' => false,
                'error' => "El campo '$campo' es requerido"
            ]);
            return;
        }
    }
    
    try {
        $usuario = new Usuario($GLOBALS['conexion']);
        
        if (!filter_var($datos['correo'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode([
                'exito' => false,
                'error' => 'Formato de correo inválido'
            ]);
            return;
        }
        
        if (strlen($datos['contrasena']) < 6) {
            http_response_code(400);
            echo json_encode([
                'exito' => false,
                'error' => 'Contraseña debe tener al menos 6 caracteres'
            ]);
            return;
        }
        
        $resultado = $usuario->crear([
            'correo' => $datos['correo'],
            'contrasena' => $datos['contrasena'],
            'nombre' => $datos['nombre'],
            'apellido' => $datos['apellido'],
            'rol' => $datos['rol'] ?? 'viajero'
        ]);
        
        if (!$resultado['exito']) {
            http_response_code(409);
            echo json_encode($resultado);
            return;
        }
        
        $nuevoUsuario = $usuario->obtenerPorId($resultado['usuario_id']);
        
        $token = JWT::generarToken([
            'usuario_id' => $nuevoUsuario['id'],
            'correo' => $nuevoUsuario['correo'],
            'nombre' => $nuevoUsuario['nombre'],
            'rol' => $nuevoUsuario['rol']
        ]);
        
        error_log("✅ Registro exitoso para: " . $datos['correo']);
        
        http_response_code(201);
        echo json_encode([
            'exito' => true,
            'token' => $token,
            'usuario' => [
                'id' => (int)$nuevoUsuario['id'],
                'correo' => $nuevoUsuario['correo'],
                'nombre' => $nuevoUsuario['nombre'],
                'apellido' => $nuevoUsuario['apellido'],
                'rol' => $nuevoUsuario['rol'],
                'estado' => $nuevoUsuario['estado']
            ],
            'mensaje' => 'Usuario registrado exitosamente'
        ]);
        
    } catch (PDOException $e) {
        error_log("❌ Error de BD en registro: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'exito' => false,
            'error' => 'Error al registrar usuario'
        ]);
    }
}

function manejarLogin($datos) {
    error_log("🔐 Iniciando login...");
    
    if (empty($datos['correo']) || empty($datos['contrasena'])) {
        http_response_code(400);
        echo json_encode([
            'exito' => false,
            'error' => 'Correo y contraseña son requeridos'
        ]);
        return;
    }
    
    try {
        $usuario = new Usuario($GLOBALS['conexion']);
        $datosUsuario = $usuario->obtenerPorCorreo($datos['correo']);
        
        if (!$datosUsuario) {
            http_response_code(401);
            echo json_encode([
                'exito' => false,
                'error' => 'Credenciales inválidas'
            ]);
            return;
        }
        
        if (!password_verify($datos['contrasena'], $datosUsuario['contrasena'])) {
            http_response_code(401);
            echo json_encode([
                'exito' => false,
                'error' => 'Credenciales inválidas'
            ]);
            return;
        }
        
        if ($datosUsuario['estado'] === 'inactivo' || $datosUsuario['estado'] === 'suspendido') {
            http_response_code(403);
            echo json_encode([
                'exito' => false,
                'error' => 'Cuenta inactiva o suspendida'
            ]);
            return;
        }
        
        $token = JWT::generarToken([
            'usuario_id' => $datosUsuario['id'],
            'correo' => $datosUsuario['correo'],
            'nombre' => $datosUsuario['nombre'],
            'rol' => $datosUsuario['rol']
        ]);
        
        error_log("✅ Login exitoso para: " . $datos['correo']);
        
        // ============================================
        // ✅ ACTUALIZACIONES AUTOMÁTICAS
        // ============================================
        // Intentar incluir el actualizador
        $actualizaciones = ['reservas_completadas' => 0, 'notificaciones_enviadas' => 0, 'recordatorios_enviados' => 0];
        
        $ruta_actualizador = dirname(__DIR__) . '/../app/helpers/actualizador_reservas.php';
        error_log("Buscando actualizador en: " . $ruta_actualizador);
        
        if (file_exists($ruta_actualizador)) {
            require_once $ruta_actualizador;
            
            try {
                $actualizador = new ActualizadorReservas($GLOBALS['conexion']);
                $actualizaciones = $actualizador->ejecutarActualizaciones($datosUsuario['id']);
                
                if ($actualizaciones['reservas_completadas'] > 0) {
                    error_log("Usuario {$datosUsuario['id']}: {$actualizaciones['reservas_completadas']} reservas completadas");
                }
            } catch (Exception $e) {
                error_log("⚠️ Error en actualizaciones: " . $e->getMessage());
                // No fallar el login si hay error en actualizaciones
            }
        } else {
            error_log("⚠️ Archivo actualizador_reservas.php no encontrado en: " . $ruta_actualizador);
        }
        
        // Respuesta exitosa
        http_response_code(200);
        echo json_encode([
            'exito' => true,
            'token' => $token,
            'usuario' => [
                'id' => (int)$datosUsuario['id'],
                'correo' => $datosUsuario['correo'],
                'nombre' => $datosUsuario['nombre'],
                'apellido' => $datosUsuario['apellido'],
                'rol' => $datosUsuario['rol'],
                'estado' => $datosUsuario['estado'],
                // Incluir preferencia de idioma y zona horaria para que el frontend la aplique inmediatamente
                'idioma_preferido' => $datosUsuario['idioma_preferido'] ?? 'es',
                'idioma' => $datosUsuario['idioma_preferido'] ?? 'es',
                'zona_horaria' => $datosUsuario['zona_horaria'] ?? 'UTC',
                'visibilidad_perfil' => $datosUsuario['visibilidad_perfil'] ?? 'publico'
            ],
            'actualizaciones' => $actualizaciones,
            'mensaje' => 'Login exitoso'
        ]);
        
    } catch (PDOException $e) {
        error_log("❌ Error de BD en login: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'exito' => false,
            'error' => 'Error interno del servidor'
        ]);
    }
}

function manejarRefresh($datos) {
    error_log("🔄 Intentando refrescar token...");
    
    if (empty($datos['token'])) {
        http_response_code(400);
        echo json_encode([
            'exito' => false,
            'error' => 'Token no proporcionado'
        ]);
        return;
    }
    
    try {
        $payload = JWT::validarToken($datos['token']);
        
        if (!$payload) {
            http_response_code(401);
            echo json_encode([
                'exito' => false,
                'error' => 'Token inválido o expirado'
            ]);
            return;
        }
        
        $nuevoToken = JWT::generarToken([
            'usuario_id' => $payload['usuario_id'],
            'correo' => $payload['correo'],
            'nombre' => $payload['nombre'],
            'rol' => $payload['rol']
        ]);
        
        echo json_encode([
            'exito' => true,
            'token' => $nuevoToken,
            'mensaje' => 'Token refrescado'
        ]);
        
    } catch (Exception $e) {
        error_log("❌ Error refrescando token: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'exito' => false,
            'error' => 'Error refrescando token'
        ]);
    }
}

?>