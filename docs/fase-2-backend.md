# Fase 2 — backend ejecutable

## Rama de trabajo

El backend se desarrolla en la rama codex/fase-2-backend. La rama main conserva el estado estable de Fase 1 y la especificación documental.

## Implementado en la primera iteración

- paquete independiente en backend/;
- Express 5 + TypeScript;
- Prisma 7 compatible con MySQL 8.4;
- schema.prisma con los 25 modelos documentados;
- migración SQL inicial;
- restricciones por fila y relaciones compuestas;
- autenticación y sesiones rotatorias;
- cifrado de contactos;
- CRUD inicial de fincas y publicaciones;
- ofertas versionadas;
- lectura anónima;
- adjudicación única;
- idempotencia y auditoría;
- seed territorial inicial para Casanare;
- pruebas unitarias, contractuales y HTTP sin base.

## Conexión de componentes

~~~mermaid
flowchart LR
    UI[React] -->|HTTPS / JWT| API[Express 5]
    API --> AUTH[Auth]
    API --> MARKET[Market]
    MARKET --> BID[Bids]
    AUTH --> CRYPTO[AES-GCM / Argon2id / JWT]
    AUTH --> PRISMA[Prisma 7]
    MARKET --> PRISMA
    BID --> PRISMA
    PRISMA --> MYSQL[(MySQL 8.4)]
    BID --> AUDIT[Auditoría HMAC]
    AUTH --> AUDIT
    AUDIT --> MYSQL
~~~

## Fuentes de verdad

| Tema | Archivo |
|---|---|
| Modelos Prisma | backend/prisma/schema.prisma |
| SQL inicial | backend/prisma/migrations/20260828032000_init/migration.sql |
| Reglas de oferta | backend/src/modules/bids/bid-policy.ts |
| Transacción de adjudicación | backend/src/modules/bids/bid.service.ts |
| Seguridad de identidad | backend/src/modules/auth/auth.service.ts |
| Operación local | backend/README.md |
| Diseño conceptual | docs/fase-2-base-de-datos/README.md |

## Estado de verificación

La verificación sin MySQL cubre tipos, criptografía, Argon2id, tokens, políticas monetarias, contrato del esquema, restricciones del SQL y superficie HTTP.

La validación con MySQL real queda como siguiente puerta: migración, seed, ciclo completo y carrera concurrente de adjudicación.

## Plan de cierre de los siete frentes

Este documento diferencia código existente de evidencia de cierre. Un frente no se marca como terminado solo porque tenga tablas o servicios: debe superar su prueba operativa correspondiente.

| # | Frente | Ya existe | Falta para aceptar |
|---:|---|---|---|
| 1 | MySQL 8.4 real | Schema, SQL inicial, seed y Compose | Aplicar desde cero, validar restricciones, ciclo E2E y CI efímero |
| 2 | API CRUD | Registro, finca, publicación, oferta, revisión, comparación y adjudicación | CRUD de perfiles/intereses/fincas/publicaciones, fotografías, historial y paginación |
| 3 | Autenticación y administración | Argon2id, verificación por token, JWT, refresh rotatorio y bloqueo | Correo real, cambio/recuperación de contraseña, administración de roles y MFA TOTP obligatorio |
| 4 | Seguridad MySQL | Cifrado de PII, hashes ciegos, CHECK, FK y HMAC de eventos | Cuentas/GRANT, vista anónima, tablas inmutables y cadena `previous_hash` |
| 5 | Integración y concurrencia | Pruebas unitarias, contractuales y HTTP sin base | Suite sobre MySQL, pruebas negativas de autorización y adjudicación concurrente |
| 6 | Frontend persistente | Demo React completa con datos simulados | Cliente API, sesión, estados de red y recorrido comercial persistente |
| 7 | Operación y recuperación | Health checks y logging con redacción | EXPLAIN, volumen, métricas, backup/PITR, restauración y medición RPO/RTO |

### Orden obligatorio

1. establecer MySQL real y CI;
2. completar API y autenticación;
3. aplicar permisos e inmutabilidad en la base;
4. probar integración, privacidad y concurrencia;
5. conectar el frontend;
6. medir rendimiento y demostrar recuperación;
7. auditar todos los criterios y actualizar el estado documental.

### Definición de terminado

Fase 2 termina únicamente cuando un entorno limpio puede migrar y cargar datos, el frontend completa el ciclo comercial con persistencia, solicitudes concurrentes producen una sola adjudicación, los datos privados están aislados por permisos efectivos, MFA protege administración y un respaldo real se restaura dentro de los objetivos documentados.
