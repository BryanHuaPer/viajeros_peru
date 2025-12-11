# 🔧 Guía de Troubleshooting - Ajustes.html

## El problema
La página `ajustes.html` redirige a `iniciar_sesion.html` aunque ya estés logueado.

## Causas posibles

1. **Token no se guardó correctamente después del login**
2. **La clave del token es diferente** (`token` vs `token_usuario`)
3. **Los datos del usuario no se guardaron** (`datos_usuario`)
4. **El navegador tiene limitaciones CORS o privacidad que impiden acceder a localStorage**

## Soluciones

### 1️⃣ Verificar que estés logueado
Accede a esta URL:
```
http://localhost/proyectoWeb/viajeros_peru/verificar_sesion.html
```

Debe mostrar:
- ✅ token_usuario: SÍ
- ✅ datos_usuario: SÍ
- ✅ ESTÁS LOGUEADO

Si no, necesitas:
1. Ir a `/proyectoWeb/viajeros_peru/app/vistas/auth/iniciar_sesion.html`
2. Iniciar sesión correctamente
3. Volver a verificar

### 2️⃣ Abrir la consola del navegador
Presiona `F12` → Pestaña "Console"

Si ves esto:
```
❌ NO HAY TOKEN - Sesión inválida
```

**Significa** que el login no guardó el token correctamente.

### 3️⃣ Si aparece un error de CORS en la consola
**Solución:** 
- Asegúrate de que el servidor PHP está corriendo en XAMPP
- Accede desde `http://localhost` NO desde `file://`
- Si usas un puerto diferente, ajusta las URLs

### 4️⃣ Si ves en la consola:
```
✅ Sesión VÁLIDA, cargando ajustes...
```

Pero aún así te redirige, entonces:
- El problema es que `datos_usuario` falta
- **Solución:** Haz logout y login nuevamente desde `iniciar_sesion.html`

## Logs a revisar

En la **consola del navegador** (F12 → Console), busca:

| Log | Significado |
|-----|-------------|
| `🚀 SCRIPT DE AJUSTES INICIADO` | El script comenzó a ejecutarse |
| `✅ Sesión VÁLIDA` | El token existe |
| `✅ Sesión válida, cargando ajustes...` | Todo está bien hasta aquí |
| `❌ NO HAY TOKEN - Sesión inválida` | Token no encontrado |
| `❌ Sesión incompleta` | Falta token o datos_usuario |

## Pasos para debuguear

1. **Abre el navegador en modo privado/incógnito** (a veces localStorage no funciona en modo privado)
2. **Inicia sesión** desde `iniciar_sesion.html`
3. **Abre DevTools** (F12)
4. **Pestaña Application → Local Storage**
5. **Verifica que existan:**
   - `token_usuario` (debe tener un valor largo, el JWT)
   - `datos_usuario` (debe ser un objeto JSON)

Si no existen, el problema está en el login.

## Solución rápida

Si nada funciona:
1. Borra todo el localStorage: `localStorage.clear()`
2. Recarga la página
3. Vuelve a iniciar sesión
4. Intenta acceder a ajustes.html de nuevo

## Si sigue sin funcionar

Verifica que en `login.js` se esté guardando así:
```javascript
localStorage.setItem('token_usuario', datos.token);
localStorage.setItem('datos_usuario', JSON.stringify(datos.usuario));
```

Y que la respuesta del servidor incluya:
```json
{
  "exito": true,
  "token": "eyJhbGc...",
  "usuario": {
    "id": 1,
    "nombre": "...",
    "apellido": "..."
  }
}
```
