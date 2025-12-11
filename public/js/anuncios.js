class ManejadorAnuncios {
    constructor() {
        this.usuario = null;
        this.anuncios = [];
        this.inicializar();
    }

    inicializar() {
        this.verificarAutenticacion();
        this.cargarDatosUsuario();
        this.configurarManejadores();
    }

    verificarAutenticacion() {
        const datosUsuario = localStorage.getItem('datos_usuario');
        const token = localStorage.getItem('token_usuario');
        
        if (!datosUsuario || !token) {
            window.location.href = 'iniciar_sesion.html';
            return;
        }

        try {
            this.usuario = JSON.parse(datosUsuario);
        } catch (error) {
            this.cerrarSesion();
        }
    }

    cargarDatosUsuario() {
        if (!this.usuario) return;

        document.getElementById('nombre-usuario').textContent = 
            `${this.usuario.nombre} ${this.usuario.apellido}`;
    }

    configurarManejadores() {
        // Botón para crear anuncio
        const btnCrearAnuncio = document.getElementById('btn-crear-anuncio');
        if (btnCrearAnuncio) {
            btnCrearAnuncio.addEventListener('click', () => this.mostrarFormularioCrear());
        }

        // Botón para guardar anuncio
        const btnGuardarAnuncio = document.getElementById('btn-guardar-anuncio');
        if (btnGuardarAnuncio) {
            btnGuardarAnuncio.addEventListener('click', () => this.guardarAnuncio());
        }

        // Cargar anuncios si estamos en la página de listado
        if (document.getElementById('listado-anuncios')) {
            this.cargarAnuncios();
        }
    }

    async cargarAnuncios() {
        try {
            const token = localStorage.getItem('token_usuario');
            const respuesta = await fetch(`/proyectoWeb/viajeros_peru/backend/api/anuncios.php?accion=listar&anfitrion_id=${this.usuario.id}`, {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.anuncios = resultado.anuncios;
                this.mostrarAnuncios();
            } else {
                this.mostrarError('Error al cargar anuncios: ' + resultado.error);
            }
        } catch (error) {
            this.mostrarError('Error de conexión al cargar anuncios');
        }
    }

    mostrarAnuncios() {
        const contenedor = document.getElementById('listado-anuncios');
        if (!contenedor) return;

        if (this.anuncios.length === 0) {
            contenedor.innerHTML = '<p>No tienes anuncios publicados.</p>';
            return;
        }

        const html = this.anuncios.map(anuncio => `
            <div class="anuncio-card">
                <h3>${anuncio.titulo}</h3>
                <p><strong>Ubicación:</strong> ${anuncio.ubicacion}</p>
                <p><strong>Actividad:</strong> ${anuncio.tipo_actividad}</p>
                <p><strong>Duración:</strong> ${anuncio.duracion_minima} - ${anuncio.duracion_maxima} días</p>
                <p><strong>Cupos:</strong> ${anuncio.cupos_disponibles}</p>
                <p><strong>Estado:</strong> ${anuncio.estado}</p>
                <div class="acciones-anuncio">
                    <button onclick="manejadorAnuncios.editarAnuncio(${anuncio.id})">Editar</button>
                    <button onclick="manejadorAnuncios.eliminarAnuncio(${anuncio.id})">Eliminar</button>
                </div>
            </div>
        `).join('');

        contenedor.innerHTML = html;
    }

    mostrarFormularioCrear() {
        // Aquí podrías mostrar un modal o redirigir a una página de creación
        window.location.href = 'crear_anuncio.html';
    }

    async guardarAnuncio(e) {
        if (e) e.preventDefault();
        const datos = {
            anfitrion_id: this.usuario.id,
            titulo: document.getElementById('titulo').value,
            descripcion: document.getElementById('descripcion').value,
            ubicacion: document.getElementById('ubicacion').value,
            tipo_actividad: document.getElementById('tipo_actividad').value,
            duracion_minima: document.getElementById('duracion_minima').value,
            duracion_maxima: document.getElementById('duracion_maxima').value,
            cupos_disponibles: document.getElementById('cupos_disponibles').value,
            requisitos: document.getElementById('requisitos').value,
            comodidades: document.getElementById('comodidades').value
        };
        // Validación básica
        if (!datos.titulo || !datos.descripcion || !datos.ubicacion || !datos.tipo_actividad) {
            alert('Completa todos los campos obligatorios');
            return;
        }
        try {
            const token = localStorage.getItem('token_usuario');
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/anuncios.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    accion: 'crear',
                    ...datos
                })
            });
            const resultado = await respuesta.json();
            if (resultado.exito && resultado.anuncio && resultado.anuncio.id) {
                // Subir imágenes si hay
                const inputImagenes = document.getElementById('imagenes-anuncio');
                if (inputImagenes && inputImagenes.files.length > 0) {
                    for (let i = 0; i < inputImagenes.files.length; i++) {
                        const file = inputImagenes.files[i];
                        if (!['image/jpeg','image/png','image/gif'].includes(file.type) || file.size > 5*1024*1024) continue;
                        const formData = new FormData();
                        formData.append('anuncio_id', resultado.anuncio.id);
                        formData.append('imagen', file);
                        formData.append('orden', i+1);
                        await fetch('/proyectoWeb/viajeros_peru/backend/api/anuncios.php?accion=subir_imagen', {
                            method: 'POST',
                            body: formData
                        });
                    }
                }
                alert('Anuncio creado correctamente');
                window.location.href = 'anuncios.html';
            } else {
                alert('Error al crear anuncio: ' + (resultado.error || ''));
            }
        } catch (error) {
            alert('Error de conexión al crear anuncio');
        }
    }

    async eliminarAnuncio(id) {
        if (!confirm('¿Estás seguro de que quieres eliminar este anuncio?')) {
            return;
        }

        try {
            const token = localStorage.getItem('token_usuario');
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/anuncios.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    accion: 'eliminar',
                    id: id,
                    anfitrion_id: this.usuario.id
                })
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.mostrarExito('Anuncio eliminado correctamente');
                this.cargarAnuncios(); // Recargar listado
            } else {
                this.mostrarError('Error al eliminar anuncio: ' + resultado.error);
            }
        } catch (error) {
            this.mostrarError('Error de conexión al eliminar anuncio');
        }
    }

    mostrarError(mensaje) {
        alert('Error: ' + mensaje);
    }

    mostrarExito(mensaje) {
        alert(mensaje);
    }

    cerrarSesion() {
        localStorage.removeItem('token_usuario');
        localStorage.removeItem('datos_usuario');
        window.location.href = 'iniciar_sesion.html';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.manejadorAnuncios = new ManejadorAnuncios();
});