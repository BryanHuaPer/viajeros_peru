<?php
class Perfil {
    private $conexion;
    
    public function __construct($conexion) {
        $this->conexion = $conexion;
    }
    
    /**
     * Obtener perfil COMPLETO por ID de usuario
     */
    public function obtenerPorUsuarioId($usuarioId) {
        try {
            $sql = "SELECT p.*, u.nombre, u.apellido, u.correo, u.rol, u.fecha_creacion,
                           u.idioma_preferido, u.zona_horaria, u.visibilidad_perfil,
                           v.estado as estado_verificacion_real, v.tipo_documento,
                           (SELECT COUNT(*) FROM resenas r WHERE r.destinatario_id = u.id) as total_resenas,
                           (SELECT COUNT(*) FROM reservas r WHERE r.viajero_id = u.id AND r.estado = 'completada') as total_estancias,
                           (SELECT COUNT(*) FROM anuncios a WHERE a.anfitrion_id = u.id) as total_anuncios
                   FROM perfiles p
                   INNER JOIN usuarios u ON p.usuario_id = u.id 
                   LEFT JOIN verificaciones_identidad v ON p.usuario_id = v.usuario_id AND v.estado = 'verificado'
                   WHERE p.usuario_id = ?";
                   
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuarioId]);
            
            $perfil = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($perfil) {
                // Convertir JSON strings a arrays de manera segura
                $perfil['habilidades'] = $this->safeJsonDecode($perfil['habilidades'] ?? '[]');
                $perfil['idiomas'] = $this->safeJsonDecode($perfil['idiomas'] ?? '["espanol"]');
                $perfil['intereses'] = $this->safeJsonDecode($perfil['intereses'] ?? '[]');
                $perfil['redes_sociales'] = $this->safeJsonDecode($perfil['redes_sociales'] ?? '[]');
                
                // Procesar experiencias_previas
                $perfil['experiencias_previas'] = $this->procesarExperiencias($perfil['experiencias_previas'] ?? '');
                
                // Calcular edad si hay fecha_nacimiento
                if ($perfil['fecha_nacimiento']) {
                    $perfil['edad'] = $this->calcularEdad($perfil['fecha_nacimiento']);
                }
                
                // Determinar estado de verificación real
                $perfil['estado_verificacion_display'] = $this->obtenerEstadoVerificacionDisplay($perfil);
            }
            
            return $perfil;
            
        } catch (PDOException $e) {
            error_log("Error al obtener perfil: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Procesar experiencias previas
     */
    private function procesarExperiencias($experiencias) {
        if (empty($experiencias)) {
            return [];
        }
        
        // Si ya es array, retornarlo
        if (is_array($experiencias)) {
            return $experiencias;
        }
        
        // Si es JSON, decodificar
        if ($this->esJson($experiencias)) {
            return json_decode($experiencias, true);
        }
        
        // Si es string con saltos de línea, convertir a array
        return array_filter(array_map('trim', explode("\n", $experiencias)));
    }
    
    /**
     * Calcular edad desde fecha de nacimiento
     */
    private function calcularEdad($fechaNacimiento) {
        $nacimiento = new DateTime($fechaNacimiento);
        $hoy = new DateTime();
        $edad = $hoy->diff($nacimiento);
        return $edad->y;
    }
    
    /**
     * Obtener estado de verificación para mostrar
     */
    private function obtenerEstadoVerificacionDisplay($perfil) {
        if ($perfil['estado_verificacion_real'] === 'verificado') {
            return [
                'estado' => 'verificado',
                'texto' => '✅ Verificado',
                'clase' => 'verificado',
                'icono' => '✅'
            ];
        } else if ($perfil['estado_verificacion'] === 'verificado') {
            return [
                'estado' => 'verificado',
                'texto' => '✅ Verificado',
                'clase' => 'verificado',
                'icono' => '✅'
            ];
        } else if ($perfil['estado_verificacion'] === 'pendiente') {
            return [
                'estado' => 'pendiente',
                'texto' => '⏳ En revisión',
                'clase' => 'pendiente',
                'icono' => '⏳'
            ];
        } else {
            return [
                'estado' => 'no_verificado',
                'texto' => '❌ No verificado',
                'clase' => 'no-verificado',
                'icono' => '❌'
            ];
        }
    }
    
    /**
     * Decodificar JSON de manera segura
     */
    private function safeJsonDecode($jsonString) {
        if (empty($jsonString)) {
            return [];
        }
        
        // Si ya es un array, retornarlo
        if (is_array($jsonString)) {
            return $jsonString;
        }
        
        // Si es string "Español" (viene de la BD), convertirlo a array
        if ($jsonString === 'Español') {
            return ['espanol'];
        }
        
        // Intentar decodificar JSON
        $decoded = json_decode($jsonString, true);
        
        if (json_last_error() === JSON_ERROR_NONE) {
            return $decoded;
        }
        
        // Si falla, intentar como string separado por comas
        if (is_string($jsonString)) {
            return array_map('trim', explode(',', $jsonString));
        }
        
        return [];
    }
    
    /**
     * Verificar si string es JSON válido
     */
    private function esJson($string) {
        json_decode($string);
        return json_last_error() === JSON_ERROR_NONE;
    }
    
    /**
     * Obtener perfil público por ID de usuario
     */
    public function obtenerPerfilPublico($usuarioId) {
        try {
            $sql = "SELECT p.*, 
                        u.nombre, u.apellido, u.rol, u.visibilidad_perfil,
                        (SELECT COUNT(*) FROM resenas r WHERE r.destinatario_id = u.id) as total_resenas,
                        (SELECT COUNT(*) FROM reservas r WHERE r.viajero_id = u.id AND r.estado = 'completada') as total_estancias,
                        (SELECT COUNT(*) FROM anuncios a WHERE a.anfitrion_id = u.id) as total_anuncios,
                        (SELECT AVG(puntuacion) FROM resenas WHERE destinatario_id = u.id) as promedio_calificacion,  -- ← NUEVO
                        v.estado as estado_verificacion_real
                FROM perfiles p
                INNER JOIN usuarios u ON p.usuario_id = u.id 
                LEFT JOIN verificaciones_identidad v ON p.usuario_id = v.usuario_id AND v.estado = 'verificado'
                WHERE p.usuario_id = ? AND u.estado = 'activo'";
                
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$usuarioId]);
            
            $perfil = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($perfil) {
                // Verificar visibilidad
                if ($perfil['visibilidad_perfil'] === 'privado') {
                    return ['error' => 'Perfil privado'];
                }
                
                // Procesar arrays
                $perfil['habilidades'] = $this->safeJsonDecode($perfil['habilidades'] ?? '[]');
                $perfil['idiomas'] = $this->safeJsonDecode($perfil['idiomas'] ?? '["espanol"]');
                $perfil['intereses'] = $this->safeJsonDecode($perfil['intereses'] ?? '[]');
                $perfil['redes_sociales'] = $this->safeJsonDecode($perfil['redes_sociales'] ?? '[]');
                $perfil['experiencias_previas'] = $this->procesarExperiencias($perfil['experiencias_previas'] ?? '');
                
                // Formatear nombre completo
                $perfil['nombre_completo'] = $perfil['nombre'] . ' ' . $perfil['apellido'];
                
                // Calcular edad si hay fecha_nacimiento
                if ($perfil['fecha_nacimiento']) {
                    $perfil['edad'] = $this->calcularEdad($perfil['fecha_nacimiento']);
                }
                
                // Determinar estado de verificación
                $perfil['estado_verificacion_display'] = $this->obtenerEstadoVerificacionDisplay($perfil);
                
                // Procesar calificación promedio
                $perfil['promedio_calificacion'] = $perfil['promedio_calificacion'] 
                    ? round((float)$perfil['promedio_calificacion'], 1) 
                    : 0;
                
                // Determinar color de calificación
                $perfil['color_calificacion'] = $this->obtenerColorCalificacion($perfil['promedio_calificacion']);
                
                // Remover campos sensibles
                unset($perfil['telefono'], $perfil['correo'], $perfil['fecha_actualizacion']);
                
                return $perfil;
            }
            
            return false;
            
        } catch (PDOException $e) {
            error_log("Error al obtener perfil público: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Obtener color según calificación promedio
     */
    private function obtenerColorCalificacion($puntuacion) {
        if ($puntuacion >= 4.5) return '#4CAF50'; // Verde - Excelente
        if ($puntuacion >= 4.0) return '#8BC34A'; // Verde claro - Muy bueno
        if ($puntuacion >= 3.0) return '#FFC107'; // Amarillo - Bueno
        if ($puntuacion >= 2.0) return '#FF9800'; // Naranja - Regular
        return '#F44336'; // Rojo - Malo
    }
    
    public function iniciarVerificacion($usuarioId, $datosVerificacion) {
        try {
            error_log("=== INICIAR VERIFICACION - Usuario ID: $usuarioId ===");
            
            // Validar datos requeridos
            $camposRequeridos = ['tipo_documento', 'numero_documento', 'documento_archivo', 'selfie_archivo'];
            foreach ($camposRequeridos as $campo) {
                if (empty($datosVerificacion[$campo])) {
                    throw new Exception("Campo requerido faltante: $campo");
                }
            }
            
            $this->conexion->beginTransaction();
            
            // 1. BUSCAR DOCUMENTO EXISTENTE
            $sqlVerificarDoc = "SELECT v.id, v.usuario_id, v.estado, u.nombre, u.apellido, u.correo
                            FROM verificaciones_identidad v
                            JOIN usuarios u ON v.usuario_id = u.id
                            WHERE v.tipo_documento = ? 
                            AND v.numero_documento = ? 
                            ORDER BY v.fecha_solicitud DESC 
                            LIMIT 1";
            
            $stmtVerificar = $this->conexion->prepare($sqlVerificarDoc);
            $stmtVerificar->execute([
                $datosVerificacion['tipo_documento'],
                $datosVerificacion['numero_documento']
            ]);
            
            $documentoExistente = $stmtVerificar->fetch(PDO::FETCH_ASSOC);

            $verificacionId = null;
            $accion = null;
            $mensaje = ''; 
            
            if ($documentoExistente) {
                // CASO A: Documento VERIFICADO (APROBADO) - ❌ NUNCA PERMITIR
                if ($documentoExistente['estado'] === 'verificado') {
                    $this->conexion->rollBack();
                    return [
                        'exito' => false,
                        'error' => 'Este documento ya ha sido verificado por otra cuenta.',
                        'codigo_error' => 'DOCUMENTO_VERIFICADO',
                        'email_asociado' => $documentoExistente['correo']
                    ];
                }
                
                // CASO B: Documento PENDIENTE
                if ($documentoExistente['estado'] === 'pendiente') {
                    // Solo el mismo usuario puede actualizar
                    if ($documentoExistente['usuario_id'] == $usuarioId) {
                        // ✅ Mismo usuario, puede actualizar
                        $accion = 'actualizar_pendiente';
                        $mensaje = 'Solicitud de verificación actualizada exitosamente';
                    } else {
                        // ❌ Otro usuario, NO puede tocar
                        $this->conexion->rollBack();
                        return [
                            'exito' => false,
                            'error' => 'Este documento ya tiene una verificación pendiente.',
                            'codigo_error' => 'DOCUMENTO_PENDIENTE'
                        ];
                    }
                }
                
                // CASO C: Documento RECHAZADO - ✅ CUALQUIER usuario puede usar
                if ($documentoExistente['estado'] === 'rechazado') {
                    // ✅ CUALQUIER usuario puede usar un documento rechazado
                    $accion = 'reutilizar_rechazado';
                    $mensaje = 'Solicitud de verificación creada exitosamente';
                    
                    // Opcional: Notificar al usuario anterior
                    if ($documentoExistente['usuario_id'] != $usuarioId) {
                        $this->notificarUsuario($documentoExistente['usuario_id'], 
                            'Tu verificación rechazada ha sido reemplazada por otra solicitud.');
                    }
                }
                
            } else {
                // CASO D: Documento NUEVO
                $accion = 'nuevo';
                $mensaje = 'Solicitud de verificación creada exitosamente';
            }
            
            // 2. PROCEDER CON LA ACCIÓN CORRESPONDIENTE
            switch ($accion) {
                case 'actualizar_pendiente':
                    // Actualizar verificación pendiente existente
                    $sql = "UPDATE verificaciones_identidad 
                        SET documento_archivo = ?,
                            selfie_archivo = ?,
                            estado = 'pendiente',
                            fecha_solicitud = NOW()
                        WHERE id = ?";
                    $stmt = $this->conexion->prepare($sql);
                    $stmt->execute([
                        $datosVerificacion['documento_archivo'],
                        $datosVerificacion['selfie_archivo'],
                        $documentoExistente['id']
                    ]);
                    $verificacionId = $documentoExistente['id'];
                    break;
                    
                case 'reutilizar_rechazado':
                    // Reutilizar registro rechazado (actualizar con nuevo usuario)
                    $sql = "UPDATE verificaciones_identidad 
                        SET usuario_id = ?,
                            documento_archivo = ?,
                            selfie_archivo = ?,
                            estado = 'pendiente',
                            fecha_solicitud = NOW(),
                            notas_admin = NULL
                        WHERE id = ?";
                    $stmt = $this->conexion->prepare($sql);
                    $stmt->execute([
                        $usuarioId,
                        $datosVerificacion['documento_archivo'],
                        $datosVerificacion['selfie_archivo'],
                        $documentoExistente['id']
                    ]);
                    $verificacionId = $documentoExistente['id'];
                    break;
                    
                case 'nuevo':
                    // Crear nuevo registro
                    $sql = "INSERT INTO verificaciones_identidad 
                        (usuario_id, tipo_documento, numero_documento, 
                            documento_archivo, selfie_archivo, estado, fecha_solicitud) 
                        VALUES (?, ?, ?, ?, ?, 'pendiente', NOW())";
                    $stmt = $this->conexion->prepare($sql);
                    $stmt->execute([
                        $usuarioId,
                        $datosVerificacion['tipo_documento'],
                        $datosVerificacion['numero_documento'],
                        $datosVerificacion['documento_archivo'],
                        $datosVerificacion['selfie_archivo']
                    ]);
                    $verificacionId = $this->conexion->lastInsertId();
                    break;
            }
            
            // 3. ACTUALIZAR ESTADO EN EL PERFIL
            $sqlPerfil = "UPDATE perfiles SET estado_verificacion = 'pendiente' 
                        WHERE usuario_id = ?";
            $stmtPerfil = $this->conexion->prepare($sqlPerfil);
            $stmtPerfil->execute([$usuarioId]);
            
            // 4. CREAR LOG DE AUDITORÍA
            $this->crearLogAuditoria($usuarioId, 'solicitar_verificacion', 'verificaciones_identidad', $verificacionId, [
                'tipo_documento' => $datosVerificacion['tipo_documento'],
                'numero_documento' => substr($datosVerificacion['numero_documento'], 0, 3) . '***',
                'accion' => $accion
            ]);
            
            // 5. VERIFICAR SI EL USUARIO TIENE MÚLTIPLES VERIFICACIONES PENDIENTES
            $sqlContarPendientes = "SELECT COUNT(*) as total 
                                FROM verificaciones_identidad 
                                WHERE usuario_id = ? 
                                AND estado = 'pendiente'";
            
            $stmtContar = $this->conexion->prepare($sqlContarPendientes);
            $stmtContar->execute([$usuarioId]);
            $resultado = $stmtContar->fetch(PDO::FETCH_ASSOC);
            
            if ($resultado['total'] > 1) {
                // Eliminar verificaciones pendientes duplicadas
                $sqlEliminarDuplicados = "DELETE FROM verificaciones_identidad 
                                        WHERE usuario_id = ? 
                                        AND estado = 'pendiente' 
                                        AND id != ?";
                
                $stmtEliminar = $this->conexion->prepare($sqlEliminarDuplicados);
                $stmtEliminar->execute([$usuarioId, $verificacionId]);
                
                error_log("⚠️ Eliminadas verificaciones pendientes duplicadas para usuario $usuarioId");
            }
            
            $this->conexion->commit();
            
            error_log("✅ Verificación $accion exitosamente. ID: $verificacionId");
            
            return [
                'exito' => true,
                'mensaje' => $mensaje,
                'verificacion_id' => $verificacionId,
                'accion' => $accion,
                'estado' => 'pendiente'
            ];
            
        } catch (PDOException $e) {
            $this->conexion->rollBack();
            
            // Manejar error de restricción única
            if ($e->getCode() == '23000') {
                // Código específico para violación de índice único
                if (strpos($e->getMessage(), 'documento_unico') !== false) {
                    return [
                        'exito' => false,
                        'error' => 'Este documento ya está registrado en el sistema.',
                        'codigo_error' => 'DUPLICADO_UNICO'
                    ];
                }
            }
            
            error_log("❌ Error en iniciarVerificacion: " . $e->getMessage());
            return [
                'exito' => false, 
                'error' => 'Error del sistema al procesar la verificación',
                'debug' => (ENVIRONMENT === 'development') ? $e->getMessage() : null
            ];
            
        } catch (Exception $e) {
            $this->conexion->rollBack();
            error_log("❌ Error general en iniciarVerificacion: " . $e->getMessage());
            return ['exito' => false, 'error' => $e->getMessage()];
        }
    }

    public function obtenerEstadoVerificacion($usuarioId) {
        $sql = "SELECT vi.*, p.estado_verificacion 
                FROM verificaciones_identidad vi 
                LEFT JOIN perfiles p ON vi.usuario_id = p.usuario_id 
                WHERE vi.usuario_id = ? 
                ORDER BY vi.fecha_solicitud DESC 
                LIMIT 1";
        
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([$usuarioId]);
        $verificacion = $stmt->fetch(PDO::FETCH_ASSOC);
        $stmt = null;
        return $verificacion;
    }

    // Método auxiliar para logs
    private function crearLogAuditoria($usuarioId, $accion, $recurso, $recursoId = null, $detalles = null) {
        $sql = "INSERT INTO logs_auditoria (usuario_id, accion, recurso, recurso_id, detalles, ip_address) 
                VALUES (?, ?, ?, ?, ?, ?)";
        
        $stmt = $this->conexion->prepare($sql);
        $detallesJson = $detalles ? json_encode($detalles) : null;
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

        $stmt->execute([
            $usuarioId,
            $accion,
            $recurso,
            $recursoId,
            $detallesJson,
            $ip
        ]);
        $stmt = null;
    }
    
    /**
     * Guardar o actualizar perfil COMPLETO
     */
    public function guardar($datos) {
        try {
            // Verificar si el perfil ya existe
            $perfilExistente = $this->obtenerPorUsuarioId($datos['usuario_id']);
            
            if ($perfilExistente) {
                // Actualizar perfil existente
                return $this->actualizar($datos);
            } else {
                // Crear nuevo perfil
                return $this->crear($datos);
            }
            
        } catch (PDOException $e) {
            error_log("Error al guardar perfil: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al guardar el perfil: ' . $e->getMessage()];
        }
    }
    
    /**
     * Crear nuevo perfil COMPLETO
     */
    private function crear($datos) {
        try {
            $sql = "INSERT INTO perfiles 
                    (usuario_id, biografia, telefono, pais, ciudad, ubicacion, 
                     habilidades, idiomas, intereses, experiencias_previas, 
                     redes_sociales, disponibilidad, fecha_nacimiento) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            $stmt = $this->conexion->prepare($sql);
            
            // Preparar datos para la base de datos
            $habilidadesJson = json_encode($datos['habilidades'] ?? []);
            $idiomasJson = json_encode($datos['idiomas'] ?? ['espanol']);
            $interesesJson = json_encode($datos['intereses'] ?? []);
            $redesSocialesJson = json_encode($datos['redes_sociales'] ?? []);
            $experienciasJson = json_encode($datos['experiencias_previas'] ?? []);
            
            $stmt->execute([
                $datos['usuario_id'],
                $datos['biografia'] ?? '',
                $datos['telefono'] ?? '',
                $datos['pais'] ?? '',
                $datos['ciudad'] ?? '',
                $datos['ubicacion'] ?? '',
                $habilidadesJson,
                $idiomasJson,
                $interesesJson,
                $experienciasJson,
                $redesSocialesJson,
                $datos['disponibilidad'] ?? '',
                $datos['fecha_nacimiento'] ?? null
            ]);
            
            // Obtener el perfil recién creado
            $perfil = $this->obtenerPorUsuarioId($datos['usuario_id']);
            
            return [
                'exito' => true,
                'mensaje' => 'Perfil creado exitosamente',
                'perfil' => $perfil
            ];
            
        } catch (PDOException $e) {
            error_log("Error al crear perfil: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al crear el perfil: ' . $e->getMessage()];
        }
    }
    
    /**
     * Actualizar perfil existente COMPLETO
     */
    private function actualizar($datos) {
        try {
            $sql = "UPDATE perfiles SET 
                    biografia = ?, 
                    telefono = ?, 
                    pais = ?,
                    ciudad = ?,
                    ubicacion = ?, 
                    habilidades = ?, 
                    idiomas = ?, 
                    intereses = ?, 
                    experiencias_previas = ?,
                    redes_sociales = ?,
                    disponibilidad = ?,
                    fecha_nacimiento = ?
                    WHERE usuario_id = ?";
            
            $stmt = $this->conexion->prepare($sql);
            
            // Preparar datos para la base de datos
            $habilidadesJson = json_encode($datos['habilidades'] ?? []);
            $idiomasJson = json_encode($datos['idiomas'] ?? ['espanol']);
            $interesesJson = json_encode($datos['intereses'] ?? []);
            $redesSocialesJson = json_encode($datos['redes_sociales'] ?? []);
            $experienciasJson = json_encode($datos['experiencias_previas'] ?? []);
            
            $stmt->execute([
                $datos['biografia'] ?? '',
                $datos['telefono'] ?? '',
                $datos['pais'] ?? '',
                $datos['ciudad'] ?? '',
                $datos['ubicacion'] ?? '',
                $habilidadesJson,
                $idiomasJson,
                $interesesJson,
                $experienciasJson,
                $redesSocialesJson,
                $datos['disponibilidad'] ?? '',
                $datos['fecha_nacimiento'] ?? null,
                $datos['usuario_id']
            ]);
            
            // Obtener el perfil actualizado
            $perfil = $this->obtenerPorUsuarioId($datos['usuario_id']);
            
            if ($perfil) {
                return [
                    'exito' => true,
                    'mensaje' => 'Perfil actualizado exitosamente',
                    'perfil' => $perfil
                ];
            } else {
                return ['exito' => false, 'error' => 'No se pudo verificar la actualización del perfil'];
            }
            
        } catch (PDOException $e) {
            error_log("Error al actualizar perfil: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al actualizar el perfil: ' . $e->getMessage()];
        }
    }
    
    /**
     * Actualizar foto de perfil
     */
    public function actualizarFoto($usuarioId, $urlFoto) {
        try {
            $sql = "UPDATE perfiles SET foto_perfil = ? WHERE usuario_id = ?";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$urlFoto, $usuarioId]);
            
            return [
                'exito' => true,
                'mensaje' => 'Foto de perfil actualizada'
            ];
            
        } catch (PDOException $e) {
            error_log("Error al actualizar foto de perfil: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al actualizar la foto de perfil'];
        }
    }
}
?>