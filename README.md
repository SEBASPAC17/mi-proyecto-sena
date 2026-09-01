# Dinamicash Wallet

Aplicación web para la gestión de finanzas personales orientada a estudiantes y usuarios que necesitan registrar ingresos, gastos, metas de ahorro y una simulación básica de renta en Colombia.

## Resumen del proyecto

Dinamicash Wallet fue construido como proyecto de grado para demostrar análisis, diseño e implementación de una solución de software completa. El sistema integra autenticación, verificación por correo, sesiones persistentes, trazabilidad de acciones, reportes financieros y una interfaz pensada para acompañar al usuario con apoyo visual y educativo.

## Problema que resuelve

Muchos usuarios llevan sus finanzas de forma manual o desordenada, lo que dificulta:

- conocer cuánto dinero entra y sale realmente
- identificar categorías de gasto que afectan el ahorro
- hacer seguimiento a metas financieras
- tener una referencia inicial sobre la declaración de renta

Dinamicash centraliza esta información y presenta reportes que apoyan la toma de decisiones.

## Objetivo general

Desarrollar una aplicación web de finanzas personales que permita registrar movimientos, administrar metas de ahorro y consultar reportes financieros de manera segura, usable y trazable.

## Objetivos específicos

- Registrar usuarios con validación y confirmación por correo.
- Gestionar ingresos, gastos y categorías personalizadas.
- Generar reportes resumidos por periodos y categorías.
- Administrar metas financieras con fechas límite.
- Proveer una simulación orientativa de renta para Colombia.
- Incorporar medidas de seguridad como sesiones, bloqueo por intentos fallidos y auditoría.

## Alcance funcional

- Registro, inicio y cierre de sesión.
- Verificación de correo y restablecimiento de PIN.
- Gestión de perfil y cambio de correo.
- Registro, edición y eliminación lógica de movimientos.
- Gestión de categorías.
- Gestión de metas.
- Reportes con comparativa mensual.
- Envío de solicitudes de ayuda.
- Simulador simple de renta.

## Requisitos no funcionales

- Seguridad básica en autenticación y sesiones.
- Persistencia en MySQL.
- Interfaz responsive.
- Soporte de idioma en español, inglés y portugués.
- Trazabilidad de eventos clave mediante auditoría.

## Arquitectura

La solución sigue una arquitectura cliente-servidor:

- `frontend/`: interfaz web estática en HTML, CSS y JavaScript.
- `backend/`: API REST construida con Express y conexión a MySQL.
- `backend/schema.sql`: esquema base de la base de datos.

### Componentes principales

- `frontend/dashboard.html`: interfaz principal de operación.
- `frontend/script.js`: lógica del dashboard.
- `frontend/login.js`: flujo de autenticación.
- `backend/server.js`: composición principal de la API.
- `backend/routes/`: registro modular de rutas por dominio.
- `backend/config/appConfig.js`: constantes y configuración.
- `backend/utils/common.js`: utilidades compartidas.
- `backend/utils/reporting.js`: reglas de filtros y reportes.
- `backend/db.js`: conexión a MySQL.

## Modelo de datos

Entidades principales:

- `usuarios`
- `categorias`
- `movimientos`
- `metas`
- `email_tokens`
- `user_sessions`
- `audit_logs`

El esquema completo se encuentra en [backend/schema.sql](/abs/path/C:/Users/Admin/OneDrive/Escritorio/dinamicash/backend/schema.sql:1).

## Tecnologías usadas

- Node.js
- Express
- MySQL
- bcryptjs
- Nodemailer
- HTML5
- CSS3
- JavaScript
- Chart.js
- jsPDF

## Instalación

1. Instalar dependencias del backend:

```bash
cd backend
npm install
```

2. Crear la base de datos ejecutando:

```sql
SOURCE backend/schema.sql;
```

3. Configurar variables de entorno a partir de [backend/.env.example](/abs/path/C:/Users/Admin/OneDrive/Escritorio/dinamicash/backend/.env.example:1).

4. Iniciar el backend:

```bash
cd backend
npm run dev
```

5. Abrir el frontend desde:

- `http://localhost:3000/frontend/login.html`

## Pruebas

Se incluyeron pruebas automáticas para reglas críticas de validación y reportes:

```bash
cd backend
npm test
```

Archivo de pruebas:

- [backend/tests/run-tests.js](/abs/path/C:/Users/Admin/OneDrive/Escritorio/dinamicash/backend/tests/run-tests.js:1)

## APK Android con Capacitor

El proyecto esta preparado para compilarse como APK Android usando Capacitor sin frameworks frontend. La configuracion vive en la raiz del repositorio y apunta a `frontend/` como carpeta web.

Comandos principales:

```bash
npm install
npx cap copy android
npx cap sync android
npx cap open android
```

Guia completa:

- [docs/CAPACITOR-ANDROID.md](/abs/path/C:/Users/Admin/OneDrive/Escritorio/dinamicash/docs/CAPACITOR-ANDROID.md:1)

## Evidencias técnicas que fortalecen la sustentación

- Validación de correo antes de permitir acceso.
- Bloqueo temporal por intentos fallidos.
- Sesiones persistentes mediante cookie HTTP-only.
- Auditoría de eventos sensibles.
- Soporte para restablecimiento de PIN.
- Reportes con filtros por fecha, tipo y categoría.
- Simulador orientativo de renta.

## Recomendaciones para la sustentación

- Explicar primero el problema real y el usuario objetivo.
- Mostrar el flujo completo: registro, verificación, login y dashboard.
- Resaltar seguridad, sesiones, reportes y auditoría.
- Mostrar el modelo de datos y cómo se relacionan las tablas.
- Aclarar que la simulación de renta es orientativa y no reemplaza asesoría contable.

Material de apoyo:

- [docs/SUSTENTACION.md](/abs/path/C:/Users/Admin/OneDrive/Escritorio/dinamicash/docs/SUSTENTACION.md:1)
- [docs/PREGUNTAS-JURADO.md](/abs/path/C:/Users/Admin/OneDrive/Escritorio/dinamicash/docs/PREGUNTAS-JURADO.md:1)

## Mejoras futuras sugeridas

- Desacoplar aún más la lógica en `controllers` y `services`.
- Agregar pruebas de integración para endpoints.
- Implementar panel administrativo o analítica de uso.
- Incorporar presupuestos mensuales automáticos.
- Notificaciones programadas para metas.
