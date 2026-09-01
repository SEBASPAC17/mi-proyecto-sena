# Dinamicash en Android con Capacitor

Esta guia documenta el estado actual y los pasos para generar una APK Android de Dinamicash.

## Estado actual

El proyecto ya quedo preparado para Capacitor sin framework:

- Frontend estatico: `frontend/`
- Backend Express/MySQL: `backend/`
- Configuracion Capacitor: `capacitor.config.json`
- Proyecto Android nativo: `android/`
- Dependencias Capacitor instaladas en la raiz del proyecto.

Archivo principal de Capacitor:

```json
{
  "appId": "com.dinamicash.app",
  "appName": "Dinamicash",
  "webDir": "frontend",
  "server": {
    "androidScheme": "https"
  }
}
```

## Punto critico: no usar localhost en la APK

En Android, `localhost` apunta al celular, no al computador ni al servidor.

El archivo `frontend/api.js` ya fue preparado para usar una URL productiva cuando la app corre dentro de Capacitor. Antes de generar una APK real, cambia:

```js
const PRODUCTION_API_URL = "https://tu-backend-dinamicash.com";
```

Por el dominio real de tu API, por ejemplo:

```js
const PRODUCTION_API_URL = "https://api.dinamicash.com";
```

## Backend requerido

La APK no incluye Node.js, Express ni MySQL. El backend debe estar desplegado en un servidor accesible desde internet y con HTTPS.

Opciones comunes:

- Render
- Railway
- VPS
- Servidor institucional
- Host propio con Node.js y MySQL

## Variables recomendadas en produccion

En el `.env` real del backend desplegado usa valores equivalentes a:

```env
NODE_ENV=production
PORT=3000

DB_HOST=tu-host-mysql
DB_USER=tu-usuario
DB_PASSWORD=tu-password
DB_NAME=dinamicash

FRONTEND_URL=https://tu-frontend-dinamicash.com
CORS_ORIGIN=https://tu-frontend-dinamicash.com,https://localhost

SECURE_COOKIES=true
SESSION_COOKIE_SAMESITE=None
TRUST_PROXY=true

SESSION_COOKIE_NAME=dinamicash_session
SESSION_TTL_DAYS=7

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu_correo@ejemplo.com
EMAIL_PASS=tu_password_de_aplicacion
EMAIL_FROM=Dinamicash <no-reply@ejemplo.com>
SUPPORT_EMAIL=soporte@ejemplo.com
```

`https://localhost` en `CORS_ORIGIN` es importante para Capacitor Android.

## Comandos de trabajo

Instalar dependencias raiz:

```bash
npm install
```

Agregar Android si no existe:

```bash
npx cap add android
```

Copiar cambios del frontend hacia Android:

```bash
npx cap copy android
```

Sincronizar plugins y proyecto nativo:

```bash
npx cap sync android
```

Abrir Android Studio:

```bash
npx cap open android
```

## Generar APK en Android Studio

Para APK de prueba:

1. Abrir Android Studio con `npx cap open android`.
2. Esperar la sincronizacion de Gradle.
3. Ir a `Build > Build Bundle(s) / APK(s) > Build APK(s)`.
4. Buscar el APK en `android/app/build/outputs/apk/debug/app-debug.apk`.

Para APK final firmada:

1. Ir a `Build > Generate Signed Bundle / APK`.
2. Elegir `APK`.
3. Crear o seleccionar un keystore.
4. Elegir variante `release`.
5. Finalizar el asistente.

## Flujo cada vez que cambies frontend

Cada cambio en `frontend/*.html`, `frontend/*.css` o `frontend/*.js` requiere:

```bash
npx cap copy android
```

Si cambias plugins nativos:

```bash
npx cap sync android
```

## Pendientes que dependen de informacion externa

- Reemplazar `https://tu-backend-dinamicash.com` por el dominio real del backend en `frontend/api.js`.
- Desplegar el backend Express/MySQL en un servidor HTTPS.
- Configurar el `.env` real del servidor con credenciales de MySQL y correo.
- Abrir Android Studio y generar la APK firmada con tu keystore.
- Probar login, registro, recuperacion y dashboard desde un celular real.

## Pruebas hechas localmente

- `npm install` en la raiz: correcto.
- `npx cap copy android`: correcto.
- `npx cap doctor android`: correcto.
- `npm test` en `backend/`: 19 pruebas superadas.

