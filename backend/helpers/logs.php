<?php
// backend/helpers/logs.php

/**
 * Clase para manejar logs de auditoría del sistema
 * Compatible con la tabla logs_auditoria en tu base de datos
 */
class Auditoria {
    private $conexion;
    
    public function __construct($conexion) {
        $this->conexion = $conexion;
    }
    
    /**
     * Registrar una acción en el sistema
     * 
     * @param int $usuarioId ID del usuario que realiza la acción (puede ser null para acciones del sistema)
     * @param string $accion Nombre de la acción (ej: 'LOGIN', 'MENSAJE_ENVIADO', 'USUARIO_BLOQUEADO')
     * @param string $recurso Tipo de recurso afectado (ej: 'usuarios', 'mensajes', 'anuncios')
     * @param int|null $recursoId ID del recurso afectado
     * @param array|null $detalles Información adicional en formato array
     * @return bool True si se registró correctamente
     */
    public function registrar($usuarioId, $accion, $recurso, $recursoId = null, $detalles = null) {
        try {
            // Obtener información del cliente
            $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
            $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Desconocido';
            
            // Convertir detalles a JSON si es un array
            $detallesJson = null;
            if ($detalles !== null) {
                if (is_array($detalles) || is_object($detalles)) {
                    $detallesJson = json_encode($detalles, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                } else {
                    $detallesJson = (string) $detalles;
                }
            }
            
            $sql = "INSERT INTO logs_auditoria 
                    (usuario_id, accion, recurso, recurso_id, detalles, ip_address, user_agent, fecha_creacion) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())";
            
            $stmt = $this->conexion->prepare($sql);
            
            return $stmt->execute([
                $usuarioId,
                $accion,
                $recurso,
                $recursoId,
                $detallesJson,
                $ip,
                $userAgent
            ]);
            
        } catch (PDOException $e) {
            // No lanzar error para no romper el flujo principal
            error_log("Error en registro de auditoría: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Registrar acción crítica específica para mensajes
     * Método de conveniencia
     */
    public function registrarAccionMensaje($usuarioId, $accion, $mensajeId, $detallesAdicionales = []) {
        $detalles = array_merge([
            'mensaje_id' => $mensajeId,
            'timestamp' => date('Y-m-d H:i:s')
        ], $detallesAdicionales);
        
        return $this->registrar($usuarioId, $accion, 'mensajes', $mensajeId, $detalles);
    }
    
    /**
     * Registrar acción crítica específica para usuarios
     */
    public function registrarAccionUsuario($usuarioId, $accion, $usuarioAfectadoId, $detallesAdicionales = []) {
        $detalles = array_merge([
            'usuario_afectado_id' => $usuarioAfectadoId,
            'timestamp' => date('Y-m-d H:i:s')
        ], $detallesAdicionales);
        
        return $this->registrar($usuarioId, $accion, 'usuarios', $usuarioAfectadoId, $detalles);
    }
    
    /**
     * Registrar intento de acción prohibida (contenido inapropiado)
     */
    public function registrarIntentoInapropiado($usuarioId, $tipo, $contenidoPreview, $detalles = []) {
        $detallesCompletos = array_merge([
            'tipo_violacion' => $tipo,
            'contenido_preview' => substr($contenidoPreview, 0, 100),
            'timestamp' => date('Y-m-d H:i:s')
        ], $detalles);
        
        return $this->registrar($usuarioId, 'INTENTO_CONTENIDO_INAPROPIADO', 'sistema', null, $detallesCompletos);
    }
}

// ============= FUNCIONES GLOBALES DE CONVENIENCIA =============

/**
 * Obtener instancia de auditoría (singleton)
 */
function obtenerAuditoria($conexion = null) {
    static $auditoria = null;
    
    if ($auditoria === null) {
        if ($conexion === null) {
            // Si no se proporciona conexión, intentar obtenerla
            // PERO SIN CAUSAR BUCLE
            try {
                // Verificar si ya hay una conexión en GLOBALS
                if (isset($GLOBALS['conexion'])) {
                    $conexion = $GLOBALS['conexion'];
                } else {
                    // Intento limitado de obtener conexión
                    if (file_exists(__DIR__ . '/../../backend/base_datos/conexion.php')) {
                        require_once __DIR__ . '/../../backend/base_datos/conexion.php';
                        
                        // Usar función específica si existe
                        if (function_exists('obtenerConexion')) {
                            $conexion = obtenerConexion();
                        } else if (isset($GLOBALS['conexionBD'])) {
                            // Si existe la instancia de ConexionBD
                            $conexion = $GLOBALS['conexionBD']->obtenerConexion();
                        }
                    }
                }
            } catch (Exception $e) {
                error_log("Error obteniendo conexión para auditoría: " . $e->getMessage());
                // Si falla, crear auditoría sin conexión (solo en memoria)
                $conexion = null;
            }
        }
        
        $auditoria = new Auditoria($conexion);
    }
    
    return $auditoria;
}

/**
 * Registrar log rápidamente (función global)
 */
function registrarLog($usuarioId, $accion, $recurso, $recursoId = null, $detalles = null) {
    try {
        $auditoria = obtenerAuditoria(null); // Pasar null para usar conexión existente
        return $auditoria->registrar($usuarioId, $accion, $recurso, $recursoId, $detalles);
    } catch (Exception $e) {
        // Fallback: log simple
        error_log("Auditoría falló: $accion - Usuario: $usuarioId - Recurso: $recurso - Error: " . $e->getMessage());
        return false;
    }
}

/**
 * Registrar log específico para mensajes
 */
function registrarLogMensaje($usuarioId, $accion, $mensajeId, $detalles = []) {
    $auditoria = obtenerAuditoria();
    return $auditoria->registrarAccionMensaje($usuarioId, $accion, $mensajeId, $detalles);
}

/**
 * Registrar log específico para usuarios
 */
function registrarLogUsuario($usuarioId, $accion, $usuarioAfectadoId, $detalles = []) {
    $auditoria = obtenerAuditoria();
    return $auditoria->registrarAccionUsuario($usuarioId, $accion, $usuarioAfectadoId, $detalles);
}
?>