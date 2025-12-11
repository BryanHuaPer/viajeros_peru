// Sistema de Gestión de Reservas - VERSIÓN CORREGIDA
class SistemaReservas {
    constructor() {
        this.usuario = null;
        this.reservas = [];
        this.filtroActual = 'todas';
        this.inicializar();
    }

    inicializar() {
        console.log('📅 Iniciando sistema de reservas...');
        this.verificarAutenticacion();
        this.cargarReservas();
        this.configurarFiltros();
    }

    verificarAutenticacion() {
        const datosUsuario = localStorage.getItem('datos_usuario');
        
        if (datosUsuario) {
            try {
                this.usuario = JSON.parse(datosUsuario);
                console.log('✅ Usuario autenticado:', this.usuario);
            } catch (error) {
                console.error('Error parseando usuario:', error);
                window.location.href = '../auth/iniciar_sesion.html';
            }
        } else {
            window.location.href = '../auth/iniciar_sesion.html';
        }
    }

    async cargarReservas() {
        try {
            let url = '';
            if (this.usuario.rol === 'viajero') {
                url = `/proyectoWeb/viajeros_peru/backend/api/reservas.php?accion=obtener_por_viajero&viajero_id=${this.usuario.id}`;
            } else if (this.usuario.rol === 'anfitrion') {
                url = `/proyectoWeb/viajeros_peru/backend/api/reservas.php?accion=obtener_por_anfitrion&anfitrion_id=${this.usuario.id}`;
            } else {
                throw new Error('Rol de usuario no válido para ver reservas');
            }

            console.log('📡 Solicitando reservas desde:', url);
            const respuesta = await fetch(url);
            const resultado = await respuesta.json();

            console.log('📊 Resultado de reservas:', resultado);
            
            if (resultado.exito) {
                this.reservas = resultado.reservas;
                this.mostrarReservas(this.reservas);
            } else {
                this.mostrarError('Error cargando reservas: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error cargando reservas:', error);
            this.mostrarError('Error al cargar las reservas');
        }
    }

    mostrarReservas(reservas) {
        const contenedor = document.getElementById('contenido-reservas');
        
        if (!reservas || reservas.length === 0) {
            contenedor.innerHTML = `
                <div class="sin-reservas">
                    <div class="icono-sin-reservas">📅</div>
                    <h3>No tienes reservas</h3>
                    <p>${this.usuario.rol === 'viajero' ? 
                        'Busca anuncios y solicita tu primera estancia' : 
                        'Los viajeros solicitarán estancias en tus anuncios'}</p>
                    ${this.usuario.rol === 'viajero' ? 
                        '<a href="../inicio/busqueda.html" class="boton-primario">Buscar Anuncios</a>' : 
                        '<a href="../anuncios/crear_anuncio.html" class="boton-primario">Crear Anuncio</a>'}
                </div>
            `;
            return;
        }

        // Aplicar filtro
        const reservasFiltradas = this.filtrarReservas(reservas);
        
        const html = reservasFiltradas.map(reserva => this.crearHTMLReserva(reserva)).join('');
        contenedor.innerHTML = html;
    }
    mostrarReservas(reservas) {
        const contenedor = document.getElementById('contenido-reservas');
        
        if (!reservas || reservas.length === 0) {
            contenedor.innerHTML = `
                <div class="sin-reservas">
                    <div class="icono-sin-reservas">📅</div>
                    <h3>No tienes reservas</h3>
                    <p>${this.usuario.rol === 'viajero' ? 
                        'Busca anuncios y solicita tu primera estancia' : 
                        'Los viajeros solicitarán estancias en tus anuncios'}</p>
                    ${this.usuario.rol === 'viajero' ? 
                        '<a href="../inicio/busqueda.html" class="boton-primario">Buscar Anuncios</a>' : 
                        '<a href="../anuncios/crear_anuncio.html" class="boton-primario">Crear Anuncio</a>'}
                </div>
            `;
            return;
        }

        // ✅ DEBUG: Mostrar información de cada reserva
        console.log('=== DEBUG RESERVAS ===');
        reservas.forEach((reserva, index) => {
            console.log(`Reserva ${index + 1}:`, {
                id: reserva.id,
                estado: reserva.estado,
                ya_resenia: reserva.ya_resenia,
                tipo_ya_resenia: typeof reserva.ya_resenia,
                fecha_fin: reserva.fecha_fin,
                dias_desde_fin: this.calcularDiasDesdeFin(reserva.fecha_fin)
            });
        });

        // Aplicar filtro
        const reservasFiltradas = this.filtrarReservas(reservas);
        
        const html = reservasFiltradas.map(reserva => this.crearHTMLReserva(reserva)).join('');
        contenedor.innerHTML = html;
    }

    // ✅ NUEVA FUNCIÓN: Calcular días desde fecha_fin
    calcularDiasDesdeFin(fechaFinStr) {
        const fechaFin = new Date(fechaFinStr);
        const hoy = new Date();
        return Math.floor((hoy - fechaFin) / (1000 * 60 * 60 * 24));
    }

    filtrarReservas(reservas) {
        if (this.filtroActual === 'todas') {
            return reservas;
        }
        return reservas.filter(reserva => reserva.estado === this.filtroActual);
    }

    crearHTMLReserva(reserva) {
        const esAnfitrion = this.usuario.rol === 'anfitrion';
        const estadoClase = `estado-${reserva.estado}`;
        const estadoTexto = this.formatearEstado(reserva.estado);
        
        // Debug: verificar si ya_resenia está presente
        console.log(`Reserva ${reserva.id} - ya_resenia:`, reserva.ya_resenia, 'tipo:', typeof reserva.ya_resenia);
        
        return `
            <div class="tarjeta-reserva ${estadoClase}" data-id="${reserva.id}">
                <div class="cabecera-reserva">
                    <h4>${this.escaparHTML(reserva.anuncio_titulo)}</h4>
                    <span class="badge-estado">${estadoTexto}</span>
                </div>
                
                <div class="info-reserva">
                    <div class="info-item">
                        <strong>📍 Ubicación:</strong>
                        <span>${this.escaparHTML(reserva.anuncio_ubicacion)}</span>
                    </div>
                    <div class="info-item">
                        <strong>📅 Fechas:</strong>
                        <span>${this.formatearFecha(reserva.fecha_inicio)} - ${this.formatearFecha(reserva.fecha_fin)}</span>
                    </div>
                    ${esAnfitrion ? `
                        <div class="info-item">
                            <strong>👤 Viajero:</strong>
                            <span>${this.escaparHTML(reserva.viajero_nombre)} ${this.escaparHTML(reserva.viajero_apellido)}</span>
                        </div>
                    ` : `
                        <div class="info-item">
                            <strong>👤 Anfitrión:</strong>
                            <span>${this.escaparHTML(reserva.anfitrion_nombre)} ${this.escaparHTML(reserva.anfitrion_apellido)}</span>
                        </div>
                    `}
                    ${reserva.mensaje_solicitud ? `
                        <div class="info-item mensaje-solicitud">
                            <strong>💬 Mensaje:</strong>
                            <p>${this.escaparHTML(reserva.mensaje_solicitud)}</p>
                        </div>
                    ` : ''}
                </div>
                
                <div class="acciones-reserva">
                    ${this.obtenerAccionesReserva(reserva, esAnfitrion)}
                </div>
            </div>
        `;
    }

    obtenerAccionesReserva(reserva, esAnfitrion) {
        if (esAnfitrion) {
            if (reserva.estado === 'pendiente') {
                return `
                    <button class="boton-aceptar" onclick="sistemaReservas.actualizarEstado(${reserva.id}, 'aceptada')">
                        ✅ Aceptar
                    </button>
                    <button class="boton-rechazar" onclick="sistemaReservas.actualizarEstado(${reserva.id}, 'rechazada')">
                        ❌ Rechazar
                    </button>
                `;
            } else if (reserva.estado === 'aceptada') {
                return `
                    <button class="boton-completar" onclick="sistemaReservas.actualizarEstado(${reserva.id}, 'completada')">
                        ✅ Marcar como Completada
                    </button>
                `;
            } else if (reserva.estado === 'completada') {
                return this.obtenerAccionesResena(reserva, esAnfitrion);
            }
        } else {
            // Para viajero
            if (reserva.estado === 'pendiente' || reserva.estado === 'aceptada') {
                return `
                    <button class="boton-cancelar" onclick="sistemaReservas.cancelarReserva(${reserva.id})">
                        ❌ Cancelar
                    </button>
                `;
            } else if (reserva.estado === 'completada') {
                return this.obtenerAccionesResena(reserva, esAnfitrion);
            }
        }
        
        return '<span class="sin-acciones">No hay acciones disponibles</span>';
    }

    // ✅ NUEVA FUNCIÓN: Manejar acciones de reseña
    obtenerAccionesResena(reserva, esAnfitrion) {
        const yaResenio = parseInt(reserva.ya_resenia) === 1;
        console.log(`Reserva ${reserva.id} - ${esAnfitrion ? 'Anfitrión' : 'Viajero'} ya reseñó?`, yaResenio);
        
        // ✅ Verificar si ha pasado más de 30 días desde fecha_fin
        const fechaFin = new Date(reserva.fecha_fin);
        const hoy = new Date();
        const diferenciaDias = Math.floor((hoy - fechaFin) / (1000 * 60 * 60 * 24));
        const periodoExpirado = diferenciaDias > 30;
        
        // Debug
        console.log(`Reserva ${reserva.id}: días desde fin = ${diferenciaDias}, expirado = ${periodoExpirado}`);
        
        if (yaResenio) {
            // Si ya reseñó, mostrar botón para ver la reseña
            return `
                <span class="resenia-hecha">✅ Ya dejaste reseña</span>
                <button class="boton-ver-resena" onclick="sistemaReservas.verResenaEnviada(${reserva.id})">
                    👁️ Ver reseña enviada
                </button>
            `;
        } else if (periodoExpirado) {
            // Si expiró, mostrar mensaje
            return '<span class="resenia-expirada">⏰ Período para reseña expirado (30 días)</span>';
        } else {
            // Si no ha reseñado y no expiró, mostrar botón para dejar reseña
            return `
                <button class="boton-reseniar" onclick="sistemaReservas.verificarYMostrarResenia(${reserva.id})">
                    ⭐ Dejar Reseña
                </button>
            `;
        }
    }

    // ✅ NUEVA FUNCIÓN: Ver reseña enviada
    async verResenaEnviada(reservaId) {
        try {
            const usuario = JSON.parse(localStorage.getItem('datos_usuario') || '{}');
            const autorId = usuario.id;
            
            const respuesta = await fetch(
                `/proyectoWeb/viajeros_peru/backend/api/resenas.php?accion=obtener_por_reserva&reserva_id=${reservaId}`
            );
            
            const resultado = await respuesta.json();
            
            if (resultado.exito && resultado.resenas && resultado.resenas.length > 0) {
                // Buscar la reseña que este usuario envió
                const miResena = resultado.resenas.find(resena => resena.autor_id == autorId);
                
                if (miResena) {
                    const fecha = new Date(miResena.fecha_creacion).toLocaleDateString('es-PE');
                    let estrellas = '';
                    for (let i = 1; i <= 5; i++) {
                        estrellas += i <= miResena.puntuacion ? '★' : '☆';
                    }
                    
                    // Mostrar modal con la reseña
                    this.mostrarModalVerResena(miResena, estrellas, fecha);
                } else {
                    alert('No se encontró tu reseña para esta reserva');
                }
            } else {
                alert('No se encontró ninguna reseña para esta reserva');
            }
        } catch (error) {
            console.error('Error obteniendo reseña:', error);
            alert('Error al cargar la reseña');
        }
    }

    // ✅ NUEVA FUNCIÓN: Mostrar modal para ver reseña enviada
    mostrarModalVerResena(resena, estrellas, fecha) {
        const modalHTML = `
            <div class="modal-resenia" id="modal-ver-resenia">
                <div class="modal-contenido">
                    <div class="modal-cabecera">
                        <h3>⭐ Tu Reseña Enviada</h3>
                        <button class="cerrar-modal" onclick="sistemaReservas.cerrarModalVerResenia()">&times;</button>
                    </div>
                    <div class="modal-cuerpo">
                        <div class="calificacion">
                            <p><strong>Calificación:</strong></p>
                            <div class="estrellas">
                                <span style="font-size: 30px; color: #ffc107;">${estrellas}</span>
                            </div>
                            <p><small>Puntuación: ${resena.puntuacion}/5</small></p>
                        </div>
                        <div class="comentario">
                            <p><strong>Comentario:</strong></p>
                            <div class="comentario-texto" style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin-top: 10px;">
                                ${this.escaparHTML(resena.comentario)}
                            </div>
                        </div>
                        <div class="fecha-resena">
                            <p><small>📅 Enviada el: ${fecha}</small></p>
                        </div>
                    </div>
                    <div class="modal-pie">
                        <button class="boton-principal" onclick="sistemaReservas.cerrarModalVerResenia()">Cerrar</button>
                    </div>
                </div>
            </div>
            <style>
                .modal-resenia {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .modal-contenido {
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    width: 90%;
                    max-width: 500px;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                .modal-cabecera {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 10px;
                }
                .cerrar-modal {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                }
                .comentario-texto {
                    line-height: 1.6;
                    color: #333;
                }
                .modal-pie {
                    margin-top: 20px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
            </style>
        `;
        
        // Añadir al body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    cerrarModalVerResenia() {
        const modal = document.getElementById('modal-ver-resenia');
        if (modal) {
            modal.remove();
        }
    }

    async verificarYMostrarResenia(reservaId) {
        try {
            const token = localStorage.getItem('token_usuario');
            console.log('🔍 Verificando si puede dejar reseña para reserva:', reservaId);
            
            // Primero verificar si puede dejar reseña
            const respuesta = await fetch(
                `/proyectoWeb/viajeros_peru/backend/api/resenas.php?accion=verificar_puede_reseniar&reserva_id=${reservaId}&token=${token}`
            );
            
            const resultado = await respuesta.json();
            console.log('✅ Resultado verificación:', resultado);
            
            if (resultado.exito) {
                // Puede dejar reseña, mostrar modal
                this.mostrarModalResenia(reservaId, resultado.rol, resultado.destinatario_id);
            } else {
                // Mostrar mensaje específico según el error
                if (resultado.ya_califico) {
                    alert('❌ Ya dejaste una reseña para esta estancia');
                    // Recargar para actualizar la vista
                    this.cargarReservas();
                } else if (resultado.periodo_expirado) {
                    alert('❌ El período para dejar reseña ha expirado (30 días)');
                    // Recargar para actualizar la vista
                    this.cargarReservas();
                } else {
                    alert('❌ ' + resultado.error);
                }
            }
            
        } catch (error) {
            console.error('Error verificando reseña:', error);
            alert('❌ Error al verificar disponibilidad para reseña');
        }
    }

    mostrarModalResenia(reservaId, rolUsuario, destinatarioId) {
        // Crear modal dinámicamente
        const modalHTML = `
            <div class="modal-resenia" id="modal-resenia">
                <div class="modal-contenido">
                    <div class="modal-cabecera">
                        <h3>⭐ Dejar Reseña</h3>
                        <button class="cerrar-modal" onclick="sistemaReservas.cerrarModalResenia()">&times;</button>
                    </div>
                    <div class="modal-cuerpo">
                        <div class="calificacion">
                            <p><strong>Calificación:</strong></p>
                            <div class="estrellas" id="estrellas-calificacion">
                                <span class="estrella" data-valor="1">☆</span>
                                <span class="estrella" data-valor="2">☆</span>
                                <span class="estrella" data-valor="3">☆</span>
                                <span class="estrella" data-valor="4">☆</span>
                                <span class="estrella" data-valor="5">☆</span>
                            </div>
                            <input type="hidden" id="puntuacion-reserva-${reservaId}" value="5">
                        </div>
                        <div class="comentario">
                            <label for="comentario-reserva-${reservaId}"><strong>Comentario:</strong></label>
                            <textarea id="comentario-reserva-${reservaId}" rows="4" placeholder="Describe tu experiencia..."></textarea>
                        </div>
                        <div class="nota-importante">
                            <p><small>⚠️ Tu reseña será visible después de que ambas partes hayan calificado.</small></p>
                        </div>
                    </div>
                    <div class="modal-pie">
                        <button class="boton-secundario" onclick="sistemaReservas.cerrarModalResenia()">Cancelar</button>
                        <button class="boton-primario" onclick="sistemaReservas.enviarResenia(${reservaId}, ${destinatarioId})">Enviar Reseña</button>
                    </div>
                </div>
            </div>
            <style>
                .modal-resenia {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .modal-contenido {
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    width: 90%;
                    max-width: 500px;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                .modal-cabecera {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 10px;
                }
                .cerrar-modal {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                }
                .estrellas {
                    font-size: 30px;
                    cursor: pointer;
                }
                .estrella {
                    color: #ccc;
                    transition: color 0.2s;
                    cursor: pointer;
                    margin: 0 5px;
                }
                .estrella.seleccionada {
                    color: #ffc107;
                }
                textarea {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    resize: vertical;
                    margin-top: 5px;
                }
                .modal-pie {
                    margin-top: 20px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
            </style>
        `;
        
        // Añadir al body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Configurar estrellas interactivas
        this.configurarEstrellas(reservaId);
    }

    configurarEstrellas(reservaId) {
        const estrellas = document.querySelectorAll(`#modal-resenia .estrella`);
        const inputPuntuacion = document.getElementById(`puntuacion-reserva-${reservaId}`);
        
        estrellas.forEach(estrella => {
            estrella.addEventListener('mouseover', (e) => {
                const valor = parseInt(e.target.dataset.valor);
                this.resaltarEstrellasHasta(valor);
            });
            
            estrella.addEventListener('click', (e) => {
                const valor = parseInt(e.target.dataset.valor);
                inputPuntuacion.value = valor;
                this.resaltarEstrellasHasta(valor);
            });
        });
        
        // Al salir del contenedor, volver al valor seleccionado
        const contenedorEstrellas = document.getElementById('estrellas-calificacion');
        if (contenedorEstrellas) {
            contenedorEstrellas.addEventListener('mouseleave', () => {
                const valorActual = parseInt(inputPuntuacion.value);
                this.resaltarEstrellasHasta(valorActual);
            });
        }
        
        // Inicializar con 5 estrellas seleccionadas
        this.resaltarEstrellasHasta(5);
    }

    resaltarEstrellasHasta(valor) {
        const estrellas = document.querySelectorAll(`#modal-resenia .estrella`);
        estrellas.forEach((estrella, index) => {
            if (index < valor) {
                estrella.textContent = '★';
                estrella.style.color = '#ffc107';
                estrella.classList.add('seleccionada');
            } else {
                estrella.textContent = '☆';
                estrella.style.color = '#ccc';
                estrella.classList.remove('seleccionada');
            }
        });
    }

    cerrarModalResenia() {
        const modal = document.getElementById('modal-resenia');
        if (modal) {
            modal.remove();
        }
    }

    async enviarResenia(reservaId, destinatarioId) {
        const puntuacion = document.getElementById(`puntuacion-reserva-${reservaId}`).value;
        const comentario = document.getElementById(`comentario-reserva-${reservaId}`).value.trim();
        const token = localStorage.getItem('token_usuario');
        
        // Obtener el usuario actual
        const usuario = JSON.parse(localStorage.getItem('datos_usuario') || '{}');
        const autorId = usuario.id;
        
        console.log('📤 Enviando reseña...', { 
            reservaId, 
            destinatarioId, 
            autorId,
            puntuacion, 
            comentario: comentario.substring(0, 50) + '...' 
        });
        
        if (!comentario) {
            alert('Por favor, escribe un comentario');
            return;
        }
        
        if (puntuacion < 1 || puntuacion > 5) {
            alert('Por favor, selecciona una calificación válida');
            return;
        }
        
        if (!autorId) {
            alert('❌ Error: No se pudo identificar tu usuario. Por favor, inicia sesión nuevamente.');
            return;
        }
        
        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/resenas.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                    // ✅ Eliminar Authorization header si no usas JWT
                },
                body: JSON.stringify({
                    accion: 'crear',
                    reserva_id: reservaId,
                    autor_id: autorId,
                    destinatario_id: destinatarioId,
                    puntuacion: parseInt(puntuacion),
                    comentario: comentario
                })
            });
            
            const resultado = await respuesta.json();
            console.log('✅ Respuesta reseña:', resultado);
            
            if (resultado.exito) {
                alert('✅ Reseña enviada correctamente');
                this.cerrarModalResenia();
                this.cargarReservas(); // Recargar para actualizar estado
            } else {
                // ✅ Mostrar error detallado
                alert('❌ Error: ' + (resultado.error || 'No se pudo enviar la reseña'));
                console.error('Detalles del error:', resultado);
            }
            
        } catch (error) {
            console.error('Error enviando reseña:', error);
            alert('❌ Error de conexión al enviar la reseña');
        }
    }
    // ============================================
    // MÉTODOS EXISTENTES (no cambiar)
    // ============================================

    async actualizarEstado(reservaId, nuevoEstado) {
        if (!confirm(`¿Estás seguro de que quieres ${nuevoEstado === 'aceptada' ? 'aceptar' : nuevoEstado === 'rechazada' ? 'rechazar' : 'completar'} esta reserva?`)) {
            return;
        }

        try {
            const datos = {
                accion: 'actualizar_estado',
                id: reservaId,
                estado: nuevoEstado
            };

            if (this.usuario.rol === 'anfitrion') {
                datos.anfitrion_id = this.usuario.id;
            }

            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/reservas.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(datos)
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                alert(`✅ Reserva ${nuevoEstado} correctamente`);
                this.cargarReservas();
            } else {
                alert('❌ Error al actualizar la reserva: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error actualizando reserva:', error);
            alert('❌ Error al actualizar la reserva');
        }
    }

    async cancelarReserva(reservaId) {
        if (!confirm('¿Estás seguro de que quieres cancelar esta reserva?')) {
            return;
        }

        try {
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/reservas.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accion: 'cancelar',
                    id: reservaId,
                    viajero_id: this.usuario.id
                })
            });

            const resultado = await respuesta.json();

            if (resultado.exito) {
                alert('✅ Reserva cancelada correctamente');
                this.cargarReservas();
            } else {
                alert('❌ Error al cancelar la reserva: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error cancelando reserva:', error);
            alert('❌ Error al cancelar la reserva');
        }
    }

    configurarFiltros() {
        const botonesFiltro = document.querySelectorAll('.filtros-contenedor button');
        botonesFiltro.forEach(boton => {
            boton.addEventListener('click', () => {
                // Remover clase activa de todos los botones
                botonesFiltro.forEach(b => b.classList.remove('filtro-activo'));
                // Agregar clase activa al botón clickeado
                boton.classList.add('filtro-activo');
                // Actualizar filtro
                this.filtroActual = boton.dataset.estado;
                this.mostrarReservas(this.reservas);
            });
        });
    }

    // Utilidades
    formatearEstado(estado) {
        const estados = {
            'pendiente': '⏳ Pendiente',
            'aceptada': '✅ Aceptada',
            'rechazada': '❌ Rechazada',
            'cancelada': '🚫 Cancelada',
            'completada': '⭐ Completada'
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

    mostrarError(mensaje) {
        const contenedor = document.getElementById('contenido-reservas');
        contenedor.innerHTML = `
            <div class="error-carga">
                <p>❌ ${mensaje}</p>
                <button onclick="sistemaReservas.cargarReservas()" class="boton-primario">Reintentar</button>
            </div>
        `;
    }
}

// Función global para cerrar sesión
function cerrarSesion() {
    localStorage.removeItem('token_usuario');
    localStorage.removeItem('datos_usuario');
    window.location.href = '../auth/iniciar_sesion.html';
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.sistemaReservas = new SistemaReservas();
});