console.log('🎯 detalle_anuncio.js cargado');

class ManejadorDetalleAnuncio {
    constructor() {
        this.usuario = null;
        this.rol = null;
        this.anuncioId = null;
        this.anuncio = null;
        this.imagenes = []; 
        this.indiceLightboxActual = 0; 
        this.esFavorito = false;
        this.inicializar();
    }

    inicializar() {
        console.log('🚀 Inicializando detalle de anuncio...');
        this.obtenerIdAnuncio();
        this.verificarAutenticacion();
        this.cargarDatosUsuario();
        this.cargarAnuncio();
    }

    obtenerIdAnuncio() {
        const urlParams = new URLSearchParams(window.location.search);
        this.anuncioId = urlParams.get('id');
        
        if (!this.anuncioId) {
            this.mostrarError('No se especificó el ID del anuncio');
            return;
        }
        
        console.log('📋 Cargando anuncio ID:', this.anuncioId);
    }

    verificarAutenticacion() {
        const datosUsuario = localStorage.getItem('datos_usuario');
        
        if (datosUsuario) {
            try {
                this.usuario = JSON.parse(datosUsuario);
                this.rol = this.usuario.rol;
                console.log('✅ Usuario autenticado:', this.usuario);
            } catch (error) {
                console.error('❌ Error parseando usuario:', error);
            }
        } else {
            console.log('👤 Usuario no autenticado');
            this.rol = 'publico';
        }
    }

    cargarDatosUsuario() {
        const menuNavegacion = document.querySelector('.menu');
        
        if (this.usuario) {
            // Usuario autenticado 
            const rolTexto = this.rol === 'viajero' ? 'Viajero' : 
                        this.rol === 'anfitrion' ? 'Anfitrión' : 'Usuario';
            const estado = this.usuario.estado === 'activo' ? 'Activo' : 'Inactivo';
                    
            document.getElementById('badge-rol').textContent = rolTexto;
            document.getElementById('estado-anuncio').textContent = estado;
        } else {
            // Usuario NO autenticado
            document.getElementById('badge-rol').textContent = 'Invitado';
            document.getElementById('estado-anuncio').textContent = 'Sin acceso';
        }
    }

        async verificarEstadoFavorito() {
        const token = localStorage.getItem('token_usuario');
        
        if (!token || !this.usuario || !this.anuncioId) {
            console.log('⚠️ No se puede verificar favorito: usuario no autenticado o anuncio no cargado');
            return false;
        }

        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/favoritos.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: token,
                    accion: 'verificar',
                    anuncio_id: this.anuncioId
                })
            });

            const datos = await respuesta.json();
            
            if (datos.exito) {
                this.esFavorito = datos.es_favorito;
                this.actualizarBotonFavorito();
                return datos.es_favorito;
            }
        } catch (error) {
            console.error('Error verificando favorito:', error);
        }
        
        return false;
    }

        async alternarFavorito() {
        const token = localStorage.getItem('token_usuario');
        
        if (!token || !this.usuario) {
            alert('🔐 Debes iniciar sesión para guardar favoritos');
            window.location.href = '../auth/iniciar_sesion.html';
            return;
        }

        try {
            if (this.esFavorito) {
                // Eliminar de favoritos
                const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/favoritos.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        token: token,
                        accion: 'eliminar_anuncio',
                        anuncio_id: this.anuncioId
                    })
                });

                const datos = await respuesta.json();
                if (datos.exito) {
                    this.esFavorito = false;
                    this.actualizarBotonFavorito();
                    alert('❌ Eliminado de favoritos');
                }
            } else {
                // Agregar a favoritos
                const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/favoritos.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        token: token,
                        accion: 'agregar',
                        anuncio_id: this.anuncioId
                    })
                });

                const datos = await respuesta.json();
                if (datos.exito) {
                    this.esFavorito = true;
                    this.actualizarBotonFavorito();
                    alert('❤️ Agregado a favoritos');
                } else {
                    alert('⚠️ ' + datos.error);
                }
            }
        } catch (error) {
            console.error('Error al alternar favorito:', error);
            alert('❌ Error al procesar favorito');
        }
    }

        actualizarBotonFavorito() {
        const botonFavorito = document.getElementById('btn-favorito');
        if (!botonFavorito) return;
        
        if (this.esFavorito) {
            botonFavorito.innerHTML = '❤️ Quitar de Favoritos';
            botonFavorito.style.color = '#ff6b35';
            botonFavorito.style.backgroundColor = '#fff3f0';
            botonFavorito.style.border = '1px solid #ff6b35';
        } else {
            botonFavorito.innerHTML = '🤍 Agregar a Favoritos';
            botonFavorito.style.color = '#64748b';
            botonFavorito.style.backgroundColor = '#f8fafc';
            botonFavorito.style.border = '1px solid #e2e8f0';
        }
    }

    async cargarAnuncio() {
        if (!this.anuncioId) {
            this.mostrarError('ID de anuncio no válido');
            return;
        }

        try {
            console.log('📡 Cargando datos del anuncio...');
            
            const respuesta = await fetch(`/proyectoWeb/viajeros_peru/backend/api/anuncios.php?accion=obtener_por_id&id=${this.anuncioId}`);
            
            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }

            const resultado = await respuesta.json();
            console.log('📊 Resultado:', resultado);

            if (resultado.exito && resultado.anuncio) {
                this.anuncio = resultado.anuncio;
                this.mostrarAnuncio();
                this.configurarAcciones();
                
                // 🆕 CARGAR RESEÑAS PARA VIAJEROS
                if (this.rol === 'viajero' || this.rol === 'publico') {
                    await this.mostrarResenasEnAnuncio();
                }
                
            } else {
                throw new Error(resultado.error || 'Anuncio no encontrado');
            }
        } catch (error) {
            console.error('💥 Error cargando anuncio:', error);
            this.mostrarError('Error al cargar el anuncio: ' + error.message);
        }
    }

    mostrarAnuncio() {
        if (!this.anuncio) return;

        console.log('🎨 Mostrando anuncio en la interfaz...');
        console.log('📸 Datos del anfitrión:', {
            nombre: this.anuncio.nombre,
            apellido: this.anuncio.apellido,
            foto_perfil: this.anuncio.foto_perfil  // ← Ahora debería venir del backend
        });

        // Información básica
        document.getElementById('titulo-anuncio').textContent = this.anuncio.titulo;
        document.getElementById('subtitulo-anuncio').textContent = `En ${this.anuncio.ubicacion}`;
        
        // Información detallada
        document.getElementById('info-ubicacion').textContent = this.anuncio.ubicacion;
        document.getElementById('info-actividad').textContent = this.formatearTipoActividad(this.anuncio.tipo_actividad);
        document.getElementById('info-duracion').textContent = `${this.anuncio.duracion_minima} - ${this.anuncio.duracion_maxima} días`;
        document.getElementById('info-cupos').textContent = this.anuncio.cupos_disponibles;
        document.getElementById('info-fecha').textContent = new Date(this.anuncio.fecha_publicacion).toLocaleDateString('es-PE');
        
        // Estado
        const estadoElement = document.getElementById('info-estado');
        estadoElement.textContent = this.anuncio.estado;
        estadoElement.className = `estado-${this.anuncio.estado}`;
        
        // Descripción
        document.getElementById('descripcion-completa').textContent = this.anuncio.descripcion;

        // Requisitos
        if (this.anuncio.requisitos && this.anuncio.requisitos.trim() !== '') {
            document.getElementById('info-requisitos').textContent = this.anuncio.requisitos;
        } else {
            document.getElementById('seccion-requisitos').style.display = 'none';
        }

        // Comodidades
        if (this.anuncio.comodidades && this.anuncio.comodidades.trim() !== '') {
            document.getElementById('info-comodidades').textContent = this.anuncio.comodidades;
        } else {
            document.getElementById('seccion-comodidades').style.display = 'none';
        }

        // Anfitrión 
        if (!this.anuncio.foto_perfil) {
            document.getElementById('avatar-anfitrion').style.backgroundColor = '#6b7280'; // Gris por defecto
            document.getElementById('avatar-anfitrion').textContent = (this.anuncio.nombre?.charAt(0) || 'A') + (this.anuncio.apellido?.charAt(0) || 'N');
        } else {
            const rutaImagen = this.anuncio.foto_perfil;
            console.log('🖼️ Ruta de imagen del anfitrión:', rutaImagen);
            
            document.getElementById('avatar-anfitrion').style.backgroundImage = `url('${rutaImagen}')`;
            document.getElementById('avatar-anfitrion').textContent = '';
        }
        document.getElementById('nombre-anfitrion').textContent = `${this.anuncio.nombre} ${this.anuncio.apellido}`;
        document.getElementById('correo-anfitrion').textContent = this.anuncio.correo || 'Correo no disponible';

        console.log('✅ Anuncio mostrado correctamente');
        this.cargarImagenesAnuncio();
    }

    async cargarImagenesAnuncio() {
        if (!this.anuncioId) return;

        try {
            console.log('🖼️ Cargando imágenes del anuncio...');
            
            const respuesta = await fetch(`/proyectoWeb/viajeros_peru/backend/api/anuncios.php?accion=obtener_imagenes&anuncio_id=${this.anuncioId}`);
            
            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }

            const resultado = await respuesta.json();
            console.log('📸 Resultado imágenes:', resultado);

            if (resultado.exito && resultado.imagenes && resultado.imagenes.length > 0) {
                this.mostrarImagenes(resultado.imagenes);
            } else {
                this.mostrarSinImagenes();
            }
        } catch (error) {
            console.error('💥 Error cargando imágenes:', error);
            this.mostrarSinImagenes();
        }
    }

    mostrarImagenes(imagenes) {
        const contenedor = document.getElementById('imagenes-anuncio');
        
        if (!imagenes || imagenes.length === 0) {
            this.mostrarSinImagenes();
            return;
        }

        console.log('🎨 Mostrando imágenes:', imagenes.length);
        
        // Guardar las imágenes para el lightbox
        this.imagenes = imagenes;
        
        contenedor.innerHTML = '';
        
        // Crear galería principal
        const galeriaHTML = this.crearGaleriaHTML(imagenes);
        contenedor.innerHTML = galeriaHTML;
        
        // Configurar eventos para el lightbox
        this.configurarLightbox();
    }

    crearGaleriaHTML(imagenes) {
        if (imagenes.length === 0) {
            return '<div class="sin-imagenes">📷 No hay imágenes disponibles</div>';
        }

        let html = '';
        
        if (imagenes.length === 1) {
            // Una sola imagen - mostrar grande
            html = `
                <div class="galeria-simple">
                    <div class="imagen-principal">
                        <img src="${this.obtenerRutaImagen(imagenes[0])}" 
                            alt="Imagen del anuncio" 
                            class="imagen-grande"
                            onclick="manejadorDetalle.mostrarLightbox(0)">
                    </div>
                </div>
            `;
        } else {
            // Múltiples imágenes - mostrar grid con primera imagen grande
            html = `
                <div class="galeria-multiple">
                    <div class="imagen-principal">
                        <img src="${this.obtenerRutaImagen(imagenes[0])}" 
                            alt="Imagen principal del anuncio" 
                            class="imagen-grande"
                            onclick="manejadorDetalle.mostrarLightbox(0)">
                    </div>
                    <div class="grid-miniaturas">
                        ${imagenes.slice(1, 5).map((imagen, index) => `
                            <div class="miniatura-contenedor">
                                <img src="${this.obtenerRutaImagen(imagen)}" 
                                    alt="Imagen ${index + 2}" 
                                    class="miniatura"
                                    onclick="manejadorDetalle.mostrarLightbox(${index + 1})">
                                ${imagenes.length > 5 && index === 3 ? `
                                    <div class="contador-restantes">
                                        +${imagenes.length - 5}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    obtenerRutaImagen(imagen) {
        // Si la imagen es un objeto con propiedad 'ruta'
        if (typeof imagen === 'object' && imagen.ruta) {
            return imagen.ruta;
        }
        
        // Si es un string directo (nombre de archivo)
        if (typeof imagen === 'string') {
            return `/proyectoWeb/viajeros_peru/public/uploads/anuncios/${imagen}`;
        }
        
        // Valor por defecto si no se puede determinar
        console.warn('⚠️ No se pudo determinar la ruta de la imagen:', imagen);
        return '/proyectoWeb/viajeros_peru/public/img/placeholder-imagen.jpg';
    }

    mostrarSinImagenes() {
        const contenedor = document.getElementById('imagenes-anuncio');
        contenedor.innerHTML = `
            <div class="sin-imagenes">
                <div class="icono-sin-imagen">📷</div>
                <p>No hay imágenes disponibles para este anuncio</p>
            </div>
        `;
    }

    // Lightbox para ver imágenes en grande
    mostrarLightbox(indice) {
        if (this.imagenes.length === 0) return;

        const lightboxHTML = `
            <div class="lightbox" id="lightbox">
                <div class="lightbox-contenido">
                    <button class="lightbox-cerrar" onclick="manejadorDetalle.cerrarLightbox()">&times;</button>
                    <button class="lightbox-anterior" onclick="manejadorDetalle.cambiarImagen(-1)">‹</button>
                    <div class="lightbox-imagen-contenedor">
                        <img src="${this.obtenerRutaImagen(this.imagenes[indice])}" 
                            alt="Imagen ${indice + 1}" 
                            class="lightbox-imagen">
                    </div>
                    <button class="lightbox-siguiente" onclick="manejadorDetalle.cambiarImagen(1)">›</button>
                    <div class="lightbox-indicadores">
                        ${this.imagenes.map((_, i) => `
                            <span class="indicador ${i === indice ? 'activo' : ''}" 
                                onclick="manejadorDetalle.cambiarImagenDirecto(${i})"></span>
                        `).join('')}
                    </div>
                    <div class="lightbox-contador">
                        ${indice + 1} / ${this.imagenes.length}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', lightboxHTML);
        this.indiceLightboxActual = indice;
        
        // Configurar eventos de teclado
        document.addEventListener('keydown', this.manejarTecladoLightbox);
    }

    cerrarLightbox() {
        const lightbox = document.getElementById('lightbox');
        if (lightbox) {
            lightbox.remove();
        }
        document.removeEventListener('keydown', this.manejarTecladoLightbox);
    }

    cambiarImagen(direccion) {
        if (this.imagenes.length === 0) return;

        this.indiceLightboxActual += direccion;
        
        if (this.indiceLightboxActual < 0) {
            this.indiceLightboxActual = this.imagenes.length - 1;
        } else if (this.indiceLightboxActual >= this.imagenes.length) {
            this.indiceLightboxActual = 0;
        }

        this.actualizarLightbox();
    }

    cambiarImagenDirecto(indice) {
        this.indiceLightboxActual = indice;
        this.actualizarLightbox();
    }

    actualizarLightbox() {
        const lightbox = document.getElementById('lightbox');
        if (!lightbox) return;

        const imagenElement = lightbox.querySelector('.lightbox-imagen');
        const contadorElement = lightbox.querySelector('.lightbox-contador');
        const indicadores = lightbox.querySelectorAll('.indicador');

        if (imagenElement && this.imagenes[this.indiceLightboxActual]) {
            imagenElement.src = this.obtenerRutaImagen(this.imagenes[this.indiceLightboxActual]);
        }

        if (contadorElement) {
            contadorElement.textContent = `${this.indiceLightboxActual + 1} / ${this.imagenes.length}`;
        }

        indicadores.forEach((indicador, i) => {
            indicador.classList.toggle('activo', i === this.indiceLightboxActual);
        });
    }

    manejarTecladoLightbox = (e) => {
        switch(e.key) {
            case 'Escape':
                this.cerrarLightbox();
                break;
            case 'ArrowLeft':
                this.cambiarImagen(-1);
                break;
            case 'ArrowRight':
                this.cambiarImagen(1);
                break;
        }
    }

    configurarLightbox() {
        // Este método se llama después de crear la galería
        console.log('🔧 Lightbox configurado');
    }
        async configurarAcciones() {
        const esMiAnuncio = this.usuario && this.anuncio.anfitrion_id == this.usuario.id;

        // Ocultar todos los botones primero
        document.querySelectorAll('.boton-accion').forEach(btn => btn.style.display = 'none');
        document.getElementById('btn-verPerfil').style.display = 'block';
        document.getElementById('btn-verPerfil').addEventListener('click', () => {
            window.location.href = '../perfil/perfilPublico.html?id=' + this.anuncio.anfitrion_id;
        });

        // 🆕 Configurar botón de favoritos
        const btnFavorito = document.getElementById('btn-favorito');
        if (btnFavorito) {
            btnFavorito.addEventListener('click', () => this.alternarFavorito());
        }

        if (esMiAnuncio) {
            // Es el propietario del anuncio
            document.getElementById('btn-editar').style.display = 'block';
            document.getElementById('btn-eliminar').style.display = 'block';
            
            document.getElementById('btn-editar').addEventListener('click', () => {
                window.location.href = `editar_anuncio.html?id=${this.anuncioId}`;
            });
            
            document.getElementById('btn-eliminar').addEventListener('click', () => {
                this.eliminarAnuncio();
            });
        } else if (this.rol === 'viajero') {
            // Es un viajero - mostrar botones relevantes
            document.getElementById('btn-contactar').style.display = 'block';
            document.getElementById('btn-reservar').style.display = 'block';
            document.getElementById('btn-favorito').style.display = 'block';
            
            document.getElementById('btn-contactar').addEventListener('click', () => {
                this.contactarAnfitrion();
            });
            
            document.getElementById('btn-reservar').addEventListener('click', () => {
                this.solicitarReserva();
            });
            
            // 🆕 Verificar estado de favorito
            await this.verificarEstadoFavorito();
        } else if (this.rol === 'publico') {
            // Usuario no logueado
            document.getElementById('btn-login').style.display = 'block';
            
            document.getElementById('btn-login').addEventListener('click', () => {
                window.location.href = '../auth/iniciar_sesion.html';
            });
        } else if (this.rol === 'anfitrion') {
            // Es anfitrión pero no es su anuncio
            document.getElementById('btn-contactar').style.display = 'block';
            document.getElementById('btn-favorito').style.display = 'block';
            document.getElementById('btn-contactar').textContent = '💡 Contactar para Colaboración';
            
            document.getElementById('btn-contactar').addEventListener('click', () => {
                this.contactarAnfitrion();
            });
            
            // 🆕 Verificar estado de favorito
            await this.verificarEstadoFavorito();
        }
    }

    formatearTipoActividad(tipo) {
        const actividades = {
            'agricultura': '🌱 Agricultura',
            'ensenanza': '📚 Enseñanza',
            'construccion': '🏗️ Construcción',
            'cocina': '👨‍🍳 Cocina',
            'jardineria': '🌿 Jardinería',
            'ninos': '👶 Cuidado de niños',
            'animales': '🐕 Cuidado de animales',
            'tecnologia': '💻 Tecnología',
            'manualidades': '🎨 Manualidades'
        };
        
        return actividades[tipo] || tipo;
    }

    contactarAnfitrion() {
        if (!this.usuario) {
            alert('🔐 Debes iniciar sesión para contactar anfitriones');
            window.location.href = '../auth/iniciar_sesion.html';
            return;
        }
        
        // Abrir modal de mensajería
        this.abrirModalMensajeria();
    }

    solicitarReserva() {
        if (!this.usuario) {
            alert('🔐 Debes iniciar sesión para solicitar reservas');
            window.location.href = '../auth/iniciar_sesion.html';
            return;
        }
        
        // Abrir modal de reserva
        this.abrirModalReserva();
    }

    // Agrega estos métodos para el modal de reserva:

    abrirModalReserva() {
        const modalHTML = `
            <div class="modal-reserva" id="modal-reserva">
                <div class="modal-contenido">
                    <div class="modal-cabecera">
                        <h3>📅 Solicitar Reserva</h3>
                        <button class="cerrar-modal" onclick="manejadorDetalle.cerrarModalReserva()">&times;</button>
                    </div>
                    <div class="modal-cuerpo">
                        <form id="formulario-reserva">
                            <div class="campo-formulario">
                                <label for="fecha-inicio">Fecha de Inicio:</label>
                                <input type="date" id="fecha-inicio" required min="${this.obtenerFechaMinima()}">
                            </div>
                            <div class="campo-formulario">
                                <label for="fecha-fin">Fecha de Fin:</label>
                                <input type="date" id="fecha-fin" required>
                            </div>
                            <div class="campo-formulario">
                                <label for="mensaje-reserva">Mensaje para el anfitrión (opcional):</label>
                                <textarea id="mensaje-reserva" placeholder="Cuéntale al anfitrión sobre ti y tu viaje..." rows="4"></textarea>
                            </div>
                            <div class="info-reserva">
                                <p><strong>Duración mínima:</strong> ${this.anuncio.duracion_minima} días</p>
                                <p><strong>Duración máxima:</strong> ${this.anuncio.duracion_maxima} días</p>
                            </div>
                            <div class="acciones-modal">
                                <button type="button" class="boton-secundario" onclick="manejadorDetalle.cerrarModalReserva()">Cancelar</button>
                                <button type="submit" class="boton-primario">Enviar Solicitud</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Configurar manejador del formulario
        document.getElementById('formulario-reserva').addEventListener('submit', (e) => this.enviarSolicitudReserva(e));
        
        // Configurar validación de fechas
        document.getElementById('fecha-inicio').addEventListener('change', () => this.actualizarFechaMinimaFin());
    }

    cerrarModalReserva() {
        const modal = document.getElementById('modal-reserva');
        if (modal) {
            modal.remove();
        }
    }

    obtenerFechaMinima() {
        const hoy = new Date();
        return hoy.toISOString().split('T')[0];
    }

    actualizarFechaMinimaFin() {
        const fechaInicio = document.getElementById('fecha-inicio').value;
        const fechaFin = document.getElementById('fecha-fin');
        
        if (fechaInicio) {
            fechaFin.min = fechaInicio;
            
            // Calcular fecha mínima basada en duración mínima
            const fechaMin = new Date(fechaInicio);
            fechaMin.setDate(fechaMin.getDate() + this.anuncio.duracion_minima);
            fechaFin.min = fechaMin.toISOString().split('T')[0];
            
            // Calcular fecha máxima basada en duración máxima
            const fechaMax = new Date(fechaInicio);
            fechaMax.setDate(fechaMax.getDate() + this.anuncio.duracion_maxima);
            fechaFin.max = fechaMax.toISOString().split('T')[0];
        }
    }

    async enviarSolicitudReserva(e) {
        e.preventDefault();
        
        const fechaInicio = document.getElementById('fecha-inicio').value;
        const fechaFin = document.getElementById('fecha-fin').value;
        const mensaje = document.getElementById('mensaje-reserva').value;

        if (!fechaInicio || !fechaFin) {
            alert('Por favor, completa las fechas de la reserva');
            return;
        }

        try {
            const reserva = {
                accion: 'crear',
                anuncio_id: this.anuncioId,
                viajero_id: this.usuario.id,
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                mensaje_solicitud: mensaje
            };

            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/reservas.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(reserva)
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                alert('✅ Solicitud de reserva enviada correctamente');
                this.cerrarModalReserva();
            } else {
                alert('❌ Error al enviar la solicitud: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error enviando solicitud de reserva:', error);
            alert('❌ Error al enviar la solicitud');
        }
    }

    async eliminarAnuncio() {
        if (!confirm('¿Estás seguro de que quieres eliminar este anuncio? Esta acción no se puede deshacer.')) {
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
                    id: this.anuncioId,
                    anfitrion_id: this.usuario.id
                })
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                alert('✅ Anuncio eliminado correctamente');
                window.location.href = 'panel_control.html';
            } else {
                throw new Error(resultado.error || 'Error al eliminar');
            }
        } catch (error) {
            console.error('💥 Error eliminando anuncio:', error);
            alert('❌ Error al eliminar el anuncio: ' + error.message);
        }
    }

    mostrarError(mensaje) {
        const main = document.querySelector('main');
        main.innerHTML = `
            <div class="error-detalle">
                <h2 style="color: #dc2626; margin-bottom: 1rem;">❌ Error</h2>
                <p style="color: #64748b; margin-bottom: 2rem;">${mensaje}</p>
                <button onclick="window.location.href='busqueda.html'" 
                        style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer;">
                    🔍 Volver a Búsqueda
                </button>
            </div>
        `;
    }
    // Modal de mensajería integrado
    abrirModalMensajeria() {
    // Crear modal dinámicamente
        const modalHTML = `
            <div class="modal-mensajeria" id="modal-mensajeria">
                <div class="modal-contenido">
                    <div class="modal-cabecera">
                        <h3>💬 Contactar a ${this.anuncio.nombre} ${this.anuncio.apellido}</h3>
                        <button class="cerrar-modal" onclick="manejadorDetalle.cerrarModal()">&times;</button>
                    </div>
                    <div class="modal-cuerpo">
                        <div class="conversacion-mensajes" id="conversacion-mensajes">
                            <div class="mensaje-sistema">
                                💡 Puedes preguntar sobre disponibilidad, actividades, requisitos, etc.
                            </div>
                        </div>
                        <div class="formulario-mensaje">
                            <textarea 
                                id="texto-mensaje" 
                                placeholder="Escribe tu mensaje aquí..." 
                                rows="3"
                            ></textarea>
                            <button onclick="manejadorDetalle.enviarMensaje()" 
                                    class="boton-enviar">
                                📤 Enviar Mensaje
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Agregar modal al body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Cargar conversación existente
        this.cargarConversacion();
    }

    cerrarModal() {
        const modal = document.getElementById('modal-mensajeria');
        if (modal) {
            modal.remove();
        }
    }

    async cargarConversacion() {
        try {
            const respuesta = await fetch(`/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=obtener_conversacion&usuario1=${this.usuario.id}&usuario2=${this.anuncio.anfitrion_id}&anuncio_id=${this.anuncioId}`);
            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.mostrarMensajes(resultado.mensajes);
            }
        } catch (error) {
            console.error('Error cargando conversación:', error);
        }
    }

    mostrarMensajes(mensajes) {
        const contenedor = document.getElementById('conversacion-mensajes');
        if (!contenedor) return;

        // Mantener el mensaje del sistema
        const mensajeSistema = contenedor.querySelector('.mensaje-sistema');
        contenedor.innerHTML = '';
        if (mensajeSistema) {
            contenedor.appendChild(mensajeSistema);
        }

        if (mensajes && mensajes.length > 0) {
            mensajes.forEach(mensaje => {
                const esPropio = mensaje.remitente_id == this.usuario.id;
                const claseMensaje = esPropio ? 'mensaje-propio' : 'mensaje-recibido';
                
                const mensajeHTML = `
                    <div class="mensaje-chat ${claseMensaje}">
                        <div class="contenido-mensaje">
                            <p>${this.escaparHTML(mensaje.contenido)}</p>
                            <span class="hora-mensaje">${this.formatearHora(mensaje.fecha_creacion)}</span>
                        </div>
                    </div>
                `;
                
                contenedor.insertAdjacentHTML('beforeend', mensajeHTML);
            });
        }

        // Scroll al final
        contenedor.scrollTop = contenedor.scrollHeight;
    }

    async enviarMensaje() {
        const input = document.getElementById('texto-mensaje');
        const contenido = input.value.trim();

        if (!contenido) {
            alert('📝 Escribe un mensaje antes de enviar');
            return;
        }

        try {
            const mensaje = {
                accion: 'enviar',
                remitente_id: this.usuario.id,
                destinatario_id: this.anuncio.anfitrion_id,
                anuncio_id: this.anuncioId,
                contenido: contenido
            };

            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/mensajes.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(mensaje)
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                input.value = '';
                // Recargar la conversación
                this.cargarConversacion();
            } else {
                alert('❌ Error al enviar mensaje: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            alert('❌ Error al enviar mensaje');
        }
    }

    async cargarResenasAnuncio() {
        try {
            if (!this.anuncioId) {
                console.log('⚠️ No hay anuncio ID para cargar reseñas');
                return null;
            }

            console.log('📝 Cargando reseñas para anuncio:', this.anuncioId);
            
            const respuesta = await fetch(`/proyectoWeb/viajeros_peru/backend/api/resenas.php?accion=obtener_por_anuncio&anuncio_id=${this.anuncioId}`);
            
            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }

            const resultado = await respuesta.json();
            
            if (resultado.exito) {
                console.log(`✅ Reseñas cargadas: ${resultado.total}`);
                return resultado;
            } else {
                console.warn('⚠️ No se pudieron cargar las reseñas:', resultado.error);
                return null;
            }
        } catch (error) {
            console.error('Error cargando reseñas del anuncio:', error);
            return null;
        }
    }

    generarEstrellasHTML(puntuacion) {
        const estrellasLlenas = Math.floor(puntuacion);
        const mediaEstrella = (puntuacion - estrellasLlenas) >= 0.5;
        const estrellasVacias = 5 - estrellasLlenas - (mediaEstrella ? 1 : 0);
        
        let html = '';
        
        // Estrellas llenas
        for (let i = 0; i < estrellasLlenas; i++) {
            html += '<span style="color: #FFD700; font-size: 16px;">★</span>';
        }
        
        // Media estrella
        if (mediaEstrella) {
            html += '<span style="color: #FFD700; font-size: 16px; position: relative;">';
            html += '<span style="position: absolute; color: #ddd;">★</span>';
            html += '<span style="position: absolute; width: 50%; overflow: hidden; color: #FFD700;">★</span>';
            html += '</span>';
        }
        
        // Estrellas vacías
        for (let i = 0; i < estrellasVacias; i++) {
            html += '<span style="color: #ddd; font-size: 16px;">★</span>';
        }
        
        return html;
    }

    formatearFechaRelativa(fecha) {
        const ahora = new Date();
        const fechaResena = new Date(fecha);
        const diferencia = Math.floor((ahora - fechaResena) / (1000 * 60 * 60 * 24));
        
        if (diferencia === 0) {
            return 'Hoy';
        } else if (diferencia === 1) {
            return 'Ayer';
        } else if (diferencia < 7) {
            return `Hace ${diferencia} días`;
        } else if (diferencia < 30) {
            const semanas = Math.floor(diferencia / 7);
            return `Hace ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`;
        } else if (diferencia < 365) {
            const meses = Math.floor(diferencia / 30);
            return `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
        } else {
            const años = Math.floor(diferencia / 365);
            return `Hace ${años} ${años === 1 ? 'año' : 'años'}`;
        }
    }

    async mostrarResenasEnAnuncio() {
        // Solo mostrar reseñas si el usuario es viajero
        if (this.rol !== 'viajero' && this.rol !== 'publico') {
            console.log('👤 No es viajero, no se muestran reseñas');
            return;
        }

        const datosResenas = await this.cargarResenasAnuncio();
        
        if (!datosResenas || datosResenas.total === 0) {
            console.log('📭 No hay reseñas para mostrar');
            return;
        }

        // Crear sección de reseñas
        const seccionResenas = document.createElement('div');
        seccionResenas.className = 'tarjeta-detalle seccion-resenas-anuncio';
        seccionResenas.innerHTML = this.generarHTMLResenasAnuncio(datosResenas);
        
        // Insertar después de la sección de comodidades
        const seccionComodidades = document.getElementById('seccion-comodidades');
        if (seccionComodidades) {
            seccionComodidades.parentNode.insertBefore(seccionResenas, seccionComodidades.nextSibling);
        } else {
            // Insertar al final de la columna de información
            const columnaInfo = document.querySelector('.columna-info');
            if (columnaInfo) {
                columnaInfo.appendChild(seccionResenas);
            }
        }
    }

    generarHTMLResenasAnuncio(datos) {
        const { resenas, total, promedio, distribucion } = datos;
        
        // Generar HTML para la barra de distribución
        const barrasHTML = [5, 4, 3, 2, 1].map(estrellas => {
            const cantidad = distribucion[estrellas] || 0;
            const porcentaje = total > 0 ? (cantidad / total) * 100 : 0;
            
            return `
                <div class="barra-distribucion">
                    <span class="estrellas-bar">${estrellas} ★</span>
                    <div class="barra-container">
                        <div class="barra-progreso" style="width: ${porcentaje}%"></div>
                    </div>
                    <span class="cantidad-bar">${cantidad}</span>
                </div>
            `;
        }).join('');

        // HTML de las reseñas individuales
        const reseñasHTML = resenas.map(resena => {
            const estrellasHTML = this.generarEstrellasHTML(resena.puntuacion);
            const fechaRelativa = this.formatearFechaRelativa(resena.fecha_creacion);
            
            // Determinar foto del autor
            let fotoAutorHTML = '';
            if (resena.autor_foto_perfil) {
                fotoAutorHTML = `
                    <img src="${resena.autor_foto_perfil}" 
                        alt="Foto de ${resena.autor_nombre_completo || 'autor'}"
                        class="foto-autor-resena"
                        onerror="this.src='/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg'">
                `;
            } else {
                // Iniciales como fallback
                const iniciales = resena.autor_nombre ? resena.autor_nombre.charAt(0) : 'U';
                fotoAutorHTML = `
                    <div class="avatar-resena-iniciales">
                        ${iniciales}
                    </div>
                `;
            }
            
            return `
                <div class="resena-item">
                    <div class="resena-header">
                        <div class="resena-autor">
                            <div class="contenedor-foto-autor">
                                ${fotoAutorHTML}
                            </div>
                            <div class="info-autor">
                                <strong>${resena.autor_nombre_completo || 'Usuario'}</strong>
                                <span class="fecha-resena">${fechaRelativa}</span>
                                ${resena.estancia_info ? `
                                <span class="info-estancia">
                                    · ${resena.estancia_info.duracion_dias} días
                                </span>
                                ` : ''}
                            </div>
                        </div>
                        <div class="resena-calificacion">
                            ${estrellasHTML}
                        </div>
                    </div>
                    ${resena.comentario ? `
                    <div class="resena-comentario">
                        <p>${this.escaparHTML(resena.comentario)}</p>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        return `
            <h2>⭐ Reseñas de Viajeros (${total})</h2>
            <div class="contenedor-resenas-anuncio">
                <div class="resumen-resenas">
                    <div class="calificacion-promedio">
                        <div class="numero-promedio">${promedio.toFixed(1)}</div>
                        <div class="estrellas-promedio">
                            ${this.generarEstrellasHTML(promedio)}
                        </div>
                        <div class="total-resenas">${total} ${total === 1 ? 'reseña' : 'reseñas'}</div>
                    </div>
                    <div class="distribucion-resenas">
                        ${barrasHTML}
                    </div>
                </div>
                
                <div class="lista-resenas-anuncio">
                    ${reseñasHTML}
                </div>
                
                ${resenas.length > 5 ? `
                <div class="ver-mas-resenas">
                    <button class="boton-ver-mas" onclick="manejadorDetalle.mostrarTodasResenas()">
                        Ver todas las reseñas (${total})
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    }

    mostrarTodasResenas() {
        // Aquí podrías implementar un modal o página completa con todas las reseñas
        alert(`Este anuncio tiene ${this.totalResenas || 0} reseñas. En una implementación completa, esto abriría un modal con todas las reseñas.`);
    }

    formatearHora(fechaStr) {
        const fecha = new Date(fechaStr);
        return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }

    escaparHTML(texto) {
        if (!texto) return '';
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }
}

function cerrarSesion() {
    localStorage.removeItem('token_usuario');
    localStorage.removeItem('datos_usuario');
    window.location.href = '../auth/iniciar_sesion.html';
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🏁 DOM cargado - Iniciando detalle de anuncio');
    window.manejadorDetalle = new ManejadorDetalleAnuncio();
});