// Sistema de Gestión de Anuncios MEJORADO
class SistemaAnuncios {
    constructor() {
        this.usuario = null;
        this.anuncios = [];
        this.filtros = {
            estado: '',
            tipo: '',
            orden: 'reciente'
        };
        this.inicializar();
    }

    inicializar() {
        console.log('🏠 Iniciando sistema de anuncios mejorado...');
        this.verificarAutenticacion();
        this.cargarEstadisticas();
        this.cargarAnuncios();
        this.configurarEventos();
    }

    verificarAutenticacion() {
        const datosUsuario = localStorage.getItem('datos_usuario');
        
        if (datosUsuario) {
            try {
                this.usuario = JSON.parse(datosUsuario);
                if (this.usuario.rol !== 'anfitrion') {
                    alert('Solo los anfitriones pueden acceder a esta página');
                    window.location.href = '../perfil/panel_control.html';
                    return;
                }
                
            } catch (error) {
                console.error('Error parseando usuario:', error);
                window.location.href = '../auth/iniciar_sesion.html';
            }
        } else {
            window.location.href = '../auth/iniciar_sesion.html';
        }
    }

    configurarEventos() {
        // Configurar filtros
        document.getElementById('filtro-estado')?.addEventListener('change', (e) => {
            this.filtros.estado = e.target.value;
            this.filtrarYMostrarAnuncios();
        });
        
        document.getElementById('filtro-tipo')?.addEventListener('change', (e) => {
            this.filtros.tipo = e.target.value;
            this.filtrarYMostrarAnuncios();
        });
        
        document.getElementById('filtro-orden')?.addEventListener('change', (e) => {
            this.filtros.orden = e.target.value;
            this.filtrarYMostrarAnuncios();
        });
        
        // Botón limpiar filtros
        document.getElementById('btn-limpiar-filtros')?.addEventListener('click', () => {
            this.limpiarFiltros();
        });
    }

    limpiarFiltros() {
        document.getElementById('filtro-estado').value = '';
        document.getElementById('filtro-tipo').value = '';
        document.getElementById('filtro-orden').value = 'reciente';
        
        this.filtros = {
            estado: '',
            tipo: '',
            orden: 'reciente'
        };
        
        this.filtrarYMostrarAnuncios();
    }

    async cargarEstadisticas() {
        try {
            const respuesta = await fetch(
                `/proyectoWeb/viajeros_peru/backend/api/anuncios.php?accion=estadisticas_anfitrion&anfitrion_id=${this.usuario.id}`
            );
            
            const resultado = await respuesta.json();
            
            if (resultado.exito) {
                this.mostrarEstadisticas(resultado.estadisticas);
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    }

    mostrarEstadisticas(estadisticas) {
        const container = document.getElementById('estadisticas-container');
        
        if (!estadisticas || estadisticas.total_anuncios === 0) {
            container.innerHTML = '';
            return;
        }
        
        container.innerHTML = `
            <div class="tarjeta-estadistica total">
                <div class="numero">${estadisticas.total_anuncios}</div>
                <div class="label">Total Anuncios</div>
            </div>
            <div class="tarjeta-estadistica activos">
                <div class="numero">${estadisticas.total_anuncios}</div>
                <div class="label">Activos</div>
            </div>
            <div class="tarjeta-estadistica inactivos">
                <div class="numero">${estadisticas.reservas_confirmadas}</div>
                <div class="label">Reservas Confirmadas</div>
            </div>
            <div class="tarjeta-estadistica">
                <div class="numero">${estadisticas.solicitudes_pendientes}</div>
                <div class="label">Solicitudes Pendientes</div>
            </div>
        `;
    }

    async cargarAnuncios() {
        try {
            const respuesta = await fetch(
                `/proyectoWeb/viajeros_peru/backend/api/anuncios.php?accion=obtener_por_anfitrion&anfitrion_id=${this.usuario.id}`
            );
            
            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.anuncios = resultado.anuncios;
                this.filtrarYMostrarAnuncios();
            } else {
                this.mostrarError('Error cargando anuncios: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error cargando anuncios:', error);
            this.mostrarError('Error al cargar los anuncios');
        }
    }

    filtrarYMostrarAnuncios() {
        let anunciosFiltrados = [...this.anuncios];
        
        // Aplicar filtro por estado
        if (this.filtros.estado) {
            anunciosFiltrados = anunciosFiltrados.filter(anuncio => 
                anuncio.estado === this.filtros.estado
            );
        }
        
        // Aplicar filtro por tipo
        if (this.filtros.tipo) {
            anunciosFiltrados = anunciosFiltrados.filter(anuncio => 
                anuncio.tipo_actividad === this.filtros.tipo
            );
        }
        
        // Aplicar orden
        anunciosFiltrados.sort((a, b) => {
            switch (this.filtros.orden) {
                case 'antiguo':
                    return new Date(a.fecha_publicacion) - new Date(b.fecha_publicacion);
                case 'titulo':
                    return a.titulo.localeCompare(b.titulo);
                case 'reciente':
                default:
                    return new Date(b.fecha_publicacion) - new Date(a.fecha_publicacion);
            }
        });
        
        this.mostrarAnuncios(anunciosFiltrados);
    }

    mostrarAnuncios(anuncios) {
        const contenedor = document.getElementById('contenido-anuncios');
        
        if (!anuncios || anuncios.length === 0) {
            contenedor.innerHTML = `
                <div class="sin-anuncios">
                    <div class="icono-sin-anuncios">🏠</div>
                    <h3>No se encontraron anuncios</h3>
                    <p>${this.filtros.estado || this.filtros.tipo ? 
                        'Intenta con otros filtros o crea un nuevo anuncio' : 
                        'Crea tu primer anuncio para recibir viajeros'}</p>
                    <a href="../anuncios/crear_anuncio.html" class="boton-principal" style="display: inline-block; margin-top: 10px;">
                        Crear Nuevo Anuncio
                    </a>
                </div>
            `;
            return;
        }

        const html = `
            <div class="grid-anuncios">
                ${anuncios.map(anuncio => this.crearHTMLAnuncio(anuncio)).join('')}
            </div>
        `;
        
        contenedor.innerHTML = html;
    }

    crearHTMLAnuncio(anuncio) {
        const estadoClase = anuncio.estado;
        const estadoTexto = this.formatearEstado(anuncio.estado);
        const imagenUrl = anuncio.imagen_principal ? 
            anuncio.imagen_principal : 
            '';
        
        return `
            <div class="tarjeta-anuncio estado-${estadoClase}" data-id="${anuncio.id}">
                <div class="imagen-anuncio">
                    ${imagenUrl ? 
                        `<img src="/proyectoWeb/viajeros_peru${imagenUrl}" alt="${this.escaparHTML(anuncio.titulo)}" loading="lazy">` : 
                        `<div class="sin-imagen">🏠</div>`
                    }
                </div>
                
                <div class="contenido-anuncio">
                    <div class="cabecera-anuncio">
                        <h4 title="${this.escaparHTML(anuncio.titulo)}">
                            ${this.escaparHTML(anuncio.titulo.substring(0, 50))}${anuncio.titulo.length > 50 ? '...' : ''}
                        </h4>
                        <span class="badge-estado ${estadoClase}">${estadoTexto}</span>
                    </div>
                    
                    <div class="info-anuncio">
                        <div class="info-item">
                            <strong>📍</strong>
                            <span title="${this.escaparHTML(anuncio.ubicacion)}">
                                ${this.escaparHTML(anuncio.ubicacion.substring(0, 30))}${anuncio.ubicacion.length > 30 ? '...' : ''}
                            </span>
                        </div>
                        <div class="info-item">
                            <strong>🎯</strong>
                            <span>${this.formatearTipoActividad(anuncio.tipo_actividad)}</span>
                        </div>
                        <div class="info-item">
                            <strong>👥</strong>
                            <span>${anuncio.cupos_disponibles} cupos</span>
                        </div>
                    </div>
                    
                    <div class="descripcion-anuncio">
                        <p title="${this.escaparHTML(anuncio.descripcion)}">
                            ${this.escaparHTML(anuncio.descripcion.substring(0, 100))}${anuncio.descripcion.length > 100 ? '...' : ''}
                        </p>
                    </div>
                    
                    <div class="acciones-anuncio">
                        <a href="../anuncios/detalle_anuncio.html?id=${anuncio.id}" class="btn-accion btn-ver" title="Ver detalles">
                            👁️ Ver
                        </a>
                        <a href="../anuncios/editar_anuncio.html?id=${anuncio.id}" class="btn-accion btn-editar" title="Editar anuncio">
                            ✏️ Editar
                        </a>
                        <button class="btn-accion btn-eliminar" onclick="sistemaAnuncios.eliminarAnuncio(${anuncio.id})" title="Eliminar anuncio">
                            🗑️ Eliminar
                        </button>
                        <button class="btn-accion btn-estado" onclick="sistemaAnuncios.cambiarEstadoAnuncio(${anuncio.id})" title="Cambiar estado">
                            🔄 ${anuncio.estado === 'activo' ? 'Pausar anuncio' : 'Activar anuncio'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async eliminarAnuncio(anuncioId) {
        if (!confirm('¿Estás seguro de que quieres eliminar este anuncio?\n\nEsta acción eliminará todas las imágenes y reservas asociadas, y no se puede deshacer.')) {
            return;
        }

        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/anuncios.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'eliminar',
                    id: anuncioId,
                    anfitrion_id: this.usuario.id
                })
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.mostrarNotificacion('✅ Anuncio eliminado correctamente', 'exito');
                this.cargarEstadisticas();
                this.cargarAnuncios();
            } else {
                this.mostrarNotificacion('❌ Error al eliminar: ' + resultado.error, 'error');
            }
        } catch (error) {
            console.error('Error eliminando anuncio:', error);
            this.mostrarNotificacion('❌ Error al eliminar el anuncio', 'error');
        }
    }

    async cambiarEstadoAnuncio(anuncioId) {
        const anuncio = this.anuncios.find(a => a.id === anuncioId);
        if (!anuncio) {
            this.mostrarNotificacion('❌ Anuncio no encontrado', 'error');
            return;
        }
        
        let nuevoEstado;
        let mensajeConfirmacion;
        
        switch (anuncio.estado) {
            case 'activo':
                nuevoEstado = 'inactivo';
                mensajeConfirmacion = '¿Pausar este anuncio? Los viajeros no podrán verlo hasta que lo actives nuevamente.';
                break;
            case 'inactivo':
                nuevoEstado = 'activo';
                mensajeConfirmacion = '¿Activar este anuncio? Los viajeros podrán verlo y solicitar reservas.';
                break;
            case 'completo':
                this.mostrarNotificacion('❌ No se puede cambiar el estado de un anuncio completo', 'error');
                return;
            default:
                this.mostrarNotificacion('❌ Estado desconocido', 'error');
                return;
        }
        
        if (!confirm(mensajeConfirmacion)) {
            return;
        }
        
        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/anuncios.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'cambiar_estado',
                    id: anuncioId,
                    nuevo_estado: nuevoEstado,
                    anfitrion_id: this.usuario.id
                })
            });
            
            const resultado = await respuesta.json();
            
            if (resultado.exito) {
                this.mostrarNotificacion(`✅ Estado cambiado a ${this.formatearEstado(nuevoEstado)}`, 'exito');
                this.cargarEstadisticas();
                this.cargarAnuncios();
            } else {
                this.mostrarNotificacion('❌ Error al cambiar el estado: ' + resultado.error, 'error');
            }
        } catch (error) {
            console.error('Error cambiando estado del anuncio:', error);
            this.mostrarNotificacion('❌ Error al cambiar el estado del anuncio', 'error');
        }
    }

    // Utilidades
    formatearEstado(estado) {
        const estados = {
            'activo': '✅ Activo',
            'inactivo': '⏸️ Inactivo',
            'completo': '🏁 Completo'
        };
        return estados[estado] || estado;
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
            'manualidades': '🎨 Manualidades',
            'turismo': '🏞️ Turismo',
            'proyectos': '🔨 Proyectos'
        };
        return actividades[tipo] || tipo;
    }

    escaparHTML(texto) {
        if (!texto) return '';
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    mostrarNotificacion(mensaje, tipo = 'info') {
        // Crear notificación temporal
        const notificacion = document.createElement('div');
        notificacion.className = `notificacion-temporal notificacion-${tipo}`;
        notificacion.textContent = mensaje;
        notificacion.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: fadeIn 0.3s;
            max-width: 300px;
        `;
        
        if (tipo === 'exito') {
            notificacion.style.background = '#10b981';
        } else if (tipo === 'error') {
            notificacion.style.background = '#ef4444';
        } else {
            notificacion.style.background = '#3b82f6';
        }
        
        document.body.appendChild(notificacion);
        
        // Auto-eliminar después de 3 segundos
        setTimeout(() => {
            notificacion.style.animation = 'fadeOut 0.3s';
            setTimeout(() => {
                if (notificacion.parentNode) {
                    notificacion.parentNode.removeChild(notificacion);
                }
            }, 300);
        }, 3000);
    }

    mostrarError(mensaje) {
        const contenedor = document.getElementById('contenido-anuncios');
        contenedor.innerHTML = `
            <div class="sin-anuncios">
                <div class="icono-sin-anuncios">❌</div>
                <h3>Error al cargar anuncios</h3>
                <p>${mensaje}</p>
                <button onclick="sistemaAnuncios.cargarAnuncios()" class="boton-principal" style="margin-top: 15px;">
                    Reintentar
                </button>
            </div>
        `;
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.sistemaAnuncios = new SistemaAnuncios();
});