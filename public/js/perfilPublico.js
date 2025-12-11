// Script para manejar el perfil público
class ManejadorPerfilPublico {
    constructor() {
        this.usuarioId = null;
        this.perfil = null;
        this.usuarioActual = null;
        this.token = null;
        this.esFavorito = false;
        this.favoritoId = null;
        this.conversacionCargada = false;
        this.inicializar();
    }

    inicializar() {
        this.obtenerIdUsuario();
        this.verificarAutenticacion();
        this.cargarPerfilPublico();
        this.configurarManejadoresEventos();
        this.configurarResponsive();
    }

    obtenerIdUsuario() {
        const urlParams = new URLSearchParams(window.location.search);
        this.usuarioId = urlParams.get('id');
        
        if (!this.usuarioId) {
            this.mostrarError('ID de usuario no especificado');
            return;
        }
        console.log('👤 Cargando perfil público para usuario ID:', this.usuarioId);
    }

    verificarAutenticacion() {
        const datosUsuario = localStorage.getItem('datos_usuario');
        this.token = localStorage.getItem('token_usuario');
        
        if (!datosUsuario || !this.token) {
            this.usuarioActual = null;
            return;
        }

        try {
            this.usuarioActual = JSON.parse(datosUsuario);
            console.log('✅ Usuario actual cargado:', this.usuarioActual.id);
        } catch (error) {
            console.error('Error al parsear datos de usuario:', error);
            this.usuarioActual = null;
        }
    }

    async verificarSiEsFavorito() {
        if (!this.usuarioActual || !this.token) return;
        
        try {
            const resp = await fetch('/proyectoWeb/viajeros_peru/backend/api/favoritos.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: this.token,
                    accion: 'verificar_perfil',
                    usuario_favorito_id: this.usuarioId
                })
            });

            const datos = await resp.json();
            
            if (datos.exito) {
                this.esFavorito = datos.es_favorito;
                this.favoritoId = datos.favorito_id || null;
                this.actualizarBotonFavorito();
            }
        } catch (error) {
            console.error('Error al verificar favorito:', error);
        }
    }

    async cargarPerfilPublico() {
        try {
            if (!this.usuarioId) {
                throw new Error('No hay ID de usuario');
            }

            const urlAPI = '/proyectoWeb/viajeros_peru/backend/api/perfiles.php';
            const respuesta = await fetch(`${urlAPI}?accion=ver_publico&usuario_id=${this.usuarioId}`);

            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }

            const resultado = await respuesta.json();
            console.log('📊 Resultado perfil público:', resultado);

            if (resultado.exito && resultado.perfil) {
                this.perfil = this.procesarDatosPerfil(resultado.perfil);
                this.mostrarPerfilPublico();
                
                // Verificar si este perfil ya está en favoritos
                if (this.usuarioActual) {
                    await this.verificarSiEsFavorito();
                }
            } else {
                throw new Error(resultado.error || 'Perfil no encontrado');
            }

        } catch (error) {
            console.error('💥 Error cargando perfil público:', error);
            this.mostrarError('No se pudo cargar el perfil: ' + error.message);
        }
    }

    procesarDatosPerfil(perfil) {
        const habilidades = this.obtenerArrayDesdeCampo(perfil.habilidades);
        const idiomas = this.obtenerArrayDesdeCampo(perfil.idiomas);
        const intereses = this.obtenerArrayDesdeCampo(perfil.intereses);
        const redesSociales = this.obtenerArrayDesdeCampo(perfil.redes_sociales);
        const experienciasPrevias = this.obtenerArrayDesdeCampo(perfil.experiencias_previas);

        return {
            ...perfil,
            habilidades,
            idiomas,
            intereses,
            redes_sociales: redesSociales,
            experiencias_previas: experienciasPrevias
        };
    }

    obtenerArrayDesdeCampo(campo) {
        if (Array.isArray(campo)) {
            return campo;
        }
        
        if (typeof campo === 'string') {
            if (campo.trim() === '') {
                return [];
            }
            try {
                return JSON.parse(campo);
            } catch (e) {
                return campo.split(',').map(item => item.trim()).filter(item => item !== '');
            }
        }
        
        return [];
    }

    mostrarCalificacionEstrellas() {
        // Añadir calificación al header del perfil
        if (this.perfil.promedio_calificacion > 0) {
            const infoPrincipal = document.querySelector('.info-principal-publica');
            
            const calificacionDiv = document.createElement('div');
            calificacionDiv.className = 'calificacion-perfil';
            calificacionDiv.style.cssText = `
                display: flex;
                align-items: center;
                margin: 10px 0;
                background: #f8f9fa;
                padding: 8px 16px;
                border-radius: 20px;
                border: 1px solid #e0e0e0;
            `;
            
            const puntuacion = this.perfil.promedio_calificacion;
            const estrellasHTML = this.generarEstrellasHTML(puntuacion);
            
            calificacionDiv.innerHTML = `
                <div style="font-size: 24px; font-weight: bold; color: ${this.perfil.color_calificacion}; margin-right: 10px;">
                    ${puntuacion.toFixed(1)}
                </div>
                <div style="display: flex; align-items: center; margin-right: 10px;">
                    ${estrellasHTML}
                </div>
                <div style="color: #666; font-size: 14px;">
                    (${this.perfil.total_resenas} ${this.perfil.total_resenas === 1 ? 'reseña' : 'reseñas'})
                </div>
            `;
            
            // Insertar después del badge de rol
            const badgeRol = document.getElementById('badge-rol-publico');
            if (badgeRol && infoPrincipal) {
                infoPrincipal.insertBefore(calificacionDiv, badgeRol.nextSibling);
            }
        }
    }

    // Añade este método para generar las estrellas
    generarEstrellasHTML(puntuacion) {
        const estrellasLlenas = Math.floor(puntuacion);
        const mediaEstrella = (puntuacion - estrellasLlenas) >= 0.5;
        const estrellasVacias = 5 - estrellasLlenas - (mediaEstrella ? 1 : 0);
        
        let html = '';
        
        // Estrellas llenas
        for (let i = 0; i < estrellasLlenas; i++) {
            html += '<span style="color: #FFD700; font-size: 20px;">★</span>';
        }
        
        // Media estrella
        if (mediaEstrella) {
            html += '<span style="color: #FFD700; font-size: 20px; position: relative;">';
            html += '<span style="position: absolute; color: #ddd;">★</span>';
            html += '<span style="position: absolute; width: 50%; overflow: hidden; color: #FFD700;">★</span>';
            html += '</span>';
        }
        
        // Estrellas vacías
        for (let i = 0; i < estrellasVacias; i++) {
            html += '<span style="color: #ddd; font-size: 20px;">★</span>';
        }
        
        return html;
    }

    mostrarPerfilPublico() {
        if (!this.perfil) return;

        // Ocultar mensaje de carga
        document.getElementById('mensaje-carga').style.display = 'none';

        // Actualizar header
        this.actualizarHeaderPublico();

        // Mostrar calificación con estrellas
        this.mostrarCalificacionEstrellas();

        // Generar contenido del perfil
        this.generarContenidoPerfil();

        // Mostrar reseñas
        this.mostrarResenasEnPerfil();  // ← AÑADE ESTA LÍNEA

        // Configurar botones (en este orden)
        console.log('🔧 Configurando botones del perfil...');
        this.configurarBotonContacto();    // Primero verificar contacto
        this.configurarBotonFavoritos();   // Luego favoritos
        
        // Verificar si hay que mostrar también el modal antiguo
        this.verificarModalContactoAntiguo();
    }

    async cargarResenasUsuario() {
        try {
            console.log('📝 Cargando reseñas para usuario:', this.usuarioId);
            
            const respuesta = await fetch(`/proyectoWeb/viajeros_peru/backend/api/resenas.php?accion=obtener_por_usuario&usuario_id=${this.usuarioId}`);
            
            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }

            const resultado = await respuesta.json();
            
            if (resultado.exito) {
                return resultado.resenas || [];
            } else {
                console.warn('No se pudieron cargar las reseñas:', resultado.error);
                return [];
            }
        } catch (error) {
            console.error('Error cargando reseñas:', error);
            return [];
        }
    }

    generarEstrellasHTML(puntuacion) {
        const estrellasLlenas = Math.floor(puntuacion);
        const mediaEstrella = (puntuacion - estrellasLlenas) >= 0.5;
        const estrellasVacias = 5 - estrellasLlenas - (mediaEstrella ? 1 : 0);
        
        let html = '';
        
        // Estrellas llenas
        for (let i = 0; i < estrellasLlenas; i++) {
            html += '<span style="color: #FFD700; font-size: 20px;">★</span>';
        }
        
        // Media estrella
        if (mediaEstrella) {
            html += '<span style="color: #FFD700; font-size: 20px; position: relative;">';
            html += '<span style="position: absolute; color: #ddd;">★</span>';
            html += '<span style="position: absolute; width: 50%; overflow: hidden; color: #FFD700;">★</span>';
            html += '</span>';
        }
        
        // Estrellas vacías
        for (let i = 0; i < estrellasVacias; i++) {
            html += '<span style="color: #ddd; font-size: 20px;">★</span>';
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

    formatearFechaCompleta(fecha) {
        const fechaObj = new Date(fecha);
        return fechaObj.toLocaleDateString('es-PE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    configurarClickEnFotosResenas() {
        setTimeout(() => {
            const fotosAutores = document.querySelectorAll('.contenedor-foto-autor');
            const nombresAutores = document.querySelectorAll('.info-autor strong');
            
            // Para las fotos
            fotosAutores.forEach((foto, index) => {
                // Encontrar el elemento de reseña padre
                const resenaItem = foto.closest('.resena-item');
                if (resenaItem) {
                    // Obtener datos del autor (podrías almacenarlos en data attributes)
                    const autorNombre = resenaItem.querySelector('.info-autor strong')?.textContent;
                    
                    foto.addEventListener('click', (e) => {
                        e.preventDefault();
                        window.location.href = `perfilPublico.html?id=${autorId}`;
                    });
                }
            });
            
            // Para los nombres
            nombresAutores.forEach((nombre) => {
                nombre.style.cursor = 'pointer';
                nombre.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('Clic en nombre de autor:', nombre.textContent);
                    // Implementar redirección al perfil
                });
            });
        }, 500);
    }

    async mostrarResenasEnPerfil() {
        const resenas = await this.cargarResenasUsuario();
        
        if (resenas.length === 0) {
            // Si no hay reseñas, no mostrar nada o mostrar mensaje
            return;
        }
        
        // Crear sección de reseñas
        const seccionResenas = document.createElement('section');
        seccionResenas.className = 'seccion-perfil seccion-resenas';
        seccionResenas.innerHTML = this.generarHTMLResenas(resenas);
        
        // Insertar después de la última sección existente
        const gridPerfil = document.getElementById('contenido-perfil');
        if (gridPerfil) {
            gridPerfil.appendChild(seccionResenas);
            
            // Configurar clics en fotos (opcional)
            this.configurarClickEnFotosResenas();
        }
    }

    generarHTMLResenas(resenas) {
        // Calcular estadísticas
        const totalResenas = resenas.length;
        const promedio = resenas.reduce((sum, resena) => sum + resena.puntuacion, 0) / totalResenas;
        
        // Calcular distribución de estrellas
        const distribucion = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0};
        resenas.forEach(resena => distribucion[resena.puntuacion]++);
        
        // Generar HTML para la barra de distribución
        const barrasHTML = [5, 4, 3, 2, 1].map(estrellas => {
            const cantidad = distribucion[estrellas];
            const porcentaje = totalResenas > 0 ? (cantidad / totalResenas) * 100 : 0;
            
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
            const fechaCompleta = this.formatearFechaCompleta(resena.fecha_creacion);
            
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
                                <span class="fecha-resena" title="${fechaCompleta}">${fechaRelativa}</span>
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
                    ${resena.anuncio_titulo ? `
                    <div class="resena-contexto">
                        <small>↪ Estancia: ${resena.anuncio_titulo}</small>
                        ${resena.estancia_info ? `
                        <small>· ${resena.estancia_info.fecha_inicio} - ${resena.estancia_info.fecha_fin}</small>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        return `
            <h3>⭐ Reseñas (${totalResenas})</h3>
            <div class="contenedor-resenas">
                <div class="resumen-resenas">
                    <div class="calificacion-promedio">
                        <div class="numero-promedio">${promedio.toFixed(1)}</div>
                        <div class="estrellas-promedio">
                            ${this.generarEstrellasHTML(promedio)}
                        </div>
                        <div class="total-resenas">${totalResenas} ${totalResenas === 1 ? 'reseña' : 'reseñas'}</div>
                    </div>
                    <div class="distribucion-resenas">
                        ${barrasHTML}
                    </div>
                </div>
                
                <div class="lista-resenas">
                    ${reseñasHTML}
                </div>
            </div>
        `;
    }

    // Método auxiliar para escapar HTML
    escaparHTML(texto) {
        if (!texto) return '';
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    verificarModalContactoAntiguo() {
        const modalContacto = document.getElementById('modal-contacto');
        if (modalContacto) {
            // Ocultar modal antiguo si el usuario está viendo su propio perfil
            const usuarioActualId = this.usuarioActual ? parseInt(this.usuarioActual.id) : null;
            const perfilId = this.usuarioId ? parseInt(this.usuarioId) : null;
            
            if (usuarioActualId === perfilId) {
                modalContacto.style.display = 'none';
                console.log('❌ Ocultando modal antiguo de contacto (propio perfil)');
            }
        }
    }

    actualizarHeaderPublico() {
        // Nombre completo CON ICONO DE VERIFICACIÓN
        const nombreElement = document.getElementById('nombre-completo-publico');
        let nombreHTML = this.perfil.nombre_completo || 'Usuario de Viajeros Perú';
        
        // Agregar icono de verificación si está verificado
        if (this.perfil.estado_verificacion === 'verificado') {
            nombreHTML += ' <span class="badge-verificado" title="Usuario verificado">✓</span>';
        }
        
        nombreElement.innerHTML = nombreHTML;

        // Rol
        const rolTexto = this.perfil.rol === 'viajero' ? 'Viajero' : 
                        this.perfil.rol === 'anfitrion' ? 'Anfitrión' : 'Usuario';
        document.getElementById('badge-rol-publico').textContent = rolTexto;

        // Biografía
        const bioElement = document.getElementById('bio-usuario-publica');
        if (this.perfil.biografia && this.perfil.biografia.trim() !== '') {
            bioElement.textContent = this.perfil.biografia;
            bioElement.style.fontStyle = 'normal';
        } else {
            bioElement.textContent = 'Este usuario aún no ha agregado una biografía.';
            bioElement.style.fontStyle = 'italic';
        }

        // Foto de perfil
        const imgPerfil = document.getElementById('imagen-perfil-publica');
        if (this.perfil.foto_perfil) {
            imgPerfil.src = this.perfil.foto_perfil;
        }

        // Estadísticas
        document.getElementById('contador-resenas-publico').textContent = this.perfil.total_resenas || 0;
        document.getElementById('contador-estancias-publico').textContent = this.perfil.total_estancias || 0;
        document.getElementById('contador-anuncios-publico').textContent = this.perfil.total_anuncios || 0;
    }

    generarContenidoPerfil() {
        const contenedor = document.getElementById('contenido-perfil');
        
        const contenidoHTML = `
            <!-- Ubicación -->
            <section class="seccion-perfil">
                <h3>📍 Ubicación</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <label>País</label>
                        <p>${this.perfil.pais || 'No especificado'}</p>
                    </div>
                    <div class="info-item">
                        <label>Ciudad</label>
                        <p>${this.perfil.ciudad || 'No especificada'}</p>
                    </div>
                    <div class="info-item">
                        <label>Dirección</label>
                        <p>${this.perfil.ubicacion || 'No especificada'}</p>
                    </div>
                </div>
            </section>

            <!-- Información Personal -->
            <section class="seccion-perfil">
                <h3>👤 Información Personal</h3>
                <div class="info-grid">
                    ${this.perfil.fecha_nacimiento ? `
                    <div class="info-item">
                        <label>Edad</label>
                        <p>${this.perfil.edad || this.calcularEdad(this.perfil.fecha_nacimiento)} años</p>
                    </div>
                    ` : ''}
                    <div class="info-item">
                        <label>Miembro desde</label>
                        <p>${this.formatearFecha(this.perfil.fecha_creacion)}</p>
                    </div>
                    ${this.perfil.estado_verificacion_display ? `
                    <div class="info-item">
                        <label>Verificación</label>
                        <div class="badge ${this.perfil.estado_verificacion_display.clase}">
                            ${this.perfil.estado_verificacion_display.icono} ${this.perfil.estado_verificacion_display.texto}
                        </div>
                    </div>
                    ` : ''}
                    ${this.perfil.promedio_calificacion > 0 ? `
                    <div class="info-item">
                        <label>Calificación promedio</label>
                        <div class="calificacion-item">
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <span style="font-weight: bold; color: ${this.perfil.color_calificacion}">
                                    ${this.perfil.promedio_calificacion.toFixed(1)}
                                </span>
                                <div style="display: flex; align-items: center;">
                                    ${this.generarEstrellasHTML(this.perfil.promedio_calificacion)}
                                </div>
                                <span style="font-size: 12px; color: #666;">
                                    (${this.perfil.total_resenas} ${this.perfil.total_resenas === 1 ? 'reseña' : 'reseñas'})
                                </span>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </section>

            <!-- Habilidades -->
            <section class="seccion-perfil">
                <h3>🛠️ Habilidades</h3>
                <div class="lista-habilidades">
                    ${this.generarListaBadges(this.perfil.habilidades, 'habilidades')}
                </div>
            </section>

            <!-- Idiomas -->
            <section class="seccion-perfil">
                <h3>🗣️ Idiomas</h3>
                <div class="lista-idiomas">
                    ${this.generarListaBadges(this.perfil.idiomas, 'idiomas')}
                </div>
            </section>

            <!-- Intereses -->
            <section class="seccion-perfil">
                <h3>🎯 Intereses</h3>
                <div class="lista-intereses">
                    ${this.generarListaBadges(this.perfil.intereses, 'intereses')}
                </div>
            </section>

            <!-- Experiencias Previas -->
            ${this.perfil.experiencias_previas && this.perfil.experiencias_previas.length > 0 ? `
            <section class="seccion-perfil">
                <h3>📚 Experiencias Previas</h3>
                <div class="lista-experiencias">
                    ${this.generarListaExperiencias(this.perfil.experiencias_previas)}
                </div>
            </section>
            ` : ''}

            <!-- Redes Sociales -->
            ${this.perfil.redes_sociales && this.perfil.redes_sociales.length > 0 ? `
            <section class="seccion-perfil">
                <h3>🌐 Redes Sociales</h3>
                <div class="lista-redes-sociales">
                    ${this.generarListaBadges(this.perfil.redes_sociales, 'red-social')}
                </div>
            </section>
            ` : ''}

            <!-- Disponibilidad -->
            <section class="seccion-perfil">
                <h3>📅 Disponibilidad</h3>
                <div class="info-disponibilidad">
                    ${this.generarBadgeDisponibilidad(this.perfil.disponibilidad)}
                </div>
            </section>
        `;

        contenedor.innerHTML = contenidoHTML;
    }

    // MÉTODOS AUXILIARES FALTANTES
    generarListaBadges(items, tipo) {
        if (!items || items.length === 0) {
            return '<div class="sin-datos">No se han agregado ' + this.obtenerNombrePlural(tipo) + '</div>';
        }

        const etiquetas = this.obtenerEtiquetas();
        const tipoSingular = this.obtenerSingular(tipo);
        return items.map(item => {
            const etiqueta = etiquetas[tipo]?.[item] || this.formatearTexto(item);
            return `<div class="badge-${tipoSingular}">${etiqueta}</div>`;
        }).join('');
    }

    obtenerSingular(tipo) {
        if (tipo === 'habilidades') return 'habilidad';
        if (tipo === 'intereses') return 'interes';
        if (tipo.endsWith('s')) return tipo.slice(0, -1);
        return tipo;
    }

    generarListaExperiencias(experiencias) {
        if (!experiencias || experiencias.length === 0) {
            return '<div class="sin-datos">No se han agregado experiencias previas</div>';
        }

        return experiencias.map(exp => 
            `<div class="experiencia-item">${exp}</div>`
        ).join('');
    }

    generarBadgeDisponibilidad(disponibilidad) {
        if (!disponibilidad) {
            return '<div class="sin-datos">No se ha especificado disponibilidad</div>';
        }

        const opciones = {
            'siempre': '🟢 Siempre disponible',
            'fines_semana': '📅 Fines de semana',
            'temporal': '⏰ Disponibilidad temporal',
            'fechas_especificas': '📋 Fechas específicas',
            'no_disponible': '🔴 No disponible por ahora'
        };

        const texto = opciones[disponibilidad] || this.formatearTexto(disponibilidad);
        return `<div class="badge-disponibilidad">${texto}</div>`;
    }

    obtenerNombrePlural(tipo) {
        const plurales = {
            'habilidades': 'habilidades',
            'idiomas': 'idiomas', 
            'intereses': 'intereses',
            'redes_sociales': 'redes sociales',
            'experiencias_previas': 'experiencias previas'
        };
        return plurales[tipo] || tipo;
    }

    calcularEdad(fechaNacimiento) {
        if (!fechaNacimiento) return 'No especificada';
        const nacimiento = new Date(fechaNacimiento);
        const hoy = new Date();
        const edad = hoy.getFullYear() - nacimiento.getFullYear();
        const mes = hoy.getMonth() - nacimiento.getMonth();
        return (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) ? edad - 1 : edad;
    }

    formatearFecha(fecha) {
        if (!fecha) return 'No disponible';
        try {
            return new Date(fecha).toLocaleDateString('es-PE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return fecha;
        }
    }

    formatearTexto(texto) {
        if (!texto || typeof texto !== 'string') return texto;
        return texto.charAt(0).toUpperCase() + texto.slice(1).replace(/_/g, ' ');
    }

    obtenerEtiquetas() {
        return {
            habilidades: {
                'ensenanza': 'Enseñanza',
                'cocina': 'Cocina',
                'agricultura': 'Agricultura',
                'construccion': 'Construcción',
                'jardineria': 'Jardinería',
                'ninos': 'Cuidado de Niños',
                'animales': 'Cuidado de Animales',
                'idiomas': 'Enseñanza de Idiomas',
                'manualidades': 'Manualidades',
                'tecnologia': 'Tecnología'
            },
            idiomas: {
                'espanol': 'Español',
                'ingles': 'Inglés',
                'quechua': 'Quechua',
                'aimara': 'Aimara',
                'portugues': 'Portugués',
                'frances': 'Francés',
                'aleman': 'Alemán',
                'italiano': 'Italiano'
            },
            intereses: {
                'cultura': 'Cultura Local',
                'naturaleza': 'Naturaleza',
                'gastronomia': 'Gastronomía',
                'aventura': 'Aventura',
                'voluntariado': 'Voluntariado',
                'aprendizaje': 'Aprendizaje',
                'deportes': 'Deportes',
                'musica': 'Música',
                'arte': 'Arte'
            },
            redes_sociales: {
                'facebook': 'Facebook',
                'instagram': 'Instagram',
                'twitter': 'Twitter/X',
                'linkedin': 'LinkedIn',
                'whatsapp': 'WhatsApp',
                'telegram': 'Telegram'
            }
        };
    }

    configurarBotonFavoritos() {
        // Solo mostrar botón de favoritos si el usuario está autenticado y no es su propio perfil
        const usuarioActualId = this.usuarioActual ? parseInt(this.usuarioActual.id) : null;
        const perfilId = this.usuarioId ? parseInt(this.usuarioId) : null;
        
        if (this.usuarioActual && usuarioActualId !== perfilId) {
            const accionesContenedor = document.querySelector('.acciones-perfil-publico');
            
            if (!accionesContenedor) {
                console.warn('⚠️ No se encontró el contenedor de acciones');
                return;
            }
            
            // Verificar si ya existe el botón
            let botonFavorito = document.getElementById('boton-favorito');
            
            if (!botonFavorito) {
                // Crear botón de favoritos
                botonFavorito = document.createElement('button');
                botonFavorito.id = 'boton-favorito';
                botonFavorito.className = this.esFavorito ? 'boton-principal activo-favorito' : 'boton-principal';
                botonFavorito.innerHTML = this.esFavorito ? 
                    '<span aria-hidden="true">❤️</span> En favoritos' : 
                    '<span aria-hidden="true">🤍</span> Agregar a favoritos';
                
                botonFavorito.addEventListener('click', () => this.toggleFavorito());
                botonFavorito.style.marginLeft = '10px';
                
                // Insertar antes del botón "Volver" que es el último
                const botonVolver = accionesContenedor.querySelector('button:last-child');
                if (botonVolver) {
                    accionesContenedor.insertBefore(botonFavorito, botonVolver);
                } else {
                    accionesContenedor.appendChild(botonFavorito);
                }
                
                console.log('✅ Botón favoritos creado');
            } else {
                // Actualizar botón existente
                this.actualizarBotonFavorito();
            }
        } else {
            // Ocultar botón si existe
            const botonFavorito = document.getElementById('boton-favorito');
            if (botonFavorito) {
                botonFavorito.style.display = 'none';
            }
        }
    }

    actualizarBotonFavorito() {
        const boton = document.getElementById('boton-favorito');
        if (!boton) return;
        
        boton.className = this.esFavorito ? 'boton-principal activo-favorito' : 'boton-principal';
        boton.innerHTML = this.esFavorito ? 
            '<span aria-hidden="true">❤️</span> En favoritos' : 
            '<span aria-hidden="true">🤍</span> Agregar a favoritos';
    }

    async toggleFavorito() {
        if (!this.token) {
            this.mostrarError('Debes iniciar sesión para agregar a favoritos');
            return;
        }

        if (this.usuarioActual.id == this.usuarioId) {
            this.mostrarError('No puedes agregarte a ti mismo a favoritos');
            return;
        }

        try {
            if (this.esFavorito && this.favoritoId) {
                // Eliminar de favoritos
                const resp = await fetch('/proyectoWeb/viajeros_peru/backend/api/favoritos.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        token: this.token,
                        accion: 'eliminar',
                        favorito_id: this.favoritoId
                    })
                });

                const datos = await resp.json();
                
                if (datos.exito) {
                    this.esFavorito = false;
                    this.favoritoId = null;
                    this.actualizarBotonFavorito();
                    this.mostrarMensaje('Eliminado de favoritos');
                } else {
                    this.mostrarError(datos.error || 'Error al eliminar de favoritos');
                }
            } else {
                // Agregar a favoritos
                const resp = await fetch('/proyectoWeb/viajeros_peru/backend/api/favoritos.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        token: this.token,
                        accion: 'agregar',
                        usuario_favorito_id: this.usuarioId
                    })
                });

                const datos = await resp.json();
                
                if (datos.exito) {
                    this.esFavorito = true;
                    this.favoritoId = datos.favorito_id;
                    this.actualizarBotonFavorito();
                    this.mostrarMensaje('Agregado a favoritos');
                } else {
                    this.mostrarError(datos.error || 'Error al agregar a favoritos');
                }
            }
        } catch (error) {
            console.error('Error al gestionar favorito:', error);
            this.mostrarError('Error al gestionar favoritos');
        }
    }

    configurarBotonContacto() {
        const botonContactar = document.getElementById('boton-contactar');
        
        if (!botonContactar) {
            console.warn('⚠️ No se encontró el botón de contacto');
            return;
        }
        
        // Convertir IDs a números para comparación consistente
        const usuarioActualId = this.usuarioActual ? parseInt(this.usuarioActual.id) : null;
        const perfilId = this.usuarioId ? parseInt(this.usuarioId) : null;
        
        console.log('👤 Comparando IDs:', {
            usuarioActualId: usuarioActualId,
            perfilId: perfilId,
            tieneToken: !!this.token,
            tieneUsuarioActual: !!this.usuarioActual
        });
        
        // Mostrar botón solo si:
        // 1. El usuario está autenticado
        // 2. NO es su propio perfil
        // 3. El perfil cargado es válido
        if (this.token && this.usuarioActual && usuarioActualId !== perfilId) {
            botonContactar.style.display = 'block';
            console.log('✅ Mostrando botón Contactar');
        } else {
            botonContactar.style.display = 'none';
            let razon = '';
            
            if (!this.token || !this.usuarioActual) {
                razon = 'Usuario no autenticado';
            } else if (usuarioActualId === perfilId) {
                razon = 'Es su propio perfil';
            }
            
            console.log(`❌ Ocultando botón Contactar: ${razon}`);
        }
    }

    configurarManejadoresEventos() {
        // Botón de contacto
        const botonContactar = document.getElementById('boton-contactar');
        if (botonContactar) {
            botonContactar.addEventListener('click', () => {
                this.abrirModalMensajeria();
            });
        }

        // Formulario de contacto (modal antiguo)
        const formularioContacto = document.getElementById('formulario-contacto');
        if (formularioContacto) {
            formularioContacto.addEventListener('submit', (e) => {
                e.preventDefault();
                this.enviarMensajeContacto(); // Método antiguo - puedes mantenerlo o reemplazarlo
            });
        }
    }

    // Método para abrir el modal de mensajería
    abrirModalMensajeria() {
        // Verificar que el perfil esté cargado
        if (!this.perfil) {
            console.error('Perfil no cargado');
            return;
        }
        
        // Verificar autenticación
        if (!this.token || !this.usuarioActual) {
            this.mostrarError('Debes iniciar sesión para enviar mensajes');
            setTimeout(() => {
                window.location.href = '../../auth/iniciar_sesion.html';
            }, 2000);
            return;
        }
        
        // Verificar que no sea el propio perfil
        const usuarioActualId = parseInt(this.usuarioActual.id);
        const perfilId = parseInt(this.usuarioId);
        
        if (usuarioActualId === perfilId) {
            this.mostrarError('No puedes enviarte mensajes a ti mismo');
            return;
        }
        
        console.log('💬 Abriendo modal de mensajería para:', this.perfil.nombre_completo);

        // Crear modal dinámicamente
        const modalHTML = `
            <div class="modal-mensajeria" id="modal-mensajeria">
                <div class="modal-contenido">
                    <div class="modal-cabecera">
                        <h3>💬 Mensaje a ${this.perfil.nombre_completo}</h3>
                        <button class="cerrar-modal" onclick="manejadorPerfilPublico.cerrarModalMensajeria()">&times;</button>
                    </div>
                    <div class="modal-cuerpo">
                        <div class="conversacion-mensajes" id="conversacion-mensajes">
                            <div class="mensaje-sistema">
                                💡 Puedes enviar un mensaje a ${this.perfil.nombre.split(' ')[0]} para saludar, preguntar sobre sus experiencias, o coordinar una futura colaboración.
                            </div>
                        </div>
                        <div class="formulario-mensaje">
                            <textarea 
                                id="texto-mensaje" 
                                placeholder="Escribe tu mensaje aquí..." 
                                rows="3"
                            ></textarea>
                            <button onclick="manejadorPerfilPublico.enviarMensaje()" 
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
        
        // Configurar evento para enviar con Enter
        const textarea = document.getElementById('texto-mensaje');
        if (textarea) {
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.enviarMensaje();
                }
            });
            textarea.focus(); // Enfocar automáticamente
        }
    }

    // Método para cerrar el modal
    cerrarModalMensajeria() {
        const modal = document.getElementById('modal-mensajeria');
        if (modal) {
            modal.remove();
        }
        this.conversacionCargada = false;
    }

    // Método para cargar la conversación existente
    async cargarConversacion() {
        if (this.conversacionCargada) return;
        
        try {
            if (!this.token || !this.usuarioActual) {
                throw new Error('Usuario no autenticado');
            }

            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/mensajes.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    accion: 'obtener_conversacion',
                    usuario1: this.usuarioActual.id,
                    usuario2: this.usuarioId,
                    anuncio_id: null,  // ← IMPORTANTE: null para mensajes directos
                    pagina: 1,
                    limite: 50
                })
            });

            const resultado = await respuesta.json();
            console.log('📨 Respuesta API mensajes:', resultado);

            if (resultado.exito) {
                // ADAPTAR la respuesta del API para que funcione con tu código
                let mensajes = [];
                
                // Manejar ambas estructuras posibles
                if (resultado.data && resultado.data.mensajes) {
                    // Estructura usada en mensajes.html
                    mensajes = resultado.data.mensajes;
                } else if (resultado.mensajes) {
                    // Estructura más simple (si la API la devuelve)
                    mensajes = resultado.mensajes;
                }
                
                console.log(`📩 Cargando ${mensajes.length} mensajes`);
                this.mostrarMensajes(mensajes);
                this.conversacionCargada = true;
            } else {
                console.log('No hay conversación previa o error:', resultado.error);
                // No mostrar error, solo dejar vacío
            }
        } catch (error) {
            console.error('Error cargando conversación:', error);
            // No mostrar error al usuario, solo log
        }
    }

    // Método para procesar la respuesta del API
    procesarRespuestaMensajes(respuesta) {
        // El API mensajes.php devuelve {exito: true, data: {mensajes: [], paginacion: {}}}
        // Necesitamos adaptarlo a la estructura que espera mostrarMensajes()
        
        if (respuesta.exito && respuesta.data) {
            return respuesta.data.mensajes || [];
        } else if (respuesta.exito && respuesta.mensajes) {
            return respuesta.mensajes;
        }
        return [];
    }

    // Método mejorado para mostrar mensajes
    mostrarMensajes(mensajes) {
        const contenedor = document.getElementById('conversacion-mensajes');
        if (!contenedor) return;

        // Asegurar que mensajes sea un array
        if (!Array.isArray(mensajes)) {
            mensajes = this.procesarRespuestaMensajes(mensajes);
        }

        // Mantener solo el mensaje del sistema
        const mensajesExistentes = contenedor.querySelectorAll('.mensaje-chat, .mensaje-sistema');
        mensajesExistentes.forEach(msg => {
            if (!msg.classList.contains('mensaje-sistema')) {
                msg.remove();
            }
        });

        if (mensajes && mensajes.length > 0) {
            // Ordenar por fecha (más antiguo primero)
            mensajes.sort((a, b) => new Date(a.fecha_creacion) - new Date(b.fecha_creacion));
            
            mensajes.forEach(mensaje => {
                const esPropio = mensaje.remitente_id == this.usuarioActual.id;
                const claseMensaje = esPropio ? 'mensaje-propio' : 'mensaje-recibido';
                
                const mensajeHTML = `
                    <div class="mensaje-chat ${claseMensaje}" data-mensaje-id="${mensaje.id}">
                        <div class="contenido-mensaje">
                            <p>${this.escaparHTML(mensaje.contenido)}</p>
                            <span class="hora-mensaje">${this.formatearHora(mensaje.fecha_creacion)}</span>
                        </div>
                    </div>
                `;
                
                contenedor.insertAdjacentHTML('beforeend', mensajeHTML);
            });
        } else {
            // Mostrar mensaje si no hay conversación
            const noMensajesHTML = `
                <div class="mensaje-sin-conversacion">
                    💬 Esta es la primera vez que hablas con ${this.perfil.nombre.split(' ')[0]}. 
                    ¡Envía un mensaje para iniciar la conversación!
                </div>
            `;
            
            const mensajeSistema = contenedor.querySelector('.mensaje-sistema');
            if (mensajeSistema) {
                mensajeSistema.insertAdjacentHTML('afterend', noMensajesHTML);
            } else {
                contenedor.insertAdjacentHTML('beforeend', noMensajesHTML);
            }
        }

        // Scroll al final
        setTimeout(() => {
            contenedor.scrollTop = contenedor.scrollHeight;
        }, 100);
    }

    // Método para enviar mensaje
    async enviarMensaje() {
        const input = document.getElementById('texto-mensaje');
        const contenido = input.value.trim();

        if (!contenido) {
            this.mostrarErrorModal('📝 Escribe un mensaje antes de enviar');
            return;
        }

        if (!this.token || !this.usuarioActual) {
            this.mostrarErrorModal('Debes iniciar sesión para enviar mensajes');
            return;
        }

        if (this.usuarioActual.id == this.usuarioId) {
            this.mostrarErrorModal('No puedes enviarte mensajes a ti mismo');
            return;
        }

        try {
            const mensajeData = {
                accion: 'enviar',
                remitente_id: this.usuarioActual.id,
                destinatario_id: this.usuarioId,
                anuncio_id: null,  // ← IMPORTANTE: null para mensajes directos
                contenido: contenido
            };

            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/mensajes.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(mensajeData)
            });

            const resultado = await respuesta.json();
            console.log('✅ Resultado enviar mensaje:', resultado);

            if (resultado.exito) {
                input.value = '';
                
                // AGREGAR el mensaje enviado a la conversación
                // Primero construir un objeto de mensaje similar al que devuelve la API
                const nuevoMensaje = {
                    id: resultado.mensaje_id || Date.now(), // Usar ID real o temporal
                    remitente_id: this.usuarioActual.id,
                    destinatario_id: this.usuarioId,
                    contenido: contenido,
                    fecha_creacion: new Date().toISOString(),
                    // Agregar datos de usuario si están disponibles
                    remitente_nombre: this.usuarioActual.nombre || 'Tú',
                    remitente_apellido: this.usuarioActual.apellido || '',
                    estado: 'enviado'
                };
                
                // Agregar a la conversación
                this.agregarMensajeALaConversacion(nuevoMensaje, true);
                
                this.mostrarMensajeExitoModal('✅ Mensaje enviado correctamente');
                
                // Recargar la conversación completa después de un momento
                setTimeout(() => {
                    this.conversacionCargada = false; // Forzar recarga
                    this.cargarConversacion();
                }, 1000);
                
            } else {
                let mensajeError = resultado.error || 'No se pudo enviar el mensaje';
                
                // Mensajes de error más específicos
                if (mensajeError.includes('bloqueado')) {
                    mensajeError = '🚫 No puedes enviar mensajes a este usuario. Está bloqueado.';
                } else if (mensajeError.includes('contenido')) {
                    mensajeError = '⚠️ ' + mensajeError;
                }
                
                this.mostrarErrorModal('❌ ' + mensajeError);
            }
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            this.mostrarErrorModal('❌ Error de conexión al enviar mensaje');
        }
    }

    // Método auxiliar para agregar mensaje a la conversación
    agregarMensajeALaConversacion(mensaje, esPropio) {
        const contenedor = document.getElementById('conversacion-mensajes');
        if (!contenedor) return;

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
        
        // Scroll al final
        setTimeout(() => {
            contenedor.scrollTop = contenedor.scrollHeight;
        }, 100);
    }

    // Método para formatear hora
    formatearHora(fechaStr) {
        try {
            const fecha = new Date(fechaStr);
            return fecha.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
        } catch (e) {
            return 'Ahora';
        }
    }

    // Método para escapar HTML
    escaparHTML(texto) {
        if (!texto) return '';
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    // Método para mostrar errores en el modal
    mostrarErrorModal(mensaje) {
        const contenedor = document.getElementById('conversacion-mensajes');
        if (contenedor) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'mensaje-error-modal';
            errorDiv.style.cssText = 'background: #ffebee; color: #c62828; padding: 8px 12px; border-radius: 4px; margin: 10px 0; font-size: 14px;';
            errorDiv.textContent = mensaje;
            contenedor.appendChild(errorDiv);
            
            setTimeout(() => errorDiv.remove(), 3000);
        }
    }

    // Método para mostrar mensajes de éxito en el modal
    mostrarMensajeExitoModal(mensaje) {
        const contenedor = document.getElementById('conversacion-mensajes');
        if (contenedor) {
            const successDiv = document.createElement('div');
            successDiv.className = 'mensaje-exito-modal';
            successDiv.style.cssText = 'background: #e8f5e9; color: #2e7d32; padding: 8px 12px; border-radius: 4px; margin: 10px 0; font-size: 14px;';
            successDiv.textContent = mensaje;
            contenedor.appendChild(successDiv);
            
            setTimeout(() => successDiv.remove(), 2000);
        }
    }

    // Mantén el método antiguo para compatibilidad (opcional)
    async enviarMensajeContacto() {
        const mensaje = document.getElementById('mensaje-contacto').value.trim();
        
        if (!mensaje) {
            alert('Por favor, escribe un mensaje');
            return;
        }

        try {
            // Aquí podrías mantener la funcionalidad antigua si quieres
            // O redirigir al nuevo sistema
            this.cerrarModalContacto();
            this.abrirModalMensajeria();
            
            // Pre-cargar el mensaje en el nuevo modal
            setTimeout(() => {
                const input = document.getElementById('texto-mensaje');
                if (input) {
                    input.value = mensaje;
                    input.focus();
                }
            }, 500);
            
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            alert('Error al enviar el mensaje');
        }
    }

    mostrarModalContacto() {
        document.getElementById('modal-nombre-usuario').textContent = this.perfil.nombre_completo;
        document.getElementById('modal-contacto').style.display = 'block';
    }

    async enviarMensajeContacto() {
        // Implementar envío de mensaje
        alert('Funcionalidad de contacto en desarrollo');
        this.cerrarModalContacto();
    }

    cerrarModalContacto() {
        document.getElementById('modal-contacto').style.display = 'none';
        document.getElementById('mensaje-contacto').value = '';
    }

    configurarResponsive() {
        // Manejar cambios de tamaño de pantalla
        window.addEventListener('resize', () => {
            this.ajustarVistaResponsive();
        });
        
        // Ejecutar al cargar
        this.ajustarVistaResponsive();
    }

    ajustarVistaResponsive() {
        const anchoPantalla = window.innerWidth;
        const header = document.getElementById('header-perfil');
        
        if (anchoPantalla <= 768) {
            // Optimizaciones para móviles
            if (header) header.classList.add('modo-movil');
        } else {
            if (header) header.classList.remove('modo-movil');
        }
    }

    mostrarMensaje(mensaje) {
        // Crear y mostrar mensaje temporal
        const mensajeDiv = document.createElement('div');
        mensajeDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 24px;
            border-radius: 4px;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        mensajeDiv.textContent = '✅ ' + mensaje;
        document.body.appendChild(mensajeDiv);
        
        setTimeout(() => mensajeDiv.remove(), 3000);
    }

    mostrarError(mensaje) {
        // Mostrar mensaje de error en el contenedor designado
        const errorElement = document.getElementById('mensaje-error');
        const textoError = document.getElementById('texto-error');
        
        if (errorElement && textoError) {
            textoError.textContent = mensaje;
            errorElement.style.display = 'block';
        } else {
            // Si no existe el contenedor, crear uno temporal
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #f44336;
                color: white;
                padding: 12px 24px;
                border-radius: 4px;
                z-index: 1000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            `;
            errorDiv.textContent = '❌ ' + mensaje;
            document.body.appendChild(errorDiv);
            
            setTimeout(() => errorDiv.remove(), 3000);
        }
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    window.manejadorPerfilPublico = new ManejadorPerfilPublico();
});