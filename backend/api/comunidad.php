<?php
require_once __DIR__ . '/common.php';

// Para debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Obtener acción
$accion = $_GET['accion'] ?? '';
if (empty($accion)) {
    $input = file_get_contents('php://input');
    $datos = json_decode($input, true) ?? $_POST;
    $accion = $datos['accion'] ?? '';
}

error_log("Acción recibida en comunidad.php: $accion");

try {
    // Obtener conexión PDO
    require_once __DIR__ . '/../base_datos/conexion.php';
    
    if (!isset($conexion)) {
        throw new Exception("No se pudo obtener conexión a la base de datos");
    }
    
    switch ($accion) {
        case 'obtener':
            obtenerPublicaciones($conexion);
            break;
        case 'crear':
            crearPublicacion($conexion, $datos ?? []);
            break;
        case 'obtener_detalle':
            obtenerPublicacionDetalle($conexion);
            break;
        case 'crear_comentario':
            crearComentario($conexion, $datos ?? []);
            break;
        case 'eliminar':
            eliminarPublicacion($conexion, $datos ?? []);
            break;
        case 'obtener_comentarios':
            obtenerComentarios($conexion);
            break;
        default:
            responderJSON(['exito' => false, 'error' => 'Acción no válida: ' . $accion]);
    }
} catch (Exception $e) {
    error_log("Error en comunidad.php: " . $e->getMessage());
    responderJSON(['exito' => false, 'error' => 'Error interno del servidor: ' . $e->getMessage()]);
}

function obtenerPublicaciones($conexion) {
    $filtro = $_GET['filtro'] ?? 'todas';
    $pagina = intval($_GET['pagina'] ?? 1);
    $limite = 10;
    $offset = ($pagina - 1) * $limite;
    
    error_log("Filtro: $filtro, Página: $pagina");
    
    try {
        // Construir consulta SQL
        $sql = "SELECT cp.*, u.nombre, u.apellido 
                FROM comunidad_publicaciones cp
                JOIN usuarios u ON cp.autor_id = u.id
                WHERE cp.estado = 'activo'";
        
        $params = [];
        
        if ($filtro !== 'todas') {
            $sql .= " AND cp.tipo = :tipo";
            $params[':tipo'] = $filtro;
        }
        
        $sql .= " ORDER BY cp.fecha_publicacion DESC LIMIT :limite OFFSET :offset";
        
        error_log("SQL: $sql");
        
        $stmt = $conexion->prepare($sql);
        
        // Vincular parámetros
        if ($filtro !== 'todas') {
            $stmt->bindValue(':tipo', $filtro, PDO::PARAM_STR);
        }
        $stmt->bindValue(':limite', $limite, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        
        $stmt->execute();
        $publicaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Procesar cada publicación
        foreach ($publicaciones as &$publicacion) {
            // Obtener foto de perfil
            $sqlFoto = "SELECT foto_perfil FROM perfiles WHERE usuario_id = :usuario_id";
            $stmtFoto = $conexion->prepare($sqlFoto);
            $stmtFoto->bindValue(':usuario_id', $publicacion['autor_id'], PDO::PARAM_INT);
            $stmtFoto->execute();
            $foto = $stmtFoto->fetch(PDO::FETCH_ASSOC);
            $publicacion['foto_perfil'] = $foto['foto_perfil'] ?? '/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg';
            
            // Obtener conteo de comentarios
            $sqlComentarios = "SELECT COUNT(*) as total FROM comunidad_comentarios WHERE publicacion_id = :publicacion_id";
            $stmtCom = $conexion->prepare($sqlComentarios);
            $stmtCom->bindValue(':publicacion_id', $publicacion['id'], PDO::PARAM_INT);
            $stmtCom->execute();
            $comentarios = $stmtCom->fetch(PDO::FETCH_ASSOC);
            $publicacion['total_comentarios'] = $comentarios['total'] ?? 0;
            
            // Formatear datos
            $publicacion['autor_nombre_completo'] = $publicacion['nombre'] . ' ' . $publicacion['apellido'];
            $publicacion['fecha_formateada'] = date('d/m/Y', strtotime($publicacion['fecha_publicacion']));
            $publicacion['contenido_corto'] = substr(strip_tags($publicacion['contenido']), 0, 200) . 
                                            (strlen(strip_tags($publicacion['contenido'])) > 200 ? '...' : '');
            
            // Decodificar etiquetas
            if (!empty($publicacion['etiquetas'])) {
                $publicacion['etiquetas_array'] = json_decode($publicacion['etiquetas'], true);
            } else {
                $publicacion['etiquetas_array'] = [];
            }
        }
        
        // Obtener total para paginación
        $sqlTotal = "SELECT COUNT(*) as total FROM comunidad_publicaciones WHERE estado = 'activo'";
        if ($filtro !== 'todas') {
            $sqlTotal .= " AND tipo = :tipo";
        }
        
        $stmtTotal = $conexion->prepare($sqlTotal);
        if ($filtro !== 'todas') {
            $stmtTotal->bindValue(':tipo', $filtro, PDO::PARAM_STR);
        }
        $stmtTotal->execute();
        $totalResult = $stmtTotal->fetch(PDO::FETCH_ASSOC);
        $total = $totalResult['total'] ?? 0;
        
        responderJSON([
            'exito' => true,
            'publicaciones' => $publicaciones,
            'total' => $total,
            'pagina_actual' => $pagina,
            'total_paginas' => ceil($total / $limite),
            'mensaje' => 'Publicaciones obtenidas exitosamente'
        ]);
        
    } catch (PDOException $e) {
        error_log("Error PDO en obtenerPublicaciones: " . $e->getMessage());
        responderJSON(['exito' => false, 'error' => 'Error en la base de datos: ' . $e->getMessage()]);
    }
}

function crearPublicacion($conexion, $datos) {
    error_log("Datos para crear publicación: " . print_r($datos, true));
    
    try {
        // Validar datos
        if (empty($datos['titulo']) || empty($datos['contenido'])) {
            responderJSON(['exito' => false, 'error' => 'Título y contenido son requeridos']);
            return;
        }
        
        // Obtener usuario autenticado: intentar header Authorization, luego token en body, luego token en query string
        $usuarioId = null;
        $token = null;

        // 1) Headers
        $headers = null;
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
        } else {
            // Fallback similar a common::obtenerHeaders
            foreach ($_SERVER as $name => $value) {
                if (substr($name, 0, 5) == 'HTTP_') {
                    $headerName = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
                    $headers[$headerName] = $value;
                }
            }
            if (isset($_SERVER['CONTENT_TYPE'])) $headers['Content-Type'] = $_SERVER['CONTENT_TYPE'];
        }

        if (!empty($headers['Authorization'])) {
            $token = str_replace('Bearer ', '', $headers['Authorization']);
        }

        // 2) Body
        if (empty($token) && !empty($datos['token'])) {
            $token = $datos['token'];
        }

        // 3) Query param
        if (empty($token) && !empty($_GET['token'])) {
            $token = $_GET['token'];
        }

        if (!empty($token)) {
            require_once __DIR__ . '/../helpers/jwt.php';
            if (method_exists('JWT', 'validarToken')) {
                $payload = JWT::validarToken($token);
            } else {
                $payload = JWT::obtenerPayload($token);
            }
            if ($payload && isset($payload['usuario_id'])) {
                $usuarioId = $payload['usuario_id'];
            }
        }

        // Si no hay usuario autenticado, usar usuario 1 para pruebas (mantener comportamiento previo)
        if (!$usuarioId) {
            $usuarioId = 1; // Usuario de prueba
            error_log("⚠️ Usando usuario de prueba ID: 1");
        }
        
        $titulo = htmlspecialchars(trim($datos['titulo']));
        $contenido = htmlspecialchars(trim($datos['contenido']));
        $tipo = htmlspecialchars(trim($datos['categoria'] ?? 'experiencia'));
        $etiquetas = isset($datos['etiquetas']) ? json_encode($datos['etiquetas']) : '[]';
        
        // Validar tipo
        $tiposPermitidos = ['experiencia', 'pregunta', 'consejo', 'evento'];
        if (!in_array($tipo, $tiposPermitidos)) {
            $tipo = 'experiencia';
        }
        
        error_log("Insertando publicación: usuario=$usuarioId, titulo=$titulo, tipo=$tipo");
        
        $sql = "INSERT INTO comunidad_publicaciones (autor_id, titulo, contenido, tipo, etiquetas)
                VALUES (:autor_id, :titulo, :contenido, :tipo, :etiquetas)";
        
        $stmt = $conexion->prepare($sql);
        $stmt->bindValue(':autor_id', $usuarioId, PDO::PARAM_INT);
        $stmt->bindValue(':titulo', $titulo, PDO::PARAM_STR);
        $stmt->bindValue(':contenido', $contenido, PDO::PARAM_STR);
        $stmt->bindValue(':tipo', $tipo, PDO::PARAM_STR);
        $stmt->bindValue(':etiquetas', $etiquetas, PDO::PARAM_STR);
        
        if ($stmt->execute()) {
            $id = $conexion->lastInsertId();
            error_log("Publicación creada con ID: $id");
            
            // Obtener datos de la publicación creada
            $sqlPublicacion = "SELECT cp.*, u.nombre, u.apellido 
                              FROM comunidad_publicaciones cp
                              JOIN usuarios u ON cp.autor_id = u.id
                              WHERE cp.id = :id";
            
            $stmtPub = $conexion->prepare($sqlPublicacion);
            $stmtPub->bindValue(':id', $id, PDO::PARAM_INT);
            $stmtPub->execute();
            $publicacion = $stmtPub->fetch(PDO::FETCH_ASSOC);
            
            responderJSON([
                'exito' => true, 
                'id' => $id,
                'publicacion' => $publicacion,
                'mensaje' => 'Publicación creada exitosamente'
            ]);
        } else {
            $error = $stmt->errorInfo();
            error_log("Error ejecutando inserción: " . print_r($error, true));
            responderJSON(['exito' => false, 'error' => 'Error al crear la publicación: ' . $error[2]]);
        }
        
    } catch (PDOException $e) {
        error_log("Error PDO en crearPublicacion: " . $e->getMessage());
        responderJSON(['exito' => false, 'error' => 'Error en la base de datos: ' . $e->getMessage()]);
    }
}

function obtenerPublicacionDetalle($conexion) {
    $publicacionId = intval($_GET['id'] ?? 0);
    
    error_log("Obteniendo detalle de publicación ID: $publicacionId");
    
    if ($publicacionId <= 0) {
        responderJSON(['exito' => false, 'error' => 'ID de publicación no válido']);
        return;
    }
    
    try {
        $sql = "SELECT cp.*, u.nombre, u.apellido 
                FROM comunidad_publicaciones cp
                JOIN usuarios u ON cp.autor_id = u.id
                WHERE cp.id = :id AND cp.estado = 'activo'";
        
        $stmt = $conexion->prepare($sql);
        $stmt->bindValue(':id', $publicacionId, PDO::PARAM_INT);
        $stmt->execute();
        
        $publicacion = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($publicacion) {
            // Obtener foto de perfil
            $sqlFoto = "SELECT foto_perfil FROM perfiles WHERE usuario_id = :usuario_id";
            $stmtFoto = $conexion->prepare($sqlFoto);
            $stmtFoto->bindValue(':usuario_id', $publicacion['autor_id'], PDO::PARAM_INT);
            $stmtFoto->execute();
            $foto = $stmtFoto->fetch(PDO::FETCH_ASSOC);
            $publicacion['foto_perfil'] = $foto['foto_perfil'] ?? '/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg';
            
            // Obtener comentarios
            $sqlComentarios = "SELECT cc.*, u.nombre, u.apellido 
                              FROM comunidad_comentarios cc
                              JOIN usuarios u ON cc.autor_id = u.id
                              WHERE cc.publicacion_id = :publicacion_id
                              ORDER BY cc.fecha_creacion ASC";
            
            $stmtComentarios = $conexion->prepare($sqlComentarios);
            $stmtComentarios->bindValue(':publicacion_id', $publicacionId, PDO::PARAM_INT);
            $stmtComentarios->execute();
            $comentarios = $stmtComentarios->fetchAll(PDO::FETCH_ASSOC);
            
            // Procesar comentarios
            foreach ($comentarios as &$comentario) {
                $sqlFotoCom = "SELECT foto_perfil FROM perfiles WHERE usuario_id = :usuario_id";
                $stmtFotoCom = $conexion->prepare($sqlFotoCom);
                $stmtFotoCom->bindValue(':usuario_id', $comentario['autor_id'], PDO::PARAM_INT);
                $stmtFotoCom->execute();
                $fotoCom = $stmtFotoCom->fetch(PDO::FETCH_ASSOC);
                $comentario['foto_perfil'] = $fotoCom['foto_perfil'] ?? '/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg';
                
                $comentario['fecha_formateada'] = date('d/m/Y H:i', strtotime($comentario['fecha_creacion']));
            }
            
            // Formatear publicación
            if (!empty($publicacion['etiquetas'])) {
                $publicacion['etiquetas_array'] = json_decode($publicacion['etiquetas'], true);
            } else {
                $publicacion['etiquetas_array'] = [];
            }
            
            $publicacion['fecha_formateada'] = date('d/m/Y H:i', strtotime($publicacion['fecha_publicacion']));
            $publicacion['autor_nombre_completo'] = $publicacion['nombre'] . ' ' . $publicacion['apellido'];
            $publicacion['comentarios'] = $comentarios;
            
            responderJSON(['exito' => true, 'publicacion' => $publicacion]);
        } else {
            responderJSON(['exito' => false, 'error' => 'Publicación no encontrada']);
        }
        
    } catch (PDOException $e) {
        error_log("Error PDO en obtenerPublicacionDetalle: " . $e->getMessage());
        responderJSON(['exito' => false, 'error' => 'Error en la base de datos: ' . $e->getMessage()]);
    }
}

function obtenerComentarios($conexion) {
    $publicacionId = intval($_GET['publicacion_id'] ?? 0);
    
    if ($publicacionId <= 0) {
        responderJSON(['exito' => false, 'error' => 'ID de publicación no válido']);
        return;
    }
    
    try {
        $sql = "SELECT cc.*, u.nombre, u.apellido
                FROM comunidad_comentarios cc
                JOIN usuarios u ON cc.autor_id = u.id
                WHERE cc.publicacion_id = :publicacion_id
                ORDER BY cc.fecha_creacion ASC";
        
        $stmt = $conexion->prepare($sql);
        $stmt->bindValue(':publicacion_id', $publicacionId, PDO::PARAM_INT);
        $stmt->execute();
        $comentarios = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Procesar comentarios
        foreach ($comentarios as &$comentario) {
            $comentario['fecha_formateada'] = date('d/m/Y H:i', strtotime($comentario['fecha_creacion']));
        }
        
        responderJSON(['exito' => true, 'comentarios' => $comentarios]);
        
    } catch (PDOException $e) {
        error_log("Error PDO en obtenerComentarios: " . $e->getMessage());
        responderJSON(['exito' => false, 'error' => 'Error en la base de datos: ' . $e->getMessage()]);
    }
}

function crearComentario($conexion, $datos) {
    error_log("Datos para crear comentario: " . print_r($datos, true));
    
    try {
        // Validar datos
        if (empty($datos['publicacion_id']) || empty($datos['contenido'])) {
            responderJSON(['exito' => false, 'error' => 'ID de publicación y contenido son requeridos']);
            return;
        }
        
        // Obtener usuario autenticado: intentar header Authorization, luego token en body, luego token en query string
        $usuarioId = null;
        $token = null;

        if (function_exists('getallheaders')) {
            $headers = getallheaders();
        } else {
            $headers = [];
            foreach ($_SERVER as $name => $value) {
                if (substr($name, 0, 5) == 'HTTP_') {
                    $headerName = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
                    $headers[$headerName] = $value;
                }
            }
        }

        if (!empty($headers['Authorization'])) {
            $token = str_replace('Bearer ', '', $headers['Authorization']);
        }

        if (empty($token) && !empty($datos['token'])) {
            $token = $datos['token'];
        }

        if (empty($token) && !empty($_GET['token'])) {
            $token = $_GET['token'];
        }

        if (!empty($token)) {
            require_once __DIR__ . '/../helpers/jwt.php';
            if (method_exists('JWT', 'validarToken')) {
                $payload = JWT::validarToken($token);
            } else {
                $payload = JWT::obtenerPayload($token);
            }
            if ($payload && isset($payload['usuario_id'])) {
                $usuarioId = $payload['usuario_id'];
                error_log("Usuario autenticado ID: $usuarioId");
            }
        }

        // Si no hay usuario autenticado, devolver error
        if (!$usuarioId) {
            responderJSON(['exito' => false, 'error' => 'Debes iniciar sesión para comentar']);
            return;
        }
        
        $publicacionId = intval($datos['publicacion_id']);
        $contenido = htmlspecialchars(trim($datos['contenido']));
        
        // Verificar que la publicación existe
        $sqlVerificar = "SELECT id FROM comunidad_publicaciones WHERE id = :id AND estado = 'activo'";
        $stmtVerificar = $conexion->prepare($sqlVerificar);
        $stmtVerificar->bindValue(':id', $publicacionId, PDO::PARAM_INT);
        $stmtVerificar->execute();
        
        if (!$stmtVerificar->fetch(PDO::FETCH_ASSOC)) {
            responderJSON(['exito' => false, 'error' => 'Publicación no disponible']);
            return;
        }
        
        $sql = "INSERT INTO comunidad_comentarios (publicacion_id, autor_id, contenido)
                VALUES (:publicacion_id, :autor_id, :contenido)";
        
        $stmt = $conexion->prepare($sql);
        $stmt->bindValue(':publicacion_id', $publicacionId, PDO::PARAM_INT);
        $stmt->bindValue(':autor_id', $usuarioId, PDO::PARAM_INT);
        $stmt->bindValue(':contenido', $contenido, PDO::PARAM_STR);
        
        if ($stmt->execute()) {
            $id = $conexion->lastInsertId();
            
            // Obtener el comentario recién creado con datos completos del autor
            $sqlComentario = "SELECT cc.*, u.nombre, u.apellido
                              FROM comunidad_comentarios cc
                              JOIN usuarios u ON cc.autor_id = u.id
                              WHERE cc.id = :id";
            
            $stmtCom = $conexion->prepare($sqlComentario);
            $stmtCom->bindValue(':id', $id, PDO::PARAM_INT);
            $stmtCom->execute();
            $comentario = $stmtCom->fetch(PDO::FETCH_ASSOC);
            
            if ($comentario) {
                // Obtener foto de perfil del autor del comentario
                $sqlFoto = "SELECT foto_perfil FROM perfiles WHERE usuario_id = :usuario_id";
                $stmtFoto = $conexion->prepare($sqlFoto);
                $stmtFoto->bindValue(':usuario_id', $comentario['autor_id'], PDO::PARAM_INT);
                $stmtFoto->execute();
                $foto = $stmtFoto->fetch(PDO::FETCH_ASSOC);
                
                $comentario['foto_perfil'] = $foto['foto_perfil'] ?? '/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg';
                $comentario['fecha_formateada'] = date('d/m/Y H:i', strtotime($comentario['fecha_creacion']));
            }
            
            responderJSON([
                'exito' => true, 
                'id' => $id,
                'comentario' => $comentario,
                'mensaje' => 'Comentario agregado exitosamente'
            ]);
        } else {
            $error = $stmt->errorInfo();
            responderJSON(['exito' => false, 'error' => 'Error al agregar el comentario: ' . $error[2]]);
        }
        
    } catch (PDOException $e) {
        error_log("Error PDO en crearComentario: " . $e->getMessage());
        responderJSON(['exito' => false, 'error' => 'Error en la base de datos: ' . $e->getMessage()]);
    }
}

function eliminarPublicacion($conexion, $datos) {
    error_log("Datos para eliminar publicación: " . print_r($datos, true));
    
    try {
        $publicacionId = intval($datos['id'] ?? 0);
        
        if ($publicacionId <= 0) {
            responderJSON(['exito' => false, 'error' => 'ID de publicación no válido']);
            return;
        }
        
        // Verificar autenticación (aceptar token en header, body o query)
        $usuarioId = null;
        $token = null;
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
        } else {
            $headers = [];
            foreach ($_SERVER as $name => $value) {
                if (substr($name, 0, 5) == 'HTTP_') {
                    $headerName = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
                    $headers[$headerName] = $value;
                }
            }
        }
        if (!empty($headers['Authorization'])) {
            $token = str_replace('Bearer ', '', $headers['Authorization']);
        }
        if (empty($token) && !empty($datos['token'])) {
            $token = $datos['token'];
        }
        if (empty($token) && !empty($_GET['token'])) {
            $token = $_GET['token'];
        }
        if (!empty($token)) {
            require_once __DIR__ . '/../helpers/jwt.php';
            if (method_exists('JWT', 'validarToken')) {
                $payload = JWT::validarToken($token);
            } else {
                $payload = JWT::obtenerPayload($token);
            }
            if ($payload && isset($payload['usuario_id'])) {
                $usuarioId = $payload['usuario_id'];
            }
        }
        
        $sql = "UPDATE comunidad_publicaciones SET estado = 'eliminado' WHERE id = :id";
        $stmt = $conexion->prepare($sql);
        $stmt->bindValue(':id', $publicacionId, PDO::PARAM_INT);
        
        if ($stmt->execute()) {
            $filasAfectadas = $stmt->rowCount();
            if ($filasAfectadas > 0) {
                responderJSON(['exito' => true, 'mensaje' => 'Publicación eliminada exitosamente']);
            } else {
                responderJSON(['exito' => false, 'error' => 'Publicación no encontrada']);
            }
        } else {
            $error = $stmt->errorInfo();
            responderJSON(['exito' => false, 'error' => 'Error al eliminar la publicación: ' . $error[2]]);
        }
        
    } catch (PDOException $e) {
        error_log("Error PDO en eliminarPublicacion: " . $e->getMessage());
        responderJSON(['exito' => false, 'error' => 'Error en la base de datos: ' . $e->getMessage()]);
    }
}
?>