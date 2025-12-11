<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ob_start();


try {
    require_once __DIR__ . '/common.php';
    require_once $ruta_base . '/../app/modelos/Anuncio.php';

    // DEBUG: Log inicial
    error_log("🚀 === INICIANDO API ANUNCIOS ===");
    error_log("🔧 MÉTODO: " . $_SERVER['REQUEST_METHOD']);
    error_log("🔧 CONTENT_TYPE: " . ($_SERVER["CONTENT_TYPE"] ?? 'No definido'));
    
    // Determinar el método de obtención de datos - VERSIÓN CORREGIDA
    $datos = [];
    $accion = '';
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
        
        // Si es FormData (multipart), los datos vienen en $_POST
        if (strpos($contentType, 'multipart/form-data') !== false) {
            error_log("📁 Detectado FormData - usando $_POST");
            $datos = $_POST;
            $accion = $datos['accion'] ?? '';
            error_log("📦 Datos POST recibidos:");
            error_log(print_r($_POST, true));
        } else {
            // Si es JSON, leer de php://input
            error_log("📄 Detectado JSON - usando php://input");
            $datos_json = file_get_contents('php://input');
            if (!empty($datos_json)) {
                $datos = json_decode($datos_json, true);
                $accion = $datos['accion'] ?? '';
            }
        }
    } else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $datos = $_GET;
        $accion = $datos['accion'] ?? '';
    }
    
    error_log("🎯 Acción detectada: " . ($accion ?: 'Ninguna'));
    error_log("📁 Archivos FILES recibidos:");
    error_log(print_r($_FILES, true));
    
    // Si no hay acción específica y es GET, obtener anuncios
    if (empty($accion) && $_SERVER['REQUEST_METHOD'] === 'GET') {
        if (isset($datos['anfitrion_id'])) {
            $accion = 'obtener_por_anfitrion';
        } else if (isset($datos['buscar'])) {
            $accion = 'buscar';
        } else if (isset($datos['id'])) {
            $accion = 'obtener_por_id';
        } else {
            $accion = 'destacados'; // Caso por defecto
        }
        error_log("🔄 Acción inferida: " . $accion);
    }

    $anuncioModel = new Anuncio($GLOBALS['conexion']);
    // Función para formatear rutas de imágenes
    // Función para formatear rutas de imágenes
    function formatearRutaImagen($ruta) {
        // Si ya es URL absoluta
        if (strpos($ruta, 'http') === 0 || strpos($ruta, '//') === 0) {
            return $ruta;
        }

        // Si la ruta está vacía
        if ($ruta === '') return '';

        // Ruta base fija de tu proyecto
        $ruta_base_proyecto = '/proyectoWeb/viajeros_peru';

        // Asegurar que la ruta comienza con '/'
        if ($ruta[0] !== '/') {
            $ruta = '/' . $ruta;
        }

        // Combinar ruta base del proyecto con la ruta de la imagen
        $ruta_completa = $ruta_base_proyecto . $ruta;

        // Construir URL completa
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? '192.168.1.37';

        return $scheme . '://' . $host . $ruta_completa;
    }
    
    // DEBUG: Verificar conexión
    error_log("🔌 Verificando conexión a BD en anuncios.php");
    if (!isset($GLOBALS['conexion'])) {
        throw new Exception("No hay conexión a BD disponible");
    } else {
        error_log("✅ Conexión a BD disponible");
    }
    
    switch ($accion) {
        case 'destacados':
        case '':
            // Si no hay acción, devolver anuncios destacados
            try {
                error_log("📊 Obteniendo anuncios destacados");
                $limite = 6;
                $sql = "SELECT a.*, u.nombre, u.apellido , p.foto_perfil
                        FROM anuncios a 
                        JOIN usuarios u ON a.anfitrion_id = u.id 
                        JOIN perfiles p ON u.id = p.usuario_id
                        WHERE a.estado = 'activo' 
                        ORDER BY a.fecha_publicacion DESC 
                        LIMIT ?";
                
                $stmt = $conexion->prepare($sql);
                $stmt->execute([$limite]);
                
                // PRIMERO obtener los anuncios
                $anuncios = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // LUEGO obtener imágenes para cada anuncio
                foreach ($anuncios as &$anuncio) {
                    $sql_imagenes = "SELECT url_imagen FROM anuncio_imagenes 
                                WHERE anuncio_id = ? 
                                ORDER BY orden ASC";
                    $stmt_img = $conexion->prepare($sql_imagenes);
                    $stmt_img->execute([$anuncio['id']]);
                    $imagenes = $stmt_img->fetchAll(PDO::FETCH_COLUMN);
                    
                    // Formatear las rutas de las imágenes
                    $anuncio['imagenes'] = array_map('formatearRutaImagen', $imagenes);
                }
                
                error_log("✅ Anuncios destacados obtenidos: " . count($anuncios));
                ob_clean();
                echo json_encode(['exito' => true, 'anuncios' => $anuncios]);
                
            } catch (PDOException $e) {
                error_log("❌ Error al cargar anuncios destacados: " . $e->getMessage());
                ob_clean();
                echo json_encode(['exito' => false, 'error' => 'Error al cargar anuncios']);
            }
            break;
            
        case 'obtener_por_anfitrion':
            if (empty($datos['anfitrion_id'])) {
                ob_clean();
                echo json_encode(['exito' => false, 'error' => 'ID de anfitrión no especificado']);
                return;
            }
            
            $anuncios = $anuncioModel->obtenerPorAnfitrion($datos['anfitrion_id']);
            ob_clean();
            echo json_encode(['exito' => true, 'anuncios' => $anuncios]);
            break;
        
        case 'obtener_por_id':
            if (empty($datos['id'])) {
                ob_clean();
                echo json_encode(['exito' => false, 'error' => 'ID de anuncio no especificado']);
                return;
            }
            
            $anuncio = $anuncioModel->obtenerPorId($datos['id']);
            ob_clean();
            if ($anuncio) {
                echo json_encode(['exito' => true, 'anuncio' => $anuncio]);
            } else {
                echo json_encode(['exito' => false, 'error' => 'Anuncio no encontrado']);
            }
            break;
        
        case 'crear':
            error_log("📥 === INICIANDO CREACIÓN DE ANUNCIO ===");
            
            // Determinar si es FormData o JSON
            $contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
            
            if (strpos($contentType, 'multipart/form-data') !== false) {
                // Es FormData (con o sin imágenes)
                error_log("📁 Recibiendo FormData");
                $datosForm = $_POST;
                $archivos = $_FILES;
                
                error_log("📊 Datos POST para crear:");
                error_log(print_r($datosForm, true));
                error_log("📁 Archivos FILES para crear:");
                error_log(print_r($archivos, true));
                
                // VERIFICAR CRÍTICO: ¿Tenemos la acción?
                if (empty($datosForm['accion'])) {
                    throw new Exception("No se encontró 'accion' en $_POST");
                }
                
                if (empty($datosForm['anfitrion_id'])) {
                    ob_clean();
                    echo json_encode(['exito' => false, 'error' => 'ID de anfitrión no especificado']);
                    break;
                }
                
                // Validar campos obligatorios
                $camposObligatorios = ['titulo', 'descripcion', 'ubicacion', 'tipo_actividad'];
                foreach ($camposObligatorios as $campo) {
                    if (empty($datosForm[$campo])) {
                        ob_clean();
                        echo json_encode(['exito' => false, 'error' => "El campo $campo es obligatorio"]);
                        break 2;
                    }
                }
                
                // Si se enviaron imágenes, usar crearConImagenes
                if (isset($archivos['imagenes']) && !empty($archivos['imagenes']['name'][0])) {
                    error_log("🖼️ Creando anuncio CON imágenes");
                    $resultado = $anuncioModel->crearConImagenes($datosForm, $archivos['imagenes']);
                } else {
                    // Si no hay imágenes, crear normalmente
                    error_log("📄 Creando anuncio SIN imágenes");
                    $resultado = $anuncioModel->crear($datosForm);
                }
                
            } else {
                // Es JSON (método antiguo)
                error_log("📄 Recibiendo JSON");
                if (empty($datos['anfitrion_id'])) {
                    ob_clean();
                    echo json_encode(['exito' => false, 'error' => 'ID de anfitrión no especificado']);
                    break;
                }
                $resultado = $anuncioModel->crear($datos);
            }
            
            error_log("📤 Resultado final de creación:");
            error_log(print_r($resultado, true));
            ob_clean();
            echo json_encode($resultado);
            break;
            
        case 'actualizar':
            error_log("🎯 === INICIANDO ACTUALIZACIÓN DE ANUNCIO ===");
            
            // DEPURACIÓN DETALLADA - VERSIÓN MEJORADA
            error_log("📦 Datos POST recibidos:");
            $postKeys = array_keys($_POST);
            error_log("Claves POST: " . implode(', ', $postKeys));
            
            error_log("📁 Archivos FILES recibidos:");
            if (isset($_FILES)) {
                $filesKeys = array_keys($_FILES);
                error_log("Claves FILES: " . implode(', ', $filesKeys));
                
                // ESPECÍFICAMENTE para nuevas_imagenes
                if (isset($_FILES['nuevas_imagenes'])) {
                    error_log("📊 === DETALLES DE nuevas_imagenes ===");
                    
                    // Verificar estructura
                    error_log("Estructura de nuevas_imagenes:");
                    error_log(print_r($_FILES['nuevas_imagenes'], true));
                    
                    // Contar imágenes de DIFERENTES MANERAS para comparar
                    $contador_metodo1 = 0;
                    $contador_metodo2 = 0;
                    $contador_metodo3 = 0;
                    
                    // Método 1: Contar por nombres no vacíos
                    if (isset($_FILES['nuevas_imagenes']['name'])) {
                        if (is_array($_FILES['nuevas_imagenes']['name'])) {
                            foreach ($_FILES['nuevas_imagenes']['name'] as $nombre) {
                                if (!empty($nombre)) {
                                    $contador_metodo1++;
                                }
                            }
                        } else if (!empty($_FILES['nuevas_imagenes']['name'])) {
                            $contador_metodo1 = 1;
                        }
                    }
                    
                    // Método 2: Usar count() directamente
                    if (isset($_FILES['nuevas_imagenes']['name']) && is_array($_FILES['nuevas_imagenes']['name'])) {
                        $contador_metodo2 = count($_FILES['nuevas_imagenes']['name']);
                    }
                    
                    // Método 3: Contar solo archivos con error UPLOAD_ERR_OK
                    if (isset($_FILES['nuevas_imagenes']['error'])) {
                        if (is_array($_FILES['nuevas_imagenes']['error'])) {
                            foreach ($_FILES['nuevas_imagenes']['error'] as $error) {
                                if ($error === UPLOAD_ERR_OK) {
                                    $contador_metodo3++;
                                }
                            }
                        } else if ($_FILES['nuevas_imagenes']['error'] === UPLOAD_ERR_OK) {
                            $contador_metodo3 = 1;
                        }
                    }
                    
                    error_log("📊 CONTEO DE IMÁGENES EN BACKEND:");
                    error_log("  - Método 1 (nombres no vacíos): $contador_metodo1");
                    error_log("  - Método 2 (count() directo): $contador_metodo2");
                    error_log("  - Método 3 (errores UPLOAD_ERR_OK): $contador_metodo3");
                    
                    // Mostrar nombres específicos
                    if (isset($_FILES['nuevas_imagenes']['name']) && is_array($_FILES['nuevas_imagenes']['name'])) {
                        error_log("📋 Nombres de imágenes recibidas:");
                        foreach ($_FILES['nuevas_imagenes']['name'] as $index => $nombre) {
                            if (!empty($nombre)) {
                                $error = $_FILES['nuevas_imagenes']['error'][$index] ?? 'N/A';
                                $size = $_FILES['nuevas_imagenes']['size'][$index] ?? 0;
                                error_log("  [$index]: $nombre (error: $error, tamaño: $size)");
                            }
                        }
                    }
                }
            }
            
            if (empty($datos['id']) || empty($datos['anfitrion_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de anuncio o anfitrión no especificado']);
                return;
            }
            
            // Pasar el control al modelo que ahora incluye validación
            $resultado = $anuncioModel->actualizar($datos['id'], $datos);
            ob_clean();
            echo json_encode($resultado);
            break;
        
        case 'eliminar':
            if (empty($datos['id']) || empty($datos['anfitrion_id'])) {
                ob_clean();
                echo json_encode(['exito' => false, 'error' => 'ID de anuncio o anfitrión no especificado']);
                return;
            }
            
            $resultado = $anuncioModel->eliminar($datos['id'], $datos['anfitrion_id']);
            ob_clean();
            echo json_encode($resultado);
            break;
        
        case 'cambiar_estado':
            if (empty($datos['id']) || empty($datos['anfitrion_id']) || empty($datos['nuevo_estado'])) {
                ob_clean();
                echo json_encode(['exito' => false, 'error' => 'ID de anuncio, anfitrión o nuevo estado no especificado']);
                return;
            }
            $resultado = $anuncioModel->cambiarEstado($datos['id'], $datos['anfitrion_id'], $datos['nuevo_estado']);
            ob_clean();
            echo json_encode($resultado);
            break;
        
        case 'buscar':
            // DEBUG: Verificar parámetros recibidos
            error_log("🔍 PARÁMETROS RECIBIDOS EN BUSCAR:");
            error_log("📋 GET completo: " . print_r($_GET, true));
            error_log("🎯 Pagina: " . ($_GET['pagina'] ?? 'NO RECIBIDO'));
            error_log("🎯 Limite: " . ($_GET['limite'] ?? 'NO RECIBIDO'));
            // Obtener parámetros de paginación
            $pagina = isset($datos['pagina']) ? intval($datos['pagina']) : 1;
            $limite = isset($datos['limite']) ? intval($datos['limite']) : 10;
            
            error_log("🔍 Búsqueda con paginación - Página: $pagina, Límite: $limite");
            
            // Usar el método del modelo con paginación
            $resultado = $anuncioModel->buscar($datos, $pagina, $limite);
            
            // Formatear rutas de imágenes en los resultados
            foreach ($resultado['anuncios'] as &$anuncio) {
                if (!empty($anuncio['imagen_principal'])) {
                    $anuncio['imagen_principal'] = ($anuncio['imagen_principal']);
                }
            }
            
            ob_clean();
            echo json_encode([
                'exito' => true, 
                'anuncios' => $resultado['anuncios'],
                'total' => $resultado['total'],
                'pagina_actual' => $resultado['pagina_actual'],
                'total_paginas' => $resultado['total_paginas'],
                'resultados_por_pagina' => $resultado['resultados_por_pagina']
            ]);
            break;
        case 'obtener_imagenes':
            if (empty($datos['anuncio_id'])) {
                ob_clean();
                echo json_encode(['exito' => false, 'error' => 'ID de anuncio no especificado']);
                break;
            }
            
            try {
                $imagenes = $anuncioModel->obtenerImagenes($datos['anuncio_id']);
                
                // Formatear las rutas de las imágenes
                $imagenesFormateadas = array_map(function($imagen) {
                    return [
                        'id' => $imagen['id'],
                        'ruta' => formatearRutaImagen($imagen['url_imagen']), // ← SIN $this
                        'orden' => $imagen['orden'],
                        'fecha_subida' => $imagen['fecha_subida']
                    ];
                }, $imagenes);
                
                ob_clean();
                echo json_encode([
                    'exito' => true, 
                    'imagenes' => $imagenesFormateadas,
                    'total' => count($imagenesFormateadas)
                ]);
                
            } catch (Exception $e) {
                error_log("Error al obtener imágenes: " . $e->getMessage());
                ob_clean();
                echo json_encode(['exito' => false, 'error' => 'Error al cargar imágenes']);
            }
            break;
        case 'estadisticas_anfitrion':
            require_once __DIR__ . '/common.php';
            
            $anfitrion_id = $_GET['anfitrion_id'] ?? 0;
            
            try {
                // 1. Total anuncios activos
                $sql_anuncios = "SELECT COUNT(*) as total FROM anuncios WHERE anfitrion_id = ? AND estado = 'activo'";
                $stmt = $conexion->prepare($sql_anuncios);
                $stmt->execute([$anfitrion_id]);
                $total_anuncios = $stmt->fetchColumn();
                
                // 2. Solicitudes recibidas (todas las reservas a sus anuncios)
                $sql_solicitudes = "SELECT COUNT(*) as total 
                                FROM reservas r 
                                JOIN anuncios a ON r.anuncio_id = a.id 
                                WHERE a.anfitrion_id = ?";
                $stmt = $conexion->prepare($sql_solicitudes);
                $stmt->execute([$anfitrion_id]);
                $solicitudes_recibidas = $stmt->fetchColumn();
                
                // 3. Reservas confirmadas
                $sql_reservas = "SELECT COUNT(*) as total 
                                FROM reservas r 
                                JOIN anuncios a ON r.anuncio_id = a.id 
                                WHERE a.anfitrion_id = ? AND r.estado = 'aceptada'";
                $stmt = $conexion->prepare($sql_reservas);
                $stmt->execute([$anfitrion_id]);
                $reservas_confirmadas = $stmt->fetchColumn();
                
                // 4. Calificación promedio (con redondeo a 1 decimal) - CONSULTA CORREGIDA
                $sql_calificacion = "SELECT AVG(re.puntuacion)as promedio
                                    FROM resenas re
                                    WHERE re.destinatario_id = ?";
                $stmt = $conexion->prepare($sql_calificacion);
                $stmt->execute([$anfitrion_id]);
                $calificacion_promedio = $stmt->fetchColumn();
                
                // 5. Solicitudes pendientes (para el badge)
                $sql_pendientes = "SELECT COUNT(*) as total 
                                FROM reservas r 
                                JOIN anuncios a ON r.anuncio_id = a.id 
                                WHERE a.anfitrion_id = ? AND r.estado = 'pendiente'";
                $stmt = $conexion->prepare($sql_pendientes);
                $stmt->execute([$anfitrion_id]);
                $solicitudes_pendientes = $stmt->fetchColumn();
                
                $estadisticas = [
                    'total_anuncios' => (int)$total_anuncios,
                    'solicitudes_recibidas' => (int)$solicitudes_recibidas,
                    'reservas_confirmadas' => (int)$reservas_confirmadas,
                    'calificacion_promedio' => $calificacion_promedio ? (float)$calificacion_promedio : 0.0,
                    'solicitudes_pendientes' => (int)$solicitudes_pendientes
                ];
                ob_clean();
                echo json_encode(['exito' => true, 'estadisticas' => $estadisticas]);
                
            } catch (PDOException $e) {
                error_log("Error en estadísticas anfitrión: " . $e->getMessage());
                ob_clean();
                echo json_encode(['exito' => false, 'error' => 'Error al cargar estadísticas']);
            }
            break;
        
        default:
            error_log("❌ Acción no válida: " . $accion);
            ob_clean();
            echo json_encode([
                'exito' => false, 
                'error' => 'Acción no válida: ' . $accion,
                'acciones_validas' => [
                    'obtener_por_anfitrion', 
                    'obtener_por_id', 
                    'crear', 
                    'actualizar', 
                    'eliminar', 
                    'buscar'
                ]
            ]);
            break;
    }

} catch (Exception $e) {
    error_log("💥 ERROR CAPTURADO en anuncios.php: " . $e->getMessage());
    error_log("📋 STACK TRACE: " . $e->getTraceAsString());
    
    // Limpiar buffer y enviar error con detalles
    ob_clean();
    echo json_encode([
        'exito' => false, 
        'error' => 'Error interno del servidor: ' . $e->getMessage(),
        'debug' => [
            'archivo' => $e->getFile(),
            'linea' => $e->getLine(),
            'trace' => $e->getTrace()
        ]
    ]);
    exit;
}
// Limpiar buffer exitosamente
$output = ob_get_clean();
if (!empty($output)) {
    error_log("📤 Output final: " . substr($output, 0, 500));
    echo $output;
}
?>