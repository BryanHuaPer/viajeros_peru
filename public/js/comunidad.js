class ManejadorComunidad {
    constructor() {
        this.publicaciones = [];
        this.categoriaActual = 'todas';
        this.paginaActual = 1;
        this.totalPaginas = 1;
        this.usuario = null;
        this.inicializar();
    }

    inicializar() {
        this.verificarAutenticacion();
        this.cargarPublicaciones();
        this.configurarEventos();
    }

    verificarAutenticacion() {
        const datosUsuario = localStorage.getItem('datos_usuario');
        if (datosUsuario) {
            this.usuario = JSON.parse(datosUsuario);
        }
    }

    async cargarPublicaciones(pagina = 1) {
        this.paginaActual = pagina;
        
        try {
            const respuesta = await fetch(
                `../backend/api/comunidad.php?accion=obtener&filtro=${this.categoriaActual}&pagina=${pagina}`
            );
            const datos = await respuesta.json();
            
            if (datos.exito) {
                this.publicaciones = datos.publicaciones || [];
                this.totalPaginas = datos.total_paginas || 1;
                this.mostrarPublicaciones();
                this.mostrarPaginacion();
            } else {
                this.mostrarPublicacionesEjemplo();
            }
        } catch (error) {
            console.error('Error cargando publicaciones:', error);
            this.mostrarPublicacionesEjemplo();
        }
    }

    mostrarPublicaciones() {
        const contenedor = document.getElementById('lista-publicaciones');
        
        if (this.publicaciones.length === 0) {
            contenedor.innerHTML = `
                <div class="sin-resultados">
                    <p>No hay publicaciones en esta categoría.</p>
                    ${this.usuario ? '<button class="boton-principal" onclick="comunidad.mostrarFormulario()">Crear la primera publicación</button>' : ''}
                </div>
            `;
            return;
        }
        
        contenedor.innerHTML = this.publicaciones.map(pub => this.crearTarjetaPublicacion(pub)).join('');
    }

    crearTarjetaPublicacion(publicacion) {
        // ... usar la función actualizada que creamos arriba
        return this.crearHTMLTarjeta(publicacion);
    }

    mostrarPaginacion() {
        const contenedorPaginacion = document.getElementById('paginacion');
        if (!contenedorPaginacion) return;
        
        let html = '';
        
        // Botón anterior
        if (this.paginaActual > 1) {
            html += `<button class="boton-paginacion" onclick="comunidad.cargarPublicaciones(${this.paginaActual - 1})">← Anterior</button>`;
        }
        
        // Números de página
        for (let i = 1; i <= this.totalPaginas; i++) {
            if (i === 1 || i === this.totalPaginas || (i >= this.paginaActual - 2 && i <= this.paginaActual + 2)) {
                html += `<button class="boton-paginacion ${i === this.paginaActual ? 'activo' : ''}" onclick="comunidad.cargarPublicaciones(${i})">${i}</button>`;
            } else if (i === this.paginaActual - 3 || i === this.paginaActual + 3) {
                html += '<span class="puntos">...</span>';
            }
        }
        
        // Botón siguiente
        if (this.paginaActual < this.totalPaginas) {
            html += `<button class="boton-paginacion" onclick="comunidad.cargarPublicaciones(${this.paginaActual + 1})">Siguiente →</button>`;
        }
        
        contenedorPaginacion.innerHTML = html;
    }

    configurarEventos() {
        // Filtros por categoría
        document.querySelectorAll('.categoria').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.categoria').forEach(b => b.classList.remove('activa'));
                btn.classList.add('activa');
                this.categoriaActual = btn.dataset.categoria;
                this.cargarPublicaciones(1);
            });
        });
    }
}

// Instancia global
window.comunidad = new ManejadorComunidad();