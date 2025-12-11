// Script para manejar el perfil de usuario
class ManejadorPerfil {
    constructor() {
        this.usuario = null;
        this.perfil = null;
        this.modoEdicion = false;
        // Almacenar archivos procesados (resized/compressed) antes de enviarlos
        this.processedVerifFiles = {};
        this.inicializar();
    }

    inicializar() {
        this.verificarAutenticacion();
        this.cargarDatosUsuario();
        this.cargarPerfil();
        this.configurarManejadores();
        this.verificarModoEdicionDesdeURL();
    }
    verificarModoEdicionDesdeURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const modo = urlParams.get('modo');
        
        if (modo === 'edicion') {
            console.log('🎯 Modo edición activado desde URL');
            setTimeout(() => {
                this.cambiarModoEdicion();
            }, 100);
            window.history.replaceState({}, document.title, window.location.pathname);
        } 
        else if (modo === 'verificacion') {
            console.log('🎯 Modo verificación activado desde URL');
            setTimeout(() => {
                this.iniciarVerificacion();
            }, 100);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    obtenerUrlEdicionPerfil() {
        return '../perfil/perfil.html?modo=edicion';
    }

    verificarAutenticacion() {
        console.log('🔐 Verificando autenticación...');
        
        const datosUsuario = localStorage.getItem('datos_usuario');
        const token = localStorage.getItem('token_usuario');
        
        console.log('📦 Token en localStorage:', token ? 'SÍ' : 'NO');
        console.log('📦 Datos usuario en localStorage:', datosUsuario);
        
        if (!datosUsuario || !token) {
            console.log('❌ Usuario no autenticado, redirigiendo al login...');
            window.location.href = '../auth/iniciar_sesion.html';
            return;
        }

        try {
            this.usuario = JSON.parse(datosUsuario);
            console.log('✅ Usuario parseado correctamente:', this.usuario);
            
            // VERIFICAR ESTRUCTURA DEL USUARIO
            if (!this.usuario.id) {
                console.error('❌ El usuario no tiene ID');
                throw new Error('Estructura de usuario inválida');
            }
            
        } catch (error) {
            console.error('💥 Error parseando datos de usuario:', error);
            console.error('📄 Datos que fallaron:', datosUsuario);
            this.cerrarSesion();
        }
    }

    async cargarDatosUsuario() {
        if (!this.usuario) {
            console.error('❌ No hay datos de usuario para cargar');
            return;
        }

        console.log('👤 Cargando datos del usuario:', this.usuario);

        // VERIFICAR QUE LOS DATOS EXISTAN
        const nombreCompleto = `${this.usuario.nombre || ''} ${this.usuario.apellido || ''}`.trim();
        const correo = this.usuario.correo || 'No disponible';

        console.log('📝 Nombre completo:', nombreCompleto);
        console.log('📧 Correo:', correo);
        console.log('🎭 Rol:', this.usuario.rol);

        // Actualizar interfaz con datos del usuario
        document.getElementById('nombre-completo').textContent = nombreCompleto || 'Cargando...';
        document.getElementById('info-correo').textContent = correo;
        document.getElementById('info-fecha-registro').textContent = new Date().toLocaleDateString('es-PE');

        const rolTexto = this.usuario.rol === 'viajero' ? 'Viajero' : 
                        this.usuario.rol === 'anfitrion' ? 'Anfitrión' : 'Usuario';
        document.getElementById('badge-rol').textContent = rolTexto;
    }

    async cargarPerfil() {
        try {
            if (!this.usuario || !this.usuario.id) {
                throw new Error('No hay usuario ID disponible');
            }

            console.log('📥 Cargando datos del perfil para usuario ID:', this.usuario.id);
            
            const urlAPI = '/proyectoWeb/viajeros_peru/backend/api/perfiles.php';
            const token = localStorage.getItem('token_usuario');
            
            console.log('📍 URL completa:', `${urlAPI}?usuario_id=${this.usuario.id}`);
            
            const respuesta = await fetch(`${urlAPI}?usuario_id=${this.usuario.id}`, {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }

            const textoRespuesta = await respuesta.text();
            console.log('📄 Respuesta cruda del perfil:', textoRespuesta);

            let datos;
            try {
                datos = JSON.parse(textoRespuesta);
            } catch (e) {
                console.error('❌ Error parseando JSON:', e);
                throw new Error('Respuesta inválida del servidor');
            }

            console.log('📊 Datos del perfil parseados:', datos);

            if (datos.exito && datos.perfil) {
                this.perfil = datos.perfil;
                console.log('✅ Perfil cargado exitosamente');
                localStorage.setItem('perfil_usuario', JSON.stringify(this.perfil));
            
                // 🆕 ACTUALIZAR FOTO EN NAVEGACIÓN SI EXISTE - CON VERIFICACIÓN
                if (this.perfil.foto_perfil) {
                    this.actualizarFotoEnNavegacion(this.perfil.foto_perfil);
                }
                if (this.perfil.estado_verificacion && window.navegacionGlobal) {
                    window.navegacionGlobal.actualizarEstadoVerificacion(this.perfil.estado_verificacion);
                }
                this.actualizarInterfazPerfil();
            } else {
                console.warn('⚠️ No se encontró perfil completo, usando datos básicos');
                this.perfil = this.crearPerfilVacio();
                this.actualizarInterfazPerfil();
            }

        } catch (error) {
            console.error('💥 Error cargando perfil:', error);
            this.mostrarError('Error al cargar el perfil: ' + error.message);
            this.perfil = this.crearPerfilVacio();
            this.actualizarInterfazPerfil();
        }
    }

    crearPerfilVacio() {
        return {
            biografia: '',
            habilidades: [],
            idiomas: ['espanol'],
            intereses: [],
            telefono: '',
            ubicacion: '',
            disponibilidad: '',
            foto_perfil: ''
        };
    }

    actualizarInterfazPerfil() {
        if (!this.perfil) {
            console.warn('⚠️ No hay perfil para actualizar la interfaz');
            return;
        }

        console.log('🔄 Actualizando interfaz con perfil completo:', this.perfil);
        console.log('🔍 DEBUG - Datos crudos del perfil:', {
            habilidades_raw: this.perfil.habilidades,
            idiomas_raw: this.perfil.idiomas,
            intereses_raw: this.perfil.intereses,
            redes_sociales_raw: this.perfil.redes_sociales,
            tipo_habilidades: typeof this.perfil.habilidades,
            tipo_idiomas: typeof this.perfil.idiomas
        });

        // Biografía
        const bioElement = document.getElementById('bio-usuario');
        if (this.perfil.biografia && this.perfil.biografia.trim() !== '') {
            bioElement.textContent = this.perfil.biografia;
            bioElement.style.fontStyle = 'normal';
            bioElement.style.color = 'inherit';
        } else {
            bioElement.textContent = 'Esta persona aún no ha agregado una biografía.';
            bioElement.style.fontStyle = 'italic';
            bioElement.style.color = '#64748b';
        }

        // Información personal - MANEJAR NULL Y STRINGS VACÍOS
        document.getElementById('info-correo').textContent = this.perfil.correo || 'No disponible';
        document.getElementById('info-telefono').textContent = 
            (this.perfil.telefono && this.perfil.telefono.trim() !== '') ? this.perfil.telefono : 'No especificado';
        
        // NUEVO: Información de ubicación detallada
        document.getElementById('info-pais').textContent = 
            (this.perfil.pais && this.perfil.pais.trim() !== '') ? this.perfil.pais : 'No especificado';
        
        document.getElementById('info-ciudad').textContent = 
            (this.perfil.ciudad && this.perfil.ciudad.trim() !== '') ? this.perfil.ciudad : 'No especificada';
        
        document.getElementById('info-ubicacion-detalle').textContent = 
            (this.perfil.ubicacion && this.perfil.ubicacion.trim() !== '') ? this.perfil.ubicacion : 'No especificada';

        // NUEVO: Información personal adicional
        if (this.perfil.fecha_nacimiento) {
            const fechaNac = new Date(this.perfil.fecha_nacimiento);
            document.getElementById('info-fecha-nacimiento').textContent = 
                fechaNac.toLocaleDateString('es-PE', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            
            // Calcular edad si no viene del servidor
            if (this.perfil.edad) {
                document.getElementById('info-edad').textContent = this.perfil.edad + ' años';
            } else {
                const hoy = new Date();
                const edad = hoy.getFullYear() - fechaNac.getFullYear();
                const mes = hoy.getMonth() - fechaNac.getMonth();
                if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
                    edad--;
                }
                document.getElementById('info-edad').textContent = edad + ' años';
            }
        } else {
            document.getElementById('info-fecha-nacimiento').textContent = 'No especificada';
            document.getElementById('info-edad').textContent = 'No especificada';
        }

        // NUEVO: Idioma preferido y zona horaria
        document.getElementById('info-idioma-preferido').textContent = 
            this.perfil.idioma_preferido === 'en' ? 'English' : 'Español';
        
        document.getElementById('info-zona-horaria').textContent = 
            this.perfil.zona_horaria || 'UTC';

        // Fecha de registro
        if (this.perfil.fecha_creacion) {
            const fechaRegistro = new Date(this.perfil.fecha_creacion);
            document.getElementById('info-fecha-registro').textContent = 
                fechaRegistro.toLocaleDateString('es-PE', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
        }

        // Habilidades - CONVERTIR STRING A ARRAY SI ES NECESARIO
        let habilidades = [];
        if (Array.isArray(this.perfil.habilidades)) {
            habilidades = this.perfil.habilidades;
        } else if (typeof this.perfil.habilidades === 'string' && this.perfil.habilidades.trim() !== '') {
            try {
                habilidades = JSON.parse(this.perfil.habilidades);
            } catch (e) {
                console.warn('No se pudieron parsear las habilidades:', e);
            }
        }
        this.actualizarLista('habilidades', habilidades);

        // Idiomas - MANEJAR EL STRING "Español" que viene de la BD
        let idiomas = [];
        if (Array.isArray(this.perfil.idiomas)) {
            idiomas = this.perfil.idiomas;
        } else if (this.perfil.idiomas === 'Español') {
            idiomas = ['espanol']; // Convertir a formato array
        } else if (typeof this.perfil.idiomas === 'string' && this.perfil.idiomas.trim() !== '') {
            try {
                idiomas = JSON.parse(this.perfil.idiomas);
            } catch (e) {
                console.warn('No se pudieron parsear los idiomas:', e);
                idiomas = ['espanol']; // Valor por defecto
            }
        } else {
            idiomas = ['espanol']; // Valor por defecto
        }
        this.actualizarLista('idiomas', idiomas);

        // Intereses
        let intereses = [];
        if (Array.isArray(this.perfil.intereses)) {
            intereses = this.perfil.intereses;
        } else if (typeof this.perfil.intereses === 'string' && this.perfil.intereses.trim() !== '') {
            try {
                intereses = JSON.parse(this.perfil.intereses);
            } catch (e) {
                console.warn('No se pudieron parsear los intereses:', e);
            }
        }
        this.actualizarLista('intereses', intereses);

        // NUEVO: Experiencias previas
        this.actualizarExperienciasPrevias();

        // NUEVO: Redes sociales
        this.actualizarRedesSociales();

        // Disponibilidad
        this.actualizarDisponibilidad();

        // Foto de perfil
        if (this.perfil.foto_perfil) {
            document.getElementById('imagen-perfil').src = this.perfil.foto_perfil;
        }

        // NUEVO: Verificación REAL
        this.actualizarVerificacionReal();

        // Estadísticas REALES
        this.actualizarEstadisticasReales();

        // Llenar formulario de edición
        this.llenarFormularioEdicion();
        
        console.log('✅ Interfaz actualizada correctamente con todos los datos');
    }
    // NUEVO: Método para actualizar experiencias previas
    actualizarExperienciasPrevias() {
        const contenedor = document.getElementById('lista-experiencias');
        
        let experiencias = [];
        if (Array.isArray(this.perfil.experiencias_previas)) {
            experiencias = this.perfil.experiencias_previas;
        } else if (typeof this.perfil.experiencias_previas === 'string' && this.perfil.experiencias_previas.trim() !== '') {
            try {
                experiencias = JSON.parse(this.perfil.experiencias_previas);
            } catch (e) {
                // Si no es JSON, tratar como texto con saltos de línea
                experiencias = this.perfil.experiencias_previas.split('\n').filter(exp => exp.trim() !== '');
            }
        }

        if (experiencias.length === 0) {
            contenedor.innerHTML = '<div class="sin-datos">No se han agregado experiencias previas</div>';
            return;
        }

        const html = experiencias.map(exp => 
            `<div class="experiencia-item">• ${exp}</div>`
        ).join('');

        contenedor.innerHTML = html;
    }


    actualizarRedesSociales() {
        const contenedor = document.getElementById('lista-redes-sociales');
        
        let redes = this.obtenerArrayDesdeCampo(this.perfil.redes_sociales);

        if (redes.length === 0) {
            contenedor.innerHTML = '<div class="sin-datos">No se han agregado redes sociales</div>';
            return;
        }

        // Ya no necesitamos mapeo especial porque usamos el estilo unificado
        const html = redes.map(red => 
            `<div class="badge-red-social">${this.formatearTexto(red)}</div>`
        ).join('');

        contenedor.innerHTML = html;
    }

    // NUEVO: Método para actualizar verificación REAL
    actualizarVerificacionReal() {
        const contenedor = document.querySelector('.estado-verificacion');
        
        if (!this.perfil.estado_verificacion_display) {
            // Estado por defecto si no hay información
            contenedor.innerHTML = `
                <div class="badge no-verificado">❌ No verificado</div>
                <p>Verifica tu identidad para generar más confianza en la comunidad</p>
                <button class="boton-secundario pequeño" onclick="window.manejadorPerfil.iniciarVerificacion()">
                    Iniciar verificación
                </button>
            `;
            return;
        }

        const estado = this.perfil.estado_verificacion_display;
        
        if (estado.estado === 'verificado') {
            contenedor.innerHTML = `
                <div class="badge verificado">${estado.icono} ${estado.texto}</div>
                <p>✅ Tu identidad ha sido verificada exitosamente</p>
            `;
        } else if (estado.estado === 'pendiente') {
            contenedor.innerHTML = `
                <div class="badge pendiente">${estado.icono} ${estado.texto}</div>
                <p>⏳ Tu solicitud de verificación está en revisión</p>
                <p class="texto-pequeno">Te notificaremos cuando sea completada</p>
            `;
        } else {
            contenedor.innerHTML = `
                <div class="badge no-verificado">${estado.icono} ${estado.texto}</div>
                <p>Verifica tu identidad para generar más confianza en la comunidad</p>
                <button class="boton-secundario pequeño" onclick="window.manejadorPerfil.iniciarVerificacion()">
                    Iniciar verificación
                </button>
            `;
        }
    }

    // NUEVO: Método para actualizar estadísticas REALES
    actualizarEstadisticasReales() {
        // Usar estadísticas reales del servidor si están disponibles
        const totalResenas = this.perfil.total_resenas || 0;
        const totalEstancias = this.perfil.total_estancias || 0;
        const totalAnuncios = this.perfil.total_anuncios || 0;

        document.getElementById('contador-resenas').textContent = totalResenas;
        document.getElementById('contador-estancias').textContent = totalEstancias;
        document.getElementById('contador-anuncios').textContent = totalAnuncios;
    }

    actualizarLista(tipo, items) {
        const contenedor = document.getElementById(`lista-${tipo}`);
        
        if (!items || items.length === 0) {
            contenedor.innerHTML = '<div class="sin-datos">No se han agregado ' + this.obtenerNombrePlural(tipo) + '</div>';
            return;
        }

        console.log(`🎨 Renderizando ${tipo}:`, items);

        // Mapear valores a etiquetas bonitas
        const etiquetas = this.obtenerEtiquetas();
        const tipoSingular = this.obtenerSingular(tipo);
        const html = items.map(item => {
            const etiqueta = etiquetas[tipo]?.[item] || this.formatearTexto(item);
            return `<div class="badge-${tipoSingular}">${etiqueta}</div>`;
        }).join('');

        contenedor.innerHTML = html;
    }
    obtenerSingular(tipo) {
        // Manejar casos especiales conocidos
        if (tipo === 'habilidades') {
            return 'habilidad';
        }
        if (tipo === 'intereses') {
            return 'interes';
        }
        // Caso por defecto: simplemente quitar la última 's' (slice(0, -1))
        if (tipo.endsWith('s')) {
            return tipo.slice(0, -1);
        }
        // Si no termina en 's', devolver como está (ej. "lenguaje")
        return tipo;
    }
    // NUEVO: Método para formatear texto (primera letra mayúscula)
    formatearTexto(texto) {
        if (!texto || typeof texto !== 'string') return texto;
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }

    // NUEVO: Método para nombres plurales
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


    actualizarDisponibilidad() {
        const contenedor = document.getElementById('info-disponibilidad');
        const disponibilidad = this.perfil.disponibilidad;

        if (!disponibilidad) {
            contenedor.innerHTML = '<div class="sin-datos">No se ha especificado disponibilidad</div>';
            return;
        }

        const opciones = {
            'siempre': '🟢 Siempre disponible',
            'fines_semana': '📅 Fines de semana',
            'temporal': '⏰ Disponibilidad temporal', 
            'fechas_especificas': '📋 Fechas específicas',
            'no_disponible': '🔴 No disponible por ahora'
        };

        const texto = opciones[disponibilidad] || this.formatearTexto(disponibilidad);
        contenedor.innerHTML = `<div class="badge-disponibilidad">${texto}</div>`;
    }

    llenarFormularioEdicion() {
        if (!this.perfil) return;

        console.log('📝 Llenando formulario con perfil:', this.perfil);

        // Biografía
        document.getElementById('editar-biografia').value = this.perfil.biografia || '';

        // Información personal
        document.getElementById('editar-telefono').value = this.perfil.telefono || '';
        document.getElementById('editar-pais').value = this.perfil.pais || '';
        document.getElementById('editar-ciudad').value = this.perfil.ciudad || '';
        document.getElementById('editar-ubicacion-detalle').value = this.perfil.ubicacion || '';

        // NUEVO: Información personal adicional
        document.getElementById('editar-fecha-nacimiento').value = this.perfil.fecha_nacimiento || '';
        document.getElementById('editar-idioma-preferido').value = this.perfil.idioma_preferido || 'es';
        document.getElementById('editar-zona-horaria').value = this.perfil.zona_horaria || 'UTC-5';

        // NUEVO: Experiencias previas
        let experienciasTexto = '';
        if (Array.isArray(this.perfil.experiencias_previas)) {
            experienciasTexto = this.perfil.experiencias_previas.join('\n');
        } else if (typeof this.perfil.experiencias_previas === 'string') {
            experienciasTexto = this.perfil.experiencias_previas;
        }
        document.getElementById('editar-experiencias').value = experienciasTexto;
        const habilidades = this.obtenerArrayDesdeCampo(this.perfil.habilidades);
        const idiomas = this.obtenerArrayDesdeCampo(this.perfil.idiomas);
        const intereses = this.obtenerArrayDesdeCampo(this.perfil.intereses);
        const redesSociales = this.obtenerArrayDesdeCampo(this.perfil.redes_sociales);

        console.log('🔍 Datos procesados para checkboxes:', {
            habilidades,
            idiomas, 
            intereses,
            redesSociales
        });

        // Habilidades
        this.marcarCheckboxes('habilidades', this.perfil.habilidades);

        // Idiomas
        this.marcarCheckboxes('idiomas', this.perfil.idiomas);

        // Intereses
        this.marcarCheckboxes('intereses', this.perfil.intereses);

        // Redes sociales
        this.marcarCheckboxes('redes_sociales', this.perfil.redes_sociales);

        // Disponibilidad
        document.getElementById('editar-disponibilidad').value = this.perfil.disponibilidad || '';
    }

    obtenerArrayDesdeCampo(campo) {
        console.log('🔄 Procesando campo:', campo);
        
        // Si ya es array, retornarlo
        if (Array.isArray(campo)) {
            console.log('✅ Ya es array:', campo);
            return campo;
        }
        
        // Si es string vacío o null
        if (!campo || campo === '' || campo === 'null') {
            console.log('⚪ Campo vacío o null');
            return [];
        }
        
        // Si es string JSON, intentar parsear
        if (typeof campo === 'string') {
            try {
                // Limpiar el string por si tiene espacios extra
                const campoLimpio = campo.trim();
                
                // Si empieza con [ y termina con ], es JSON
                if (campoLimpio.startsWith('[') && campoLimpio.endsWith(']')) {
                    const parsed = JSON.parse(campoLimpio);
                    console.log('✅ JSON parseado exitosamente:', parsed);
                    return Array.isArray(parsed) ? parsed : [];
                }
                
                // Si es string "Español" (caso especial de idiomas)
                if (campoLimpio === 'Español') {
                    console.log('✅ Caso especial: Español');
                    return ['espanol'];
                }
                
                // Si es string con comas, separar
                if (campoLimpio.includes(',')) {
                    const array = campoLimpio.split(',').map(item => item.trim()).filter(item => item !== '');
                    console.log('✅ Separado por comas:', array);
                    return array;
                }
                
                // Si es un solo valor, convertirlo a array
                if (campoLimpio !== '') {
                    console.log('✅ Valor único convertido a array:', [campoLimpio]);
                    return [campoLimpio];
                }
                
            } catch (error) {
                console.error('❌ Error parseando JSON:', error, 'Campo:', campo);
            }
        }
        
        console.log('⚪ Retornando array vacío');
        return [];
    }

    marcarCheckboxes(nombre, valores) {
        console.log(`🎯 Marcando checkboxes para ${nombre}:`, valores);
        
        const checkboxes = document.querySelectorAll(`input[name="${nombre}"]`);
        
        checkboxes.forEach(checkbox => {
            // Asegurarse de que valores sea un array
            const valoresArray = Array.isArray(valores) ? valores : [];
            
            // Verificar si el valor del checkbox está en el array
            const estaMarcado = valoresArray.includes(checkbox.value);
            
            console.log(`📋 Checkbox ${checkbox.value}: ${estaMarcado ? '✓' : '✗'}`);
            
            checkbox.checked = estaMarcado;
        });
        
        console.log(`✅ Checkboxes de ${nombre} procesados`);
    }

    configurarManejadores() {
        const formulario = document.getElementById('formulario-edicion');
        if (formulario) {
            formulario.addEventListener('submit', (e) => this.manejarGuardado(e));
        }

        // 🚨 SOLO UN EVENT LISTENER PARA EL INPUT FOTO
        const inputFoto = document.getElementById('input-foto');
        if (inputFoto) {
            // Remover cualquier listener previo para evitar duplicados
            inputFoto.replaceWith(inputFoto.cloneNode(true));
            
            // Agregar el listener una sola vez
            document.getElementById('input-foto').addEventListener('change', async (e) => {
                const archivo = e.target.files[0];
                if (archivo) {
                    console.log('🖼️ Archivo seleccionado para subir:', archivo.name);
                    await this.manejarSubidaFoto(archivo);
                }
            });
        }

        // Configurar botones
        this.configurarManejadoresBotones();
    }

    configurarManejadoresBotones() {
        console.log('🔧 Configurando manejadores de botones...');

        // Botón Editar Perfil
        const botonEditar = document.getElementById('boton-editar-perfil');
        if (botonEditar) {
            botonEditar.addEventListener('click', () => this.cambiarModoEdicion());
        }

        // Botón Ver Perfil Público
        const botonPublico = document.getElementById('boton-ver-publico');
        if (botonPublico) {
            botonPublico.addEventListener('click', () => this.verPerfilPublico());
        }

        
        // Botón Cambiar Foto - Solo abre el selector
        const botonCambiarFoto = document.querySelector('.cambiar-foto');
        if (botonCambiarFoto) {
            botonCambiarFoto.addEventListener('click', () => {
                console.log('🖼️ Abriendo selector de archivos...');
                document.getElementById('input-foto').click();
            });
        }

        // Botón Cancelar Edición
        const botonCancelar = document.querySelector('button[onclick="cancelarEdicion()"]');
        if (botonCancelar) {
            botonCancelar.addEventListener('click', () => this.cancelarEdicion());
        }

        console.log('✅ Manejadores de botones configurados correctamente');
    }

    // 🚀 MÉTODOS PARA MANEJAR LOS EVENTOS
    cambiarModoEdicion() {
        console.log('✏️ Cambiando a modo edición...');
        document.getElementById('modo-visualizacion').style.display = 'none';
        document.getElementById('modo-edicion').style.display = 'block';
        window.scrollTo(0, 0);
    }

    cancelarEdicion() {
        console.log('❌ Cancelando edición...');
        document.getElementById('modo-edicion').style.display = 'none';
        document.getElementById('modo-visualizacion').style.display = 'block';
    }

    cambiarModoVisualizacion() {
        console.log('👀 Volviendo a modo visualización...');
        document.getElementById('modo-edicion').style.display = 'none';
        document.getElementById('modo-visualizacion').style.display = 'block';
    }

    async verPerfilPublico() {
        console.log('👁️ Redirigiendo a perfil público...');
        if (this.usuario && this.usuario.id) {
            window.location.href = `perfilPublico.html?id=${this.usuario.id}`;
        } else {
            this.mostrarError('No se pudo cargar el perfil público');
        }
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

    escaparHTML(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async iniciarVerificacion() {
        const mainElement = document.querySelector('main');
        const contenidoOriginal = mainElement.innerHTML;
        
        // Cambiar a la vista de verificación
        mainElement.innerHTML = `
            <div class="contenedor vista-verificacion">
                <header class="header-verificacion">
                    <button class="boton-secundario" id="btn-volver-verificacion">← Volver</button>
                    <h1>Verificación de Identidad</h1>
                </header>

                <div class="proceso-verificacion">
                    <div class="pasos-verificacion">
                        <div class="paso actual">
                            <div class="numero-paso">1</div>
                            <h3>Información Personal</h3>
                            <p>Confirma tus datos personales</p>
                        </div>
                        <div class="paso">
                            <div class="numero-paso">2</div>
                            <h3>Documento de Identidad</h3>
                            <p>Sube una foto de tu DNI o pasaporte</p>
                        </div>
                        <div class="paso">
                            <div class="numero-paso">3</div>
                            <h3>Foto con Documento</h3>
                            <p>Tómate una selfie sosteniendo tu documento</p>
                        </div>
                        <div class="paso">
                            <div class="numero-paso">4</div>
                            <h3>Revisión</h3>
                            <p>Revisaremos tu solicitud</p>
                        </div>
                    </div>

                    <form id="form-verificacion" class="formulario-verificacion">
                        <!-- Paso 1: Información Personal -->
                        <div class="paso-contenido" id="paso-1">
                            <div class="grupo-formulario">
                                <label for="nombre_completo">Nombre completo (como aparece en tu documento)</label>
                                <input type="text" id="nombre_completo" required>
                            </div>
                            <div class="grupo-formulario">
                                <label for="fecha_nacimiento">Fecha de nacimiento</label>
                                <input type="date" id="fecha_nacimiento" required>
                            </div>
                            <div class="grupo-formulario">
                                <label for="tipo_documento">Tipo de documento</label>
                                <select id="tipo_documento" required>
                                    <option value="dni">DNI</option>
                                    <option value="pasaporte">Pasaporte</option>
                                    <option value="ce">Carné de Extranjería</option>
                                </select>
                            </div>
                            <div class="grupo-formulario">
                                <label for="numero_documento">Número de documento</label>
                                <input type="text" id="numero_documento" required>
                            </div>
                            <div class="acciones-formulario">
                                <button type="button" class="boton-principal" onclick="window.manejadorPerfil.siguientePasoVerificacion(1)">
                                    Continuar
                                </button>
                            </div>
                        </div>

                        <!-- Paso 2: Documento de Identidad -->
                        <div class="paso-contenido" id="paso-2" style="display: none;">
                            <div class="subida-documento">
                                <div class="instrucciones">
                                    <h4>📸 Foto del documento</h4>
                                    <ul>
                                        <li>Asegúrate que el documento sea legible</li>
                                        <li>Incluye ambos lados del documento</li>
                                        <li>Evita reflejos o sombras</li>
                                    </ul>
                                </div>
                                <div class="area-subida">
                                    <input type="file" id="documento_foto" accept="image/*" required style="display: none;">
                                    <button type="button" class="boton-subida" onclick="document.getElementById('documento_foto').click()">
                                        📄 Subir foto del documento
                                    </button>
                                    <div id="preview-documento" class="preview-imagen"></div>
                                </div>
                            </div>
                            <div class="acciones-formulario">
                                <button type="button" class="boton-secundario" onclick="window.manejadorPerfil.anteriorPasoVerificacion(2)">
                                    Atrás
                                </button>
                                <button type="button" class="boton-principal" onclick="window.manejadorPerfil.siguientePasoVerificacion(2)">
                                    Continuar
                                </button>
                            </div>
                        </div>

                        <!-- Paso 3: Selfie con Documento -->
                        <div class="paso-contenido" id="paso-3" style="display: none;">
                            <div class="subida-selfie">
                                <div class="instrucciones">
                                    <h4>🤳 Selfie con el documento</h4>
                                    <ul>
                                        <li>Tu rostro debe ser claramente visible</li>
                                        <li>Sostén tu documento cerca de tu rostro</li>
                                        <li>Asegúrate de tener buena iluminación</li>
                                    </ul>
                                </div>
                                <div class="area-subida">
                                    <input type="file" id="selfie_foto" accept="image/*" required style="display: none;">
                                    <button type="button" class="boton-subida" onclick="document.getElementById('selfie_foto').click()">
                                        🤳 Tomar selfie
                                    </button>
                                    <div id="preview-selfie" class="preview-imagen"></div>
                                </div>
                            </div>
                            <div class="acciones-formulario">
                                <button type="button" class="boton-secundario" onclick="window.manejadorPerfil.anteriorPasoVerificacion(3)">
                                    Atrás
                                </button>
                                <button type="button" class="boton-principal" onclick="window.manejadorPerfil.enviarVerificacion()">
                                    Enviar verificación
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Añadir estilos específicos para la verificación
        const estilos = document.createElement('style');
        estilos.textContent = `
            .vista-verificacion { padding: 2rem; }
            .header-verificacion { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; }
            .pasos-verificacion { display: flex; justify-content: space-between; margin-bottom: 2rem; gap: 0.5rem; }
            .paso { flex: 1; text-align: center; position: relative; padding: 0 0.5rem; }
            .paso:not(:last-child):after { content: ""; position: absolute; top: 24px; left: 70%; width: 60%; height: 2px; background: #e2e8f0; }
            .paso.actual .numero-paso { background: #2563eb; color: white; }
            .numero-paso { width: 36px; height: 36px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.5rem; font-weight: bold; }
            .formulario-verificacion { max-width: 720px; margin: 0 auto; padding: 1.5rem; background: white; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
            .grupo-formulario label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
            .grupo-formulario input, .grupo-formulario select { width: 100%; padding: 0.65rem; border: 1px solid #e2e8f0; border-radius: 6px; }
            .acciones-formulario { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1.25rem; }
            .area-subida { border: 2px dashed #e2e8f0; padding: 1rem; text-align: center; border-radius: 8px; margin: 1rem 0; }
            .preview-imagen { margin-top: 1rem; max-width: 100%; display: flex; flex-direction: column; gap: 0.5rem; align-items: center; }
            .preview-imagen img { max-width: 100%; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
            .preview-meta { font-size: 0.9rem; color: #64748b; }
            .instrucciones { background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }

            /* Responsive: apilar pasos y formulario en pantallas pequeñas */
            @media (max-width: 720px) {
                .pasos-verificacion { flex-direction: column; gap: 0.75rem; }
                .paso:not(:last-child):after { display: none; }
                .formulario-verificacion { padding: 1rem; }
                .acciones-formulario { flex-direction: column-reverse; }
            }
        `;
        document.head.appendChild(estilos);

        // Configurar evento para volver
        document.getElementById('btn-volver-verificacion').addEventListener('click', () => {
            mainElement.innerHTML = contenidoOriginal;
            this.configurarManejadores();
            document.head.removeChild(estilos);
        });

        // Helper: reducir imagen con canvas si es demasiado grande
        const resizeImageIfNeeded = (file, maxWidth = 1200, quality = 0.8) => {
            return new Promise((resolve, reject) => {
                if (!file.type.startsWith('image/')) {
                    return reject(new Error('Tipo de archivo no soportado'));
                }

                // Si ya es pequeño (<1.5MB) no re-dimensionar
                if (file.size <= 1500 * 1024) {
                    return resolve(file);
                }

                const img = new Image();
                const reader = new FileReader();
                reader.onload = (e) => {
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ratio = img.width / img.height;
                        let width = img.width;
                        let height = img.height;
                        if (width > maxWidth) {
                            width = maxWidth;
                            height = Math.round(maxWidth / ratio);
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        canvas.toBlob((blob) => {
                            if (!blob) return resolve(file);
                            const newFile = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
                            resolve(newFile);
                        }, 'image/jpeg', quality);
                    };
                    img.onerror = () => reject(new Error('Error cargando la imagen'));
                    img.src = e.target.result;
                };
                reader.onerror = () => reject(new Error('Error leyendo el archivo'));
                reader.readAsDataURL(file);
            });
        };

        // Configurar listeners y previews con procesamiento de imagen
        ['documento_foto', 'selfie_foto'].forEach(id => {
            const input = document.getElementById(id);
            const previewId = 'preview-' + id.split('_')[0];

            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                const preview = document.getElementById(previewId);
                preview.innerHTML = '';

                if (!file) return;

                // Validar tipo
                const tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg'];
                if (!tiposPermitidos.includes(file.type)) {
                    preview.innerHTML = `<div class="preview-meta">Tipo de archivo no permitido</div>`;
                    return;
                }

                try {
                    // Procesar (resize/compress) si es necesario
                    const processed = await resizeImageIfNeeded(file);
                    // Guardar en memoria para usar al enviar
                    this.processedVerifFiles[id] = processed;

                    // Mostrar preview
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const tamañoKB = Math.round(processed.size / 1024);
                        preview.innerHTML = `<img src="${ev.target.result}" alt="Preview"><div class="preview-meta">${this.escaparHTML(processed.name)} • ${tamañoKB} KB</div>`;
                    };
                    reader.readAsDataURL(processed);
                } catch (err) {
                    console.error('Error procesando imagen:', err);
                    preview.innerHTML = `<div class="preview-meta">Error procesando la imagen</div>`;
                    // Fallback: usar el archivo original
                    this.processedVerifFiles[id] = file;
                }
            });
        });
    }

    siguientePasoVerificacion(pasoActual) {
        const siguientePaso = pasoActual + 1;
        
        // Validar el paso actual antes de continuar
        if (!this.validarPasoVerificacion(pasoActual)) {
            return;
        }
        
        // Ocultar paso actual y mostrar siguiente
        document.getElementById(`paso-${pasoActual}`).style.display = 'none';
        document.getElementById(`paso-${siguientePaso}`).style.display = 'block';
        
        // Actualizar indicador visual de pasos
        const pasos = document.querySelectorAll('.paso');
        pasos[pasoActual-1].classList.remove('actual');
        pasos[siguientePaso-1].classList.add('actual');
    }

    anteriorPasoVerificacion(pasoActual) {
        const pasoAnterior = pasoActual - 1;
        
        // Ocultar paso actual y mostrar anterior
        document.getElementById(`paso-${pasoActual}`).style.display = 'none';
        document.getElementById(`paso-${pasoAnterior}`).style.display = 'block';
        
        // Actualizar indicador visual de pasos
        const pasos = document.querySelectorAll('.paso');
        pasos[pasoActual-1].classList.remove('actual');
        pasos[pasoAnterior-1].classList.add('actual');
    }

    /**
     * Validar paso actual de verificación
     */
    validarPasoVerificacion(paso) {
        switch(paso) {
            case 1:
                const nombre = document.getElementById('nombre_completo').value;
                const fecha = document.getElementById('fecha_nacimiento').value;
                const tipoDoc = document.getElementById('tipo_documento').value;
                const numDoc = document.getElementById('numero_documento').value;
                
                if (!nombre || !fecha || !tipoDoc || !numDoc) {
                    this.mostrarError('Por favor completa todos los campos del paso 1');
                    return false;
                }
                return true;
                
            case 2:
                const docFoto = document.getElementById('documento_foto').files[0];
                if (!docFoto) {
                    this.mostrarError('Por favor sube una foto de tu documento');
                    return false;
                }
                return true;
                
            case 3:
                const selfieFoto = document.getElementById('selfie_foto').files[0];
                if (!selfieFoto) {
                    this.mostrarError('Por favor sube una selfie con tu documento');
                    return false;
                }
                return true;
                
            default:
                return true;
        }
    }

    /**
     * Siguiente paso en verificación
     */
    siguientePasoVerificacion(pasoActual) {
        if (!this.validarPasoVerificacion(pasoActual)) {
            return;
        }
        
        const siguientePaso = pasoActual + 1;
        
        // Ocultar paso actual y mostrar siguiente
        document.getElementById(`paso-${pasoActual}`).style.display = 'none';
        document.getElementById(`paso-${siguientePaso}`).style.display = 'block';
        
        // Actualizar indicadores visuales
        this.actualizarIndicadoresPasosVerificacion(pasoActual, siguientePaso);
    }

    /**
     * Paso anterior en verificación
     */
    anteriorPasoVerificacion(pasoActual) {
        const pasoAnterior = pasoActual - 1;
        
        // Ocultar paso actual y mostrar anterior
        document.getElementById(`paso-${pasoActual}`).style.display = 'none';
        document.getElementById(`paso-${pasoAnterior}`).style.display = 'block';
        
        // Actualizar indicadores visuales
        this.actualizarIndicadoresPasosVerificacion(pasoActual, pasoAnterior);
    }

    /**
     * Actualizar indicadores de pasos
     */
    actualizarIndicadoresPasosVerificacion(pasoAnterior, pasoNuevo) {
        const pasos = document.querySelectorAll('.paso');
        
        // Remover clase actual del paso anterior
        if (pasoAnterior > 0) {
            pasos[pasoAnterior-1].classList.remove('actual');
        }
        
        // Agregar clase actual al paso nuevo
        if (pasoNuevo > 0) {
            pasos[pasoNuevo-1].classList.add('actual');
        }
    }

    /**
     * Enviar verificación al servidor
     */
    async enviarVerificacion() {
        try {
            // Validar paso final
            if (!this.validarPasoVerificacion(3)) {
                return;
            }

            // Crear FormData con todos los datos
            const formData = new FormData();
            formData.append('accion', 'iniciar_verificacion');
            formData.append('usuario_id', this.usuario.id);
            formData.append('nombre_completo', document.getElementById('nombre_completo').value);
            formData.append('fecha_nacimiento', document.getElementById('fecha_nacimiento').value);
            formData.append('tipo_documento', document.getElementById('tipo_documento').value);
            formData.append('numero_documento', document.getElementById('numero_documento').value);

            // Usar archivos procesados si existen (resize/compress), si no usar los originales
            const archivoDocumento = this.processedVerifFiles['documento_foto'] || document.getElementById('documento_foto').files[0];
            const archivoSelfie = this.processedVerifFiles['selfie_foto'] || document.getElementById('selfie_foto').files[0];

            if (archivoDocumento) formData.append('documento_foto', archivoDocumento);
            if (archivoSelfie) formData.append('selfie_foto', archivoSelfie);

            // Incluir token también en el body para servidores que eliminan headers Authorization
            const urlAPI = '/proyectoWeb/viajeros_peru/backend/api/perfiles.php';
            const token = localStorage.getItem('token_usuario');
            if (token) formData.append('token', token);

            console.log('📤 Enviando solicitud de verificación (con token en FormData)...');

            const fetchOptions = {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                    // NO incluir Authorization header aquí con FormData multipart
                    // InfinityFree lo elimina, pero los headers custom pueden ayudar
                }
            };

            // Intentar mantener Authorization header si el servidor lo permite
            if (token) {
                fetchOptions.headers['Authorization'] = 'Bearer ' + token;
            }

            const respuesta = await fetch(urlAPI, fetchOptions);

            // Leer primero como texto y luego parsear a JSON (evita leer el stream dos veces)
            let resultado;
            const textoRespuesta = await respuesta.text();
            try {
                resultado = JSON.parse(textoRespuesta);
            } catch (e) {
                console.error('Respuesta no JSON:', textoRespuesta);
                throw new Error('Respuesta inválida del servidor');
            }
            console.log('📄 Respuesta del servidor:', resultado);
            
            if (resultado.exito) {
                // Actualizar estado en la navegación
                if (window.navegacionGlobal) {
                    window.navegacionGlobal.actualizarEstadoVerificacion('pendiente');
                }
                
                // Actualizar perfil local
                if (this.perfil) {
                    this.perfil.estado_verificacion = 'pendiente';
                    localStorage.setItem('perfil_usuario', JSON.stringify(this.perfil));
                }

                // Mostrar confirmación
                this.mostrarConfirmacionVerificacion();
                
            } else {
                throw new Error(resultado.error || 'Error al enviar la verificación');
            }

        } catch (error) {
            console.error('Error en verificación:', error);
            this.mostrarError('Error al enviar la verificación: ' + error.message);
        }
    }

    /**
     * Mostrar confirmación de verificación enviada
     */
    mostrarConfirmacionVerificacion() {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = `
            <div class="contenedor vista-verificacion">
                <div class="confirmacion-verificacion" style="text-align: center; padding: 4rem 2rem;">
                    <div style="font-size: 4rem; margin-bottom: 2rem;">✅</div>
                    <h2>¡Solicitud Enviada Exitosamente!</h2>
                    <p style="margin: 1rem 0 2rem; font-size: 1.1rem;">
                        Hemos recibido tu solicitud de verificación. Nuestro equipo la revisará 
                        y te notificaremos cuando el proceso esté completo.
                    </p>
                    <p style="color: #64748b; margin-bottom: 2rem;">
                        ⏱️ Tiempo estimado: 1-3 días hábiles
                    </p>
                    <button class="boton-principal" onclick="window.location.reload()">
                        Volver a Mi Perfil
                    </button>
                </div>
            </div>
        `;
    }

    async manejarGuardado(evento) {
        evento.preventDefault();
        console.log('💾 Guardando cambios del perfil...');

        const botonGuardar = evento.target.querySelector('button[type="submit"]');
        botonGuardar.disabled = true;
        botonGuardar.textContent = 'Guardando...';

        try {
            const datosActualizados = this.recopilarDatosFormulario();
            await this.guardarPerfil(datosActualizados);
        } catch (error) {
            console.error('💥 Error guardando perfil:', error);
            this.mostrarError('Error al guardar los cambios: ' + error.message);
        } finally {
            botonGuardar.disabled = false;
            botonGuardar.textContent = 'Guardar Cambios';
        }
    }

    recopilarDatosFormulario() {
        const datos = {
            biografia: document.getElementById('editar-biografia').value,
            telefono: document.getElementById('editar-telefono').value,
            pais: document.getElementById('editar-pais').value,
            ciudad: document.getElementById('editar-ciudad').value,
            ubicacion: document.getElementById('editar-ubicacion-detalle').value,
            fecha_nacimiento: document.getElementById('editar-fecha-nacimiento').value,
            idioma_preferido: document.getElementById('editar-idioma-preferido').value,
            zona_horaria: document.getElementById('editar-zona-horaria').value,
            experiencias_previas: document.getElementById('editar-experiencias').value,
            disponibilidad: document.getElementById('editar-disponibilidad').value,
            habilidades: this.obtenerCheckboxesSeleccionados('habilidades'),
            idiomas: this.obtenerCheckboxesSeleccionados('idiomas'),
            intereses: this.obtenerCheckboxesSeleccionados('intereses'),
            redes_sociales: this.obtenerCheckboxesSeleccionados('redes_sociales')
        };

        console.log('📦 Datos completos a guardar:', datos);
        return datos;
    }

    obtenerCheckboxesSeleccionados(nombre) {
        const checkboxes = document.querySelectorAll(`input[name="${nombre}"]:checked`);
        return Array.from(checkboxes).map(cb => cb.value);
    }

    async guardarPerfil(datos) {
        console.log('💾 Intentando guardar perfil:', datos);
        
        const urlAPI = '/proyectoWeb/viajeros_peru/backend/api/perfiles.php';
        const token = localStorage.getItem('token_usuario');

        if (!this.usuario || !this.usuario.id) {
            throw new Error('No hay usuario ID disponible para guardar');
        }

        const respuesta = await fetch(urlAPI, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                accion: 'guardar',
                usuario_id: this.usuario.id,
                ...datos
            })
        });

        const textoRespuesta = await respuesta.text();
        console.log('📄 Respuesta cruda del guardado:', textoRespuesta);

        let resultado;
        try {
            resultado = JSON.parse(textoRespuesta);
        } catch (e) {
            throw new Error('Respuesta inválida del servidor al guardar');
        }

        console.log('📊 Resultado del guardado:', resultado);

        if (resultado.exito) {
            this.mostrarExito('✅ Perfil actualizado correctamente');
            this.perfil = { ...this.perfil, ...datos };
            this.actualizarInterfazPerfil();
            this.cambiarModoVisualizacion();
        } else {
            throw new Error(resultado.error || 'Error desconocido al guardar');
        }
    }

    async manejarSubidaFoto(archivo) {
        if (!archivo) return;

        console.log('📸 Iniciando subida de foto:', archivo.name);

        // Prevenir múltiples subidas
        const inputFoto = document.getElementById('input-foto');
        const botonCambiar = document.querySelector('.cambiar-foto');
        
        if (inputFoto) inputFoto.disabled = true;
        if (botonCambiar) {
            botonCambiar.style.pointerEvents = 'none';
            botonCambiar.textContent = '📸 Subiendo...';
        }

        try {
            // Validaciones
            const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
            if (!tiposPermitidos.includes(archivo.type)) {
                throw new Error('Solo se permiten imágenes JPEG, PNG o GIF');
            }

            if (archivo.size > 5 * 1024 * 1024) {
                throw new Error('La imagen debe ser menor a 5MB');
            }

            // Mostrar vista previa inmediatamente
            const imagenPerfil = document.getElementById('imagen-perfil');
            const urlPrevia = URL.createObjectURL(archivo);
            imagenPerfil.src = urlPrevia;

            // Preparar datos para enviar
            const formData = new FormData();
            formData.append('foto', archivo);
            formData.append('usuario_id', this.usuario.id);
            formData.append('accion', 'subir_foto');

            const urlAPI = '/proyectoWeb/viajeros_peru/backend/api/perfiles.php';
            const token = localStorage.getItem('token_usuario');

            console.log('📤 Enviando foto al servidor...');
            
            const respuesta = await fetch(urlAPI, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                body: formData
            });

            const resultado = await respuesta.json();
            console.log('📄 Respuesta del servidor:', resultado);

            if (resultado.exito) {
                this.mostrarExito('✅ Foto de perfil actualizada correctamente');
                
                // Actualizar la imagen con cache busting
                if (resultado.url_foto) {
                    const nuevaUrl = resultado.url_foto + '?t=' + new Date().getTime();
                    imagenPerfil.src = nuevaUrl;
                    
                    // 🆕 ACTUALIZAR FOTO EN LA NAVEGACIÓN GLOBAL - CON VERIFICACIÓN
                    if (window.navegacionGlobal && typeof window.navegacionGlobal.actualizarFotoEnNavegacion === 'function') {
                        window.navegacionGlobal.actualizarFotoEnNavegacion(nuevaUrl);
                    }
                    
                    // 🆕 ACTUALIZAR EN LOCALSTORAGE
                    if (this.perfil) {
                        this.perfil.foto_perfil = nuevaUrl;
                        localStorage.setItem('perfil_usuario', JSON.stringify(this.perfil));
                        localStorage.setItem('foto_perfil_actual', nuevaUrl);
                    }
                }
                console.log('✅ Foto subida y actualizada exitosamente');
            } else {
                throw new Error(resultado.error || 'Error al subir la foto');
            }

        } catch (error) {
            console.error('💥 Error subiendo foto:', error);
            this.mostrarError('Error al subir la foto: ' + error.message);
            
            // Revertir a la foto anterior
            const imagenPerfil = document.getElementById('imagen-perfil');
            if (this.perfil && this.perfil.foto_perfil) {
                imagenPerfil.src = this.perfil.foto_perfil;
            } else {
                imagenPerfil.src = '/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg';
            }
        } finally {
            // Limpiar y reactivar controles
            if (inputFoto) {
                inputFoto.disabled = false;
                inputFoto.value = ''; // Limpiar input
            }
            if (botonCambiar) {
                botonCambiar.style.pointerEvents = 'auto';
                botonCambiar.textContent = '📷 Cambiar';
            }
            
            // Limpiar URL de vista previa
            if (urlPrevia) {
                URL.revokeObjectURL(urlPrevia);
            }
        }
    }
    // 🆕 MÉTODO: Actualizar foto en tiempo real
    actualizarFotoEnNavegacion(nuevaUrl) {
        if (!nuevaUrl) return;
        
        console.log('🔄 Intentando actualizar foto en navegación:', nuevaUrl);
        
        // Actualizar en localStorage para que la navegación lo use
        localStorage.setItem('foto_perfil_actual', nuevaUrl);
        
        // Intentar actualizar directamente si la navegación está disponible
        if (window.navegacionGlobal && typeof window.navegacionGlobal.actualizarFotoEnNavegacion === 'function') {
            console.log('✅ Navegación global disponible, actualizando directamente');
            window.navegacionGlobal.actualizarFotoEnNavegacion(nuevaUrl);
        } else {
            console.log('⚠️ Navegación global no disponible, se actualizará en el próximo refresh');
            // La foto se cargará cuando la navegación se inicialice
        }
        
        // También intentar actualizar las imágenes directamente en el DOM
        this.actualizarFotosDirectamenteEnDOM(nuevaUrl);
    }
    actualizarFotosDirectamenteEnDOM(nuevaUrl) {
        try {
            const fotos = document.querySelectorAll('.foto-perfil-usuario, .foto-perfil-grande');
            console.log(`🔍 Encontradas ${fotos.length} fotos para actualizar`);
            
            fotos.forEach((foto, index) => {
                if (foto && foto.tagName === 'IMG') {
                    console.log(`📸 Actualizando foto ${index + 1}:`, foto.className);
                    foto.src = nuevaUrl;
                    // Agregar manejador de error por si la URL falla
                    foto.onerror = function() {
                        console.warn('⚠️ Error cargando foto, usando placeholder');
                        this.src = '/proyectoWeb/viajeros_peru/public/img/placeholder-usuario.jpg';
                    };
                }
            });
        } catch (error) {
            console.error('💥 Error actualizando fotos en DOM:', error);
        }
    }

    mostrarError(mensaje) {
        alert('Error: ' + mensaje);
    }

    mostrarExito(mensaje) {
        alert(mensaje);
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

    cerrarSesion() {
        console.log('👋 Cerrando sesión...');
        localStorage.removeItem('token_usuario');
        localStorage.removeItem('datos_usuario');
        window.location.href = '../auth/iniciar_sesion.html';
    }
}
// 🚀 FUNCIONES GLOBALES MÍNIMAS
function cerrarSesion() {
    if (window.manejadorPerfil) {
        window.manejadorPerfil.cerrarSesion();
    } else {
        localStorage.removeItem('token_usuario');
        localStorage.removeItem('datos_usuario');
        window.location.href = '../auth/iniciar_sesion.html';
    }
}

function irA(pagina) {
    window.location.href = pagina;
}
function cancelarEdicion() {
    if (window.manejadorPerfil) {
        window.manejadorPerfil.cancelarEdicion();
    }
}

// 🚀 INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando ManejadorPerfil...');
    try {
        window.manejadorPerfil = new ManejadorPerfil();
        console.log('✅ ManejadorPerfil inicializado correctamente');
    } catch (error) {
        console.error('💥 Error crítico al inicializar ManejadorPerfil:', error);
    }
});