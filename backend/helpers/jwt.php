<?php


class JWT {
    // Cambiar esto a una clave secreta fuerte
    private static $secretKey = "tu_clave_secreta_super_segura_cambiar_en_produccion_12345";
    
    // Algoritmo de firma
    private static $algorithm = 'HS256';
    
    // Tiempo de expiración en segundos (24 horas)
    private static $expirationTime = 86400;
    
    /**
     * Generar un token JWT
     * 
     * @param array $datos Información a incluir en el token
     * @param int $expirationTime Tiempo en segundos
     * @return string Token JWT
     */
    public static function generarToken($datos, $expirationTime = null) {
        if ($expirationTime === null) {
            $expirationTime = self::$expirationTime;
        }
        
        // Header
        $header = [
            'alg' => self::$algorithm,
            'typ' => 'JWT'
        ];
        
        // Payload
        $payload = array_merge($datos, [
            'iat' => time(),  // Issued at
            'exp' => time() + $expirationTime  // Expiration time
        ]);
        
        // Codificar header y payload
        $headerEncoded = self::base64UrlEncode(json_encode($header));
        $payloadEncoded = self::base64UrlEncode(json_encode($payload));
        
        // Crear firma
        $signature = self::base64UrlEncode(
            hash_hmac('sha256', "$headerEncoded.$payloadEncoded", self::$secretKey, true)
        );
        
        // Combinar en token
        return "$headerEncoded.$payloadEncoded.$signature";
    }
    
    /**
     * Validar un token JWT
     * 
     * @param string $token Token a validar
     * @return array|false Datos del payload si es válido, false si no
     */
    public static function validarToken($token) {
        try {
            // Dividir token en partes
            $partes = explode('.', $token);
            
            if (count($partes) !== 3) {
                error_log("JWT: Token con formato inválido");
                return false;
            }
            
            $headerEncoded = $partes[0];
            $payloadEncoded = $partes[1];
            $signatureRecibida = $partes[2];
            
            // Validar firma
            $signatureCalculada = self::base64UrlEncode(
                hash_hmac('sha256', "$headerEncoded.$payloadEncoded", self::$secretKey, true)
            );
            
            if ($signatureRecibida !== $signatureCalculada) {
                error_log("JWT: Firma inválida");
                return false;
            }
            
            // Decodificar payload
            $payload = json_decode(self::base64UrlDecode($payloadEncoded), true);
            
            if (!$payload) {
                error_log("JWT: No se pudo decodificar payload");
                return false;
            }
            
            // Verificar expiración
            if (isset($payload['exp']) && $payload['exp'] < time()) {
                error_log("JWT: Token expirado");
                return false;
            }
            
            return $payload;
            
        } catch (Exception $e) {
            error_log("JWT Error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Refrescar un token (genera uno nuevo)
     * 
     * @param string $tokenViejo Token anterior
     * @param int $expirationTime Nuevo tiempo de expiración
     * @return string|false Nuevo token o false si falla
     */
    //solo verifica que funcione correctamente
    public static function refrescarToken($tokenViejo, $expirationTime = null) {
        $payload = self::validarToken($tokenViejo);
        
        if (!$payload) {
            return false;
        }
        
        // Remover datos de tiempo anterior
        unset($payload['iat']);
        unset($payload['exp']);
        
        // Generar nuevo token
        return self::generarToken($payload, $expirationTime);
    }
    
    /**
     * Obtener datos del token sin validar firma
     * (Usar solo para debugging)
     * 
     * @param string $token Token
     * @return array|false Payload decodificado
     */
    public static function obtenerPayload($token) {
        try {
            $partes = explode('.', $token);
            if (count($partes) !== 3) {
                return false;
            }
            return json_decode(self::base64UrlDecode($partes[1]), true);
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Codificar Base64 URL-safe
     */
    private static function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    
    /**
     * Decodificar Base64 URL-safe
     */
    private static function base64UrlDecode($data) {
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 4 - strlen($data) % 4));
    }
}

// ============= FUNCIONES DE UTILIDAD =============

/**
 * Obtener token del header Authorization
 * Header esperado: Authorization: Bearer <token>
 * 
 * @return string|null Token sin "Bearer " o null si no existe
 */
function obtenerTokenDelHeader() {
    $headers = getallheaders();
    
    if (isset($headers['Authorization'])) {
        $auth = $headers['Authorization'];
        if (strpos($auth, 'Bearer ') === 0) {
            return substr($auth, 7); // Remover "Bearer "
        }
    }
    
    return null;
}

/**
 * Validar autenticación (verificar token)
 * 
 * @return array|false Datos del usuario si es válido, false si no
 */
function validarAutenticacion() {
    $token = obtenerTokenDelHeader();
    
    if (!$token) {
        http_response_code(401);
        echo json_encode([
            'exito' => false,
            'error' => 'Token no proporcionado'
        ]);
        exit;
    }
    
    $payload = JWT::validarToken($token);
    
    if (!$payload) {
        http_response_code(401);
        echo json_encode([
            'exito' => false,
            'error' => 'Token inválido o expirado'
        ]);
        exit;
    }
    
    return $payload;
}
?>
