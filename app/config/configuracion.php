<?php
// Configuración de la aplicación
class Configuracion {
    // Configuración de base de datos - ¡VERIFICA ESTOS DATOS!
    const BD_SERVIDOR = 'localhost';
    const BD_NOMBRE = 'viajeros_peru';
    const BD_USUARIO = 'root';
    const BD_CONTRASENA = '';  // Si usas XAMPP, usualmente está vacío
    
    // Configuración de la aplicación
    const APP_NOMBRE = 'Viajeros Perú';
    const APP_VERSION = '1.0.0';
    const APP_URL = 'http://localhost/viajeros_peru';
    
    // Configuración de seguridad
    const CLAVE_SECRETA = 'viajeros_peru_clave_secreta_2024';
    const TIEMPO_SESION = 3600;
    
    // Configuración de subida de archivos
    // RUTA_SUBIDAS: ruta en el filesystem donde se guardan las subidas
    // Ahora apuntamos a la carpeta pública 'public/uploads/' para que los archivos sean accesibles vía web
    const RUTA_SUBIDAS = __DIR__ . '/../../public/uploads/';
    // URL pública base para archivos subidos (ajusta si tu host/estructura cambia)
    const URL_SUBIDAS = '/proyectoWeb/viajeros_peru/public/uploads/';
    const TAMANIO_MAXIMO = 5 * 1024 * 1024;
    const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/gif'];
}

// Manejo de errores - IMPORTANTE para desarrollo
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Configuración de zona horaria
date_default_timezone_set('America/Lima');

// Iniciar sesión (proteger contra 'headers already sent')
if (session_status() == PHP_SESSION_NONE) {
    if (!headers_sent()) {
        session_start();
    } else {
        // No se puede iniciar sesión porque ya se envió salida; registrar para debugging
        error_log('⚠️ No se inició la sesión porque ya se envió salida (headers sent)');
    }
}

// Log para verificar que se cargó la configuración
error_log("✅ Configuración cargada correctamente");
?>