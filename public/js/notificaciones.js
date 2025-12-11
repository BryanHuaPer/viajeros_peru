/**
 * Controlador de Notificaciones
 * Maneja la página completa de notificaciones con filtros, paginación y modal
 */
class ManejadorNotificaciones {
    constructor() {
        this.usuario = null;
        this.notificaciones = [];
        this.filtroActual = '';
        this.paginaActual = 1;
        this.limite = 20;
        this.totalNotificaciones = 0;
        this.notificacionesOriginales = [];
        
        this.inicializar();
    }

    inicializar() {
        this.verificarAutenticacion();
        this.cargarNotificaciones();
        this.configurarEventos();
    }

    verificarAutenticacion() {
        const datosUsuario = localStorage.getItem('datos_usuario');
        const token = localStorage.getItem('token_usuario');
        
        if (!datosUsuario || !token) {
            window.location.href = '/proyectoWeb/viajeros_peru/index.php';
            return;
        }

        try {
            this.usuario = JSON.parse(datosUsuario);
        } catch (error) {
            console.error('Error parseando datos usuario:', error);
            window.location.href = '/proyectoWeb/viajeros_peru/index.php';
        }
    }

    async cargarNotificaciones() {
        try {
            const token = localStorage.getItem('token_usuario');
            if (!token) {
                console.error('❌ No hay token disponible en notificaciones.js');
                window.location.href = '/proyectoWeb/viajeros_peru/index.php';
                return;
            }

            // 🆕 ENVIAR TOKEN EN QUERY STRING COMO FALLBACK PARA INFINITYFREE
            const url = `/proyectoWeb/viajeros_peru/backend/api/notificaciones.php?accion=obtener_todas&pagina=${this.paginaActual}&limite=${this.limite}&token=${encodeURIComponent(token)}`;

            const respuesta = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                }
            });

            console.log('📡 Status notificaciones completa:', respuesta.status);
            
            if (respuesta.status === 401) {
                // Intentar sin header Authorization
                console.log('⚠️ 401 recibido, intentando sin header...');
                const urlSinHeader = `/proyectoWeb/viajeros_peru/backend/api/notificaciones.php?accion=obtener_todas&pagina=${this.paginaActual}&limite=${this.limite}&token=${encodeURIComponent(token)}`;

                const respuesta2 = await fetch(urlSinHeader, {
                    method: 'GET',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json'
                    }
                });
                
                if (!respuesta2.ok) {
                    throw new Error(`Error HTTP (sin header): ${respuesta2.status}`);
                }

                const resultado2 = await respuesta2.text();
                console.log('📨 Respuesta alternativa:', resultado2.substring(0, 200) + '...');
                
                try {
                    const json = JSON.parse(resultado2);
                    if (json.exito) {
                        this.notificacionesOriginales = json.notificaciones;
                        this.notificaciones = json.notificaciones;
                        this.totalNotificaciones = json.total;
                        this.paginaActual = json.pagina;
                        this.limite = json.limite;
                        
                        this.renderizarNotificaciones();
                        this.renderizarPaginacion(json.total_paginas);
                        
                        this.actualizarBotonMarcarTodas();
                        
                    } else {
                        this.mostrarSinNotificaciones();
                        document.getElementById('btn-marcar-todas').disabled = true;
                    }
                } catch (e) {
                    console.error('Error parseando JSON alternativo:', e);
                    this.mostrarSinNotificaciones();
                    document.getElementById('btn-marcar-todas').disabled = true;
                }
                return;
            }

            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }

            const resultado = await respuesta.text();
            console.log('📨 Respuesta original:', resultado.substring(0, 200) + '...');
            
            try {
                const json = JSON.parse(resultado);
                if (json.exito) {
                    this.notificacionesOriginales = json.notificaciones;
                    this.notificaciones = json.notificaciones;
                    this.totalNotificaciones = json.total;
                    this.paginaActual = json.pagina;
                    this.limite = json.limite;
                    
                    this.renderizarNotificaciones();
                    this.renderizarPaginacion(json.total_paginas);
                    
                    this.actualizarBotonMarcarTodas();
                    
                } else {
                    this.mostrarSinNotificaciones();
                    document.getElementById('btn-marcar-todas').disabled = true;
                }
            } catch (e) {
                console.error('Error parseando JSON:', e);
                this.mostrarSinNotificaciones();
                document.getElementById('btn-marcar-todas').disabled = true;
            }
        } catch (error) {
            console.error('❌ Error cargando notificaciones:', error);
            this.mostrarError('Error cargando notificaciones: ' + error.message);
            this.mostrarSinNotificaciones();
            document.getElementById('btn-marcar-todas').disabled = true;
        }
    }

    // MÉTODO: Actualizar estado del botón "Marcar todas"
    actualizarBotonMarcarTodas() {
        const btnMarcarTodas = document.getElementById('btn-marcar-todas');
        if (!btnMarcarTodas) return;
        
        // Verificar si hay notificaciones no leídas
        const hayNoLeidas = this.notificacionesOriginales.some(n => !n.leido);
        
        if (hayNoLeidas) {
            btnMarcarTodas.disabled = false;
            btnMarcarTodas.style.opacity = '1';
            btnMarcarTodas.style.cursor = 'pointer';
            btnMarcarTodas.innerHTML = '✓ Marcar todas como vistas';
        } else {
            btnMarcarTodas.disabled = true;
            btnMarcarTodas.style.opacity = '0.5';
            btnMarcarTodas.style.cursor = 'not-allowed';
            btnMarcarTodas.innerHTML = '✓ Todas vistas';
        }
    }

    renderizarNotificaciones() {
        const contenedor = document.getElementById('lista-notificaciones-completa');
        
        if (this.notificaciones.length === 0) {
            this.mostrarSinNotificaciones();
            return;
        }

        let html = this.notificaciones.map(notif => {
            const icono = this.obtenerIconoNotificacion(notif.tipo);
            const fecha = this.formatearFechaRelativa(notif.fecha_creacion);
            const claseNoLeido = !notif.leido ? 'no-leido' : '';
            const puntoNoLeido = !notif.leido ? '<div class="punto-no-leido-grande"></div>' : '';
            const textoEstado = notif.leido ? 'Visto' : 'Nuevo';
            const claseEstado = notif.leido ? 'estado-visto' : 'estado-nuevo';
            
            // Texto del botón basado en si tiene enlace o no
            const textoBoton = notif.enlace ? '🔍 Ver detalle' : '📄 Ver mensaje';
            const claseBoton = notif.enlace ? '' : 'btn-sin-enlace';
            
            // Escapar el enlace para el onclick
            const enlaceEscapado = notif.enlace ? this.escaparHTML(notif.enlace) : '';
            
            return `
                <div class="item-notif-completo ${claseNoLeido}" data-id="${notif.id}">
                    <div class="icono-notif-grande">${icono}</div>
                    <div class="contenido-notif-completo">
                        <div class="header-notif-completo">
                            <div class="titulo-notif-completo">${this.escaparHTML(notif.titulo)}</div>
                            <span class="estado-notif ${claseEstado}">${textoEstado}</span>
                        </div>
                        <div class="descripcion-notif-completo">${this.escaparHTML(notif.contenido)}</div>
                        <div class="fecha-y-origen">
                            <span>📅 ${fecha}</span>
                            <button class="btn-ver-origen ${claseBoton}" 
                                    onclick="window.gestorNotificaciones.abrirModal(${notif.id}, '${enlaceEscapado}')">
                                ${textoBoton}
                            </button>
                        </div>
                    </div>
                    ${puntoNoLeido}
                </div>`;
        }).join('');

        contenedor.innerHTML = html;
    }

    renderizarPaginacion(totalPaginas) {
        const paginacion = document.getElementById('paginacion');
        
        if (totalPaginas <= 1) {
            paginacion.style.display = 'none';
            return;
        }

        paginacion.style.display = 'flex';
        let html = '';

        // Botón anterior
        if (this.paginaActual > 1) {
            html += `<button class="btn-pagina" onclick="window.gestorNotificaciones.irAPagina(${this.paginaActual - 1})">← Anterior</button>`;
        }

        // Números de página
        const inicio = Math.max(1, this.paginaActual - 2);
        const fin = Math.min(totalPaginas, this.paginaActual + 2);

        if (inicio > 1) {
            html += `<button class="btn-pagina" onclick="window.gestorNotificaciones.irAPagina(1)">1</button>`;
            if (inicio > 2) html += `<span>...</span>`;
        }

        for (let i = inicio; i <= fin; i++) {
            const activo = i === this.paginaActual ? 'activo' : '';
            html += `<button class="btn-pagina ${activo}" onclick="window.gestorNotificaciones.irAPagina(${i})">${i}</button>`;
        }

        if (fin < totalPaginas) {
            if (fin < totalPaginas - 1) html += `<span>...</span>`;
            html += `<button class="btn-pagina" onclick="window.gestorNotificaciones.irAPagina(${totalPaginas})">${totalPaginas}</button>`;
        }

        // Botón siguiente
        if (this.paginaActual < totalPaginas) {
            html += `<button class="btn-pagina" onclick="window.gestorNotificaciones.irAPagina(${this.paginaActual + 1})">Siguiente →</button>`;
        }

        paginacion.innerHTML = html;
    }

    irAPagina(pagina) {
        this.paginaActual = pagina;
        this.cargarNotificaciones();
        // Scroll al top
        document.querySelector('.lista-notificaciones-completa').scrollIntoView({ behavior: 'smooth' });
    }

    async abrirModal(notificacionId, enlace) {
        console.log('Abriendo modal para notificación:', notificacionId, 'enlace:', enlace);
        
        // Marcar como visto al abrir
        await this.marcarComoVisto(notificacionId);
        
        // Obtener datos de la notificación
        const notif = this.notificacionesOriginales.find(n => n.id === notificacionId);
        if (!notif) {
            console.error('No se encontró la notificación con ID:', notificacionId);
            return;
        }

        // Llenar modal
        const modal = document.getElementById('modal-notificacion');
        if (!modal) {
            console.error('No se encontró el modal con ID modal-notificacion');
            return;
        }

        document.getElementById('modal-titulo').textContent = notif.titulo;

        let bodyHTML = `
            <div class="notif-detalle-item">
                <div class="notif-detalle-label">📌 Tipo</div>
                <div class="notif-detalle-valor">${this.obtenerNombreTipo(notif.tipo)}</div>
            </div>
            <div class="notif-detalle-item">
                <div class="notif-detalle-label">📝 Mensaje</div>
                <div class="notif-detalle-valor">${this.escaparHTML(notif.contenido)}</div>
            </div>
            <div class="notif-detalle-item">
                <div class="notif-detalle-label">📅 Fecha</div>
                <div class="notif-detalle-valor">${new Date(notif.fecha_creacion).toLocaleString('es-ES')}</div>
            </div>
            <div class="notif-detalle-item">
                <div class="notif-detalle-label">👁️ Estado</div>
                <div class="notif-detalle-valor">
                    <span class="estado-badge ${notif.leido ? 'estado-leido' : 'estado-nuevo'}">
                        ${notif.leido ? '✓ Visto' : '✗ No visto'}
                    </span>
                </div>
            </div>`;

        document.getElementById('modal-body').innerHTML = bodyHTML;

        // Configurar botones del modal
        const btnCerrar = document.getElementById('btn-cerrar-modal');
        const btnCerrarX = document.getElementById('btn-cerrar-modal-x');
        const btnOrigen = document.getElementById('btn-ir-origen');
        
        // Mostrar botón de origen solo si hay enlace
        if (enlace && enlace.trim() !== '' && enlace !== 'undefined') {
            btnOrigen.style.display = 'block';
            btnOrigen.href = enlace;
            btnOrigen.target = '_blank';
            btnOrigen.onclick = (e) => {
                e.preventDefault();
                modal.classList.remove('mostrar');
                // Redirigir al enlace después de cerrar el modal
                setTimeout(() => {
                    window.open(enlace, '_blank');
                }, 300);
            };
        } else {
            btnOrigen.style.display = 'none';
        }

        // Configurar eventos de cierre
        const cerrarModal = () => {
            modal.classList.remove('mostrar');
        };

        if (btnCerrar) {
            btnCerrar.onclick = cerrarModal;
        }

        if (btnCerrarX) {
            btnCerrarX.onclick = cerrarModal;
        }

        // Mostrar modal
        modal.classList.add('mostrar');
        console.log('Modal mostrado');
    }

    async marcarComoVisto(notificacionId) {
        try {
            console.log('🔔 Marcando notificación como vista:', notificacionId);
            
            const token = localStorage.getItem('token_usuario');
            if (!token) {
                console.error('❌ No hay token disponible');
                return;
            }

            // 🆕 ENVIAR TOKEN EN QUERY STRING COMO FALLBACK
            const url = `/proyectoWeb/viajeros_peru/backend/api/notificaciones.php?token=${encodeURIComponent(token)}`;
            
            const data = {
                accion: 'marcar_como_visto',
                notificacion_id: notificacionId,
                token: token // AÑADIR TOKEN EN EL BODY
            };

            const respuesta = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(data)
            });
            
            console.log('📡 Status marcar como visto:', respuesta.status);
            
            if (respuesta.status === 401) {
                // Intentar sin header - usar FormData
                console.log('⚠️ 401 en marcar como visto, intentando alternativa...');
                
                const formData = new FormData();
                formData.append('accion', 'marcar_como_visto');
                formData.append('notificacion_id', notificacionId);
                formData.append('token', token);
                
                const urlAlternativa = `/proyectoWeb/viajeros_peru/backend/api/notificaciones.php`;
                respuesta = await fetch(urlAlternativa, {
                    method: 'POST',
                    body: formData
                });
            }
            
            console.log('✅ Respuesta del servidor (marcar como visto):', respuesta.status);
            
            if (respuesta.ok) {
                // Actualizar UI INMEDIATAMENTE
                this.actualizarNotificacionEnUI(notificacionId);
                
                // Actualizar el contador en el navbar
                if (window.navegacionGlobal) {
                    console.log('🔄 Actualizando navbar...');
                    window.navegacionGlobal.cargarNotificaciones();
                }
                
                // Actualizar el badge en el título de la página
                this.actualizarBadgePagina();
                
                console.log('✅ Notificación marcada como vista exitosamente');
            } else {
                console.error('❌ Error en la respuesta del servidor:', respuesta.status);
            }
            
        } catch (error) {
            console.error('❌ Error marcando como visto:', error);
        }
    }

    actualizarNotificacionEnUI(notificacionId) {
        // 1. Encontrar el elemento en el DOM
        const elementoNotif = document.querySelector(`.item-notif-completo[data-id="${notificacionId}"]`);
        if (!elementoNotif) return;
        
        // 2. Quitar clase "no-leido" y punto
        elementoNotif.classList.remove('no-leido');
        
        const puntoNoLeido = elementoNotif.querySelector('.punto-no-leido-grande');
        if (puntoNoLeido) {
            puntoNoLeido.remove();
        }
        
        // 3. Actualizar en el array local
        const notifIndex = this.notificaciones.findIndex(n => n.id === notificacionId);
        if (notifIndex !== -1) {
            this.notificaciones[notifIndex].leido = true;
        }
        
        const notifOriginalIndex = this.notificacionesOriginales.findIndex(n => n.id === notificacionId);
        if (notifOriginalIndex !== -1) {
            this.notificacionesOriginales[notifOriginalIndex].leido = true;
        }
        
        // 4. Actualizar botones de filtro
        this.actualizarContadorFiltros();
    }

    actualizarContadorFiltros() {
        // Calcular cuántas notificaciones no leídas quedan
        const noLeidasTotales = this.notificacionesOriginales.filter(n => !n.leido).length;
        
        // Actualizar texto de los filtros
        const filtros = document.querySelectorAll('.filtro-btn');
        filtros.forEach(btn => {
            const tipo = btn.dataset.tipo;
            let contador;
            
            if (tipo === 'todas') {
                contador = noLeidasTotales;
            } else if (tipo === 'no-vistas') {
                contador = this.notificacionesOriginales.filter(n => !n.leido && 
                    (this.filtroActual === '' || n.tipo === this.filtroActual)).length;
            } else {
                contador = this.notificacionesOriginales.filter(n => !n.leido && n.tipo === tipo).length;
            }
            
            // Actualizar badge en el filtro
            const badgeExistente = btn.querySelector('.badge-filtro');
            if (contador > 0) {
                if (badgeExistente) {
                    badgeExistente.textContent = contador;
                } else {
                    const badge = document.createElement('span');
                    badge.className = 'badge-filtro';
                    badge.textContent = contador;
                    btn.appendChild(badge);
                }
            } else if (badgeExistente) {
                badgeExistente.remove();
            }
        });
        
        // Ocultar botón "Marcar todas" si ya no hay no leídas
        const hayNoVistas = this.notificacionesOriginales.some(n => !n.leido);
        document.getElementById('btn-marcar-todas').style.display = hayNoVistas ? 'block' : 'none';
    }

    actualizarBadgePagina() {
        // Actualizar el título de la página
        const noLeidas = this.notificacionesOriginales.filter(n => !n.leido).length;
        const tituloBase = document.title.replace(/^\(\d+\)\s*/, '');
        
        if (noLeidas > 0) {
            document.title = `(${noLeidas}) ${tituloBase}`;
        } else {
            document.title = tituloBase;
        }
    }

    async marcarTodasVisto() {
        const idsNoVistos = this.notificacionesOriginales
            .filter(n => !n.leido)
            .map(n => n.id);

        if (idsNoVistos.length === 0) {
            console.log('ℹ️ No hay notificaciones por marcar como vistas');
            return;
        }

        console.log(`🔔 Marcando ${idsNoVistos.length} notificaciones como vistas`);
        
        try {
            const token = localStorage.getItem('token_usuario');
            if (!token) {
                console.error('❌ No hay token disponible');
                return;
            }

            // Deshabilitar el botón mientras se procesa
            const btnMarcarTodas = document.getElementById('btn-marcar-todas');
            btnMarcarTodas.disabled = true;
            btnMarcarTodas.innerHTML = '⏳ Procesando...';
            
            // 🆕 ENVIAR TOKEN EN QUERY STRING COMO FALLBACK
            const url = `/proyectoWeb/viajeros_peru/backend/api/notificaciones.php?token=${encodeURIComponent(token)}`;
            
            const data = {
                accion: 'marcar_multples_visto',
                notificacion_id: notificacionId,
                token: token // AÑADIR TOKEN EN EL BODY
            };

            const respuesta = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(data)
            });
            
            if (respuesta.status === 401) {
                // Intentar sin header - usar FormData
                console.log('⚠️ 401 en marcar múltiples, intentando alternativa...');
                
                const formData = new FormData();
                formData.append('accion', 'marcar_multiples_visto');
                formData.append('token', token);
                idsNoVistos.forEach((id, index) => {
                    formData.append(`notificacion_ids[${index}]`, id);
                });
                
                const urlAlternativa = `/proyectoWeb/viajeros_peru/backend/api/notificaciones.php`;
                respuesta = await fetch(urlAlternativa, {
                    method: 'POST',
                    body: formData
                });
            }

            const resultado = await respuesta.json();
            
            if (resultado.exito) {
                console.log('✅ Todas las notificaciones marcadas como vistas exitosamente');
                
                // Actualizar UI inmediatamente para cada notificación
                idsNoVistos.forEach(id => {
                    this.actualizarNotificacionEnUI(id);
                });
                
                // Actualizar el navbar si existe
                if (window.navegacionGlobal) {
                    window.navegacionGlobal.cargarNotificaciones();
                }
                
                // Actualizar título de la página
                this.actualizarBadgePagina();
                
                // Mostrar confirmación
                this.mostrarConfirmacion(`✓ ${idsNoVistos.length} notificaciones marcadas como vistas`);
                
                // Actualizar estado del botón
                setTimeout(() => {
                    this.actualizarBotonMarcarTodas();
                }, 500);
                
            } else {
                console.error('❌ Error del servidor:', resultado.error);
                this.mostrarError('Error al marcar las notificaciones como vistas');
                
                // Rehabilitar el botón
                btnMarcarTodas.disabled = false;
                btnMarcarTodas.innerHTML = '✓ Marcar todas como vistas';
            }
            
        } catch (error) {
            console.error('❌ Error marcando como visto:', error);
            this.mostrarError('Error de conexión. Intenta nuevamente.');
            
            // Rehabilitar el botón
            const btnMarcarTodas = document.getElementById('btn-marcar-todas');
            if (btnMarcarTodas) {
                btnMarcarTodas.disabled = false;
                btnMarcarTodas.innerHTML = '✓ Marcar todas como vistas';
            }
        }
    }

    mostrarConfirmacion(mensaje) {
        // Crear notificación flotante
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #38a169;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notif.textContent = mensaje;
        
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    mostrarError(mensaje) {
        // Crear notificación de error flotante
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e53e3e;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(229, 62, 62, 0.3);
        `;
        notif.innerHTML = `❌ ${mensaje}`;
        
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notif.remove(), 300);
        }, 4000);
    }

    aplicarFiltro(tipo) {
        this.filtroActual = tipo;
        if (tipo === '') {
            this.notificaciones = this.notificacionesOriginales;
        } else {
            this.notificaciones = this.notificacionesOriginales.filter(n => n.tipo === tipo);
        }
        this.renderizarNotificaciones();
    }

    configurarEventos() {
        // Filtros
        document.querySelectorAll('.filtro-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('activo'));
                e.target.classList.add('activo');
                this.aplicarFiltro(e.target.dataset.tipo);
            });
        });

        // Botón marcar todas
        const btnMarcarTodas = document.getElementById('btn-marcar-todas');
        if (btnMarcarTodas) {
            btnMarcarTodas.addEventListener('click', () => {
                this.marcarTodasVisto();
            });
        }

        // Cerrar modal al hacer click fuera
        const modal = document.getElementById('modal-notificacion');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    e.target.classList.remove('mostrar');
                }
            });
        }

        // Cerrar modal con Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('modal-notificacion');
                if (modal) {
                    modal.classList.remove('mostrar');
                }
            }
        });
    }

    obtenerIconoNotificacion(tipo) {
        const iconos = {
            'mensaje': '💬',
            'solicitud': '📮',
            'reserva': '🎫',
            'resena': '⭐',
            'sistema': '⚙️'
        };
        return iconos[tipo] || '📢';
    }

    obtenerNombreTipo(tipo) {
        const nombres = {
            'mensaje': 'Mensaje',
            'solicitud': 'Solicitud',
            'reserva': 'Reserva',
            'resena': 'Reseña',
            'sistema': 'Sistema'
        };
        return nombres[tipo] || 'Notificación';
    }

    formatearFechaRelativa(fechaStr) {
        const fecha = new Date(fechaStr);
        const ahora = new Date();
        const diff = ahora - fecha;

        const minutos = Math.floor(diff / 60000);
        const horas = Math.floor(diff / 3600000);
        const dias = Math.floor(diff / 86400000);

        if (minutos < 1) return 'Ahora';
        if (minutos < 60) return `Hace ${minutos} min`;
        if (horas < 24) return `Hace ${horas} h`;
        if (dias < 7) return `Hace ${dias} d`;
        
        return fecha.toLocaleDateString('es-ES');
    }

    escaparHTML(texto) {
        if (!texto) return '';
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    mostrarSinNotificaciones() {
        const contenedor = document.getElementById('lista-notificaciones-completa');
        contenedor.innerHTML = `
            <div class="sin-notificaciones-completo">
                <p>✓ No tienes notificaciones</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Volverás a recibir notificaciones cuando haya actividad nueva.</p>
            </div>`;
        document.getElementById('btn-marcar-todas').style.display = 'none';
    }
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
    window.gestorNotificaciones = new ManejadorNotificaciones();
});
