<?php
require_once __DIR__ . '/common.php';
require_once $ruta_base . '/../app/modelos/Usuario.php';
require_once $ruta_base . '/../app/modelos/Anuncio.php';

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

    $usuarioModel = new Usuario($GLOBALS['conexion']);
    $anuncioModel = new Anuncio($GLOBALS['conexion']);

    // Primero verificar si es acción que requiere autenticación de admin
    $accionesQueRequierenAdmin = [
        'obtener_reportes', 'obtener_detalle_reporte', 'cambiar_estado_reporte', 
        'tomar_accion_reporte', 'bloquear_usuario_reporte'
    ];
    
    if (in_array($accion, $accionesQueRequierenAdmin)) {
        // Verificar que sea administrador
        $usuario = verificarAdmin();
    }

    switch ($accion) {
        case 'suspender_usuario':
            if (empty($datos['usuario_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de usuario no especificado']);
                return;
            }
            
            $resultado = $usuarioModel->actualizarEstado($datos['usuario_id'], 'inactivo');
            echo json_encode($resultado);
            break;
        
        case 'activar_usuario':
            if (empty($datos['usuario_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de usuario no especificado']);
                return;
            }
            
            $resultado = $usuarioModel->actualizarEstado($datos['usuario_id'], 'activo');
            echo json_encode($resultado);
            break;
        
        case 'eliminar_usuario':
            if (empty($datos['usuario_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de usuario no especificado']);
                return;
            }
            
            // Primero eliminar anuncios del usuario si es anfitrión
            $sqlAnuncios = "DELETE FROM anuncios WHERE anfitrion_id = ?";
            $stmtAnuncios = $GLOBALS['conexion']->prepare($sqlAnuncios);
            $stmtAnuncios->execute([$datos['usuario_id']]);
            
            // Luego eliminar el usuario
            $sql = "DELETE FROM usuarios WHERE id = ? AND rol != 'administrador'";
            $stmt = $GLOBALS['conexion']->prepare($sql);
            $stmt->execute([$datos['usuario_id']]);
            
            if ($stmt->rowCount() > 0) {
                echo json_encode(['exito' => true, 'mensaje' => 'Usuario eliminado correctamente']);
            } else {
                echo json_encode(['exito' => false, 'error' => 'No se pudo eliminar el usuario']);
            }
            break;
        
        case 'eliminar_anuncio':
            if (empty($datos['anuncio_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de anuncio no especificado']);
                return;
            }
            
            // Como admin, podemos eliminar cualquier anuncio
            $sql = "DELETE FROM anuncios WHERE id = ?";
            $stmt = $GLOBALS['conexion']->prepare($sql);
            $stmt->execute([$datos['anuncio_id']]);
            
            if ($stmt->rowCount() > 0) {
                echo json_encode(['exito' => true, 'mensaje' => 'Anuncio eliminado correctamente']);
            } else {
                echo json_encode(['exito' => false, 'error' => 'No se pudo eliminar el anuncio']);
            }
            break;
        
        // ================== NUEVAS ACCIONES PARA REPORTES ==================
        case 'obtener_reportes':
            // Obtener reportes con información de usuarios
            $sql = "
                SELECT 
                    r.*,
                    -- Información del reportador
                    ur.id as reportador_id,
                    ur.nombre as reportador_nombre,
                    ur.apellido as reportador_apellido,
                    ur.correo as reportador_correo,
                    ur.rol as reportador_rol,
                    pr.foto_perfil as reportador_foto_perfil,
                    -- Información del usuario reportado (si aplica)
                    urep.id as reportado_id,
                    urep.nombre as reportado_nombre,
                    urep.apellido as reportado_apellido,
                    urep.correo as reportado_correo,
                    prep.foto_perfil as reportado_foto_perfil,
                    -- Información del anuncio reportado (si aplica)
                    ar.titulo as anuncio_titulo,
                    ar.ubicacion as anuncio_ubicacion,
                    -- Información de publicación reportada (si aplica)
                    prc.titulo as publicacion_titulo,
                    prc.contenido as publicacion_contenido
                FROM reportes r
                LEFT JOIN usuarios ur ON r.usuario_reportador_id = ur.id
                LEFT JOIN perfiles pr ON ur.id = pr.usuario_id
                LEFT JOIN usuarios urep ON r.usuario_reportado_id = urep.id
                LEFT JOIN perfiles prep ON urep.id = prep.usuario_id
                LEFT JOIN anuncios ar ON r.anuncio_reportado_id = ar.id
                LEFT JOIN comunidad_publicaciones prc ON r.publicacion_reportada_id = prc.id
                ORDER BY r.fecha_reporte DESC
            ";
            
            $stmt = $GLOBALS['conexion']->prepare($sql);
            $stmt->execute();
            $reportes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Contar reportes por estado
            $pendientes = 0;
            $revisados = 0;
            $resueltos = 0;
            
            foreach ($reportes as $reporte) {
                switch ($reporte['estado']) {
                    case 'pendiente': $pendientes++; break;
                    case 'revisado': $revisados++; break;
                    case 'resuelto': $resueltos++; break;
                }
            }
            
            echo json_encode([
                'exito' => true,
                'reportes' => $reportes,
                'total' => count($reportes),
                'estadisticas' => [
                    'pendientes' => $pendientes,
                    'revisados' => $revisados,
                    'resueltos' => $resueltos
                ]
            ]);
            break;
        
        case 'obtener_detalle_reporte':
            if (!isset($datos['reporte_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de reporte no especificado']);
                return;
            }
            
            $sql = "
                SELECT 
                    r.*,
                    -- Información del reportador
                    ur.id as reportador_id,
                    ur.nombre as reportador_nombre,
                    ur.apellido as reportador_apellido,
                    ur.correo as reportador_correo,
                    ur.rol as reportador_rol,
                    ur.estado as reportador_estado,
                    pr.foto_perfil as reportador_foto_perfil,
                    pr.biografia as reportador_biografia,
                    pr.telefono as reportador_telefono,
                    pr.pais as reportador_pais,
                    pr.ciudad as reportador_ciudad,
                    -- Información del usuario reportado (si aplica)
                    urep.id as reportado_id,
                    urep.nombre as reportado_nombre,
                    urep.apellido as reportado_apellido,
                    urep.correo as reportado_correo,
                    urep.estado as reportado_estado,
                    prep.foto_perfil as reportado_foto_perfil,
                    prep.biografia as reportado_biografia,
                    prep.telefono as reportado_telefono,
                    prep.pais as reportado_pais,
                    prep.ciudad as reportado_ciudad,
                    -- Información del anuncio reportado (si aplica)
                    ar.id as anuncio_id,
                    ar.titulo as anuncio_titulo,
                    ar.descripcion as anuncio_descripcion,
                    ar.ubicacion as anuncio_ubicacion,
                    ar.tipo_actividad as anuncio_tipo_actividad,
                    ar.estado as anuncio_estado,
                    ar.fecha_publicacion as anuncio_fecha_publicacion,
                    -- Información de publicación reportada (si aplica)
                    prc.id as publicacion_id,
                    prc.titulo as publicacion_titulo,
                    prc.contenido as publicacion_contenido,
                    prc.tipo as publicacion_tipo,
                    prc.estado as publicacion_estado,
                    prc.fecha_publicacion as publicacion_fecha_publicacion
                FROM reportes r
                LEFT JOIN usuarios ur ON r.usuario_reportador_id = ur.id
                LEFT JOIN perfiles pr ON ur.id = pr.usuario_id
                LEFT JOIN usuarios urep ON r.usuario_reportado_id = urep.id
                LEFT JOIN perfiles prep ON urep.id = prep.usuario_id
                LEFT JOIN anuncios ar ON r.anuncio_reportado_id = ar.id
                LEFT JOIN comunidad_publicaciones prc ON r.publicacion_reportada_id = prc.id
                WHERE r.id = ?
            ";
            
            $stmt = $GLOBALS['conexion']->prepare($sql);
            $stmt->execute([$datos['reporte_id']]);
            $reporte = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($reporte) {
                // Intentar parsear el motivo si es JSON (para reportes de mensajes)
                if ($reporte['tipo'] === 'mensaje' && $reporte['motivo'] && $reporte['motivo'][0] === '{') {
                    try {
                        $motivoJson = json_decode($reporte['motivo'], true);
                        if ($motivoJson && isset($motivoJson['motivo_texto'])) {
                            $reporte['motivo_parseado'] = $motivoJson;
                        }
                    } catch (Exception $e) {
                        // Si falla el parseo, mantener el motivo original
                        error_log("Error parseando JSON del motivo: " . $e->getMessage());
                    }
                }
                
                echo json_encode(['exito' => true, 'reporte' => $reporte]);
            } else {
                echo json_encode(['exito' => false, 'error' => 'Reporte no encontrado']);
            }
            break;
        
        case 'cambiar_estado_reporte':
            if (!isset($datos['reporte_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de reporte no especificado']);
                return;
            }
            
            if (!isset($datos['nuevo_estado'])) {
                echo json_encode(['exito' => false, 'error' => 'Nuevo estado no especificado']);
                return;
            }
            
            // Validar que el estado sea válido
            $estadosValidos = ['pendiente', 'revisado', 'resuelto'];
            if (!in_array($datos['nuevo_estado'], $estadosValidos)) {
                echo json_encode(['exito' => false, 'error' => 'Estado no válido. Estados válidos: ' . implode(', ', $estadosValidos)]);
                return;
            }
            
            $sql = "UPDATE reportes SET estado = ? WHERE id = ?";
            $stmt = $GLOBALS['conexion']->prepare($sql);
            $stmt->execute([$datos['nuevo_estado'], $datos['reporte_id']]);
            
            if ($stmt->rowCount() > 0) {
                echo json_encode(['exito' => true, 'mensaje' => 'Estado actualizado correctamente']);
            } else {
                echo json_encode(['exito' => false, 'error' => 'No se pudo actualizar el estado']);
            }
            break;
        
        case 'tomar_accion_reporte':
            if (!isset($datos['reporte_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de reporte no especificado']);
                return;
            }
            
            if (!isset($datos['tipo_accion'])) {
                echo json_encode(['exito' => false, 'error' => 'Tipo de acción no especificado']);
                return;
            }
            
            $detalleAccion = $datos['detalle_accion'] ?? '';
            
            // Primero, obtener información del reporte
            $sqlReporte = "SELECT * FROM reportes WHERE id = ?";
            $stmtReporte = $GLOBALS['conexion']->prepare($sqlReporte);
            $stmtReporte->execute([$datos['reporte_id']]);
            $reporte = $stmtReporte->fetch(PDO::FETCH_ASSOC);
            
            if (!$reporte) {
                echo json_encode(['exito' => false, 'error' => 'Reporte no encontrado']);
                return;
            }
            
            $tipoAccion = $datos['tipo_accion'];
            $resultadoAccion = false;
            $mensajeAccion = '';
            
            switch ($tipoAccion) {
                case 'advertencia':
                    // Crear notificación de advertencia para el usuario reportado
                    if ($reporte['usuario_reportado_id']) {
                        $sqlNotificacion = "
                            INSERT INTO notificaciones 
                            (usuario_id, tipo, titulo, contenido, enlace)
                            VALUES (?, 'sistema', 'Advertencia por reporte', ?, ?)
                        ";
                        $stmtNotif = $GLOBALS['conexion']->prepare($sqlNotificacion);
                        $enlace = "#";
                        $stmtNotif->execute([
                            $reporte['usuario_reportado_id'],
                            "Has recibido una advertencia por un reporte. Motivo: " . $detalleAccion,
                            $enlace
                        ]);
                        
                        // También marcar el reporte como resuelto
                        $sqlUpdateReporte = "UPDATE reportes SET estado = 'resuelto' WHERE id = ?";
                        $stmtUpdate = $GLOBALS['conexion']->prepare($sqlUpdateReporte);
                        $stmtUpdate->execute([$datos['reporte_id']]);
                        
                        $resultadoAccion = true;
                        $mensajeAccion = 'Advertencia enviada al usuario y reporte marcado como resuelto';
                    } else {
                        echo json_encode(['exito' => false, 'error' => 'Este reporte no tiene un usuario reportado para enviar advertencia']);
                        return;
                    }
                    break;
                
                case 'suspender_usuario':
                    // Suspender usuario reportado temporalmente
                    if ($reporte['usuario_reportado_id']) {
                        $sqlSuspender = "UPDATE usuarios SET estado = 'suspendido' WHERE id = ?";
                        $stmtSuspender = $GLOBALS['conexion']->prepare($sqlSuspender);
                        $stmtSuspender->execute([$reporte['usuario_reportado_id']]);
                        
                        // Crear notificación
                        $sqlNotificacion = "
                            INSERT INTO notificaciones 
                            (usuario_id, tipo, titulo, contenido, enlace)
                            VALUES (?, 'sistema', 'Cuenta suspendida', ?, ?)
                        ";
                        $stmtNotif = $GLOBALS['conexion']->prepare($sqlNotificacion);
                        $enlace = "#";
                        $stmtNotif->execute([
                            $reporte['usuario_reportado_id'],
                            "Tu cuenta ha sido suspendida temporalmente por violar nuestros términos. Motivo: " . $detalleAccion,
                            $enlace
                        ]);
                        
                        // Marcar reporte como resuelto
                        $sqlUpdateReporte = "UPDATE reportes SET estado = 'resuelto' WHERE id = ?";
                        $stmtUpdate = $GLOBALS['conexion']->prepare($sqlUpdateReporte);
                        $stmtUpdate->execute([$datos['reporte_id']]);
                        
                        $resultadoAccion = true;
                        $mensajeAccion = 'Usuario suspendido y notificación enviada';
                    } else {
                        echo json_encode(['exito' => false, 'error' => 'Este reporte no tiene un usuario reportado para suspender']);
                        return;
                    }
                    break;
                
                case 'eliminar_contenido':
                    // Eliminar contenido reportado según el tipo
                    switch ($reporte['tipo']) {
                        case 'anuncio':
                            if ($reporte['anuncio_reportado_id']) {
                                $sqlEliminarAnuncio = "DELETE FROM anuncios WHERE id = ?";
                                $stmtEliminar = $GLOBALS['conexion']->prepare($sqlEliminarAnuncio);
                                $stmtEliminar->execute([$reporte['anuncio_reportado_id']]);
                                $resultadoAccion = $stmtEliminar->rowCount() > 0;
                                $mensajeAccion = 'Anuncio eliminado exitosamente';
                            }
                            break;
                            
                        case 'publicacion':
                            if ($reporte['publicacion_reportada_id']) {
                                $sqlEliminarPublicacion = "DELETE FROM comunidad_publicaciones WHERE id = ?";
                                $stmtEliminar = $GLOBALS['conexion']->prepare($sqlEliminarPublicacion);
                                $stmtEliminar->execute([$reporte['publicacion_reportada_id']]);
                                $resultadoAccion = $stmtEliminar->rowCount() > 0;
                                $mensajeAccion = 'Publicación eliminada exitosamente';
                            }
                            break;
                            
                        case 'mensaje':
                            // Para mensajes, necesitaríamos el ID del mensaje del JSON
                            if ($reporte['tipo'] === 'mensaje' && $reporte['motivo'] && $reporte['motivo'][0] === '{') {
                                try {
                                    $motivoJson = json_decode($reporte['motivo'], true);
                                    if (isset($motivoJson['mensaje_reportado_id'])) {
                                        $sqlEliminarMensaje = "DELETE FROM mensajes WHERE id = ?";
                                        $stmtEliminar = $GLOBALS['conexion']->prepare($sqlEliminarMensaje);
                                        $stmtEliminar->execute([$motivoJson['mensaje_reportado_id']]);
                                        $resultadoAccion = $stmtEliminar->rowCount() > 0;
                                        $mensajeAccion = 'Mensaje eliminado exitosamente';
                                    }
                                } catch (Exception $e) {
                                    error_log("Error al obtener ID del mensaje: " . $e->getMessage());
                                }
                            }
                            break;
                    }
                    
                    if ($resultadoAccion) {
                        // Marcar reporte como resuelto
                        $sqlUpdateReporte = "UPDATE reportes SET estado = 'resuelto' WHERE id = ?";
                        $stmtUpdate = $GLOBALS['conexion']->prepare($sqlUpdateReporte);
                        $stmtUpdate->execute([$datos['reporte_id']]);
                    }
                    break;
                
                case 'archivar':
                    // Simplemente marcar como resuelto
                    $sqlUpdateReporte = "UPDATE reportes SET estado = 'resuelto' WHERE id = ?";
                    $stmtUpdate = $GLOBALS['conexion']->prepare($sqlUpdateReporte);
                    $stmtUpdate->execute([$datos['reporte_id']]);
                    
                    $resultadoAccion = $stmtUpdate->rowCount() > 0;
                    $mensajeAccion = 'Reporte archivado como resuelto';
                    break;
                
                default:
                    echo json_encode(['exito' => false, 'error' => 'Tipo de acción no válido']);
                    return;
            }
            
            if ($resultadoAccion) {
                echo json_encode(['exito' => true, 'mensaje' => $mensajeAccion]);
            } else {
                echo json_encode(['exito' => false, 'error' => 'No se pudo ejecutar la acción']);
            }
            break;
        
        case 'bloquear_usuario_reporte':
            // Bloquear mutuamente a los usuarios involucrados
            if (!isset($datos['reporte_id'])) {
                echo json_encode(['exito' => false, 'error' => 'ID de reporte no especificado']);
                return;
            }
            
            // Obtener el reporte
            $sqlReporte = "SELECT * FROM reportes WHERE id = ?";
            $stmtReporte = $GLOBALS['conexion']->prepare($sqlReporte);
            $stmtReporte->execute([$datos['reporte_id']]);
            $reporte = $stmtReporte->fetch(PDO::FETCH_ASSOC);
            
            if (!$reporte || !$reporte['usuario_reportado_id']) {
                echo json_encode(['exito' => false, 'error' => 'Reporte no encontrado o no tiene usuario reportado']);
                return;
            }
            
            // Verificar si ya existe bloqueo
            $sqlVerificar = "SELECT id FROM bloqueos_usuarios WHERE usuario_bloqueador_id = ? AND usuario_bloqueado_id = ?";
            $stmtVerificar = $GLOBALS['conexion']->prepare($sqlVerificar);
            
            // Bloqueo del reportador hacia el reportado
            $stmtVerificar->execute([$reporte['usuario_reportador_id'], $reporte['usuario_reportado_id']]);
            if ($stmtVerificar->rowCount() == 0) {
                $sqlBloquear = "INSERT INTO bloqueos_usuarios (usuario_bloqueador_id, usuario_bloqueado_id) VALUES (?, ?)";
                $stmtBloquear = $GLOBALS['conexion']->prepare($sqlBloquear);
                $stmtBloquear->execute([$reporte['usuario_reportador_id'], $reporte['usuario_reportado_id']]);
            }
            
            // Bloqueo del reportado hacia el reportador (opcional, si quieres bloqueo mutuo)
            $stmtVerificar->execute([$reporte['usuario_reportado_id'], $reporte['usuario_reportador_id']]);
            if ($stmtVerificar->rowCount() == 0) {
                $sqlBloquear = "INSERT INTO bloqueos_usuarios (usuario_bloqueador_id, usuario_bloqueado_id) VALUES (?, ?)";
                $stmtBloquear = $GLOBALS['conexion']->prepare($sqlBloquear);
                $stmtBloquear->execute([$reporte['usuario_reportado_id'], $reporte['usuario_reportador_id']]);
            }
            
            // Marcar reporte como resuelto
            $sqlUpdateReporte = "UPDATE reportes SET estado = 'resuelto' WHERE id = ?";
            $stmtUpdate = $GLOBALS['conexion']->prepare($sqlUpdateReporte);
            $stmtUpdate->execute([$datos['reporte_id']]);
            
            echo json_encode(['exito' => true, 'mensaje' => 'Usuarios bloqueados mutuamente y reporte resuelto']);
            break;
        
        default:
            echo json_encode([
                'exito' => false, 
                'error' => 'Acción no válida: ' . $accion,
                'acciones_validas' => [
                    'suspender_usuario', 'activar_usuario', 'eliminar_usuario', 'eliminar_anuncio',
                    'obtener_reportes', 'obtener_detalle_reporte', 'cambiar_estado_reporte',
                    'tomar_accion_reporte', 'bloquear_usuario_reporte'
                ]
            ]);
            break;
    }

} catch (Exception $e) {
    error_log("ERROR GENERAL en admin.php: " . $e->getMessage());
    echo json_encode([
        'exito' => false, 
        'error' => 'Error interno del servidor',
        'debug' => $e->getMessage()
    ]);
}
?>