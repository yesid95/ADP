# Fase 2 — operación, rendimiento y recuperación

## Estado

El cierre operativo de Fase 2 fue ejecutado el 28 de agosto de 2026 sobre MySQL 8.4.11 local. Los comandos son reproducibles; sus archivos de evidencia contienen rutas y datos del entorno y por eso se guardan bajo `backend/var/`, excluido de Git.

Esta evidencia demuestra que el código y el runbook funcionan. Cada entorno productivo debe repetir el drill con su red, almacenamiento, KMS y proveedor MySQL antes de recibir tráfico.

## Resultado medido

| Control | Resultado |
|---|---:|
| Dump completo cifrado | 202.707 bytes |
| Tiempo de backup | 0,779 s |
| Cifrado | AES-256-GCM, IV aleatorio y tag autenticado |
| Recuperación puntual | Marcador posterior recuperado desde binlog ROW |
| RPO observado | 0 s; objetivo <= 900 s |
| RTO observado | 35,637 s; objetivo <= 14.400 s |
| Tablas comparadas | 27, conteos exactos |
| Objetos restaurados | 2 triggers, 1 rutina y 1 vista |
| Aislamiento del restore | Contenedor con `network_mode: none` |
| Planes SQL revisados | 8/8 aprobados |
| Consultas lentas registradas | 0 durante la evidencia |
| Carga sostenida | 250 respuestas 200, 0 errores, concurrencia 25 |
| Rendimiento HTTP | 259,99 req/s, p95 193,137 ms, p99 209,738 ms |
| Protección de exceso | 300 respuestas permitidas y 700 respuestas 429 en 1.000 solicitudes desde una IP |

## Consultas revisadas

`npm run db:plans` ejecuta `EXPLAIN` y `EXPLAIN ANALYZE` sobre:

1. publicaciones abiertas por cultivo, municipio y fecha;
2. publicaciones de una finca;
3. ofertas activas de una publicación;
4. ofertas de un comprador;
5. versión vigente de una oferta;
6. historial cronológico de una publicación;
7. sesiones activas de un usuario;
8. auditoría por entidad y periodo.

La prueba falla si no aparece el índice esperado como seleccionado o posible, o si el optimizador estima un table scan mayor a 1.000 filas. En el cierre no apareció ese riesgo. Los índices efectivamente elegidos incluyeron:

- `harvest_listings_status_deadline_idx`;
- `harvest_listings_farm_created_idx`;
- `bids_listing_status_idx`;
- `bids_buyer_status_idx`;
- `PRIMARY` de `bid_versions`;
- `listing_status_events_timeline_idx`;
- `auth_sessions_user_active_idx`;
- `audit_events_entity_idx`.

## Ejecutar la evidencia de rendimiento

Desde `backend/`, con MySQL y API activos:

```bash
npm run db:plans
npm run test:load
```

La carga por defecto se mantiene en 250 solicitudes porque el límite de seguridad es 300 por IP y minuto. Para una prueba de capacidad superior se debe usar un entorno dedicado con múltiples IP de origen y parámetros explícitos:

```bash
LOAD_REQUESTS=10000 LOAD_CONCURRENCY=100 LOAD_BASE_URL=https://api.example.com npm run test:load
```

No elevar o desactivar el rate limit del entorno real solo para obtener una cifra de benchmark.

## Ejecutar el drill de recuperación

### Requisitos

- Docker y Compose;
- MySQL principal activo mediante `compose.yaml`;
- migraciones, seed y `apply-grants.sh` aplicados;
- clave Base64 independiente que decodifique 32 bytes;
- espacio suficiente para dump, binlog y contenedor efímero.

### Comando

```powershell
$keyBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($keyBytes)
$env:BACKUP_ENCRYPTION_KEY_BASE64 = [Convert]::ToBase64String($keyBytes)
npm run db:recovery:drill
```

En Linux o macOS, cargar la clave desde el gestor de secretos:

```bash
export BACKUP_ENCRYPTION_KEY_BASE64='valor-entregado-por-el-gestor-de-secretos'
npm run db:recovery:drill
```

### Qué hace

1. construye `mysql-tools` con el cliente MySQL 8.4 de Oracle Linux;
2. crea un dump consistente con `mysqldump --single-transaction --source-data=2`;
3. cifra el stream con AES-256-GCM y calcula SHA-256 del archivo cifrado;
4. inserta un marcador temporal después del dump;
5. extrae el intervalo exacto del binlog con `mysqlbinlog`;
6. cifra el binlog y registra sus posiciones;
7. inicia un MySQL 8.4 efímero sin red;
8. restaura el dump y reproduce el binlog hasta la posición objetivo;
9. verifica marcador, conteos por tabla, triggers, rutina y vista;
10. elimina el marcador de la fuente y destruye solo el contenedor efímero creado por el drill.

La recuperación puntual sigue el modelo oficial de MySQL: restaurar primero un backup completo y luego aplicar eventos binlog hasta la posición deseada. Referencias: [Point-in-Time Recovery](https://dev.mysql.com/doc/refman/8.4/en/point-in-time-recovery.html) y [mysqlbinlog](https://dev.mysql.com/doc/refman/8.4/en/mysqlbinlog.html).

## Privilegios de backup

`adp_backup` conserva `SELECT`, `SHOW VIEW`, `TRIGGER`, `EVENT` y `LOCK TABLES` sobre `adp.*`. Globalmente recibe solo lo requerido por las utilidades de backup:

- `RELOAD` para la coordenada consistente de `--source-data`;
- `REPLICATION CLIENT` para consultar estado y posiciones del binlog;
- `SHOW_ROUTINE` para respaldar la definición de rutinas sin otorgar administración general.

No tiene `INSERT`, `UPDATE`, `DELETE`, `CREATE USER`, `GRANT OPTION` ni acceso runtime a contactos mediante la cuenta de mercado.

## Objetivos productivos

| Métrica | Objetivo | Control requerido |
|---|---:|---|
| RPO | <= 15 minutos | binlog copiado de forma continua a otra cuenta o ubicación |
| RTO | <= 4 horas | restore automatizado, imagen preconstruida y runbook ensayado |
| Backup completo | diario | job programado con alerta de antigüedad |
| Retención diaria | 35 días | lifecycle inmutable y cifrado |
| Retención mensual | 12 meses | validar política legal antes de habilitar |
| Prueba de restauración | trimestral | además, antes de cambios de alto riesgo |

El RPO productivo no se obtiene solo por activar binlog. Se necesita archivado continuo fuera de la instancia, alarma si se interrumpe y verificación periódica de que el tramo puede reproducirse.

## Señales y alertas

La API ya expone `health/live`, `health/ready`, request ID y logs JSON redactados con latencia. La evidencia de planes añade:

- `Threads_connected` y `Threads_running`;
- `Connections` y `Aborted_connects`;
- `Slow_queries`;
- bytes de datos e índices;
- versión exacta de MySQL.

En producción crear alertas por:

- readiness fallido durante dos intervalos;
- crecimiento de 5xx, 429 o p95;
- uso de conexiones sobre 80 % del pool o máximo MySQL;
- disco sobre 75 % y proyección de agotamiento;
- incremento de `Slow_queries`;
- lag de réplica, si existe;
- último backup o binlog archivado más antiguo que el RPO;
- fallo de checksum, descifrado o drill trimestral.

## Criterio de despliegue

No dirigir tráfico hasta que el entorno destino supere, en este orden:

1. migración y seed en una base limpia;
2. hardening de cuentas y pruebas negativas;
3. suite de integración;
4. `db:plans`;
5. carga acorde con su topología y rate limit;
6. backup y restore aislado con la clave del KMS;
7. readiness y alertas;
8. smoke SMTP/TLS con el remitente productivo autorizado.
