<?php
class Favorito {
    private $conexion;
    
    public function __construct($conexion) {
        $this->conexion = $conexion;
    }

    /**
     * Obtener todos los favoritos de un usuario
     */
    public function obtenerFavoritosUsuario($usuario_id, $tipo = 'anuncio') {
        try {
            if ($tipo === 'anuncio') {
                $sql = "SELECT f.id, f.anuncio_id, f.fecha_agregado, 
                               a.id, a.titulo, a.descripcion, a.ubicacion, 
                               a.tipo_actividad, a.duracion_minima, a.duracion_maxima,
                               a.cupos_disponibles, a.estado,
                               u.nombre, u.apellido, u.correo,
                               p.foto_perfil,
                               ai.url_imagen
                        FROM favoritos f
                        INNER JOIN anuncios a ON f.anuncio_id = a.id
                        INNER JOIN usuarios u ON a.anfitrion_id = u.id
                        LEFT JOIN perfiles p ON u.id = p.usuario_id
                        LEFT JOIN anuncio_imagenes ai ON a.id = ai.anuncio_id AND ai.orden = 1
                        WHERE f.usuario_id = ? AND f.tipo = 'anuncio'
                        ORDER BY f.fecha_agregado DESC";
                
                $stmt = $this->conexion->prepare($sql);
                $stmt->execute([$usuario_id]);
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
                
            } else if ($tipo === 'perfil') {
                $sql = "SELECT f.id, f.usuario_favorito_id, f.fecha_agregado,
                               u.nombre, u.apellido, u.rol, u.estado,
                               p.biografia, p.foto_perfil, p.ubicacion,
                               COUNT(CASE WHEN a.estado = 'activo' THEN 1 END) as anuncios_activos
                        FROM favoritos f
                        INNER JOIN usuarios u ON f.usuario_favorito_id = u.id
                        LEFT JOIN perfiles p ON u.id = p.usuario_id
                        LEFT JOIN anuncios a ON u.id = a.anfitrion_id
                        WHERE f.usuario_id = ? AND f.tipo = 'perfil'
                        GROUP BY f.id
                        ORDER BY f.fecha_agregado DESC";
                
                $stmt = $this->conexion->prepare($sql);
                $stmt->execute([$usuario_id]);
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            }
            
            return [];
            
        } catch (PDOException $e) {
            error_log("Error al obtener favoritos: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Agregar un favorito
     */
    public function agregar($usuario_id, $anuncio_id = null, $usuario_favorito_id = null) {
        try {
            // Determinar tipo
            $tipo = $anuncio_id ? 'anuncio' : 'perfil';
            
            // Validar que al menos uno de los ids esté presente
            if (!$anuncio_id && !$usuario_favorito_id) {
                return ['exito' => false, 'error' => 'Debes proporcionar anuncio_id o usuario_favorito_id'];
            }
            
            // Evitar agregar a sí mismo como favorito de perfil
            if ($tipo === 'perfil' && $usuario_id === $usuario_favorito_id) {
                return ['exito' => false, 'error' => 'No puedes agregarte a ti mismo como favorito'];
            }
            
            $sql = "INSERT INTO favoritos (usuario_id, anuncio_id, usuario_favorito_id, tipo) 
                    VALUES (?, ?, ?, ?)";
            
            $stmt = $this->conexion->prepare($sql);
            $resultado = $stmt->execute([
                $usuario_id,
                $anuncio_id,
                $usuario_favorito_id,
                $tipo
            ]);
            
            if ($resultado) {
                return [
                    'exito' => true,
                    'mensaje' => 'Agregado a favoritos',
                    'favorito_id' => $this->conexion->lastInsertId()
                ];
            } else {
                return ['exito' => false, 'error' => 'No se pudo agregar a favoritos'];
            }
            
        } catch (PDOException $e) {
            // Capturar error de constraint único (ya existe)
            if (strpos($e->getMessage(), 'UNIQUE constraint failed') !== false || 
                strpos($e->getMessage(), 'Duplicate entry') !== false) {
                return ['exito' => false, 'error' => 'Este elemento ya está en tus favoritos'];
            }
            
            error_log("Error al agregar favorito: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al agregar a favoritos'];
        }
    }

    /**
     * Eliminar un favorito
     */
    public function eliminar($usuario_id, $favorito_id) {
        try {
            $sql = "DELETE FROM favoritos WHERE id = ? AND usuario_id = ?";
            $stmt = $this->conexion->prepare($sql);
            $resultado = $stmt->execute([$favorito_id, $usuario_id]);
            
            if ($stmt->rowCount() > 0) {
                return ['exito' => true, 'mensaje' => 'Eliminado de favoritos'];
            } else {
                return ['exito' => false, 'error' => 'No se pudo eliminar de favoritos'];
            }
            
        } catch (PDOException $e) {
            error_log("Error al eliminar favorito: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al eliminar de favoritos'];
        }
    }

    /**
     * Eliminar favorito por anuncio_id
     */
    public function eliminarPorAnuncio($usuario_id, $anuncio_id) {
        try {
            $sql = "DELETE FROM favoritos WHERE usuario_id = ? AND anuncio_id = ?";
            $stmt = $this->conexion->prepare($sql);
            $resultado = $stmt->execute([$usuario_id, $anuncio_id]);
            
            if ($stmt->rowCount() > 0) {
                return ['exito' => true, 'mensaje' => 'Eliminado de favoritos'];
            } else {
                return ['exito' => false, 'error' => 'No se pudo eliminar de favoritos'];
            }
            
        } catch (PDOException $e) {
            error_log("Error al eliminar favorito por anuncio: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al eliminar de favoritos'];
        }
    }

    /**
     * Verificar si un anuncio está en favoritos
     */
    public function esAnunciofavorito($usuario_id, $anuncio_id) {
        try {
            $sql = "SELECT id FROM favoritos WHERE usuario_id = ? AND anuncio_id = ? AND tipo = 'anuncio'";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuario_id, $anuncio_id]);
            
            $resultado = $stmt->fetch(PDO::FETCH_ASSOC);
            return $resultado ? true : false;
            
        } catch (PDOException $e) {
            error_log("Error al verificar favorito: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Verificar si un perfil está en favoritos
     */
    public function esPerfilFavorito($usuario_id, $usuario_favorito_id) {
        try {
            $sql = "SELECT id FROM favoritos WHERE usuario_id = ? AND usuario_favorito_id = ? AND tipo = 'perfil'";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuario_id, $usuario_favorito_id]);
            
            $resultado = $stmt->fetch(PDO::FETCH_ASSOC);
            return $resultado ? true : false;
            
        } catch (PDOException $e) {
            error_log("Error al verificar favorito de perfil: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Obtener ID de favorito por anuncio_id
     */
    public function obtenerIdFavoritoPorAnuncio($usuario_id, $anuncio_id) {
        try {
            $sql = "SELECT id FROM favoritos WHERE usuario_id = ? AND anuncio_id = ? AND tipo = 'anuncio'";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuario_id, $anuncio_id]);
            
            $resultado = $stmt->fetch(PDO::FETCH_ASSOC);
            return $resultado ? $resultado['id'] : null;
            
        } catch (PDOException $e) {
            error_log("Error al obtener ID de favorito: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Contar favoritos de un usuario
     */
    public function contarFavoritos($usuario_id, $tipo = 'anuncio') {
        try {
            $sql = "SELECT COUNT(*) as total FROM favoritos WHERE usuario_id = ? AND tipo = ?";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuario_id, $tipo]);
            
            $resultado = $stmt->fetch(PDO::FETCH_ASSOC);
            return $resultado['total'] ?? 0;
            
        } catch (PDOException $e) {
            error_log("Error al contar favoritos: " . $e->getMessage());
            return 0;
        }
    }
}
?>
