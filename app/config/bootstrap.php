<?php
// Bootstrap de rutas absolutas para todo el proyecto

define('BASE_PATH', realpath(__DIR__ . '/../../'));
define('APP_PATH', BASE_PATH . '/app');
define('BACKEND_PATH', BASE_PATH . '/backend');
define('PUBLIC_PATH', BASE_PATH . '/public');
define('CONFIG_PATH', APP_PATH . '/config');
define('MODELOS_PATH', APP_PATH . '/modelos');
define('HELPERS_PATH', APP_PATH . '/helpers');

define('FRONTEND_PATH', BASE_PATH . '/frontend');
define('VISTAS_PATH', APP_PATH . '/vistas');

define('DB_PATH', BACKEND_PATH . '/base_datos');
