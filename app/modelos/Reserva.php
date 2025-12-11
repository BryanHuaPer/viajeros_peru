<?php
class Reserva {
    private $conexion;
    
    public function __construct($conexion) {
        $this->conexion = $conexion;
    }
    
    /**
     * Crear nueva solicitud de reserva
     */
    public function crear($datos) {
        try {
            // Validar que las fechas no estén en el pasado
            $fechaInicio = $datos['fecha_inicio'];
            $fechaFin = $datos['fecha_fin'];
            
            if (strtotime($fechaInicio) < strtotime(date('Y-m-d'))) {
                return ['exito' => false, 'error' => 'La fecha de inicio no puede ser en el pasado'];
            }
            
            if (strtotime($fechaFin) <= strtotime($fechaInicio)) {
                return ['exito' => false, 'error' => 'La fecha de fin debe ser posterior a la fecha de inicio'];
            }
            
            // Verificar disponibilidad (no hay reservas superpuestas para el mismo anuncio)
            $sqlVerificar = "SELECT COUNT(*) as solapadas 
                            FROM reservas 
                            WHERE anuncio_id = ? 
                            AND estado IN ('pendiente', 'aceptada')
                            AND ((fecha_inicio BETWEEN ? AND ?) 
                                OR (fecha_fin BETWEEN ? AND ?)
                                OR (fecha_inicio <= ? AND fecha_fin >= ?))";
            
            $stmtVerificar = $this->conexion->prepare($sqlVerificar);
            $stmtVerificar->execute([
                $datos['anuncio_id'],
                $fechaInicio, $fechaFin,
                $fechaInicio, $fechaFin,
                $fechaInicio, $fechaFin
            ]);
            
            $resultado = $stmtVerificar->fetch(PDO::FETCH_ASSOC);
            
            if ($resultado['solapadas'] > 0) {
                return ['exito' => false, 'error' => 'Ya existe una reserva en las fechas seleccionadas'];
            }
            
            // Insertar la reserva
            $sql = "INSERT INTO reservas (anuncio_id, viajero_id, fecha_inicio, fecha_fin, mensaje_solicitud) 
                    VALUES (?, ?, ?, ?, ?)";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([
                $datos['anuncio_id'],
                $datos['viajero_id'],
                $fechaInicio,
                $fechaFin,
                $datos['mensaje_solicitud'] ?? ''
            ]);
            
            $reservaId = $this->conexion->lastInsertId();
            
            // Obtener la reserva recién creada con información relacionada
            $reserva = $this->obtenerPorId($reservaId);
            
            return [
                'exito' => true,
                'mensaje' => 'Solicitud de reserva enviada correctamente',
                'reserva' => $reserva
            ];
            
        } catch (PDOException $e) {
            error_log("Error al crear reserva: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al crear la reserva: ' . $e->getMessage()];
        }
    }

    /**
     * Obtener todas los reservas
     */
    public function obtenerTodas() {
        try {
            $sql = "SELECT *
                    FROM reservas 
                    ORDER BY fecha_actualizacion DESC";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute();
            
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Error al obtener reservas: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Obtener reserva por ID
     */
    public function obtenerPorId($id) {
        try {
            $sql = "SELECT r.*, 
                    a.titulo as anuncio_titulo, a.ubicacion as anuncio_ubicacion,
                    u.nombre as viajero_nombre, u.apellido as viajero_apellido, u.correo as viajero_correo,
                    anfitrion.id as anfitrion_id, anfitrion.nombre as anfitrion_nombre, anfitrion.apellido as anfitrion_apellido
                    FROM reservas r
                    JOIN anuncios a ON r.anuncio_id = a.id
                    JOIN usuarios u ON r.viajero_id = u.id
                    JOIN usuarios anfitrion ON a.anfitrion_id = anfitrion.id
                    WHERE r.id = ?";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$id]);
            
            return $stmt->fetch(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Error al obtener reserva por ID: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Obtener reservas por viajero
     */
    public function obtenerPorViajero($viajeroId) {
        try {
            $sql = "SELECT r.*, 
                    a.titulo as anuncio_titulo, a.ubicacion as anuncio_ubicacion,
                    anfitrion.nombre as anfitrion_nombre, anfitrion.apellido as anfitrion_apellido,
                    -- ✅ AGREGAR ya_resenia para viajero
                    COALESCE(
                        (SELECT COUNT(*) FROM resenas 
                        WHERE reserva_id = r.id AND autor_id = r.viajero_id),
                        0
                    ) AS ya_resenia
                    FROM reservas r
                    JOIN anuncios a ON r.anuncio_id = a.id
                    JOIN usuarios anfitrion ON a.anfitrion_id = anfitrion.id
                    WHERE r.viajero_id = ?
                    ORDER BY r.fecha_creacion DESC";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$viajeroId]);
            
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Error al obtener reservas por viajero: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Obtener reservas por anfitrión (de sus anuncios)
     */
    public function obtenerPorAnfitrion($anfitrionId) {
        try {
            $sql = "SELECT r.*, 
                    a.titulo as anuncio_titulo, a.ubicacion as anuncio_ubicacion,
                    u.nombre as viajero_nombre, u.apellido as viajero_apellido, u.correo as viajero_correo,
                    -- ✅ AGREGAR ya_resenia para anfitrión
                    COALESCE(
                        (SELECT COUNT(*) FROM resenas 
                        WHERE reserva_id = r.id AND autor_id = a.anfitrion_id),
                        0
                    ) AS ya_resenia
                    FROM reservas r
                    JOIN anuncios a ON r.anuncio_id = a.id
                    JOIN usuarios u ON r.viajero_id = u.id
                    WHERE a.anfitrion_id = ?
                    ORDER BY r.fecha_creacion DESC";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$anfitrionId]);
            
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Error al obtener reservas por anfitrión: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Actualizar estado de una reserva
     */
    public function actualizarEstado($id, $estado, $anfitrionId = null) {
        try {
            $sql = "UPDATE reservas r
                    JOIN anuncios a ON r.anuncio_id = a.id
                    SET r.estado = ?, r.fecha_actualizacion = CURRENT_TIMESTAMP
                    WHERE r.id = ?";
            
            $params = [$estado, $id];
            
            // Si se proporciona anfitrionId, verificar que el anfitrión es dueño del anuncio
            if ($anfitrionId) {
                $sql .= " AND a.anfitrion_id = ?";
                $params[] = $anfitrionId;
            }
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute($params);
            
            if ($stmt->rowCount() === 0) {
                return ['exito' => false, 'error' => 'No se pudo actualizar la reserva'];
            }
            
            // Obtener la reserva actualizada
            $reserva = $this->obtenerPorId($id);
            
            return [
                'exito' => true,
                'mensaje' => 'Reserva actualizada correctamente',
                'reserva' => $reserva
            ];
            
        } catch (PDOException $e) {
            error_log("Error al actualizar estado de reserva: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al actualizar la reserva: ' . $e->getMessage()];
        }
    }
    
    /**
     * Cancelar reserva (solo el viajero puede cancelar)
     */
    public function cancelar($id, $viajeroId) {
        try {
            $sql = "UPDATE reservas 
                    SET estado = 'cancelada', fecha_actualizacion = CURRENT_TIMESTAMP
                    WHERE id = ? AND viajero_id = ? AND estado IN ('pendiente', 'aceptada')";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$id, $viajeroId]);
            
            if ($stmt->rowCount() === 0) {
                return ['exito' => false, 'error' => 'No se pudo cancelar la reserva'];
            }
            
            return [
                'exito' => true,
                'mensaje' => 'Reserva cancelada correctamente'
            ];
            
        } catch (PDOException $e) {
            error_log("Error al cancelar reserva: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al cancelar la reserva: ' . $e->getMessage()];
        }
    }

    /**
     * Completar reservas automáticamente cuando pasan la fecha_fin
     */
    public static function completarAutomaticamente() {
        require_once __DIR__ . '/../../backend/base_datos/conexion.php';
        
        $conexion = Conexion::obtenerInstancia();
        $conn = $conexion->obtenerConexion();
        
        // Buscar reservas aceptadas cuya fecha_fin ya pasó
        $query = "UPDATE reservas 
                  SET estado = 'completada', 
                      fecha_actualizacion = NOW() 
                  WHERE estado = 'aceptada' 
                  AND fecha_fin < CURDATE() 
                  AND fecha_fin >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
        
        $stmt = $conn->prepare($query);
        $stmt->execute();
        
        $filasAfectadas = $stmt->rowCount();
        
        if ($filasAfectadas > 0) {
            // Obtener las reservas completadas para notificar
            $query = "SELECT r.*, 
                             a.titulo AS anuncio_titulo,
                             u_v.id AS viajero_id,
                             u_v.correo AS viajero_email,
                             u_v.nombre AS viajero_nombre,
                             u_a.id AS anfitrion_id,
                             u_a.correo AS anfitrion_email,
                             u_a.nombre AS anfitrion_nombre
                      FROM reservas r
                      JOIN anuncios a ON r.anuncio_id = a.id
                      JOIN usuarios u_v ON r.viajero_id = u_v.id
                      JOIN usuarios u_a ON a.anfitrion_id = u_a.id
                      WHERE r.estado = 'completada' 
                      AND DATE(r.fecha_actualizacion) = CURDATE()";
            
            $stmt = $conn->prepare($query);
            $stmt->execute();
            $reservasCompletadas = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Crear notificaciones para cada reserva completada
            foreach ($reservasCompletadas as $reserva) {
                self::crearNotificacionesCompletacion($reserva);
            }
            
            return $reservasCompletadas;
        }
        
        return [];
    }
    
    /**
     * Crear notificaciones cuando una reserva se completa
     */
    private static function crearNotificacionesCompletacion($reserva) {
        require_once __DIR__ . '/../../backend/api/notificaciones.php';
        
        // Notificar al VIAJERO
        Notificacion::crear([
            'usuario_id' => $reserva['viajero_id'],
            'tipo' => 'reserva',
            'titulo' => '📅 Estancia Completada',
            'contenido' => "Tu estancia en '{$reserva['anuncio_titulo']}' ha finalizado. ¡Deja una reseña sobre tu experiencia!",
            'enlace' => '/proyectoWeb/viajeros_peru/app/vistas/reservas/mis_reservas.html',
            'data' => json_encode([
                'reserva_id' => $reserva['id'],
                'tipo' => 'completada',
                'accion' => 'dejar_resena'
            ])
        ]);
        
        // Notificar al ANFITRIÓN
        Notificacion::crear([
            'usuario_id' => $reserva['anfitrion_id'],
            'tipo' => 'reserva',
            'titulo' => '📅 Estancia Completada',
            'contenido' => "La estancia de {$reserva['viajero_nombre']} en '{$reserva['anuncio_titulo']}' ha finalizado. ¡Deja una reseña!",
            'enlace' => '/proyectoWeb/viajeros_peru/app/vistas/reservas/mis_reservas.html',
            'data' => json_encode([
                'reserva_id' => $reserva['id'],
                'tipo' => 'completada',
                'accion' => 'dejar_resena'
            ])
        ]);
    }
    
    /**
     * Verificar si una reserva puede recibir reseñas
     */
    public static function puedeRecibirResena($reservaId, $usuarioId) {
        require_once __DIR__ . '/../../backend/base_datos/conexion.php';
        
        $conexion = Conexion::obtenerInstancia();
        $conn = $conexion->obtenerConexion();
        
        $query = "SELECT r.*,
                         a.anfitrion_id,
                         CASE 
                            WHEN :usuario_id = r.viajero_id THEN 'viajero'
                            WHEN :usuario_id = a.anfitrion_id THEN 'anfitrion'
                            ELSE 'no_participante'
                         END AS rol_usuario,
                         (SELECT COUNT(*) FROM resenas WHERE reserva_id = r.id AND autor_id = :usuario_id) AS ya_califico
                  FROM reservas r
                  JOIN anuncios a ON r.anuncio_id = a.id
                  WHERE r.id = :reserva_id
                  AND r.estado = 'completada'
                  AND (r.viajero_id = :usuario_id OR a.anfitrion_id = :usuario_id)";
        
        $stmt = $conn->prepare($query);
        $stmt->execute([
            ':reserva_id' => $reservaId,
            ':usuario_id' => $usuarioId
        ]);
        
        $reserva = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$reserva) {
            return ['puede' => false, 'mensaje' => 'Reserva no encontrada o no completada'];
        }
        
        // Verificar fecha (máximo 30 días para dejar reseña)
        $fechaFin = new DateTime($reserva['fecha_fin']);
        $hoy = new DateTime();
        $diferencia = $hoy->diff($fechaFin)->days;
        
        if ($diferencia > 30) {
            return ['puede' => false, 'mensaje' => 'El período para dejar reseña ha expirado (30 días)'];
        }
        
        if ($reserva['ya_califico'] > 0) {
            return ['puede' => false, 'mensaje' => 'Ya has dejado una reseña para esta estancia'];
        }
        
        return [
            'puede' => true,
            'rol' => $reserva['rol_usuario'],
            'destinatario_id' => $reserva['rol_usuario'] === 'viajero' ? $reserva['anfitrion_id'] : $reserva['viajero_id'],
            'reserva' => $reserva
        ];
    }
}
?>