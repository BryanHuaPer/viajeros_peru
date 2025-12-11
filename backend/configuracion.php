<?php
// Archivo puente: incluye la configuración principal ubicada en app/config/
require_once realpath(__DIR__ . '/../app/config/configuracion.php');

// Reexportar la clase Configuracion (ya definida en app/config/configuracion.php)
// Este archivo existe para mantener compatibilidad con includes que esperan
// backend/configuracion.php en la estructura original.

?>
