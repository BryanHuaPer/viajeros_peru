<?php
require_once __DIR__ . '/common.php';
require_once $ruta_base . '/../app/modelos/Reserva.php';

try {
    $datos = [];
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $datos_json = file_get_contents('php://input');
        if (!empty($datos_json)) {
            $datos = json_decode($datos_json, true);
        }
    } else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $datos = $_GET;
    }

    $accion = $datos['accion'] ?? '';

    $reservaModel = new Reserva($GLOBALS['conexion']);

    switch ($accion) {
        case 'crear':
            if (empty($datos['anuncio_id']) || empty($datos['viajero_id']) || empty($datos['fecha_inicio']) || empty($datos['fecha_fin'])) {
                echo json_encode(['exito' => false, 'error' => 'Datos incompletos para crear reserva']);
                return;
            }
            
            $resultado = $reservaModel->crear($datos);
            echo json_encode($resultado);
            break;

        case 'obtener_todas':    
            $reservas = $reservaModel->obtenerTodas();
            echo json_encode(['exito' => true, 'reservas' => $reservas]);
            break;
        
        case 'obtener_por_viajero':
            if (empty($datos['viajero_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de viajero no especificado']);
                return;
            }
            
            try {
                $sql = "SELECT r.*,
                            a.titulo AS anuncio_titulo,
                            a.ubicacion AS anuncio_ubicacion,
                            u_a.nombre AS anfitrion_nombre,
                            u_a.apellido AS anfitrion_apellido,
                            -- ESTA ES LA LÍNEA CRÍTICA
                            COALESCE(
                                (SELECT COUNT(*) FROM resenas 
                                    WHERE reserva_id = r.id AND autor_id = r.viajero_id),
                                0
                            ) AS ya_resenia
                        FROM reservas r
                        JOIN anuncios a ON r.anuncio_id = a.id
                        JOIN usuarios u_a ON a.anfitrion_id = u_a.id
                        WHERE r.viajero_id = ?
                        ORDER BY r.fecha_creacion DESC";
                
                $stmt = $GLOBALS['conexion']->prepare($sql);
                $stmt->execute([$datos['viajero_id']]);
                $reservas = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Debug: ver qué se está devolviendo
                error_log("Reservas para viajero {$datos['viajero_id']}: " . count($reservas));
                if (!empty($reservas)) {
                    error_log("Primera reserva: " . json_encode($reservas[0]));
                }
                
                echo json_encode(['exito' => true, 'reservas' => $reservas]);
                
            } catch (PDOException $e) {
                error_log("Error obteniendo reservas de viajero: " . $e->getMessage());
                echo json_encode(['exito' => false, 'error' => 'Error al obtener reservas']);
            }
            break;
        
        case 'obtener_por_anfitrion':
            if (empty($datos['anfitrion_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de anfitrión no especificado']);
                return;
            }
            
            try {
                $sql = "SELECT r.*,
                            a.titulo AS anuncio_titulo,
                            a.ubicacion AS anuncio_ubicacion,
                            u_v.nombre AS viajero_nombre,
                            u_v.apellido AS viajero_apellido,
                            -- ✅ CORRECCIÓN: Verificar si el ANFITRIÓN ya reseñó
                            COALESCE(
                                (SELECT COUNT(*) FROM resenas 
                                WHERE reserva_id = r.id AND autor_id = a.anfitrion_id),
                                0
                            ) AS ya_resenia
                        FROM reservas r
                        JOIN anuncios a ON r.anuncio_id = a.id
                        JOIN usuarios u_v ON r.viajero_id = u_v.id
                        WHERE a.anfitrion_id = ?
                        ORDER BY r.fecha_creacion DESC";
                
                $stmt = $GLOBALS['conexion']->prepare($sql);
                $stmt->execute([$datos['anfitrion_id']]);
                $reservas = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // ✅ DEBUG: Ver qué datos se están devolviendo
                error_log("Reservas para anfitrión {$datos['anfitrion_id']}: " . count($reservas));
                if (!empty($reservas)) {
                    error_log("Primera reserva anfitrión: " . json_encode($reservas[0]));
                }
                
                echo json_encode(['exito' => true, 'reservas' => $reservas]);
                
            } catch (PDOException $e) {
                error_log("Error obteniendo reservas de anfitrión: " . $e->getMessage());
                echo json_encode(['exito' => false, 'error' => 'Error al obtener reservas']);
            }
            break;
        
        case 'actualizar_estado':
            if (empty($datos['id']) || empty($datos['estado'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de reserva o estado no especificado']);
                return;
            }
            
            $anfitrionId = $datos['anfitrion_id'] ?? null;
            $resultado = $reservaModel->actualizarEstado($datos['id'], $datos['estado'], $anfitrionId);
            echo json_encode($resultado);
            break;
        
        case 'cancelar':
            if (empty($datos['id']) || empty($datos['viajero_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de reserva o viajero no especificado']);
                return;
            }
            
            $resultado = $reservaModel->cancelar($datos['id'], $datos['viajero_id']);
            echo json_encode($resultado);
            break;
            
        case 'estadisticas_viajero':
            $viajero_id = $datos['viajero_id'] ?? 0;
            
            try {
                // 1. Solicitudes enviadas
                $sql_enviadas = "SELECT COUNT(*) as total FROM reservas WHERE viajero_id = ?";
                $stmt = $GLOBALS['conexion']->prepare($sql_enviadas);
                $stmt->execute([$viajero_id]);
                $solicitudes_enviadas = $stmt->fetchColumn();
                
                // 2. Solicitudes aceptadas
                $sql_aceptadas = "SELECT COUNT(*) as total FROM reservas WHERE viajero_id = ? AND estado = 'aceptada'";
                $stmt = $GLOBALS['conexion']->prepare($sql_aceptadas);
                $stmt->execute([$viajero_id]);
                $solicitudes_aceptadas = $stmt->fetchColumn();
                
                // 3. Reseñas recibidas (que anfitriones hicieron sobre el viajero)
                $sql_resenas = "SELECT COUNT(*) as total FROM resenas WHERE destinatario_id = ?";
                $stmt = $GLOBALS['conexion']->prepare($sql_resenas);
                $stmt->execute([$viajero_id]);
                $reseñas_recibidas = $stmt->fetchColumn();

                // 4. Calificación promedio del viajero
                $sql_calificacion_viajero = "SELECT ROUND(AVG(puntuacion), 1) as promedio 
                                            FROM resenas 
                                            WHERE destinatario_id = ?";
                $stmt = $GLOBALS['conexion']->prepare($sql_calificacion_viajero);
                $stmt->execute([$viajero_id]);
                $calificacion_promedio = $stmt->fetchColumn();
                
                $estadisticas = [
                    'solicitudes_enviadas' => (int)$solicitudes_enviadas,
                    'solicitudes_aceptadas' => (int)$solicitudes_aceptadas,
                    'reseñas_recibidas' => (int)$reseñas_recibidas,
                    'calificacion_promedio' => $calificacion_promedio ? (float)$calificacion_promedio : 0.0,
                ];
                                
                echo json_encode(['exito' => true, 'estadisticas' => $estadisticas]);
                
            } catch (PDOException $e) {
                error_log("Error en estadísticas viajero: " . $e->getMessage());
                echo json_encode(['exito' => false, 'error' => 'Error al cargar estadísticas']);
            }
            break;

        default:
            echo json_encode([
                'exito' => false, 
                'error' => 'Acción no válida: ' . $accion,
                'acciones_validas' => ['crear', 'obtener_por_viajero', 'obtener_por_anfitrion', 'actualizar_estado', 'cancelar', 'estadisticas_viajero']
            ]);
            break;
    }

} catch (Exception $e) {
    error_log("ERROR GENERAL en reservas.php: " . $e->getMessage());
    echo json_encode([
        'exito' => false, 
        'error' => 'Error interno del servidor',
        'debug' => $e->getMessage()
    ]);
}
?>