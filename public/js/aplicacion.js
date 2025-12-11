// Aplicación principal de Viajeros Perú - Versión Simplificada
class AplicacionViajerosPeru {
    constructor() {
        this.configuracion = {
            apiBaseUrl: '/proyectoWeb/viajeros_peru/backend/api'
        };
        // Esperar a que la navegación se cargue primero
        setTimeout(() => this.inicializar(), 100);
    }

    inicializar() {
        console.log('🚀 Iniciando Aplicación Viajeros Perú...');
        this.cargarAnunciosIniciales();
        this.configurarManejadores();
    }

    // Cargar anuncios iniciales en la página de inicio
    async cargarAnunciosIniciales() {
        try {
            console.log('📡 Cargando anuncios para la página de inicio...');
            
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/anuncios.php?accion=buscar&limite=6');
            
            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }

            const resultado = await respuesta.json();
            console.log('📊 Anuncios recibidos:', resultado);

            if (resultado.exito) {
                const anuncios = resultado.anuncios.slice(0, 6);
                this.mostrarAnuncios(anuncios);
            } else {
                this.mostrarError('No se pudieron cargar los anuncios: ' + resultado.error);
            }
        } catch (error) {
            console.error('Error cargando anuncios:', error);
            this.mostrarAnuncios([]);
        }
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
                const favoritosIds = datos.favoritos.map(f => f.anuncio_id);
                console.log('❤️ Anuncios favoritos:', favoritosIds);
                
                // Actualizar botones según estado
                this.actualizarBotonesFavoritos(favoritosIds);
            }
        } catch (error) {
            console.error('Error verificando favoritos:', error);
        }
    }

    // MÉTODO: Actualizar botones según estado de favorito
    actualizarBotonesFavoritos(favoritosIds) {
        const botones = document.querySelectorAll('.boton-favorito');
        
        botones.forEach(boton => {
            const anuncioId = this.obtenerAnuncioIdDesdeBoton(boton);
            
            if (anuncioId && favoritosIds.includes(parseInt(anuncioId))) {
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

    // MÉTODO: Obtener ID del anuncio desde el botón
    obtenerAnuncioIdDesdeBoton(boton) {
        // Buscar el elemento padre que tiene data-id
        let elemento = boton;
        while (elemento && !elemento.hasAttribute('data-anuncio-id')) {
            elemento = elemento.parentElement;
            if (elemento && elemento.classList.contains('tarjeta-anuncio-inicio')) {
                return elemento.getAttribute('data-id');
            }
        }
        return elemento ? elemento.getAttribute('data-anuncio-id') : null;
    }


    // Mostrar anuncios en el grid
    mostrarAnuncios(anuncios) {
        const contenedor = document.getElementById('lista-anuncios');
        
        if (!contenedor) {
            console.error('❌ No se encontró el contenedor de anuncios');
            return;
        }

        if (!anuncios || anuncios.length === 0) {
            contenedor.innerHTML = `
                <div class="sin-resultados" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                    <h4>😞 No hay anuncios disponibles</h4>
                    <p>Pronto tendremos nuevas oportunidades de viaje</p>
                    <a href="../auth/registro.html" class="boton-principal" style="margin-top: 1rem; display: inline-block;">
                        🏠 Sé el primero en publicar
                    </a>
                </div>
            `;
            return;
        }

        const html = anuncios.map(anuncio => `
            <div class="tarjeta-anuncio-inicio" data-id="${anuncio.id}">
                <!-- Sección de imagen -->
                <div class="imagen-anuncio">
                    ${anuncio.imagen_principal ? 
                        `<img src="/proyectoWeb/viajeros_peru${anuncio.imagen_principal}" 
                            alt="${this.escaparHTML(anuncio.titulo)}"
                            onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">` : 
                        ''
                    }
                    <div class="placeholder-imagen" style="${anuncio.imagen_principal ? 'display: none;' : ''}">
                        🏠 ${this.obtenerIconoPorActividad(anuncio.tipo_actividad)}
                    </div>
                </div>
                
                <div class="contenido-tarjeta">
                    <div class="cabecera-tarjeta">
                        <h4>${this.escaparHTML(anuncio.titulo)}</h4>
                        <span class="badge-actividad">${this.formatearTipoActividad(anuncio.tipo_actividad)}</span>
                    </div>
                    <p class="ubicacion">📍 ${this.escaparHTML(anuncio.ubicacion)}</p>
                    <p class="descripcion">${this.escaparHTML(anuncio.descripcion.substring(0, 120))}${anuncio.descripcion.length > 120 ? '...' : ''}</p>
                    
                    <div class="info-adicional">
                        <span class="info-item">⏱️ ${anuncio.duracion_minima}-${anuncio.duracion_maxima} días</span>
                        <span class="info-item">👥 ${anuncio.cupos_disponibles} cupos</span>
                    </div>
                    
                    <div class="anfitrion-info">
                        ${anuncio.foto_perfil ? 
                            `<div class="avatar-mini" style="background-image: url('${anuncio.foto_perfil}')"></div>` :
                            `<div class="avatar-mini">${this.obtenerIniciales(anuncio.nombre, anuncio.apellido)}</div>`
                        }
                        <span>${anuncio.nombre} ${anuncio.apellido}</span>
                    </div>
                    
                    <div class="acciones-tarjeta">
                        <a href="../anuncios/detalle_anuncio.html?id=${anuncio.id}" class="boton-ver">
                            👁️ Ver Detalle
                        </a>
                        <button class="boton-favorito" onclick="app.alternarFavorito(${anuncio.id})" 
                            data-anuncio-id="${anuncio.id}"
                            title="Agregar a favoritos">
                            🤍
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        contenedor.innerHTML = html;
        
        // 🆕 VERIFICAR ESTADO DE FAVORITOS DESPUÉS DE CARGAR
        setTimeout(() => {
            this.verificarEstadoFavoritos();
        }, 500);
    }

    // Agregar esta nueva función para obtener iconos por actividad
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

    // Utilidad para formatear tipo de actividad
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

    // Obtener iniciales para el avatar
    obtenerIniciales(nombre, apellido) {
        return `${nombre?.charAt(0) || 'A'}${apellido?.charAt(0) || 'N'}`;
    }

    // Utilidad para escapar HTML
    escaparHTML(texto) {
        if (!texto) return '';
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    // Mostrar mensajes de error
    mostrarError(mensaje) {
        console.error('Error:', mensaje);
        const contenedor = document.getElementById('lista-anuncios');
        if (contenedor) {
            contenedor.innerHTML = `
                <div class="error-carga" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                    <h4>❌ Error al cargar anuncios</h4>
                    <p>${mensaje}</p>
                    <button onclick="app.cargarAnunciosIniciales()" class="boton-principal" style="margin-top: 1rem;">
                        🔄 Reintentar
                    </button>
                </div>
            `;
        }
    }

    // Configurar manejadores de eventos
    configurarManejadores() {
        // Manejador para el buscador
        const buscadorDestino = document.getElementById('busqueda-destino');
        const tipoActividad = document.getElementById('tipo-actividad');
        
        if (buscadorDestino) {
            buscadorDestino.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    realizarBusqueda();
                }
            });
        }

        if (tipoActividad) {
            tipoActividad.addEventListener('change', realizarBusqueda);
        }
    }

    // Alternar favorito
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
            const usuario = JSON.parse(datosUsuario);
            
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

    // MÉTODO : Actualizar un solo botón
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
}

// Funciones globales
function realizarBusqueda() {
    const destino = document.getElementById('busqueda-destino').value;
    const actividad = document.getElementById('tipo-actividad').value;
    
    let url = 'busqueda.html';
    const params = [];
    
    if (destino) params.push(`ubicacion=${encodeURIComponent(destino)}`);
    if (actividad) params.push(`tipo_actividad=${actividad}`);
    
    if (params.length > 0) {
        url += '?' + params.join('&');
    }
    
    window.location.href = url;
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('🏁 DOM cargado - Iniciando aplicación');
    window.app = new AplicacionViajerosPeru();
});