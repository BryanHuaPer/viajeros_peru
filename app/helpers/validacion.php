<?php
class Validador {
    
    /**
     * Validar correo electrónico
     */
    public function validarCorreo($correo) {
        if (empty($correo)) {
            return false;
        }
        
        return filter_var($correo, FILTER_VALIDATE_EMAIL) !== false;
    }
    
    /**
     * Validar contraseña
     */
    public function validarContrasena($contrasena) {
        if (empty($contrasena)) {
            return false;
        }
        
        return strlen($contrasena) >= 6;
    }
    
    /**
     * Validar texto (nombre, apellido, etc.)
     */
    public function validarTexto($texto, $minLongitud = 1, $maxLongitud = 255) {
        if (empty($texto)) {
            return false;
        }
        
        $longitud = strlen(trim($texto));
        return $longitud >= $minLongitud && $longitud <= $maxLongitud;
    }
    
    /**
     * Validar número
     */
    public function validarNumero($numero, $min = null, $max = null) {
        if (!is_numeric($numero)) {
            return false;
        }
        
        $numero = (float) $numero;
        
        if ($min !== null && $numero < $min) {
            return false;
        }
        
        if ($max !== null && $numero > $max) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Validar URL
     */
    public function validarURL($url) {
        if (empty($url)) {
            return false;
        }
        
        return filter_var($url, FILTER_VALIDATE_URL) !== false;
    }
    
    /**
     * Sanitizar texto (prevenir XSS)
     */
    public function sanitizarTexto($texto) {
        return htmlspecialchars(trim($texto), ENT_QUOTES, 'UTF-8');
    }
    
    /**
     * Validar fecha
     */
    public function validarFecha($fecha, $formato = 'Y-m-d') {
        if (empty($fecha)) {
            return false;
        }
        
        $d = DateTime::createFromFormat($formato, $fecha);
        return $d && $d->format($formato) === $fecha;
    }

    /**
     * Validar contenido de mensaje (específico para mensajes de chat)
     * 
     * @param string $contenido Texto del mensaje
     * @param int|null $usuarioId ID del usuario para logging (opcional)
     * @return array Resultado de validación
     */
    public static function validarContenidoMensaje($contenido, $usuarioId = null) {
        // 1. Validar que no esté vacío
        $contenidoTrim = trim($contenido);
        if (strlen($contenidoTrim) < 1) {
            return [
                'exito' => false,
                'error' => 'El mensaje no puede estar vacío',
                'codigo' => 'CONTENIDO_VACIO'
            ];
        }
        
        // 2. Validar longitud máxima
        if (strlen($contenido) > 2000) {
            return [
                'exito' => false,
                'error' => 'El mensaje no puede exceder 2000 caracteres',
                'codigo' => 'CONTENIDO_DEMASIADO_LARGO',
                'longitud_actual' => strlen($contenido)
            ];
        }
        
        // 3. Validar longitud mínima razonable (opcional)
        if (strlen($contenidoTrim) < 2) {
            return [
                'exito' => false,
                'error' => 'El mensaje es demasiado corto',
                'codigo' => 'CONTENIDO_DEMASIADO_CORTO'
            ];
        }
        
        // 4. Filtrar XSS (escapar HTML pero mantener texto plano)
        $contenidoLimpio = htmlspecialchars($contenido, ENT_QUOTES, 'UTF-8');
        
        // 5. Lista de palabras/patrones prohibidos
        $patronesProhibidos = [
            // Ataques XSS/JavaScript
            '/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/is',
            '/javascript:/i',
            '/onclick\s*=/i',
            '/onload\s*=/i',
            '/onerror\s*=/i',
            '/onmouse\w*\s*=/i',
            '/data:text\/html/i',
            
            // Spam/Phishing
            '/bit\.ly|tinyurl|goo\.gl|ow\.ly/i',
            '/compra\s+ahora|oferta\s+exclusiva|gana\s+dinero/i',
            
            // Inyección SQL (aunque usamos prepared statements)
            '/union\s+select|select\s+.*from|insert\s+into|drop\s+table/i',
            
            // Contenido peligroso
            '/\b(phishing|malware|virus|hack)\b/i'
        ];
        
        foreach ($patronesProhibidos as $patron) {
            if (preg_match($patron, $contenidoLimpio)) {
                // Registrar intento si tenemos usuarioId
                if ($usuarioId !== null) {
                    self::registrarIntentoContenidoInapropiado($usuarioId, $patron, $contenidoTrim);
                }
                
                return [
                    'exito' => false,
                    'error' => 'El mensaje contiene contenido no permitido',
                    'codigo' => 'CONTENIDO_PROHIBIDO',
                    'patron' => $patron
                ];
            }
        }
        
        // 6. Validar palabras específicas prohibidas (lenguaje ofensivo)
        $palabrasProhibidas = [
            'puta', 'mierda', 'carajo', 'concha', 'joder', 'verga', 'coño',
            'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'dick',
            'estafa', 'trampa', 'engaño', 'fraude'
        ];
        
        foreach ($palabrasProhibidas as $palabra) {
            if (stripos($contenidoLimpio, $palabra) !== false) {
                // Registrar intento si tenemos usuarioId
                if ($usuarioId !== null) {
                    self::registrarIntentoContenidoInapropiado($usuarioId, $palabra, $contenidoTrim);
                }
                
                return [
                    'exito' => false,
                    'error' => 'El mensaje contiene lenguaje inapropiado',
                    'codigo' => 'LENGUAJE_INAPROPIADO',
                    'palabra' => $palabra
                ];
            }
        }
        
        // 7. Prevenir exceso de mayúsculas (considerado spam)
        $letrasMayusculas = preg_match_all('/[A-Z]/', $contenidoLimpio);
        $letrasTotales = preg_match_all('/[A-Za-z]/', $contenidoLimpio);
        
        if ($letrasTotales > 10 && $letrasMayusculas > 0) {
            $porcentajeMayusculas = ($letrasMayusculas / $letrasTotales) * 100;
            
            if ($porcentajeMayusculas > 80) { // Más del 80% en mayúsculas
                return [
                    'exito' => false,
                    'error' => 'Por favor evita escribir solo en mayúsculas',
                    'codigo' => 'EXCESO_MAYUSCULAS',
                    'porcentaje' => $porcentajeMayusculas
                ];
            }
        }
        
        // 8. Prevenir repetición excesiva de caracteres (spam)
        if (preg_match('/(.)\1{10,}/', $contenidoLimpio)) {
            return [
                'exito' => false,
                'error' => 'El mensaje contiene repeticiones excesivas',
                'codigo' => 'REPETICION_EXCESIVA'
            ];
        }
        
        // 9. Validar que no sea solo emojis/símbolos (opcional)
        $contenidoSinEmojis = preg_replace('/[\x{1F600}-\x{1F64F}\x{1F300}-\x{1F5FF}\x{1F680}-\x{1F6FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}]/u', '', $contenidoLimpio);
        $contenidoSinEspacios = preg_replace('/\s+/', '', $contenidoSinEmojis);
        
        if (strlen($contenidoSinEspacios) < 1 && strlen($contenidoTrim) > 5) {
            return [
                'exito' => false,
                'error' => 'El mensaje debe contener texto además de emojis',
                'codigo' => 'SOLO_EMOJIS'
            ];
        }
        
        return [
            'exito' => true,
            'contenido' => $contenidoLimpio,
            'advertencias' => []
        ];
    }
    
    /**
     * Registrar intento de contenido inapropiado
     */
    private static function registrarIntentoContenidoInapropiado($usuarioId, $violacion, $contenido) {
        try {
            // Intentar usar el sistema de logs si existe
            if (file_exists(__DIR__ . '/../../backend/helpers/logs.php')) {
                require_once __DIR__ . '/../../backend/helpers/logs.php';
                $auditoria = obtenerAuditoria();
                
                if ($auditoria) {
                    $auditoria->registrarIntentoInapropiado(
                        $usuarioId,
                        is_string($violacion) ? $violacion : 'patron_prohibido',
                        $contenido,
                        ['violacion_detectada' => $violacion]
                    );
                }
            } else {
                // Fallback: log simple
                error_log("Intento contenido inapropiado - Usuario: $usuarioId, Violación: $violacion, Preview: " . substr($contenido, 0, 50));
            }
        } catch (Exception $e) {
            // Silencioso en producción
            error_log("Error registrando intento inapropiado: " . $e->getMessage());
        }
    }
    
    /**
     * Sanitizar contenido manteniendo formato básico (saltos de línea)
     */
    public static function sanitizarMensajeConFormato($contenido) {
        // 1. Escapar HTML
        $contenido = htmlspecialchars($contenido, ENT_QUOTES, 'UTF-8');
        
        // 2. Mantener saltos de línea (convertir \n a <br> para visualización)
        $contenido = nl2br($contenido);
        
        // 3. Permitir enlaces simples (opcional, si quieres permitir URLs)
        // $contenido = preg_replace('/(https?:\/\/[^\s]+)/', '<a href="$1" target="_blank" rel="nofollow">$1</a>', $contenido);
        
        // 4. Eliminar tags peligrosos que puedan haber pasado
        $contenido = strip_tags($contenido, '<br><a>');
        
        return $contenido;
    }
    
    /**
     * Validar contenido para búsqueda (más permisivo que para mensajes)
     */
    public static function validarContenidoBusqueda($contenido) {
        $contenidoTrim = trim($contenido);
        
        if (strlen($contenidoTrim) < 1) {
            return ['exito' => false, 'error' => 'La búsqueda no puede estar vacía'];
        }
        
        if (strlen($contenido) > 100) {
            return ['exito' => false, 'error' => 'La búsqueda no puede exceder 100 caracteres'];
        }
        
        // Filtrar XSS
        $contenidoLimpio = htmlspecialchars($contenido, ENT_QUOTES, 'UTF-8');
        
        // Patrones peligrosos
        $patronesPeligrosos = [
            '/<script/i',
            '/javascript:/i',
            '/onclick\s*=/i'
        ];
        
        foreach ($patronesPeligrosos as $patron) {
            if (preg_match($patron, $contenidoLimpio)) {
                return ['exito' => false, 'error' => 'Búsqueda con contenido no permitido'];
            }
        }
        
        return ['exito' => true, 'contenido' => $contenidoLimpio];
    }
}
// ============= FUNCIONES DE CONVENIENCIA =============

/**
 * Validar mensaje rápidamente
 */
function validarMensaje($contenido, $usuarioId = null) {
    return Validador::validarContenidoMensaje($contenido, $usuarioId);
}

/**
 * Sanitizar mensaje con formato básico
 */
function sanitizarMensaje($contenido) {
    return Validador::sanitizarMensajeConFormato($contenido);
}

?>