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
require_once $ruta_base . '/../app/modelos/Perfil.php';

// Log para debugging
error_log("=== PETICIÓN RECIBIDA EN PERFILES ===");
error_log("Método: " . $_SERVER['REQUEST_METHOD']);

try {
    // Determinar el método de obtención de datos
    $datos = [];
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Si hay cualquier archivo en $_FILES, asumir multipart/form-data
        if (!empty($_FILES)) {
            // Tomar datos de $_POST y adjuntar los archivos recibidos
            $datos = $_POST;
            foreach ($_FILES as $key => $file) {
                $datos[$key] = $file;
            }
        } else {
            // Intentar parsear JSON raw en el body
            $datos_json = file_get_contents('php://input');
            if (!empty($datos_json)) {
                $datos = json_decode($datos_json, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    throw new Exception('JSON inválido: ' . json_last_error_msg());
                }
            }
        }
    } else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $datos = $_GET;
    }

    $accion = $datos['accion'] ?? '';

    // Si no hay acción específica y es GET, obtener perfil
    if (empty($accion) && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $accion = 'obtener';
    }

    switch ($accion) {
        case 'obtener':
            manejarObtenerPerfil($datos);
            break;
        
        case 'guardar':
            manejarGuardarPerfil($datos);
            break;
        
        case 'subir_foto':
            manejarSubirFoto($datos);
            break;
            
        case 'ver_publico':
            manejarVerPerfilPublico($datos);
            break;
            
        case 'iniciar_verificacion':
            manejarIniciarVerificacion($datos);
            break;

        case 'obtener_ajustes':
            manejarObtenerAjustes($datos);
            break;

        case 'actualizar_ajustes':
            manejarActualizarAjustes($datos);
            break;
        
        default:
            echo json_encode([
                'exito' => false,
                'error' => 'Acción no válida: ' . $accion,
                'acciones_validas' => ['obtener', 'guardar', 'subir_foto', 'iniciar_verificacion', 'ver_publico', 'obtener_ajustes', 'actualizar_ajustes']
            ]);
            exit;
    }

} catch (Exception $e) {
    error_log("ERROR GENERAL en perfiles: " . $e->getMessage());
    echo json_encode([
        'exito' => false, 
        'error' => 'Error interno del servidor',
        'debug' => $e->getMessage()
    ]);
}

function manejarObtenerPerfil($datos) {
    error_log("Obteniendo perfil para usuario: " . ($datos['usuario_id'] ?? 'No especificado'));
    
    if (empty($datos['usuario_id'])) {
        echo json_encode(['exito' => false, 'error' => 'ID de usuario no especificado']);
        return;
    }
    
    $perfilModel = new Perfil($GLOBALS['conexion']);
    $perfil = $perfilModel->obtenerPorUsuarioId($datos['usuario_id']);
    
    if ($perfil) {
        echo json_encode([
            'exito' => true,
            'perfil' => $perfil
        ]);
    } else {
        echo json_encode([
            'exito' => false,
            'error' => 'Perfil no encontrado',
            'perfil' => null
        ]);
    }
}

function manejarVerPerfilPublico($datos) {
    error_log("Obteniendo perfil público para usuario: " . ($datos['usuario_id'] ?? 'No especificado'));
    
    if (empty($datos['usuario_id'])) {
        echo json_encode(['exito' => false, 'error' => 'ID de usuario no especificado']);
        return;
    }
    
    $perfilModel = new Perfil($GLOBALS['conexion']);
    $perfilPublico = $perfilModel->obtenerPerfilPublico($datos['usuario_id']);
    
    if ($perfilPublico) {
        echo json_encode([
            'exito' => true,
            'perfil' => $perfilPublico
        ]);
    } else {
        echo json_encode([
            'exito' => false,
            'error' => 'Perfil no encontrado',
            'perfil' => null
        ]);
    }
}

function manejarIniciarVerificacion($datos) {
    error_log("Iniciando verificación para usuario: " . ($datos['usuario_id'] ?? 'No especificado'));
    
    if (empty($datos['usuario_id'])) {
        echo json_encode(['exito' => false, 'error' => 'ID de usuario no especificado']);
        return;
    }
    
    try {
        // Validar archivos
        if (!isset($_FILES['documento_foto']) || !isset($_FILES['selfie_foto'])) {
            throw new Exception('Faltan archivos requeridos: documento_foto y selfie_foto');
        }
        
        // Validar campos requeridos
        $camposRequeridos = ['nombre_completo', 'fecha_nacimiento', 'tipo_documento', 'numero_documento'];
        foreach ($camposRequeridos as $campo) {
            if (empty($datos[$campo])) {
                throw new Exception("Campo requerido faltante: $campo");
            }
        }
        
        $perfilModel = new Perfil($GLOBALS['conexion']);
        
        // Crear directorio de verificaciones si no existe
        $directorioVerificaciones = rtrim(Configuracion::RUTA_SUBIDAS, '/\\') . DIRECTORY_SEPARATOR . 'verificaciones' . DIRECTORY_SEPARATOR;
        if (!is_dir($directorioVerificaciones)) {
            mkdir($directorioVerificaciones, 0777, true);
        }
        
        // Generar nombres únicos para los archivos
        $timestamp = time();
        $documentoNombre = 'documento_' . $datos['usuario_id'] . '_' . $timestamp . '.jpg';
        $selfieNombre = 'selfie_' . $datos['usuario_id'] . '_' . $timestamp . '.jpg';
        
        $documentoPath = $directorioVerificaciones . $documentoNombre;
        $selfiePath = $directorioVerificaciones . $selfieNombre;
        
        // Mover archivos
        if (!move_uploaded_file($_FILES['documento_foto']['tmp_name'], $documentoPath)) {
            throw new Exception('Error al guardar el documento');
        }
        
        if (!move_uploaded_file($_FILES['selfie_foto']['tmp_name'], $selfiePath)) {
            // Si falla el selfie, eliminar el documento ya subido
            unlink($documentoPath);
            throw new Exception('Error al guardar la selfie');
        }
        
        // Construir URLs públicas
        $urlDocumento = '/public/uploads/verificaciones/' . $documentoNombre;
        $urlSelfie = '/public/uploads/verificaciones/' . $selfieNombre;
        
        // Iniciar verificación en la base de datos
        $resultado = $perfilModel->iniciarVerificacion($datos['usuario_id'], [
            'nombre_completo' => $datos['nombre_completo'],
            'fecha_nacimiento' => $datos['fecha_nacimiento'],
            'tipo_documento' => $datos['tipo_documento'],
            'numero_documento' => $datos['numero_documento'],
            'documento_archivo' => $urlDocumento,
            'selfie_archivo' => $urlSelfie
        ]);
        
        if ($resultado['exito']) {
            echo json_encode([
                'exito' => true,
                'mensaje' => 'Solicitud de verificación enviada correctamente',
                'verificacion_id' => $resultado['verificacion_id']
            ]);
        } else {
            // Si falla la BD, eliminar los archivos subidos
            unlink($documentoPath);
            unlink($selfiePath);
            throw new Exception($resultado['error']);
        }
        
    } catch (Exception $e) {
        error_log("Error en verificación: " . $e->getMessage());
        echo json_encode([
            'exito' => false,
            'error' => 'Error al procesar la verificación: ' . $e->getMessage()
        ]);
    }
}

function manejarGuardarPerfil($datos) {
    error_log("Guardando perfil: " . print_r($datos, true));
    
    if (empty($datos['usuario_id'])) {
        echo json_encode(['exito' => false, 'error' => 'ID de usuario no especificado']);
        return;
    }
    
    $perfilModel = new Perfil($GLOBALS['conexion']);
    
    // Preparar datos COMPLETOS para guardar
    $datosPerfil = [
        'usuario_id' => $datos['usuario_id'],
        'biografia' => $datos['biografia'] ?? '',
        'telefono' => $datos['telefono'] ?? '',
        'pais' => $datos['pais'] ?? '',
        'ciudad' => $datos['ciudad'] ?? '',
        'ubicacion' => $datos['ubicacion'] ?? '',
        'fecha_nacimiento' => $datos['fecha_nacimiento'] ?? null,
        'idioma_preferido' => $datos['idioma_preferido'] ?? 'es',
        'zona_horaria' => $datos['zona_horaria'] ?? 'UTC',
        'disponibilidad' => $datos['disponibilidad'] ?? '',
        'habilidades' => json_encode($datos['habilidades'] ?? []),
        'idiomas' => json_encode($datos['idiomas'] ?? ['espanol']),
        'intereses' => json_encode($datos['intereses'] ?? []),
        'experiencias_previas' => $datos['experiencias_previas'] ?? '',
        'redes_sociales' => json_encode($datos['redes_sociales'] ?? [])
    ];
    
    $resultado = $perfilModel->guardar($datosPerfil);
    
    if ($resultado['exito']) {
        echo json_encode([
            'exito' => true,
            'mensaje' => 'Perfil guardado correctamente',
            'perfil' => $resultado['perfil']
        ]);
    } else {
        echo json_encode(['exito' => false, 'error' => $resultado['error']]);
    }
}

function manejarSubirFoto($datos) {
    error_log("Subiendo foto de perfil");
    
    if (empty($datos['usuario_id'])) {
        echo json_encode(['exito' => false, 'error' => 'ID de usuario no especificado']);
        return;
    }
    
    if (!isset($_FILES['foto'])) {
        echo json_encode(['exito' => false, 'error' => 'No se recibió ninguna foto']);
        return;
    }
    
    $foto = $_FILES['foto'];
    
    // Validar tipo de archivo
    $tiposPermitidos = ['image/jpeg', 'image/png', 'image/gif'];
    if (!in_array($foto['type'], $tiposPermitidos)) {
        echo json_encode(['exito' => false, 'error' => 'Tipo de archivo no permitido']);
        return;
    }
    
    // Validar tamaño (5MB máximo)
    if ($foto['size'] > 5 * 1024 * 1024) {
        echo json_encode(['exito' => false, 'error' => 'La imagen es demasiado grande (máximo 5MB)']);
        return;
    }
    
    // Crear directorio de uploads si no existe (filesystem)
    $directorioUploads = rtrim(Configuracion::RUTA_SUBIDAS, '/\\') . DIRECTORY_SEPARATOR . 'perfiles' . DIRECTORY_SEPARATOR;
    if (!is_dir($directorioUploads)) {
        mkdir($directorioUploads, 0777, true);
    }
    
    // Generar nombre único para el archivo
    $extension = pathinfo($foto['name'], PATHINFO_EXTENSION);
    $nombreArchivo = 'perfil_' . $datos['usuario_id'] . '_' . time() . '.' . $extension;
    $rutaCompleta = $directorioUploads . $nombreArchivo;
    
    // Mover archivo
    if (move_uploaded_file($foto['tmp_name'], $rutaCompleta)) {

    // Actualizar perfil con la nueva foto
    $perfilModel = new Perfil($GLOBALS['conexion']);

    // Construir URL pública usando la constante URL_SUBIDAS
    $urlFoto = rtrim(Configuracion::URL_SUBIDAS, '/\\') . '/perfiles/' . $nombreArchivo;

    $resultado = $perfilModel->actualizarFoto($datos['usuario_id'], $urlFoto);
        
        if ($resultado['exito']) {
            echo json_encode([
                'exito' => true,
                'mensaje' => 'Foto de perfil actualizada',
                'url_foto' => $urlFoto
            ]);
        } else {
            // Eliminar archivo si falló la actualización en BD
            unlink($rutaCompleta);
            echo json_encode(['exito' => false, 'error' => $resultado['error']]);
        }
    } else {
        echo json_encode(['exito' => false, 'error' => 'Error al subir el archivo']);
    }
}

/**
 * Helper para subir archivos de verificación
 */
function subirArchivoVerificacion($archivo, $tipo, $usuario_id) {
    // Validar archivo
    if ($archivo['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Error al subir el archivo: ' . $archivo['error']);
    }
    
    // Validar tipo
    $tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!in_array($archivo['type'], $tiposPermitidos)) {
        throw new Exception('Tipo de archivo no permitido: ' . $archivo['type']);
    }
    
    // Validar tamaño (5MB máximo)
    if ($archivo['size'] > 5 * 1024 * 1024) {
        throw new Exception('El archivo es demasiado grande (máximo 5MB)');
    }
    
    // Crear directorio si no existe
    $directorio = rtrim(Configuracion::RUTA_SUBIDAS, '/\\') . DIRECTORY_SEPARATOR . 'verificaciones' . DIRECTORY_SEPARATOR;
    if (!is_dir($directorio)) {
        mkdir($directorio, 0777, true);
    }
    
    // Generar nombre único
    $extension = pathinfo($archivo['name'], PATHINFO_EXTENSION);
    $nombreArchivo = $tipo . '_' . $usuario_id . '_' . time() . '_' . uniqid() . '.' . $extension;
    $rutaCompleta = $directorio . $nombreArchivo;
    
    // Mover archivo
    if (!move_uploaded_file($archivo['tmp_name'], $rutaCompleta)) {
        throw new Exception('Error al guardar el archivo en el servidor');
    }
    
    // Retornar URL pública
    return rtrim(Configuracion::URL_SUBIDAS, '/\\') . '/verificaciones/' . $nombreArchivo;
}

function manejarObtenerAjustes($datos) {
    error_log("Obteniendo ajustes para usuario: " . ($datos['usuario_id'] ?? 'No especificado'));
    
    if (empty($datos['usuario_id'])) {
        echo json_encode(['exito' => false, 'error' => 'ID de usuario no especificado']);
        return;
    }
    
    try {
        // Primero obtener datos básicos del usuario
        $sql = "SELECT 
                    u.id, u.correo, u.nombre, u.apellido, u.rol, u.estado,
                    u.idioma_preferido, u.zona_horaria, u.visibilidad_perfil,
                    u.config_notificaciones,
                    p.foto_perfil, p.estado_verificacion
                FROM usuarios u
                LEFT JOIN perfiles p ON u.id = p.usuario_id
                WHERE u.id = ?";
        
        $stmt = $GLOBALS['conexion']->prepare($sql);
        $stmt->execute([$datos['usuario_id']]);
        $usuario = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$usuario) {
            echo json_encode(['exito' => false, 'error' => 'Usuario no encontrado']);
            return;
        }
        
        // Parsear config_notificaciones si existe
        $notificacionesConfig = [];
        if (!empty($usuario['config_notificaciones'])) {
            parse_str($usuario['config_notificaciones'], $notificacionesConfig);
        }
        
        echo json_encode([
            'exito' => true,
            'ajustes' => [
                'idioma' => $usuario['idioma_preferido'] ?? 'es',
                'zona_horaria' => $usuario['zona_horaria'] ?? 'UTC',
                'visibilidad_perfil' => $usuario['visibilidad_perfil'] ?? 'publico',
                'notificaciones_email' => $notificacionesConfig['notificaciones_email'] ?? 'si',
                'frecuencia_sugerencias' => $notificacionesConfig['frecuencia_sugerencias'] ?? 'semanal'
            ],
            'usuario' => [
                'id' => $usuario['id'],
                'nombre' => $usuario['nombre'],
                'apellido' => $usuario['apellido'],
                'rol' => $usuario['rol'],
                'estado_verificacion' => $usuario['estado_verificacion'] ?? 'no_verificado'
            ]
        ]);
        
    } catch (Exception $e) {
        error_log("Error al obtener ajustes: " . $e->getMessage());
        echo json_encode([
            'exito' => false, 
            'error' => 'Error interno del servidor',
            'debug' => $e->getMessage()
        ]);
    }
}

function manejarActualizarAjustes($datos) {
    error_log("Actualizando ajustes: " . print_r($datos, true));
    
    if (empty($datos['usuario_id'])) {
        echo json_encode(['exito' => false, 'error' => 'ID de usuario no especificado']);
        return;
    }
    
    try {
        $campos = [];
        $valores = [];
        
        // Campos básicos del usuario
        if (isset($datos['idioma'])) {
            $campos[] = 'idioma_preferido = ?';
            $valores[] = $datos['idioma'];
        }
        
        if (isset($datos['zona_horaria'])) {
            $campos[] = 'zona_horaria = ?';
            $valores[] = $datos['zona_horaria'];
        }
        
        if (isset($datos['visibilidad_perfil'])) {
            $campos[] = 'visibilidad_perfil = ?';
            $valores[] = $datos['visibilidad_perfil'];
        }
        
        // Configuración de notificaciones (como texto plano)
        if (isset($datos['notificaciones_email']) && isset($datos['frecuencia_sugerencias'])) {
            $configString = http_build_query([
                'notificaciones_email' => $datos['notificaciones_email'],
                'frecuencia_sugerencias' => $datos['frecuencia_sugerencias']
            ]);
            
            $campos[] = 'config_notificaciones = ?';
            $valores[] = $configString;
        }
        
        if (empty($campos)) {
            echo json_encode(['exito' => false, 'error' => 'No hay campos para actualizar']);
            return;
        }
        
        // Agregar ID al final
        $valores[] = $datos['usuario_id'];
        
        $sql = "UPDATE usuarios SET " . implode(', ', $campos) . " WHERE id = ?";
        $stmt = $GLOBALS['conexion']->prepare($sql);
        $stmt->execute($valores);
        
        echo json_encode([
            'exito' => true,
            'mensaje' => 'Ajustes actualizados correctamente',
            'campos_actualizados' => count($campos)
        ]);
        
    } catch (Exception $e) {
        error_log("Error al actualizar ajustes: " . $e->getMessage());
        echo json_encode([
            'exito' => false, 
            'error' => 'Error al guardar los ajustes',
            'debug' => $e->getMessage()
        ]);
    }
}
?>