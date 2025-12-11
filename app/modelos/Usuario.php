<?php
require_once __DIR__ . '/../helpers/validacion.php';

class Usuario {
    private $conexion;
    private $validador;
    
    public function __construct($conexion) {
        $this->conexion = $conexion;
        $this->validador = new Validador();
    }
    
    /**
     * CREATE - Crear nuevo usuario
     */
    public function crear($datos) {
        try {
            // Verificar si el correo ya existe
            if ($this->correoExiste($datos['correo'])) {
                return ['exito' => false, 'error' => 'El correo electrónico ya está registrado'];
            }
            
            // Hash de la contraseña
            $contrasenaHash = password_hash($datos['contrasena'], PASSWORD_DEFAULT);
            
            // Insertar usuario
            $sql = "INSERT INTO usuarios (correo, contrasena, nombre, apellido, rol, estado) 
                    VALUES (?, ?, ?, ?, ?, 'activo')";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([
                $datos['correo'],
                $contrasenaHash,
                $datos['nombre'],
                $datos['apellido'],
                $datos['rol']
            ]);
            
            $usuarioId = $this->conexion->lastInsertId();
            
            // Crear perfil básico
            $this->crearPerfilInicial($usuarioId);
            
            return [
                'exito' => true,
                'usuario_id' => $usuarioId,
                'mensaje' => 'Usuario creado exitosamente'
            ];
            
        } catch (PDOException $e) {
            error_log("Error al crear usuario: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al crear el usuario'];
        }
    }
    
    /**
     * READ - Obtener usuario por ID
     */
    public function obtenerPorId($id) {
        try {
            $sql = "SELECT id, correo, nombre, apellido, rol, estado, fecha_creacion, idioma_preferido, zona_horaria, visibilidad_perfil 
                FROM usuarios WHERE id = ?";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$id]);
            
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Error al obtener usuario: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * READ - Obtener usuario por correo
     */
    public function obtenerPorCorreo($correo) {
        try {
            $sql = "SELECT id, correo, contrasena, nombre, apellido, rol, estado, fecha_creacion, idioma_preferido, zona_horaria, visibilidad_perfil 
                FROM usuarios WHERE correo = ?";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$correo]);
            
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Error al obtener usuario por correo: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * UPDATE - Actualizar usuario
     */
    public function actualizar($id, $datos) {
        try {
            $campos = [];
            $valores = [];
            
            $camposPermitidos = ['nombre', 'apellido', 'rol', 'estado'];
            
            foreach ($datos as $campo => $valor) {
                if (in_array($campo, $camposPermitidos)) {
                    $campos[] = "$campo = ?";
                    $valores[] = $valor;
                }
            }
            
            if (empty($campos)) {
                return ['exito' => false, 'error' => 'No hay campos válidos para actualizar'];
            }
            
            $valores[] = $id;
            $sql = "UPDATE usuarios SET " . implode(', ', $campos) . " WHERE id = ?";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute($valores);
            
            return ['exito' => true, 'mensaje' => 'Usuario actualizado exitosamente'];
            
        } catch (PDOException $e) {
            error_log("Error al actualizar usuario: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al actualizar el usuario'];
        }
    }
    
    /**
     * DELETE - Eliminar usuario (soft delete)
     */
    public function eliminar($id) {
        try {
            $sql = "UPDATE usuarios SET estado = 'inactivo' WHERE id = ?";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$id]);
            
            return ['exito' => true, 'mensaje' => 'Usuario eliminado exitosamente'];
        } catch (PDOException $e) {
            error_log("Error al eliminar usuario: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al eliminar el usuario'];
        }
    }
    
    /**
     * Verificar credenciales de login
     */
    public function verificarCredenciales($correo, $contrasena) {
        $usuario = $this->obtenerPorCorreo($correo);
        
        if (!$usuario) {
            return ['exito' => false, 'error' => 'Usuario no encontrado'];
        }
        
        if ($usuario['estado'] !== 'activo') {
            return ['exito' => false, 'error' => 'La cuenta no está activa'];
        }
        
        if (password_verify($contrasena, $usuario['contrasena'])) {
            // Remover contraseña del resultado
            unset($usuario['contrasena']);
            return ['exito' => true, 'usuario' => $usuario];
        } else {
            return ['exito' => false, 'error' => 'Contraseña incorrecta'];
        }
    }
    
    /**
     * Verificar si el correo ya existe
     */
    private function correoExiste($correo) {
        $usuario = $this->obtenerPorCorreo($correo);
        return $usuario !== false;
    }
    
    /**
     * Crear perfil inicial para el usuario
     */
    private function crearPerfilInicial($usuarioId) {
        try {
            $sql = "INSERT INTO perfiles (usuario_id, biografia, habilidades, idiomas) 
                    VALUES (?, '', '', 'Español')";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuarioId]);
        } catch (PDOException $e) {
            error_log("Error al crear perfil inicial: " . $e->getMessage());
        }
    }
    
    /**
     * Obtener todos los usuarios (para admin)
     */
    public function obtenerTodos() {
        try {
            $sql = "SELECT id, correo, nombre, apellido, rol, estado, fecha_creacion 
                    FROM usuarios 
                    ORDER BY fecha_creacion DESC";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute();
            
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Error al obtener usuarios: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Actualizar estado de usuario
     */
    public function actualizarEstado($usuarioId, $estado) {
        try {
            $sql = "UPDATE usuarios SET estado = ? WHERE id = ?";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$estado, $usuarioId]);
            
            if ($stmt->rowCount() === 0) {
                return ['exito' => false, 'error' => 'No se pudo actualizar el usuario'];
            }
            
            return ['exito' => true, 'mensaje' => 'Estado de usuario actualizado'];
            
        } catch (PDOException $e) {
            error_log("Error al actualizar estado de usuario: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al actualizar el usuario'];
        }
    }
}
?>