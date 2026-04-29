# Guia de Sustentacion

## Presentacion de 3 a 5 minutos

### 1. Apertura

"Dinamicash Wallet es una aplicacion web orientada a la gestion de finanzas personales. Nace para ayudar a usuarios que no llevan control claro de sus ingresos, gastos, metas de ahorro y una referencia inicial sobre renta en Colombia. Mi objetivo fue desarrollar una solucion usable, segura y con trazabilidad, no solamente una interfaz bonita."

### 2. Problema

"Muchas personas registran sus gastos de manera informal o no los registran, lo que dificulta saber en que se va el dinero, controlar metas de ahorro y tomar decisiones financieras. Dinamicash centraliza esa informacion y la transforma en reportes utiles."

### 3. Solucion propuesta

"La solucion permite registrar usuarios, validar el correo, iniciar sesion, gestionar categorias, registrar movimientos, administrar metas, consultar reportes comparativos y usar un simulador orientativo de renta. Adicionalmente, incorpora medidas de seguridad y auditoria para eventos sensibles."

### 4. Arquitectura

"La aplicacion esta dividida en frontend y backend. El frontend fue desarrollado con HTML, CSS y JavaScript. El backend esta construido con Node.js, Express y MySQL. En esta ultima mejora, el backend fue modularizado por dominios para separar autenticacion, usuarios, categorias, movimientos, reportes, metas y soporte."

### 5. Valor tecnico

"No es solamente un CRUD. El sistema incluye verificacion por correo, sesiones persistentes, bloqueo por intentos fallidos, recuperacion de PIN, auditoria de acciones y reportes financieros filtrables. Eso demuestra analisis funcional, seguridad basica y organizacion del software."

### 6. Cierre

"Como mejora futura, el proyecto puede crecer hacia presupuestos automaticos, notificaciones programadas y pruebas de integracion. Sin embargo, en su estado actual ya resuelve el problema propuesto y demuestra competencias de analisis, desarrollo, validacion y estructuracion del software."

## Demo sugerida

Haz la demostracion en este orden:

1. Mostrar la pantalla de login y explicar el problema que resuelve el sistema.
2. Registrar un usuario o explicar el flujo de verificacion por correo.
3. Iniciar sesion.
4. Crear un ingreso y un gasto.
5. Mostrar categorias y metas.
6. Abrir reportes y explicar filtros, comparativa y categoria de mayor gasto.
7. Mostrar el simulador de renta como modulo complementario.
8. Explicar rapidamente la seguridad: sesiones, bloqueo, auditoria.

## Puntos fuertes que debes resaltar

- Verificacion de correo antes del acceso.
- Sesiones manejadas con cookie HTTP-only.
- Recuperacion y cambio seguro del PIN.
- Registro de auditoria para acciones sensibles.
- Reportes por fechas, tipo y categoria.
- Gestion de metas financieras.
- Backend modularizado por dominios.
- Pruebas tecnicas automatizadas para reglas clave.

## Si el jurado pregunta "que tiene de analisis"

Puedes responder:

"La parte de analisis esta en la identificacion del problema, el levantamiento de funcionalidades, la definicion de entidades como usuarios, movimientos, categorias y metas, la validacion de flujos criticos, y la traduccion de esas necesidades a reglas de negocio y persistencia de datos."

## Si preguntan "por que no usaste framework frontend"

Puedes responder:

"Porque el objetivo principal del proyecto era resolver correctamente la logica funcional y la arquitectura del sistema. Decidi usar frontend web nativo para mantener control total del flujo y concentrar el esfuerzo en seguridad, reglas de negocio, reportes y experiencia del usuario."

## Si preguntan "que evidencia tienes de calidad"

Puedes responder:

"El proyecto incluye validaciones de entrada, modularizacion del backend, esquema formal de base de datos, trazabilidad mediante auditoria, endpoint de salud y pruebas automatizadas sobre reglas criticas de validacion y reportes."

## Si preguntan "que mejorarias"

Puedes responder:

"Como siguiente etapa implementaria pruebas de integracion para endpoints, mayor desacoplamiento en controladores y servicios, presupuestos mensuales, notificaciones automaticas y posiblemente una capa administrativa o analitica."

## Preguntas probables del jurado y respuesta corta

### Que problema real resuelve

"Resuelve la falta de control financiero personal y la baja visibilidad de gastos, metas y flujo de dinero."

### Por que usaste MySQL

"Porque el proyecto maneja entidades bien estructuradas y relaciones claras entre usuarios, movimientos, categorias, metas y sesiones."

### Como manejas la seguridad

"Con validacion de correo, sesiones persistentes, cookie HTTP-only, bloqueo por intentos fallidos, recuperacion de PIN y auditoria."

### Como sabes que el sistema funciona

"Porque se validaron flujos funcionales y se agregaron pruebas automatizadas para reglas de negocio clave."

### Cual fue el mayor reto

"Integrar seguridad, persistencia, reportes y experiencia de usuario sin limitar el sistema a un CRUD simple."

## Recomendaciones finales para sustentar bien

- No hables demasiado rapido.
- No leas todo; explica con tus palabras.
- Cuando muestres codigo, ensena solo estructura y piezas clave.
- Cuando muestres la base de datos, explica relaciones y no cada columna.
- Si algo no esta terminado al 100 por ciento, dilo con seguridad y muestra la ruta de mejora.
