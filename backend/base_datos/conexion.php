
<?php
// Bootstrap de rutas absolutas
require_once realpath(__DIR__ . '/../../app/config/bootstrap.php');
// Configuración central (archivo puente en backend/ que incluye la clase Configuracion)
require_once BASE_PATH . '/backend/configuracion.php';

class ConexionBD {
    private $conexion;

    public function __construct() {
        try {
            $dsn = "mysql:host=" . Configuracion::BD_SERVIDOR .
                   ";dbname=" . Configuracion::BD_NOMBRE .
                   ";charset=utf8";

            $this->conexion = new PDO(
                $dsn,
                Configuracion::BD_USUARIO,
                Configuracion::BD_CONTRASENA,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]
            );

            error_log("✅ Conexión a BD exitosa");

        } catch (PDOException $e) {
            error_log("❌ Error de conexión a BD: " . $e->getMessage());
            // Enviar error como JSON en lugar de morir
            if (!headers_sent()) {
                header('Content-Type: application/json');
            }
            echo json_encode([
                'exito' => false,
                'error' => 'Error de conexión a la base de datos',
                'debug' => $e->getMessage()
            ]);
            exit;
        }
    }

    public function obtenerConexion() {
        return $this->conexion;
    }

    public function ejecutar($sql, $parametros = []) {
        try {
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute($parametros);
            return $stmt;
        } catch (PDOException $e) {
            error_log("❌ Error en consulta SQL: " . $e->getMessage());
            error_log("SQL: " . $sql);
            error_log("Parámetros: " . print_r($parametros, true));
            return false;
        }
    }

    public function obtenerUno($sql, $parametros = []) {
        $stmt = $this->ejecutar($sql, $parametros);
        return $stmt ? $stmt->fetch() : false;
    }

    public function obtenerTodos($sql, $parametros = []) {
        $stmt = $this->ejecutar($sql, $parametros);
        return $stmt ? $stmt->fetchAll() : [];
    }

    public function obtenerUltimoId() {
        return $this->conexion->lastInsertId();
    }
}

// Inicializar conexión global
try {
    $conexionBD = new ConexionBD();
    $conexion = $conexionBD->obtenerConexion();
    // Hacer disponible la conexión también en $GLOBALS para compatibilidad
    $GLOBALS['conexion'] = $conexion;
} catch (Exception $e) {
    error_log("Error inicializando conexión: " . $e->getMessage());
    $conexion = null;
}

?>