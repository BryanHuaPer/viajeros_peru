// Sistema de Mensajería para la página mensajes.html
class SistemaMensajes {
    constructor() {
        this.usuario = null;
        this.chatActivo = null;
        this.chats = [];
        this.mensajesCargados = [];
        this.paginaActual = 1;
        this.totalPaginas = 1;
        this.cargandoMas = false;

        this.intervaloActualizacion = null;
        this.ultimaActualizacion = null;
        this.ultimoMensajeId = null;
        this.inicializar();
        // Agregar al constructor:
        this.iniciarMonitorEstado();
    }

    inicializar() {
        // Inicializar sistema de mensajes
        this.verificarAutenticacion();
        this.cargarChats();
        this.configurarManejadores();
        this.iniciarSistemaNotificaciones();
    }

    verificarEstadoMensajes() {
        const contenedor = document.getElementById('mensajes-chat');
        if (contenedor) {
            const enDOM = contenedor.querySelectorAll('.mensaje-individual').length;
            
            if (enDOM !== this.mensajesCargados.length) {
                console.error('¡DESINCRONIZACIÓN DETECTADA!');
                this.mostrarMensajesChat(this.mensajesCargados, false);
            }
        }
    }

    // Llamar esta función cada 5 segundos cuando haya un chat activo
    iniciarMonitorEstado() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }
        
        this.monitorInterval = setInterval(() => {
            if (this.chatActivo && this.mensajesCargados.length > 0) {
                this.verificarEstadoMensajes();
            }
        }, 5000);
    }

    /**
     * Iniciar sistema de actualización automática de mensajes
     */
    iniciarActualizacionAutomatica() {
        // Limpiar intervalo anterior si existe
        if (this.intervaloActualizacion) {
            clearInterval(this.intervaloActualizacion);
        }
        
        // Verificar nuevos mensajes cada 5 segundos cuando hay chat activo
        this.intervaloActualizacion = setInterval(() => {
            this.verificarNuevosMensajes();
        }, 5000);
    }

    /**
     * Detener actualización automática
     */
    detenerActualizacionAutomatica() {
        if (this.intervaloActualizacion) {
            clearInterval(this.intervaloActualizacion);
            this.intervaloActualizacion = null;
        }
    }

    /**
     * Verificar si hay nuevos mensajes en el chat activo
     */
    async verificarNuevosMensajes() {
        // Solo verificar si hay un chat activo
        if (!this.chatActivo || !this.usuario) {
            return;
        }
        
        try {
            // Obtener los mensajes más recientes
            let url = `/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=obtener_conversacion&usuario1=${this.usuario.id}&usuario2=${this.chatActivo.id}&pagina=1&limite=1&solo_recientes=true`;
            
            if (this.chatActivo.anuncio_id) {
                url += `&anuncio_id=${this.chatActivo.anuncio_id}`;
            }
            
            const respuesta = await fetch(url);
            const resultado = await respuesta.json();
            
            if (resultado.exito && resultado.data && resultado.data.mensajes) {
                const mensajes = resultado.data.mensajes;
                
                if (mensajes.length > 0) {
                    const ultimoMensaje = mensajes[mensajes.length - 1];
                    const ultimoId = ultimoMensaje.id;
                    
                    // Si es un mensaje nuevo (diferente al último que tenemos)
                    if (!this.ultimoMensajeId || ultimoId > this.ultimoMensajeId) {
                        
                        // Verificar si el mensaje ya está en nuestra lista
                        const existe = this.mensajesCargados.some(m => m.id === ultimoId);
                        
                        if (!existe) {
                            console.log('📩 Nuevo mensaje detectado, actualizando...');
                            this.actualizarMensajesEnTiempoReal();
                        }
                        
                        this.ultimoMensajeId = ultimoId;
                    }
                }
            }
        } catch (error) {
            console.error('Error verificando nuevos mensajes:', error);
        }
    }

    /**
     * Actualizar mensajes en tiempo real (sin recargar toda la página)
     */
    async actualizarMensajesEnTiempoReal() {
        if (!this.chatActivo || !this.usuario) {
            return;
        }
        
        try {
            // Cargar solo los mensajes nuevos (últimos 20)
            let url = `/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=obtener_conversacion&usuario1=${this.usuario.id}&usuario2=${this.chatActivo.id}&pagina=1&limite=20&solo_nuevos=true`;
            
            if (this.chatActivo.anuncio_id) {
                url += `&anuncio_id=${this.chatActivo.anuncio_id}`;
            }
            
            const respuesta = await fetch(url);
            const resultado = await respuesta.json();
            
            if (resultado.exito && resultado.data && resultado.data.mensajes) {
                const nuevosMensajes = resultado.data.mensajes;
                
                if (nuevosMensajes.length > 0) {
                    // Filtrar mensajes que aún no tenemos
                    const idsExistentes = new Set(this.mensajesCargados.map(m => m.id));
                    const mensajesRealmenteNuevos = nuevosMensajes.filter(m => !idsExistentes.has(m.id));
                    
                    if (mensajesRealmenteNuevos.length > 0) {
                        // Agregar nuevos mensajes a nuestra lista
                        this.mensajesCargados.push(...mensajesRealmenteNuevos);
                        
                        // Ordenar por fecha (más antiguo primero)
                        this.mensajesCargados.sort((a, b) => 
                            new Date(a.fecha_creacion) - new Date(b.fecha_creacion)
                        );
                        
                        // Actualizar solo los mensajes nuevos en la UI
                        this.agregarMensajesNuevosUI(mensajesRealmenteNuevos);
                        
                        // Actualizar el último ID
                        this.ultimoMensajeId = Math.max(...this.mensajesCargados.map(m => m.id));
                        
                        // Actualizar lista de chats
                        this.cargarChats();
                        
                        // Actualizar estados
                        this.actualizarEstadosMensajes();
                        
                        // Marcar como leídos si el chat está activo
                        this.marcarMensajesLeidos(this.chatActivo.id, this.chatActivo.anuncio_id);
                        
                        console.log(`✅ ${mensajesRealmenteNuevos.length} mensaje(s) nuevo(s) agregado(s)`);
                    }
                }
            }
        } catch (error) {
            console.error('Error actualizando mensajes en tiempo real:', error);
        }
    }

    /**
     * Agregar solo los mensajes nuevos a la UI (sin recargar todo)
     */
    agregarMensajesNuevosUI(mensajesNuevos) {
        const contenedor = document.getElementById('mensajes-chat');
        if (!contenedor) return;
        
        // Determinar si debemos hacer scroll automático
        const estaEnElBottom = this.estaEnBottomDelChat();
        
        // Agregar cada mensaje nuevo
        mensajesNuevos.forEach(mensaje => {
            const esPropio = mensaje.remitente_id == this.usuario.id;
            const claseMensaje = esPropio ? 'mensaje-propio' : 'mensaje-recibido';
            
            // Obtener fecha para separador
            const fechaMensaje = new Date(mensaje.fecha_creacion);
            const fechaActual = fechaMensaje.toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            // Verificar si necesitamos agregar separador de fecha
            const ultimoSeparador = contenedor.querySelector('.separador-fecha:last-child');
            let necesitaSeparador = false;
            
            if (!ultimoSeparador) {
                necesitaSeparador = true;
            } else {
                const ultimaFecha = ultimoSeparador.textContent.trim();
                if (ultimaFecha !== fechaActual) {
                    necesitaSeparador = true;
                }
            }
            
            // Agregar separador si es necesario
            if (necesitaSeparador) {
                const separadorHTML = `<div class="separador-fecha"><span>${fechaActual}</span></div>`;
                contenedor.insertAdjacentHTML('beforeend', separadorHTML);
            }
            
            // HTML del avatar (solo para mensajes recibidos)
            let avatarHTML = '';
            if (!esPropio) {
                const fotoRemitente = mensaje.remitente_foto;
                const nombreRemitente = `${mensaje.remitente_nombre} ${mensaje.remitente_apellido}`;
                const inicialesRemitente = mensaje.remitente_nombre.charAt(0) + mensaje.remitente_apellido.charAt(0);
                
                if (fotoRemitente && fotoRemitente !== 'null') {
                    avatarHTML = `
                        <div class="avatar-mensaje">
                            <img src="${fotoRemitente}" alt="${nombreRemitente}"
                                onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'avatar-default-mini\\'>${inicialesRemitente}</div>';">
                        </div>
                    `;
                } else {
                    avatarHTML = `
                        <div class="avatar-mensaje">
                            <div class="avatar-default-mini">${inicialesRemitente}</div>
                        </div>
                    `;
                }
            }
            
            // Crear HTML del mensaje
            const mensajeHTML = `
                <div class="mensaje-individual ${claseMensaje}" data-mensaje-id="${mensaje.id}">
                    ${!esPropio ? avatarHTML : ''}
                    <div class="contenido-mensaje-individual">
                        ${!esPropio ? `<div class="nombre-remitente">${this.escaparHTML(mensaje.remitente_nombre + ' ' + mensaje.remitente_apellido)}</div>` : ''}
                        <p>${this.escaparHTML(mensaje.contenido)}</p>
                        <div class="info-mensaje">
                            <span class="hora-mensaje-individual">${this.formatearHora(mensaje.fecha_creacion)}</span>
                            ${esPropio ? `<span class="estado-mensaje" data-estado="${mensaje.estado || 'enviado'}">${this.obtenerIconoEstado(mensaje.estado)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            contenedor.insertAdjacentHTML('beforeend', mensajeHTML);
        });
        
        // Hacer scroll al final si el usuario ya estaba abajo
        if (estaEnElBottom) {
            setTimeout(() => {
                contenedor.scrollTop = contenedor.scrollHeight;
            }, 100);
        }
    }

    /**
     * Verificar si el usuario está en la parte inferior del chat
     */
    estaEnBottomDelChat() {
        const contenedor = document.getElementById('mensajes-chat');
        if (!contenedor) return true;
        
        const scrollActual = contenedor.scrollTop + contenedor.clientHeight;
        const alturaTotal = contenedor.scrollHeight;
        
        // Considerar que está en el bottom si está a 100px del final
        return (alturaTotal - scrollActual) <= 100;
    }

    validarContenidoFrontend(contenido) {
        // 1. Validar longitud
        const contenidoTrim = contenido.trim();
        if (contenidoTrim.length < 1) {
            throw new Error('El mensaje no puede estar vacío');
        }
        
        if (contenido.length > 2000) {
            throw new Error('El mensaje no puede exceder 2000 caracteres');
        }
        
        // 2. Patrones peligrosos (XSS básico)
        const patronesPeligrosos = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /onclick\s*=/gi,
            /onload\s*=/gi,
            /onerror\s*=/gi,
            /data:text\/html/gi,
            /eval\s*\(/gi
        ];
        
        for (let patron of patronesPeligrosos) {
            if (patron.test(contenido)) {
                throw new Error('El mensaje contiene código no permitido');
            }
        }
        
        // 3. Validar exceso de mayúsculas
        const letras = contenido.replace(/[^a-zA-Z]/g, '');
        if (letras.length > 10) {
            const mayusculas = (contenido.match(/[A-Z]/g) || []).length;
            const porcentajeMayusculas = (mayusculas / letras.length) * 100;
            
            if (porcentajeMayusculas > 80) {
                throw new Error('Por favor evita escribir solo en mayúsculas');
            }
        }
        
        // 4. Validar repetición excesiva
        if (/(.)\1{10,}/.test(contenido)) {
            throw new Error('El mensaje contiene repeticiones excesivas');
        }
        
        return contenidoTrim;
    }

    verificarAutenticacion() {
        const datosUsuario = localStorage.getItem('datos_usuario');
        
        if (datosUsuario) {
            try {
                this.usuario = JSON.parse(datosUsuario);
                this.actualizarInterfazUsuario();
            } catch (error) {
                console.error('Error parseando usuario:', error);
                window.location.href = '../auth/iniciar_sesion.html';
            }
        } else {
            window.location.href = '../auth/iniciar_sesion.html';
        }
    }

    actualizarInterfazUsuario() {
        const rolTexto = this.usuario.rol === 'viajero' ? 'Viajero' : 
                       this.usuario.rol === 'anfitrion' ? 'Anfitrión' : 'Usuario';
        document.getElementById('badge-rol').textContent = rolTexto;
    }

    /**
     * Sincronizar estados periódicamente (cada 10 segundos)
     */
    iniciarSincronizacionEstados() {
        // Limpiar intervalo anterior si existe
        if (this.intervaloSincronizacion) {
            clearInterval(this.intervaloSincronizacion);
        }
        
        // Sincronizar estados cada 10 segundos
        this.intervaloSincronizacion = setInterval(() => {
            if (this.chatActivo) {
                this.verificarEstadosMensajes();
            }
        }, 10000);
    }

    detenerSincronizacionEstados() {
        if (this.intervaloSincronizacion) {
            clearInterval(this.intervaloSincronizacion);
            this.intervaloSincronizacion = null;
        }
    }

    async cargarChats() {
        try {
            const token = localStorage.getItem('token_usuario');
            if (!token) {
                console.error('❌ No hay token disponible');
                this.mostrarError('Sesión expirada. Por favor inicia sesión nuevamente.');
                return;
            }
            
            // URL con token en query string
            const url = `/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=obtener_chats&usuario_id=${this.usuario.id}&token=${encodeURIComponent(token)}`;
            
            console.log('📡 Cargando chats - URL:', url);
            
            // Intentar primero SIN header Authorization
            const respuesta = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                }
            });
            
            console.log('📡 Status cargarChats:', respuesta.status);
            
            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }
            
            const resultadoTexto = await respuesta.text();
            console.log('📨 Respuesta cargarChats:', resultadoTexto.substring(0, 200) + '...');
            
            try {
                const resultado = JSON.parse(resultadoTexto);
                
                if (resultado.exito) {
                    this.chats = resultado.chats;
                    this.mostrarChats(this.chats);
                } else {
                    this.mostrarError('Error cargando chats: ' + resultado.error);
                }
            } catch (e) {
                console.error('Error parseando JSON:', e);
                console.error('Respuesta completa:', resultadoTexto);
                this.mostrarError('Error al cargar las conversaciones (respuesta inválida)');
            }
        } catch (error) {
            console.error('Error cargando chats:', error);
            this.mostrarError('Error al cargar las conversaciones');
        }
    }

    // Agregar este método al SistemaMensajes
    agruparChatsPorUsuario(chats) {
        const grupos = {};
        
        chats.forEach(chat => {
            const usuarioId = chat.otro_usuario_id;
            
            if (!grupos[usuarioId]) {
                grupos[usuarioId] = {
                    usuario_id: usuarioId,
                    nombre: chat.nombre,
                    apellido: chat.apellido,
                    foto_perfil: chat.foto_perfil,
                    chats: [],
                    total_no_leidos: 0,
                    ultima_fecha: null
                };
            }
            
            // Agregar este chat individual al grupo
            grupos[usuarioId].chats.push(chat);
            
            // Sumar mensajes no leídos
            grupos[usuarioId].total_no_leidos += chat.no_leidos || 0;
            
            // Mantener la fecha más reciente
            if (!grupos[usuarioId].ultima_fecha || 
                new Date(chat.ultima_fecha) > new Date(grupos[usuarioId].ultima_fecha)) {
                grupos[usuarioId].ultima_fecha = chat.ultima_fecha;
            }
        });
        
        return Object.values(grupos);
    }

    mostrarChats(chats) {
        const contenedor = document.getElementById('lista-chats');
        
        if (!chats || chats.length === 0) {
            contenedor.innerHTML = `
                <div class="sin-chats">
                    <p>📭 No tienes conversaciones</p>
                    <p class="texto-secundario">Inicia una conversación desde un anuncio</p>
                </div>
            `;
            return;
        }

        // Agrupar chats por usuario
        const chatsAgrupados = this.agruparChatsPorUsuario(chats);
        
        const html = chatsAgrupados.map(grupo => {
            const totalNoLeidos = grupo.total_no_leidos || 0;
            const tieneMultiplesChats = grupo.chats.length > 1;
            
            // Obtener el último mensaje del chat más reciente
            const ultimoChat = grupo.chats.reduce((prev, current) => 
                new Date(current.ultima_fecha) > new Date(prev.ultima_fecha) ? current : prev
            );
            
            let textoMensaje = this.escaparHTML(ultimoChat.ultimo_mensaje.substring(0, 60));
            if (ultimoChat.ultimo_mensaje.length > 60) textoMensaje += '...';
            
            const prefijoMensaje = ultimoChat.es_remitente == 1 ? '<span class="tu-prefijo">Tú: </span>' : '';
            
            // CORRECCIÓN: Badge de múltiples chats con mejor posicionamiento
            const badgeMultiples = tieneMultiplesChats ? 
                `<span class="badge-multiples" title="${grupo.chats.length} conversaciones">+${grupo.chats.length}</span>` : '';
            
            // Clases CSS
            const claseChat = totalNoLeidos > 0 ? 'chat-con-nuevos' : '';
            const claseMensaje = totalNoLeidos > 0 && ultimoChat.es_remitente == 0 ? 
                'ultimo-mensaje-no-leido' : 'ultimo-mensaje';
            
            // Crear avatar
            let avatarHTML = '';
            const iniciales = (grupo.nombre?.charAt(0) || '') + (grupo.apellido?.charAt(0) || '');
            
            if (grupo.foto_perfil && grupo.foto_perfil !== 'null' && grupo.foto_perfil !== '') {
                avatarHTML = `
                    <div class="avatar-chat ${totalNoLeidos > 0 ? 'avatar-con-notificacion' : ''}">
                        <img src="${grupo.foto_perfil}" 
                            alt="${this.escaparHTML(grupo.nombre || '')} ${this.escaparHTML(grupo.apellido || '')}"
                            onerror="this.onerror=null; this.style.display='none'; const nextSibling = this.nextElementSibling; if (nextSibling && nextSibling.classList.contains('avatar-default')) { nextSibling.style.display = 'flex'; }">
                        <div class="avatar-default" style="display: none;">${iniciales}</div>
                    </div>
                `;
            } else {
                avatarHTML = `
                    <div class="avatar-chat ${totalNoLeidos > 0 ? 'avatar-con-notificacion' : ''}">
                        <div class="avatar-default">${iniciales}</div>
                    </div>
                `;
            }
            
            // CORRECCIÓN: Estructura mejorada con contenedor flexible para el nombre
            return `
            <div class="item-chat ${claseChat}" 
                data-usuario-id="${grupo.usuario_id}"
                data-grupo="true"
                onclick="sistemaMensajes.expandirGrupoChat(${grupo.usuario_id})">
                ${avatarHTML}
                <div class="info-chat">
                    <div class="cabecera-chat">
                        <div class="nombre-contenedor">
                            <strong class="${totalNoLeidos > 0 ? 'nombre-usuario-no-leido' : ''}">
                                ${this.escaparHTML(grupo.nombre || '')} ${this.escaparHTML(grupo.apellido || '')}
                            </strong>
                            ${badgeMultiples}
                        </div>
                        <span class="fecha-chat ${totalNoLeidos > 0 ? 'fecha-chat-nuevo' : ''}">
                            ${this.formatearFechaRelativa(grupo.ultima_fecha)}
                        </span>
                    </div>
                    <p class="${claseMensaje}">
                        ${prefijoMensaje}${textoMensaje}
                    </p>
                    ${tieneMultiplesChats ? 
                        `<span class="badge-multiples-info">${grupo.chats.length} conversación(es)</span>` : 
                        ''}
                </div>
                ${totalNoLeidos > 0 ? `
                    <span class="contador-no-leidos" title="${totalNoLeidos} mensaje(s) nuevo(s)">
                        ${totalNoLeidos > 99 ? '99+' : totalNoLeidos}
                    </span>
                ` : ''}
            </div>
            `;
        }).join('');
        
        contenedor.innerHTML = html;
    }

    // Método para expandir un grupo de chats
    expandirGrupoChat(usuarioId) {
        const grupoChat = this.chats.filter(chat => chat.otro_usuario_id == usuarioId);
        
        if (grupoChat.length === 1) {
            // Solo hay un chat, abrirlo directamente
            const chat = grupoChat[0];
            this.abrirChat(chat.otro_usuario_id, `${chat.nombre} ${chat.apellido}`, chat.anuncio_id);
            return;
        }
        
        // Mostrar modal con todos los chats del usuario
        this.mostrarModalChatsUsuario(usuarioId, grupoChat);
    }

    // Método para mostrar modal con todos los chats de un usuario
    mostrarModalChatsUsuario(usuarioId, chats) {
        const usuario = chats[0];
        const modalHTML = `
            <div class="modal-grupo-chats" id="modal-grupo-chats">
                <div class="modal-contenido" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>💬 Conversaciones con ${usuario.nombre} ${usuario.apellido}</h3>
                        <button class="cerrar-modal" onclick="cerrarModalGrupo()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="lista-chats-detalle">
                            ${chats.map((chat, index) => {
                                // Acortar título del anuncio si es muy largo
                                const tituloAnuncio = chat.anuncio_titulo || 'Conversación general';
                                const tituloCorto = tituloAnuncio.length > 40 ? 
                                    tituloAnuncio.substring(0, 40) + '...' : tituloAnuncio;
                                
                                return `
                                <div class="item-chat-detalle ${chat.no_leidos > 0 ? 'con-nuevos' : ''}" 
                                    onclick="sistemaMensajes.abrirChatDesdeModal(
                                        ${chat.otro_usuario_id}, 
                                        '${this.escaparHTML(usuario.nombre || '')} ${this.escaparHTML(usuario.apellido || '')}', 
                                        ${chat.anuncio_id || 'null'},
                                        '${this.escaparHTML(chat.anuncio_titulo || '')}'
                                    )"
                                    title="${chat.anuncio_titulo ? this.escaparHTML(chat.anuncio_titulo) : 'Conversación general'}">
                                    <div class="info-chat-detalle">
                                        <div class="cabecera-chat-detalle">
                                            <div class="titulo-contenedor">
                                                <strong>${this.escaparHTML(tituloCorto)}</strong>
                                            </div>
                                            <div class="fecha-contenedor">
                                                <span class="fecha">${this.formatearFechaRelativa(chat.ultima_fecha)}</span>
                                                ${chat.no_leidos > 0 ? `
                                                    <span class="contador-chat-detalle" title="${chat.no_leidos} mensaje(s) nuevo(s)">
                                                        ${chat.no_leidos > 99 ? '99+' : chat.no_leidos}
                                                    </span>
                                                ` : ''}
                                            </div>
                                        </div>
                                        <p class="ultimo-mensaje-detalle">
                                            ${chat.es_remitente == 1 ? '<span class="tu-prefijo">Tú: </span>' : ''}
                                            ${this.escaparHTML(chat.ultimo_mensaje.substring(0, 80))}
                                            ${chat.ultimo_mensaje.length > 80 ? '...' : ''}
                                        </p>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <p class="texto-ayuda">
                            💡 Selecciona una conversación para continuar el diálogo.
                            Para iniciar un nuevo chat sobre un anuncio específico, 
                            ve al anuncio y usa el botón "Contactar".
                        </p>
                        <button class="boton-principal" onclick="cerrarModalGrupo()">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
            <style>
                .modal-grupo-chats {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .modal-contenido {
                    background: white;
                    border-radius: 12px;
                    width: 90%;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.5rem;
                    border-bottom: 1px solid #e2e8f0;
                }
                .modal-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    color: #2d3748;
                }
                .cerrar-modal {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    padding: 0.5rem;
                    color: #718096;
                    transition: color 0.2s;
                }
                .cerrar-modal:hover {
                    color: #2d3748;
                }
                .modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1rem;
                }
                .modal-footer {
                    padding: 1.5rem;
                    border-top: 1px solid #e2e8f0;
                    text-align: center;
                }
                .texto-ayuda {
                    font-size: 0.85rem;
                    color: #718096;
                    margin-bottom: 1rem;
                    line-height: 1.4;
                    text-align: left;
                    padding: 0.75rem;
                    background: #f7fafc;
                    border-radius: 8px;
                    border-left: 3px solid #4299e1;
                }
                
                /* CORRECCIÓN: Estructura fija para items de chat detalle */
                .item-chat-detalle {
                    display: flex;
                    padding: 1rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    margin-bottom: 0.75rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    background: white;
                    min-width: 0; /* Permite compresión */
                }
                .item-chat-detalle:hover {
                    background: #f7fafc;
                    border-color: #cbd5e0;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                }
                .item-chat-detalle.con-nuevos {
                    background: #f0f9ff;
                    border-left: 3px solid #4299e1;
                }
                .info-chat-detalle {
                    flex: 1;
                    min-width: 0; /* Permite compresión */
                }
                
                /* CORRECCIÓN: Layout fijo con flexbox */
                .cabecera-chat-detalle {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 0.5rem;
                    gap: 1rem;
                    min-width: 0;
                }
                
                /* CORRECCIÓN: Contenedor de título con ancho máximo */
                .titulo-contenedor {
                    flex: 1;
                    min-width: 0; /* Permite compresión */
                    margin-right: 1rem;
                }
                
                .titulo-contenedor strong {
                    font-size: 0.9rem;
                    color: #2d3748;
                    font-weight: 600;
                    display: block;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    line-height: 1.3;
                }
                
                /* CORRECCIÓN: Contenedor de fecha y contador fijo a la derecha */
                .fecha-contenedor {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 0.25rem;
                    flex-shrink: 0; /* No se encoje */
                }
                
                .fecha-contenedor .fecha {
                    font-size: 0.75rem;
                    color: #718096;
                    white-space: nowrap;
                    line-height: 1;
                }
                
                /* CORRECCIÓN: Contador siempre en misma posición */
                .contador-chat-detalle {
                    background: #4299e1;
                    color: white;
                    font-size: 0.75rem;
                    font-weight: 600;
                    min-width: 22px;
                    height: 22px;
                    border-radius: 11px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 6px;
                    animation: pulse 2s infinite;
                    box-shadow: 0 2px 4px rgba(66, 153, 225, 0.3);
                    line-height: 1;
                }
                
                /* CORRECCIÓN: Último mensaje con layout consistente */
                .ultimo-mensaje-detalle {
                    font-size: 0.85rem;
                    color: #718096;
                    margin: 0;
                    line-height: 1.4;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    word-break: break-word;
                }
                
                .tu-prefijo {
                    color: #718096;
                    font-weight: 500;
                }
                
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
                
                /* CORRECCIÓN: Para pantallas pequeñas */
                @media (max-width: 480px) {
                    .cabecera-chat-detalle {
                        flex-direction: column;
                        gap: 0.5rem;
                    }
                    
                    .titulo-contenedor {
                        margin-right: 0;
                        width: 100%;
                    }
                    
                    .fecha-contenedor {
                        flex-direction: row;
                        justify-content: space-between;
                        width: 100%;
                        align-items: center;
                    }
                    
                    .titulo-contenedor strong {
                        font-size: 0.85rem;
                    }
                }
            </style>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Método para abrir chat desde el modal
    abrirChatDesdeModal(usuarioId, nombreUsuario, anuncioId, anuncioTitulo = null) {
        cerrarModalGrupo();
        setTimeout(() => {
            this.abrirChat(usuarioId, nombreUsuario, anuncioId === 'null' ? null : anuncioId, anuncioTitulo);
        }, 300);
    }

    actualizarFotoChat(fotoPerfil, nombreUsuario) {
    
    const contenedorFoto = document.getElementById('foto-usuario-chat');
    if (!contenedorFoto) return;
    
    let fotoHTML = '';
    const nombreArray = nombreUsuario.split(' ');
    const iniciales = (nombreArray[0]?.charAt(0) || '') + (nombreArray[1]?.charAt(0) || nombreArray[0]?.charAt(1) || '');
    
    if (fotoPerfil && fotoPerfil !== 'null' && fotoPerfil !== '') {
        
        fotoHTML = `
            <img src="${fotoPerfil}" 
                alt="${this.escaparHTML(nombreUsuario)}"
                onerror="console.error('Error cargando imagen:', this.src); this.style.display='none'; const nextSibling = this.nextElementSibling; if (nextSibling && nextSibling.classList.contains('avatar-default')) { nextSibling.style.display = 'flex'; }">
            <div class="avatar-default" style="display: none;">${iniciales}</div>
        `;
    } else {
        fotoHTML = `<div class="avatar-default">${iniciales}</div>`;
    }
    
    contenedorFoto.innerHTML = fotoHTML;
}

    //  Método para mostrar información de conversación
    actualizarInfoConversacion(anuncioId, anuncioTitulo) {
        // Actualizar ambas vistas (desktop y mobile)
        this.actualizarInfoConversacionDesktop(anuncioId, anuncioTitulo);
        this.actualizarInfoConversacionMobile(anuncioId, anuncioTitulo);
    }

    actualizarInfoConversacionDesktop(anuncioId, anuncioTitulo) {
        const infoContainer = document.getElementById('info-conversacion-desktop');
        if (!infoContainer) return;
        
        this.llenarInfoConversacion(infoContainer, anuncioId, anuncioTitulo);
    }

    actualizarInfoConversacionMobile(anuncioId, anuncioTitulo) {
        const infoContainer = document.getElementById('info-conversacion-mobile');
        if (!infoContainer) return;
        
        this.llenarInfoConversacion(infoContainer, anuncioId, anuncioTitulo);
    }

    llenarInfoConversacion(container, anuncioId, anuncioTitulo) {
        if (anuncioId && anuncioTitulo && anuncioTitulo !== 'null') {
            // Acortar título si es muy largo
            const tituloCorto = anuncioTitulo.length > 30 ? 
                anuncioTitulo.substring(0, 30) + '...' : anuncioTitulo;
            
            container.innerHTML = `
                <div class="info-conversacion-contenido" title="${this.escaparHTML(anuncioTitulo)}">
                    <span class="badge-conversacion" title="Sobre anuncio específico"></span>
                    <span class="titulo-conversacion">
                        ${this.escaparHTML(tituloCorto)}
                    </span>
                    <a href="/proyectoWeb/viajeros_peru/app/vistas/anuncios/detalle_anuncio.html?id=${anuncioId}" 
                    class="ver-anuncio-link" 
                    title="Ver anuncio completo"
                    target="_blank">↗️</a>
                </div>
            `;
            container.style.display = 'block';
        } else {
            container.innerHTML = `
                <div class="info-conversacion-contenido" title="Conversación general">
                    <span class="badge-conversacion" title="Conversación general">💬</span>
                    <span class="titulo-conversacion">Conversación general</span>
                </div>
            `;
            container.style.display = 'block';
        }
    }

    //método abrirChat
    async abrirChat(usuarioId, nombreUsuario, anuncioId = null, anuncioTitulo = null) {
        let fotoPerfil = null;
        
        // 🔍 BUSCAR FOTO EN DIFERENTES LUGARES
        // 1. Primero en el item de chat principal (si existe)
        let itemChat = document.querySelector(`.item-chat[data-usuario-id="${usuarioId}"]`);
        
        if (itemChat) {
            fotoPerfil = itemChat.getAttribute('data-foto-perfil');
        }
        
        // 2. Si no, buscar en los chats agrupados
        if (!fotoPerfil || fotoPerfil === '' || fotoPerfil === 'null') {
            const grupo = this.chatsAgrupados?.find(g => g.usuario_id == usuarioId);
            if (grupo && grupo.foto_perfil && grupo.foto_perfil !== 'null') {
                fotoPerfil = grupo.foto_perfil;
            }
        }
        
        // 3. Si aún no hay foto, buscar en la lista original de chats
        if (!fotoPerfil || fotoPerfil === '' || fotoPerfil === 'null') {
            const chatOriginal = this.chats.find(c => c.otro_usuario_id == usuarioId);
            if (chatOriginal && chatOriginal.foto_perfil && chatOriginal.foto_perfil !== 'null') {
                fotoPerfil = chatOriginal.foto_perfil;
            }
        }
        
        // Limpiar si es "null" string
        if (fotoPerfil === 'null') {
            fotoPerfil = null;
        }
        
        this.chatActivo = { 
            id: usuarioId, 
            nombre: nombreUsuario, 
            anuncio_id: anuncioId,
            anuncio_titulo: anuncioTitulo, 
            foto_perfil: fotoPerfil
        };
        
        // Resetear estado de paginación
        this.mensajesCargados = [];
        this.paginaActual = 1;
        this.totalPaginas = 1;
        this.ultimoMensajeId = null;
        
        // Manejar vista mobile/desktop
        this.manejarVistaMobile(true);
        
        // Actualizar nombre en el chat
        const nombreDesktop = document.getElementById('nombre-chat-activo');
        const nombreMobile = document.getElementById('nombre-chat-activo-mobile');
        
        if (nombreDesktop) nombreDesktop.textContent = nombreUsuario;
        if (nombreMobile) nombreMobile.textContent = nombreUsuario;
        
        // Actualizar foto en el chat
        this.actualizarFotoChat(fotoPerfil, nombreUsuario);
        this.actualizarFotoChatMobile(fotoPerfil, nombreUsuario);
        
        // Actualizar información de la conversación
        this.actualizarInfoConversacion(anuncioId, anuncioTitulo);
        
        // Actualizar clase activa en la lista de chats
        this.actualizarChatActivoEnLista(usuarioId, anuncioId);
        
        // Cargar mensajes
        await this.cargarMensajesChat(usuarioId);

        // Iniciar actualización automática
        this.iniciarActualizacionAutomatica();

        // Marcar mensajes como leídos
        await this.marcarMensajesLeidos(usuarioId, anuncioId);
        
        // Marcar mis mensajes como vistos por el otro usuario
        await this.marcarMensajesComoVistos(usuarioId, anuncioId);

        // Actualizar estados de mis mensajes
        await this.actualizarEstadosMensajes();

        // Actualizar estado de bloqueo
        await this.actualizarEstadoBloqueoChat(usuarioId);

        // Actualizar lista de chats
        setTimeout(() => {
            this.cargarChats();
        }, 500);
        
        // Iniciar intervalo para verificar estados periódicamente
        this.iniciarVerificacionEstados();

        // Iniciar sincronización periódica de estados
        this.iniciarSincronizacionEstados();
        
        // Enfocar el input del mensaje
        setTimeout(() => {
            document.getElementById('input-mensaje').focus();
        }, 300);
    }

    // Agrega este método nuevo para actualizar la clase activa en la lista
    actualizarChatActivoEnLista(usuarioId, anuncioId = null) {
        // Remover clase activa de todos los chats
        document.querySelectorAll('.item-chat').forEach(item => {
            item.classList.remove('activo');
        });
        
        // **BUSCAR DE FORMA MÁS FLEXIBLE**
        let chatActivoElement = null;
        
        document.querySelectorAll('.item-chat').forEach(item => {
            const itemUsuarioId = parseInt(item.getAttribute('data-usuario-id'));
            
            // Solo comparar usuarioId cuando viene de un grupo
            if (item.hasAttribute('data-grupo')) {
                if (itemUsuarioId === usuarioId) {
                    chatActivoElement = item;
                }
            } else {
                // Buscar específico por anuncio (comportamiento original)
                const itemAnuncioIdAttr = item.getAttribute('data-anuncio-id');
                const itemAnuncioId = itemAnuncioIdAttr === '' ? null : 
                                    (itemAnuncioIdAttr !== null ? parseInt(itemAnuncioIdAttr) : null);
                
                const mismoUsuario = itemUsuarioId === usuarioId;
                let mismoAnuncio = false;
                
                if (anuncioId === null && itemAnuncioId === null) {
                    mismoAnuncio = true;
                } else if (anuncioId !== null && itemAnuncioId !== null) {
                    mismoAnuncio = anuncioId === itemAnuncioId;
                }
                
                if (mismoUsuario && mismoAnuncio) {
                    chatActivoElement = item;
                }
            }
        });
        
        // Agregar clase activa al chat encontrado
        if (chatActivoElement) {
            chatActivoElement.classList.add('activo');
            chatActivoElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            console.warn(`[WARN] No se encontró chat visual para usuarioId=${usuarioId}, anuncioId=${anuncioId}`);
            
            // Intentar marcar el primer chat del usuario
            const fallbackElement = document.querySelector(`.item-chat[data-usuario-id="${usuarioId}"]`);
            if (fallbackElement) {
                fallbackElement.classList.add('activo');
            }
        }
    }
    iniciarVerificacionEstados() {
        // Limpiar intervalo anterior si existe
        if (this.intervaloEstados) {
            clearInterval(this.intervaloEstados);
        }
        
        // Verificar estados cada 5 segundos
        this.intervaloEstados = setInterval(() => {
            this.verificarEstadosMensajes();
        }, 5000);
    }

    detenerVerificacionEstados() {
        if (this.intervaloEstados) {
            clearInterval(this.intervaloEstados);
            this.intervaloEstados = null;
        }
    }

    async cargarMensajesChat(usuarioId, cargarMas = false) {
    
    if (this.cargandoMas && cargarMas) return;
    
    if (cargarMas) {
        this.cargandoMas = true;
        this.agregarIndicadorCarga();
    }
    
    try {
        const pagina = cargarMas ? this.paginaActual + 1 : 1;
        
        let url = `/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=obtener_conversacion&usuario1=${this.usuario.id}&usuario2=${usuarioId}&pagina=${pagina}&limite=20`;
        
        // Siempre enviar anuncio_id, incluso si es null
        if (this.chatActivo) {
            url += `&anuncio_id=${this.chatActivo.anuncio_id !== null ? this.chatActivo.anuncio_id : 'null'}`;
        }
        
        const respuesta = await fetch(url);
        const resultado = await respuesta.json();

        if (resultado.exito && resultado.data) {
            const nuevosMensajes = resultado.data.mensajes || [];
            const paginacion = resultado.data.paginacion || {};
            
            
            // Manejar correctamente según el tipo de carga**
            if (cargarMas) {
                // Cargar más mensajes antiguos
                // Evitar duplicados
                const idsExistentes = new Set(this.mensajesCargados.map(m => m.id));
                const mensajesUnicos = nuevosMensajes.filter(m => !idsExistentes.has(m.id));
                
                // Ordenar correctamente: más antiguos al principio
                this.mensajesCargados = [...mensajesUnicos, ...this.mensajesCargados]
                    .sort((a, b) => new Date(a.fecha_creacion) - new Date(b.fecha_creacion));
                
                this.paginaActual = pagina;
                
            } else {
                // Ordenar mensajes por fecha (más antiguo primero)
                this.mensajesCargados = nuevosMensajes.sort((a, b) => 
                    new Date(a.fecha_creacion) - new Date(b.fecha_creacion)
                );
                this.paginaActual = 1;
            }
            
            this.totalPaginas = paginacion.total_paginas || 1;
            
            this.mostrarMensajesChat(this.mensajesCargados, cargarMas);
            
            // Configurar scroll infinito
            if (!cargarMas && this.totalPaginas > 1) {
                setTimeout(() => {
                    this.configurarScrollInfinito();
                }, 500);
            } else if (cargarMas && this.paginaActual < this.totalPaginas) {
                setTimeout(() => {
                    this.configurarScrollInfinito();
                }, 300);
            }
            
            // Actualizar estados
            await this.actualizarEstadosMensajes();
            
        } else {
            console.error('[ERROR] Respuesta del servidor:', resultado);
        }
    } catch (error) {
        console.error('Error cargando mensajes:', error);
    } finally {
        if (cargarMas) {
            this.cargandoMas = false;
            this.removerIndicadorCarga();
        }
    }
}

    /**
     * Mostrar los mensajes de un chat con fotos de perfil
     */
    mostrarMensajesChat(mensajes, cargarMas = false) {
        const contenedor = document.getElementById('mensajes-chat');
        if (!contenedor) return;

        if (!cargarMas) {
            // Primera carga - limpiar contenedor completamente
            contenedor.innerHTML = `
                <div class="mensaje-sistema">
                    💡 Esta conversación está protegida. Comunícate solo a través de esta plataforma.
                </div>
                ${mensajes.length === 0 ? '<div class="sin-mensajes">No hay mensajes todavía</div>' : ''}
            `;
        }

        if (mensajes.length > 0) {
            // Construir HTML de todos los mensajes
            let htmlMensajes = '';
            let fechaAnterior = null;
            
            mensajes.forEach(mensaje => {
                const fechaMensaje = new Date(mensaje.fecha_creacion);
                const fechaActual = fechaMensaje.toLocaleDateString('es-ES', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
                // Agregar separador si cambió la fecha
                if (fechaActual !== fechaAnterior) {
                    htmlMensajes += `<div class="separador-fecha"><span>${fechaActual}</span></div>`;
                    fechaAnterior = fechaActual;
                }
                
                const esPropio = mensaje.remitente_id == this.usuario.id;
                const claseMensaje = esPropio ? 'mensaje-propio' : 'mensaje-recibido';
                
                // Determinar la foto del remitente
                const fotoRemitente = mensaje.remitente_foto;
                const nombreRemitente = `${mensaje.remitente_nombre} ${mensaje.remitente_apellido}`;
                const inicialesRemitente = mensaje.remitente_nombre.charAt(0) + mensaje.remitente_apellido.charAt(0);
                
                // HTML del avatar del remitente (solo para mensajes recibidos)
                let avatarHTML = '';
                if (!esPropio) {
                    if (fotoRemitente) {
                        avatarHTML = `
                            <div class="avatar-mensaje">
                                <img src="${fotoRemitente}" alt="${nombreRemitente}"
                                    onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'avatar-default-mini\\'>${inicialesRemitente}</div>';">
                            </div>
                        `;
                    } else {
                        avatarHTML = `
                            <div class="avatar-mensaje">
                                <div class="avatar-default-mini">${inicialesRemitente}</div>
                            </div>
                        `;
                    }
                }
                
                htmlMensajes += `
                <div class="mensaje-individual ${claseMensaje}" data-mensaje-id="${mensaje.id}">
                    ${!esPropio ? avatarHTML : ''}
                    <div class="contenido-mensaje-individual">
                        ${!esPropio ? `<div class="nombre-remitente">${this.escaparHTML(nombreRemitente)}</div>` : ''}
                        <p>${this.escaparHTML(mensaje.contenido)}</p>
                        <div class="info-mensaje">
                            <span class="hora-mensaje-individual">${this.formatearHora(mensaje.fecha_creacion)}</span>
                            ${esPropio ? `<span class="estado-mensaje" data-estado="${mensaje.estado || 'enviado'}">${this.obtenerIconoEstado(mensaje.estado)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
            });
            
            if (cargarMas) {
                // Cargar más mensajes - reconstruir todo el contenido
                // Guardar scroll antes para mantener posición relativa
                const scrollAntes = contenedor.scrollTop;
                const alturaAntes = contenedor.scrollHeight;
                
                // Limpiar pero mantener el mensaje sistema
                const mensajeSistema = contenedor.querySelector('.mensaje-sistema');
                if (mensajeSistema) {
                    mensajeSistema.nextSibling?.remove();
                    // Remover todos los hermanos del mensaje-sistema
                    let siguiente = mensajeSistema.nextSibling;
                    while (siguiente) {
                        const temp = siguiente;
                        siguiente = siguiente.nextSibling;
                        temp.remove();
                    }
                    // Insertar nuevos mensajes después del mensaje-sistema
                    mensajeSistema.insertAdjacentHTML('afterend', htmlMensajes);
                } else {
                    // Si no hay mensaje-sistema, reemplazar todo
                    contenedor.innerHTML = `<div class="mensaje-sistema">💡 Esta conversación está protegida. Comunícate solo a través de esta plataforma.</div>${htmlMensajes}`;
                }
                
                // Ajustar scroll para mantener la posición del usuario
                const alturaDespues = contenedor.scrollHeight;
                const diferencia = alturaDespues - alturaAntes;
                contenedor.scrollTop = scrollAntes + diferencia;
            } else {
                // Primera carga - insertar al final
                contenedor.insertAdjacentHTML('beforeend', htmlMensajes);
                // Scroll al final
                setTimeout(() => {
                    contenedor.scrollTop = contenedor.scrollHeight;
                }, 100);
            }
        }
    }
    obtenerIconoEstado(estado) {
        // Limpiar estado: si es null, undefined, vacío o 'null' string, usar 'enviado' por defecto
        const estadoLimpio = (estado && estado !== 'null' && estado.trim()) ? estado.trim() : 'enviado';
        
        switch(estadoLimpio) {
            case 'enviado': return '✓';
            case 'entregado': return '✓✓';
            case 'visto': return '✓✓';
            default: return '✓'; // Fallback a 'enviado' en lugar de '↗️'
        }
    }
    configurarScrollInfinito() {
        const contenedor = document.getElementById('mensajes-chat');
        if (!contenedor) return;
        // Remover event listener anterior si existe (guardamos la referencia en _boundScrollHandler)
        if (this._boundScrollHandler) {
            contenedor.removeEventListener('scroll', this._boundScrollHandler);
            this._boundScrollHandler = null;
        }

        // Handler que usa closure para capturar `this` correctamente
        this._boundScrollHandler = () => {
            // Si estamos cerca del top (100px) y no estamos cargando y hay más páginas
            if (contenedor.scrollTop < 100 && 
                !this.cargandoMas && 
                this.paginaActual < this.totalPaginas &&
                this.chatActivo) {
                this.cargarMensajesChat(this.chatActivo.id, true);
            }
        };

        contenedor.addEventListener('scroll', this._boundScrollHandler);
    }
    // Agregar indicador de carga
    agregarIndicadorCarga() {
        const contenedor = document.getElementById('mensajes-chat');
        if (!contenedor) return;

        const indicadorHTML = `
            <div id="indicador-carga" class="indicador-carga">
                <div class="spinner"></div>
                <span>Cargando mensajes anteriores...</span>
            </div>
        `;
        
        contenedor.insertAdjacentHTML('afterbegin', indicadorHTML);
    }

    removerIndicadorCarga() {
        const indicador = document.getElementById('indicador-carga');
        if (indicador) indicador.remove();
    }

    async verificarBloqueoChat(usuarioId) {
        try {
            const respuesta = await fetch(`/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=verificar_bloqueo&usuario1=${this.usuario.id}&usuario2=${usuarioId}`);
            const resultado = await respuesta.json();
            
            if (resultado.exito && resultado.bloqueado) {
                this.mostrarModalBloqueo(usuarioId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error verificando bloqueo:', error);
            return false;
        }
    }

    mostrarModalBloqueo(usuarioId) {
        // Crear modal más informativo
        const modalHTML = `
            <div class="modal-bloqueo" id="modal-bloqueo">
                <div class="modal-contenido">
                    <h3>🚫 Usuario Bloqueado</h3>
                    <div class="icono-bloqueo">⛔</div>
                    <p><strong>No puedes enviar mensajes a este usuario</strong></p>
                    <p>La comunicación ha sido bloqueada por una de las partes.</p>
                    <div class="acciones-modal">
                        <button onclick="cerrarModalBloqueo()" class="boton-secundario">
                            Entendido
                        </button>
                        <button onclick="irAPerfil(${usuarioId})" class="boton-terciario">
                            Ver perfil
                        </button>
                    </div>
                </div>
            </div>
            <style>
                .modal-bloqueo .icono-bloqueo {
                    font-size: 3rem;
                    margin: 1rem 0;
                    color: #e53e3e;
                }
                .acciones-modal {
                    display: flex;
                    gap: 1rem;
                    margin-top: 1.5rem;
                    justify-content: center;
                }
                .boton-terciario {
                    background: #4a5568;
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                }
            </style>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    async bloquearUsuario(usuarioId) {
        if (!confirm('¿Estás seguro de que quieres bloquear a este usuario?')) {
            return;
        }

        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/mensajes.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'bloquear_usuario',
                    usuario_bloqueador_id: this.usuario.id,
                    usuario_bloqueado_id: usuarioId
                })
            });

            const resultado = await respuesta.json();
            
            if (resultado.exito) {
                alert('Usuario bloqueado correctamente');
                location.reload(); // Recargar para actualizar interfaz
            } else {
                alert('Error: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error bloqueando usuario:', error);
            alert('Error al bloquear usuario');
        }
    }

    async reportarChat(usuarioId) {
        // Crear modal personalizado para reporte
        const modalHTML = `
            <div class="modal-reporte" id="modal-reporte">
                <div class="modal-contenido" style="max-width: 500px;">
                    <h3>⚠️ Reportar Conversación</h3>
                    <p><strong>Usuario:</strong> ${this.chatActivo.nombre}</p>
                    
                    <div class="motivo-reporte">
                        <label for="select-motivo">Motivo del reporte:</label>
                        <select id="select-motivo" class="select-motivo">
                            <option value="">Selecciona un motivo</option>
                            <option value="contenido_inapropiado">Contenido inapropiado</option>
                            <option value="acoso">Acoso o amenazas</option>
                            <option value="spam">Spam o publicidad</option>
                            <option value="informacion_falsa">Información falsa</option>
                            <option value="otro">Otro motivo</option>
                        </select>
                    </div>
                    
                    <div class="detalle-reporte">
                        <label for="textarea-detalle">Detalles adicionales (mínimo 20 caracteres):</label>
                        <textarea id="textarea-detalle" class="textarea-detalle" 
                                placeholder="Describe con detalle el problema..." 
                                rows="4"></textarea>
                        <div class="contador-caracteres" id="contador-caracteres">0/500</div>
                    </div>
                    
                    <div class="acciones-modal">
                        <button onclick="cerrarModalReporte()" class="boton-secundario">
                            Cancelar
                        </button>
                        <button onclick="enviarReporte(${usuarioId})" class="boton-principal" id="boton-enviar-reporte" disabled>
                            Enviar Reporte
                        </button>
                    </div>
                </div>
            </div>
            <style>
                .modal-reporte {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .select-motivo, .textarea-detalle {
                    width: 100%;
                    padding: 0.75rem;
                    margin: 0.5rem 0 1rem 0;
                    border: 1px solid #cbd5e0;
                    border-radius: 6px;
                    font-size: 0.9rem;
                }
                .textarea-detalle:focus, .select-motivo:focus {
                    outline: none;
                    border-color: #4299e1;
                }
                .contador-caracteres {
                    text-align: right;
                    font-size: 0.8rem;
                    color: #718096;
                    margin-bottom: 1rem;
                }
                .acciones-modal {
                    display: flex;
                    gap: 1rem;
                    justify-content: flex-end;
                }
            </style>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Configurar validación en tiempo real
        const textarea = document.getElementById('textarea-detalle');
        const select = document.getElementById('select-motivo');
        const botonEnviar = document.getElementById('boton-enviar-reporte');
        const contador = document.getElementById('contador-caracteres');
        
        textarea.addEventListener('input', function() {
            const caracteres = this.value.length;
            contador.textContent = `${caracteres}/500`;
            
            // Habilitar botón solo si hay motivo y al menos 20 caracteres
            const tieneMotivo = select.value.trim() !== '';
            const tieneDetalle = caracteres >= 20;
            
            botonEnviar.disabled = !(tieneMotivo && tieneDetalle);
        });
        
        select.addEventListener('change', function() {
            const caracteres = textarea.value.length;
            const tieneMotivo = this.value.trim() !== '';
            const tieneDetalle = caracteres >= 20;
            
            botonEnviar.disabled = !(tieneMotivo && tieneDetalle);
        });
    }

    async enviarMensaje() {
        if (!this.chatActivo) {
            alert('Selecciona una conversación primero');
            return;
        }

        const input = document.getElementById('input-mensaje');
        const botonEnviar = document.querySelector('.boton-enviar');
        let contenido = input.value;

        if (!contenido) {
            alert('Escribe un mensaje antes de enviar');
            return;
        }

        // 🔴 VALIDACIÓN FRONTEND
        try {
            contenido = this.validarContenidoFrontend(contenido);
        } catch (error) {
            alert(error.message);
            input.focus();
            input.select();
            return;
        }
        
        // 🔴 EVITAR DOBLE ENVÍO
        if (botonEnviar.disabled) {
            return;
        }
        
        botonEnviar.disabled = true;
        botonEnviar.textContent = 'Enviando...';

        try {
            const token = localStorage.getItem('token_usuario');
            if (!token) {
                throw new Error('No hay token disponible');
            }

            const mensaje = {
                accion: 'enviar',
                remitente_id: this.usuario.id,
                destinatario_id: this.chatActivo.id,
                contenido: contenido,
                token: token  // 🔴 AÑADIR TOKEN AL BODY
            };

            if (this.chatActivo && this.chatActivo.anuncio_id) {
                mensaje.anuncio_id = this.chatActivo.anuncio_id;
            }

            console.log('📡 Enviando mensaje con token:', token.substring(0, 20) + '...');
            
            // Usar fetch SIN header Authorization
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/mensajes.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(mensaje)
            });

            console.log('📡 Status enviar mensaje:', respuesta.status);
            
            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }
            
            const resultadoTexto = await respuesta.text();
            console.log('📨 Respuesta enviar mensaje:', resultadoTexto.substring(0, 200) + '...');
            
            let resultado;
            try {
                resultado = JSON.parse(resultadoTexto);
            } catch (e) {
                console.error('Error parseando JSON respuesta:', e);
                console.error('Respuesta completa:', resultadoTexto);
                throw new Error('Respuesta inválida del servidor');
            }

            if (resultado.exito) {
                input.value = '';
                
                if (resultado.datos) {
                    // **CORRECCIÓN: Agregar al array y mostrar TODOS los mensajes**
                    this.mensajesCargados.push(resultado.datos);
                    
                    // **¡NO mostrar solo 1 mensaje! Mostrar TODOS**
                    this.mostrarMensajesChat(this.mensajesCargados, false);
                    
                    // Actualizar estado del mensaje
                    setTimeout(() => {
                        this.actualizarEstadoMensajeUI(resultado.datos.id, resultado.datos.estado || 'enviado');
                    }, 100);
                    
                    // Scroll al final
                    setTimeout(() => {
                        const contenedor = document.getElementById('mensajes-chat');
                        if (contenedor) {
                            contenedor.scrollTop = contenedor.scrollHeight;
                        }
                    }, 150);
                } else {
                    // Fallback: recargar TODA la conversación
                    this.paginaActual = 1;
                    await this.cargarMensajesChat(this.chatActivo.id, false);
                }
                
                // Actualizar lista de chats
                this.cargarChats();
                
                // Verificar estados
                setTimeout(() => {
                    this.verificarEstadosMensajes();
                }, 1000);
                
            } else {
                alert('Error al enviar mensaje: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            alert('Error al enviar mensaje');
        } finally {
            botonEnviar.disabled = false;
            botonEnviar.textContent = 'Enviar';
        }
    }

    async marcarMensajesLeidos(usuarioId, anuncioId = null) {
        try {
            const datos = {
                accion: 'marcar_leidos',
                remitente_id: usuarioId,
                destinatario_id: this.usuario.id
            };
            
            // **AGREGAR anuncio_id si existe en el chat activo**
            if (anuncioId !== null && anuncioId !== undefined) {
                datos.anuncio_id = anuncioId;
            } else if (this.chatActivo && this.chatActivo.anuncio_id !== null) {
                datos.anuncio_id = this.chatActivo.anuncio_id;
            } else {
                datos.anuncio_id = null;
            }
            
            await fetch('/proyectoWeb/viajeros_peru/backend/api/mensajes.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(datos)
            });
        } catch (error) {
            console.error('Error marcando mensajes como leídos:', error);
        }
    }

    async actualizarEstadoBloqueoChat(usuarioId) {
        try {

            const token = localStorage.getItem('token_usuario');
            if (!token) {
                console.error('❌ No hay token disponible para verificar bloqueo');
                return false;
            }
            // URL con token en query string
            const url = `/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=verificar_bloqueo&usuario1=${this.usuario.id}&usuario2=${usuarioId}&token=${encodeURIComponent(token)}`;
            
            console.log('📡 Verificando bloqueo - URL:', url);
            
            const respuesta = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                }
            });
            console.log('📡 Status verificar bloqueo:', respuesta.status);
        
            if (!respuesta.ok) {
                console.error('Error verificando bloqueo:', respuesta.status);
                return false;
            }
            
            const resultadoTexto = await respuesta.text();
            console.log('📨 Respuesta verificar bloqueo:', resultadoTexto.substring(0, 200) + '...');
            
            let resultado;
            try {
                resultado = JSON.parse(resultadoTexto);
            } catch (e) {
                console.error('Error parseando JSON bloqueo:', e);
                return false;
            }
            
            const inputMensaje = document.getElementById('input-mensaje');
            const estadoChatDesktop = document.getElementById('estado-chat-activo');
            const estadoChatMobile = document.getElementById('estado-chat-activo-mobile');
            const opcionBloquear = document.getElementById('opcion-bloquear');
            const opcionBloquearMobile = document.getElementById('opcion-bloquear-mobile');
            
            if (resultado.exito && resultado.bloqueado) {
                // Usuario está bloqueado
                const bloqueadorId = resultado.usuario_bloqueador_id || null;

                if (inputMensaje) {
                    inputMensaje.disabled = true;
                    inputMensaje.placeholder = 'Este chat está bloqueado';
                }
                
                // Actualizar estados en ambas vistas
                if (estadoChatDesktop) {
                    estadoChatDesktop.textContent = '🚫 Usuario bloqueado';
                    estadoChatDesktop.style.color = '#e53e3e';
                }
                if (estadoChatMobile) {
                    estadoChatMobile.textContent = '🚫 Usuario bloqueado';
                    estadoChatMobile.style.color = '#e53e3e';
                }

                // Actualizar opciones del menú
                if (bloqueadorId && bloqueadorId === this.usuario.id) {
                    if (opcionBloquear) {
                        opcionBloquear.innerHTML = '✅ Desbloquear';
                        opcionBloquear.onclick = () => this.desbloquearUsuario(usuarioId);
                    }
                    if (opcionBloquearMobile) {
                        opcionBloquearMobile.innerHTML = '✅ Desbloquear';
                        opcionBloquearMobile.onclick = () => this.desbloquearUsuario(usuarioId);
                    }
                } else {
                    // El otro usuario me bloqueó: mostrar "Bloqueado" (deshabilitado)
                    if (opcionBloquear) {
                        opcionBloquear.innerHTML = '🚫 Bloqueado';
                        opcionBloquear.disabled = true;
                        opcionBloquear.style.opacity = '0.5';
                        opcionBloquear.onclick = null;
                    }
                    if (opcionBloquearMobile) {
                        opcionBloquearMobile.innerHTML = '🚫 Bloqueado';
                        opcionBloquearMobile.disabled = true;
                        opcionBloquearMobile.style.opacity = '0.5';
                        opcionBloquearMobile.onclick = null;
                    }
                }

                return true;
            } else {
                // Usuario no está bloqueado
                if (inputMensaje) {
                    inputMensaje.disabled = false;
                    inputMensaje.placeholder = 'Escribe un mensaje...';
                }
                
                if (estadoChatDesktop) {
                    estadoChatDesktop.textContent = 'Conectado';
                    estadoChatDesktop.style.color = '#718096';
                }
                if (estadoChatMobile) {
                    estadoChatMobile.textContent = 'Conectado';
                    estadoChatMobile.style.color = '#718096';
                }
                
                // Restaurar opciones del menú
                if (opcionBloquear) {
                    opcionBloquear.innerHTML = '🚫 Bloquear';
                    opcionBloquear.disabled = false;
                    opcionBloquear.style.opacity = '1';
                    opcionBloquear.onclick = () => this.bloquearUsuario(usuarioId);
                }
                if (opcionBloquearMobile) {
                    opcionBloquearMobile.innerHTML = '🚫 Bloquear';
                    opcionBloquearMobile.disabled = false;
                    opcionBloquearMobile.style.opacity = '1';
                    opcionBloquearMobile.onclick = () => this.bloquearUsuario(usuarioId);
                }
                return false;
            }
        } catch (error) {
            console.error('Error actualizando estado de bloqueo:', error);
            return false;
        }
    }
    async desbloquearUsuario(usuarioId) {
        if (!confirm('¿Estás seguro de que quieres desbloquear a este usuario?')) {
            return;
        }

        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/mensajes.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'desbloquear_usuario',
                    usuario_bloqueador_id: this.usuario.id,
                    usuario_bloqueado_id: usuarioId
                })
            });

            const resultado = await respuesta.json();
            
            if (resultado.exito) {
                alert('Usuario desbloqueado correctamente');
                location.reload(); // Recargar para actualizar interfaz
            } else {
                alert('Error: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error desbloqueando usuario:', error);
            alert('Error al desbloquear usuario');
        }
    }

    volverALista() {
        // Detener todas las actualizaciones automáticas
        this.detenerActualizacionAutomatica();
        this.detenerVerificacionEstados();
        this.detenerSincronizacionEstados();

        this.chatActivo = null;
        this.ultimoMensajeId = null;
        
        // Detener verificación de estados
        this.detenerVerificacionEstados();
        this.detenerSincronizacionEstados();

        // Manejar vista mobile/desktop
        this.manejarVistaMobile(false); // Mostrar lista, ocultar chat
        
        // **CORRECCIÓN: Remover clase activa de TODOS los chats**
        document.querySelectorAll('.item-chat').forEach(item => {
            item.classList.remove('activo');
        });

        // Limpiar input
        const inputMensaje = document.getElementById('input-mensaje');
        if (inputMensaje) inputMensaje.value = '';
    }

    /**
     * Manejar la transición entre lista y chat en mobile
     * @param {boolean} mostrarChat - true para mostrar chat, false para mostrar lista
     */
    manejarVistaMobile(mostrarChat) {
        const contenedorMensajes = document.querySelector('.contenedor-mensajes');
        const esMobile = window.innerWidth <= 768;
        
        if (esMobile) {
            if (mostrarChat) {
                // Añadir clase para mostrar chat y ocultar lista
                if (contenedorMensajes) {
                    contenedorMensajes.classList.add('chat-activo-mobile');
                }
                
                // Ocultar el estado "sin chat seleccionado"
                const sinChat = document.getElementById('sin-chat-seleccionado');
                if (sinChat) sinChat.style.display = 'none';
                
                // Mostrar la sección del chat activo
                const chatActivo = document.getElementById('seccion-chat-activo');
                if (chatActivo) chatActivo.style.display = 'flex';
            } else {
                // Remover clase para mostrar lista y ocultar chat
                if (contenedorMensajes) {
                    contenedorMensajes.classList.remove('chat-activo-mobile');
                }
                
                // Mostrar el estado "sin chat seleccionado" (solo en desktop)
                const sinChat = document.getElementById('sin-chat-seleccionado');
                if (sinChat && !esMobile) sinChat.style.display = 'flex';
                
                // Ocultar la sección del chat activo
                const chatActivo = document.getElementById('seccion-chat-activo');
                if (chatActivo) chatActivo.style.display = 'none';
            }
        } else {
            // En desktop, mantener el comportamiento normal
            const sinChat = document.getElementById('sin-chat-seleccionado');
            const chatActivo = document.getElementById('seccion-chat-activo');
            
            if (mostrarChat) {
                if (sinChat) sinChat.style.display = 'none';
                if (chatActivo) chatActivo.style.display = 'flex';
            } else {
                if (chatActivo) chatActivo.style.display = 'none';
                if (sinChat) sinChat.style.display = 'flex';
            }
        }
    }

    /**
     * Actualizar foto del chat en la cabecera mobile
     */
    actualizarFotoChatMobile(fotoPerfil, nombreUsuario) {
        const contenedorFoto = document.getElementById('foto-usuario-chat-mobile');
        if (!contenedorFoto) return;
        
        let fotoHTML = '';
        const nombreArray = nombreUsuario.split(' ');
        const iniciales = (nombreArray[0]?.charAt(0) || '') + (nombreArray[1]?.charAt(0) || nombreArray[0]?.charAt(1) || '');
        
        if (fotoPerfil && fotoPerfil !== 'null' && fotoPerfil !== '') {
            fotoHTML = `
                <img src="${fotoPerfil}" 
                    alt="${this.escaparHTML(nombreUsuario)}"
                    onerror="this.onerror=null; this.style.display='none'; const nextSibling = this.nextElementSibling; if (nextSibling && nextSibling.classList.contains('avatar-default')) { nextSibling.style.display = 'flex'; }">
                <div class="avatar-default" style="display: none;">${iniciales}</div>
            `;
        } else {
            fotoHTML = `<div class="avatar-default">${iniciales}</div>`;
        }
        
        contenedorFoto.innerHTML = fotoHTML;
    }

    // Utilidades
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

    mostrarError(mensaje) {
        const contenedor = document.getElementById('lista-chats');
        contenedor.innerHTML = `
            <div class="error-carga">
                <p>❌ ${mensaje}</p>
                <button onclick="sistemaMensajes.cargarChats()" class="boton-principal">Reintentar</button>
            </div>
        `;
    }

    configurarManejadores() {
        const inputMensaje = document.getElementById('input-mensaje');
        const botonEnviar = document.querySelector('.boton-enviar');
        
        if (inputMensaje && botonEnviar) {
            // Remover event listener anterior si existe
            inputMensaje.removeEventListener('keypress', this.manejarEnter);
            
            // Agregar nuevo event listener con throttle
            this.manejarEnter = (e) => {
                if (e.key === 'Enter' && !e.shiftKey && !botonEnviar.disabled) {
                    e.preventDefault();
                    this.enviarMensaje();
                }
            };
            
            inputMensaje.addEventListener('keypress', this.manejarEnter.bind(this));
        }
}

    iniciarSistemaNotificaciones() {
        // Actualizar notificaciones cada 20 segundos
        this.intervaloNotificaciones = setInterval(() => {
            this.actualizarNotificaciones();
        }, 10000);
    }

    async actualizarNotificaciones() {
        try {
            // Actualizar lista de chats
            await this.cargarChats();
            
            // Actualizar título de la página
            this.actualizarTituloPagina();
            
        } catch (error) {
            console.error('Error actualizando notificaciones:', error);
        }
    }

    actualizarTituloPagina() {
        const totalNoLeidos = this.chats.reduce((total, chat) => total + (chat.no_leidos || 0), 0);
        const tituloBase = 'Mensajes - Viajeros Perú';
        
        if (totalNoLeidos > 0) {
            document.title = `(${totalNoLeidos}) ${tituloBase}`;
        } else {
            document.title = tituloBase;
        }
    }

    /**
     * Obtener y mostrar el estado de un mensaje
     */
    async obtenerEstadoMensaje(mensajeId) {
        try {
            const respuesta = await fetch(`/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=obtener_estado_mensaje&mensaje_id=${mensajeId}&usuario_id=${this.usuario.id}`);
            const resultado = await respuesta.json();
            
            if (resultado.exito) {
                return resultado.estado;
            }
            return 'enviado';
        } catch (error) {
            console.error('Error obteniendo estado del mensaje:', error);
            return 'enviado';
        }
    }

    /**
     * Actualizar la visualización de estados en los mensajes
     */
    async actualizarEstadosMensajes() {
        if (!this.chatActivo || !this.usuario) return;
        
        try {
            const token = localStorage.getItem('token_usuario');
            if (!token) return;
            
            // URL con token en query string
            const url = `/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=obtener_estados_mensajes&usuario_id=${this.usuario.id}&otro_usuario_id=${this.chatActivo.id}&token=${encodeURIComponent(token)}`;
            
            console.log('📡 Obteniendo estados mensajes - URL:', url);
            
            const respuesta = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                }
            });
            
            if (!respuesta.ok) {
                console.warn('⚠️ Error obteniendo estados:', respuesta.status);
                return;
            }
            
            const resultadoTexto = await respuesta.text();
            
            let resultado;
            try {
                resultado = JSON.parse(resultadoTexto);
            } catch (e) {
                console.error('Error parseando JSON estados:', e, 'Respuesta:', resultadoTexto.substring(0, 200));
                return;
            }
            
            if (resultado.exito && resultado.estados) {
                // Actualizar cada mensaje en la UI
                resultado.estados.forEach(estadoInfo => {
                    this.actualizarEstadoMensajeUI(estadoInfo.id, estadoInfo.estado);
                });
            } else {
                console.warn('No se pudieron obtener estados:', resultado.error);
            }
        } catch (error) {
            console.error('Error actualizando estados:', error);
        }
    }

    /**
     * Actualizar la UI de un mensaje específico con su estado
     */
    actualizarEstadoMensajeUI(mensajeId, estado) {
        // Buscar en todos los mensajes visibles
        const mensajeElement = document.querySelector(`[data-mensaje-id="${mensajeId}"]`);
        
        if (!mensajeElement) {
            return;
        }
        
        // Limpiar estado: si es null, undefined, vacío o 'null' string, usar 'enviado' por defecto
        const estadoLimpio = (estado && estado !== 'null' && estado.toString().trim()) ? estado.toString().trim() : 'enviado';
        
        // Buscar o crear el contenedor de estado
        let estadoElement = mensajeElement.querySelector('.estado-mensaje');
        
        if (!estadoElement) {
            // Crear elemento si no existe
            estadoElement = document.createElement('div');
            estadoElement.className = 'estado-mensaje';
            
            const contenidoElement = mensajeElement.querySelector('.contenido-mensaje-individual');
            if (contenidoElement) {
                const horaElement = contenidoElement.querySelector('.hora-mensaje-individual');
                if (horaElement) {
                    // Insertar después de la hora
                    horaElement.parentNode.insertBefore(estadoElement, horaElement.nextSibling);
                } else {
                    // Insertar al final del info-mensaje
                    const infoMensaje = contenidoElement.querySelector('.info-mensaje');
                    if (infoMensaje) {
                        infoMensaje.appendChild(estadoElement);
                    }
                }
            }
        }
        
        // Actualizar icono según estado limpio
        let icono = '';
        let titulo = '';
        let color = '#718096';
        
        switch(estadoLimpio) {
            case 'enviado':
                icono = '✓';
                titulo = 'Enviado';
                color = '#718096';
                break;
            case 'entregado':
                icono = '✓✓';
                titulo = 'Entregado';
                color = '#718096';
                break;
            case 'visto':
                icono = '✓✓';
                titulo = 'Visto';
                color = '#4299e1'; // Azul para visto
                break;
            default:
                // Fallback a 'enviado' en lugar de '↗️'
                icono = '✓';
                titulo = 'Enviado';
                color = '#718096';
        }
        
        estadoElement.textContent = icono;
        estadoElement.title = titulo;
        estadoElement.style.color = color;
        estadoElement.setAttribute('data-estado', estadoLimpio);
        
        // Agregar animación sutil cuando cambia a "visto"
        if (estadoLimpio === 'visto') {
            estadoElement.style.animation = 'pulse 0.5s ease';
            setTimeout(() => {
                estadoElement.style.animation = '';
            }, 500);
        }
    }

    /**
     * Marcar mensajes como vistos cuando el usuario está en el chat
     */
    async marcarMensajesComoVistos(usuarioId = null, anuncioId = null) {
        if (!this.chatActivo || !this.usuario) return;
        
        try {
            const destinatarioId = this.usuario.id;
            const remitenteId = usuarioId || this.chatActivo.id;
            const anuncioIdToUse = anuncioId !== null ? anuncioId : 
                                (this.chatActivo.anuncio_id !== null ? this.chatActivo.anuncio_id : null);
            
            const datos = {
                accion: 'marcar_conversacion_vista',
                destinatario_id: destinatarioId,
                remitente_id: remitenteId
            };
            
            // **AGREGAR anuncio_id**
            if (anuncioIdToUse !== null) {
                datos.anuncio_id = anuncioIdToUse;
            } else {
                datos.anuncio_id = null;
            }
            
            await fetch('/proyectoWeb/viajeros_peru/backend/api/mensajes.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(datos)
            });
        } catch (error) {
            console.error('Error marcando mensajes como vistos:', error);
        }
    }

    /**
     * Verificar si hay mensajes nuevos para actualizar estados
     */
    async verificarEstadosMensajes() {
        if (!this.chatActivo || !this.usuario) return;
        
        try {
            // Solo verificar los últimos 20 mensajes para no sobrecargar
            const url = `/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=obtener_conversacion&usuario1=${this.usuario.id}&usuario2=${this.chatActivo.id}&pagina=1&limite=20`;
            const respuesta = await fetch(url);
            const resultado = await respuesta.json();
            
            if (resultado.exito && resultado.data && resultado.data.mensajes) {
                // Filtrar solo mis mensajes
                const misMensajes = resultado.data.mensajes.filter(m => m.remitente_id == this.usuario.id);
                
                // Actualizar estados en la UI
                for (const mensaje of misMensajes) {
                    this.actualizarEstadoMensajeUI(mensaje.id, mensaje.estado || 'enviado');
                }
            }
        } catch (error) {
            console.error('Error verificando estados:', error);
        }
    }
}

function cerrarModalReporte() {
    const modal = document.getElementById('modal-reporte');
    if (modal) modal.remove();
}

// Función para enviar reporte
async function enviarReporte(usuarioId) {
    const selectMotivo = document.getElementById('select-motivo');
    const textareaDetalle = document.getElementById('textarea-detalle');
    
    const motivoSeleccionado = selectMotivo.value;
    const detalle = textareaDetalle.value.trim();
    
    if (!motivoSeleccionado || detalle.length < 20) {
        alert('Por favor completa todos los campos correctamente');
        return;
    }
    
    const motivoCompleto = `[${motivoSeleccionado}] ${detalle}`;
    
    try {
        
        const urlChat = `/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=obtener_conversacion&usuario1=${window.sistemaMensajes.usuario.id}&usuario2=${usuarioId}&limite=1`;
        const respuestaChat = await fetch(urlChat);
        const textoChat = await respuestaChat.text();
        
        let resultadoChat;
        try {
            resultadoChat = JSON.parse(textoChat);
        } catch (e) {
            console.error('Error parseando JSON del chat:', e);
            console.error('Respuesta completa:', textoChat);
            alert('Error: El servidor devolvió una respuesta inválida');
            return;
        }
        
        if (resultadoChat.exito && resultadoChat.data && resultadoChat.data.mensajes && resultadoChat.data.mensajes.length > 0) {
            const mensajeId = resultadoChat.data.mensajes[0].id;
            
            const datosReporte = {
                accion: 'reportar_mensaje',
                usuario_reportador_id: window.sistemaMensajes.usuario.id,
                mensaje_id: mensajeId,
                motivo: motivoCompleto
            };
            
            const respuestaReporte = await fetch('/proyectoWeb/viajeros_peru/backend/api/mensajes.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(datosReporte)
            });
            
            const textoReporte = await respuestaReporte.text();
            
            let resultadoReporte;
            try {
                resultadoReporte = JSON.parse(textoReporte);
            } catch (e) {
                console.error('Error parseando JSON del reporte:', e);
                console.error('Respuesta HTML completa:', textoReporte);
                alert('Error: El servidor devolvió HTML en lugar de JSON. Revisa la consola.');
                return;
            }
            
            cerrarModalReporte();
            
            if (resultadoReporte.exito) {
                alert('✅ Reporte enviado correctamente. Nuestro equipo lo revisará pronto.');
            } else {
                alert('❌ Error: ' + resultadoReporte.error);
                console.error('Error del servidor:', resultadoReporte);
            }
        } else {
            alert('No se pudo obtener un mensaje para reportar');
            console.error('Error obteniendo conversación:', resultadoChat);
        }
    } catch (error) {
        console.error('Error enviando reporte:', error);
        alert('Error de conexión al enviar el reporte');
    }


}

function cerrarModalGrupo() {
    const modal = document.getElementById('modal-grupo-chats');
    if (modal) modal.remove();
}

function irAPerfil(usuarioId) {
    window.location.href = `../perfil/perfilPublico.html?id=${usuarioId}`;
}

function bloquearUsuarioGlobal() {
    if (window.sistemaMensajes && window.sistemaMensajes.chatActivo) {
        const usuarioId = window.sistemaMensajes.chatActivo.id;
        window.sistemaMensajes.bloquearUsuario(usuarioId);
    } else {
        alert('No hay chat activo seleccionado');
    }
}

function reportarChatGlobal() {
    if (window.sistemaMensajes && window.sistemaMensajes.chatActivo) {
        const usuarioId = window.sistemaMensajes.chatActivo.id;
        window.sistemaMensajes.reportarChat(usuarioId);
    } else {
        alert('No hay chat activo seleccionado');
    }
}

// Función global para volver a la lista en mobile
function volverAListaMobile() {
    if (window.sistemaMensajes) {
        window.sistemaMensajes.volverALista();
    }
}

// Función para el menú en mobile
function toggleMenuOpcionesMobile() {
    const menu = document.getElementById('menu-opciones-mobile');
    menu.classList.toggle('mostrar');
    
    setTimeout(() => {
        const cerrarMenu = (e) => {
            if (!menu.contains(e.target) && !e.target.classList.contains('boton-menu')) {
                menu.classList.remove('mostrar');
                document.removeEventListener('click', cerrarMenu);
            }
        };
        document.addEventListener('click', cerrarMenu);
    }, 10);
}

// Funciones globales para los onclick
function volverALista() {
    if (window.sistemaMensajes) {
        window.sistemaMensajes.volverALista();
    }
}

function enviarMensajeChat() {
    if (window.sistemaMensajes) {
        window.sistemaMensajes.enviarMensaje();
    }
}

function manejarEnter(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        enviarMensajeChat();
    }
}

function filtrarChats() {
    const busqueda = document.getElementById('buscar-chats').value.toLowerCase();
    const items = document.querySelectorAll('.item-chat');
    
    items.forEach(item => {
        const texto = item.textContent.toLowerCase();
        if (texto.includes(busqueda)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Funciones para el menú de tres puntos
function toggleMenuOpciones() {
    const menu = document.getElementById('menu-opciones');
    menu.classList.toggle('mostrar');
    
    // Cerrar menú al hacer clic fuera
    setTimeout(() => {
        const cerrarMenu = (e) => {
            if (!menu.contains(e.target) && !e.target.classList.contains('boton-menu')) {
                menu.classList.remove('mostrar');
                document.removeEventListener('click', cerrarMenu);
            }
        };
        document.addEventListener('click', cerrarMenu);
    }, 10);
}

function verPerfilUsuario() {
    if (window.sistemaMensajes && window.sistemaMensajes.chatActivo) {
        const usuarioId = window.sistemaMensajes.chatActivo.id;
        window.location.href = `../perfil/perfilPublico.html?id=${usuarioId}`;
    }
}

// Cerrar chat (ahora desde el menú)
function cerrarChat() {
    if (window.sistemaMensajes) {
        window.sistemaMensajes.volverALista();
    }
}

function cerrarSesion() {
    localStorage.removeItem('token_usuario');
    localStorage.removeItem('datos_usuario');
    window.location.href = '../auth/iniciar_sesion.html';
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.sistemaMensajes = new SistemaMensajes();
});