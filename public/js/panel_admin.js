// Panel de Administración
class PanelAdmin {
    constructor() {
        this.usuario = null;
        this.inicializar();
    }

    inicializar() {
        console.log('⚙️ Iniciando panel de administración...');
        this.verificarAutenticacion();
        this.cargarEstadisticas();
        this.configurarNavegacion();
        this.configurarBuscadores();
    }

    verificarAutenticacion() {
        const datosUsuario = localStorage.getItem('datos_usuario');
        
        if (datosUsuario) {
            try {
                this.usuario = JSON.parse(datosUsuario);
                if (this.usuario.rol !== 'administrador') {
                    alert('❌ No tienes permisos de administrador');
                    window.location.href = '../perfil/panel_control.html';
                    return;
                }
                this.actualizarInterfazUsuario();
                console.log('✅ Administrador autenticado:', this.usuario);
            } catch (error) {
                console.error('Error parseando usuario:', error);
                window.location.href = '../auth/iniciar_sesion.html';
            }
        } else {
            window.location.href = '../auth/iniciar_sesion.html';
        }
    }

    actualizarInterfazUsuario() {

    }

    configurarNavegacion() {
        const botonesNav = document.querySelectorAll('.navegacion-admin button');
        const secciones = document.querySelectorAll('.seccion-admin');

        botonesNav.forEach(boton => {
            boton.addEventListener('click', () => {
                const seccionId = boton.dataset.seccion;

                // Remover activo de todos los botones
                botonesNav.forEach(b => b.classList.remove('nav-admin-activo'));
                // Agregar activo al botón clickeado
                boton.classList.add('nav-admin-activo');

                // Ocultar todas las secciones
                secciones.forEach(sec => sec.style.display = 'none');
                // Mostrar la sección correspondiente
                document.getElementById(`seccion-${seccionId}`).style.display = 'block';

                // Cargar datos de la sección si es necesario
                this.cargarSeccion(seccionId);
            });
        });
    }

    cargarSeccion(seccionId) {
        switch (seccionId) {
            case 'usuarios':
                this.cargarUsuarios();
                break;
            case 'anuncios':
                this.cargarAnuncios();
                break;
            case 'reservas':
                this.cargarReservas();
                break;
            case 'mensajes':
                this.cargarMensajes();
                break;
            case 'estadisticas':
                this.cargarEstadisticas();
                break;
            case 'verificaciones':
                this.cargarVerificaciones();
                break;
            case 'reportes':
                this.cargarReportes();
                break;
        }
    }

    configurarBuscadores() {
        // Buscador de usuarios
        const buscarUsuarios = document.getElementById('buscar-usuarios');
        if (buscarUsuarios) {
            buscarUsuarios.addEventListener('input', (e) => this.filtrarUsuarios(e.target.value));
        }

        // Buscador de anuncios
        const buscarAnuncios = document.getElementById('buscar-anuncios');
        if (buscarAnuncios) {
            buscarAnuncios.addEventListener('input', (e) => this.filtrarAnuncios(e.target.value));
        }

        // Buscador de mensajes
        const buscarMensajes = document.getElementById('buscar-mensajes');
        if (buscarMensajes) {
            buscarMensajes.addEventListener('input', (e) => this.filtrarMensajes(e.target.value));
        }

        // Filtro de reservas
        const filtroReservas = document.getElementById('filtro-estado-reservas');
        if (filtroReservas) {
            filtroReservas.addEventListener('change', (e) => this.filtrarReservas(e.target.value));
        }
    }

    configurarFiltrosVerificaciones() {
        const botonesFiltro = document.querySelectorAll('.navegacion-verificaciones button');
        
        botonesFiltro.forEach(boton => {
            boton.addEventListener('click', () => {
                const filtro = boton.dataset.filtro;
                
                // Remover activo de todos los botones
                botonesFiltro.forEach(b => b.classList.remove('boton-filtro-activo'));
                // Agregar activo al botón clickeado
                boton.classList.add('boton-filtro-activo');
                
                // Aplicar filtro
                this.aplicarFiltroVerificaciones(filtro);
            });
        });
    }

    aplicarFiltroVerificaciones(filtro) {
        if (!this.todasLasVerificaciones) return;

        let verificacionesFiltradas;

        switch (filtro) {
            case 'pendientes':
                verificacionesFiltradas = this.todasLasVerificaciones.filter(v => v.estado === 'pendiente');
                break;
            case 'aprobadas':
                verificacionesFiltradas = this.todasLasVerificaciones.filter(v => v.estado === 'verificado');
                break;
            case 'rechazadas':
                verificacionesFiltradas = this.todasLasVerificaciones.filter(v => v.estado === 'rechazado');
                break;
            case 'todas':
            default:
                verificacionesFiltradas = this.todasLasVerificaciones;
                break;
        }

        this.mostrarVerificaciones(verificacionesFiltradas);
        
        // Actualizar contador en el título
        const contador = document.getElementById('contador-pendientes');
        if (contador) {
            const pendientes = this.todasLasVerificaciones.filter(v => v.estado === 'pendiente').length;
            contador.textContent = pendientes;
        }
    }

    async cargarEstadisticas() {
        try {
            // Obtener estadísticas de usuarios
            const usuariosResp = await fetch('/proyectoWeb/viajeros_peru/backend/api/usuarios.php?accion=obtener_todos');
            const usuariosResult = await usuariosResp.json();

            if (usuariosResult.exito) {
                const usuarios = usuariosResult.usuarios || [];
                const viajeros = usuarios.filter(u => u.rol === 'viajero').length;
                const anfitriones = usuarios.filter(u => u.rol === 'anfitrion').length;

                document.getElementById('total-usuarios').textContent = usuarios.length;
                document.getElementById('total-viajeros').textContent = viajeros;
                document.getElementById('total-anfitriones').textContent = anfitriones;
            }

            // Obtener estadísticas de anuncios
            const anunciosResp = await fetch('/proyectoWeb/viajeros_peru/backend/api/anuncios.php?accion=buscar');
            const anunciosResult = await anunciosResp.json();

            if (anunciosResult.exito) {
                document.getElementById('total-anuncios').textContent = anunciosResult.total || 0;
            } else {
                console.error("Error al obtener los anuncios:", anunciosResult);
            }

            // Obtener estadísticas de reservas
            const reservasResp = await fetch('/proyectoWeb/viajeros_peru/backend/api/reservas.php?accion=obtener_todas');
            const reservasResult = await reservasResp.json();

            if (reservasResult.exito) {
                const reservas = reservasResult.reservas || [];
                const completadas = reservas.filter(r => r.estado === 'completada').length;

                document.getElementById('total-reservas').textContent = reservas.length;
                document.getElementById('reservas-completadas').textContent = completadas;
            }

            // Obtener estadísticas de mensajes
            const mensajesResp = await fetch('/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=obtener_todos');
            const mensajesResult = await mensajesResp.json();

            if (mensajesResult.exito) {
                document.getElementById('total-mensajes').textContent = mensajesResult.mensajes?.length || 0;
            }

            // Obtener estadísticas de reseñas
            const resenasResp = await fetch('/proyectoWeb/viajeros_peru/backend/api/resenas.php?accion=obtener_todas');
            const resenasResult = await resenasResp.json();

            if (resenasResult.exito) {
                document.getElementById('total-resenas').textContent = resenasResult.resenas?.length || 0;
            }

        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    }

    async cargarUsuarios() {
        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/usuarios.php?accion=obtener_todos');
            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.usuarios = resultado.usuarios;
                this.mostrarUsuarios(this.usuarios);
            } else {
                this.mostrarError('tabla-usuarios', 'Error cargando usuarios: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error cargando usuarios:', error);
            this.mostrarError('tabla-usuarios', 'Error al cargar los usuarios');
        }
    }

    mostrarUsuarios(usuarios) {
        const tbody = document.getElementById('tabla-usuarios');
        
        if (!usuarios || usuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="sin-datos">No hay usuarios registrados</td></tr>';
            return;
        }

        const html = usuarios.map(usuario => `
            <tr>
                <td>${usuario.id}</td>
                <td>${this.escaparHTML(usuario.nombre)} ${this.escaparHTML(usuario.apellido)}</td>
                <td>${this.escaparHTML(usuario.correo)}</td>
                <td>${this.formatearRol(usuario.rol)}</td>
                <td class="estado-${usuario.estado}">${this.formatearEstado(usuario.estado)}</td>
                <td>${this.formatearFecha(usuario.fecha_creacion)}</td>
                <td>
                    <div class="acciones-admin">
                        ${usuario.estado === 'activo' && usuario.rol !== 'administrador' ? 
                            `<button class="boton-accion-admin boton-suspender" onclick="panelAdmin.suspenderUsuario(${usuario.id})">Suspender</button>` :
                            usuario.estado === 'inactivo' ?
                            `<button class="boton-accion-admin boton-activar" onclick="panelAdmin.activarUsuario(${usuario.id})">Activar</button>` :
                            ''
                        }
                        ${usuario.rol !== 'administrador' ? 
                            `<button class="boton-accion-admin boton-eliminar" onclick="panelAdmin.eliminarUsuario(${usuario.id})">Eliminar</button>` :
                            ''
                        }
                    </div>
                </td>
            </tr>
        `).join('');

        tbody.innerHTML = html;
    }

    async cargarAnuncios() {
        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/anuncios.php?accion=buscar');
            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.anuncios = resultado.anuncios;
                this.mostrarAnuncios(this.anuncios);
            } else {
                this.mostrarError('tabla-anuncios', 'Error cargando anuncios: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error cargando anuncios:', error);
            this.mostrarError('tabla-anuncios', 'Error al cargar los anuncios');
        }
    }

    mostrarAnuncios(anuncios) {
        const tbody = document.getElementById('tabla-anuncios');
        
        if (!anuncios || anuncios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="sin-datos">No hay anuncios publicados</td></tr>';
            return;
        }

        const html = anuncios.map(anuncio => `
            <tr>
                <td>${anuncio.id}</td>
                <td>${this.escaparHTML(anuncio.titulo)}</td>
                <td>${this.escaparHTML(anuncio.nombre)} ${this.escaparHTML(anuncio.apellido)}</td>
                <td>${this.escaparHTML(anuncio.ubicacion)}</td>
                <td class="estado-${anuncio.estado}">${this.formatearEstado(anuncio.estado)}</td>
                <td>${this.formatearFecha(anuncio.fecha_publicacion)}</td>
                <td>
                    <div class="acciones-admin">
                        <button class="boton-accion-admin boton-eliminar" onclick="panelAdmin.eliminarAnuncio(${anuncio.id})">Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('');

        tbody.innerHTML = html;
    }

    async cargarReservas() {
        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/reservas.php?accion=obtener_todas');
            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.reservas = resultado.reservas;
                this.mostrarReservas(this.reservas);
            } else {
                this.mostrarError('tabla-reservas', 'Error cargando reservas: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error cargando reservas:', error);
            this.mostrarError('tabla-reservas', 'Error al cargar las reservas');
        }
    }

    mostrarReservas(reservas) {
        const tbody = document.getElementById('tabla-reservas');
        
        if (!reservas || reservas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="sin-datos">No hay reservas</td></tr>';
            return;
        }

        const html = reservas.map(reserva => `
            <tr>
                <td>${reserva.id}</td>
                <td>${this.escaparHTML(reserva.anuncio_titulo)}</td>
                <td>${this.escaparHTML(reserva.viajero_nombre)} ${this.escaparHTML(reserva.viajero_apellido)}</td>
                <td>${this.escaparHTML(reserva.anfitrion_nombre)} ${this.escaparHTML(reserva.anfitrion_apellido)}</td>
                <td>${this.formatearFecha(reserva.fecha_inicio)} - ${this.formatearFecha(reserva.fecha_fin)}</td>
                <td class="estado-${reserva.estado}">${this.formatearEstado(reserva.estado)}</td>
                <td>${this.formatearFecha(reserva.fecha_creacion)}</td>
            </tr>
        `).join('');

        tbody.innerHTML = html;
    }

    async cargarMensajes() {
        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=obtener_todos');
            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.mensajes = resultado.mensajes;
                this.mostrarMensajes(this.mensajes);
            } else {
                this.mostrarError('tabla-mensajes', 'Error cargando mensajes: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error cargando mensajes:', error);
            this.mostrarError('tabla-mensajes', 'Error al cargar los mensajes');
        }
    }

    mostrarMensajes(mensajes) {
        const tbody = document.getElementById('tabla-mensajes');
        
        if (!mensajes || mensajes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="sin-datos">No hay mensajes</td></tr>';
            return;
        }

        const html = mensajes.map(mensaje => `
            <tr>
                <td>${mensaje.id}</td>
                <td>${this.escaparHTML(mensaje.remitente_nombre)} ${this.escaparHTML(mensaje.remitente_apellido)}</td>
                <td>${this.escaparHTML(mensaje.destinatario_nombre)} ${this.escaparHTML(mensaje.destinatario_apellido)}</td>
                <td>${this.escaparHTML(mensaje.contenido.substring(0, 50))}${mensaje.contenido.length > 50 ? '...' : ''}</td>
                <td>${this.formatearFecha(mensaje.fecha_creacion)}</td>
                <td>${mensaje.leido ? '✅' : '❌'}</td>
            </tr>
        `).join('');

        tbody.innerHTML = html;
    }

    // Acciones de administración
    async suspenderUsuario(usuarioId) {
        if (!confirm('¿Estás seguro de que quieres suspender este usuario?')) {
            return;
        }

        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/admin.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'suspender_usuario',
                    usuario_id: usuarioId
                })
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                alert('✅ Usuario suspendido correctamente');
                this.cargarUsuarios();
                this.cargarEstadisticas();
            } else {
                alert('❌ Error al suspender usuario: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error suspendiendo usuario:', error);
            alert('❌ Error al suspender usuario');
        }
    }

    async activarUsuario(usuarioId) {
        if (!confirm('¿Estás seguro de que quieres activar este usuario?')) {
            return;
        }

        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/admin.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'activar_usuario',
                    usuario_id: usuarioId
                })
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                alert('✅ Usuario activado correctamente');
                this.cargarUsuarios();
                this.cargarEstadisticas();
            } else {
                alert('❌ Error al activar usuario: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error activando usuario:', error);
            alert('❌ Error al activar usuario');
        }
    }

    async eliminarUsuario(usuarioId) {
        if (!confirm('¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/admin.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'eliminar_usuario',
                    usuario_id: usuarioId
                })
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                alert('✅ Usuario eliminado correctamente');
                this.cargarUsuarios();
                this.cargarEstadisticas();
            } else {
                alert('❌ Error al eliminar usuario: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error eliminando usuario:', error);
            alert('❌ Error al eliminar usuario');
        }
    }

    async eliminarAnuncio(anuncioId) {
        if (!confirm('¿Estás seguro de que quieres eliminar este anuncio? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/admin.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'eliminar_anuncio',
                    anuncio_id: anuncioId
                })
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                alert('✅ Anuncio eliminado correctamente');
                this.cargarAnuncios();
                this.cargarEstadisticas();
            } else {
                alert('❌ Error al eliminar anuncio: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error eliminando anuncio:', error);
            alert('❌ Error al eliminar anuncio');
        }
    }

    // Método para cargar reportes
    async cargarReportes() {
        try {
            console.log('🔄 Cargando reportes...');
            
            const token = localStorage.getItem('token_usuario');
            
            if (!token) {
                throw new Error('No hay token de autenticación');
            }
            
            // URL para obtener los reportes
            const url = `/proyectoWeb/viajeros_peru/backend/api/admin.php?accion=obtener_reportes&token=${encodeURIComponent(token)}`;
            
            console.log('📡 URL:', url);
            
            const respuesta = await fetch(url);
            
            console.log('📄 Respuesta HTTP:', respuesta.status, respuesta.statusText);
            
            const resultado = await respuesta.json();
            console.log('📊 Resultado JSON:', resultado);

            if (resultado.exito) {
                // Guardar todos los reportes
                this.todosLosReportes = resultado.reportes;
                
                // Configurar filtro de estado
                this.configurarFiltroReportes();
                
                // Aplicar filtro inicial (todos los reportes)
                this.aplicarFiltroReportes('');
                
                console.log('✅ Reportes cargados correctamente:', this.todosLosReportes.length);
            } else {
                console.error('❌ Error del servidor:', resultado.error);
                this.mostrarError('tabla-reportes', 'Error cargando reportes: ' + resultado.error);
            }
        } catch (error) {
            console.error('💥 Error cargando reportes:', error);
            this.mostrarError('tabla-reportes', 'Error al cargar los reportes: ' + error.message);
        }
    }

    // Configurar filtro de reportes
    configurarFiltroReportes() {
        const filtroEstado = document.getElementById('filtro-estado-reportes');
        if (filtroEstado) {
            filtroEstado.addEventListener('change', (e) => {
                this.aplicarFiltroReportes(e.target.value);
            });
        }
    }

    // Aplicar filtro a los reportes
    aplicarFiltroReportes(filtroEstado) {
        if (!this.todosLosReportes) return;

        let reportesFiltrados;

        switch (filtroEstado) {
            case 'pendiente':
                reportesFiltrados = this.todosLosReportes.filter(r => r.estado === 'pendiente');
                break;
            case 'en-revision':
                reportesFiltrados = this.todosLosReportes.filter(r => r.estado === 'revisado');
                break;
            case 'resuelto':
                reportesFiltrados = this.todosLosReportes.filter(r => r.estado === 'resuelto');
                break;
            case 'rechazado':
                // Nota: Según tu esquema, no tienes estado 'rechazado', solo 'pendiente', 'revisado', 'resuelto'
                // Podrías considerar usar 'resuelto' para ambos o agregar el estado
                reportesFiltrados = this.todosLosReportes.filter(r => r.estado === 'revisado'); // Ajusta según necesidad
                break;
            case '':
            default:
                reportesFiltrados = this.todosLosReportes;
                break;
        }

        this.mostrarReportes(reportesFiltrados);
    }

    // Mostrar reportes en la tabla
    mostrarReportes(reportes) {
        const tbody = document.getElementById('tabla-reportes');
        
        if (!reportes || reportes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="sin-datos">No hay reportes</td></tr>';
            return;
        }

        const html = reportes.map(reporte => {
            // Obtener información del reporte
            const motivoInfo = this.parsearMotivoReporte(reporte.motivo);
            const objetoInfo = this.obtenerInfoObjetoReporte(reporte);
            
            return `
            <tr data-reporte-id="${reporte.id}">
                <td>${reporte.id}</td>
                <td>
                    <div class="usuario-info">
                        ${reporte.reportador_foto_perfil ? 
                            `<img src="${reporte.reportador_foto_perfil}" class="foto-usuario-mini" alt="${reporte.reportador_nombre}">` : 
                            '<div class="avatar-mini">👤</div>'
                        }
                        <div>
                            <strong>${this.escaparHTML(reporte.reportador_nombre)} ${this.escaparHTML(reporte.reportador_apellido)}</strong>
                            <div class="correo-usuario">${this.escaparHTML(reporte.reportador_correo)}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge-tipo ${reporte.tipo}">
                        ${this.formatearTipoReporte(reporte.tipo)}
                    </span>
                    ${objetoInfo ? `
                        <div class="info-objeto-reportado">
                            <small>${objetoInfo}</small>
                        </div>
                    ` : ''}
                </td>
                <td>
                    <div class="motivo-reporte">
                        <strong>Motivo:</strong>
                        <p>${this.escaparHTML(motivoInfo.motivo)}</p>
                    </div>
                    ${motivoInfo.detalles ? `
                        <div class="detalles-reporte">
                            <small>${this.escaparHTML(motivoInfo.detalles)}</small>
                        </div>
                    ` : ''}
                </td>
                <td class="estado-${reporte.estado}">
                    ${this.formatearEstadoReporte(reporte.estado)}
                </td>
                <td>${this.formatearFecha(reporte.fecha_reporte)}</td>
                <td>
                    <div class="acciones-admin">
                        ${reporte.estado === 'pendiente' ? `
                            <button class="boton-accion-admin boton-revisar" onclick="panelAdmin.cambiarEstadoReporte(${reporte.id}, 'revisado')">
                                👁️ Revisar
                            </button>
                        ` : ''}
                        
                        ${reporte.estado === 'revisado' ? `
                            <button class="boton-accion-admin boton-resolver" onclick="panelAdmin.cambiarEstadoReporte(${reporte.id}, 'resuelto')">
                                ✅ Resolver
                            </button>
                        ` : ''}
                        
                        <button class="boton-accion-admin boton-detalle" onclick="panelAdmin.verDetalleReporte(${reporte.id})">
                            📋 Detalle
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');

        tbody.innerHTML = html;
    }

    // Parsear el motivo del reporte (maneja JSON y texto plano)
    parsearMotivoReporte(motivo) {
        try {
            // Si el motivo parece ser JSON, parsearlo
            if (motivo.trim().startsWith('{') && motivo.trim().endsWith('}')) {
                const motivoJson = JSON.parse(motivo);
                
                // Para reportes de mensajes con formato JSON
                if (motivoJson.motivo_texto) {
                    return {
                        motivo: this.formatearMotivoTexto(motivoJson.motivo_texto),
                        detalles: `Contiene contexto del chat. Mensaje ID: ${motivoJson.mensaje_reportado_id || 'N/A'}`
                    };
                }
                
                // Si no tiene el formato esperado, devolver como texto
                return {
                    motivo: this.escaparHTML(motivo),
                    detalles: null
                };
            }
        } catch (e) {
            // Si falla el parseo, no es JSON válido
            console.log('No es JSON válido:', e);
        }
        
        // Para texto plano
        return {
            motivo: this.escaparHTML(motivo),
            detalles: null
        };
    }

    // Formatear motivo de texto (ej: "[spam] texto")
    formatearMotivoTexto(motivoTexto) {
        // Separar categoría y descripción
        const match = motivoTexto.match(/^\[([^\]]+)\]\s*(.*)$/);
        
        if (match) {
            const categoria = match[1];
            const descripcion = match[2] || 'Sin descripción adicional';
            
            const categorias = {
                'spam': '🚫 Spam',
                'acoso': '⚠️ Acoso',
                'contenido_inapropiado': '🔞 Contenido inapropiado',
                'informacion_falsa': '🤥 Información falsa'
            };
            
            const categoriaFormateada = categorias[categoria] || categoria;
            return `${categoriaFormateada}: ${descripcion}`;
        }
        
        return motivoTexto;
    }

    // Obtener información del objeto reportado
    obtenerInfoObjetoReporte(reporte) {
        switch (reporte.tipo) {
            case 'usuario':
                return reporte.reportado_nombre ? 
                    `Usuario: ${reporte.reportado_nombre} ${reporte.reportado_apellido}` : 
                    'Usuario reportado';
            
            case 'anuncio':
                return reporte.anuncio_titulo ? 
                    `Anuncio: ${reporte.anuncio_titulo}` : 
                    'Anuncio reportado';
            
            case 'publicacion':
                return reporte.publicacion_titulo ? 
                    `Publicación: ${reporte.publicacion_titulo}` : 
                    'Publicación reportada';
            
            case 'mensaje':
                return reporte.reportado_nombre ? 
                    `Mensaje de: ${reporte.reportado_nombre} ${reporte.reportado_apellido}` : 
                    'Mensaje reportado';
            
            default:
                return null;
        }
    }

    // Formatear tipo de reporte
    formatearTipoReporte(tipo) {
        const tipos = {
            'usuario': '👤 Usuario',
            'anuncio': '🏠 Anuncio',
            'publicacion': '📝 Publicación',
            'mensaje': '💬 Mensaje'
        };
        return tipos[tipo] || tipo;
    }

    // Formatear estado de reporte
    formatearEstadoReporte(estado) {
        const estados = {
            'pendiente': '⏳ Pendiente',
            'revisado': '👁️ En Revisión',
            'resuelto': '✅ Resuelto'
        };
        return estados[estado] || estado;
    }

    // Cambiar estado del reporte
    async cambiarEstadoReporte(reporteId, nuevoEstado) {
        try {
            const token = localStorage.getItem('token_usuario');
            
            const confirmacion = confirm(`¿Estás seguro de cambiar el estado a "${this.formatearEstadoReporte(nuevoEstado)}"?`);
            if (!confirmacion) return;
            
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/admin.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'cambiar_estado_reporte',
                    reporte_id: reporteId,
                    nuevo_estado: nuevoEstado,
                    token: token
                })
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                alert('✅ Estado actualizado correctamente');
                this.cargarReportes();
            } else {
                alert('❌ Error al actualizar estado: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error cambiando estado:', error);
            alert('❌ Error al cambiar estado del reporte');
        }
    }

    // Ver detalle completo del reporte
    async verDetalleReporte(reporteId) {
        try {
            const token = localStorage.getItem('token_usuario');
            const url = `/proyectoWeb/viajeros_peru/backend/api/admin.php?accion=obtener_detalle_reporte&reporte_id=${reporteId}&token=${encodeURIComponent(token)}`;
            
            const respuesta = await fetch(url);
            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.mostrarModalDetalleReporte(resultado.reporte);
            } else {
                alert('❌ Error al obtener detalles: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error obteniendo detalle:', error);
            alert('❌ Error al obtener los detalles del reporte');
        }
    }

    // Mostrar modal con detalles del reporte
    mostrarModalDetalleReporte(reporte) {
        const motivoInfo = this.parsearMotivoReporte(reporte.motivo);
        
        // Para reportes de mensajes con contexto
        let contextoChatHTML = '';
        let mensajeInfo = null;
        
        try {
            if (reporte.tipo === 'mensaje' && reporte.motivo.trim().startsWith('{')) {
                const motivoJson = JSON.parse(reporte.motivo);
                mensajeInfo = motivoJson;
                
                if (motivoJson.contexto_chat && Array.isArray(motivoJson.contexto_chat)) {
                    contextoChatHTML = `
                        <div class="seccion-contexto-chat" style="margin-bottom: 1.5rem;">
                            <h4>Contexto del Chat (últimos 5 mensajes)</h4>
                            <div style="background: #f8fafc; padding: 1rem; border-radius: 6px; margin-top: 0.5rem; max-height: 300px; overflow-y: auto;">
                                ${motivoJson.contexto_chat.map(mensaje => `
                                    <div class="mensaje-contexto" style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0;">
                                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                            <span style="font-weight: 500; color: ${mensaje.remitente_id == reporte.usuario_reportador_id ? '#3b82f6' : '#ef4444'}">
                                                ${mensaje.remitente_id == reporte.usuario_reportador_id ? 
                                                    `${reporte.reportador_nombre} (Reportador)` : 
                                                    `${reporte.reportado_nombre} (Reportado)`}
                                            </span>
                                            <span style="font-size: 0.875rem; color: #64748b;">
                                                ${this.formatearFechaHora(mensaje.fecha_creacion)}
                                            </span>
                                        </div>
                                        <div style="padding-left: 1rem; color: #475569;">
                                            ${this.escaparHTML(mensaje.contenido)}
                                        </div>
                                        ${mensajeInfo.mensaje_reportado_id && mensajeInfo.mensaje_reportado_id == mensaje.id ? 
                                            '<div style="margin-top: 0.25rem;"><span style="background: #ef4444; color: white; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">Mensaje reportado</span></div>' : 
                                            ''
                                        }
                                    </div>
                                `).join('')}
                            </div>
                            <div style="font-size: 0.875rem; color: #64748b; margin-top: 0.5rem;">
                                <strong>Mensaje reportado ID:</strong> ${mensajeInfo.mensaje_reportado_id || 'N/A'}
                            </div>
                        </div>
                    `;
                }
            }
        } catch (e) {
            console.error('Error parseando contexto del chat:', e);
        }
        
        const modalHTML = `
            <div class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
                <div class="modal-content" style="background: white; padding: 2rem; border-radius: 8px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem;">
                        <div>
                            <h3 style="margin: 0;">Reporte #${reporte.id}</h3>
                            <span class="badge-tipo ${reporte.tipo}" style="margin-top: 0.25rem;">
                                ${this.formatearTipoReporte(reporte.tipo)}
                            </span>
                        </div>
                        <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b;">×</button>
                    </div>
                    
                    <div class="detalles-reporte-completo">
                        <div class="info-general" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                            <div class="info-item">
                                <label style="display: block; color: #64748b; font-size: 0.875rem; margin-bottom: 0.25rem;"><strong>Estado:</strong></label>
                                <p class="estado-${reporte.estado}" style="margin: 0; font-weight: 500;">
                                    ${this.formatearEstadoReporte(reporte.estado)}
                                </p>
                            </div>
                            
                            <div class="info-item">
                                <label style="display: block; color: #64748b; font-size: 0.875rem; margin-bottom: 0.25rem;"><strong>Fecha Reporte:</strong></label>
                                <p style="margin: 0; font-weight: 500;">
                                    ${this.formatearFechaHora(reporte.fecha_reporte)}
                                </p>
                            </div>
                        </div>

                        <div class="secciones-usuarios" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                            <div class="seccion-reportador" style="background: #dbeafe; padding: 1rem; border-radius: 6px;">
                                <h4 style="margin: 0 0 0.75rem 0; color: #1e40af;">Reportador</h4>
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    ${reporte.reportador_foto_perfil ? 
                                        `<img src="${reporte.reportador_foto_perfil}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">` : 
                                        '<div style="width: 48px; height: 48px; border-radius: 50%; background: #93c5fd; display: flex; align-items: center; justify-content: center; color: #1e40af;">👤</div>'
                                    }
                                    <div>
                                        <strong>${this.escaparHTML(reporte.reportador_nombre)} ${this.escaparHTML(reporte.reportador_apellido)}</strong>
                                        <p style="margin: 0.25rem 0 0 0; color: #3b82f6; font-size: 0.875rem;">${this.escaparHTML(reporte.reportador_correo)}</p>
                                        <p style="margin: 0.25rem 0 0 0; color: #64748b; font-size: 0.875rem;">
                                            ID: ${reporte.usuario_reportador_id}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            ${reporte.reportado_nombre ? `
                                <div class="seccion-reportado" style="background: #fef3c7; padding: 1rem; border-radius: 6px;">
                                    <h4 style="margin: 0 0 0.75rem 0; color: #92400e;">Reportado</h4>
                                    <div style="display: flex; align-items: center; gap: 1rem;">
                                        ${reporte.reportado_foto_perfil ? 
                                            `<img src="${reporte.reportado_foto_perfil}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">` : 
                                            '<div style="width: 48px; height: 48px; border-radius: 50%; background: #fcd34d; display: flex; align-items: center; justify-content: center; color: #92400e;">👤</div>'
                                        }
                                        <div>
                                            <strong>${this.escaparHTML(reporte.reportado_nombre)} ${this.escaparHTML(reporte.reportado_apellido)}</strong>
                                            <p style="margin: 0.25rem 0 0 0; color: #d97706; font-size: 0.875rem;">${this.escaparHTML(reporte.reportado_correo)}</p>
                                            <p style="margin: 0.25rem 0 0 0; color: #64748b; font-size: 0.875rem;">
                                                ID: ${reporte.usuario_reportado_id || reporte.anuncio_reportado_id || reporte.publicacion_reportada_id || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ` : `
                                <div class="seccion-reportado" style="background: #f1f5f9; padding: 1rem; border-radius: 6px;">
                                    <h4 style="margin: 0 0 0.75rem 0; color: #475569;">Contenido Reportado</h4>
                                    <p style="color: #64748b; margin: 0;">
                                        ${this.obtenerInfoObjetoReporte(reporte)}
                                    </p>
                                </div>
                            `}
                        </div>

                        <div class="seccion-motivo" style="margin-bottom: 1.5rem;">
                            <h4 style="margin: 0 0 0.75rem 0; color: #1e293b;">Motivo del Reporte</h4>
                            <div style="background: #f8fafc; padding: 1rem; border-radius: 6px; margin-top: 0.5rem;">
                                <div style="white-space: pre-wrap; font-family: monospace; color: #334155;">
                                    ${motivoInfo.motivo}
                                </div>
                            </div>
                        </div>

                        ${contextoChatHTML}

                        ${reporte.tipo === 'mensaje' && mensajeInfo ? `
                            <div class="seccion-info-mensaje" style="margin-bottom: 1.5rem;">
                                <h4 style="margin: 0 0 0.75rem 0; color: #1e293b;">Información del Mensaje</h4>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div style="background: #f0f9ff; padding: 1rem; border-radius: 6px;">
                                        <label style="display: block; color: #0369a1; font-size: 0.875rem; margin-bottom: 0.25rem;"><strong>ID Mensaje Reportado:</strong></label>
                                        <p style="margin: 0; font-weight: 500;">${mensajeInfo.mensaje_reportado_id || 'N/A'}</p>
                                    </div>
                                    <div style="background: #f0f9ff; padding: 1rem; border-radius: 6px;">
                                        <label style="display: block; color: #0369a1; font-size: 0.875rem; margin-bottom: 0.25rem;"><strong>Fecha Contexto:</strong></label>
                                        <p style="margin: 0; font-weight: 500;">${this.formatearFechaHora(mensajeInfo.fecha_contexto)}</p>
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        ${reporte.tipo !== 'mensaje' ? `
                            <div class="seccion-objeto-info" style="margin-bottom: 1.5rem;">
                                <h4 style="margin: 0 0 0.75rem 0; color: #1e293b;">Información del ${this.formatearTipoReporte(reporte.tipo)}</h4>
                                <div style="background: #f8fafc; padding: 1rem; border-radius: 6px;">
                                    <p style="margin: 0; color: #475569;">
                                        ${this.obtenerInfoObjetoReporte(reporte)}
                                    </p>
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <div class="modal-actions" style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem; border-top: 2px solid #e2e8f0; padding-top: 1rem;">
                        <button onclick="this.closest('.modal-overlay').remove()" 
                                style="padding: 0.5rem 1.5rem; background: #64748b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                            Cerrar
                        </button>
                        
                        ${reporte.estado === 'pendiente' ? `
                            <button onclick="panelAdmin.cambiarEstadoReporte(${reporte.id}, 'revisado'); this.closest('.modal-overlay').remove()" 
                                    style="padding: 0.5rem 1.5rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                                👁️ Marcar como Revisado
                            </button>
                        ` : ''}
                        
                        ${reporte.estado === 'revisado' ? `
                            <button onclick="panelAdmin.cambiarEstadoReporte(${reporte.id}, 'resuelto'); this.closest('.modal-overlay').remove()" 
                                    style="padding: 0.5rem 1.5rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                                ✅ Marcar como Resuelto
                            </button>
                        ` : ''}
                        
                        ${reporte.estado === 'pendiente' || reporte.estado === 'revisado' ? `
                            <button onclick="panelAdmin.tomarAccionSobreReporte(${reporte.id})" 
                                    style="padding: 0.5rem 1.5rem; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                                🛠️ Tomar Acción
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Método para tomar acción sobre un reporte
    tomarAccionSobreReporte(reporteId) {
        const acciones = [
            { value: 'advertencia', label: '⚠️ Enviar advertencia al usuario' },
            { value: 'suspender', label: '⏸️ Suspender cuenta temporalmente' },
            { value: 'eliminar_contenido', label: '🗑️ Eliminar contenido reportado' },
            { value: 'bloquear_usuario', label: '🚫 Bloquear usuario' },
            { value: 'archivar', label: '📁 Archivar sin acción' }
        ];

        const opcionesHTML = acciones.map(accion => 
            `<option value="${accion.value}">${accion.label}</option>`
        ).join('');

        const motivoHTML = `
            <div style="margin: 1rem 0;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Seleccionar acción:</label>
                <select id="accion-tipo" style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;">
                    ${opcionesHTML}
                </select>
            </div>
            <div>
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Detalles de la acción:</label>
                <textarea id="detalle-accion" style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px; min-height: 100px;" placeholder="Describe la acción a tomar y el motivo..."></textarea>
            </div>
        `;

        const motivo = prompt('Selecciona y describe la acción a tomar:', motivoHTML);
        
        // Nota: prompt no soporta HTML complejo, así que necesitarías un modal personalizado
        // Para simplificar, aquí una versión básica:
        const accionTipo = prompt('Selecciona acción:\n1. ⚠️ Enviar advertencia\n2. ⏸️ Suspender cuenta\n3. 🗑️ Eliminar contenido\n4. 🚫 Bloquear usuario\n5. 📁 Archivar', '1');
        const detalleAccion = prompt('Describe la acción a tomar y el motivo:');
        
        if (detalleAccion) {
            this.ejecutarAccionReporte(reporteId, accionTipo, detalleAccion);
        }
    }

    // Ejecutar acción sobre reporte
    async ejecutarAccionReporte(reporteId, tipoAccion, detalleAccion) {
        try {
            const token = localStorage.getItem('token_usuario');
            
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/admin.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'tomar_accion_reporte',
                    reporte_id: reporteId,
                    tipo_accion: tipoAccion,
                    detalle_accion: detalleAccion,
                    token: token
                })
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                alert('✅ Acción ejecutada correctamente');
                this.cargarReportes();
            } else {
                alert('❌ Error al ejecutar acción: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error ejecutando acción:', error);
            alert('❌ Error al ejecutar acción sobre el reporte');
        }
    }

    // Nueva función para formatear fecha y hora
    formatearFechaHora(fechaStr) {
        if (!fechaStr) return 'N/A';
        
        try {
            const fecha = new Date(fechaStr);
            return fecha.toLocaleDateString('es-PE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return fechaStr;
        }
    }

    // Método para cargar verificaciones
    async cargarVerificaciones() {
        try {
            console.log('🔄 Cargando todas las verificaciones...');
            
            const token = localStorage.getItem('token_usuario');
            
            console.log('📡 Token disponible:', token ? 'SÍ' : 'NO');
            
            if (!token) {
                throw new Error('No hay token de autenticación');
            }
            
            // Usar query string para enviar token (compatible con InfinityFree)
            const url = `/proyectoWeb/viajeros_peru/backend/api/admin_verificaciones.php?accion=obtener_todas_verificaciones&token=${encodeURIComponent(token)}`;
            
            console.log('📡 URL:', url);
            
            const respuesta = await fetch(url);
            
            console.log('📄 Respuesta HTTP:', respuesta.status, respuesta.statusText);
            
            const textoRespuesta = await respuesta.text();
            console.log('📝 Respuesta cruda:', textoRespuesta);
            
            const resultado = JSON.parse(textoRespuesta);
            console.log('📊 Resultado JSON:', resultado);

            if (resultado.exito) {
                // Guarda TODAS las verificaciones
                this.todasLasVerificaciones = resultado.verificaciones;
                
                // Configura los filtros después de cargar los datos
                this.configurarFiltrosVerificaciones();
                
                // Muestra todas por defecto
                this.aplicarFiltroVerificaciones('todas');
                
                // Actualiza contador de pendientes
                document.getElementById('contador-pendientes').textContent = resultado.pendientes;
                
                console.log('✅ Verificaciones cargadas correctamente:', this.todasLasVerificaciones.length);
            } else {
                console.error('❌ Error del servidor:', resultado.error);
                this.mostrarError('tabla-verificaciones', 'Error cargando verificaciones: ' + resultado.error);
            }
        } catch (error) {
            console.error('💥 Error cargando verificaciones:', error);
            this.mostrarError('tabla-verificaciones', 'Error al cargar las verificaciones: ' + error.message);
        }
    }
    mostrarVerificaciones(verificaciones) {
        const tbody = document.getElementById('tabla-verificaciones');
        
        if (!verificaciones || verificaciones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="sin-datos">No hay verificaciones</td></tr>';
            return;
        }

        const html = verificaciones.map(verificacion => `
            <tr>
                <td>${verificacion.id}</td>
                <td>
                    <div class="usuario-info">
                        ${verificacion.foto_perfil ? 
                            `<img src="${verificacion.foto_perfil}" class="foto-usuario-mini" alt="${verificacion.nombre}">` : 
                            '<div class="avatar-mini">👤</div>'
                        }
                        <div>
                            <strong>${this.escaparHTML(verificacion.nombre)} ${this.escaparHTML(verificacion.apellido)}</strong>
                            <div class="correo-usuario">${this.escaparHTML(verificacion.correo)}</div>
                        </div>
                    </div>
                </td>
                <td>${this.formatearTipoDocumento(verificacion.tipo_documento)}</td>
                <td>${this.escaparHTML(verificacion.numero_documento)}</td>
                <td>${this.formatearFecha(verificacion.fecha_solicitud)}</td>
                <td class="estado-${verificacion.estado}">${this.formatearEstado(verificacion.estado)}</td>
                <td>
                    <div class="acciones-admin">
                        ${verificacion.estado === 'pendiente' ? `
                            <button class="boton-accion-admin boton-aprobar" onclick="panelAdmin.aprobarVerificacion(${verificacion.id})">
                                ✅ Aprobar
                            </button>
                            <button class="boton-accion-admin boton-rechazar" onclick="panelAdmin.rechazarVerificacion(${verificacion.id})">
                                ❌ Rechazar
                            </button>
                        ` : ''}
                        <button class="boton-accion-admin boton-detalle" onclick="panelAdmin.verDetalleVerificacion(${verificacion.id})">
                            👁️ Detalle
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        tbody.innerHTML = html;
    }
    async verDetalleVerificacion(verificacionId) {
        try {
            const token = localStorage.getItem('token_usuario');
            const url = `/proyectoWeb/viajeros_peru/backend/api/admin_verificaciones.php?accion=obtener_detalle_verificacion&verificacion_id=${verificacionId}&token=${encodeURIComponent(token)}`;
            
            console.log('🔍 Obteniendo detalles de verificación:', verificacionId);
            
            const respuesta = await fetch(url);
            
            console.log('📄 Respuesta HTTP detalles:', respuesta.status, respuesta.statusText);
            
            const textoRespuesta = await respuesta.text();
            console.log('📝 Respuesta cruda detalles:', textoRespuesta);
            
            const resultado = JSON.parse(textoRespuesta);

            if (resultado.exito) {
                // Crear modal para mostrar detalles
                this.mostrarModalDetalleVerificacion(resultado.verificacion);
            } else {
                alert('❌ Error al obtener detalles: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error obteniendo detalle:', error);
            alert('❌ Error al obtener los detalles de la verificación');
        }
    }

    mostrarModalDetalleVerificacion(verificacion) {
        // Crear modal con los detalles
        const modalHTML = `
            <div class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
                <div class="modal-content" style="background: white; padding: 2rem; border-radius: 8px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                    <div class="modal-header" style="display: flex; justify-content: between; align-items: center; margin-bottom: 1rem;">
                        <h3>Detalles de Verificación</h3>
                        <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
                    </div>
                    
                    <div class="detalles-verificacion">
                        <div class="usuario-info-detalle" style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: #f8fafc; border-radius: 6px;">
                            ${verificacion.foto_perfil ? 
                                `<img src="${verificacion.foto_perfil}" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover;">` : 
                                '<div style="width: 64px; height: 64px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">👤</div>'
                            }
                            <div>
                                <h4 style="margin: 0 0 0.5rem 0;">${this.escaparHTML(verificacion.nombre)} ${this.escaparHTML(verificacion.apellido)}</h4>
                                <p style="margin: 0; color: #64748b;">${this.escaparHTML(verificacion.correo)}</p>
                            </div>
                        </div>

                        <div class="grid-detalles" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="detalle-item">
                                <label><strong>Tipo de Documento:</strong></label>
                                <p>${this.formatearTipoDocumento(verificacion.tipo_documento)}</p>
                            </div>
                            
                            <div class="detalle-item">
                                <label><strong>Número de Documento:</strong></label>
                                <p>${this.escaparHTML(verificacion.numero_documento)}</p>
                            </div>
                            
                            <div class="detalle-item">
                                <label><strong>Fecha de Solicitud:</strong></label>
                                <p>${this.formatearFecha(verificacion.fecha_solicitud)}</p>
                            </div>
                            
                            <div class="detalle-item">
                                <label><strong>Estado:</strong></label>
                                <p class="estado-${verificacion.estado}">${this.formatearEstado(verificacion.estado)}</p>
                            </div>
                        </div>

                        ${verificacion.biografia ? `
                            <div class="detalle-item" style="grid-column: 1 / -1;">
                                <label><strong>Biografía:</strong></label>
                                <p style="background: #f8fafc; padding: 1rem; border-radius: 4px; margin: 0;">${this.escaparHTML(verificacion.biografia)}</p>
                            </div>
                        ` : ''}

                        <div class="documentos" style="margin-top: 1.5rem;">
                            <h4>Documentos Subidos</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                                <div class="documento">
                                    <label><strong>Documento de Identidad:</strong></label>
                                    <div style="margin-top: 0.5rem;">
                                        <img src="/proyectoWeb/viajeros_peru${verificacion.documento_archivo}" 
                                            alt="Documento de identidad" 
                                            style="max-width: 100%; max-height: 200px; border: 1px solid #e2e8f0; border-radius: 4px; cursor: pointer;"
                                            onclick="window.open('/proyectoWeb/viajeros_peru${verificacion.documento_archivo}', '_blank')">

                                        <p style="font-size: 0.875rem; color: #64748b; margin-top: 0.25rem;">Haz clic para ver en tamaño completo</p>
                                    </div>
                                </div>
                                <div class="documento">
                                    <label><strong>Selfie:</strong></label>
                                    <div style="margin-top: 0.5rem;">
                                        <img src="/proyectoWeb/viajeros_peru${verificacion.selfie_archivo}" 
                                            alt="Selfie con documento" 
                                            style="max-width: 100%; max-height: 200px; border: 1px solid #e2e8f0; border-radius: 4px; cursor: pointer;"
                                            onclick="window.open('/proyectoWeb/viajeros_peru${verificacion.selfie_archivo}', '_blank')">

                                        <p style="font-size: 0.875rem; color: #64748b; margin-top: 0.25rem;">Haz clic para ver en tamaño completo</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        ${verificacion.notas_admin ? `
                            <div class="notas-admin" style="margin-top: 1.5rem; padding: 1rem; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px;">
                                <label><strong>Notas del Administrador:</strong></label>
                                <p style="margin: 0.5rem 0 0 0;">${this.escaparHTML(verificacion.notas_admin)}</p>
                            </div>
                        ` : ''}
                    </div>

                    <div class="modal-actions" style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                        <button onclick="this.closest('.modal-overlay').remove()" class="boton-secundario">Cerrar</button>
                        ${verificacion.estado === 'pendiente' ? `
                            <button onclick="panelAdmin.aprobarVerificacion(${verificacion.id}); this.closest('.modal-overlay').remove()" class="boton-accion-admin boton-aprobar">✅ Aprobar</button>
                            <button onclick="panelAdmin.rechazarVerificacion(${verificacion.id}); this.closest('.modal-overlay').remove()" class="boton-accion-admin boton-rechazar">❌ Rechazar</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    async aprobarVerificacion(verificacionId) {
        if (!confirm('¿Estás seguro de que quieres aprobar esta verificación?')) {
            return;
        }

        try {
            const token = localStorage.getItem('token_usuario');
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/admin_verificaciones.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'aprobar_verificacion',
                    verificacion_id: verificacionId,
                    token: token
                })
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                alert('✅ Verificación aprobada correctamente');
                this.cargarVerificaciones();
            } else {
                alert('❌ Error al aprobar verificación: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error aprobando verificación:', error);
            alert('❌ Error al aprobar verificación');
        }
    }

    async rechazarVerificacion(verificacionId) {
        const motivo = prompt('Ingresa el motivo del rechazo:');
        if (motivo === null) return; // Usuario canceló
        
        if (!motivo.trim()) {
            alert('Debes ingresar un motivo para el rechazo');
            return;
        }

        try {
            const token = localStorage.getItem('token_usuario');
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/admin_verificaciones.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'rechazar_verificacion',
                    verificacion_id: verificacionId,
                    notas_admin: motivo,
                    token: token
                })
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                alert('✅ Verificación rechazada correctamente');
                this.cargarVerificaciones();
            } else {
                alert('❌ Error al rechazar verificación: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error rechazando verificación:', error);
            alert('❌ Error al rechazar verificación');
        }
    }

    // Métodos auxiliares
    formatearTipoDocumento(tipo) {
        const tipos = {
            'dni': 'DNI',
            'pasaporte': 'Pasaporte',
            'carnet_extranjeria': 'Carné Extranjería'
        };
        return tipos[tipo] || tipo;
    }

    // Filtros
    filtrarUsuarios(termino) {
        if (!this.usuarios) return;

        const usuariosFiltrados = this.usuarios.filter(usuario => 
            usuario.nombre.toLowerCase().includes(termino.toLowerCase()) ||
            usuario.apellido.toLowerCase().includes(termino.toLowerCase()) ||
            usuario.correo.toLowerCase().includes(termino.toLowerCase()) ||
            usuario.rol.toLowerCase().includes(termino.toLowerCase())
        );

        this.mostrarUsuarios(usuariosFiltrados);
    }

    filtrarAnuncios(termino) {
        if (!this.anuncios) return;

        const anunciosFiltrados = this.anuncios.filter(anuncio => 
            anuncio.titulo.toLowerCase().includes(termino.toLowerCase()) ||
            anuncio.ubicacion.toLowerCase().includes(termino.toLowerCase()) ||
            anuncio.nombre.toLowerCase().includes(termino.toLowerCase()) ||
            anuncio.apellido.toLowerCase().includes(termino.toLowerCase())
        );

        this.mostrarAnuncios(anunciosFiltrados);
    }

    filtrarMensajes(termino) {
        if (!this.mensajes) return;

        const mensajesFiltrados = this.mensajes.filter(mensaje => 
            mensaje.contenido.toLowerCase().includes(termino.toLowerCase()) ||
            mensaje.remitente_nombre.toLowerCase().includes(termino.toLowerCase()) ||
            mensaje.destinatario_nombre.toLowerCase().includes(termino.toLowerCase())
        );

        this.mostrarMensajes(mensajesFiltrados);
    }

    filtrarReservas(estado) {
        if (!this.reservas) return;

        const reservasFiltradas = estado ? 
            this.reservas.filter(reserva => reserva.estado === estado) :
            this.reservas;

        this.mostrarReservas(reservasFiltradas);
    }

    // Utilidades
    formatearRol(rol) {
        const roles = {
            'viajero': '🧳 Viajero',
            'anfitrion': '🏠 Anfitrión',
            'administrador': '⚙️ Administrador'
        };
        return roles[rol] || rol;
    }

    formatearEstado(estado) {
        const estados = {
            'activo': '✅ Activo',
            'inactivo': '❌ Inactivo',
            'pendiente': '⏳ Pendiente',
            'verificado': '✅ Verificado',
            'rechazado': '❌ Rechazado',
            'aceptada': '✅ Aceptada',
            'rechazada': '❌ Rechazada',
            'cancelada': '🚫 Cancelada',
            'completada': '⭐ Completada',
            'no_verificado': '❌ No Verificado'
        };
        return estados[estado] || estado;
    }

    formatearFecha(fechaStr) {
        const fecha = new Date(fechaStr);
        return fecha.toLocaleDateString('es-PE');
    }

    escaparHTML(texto) {
        if (!texto) return '';
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    mostrarError(elementoId, mensaje) {
        const elemento = document.getElementById(elementoId);
        if (elemento) {
            elemento.innerHTML = `<tr><td colspan="7" class="error-carga">${mensaje}</td></tr>`;
        }
    }
}

function cerrarSesion() {
    localStorage.removeItem('token_usuario');
    localStorage.removeItem('datos_usuario');
    window.location.href = '../auth/iniciar_sesion.html';
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.panelAdmin = new PanelAdmin();
});