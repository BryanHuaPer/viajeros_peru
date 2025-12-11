<?php
class Mensaje {
    private $conexion;
    private $auditoria;
    
    public function __construct($conexion) {
        $this->conexion = $conexion;
        // Inicializar auditoría si existe el helper
        if (file_exists(__DIR__ . '/../../backend/helpers/logs.php')) {
            require_once __DIR__ . '/../../backend/helpers/logs.php';
            $this->auditoria = obtenerAuditoria();
        }
    }

    

    private function hasEstado() {
        try {
            $sql = "SELECT COUNT(*) as existe FROM information_schema.columns 
                    WHERE table_schema = DATABASE() AND table_name = 'mensajes' AND column_name = 'estado'";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute();
            $res = $stmt->fetch(PDO::FETCH_ASSOC);
            return (!empty($res) && intval($res['existe']) > 0);
        } catch (PDOException $e) {
            return false;
        }
    }
    
    /**
     * Enviar mensaje
     */
    public function enviar($datos) {
        try {
            // 🔴 PRIMERO VALIDAR CONTENIDO
            require_once __DIR__ . '/../helpers/validacion.php';
            $validacion = Validador::validarContenidoMensaje($datos['contenido'], $datos['remitente_id']);
            
            if (!$validacion['exito']) {
                // Registrar intento fallido si tenemos auditoría
                if ($this->auditoria && isset($datos['remitente_id'])) {
                    $this->auditoria->registrarIntentoInapropiado(
                        $datos['remitente_id'],
                        $validacion['codigo'] ?? 'VALIDACION_FALLIDA',
                        $datos['contenido'],
                        $validacion
                    );
                }
                
                return [
                    'exito' => false, 
                    'error' => $validacion['error'],
                    'codigo_error' => $validacion['codigo'] ?? 'ERROR_VALIDACION'
                ];
            }
            
            // Usar contenido validado y sanitizado
            $contenidoValidado = $validacion['contenido'];
            
            // Verificar bloqueo
            if ($this->verificarBloqueo($datos['remitente_id'], $datos['destinatario_id'])) {
                // 🔴 REGISTRAR EN LOGS
                if ($this->auditoria) {
                    $this->auditoria->registrar(
                        $datos['remitente_id'],
                        'INTENTO_ENVIO_BLOQUEADO',
                        'mensajes',
                        null,
                        [
                            'destinatario_id' => $datos['destinatario_id'],
                            'anuncio_id' => $datos['anuncio_id'] ?? null,
                            'contenido_preview' => substr($contenidoValidado, 0, 50)
                        ]
                    );
                }
                
                return [
                    'exito' => false, 
                    'error' => 'No puedes enviar mensajes a este usuario. Está bloqueado.',
                    'codigo_error' => 'USUARIO_BLOQUEADO'
                ];
            }
            // Guardamos con estado inicial 'enviado' si la columna existe.
            if ($this->hasEstado()) {
            $sql = "INSERT INTO mensajes (remitente_id, destinatario_id, anuncio_id, contenido, estado) 
                    VALUES (?, ?, ?, ?, 'enviado')";
            } else {
                $sql = "INSERT INTO mensajes (remitente_id, destinatario_id, anuncio_id, contenido) 
                        VALUES (?, ?, ?, ?)";
            }
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([
                $datos['remitente_id'],
                $datos['destinatario_id'],
                $datos['anuncio_id'] ?? null,
                $contenidoValidado  // Usar contenido validado
            ]);
            
            $mensajeId = $this->conexion->lastInsertId();
            // 🔴 REGISTRAR ENVÍO EXITOSO EN LOGS
            if ($this->auditoria) {
                $this->auditoria->registrar(
                    $datos['remitente_id'],
                    'MENSAJE_ENVIADO',
                    'mensajes',
                    $mensajeId,
                    [
                        'destinatario_id' => $datos['destinatario_id'],
                        'anuncio_id' => $datos['anuncio_id'] ?? null,
                        'longitud' => strlen($contenidoValidado),
                        'contenido_preview' => substr($contenidoValidado, 0, 30)
                    ]
                );
            }
            // Crear notificación para el destinatario (si tienes sistema de notificaciones)
            $this->crearNotificacionMensaje(
                $datos['destinatario_id'],
                $datos['remitente_id'],
                $mensajeId,
                substr($contenidoValidado, 0, 100)
            );
            
            return [
                'exito' => true,
                'mensaje' => 'Mensaje enviado correctamente',
                'mensaje_id' => $mensajeId,
                'datos' => $this->obtenerPorId($mensajeId)
            ];
            
        } catch (PDOException $e) {
            error_log("Error al enviar mensaje: " . $e->getMessage());
            
            // Registrar error en logs
            if ($this->auditoria && isset($datos['remitente_id'])) {
                $this->auditoria->registrar(
                    $datos['remitente_id'],
                    'ERROR_ENVIO_MENSAJE',
                    'mensajes',
                    null,
                    ['error' => $e->getMessage()]
                );
            }
            
            return ['exito' => false, 'error' => 'Error al enviar el mensaje'];
        }
    }
    // AGREGAR este método nuevo (opcional, para notificaciones):
    private function crearNotificacionMensaje($destinatarioId, $remitenteId, $mensajeId, $preview) {
        try {
            // Obtener nombre del remitente
            $sqlUsuario = "SELECT nombre, apellido FROM usuarios WHERE id = ?";
            $stmtUsuario = $this->conexion->prepare($sqlUsuario);
            $stmtUsuario->execute([$remitenteId]);
            $usuario = $stmtUsuario->fetch(PDO::FETCH_ASSOC);
            
            if ($usuario) {
                $nombreCompleto = $usuario['nombre'] . ' ' . $usuario['apellido'];
                
                $sql = "INSERT INTO notificaciones 
                        (usuario_id, tipo, titulo, contenido, enlace, leido) 
                        VALUES (?, 'mensaje', ?, ?, ?, 0)";
                
                $stmt = $this->conexion->prepare($sql);
                $stmt->execute([
                    $destinatarioId,
                    "Nuevo mensaje de $nombreCompleto",
                    $preview . '...',
                    "/mensajes.html"
                ]);
                
                // Registrar notificación en logs
                if ($this->auditoria) {
                    $this->auditoria->registrar(
                        $remitenteId,
                        'NOTIFICACION_CREADA',
                        'notificaciones',
                        $this->conexion->lastInsertId(),
                        ['destinatario_id' => $destinatarioId, 'tipo' => 'mensaje']
                    );
                }
            }
        } catch (PDOException $e) {
            error_log("Error creando notificación: " . $e->getMessage());
        }
    }

    /**
     * Obtener conversación entre dos usuarios
     */
    public function obtenerConversacion($usuario1, $usuario2, $anuncioId = null, $pagina = 1, $limite = 20) {
        try {
            $offset = ($pagina - 1) * $limite;
            
            // Primero contar total
            $sqlCount = "SELECT COUNT(*) as total FROM mensajes 
                        WHERE ((remitente_id = ? AND destinatario_id = ?) 
                        OR (remitente_id = ? AND destinatario_id = ?))";
            
            $paramsCount = [$usuario1, $usuario2, $usuario2, $usuario1];
            
            if ($anuncioId) {
                $sqlCount .= " AND anuncio_id = ?";
                $paramsCount[] = $anuncioId;
            } else {
                // Si no se especifica anuncioId, obtener solo mensajes sin anuncio (chat normal)
                $sqlCount .= " AND anuncio_id IS NULL";
            }
            
            $stmtCount = $this->conexion->prepare($sqlCount);
            $stmtCount->execute($paramsCount);
            $total = $stmtCount->fetch(PDO::FETCH_ASSOC)['total'];
            
            // Obtener mensajes con límite - INCLUYENDO FOTOS DE PERFIL
            $sql = "SELECT m.*, 
                    ur.nombre as remitente_nombre, ur.apellido as remitente_apellido,
                    ud.nombre as destinatario_nombre, ud.apellido as destinatario_apellido,
                    pr.foto_perfil as remitente_foto,  -- ¡NUEVO: Foto del remitente!
                    pd.foto_perfil as destinatario_foto -- ¡NUEVO: Foto del destinatario!
                    FROM mensajes m
                    JOIN usuarios ur ON m.remitente_id = ur.id
                    JOIN usuarios ud ON m.destinatario_id = ud.id
                    LEFT JOIN perfiles pr ON ur.id = pr.usuario_id  -- ¡NUEVO: JOIN para foto remitente
                    LEFT JOIN perfiles pd ON ud.id = pd.usuario_id -- ¡NUEVO: JOIN para foto destinatario
                    WHERE ((m.remitente_id = ? AND m.destinatario_id = ?) 
                    OR (m.remitente_id = ? AND m.destinatario_id = ?))";
            
            $params = [$usuario1, $usuario2, $usuario2, $usuario1];
            
            if ($anuncioId) {
                $sql .= " AND m.anuncio_id = ?";
                $params[] = $anuncioId;
            } else {
                // Si no se especifica anuncioId, obtener solo mensajes sin anuncio (chat normal)
                $sql .= " AND m.anuncio_id IS NULL";
            }
            
            $sql .= " ORDER BY m.fecha_creacion DESC LIMIT ? OFFSET ?";
            $params[] = $limite;
            $params[] = $offset;
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute($params);
            $mensajes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Asegurarse de que las fotos tengan rutas completas
            foreach ($mensajes as &$mensaje) {
                if (!empty($mensaje['remitente_foto']) && strpos($mensaje['remitente_foto'], '/') !== 0 && strpos($mensaje['remitente_foto'], 'http') !== 0) {
                    $mensaje['remitente_foto'] = '/proyectoWeb/viajeros_peru' . $mensaje['remitente_foto'];
                }
                if (!empty($mensaje['destinatario_foto']) && strpos($mensaje['destinatario_foto'], '/') !== 0 && strpos($mensaje['destinatario_foto'], 'http') !== 0) {
                    $mensaje['destinatario_foto'] = '/proyectoWeb/viajeros_peru' . $mensaje['destinatario_foto'];
                }
            }
            
            // Ordenar por fecha ascendente para mostrar
            usort($mensajes, function($a, $b) {
                return strtotime($a['fecha_creacion']) - strtotime($b['fecha_creacion']);
            });

            // Marcar como 'entregado' los mensajes que estaban en 'enviado' y cuyo destinatario es el usuario que solicita la conversación
            if ($this->hasEstado()) {
                try {
                    $sqlEntregado = "UPDATE mensajes SET estado = 'entregado' 
                                    WHERE destinatario_id = ? AND remitente_id = ? AND estado = 'enviado'";
                    $stmtEnt = $this->conexion->prepare($sqlEntregado);
                    $stmtEnt->execute([$usuario1, $usuario2]);
                } catch (PDOException $e) {
                    // no crítico, sólo logueamos
                    error_log('Error actualizando estado a entregado: ' . $e->getMessage());
                }
            }
            
            return [
                'mensajes' => $mensajes,
                'paginacion' => [
                    'total' => $total,
                    'pagina' => $pagina,
                    'limite' => $limite,
                    'total_paginas' => ceil($total / $limite)
                ]
            ];
            
        } catch (PDOException $e) {
            error_log("Error al obtener conversación: " . $e->getMessage());
            return ['mensajes' => [], 'paginacion' => []];
        }
    }
    
    /**
     * Obtener chats del usuario (lista de conversaciones)
     */
    public function obtenerChats($usuarioId) {
    try {
        $sql = "SELECT 
                CASE 
                    WHEN ultimo_msg.remitente_id = ? THEN ultimo_msg.destinatario_id 
                    ELSE ultimo_msg.remitente_id 
                END AS otro_usuario_id,
                u.nombre, 
                u.apellido,
                p.foto_perfil,
                ultimo_msg.contenido AS ultimo_mensaje,
                ultimo_msg.fecha_creacion AS ultima_fecha,
                ultimo_msg.anuncio_id,
                a.titulo AS anuncio_titulo,
                -- Verificar si el usuario actual es el remitente del último mensaje
                CASE 
                    WHEN ultimo_msg.remitente_id = ? THEN 1
                    ELSE 0
                END AS es_remitente,
                -- **CONSULTA CORREGIDA para no_leidos**
                COALESCE((
                    SELECT COUNT(*) 
                    FROM mensajes mnl
                    WHERE (
                        -- **Mensajes que YO recibí del OTRO usuario**
                        (mnl.remitente_id = 
                            CASE 
                                WHEN ultimo_msg.remitente_id = ? THEN ultimo_msg.destinatario_id 
                                ELSE ultimo_msg.remitente_id 
                            END
                        AND mnl.destinatario_id = ?)
                    )
                    -- Mismo par de usuarios (en cualquier dirección)
                    AND (
                        (mnl.remitente_id = ultimo_msg.remitente_id AND mnl.destinatario_id = ultimo_msg.destinatario_id)
                        OR (mnl.remitente_id = ultimo_msg.destinatario_id AND mnl.destinatario_id = ultimo_msg.remitente_id)
                    )
                    -- Mismo anuncio (o ambos null)
                    AND (mnl.anuncio_id = ultimo_msg.anuncio_id OR (mnl.anuncio_id IS NULL AND ultimo_msg.anuncio_id IS NULL))
                    -- **CRÍTICO: Solo mensajes que YO no he leído**
                    ";
        
        // Usar la columna correcta según si existe 'estado' o 'leido'
        if ($this->hasEstado()) {
            $sql .= "AND (mnl.estado IS NULL OR mnl.estado IN ('enviado', 'entregado')) ";
        } else {
            $sql .= "AND mnl.leido = FALSE ";
        }
        
        $sql .= "), 0) AS no_leidos
                FROM (
                    SELECT 
                        m1.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY 
                                CASE 
                                    WHEN m1.remitente_id < m1.destinatario_id 
                                    THEN CONCAT(m1.remitente_id, '-', m1.destinatario_id)
                                    ELSE CONCAT(m1.destinatario_id, '-', m1.remitente_id)
                                END,
                                m1.anuncio_id
                            ORDER BY m1.fecha_creacion DESC, m1.id DESC
                        ) as rn
                    FROM mensajes m1
                    WHERE m1.remitente_id = ? OR m1.destinatario_id = ?
                ) as ultimo_msg
                JOIN usuarios u ON (
                    CASE 
                        WHEN ultimo_msg.remitente_id = ? THEN ultimo_msg.destinatario_id 
                        ELSE ultimo_msg.remitente_id 
                    END
                ) = u.id
                LEFT JOIN perfiles p ON u.id = p.usuario_id
                LEFT JOIN anuncios a ON ultimo_msg.anuncio_id = a.id
                WHERE ultimo_msg.rn = 1
                ORDER BY ultimo_msg.fecha_creacion DESC";
        
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([
            $usuarioId,  // Para CASE 1
            $usuarioId,  // Para es_remitente
            $usuarioId,  // Para CASE en subquery de no_leidos
            $usuarioId,  // Para destinatario_id = ? en subquery (YO recibí)
            $usuarioId,  // Para WHERE m1 (primera condición)
            $usuarioId,  // Para WHERE m1 (segunda condición)
            $usuarioId   // Para JOIN usuarios
        ]);
        
        $chats = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // **AGREGAR DEBUG DETALLADO**
        error_log("=== RESULTADO DE OBTENERCHATS ===");
        foreach ($chats as $index => $chat) {
            error_log("Chat {$index}: {$chat['nombre']} {$chat['apellido']} - " .
                     "Anuncio: " . ($chat['anuncio_id'] ?: 'null') . " - " .
                     "No leídos: {$chat['no_leidos']}");
        }
        error_log("===============================");
        
        // Asegurar rutas de fotos
        foreach ($chats as &$chat) {
            if (!empty($chat['foto_perfil'])) {
                if (strpos($chat['foto_perfil'], '/') !== 0 && strpos($chat['foto_perfil'], 'http') !== 0) {
                    $chat['foto_perfil'] = '/proyectoWeb/viajeros_peru' . $chat['foto_perfil'];
                }
            }
        }
        
        return $chats;
        
    } catch (PDOException $e) {
        error_log("Error al obtener chats: " . $e->getMessage());
        return [];
    }
}
    
    /**
     * Marcar mensajes como leídos
     */
    public function marcarLeidos($remitenteId, $destinatarioId, $anuncioId = null) {
        try {
            // Marcar como leído; si existe columna estado, actualizar también
            if ($this->hasEstado()) {
                $sql = "UPDATE mensajes SET leido = TRUE, estado = 'visto' 
                        WHERE remitente_id = ? AND destinatario_id = ? 
                        AND (leido = FALSE OR estado != 'visto')";
            } else {
                $sql = "UPDATE mensajes SET leido = TRUE 
                        WHERE remitente_id = ? AND destinatario_id = ? AND leido = FALSE";
            }
            
            // Agregar filtro por anuncio_id si se proporciona
            if ($anuncioId !== null) {
                $sql .= " AND anuncio_id = ?";
                $params = [$remitenteId, $destinatarioId, $anuncioId];
            } else {
                $sql .= " AND anuncio_id IS NULL";
                $params = [$remitenteId, $destinatarioId];
            }
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute($params);
            
            return ['exito' => true, 'mensaje' => 'Mensajes marcados como leídos'];
            
        } catch (PDOException $e) {
            error_log("Error al marcar mensajes como leídos: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al actualizar mensajes'];
        }
    }
    
    /**
     * Obtener mensaje por ID
     */
    public function obtenerPorId($id) {
        try {
            $sql = "SELECT m.*, 
                    ur.nombre as remitente_nombre, ur.apellido as remitente_apellido,
                    ud.nombre as destinatario_nombre, ud.apellido as destinatario_apellido,
                    pr.foto_perfil as remitente_foto,  -- ¡NUEVO: Foto del remitente!
                    pd.foto_perfil as destinatario_foto -- ¡NUEVO: Foto del destinatario!
                    FROM mensajes m
                    JOIN usuarios ur ON m.remitente_id = ur.id
                    JOIN usuarios ud ON m.destinatario_id = ud.id
                    LEFT JOIN perfiles pr ON ur.id = pr.usuario_id  -- ¡NUEVO: JOIN para foto remitente
                    LEFT JOIN perfiles pd ON ud.id = pd.usuario_id -- ¡NUEVO: JOIN para foto destinatario
                    WHERE m.id = ?";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$id]);
            
            $mensaje = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Asegurarse de que las fotos tengan rutas completas
            if ($mensaje) {
                if (!empty($mensaje['remitente_foto']) && strpos($mensaje['remitente_foto'], '/') !== 0 && strpos($mensaje['remitente_foto'], 'http') !== 0) {
                    $mensaje['remitente_foto'] = '/proyectoWeb/viajeros_peru' . $mensaje['remitente_foto'];
                }
                if (!empty($mensaje['destinatario_foto']) && strpos($mensaje['destinatario_foto'], '/') !== 0 && strpos($mensaje['destinatario_foto'], 'http') !== 0) {
                    $mensaje['destinatario_foto'] = '/proyectoWeb/viajeros_peru' . $mensaje['destinatario_foto'];
                }
            }
            
            return $mensaje;
            
        } catch (PDOException $e) {
            error_log("Error al obtener mensaje por ID: " . $e->getMessage());
            return false;
        }
    }
    /**
     * Obtener total de mensajes no leídos para un usuario
     */
    public function obtenerTotalNoLeidos($usuarioId) {
        try {
            if ($this->hasEstado()) {
            $sql = "SELECT COUNT(*) as total_no_leidos 
                FROM mensajes 
                WHERE destinatario_id = ? AND (estado IS NULL OR estado != 'visto')";
            } else {
            $sql = "SELECT COUNT(*) as total_no_leidos 
                FROM mensajes 
                WHERE destinatario_id = ? AND leido = FALSE";
            }

            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuarioId]);
            
            $resultado = $stmt->fetch(PDO::FETCH_ASSOC);
            return $resultado['total_no_leidos'] ?? 0;
            
        } catch (PDOException $e) {
            error_log("Error al obtener mensajes no leídos: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Verificar si hay bloqueo entre usuarios
     */
    public function verificarBloqueo($usuario1, $usuario2) {
        try {
            $sql = "SELECT usuario_bloqueador_id, usuario_bloqueado_id FROM bloqueos_usuarios 
                    WHERE (usuario_bloqueador_id = ? AND usuario_bloqueado_id = ?)
                    OR (usuario_bloqueador_id = ? AND usuario_bloqueado_id = ?) LIMIT 1";

            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuario1, $usuario2, $usuario2, $usuario1]);

            $resultado = $stmt->fetch(PDO::FETCH_ASSOC);
            return $resultado ? true : false;
            
        } catch (PDOException $e) {
            error_log("Error verificando bloqueo: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Obtener detalle del bloqueo entre dos usuarios: quién bloqueó a quién
     */
    public function obtenerDetalleBloqueo($usuario1, $usuario2) {
        try {
            $sql = "SELECT usuario_bloqueador_id, usuario_bloqueado_id FROM bloqueos_usuarios 
                    WHERE (usuario_bloqueador_id = ? AND usuario_bloqueado_id = ?)
                    OR (usuario_bloqueador_id = ? AND usuario_bloqueado_id = ?) LIMIT 1";

            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuario1, $usuario2, $usuario2, $usuario1]);

            $fila = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$fila) return ['bloqueado' => false];

            return [
                'bloqueado' => true,
                'usuario_bloqueador_id' => (int)$fila['usuario_bloqueador_id'],
                'usuario_bloqueado_id' => (int)$fila['usuario_bloqueado_id']
            ];

        } catch (PDOException $e) {
            error_log("Error obteniendo detalle bloqueo: " . $e->getMessage());
            return ['bloqueado' => false];
        }
    }

    /**
     * Bloquear usuario
     */
    public function bloquearUsuario($usuarioBloqueadorId, $usuarioBloqueadoId) {
        try {
            // Verificar si ya está bloqueado
            $sqlCheck = "SELECT COUNT(*) as ya_bloqueado 
                        FROM bloqueos_usuarios 
                        WHERE usuario_bloqueador_id = ? AND usuario_bloqueado_id = ?";
            
            $stmtCheck = $this->conexion->prepare($sqlCheck);
            $stmtCheck->execute([$usuarioBloqueadorId, $usuarioBloqueadoId]);
            $yaBloqueado = $stmtCheck->fetch(PDO::FETCH_ASSOC)['ya_bloqueado'] > 0;
            
            if ($yaBloqueado) {
                return ['exito' => false, 'error' => 'Usuario ya está bloqueado'];
            }
            
            // Insertar bloqueo
            $sql = "INSERT INTO bloqueos_usuarios (usuario_bloqueador_id, usuario_bloqueado_id) 
                    VALUES (?, ?)";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuarioBloqueadorId, $usuarioBloqueadoId]);
            // 🔴 REGISTRAR BLOQUEO EN LOGS
            if ($this->auditoria) {
                $this->auditoria->registrar(
                    $usuarioBloqueadorId,
                    'USUARIO_BLOQUEADO',
                    'usuarios',
                    $usuarioBloqueadoId,
                    [
                        'accion' => 'bloqueo',
                        'timestamp' => date('Y-m-d H:i:s'),
                        'relacion' => 'chat'
                    ]
                );
            }
            
            // También registrar para el usuario bloqueado
            if ($this->auditoria) {
                $this->auditoria->registrar(
                    $usuarioBloqueadoId,
                    'FUE_BLOQUEADO',
                    'usuarios',
                    $usuarioBloqueadorId,
                    [
                        'bloqueado_por' => $usuarioBloqueadorId,
                        'timestamp' => date('Y-m-d H:i:s')
                    ]
                );
            }
            
            return ['exito' => true, 'mensaje' => 'Usuario bloqueado correctamente'];
            
        } catch (PDOException $e) {
            error_log("Error al bloquear usuario: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al bloquear usuario'];
        }
    }

    /**
     * Reportar mensaje
     */
    public function reportarMensaje($usuarioReportadorId, $mensajeId, $motivo) {
        try {
            // Obtener el mensaje
            $mensaje = $this->obtenerPorId($mensajeId);
            
            if (!$mensaje) {
                return ['exito' => false, 'error' => 'Mensaje no encontrado'];
            }
            
            // Determinar quién es el usuario reportado
            $usuarioReportadoId = $mensaje['remitente_id'] == $usuarioReportadorId 
                ? $mensaje['destinatario_id'] 
                : $mensaje['remitente_id'];
            
            // Obtener últimos 5 mensajes del contexto (para dar detalles al admin)
            $sqlContexto = "SELECT contenido, fecha_creacion, remitente_id 
                        FROM mensajes 
                        WHERE ((remitente_id = ? AND destinatario_id = ?) 
                        OR (remitente_id = ? AND destinatario_id = ?))
                        ORDER BY fecha_creacion DESC LIMIT 5";
            
            $stmtContexto = $this->conexion->prepare($sqlContexto);
            $stmtContexto->execute([
                $mensaje['remitente_id'], 
                $mensaje['destinatario_id'], 
                $mensaje['destinatario_id'], 
                $mensaje['remitente_id']
            ]);
            
            $contexto = $stmtContexto->fetchAll(PDO::FETCH_ASSOC);
            
            // Preparar motivo con contexto
            $motivoCompleto = json_encode([
                'motivo_texto' => $motivo,
                'mensaje_reportado_id' => $mensajeId,
                'contexto_chat' => $contexto,
                'fecha_contexto' => date('Y-m-d H:i:s')
            ]);

            // Insertar reporte
            $sql = "INSERT INTO reportes (usuario_reportador_id, usuario_reportado_id, tipo, motivo) 
                    VALUES (?, ?, 'mensaje', ?)";

            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuarioReportadorId, $usuarioReportadoId, $motivoCompleto]);
            
            // 🔴 OBTENER EL ID DEL REPORTE RECIÉN INSERTADO
            $reporteId = $this->conexion->lastInsertId();

            // 🔴 REGISTRAR REPORTE EN LOGS
            if ($this->auditoria) {
                $this->auditoria->registrar(
                    $usuarioReportadorId,
                    'MENSAJE_REPORTADO',
                    'reportes',
                    $reporteId,
                    [
                        'usuario_reportado_id' => $usuarioReportadoId,
                        'mensaje_id' => $mensajeId,
                        'motivo_preview' => substr($motivo, 0, 100)
                    ]
                );
            }
            
            // 🔴 NOTIFICAR AL ADMINISTRADOR (si existe el método)
            $this->notificarAdminReporte($reporteId, $usuarioReportadorId, $usuarioReportadoId);
                
            return [
                'exito' => true, 
                'mensaje' => 'Mensaje reportado correctamente',
                'reporte_id' => $reporteId
            ];
            
        } catch (PDOException $e) {
            error_log("Error al reportar mensaje: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al reportar mensaje'];
        }
    }

    /**
     * Desbloquear usuario
     */
    public function desbloquearUsuario($usuarioBloqueadorId, $usuarioBloqueadoId) {
        try {
            $sql = "DELETE FROM bloqueos_usuarios 
                    WHERE usuario_bloqueador_id = ? AND usuario_bloqueado_id = ?";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuarioBloqueadorId, $usuarioBloqueadoId]);
            
            $filasAfectadas = $stmt->rowCount();
            
            if ($filasAfectadas > 0) {
                // 🔴 REGISTRAR DESBLOQUEO EN LOGS
                if ($this->auditoria) {
                    $this->auditoria->registrar(
                        $usuarioBloqueadorId,
                        'USUARIO_DESBLOQUEADO',
                        'usuarios',
                        $usuarioBloqueadoId,
                        ['accion' => 'desbloqueo']
                    );
                }
                return ['exito' => true, 'mensaje' => 'Usuario desbloqueado correctamente'];
            } else {
                return ['exito' => false, 'error' => 'No se encontró el bloqueo'];
            }
            
        } catch (PDOException $e) {
            error_log("Error al desbloquear usuario: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al desbloquear usuario'];
        }
    }

    /**
     * Notificar a administradores sobre un reporte
     */
    private function notificarAdminReporte($reporteId, $usuarioReportadorId, $usuarioReportadoId) {
        try {
            // Obtener información de los usuarios
            $sqlUsuarios = "SELECT 
                            ur.id as reportador_id, ur.nombre as reportador_nombre, ur.apellido as reportador_apellido,
                            ud.id as reportado_id, ud.nombre as reportado_nombre, ud.apellido as reportado_apellido
                            FROM usuarios ur
                            JOIN usuarios ud ON ud.id = ?
                            WHERE ur.id = ?";
            
            $stmtUsuarios = $this->conexion->prepare($sqlUsuarios);
            $stmtUsuarios->execute([$usuarioReportadoId, $usuarioReportadorId]);
            $usuarios = $stmtUsuarios->fetch(PDO::FETCH_ASSOC);
            
            if ($usuarios) {
                // Obtener todos los administradores
                $sqlAdmins = "SELECT id FROM usuarios WHERE rol = 'administrador' AND estado = 'activo'";
                $stmtAdmins = $this->conexion->prepare($sqlAdmins);
                $stmtAdmins->execute();
                $admins = $stmtAdmins->fetchAll(PDO::FETCH_ASSOC);
                
                foreach ($admins as $admin) {
                    // Crear notificación para cada admin
                    $sqlNotificacion = "INSERT INTO notificaciones 
                                        (usuario_id, tipo, titulo, contenido, enlace, leido) 
                                        VALUES (?, 'sistema', ?, ?, ?, 0)";
                    
                    $stmtNotificacion = $this->conexion->prepare($sqlNotificacion);
                    
                    $titulo = "Nuevo reporte de mensaje #$reporteId";
                    $contenido = "Usuario {$usuarios['reportador_nombre']} reportó a {$usuarios['reportado_nombre']}";
                    $enlace = "/admin/reportes.html?id=$reporteId";
                    
                    $stmtNotificacion->execute([
                        $admin['id'],
                        $titulo,
                        $contenido,
                        $enlace
                    ]);
                    
                    $notificacionId = $this->conexion->lastInsertId();
                    
                    // Registrar en logs
                    if ($this->auditoria) {
                        $this->auditoria->registrar(
                            $usuarioReportadorId,
                            'NOTIFICACION_ADMIN_CREADA',
                            'notificaciones',
                            $notificacionId,
                            [
                                'admin_id' => $admin['id'],
                                'reporte_id' => $reporteId,
                                'tipo' => 'reporte_mensaje'
                            ]
                        );
                    }
                }
            }
        } catch (PDOException $e) {
            // No es crítico si falla la notificación
            error_log("Error notificando admin sobre reporte: " . $e->getMessage());
        }
    }

    /**
     * Obtener el estado de un mensaje específico
     */
    public function obtenerEstadoMensaje($mensajeId, $usuarioId) {
        try {
            if ($this->hasEstado()) {
                $sql = "SELECT estado FROM mensajes 
                        WHERE id = ? AND (remitente_id = ? OR destinatario_id = ?)";
                
                $stmt = $this->conexion->prepare($sql);
                $stmt->execute([$mensajeId, $usuarioId, $usuarioId]);
                $resultado = $stmt->fetch(PDO::FETCH_ASSOC);
                
                return $resultado ? $resultado['estado'] : 'desconocido';
            }
            return 'enviado'; // Estado por defecto si no existe la columna
        } catch (PDOException $e) {
            error_log("Error obteniendo estado del mensaje: " . $e->getMessage());
            return 'error';
        }
    }

    /**
     * Actualizar estado de un mensaje a 'visto'
     */
    public function marcarComoVisto($mensajeId, $usuarioId) {
        try {
            if ($this->hasEstado()) {
                // Verificar que el usuario es el destinatario
                $sqlVerificar = "SELECT id FROM mensajes 
                                WHERE id = ? AND destinatario_id = ? AND estado != 'visto'";
                $stmtVerificar = $this->conexion->prepare($sqlVerificar);
                $stmtVerificar->execute([$mensajeId, $usuarioId]);
                
                if ($stmtVerificar->fetch()) {
                    $sql = "UPDATE mensajes SET estado = 'visto' WHERE id = ?";
                    $stmt = $this->conexion->prepare($sql);
                    $stmt->execute([$mensajeId]);
                    
                    return ['exito' => true, 'mensaje' => 'Mensaje marcado como visto'];
                }
            }
            return ['exito' => false, 'error' => 'No se pudo marcar como visto'];
        } catch (PDOException $e) {
            error_log("Error marcando mensaje como visto: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al actualizar estado'];
        }
    }

    /**
     * Actualizar estado de múltiples mensajes a 'visto'
     */
    public function marcarMensajesComoVistos($destinatarioId, $remitenteId, $anuncioId = null) {
        try {
            if ($this->hasEstado()) {
                $sql = "UPDATE mensajes SET estado = 'visto' 
                        WHERE remitente_id = ? AND destinatario_id = ? 
                        AND estado IN ('enviado', 'entregado')";
                
                // Agregar filtro por anuncio_id
                if ($anuncioId !== null) {
                    $sql .= " AND anuncio_id = ?";
                    $params = [$remitenteId, $destinatarioId, $anuncioId];
                } else {
                    $sql .= " AND anuncio_id IS NULL";
                    $params = [$remitenteId, $destinatarioId];
                }
                
                $stmt = $this->conexion->prepare($sql);
                $stmt->execute($params);
                
                return ['exito' => true, 'filas_afectadas' => $stmt->rowCount()];
            }
            return ['exito' => true, 'filas_afectadas' => 0];
        } catch (PDOException $e) {
            error_log("Error marcando mensajes como vistos: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al actualizar estados'];
        }
    }

    /**
     * Obtener el estado de todos los mensajes de una conversación para el remitente
     */
    public function obtenerEstadosMensajes($usuarioId, $otroUsuarioId) {
        try {
            if ($this->hasEstado()) {
                $sql = "SELECT id, estado, fecha_creacion 
                        FROM mensajes 
                        WHERE remitente_id = ? AND destinatario_id = ? 
                        ORDER BY fecha_creacion DESC";
                
                $stmt = $this->conexion->prepare($sql);
                $stmt->execute([$usuarioId, $otroUsuarioId]);
                
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            }
            return [];
        } catch (PDOException $e) {
            error_log("Error obteniendo estados de mensajes: " . $e->getMessage());
            return [];
        }
    }
}
?>