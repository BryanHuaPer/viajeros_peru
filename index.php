<?php
// index.php - Redirige directamente a la página de inicio
$inicio_path = 'app/vistas/inicio/inicio.html';

if (file_exists($inicio_path)) {
    header('Location: ' . $inicio_path);
    exit();
} else {
    // Si no encuentra la página, muestra error claro
    header('HTTP/1.1 404 Not Found');
    echo '<h1>Error: Página no encontrada</h1>';
    echo '<p>No se pudo encontrar: ' . htmlspecialchars($inicio_path) . '</p>';
    echo '<p>Verifica la estructura de carpetas:</p>';
    echo '<ul>';
    echo '<li>app/vistas/inicio/inicio.html</li>';
    echo '<li>app/vistas/inicio/inicio.php</li>';
    echo '<li>frontend/inicio.html</li>';
    echo '</ul>';
}
?>