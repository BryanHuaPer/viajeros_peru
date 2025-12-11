// Componente de navegación global reutilizable
class NavegacionGlobal {
    constructor() {
        this.usuario = null;
        this.intervaloNotificaciones = null;
        this.fotoPerfilUrl = '/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg';
        this.estadoVerificacion = 'no_verificado';
        this.gestorSesion = null;
        this.idioma_actual = null; // 'es' o 'en'
        this.inicializar();
    }
    hayUsuarioLogueado() {
        return this.usuario !== null;
    }

    inicializar() {
        this.verificarAutenticacion();
        this.iniciarGestorSesion();
        this.cargarNavegacion();
        this.detectarPrimeraCarga();
    }
    // MÉTODO: Iniciar gestor de sesión
    iniciarGestorSesion() {
        if (!this.gestorSesion) {
            this.gestorSesion = new GestorSesion();
            this.gestorSesion.inicializar();
        }
    }
    
    // MÉTODO: Detectar primera carga después del login
    detectarPrimeraCarga() {
        const loginReciente = sessionStorage.getItem('login_reciente');
        const tienePerfil = localStorage.getItem('perfil_usuario');
        
        // Si acaba de hacer login y no tiene perfil cargado
        if (loginReciente === 'true' && this.usuario) {
            // Cargar el perfil completo siempre después del login reciente.
            // Algunos hosts (p.ej. InfinityFree) pueden bloquear preflights
            // si se usan headers personalizados; la API de perfiles no
            // requiere autenticación por header, por eso cargamos sin él.
            this.cargarPerfilCompleto();
            sessionStorage.removeItem('login_reciente'); // Limpiar flag
        }
    }
    // MÉTODO: Cargar perfil completo (solo cuando sea necesario)
    async cargarPerfilCompleto() {
        try {
            const urlAPI = '/proyectoWeb/viajeros_peru/backend/api/perfiles.php';
            const token = localStorage.getItem('token_usuario');
            
            // Evitar headers personalizados para prevenir preflight CORS
            // que en algunos hosts impide la petición. La API acepta
            // GET con el parámetro usuario_id.
            const respuesta = await fetch(`${urlAPI}?usuario_id=${this.usuario.id}`);

            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }

            const resultado = await respuesta.json();
            
            if (resultado.exito && resultado.perfil) {
                // Guardar perfil completo y aplicar campos críticos
                localStorage.setItem('perfil_usuario', JSON.stringify(resultado.perfil));

                // Si viene foto en el perfil, actualizar cache y DOM
                if (resultado.perfil.foto_perfil && resultado.perfil.foto_perfil.trim() !== '') {
                    localStorage.setItem('foto_perfil_actual', resultado.perfil.foto_perfil);
                    this.actualizarFotosEnDOM(resultado.perfil.foto_perfil);
                    this.fotoPerfilUrl = resultado.perfil.foto_perfil;
                }

                // Actualizar estado de verificación y badge
                if (resultado.perfil.estado_verificacion) {
                    this.estadoVerificacion = resultado.perfil.estado_verificacion;
                    this.actualizarBadgeVerificacion();
                }
            }
        } catch (error) {
            console.error('💥 Error cargando perfil completo:', error);
        }
    }
    // MÉTODO: Actualizar foto en navegación desde otras páginas
    actualizarFotoEnNavegacion(nuevaUrl) {
        if (!nuevaUrl) return;
        
        // Actualizar URL local
        this.fotoPerfilUrl = nuevaUrl;
        
        // Actualizar en localStorage
        localStorage.setItem('foto_perfil_actual', nuevaUrl);
        
        // Actualizar imágenes en el DOM si existen
        this.actualizarFotosEnDOM(nuevaUrl);
    }
    // MÉTODO: Actualizar fotos directamente en el DOM
    actualizarFotosEnDOM(nuevaUrl) {
        try {
            const fotos = document.querySelectorAll('.foto-perfil-usuario, .foto-perfil-grande');
            
            fotos.forEach((foto, index) => {
                if (foto && foto.tagName === 'IMG') {
                    foto.src = nuevaUrl;
                    // manejador de error
                    foto.onerror = function() {
                        this.src = '/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg';
                    };
                }
            });
        } catch (error) {
            console.error('Error actualizando fotos en DOM:', error);
        }
    }
    // MÉTODO: Verificar que la foto pertenece al usuario actual
    verificarFotoPerteneceUsuarioActual() {
        const perfilCompleto = localStorage.getItem('perfil_usuario');
        if (!perfilCompleto || !this.usuario) return false;
        
        try {
            const perfil = JSON.parse(perfilCompleto);
            return perfil.id === this.usuario.id;
        } catch (error) {
            return false;
        }
    }

    // MÉTODO: Limpiar foto si no pertenece al usuario actual
    limpiarFotoSiNoPertenece() {
        if (!this.verificarFotoPerteneceUsuarioActual()) {
            localStorage.removeItem('foto_perfil_actual');
            localStorage.removeItem('perfil_usuario');
            this.fotoPerfilUrl = '/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg';
        }
    }
    verificarAutenticacion() {
        try {
            const datosUsuario = localStorage.getItem('datos_usuario');
            const token = localStorage.getItem('token_usuario');
            
            if (token && datosUsuario) {
                this.usuario = JSON.parse(datosUsuario);
                // Establecer idioma actual desde usuario o localStorage
                this.idioma_actual = this.usuario.idioma || localStorage.getItem('idioma_preferido') || localStorage.getItem('idioma') || 'es';

                // Si el objeto de usuario no trae idioma, solicitar ajustes al backend
                if ((!this.usuario.idioma || this.usuario.idioma === '') && this.usuario.id) {
                    // petición en background para sincronizar idioma desde servidor
                    const usuarioId = this.usuario.id || this.usuario.usuario_id;
                    const urlAPI = '/proyectoWeb/viajeros_peru/backend/api/perfiles.php?accion=obtener_ajustes&usuario_id=' + usuarioId;
                    fetch(urlAPI, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token ? ('Bearer ' + token) : ''
                        }
                    }).then(r => r.json()).then(resp => {
                        if (resp && resp.exito && resp.ajustes && resp.ajustes.idioma) {
                            const nuevo = resp.ajustes.idioma;
                            try {
                                localStorage.setItem('idioma_preferido', nuevo);
                                // actualizar copia en datos_usuario
                                const du = localStorage.getItem('datos_usuario');
                                if (du) {
                                    try {
                                        const obj = JSON.parse(du);
                                        obj.idioma = nuevo;
                                        localStorage.setItem('datos_usuario', JSON.stringify(obj));
                                        this.usuario.idioma = nuevo;
                                    } catch (e) {
                                        console.warn('No se pudo actualizar datos_usuario con idioma desde ajustes:', e);
                                    }
                                }
                                // aplicar idioma en la UI
                                this.aplicarIdioma(nuevo);
                            } catch (e) {
                                console.warn('Error aplicando idioma desde ajustes:', e);
                            }
                        }
                    }).catch(err => {
                        console.warn('No se pudo obtener ajustes para idioma desde backend:', err);
                    });
                }
                
                // 🆕 VERIFICAR QUE LA FOTO PERTENECE AL USUARIO ACTUAL
                this.limpiarFotoSiNoPertenece();
                
                // Intentar cargar foto desde localStorage/perfil
                const cargoFotoLocal = this.cargarFotoDesdeLocalStorage();

                // Si no hay foto local o no existe estado de verificación,
                // intentar obtener perfil completo desde la API.
                const perfilLocal = localStorage.getItem('perfil_usuario');
                if (!cargoFotoLocal || !perfilLocal) {
                    // Llamada en background, no bloqueante
                    this.cargarPerfilCompleto();
                } else {
                    // Si ya hay perfil local, aplicar estado y foto
                    this.cargarEstadoVerificacion();
                    this.actualizarFotoPerfil();
                }
            } else {
                // 🆕 LIMPIAR FOTO SI NO HAY USUARIO AUTENTICADO
                this.fotoPerfilUrl = '/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg';
            }
        } catch (error) {
            console.error('Error verificando autenticación:', error);
        }
    }
    // MÉTODO: Cargar estado de verificación desde localStorage
    cargarEstadoVerificacion() {
        try {
            const perfilCompleto = localStorage.getItem('perfil_usuario');
            if (perfilCompleto) {
                const perfil = JSON.parse(perfilCompleto);
                if (perfil.estado_verificacion) {
                    this.estadoVerificacion = perfil.estado_verificacion;
                }
            }
        } catch (error) {
            console.warn('⚠️ No se pudo cargar el estado de verificación:', error);
        }
    }

    // MÉTODO: Actualizar estado de verificación en tiempo real
    actualizarEstadoVerificacion(nuevoEstado) {
        this.estadoVerificacion = nuevoEstado;
        
        // Actualizar la interfaz si ya está cargada
        this.actualizarBadgeVerificacion();
    }

    // MÉTODO: Actualizar badge de verificación (Nav y Dropdown)
    actualizarBadgeVerificacion() {
        // 1. Elementos del Badge (Texto descriptivo)
        const badgeVerificacion = document.getElementById('badge-verificacion-nav');
        const itemVerificacion = document.getElementById('item-verificacion-nav');
        
        // 2. Elementos del Icono de Check (Buscamos los DOS IDs diferentes)
        const iconoTop = document.getElementById('icono-verificacion-top');      // Barra superior
        const iconoDropdown = document.getElementById('icono-verificacion-dropdown'); // Dentro del menú
        
        if (!badgeVerificacion) return;
        
        badgeVerificacion.className = ''; 

        switch(this.estadoVerificacion) {
            case 'verificado':
                badgeVerificacion.innerHTML = '🛡️ Verificado';
                badgeVerificacion.className = 'badge-verificacion-nav badge-verificado';
                if(itemVerificacion) itemVerificacion.style.display = 'none';
                
                // MOSTRAR AMBOS ICONOS
                if(iconoTop) iconoTop.style.display = 'inline-flex';
                if(iconoDropdown) iconoDropdown.style.display = 'inline-flex';
                break;
                
            case 'pendiente':
                badgeVerificacion.innerHTML = '⏳ Pendiente';
                badgeVerificacion.className = 'badge-verificacion-nav badge-pendiente';
                if(itemVerificacion) itemVerificacion.style.display = 'none';
                
                // OCULTAR AMBOS ICONOS
                if(iconoTop) iconoTop.style.display = 'none';
                if(iconoDropdown) iconoDropdown.style.display = 'none';
                break;
                
            case 'no_verificado':
            default:
                badgeVerificacion.innerHTML = '❌ No verificado';
                badgeVerificacion.className = 'badge-verificacion-nav badge-no-verificado';
                badgeVerificacion.style.cursor = 'pointer';
                badgeVerificacion.onclick = (e) => {
                    e.stopPropagation();
                    window.location.href = '../perfil/perfil.html?modo=verificacion';
                };

                if(itemVerificacion) itemVerificacion.style.display = 'block';
                
                // OCULTAR AMBOS ICONOS
                if(iconoTop) iconoTop.style.display = 'none';
                if(iconoDropdown) iconoDropdown.style.display = 'none';
                break;
        }
    }
    cargarFotoDesdeLocalStorage() {
        try {
            const fotoGuardada = localStorage.getItem('foto_perfil_actual');
            if (fotoGuardada && fotoGuardada.trim() !== '') {
                this.fotoPerfilUrl = fotoGuardada;
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Error cargando foto desde localStorage:', error);
        }
        return false;
    }
    actualizarFotoPerfil() {
        if (!this.usuario) return;
        
        // 1. Intentar desde perfil_usuario en localStorage
        const perfilCompleto = localStorage.getItem('perfil_usuario');
        if (perfilCompleto) {
            try {
                const perfil = JSON.parse(perfilCompleto);
                if (perfil.foto_perfil && perfil.foto_perfil.trim() !== '') {
                    this.fotoPerfilUrl = perfil.foto_perfil;
                    return;
                }
            } catch (error) {
                console.warn('⚠️ No se pudo cargar la foto del perfil_usuario:', error);
            }
        }
        
        // 2. Intentar desde datos_usuario
        if (this.usuario.foto_perfil && this.usuario.foto_perfil.trim() !== '') {
            this.fotoPerfilUrl = this.usuario.foto_perfil;
            return;
        }
        
        // 3. Usar placeholder por defecto
        this.fotoPerfilUrl = '/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg';
    }
    cargarNavegacion() {
        const navContainer = document.getElementById('navegacion-global');
        if (!navContainer) {
            return;
        }

        if (this.usuario) {
            this.cargarNavegacionAutenticada(navContainer);
        } else {
            this.cargarNavegacionPublica(navContainer);
        }
    }

    actualizarTiempoSesionEnNavbar() {
        if (!this.gestorSesion || !this.hayUsuarioLogueado()) return;
        
        const elemento = document.getElementById('tiempo-sesion-nav');
        if (elemento) {
            elemento.textContent = `🕒 Sesión: ${this.gestorSesion.formatearTiempoRestante()}`;
            
            // Cambiar color si queda poco tiempo (menos de 10 min)
            const tiempoRestante = this.gestorSesion.obtenerTiempoRestante();
            if (tiempoRestante < 10 * 60) {
                elemento.style.color = '#dc3545';
                elemento.style.fontWeight = 'bold';
            }
        }
    }

    cargarNavegacionAutenticada(container) {
        // CACHE BUSTING A LA FOTO
        let fotoUrl = this.fotoPerfilUrl;
        if (fotoUrl && !fotoUrl.includes('/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg')) {
            fotoUrl += '?t=' + new Date().getTime(); // Cache busting
        }
        
        const L = this.getLabels();

        container.innerHTML = `
            <nav class="navegacion">
                <div class="contenedor">
                    <!-- Menú Hamburguesa -->
                    <button class="menu-hamburguesa" id="boton-menu-movil">
                        ☰
                    </button>
                    <div class="logo">
                        <a href="../inicio/inicio.html" style="text-decoration: none; color: inherit;">
                            <img src="/proyectoWeb/viajeros_peru/public/img/logos/logo.png" alt="Viajeros Perú" class="logo-imagen" 
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                            <h1 style="display: none;">🌍 Viajeros Perú</h1>
                        </a>
                    </div>
                    
                    <!-- ENLACES DE NAVEGACIÓN PRINCIPAL -->
                    <div class="navegacion-principal" style="margin-left: 0rem;">
                        <a href="../inicio/inicio.html#anuncios" class="enlace-nav">${L.anuncios}</a>
                        <a href="../inicio/inicio.html#comunidad" class="enlace-nav">${L.comunidad}</a>
                        <a href="../inicio/inicio.html#contacto" class="enlace-nav">${L.contacto}</a>
                    </div>
                    
                    <div class="menu-usuario">
                        <!-- Notificaciones -->
                        <div class="contenedor-notificaciones" id="contenedor-notificaciones">
                            <button class="icono-notificaciones" id="boton-notificaciones">
                                🔔
                                <span class="badge-notificacion" id="badge-notificaciones">0</span>
                            </button>
                            <div class="dropdown-notificaciones" id="dropdown-notificaciones">
                                <div class="cabecera-notificaciones">
                                    <h4>${L.notificaciones}</h4>
                                    <span class="contador-notificaciones" id="contador-dropdown-notificaciones">0 ${L.nuevas}</span>
                                </div>
                                <div class="lista-notificaciones" id="lista-notificaciones">
                                    <div class="sin-notificaciones">
                                        <p>${L.sin_notificaciones}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Configuración -->
                        <div class="contenedor-configuracion">
                            <button class="icono-configuracion" id="boton-configuracion">⚙️</button>
                            <div class="dropdown-configuracion" id="dropdown-configuracion">
                                <div class="item-configuracion" onclick="navegacionGlobal.cambiarIdioma()">
                                    <span>🌐 ${L.idioma_label}</span>
                                    <span class="valor-actual" id="nav-valor-idioma">${this.getIdiomaLabel()}</span>
                                </div>
                                <div class="item-configuracion" onclick="navegacionGlobal.irA('../perfil/ajustes.html')">
                                    <span>🔧 ${L.ajustes}</span>
                                </div>
                                <hr class="separador-configuracion">
                                <div class="item-configuracion item-peligro" onclick="navegacionGlobal.cerrarSesion()">
                                    <span>🚪 ${L.cerrar_sesion}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Perfil -->
                        <div class="contenedor-perfil" id="contenedor-perfil">
                            <button class="perfil-usuario" id="boton-perfil">
                                <img src="${this.fotoPerfilUrl}" 
                                    alt="Foto de perfil" 
                                    class="foto-perfil-usuario"
                                    id="foto-perfil-usuario"
                                    onerror="this.src='/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg'">
                                <span class="nombre-usuario" id="nombre-usuario-completo">
                                    ${this.usuario.nombre}
                                    <span id="icono-verificacion-top" class="icono-verificado-top" style="display: none;" title="Usuario Verificado">
                                        ✓
                                    </span>
                                </span>
                            </button>
                            <div class="dropdown-perfil" id="dropdown-perfil">
                                <div class="info-perfil-dropdown">
                                    <img src="${this.fotoPerfilUrl}" 
                                        alt="Foto de perfil" 
                                        class="foto-perfil-grande"
                                        onerror="this.src='/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg'">
                                    <div class="datos-usuario-dropdown">
                                        <div style="display: flex; align-items: center; flex-wrap: wrap;">
                                            <strong id="nombre-dropdown" style="margin-right: 5px;">${this.usuario.nombre} ${this.usuario.apellido}</strong>
                                            
                                            <span id="icono-verificacion-dropdown" class="icono-verificado-top" style="display: none;" title="Usuario Verificado">
                                                ✓
                                            </span>
                                        </div>
                                        <span class="email-dropdown" id="email-dropdown">${this.usuario.correo}</span>
                                            <div class="info-adicional-dropdown">
                                                <span class="rol-dropdown" id="rol-dropdown">${this.usuario.rol === 'viajero' ? L.rol_viajero : L.rol_anfitrion}</span>
                                                <span class="badge-verificacion-nav" id="badge-verificacion-nav">❌ ${L.no_verificado}</span>
                                            <span class="tiempo-sesion" id="tiempo-sesion-nav" style="font-size: 11px; color: #666; margin-top: 2px;">
                                                🕒 ${L.inactividad_label}: ${this.gestorSesion ? this.gestorSesion.formatearTiempoRestante() : '--:--'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <hr class="separador-perfil">
                                <a href="../perfil/panel_control.html" class="item-perfil">
                                    <span>📊 ${L.panel_control}</span>
                                </a>
                                <a href="../perfil/perfil.html" class="item-perfil">
                                    <span>👤 ${L.ver_perfil}</span>
                                </a>
                                <a href="../perfil/perfil.html?modo=edicion" class="item-perfil">
                                    <span>✏️ ${L.editar_perfil}</span>
                                </a>
                                <a href="../inicio/favoritos.html" class="item-perfil">
                                    <span>❤️ ${L.favoritos}</span>
                                </a>
                                <div class="item-perfil" id="item-verificacion-nav" style="display: none;">
                                    <a href="../perfil/perfil.html?modo=verificacion" class="enlace-verificacion">
                                        <span>✅ Verificar perfil</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Menú Móvil -->
                <div class="menu-movil" id="menu-movil">
                    <div class="enlaces-movil">
                        <a href="../inicio/inicio.html#anuncios" class="enlace-movil">${L.anuncios}</a>
                        <a href="../inicio/inicio.html#comunidad" class="enlace-movil">${L.comunidad}</a>
                        <a href="../inicio/inicio.html#contacto" class="enlace-movil">${L.contacto}</a>
                    </div>
                </div>
            </nav>
        `;

        this.configurarDropdowns();
        this.configurarMenuMovil();
        this.cargarNotificaciones();
        this.iniciarSistemaNotificaciones();
        setTimeout(() => {
            this.actualizarTiempoSesionEnNavbar();
            // Actualizar cada 30 segundos
            setInterval(() => this.actualizarTiempoSesionEnNavbar(), 1000);
        }, 100);
    }

    cargarNavegacionPublica(container) {
        const L = this.getLabels();
        container.innerHTML = `
            <nav class="navegacion">
                <div class="contenedor">
                    <!-- Menú Hamburguesa -->
                    <button class="menu-hamburguesa" id="boton-menu-movil">
                        ☰
                    </button>
                    <div class="logo">
                        <a href="../inicio/inicio.html" style="text-decoration: none; color: inherit;">
                            <img src="/proyectoWeb/viajeros_peru/public/img/logos/logo.png" alt="Viajeros Perú" class="logo-imagen" 
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                            <h1 style="display: none;">🌍 Viajeros Perú</h1>
                        </a>
                    </div>
                    <div class="navegacion-principal" id="menu-principal" style="margin-left: 3rem;">
                        <a href="../inicio/inicio.html#anuncios" class="enlace-nav">${L.anuncios}</a>
                        <a href="../inicio/inicio.html#comunidad" class="enlace-nav">${L.comunidad}</a>
                        <a href="../inicio/inicio.html#contacto" class="enlace-nav">${L.contacto}</a>
                    </div>
                    <div class="menu-usuario">    
                        <a href="../auth/iniciar_sesion.html" class="boton-secundario">${L.iniciar_sesion || 'Iniciar Sesión'}</a>
                        <a href="../auth/registro.html" class="boton-principal">${L.registrarse || 'Registrarse'}</a>
                    </div>
                </div>
                <!-- Menú Móvil -->
                <div class="menu-movil" id="menu-movil">
                    <div class="enlaces-movil">
                        <a href="../inicio/inicio.html#anuncios" class="enlace-movil">${L.anuncios}</a>
                        <a href="../inicio/inicio.html#comunidad" class="enlace-movil">${L.comunidad}</a>
                        <a href="../inicio/inicio.html#contacto" class="enlace-movil">${L.contacto}</a>
                    </div>
                </div>
            </nav>
        `;
        this.configurarMenuMovil();
    }

    // MÉTODO: Configurar menú móvil
    configurarMenuMovil() {
        const botonMenuMovil = document.getElementById('boton-menu-movil');
        const menuMovil = document.getElementById('menu-movil');

        if (botonMenuMovil && menuMovil) {
            botonMenuMovil.addEventListener('click', (e) => {
                e.stopPropagation();
                menuMovil.classList.toggle('activo');
                
                // Cerrar otros dropdowns al abrir menú móvil
                this.cerrarTodosDropdowns();
            });

            // Cerrar menú móvil al hacer click en un enlace
            const enlacesMovil = menuMovil.querySelectorAll('.enlace-movil');
            enlacesMovil.forEach(enlace => {
                enlace.addEventListener('click', () => {
                    menuMovil.classList.remove('activo');
                });
            });

            // Cerrar menú móvil al hacer click fuera
            document.addEventListener('click', (e) => {
                if (!menuMovil.contains(e.target) && !botonMenuMovil.contains(e.target)) {
                    menuMovil.classList.remove('activo');
                }
            });
        }
    }

    configurarDropdowns() {
        const dropdowns = [
            { 
                boton: 'boton-notificaciones', 
                dropdown: 'dropdown-notificaciones',
                accionEspecial: () => this.cargarNotificacionesRecientes()
            },
            { 
                boton: 'boton-configuracion', 
                dropdown: 'dropdown-configuracion' 
            },
            { 
                boton: 'boton-perfil', 
                dropdown: 'dropdown-perfil' ,
                accionEspecial: () => this.actualizarBadgeVerificacion()
            }
        ];

        dropdowns.forEach(({ boton, dropdown, accionEspecial }) => {
            const botonElement = document.getElementById(boton);
            const dropdownElement = document.getElementById(dropdown);

            if (botonElement && dropdownElement) {
                botonElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleDropdown(dropdownElement);
                    this.cerrarOtrosDropdowns(dropdownElement);
                    this.cerrarMenuMovil();
                    // Cerrar menú móvil si está abierto
                    const menuMovil = document.getElementById('menu-movil');
                    if (menuMovil) {
                        menuMovil.classList.remove('activo');
                    }

                    // Ejecutar acción especial si existe
                    if (accionEspecial) {
                        accionEspecial();
                    }
                });
            }
        });

        // Cerrar dropdowns al hacer click fuera
        document.addEventListener('click', () => {
            this.cerrarTodosDropdowns();
        });

        setTimeout(() => {
            this.actualizarBadgeVerificacion();
        }, 100);
    }
    // 🆕 Método auxiliar para mejor manejo de estados
    cerrarMenuMovil() {
        const menuMovil = document.getElementById('menu-movil');
        if (menuMovil) {
            menuMovil.classList.remove('activo');
        }
    }
    toggleDropdown(dropdown) {
        if (!dropdown) return;
        
        // Usar classList en lugar de style para mejor compatibilidad
        const estaAbierto = dropdown.classList.contains('activo');
        
        if (estaAbierto) {
            dropdown.classList.remove('activo');
            dropdown.style.display = 'none';
        } else {
            dropdown.classList.add('activo');
            dropdown.style.display = 'block';
        }
    }

    cerrarOtrosDropdowns(dropdownActual) {
        const dropdowns = [
            document.getElementById('dropdown-notificaciones'),
            document.getElementById('dropdown-configuracion'),
            document.getElementById('dropdown-perfil')
        ];

        dropdowns.forEach(dropdown => {
            if (dropdown && dropdown !== dropdownActual) {
                dropdown.style.display = 'none';
            }
        });
    }

    cerrarTodosDropdowns() {
        const dropdowns = [
            document.getElementById('dropdown-notificaciones'),
            document.getElementById('dropdown-configuracion'),
            document.getElementById('dropdown-perfil')
        ];

        dropdowns.forEach(dropdown => {
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        });
    }

    async cargarNotificaciones() {
        if (!this.usuario) return;

        try {
            const token = localStorage.getItem('token_usuario');
            if (!token) {
                console.error('No hay token disponible');
                return;
            }

            // 🆕 ENVIAR TOKEN EN QUERY STRING COMO FALLBACK PARA INFINITYFREE
            const url = `/proyectoWeb/viajeros_peru/backend/api/notificaciones.php?accion=contar_no_vistas&token=${encodeURIComponent(token)}`;
            
            const respuesta = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                }
            });

            
            console.log('📡 Fetch notificaciones - Status:', respuesta.status, 'URL:', url);
            
            if (respuesta.status === 401) {
                // Intentar sin header Authorization (solo query string)
                console.log('⚠️ 401 recibido, intentando sin header Authorization...');
                const respuesta2 = await fetch(`/proyectoWeb/viajeros_peru/backend/api/notificaciones.php?accion=contar_no_vistas&token=${encodeURIComponent(token)}`, {
                    method: 'GET',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json'
                    }
                });
                
                if (respuesta2.ok) {
                    const resultado2 = await respuesta2.text();
                    try {
                        const json = JSON.parse(resultado2);
                        if (json.exito) {
                            this.actualizarBadgeNotificaciones(json.total);
                            this.cargarNotificacionesRecientes();
                        }
                    } catch (e) {
                        console.error('Error parseando respuesta alternativa:', e);
                    }
                    return;
                }
            }
            
            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }
            
            const resultado = await respuesta.text();
            console.log('📨 Respuesta notificaciones:', resultado.substring(0, 200) + '...');
            
            try {
                const json = JSON.parse(resultado);
                if (json.exito) {
                    this.actualizarBadgeNotificaciones(json.total);
                    // Cargar las 5 más recientes para dropdown
                    this.cargarNotificacionesRecientes();
                }
            } catch (e) {
                console.error('Respuesta inválida:', resultado);
            }
        } catch (error) {
            console.error('Error cargando notificaciones:', error);
        }
    }

    // MÉTODO: Cargar últimas 5 notificaciones no vistas
    async cargarNotificacionesRecientes() {
        if (!this.usuario) return;

        try {
            const token = localStorage.getItem('token_usuario');
            if (!token) return;

            // 🆕 ENVIAR TOKEN EN QUERY STRING COMO FALLBACK
            const url = `/proyectoWeb/viajeros_peru/backend/api/notificaciones.php?accion=obtener_no_vistas&token=${encodeURIComponent(token)}`;
            
            const respuesta = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                }
            });

            
            console.log('📡 Fetch notificaciones recientes - Status:', respuesta.status);
            
            if (respuesta.status === 401) {
                // Intentar sin header
                console.log('⚠️ 401 en recientes, intentando sin header...');
                const respuesta2 = await fetch(`/proyectoWeb/viajeros_peru/backend/api/notificaciones.php?accion=obtener_no_vistas&token=${encodeURIComponent(token)}`, {
                    method: 'GET',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                
                const resultado2 = await respuesta2.text();
                try {
                    const json = JSON.parse(resultado2);
                    if (json.exito) {
                        this.mostrarNotificacionesEnDropdown(json.notificaciones);
                    } else {
                        this.mostrarNotificacionesEnDropdown([]);
                    }
                } catch (e) {
                    console.error('Error al parsear notificaciones alternativas:', e);
                    this.mostrarNotificacionesEnDropdown([]);
                }
                return;
            }
            
            const resultado = await respuesta.text();
            try {
                const json = JSON.parse(resultado);
                if (json.exito) {
                    this.mostrarNotificacionesEnDropdown(json.notificaciones);
                } else {
                    this.mostrarNotificacionesEnDropdown([]);
                }
            } catch (e) {
                console.error('Error al parsear notificaciones:', e);
                this.mostrarNotificacionesEnDropdown([]);
            }
        } catch (error) {
            console.error('Error cargando notificaciones recientes:', error);
            this.mostrarNotificacionesEnDropdown([]);
        }
    }

    // MÉTODO: Mostrar notificaciones en el dropdown
    mostrarNotificacionesEnDropdown(notificaciones) {
        const L = this.getLabels();
        const listaNotificaciones = document.getElementById('lista-notificaciones');
        const contadorDropdown = document.getElementById('contador-dropdown-notificaciones');
        
        if (!listaNotificaciones) return;

        // Calcular notificaciones no leídas
        const noLeidas = notificaciones ? notificaciones.filter(n => !n.leido).length : 0;
        
        // Actualizar contador del dropdown
        if (contadorDropdown) {
            const textoNuevas = noLeidas === 1 ? 
                L.nueva || 'nueva' : 
                L.nuevas || 'nuevas';
            contadorDropdown.textContent = `${noLeidas} ${textoNuevas}`;
        }

        let html = '';
        
        if (!notificaciones || notificaciones.length === 0) {
            // Cuando no hay notificaciones
            html = `
                <div class="sin-notificaciones">
                    <p>✓ ${L.sin_notificaciones || 'No hay notificaciones nuevas'}</p>
                </div>`;
        } else {
            // Cuando hay notificaciones
            html = notificaciones.map(notif => {
                const fecha = this.formatearFechaRelativa(notif.fecha_creacion);
                const clase = !notif.leido ? 'notificacion-sin-leer' : 'notificacion-leida';
                const icono = this.obtenerIconoNotificacion(notif.tipo);
                
                return `
                    <div class="item-notificacion ${clase}" data-id="${notif.id}" onclick="window.navegacionGlobal.abrirNotificacion(${notif.id}, '${notif.enlace || ''}')">
                        <div class="icono-notif">${icono}</div>
                        <div class="contenido-notif">
                            <div class="titulo-notif">${this.escaparHTML(notif.titulo)}</div>
                            <div class="descripcion-notif">${this.escaparHTML(notif.contenido.substring(0, 50))}${notif.contenido.length > 50 ? '...' : ''}</div>
                            <div class="fecha-notif">${fecha}</div>
                        </div>
                        ${!notif.leido ? '<div class="punto-no-leido"></div>' : ''}
                    </div>`;
            }).join('');
        }

        // 🆕 SIEMPRE agregar el pie con el enlace "Ver todas"
        html += `
            <div class="pie-notificaciones">
                <a href="/proyectoWeb/viajeros_peru/app/vistas/perfil/notificaciones.html" class="ver-todas">
                    ${L.ver_todas_notificaciones || 'Ver todas las notificaciones'} →
                </a>
            </div>`;

        listaNotificaciones.innerHTML = html;
    }

    // MÉTODO: Obtener ícono según tipo de notificación
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

    // MÉTODO: Abrir notificación (marca como visto y abre modal)
    async abrirNotificacion(notificacionId, enlace) {
        // Marcar como visto
        await this.marcarNotificacionVisto(notificacionId);
        
        // Si tiene enlace, redirigir
        if (enlace && enlace.trim() !== '') {
            // Agregar token si es necesario
            const token = localStorage.getItem('token_usuario');
            if (!enlace.includes('?')) {
                enlace += '?token=' + token;
            } else {
                enlace += '&token=' + token;
            }
            window.location.href = enlace;
        }
        // Si no hay enlace, solo marca como visto (notificaciones de sistema)
    }

    // MÉTODO: Marcar notificación como visto
    async marcarNotificacionVisto(notificacionId) {
        try {
            const token = localStorage.getItem('token_usuario');
            if (!token) return;

            // 🆕 ENVIAR TOKEN EN QUERY STRING COMO FALLBACK
            const url = `/proyectoWeb/viajeros_peru/backend/api/notificaciones.php?token=${encodeURIComponent(token)}`;
            
            const data = {
                accion: 'marcar_como_visto',
                notificacion_id: notificacionId
            };

            // Primero intentar con header
            const respuesta = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                }
            });

            
            console.log('📡 Status marcar notificación como visto:', respuesta.status);
            
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
            
            if (respuesta.ok) {
                // Recargar el badge
                this.cargarNotificaciones();
            } else {
                console.error('Error en la respuesta del servidor:', respuesta.status);
            }
        } catch (error) {
            console.error('Error marcando notificación como visto:', error);
        }
    }

    // MÉTODO: Formatear fecha relativa
    formatearFechaRelativa(fechaStr) {
        const L = this.getLabels();
        const fecha = new Date(fechaStr);
        const ahora = new Date();
        const diffMs = ahora - fecha;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return L.ahora || 'Ahora';
        if (diffMins < 60) return (L.min_ago || '{n} min').replace('{n}', diffMins);
        if (diffHours < 24) return (L.hora_ago || '{n} h').replace('{n}', diffHours);
        if (diffDays < 7) return (L.dia_ago || '{n} d').replace('{n}', diffDays);

        return fecha.toLocaleDateString();
    }

    // MÉTODO  Escapar HTML para seguridad
    escaparHTML(texto) {
        if (!texto) return '';
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    iniciarSistemaNotificaciones() {
        if (!this.usuario) return;

        // Actualizar cada 30 segundos
        this.intervaloNotificaciones = setInterval(() => {
            this.cargarNotificaciones();
        }, 30000);
    }

    actualizarBadgeNotificaciones(totalNoLeidos) {
        // 1. Actualizar el badge principal
        const badge = document.getElementById('badge-notificaciones');
        if (badge) {
            const mostrar = totalNoLeidos > 5 ? '+5' : totalNoLeidos;
            badge.textContent = mostrar;
            
            if (totalNoLeidos > 0) {
                badge.style.background = '#e53e3e';
                badge.style.color = 'white';
                badge.style.animation = 'pulse 2s infinite';
            } else {
                badge.style.background = '';
                badge.style.animation = '';
            }
        }

        // 🆕 2. Actualizar el contador del dropdown
        const contadorDropdown = document.getElementById('contador-dropdown-notificaciones');
        if (contadorDropdown) {
            const L = this.getLabels();
            const textoNuevas = totalNoLeidos === 1 ? 
                L.nueva || 'nueva' : 
                L.nuevas || 'nuevas';
            
            contadorDropdown.textContent = `${totalNoLeidos} ${textoNuevas}`;
            
            // También actualizar el estilo
            if (totalNoLeidos > 0) {
                contadorDropdown.style.color = '#e53e3e';
                contadorDropdown.style.fontWeight = 'bold';
            } else {
                contadorDropdown.style.color = '';
                contadorDropdown.style.fontWeight = '';
            }
        }

        // 3. Actualizar título de la página
        this.actualizarTituloPagina(totalNoLeidos);
    }

    actualizarTituloPagina(totalNoLeidos) {
        const tituloBase = document.title.replace(/^\(\d+\)\s*/, '');
        if (totalNoLeidos > 0) {
            document.title = `(${totalNoLeidos}) ${tituloBase}`;
        } else {
            document.title = tituloBase;
        }
    }

    // Métodos de utilidad global
    getIdiomaActual() {
        // Priorizar usuario, luego localStorage
        if (this.usuario && this.usuario.idioma) return this.usuario.idioma;
        const almacen = localStorage.getItem('idioma_preferido') || localStorage.getItem('idioma') || this.idioma_actual;
        return almacen || 'es';
    }

    getIdiomaLabel(code) {
        const c = code || this.getIdiomaActual();
        return c === 'en' ? 'English' : 'Español';
    }

    getLabels() {
        const lang = this.getIdiomaActual();
        if (lang === 'en') {
            return {
                anuncios: 'Listings',
                comunidad: 'Community',
                contacto: 'Contact',
                idioma_label: 'Language',
                ajustes: 'Settings',
                iniciar_sesion: 'Sign In',
                registrarse: 'Sign Up',
                cerrar_sesion: 'Sign Out',
                panel_control: 'Dashboard',
                ver_perfil: 'View profile',
                editar_perfil: 'Edit profile',
                favoritos: 'Favorites',
                notificaciones: 'Notifications',
                rol_viajero: 'Traveler',
                rol_anfitrion: 'Host',
                no_verificado: 'Not verified',
                nuevas: 'new',
                sin_notificaciones: 'No new notifications',
                ver_todas_notificaciones: 'View all notifications',
                mensajes_sin_nuevos: 'No new messages',
                ahora: 'Now',
                min_ago: '{n} min ago',
                hora_ago: '{n} h ago',
                dia_ago: '{n} d ago',
                inactividad_label: 'Inactivity',
                titulo_modal_idioma: 'Select language'
            };
        }

        // default es
        return {
            anuncios: 'Anuncios',
            comunidad: 'Comunidad',
            contacto: 'Contacto',
            idioma_label: 'Idioma',
            ajustes: 'Ajustes',
            iniciar_sesion: 'Iniciar Sesión',
            registrarse: 'Registrarse',
            cerrar_sesion: 'Cerrar Sesión',
            panel_control: 'Panel de Control',
            ver_perfil: 'Ver mi perfil',
            editar_perfil: 'Editar perfil',
            favoritos: 'Ver favoritos',
            notificaciones: 'Notificaciones',
            rol_viajero: 'Viajero',
            rol_anfitrion: 'Anfitrión',
            no_verificado: 'No verificado',
            nuevas: 'nuevas',
            sin_notificaciones: 'No tienes notificaciones nuevas',
            ver_todas_notificaciones: 'Ver todas las notificaciones',
            mensajes_sin_nuevos: 'No tienes mensajes nuevos',
            ahora: 'Ahora',
            min_ago: 'Hace {n} min',
            hora_ago: 'Hace {n} h',
            dia_ago: 'Hace {n} d',
            inactividad_label: 'Inactividad',
            titulo_modal_idioma: 'Selecciona idioma',
            ver_origen: 'Ver Origen',
            cerrar_modal: 'Cerrar'
        };
    }

    cambiarIdioma() {
        const L = this.getLabels();
        // Mostrar un pequeño modal simple para elegir idioma
        const existente = document.getElementById('modal-idioma');
        if (existente) return; // ya abierto

        const modal = document.createElement('div');
        modal.id = 'modal-idioma';
        modal.style.position = 'fixed';
        modal.style.left = '0';
        modal.style.top = '0';
        modal.style.right = '0';
        modal.style.bottom = '0';
        modal.style.background = 'rgba(0,0,0,0.4)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9999';

        const cuadro = document.createElement('div');
        cuadro.style.background = '#fff';
        cuadro.style.padding = '18px';
        cuadro.style.borderRadius = '8px';
        cuadro.style.minWidth = '260px';
        cuadro.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';

        // Añadir listener al fondo del modal para cerrarlo
        modal.addEventListener('click', (evento) => {
            if (evento.target === modal) {
                document.body.removeChild(modal);
            }
        });

        // Añadir un botón de cierre "X"
        const btnCerrar = document.createElement('button');
        btnCerrar.textContent = 'X';
        btnCerrar.style.position = 'absolute';
        btnCerrar.style.top = '5px';
        btnCerrar.style.right = '5px';
        btnCerrar.style.background = 'none';
        btnCerrar.style.border = 'none';
        btnCerrar.style.cursor = 'pointer';
        btnCerrar.onclick = () => {
            document.body.removeChild(modal);
        };
        cuadro.style.position = 'relative'; // Asegura que el botón "X" se posicione correctamente dentro del cuadro
        cuadro.appendChild(btnCerrar);

        const titulo = document.createElement('h3');
        titulo.textContent = L.titulo_modal_idioma || 'Selecciona idioma / Select language';
        titulo.style.marginTop = '0';
        cuadro.appendChild(titulo);

        const btnEs = document.createElement('button');
        btnEs.textContent = 'Español';
        btnEs.style.marginRight = '10px';
        btnEs.className = 'boton';
        btnEs.onclick = () => { this.aplicarIdioma('es'); document.body.removeChild(modal); };

        const btnEn = document.createElement('button');
        btnEn.textContent = 'English';
        btnEn.className = 'boton';
        btnEn.onclick = () => { this.aplicarIdioma('en'); document.body.removeChild(modal); };

        const contBtns = document.createElement('div');
        contBtns.style.display = 'flex';
        contBtns.style.justifyContent = 'flex-end';
        contBtns.style.marginTop = '12px';
        contBtns.appendChild(btnEs);
        contBtns.appendChild(btnEn);

        cuadro.appendChild(contBtns);
        modal.appendChild(cuadro);
        document.body.appendChild(modal);
    }

    aplicarIdioma(codigo) {
        try {
            // Actualizar almacenamiento local
            localStorage.setItem('idioma_preferido', codigo);
            this.idioma_actual = codigo;

            // Si tenemos usuario, actualizar propiedad y persistir en backend
            const datosUsuario = localStorage.getItem('datos_usuario');
            let usuarioId = null;
            if (datosUsuario) {
                try {
                    const datos = JSON.parse(datosUsuario);
                    usuarioId = datos.id || datos.usuario_id || null;
                    // actualizar copia en memoria
                    if (this.usuario) this.usuario.idioma = codigo;
                    // Actualizar también el objeto almacenado para que el resto del frontend lo lea inmediatamente
                    try {
                        datos.idioma = codigo;
                        datos.idioma_preferido = codigo;
                        localStorage.setItem('datos_usuario', JSON.stringify(datos));
                    } catch (e) {
                        console.warn('No se pudo actualizar localStorage datos_usuario con el nuevo idioma:', e);
                    }
                } catch (e) {
                    console.warn('No se pudo parsear datos_usuario al aplicar idioma');
                }
            }

            // Re-render navigation to apply labels
            this.cargarNavegacion();

            // Actualizar la etiqueta visible del idioma si existe
            const navSpan = document.getElementById('nav-valor-idioma');
            if (navSpan) navSpan.textContent = this.getIdiomaLabel(codigo);

            // Actualizar el atributo lang del documento para accesibilidad y para bibliotecas que lo usen
            try {
                document.documentElement.lang = codigo;
            } catch (e) {
                // noop
            }

            // Despachar un evento global para que otras partes de la app reaccionen al cambio de idioma
            try {
                const ev = new CustomEvent('idiomaCambiado', { detail: { idioma: codigo } });
                window.dispatchEvent(ev);
            } catch (e) {
                console.warn('No se pudo despachar evento idiomaCambiado:', e);
            }

            // Llamada a la API para persistir preferencia si hay usuarioId
            if (usuarioId) {
                fetch('/proyectoWeb/viajeros_peru/backend/api/perfiles.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accion: 'actualizar_ajustes', usuario_id: usuarioId, idioma: codigo })
                })
                .then(res => res.json())
                .then(resp => {
                    if (resp.exito) {
                        console.log('Preferencia de idioma guardada en el servidor');
                        // Asegurarnos de que si el servidor devuelve datos actualizados los apliquemos
                        if (resp.ajustes && resp.ajustes.idioma) {
                            const servidor = resp.ajustes.idioma;
                            localStorage.setItem('idioma_preferido', servidor);
                            // actualizar datos_usuario si está disponible
                            try {
                                const du = localStorage.getItem('datos_usuario');
                                if (du) {
                                    const obj = JSON.parse(du);
                                    obj.idioma = servidor;
                                    obj.idioma_preferido = servidor;
                                    localStorage.setItem('datos_usuario', JSON.stringify(obj));
                                }
                            } catch (e) {
                                console.warn('No se pudo sincronizar datos_usuario con la respuesta del servidor:', e);
                            }
                            // Re-render por si el servidor devuelve un valor distinto
                            this.idioma_actual = servidor;
                            this.cargarNavegacion();
                            const ev2 = new CustomEvent('idiomaCambiado', { detail: { idioma: servidor } });
                            window.dispatchEvent(ev2);
                        }
                    } else {
                        console.warn('No se pudo guardar idioma en servidor:', resp.error);
                    }
                })
                .catch(err => console.warn('Error guardando idioma en servidor:', err));
            }
        } catch (error) {
            console.error('Error aplicando idioma:', error);
        }
    }

    irA(pagina) {
        window.location.href = pagina;
    }

    cerrarSesion() {
        // Detener gestor de sesión
        if (this.gestorSesion) {
            this.gestorSesion.detenerMonitoreo();
        }
        
        // 🆕 LIMPIAR CACHE DE FOTOS AL CERRAR SESIÓN
        localStorage.removeItem('foto_perfil_actual');
        localStorage.removeItem('perfil_usuario');
        sessionStorage.removeItem('login_reciente');
        
        // Limpiar datos de usuario
        localStorage.removeItem('token_usuario');
        localStorage.removeItem('datos_usuario');
        // Limpiar preferencia de idioma en cache para evitar afectar siguiente usuario
        localStorage.removeItem('idioma_preferido');
        
        // Detener intervalos
        if (this.intervaloNotificaciones) {
            clearInterval(this.intervaloNotificaciones);
        }
        
        window.location.href = '../auth/iniciar_sesion.html';
    }
}

// Inicializar navegación global
document.addEventListener('DOMContentLoaded', function() {
    window.navegacionGlobal = new NavegacionGlobal();
});



// ==============================================
// GESTOR DE SESIÓN CON AUTO-LOGOUT
// ==============================================

class GestorSesion {
    constructor() {
        this.tiempoInactividad = 0;
        this.tiempoMaximo = 30 * 60 * 1000; // 30 minutos de inactividad
        this.advertenciaTimeout = 5 * 60 * 1000; // 5 minutos antes
        this.intervalo = null;
        this.advertenciaMostrada = false;
        this.modalAdvertencia = null;
        this.timestampUltimaActividad = null; // NUEVO
        //debugging
        console.log(`⏱️ GestorSesion creado: ${this.tiempoMaximo/60000} min total, advertencia a ${this.advertenciaTimeout/60000} min`);
    }

    inicializar() {
        if (!this.hayUsuarioLogueado()) return;

        // CARGAR timestamp desde localStorage si existe
        const timestampGuardado = localStorage.getItem('timestamp_ultima_actividad');
        if (timestampGuardado) {
            const tiempoTranscurrido = Date.now() - parseInt(timestampGuardado);
            this.tiempoInactividad = Math.min(tiempoTranscurrido, this.tiempoMaximo);
            console.log(`⏱️ Tiempo transcurrido desde última actividad: ${Math.floor(tiempoTranscurrido/1000)} segundos`);
        } else {
            // Primera vez, guardar timestamp
            this.guardarTimestamp();
        }
        
        console.log(`🛡️ GestorSesion ACTIVADO - Tiempo inactividad: ${Math.floor(this.tiempoInactividad/1000)}s`);
        
        this.reiniciarTemporizador();
        this.iniciarMonitoreo();
        this.verificarToken();
    }
    guardarTimestamp() {
        localStorage.setItem('timestamp_ultima_actividad', Date.now().toString());
    }
    reiniciarTemporizador() {
        this.tiempoInactividad = 0;
        this.advertenciaMostrada = false;
        this.guardarTimestamp(); // GUARDAR CUANDO HAY ACTIVIDAD
        
        if (this.modalAdvertencia) {
            this.modalAdvertencia.remove();
            this.modalAdvertencia = null;
        }
    }

    hayUsuarioLogueado() {
        const hayToken = localStorage.getItem('token_usuario');
        const hayDatos = localStorage.getItem('datos_usuario');
        
        console.log(`🔍 GestorSesion.hayUsuarioLogueado(): token=${hayToken ? 'SÍ' : 'NO'}, datos=${hayDatos ? 'SÍ' : 'NO'}`);
        
        return hayToken && hayDatos;
    }

    iniciarMonitoreo() {
        // Escuchar eventos de actividad
        const eventos = ['mousemove', 'keypress', 'click', 'scroll', 'touchstart'];
        eventos.forEach(evento => {
            document.addEventListener(evento, () => this.reiniciarTemporizador());
        });

        // Monitorear cada segundo
        this.intervalo = setInterval(() => this.verificarSesion(), 1000);
    }

    verificarSesion() {
        if (!this.hayUsuarioLogueado()) {
            this.detenerMonitoreo();
            return;
        }

        this.tiempoInactividad += 1000; // 1 segundo

        // Mostrar advertencia 5 minutos antes
        if (!this.advertenciaMostrada && 
            this.tiempoInactividad >= (this.tiempoMaximo - this.advertenciaTimeout)) {
            this.mostrarAdvertencia();
            this.advertenciaMostrada = true;
        }

        // Cerrar sesión después de 30 minutos
        if (this.tiempoInactividad >= this.tiempoMaximo) {
            this.cerrarSesion('Tu sesión ha expirado por inactividad');
        }
    }

    verificarToken() {
        try {
            const token = localStorage.getItem('token_usuario');
            if (!token) {
                this.cerrarSesion();
                return;
            }

            // Decodificar token para verificar expiración
            const partes = token.split('.');
            if (partes.length !== 3) {
                this.cerrarSesion();
                return;
            }

            const payload = JSON.parse(atob(partes[1]));
            const tiempoRestante = (payload.exp * 1000) - Date.now();

            // Si el token expira en menos de 10 minutos, mostrar advertencia
            if (tiempoRestante < 10 * 60 * 1000) {
                this.mostrarAdvertenciaToken();
            }

        } catch (error) {
            console.error('Error verificando token:', error);
        }
    }

    mostrarAdvertenciaToken() {
        // 1. Evitar múltiples modales
        if (document.getElementById('modal-token-expirado')) return;
        
        // 2. Crear modal que BLOQUEA la interfaz
        const modal = document.createElement('div');
        modal.id = 'modal-token-expirado';
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
        `;
        
        // 3. Contenido con CUENTA REGRESIVA (10 SEGUNDOS!)
        let tiempoRestante = 10; // 10 segundos (no 2 minutos)
        
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 12px; max-width: 500px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <h2 style="color: #d32f2f; margin-bottom: 15px;">SESIÓN EXPIRADA</h2>
                
                <div style="margin: 20px 0; padding: 15px; background: #ffebee; border-radius: 8px; border-left: 4px solid #d32f2f;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #d32f2f;">
                        ¡Tu sesión de seguridad ha expirado!
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #666;">
                        Por motivos de seguridad, la sesión se cerrará automáticamente en 
                        <span id="contador-token" style="font-weight: bold; color: #d32f2f;">${tiempoRestante}s</span>.
                    </p>
                </div>
                
                <div id="contador-circular" style="
                    width: 80px; height: 80px; 
                    margin: 20px auto;
                    border-radius: 50%;
                    background: conic-gradient(#f44336 ${(tiempoRestante/10)*100}%, #f0f0f0 0%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    font-weight: bold;
                    color: #d32f2f;
                ">
                    ${tiempoRestante}s
                </div>
                
                <div style="margin-top: 25px;">
                    <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
                        <strong>Nota:</strong> Algunas funciones ya no están disponibles.<br>
                        Serás redirigido automáticamente a la página de inicio de sesión.
                    </p>
                </div>
                
                <div style="display: flex; gap: 15px; justify-content: center; margin-top: 25px;">
                    <button id="btn-cerrar-ahora" 
                            style="padding: 12px 24px; background: #d32f2f; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
                        🚪 Cerrar sesión ahora
                    </button>
                </div>
                
                <div style="margin-top: 20px; font-size: 12px; color: #999;">
                    La sesión se cerrará automáticamente cuando el tiempo llegue a 0
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 4. Configurar contador regresivo (10 segundos)
        const contadorTexto = document.getElementById('contador-token');
        const contadorCircular = document.getElementById('contador-circular');
        
        const intervalo = setInterval(() => {
            tiempoRestante--;
            
            if (tiempoRestante <= 0) {
                clearInterval(intervalo);
                this.cerrarSesion('Tu sesión ha expirado por seguridad');
                return;
            }
            
            // Actualizar contadores
            contadorTexto.textContent = `${tiempoRestante}s`;
            contadorCircular.innerHTML = `${tiempoRestante}s`;
            contadorCircular.style.background = 
                `conic-gradient(#f44336 ${(tiempoRestante/10)*100}%, #f0f0f0 0%)`;
            
            // Cambiar color cuando quede poco tiempo
            if (tiempoRestante <= 3) {
                contadorCircular.style.animation = 'pulse 0.5s infinite';
            }
        }, 1000);
        
        // 5. Configurar botón
        document.getElementById('btn-cerrar-ahora').addEventListener('click', () => {
            clearInterval(intervalo);
            this.cerrarSesion('Sesión cerrada por el usuario');
        });
        
        // 6. Bloquear interacción con el fondo
        modal.addEventListener('click', (e) => {
            e.stopPropagation(); // No permitir cerrar haciendo click fuera
        });
        
        // 7. Añadir animación de pulso para urgencia
        const estilo = document.createElement('style');
        estilo.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(estilo);
    }

    async intentarRenovarToken() {
        try {
            // Intenta usar refresh_token si existe
            const refreshToken = localStorage.getItem('refresh_token');
            
            if (!refreshToken) {
                return false; // No hay forma de renovar
            }
            
            const respuesta = await fetch('/proyectoWeb/viajeros_peru/backend/api/auth.php?accion=refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            
            if (respuesta.ok) {
                const datos = await respuesta.json();
                localStorage.setItem('token_usuario', datos.token);
                
                // Actualizar refresh_token si viene uno nuevo
                if (datos.refresh_token) {
                    localStorage.setItem('refresh_token', datos.refresh_token);
                }
                
                return true;
            }
        } catch (error) {
            console.error('Error renovando token:', error);
        }
        
        return false;
    }

    mostrarAdvertencia() {
        // Crear modal de advertencia
        this.modalAdvertencia = document.createElement('div');
        this.modalAdvertencia.id = 'modal-advertencia-sesion';
        this.modalAdvertencia.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 15px 20px;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;

        const minutos = Math.ceil((this.tiempoMaximo - this.tiempoInactividad) / 60000);
        
        this.modalAdvertencia.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <span style="font-size: 20px;">⚠️</span>
                <strong style="color: #856404;">Sesión por expirar</strong>
            </div>
            <p style="margin: 0; color: #856404; font-size: 14px;">
                Tu sesión expirará en <strong>${minutos} minutos</strong> por inactividad.
                Mueve el mouse o presiona una tecla para mantenerla activa.
            </p>
            <div style="margin-top: 10px; display: flex; gap: 10px;">
                <button id="btn-mantener-sesion" 
                        style="padding: 8px 16px; background: #ff6b35; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Mantener sesión
                </button>
                <button id="btn-cerrar-sesion" 
                        style="padding: 8px 16px; background: #f8f9fa; color: #495057; border: 1px solid #dee2e6; border-radius: 4px; cursor: pointer;">
                    Cerrar sesión
                </button>
            </div>
        `;

        // Estilos CSS para animación
        if (!document.querySelector('#estilos-sesion')) {
            const estilo = document.createElement('style');
            estilo.id = 'estilos-sesion';
            estilo.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(estilo);
        }

        document.body.appendChild(this.modalAdvertencia);

        // Configurar botones
        setTimeout(() => {
            const btnMantener = document.getElementById('btn-mantener-sesion');
            const btnCerrar = document.getElementById('btn-cerrar-sesion');
            
            if (btnMantener) {
                btnMantener.addEventListener('click', () => {
                    this.reiniciarTemporizador();
                });
            }
            
            if (btnCerrar) {
                btnCerrar.addEventListener('click', () => {
                    this.cerrarSesion();
                });
            }
        }, 100);
    }

    cerrarSesion(mensaje = 'Sesión finalizada') {
        this.detenerMonitoreo();

        // Limpiar timestamp también
        localStorage.removeItem('timestamp_ultima_actividad');
        
        // Limpiar localStorage
        localStorage.removeItem('token_usuario');
        localStorage.removeItem('datos_usuario');
        localStorage.removeItem('foto_perfil_actual');
        localStorage.removeItem('perfil_usuario');
        
        // Remover modal si existe
        if (this.modalAdvertencia) {
            this.modalAdvertencia.remove();
            this.modalAdvertencia = null;
        }

        // Mostrar mensaje
        if (mensaje) {
            alert(mensaje);
        }

        // Redirigir a login
        window.location.href = '../../vistas/auth/iniciar_sesion.html';
    }

    detenerMonitoreo() {
        if (this.intervalo) {
            clearInterval(this.intervalo);
            this.intervalo = null;
        }
        
        if (this.modalAdvertencia) {
            this.modalAdvertencia.remove();
            this.modalAdvertencia = null;
        }
    }

    // Métodos públicos
    obtenerTiempoRestante() {
        const tiempoRestante = this.tiempoMaximo - this.tiempoInactividad;
        return Math.max(0, Math.floor(tiempoRestante / 1000)); // En segundos
    }

    formatearTiempoRestante() {
        const segundos = this.obtenerTiempoRestante();
        const minutos = Math.floor(segundos / 60);
        const segs = segundos % 60;
        return `${minutos}:${segs.toString().padStart(2, '0')}`;
    }
}