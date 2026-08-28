# ADP - Asociación de Plataneros

**ADP**, por **Asociación de Plataneros**, es una plataforma comercial con IA para que finqueros publiquen cosechas de plátano y reciban pujas anónimas de compradores, distribuidores o aliados logísticos.

La propuesta busca resolver un problema simple pero fuerte: el productor no siempre necesita la oferta mas alta, sino la oferta que mas le conviene en valor real, considerando precio, transporte, anticipo, recoleccion, tiempo de pago, compra total y continuidad comercial.

## Estado del proyecto

**Fase actual:** Fase 1 terminada; cierre técnico de Fase 2 completado en la rama `codex/fase-2-backend`.

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
- Frontend persistente con registro, sesión rotatoria, fincas, publicaciones, ofertas, retiros y adjudicación real.
- Backup AES-256-GCM, recuperación puntual con binlog y restauración medida en MySQL 8.4 aislado.
- EXPLAIN ANALYZE de ocho consultas críticas y prueba HTTP concurrente con umbrales verificables.

Los siete frentes técnicos de Fase 2 tienen evidencia local reproducible. El despliegue productivo sigue requiriendo infraestructura privada, secretos reales y una prueba con las credenciales del proveedor SMTP elegido; esa validación externa no cambia el cierre del código de la fase.

El diseño completo está en `docs/fase-2-base-de-datos/README.md`.

La implementación ejecutable y su estado están en `backend/README.md` y `docs/fase-2-backend.md`.

### Estado verificable de cierre de Fase 2

La rama contiene 26 modelos Prisma, seis migraciones, autenticación/MFA, administración, cifrado de contactos, CRUD comercial, privilegios efectivos, adjudicación transaccional, idempotencia y pruebas sobre MySQL 8.4. Esto todavía no equivale a una Fase 2 terminada.

| Frente de cierre | Estado actual | Evidencia que falta para cerrarlo |
|---|---|---|
| MySQL 8.4 real | Completo | Migraciones, seed, ciclo completo, reinicio frío y CI MySQL 8.4 |
| API CRUD | Completo | Perfiles, intereses, fincas, publicaciones, fotos privadas, ofertas e historial |
| Autenticación y administración | Completo | SMTP/TLS, recuperación, sesiones, MFA y RBAC probados; repetir smoke con el proveedor productivo |
| Seguridad efectiva en MySQL | Completo | Cuentas separadas, GRANT negativos, vista anónima, inmutabilidad y cadena HMAC |
| Integración y concurrencia | Completo | MySQL, privacidad, idempotencia, permisos, 100 adjudicaciones concurrentes y carga HTTP |
| Frontend persistente | Completo | Flujo agricultor-comprador real, regresión automática y QA responsive/accesible |
| Operación y recuperación | Completo | 8 EXPLAIN ANALYZE, métricas, backup cifrado, PITR y restauración medida |

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
- Las seis claves Base64 del backend deben ser diferentes y decodificar exactamente 32 bytes, incluida `BACKUP_ENCRYPTION_KEY_BASE64`.
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

### 5. Crear o recuperar la cuenta administradora

El proyecto no incluye una contraseña administrativa fija. Después de migrar la base y aplicar los privilegios, cada instalación debe crear su propio administrador con un secreto distinto. El comando exige una contraseña de 16 a 128 caracteres, la protege con Argon2id y nunca la imprime.

En PowerShell, desde `backend/`:

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL = Read-Host "Correo del administrador"
$adminSecret = Read-Host "Contraseña administrativa (mínimo 16 caracteres)" -AsSecureString
$adminCredential = [PSCredential]::new("adp-admin", $adminSecret)
$env:BOOTSTRAP_ADMIN_PASSWORD = $adminCredential.GetNetworkCredential().Password
$env:BOOTSTRAP_ADMIN_DISPLAY_NAME = "Administrador ADP"

try {
  npm run admin:bootstrap
} finally {
  Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:BOOTSTRAP_ADMIN_DISPLAY_NAME -ErrorAction SilentlyContinue
}
```

En Bash:

```bash
read -r -p "Correo del administrador: " BOOTSTRAP_ADMIN_EMAIL
read -r -s -p "Contraseña administrativa (mínimo 16 caracteres): " BOOTSTRAP_ADMIN_PASSWORD
printf '\n'
export BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_PASSWORD
export BOOTSTRAP_ADMIN_DISPLAY_NAME="Administrador ADP"
npm run admin:bootstrap
unset BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_PASSWORD BOOTSTRAP_ADMIN_DISPLAY_NAME
```

En una base nueva crea el usuario `ACTIVE`, marca su correo como verificado y asigna exclusivamente el rol `ADMIN`. Si el correo ya existe, el mismo comando recupera la cuenta: rota la contraseña, conserva sus otros roles, revoca sesiones y factores MFA anteriores y registra la operación en la auditoría. Después hay que iniciar sesión y enrolar nuevamente MFA antes de consumir `/api/v1/admin/*`.

No colocar `BOOTSTRAP_ADMIN_PASSWORD` en el README, `.env.example`, scripts, imágenes ni commits. En otro PC se repiten estos pasos con una contraseña nueva para ese entorno. Si se traslada una base existente, también deben trasladarse de forma segura sus claves criptográficas; cambiarlas sin una rotación planificada impediría localizar o descifrar los contactos existentes.

La interfaz persistente actual implementa los espacios de productor y comprador. La cuenta administradora puede autenticarse, pero la consola visual de administración aún no forma parte del frontend; las operaciones administrativas disponibles en esta fase se realizan mediante la API y exigen MFA.

### 6. Ejecutar API y frontend

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
cd backend
npm run db:plans
npm run test:load
```

La carga local por defecto ejecuta 250 lecturas con concurrencia 25, por debajo del límite global de 300 solicitudes por IP y minuto. Una prueba separada de exceso confirmó respuestas `429`; para medir más volumen se deben simular múltiples IP en un entorno dedicado, no desactivar el control en producción.

### Probar backup y restauración puntual

Definir una clave de backup distinta a las claves de la aplicación y ejecutar desde `backend/`:

```powershell
$keyBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($keyBytes)
$env:BACKUP_ENCRYPTION_KEY_BASE64 = [Convert]::ToBase64String($keyBytes)
npm run db:recovery:drill
```

El comando crea un dump consistente cifrado con AES-256-GCM, captura el tramo binlog posterior, inicia un MySQL 8.4 efímero sin red, restaura ambos archivos y compara los conteos exactos de todas las tablas, triggers, rutina y vista. Los artefactos locales quedan ignorados en `backend/var/recovery/`. En producción la clave debe vivir en un gestor de secretos separado y el binlog debe copiarse continuamente fuera de la instancia.

La ejecución de cierre obtuvo RPO observado de 0 segundos y RTO de 35,637 segundos frente a objetivos de 15 minutos y 4 horas. El procedimiento y la evidencia están en `docs/fase-2-operacion.md`.

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

1. aprovisionar MySQL 8.4 en red privada, con TLS obligatorio, binlog continuo y backups cifrados;
2. guardar credenciales y claves en un gestor de secretos;
3. configurar SMTP con TLS y verificar desde el proveedor que `SMTP_FROM` esté autorizado;
4. ejecutar `npm ci`, `npm run db:migrate:deploy`, el hardening `database/security/apply-grants.sh` con una cuenta administrativa y `npm run build` dentro de `backend/`;
5. ejecutar una vez `npm run admin:bootstrap` con credenciales entregadas temporalmente por el gestor de secretos, retirarlas del entorno y enrolar MFA;
6. ejecutar la API con `node backend/dist/server.js` bajo un supervisor y detrás de HTTPS;
7. compilar el frontend con `npm ci && npm run build` y servir `dist/` mediante CDN o servidor HTTPS;
8. configurar `CORS_ORIGINS`, proxy confiable, límites de red, observabilidad y rotación de claves;
9. ejecutar `db:plans`, las pruebas de integración y `db:recovery:drill` sobre un clon aislado antes de dirigir tráfico;
10. configurar alertas sobre readiness, tasa 5xx/429, p95, conexiones, espacio, `Slow_queries`, replicación y antigüedad del último backup.

El cierre técnico no autoriza por sí solo exponer el backend: la lista productiva anterior, el smoke SMTP real y la restauración en la infraestructura elegida siguen siendo puertas obligatorias de despliegue.

## Estructura actual

```text
src/                     Frontend React y demo de Fase 1
public/assets/           Fotografías locales
backend/prisma/          Schema, migraciones y seed
backend/database/        Inicialización y seguridad local de MySQL
backend/src/             API y lógica de Fase 2
backend/tests/           Pruebas unitarias e integración MySQL
backend/scripts/         Drills de recuperación, EXPLAIN y carga
docs/fase-1-demo.md      Estado y límites de la Fase 1
docs/fase-2-backend.md   Estado y puertas de cierre de Fase 2
docs/fase-2-operacion.md Evidencia y runbook operativo de Fase 2
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
- `docs/fase-2-operacion.md`
- `backend/README.md`
- `docs/git-workflow.md`
- `docs/llano/guia-proyecto-plataneros.md`
- `docs/llano/plataneros-marketplace-pujas.md`
- `docs/llano/stack-tecnologico-seleccionado.md`
- `docs/llano/diagramas/plataneros-marketplace-pujas.puml`

## Frase guia

> No es otro marketplace agricola. Es un sistema de negociacion inteligente para que el finquero elija la oferta que mas le conviene en terminos reales: precio, transporte, anticipo, riesgo, recoleccion y continuidad comercial.
