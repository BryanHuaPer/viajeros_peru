<?php
class ActualizadorReservas {
    private $conexion;
    
    public function __construct($conexion) {
        $this->conexion = $conexion;
    }
    
    /**
     * Ejecutar todas las actualizaciones necesarias al iniciar sesión
     */
    public function ejecutarActualizaciones($usuarioId) {
        $resultados = [
            'reservas_completadas' => 0,
            'notificaciones_enviadas' => 0,
            'recordatorios_enviados' => 0
        ];
        
        // 1. Completar reservas vencidas de este usuario
        $resultados['reservas_completadas'] = $this->completarReservasVencidas($usuarioId);
        
        // 2. Enviar notificaciones para reservas recién completadas
        $resultados['notificaciones_enviadas'] = $this->enviarNotificacionesCompletadas($usuarioId);
        
        // 3. Enviar recordatorios de reseñas pendientes
        $resultados['recordatorios_enviados'] = $this->enviarRecordatoriosResenas($usuarioId);
        
        return $resultados;
    }
    
    /**
     * Completar reservas aceptadas cuya fecha_fin ya pasó
     */
    private function completarReservasVencidas($usuarioId) {
        try {
            $sql = "UPDATE reservas r
                    JOIN anuncios a ON r.anuncio_id = a.id
                    SET r.estado = 'completada',
                        r.fecha_actualizacion = NOW()
                    WHERE r.estado = 'aceptada'
                    AND r.fecha_fin < CURDATE()
                    AND (r.viajero_id = ? OR a.anfitrion_id = ?)";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuarioId, $usuarioId]);
            
            return $stmt->rowCount();
            
        } catch (PDOException $e) {
            error_log("Error completando reservas vencidas: " . $e->getMessage());
            return 0;
        }
    }
    
    /**
     * Enviar notificaciones para reservas recién completadas
     */
    private function enviarNotificacionesCompletadas($usuarioId) {
        try {
            // Buscar reservas completadas hoy
            $sql = "SELECT r.id, r.anuncio_id, a.titulo,
                           u_v.nombre AS viajero_nombre,
                           u_a.nombre AS anfitrion_nombre,
                           CASE 
                              WHEN r.viajero_id = ? THEN 'viajero'
                              ELSE 'anfitrion'
                           END AS rol_usuario
                    FROM reservas r
                    JOIN anuncios a ON r.anuncio_id = a.id
                    JOIN usuarios u_v ON r.viajero_id = u_v.id
                    JOIN usuarios u_a ON a.anfitrion_id = u_a.id
                    WHERE r.estado = 'completada'
                    AND DATE(r.fecha_actualizacion) = CURDATE()
                    AND (r.viajero_id = ? OR a.anfitrion_id = ?)";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuarioId, $usuarioId, $usuarioId]);
            $reservas = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $notificaciones = 0;
            
            foreach ($reservas as $reserva) {
                $mensaje = ($reserva['rol_usuario'] == 'viajero') 
                    ? "Tu estancia en '{$reserva['titulo']}' ha finalizado. ¡Deja una reseña sobre tu experiencia!"
                    : "La estancia de {$reserva['viajero_nombre']} ha finalizado. ¡Deja una reseña!";
                
                $this->crearNotificacion($usuarioId, 'reserva', '📅 Estancia Completada', $mensaje);
                $notificaciones++;
            }
            
            return $notificaciones;
            
        } catch (PDOException $e) {
            error_log("Error enviando notificaciones: " . $e->getMessage());
            return 0;
        }
    }
    
    /**
     * Enviar recordatorios de reseñas pendientes
     */
    private function enviarRecordatoriosResenas($usuarioId) {
        try {
            // Buscar reservas completadas sin reseña (hasta 30 días después)
            $sql = "SELECT r.id, a.titulo, 
                           DATEDIFF(CURDATE(), r.fecha_fin) AS dias_desde_fin,
                           (SELECT COUNT(*) FROM resenas WHERE reserva_id = r.id AND autor_id = ?) AS ya_resenio
                    FROM reservas r
                    JOIN anuncios a ON r.anuncio_id = a.id
                    WHERE r.estado = 'completada'
                    AND (r.viajero_id = ? OR a.anfitrion_id = ?)
                    AND DATEDIFF(CURDATE(), r.fecha_fin) BETWEEN 1 AND 30
                    HAVING ya_resenio = 0";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuarioId, $usuarioId, $usuarioId]);
            $reservas = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $recordatorios = 0;
            
            foreach ($reservas as $reserva) {
                $dias = $reserva['dias_desde_fin'];
                $diasRecordatorio = [1, 3, 7, 14, 30]; // Días para recordar
                
                if (in_array($dias, $diasRecordatorio)) {
                    $mensaje = "Han pasado {$dias} días desde tu estancia. ¡No olvides dejar tu reseña!";
                    
                    // Verificar si ya se envió este recordatorio hoy
                    $sqlCheck = "SELECT COUNT(*) as enviado_hoy FROM notificaciones 
                                 WHERE usuario_id = ? 
                                 AND tipo = 'recordatorio'
                                 AND contenido LIKE ?
                                 AND DATE(fecha_creacion) = CURDATE()";
                    
                    $stmtCheck = $this->conexion->prepare($sqlCheck);
                    $stmtCheck->execute([$usuarioId, "%{$dias} días%"]);
                    $yaEnviado = $stmtCheck->fetch(PDO::FETCH_ASSOC)['enviado_hoy'];
                    
                    if (!$yaEnviado) {
                        $this->crearNotificacion($usuarioId, 'recordatorio', '⭐ Recordatorio de Reseña', $mensaje);
                        $recordatorios++;
                    }
                }
            }
            
            return $recordatorios;
            
        } catch (PDOException $e) {
            error_log("Error enviando recordatorios: " . $e->getMessage());
            return 0;
        }
    }
    
    /**
     * Crear una notificación en la base de datos
     */
    private function crearNotificacion($usuarioId, $tipo, $titulo, $contenido) {
        try {
            $sql = "INSERT INTO notificaciones 
                    (usuario_id, tipo, titulo, contenido, enlace, leido, fecha_creacion)
                    VALUES (?, ?, ?, ?, '/proyectoWeb/viajeros_peru/app/vistas/reservas/mis_reservas.html', 0, NOW())";
            
            $stmt = $this->conexion->prepare($sql);
            return $stmt->execute([$usuarioId, $tipo, $titulo, $contenido]);
            
        } catch (PDOException $e) {
            error_log("Error creando notificación: " . $e->getMessage());
            return false;
        }
    }
}
?>