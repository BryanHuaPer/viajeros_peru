<?php
require_once __DIR__ . '/../modelos/Comunidad.php';

class ComunidadController {
    private $comunidadModel;
    private $conexion;
    
    public function __construct($conexion) {
        $this->conexion = $conexion;
        $this->comunidadModel = new Comunidad($conexion);
    }
    
    public function listarPublicaciones($filtro = 'todas', $pagina = 1) {
        $publicaciones = $this->comunidadModel->obtenerPublicaciones($filtro, $pagina);
        $total = $this->comunidadModel->obtenerTotalPublicaciones($filtro);
        $totalPaginas = ceil($total / 10);
        
        return [
            'publicaciones' => $publicaciones,
            'total' => $total,
            'pagina_actual' => $pagina,
            'total_paginas' => $totalPaginas
        ];
    }
    
    public function verPublicacion($id) {
        $publicacion = $this->comunidadModel->obtenerPublicacion($id);
        
        if ($publicacion) {
            $publicacion['comentarios'] = $this->comunidadModel->obtenerComentarios($id);
            return $publicacion;
        }
        
        return null;
    }
    
    public function crearPublicacion($usuarioId, $datos) {
        if (empty($datos['titulo']) || empty($datos['contenido'])) {
            return ['exito' => false, 'error' => 'Título y contenido son requeridos'];
        }
        
        $titulo = htmlspecialchars(trim($datos['titulo']));
        $contenido = htmlspecialchars(trim($datos['contenido']));
        $tipo = $datos['tipo'] ?? 'experiencia';
        $etiquetas = $datos['etiquetas'] ?? [];
        
        $id = $this->comunidadModel->crearPublicacion($usuarioId, $titulo, $contenido, $tipo, $etiquetas);
        
        if ($id) {
            return ['exito' => true, 'id' => $id];
        }
        
        return ['exito' => false, 'error' => 'Error al crear la publicación'];
    }
    
    public function agregarComentario($usuarioId, $publicacionId, $contenido) {
        if (empty($contenido)) {
            return ['exito' => false, 'error' => 'El comentario no puede estar vacío'];
        }
        
        $contenido = htmlspecialchars(trim($contenido));
        
        $exito = $this->comunidadModel->crearComentario($publicacionId, $usuarioId, $contenido);
        
        if ($exito) {
            return ['exito' => true];
        }
        
        return ['exito' => false, 'error' => 'Error al agregar el comentario'];
    }
    
    public function eliminarPublicacion($publicacionId, $usuarioId, $esAdmin = false) {
        $exito = $this->comunidadModel->eliminarPublicacion($publicacionId, $usuarioId, $esAdmin);
        
        if ($exito) {
            return ['exito' => true];
        }
        
        return ['exito' => false, 'error' => 'No tienes permiso para eliminar esta publicación'];
    }
}
?>