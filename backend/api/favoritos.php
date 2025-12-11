<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ob_start();

try {
    require_once __DIR__ . '/common.php';
    require_once $ruta_base . '/../app/modelos/Favorito.php';

    error_log("🚀 === API FAVORITOS ===");
    error_log("🔧 MÉTODO: " . $_SERVER['REQUEST_METHOD']);
    
    // Obtener datos según el método
    $datos = [];
    $accion = '';
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $datos_json = file_get_contents('php://input');
        if (!empty($datos_json)) {
            $datos = json_decode($datos_json, true);
        }
        $accion = $datos['accion'] ?? '';
    } else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $datos = $_GET;
        $accion = $datos['accion'] ?? '';
    }
    
    error_log("🎯 Acción: " . ($accion ?: 'Ninguna'));
    error_log("📦 Datos recibidos: " . print_r($datos, true));
    
    // Verificar autenticación
    $headers = obtenerHeaders();
    $token = null;
    
    // Buscar el token en headers
    if (isset($headers['Authorization'])) {
        $auth = $headers['Authorization'];
        if (preg_match('/Bearer\s+(\S+)/', $auth, $matches)) {
            $token = $matches[1];
        }
    }

    // Si no se recibió por header, intentar obtener token desde el body (por compatibilidad con hosts)
    if (!$token) {
        // $datos ya contiene el JSON-decoded body para POST, o $_GET para GET
        if (!empty($datos['token'])) {
            $token = $datos['token'];
            error_log("🔁 Token tomado desde body (datos.token)");
        } elseif (!empty($datos['token_usuario'])) {
            $token = $datos['token_usuario'];
            error_log("🔁 Token tomado desde body (datos.token_usuario)");
        } elseif (!empty($_GET['token'])) {
            $token = $_GET['token'];
            error_log("🔁 Token tomado desde query param");
        }
    }

    if (!$token) {
        ob_clean();
        http_response_code(401);
        echo json_encode(['exito' => false, 'error' => 'No autorizado - Token requerido']);
        exit;
    }
    
    // Validar token
    $datosToken = JWT::validarToken($token);
    
    if (!$datosToken || !isset($datosToken['usuario_id'])) {
        ob_clean();
        http_response_code(401);
        echo json_encode(['exito' => false, 'error' => 'Token inválido o expirado']);
        exit;
    }
    
    $usuario_id = $datosToken['usuario_id'];
    
    $favoritoModel = new Favorito($GLOBALS['conexion']);
    
    switch ($accion) {
        case 'obtener':
            // Obtener todos los favoritos del usuario
            $tipo = $datos['tipo'] ?? 'anuncio'; // 'anuncio' o 'perfil'
            
            $favoritos = $favoritoModel->obtenerFavoritosUsuario($usuario_id, $tipo);
            
            ob_clean();
            echo json_encode([
                'exito' => true,
                'favoritos' => $favoritos,
                'total' => count($favoritos)
            ]);
            break;
            
        case 'agregar':
            // Agregar a favoritos
            $anuncio_id = $datos['anuncio_id'] ?? null;
            $usuario_favorito_id = $datos['usuario_favorito_id'] ?? null;
            
            $resultado = $favoritoModel->agregar($usuario_id, $anuncio_id, $usuario_favorito_id);
            
            ob_clean();
            echo json_encode($resultado);
            break;
            
        case 'eliminar':
            // Eliminar de favoritos por ID
            $favorito_id = $datos['favorito_id'] ?? null;
            
            if (!$favorito_id) {
                ob_clean();
                echo json_encode(['exito' => false, 'error' => 'favorito_id requerido']);
                break;
            }
            
            $resultado = $favoritoModel->eliminar($usuario_id, $favorito_id);
            
            ob_clean();
            echo json_encode($resultado);
            break;
            
        case 'eliminar_anuncio':
            // Eliminar de favoritos por anuncio_id
            $anuncio_id = $datos['anuncio_id'] ?? null;
            
            if (!$anuncio_id) {
                ob_clean();
                echo json_encode(['exito' => false, 'error' => 'anuncio_id requerido']);
                break;
            }
            
            $resultado = $favoritoModel->eliminarPorAnuncio($usuario_id, $anuncio_id);
            
            ob_clean();
            echo json_encode($resultado);
            break;
            
        case 'verificar':
            // Verificar si un anuncio está en favoritos
            $anuncio_id = $datos['anuncio_id'] ?? null;
            
            if (!$anuncio_id) {
                ob_clean();
                echo json_encode(['exito' => false, 'error' => 'anuncio_id requerido']);
                break;
            }
            
            $esFavorito = $favoritoModel->esAnunciofavorito($usuario_id, $anuncio_id);
            
            ob_clean();
            echo json_encode([
                'exito' => true,
                'es_favorito' => $esFavorito,
                'anuncio_id' => $anuncio_id
            ]);
            break;

        case 'verificar_perfil':
            // Verificar si un perfil está en favoritos
            $usuario_favorito_id = $datos['usuario_favorito_id'] ?? null;
            
            if (!$usuario_favorito_id) {
                ob_clean();
                echo json_encode(['exito' => false, 'error' => 'usuario_favorito_id requerido']);
                break;
            }
            
            $esFavorito = $favoritoModel->esPerfilFavorito($usuario_id, $usuario_favorito_id);
            $favorito_id = null;
            
            if ($esFavorito) {
                // Obtener el ID del favorito
                $sql = "SELECT id FROM favoritos WHERE usuario_id = ? AND usuario_favorito_id = ? AND tipo = 'perfil'";
                $stmt = $GLOBALS['conexion']->prepare($sql);
                $stmt->execute([$usuario_id, $usuario_favorito_id]);
                $resultado = $stmt->fetch(PDO::FETCH_ASSOC);
                $favorito_id = $resultado['id'] ?? null;
            }
            
            ob_clean();
            echo json_encode([
                'exito' => true,
                'es_favorito' => $esFavorito,
                'favorito_id' => $favorito_id,
                'usuario_favorito_id' => $usuario_favorito_id
            ]);
            break;
            
        case 'contar':
            // Contar favoritos del usuario
            $tipo = $datos['tipo'] ?? 'anuncio';
            $total = $favoritoModel->contarFavoritos($usuario_id, $tipo);
            
            ob_clean();
            echo json_encode([
                'exito' => true,
                'total' => $total,
                'tipo' => $tipo
            ]);
            break;
            
        default:
            ob_clean();
            echo json_encode(['exito' => false, 'error' => 'Acción no reconocida']);
    }

} catch (Exception $e) {
    error_log("💥 ERROR en favoritos.php: " . $e->getMessage());
    
    ob_clean();
    http_response_code(500);
    echo json_encode([
        'exito' => false,
        'error' => 'Error interno del servidor: ' . $e->getMessage()
    ]);
    exit;
}

$output = ob_get_clean();
if (!empty($output)) {
    echo $output;
}
?>
