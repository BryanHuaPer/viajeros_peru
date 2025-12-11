// Sistema de Mensajería
class SistemaChat {
    constructor() {
        this.chatActivo = null;
        this.intervaloActualizacion = null;
        this.inicializar();
    }

    inicializar() {
        console.log('💬 Iniciando sistema de chat...');
        this.configurarManejadores();
    }

    // Configurar manejadores de eventos
    configurarManejadores() {
        // Manejador para enviar mensaje
        const formularioChat = document.getElementById('formulario-chat');
        if (formularioChat) {
            formularioChat.addEventListener('submit', (e) => this.enviarMensaje(e));
        }

        // Manejador para entrada de mensaje
        const inputMensaje = document.getElementById('input-mensaje');
        if (inputMensaje) {
            inputMensaje.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.enviarMensaje(e);
                }
            });
        }
    }

    // Cargar lista de chats
    async cargarChats() {
        if (!app.usuario) return;

        try {
            const respuesta = await fetch(`/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=obtener_chats&usuario_id=${app.usuario.id}`);
            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.mostrarChats(resultado.chats);
            } else {
                console.error('Error cargando chats:', resultado.error);
            }
        } catch (error) {
            console.error('Error cargando chats:', error);
        }
    }

    // Mostrar lista de chats
    mostrarChats(chats) {
        const contenedor = document.getElementById('lista-chats');
        if (!contenedor) return;

        if (!chats || chats.length === 0) {
            contenedor.innerHTML = `
                <div class="sin-chats">
                    <p>📭 No tienes conversaciones</p>
                    <p class="texto-secundario">Inicia una conversación desde un anuncio</p>
                </div>
            `;
            return;
        }

        const html = chats.map(chat => `
            <div class="item-chat" data-usuario-id="${chat.otro_usuario_id}" onclick="chat.abrirChat(${chat.otro_usuario_id}, '${chat.nombre} ${chat.apellido}')">
                <div class="avatar-chat">${chat.nombre.charAt(0)}${chat.apellido.charAt(0)}</div>
                <div class="info-chat">
                    <div class="cabecera-chat">
                        <strong>${chat.nombre} ${chat.apellido}</strong>
                        <span class="fecha-chat">${this.formatearFechaRelativa(chat.ultima_fecha)}</span>
                    </div>
                    <p class="ultimo-mensaje">${this.escaparHTML(chat.ultimo_mensaje.substring(0, 60))}${chat.ultimo_mensaje.length > 60 ? '...' : ''}</p>
                    ${chat.anuncio_titulo ? `<span class="badge-anuncio">${this.escaparHTML(chat.anuncio_titulo)}</span>` : ''}
                </div>
                ${chat.no_leidos > 0 ? `<span class="contador-no-leidos">${chat.no_leidos}</span>` : ''}
            </div>
        `).join('');

        contenedor.innerHTML = html;
    }

    // Abrir chat con un usuario
    async abrirChat(usuarioId, nombreUsuario) {
        if (!app.usuario) {
            alert('Debes iniciar sesión para usar el chat');
            return;
        }

        this.chatActivo = { id: usuarioId, nombre: nombreUsuario };
        
        // Actualizar UI
        document.getElementById('nombre-chat-activo').textContent = nombreUsuario;
        document.getElementById('seccion-lista-chats').style.display = 'none';
        document.getElementById('seccion-chat-activo').style.display = 'block';

        // Cargar mensajes
        await this.cargarMensajes(usuarioId);

        // Marcar mensajes como leídos
        await this.marcarMensajesLeidos(usuarioId);

        // Iniciar actualización automática
        this.iniciarActualizacionAutomatica(usuarioId);
    }

    // Cargar mensajes de la conversación
    async cargarMensajes(usuarioId) {
        try {
            const respuesta = await fetch(`/proyectoWeb/viajeros_peru/backend/api/mensajes.php?accion=obtener_conversacion&usuario1=${app.usuario.id}&usuario2=${usuarioId}`);
            const resultado = await respuesta.json();

            if (resultado.exito) {
                this.mostrarMensajes(resultado.mensajes);
            }
        } catch (error) {
            console.error('Error cargando mensajes:', error);
        }
    }

    // Mostrar mensajes en el chat
    mostrarMensajes(mensajes) {
        const contenedor = document.getElementById('mensajes-chat');
        if (!contenedor) return;

        const html = mensajes.map(mensaje => {
            const esPropio = mensaje.remitente_id == app.usuario.id;
            const claseMensaje = esPropio ? 'mensaje-propio' : 'mensaje-recibido';
            
            return `
                <div class="mensaje ${claseMensaje}">
                    <div class="contenido-mensaje">
                        <p>${this.escaparHTML(mensaje.contenido)}</p>
                        <span class="hora-mensaje">${this.formatearHora(mensaje.fecha_creacion)}</span>
                    </div>
                </div>
            `;
        }).join('');

        contenedor.innerHTML = html;
        
        // Scroll al final
        contenedor.scrollTop = contenedor.scrollHeight;
    }

    // Enviar mensaje
    async enviarMensaje(e) {
        e.preventDefault();
        
        if (!app.usuario || !this.chatActivo) {
            alert('Debes iniciar sesión y tener un chat activo');
            return;
        }

        const input = document.getElementById('input-mensaje');
        const contenido = input.value.trim();

        if (!contenido) return;

        try {
            const mensaje = {
                accion: 'enviar',
                remitente_id: app.usuario.id,
                destinatario_id: this.chatActivo.id,
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
                // Recargar mensajes para mostrar el nuevo
                await this.cargarMensajes(this.chatActivo.id);
            } else {
                alert('Error al enviar mensaje: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            alert('Error al enviar mensaje');
        }
    }

    // Marcar mensajes como leídos
    async marcarMensajesLeidos(usuarioId) {
        try {
            await fetch('/proyectoWeb/viajeros_peru/backend/api/mensajes.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'marcar_leidos',
                    remitente_id: usuarioId,
                    destinatario_id: app.usuario.id
                })
            });
        } catch (error) {
            console.error('Error marcando mensajes como leídos:', error);
        }
    }

    // Iniciar actualización automática de mensajes
    iniciarActualizacionAutomatica(usuarioId) {
        // Limpiar intervalo anterior
        if (this.intervaloActualizacion) {
            clearInterval(this.intervaloActualizacion);
        }

        // Actualizar cada 5 segundos
        this.intervaloActualizacion = setInterval(() => {
            if (this.chatActivo && this.chatActivo.id === usuarioId) {
                this.cargarMensajes(usuarioId);
            }
        }, 5000);
    }

    // Volver a la lista de chats
    volverALista() {
        this.chatActivo = null;
        
        document.getElementById('seccion-lista-chats').style.display = 'block';
        document.getElementById('seccion-chat-activo').style.display = 'none';

        // Limpiar intervalo de actualización
        if (this.intervaloActualizacion) {
            clearInterval(this.intervaloActualizacion);
            this.intervaloActualizacion = null;
        }

        // Recargar lista de chats
        this.cargarChats();
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
}

// Inicializar chat cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.chat = new SistemaChat();
    
    // Cargar chats si estamos en la página de mensajes
    if (window.location.pathname.includes('mensajes.html')) {
        chat.cargarChats();
    }
});