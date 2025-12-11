// public/js/busqueda.js
console.log('🗺️ Cargando módulo de búsqueda con mapa...');

// Clase para manejar el mapa de Perú CON CLUSTERING
class MapaPeru {
    constructor() {
        this.mapa = null;
        this.marcadores = [];
        this.clusterGroup = null;
        this.inicializarMapa();
    }

    inicializarMapa() {
        console.log('🗺️ Inicializando mapa de Perú...');
        
        // Verificar que Leaflet esté cargado
        if (typeof L === 'undefined') {
            console.error('❌ Leaflet no está cargado');
            return;
        }

        // Verificar que MarkerCluster esté disponible
        if (typeof L.markerClusterGroup === 'undefined') {
            console.error('❌ Leaflet.markercluster no está cargado');
            // Fallback: usar grupo normal sin clustering
            console.log('🔄 Usando grupo normal sin clustering');
        }
        
        // Configurar límites de Perú aproximadamente
        const boundsPeru = L.latLngBounds(
            L.latLng(-18.3518, -81.3281), // Esquina sudoeste
            L.latLng(0.0384, -68.6531)    // Esquina noreste
        );

        // Crear mapa centrado en Perú con límites
        this.mapa = L.map('mapa-peru', {
            center: [-9.1900, -75.0152],
            zoom: 6,
            minZoom: 5,
            maxZoom: 15,
            maxBounds: boundsPeru,
            maxBoundsViscosity: 1.0 // Fuerza a mantenerse dentro de los límites
        });

        // Capa base de OpenStreetMap con mejor configuración
        // Usar una capa más ligera / performante (CartoDB Positron) para mejorar carga de tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors &middot; &copy; <a href="https://carto.com/">CARTO</a>',
            minZoom: 5,
            maxZoom: 15,
            bounds: boundsPeru,
            reuseTiles: true,
            updateWhenIdle: true,
            detectRetina: true
        }).addTo(this.mapa);

        // Crear grupo para los marcadores (con clustering si está disponible)
        if (typeof L.markerClusterGroup !== 'undefined') {
            this.clusterGroup = L.markerClusterGroup({
                chunkedLoading: true,
                chunkInterval: 100,
                disableClusteringAtZoom: 16,
                maxClusterRadius: 80,
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: true,
                zoomToBoundsOnClick: true,
                iconCreateFunction: function(cluster) {
                    const count = cluster.getChildCount();
                    let size = 'small';
                    
                    if (count > 10) size = 'large';
                    else if (count > 5) size = 'medium';
                    
                    return L.divIcon({
                        html: '<div><span>' + count + '</span></div>',
                        className: 'marker-cluster marker-cluster-' + size,
                        iconSize: L.point(40, 40)
                    });
                }
            });
            console.log('✅ Clustering activado');
        } else {
            // Fallback: usar FeatureGroup normal
            this.clusterGroup = L.featureGroup();
            console.log('⚠️ Usando grupo normal (clustering no disponible)');
        }

        this.clusterGroup.addTo(this.mapa);
        console.log('✅ Mapa de Perú inicializado');
    }

    limpiarMarcadores() {
        if (this.clusterGroup) {
            this.clusterGroup.clearLayers();
        }
        this.marcadores = [];
    }

        agregarMarcador(anuncio) {
        let lat = parseFloat(anuncio.latitud);
        let lng = parseFloat(anuncio.longitud);

        // Si no hay coordenadas válidas en BD, geocodificar
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
            console.debug('🧭 Coordenadas faltantes o inválidas para anuncio', anuncio.id, anuncio.ubicacion, '-> geocodificando localmente...');
            const coords = this.geocodificarUbicacion(anuncio.ubicacion);
            lat = coords.lat;
            lng = coords.lng;
            console.debug('🧭 Coordenadas calculadas:', lat, lng);
        }

        // Validar que las coordenadas estén dentro de Perú aproximadamente
        if (lat < -18.5 || lat > 0.5 || lng < -81.5 || lng > -68) {
            console.warn(`📍 Coordenadas fuera de Perú: ${lat}, ${lng} para ${anuncio.ubicacion}`);
            const coords = this.geocodificarUbicacion(anuncio.ubicacion);
            lat = coords.lat;
            lng = coords.lng;
            console.debug('🧭 Reemplazado con coordenadas locales:', lat, lng);
        }

        // Crear icono personalizado con popupAnchor ajustado para mostrar hacia abajo
        const icono = L.divIcon({
            className: 'marcador-mapa',
            html: this.obtenerIconoPorActividad(anuncio.tipo_actividad),
            iconSize: [35, 35],
            iconAnchor: [17, 35],
            popupAnchor: [0, -40]  // 🆕 Cambiado de -35 a -40 para dar más espacio
        });

        const marcador = L.marker([lat, lng], { icon: icono })
            .bindPopup(this.crearPopup(anuncio), {
                maxWidth: 300,  // 🆕 Limitar ancho máximo
                minWidth: 220,  // 🆕 Ancho mínimo
                autoPanPadding: [20, 20],  // 🆕 Padding para el autoPan
                autoPanPaddingTopLeft: [20, 20],  // 🆕 Especial para la esquina superior izquierda
                autoPanPaddingBottomRight: [20, 20],  // 🆕 Especial para la esquina inferior derecha
                closeButton: true,
                className: 'popup-personalizado'  // 🆕 Clase CSS personalizada
            });

        // Agregar evento para evitar que el popup se salga de los límites
        marcador.on('popupopen', () => {
            setTimeout(() => {
                const popup = marcador.getPopup();
                if (popup && this.mapa) {
                    // Asegurar que el popup no se salga de los límites del mapa
                    const popupContainer = popup.getElement();
                    if (popupContainer) {
                        const mapRect = this.mapa.getContainer().getBoundingClientRect();
                        const popupRect = popupContainer.getBoundingClientRect();
                        
                        // Si el popup está muy cerca del borde superior, ajustarlo
                        if (popupRect.top < mapRect.top + 10) {
                            // Ajustar la posición del popup
                            marcador.setPopupContent(this.crearPopup(anuncio));
                        }
                    }
                }
            }, 10);
        });

        // Agregar datos personalizados al marcador para clusters
        marcador.anuncioData = anuncio;

        this.clusterGroup.addLayer(marcador);
        this.marcadores.push(marcador);
        
        return marcador;
    }

    crearPopup(anuncio) {
        // Determinar si ya es favorito
        let esFavorito = false;
        let iconoFavorito = '🤍';
        let estiloFavorito = '';
        
        if (window.manejadorBusqueda && window.manejadorBusqueda.favoritosIds) {
            esFavorito = window.manejadorBusqueda.favoritosIds.includes(parseInt(anuncio.id));
            iconoFavorito = esFavorito ? '❤️' : '🤍';
            estiloFavorito = esFavorito ? 
                'background: #ff6b35; color: white;' : 
                'background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0;';
        }

        const token = localStorage.getItem('token_usuario');
        const datosUsuario = localStorage.getItem('datos_usuario');
        const usuarioLogueado = token && datosUsuario;
        
        // Preparar avatar del anfitrión
        let avatarAnfitrion = '';
        if (anuncio.foto_perfil) {
            avatarAnfitrion = `
                <div style="width: 30px; height: 30px; border-radius: 50%; background-image: url('${anuncio.foto_perfil}'); background-size: cover; background-position: center; border: 1px solid #e2e8f0;">
                </div>
            `;
        } else {
            const iniciales = `${anuncio.nombre?.charAt(0) || 'A'}${anuncio.apellido?.charAt(0) || 'N'}`;
            avatarAnfitrion = `
                <div style="width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 1px solid white;">
                    ${iniciales}
                </div>
            `;
        }

        // Preparar imagen del anuncio (más pequeña)
        let imagenAnuncio = '';
        if (anuncio.imagen_principal) {
            imagenAnuncio = `
                <div style="width: 100%; height: 100px; border-radius: 6px; overflow: hidden; margin-bottom: 8px;">
                    <img src="/proyectoWeb/viajeros_peru/${anuncio.imagen_principal}" 
                         alt="${this.escapeHtmlPopup(anuncio.titulo)}"
                         style="width: 100%; height: 100%; object-fit: cover;"
                         onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width:100%;height:100px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;border-radius:6px;\\'><span style=\\'font-size:24px;color:#64748b;\\'>${this.obtenerIconoPorActividad(anuncio.tipo_actividad)}</span></div>'">
                </div>
            `;
        } else {
            imagenAnuncio = `
                <div style="width: 100%; height: 100px; background: #f1f5f9; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                    <span style="font-size: 24px; color: #64748b;">
                        ${this.obtenerIconoPorActividad(anuncio.tipo_actividad)}
                    </span>
                </div>
            `;
        }

        return `
            <div class="popup-anuncio" style="min-width: 220px; max-width: 260px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 4px;">
                <!-- Imagen del anuncio -->
                ${imagenAnuncio}

                <!-- Header con título y favorito -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <div style="flex: 1; margin-right: 6px;">
                        <h4 style="margin: 0; font-size: 14px; color: #1e293b; font-weight: 600; line-height: 1.3; margin-bottom: 3px;">
                            ${this.escapeHtmlPopup(anuncio.titulo)}
                        </h4>
                        <p style="margin: 0; color: #64748b; font-size: 12px; display: flex; align-items: center; gap: 3px;">
                            <span style="font-size: 10px;">📍</span>
                            ${this.escapeHtmlPopup(anuncio.ubicacion)}
                        </p>
                    </div>
                    ${usuarioLogueado ? 
                        `<button onclick="alternarFavoritoPopup(${anuncio.id})" 
                                style="${estiloFavorito} border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 12px; flex-shrink: 0;"
                                title="${esFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                            ${iconoFavorito}
                        </button>` : 
                        ''
                    }
                </div>

                <!-- Info rápida -->
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0;">
                    <span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 10px; font-size: 10px; display: flex; align-items: center; gap: 2px;">
                        <span>🎯</span>
                        ${this.formatearTipoActividad(anuncio.tipo_actividad).replace('🌱 ', '').replace('📚 ', '').replace('🏗️ ', '').replace('👨‍🍳 ', '').replace('🌿 ', '').replace('👶 ', '').replace('🐕 ', '').replace('💻 ', '').replace('🎨 ', '')}
                    </span>
                    <span style="background: #f0f9ff; color: #0c4a6e; padding: 2px 6px; border-radius: 10px; font-size: 10px; display: flex; align-items: center; gap: 2px;">
                        <span>⏱️</span>
                        ${anuncio.duracion_minima}-${anuncio.duracion_maxima} días
                    </span>
                </div>

                <!-- Anfitrión con foto -->
                <div style="display: flex; align-items: center; gap: 8px; margin: 8px 0; padding: 6px 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;">
                    ${avatarAnfitrion}
                    <div style="flex: 1;">
                        <div style="font-weight: 500; color: #334155; font-size: 12px;">
                            ${this.escapeHtmlPopup(anuncio.nombre)} ${this.escapeHtmlPopup(anuncio.apellido)}
                        </div>
                        <div style="font-size: 10px; color: #94a3b8;">Anfitrión</div>
                    </div>
                </div>

                <!-- Botón de acción -->
                <div style="margin-top: 8px;">
                    <button onclick="manejadorBusqueda.verDetalle(${anuncio.id})" 
                            style="width: 100%; background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <span style="font-size: 12px;">👁️</span>
                        Ver Detalle
                    </button>
                </div>
            </div>
        `;
    }

    // 🆕 MÉTODO: Escapar HTML para popup
    escapeHtmlPopup(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 🆕 MÉTODO: Obtener icono por actividad (sin emoji adicional)
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
            'manualidades': '🎨'
        };
        return iconos[tipo] || '🏠';
    }

    // 🆕 MÉTODO: Obtener iniciales para popup
    obtenerInicialesPopup(nombre, apellido) {
        return `${nombre?.charAt(0) || 'A'}${apellido?.charAt(0) || 'N'}`;
    }

    geocodificarUbicacion(ubicacion) {
        const ciudadesPeru = {
            'lima': { lat: -12.0464, lng: -77.0428 },
            'cusco': { lat: -13.5320, lng: -71.9675 },
            'machu picchu': { lat: -13.1631, lng: -72.5450 },
            'arequipa': { lat: -16.4090, lng: -71.5375 },
            'trujillo': { lat: -8.1092, lng: -79.0215 },
            'chiclayo': { lat: -6.7760, lng: -79.8446 },
            'piura': { lat: -5.1945, lng: -80.6328 },
            'iquitos': { lat: -3.7491, lng: -73.2538 },
            'huaraz': { lat: -9.5279, lng: -77.5286 },
            'tacna': { lat: -18.0066, lng: -70.2463 },
            'cajamarca': { lat: -7.1617, lng: -78.5128 },
            'ayacucho': { lat: -13.1631, lng: -74.2236 },
            'puno': { lat: -15.8402, lng: -70.0219 },
            'tarapoto': { lat: -6.4833, lng: -76.3667 },
            'huancayo': { lat: -12.0667, lng: -75.2333 },
            'ica': { lat: -14.0681, lng: -75.7256 },
            'pucallpa': { lat: -8.3792, lng: -74.5539 },
            'tumbes': { lat: -3.5669, lng: -80.4515 },
            'moquegua': { lat: -17.1956, lng: -70.9353 }
        };

        const ubicacionLower = ubicacion.toLowerCase().trim();
        
        for (let ciudad in ciudadesPeru) {
            if (ubicacionLower.includes(ciudad)) {
                console.log(`📍 Geocodificado "${ubicacion}" como ${ciudad}`);
                return ciudadesPeru[ciudad];
            }
        }

        console.log(`📍 Usando coordenadas por defecto para: ${ubicacion}`);
        return { lat: -9.1900, lng: -75.0152 };
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
            'manualidades': '🎨'
        };
        return iconos[tipo] || '🏠';
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

    ajustarVista() {
        if (this.marcadores.length === 0) {
            this.mapa.setView([-9.1900, -75.0152], 6);
            return;
        }

        const grupo = this.clusterGroup instanceof L.FeatureGroup ? 
            this.clusterGroup : 
            new L.FeatureGroup(this.marcadores);
            
        this.mapa.fitBounds(grupo.getBounds().pad(0.05));
    }
}

// Clase principal para manejar la búsqueda (MANTENIENDO EL CÓDIGO ORIGINAL)
class ManejadorBusqueda {
    constructor() {
        console.log('🚀 Inicializando ManejadorBusqueda...');
        this.usuario = null;
        this.rol = 'publico';
        this.resultados = [];
        this.filtros = {};
        this.favoritosIds = [];

        this.mapaPeru = new MapaPeru();
        this.vistaActual = 'lista';
        
        this.paginaActual = 1;
        this.resultadosPorPagina = 10; 
        this.totalResultados = 0; 
        this.totalPaginas = 0; 
        this.inicializar();
    }

    inicializar() {
        console.log('🔧 Inicializando sistema de búsqueda...');
        this.verificarAutenticacion();
        this.cargarDatosUsuario();
        this.configurarManejadores();
        this.configurarVistas();
        this.buscarAnuncios();
        this.verificarEstadoFavoritos();
    }

    verificarAutenticacion() {
        const datosUsuario = localStorage.getItem('datos_usuario');
        console.log('📦 Datos usuario en localStorage:', datosUsuario);

        if (datosUsuario) {
            try {
                this.usuario = JSON.parse(datosUsuario);
                this.rol = this.usuario.rol || 'viajero';
                console.log('✅ Usuario autenticado:', this.usuario);
            } catch (error) {
                console.error('❌ Error parseando usuario:', error);
                this.rol = 'publico';
            }
        } else {
            console.log('👤 Usuario no autenticado - modo público');
            this.rol = 'publico';
        }
    }

    cargarDatosUsuario() {
        const menuElement = document.getElementById('menu-usuario');
        const badgeElement = document.getElementById('badge-rol');
        
        if (this.usuario) {
            if (menuElement) {
                menuElement.innerHTML = `
                    <span id="nombre-usuario" style="margin-right: 1rem;">${this.usuario.nombre} ${this.usuario.apellido}</span>
                    <a href="../perfil/panel_control.html" class="boton-secundario">Panel</a>
                    <button onclick="cerrarSesion()" class="boton-secundario">Cerrar Sesión</button>
                `;
            }
            
            if (badgeElement) {
                badgeElement.textContent = this.rol === 'viajero' ? 'Viajero' : 
                                         this.rol === 'anfitrion' ? 'Anfitrión' : 'Usuario';
                badgeElement.style.background = this.rol === 'viajero' ? '#3b82f6' : 
                                               this.rol === 'anfitrion' ? '#10b981' : '#6b7280';
            }
        } else {
            if (menuElement) {
                menuElement.innerHTML = `
                    <a href="../auth/iniciar_sesion.html" class="boton-secundario">Iniciar Sesión</a>
                    <a href="../auth/registro.html" class="boton-principal">Registrarse</a>
                `;
            }
            
            if (badgeElement) {
                badgeElement.textContent = 'Invitado';
            }
        }
    }

    configurarManejadores() {
        console.log('⚙️ Configurando eventos...');
        
        const formulario = document.getElementById('form-busqueda');
        if (formulario) {
            formulario.addEventListener('submit', (e) => {
                e.preventDefault();
                this.buscarAnuncios(e);
                if (window.innerWidth <= 768) {
                    const panelFiltros = document.getElementById('panel-filtros');
                    const overlayFiltros = document.getElementById('overlay-filtros');
                    if (panelFiltros) panelFiltros.classList.remove('activo');
                    if (overlayFiltros) overlayFiltros.classList.remove('activo');
                    document.body.style.overflow = '';
                }
            });
            console.log('✅ Formulario configurado');
        }

        const btnLimpiar = document.getElementById('btn-limpiar');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => this.limpiarFiltros());
            console.log('✅ Botón limpiar configurado');
        }
    }

    async buscarAnuncios(evento = null) {
        if (evento) {
            evento.preventDefault();
            console.log('🔍 Búsqueda por formulario');
        } else {
            console.log('🔍 Búsqueda automática inicial');
        }

        this.mostrarEstadoCarga();
        this.recopilarFiltros();

        try {
            const pagina = this.paginaActual || 1;
            const limite = this.resultadosPorPagina || 10;
            
            let url = `/proyectoWeb/viajeros_peru/backend/api/anuncios.php?accion=buscar&pagina=${pagina}&limite=${limite}`;
            
            Object.keys(this.filtros).forEach(key => {
                if (this.filtros[key]) {
                    url += `&${key}=${encodeURIComponent(this.filtros[key])}`;
                }
            });

            console.log('🌐 URL completa:', url);

            const respuesta = await fetch(url);
            console.log('📡 Estado respuesta:', respuesta.status);
            
            const contentType = respuesta.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await respuesta.text();
                console.error('❌ El servidor no devolvió JSON:', textResponse.substring(0, 200));
                throw new Error('El servidor respondió con HTML en lugar de JSON. Revisa la API.');
            }

            const datos = await respuesta.json();
            console.log('📊 Datos recibidos:', datos);

            if (datos.exito) {
                this.resultados = datos.anuncios || [];
                this.totalResultados = datos.total || this.resultados.length;
                this.totalPaginas = datos.total_paginas || Math.ceil(this.totalResultados / this.resultadosPorPagina);
        
                console.log(`✅ ${this.resultados.length} anuncios de ${this.totalResultados} totales`);
                this.mostrarResultados();
                this.mostrarPaginacion();
            } else {
                throw new Error(datos.error || 'Error en la búsqueda');
            }
        } catch (error) {
            console.error('💥 Error:', error);
            this.mostrarError('Error al buscar anuncios: ' + error.message);
        }
    }

    recopilarFiltros() {
        this.filtros = {
            ubicacion: document.getElementById('filtro-ubicacion')?.value || '',
            tipo_actividad: document.getElementById('filtro-tipo-actividad')?.value || '',
            duracion_minima: document.getElementById('filtro-duracion-min')?.value || '',
            duracion_maxima: document.getElementById('filtro-duracion-max')?.value || '',
            cupos_disponibles: document.getElementById('filtro-cupos')?.value || ''
        };

        Object.keys(this.filtros).forEach(key => {
            if (!this.filtros[key]) delete this.filtros[key];
        });

        console.log('🎛️ Filtros activos:', this.filtros);
    }

    mostrarEstadoCarga() {
        const contenedor = document.getElementById('lista-resultados');
        const estado = document.getElementById('estado-busqueda');
        
        if (estado) estado.style.display = 'none';
        if (contenedor) {
            contenedor.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #64748b;">
                    <p>🔍 Buscando anuncios...</p>
                    <p style="font-size: 0.9rem;">Consultando la base de datos</p>
                </div>
            `;
        }
    }

    configurarVistas() {
        const botonesVista = document.querySelectorAll('.boton-vista');
        botonesVista.forEach(boton => {
            boton.addEventListener('click', (e) => {
                const vista = e.target.dataset.vista;
                this.cambiarVista(vista);
            });
        });

        console.log('👁️ Configuración de vistas lista');
    }

    cambiarVista(vista) {
        this.vistaActual = vista;
        
        document.querySelectorAll('.boton-vista').forEach(btn => {
            btn.classList.toggle('activo', btn.dataset.vista === vista);
        });

        document.getElementById('vista-lista').classList.toggle('activa', vista === 'lista');
        document.getElementById('vista-mapa').classList.toggle('activa', vista === 'mapa');

        if (vista === 'mapa' && this.resultados.length > 0) {
            // Forzar resize del mapa antes de actualizar marcadores.
            // A veces el mapa se inicializa en un contenedor oculto y no renderiza hasta
            // que el navegador recalcula el layout (por ejemplo al abrir DevTools).
            // Llamar invalidateSize y esperar un pequeño delay soluciona el problema.
            try {
                if (this.mapaPeru && this.mapaPeru.mapa && typeof this.mapaPeru.mapa.invalidateSize === 'function') {
                    // invalidar tamaño y actualizar en el siguiente tick
                    this.mapaPeru.mapa.invalidateSize();
                }
            } catch (e) {
                console.warn('No se pudo invalidar tamaño del mapa:', e);
            }

            setTimeout(() => {
                this.actualizarMapa();
            }, 120);
        }

        // Si cambiamos a lista y ya tenemos resultados cargados, renderizarlos
        if (vista === 'lista' && this.resultados.length > 0) {
            // Mostrar inmediatamente la lista (evita quedarse en el estado de 'cargando')
            this.mostrarListaResultados();
        }
    }

    actualizarMapa() {
        console.log('🔄 Actualizando mapa con', this.resultados.length, 'anuncios');
        this.mapaPeru.limpiarMarcadores();
        
        // Añadir marcadores en lotes para evitar bloquear el hilo principal cuando hay muchos
        const batchSize = 50; // ajustar según el rendimiento en el cliente
        let index = 0;

        const addBatch = () => {
            const slice = this.resultados.slice(index, index + batchSize);
            slice.forEach(anuncio => {
                try {
                    this.mapaPeru.agregarMarcador(anuncio);
                } catch (e) {
                    console.warn('Error al agregar marcador para anuncio', anuncio.id, e);
                }
            });
            index += batchSize;
            if (index < this.resultados.length) {
                // Esperar un pequeño espacio para mantener la UI responsiva
                setTimeout(addBatch, 40);
            } else {
                // Ajustar la vista sólo cuando todos los marcadores hayan sido agregados
                this.mapaPeru.ajustarVista();
            }
        };

        addBatch();
    }

    mostrarResultados() {
        const estado = document.getElementById('estado-busqueda');
        const contador = document.getElementById('numero-resultados');
        
        if (estado) estado.style.display = 'none';
        if (contador) contador.textContent = this.totalResultados;

        if (this.resultados.length === 0) {
            this.mostrarSinResultados();
            return;
        }

        if (this.vistaActual === 'lista') {
            this.mostrarListaResultados();
        } else {
            this.actualizarMapa();
        }
    }

    mostrarListaResultados() {
        const contenedor = document.getElementById('lista-resultados');
        if (!contenedor) return;

        console.log('🎨 Generando interfaz de lista...');
        const html = this.resultados.map(anuncio => this.crearTarjetaResultado(anuncio)).join('');
        contenedor.innerHTML = html;
        
        // 🆕 Actualizar botones de favoritos después de renderizar
        setTimeout(() => {
            this.actualizarBotonesFavoritos();
        }, 100);
    }

    mostrarSinResultados() {
        const contenedorLista = document.getElementById('lista-resultados');
        const contenedorMapa = document.getElementById('vista-mapa');
        
        const mensajeHTML = `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 2rem; border-radius: 8px; text-align: center; grid-column: 1 / -1;">
                <h4 style="color: #64748b; margin-bottom: 1rem;">😞 No se encontraron anuncios</h4>
                <p style="color: #94a3b8; margin-bottom: 1.5rem;">Prueba ajustando los filtros de búsqueda</p>
                <button onclick="manejadorBusqueda.limpiarFiltros()" 
                        style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer;">
                    🔄 Limpiar filtros
                </button>
            </div>
        `;

        if (contenedorLista) contenedorLista.innerHTML = mensajeHTML;
        if (contenedorMapa) contenedorMapa.innerHTML = mensajeHTML;
    }

    async verificarEstadoFavoritos() {
        const token = localStorage.getItem('token_usuario');
        const datosUsuario = localStorage.getItem('datos_usuario');
        
        if (!token || !datosUsuario) {
            console.log('⚠️ Usuario no autenticado, no se pueden verificar favoritos');
            return;
        }

        try {
            // Obtener TODOS los anuncios favoritos del usuario
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/favoritos.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: token,
                    accion: 'obtener',
                    tipo: 'anuncio'
                })
            });

            const datos = await respuesta.json();
            
            if (datos.exito) {
                this.favoritosIds = datos.favoritos.map(f => f.anuncio_id);
                console.log('❤️ Anuncios favoritos:', this.favoritosIds);
                
                // Actualizar botones según estado
                this.actualizarBotonesFavoritos();
            }
        } catch (error) {
            console.error('Error verificando favoritos:', error);
        }
    }

    // 🆕 NUEVO MÉTODO: Actualizar botones según estado de favorito
    actualizarBotonesFavoritos() {
        const botones = document.querySelectorAll('.boton-favorito');
        
        botones.forEach(boton => {
            const anuncioId = this.obtenerAnuncioIdDesdeBoton(boton);
            
            if (anuncioId && this.favoritosIds.includes(parseInt(anuncioId))) {
                // Ya está en favoritos
                boton.innerHTML = '❤️'; // Corazón rojo/lleno
                boton.style.color = '#ff6b35';
                boton.style.backgroundColor = '#fff3f0';
                boton.title = 'Quitar de favoritos';
            } else {
                // No está en favoritos
                boton.innerHTML = '🤍'; // Corazón blanco/vacío
                boton.style.color = '#999';
                boton.style.backgroundColor = 'transparent';
                boton.title = 'Agregar a favoritos';
            }
        });
    }

    // 🆕 NUEVO MÉTODO: Obtener ID del anuncio desde el botón
    obtenerAnuncioIdDesdeBoton(boton) {
        // Buscar el elemento padre que tiene data-id
        let elemento = boton;
        while (elemento && !elemento.hasAttribute('data-anuncio-id')) {
            elemento = elemento.parentElement;
            if (elemento && elemento.classList.contains('tarjeta-resultado')) {
                return elemento.getAttribute('data-id');
            }
        }
        return elemento ? elemento.getAttribute('data-anuncio-id') : null;
    }

    // 🆕 NUEVO MÉTODO: Alternar favorito
    async alternarFavorito(anuncioId) {
        console.log('Alternando favorito para anuncio:', anuncioId);
        
        // Verificar autenticación
        const token = localStorage.getItem('token_usuario');
        const datosUsuario = localStorage.getItem('datos_usuario');
        
        if (!token || !datosUsuario) {
            alert('🔐 Debes iniciar sesión para guardar favoritos');
            window.location.href = '../../vistas/auth/iniciar_sesion.html';
            return;
        }

        try {
            // Verificar si ya está en favoritos
            const respVerif = await fetch('/proyectoWeb/viajeros_peru/backend/api/favoritos.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: token,
                    accion: 'verificar',
                    anuncio_id: anuncioId
                })
            });

            const datosVerif = await respVerif.json();
            
            if (datosVerif.es_favorito) {
                // Eliminar de favoritos
                const respElim = await fetch('/proyectoWeb/viajeros_peru/backend/api/favoritos.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        token: token,
                        accion: 'eliminar_anuncio',
                        anuncio_id: anuncioId
                    })
                });

                const datosElim = await respElim.json();
                if (datosElim.exito) {
                    console.log('❌ Eliminado de favoritos');
                    // Actualizar array local
                    this.favoritosIds = this.favoritosIds.filter(id => id !== anuncioId);
                    // Actualizar UI inmediatamente
                    this.actualizarBotonFavorito(anuncioId, false);
                    alert('❌ Eliminado de favoritos');
                }
            } else {
                // Agregar a favoritos
                const respAgr = await fetch('/proyectoWeb/viajeros_peru/backend/api/favoritos.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        token: token,
                        accion: 'agregar',
                        anuncio_id: anuncioId
                    })
                });

                const datosAgr = await respAgr.json();
                if (datosAgr.exito) {
                    console.log('❤️ Agregado a favoritos');
                    // Actualizar array local
                    this.favoritosIds.push(anuncioId);
                    // Actualizar UI inmediatamente
                    this.actualizarBotonFavorito(anuncioId, true);
                    alert('❤️ Agregado a favoritos');
                } else {
                    alert('⚠️ ' + datosAgr.error);
                }
            }
        } catch (error) {
            console.error('Error al alternar favorito:', error);
            alert('❌ Error al procesar favorito');
        }
    }

    // 🆕 NUEVO MÉTODO: Actualizar un solo botón
    actualizarBotonFavorito(anuncioId, esFavorito) {
        const boton = document.querySelector(`.boton-favorito[data-anuncio-id="${anuncioId}"]`);
        if (!boton) return;
        
        if (esFavorito) {
            boton.innerHTML = '❤️';
            boton.style.color = '#ff6b35';
            boton.style.backgroundColor = '#fff3f0';
            boton.title = 'Quitar de favoritos';
        } else {
            boton.innerHTML = '🤍';
            boton.style.color = '#999';
            boton.style.backgroundColor = 'transparent';
            boton.title = 'Agregar a favoritos';
        }
    }

        crearTarjetaResultado(anuncio) {
        const iniciales = `${anuncio.nombre?.charAt(0) || 'A'}${anuncio.apellido?.charAt(0) || 'N'}`;
        const esMiAnuncio = this.usuario && anuncio.anfitrion_id == this.usuario.id;
        
        // 🆕 Determinar si ya es favorito
        const esFavorito = this.favoritosIds.includes(parseInt(anuncio.id));
        const iconoFavorito = esFavorito ? '❤️' : '🤍';
        const estiloFavorito = esFavorito ? 
            'color: #ff6b35; background-color: #fff3f0;' : 
            'color: #999; background-color: transparent;';

        return `
            <div class="tarjeta-resultado" data-id="${anuncio.id}">
                <div class="imagen-resultado">
                    ${anuncio.imagen_principal ? 
                        `<img src="/proyectoWeb/viajeros_peru/${anuncio.imagen_principal}" 
                            alt="${this.escapeHtml(anuncio.titulo)}"
                            class="imagen-resultado-principal"
                            onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">` : 
                        ''
                    }
                    <div class="placeholder-resultado" style="${anuncio.imagen_principal ? 'display: none;' : ''}">
                        🏠 ${this.obtenerIconoPorActividad(anuncio.tipo_actividad)}
                    </div>
                </div>
                
                <div class="contenido-resultado">
                    <div class="cabecera-resultado">
                        <h4>${this.escapeHtml(anuncio.titulo)}</h4>
                        <div class="ubicacion-resultado">
                            📍 ${this.escapeHtml(anuncio.ubicacion)}
                        </div>
                    </div>
                    
                    <div class="cuerpo-resultado">
                        <div class="anfitrion-resultado">
                            <div class="avatar-anfitrion">
                                ${anuncio.foto_perfil ? 
                                    `<div class="avatar-anfitrion" style="background-image: url('${anuncio.foto_perfil}')"></div>` :
                                    `<div class="avatar-anfitrion">${iniciales}</div>`
                                }    
                            </div>
                            <div class="info-anfitrion">
                                <h5>${this.escapeHtml(anuncio.nombre)} ${this.escapeHtml(anuncio.apellido)}</h5>
                                <p>Anfitrión</p>
                            </div>
                        </div>

                        <div class="info-resultado">
                            <p><strong>🎯 Actividad:</strong> ${this.formatearTipoActividad(anuncio.tipo_actividad)}</p>
                            <p><strong>⏱️ Duración:</strong> ${anuncio.duracion_minima} - ${anuncio.duracion_maxima} días</p>
                            <p><strong>👥 Cupos:</strong> ${anuncio.cupos_disponibles} disponible(s)</p>
                            <p><strong>📅 Publicado:</strong> ${new Date(anuncio.fecha_publicacion).toLocaleDateString('es-PE')}</p>
                        </div>

                        <div class="descripcion-resultado">
                            <p>${this.escapeHtml(anuncio.descripcion.substring(0, 120))}${anuncio.descripcion.length > 120 ? '...' : ''}</p>
                        </div>

                        <div class="acciones-resultado">
                            ${this.generarBotonesAccion(anuncio, esMiAnuncio)}
                            <!-- 🆕 BOTÓN DE FAVORITO -->
                            <button class="boton-favorito" 
                                    onclick="manejadorBusqueda.alternarFavorito(${anuncio.id})" 
                                    data-anuncio-id="${anuncio.id}"
                                    title="${esFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}"
                                    style="${estiloFavorito} border: 1px solid #e2e8f0; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 1.1rem;">
                                ${iconoFavorito}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
            'manualidades': '🎨'
        };
        return iconos[tipo] || '🏠';
    }

    generarBotonesAccion(anuncio, esMiAnuncio) {
        if (esMiAnuncio) {
            return `
                <button class="boton-detalle" onclick="manejadorBusqueda.verDetalle(${anuncio.id})">
                    👁️ Ver Mi Anuncio
                </button>
                <button class="boton-contactar" onclick="manejadorBusqueda.editarAnuncio(${anuncio.id})">
                    ✏️ Editar
                </button>
            `;
        }

        if (this.rol === 'viajero') {
            return `
                <button class="boton-detalle" onclick="manejadorBusqueda.verDetalle(${anuncio.id})">
                    👁️ Ver Detalle
                </button>
            `;
        } else if (this.rol === 'publico') {
            return `
                <button class="boton-detalle" onclick="manejadorBusqueda.verDetalle(${anuncio.id})">
                    👁️ Ver Detalle
                </button>
                <button class="boton-contactar" onclick="manejadorBusqueda.solicitarLogin()">
                    🔐 Iniciar Sesión para Contactar
                </button>
            `;
        } else {
            return `
                <button class="boton-detalle" onclick="manejadorBusqueda.verDetalle(${anuncio.id})">
                    👁️ Ver Detalle
                </button>
            `;
        }
    }

    solicitarLogin() {
        if (confirm('🔐 Debes iniciar sesión como viajero para contactar anfitriones. ¿Quieres ir a la página de inicio de sesión?')) {
            window.location.href = '../auth/iniciar_sesion.html';
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
    
    mostrarPaginacion() {
        const contenedorPaginacion = document.getElementById('paginacion');
        if (!contenedorPaginacion) return;

        if (this.totalPaginas <= 1) {
            contenedorPaginacion.style.display = 'none';
            return;
        }

        contenedorPaginacion.style.display = 'block';
        
        let htmlPaginacion = '<div class="controles-paginacion">';
        
        if (this.paginaActual > 1) {
            htmlPaginacion += `<button class="boton-paginacion" onclick="manejadorBusqueda.cambiarPagina(${this.paginaActual - 1})">⬅️ Anterior</button>`;
        }

        for (let i = 1; i <= this.totalPaginas; i++) {
            if (i === this.paginaActual) {
                htmlPaginacion += `<span class="pagina-actual">${i}</span>`;
            } else {
                htmlPaginacion += `<button class="boton-paginacion" onclick="manejadorBusqueda.cambiarPagina(${i})">${i}</button>`;
            }
        }

        if (this.paginaActual < this.totalPaginas) {
            htmlPaginacion += `<button class="boton-paginacion" onclick="manejadorBusqueda.cambiarPagina(${this.paginaActual + 1})">Siguiente ➡️</button>`;
        }

        htmlPaginacion += '</div>';
        contenedorPaginacion.innerHTML = htmlPaginacion;
    }

    cambiarPagina(nuevaPagina) {
        this.paginaActual = nuevaPagina;
        this.buscarAnuncios();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    limpiarFiltros() {
        document.getElementById('filtro-ubicacion').value = '';
        document.getElementById('filtro-tipo-actividad').value = '';
        document.getElementById('filtro-duracion-min').value = '';
        document.getElementById('filtro-duracion-max').value = '';
        document.getElementById('filtro-cupos').value = '1';
        
        this.paginaActual = 1;
        this.buscarAnuncios();
    }

    verDetalle(anuncioId) {
         window.location.href = `../anuncios/detalle_anuncio.html?id=${anuncioId}`;
    }

    editarAnuncio(anuncioId) {
        window.location.href = `../anuncios/editar_anuncio.html?id=${anuncioId}`;
    }

    mostrarError(mensaje) {
        const contenedor = document.getElementById('lista-resultados');
        if (contenedor) {
            contenedor.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 1.5rem; border-radius: 8px; text-align: center;">
                    <h4>❌ Error en la búsqueda</h4>
                    <p>${mensaje}</p>
                </div>
            `;
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Funciones globales
function cerrarSesion() {
    localStorage.removeItem('token_usuario');
    localStorage.removeItem('datos_usuario');
    window.location.href = '../auth/iniciar_sesion.html';
}
// FUNCIÓN para alternar favoritos
function alternarFavoritoBusqueda(anuncioId) {
    if (window.manejadorBusqueda && window.manejadorBusqueda.alternarFavorito) {
        window.manejadorBusqueda.alternarFavorito(anuncioId);
    }
}

// FUNCIÓN: Alternar favorito desde popup
// 🆕 FUNCIÓN: Alternar favorito desde popup
function alternarFavoritoPopup(anuncioId) {
    if (window.manejadorBusqueda && window.manejadorBusqueda.alternarFavorito) {
        window.manejadorBusqueda.alternarFavorito(anuncioId);
        
        // Cerrar el popup después de hacer clic (opcional)
        setTimeout(() => {
            const popup = document.querySelector('.leaflet-popup-content');
            if (popup) {
                // Actualizar el botón de favorito en el popup
                const botonFavorito = popup.querySelector(`button[onclick*="${anuncioId}"]`);
                if (botonFavorito) {
                    const esFavorito = window.manejadorBusqueda.favoritosIds.includes(parseInt(anuncioId));
                    const nuevoIcono = esFavorito ? '❤️' : '🤍';
                    const nuevoEstilo = esFavorito ? 
                        'background: #ff6b35; color: white;' : 
                        'background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0;';
                    const nuevoTitulo = esFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos';
                    
                    botonFavorito.innerHTML = nuevoIcono;
                    botonFavorito.style.cssText = `${nuevoEstilo} border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; transition: all 0.2s; flex-shrink: 0;`;
                    botonFavorito.title = nuevoTitulo;
                    
                    // Pequeña animación
                    botonFavorito.style.transform = 'scale(1.2)';
                    setTimeout(() => {
                        botonFavorito.style.transform = 'scale(1)';
                    }, 200);
                }
            }
        }, 100);
    }
}

function configurarFiltrosResponsive() {
    const btnAbrirFiltros = document.getElementById('btn-abrir-filtros');
    const btnFiltrosFlotante = document.getElementById('btn-filtros-flotante');
    const btnCerrarFiltros = document.getElementById('btn-cerrar-filtros');
    const panelFiltros = document.getElementById('panel-filtros');
    const overlayFiltros = document.getElementById('overlay-filtros');
    
    function abrirFiltros() {
        panelFiltros.classList.add('activo');
        overlayFiltros.classList.add('activo');
        document.body.style.overflow = 'hidden';
    }
    
    function cerrarFiltros() {
        panelFiltros.classList.remove('activo');
        overlayFiltros.classList.remove('activo');
        document.body.style.overflow = '';
    }
    
    if (btnAbrirFiltros && panelFiltros) {
        btnAbrirFiltros.addEventListener('click', abrirFiltros);
        btnFiltrosFlotante.addEventListener('click', abrirFiltros);
        btnCerrarFiltros.addEventListener('click', cerrarFiltros);
        overlayFiltros.addEventListener('click', cerrarFiltros);
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && panelFiltros.classList.contains('activo')) {
                cerrarFiltros();
            }
        });
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                if (panelFiltros.classList.contains('activo')) {
                    btnFiltrosFlotante.style.display = 'none';
                } else {
                    btnFiltrosFlotante.style.display = 'flex';
                }
            }
        });
    });

    observer.observe(panelFiltros, { attributes: true });
}

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    console.log('🏁 DOM completamente cargado');
    window.manejadorBusqueda = new ManejadorBusqueda();
    configurarFiltrosResponsive();
});