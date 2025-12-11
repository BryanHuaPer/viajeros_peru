<?php
    // app/helpers/subida_archivos.php

    function subirFotoPerfil($archivo, $usuario_id) {
        $directorio_destino = $_SERVER['DOCUMENT_ROOT'] . '/proyectoWeb/viajeros_peru/public/uploads/perfiles/';
        
        // Verificar si el directorio existe, si no crearlo
        if (!file_exists($directorio_destino)) {
            mkdir($directorio_destino, 0777, true);
        }
        
        // Validar que sea una imagen
        $tipo_permitido = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!in_array($archivo['type'], $tipo_permitido)) {
            return ['error' => 'Solo se permiten archivos JPEG, PNG y GIF'];
        }
        
        // Validar tamaño (máximo 5MB)
        if ($archivo['size'] > 5 * 1024 * 1024) {
            return ['error' => 'La imagen no debe superar los 5MB'];
        }
        
        // Generar nombre único para el archivo
        $extension = pathinfo($archivo['name'], PATHINFO_EXTENSION);
        $nombre_archivo = 'perfil_' . $usuario_id . '_' . time() . '.' . $extension;
        $ruta_completa = $directorio_destino . $nombre_archivo;
        
        // Mover el archivo
        if (move_uploaded_file($archivo['tmp_name'], $ruta_completa)) {
            return [
                'success' => true,
                'nombre_archivo' => $nombre_archivo,
                'ruta' => '/proyectoWeb/viajeros_peru/public/uploads/perfiles/' . $nombre_archivo
            ];
        } else {
            return ['error' => 'Error al subir la imagen'];
        }
    }
    
    function subirImagenesAnuncio($archivos, $anuncio_id) {
        error_log("📁 === PROCESANDO IMÁGENES PARA ANUNCIO $anuncio_id ===");
        error_log("📊 Estructura completa de archivos recibida:");
        error_log(print_r($archivos, true));
        
        // Agrega esto para ver exactamente qué se está recibiendo:
        error_log("📊 CONTEOS:");
        if (isset($archivos['name']) && is_array($archivos['name'])) {
            error_log("  - names: " . count($archivos['name']));
            foreach ($archivos['name'] as $index => $name) {
                error_log("    [$index]: $name (tipo: " . ($archivos['type'][$index] ?? 'N/A') . 
                        ", tamaño: " . ($archivos['size'][$index] ?? 0) . ")");
            }
        }
        $directorio_destino = $_SERVER['DOCUMENT_ROOT'] . '/proyectoWeb/viajeros_peru/public/uploads/anuncios/';
        
        // Verificar si el directorio existe, si no crearlo
        if (!file_exists($directorio_destino)) {
            mkdir($directorio_destino, 0777, true);
        }
        
        $resultados = [];
        $errores = [];
        
        // DEBUG: Log para ver qué se está recibiendo
        error_log("📁 === PROCESANDO IMÁGENES PARA ANUNCIO $anuncio_id ===");
        error_log("📊 Estructura de archivos recibida: " . print_r($archivos, true));
        
        // Diferentes formas en que pueden llegar las imágenes
        $archivos_a_procesar = [];
        
        // Caso 1: Array indexado tradicional (imagenes[0], imagenes[1], etc.)
        if (isset($archivos['name']) && is_array($archivos['name'])) {
            error_log("🔹 Procesando como array indexado");
            foreach ($archivos['name'] as $index => $name) {
                if ($archivos['error'][$index] === UPLOAD_ERR_OK && !empty($name)) {
                    $archivos_a_procesar[] = [
                        'name' => $name,
                        'type' => $archivos['type'][$index],
                        'tmp_name' => $archivos['tmp_name'][$index],
                        'error' => $archivos['error'][$index],
                        'size' => $archivos['size'][$index]
                    ];
                }
            }
        }
        // Caso 2: Array asociativo (imagenes[0], imagenes[1], etc. como objetos separados)
        else if (isset($archivos[0])) {
            error_log("🔹 Procesando como array de objetos");
            foreach ($archivos as $index => $archivo) {
                if ($archivo['error'] === UPLOAD_ERR_OK && !empty($archivo['name'])) {
                    $archivos_a_procesar[] = $archivo;
                }
            }
        }
        // Caso 3: Single file
        else if (isset($archivos['name']) && !empty($archivos['name'])) {
            error_log("🔹 Procesando como archivo único");
            $archivos_a_procesar[] = $archivos;
        }
        
        error_log("📁 Archivos a procesar: " . count($archivos_a_procesar));
        
        // Procesar los archivos
        foreach ($archivos_a_procesar as $index => $archivo) {
            if ($archivo['error'] !== UPLOAD_ERR_OK) {
                $errores[] = "Error en archivo " . $archivo['name'] . " (código: " . $archivo['error'] . ")";
                continue;
            }
            
            // Validar que sea una imagen
            $tipo_permitido = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!in_array($archivo['type'], $tipo_permitido)) {
                $errores[] = "El archivo '" . $archivo['name'] . "' no es una imagen válida. Tipo: " . $archivo['type'];
                continue;
            }
            
            // Validar tamaño (máximo 5MB)
            if ($archivo['size'] > 5 * 1024 * 1024) {
                $errores[] = "La imagen '" . $archivo['name'] . "' es demasiado grande (máximo 5MB)";
                continue;
            }
            
            // Generar nombre único para el archivo
            $extension = strtolower(pathinfo($archivo['name'], PATHINFO_EXTENSION));
            $nombre_archivo = 'anuncio_' . $anuncio_id . '_' . $index . '_' . time() . '.' . $extension;
            $ruta_completa = $directorio_destino . $nombre_archivo;
            
            // Mover el archivo
            if (move_uploaded_file($archivo['tmp_name'], $ruta_completa)) {
                $ruta_web = '/public/uploads/anuncios/' . $nombre_archivo;
                
                $resultados[] = [
                    'nombre_archivo' => $nombre_archivo,
                    'ruta' => $ruta_web,
                    'orden' => $index + 1,
                    'tipo' => $archivo['type'],
                    'tamaño' => $archivo['size']
                ];
                error_log("✅ Imagen subida: $nombre_archivo -> $ruta_web");
            } else {
                $errores[] = "Error al subir la imagen '" . $archivo['name'] . "'";
                error_log("❌ Error moviendo imagen: " . $archivo['name']);
            }
        }
        
        error_log("📊 Resultado final: " . count($resultados) . " éxitos, " . count($errores) . " errores");
        
        return [
            'success' => empty($errores) && !empty($resultados),
            'imagenes' => $resultados,
            'errores' => $errores
        ];
    }
?>