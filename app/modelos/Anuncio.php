<?php
class Anuncio {
    private $conexion;
    
    public function __construct($conexion) {
        $this->conexion = $conexion;
    }

    /**
     * Obtener anuncios por anfitrión
     */
    public function obtenerPorAnfitrion($anfitrionId) {
        try {
            $sql = "SELECT a.*, u.nombre, u.apellido,
                        (SELECT url_imagen FROM anuncio_imagenes WHERE anuncio_id = a.id ORDER BY orden LIMIT 1) as imagen_principal
                    FROM anuncios a 
                    JOIN usuarios u ON a.anfitrion_id = u.id 
                    WHERE a.anfitrion_id = ? 
                    ORDER BY a.fecha_publicacion DESC";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$anfitrionId]);
            
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Error al obtener anuncios por anfitrión: " . $e->getMessage());
            return [];
        }
    }
    /**
     * Obtener anuncio por ID - VERSIÓN CORREGIDA
     */
    public function obtenerPorId($id) {
        try {
            $sql = "SELECT a.*, u.nombre, u.apellido, u.correo, p.foto_perfil
                    FROM anuncios a 
                    JOIN usuarios u ON a.anfitrion_id = u.id 
                    LEFT JOIN perfiles p ON u.id = p.usuario_id
                    WHERE a.id = ?";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$id]);
            
            return $stmt->fetch(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Error al obtener anuncio por ID: " . $e->getMessage());
            return false;
        }
    }
        
    /**
     * Crear nuevo anuncio - VERSIÓN CORREGIDA CON COORDENADAS
     */
    public function crear($datos) {
        try {
            error_log("🎯 === INICIANDO CREACIÓN DE ANUNCIO EN MODELO ===");
            error_log("📦 Datos recibidos en modelo: " . print_r($datos, true));
            
            // Verificar conexión
            if (!$this->conexion) {
                error_log("❌ ERROR: No hay conexión a BD en el modelo");
                return ['exito' => false, 'error' => 'Error de conexión a la base de datos'];
            }

            // SQL CORREGIDO - Incluye latitud y longitud
            $sql = "INSERT INTO anuncios 
                    (anfitrion_id, titulo, descripcion, ubicacion, latitud, longitud, 
                    tipo_actividad, duracion_minima, duracion_maxima, cupos_disponibles, 
                    requisitos, comodidades) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            $stmt = $this->conexion->prepare($sql);
            
            // Parámetros CORREGIDOS - Orden correcto
            $parametros = [
                $datos['anfitrion_id'],
                $datos['titulo'],
                $datos['descripcion'],
                $datos['ubicacion'],
                $datos['latitud'] ?? null,        // NUEVO: latitud
                $datos['longitud'] ?? null,       // NUEVO: longitud
                $datos['tipo_actividad'],
                $datos['duracion_minima'] ?? 7,
                $datos['duracion_maxima'] ?? 30,
                $datos['cupos_disponibles'] ?? 1,
                $datos['requisitos'] ?? '',
                $datos['comodidades'] ?? ''
            ];
            
            error_log("🔢 Parámetros SQL CORREGIDOS: " . print_r($parametros, true));
            error_log("📝 SQL: " . $sql);
            
            $resultadoEjecucion = $stmt->execute($parametros);
            error_log("✅ Resultado ejecución SQL: " . ($resultadoEjecucion ? 'ÉXITO' : 'FALLO'));
            
            if (!$resultadoEjecucion) {
                $errorInfo = $stmt->errorInfo();
                error_log("❌ Error SQL: " . print_r($errorInfo, true));
                return ['exito' => false, 'error' => 'Error en la base de datos: ' . $errorInfo[2]];
            }
            
            $anuncioId = $this->conexion->lastInsertId();
            error_log("🆕 ID del anuncio creado: " . $anuncioId);
            
            // Obtener el anuncio recién creado
            $anuncio = $this->obtenerPorId($anuncioId);

            // VERIFICACIÓN CRÍTICA
            if (!$anuncio) {
                error_log("❌ ERROR CRÍTICO: No se pudo obtener el anuncio recién creado con ID: " . $anuncioId);
                
                // Verificación adicional
                $sqlCheck = "SELECT COUNT(*) as total FROM anuncios WHERE id = ?";
                $stmtCheck = $this->conexion->prepare($sqlCheck);
                $stmtCheck->execute([$anuncioId]);
                $existe = $stmtCheck->fetchColumn();
                
                error_log("🔍 Anuncio existe en BD: " . ($existe ? 'SÍ' : 'NO'));
                
                return [
                    'exito' => false, 
                    'error' => 'Error al recuperar el anuncio creado. ID: ' . $anuncioId,
                    'anuncio_id' => $anuncioId
                ];
            }

            error_log("🎉 Anuncio creado exitosamente - ID: " . $anuncio['id'] . ", Título: " . $anuncio['titulo']);
            
            return [
                'exito' => true,
                'mensaje' => 'Anuncio creado exitosamente',
                'anuncio' => $anuncio,
                'anuncio_id' => $anuncioId
            ];
            
        } catch (PDOException $e) {
            error_log("💥 Error al crear anuncio: " . $e->getMessage());
            error_log("📋 Trace: " . $e->getTraceAsString());
            return ['exito' => false, 'error' => 'Error al crear el anuncio: ' . $e->getMessage()];
        }
    }
        
    // MÉTODO actualizar()
    public function actualizar($id, $datos) {
        try {
            // Extraer datos de imágenes si existen
            $imagenes_a_eliminar = isset($datos['imagenes_eliminar']) ? (array)$datos['imagenes_eliminar'] : [];
            $nuevas_imagenes = isset($_FILES['nuevas_imagenes']) ? $_FILES['nuevas_imagenes'] : [];
            
            // Verificar límite de imágenes antes de proceder
            $verificacion = $this->verificarLimiteImagenes($id, $imagenes_a_eliminar, $nuevas_imagenes);
            
            if (!$verificacion['exito']) {
                return ['exito' => false, 'error' => 'Error al verificar imágenes: ' . $verificacion['error']];
            }
            
            if (!$verificacion['dentro_limite']) {
                return [
                    'exito' => false, 
                    'error' => 'El anuncio no puede tener más de 5 imágenes. ' .
                            'Actualmente tiene ' . $verificacion['actuales'] . 
                            ', intentas eliminar ' . $verificacion['a_eliminar'] . 
                            ' y agregar ' . $verificacion['nuevas'] . 
                            '. Total sería: ' . $verificacion['total_despues']
                ];
            }
            
            // Procesar eliminación de imágenes si existen
            if (!empty($imagenes_a_eliminar)) {
                $resultado_eliminacion = $this->eliminarImagenes($imagenes_a_eliminar);
                if (!$resultado_eliminacion['exito']) {
                    return ['exito' => false, 'error' => 'Error al eliminar imágenes: ' . $resultado_eliminacion['error']];
                }
                error_log("✅ Imágenes eliminadas: " . $resultado_eliminacion['eliminadas']);
            }
            
            // SQL para actualizar datos del anuncio
            $sql = "UPDATE anuncios SET 
                    titulo = ?, 
                    descripcion = ?, 
                    ubicacion = ?, 
                    latitud = ?, 
                    longitud = ?, 
                    tipo_actividad = ?, 
                    duracion_minima = ?, 
                    duracion_maxima = ?, 
                    cupos_disponibles = ?, 
                    requisitos = ?, 
                    comodidades = ?,
                    estado = ?,
                    fecha_actualizacion = CURRENT_TIMESTAMP
                    WHERE id = ? AND anfitrion_id = ?";
            
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([
                $datos['titulo'],
                $datos['descripcion'],
                $datos['ubicacion'],
                $datos['latitud'] ?? null,
                $datos['longitud'] ?? null,
                $datos['tipo_actividad'],
                $datos['duracion_minima'],
                $datos['duracion_maxima'],
                $datos['cupos_disponibles'],
                $datos['requisitos'],
                $datos['comodidades'],
                $datos['estado'],
                $id,
                $datos['anfitrion_id']
            ]);
            
            if ($stmt->rowCount() === 0) {
                return ['exito' => false, 'error' => 'No se pudo actualizar el anuncio'];
            }
            
            // Procesar nuevas imágenes si existen
            if (!empty($nuevas_imagenes) && !empty($nuevas_imagenes['name'][0])) {
                require_once __DIR__ . '/../helpers/subida_archivos.php';
                
                // Obtener el próximo orden
                $sql_orden = "SELECT COALESCE(MAX(orden), 0) as max_orden FROM anuncio_imagenes WHERE anuncio_id = ?";
                $stmt_orden = $this->conexion->prepare($sql_orden);
                $stmt_orden->execute([$id]);
                $orden_actual = $stmt_orden->fetchColumn();
                
                $resultado_subida = subirImagenesAnuncio($nuevas_imagenes, $id);
                
                if (!$resultado_subida['success']) {
                    return [
                        'exito' => false,
                        'error' => 'Error al subir imágenes: ' . implode(', ', $resultado_subida['errores'])
                    ];
                }
                
                // Guardar nuevas imágenes en BD
                $imagenes_guardadas = 0;
                foreach ($resultado_subida['imagenes'] as $imagen) {
                    $nuevo_orden = $orden_actual + $imagen['orden'];
                    if ($this->agregarImagen($id, $imagen['ruta'], $nuevo_orden)) {
                        $imagenes_guardadas++;
                        error_log("💾 Nueva imagen guardada: " . $imagen['ruta']);
                    }
                }
                error_log("✅ Nuevas imágenes guardadas: " . $imagenes_guardadas);
            }
            
            // Obtener el anuncio actualizado
            $anuncio = $this->obtenerPorId($id);
            
            return [
                'exito' => true,
                'mensaje' => 'Anuncio actualizado exitosamente',
                'anuncio' => $anuncio
            ];
            
        } catch (PDOException $e) {
            error_log("Error al actualizar anuncio: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al actualizar el anuncio: ' . $e->getMessage()];
        }
    }
    
    /**
     * Eliminar anuncio
     */
    public function eliminar($id, $anfitrionId) {
        try {
            $sql = "DELETE FROM anuncios WHERE id = ? AND anfitrion_id = ?";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$id, $anfitrionId]);
            
            if ($stmt->rowCount() > 0) {
                return ['exito' => true, 'mensaje' => 'Anuncio eliminado correctamente'];
            } else {
                return ['exito' => false, 'error' => 'No se pudo eliminar el anuncio'];
            }
            
        } catch (PDOException $e) {
            error_log("Error al eliminar anuncio: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al eliminar el anuncio: ' . $e->getMessage()];
        }
    }
    /**
     * Cambiar estado del anuncio 
     */
    public function cambiarEstado($id, $anfitrionId, $nuevoEstado) {
        try {
            $sql = "UPDATE anuncios SET estado = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ? AND anfitrion_id = ?";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$nuevoEstado, $id, $anfitrionId]);
            
            if ($stmt->rowCount() === 0) {
                return ['exito' => false, 'error' => 'No se pudo cambiar el estado del anuncio'];
            }
            
            // Obtener el anuncio actualizado
            $anuncio = $this->obtenerPorId($id);
            
            return [
                'exito' => true,
                'mensaje' => 'Estado del anuncio cambiado exitosamente',
                'anuncio' => $anuncio
            ];
            
        } catch (PDOException $e) {
            error_log("Error al cambiar estado del anuncio: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al cambiar el estado del anuncio: ' . $e->getMessage()];
        }
    }
    /**
     * Buscar anuncios (para viajeros) - VERSIÓN CON PAGINACIÓN
     */
    public function buscar($criterios = [], $pagina = 1, $limite = 10) {
        try {
            // VALIDAR PARÁMETROS
            $pagina = max(1, intval($pagina));
            $limite = max(1, min(50, intval($limite))); // Máximo 50 por página
            
            error_log("🔍 Búsqueda con paginación validada - Página: $pagina, Límite: $limite");
            error_log("📦 Criterios: " . print_r($criterios, true));
            
            // Calcular offset
            $offset = ($pagina - 1) * $limite;
            
            // Usar SQL_CALC_FOUND_ROWS para obtener el total sin paginación
            $sql = "SELECT SQL_CALC_FOUND_ROWS a.*, u.nombre, u.apellido, p.foto_perfil, 
                        (SELECT url_imagen FROM anuncio_imagenes WHERE anuncio_id = a.id ORDER BY orden LIMIT 1) as imagen_principal
                    FROM anuncios a 
                    JOIN usuarios u ON a.anfitrion_id = u.id
                    LEFT JOIN perfiles p ON u.id = p.usuario_id
                    WHERE a.estado = 'activo'";
            
            $params = [];
            
            // Filtro por ubicación
            if (!empty($criterios['ubicacion'])) {
                $sql .= " AND a.ubicacion LIKE ?";
                $params[] = '%' . $criterios['ubicacion'] . '%';
            }
            
            // Filtro por tipo de actividad
            if (!empty($criterios['tipo_actividad'])) {
                $sql .= " AND a.tipo_actividad = ?";
                $params[] = $criterios['tipo_actividad'];
            }
            
            // Filtro por duración mínima
            if (!empty($criterios['duracion_minima'])) {
                $sql .= " AND a.duracion_minima >= ?";
                $params[] = (int)$criterios['duracion_minima'];
            }
            
            // Filtro por duración máxima
            if (!empty($criterios['duracion_maxima'])) {
                $sql .= " AND a.duracion_maxima <= ?";
                $params[] = (int)$criterios['duracion_maxima'];
            }
            
            // Filtro por cupos disponibles
            if (!empty($criterios['cupos_disponibles'])) {
                $sql .= " AND a.cupos_disponibles >= ?";
                $params[] = (int)$criterios['cupos_disponibles'];
            }
            
            $sql .= " ORDER BY a.fecha_publicacion DESC";
            
            // Aplicar paginación
            $sql .= " LIMIT ? OFFSET ?";
            $params[] = $limite;
            $params[] = $offset;
            
            error_log("📝 SQL con paginación: " . $sql);
            error_log("🎯 Parámetros: " . print_r($params, true));
            
            // Ejecutar consulta principal
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute($params);
            
            $resultados = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Obtener el total de resultados (sin paginación)
            $sqlTotal = "SELECT FOUND_ROWS() as total";
            $stmtTotal = $this->conexion->prepare($sqlTotal);
            $stmtTotal->execute();
            $totalResultados = $stmtTotal->fetchColumn();
            
            $totalPaginas = ceil($totalResultados / $limite);
            
            error_log("✅ Búsqueda completada:");
            error_log("   - Resultados en página: " . count($resultados));
            error_log("   - Total resultados: " . $totalResultados);
            error_log("   - Páginas totales: " . $totalPaginas);
            error_log("   - Página actual: " . $pagina);
            
            return [
                'anuncios' => $resultados,
                'total' => $totalResultados,
                'pagina_actual' => $pagina,
                'total_paginas' => $totalPaginas,
                'resultados_por_pagina' => $limite
            ];
            
        } catch (PDOException $e) {
            error_log("❌ Error al buscar anuncios: " . $e->getMessage());
            return [
                'anuncios' => [],
                'total' => 0,
                'pagina_actual' => $pagina,
                'total_paginas' => 0,
                'resultados_por_pagina' => $limite
            ];
        }
    }

    /**
     * Agregar imagen a un anuncio
     */
    public function agregarImagen($anuncio_id, $url_imagen, $orden = 1) {
        try {
            $sql = "INSERT INTO anuncio_imagenes (anuncio_id, url_imagen, orden) VALUES (?, ?, ?)";
            $stmt = $this->conexion->prepare($sql);
            return $stmt->execute([$anuncio_id, $url_imagen, $orden]);
        } catch (PDOException $e) {
            error_log("Error al agregar imagen de anuncio: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Obtener imágenes de un anuncio
     */
    public function obtenerImagenes($anuncio_id) {
        try {
            $sql = "SELECT id, url_imagen, orden, fecha_subida FROM anuncio_imagenes WHERE anuncio_id = ? ORDER BY orden, id";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$anuncio_id]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Error al obtener imágenes de anuncio: " . $e->getMessage());
            return [];
        }
    }
    /**
     * Verificar límite de imágenes para un anuncio
     */
    public function verificarLimiteImagenes($anuncio_id, $imagenes_a_eliminar, $nuevas_imagenes) {
        try {
            error_log("🔍 === VERIFICANDO LÍMITE EN BACKEND ===");
            error_log("📊 Parámetros recibidos:");
            error_log("  - anuncio_id: $anuncio_id");
            error_log("  - imagenes_a_eliminar: " . (is_array($imagenes_a_eliminar) ? count($imagenes_a_eliminar) : '0'));
            error_log("  - nuevas_imagenes: " . (is_array($nuevas_imagenes) ? 'Array recibido' : 'No array'));
            
            // DEPURACIÓN DETALLADA de nuevas_imagenes
            if (is_array($nuevas_imagenes) && isset($nuevas_imagenes['name'])) {
                error_log("📁 Estructura de nuevas_imagenes en verificarLimiteImagenes:");
                
                // Contar de diferentes maneras
                $contador_array = 0;
                $contador_validos = 0;
                $nombres = [];
                
                if (is_array($nuevas_imagenes['name'])) {
                    $contador_array = count($nuevas_imagenes['name']);
                    error_log("  - count(nuevas_imagenes['name']): $contador_array");
                    
                    foreach ($nuevas_imagenes['name'] as $index => $nombre) {
                        if (!empty($nombre)) {
                            $nombres[] = $nombre;
                            $error = $nuevas_imagenes['error'][$index] ?? 'N/A';
                            if ($error === UPLOAD_ERR_OK) {
                                $contador_validos++;
                            }
                        }
                    }
                    
                    error_log("  - Nombres no vacíos: " . count($nombres));
                    error_log("  - Archivos válidos (UPLOAD_ERR_OK): $contador_validos");
                    error_log("  - Lista de nombres: " . implode(', ', $nombres));
                } else if (!empty($nuevas_imagenes['name'])) {
                    error_log("  - Solo un archivo: " . $nuevas_imagenes['name']);
                    $contador_array = 1;
                    if (($nuevas_imagenes['error'] ?? 0) === UPLOAD_ERR_OK) {
                        $contador_validos = 1;
                    }
                }
                
                // Usar contador_validos para el cálculo
                $contador_nuevas = $contador_validos;
            } else {
                $contador_nuevas = 0;
                error_log("  - No hay nuevas_imagenes o estructura incorrecta");
            }
            
            // Contar imágenes actuales
            $sql_actuales = "SELECT COUNT(*) as total FROM anuncio_imagenes WHERE anuncio_id = ?";
            $stmt = $this->conexion->prepare($sql_actuales);
            $stmt->execute([$anuncio_id]);
            $imagenes_actuales = $stmt->fetchColumn();
            
            error_log("📊 CÁLCULO FINAL:");
            error_log("  - Imágenes actuales en BD: $imagenes_actuales");
            error_log("  - Eliminando: " . (is_array($imagenes_a_eliminar) ? count($imagenes_a_eliminar) : '0'));
            error_log("  - Nuevas válidas: $contador_nuevas");
            
            $imagenes_que_quedaran = $imagenes_actuales - (is_array($imagenes_a_eliminar) ? count($imagenes_a_eliminar) : 0);
            $total_despues = $imagenes_que_quedaran + $contador_nuevas;
            
            error_log("  - Que quedarán: $imagenes_que_quedaran");
            error_log("  - Total después: $total_despues");
            error_log("  - Dentro del límite (≤5): " . ($total_despues <= 5 ? 'SÍ' : 'NO'));
            
            return [
                'exito' => true,
                'actuales' => $imagenes_actuales,
                'a_eliminar' => is_array($imagenes_a_eliminar) ? count($imagenes_a_eliminar) : 0,
                'nuevas' => $contador_nuevas,
                'total_despues' => $total_despues,
                'dentro_limite' => $total_despues <= 5
            ];
            
        } catch (PDOException $e) {
            error_log("❌ Error al verificar límite de imágenes: " . $e->getMessage());
            return ['exito' => false, 'error' => $e->getMessage()];
        }
    }
    /**
     * Eliminar imágenes físicamente y de la base de datos
     */
    public function eliminarImagenes($imagenes_ids) {
        try {
            if (empty($imagenes_ids)) {
                return ['exito' => true, 'eliminadas' => 0];
            }
            
            // Obtener rutas de las imágenes
            $placeholders = implode(',', array_fill(0, count($imagenes_ids), '?'));
            $sql_rutas = "SELECT id, url_imagen FROM anuncio_imagenes WHERE id IN ($placeholders)";
            $stmt = $this->conexion->prepare($sql_rutas);
            $stmt->execute($imagenes_ids);
            $imagenes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $eliminadas = 0;
            $errores = [];
            
            foreach ($imagenes as $imagen) {
                // Eliminar archivo físico
                $ruta_fisica = $_SERVER['DOCUMENT_ROOT'] . '/proyectoWeb/viajeros_peru' . $imagen['url_imagen'];
                if (file_exists($ruta_fisica)) {
                    if (unlink($ruta_fisica)) {
                        error_log("🗑️ Archivo eliminado físicamente: " . $ruta_fisica);
                    } else {
                        $errores[] = "No se pudo eliminar el archivo: " . $ruta_fisica;
                    }
                }
                
                // Eliminar registro de la BD
                $sql_eliminar = "DELETE FROM anuncio_imagenes WHERE id = ?";
                $stmt_eliminar = $this->conexion->prepare($sql_eliminar);
                if ($stmt_eliminar->execute([$imagen['id']])) {
                    $eliminadas++;
                }
            }
            
            return [
                'exito' => true,
                'eliminadas' => $eliminadas,
                'errores' => $errores
            ];
            
        } catch (PDOException $e) {
            error_log("Error al eliminar imágenes: " . $e->getMessage());
            return ['exito' => false, 'error' => $e->getMessage()];
        }
    }
    /**
     * Crear anuncio con imágenes - VERSIÓN MEJORADA
     */
    public function crearConImagenes($datos, $imagenes) {
        try {
            error_log("🖼️ === INICIANDO CREACIÓN DE ANUNCIO CON IMÁGENES ===");
            error_log("📦 Datos recibidos: " . print_r($datos, true));
            error_log("📁 Estructura de imágenes: " . (is_array($imagenes) ? print_r($imagenes, true) : 'NO ES ARRAY'));
            
            // Primero crear el anuncio
            $resultadoCreacion = $this->crear($datos);
            
            if (!$resultadoCreacion['exito']) {
                error_log("❌ Error al crear anuncio base: " . $resultadoCreacion['error']);
                return $resultadoCreacion;
            }
            
            // Obtener el ID del anuncio creado
            $anuncioId = $resultadoCreacion['anuncio_id'] ?? $resultadoCreacion['anuncio']['id'];
            error_log("🆕 ID del anuncio creado: " . $anuncioId);
            
            // Verificar si hay imágenes para procesar
            $hayImagenes = false;
            if (is_array($imagenes)) {
                // Verificar diferentes formatos de imágenes
                if (isset($imagenes['name'])) {
                    if (is_array($imagenes['name'])) {
                        $hayImagenes = !empty($imagenes['name'][0]);
                    } else {
                        $hayImagenes = !empty($imagenes['name']);
                    }
                } else if (isset($imagenes[0])) {
                    $hayImagenes = !empty($imagenes[0]['name']);
                }
            }
            
            if ($hayImagenes) {
                error_log("📁 Procesando imágenes...");
                
                require_once __DIR__ . '/../helpers/subida_archivos.php';
                
                $resultadoImagenes = subirImagenesAnuncio($imagenes, $anuncioId);
                
                if (!$resultadoImagenes['success']) {
                    error_log("❌ Error subiendo imágenes: " . implode(', ', $resultadoImagenes['errores']));
                    
                    // Si hay errores en las imágenes, eliminar el anuncio creado
                    $this->eliminar($anuncioId, $datos['anfitrion_id']);
                    return [
                        'exito' => false,
                        'error' => 'Error al subir imágenes: ' . implode(', ', $resultadoImagenes['errores'])
                    ];
                }
                
                // Guardar las imágenes en la base de datos
                $imagenesGuardadas = 0;
                foreach ($resultadoImagenes['imagenes'] as $imagen) {
                    if ($this->agregarImagen($anuncioId, $imagen['ruta'], $imagen['orden'])) {
                        $imagenesGuardadas++;
                        error_log("💾 Imagen guardada en BD: " . $imagen['ruta']);
                    } else {
                        error_log("❌ Error guardando imagen en BD: " . $imagen['ruta']);
                    }
                }
                
                error_log("✅ Imágenes guardadas en BD: " . $imagenesGuardadas);
                $resultadoCreacion['mensaje'] = 'Anuncio creado exitosamente con ' . $imagenesGuardadas . ' imágenes';
                $resultadoCreacion['imagenes_subidas'] = $imagenesGuardadas;
            } else {
                error_log("ℹ️ No hay imágenes para procesar");
                $resultadoCreacion['mensaje'] = 'Anuncio creado exitosamente sin imágenes';
            }
            
            error_log("🎉 Proceso de creación completado");
            return $resultadoCreacion;
            
        } catch (Exception $e) {
            error_log("💥 Error crítico al crear anuncio con imágenes: " . $e->getMessage());
            return ['exito' => false, 'error' => 'Error al crear el anuncio con imágenes: ' . $e->getMessage()];
        }
    }
}
?>