// Script para manejar la autenticación (registro y login)
class ManejadorAutenticacion {
    constructor() {
        this.pasoActual = 1;
        this.datosFormulario = {};
        this.inicializar();
    }

    inicializar() {
        this.configurarManejadores();
        this.mostrarPaso(1);
    }

    configurarManejadores() {
        const formulario = document.getElementById('formulario-registro');
        if (formulario) {
            formulario.addEventListener('submit', (e) => this.manejarEnvio(e));
        }

        // Validación en tiempo real
        this.configurarValidacionEnTiempoReal();
    }

    configurarValidacionEnTiempoReal() {
        const campos = ['nombre', 'apellido', 'correo', 'contrasena', 'confirmar_contrasena'];
        
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
            case 'nombre':
            case 'apellido':
                esValido = this.validarTexto(valor, 2, 50);
                mensaje = esValido ? '' : 'Debe tener entre 2 y 50 caracteres';
                break;
            
            case 'correo':
                esValido = this.validarCorreo(valor);
                mensaje = esValido ? '' : 'Correo electrónico inválido';
                break;
            
            case 'contrasena':
                esValido = this.validarContrasena(valor);
                mensaje = esValido ? '' : 'La contraseña debe tener al menos 6 caracteres';
                break;
            
            case 'confirmar_contrasena':
                const contrasena = document.getElementById('contrasena').value;
                esValido = valor === contrasena;
                mensaje = esValido ? '' : 'Las contraseñas no coinciden';
                break;
        }

        this.mostrarErrorCampo(nombreCampo, mensaje);
        return esValido;
    }

    validarTexto(texto, min, max) {
        return texto && texto.length >= min && texto.length <= max;
    }

    validarCorreo(correo) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(correo);
    }

    validarContrasena(contrasena) {
        return contrasena && contrasena.length >= 6;
    }

    mostrarErrorCampo(nombreCampo, mensaje) {
        const elementoError = document.getElementById(`error-${nombreCampo.replace('_', '-')}`);
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

    validarPaso1() {
        const campos = ['nombre', 'apellido', 'correo', 'contrasena', 'confirmar_contrasena'];
        let esValido = true;

        campos.forEach(campo => {
            if (!this.validarCampo(campo)) {
                esValido = false;
            }
        });

        return esValido;
    }

    validarPaso2() {
        const rol = document.getElementById('rol').value;
        if (!rol) {
            this.mostrarErrorGeneral('Por favor selecciona un tipo de usuario');
            return false;
        }
        return true;
    }

    mostrarErrorGeneral(mensaje) {
        // Crear o mostrar notificación de error
        let errorDiv = document.getElementById('mensaje-error-general');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'mensaje-error-general';
            errorDiv.className = 'mensaje-error-general';
            document.querySelector('.tarjeta-auth').prepend(errorDiv);
        }
        
        errorDiv.innerHTML = `
            <strong>Error:</strong> ${mensaje}
            <button onclick="this.parentElement.style.display='none'">×</button>
        `;
        errorDiv.style.display = 'block';
    }

    async manejarEnvio(evento) {
        evento.preventDefault();
        console.log('📝 Manejar envío iniciado');
        
        if (!this.validarPaso2()) {
            return;
        }

        this.recopilarDatosFormulario();
        
        try {
            await this.enviarRegistro();
        } catch (error) {
            console.error('Error en manejarEnvio:', error);
            this.mostrarErrorGeneral('Error al crear la cuenta: ' + error.message);
        }
    }

    recopilarDatosFormulario() {
        const campos = ['nombre', 'apellido', 'correo', 'contrasena', 'rol'];
        
        campos.forEach(campo => {
            const elemento = document.getElementById(campo);
            if (elemento) {
                this.datosFormulario[campo] = elemento.value;
                console.log(`Campo ${campo}:`, elemento.value);
            }
        });

        console.log('📦 Datos recopilados:', this.datosFormulario);
    }

    async enviarRegistro() {
        const botonRegistro = document.getElementById('boton-registro');
        botonRegistro.disabled = true;
        botonRegistro.textContent = 'Creando cuenta...';

        try {
            // 🎯 SOLUCIÓN DIRECTA - USA ESTA LÍNEA EXACTA
            const urlAPI = '/proyectoWeb/viajeros_peru/backend/api/autenticacion.php';
            
            console.log('📍 URL corregida:', urlAPI);

            const respuesta = await fetch(urlAPI, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accion: 'registro',
                    ...this.datosFormulario
                })
            });

            const textoRespuesta = await respuesta.text();
            console.log('📄 Respuesta:', textoRespuesta);

            let datos = JSON.parse(textoRespuesta);

            if (datos.exito) {
                this.mostrarExito();
                setTimeout(() => {
                    window.location.href = 'iniciar_sesion.html?registro=exitoso';
                }, 2000);
            } else {
                throw new Error(datos.error || 'Error desconocido');
            }

        } catch (error) {
            this.mostrarErrorGeneral(error.message);
        } finally {
            botonRegistro.disabled = false;
            botonRegistro.textContent = 'Crear Cuenta';
        }
    }

    mostrarExito() {
        const formulario = document.getElementById('formulario-registro');
        const mensajeExito = document.getElementById('mensaje-exito');
        
        if (formulario) formulario.style.display = 'none';
        if (mensajeExito) mensajeExito.style.display = 'block';
        
        console.log('✅ Mostrando mensaje de éxito');
    }
    
}

// Funciones globales para el formulario de múltiples pasos
function siguientePaso(pasoActual) {
    const manejador = window.manejadorAuth;
    
    if (pasoActual === 1 && !manejador.validarPaso1()) {
        return;
    }

    manejador.pasoActual = pasoActual + 1;
    manejador.mostrarPaso(manejador.pasoActual);
}

function anteriorPaso(pasoActual) {
    const manejador = window.manejadorAuth;
    manejador.pasoActual = pasoActual - 1;
    manejador.mostrarPaso(manejador.pasoActual);
}

function seleccionarRol(rol) {
    console.log('👤 Rol seleccionado:', rol);
    
    // Remover selección anterior
    document.querySelectorAll('.opcion-rol').forEach(opcion => {
        opcion.classList.remove('seleccionado');
    });

    // Agregar selección actual
    const opcionSeleccionada = document.querySelector(`.opcion-rol:nth-child(${rol === 'viajero' ? 1 : 2})`);
    if (opcionSeleccionada) {
        opcionSeleccionada.classList.add('seleccionado');
    }

    // Actualizar campo oculto
    document.getElementById('rol').value = rol;
    
    // 🎯 NUEVO: Ocultar mensaje de error cuando se selecciona un rol
    const errorDiv = document.getElementById('mensaje-error-general');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

// Extender la clase para incluir manejo de pasos
ManejadorAutenticacion.prototype.mostrarPaso = function(numeroPaso) {
    console.log(`🔄 Mostrando paso ${numeroPaso}`);
    
    // Ocultar todos los pasos
    document.querySelectorAll('.paso-formulario').forEach(paso => {
        paso.classList.remove('activo');
    });

    // Mostrar paso actual
    const pasoActual = document.getElementById(`paso-${numeroPaso}`);
    if (pasoActual) {
        pasoActual.classList.add('activo');
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando ManejadorAutenticacion...');
    window.manejadorAuth = new ManejadorAutenticacion();
});