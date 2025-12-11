<?php
require_once __DIR__ . '/common.php';
require_once $ruta_base . '/../app/modelos/Resena.php';

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

    $resenaModel = new Resena($GLOBALS['conexion']);

    switch ($accion) {
        case 'crear':
            // Obtener datos del POST
            $datos_json = file_get_contents('php://input');
            $datos = json_decode($datos_json, true);
            
            // ✅ Verificar datos básicos incluyendo autor_id
            if (empty($datos['reserva_id']) || empty($datos['puntuacion']) || empty($datos['autor_id'])) {
                echo json_encode(['exito' => false, 'error' => 'Datos incompletos para crear reseña']);
                return;
            }
            
            // Usar el autor_id que viene en el request
            $autorId = $datos['autor_id'];
            
            // Verificar si puede dejar reseña
            $verificacion = verificarPuedeReseniar($datos['reserva_id'], $autorId);
            
            if (!$verificacion['exito']) {
                echo json_encode($verificacion);
                return;
            }
            
            // ✅ Asegurarse de que el destinatario_id sea correcto
            if (empty($datos['destinatario_id']) || $datos['destinatario_id'] != $verificacion['destinatario_id']) {
                $datos['destinatario_id'] = $verificacion['destinatario_id'];
            }
            
            // Crear la reseña
            $datosResena = [
                'reserva_id' => $datos['reserva_id'],
                'autor_id' => $autorId,
                'destinatario_id' => $datos['destinatario_id'],
                'puntuacion' => $datos['puntuacion'],
                'comentario' => $datos['comentario'] ?? ''
            ];
            
            $resenaModel = new Resena($GLOBALS['conexion']);
            $resultado = $resenaModel->crear($datosResena);

            // ✅ Notificar al destinatario si la reseña se creó exitosamente
            if ($resultado['exito']) {
                notificarResenaRecibida(
                    $datos['destinatario_id'],
                    $autorId,
                    $datos['reserva_id'],
                    $datos['puntuacion']
                );
                
                // ✅ Verificar si ambas partes ya reseñaron para publicar reseñas
                verificarResenasDuales($datos['reserva_id']);
            }
            
            echo json_encode($resultado);
            break;

        case 'obtener_todas':
            $resenas = $resenaModel->obtenerTodas();
            echo json_encode(['exito' => true, 'resenas' => $resenas]);
            break;
        
        case 'obtener_por_usuario':
            if (empty($datos['usuario_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de usuario no especificado']);
                return;
            }
            
            try {
                $sql = "SELECT 
                            r.*,
                            u.nombre AS autor_nombre,
                            u.apellido AS autor_apellido,
                            CONCAT(u.nombre, ' ', u.apellido) AS autor_nombre_completo,
                            p.foto_perfil AS autor_foto_perfil,  
                            a.titulo AS anuncio_titulo,
                            re.fecha_inicio,
                            re.fecha_fin,
                            TIMESTAMPDIFF(DAY, re.fecha_inicio, re.fecha_fin) AS duracion_estancia
                        FROM resenas r
                        INNER JOIN usuarios u ON r.autor_id = u.id
                        LEFT JOIN perfiles p ON u.id = p.usuario_id 
                        INNER JOIN reservas re ON r.reserva_id = re.id
                        LEFT JOIN anuncios a ON re.anuncio_id = a.id
                        WHERE r.destinatario_id = :usuario_id
                        ORDER BY r.fecha_creacion DESC";
                
                $stmt = $conexion->prepare($sql);
                $stmt->bindParam(':usuario_id', $datos['usuario_id'], PDO::PARAM_INT);
                $stmt->execute();
                
                $resenas = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Formatear datos adicionales
                foreach ($resenas as &$resena) {
                    // Formatear fecha
                    $fecha = new DateTime($resena['fecha_creacion']);
                    $resena['fecha_formateada'] = $fecha->format('d/m/Y H:i');
                    
                    // Procesar foto del autor (usar placeholder si no tiene)
                    if (empty($resena['autor_foto_perfil'])) {
                        $resena['autor_foto_perfil'] = '/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg';
                    }
                    
                    // Estancia info
                    if ($resena['fecha_inicio'] && $resena['fecha_fin']) {
                        $fechaInicio = new DateTime($resena['fecha_inicio']);
                        $fechaFin = new DateTime($resena['fecha_fin']);
                        $resena['estancia_info'] = [
                            'fecha_inicio' => $fechaInicio->format('d/m/Y'),
                            'fecha_fin' => $fechaFin->format('d/m/Y'),
                            'duracion_dias' => $resena['duracion_estancia']
                        ];
                    }
                }
                
                echo json_encode([
                    'exito' => true, 
                    'resenas' => $resenas,
                    'total' => count($resenas)
                ]);
                
            } catch (Exception $e) {
                echo json_encode([
                    'exito' => false,
                    'error' => 'Error al obtener reseñas: ' . $e->getMessage()
                ]);
            }
            break;
        
        case 'obtener_por_reserva':
            if (empty($datos['reserva_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de reserva no especificado']);
                return;
            }
            
            $resenas = $resenaModel->obtenerPorReserva($datos['reserva_id']);
            echo json_encode(['exito' => true, 'resenas' => $resenas]);
            break;
        
        case 'obtener_promedio':
            if (empty($datos['usuario_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de usuario no especificado']);
                return;
            }
            
            $promedio = $resenaModel->obtenerPromedioUsuario($datos['usuario_id']);
            echo json_encode(['exito' => true, 'promedio' => $promedio]);
            break;

        case 'verificar_puede_reseniar':
            // Verificar autenticación
            if (empty($datos['token'])) {
                echo json_encode(['exito' => false, 'error' => 'Token no proporcionado']);
                return;
            }
            
            // Validar token (necesitas la función JWT)
            require_once dirname(__DIR__) . '/helpers/jwt.php';
            $payload = JWT::validarToken($datos['token']);
            
            if (!$payload) {
                echo json_encode(['exito' => false, 'error' => 'Token inválido o expirado']);
                return;
            }
            
            if (empty($datos['reserva_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de reserva no especificado']);
                return;
            }
            
            // Usar la función que ya tienes
            $resultado = verificarPuedeReseniar($datos['reserva_id'], $payload['usuario_id']);
            echo json_encode($resultado);
            break;
        case 'obtener_por_anuncio':
            if (empty($datos['anuncio_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de anuncio no especificado']);
                return;
            }
            
            try {
                $sql = "SELECT 
                            r.*,
                            u.nombre AS autor_nombre,
                            u.apellido AS autor_apellido,
                            CONCAT(u.nombre, ' ', u.apellido) AS autor_nombre_completo,
                            p.foto_perfil AS autor_foto_perfil,
                            re.fecha_inicio,
                            re.fecha_fin,
                            TIMESTAMPDIFF(DAY, re.fecha_inicio, re.fecha_fin) AS duracion_estancia,
                            CASE 
                                WHEN re.viajero_id = r.autor_id THEN 'viajero'
                                WHEN a.anfitrion_id = r.autor_id THEN 'anfitrion'
                                ELSE 'desconocido'
                            END AS rol_autor
                        FROM resenas r
                        INNER JOIN usuarios u ON r.autor_id = u.id
                        LEFT JOIN perfiles p ON u.id = p.usuario_id
                        INNER JOIN reservas re ON r.reserva_id = re.id
                        INNER JOIN anuncios a ON re.anuncio_id = a.id
                        WHERE a.id = :anuncio_id
                        AND r.destinatario_id = a.anfitrion_id
                        ORDER BY r.fecha_creacion DESC";
                
                $stmt = $conexion->prepare($sql);
                $stmt->bindParam(':anuncio_id', $datos['anuncio_id'], PDO::PARAM_INT);
                $stmt->execute();
                
                $resenas = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Calcular estadísticas
                $totalResenas = count($resenas);
                $promedio = 0;
                $distribucion = [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0];
                
                foreach ($resenas as &$resena) {
                    // Formatear fecha
                    $fecha = new DateTime($resena['fecha_creacion']);
                    $resena['fecha_formateada'] = $fecha->format('d/m/Y H:i');
                    
                    // Procesar foto del autor
                    if (empty($resena['autor_foto_perfil'])) {
                        $resena['autor_foto_perfil'] = '/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg';
                    }
                    
                    // Estancia info
                    if ($resena['fecha_inicio'] && $resena['fecha_fin']) {
                        $fechaInicio = new DateTime($resena['fecha_inicio']);
                        $fechaFin = new DateTime($resena['fecha_fin']);
                        $resena['estancia_info'] = [
                            'fecha_inicio' => $fechaInicio->format('d/m/Y'),
                            'fecha_fin' => $fechaFin->format('d/m/Y'),
                            'duracion_dias' => $resena['duracion_estancia']
                        ];
                    }
                    
                    // Para estadísticas
                    $puntuacion = (int)$resena['puntuacion'];
                    if (isset($distribucion[$puntuacion])) {
                        $distribucion[$puntuacion]++;
                    }
                    $promedio += $puntuacion;
                }
                
                if ($totalResenas > 0) {
                    $promedio = round($promedio / $totalResenas, 1);
                }
                
                echo json_encode([
                    'exito' => true, 
                    'resenas' => $resenas,
                    'total' => $totalResenas,
                    'promedio' => $promedio,
                    'distribucion' => $distribucion
                ]);
                
            } catch (Exception $e) {
                echo json_encode([
                    'exito' => false,
                    'error' => 'Error al obtener reseñas: ' . $e->getMessage()
                ]);
            }
            break;
        
        default:
            echo json_encode([
                'exito' => false, 
                'error' => 'Acción no válida: ' . $accion,
                'acciones_validas' => ['crear', 'obtener_por_usuario', 'obtener_por_reserva', 'obtener_promedio']
            ]);
            break;
    }

} catch (Exception $e) {
    error_log("ERROR GENERAL en resenas.php: " . $e->getMessage());
    echo json_encode([
        'exito' => false, 
        'error' => 'Error interno del servidor',
        'debug' => $e->getMessage()
    ]);
}


// =================================================================
// FUNCIONES AUXILIARES NUEVAS
// =================================================================

/**
 * Verificar si un usuario puede dejar reseña para una reserva
 */
function verificarPuedeReseniar($reservaId, $usuarioId) {
    $conexion = $GLOBALS['conexion'];
    
    try {
        $sql = "SELECT r.id, 
                       r.viajero_id, 
                       r.fecha_inicio, 
                       r.fecha_fin,
                       r.estado AS reserva_estado,
                       r.fecha_creacion,
                       a.anfitrion_id,
                       a.titulo AS anuncio_titulo,
                       CASE 
                          WHEN ? = r.viajero_id THEN 'viajero'
                          WHEN ? = a.anfitrion_id THEN 'anfitrion'
                          ELSE 'no_participante'
                       END AS rol_usuario,
                       (SELECT COUNT(*) FROM resenas WHERE reserva_id = r.id AND autor_id = ?) AS ya_califico
                FROM reservas r
                JOIN anuncios a ON r.anuncio_id = a.id
                WHERE r.id = ?";
        
        $stmt = $conexion->prepare($sql);
        $stmt->execute([$usuarioId, $usuarioId, $usuarioId, $reservaId]);
        $reserva = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$reserva) {
            return ['exito' => false, 'error' => 'Reserva no encontrada'];
        }
        
        if ($reserva['reserva_estado'] !== 'completada') {
            return ['exito' => false, 'error' => 'Solo puedes dejar reseñas en reservas completadas'];
        }
        
        if ($reserva['rol_usuario'] === 'no_participante') {
            return ['exito' => false, 'error' => 'No participaste en esta reserva'];
        }
        
        // ✅ Primero verificar si ya calificó
        if ($reserva['ya_califico'] > 0) {
            return [
                'exito' => false, 
                'error' => 'Ya dejaste una reseña para esta estancia',
                'ya_califico' => true  // ✅ Nueva bandera
            ];
        }
        
        // ✅ Luego verificar límite de tiempo
        $fechaFin = new DateTime($reserva['fecha_fin']);
        $hoy = new DateTime();
        $diferencia = $hoy->diff($fechaFin)->days;
        
        if ($diferencia > 30) {
            return [
                'exito' => false, 
                'error' => 'El período para dejar reseña ha expirado (30 días)',
                'periodo_expirado' => true  // ✅ Nueva bandera
            ];
        }
        
        $destinatarioId = ($reserva['rol_usuario'] === 'viajero') 
            ? $reserva['anfitrion_id'] 
            : $reserva['viajero_id'];
        
        return [
            'exito' => true,
            'rol' => $reserva['rol_usuario'],
            'destinatario_id' => $destinatarioId,
            'reserva' => [
                'id' => $reserva['id'],
                'titulo' => $reserva['anuncio_titulo'] ?? 'Reserva sin título',
                'fecha_fin' => $reserva['fecha_fin']
            ]
        ];
        
    } catch (PDOException $e) {
        error_log("Error verificando reseña: " . $e->getMessage());
        return ['exito' => false, 'error' => 'Error al verificar: ' . $e->getMessage()];
    }
}

/**
 * Verificar si ambas partes ya calificaron para publicar reseñas
 */
function verificarResenasDuales($reservaId) {
    $conexion = $GLOBALS['conexion'];
    
    try {
        // Contar reseñas diferentes
        $sql = "SELECT COUNT(DISTINCT autor_id) as total_autores
                FROM resenas 
                WHERE reserva_id = ?";
        
        $stmt = $conexion->prepare($sql);
        $stmt->execute([$reservaId]);
        $resultado = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Si ambas partes ya calificaron (2 autores diferentes)
        if ($resultado['total_autores'] >= 2) {
            // Obtener información de la reserva
            $sqlReserva = "SELECT r.viajero_id, a.anfitrion_id, a.titulo
                          FROM reservas r
                          JOIN anuncios a ON r.anuncio_id = a.id
                          WHERE r.id = ?";
            
            $stmtReserva = $conexion->prepare($sqlReserva);
            $stmtReserva->execute([$reservaId]);
            $reserva = $stmtReserva->fetch(PDO::FETCH_ASSOC);
            
            // Enviar notificaciones a ambos
            enviarNotificacionResenasPublicadas($reserva['viajero_id'], $reserva['titulo']);
            enviarNotificacionResenasPublicadas($reserva['anfitrion_id'], $reserva['titulo']);
            
            return true;
        }
        
        return false;
        
    } catch (PDOException $e) {
        error_log("Error verificando reseñas duales: " . $e->getMessage());
        return false;
    }
}

/**
 * Enviar notificación de reseñas publicadas
 */
function enviarNotificacionResenasPublicadas($usuarioId, $tituloAnuncio) {
    $conexion = $GLOBALS['conexion'];
    
    try {
        $sql = "INSERT INTO notificaciones 
                (usuario_id, tipo, titulo, contenido, enlace, leido, fecha_creacion)
                VALUES (?, 'resena', '⭐ Reseñas Publicadas', 
                        'Las reseñas de tu estancia en \"' || ? || '\" han sido publicadas', 
                        '/proyectoWeb/viajeros_peru/app/vistas/reservas/mis_reservas.html', 
                        0, NOW())";
        
        $stmt = $conexion->prepare($sql);
        return $stmt->execute([$usuarioId, $tituloAnuncio]);
        
    } catch (PDOException $e) {
        error_log("Error enviando notificación: " . $e->getMessage());
        return false;
    }
}
/**
 * Notificar cuando se recibe una reseña
 */
function notificarResenaRecibida($destinatarioId, $autorId, $reservaId, $puntuacion) {
    $conexion = $GLOBALS['conexion'];
    
    try {
        // Obtener información del autor
        $sqlAutor = "SELECT nombre, apellido FROM usuarios WHERE id = ?";
        $stmt = $conexion->prepare($sqlAutor);
        $stmt->execute([$autorId]);
        $autor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Obtener información de la reserva
        $sqlReserva = "SELECT a.titulo FROM reservas r 
                       JOIN anuncios a ON r.anuncio_id = a.id 
                       WHERE r.id = ?";
        $stmt = $conexion->prepare($sqlReserva);
        $stmt->execute([$reservaId]);
        $reserva = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Crear notificación
        // 🚨 CAMBIO CLAVE: Usamos el operador de concatenación '||' en lugar de CONCAT()
        $sqlNotif = "INSERT INTO notificaciones 
                     (usuario_id, tipo, titulo, contenido, enlace, leido, fecha_creacion)
                     VALUES (?, 'resena', '⭐ Nueva Reseña Recibida', 
                             '¡' || ? || ' ' || ? || ' te ha dejado una reseña de ' || ? || ' estrellas para \"' || ? || '.\"',
                             '/proyectoWeb/viajeros_peru/app/vistas/perfil/perfilPublico.html?id=', 
                             0, NOW())";
        
        $stmt = $conexion->prepare($sqlNotif);
        $resultado = $stmt->execute([
            $destinatarioId,
            $autor['nombre'] ?? 'Usuario',
            $autor['apellido'] ?? 'Anónimo',
            $puntuacion,
            $reserva['titulo'] ?? 'tu estancia'
        ]);
        
        return $resultado;
        
    } catch (PDOException $e) {
        error_log("Error creando notificación de reseña: " . $e->getMessage());
        return false;
    }
}
?>