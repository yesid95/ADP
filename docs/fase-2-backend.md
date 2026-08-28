# Fase 2 — backend ejecutable

## Rama de trabajo

El backend se desarrolla en la rama codex/fase-2-backend. La rama main conserva el estado estable de Fase 1 y la especificación documental.

## Implementado y validado en la rama

- paquete independiente en backend/;
- Express 5 + TypeScript;
- Prisma 7 compatible con MySQL 8.4;
- schema.prisma con 26 modelos;
- seis migraciones SQL versionadas;
- restricciones por fila y relaciones compuestas;
- autenticación, correo SMTP, recuperación, sesiones rotatorias y MFA TOTP;
- administración de usuarios protegida por rol y MFA;
- cifrado de contactos;
- CRUD de perfiles, intereses, fincas, publicaciones y fotos privadas;
- ofertas versionadas;
- lectura anónima;
- adjudicación única;
- idempotencia y auditoría;
- cuentas MySQL por responsabilidad, vista anónima y auditoría HMAC encadenada;
- seed territorial inicial para Casanare;
- frontend persistente para agricultor y comprador, con sesión rotatoria y recuperación;
- backup cifrado, recuperación puntual, EXPLAIN ANALYZE y carga HTTP;
- pruebas unitarias, contractuales y HTTP sobre MySQL 8.4.

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
| Evidencia operativa | docs/fase-2-operacion.md |
| Diseño conceptual | docs/fase-2-base-de-datos/README.md |

## Estado de verificación

La verificación cubre tipos, criptografía, Argon2id, JWT, TOTP con vectores RFC 6238, políticas monetarias, restricciones SQL y superficie HTTP. MySQL 8.4 ejecuta las seis migraciones, seed, CRUD, privacidad, MFA/RBAC y una carrera de 100 solicitudes de adjudicación con un solo ganador; la misma suite corre en CI. El frontend completó en navegador el ciclo finca, publicación, oferta anónima y adjudicación. El drill restauró dump y binlog con RPO observado de 0 segundos y RTO de 35,637 segundos.

## Plan de cierre de los siete frentes

Este documento diferencia código existente de evidencia de cierre. Un frente no se marca como terminado solo porque tenga tablas o servicios: debe superar su prueba operativa correspondiente.

| # | Frente | Ya existe | Falta para aceptar |
|---:|---|---|---|
| 1 | MySQL 8.4 real | Migraciones, seed, reinicio frío, ciclo E2E y CI efímero | Cerrado |
| 2 | API CRUD | Perfiles, intereses, fincas, publicaciones, fotos, ofertas, historial y paginación | Cerrado |
| 3 | Autenticación y administración | SMTP, contraseñas, sesiones, roles, TOTP y recuperaciones | Cerrado técnicamente; repetir smoke con credenciales productivas |
| 4 | Seguridad MySQL | Cuentas/GRANT, vista anónima, tablas inmutables, cadena `previous_hash` y pruebas negativas | Cerrado |
| 5 | Integración y concurrencia | Suite MySQL, privacidad, autorización, permisos técnicos, MFA, 100 adjudicaciones y carga HTTP | Cerrado |
| 6 | Frontend persistente | Cliente API, sesión, flujos agricultor/comprador, QA responsive y accesibilidad | Cerrado |
| 7 | Operación y recuperación | Health/logging, 8 EXPLAIN, métricas, backup AES-GCM, PITR y restauración medida | Cerrado |

### Orden obligatorio

1. establecer MySQL real y CI;
2. completar API y autenticación;
3. aplicar permisos e inmutabilidad en la base;
4. probar integración, privacidad y concurrencia;
5. conectar el frontend;
6. medir rendimiento y demostrar recuperación;
7. auditar todos los criterios y actualizar el estado documental.

### Definición de terminado

El cierre técnico de Fase 2 está integrado en `main`: un entorno limpio puede migrar y cargar datos, el frontend completa el ciclo comercial con persistencia, solicitudes concurrentes producen una sola adjudicación, los datos privados están aislados por permisos efectivos, MFA protege administración y un respaldo real se restaura dentro de los objetivos documentados.

Antes de desplegar se repiten estas pruebas en la infraestructura destino y se valida el proveedor SMTP real. Esas puertas pertenecen al despliegue del entorno y no se sustituyen con la evidencia local.
