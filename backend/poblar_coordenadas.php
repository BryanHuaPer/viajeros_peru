<?php
// poblar_coordenadas.php
require_once 'base_datos/conexion.php';

// Usar la conexión global que ya está definida en conexion.php
global $conexion;

function geocodificarUbicacion($ubicacion) {
    $ciudadesPeru = [
        'lima' => ['lat' => -12.0464, 'lng' => -77.0428],
        'cusco' => ['lat' => -13.5320, 'lng' => -71.9675],
        'machu picchu' => ['lat' => -13.1631, 'lng' => -72.5450],
        'arequipa' => ['lat' => -16.4090, 'lng' => -71.5375],
        'trujillo' => ['lat' => -8.1092, 'lng' => -79.0215],
        'chiclayo' => ['lat' => -6.7760, 'lng' => -79.8446],
        'piura' => ['lat' => -5.1945, 'lng' => -80.6328],
        'iquitos' => ['lat' => -3.7491, 'lng' => -73.2538],
        'huaraz' => ['lat' => -9.5279, 'lng' => -77.5286],
        'tacna' => ['lat' => -18.0066, 'lng' => -70.2463],
        'cajamarca' => ['lat' => -7.1617, 'lng' => -78.5128],
        'ayacucho' => ['lat' => -13.1631, 'lng' => -74.2236],
        'puno' => ['lat' => -15.8402, 'lng' => -70.0219],
        'tarapoto' => ['lat' => -6.4833, 'lng' => -76.3667],
        'huancayo' => ['lat' => -12.0667, 'lng' => -75.2333],
        'ica' => ['lat' => -14.0681, 'lng' => -75.7256],
        'pucallpa' => ['lat' => -8.3792, 'lng' => -74.5539],
        'tumbes' => ['lat' => -3.5669, 'lng' => -80.4515],
        'moquegua' => ['lat' => -17.1956, 'lng' => -70.9353]
    ];

    $ubicacionLower = strtolower(trim($ubicacion));
    
    foreach ($ciudadesPeru as $ciudad => $coords) {
        if (strpos($ubicacionLower, $ciudad) !== false) {
            return $coords;
        }
    }

    return ['lat' => -9.1900, 'lng' => -75.0152];
}

try {
    // Verificar si la conexión está disponible
    if (!isset($conexion)) {
        throw new Exception("No se pudo establecer conexión a la base de datos");
    }

    // Obtener anuncios sin coordenadas válidas
    $sql = "SELECT id, ubicacion FROM anuncios WHERE latitud IS NULL OR longitud IS NULL OR latitud = 0 OR longitud = 0";
    $stmt = $conexion->prepare($sql);
    $stmt->execute();
    $anuncios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $actualizados = 0;
    foreach ($anuncios as $anuncio) {
        $coords = geocodificarUbicacion($anuncio['ubicacion']);
        
        $sqlUpdate = "UPDATE anuncios SET latitud = ?, longitud = ? WHERE id = ?";
        $stmtUpdate = $conexion->prepare($sqlUpdate);
        $stmtUpdate->execute([$coords['lat'], $coords['lng'], $anuncio['id']]);
        
        echo "✅ Actualizado anuncio {$anuncio['id']} - {$anuncio['ubicacion']}: {$coords['lat']}, {$coords['lng']}\n";
        $actualizados++;
    }

    echo "\n🎉 Proceso completado. {$actualizados} anuncios actualizados con coordenadas.";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage();
    error_log("Error en poblar_coordenadas.php: " . $e->getMessage());
}
?>