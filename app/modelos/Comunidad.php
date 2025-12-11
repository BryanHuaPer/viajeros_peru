<?php
class Comunidad {
    private $conexion;
    
    public function __construct($conexion) {
        $this->conexion = $conexion;
    }
    
    public function obtenerPublicaciones($filtro = 'todas', $pagina = 1, $limite = 10) {
        $offset = ($pagina - 1) * $limite;
        
        $sql = "SELECT cp.*, u.nombre, u.apellido, u.foto_perfil,
                       (SELECT COUNT(*) FROM comunidad_comentarios cc WHERE cc.publicacion_id = cp.id) as total_comentarios
                FROM comunidad_publicaciones cp
                JOIN usuarios u ON cp.autor_id = u.id
                WHERE cp.estado = 'activo'";
        
        $parametros = [];
        $tipos = "";
        
        if ($filtro !== 'todas') {
            $sql .= " AND cp.tipo = ?";
            $parametros[] = $filtro;
            $tipos .= "s";
        }
        
        $sql .= " ORDER BY cp.fecha_publicacion DESC LIMIT ? OFFSET ?";
        $parametros[] = $limite;
        $parametros[] = $offset;
        $tipos .= "ii";
        
        $stmt = $this->conexion->prepare($sql);
        if ($tipos) {
            $stmt->bind_param($tipos, ...$parametros);
        }
        $stmt->execute();
        $resultado = $stmt->get_result();
        
        $publicaciones = [];
        while ($fila = $resultado->fetch_assoc()) {
            $fila['etiquetas'] = json_decode($fila['etiquetas'] ?? '[]', true);
            $publicaciones[] = $fila;
        }
        
        return $publicaciones;
    }
    
    public function obtenerPublicacion($id) {
        $sql = "SELECT cp.*, u.nombre, u.apellido, u.foto_perfil, p.biografia
                FROM comunidad_publicaciones cp
                JOIN usuarios u ON cp.autor_id = u.id
                LEFT JOIN perfiles p ON u.id = p.usuario_id
                WHERE cp.id = ? AND cp.estado = 'activo'";
        
        $stmt = $this->conexion->prepare($sql);
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $resultado = $stmt->get_result();
        
        if ($publicacion = $resultado->fetch_assoc()) {
            $publicacion['etiquetas'] = json_decode($publicacion['etiquetas'] ?? '[]', true);
            return $publicacion;
        }
        
        return null;
    }
    
    public function obtenerComentarios($publicacionId) {
        $sql = "SELECT cc.*, u.nombre, u.apellido, u.foto_perfil
                FROM comunidad_comentarios cc
                JOIN usuarios u ON cc.autor_id = u.id
                WHERE cc.publicacion_id = ?
                ORDER BY cc.fecha_creacion ASC";
        
        $stmt = $this->conexion->prepare($sql);
        $stmt->bind_param("i", $publicacionId);
        $stmt->execute();
        $resultado = $stmt->get_result();
        
        $comentarios = [];
        while ($fila = $resultado->fetch_assoc()) {
            $comentarios[] = $fila;
        }
        
        return $comentarios;
    }
    
    public function crearPublicacion($autorId, $titulo, $contenido, $tipo = 'experiencia', $etiquetas = []) {
        $etiquetasJson = json_encode($etiquetas);
        
        $sql = "INSERT INTO comunidad_publicaciones (autor_id, titulo, contenido, tipo, etiquetas)
                VALUES (?, ?, ?, ?, ?)";
        
        $stmt = $this->conexion->prepare($sql);
        $stmt->bind_param("issss", $autorId, $titulo, $contenido, $tipo, $etiquetasJson);
        
        if ($stmt->execute()) {
            return $stmt->insert_id;
        }
        
        return false;
    }
    
    public function crearComentario($publicacionId, $autorId, $contenido) {
        $sql = "INSERT INTO comunidad_comentarios (publicacion_id, autor_id, contenido)
                VALUES (?, ?, ?)";
        
        $stmt = $this->conexion->prepare($sql);
        $stmt->bind_param("iis", $publicacionId, $autorId, $contenido);
        
        return $stmt->execute();
    }
    
    public function eliminarPublicacion($id, $usuarioId, $esAdmin = false) {
        // Verificar permisos
        $sqlVerificar = "SELECT autor_id FROM comunidad_publicaciones WHERE id = ?";
        $stmtVerificar = $this->conexion->prepare($sqlVerificar);
        $stmtVerificar->bind_param("i", $id);
        $stmtVerificar->execute();
        $resultado = $stmtVerificar->get_result();
        
        if ($publicacion = $resultado->fetch_assoc()) {
            if ($publicacion['autor_id'] == $usuarioId || $esAdmin) {
                $sql = "UPDATE comunidad_publicaciones SET estado = 'eliminado' WHERE id = ?";
                $stmt = $this->conexion->prepare($sql);
                $stmt->bind_param("i", $id);
                return $stmt->execute();
            }
        }
        
        return false;
    }
    
    public function obtenerTotalPublicaciones($filtro = 'todas') {
        $sql = "SELECT COUNT(*) as total FROM comunidad_publicaciones WHERE estado = 'activo'";
        
        if ($filtro !== 'todas') {
            $sql .= " AND tipo = '$filtro'";
        }
        
        $resultado = $this->conexion->query($sql);
        $fila = $resultado->fetch_assoc();
        
        return $fila['total'] ?? 0;
    }
}
?>