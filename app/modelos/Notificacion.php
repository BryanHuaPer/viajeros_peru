// viajeros_peru/app/modelos/Notificacion.php
<?php
class Notificacion {
    public static function crear($datos) {
        require_once __DIR__ . '/../../backend/base_datos/conexion.php';
        
        $conexion = Conexion::obtenerInstancia();
        $conn = $conexion->obtenerConexion();
        
        $query = "INSERT INTO notificaciones (usuario_id, tipo, titulo, contenido, enlace, data, fecha_creacion) 
                  VALUES (:usuario_id, :tipo, :titulo, :contenido, :enlace, :data, NOW())";
        
        $stmt = $conn->prepare($query);
        return $stmt->execute([
            ':usuario_id' => $datos['usuario_id'],
            ':tipo' => $datos['tipo'],
            ':titulo' => $datos['titulo'],
            ':contenido' => $datos['contenido'],
            ':enlace' => $datos['enlace'] ?? null,
            ':data' => $datos['data'] ?? null
        ]);
    }
    
    public static function obtenerParaUsuario($usuarioId, $noLeidas = false) {
        require_once __DIR__ . '/../../backend/base_datos/conexion.php';
        
        $conexion = Conexion::obtenerInstancia();
        $conn = $conexion->obtenerConexion();
        
        $where = $noLeidas ? "WHERE usuario_id = :usuario_id AND leido = 0" 
                           : "WHERE usuario_id = :usuario_id";
        
        $query = "SELECT * FROM notificaciones 
                  $where 
                  ORDER BY fecha_creacion DESC 
                  LIMIT 50";
        
        $stmt = $conn->prepare($query);
        $stmt->execute([':usuario_id' => $usuarioId]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public static function marcarComoLeida($notificacionId, $usuarioId) {
        require_once __DIR__ . '/../../backend/base_datos/conexion.php';
        
        $conexion = Conexion::obtenerInstancia();
        $conn = $conexion->obtenerConexion();
        
        $query = "UPDATE notificaciones 
                  SET leido = 1 
                  WHERE id = :id AND usuario_id = :usuario_id";
        
        $stmt = $conn->prepare($query);
        return $stmt->execute([
            ':id' => $notificacionId,
            ':usuario_id' => $usuarioId
        ]);
    }
}
?>