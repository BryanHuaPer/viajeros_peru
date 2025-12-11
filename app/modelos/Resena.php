<?php
class Resena {
    private $conexion;
    
    public function __construct($conexion) {
        $this->conexion = $conexion;
    }
    
    /**
     * Crear nueva reseña
     */
    public function crear($datos) {
        try {
            // ✅ CORREGIDO: Especificar explícitamente las columnas de reservas
            $sqlReserva = "SELECT r.estado, r.viajero_id, a.anfitrion_id 
                        FROM reservas r
                        JOIN anuncios a ON r.anuncio_id = a.id
                        WHERE r.id = ?";
            
            $stmtReserva = $this->conexion->prepare($sqlReserva);
            $stmtReserva->execute([$datos['reserva_id']]);
            $reserva = $stmtReserva->fetch(PDO::FETCH_ASSOC);
            
            if (!$reserva) {
                return ['exito' => false, 'error' => 'La reserva no existe'];
            }
            
            if ($reserva['estado'] !== 'completada') {
                return ['exito' => false, 'error' => 'Solo se pueden dejar reseñas para reservas completadas'];
            }
            
            // Validar que el autor es parte de la reserva (viajero o anfitrión)
            $esViajero = $reserva['viajero_id'] == $datos['autor_id'];
            $esAnfitrion = $reserva['anfitrion_id'] == $datos['autor_id'];
            
            if (!$esViajero && !$esAnfitrion) {
                return ['exito' => false, 'error' => 'No tienes permiso para dejar una reseña en esta reserva'];
            }
            
            // El destinatario debe ser el otro usuario
            $destinatarioCorrecto = $esViajero ? $reserva['anfitrion_id'] : $reserva['viajero_id'];
            
            if ($datos['destinatario_id'] != $destinatarioCorrecto) {
                return ['exito' => false, 'error' => 'El destinatario de la reseña no es válido'];
            }
            
            // Verificar que no exista ya una reseña del autor para esta reserva
            $sqlExiste = "SELECT COUNT(*) as existe FROM resenas WHERE reserva_id = ? AND autor_id = ?";
            $stmtExiste = $this->conexion->prepare($sqlExiste);
            $stmtExiste->execute([$datos['reserva_id'], $datos['autor_id']]);
            $resultado = $stmtExiste->fetch(PDO::FETCH_ASSOC);
            
            if ($resultado['existe'] > 0) {
                return ['exito' => false, 'error' => 'Ya has dejado una reseña para esta reserva'];
            }
            
            // Insertar la reseña
            $sql = "INSERT INTO resenas (reserva_id, autor_id, destinatario_id, puntuacion, comentario) 
                    VALUES (?, ?, ?, ?, ?)";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([
                $datos['reserva_id'],
                $datos['autor_id'],
                $datos['destinatario_id'],
                $datos['puntuacion'],
                $datos['comentario'] ?? ''
            ]);
            
            $resenaId = $this->conexion->lastInsertId();
            
            // Obtener la reseña recién creada con información del autor
            $resena = $this->obtenerPorId($resenaId);
            
            return [
                'exito' => true,
                'mensaje' => 'Reseña publicada correctamente',
                'resena' => $resena
            ];
            
        } catch (PDOException $e) {
            error_log("Error al crear reseña: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al crear la reseña: ' . $e->getMessage()];
        }
    }

    /**
     * Obtener todas los reseñas
     */
    public function obtenerTodas() {
        try {
            $sql = "SELECT *
                    FROM resenas 
                    ORDER BY fecha_creacion DESC";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute();
            
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Error al obtener resenas: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Obtener reseña por ID
     */
    public function obtenerPorId($id) {
        try {
            $sql = "SELECT r.*, 
                    u.nombre as autor_nombre, u.apellido as autor_apellido,
                    d.nombre as destinatario_nombre, d.apellido as destinatario_apellido
                    FROM resenas r
                    JOIN usuarios u ON r.autor_id = u.id
                    JOIN usuarios d ON r.destinatario_id = d.id
                    WHERE r.id = ?";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$id]);
            
            return $stmt->fetch(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Error al obtener reseña por ID: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Obtener reseñas por usuario (destinatario)
     */
    public function obtenerPorUsuario($usuarioId) {
        try {
            $sql = "SELECT r.*, 
                    u.nombre as autor_nombre, u.apellido as autor_apellido,
                    res.titulo as anuncio_titulo, res.anuncio_ubicacion
                    FROM resenas r
                    JOIN usuarios u ON r.autor_id = u.id
                    JOIN (
                        SELECT re.id as reserva_id, a.titulo, a.ubicacion as anuncio_ubicacion
                        FROM reservas re
                        JOIN anuncios a ON re.anuncio_id = a.id
                    ) res ON r.reserva_id = res.reserva_id
                    WHERE r.destinatario_id = ?
                    ORDER BY r.fecha_creacion DESC";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuarioId]);
            
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Error al obtener reseñas por usuario: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Obtener reseñas por reserva
     */
    public function obtenerPorReserva($reservaId) {
        try {
            $sql = "SELECT r.*, 
                    u.nombre as autor_nombre, u.apellido as autor_apellido
                    FROM resenas r
                    JOIN usuarios u ON r.autor_id = u.id
                    WHERE r.reserva_id = ?";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$reservaId]);
            
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Error al obtener reseñas por reserva: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Calcular promedio de puntuaciones de un usuario
     */
    public function obtenerPromedioUsuario($usuarioId) {
        try {
            $sql = "SELECT AVG(puntuacion) as promedio, COUNT(*) as total
                    FROM resenas 
                    WHERE destinatario_id = ?";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuarioId]);
            
            return $stmt->fetch(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Error al obtener promedio de usuario: " . $e->getMessage());
            return ['promedio' => 0, 'total' => 0];
        }
    }
}
?>