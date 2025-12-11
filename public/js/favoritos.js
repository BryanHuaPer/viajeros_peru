// Script para la página de Favoritos
class GestorFavoritos {
    constructor() {
        this.usuario = null;
        this.token = null;
        this.favoritos = {
            anuncios: [],
            perfiles: []
        };
        this.tabActivo = 'anuncios';
        
        this.inicializar();
    }

    async inicializar() {
        this.verificarAutenticacion();
        await this.cargarFavoritos();
    }

    verificarAutenticacion() {
        const datosUsuario = localStorage.getItem('datos_usuario');
        this.token = localStorage.getItem('token_usuario');
        
        if (!datosUsuario || !this.token) {
            window.location.href = '../../auth/iniciar_sesion.html';
            return;
        }

        try {
            this.usuario = JSON.parse(datosUsuario);
        } catch (error) {
            console.error('Error al parsear datos de usuario:', error);
            window.location.href = '../../auth/iniciar_sesion.html';
        }
    }

    async cargarFavoritos() {
        try {
            console.log('📥 Cargando favoritos...');
            
            // Cargar anuncios favoritos
            const urlAnuncios = '/proyectoWeb/viajeros_peru/backend/api/favoritos.php?token=' + encodeURIComponent(this.token);
            const respAnuncios = await fetch(urlAnuncios, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'obtener',
                    tipo: 'anuncio'
                })
            });

            const datosAnuncios = await respAnuncios.json();
            if (datosAnuncios.exito) {
                this.favoritos.anuncios = datosAnuncios.favoritos || [];
                console.log(`✅ ${this.favoritos.anuncios.length} anuncios favoritos cargados`);
            }

            // Cargar perfiles favoritos
            const urlPerfiles = '/proyectoWeb/viajeros_peru/backend/api/favoritos.php?token=' + encodeURIComponent(this.token);
            const respPerfiles = await fetch(urlPerfiles, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'obtener',
                    tipo: 'perfil'
                })
            });

            const datosPerfiles = await respPerfiles.json();
            if (datosPerfiles.exito) {
                this.favoritos.perfiles = datosPerfiles.favoritos || [];
                console.log(`✅ ${this.favoritos.perfiles.length} perfiles favoritos cargados`);
            }

            this.actualizarUI();
            
        } catch (error) {
            console.error('❌ Error al cargar favoritos:', error);
            this.mostrarError('Error al cargar los favoritos');
        }
    }

    actualizarUI() {
        // Actualizar contadores en tabs
        document.getElementById('count-anuncios').textContent = this.favoritos.anuncios.length;
        document.getElementById('count-perfiles').textContent = this.favoritos.perfiles.length;

        // Actualizar contador principal
        const totalFavoritos = this.favoritos.anuncios.length + this.favoritos.perfiles.length;
        document.getElementById('contador-favoritos').textContent = 
            `Tienes ${totalFavoritos} favorito${totalFavoritos !== 1 ? 's' : ''} guardado${totalFavoritos !== 1 ? 's' : ''}`;

        // Renderizar favoritos
        this.renderizarAnuncios();
        this.renderizarPerfiles();
    }

    renderizarAnuncios() {
        const contenedor = document.getElementById('grid-favoritos-anuncios');
        
        if (this.favoritos.anuncios.length === 0) {
            contenedor.innerHTML = `
                <div class="sin-favoritos">
                    <div class="sin-favoritos-icono">📍</div>
                    <h3>Sin anuncios favoritos</h3>
                    <p>Aún no has guardado ningún anuncio en favoritos. Explora y encuentra anuncios interesantes.</p>
                    <a href="../inicio/busqueda.html" class="btn-explorar">Explorar Anuncios</a>
                </div>
            `;
            return;
        }

        const html = this.favoritos.anuncios.map(fav => `
            <div class="tarjeta-favorito" data-anuncio-id="${fav.anuncio_id}" data-favorito-id="${fav.id}">
                ${
                    // Verificar si hay imagen o usar icono
                    fav.url_imagen && fav.url_imagen.trim() !== '' && fav.url_imagen !== 'null' 
                    ? `<img src="${this.formatearRutaImagen(fav.url_imagen, fav.tipo_actividad)}" 
                        alt="${fav.titulo}" 
                        class="imagen-favorito" 
                        onerror="this.src='/proyectoWeb/viajeros_peru/public/img/logos/logo.png'">`
                    : `<div class="icono-favorito">${this.obtenerIconoPorActividad(fav.tipo_actividad)}</div>`
                }
                
                <div class="contenido-tarjeta-favorito">
                    <h3 class="titulo-favorito">${this.escaparHTML(fav.titulo)}</h3>
                    
                    <span class="tipo-actividad">${this.formatearTipoActividad(fav.tipo_actividad)}</span>
                    
                    <div class="ubicacion-favorito">
                        📍 ${this.escaparHTML(fav.ubicacion)}
                    </div>

                    <div class="info-adicional">
                        <small style="color: #999;">
                            ${fav.duracion_minima} - ${fav.duracion_maxima} días
                        </small>
                    </div>

                    <div class="info-anfitrion">
                        <img src="${fav.foto_perfil || '/proyectoWeb/viajeros_peru/public/img/logos/logo.png'}" 
                            alt="${fav.nombre}" 
                            class="avatar-anfitrion" 
                            onerror="this.src='/proyectoWeb/viajeros_peru/public/img/logos/logo.png'">
                        <div>
                            <div class="nombre-anfitrion">${this.escaparHTML(fav.nombre)} ${this.escaparHTML(fav.apellido)}</div>
                            <div class="nombre-anfitrion" style="font-size: 11px;">Anfitrión</div>
                        </div>
                    </div>

                    <div class="acciones-favorito">
                        <button class="btn-ver-detalles" onclick="app.verDetallesAnuncio(${fav.anuncio_id})">
                            Ver detalles
                        </button>
                        <button class="btn-eliminar-favorito" onclick="app.eliminarFavorito(${fav.id}, 'anuncio')" title="Eliminar de favoritos">
                            ❌
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        contenedor.innerHTML = html;
    }

    renderizarPerfiles() {
        const contenedor = document.getElementById('grid-favoritos-perfiles');
        
        if (this.favoritos.perfiles.length === 0) {
            contenedor.innerHTML = `
                <div class="sin-favoritos">
                    <div class="sin-favoritos-icono">👥</div>
                    <h3>Sin perfiles favoritos</h3>
                    <p>Aún no has guardado ningún perfil en favoritos. Descubre perfiles interesantes en la comunidad.</p>
                    <a href="../comunidad/foro.html" class="btn-explorar">Explorar Comunidad</a>
                </div>
            `;
            return;
        }

        const html = this.favoritos.perfiles.map(fav => `
            <div class="tarjeta-favorito" data-usuario-id="${fav.usuario_favorito_id}" data-favorito-id="${fav.id}">
                <img src="${fav.foto_perfil}" alt="${fav.nombre}" class="imagen-favorito" onerror="this.src='/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg'" style="object-fit: cover;">
                
                <div class="contenido-tarjeta-favorito">
                    <h3 class="titulo-favorito">${this.escaparHTML(fav.nombre)} ${this.escaparHTML(fav.apellido)}</h3>
                    
                    <span class="tipo-actividad">${this.formatearRol(fav.rol)}</span>
                    
                    <div style="color: #666; font-size: 14px; margin: 8px 0;">
                        ${this.escaparHTML(fav.ubicacion || 'Ubicación no especificada')}
                    </div>

                    ${fav.bio ? `
                        <p style="font-size: 12px; color: #999; margin: 8px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            "${this.escaparHTML(fav.bio)}"
                        </p>
                    ` : ''}

                    <div class="info-anfitrion" style="border-top: 1px solid #e0e0e0; margin-top: 12px;">
                        <span style="font-size: 13px; color: #666;">
                            📍 ${fav.anuncios_activos || 0} anuncio${fav.anuncios_activos !== 1 ? 's' : ''} activo${fav.anuncios_activos !== 1 ? 's' : ''}
                        </span>
                    </div>

                    <div class="acciones-favorito">
                        <button class="btn-ver-detalles" onclick="app.verPerfilPublico(${fav.usuario_favorito_id})">
                            Ver perfil
                        </button>
                        <button class="btn-eliminar-favorito" onclick="app.eliminarFavorito(${fav.id}, 'perfil')" title="Eliminar de favoritos">
                            ❌
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        contenedor.innerHTML = html;
    }

    async eliminarFavorito(favoritoId, tipo) {
        if (!confirm('¿Estás seguro de que deseas eliminar esto de favoritos?')) {
            return;
        }

        try {
            const urlEliminar = '/proyectoWeb/viajeros_peru/backend/api/favoritos.php?token=' + encodeURIComponent(this.token);
            const resp = await fetch(urlEliminar, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'eliminar',
                    favorito_id: favoritoId
                })
            });

            const datos = await resp.json();
            
            if (datos.exito) {
                console.log('✅ Favorito eliminado');
                // Remover del array local
                if (tipo === 'anuncio') {
                    this.favoritos.anuncios = this.favoritos.anuncios.filter(f => f.id !== favoritoId);
                } else {
                    this.favoritos.perfiles = this.favoritos.perfiles.filter(f => f.id !== favoritoId);
                }
                this.actualizarUI();
                this.mostrarExito('Eliminado de favoritos');
            } else {
                this.mostrarError(datos.error || 'Error al eliminar de favoritos');
            }
        } catch (error) {
            console.error('❌ Error al eliminar favorito:', error);
            this.mostrarError('Error al eliminar de favoritos');
        }
    }

    cambiarTab(tab) {
        this.tabActivo = tab;
        
        // Actualizar botones
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('activo');
        });
        event.target.classList.add('activo');

        // Mostrar/ocultar contenido
        document.getElementById('contenedor-anuncios').style.display = tab === 'anuncios' ? 'block' : 'none';
        document.getElementById('contenedor-perfiles').style.display = tab === 'perfiles' ? 'block' : 'none';
    }

    verDetallesAnuncio(anuncioId) {
        window.location.href = `../anuncios/detalle_anuncio.html?id=${anuncioId}`;
    }

    verPerfilPublico(usuarioId) {
        window.location.href = `../perfil/perfilPublico.html?id=${usuarioId}`;
    }

    formatearRutaImagen(ruta, tipoActividad) {
        // Si no hay ruta de imagen, retornar icono
        if (!ruta || ruta.trim() === '' || ruta === 'null' || ruta === 'undefined') {
            const icono = this.obtenerIconoPorActividad(tipoActividad);
            return icono; // Retorna solo el emoji, no el template literal
        }
        
        // Si la ruta ya es una URL completa
        if (ruta.startsWith('http') || ruta.startsWith('//')) {
            return ruta;
        }

        // Asegurar que la ruta comience con /
        if (!ruta.startsWith('/')) {
            ruta = '/' + ruta;
        }

        // Construir URL completa
        const scheme = window.location.protocol;
        const host = window.location.host;
        return `${scheme}//${host}/proyectoWeb/viajeros_peru${ruta}`;
    }

    obtenerIconoPorActividad(tipo) {
        const iconos = {
            'agricultura': '🌱',
            'ensenanza': '📚',
            'construccion': '🏗️',
            'cocina': '👨‍🍳',
            'jardineria': '🌿',
            'ninos': '👶',
            'animales': '🐕',
            'tecnologia': '💻',
            'manualidades': '🎨',
            'artesania': '🎨',
            'turismo': '🏔️',
            'otro': '📍'
        };
        return iconos[tipo?.toLowerCase()] || '🏠';
    }

    formatearTipoActividad(tipo) {
        const tipos = {
            'agricultura': '🌾 Agricultura',
            'ensenanza': '📚 Enseñanza',
            'artesania': '🎨 Artesanía',
            'turismo': '🏔️ Turismo',
            'otro': '📍 Otro'
        };
        return tipos[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
    }

    formatearRol(rol) {
        const roles = {
            'viajero': '✈️ Viajero',
            'anfitrion': '🏠 Anfitrión',
            'administrador': '👨‍💼 Administrador'
        };
        return roles[rol] || rol;
    }

    escaparHTML(texto) {
        if (!texto) return '';
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    mostrarError(mensaje) {
        console.error('❌ Error:', mensaje);
        const alerta = document.createElement('div');
        alerta.className = 'error-mensaje';
        alerta.textContent = '❌ ' + mensaje;
        document.querySelector('.contenedor-favoritos').prepend(alerta);
        setTimeout(() => alerta.remove(), 5000);
    }

    mostrarExito(mensaje) {
        console.log('✅ Éxito:', mensaje);
        const alerta = document.createElement('div');
        alerta.style.cssText = 'background: #efe; color: #3c3; padding: 16px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #3c3;';
        alerta.textContent = '✅ ' + mensaje;
        document.querySelector('.contenedor-favoritos').prepend(alerta);
        setTimeout(() => alerta.remove(), 5000);
    }
}

// Objeto global para la aplicación
const app = {
    gestor: null,

    inicializar() {
        console.log('🚀 Inicializando Gestor de Favoritos...');
        this.gestor = new GestorFavoritos();
    },

    cambiarTab(tab) {
        this.gestor.cambiarTab(tab);
    },

    verDetallesAnuncio(anuncioId) {
        this.gestor.verDetallesAnuncio(anuncioId);
    },

    verPerfilPublico(usuarioId) {
        this.gestor.verPerfilPublico(usuarioId);
    },

    async eliminarFavorito(favoritoId, tipo) {
        await this.gestor.eliminarFavorito(favoritoId, tipo);
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    app.inicializar();
});
