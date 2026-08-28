# ADP - Asociación de Plataneros

**ADP**, por **Asociación de Plataneros**, es una plataforma comercial con IA para que finqueros publiquen cosechas de plátano y reciban pujas anónimas de compradores, distribuidores o aliados logísticos.

La propuesta busca resolver un problema simple pero fuerte: el productor no siempre necesita la oferta mas alta, sino la oferta que mas le conviene en valor real, considerando precio, transporte, anticipo, recoleccion, tiempo de pago, compra total y continuidad comercial.

## Estado del proyecto

**Fase actual:** Fase 1 terminada; Fase 2 en desarrollo en la rama `codex/fase-2-backend`.

La demo funcional está implementada como una aplicación **React + Vite** con datos simulados, estado en memoria y pruebas automáticas. Permite recorrer el flujo principal del producto:

```text
Finquero publica cosecha -> compradores hacen pujas anonimas -> IA compara -> finquero acepta -> cierre por WhatsApp
```

### Implementado en Fase 1

- Perfil de finca con fotografías locales de cultivo de plátano hartón.
- Formulario validado de publicación con carga temporal de fotografías.
- Asistente simulado que genera un texto comercial usando los datos del formulario.
- Vista pública de la cosecha y recorrido guiado hacia mercado y pujas.
- Compradores sugeridos y tres pujas anónimas con condiciones diferentes.
- Comparador de precio bruto, valor neto, transporte, anticipo y plazo de pago.
- Recomendación IA simulada para elegir por valor total.
- Confirmación de una única puja, bloqueo del proceso y revelación del comprador ganador.
- Cierre por WhatsApp con mensaje dinámico y destinatario opcional por entorno.
- Acción para reiniciar y repetir la demo.

### Avance de Fase 2 en la rama dedicada

- Backend Node.js + Express y TypeScript estricto.
- Prisma para MySQL 8.4 con 26 modelos, seis migraciones, llaves foráneas y restricciones reales.
- Registro, correo SMTP, recuperación/cambio de contraseña, Argon2id, JWT corto y refresh token rotatorio.
- MFA TOTP con recuperación de un solo uso y administración protegida por rol + MFA.
- Separación y cifrado autenticado de contactos privados.
- CRUD de perfiles, intereses, fincas, publicaciones, fotografías privadas y ofertas con versiones inmutables.
- Adjudicación única protegida por transacción serializable, bloqueo de filas e idempotencia.
- Auditoría HMAC encadenada, cuentas MySQL separadas y pruebas negativas de privilegios.

MySQL 8.4, el CRUD, autenticación/MFA y los privilegios técnicos ya tienen pruebas de integración reales. Antes de considerar terminada la fase faltan el frontend persistente y la recuperación operativa desde respaldos.

El diseño completo está en `docs/fase-2-base-de-datos/README.md`.

La implementación ejecutable y su estado están en `backend/README.md` y `docs/fase-2-backend.md`.

### Estado verificable de cierre de Fase 2

La rama contiene 26 modelos Prisma, seis migraciones, autenticación/MFA, administración, cifrado de contactos, CRUD comercial, privilegios efectivos, adjudicación transaccional, idempotencia y pruebas sobre MySQL 8.4. Esto todavía no equivale a una Fase 2 terminada.

| Frente de cierre | Estado actual | Evidencia que falta para cerrarlo |
|---|---|---|
| MySQL 8.4 real | Completo | Migraciones, seed, ciclo completo, reinicio frío y CI MySQL 8.4 |
| API CRUD | Completo | Perfiles, intereses, fincas, publicaciones, fotos privadas, ofertas e historial |
| Autenticación y administración | Implementado | Falta validar las credenciales del proveedor SMTP del entorno productivo |
| Seguridad efectiva en MySQL | Completo | Cuentas separadas, GRANT negativos, vista anónima, inmutabilidad y cadena HMAC |
| Integración y concurrencia | Avanzado | MySQL y 100 adjudicaciones concurrentes pasan; faltan privilegios y carga operacional |
| Frontend persistente | Pendiente | Sustituir datos simulados por autenticación y API real |
| Operación y recuperación | Pendiente | EXPLAIN, volumen, observabilidad, backup, PITR y restauración medida |

El detalle, orden de ejecución y criterio de salida están en `docs/fase-2-backend.md`. Las fases 3 a 5 —tiempo real, IA real y reputación— no forman parte de esta puerta de cierre.

## Desplegar el proyecto para desarrollo

### Requisitos

- Node.js 22.12 o superior; el entorno verificado usa Node 24.
- npm 11 o superior.
- Docker Desktop con soporte para Compose.
- Puertos locales libres: 5173 para React, 3000 para la API y 3306 para MySQL.

Docker se usa solamente para MySQL 8.4 local. El frontend y el backend se ejecutan con Node.js para conservar recarga rápida y depuración directa.

### 1. Instalar dependencias

Desde la raíz:

```bash
npm install
npm --prefix backend install
```

### 2. Preparar variables locales

Crear los archivos locales a partir de los ejemplos:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item backend/.env.docker.example backend/.env.docker
```

En otros shells se puede usar `cp` en lugar de `Copy-Item`.

- `backend/.env.docker` define contraseñas independientes para root, aplicación, observación, identidad, mercado, auditoría, migración y backup.
- `backend/.env` debe usar los mismos valores de aplicación, `MYSQL_AUTH_PASSWORD` y `MYSQL_MARKET_PASSWORD` en sus variables `DATABASE_*`, `AUTH_DATABASE_*` y `MARKET_DATABASE_*`.
- Las cinco claves Base64 del backend deben ser diferentes y decodificar exactamente 32 bytes.
- Ninguno de estos archivos se versiona.

Para generar cada clave:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Para desarrollo, `MAIL_MODE=token` devuelve tokens de verificación y recuperación en la API. Producción rechaza esa modalidad: debe usar `MAIL_MODE=smtp` y configurar `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` y `APP_PUBLIC_URL`.

### 3. Levantar MySQL 8.4

```bash
cd backend
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
```

El estado de `adp-mysql` debe aparecer como `healthy`. MySQL solo se publica en `127.0.0.1:3306`; no queda expuesto a la red local.

### 4. Crear tablas y datos iniciales

```bash
npm run db:migrate:deploy
npm run db:seed
docker compose --env-file .env.docker exec mysql sh /opt/adp/security/apply-grants.sh
npm run test:integration
```

Las migraciones crean tablas, relaciones, restricciones y la vista anónima. El seed carga Casanare, sus 19 municipios y `PLATANO_HARTON`. El paso `apply-grants.sh` crea o rota las cuentas técnicas, aplica privilegios mínimos e instala el procedimiento y los triggers de auditoría; debe ejecutarse después de cada migración que agregue tablas o vistas.

### 5. Ejecutar API y frontend

Terminal para backend:

```bash
cd backend
npm run dev
```

Terminal para frontend, desde la raíz:

```bash
npm run dev
```

Servicios:

| Componente | Dirección |
|---|---|
| Frontend | `http://127.0.0.1:5173` |
| API | `http://127.0.0.1:3000/api/v1` |
| Liveness | `http://127.0.0.1:3000/health/live` |
| Readiness MySQL | `http://127.0.0.1:3000/health/ready` |
| MySQL | `127.0.0.1:3306` |

### Conectar DBeaver sin permisos de escritura

La composición crea `adp_observer`, una cuenta destinada a inspección. No usar `root` ni `adp_app` desde DBeaver.

1. Crear una conexión **MySQL**.
2. Host: `127.0.0.1`.
3. Puerto: `3306`.
4. Base de datos: `adp`.
5. Usuario: `adp_observer`.
6. Contraseña: el valor local de `MYSQL_OBSERVER_PASSWORD` en `backend/.env.docker`.
7. Para este entorno local, dejar SSL desactivado y pulsar **Test Connection**.

Si el volumen fue creado antes de incorporar la cuenta de observación, provisionarla una vez con:

```bash
cd backend
docker compose --env-file .env.docker exec mysql sh /docker-entrypoint-initdb.d/01-create-observer.sh
```

La cuenta puede hacer `SELECT` y `SHOW VIEW`, pero no insertar, modificar ni eliminar registros.

### Verificación completa

```bash
npm run lint
npm test
npm run build
npm run backend:validate
npm --prefix backend run test:integration
```

### Detener el entorno

```bash
cd backend
docker compose --env-file .env.docker stop
```

`stop` conserva el volumen. No ejecutar `docker compose down -v` salvo que se quiera eliminar deliberadamente toda la base local.

### WhatsApp opcional

En el `.env` de la raíz se puede definir el número internacional, solo con dígitos:

```env
VITE_WHATSAPP_NUMBER=573001112233
```

Si queda vacío, WhatsApp abre el mensaje sin seleccionar destinatario.

## Despliegue de producción

La composición local no es una plantilla de producción. Antes de publicar ADP:

1. aprovisionar MySQL 8.4 en red privada, con TLS obligatorio, backups cifrados y recuperación puntual;
2. guardar credenciales y claves en un gestor de secretos;
3. configurar SMTP con TLS y verificar desde el proveedor que `SMTP_FROM` esté autorizado;
4. ejecutar `npm ci`, `npm run db:migrate:deploy`, el hardening `database/security/apply-grants.sh` con una cuenta administrativa y `npm run build` dentro de `backend/`;
5. ejecutar la API con `node backend/dist/server.js` bajo un supervisor y detrás de HTTPS;
6. compilar el frontend con `npm ci && npm run build` y servir `dist/` mediante CDN o servidor HTTPS;
7. configurar `CORS_ORIGINS`, proxy confiable, límites de red, observabilidad y rotación de claves;
8. ejecutar pruebas de integración, restaurar un backup y verificar readiness antes de dirigir tráfico.

El backend no debe exponerse a Internet hasta cerrar todos los criterios de seguridad y operación documentados para Fase 2.

## Estructura actual

```text
src/                     Frontend React y demo de Fase 1
public/assets/           Fotografías locales
backend/prisma/          Schema, migraciones y seed
backend/database/        Inicialización y seguridad local de MySQL
backend/src/             API y lógica de Fase 2
backend/tests/           Pruebas unitarias e integración MySQL
docs/fase-1-demo.md      Estado y límites de la Fase 1
docs/fase-2-backend.md   Estado y puertas de cierre de Fase 2
```

## Concepto

Un finquero crea su perfil, publica una cosecha y recibe pujas anonimas. La IA ayuda a mejorar la publicacion y luego compara las ofertas para que el productor pueda decidir con mas informacion.

La identidad del comprador se mantiene anonima mientras la puja esta abierta. Cuando el finquero acepta una oferta, se revela el comprador y las partes cierran la negociacion por chat o WhatsApp.

## Usuarios

- **Finqueros:** publican cosechas, reciben pujas y eligen la mejor oferta.
- **Compradores mayoristas:** buscan volumen, ubicacion, fecha y calidad.
- **Distribuidores:** encuentran producto y proponen condiciones logisticas.
- **Asociaciones:** agrupan publicaciones de varios productores.
- **Instituciones:** pueden usar datos agregados para entender oferta, demanda y zonas productivas.

## Donde entra la IA

- Ayuda al finquero a redactar publicaciones claras.
- Sugiere datos faltantes: cantidad, fecha, fotos, acceso vial, condiciones de cargue.
- Ayuda al comprador a buscar cosechas segun zona, volumen y fecha.
- Compara pujas por valor total, no solo por precio.
- Resume ventajas, riesgos y condiciones de cada oferta.

## MVP

La primera version debe concentrarse en:

- perfiles de finqueros;
- publicaciones de cosecha;
- buscador para compradores;
- pujas anonimas;
- asistente IA para publicaciones;
- comparador IA de pujas;
- cierre por WhatsApp.

## Roadmap

El desarrollo se organizara por fases:

1. Preparacion del proyecto.
2. Demo navegable.
3. MVP tecnico con backend y MySQL.
4. Pujas anonimas en tiempo real.
5. Inteligencia artificial comercial.
6. Cierre por WhatsApp y reputacion.
7. Piloto con usuarios reales.
8. Inteligencia comercial, prediccion y escalamiento.

Ver detalle en `docs/roadmap.md`.

## Documentacion

La guia principal del proyecto esta en:

- `CONTRIBUTING.md`
- `docs/roadmap.md`
- `docs/fase-1-demo.md`
- `docs/fase-2-base-de-datos/README.md`
- `docs/fase-2-base-de-datos/modelo-relacional.md`
- `docs/fase-2-base-de-datos/diccionario-de-datos.md`
- `docs/fase-2-base-de-datos/logica-e-integridad.md`
- `docs/fase-2-base-de-datos/seguridad-de-la-informacion.md`
- `docs/fase-2-base-de-datos/plan-de-implementacion.md`
- `docs/fase-2-backend.md`
- `backend/README.md`
- `docs/git-workflow.md`
- `docs/llano/guia-proyecto-plataneros.md`
- `docs/llano/plataneros-marketplace-pujas.md`
- `docs/llano/stack-tecnologico-seleccionado.md`
- `docs/llano/diagramas/plataneros-marketplace-pujas.puml`

## Frase guia

> No es otro marketplace agricola. Es un sistema de negociacion inteligente para que el finquero elija la oferta que mas le conviene en terminos reales: precio, transporte, anticipo, riesgo, recoleccion y continuidad comercial.
