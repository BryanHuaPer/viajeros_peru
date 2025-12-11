// Script para manejar el login
class ManejadorLogin {
    constructor() {
        this.inicializar();
    }

    inicializar() {
        this.configurarManejadores();
        this.verificarParametrosURL();
    }

    configurarManejadores() {
        const formulario = document.getElementById('formulario-login');
        if (formulario) {
            formulario.addEventListener('submit', (e) => this.manejarEnvio(e));
        }

        // Validación en tiempo real
        this.configurarValidacionEnTiempoReal();
    }

    configurarValidacionEnTiempoReal() {
        const campos = ['correo', 'contrasena'];
        
        campos.forEach(campo => {
            const elemento = document.getElementById(campo);
            if (elemento) {
                elemento.addEventListener('blur', () => this.validarCampo(campo));
                elemento.addEventListener('input', () => this.limpiarError(campo));
            }
        });
    }

    validarCampo(nombreCampo) {
        const valor = document.getElementById(nombreCampo).value;
        let esValido = true;
        let mensaje = '';

        switch (nombreCampo) {
            case 'correo':
                esValido = this.validarCorreo(valor);
                mensaje = esValido ? '' : 'Correo electrónico inválido';
                break;
            
            case 'contrasena':
                esValido = this.validarContrasena(valor);
                mensaje = esValido ? '' : 'La contraseña es requerida';
                break;
        }

        this.mostrarErrorCampo(nombreCampo, mensaje);
        return esValido;
    }

    validarCorreo(correo) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(correo);
    }

    validarContrasena(contrasena) {
        return contrasena && contrasena.length >= 1;
    }

    mostrarErrorCampo(nombreCampo, mensaje) {
        const elementoError = document.getElementById(`error-${nombreCampo}`);
        const elementoInput = document.getElementById(nombreCampo);
        
        if (mensaje) {
            elementoError.textContent = mensaje;
            elementoError.classList.add('mostrar');
            elementoInput.classList.add('error');
        } else {
            elementoError.classList.remove('mostrar');
            elementoInput.classList.remove('error');
        }
    }

    limpiarError(nombreCampo) {
        this.mostrarErrorCampo(nombreCampo, '');
    }

    verificarParametrosURL() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('registro') === 'exitoso') {
            this.mostrarMensajeRegistroExitoso();
        }
    }

    mostrarMensajeRegistroExitoso() {
        const mensajeDiv = document.getElementById('mensaje-registro-exitoso');
        if (mensajeDiv) {
            mensajeDiv.style.display = 'block';
            
            // Ocultar después de 5 segundos
            setTimeout(() => {
                mensajeDiv.style.display = 'none';
            }, 5000);
        }
    }

    async manejarEnvio(evento) {
        evento.preventDefault();
        console.log('📝 Iniciando proceso de login...');
        
        if (!this.validarFormulario()) {
            return;
        }

        await this.enviarLogin();
    }

    validarFormulario() {
        const campos = ['correo', 'contrasena'];
        let esValido = true;

        campos.forEach(campo => {
            if (!this.validarCampo(campo)) {
                esValido = false;
            }
        });

        return esValido;
    }

    async enviarLogin() {
        const botonLogin = document.querySelector('.boton-login');
        botonLogin.disabled = true;
        botonLogin.textContent = 'Iniciando sesión...';

        // Ocultar mensajes de error anteriores
        this.ocultarErrorGeneral();

        try {
            const datos = {
                correo: document.getElementById('correo').value,
                contrasena: document.getElementById('contrasena').value,
                recordarme: document.getElementById('recordarme').checked
            };

            console.log('🚀 Enviando login:', { ...datos, contrasena: '***' });

            const urlAPI = '/proyectoWeb/viajeros_peru/backend/api/autenticacion.php';
            
            const respuesta = await fetch(urlAPI, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accion: 'login',
                    ...datos
                })
            });

            const textoRespuesta = await respuesta.text();
            console.log('📄 Respuesta del login:', textoRespuesta);

            let datosRespuesta;
            try {
                datosRespuesta = JSON.parse(textoRespuesta);
            } catch (e) {
                throw new Error('Error en la respuesta del servidor');
            }

            if (datosRespuesta.exito) {
                console.log('🎉 Login exitoso');
                this.procesarLoginExitoso(datosRespuesta);
            } else {
                throw new Error(datosRespuesta.error || 'Error desconocido en el login');
            }

        } catch (error) {
            console.error('💥 Error en login:', error);
            this.mostrarErrorGeneral(error.message);
        } finally {
            botonLogin.disabled = false;
            botonLogin.textContent = 'Iniciar Sesión';
        }
    }

    procesarLoginExitoso(datos) {
        // 🆕 LIMPIAR CACHE DE FOTOS ANTES DEL LOGIN
        localStorage.removeItem('foto_perfil_actual');
        localStorage.removeItem('perfil_usuario');
        
        // Guardar token y datos de usuario
        if (datos.token) {
            localStorage.setItem('token_usuario', datos.token);
        }
        
        if (datos.usuario) {
            localStorage.setItem('datos_usuario', JSON.stringify(datos.usuario));
            // Guardar preferencia de idioma si viene desde el servidor
            try {
                const idiomaServidor = datos.usuario.idioma || datos.usuario.idioma_preferido;
                if (idiomaServidor) {
                    localStorage.setItem('idioma_preferido', idiomaServidor);
                }
            } catch (e) {
                console.warn('No se pudo guardar idioma desde la respuesta de login:', e);
            }
        }

        // 🆕 AGREGAR FLAG DE LOGIN RECIENTE
        sessionStorage.setItem('login_reciente', 'true');
        console.log('🏷️ Flag de login reciente establecido');

        // Mostrar mensaje de éxito
        this.mostrarExito('¡Bienvenido de vuelta! Redirigiendo...');

        // Redirigir al dashboard
        setTimeout(() => {
            window.location.href = '../perfil/panel_control.html';
        }, 1500);
    }

    mostrarErrorGeneral(mensaje) {
        const errorDiv = document.getElementById('mensaje-error-general');
        if (errorDiv) {
            errorDiv.innerHTML = `
                <strong>Error:</strong> ${mensaje}
                <button type="button" id="cerrar-error" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; position: absolute; right: 0.5rem; top: 0.5rem; color: #dc2626;">×</button>
            `;
            errorDiv.style.display = 'block';
            
            // Configurar el evento de cierre correctamente
            const botonCerrar = document.getElementById('cerrar-error');
            if (botonCerrar) {
                botonCerrar.addEventListener('click', () => {
                    errorDiv.style.display = 'none';
                });
            }
        }
    }

    ocultarErrorGeneral() {
        const errorDiv = document.getElementById('mensaje-error-general');
        if (errorDiv) {
            errorDiv.style.display = 'none';
            // Limpiar el contenido para evitar eventos duplicados
            errorDiv.innerHTML = '';
        }
    }

    mostrarExito(mensaje) {
        // Temporal - podemos mejorar esto después con notificaciones bonitas
        const mensajeDiv = document.getElementById('mensaje-registro-exitoso');
        if (mensajeDiv) {
            mensajeDiv.innerHTML = `✅ ${mensaje}`;
            mensajeDiv.style.display = 'block';
            mensajeDiv.style.background = '#d4edda';
            mensajeDiv.style.color = '#155724';
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando ManejadorLogin...');
    window.manejadorLogin = new ManejadorLogin();
});