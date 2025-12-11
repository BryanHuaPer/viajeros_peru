<?php
require_once __DIR__ . '/common.php';
require_once $ruta_base . '/../app/modelos/Usuario.php';
require_once $ruta_base . '/helpers/jwt.php';

try {
    // Determinar método y obtener datos
    $metodo = $_SERVER['REQUEST_METHOD'];
    
    if ($metodo === 'GET') {
        $datos = $_GET;
    } else {
        // Para POST, PUT, etc.
        $raw = file_get_contents('php://input');
        $datos = json_decode($raw, true) ?: [];
    }

    $accion = $datos['accion'] ?? '';
    $usuarioModel = new Usuario($GLOBALS['conexion']);

    switch ($accion) {
        case 'obtener_todos':
            // Solo para administradores
            // $payload = JWT::validarToken($_SERVER['HTTP_AUTHORIZATION'] ?? '');
            // if (!$payload || $payload['rol'] !== 'admin') {
            //     http_response_code(403);
            //     echo json_encode(['exito' => false, 'error' => 'No autorizado']);
            //     break;
            // }
            
            $usuarios = $usuarioModel->obtenerTodos();
            echo json_encode(['exito' => true, 'usuarios' => $usuarios]);
            break;

        case 'cambiar_contrasena':
            manejarCambioContrasena($datos, $usuarioModel);
            break;

        case 'obtener_perfil':
            $payload = JWT::validarToken($_SERVER['HTTP_AUTHORIZATION'] ?? '');
            if (!$payload) {
                http_response_code(401);
                echo json_encode(['exito' => false, 'error' => 'No autenticado']);
                break;
            }
            
            $usuario = $usuarioModel->obtenerPorId($payload['usuario_id']);
            if ($usuario) {
                echo json_encode(['exito' => true, 'usuario' => $usuario]);
            } else {
                echo json_encode(['exito' => false, 'error' => 'Usuario no encontrado']);
            }
            break;

        default:
            echo json_encode([
                'exito' => false, 
                'error' => 'Acción no válida',
                'acciones_validas' => ['obtener_todos', 'cambiar_contrasena', 'obtener_perfil']
            ]);
    }

} catch (Exception $e) {
    error_log("ERROR GENERAL en usuarios.php: " . $e->getMessage());
    echo json_encode([
        'exito' => false, 
        'error' => 'Error interno del servidor'
    ]);
}

function manejarCambioContrasena($datos, $usuarioModel) {
    // Validar autenticación
    $payload = JWT::validarToken($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['exito' => false, 'error' => 'No autenticado']);
        return;
    }

    // Validar datos requeridos
    $camposRequeridos = ['contrasena_actual', 'nueva_contrasena'];
    foreach ($camposRequeridos as $campo) {
        if (empty($datos[$campo])) {
            http_response_code(400);
            echo json_encode(['exito' => false, 'error' => "El campo '$campo' es requerido"]);
            return;
        }
    }

    // Validar longitud de nueva contraseña
    if (strlen($datos['nueva_contrasena']) < 6) {
        http_response_code(400);
        echo json_encode(['exito' => false, 'error' => 'La nueva contraseña debe tener al menos 6 caracteres']);
        return;
    }

    // Cambiar contraseña
    $resultado = $usuarioModel->cambiarContrasena(
        $payload['usuario_id'],
        $datos['contrasena_actual'],
        $datos['nueva_contrasena']
    );

    if ($resultado['exito']) {
        echo json_encode($resultado);
    } else {
        http_response_code(400);
        echo json_encode($resultado);
    }
}
?>