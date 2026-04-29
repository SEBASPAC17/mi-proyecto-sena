# Preguntas Del Jurado

## Pregunta: Que hace diferente a este proyecto frente a un CRUD basico

Respuesta sugerida:

"Ademas de crear, leer, actualizar y eliminar datos, el sistema incorpora verificacion de correo, control de sesiones, recuperacion de PIN, auditoria, reportes con filtros, metas financieras y un simulador orientativo de renta. Eso lo convierte en una solucion mas cercana a un producto real."

## Pregunta: Donde se evidencia la arquitectura

Respuesta sugerida:

"En la separacion entre frontend y backend, el uso de MySQL como capa de persistencia y la modularizacion reciente del backend por dominios como autenticacion, usuarios, categorias, movimientos, reportes, metas y soporte."

## Pregunta: Cuales fueron las entidades principales

Respuesta sugerida:

"Usuarios, categorias, movimientos, metas, tokens de correo, sesiones y logs de auditoria."

## Pregunta: Que validaciones implementaste

Respuesta sugerida:

"Validacion de correo, nombre, PIN de 4 digitos, ownership del usuario autenticado, verificacion de categorias validas, control de fecha de movimiento y prevencion de operaciones sobre registros inexistentes."

## Pregunta: Como evitaste accesos no autorizados

Respuesta sugerida:

"Cada endpoint sensible exige autenticacion y valida que el usuario solo consulte o modifique su propia informacion."

## Pregunta: Como manejas la continuidad de la sesion

Respuesta sugerida:

"Mediante sesiones persistentes almacenadas en base de datos y una cookie HTTP-only que referencia un token cifrado por hash."

## Pregunta: Como probaste el proyecto

Respuesta sugerida:

"Con pruebas funcionales de uso y con pruebas automatizadas para reglas criticas como validaciones y logica de reportes."

## Pregunta: Si tuvieras mas tiempo, que harías

Respuesta sugerida:

"Agregaria pruebas de integracion, un presupuesto mensual inteligente, notificaciones automaticas y una vista administrativa de analitica."
