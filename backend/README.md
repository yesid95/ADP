# Backend de ADP — Fase 2

Backend TypeScript para persistir usuarios, fincas, cosechas, ofertas versionadas y adjudicaciones sobre MySQL 8.4.

## Estado

Esta rama contiene la primera base ejecutable de Fase 2:

- Express 5 y TypeScript estricto;
- Prisma 7.9.1, línea soportada para MySQL;
- 25 modelos relacionales;
- migración inicial con FKs, índices, ENUM y CHECK;
- registro, verificación de correo, login, refresh rotatorio y logout;
- Argon2id, AES-256-GCM, hashes ciegos y auditoría HMAC;
- fincas y publicaciones;
- ofertas con versiones inmutables;
- idempotencia;
- adjudicación única bajo transacción serializable y bloqueo de filas;
- lectura anónima de ofertas;
- revelación del contacto únicamente después de adjudicar.

## Requisitos

- Node.js 22.12 o superior; el entorno verificado usa Node 24.
- npm 11 o superior.
- MySQL 8.4.
- Docker es opcional para la base local.

Prisma 8 no se usa porque su versión actual todavía no soporta MySQL. Prisma 7 permanece soportado.

## Configuración

1. Copiar .env.example como .env.
2. Cambiar credenciales y generar cuatro secretos independientes de 32 bytes.

Ejemplo para generar cada secreto:

~~~bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
~~~

No reutilizar la misma clave para JWT, cifrado, lookup y auditoría.

## MySQL local con Docker

Copiar .env.docker.example como .env.docker, definir las dos contraseñas y ejecutar desde backend:

~~~bash
docker compose --env-file .env.docker up -d
~~~

La base solo se publica en 127.0.0.1. Esta composición es para desarrollo; producción debe usar red privada, TLS, backups cifrados y cuentas de menor privilegio.

## Instalación

~~~bash
npm install
npm run prisma:validate
npm run db:migrate:deploy
npm run db:seed
npm run dev
~~~

Servidor por defecto:

~~~text
http://127.0.0.1:3000
~~~

## Comandos

| Comando | Función |
|---|---|
| npm run dev | Servidor con recarga |
| npm run build | Generar Prisma y compilar TypeScript |
| npm start | Ejecutar dist/server.js |
| npm run typecheck | Generar Prisma y verificar tipos |
| npm test | Ejecutar pruebas |
| npm run prisma:validate | Validar schema.prisma |
| npm run db:migrate:dev | Crear/aplicar migraciones de desarrollo |
| npm run db:migrate:deploy | Aplicar migraciones versionadas |
| npm run db:seed | Cargar Casanare, municipios y plátano hartón |
| npm run validate | Esquema, tipos, pruebas y build |

## API inicial

Prefijo: /api/v1.

| Método | Ruta | Acceso | Uso |
|---|---|---|---|
| GET | /health/live | Público | Proceso vivo |
| GET | /health/ready | Público interno | Conexión MySQL |
| POST | /auth/register | Público limitado | Crear cuenta FARMER o BUYER |
| POST | /auth/verify-email | Público limitado | Activar correo |
| POST | /auth/login | Público limitado | Abrir sesión |
| POST | /auth/refresh | Público limitado | Rotar sesión |
| POST | /auth/logout | Público limitado | Revocar refresh token |
| POST | /farms | FARMER | Crear finca activa |
| POST | /listings | FARMER propietario | Crear publicación DRAFT |
| POST | /listings/:id/publish | FARMER propietario | Abrir publicación |
| GET | /listings | Público | Buscar publicaciones abiertas |
| POST | /listings/:id/bids | BUYER | Crear oferta |
| POST | /bids/:id/versions | BUYER propietario | Revisar condiciones |
| GET | /listings/:id/bids | FARMER propietario | Comparar ofertas anónimas |
| POST | /listings/:id/award | FARMER propietario | Adjudicar una oferta |
| GET | /listings/:id/award/contact | FARMER propietario | Revelar ganador |

Los comandos de oferta y adjudicación requieren:

~~~text
Idempotency-Key: identificador-aleatorio-de-16-a-128-caracteres
~~~

Los campos monetarios y cantidades se reciben como cadenas decimales para evitar pérdida de precisión:

~~~json
{
  "unitPriceCopPerKg": "1800.00",
  "offeredQuantityKg": "2500.000",
  "sellerLogisticsCostCop": "0.00",
  "advanceAmountCop": "1000000.00"
}
~~~

## Adjudicación

La operación:

1. inicia una transacción SERIALIZABLE;
2. bloquea la publicación con SELECT FOR UPDATE;
3. comprueba propietario, estado y plazo;
4. bloquea la oferta;
5. congela current_version_no en listing_awards;
6. cambia publicación, oferta ganadora y ofertas perdedoras;
7. escribe historiales, idempotencia y auditoría;
8. confirma una sola vez.

La PK listing_awards.listing_id impide dos ganadores. La FK compuesta listing_id + bid_id impide aceptar una oferta perteneciente a otra publicación.

## Estructura

~~~text
backend/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── config/
│   ├── infrastructure/
│   ├── middleware/
│   ├── modules/
│   │   ├── audit/
│   │   ├── auth/
│   │   ├── bids/
│   │   ├── idempotency/
│   │   └── market/
│   ├── shared/
│   ├── app.ts
│   └── server.ts
└── tests/
~~~

## Límites pendientes antes de producción

- Ejecutar la migración y pruebas concurrentes contra MySQL 8.4 real en CI.
- Implementar envío real de correo; el token de verificación solo se retorna fuera de producción.
- Implementar activación y verificación TOTP; las tablas MFA ya existen.
- Separar credenciales MySQL de identidad, mercado y auditoría.
- Aplicar permisos INSERT-only a auditoría y sin UPDATE/DELETE a bid_versions.
- Integrar almacenamiento privado y análisis de fotografías.
- Agregar recuperación de contraseña y rotación operativa de claves.
- Probar restauración de backup y recuperación puntual.
- Añadir pruebas de integración de autorización y concurrencia con base efímera.

El servidor no debe publicarse en Internet hasta cerrar esos puntos.
