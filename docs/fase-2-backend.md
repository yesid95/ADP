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
