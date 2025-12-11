<?php
namespace App\Controladores;

class AuthController {
    private $usuarioModelo;

    public function __construct() {
        $this->usuarioModelo = new \App\Modelos\Usuario();
    }

    public function login($request) {
        // Lógica de inicio de sesión
    }

    public function registro($request) {
        // Lógica de registro
    }

    public function cerrarSesion() {
        // Lógica de cierre de sesión
    }
}
?>