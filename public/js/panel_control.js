// Script para el panel de control
class PanelControl {
    constructor() {
        this.usuario = null;
        this.manejadorAnuncios = null;
        this.inicializar();
    }

    async inicializar() { // 🆕 Hacer async
        this.verificarAutenticacion();
        this.cargarDatosUsuario();
        await this.cargarPerfilCompleto(); 
        this.cargarEstadisticas();
        this.cargarMensajesRecientes();
        
        // Cargar contenido según rol
        if (this.usuario.rol === 'anfitrion') {
            this.inicializarManejadorAnuncios();
            this.cargarMisAnuncios();
        } else {
            this.cargarAnunciosRecomendados();
        }
    }
    // 🆕 MÉTODO NUEVO: Cargar perfil completo
    async cargarPerfilCompleto() {
        try {
            console.log('📥 Cargando perfil completo desde panel_control...');
            
            const urlAPI = '/proyectoWeb/viajeros_peru/backend/api/perfiles.php';
            const token = localStorage.getItem('token_usuario');
            
            const respuesta = await fetch(`${urlAPI}?usuario_id=${this.usuario.id}`, {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }

            const resultado = await respuesta.json();
            
            if (resultado.exito && resultado.perfil) {
                console.log('✅ Perfil completo cargado desde panel_control');
                
                // Guardar en localStorage para que la navegación lo use
                localStorage.setItem('perfil_usuario', JSON.stringify(resultado.perfil));
                
                if (resultado.perfil.foto_perfil) {
                    localStorage.setItem('foto_perfil_actual', resultado.perfil.foto_perfil);
                    console.log('📸 Foto guardada para navegación:', resultado.perfil.foto_perfil);
                    
                    // 🆕 ACTUALIZAR NAVEGACIÓN EN TIEMPO REAL
                    if (window.navegacionGlobal && typeof window.navegacionGlobal.actualizarFotoEnNavegacion === 'function') {
                        window.navegacionGlobal.actualizarFotoEnNavegacion(resultado.perfil.foto_perfil);
                    }
                }
                
                return true;
            } else {
                console.warn('⚠️ No se pudo cargar perfil completo');
                return false;
            }
        } catch (error) {
            console.error('💥 Error cargando perfil completo:', error);
            return false;
        }
    }

    verificarAutenticacion() {
        const datosUsuario = localStorage.getItem('datos_usuario');
        const token = localStorage.getItem('token_usuario');
        
        if (!datosUsuario || !token) {
            console.log('❌ Usuario no autenticado, redirigiendo al login...');
            window.location.href = '../auth/iniciar_sesion.html';
            return;
        }

        try {
            this.usuario = JSON.parse(datosUsuario);
            console.log('✅ Usuario autenticado:', this.usuario);
        } catch (error) {
            console.error('Error parseando datos de usuario:', error);
            this.cerrarSesion();
        }
    }

    cargarDatosUsuario() {
        if (!this.usuario) return;
        
        document.getElementById('titulo-bienvenida').textContent = 
            `¡Bienvenido de vuelta, ${this.usuario.nombre}!`;
        
        document.getElementById('subtitulo-panel').textContent = 
            this.usuario.rol === 'viajero' 
                ? 'Encuentra tu próxima aventura en Perú' 
                : 'Gestiona tus alojamientos y recibe viajeros';

        document.getElementById('badge-rol').textContent = 
            this.usuario.rol === 'viajero' ? 'Viajero' : 'Anfitrión';

        // Mostrar/ocultar accesos según el rol
        if(this.usuario.rol === 'viajero') {
            document.getElementById('acceso-viajero-1').style.display = 'block';
            document.getElementById('acceso-viajero-2').style.display = 'block';
            document.getElementById('acceso-viajero-3').style.display = 'block';
        }

        if (this.usuario.rol === 'anfitrion') {
            document.getElementById('acceso-anfitrion-1').style.display = 'block';
            document.getElementById('acceso-anfitrion-2').style.display = 'block';
            document.getElementById('acceso-anfitrion-3').style.display = 'block';
            
            // Actualizar sección de anuncios para anfitriones
            document.getElementById('seccion-anuncios').style.display = 'block';
            document.getElementById('lista-anuncios-recomendados').style.display = 'none';
            document.getElementById('lista-mis-anuncios').style.display = 'block';
        }
        
        // Mostrar acceso a panel admin si es administrador
        if (this.usuario.rol === 'administrador') {
            document.getElementById('acceso-admin').style.display = 'block';
        }
    }

    inicializarManejadorAnuncios() {
        this.manejadorAnuncios = new ManejadorAnuncios(this.usuario);
    }

    async cargarEstadisticas() {
        if (this.usuario.rol === 'anfitrion') {
            await this.cargarEstadisticasAnfitrion();
        } else {
            await this.cargarEstadisticasViajero();
        }
    }

    async cargarEstadisticasAnfitrion() {
        try {
            const token = localStorage.getItem('token_usuario');
            
            const respuesta = await fetch(`/proyectoWeb/viajeros_peru/backend/api/anuncios.php?accion=estadisticas_anfitrion&anfitrion_id=${this.usuario.id}`, {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (respuesta.ok) {
                const resultado = await respuesta.json();
                
                if (resultado.exito) {
                    this.actualizarUIEstadisticasAnfitrion(resultado.estadisticas);
                } else {
                    console.error('Error en respuesta:', resultado.error);
                    this.mostrarEstadisticasPorDefecto();
                }
            } else {
                throw new Error('Error HTTP: ' + respuesta.status);
            }
        } catch (error) {
            console.error('Error cargando estadísticas anfitrión:', error);
            this.mostrarEstadisticasPorDefecto();
        }
    }

    async cargarEstadisticasViajero() {
        try {
            const token = localStorage.getItem('token_usuario');
            
            const respuesta = await fetch(`/proyectoWeb/viajeros_peru/backend/api/reservas.php?accion=estadisticas_viajero&viajero_id=${this.usuario.id}`, {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (respuesta.ok) {
                const resultado = await respuesta.json();
                
                if (resultado.exito) {
                    this.actualizarUIEstadisticasViajero(resultado.estadisticas);
                } else {
                    console.error('Error en respuesta:', resultado.error);
                    this.mostrarEstadisticasPorDefectoViajero();
                }
            } else {
                throw new Error('Error HTTP: ' + respuesta.status);
            }
        } catch (error) {
            console.error('Error cargando estadísticas viajero:', error);
            this.mostrarEstadisticasPorDefectoViajero();
        }
    }

    actualizarUIEstadisticasAnfitrion(estadisticas) {
        // Mostrar estadísticas de anfitrión
        document.getElementById('estadistica-anuncios').style.display = 'flex';
        document.getElementById('estadistica-solicitudes-anfitrion').style.display = 'flex';
        document.getElementById('estadistica-reservas').style.display = 'flex';
        document.getElementById('estadistica-calificacion-anfitrion').style.display = 'flex';
        
        // Ocultar estadísticas de viajero
        document.getElementById('estadistica-solicitudes-viajero').style.display = 'none';
        document.getElementById('estadistica-aceptadas').style.display = 'none';
        document.getElementById('estadistica-resenas').style.display = 'none';
        document.getElementById('estadistica-calificacion-viajero').style.display = 'none';
        
        // Actualizar valores
        document.getElementById('contador-anuncios').textContent = estadisticas.total_anuncios || 0;
        document.getElementById('contador-solicitudes-anfitrion').textContent = estadisticas.solicitudes_pendientes || 0;
        document.getElementById('contador-reservas').textContent = estadisticas.reservas_confirmadas || 0;
        document.getElementById('contador-calificacion-anfitrion').textContent = estadisticas.calificacion_promedio || '0.0';
    }

    actualizarUIEstadisticasViajero(estadisticas) {
        // Mostrar estadísticas de viajero
        document.getElementById('estadistica-solicitudes-viajero').style.display = 'flex';
        document.getElementById('estadistica-aceptadas').style.display = 'flex';
        document.getElementById('estadistica-resenas').style.display = 'flex';
        document.getElementById('estadistica-calificacion-viajero').style.display = 'flex';
        
        // Ocultar estadísticas de anfitrión
        document.getElementById('estadistica-anuncios').style.display = 'none';
        document.getElementById('estadistica-solicitudes-anfitrion').style.display = 'none';
        document.getElementById('estadistica-reservas').style.display = 'none';
        document.getElementById('estadistica-calificacion-anfitrion').style.display = 'none';
        
        // Actualizar valores
        document.getElementById('contador-solicitudes-viajero').textContent = estadisticas.solicitudes_enviadas || 0;
        document.getElementById('contador-aceptadas').textContent = estadisticas.solicitudes_aceptadas || 0;
        document.getElementById('contador-resenas').textContent = estadisticas.reseñas_recibidas || 0;
        document.getElementById('contador-calificacion-viajero').textContent = estadisticas.calificacion_promedio || 0;
    }

    mostrarEstadisticasPorDefecto() {
        // Valores por defecto para desarrollo
        document.getElementById('contador-anuncios').textContent = '0';
        document.getElementById('contador-solicitudes').textContent = '0';
        document.getElementById('contador-reservas').textContent = '0';
        document.getElementById('contador-calificacion').textContent = '0.0';
    }

    mostrarEstadisticasPorDefectoViajero() {
        document.getElementById('contador-solicitudes-viajero').textContent = '0';
        document.getElementById('contador-aceptadas').textContent = '0';
        document.getElementById('contador-resenas').textContent = '0';
        document.getElementById('contador-calificacion-viajero').textContent = '0.0';
    }

    async cargarMisAnuncios() {
        if (this.manejadorAnuncios) {
            await this.manejadorAnuncios.cargarAnuncios();
        }
    }

    async cargarAnunciosRecomendados() {
        try {
            const contenedor = document.getElementById('lista-anuncios-recomendados');
            contenedor.innerHTML = `
                <div class="sin-resultados" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                    <h4>🏠 Descubre Alojamientos Únicos</h4>
                    <p>Encuentra experiencias auténticas con anfitriones locales</p>
                    <a href="../inicio/busqueda.html" class="boton-primario" style="margin-top: 1rem; display: inline-block;">
                        🔍 Explorar Anuncios
                    </a>
                </div>
            `;

        } catch (error) {
            console.error('Error cargando anuncios recomendados:', error);
            const contenedor = document.getElementById('lista-anuncios-recomendados');
            contenedor.innerHTML = `
                <div class="error-carga">
                    <p>⚠️ Error al cargar anuncios. <a href="../inicio/busqueda.html">Intenta buscar manualmente</a></p>
                </div>
            `;
        }
    }

    async cargarMensajesRecientes() {
        if (!this.usuario) return;

        try {
            const respuesta = await fetch(`/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=obtener_chats&usuario_id=${this.usuario.id}`);
            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.mostrarMensajesRecientes(resultado.chats);
            }
        } catch (error) {
            console.error('Error cargando mensajes:', error);
        }
    }

    mostrarMensajesRecientes(chats) {
        const contenedor = document.getElementById('lista-actividad');
        if (!contenedor) return;

        if (!chats || chats.length === 0) {
            contenedor.innerHTML = `
                <div class="item-actividad">
                    <div class="icono-actividad">💬</div>
                    <div class="contenido-actividad">
                        <p><strong>No tienes mensajes aún</strong></p>
                        <span class="fecha-actividad">Los mensajes aparecerán aquí</span>
                    </div>
                </div>
            `;
            return;
        }

        // Mostrar hasta 5 actividades recientes
        const actividadesRecientes = chats.slice(0, 5);
        
        const html = actividadesRecientes.map(chat => {
            const tieneNoLeidos = chat.no_leidos > 0;
            const claseNotificacion = tieneNoLeidos ? 'item-actividad-nueva' : '';
            
            return `
                <div class="item-actividad ${claseNotificacion}" onclick="irA('../mensajes/mensajes.html')" style="cursor: pointer;">
                    <div class="icono-actividad">💬</div>
                    <div class="contenido-actividad">
                        <p><strong>${this.escaparHTML(chat.nombre)} ${this.escaparHTML(chat.apellido)}</strong></p>
                        <p style="color: #666; font-size: 0.9rem; margin: 0.25rem 0;">
                            ${this.escaparHTML(chat.ultimo_mensaje.substring(0, 60))}${chat.ultimo_mensaje.length > 60 ? '...' : ''}
                        </p>
                        <span class="fecha-actividad">${this.formatearFechaRelativa(chat.ultima_fecha)}</span>
                        ${tieneNoLeidos ? `<span class="badge-nuevo-mensaje">${chat.no_leidos} nuevo(s)</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        contenedor.innerHTML = html;
    }

    formatearFechaRelativa(fechaStr) {
        const fecha = new Date(fechaStr);
        const ahora = new Date();
        const diffMs = ahora - fecha;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours} h`;
        if (diffDays < 7) return `Hace ${diffDays} d`;
        
        return fecha.toLocaleDateString();
    }

    escaparHTML(texto) {
        if (!texto) return '';
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    cerrarSesion() {
        console.log('👋 Cerrando sesión...');
        localStorage.removeItem('token_usuario');
        localStorage.removeItem('datos_usuario');
        window.location.href = '../auth/iniciar_sesion.html';
    }
}

// Manejador de Anuncios
class ManejadorAnuncios {
    constructor(usuario) {
        this.usuario = usuario;
        this.anuncios = [];
        this.contenedor = document.getElementById('lista-mis-anuncios');
    }

    async cargarAnuncios() {
        try {
            
            const token = localStorage.getItem('token_usuario');
            const respuesta = await fetch(`/proyectoWeb/viajeros_peru/backend/api/anuncios.php?accion=obtener_por_anfitrion&anfitrion_id=${this.usuario.id}`, {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.anuncios = resultado.anuncios;
            } else {
                this.mostrarError('Error al cargar anuncios: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error cargando anuncios:', error);
            this.mostrarError('Error de conexión al cargar anuncios');
        }
    }

    async guardarAnuncio(evento) {
        evento.preventDefault();
        
        const botonGuardar = evento.target.querySelector('button[type="submit"]');
        const textoOriginal = botonGuardar.textContent;
        botonGuardar.disabled = true;
        botonGuardar.textContent = 'Publicando...';

        try {
            const token = localStorage.getItem('token_usuario');
            
            const datos = {
                accion: 'crear',
                anfitrion_id: this.usuario.id,
                titulo: document.getElementById('titulo-anuncio').value,
                descripcion: document.getElementById('descripcion-anuncio').value,
                ubicacion: document.getElementById('ubicacion-anuncio').value,
                tipo_actividad: document.getElementById('tipo-actividad').value,
                duracion_minima: document.getElementById('duracion-minima').value,
                duracion_maxima: document.getElementById('duracion-maxima').value,
                cupos_disponibles: document.getElementById('cupos-disponibles').value,
                requisitos: document.getElementById('requisitos-anuncio').value,
                comodidades: document.getElementById('comodidades-anuncio').value
            };

            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/anuncios.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(datos)
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.mostrarExito('✅ Anuncio creado correctamente');
                this.cerrarFormulario();
                await this.cargarAnuncios(); // Recargar la lista
            } else {
                throw new Error(resultado.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Error guardando anuncio:', error);
            this.mostrarError('Error al crear anuncio: ' + error.message);
        } finally {
            botonGuardar.disabled = false;
            botonGuardar.textContent = textoOriginal;
        }
    }

    cerrarFormulario() {
        const modal = document.querySelector('.modal-formulario');
        if (modal) {
            modal.remove();
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
                this.mostrarExito('✅ Anuncio eliminado correctamente');
                await this.cargarAnuncios(); // Recargar la lista
            } else {
                throw new Error(resultado.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Error eliminando anuncio:', error);
            this.mostrarError('Error al eliminar anuncio: ' + error.message);
        }
    }

    mostrarEstadoCarga(mensaje) {
        this.contenedor.innerHTML = `<div class="estado-carga">${mensaje}</div>`;
    }

    mostrarError(mensaje) {
        alert('❌ ' + mensaje);
    }

    mostrarExito(mensaje) {
        alert(mensaje);
    }

    editarAnuncio(id) {
        window.location.href = `../anuncios/editar_anuncio.html?id=${id}`;
    }
}

// Funciones globales 
function irA(pagina) {
    window.location.href = pagina;
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando Panel de Control...');
    window.panelControl = new PanelControl();
});