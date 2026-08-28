# Plan de implementación de la base de datos

## Objetivo

Construir y verificar el esquema documentado sin mezclar todavía interfaz, tiempo real, IA, reputación ni pagos.

La implementación se divide en bloques pequeños para que cada migración sea revisable y reversible.

## Dependencias

~~~mermaid
flowchart LR
    A[1. MySQL seguro] --> B[2. Prisma y convenciones]
    B --> C[3. Identidad y sesiones]
    B --> D[4. Catálogos territoriales]
    C --> E[5. Perfiles y fincas]
    D --> E
    E --> F[6. Publicaciones y fotos]
    C --> G[7. Compradores e intereses]
    F --> H[8. Ofertas versionadas]
    G --> H
    H --> I[9. Adjudicación e idempotencia]
    I --> J[10. Auditoría y permisos]
    J --> K[11. Pruebas de restauración y seguridad]
~~~

## Bloque 1. MySQL seguro

### Trabajo

- Fijar MySQL 8.4 LTS e InnoDB.
- Configurar utf8mb4 y modo estricto.
- Usar UTC en servidor, conexiones y aplicación.
- Restringir el puerto 3306 a la red privada.
- Activar TLS obligatorio.
- Desactivar local_infile.
- Crear entornos separados.
- Definir respaldo completo y binary log.

### Evidencia

- Consulta de versión y variables.
- Conexión sin TLS rechazada.
- Puerto inaccesible desde un origen no permitido.
- Primer backup restaurado en entorno aislado.

## Bloque 2. Prisma y convenciones

### Trabajo

- Agregar Prisma al backend de Fase 2.
- Crear schema.prisma con proveedor mysql.
- Usar relationMode = foreignKeys.
- Definir nombres de modelos y mapeos snake_case.
- Crear cliente de migración separado del cliente runtime.
- Configurar variables de conexión por secreto.

### Evidencia

- prisma validate exitoso.
- prisma format sin cambios pendientes.
- Migración inicial reproducible desde una base vacía.
- Ninguna credencial real versionada.

## Bloque 3. Identidad y autenticación

### Tablas

- users;
- user_private_contacts;
- password_credentials;
- user_roles;
- auth_sessions;
- auth_tokens;
- mfa_factors;
- mfa_recovery_codes.

### Pruebas

- correo normalizado duplicado es rechazado por lookup_hash;
- correo cifrado no aparece en un dump;
- hash Argon2id se verifica y una contraseña incorrecta falla;
- token usado no puede reutilizarse;
- refresh token rotado revoca la familia si vuelve a aparecer;
- un administrador sin MFA no puede completar acciones administrativas.

## Bloque 4. Catálogos territoriales

### Tablas

- departments;
- municipalities;
- crop_varieties.

### Trabajo

- Cargar códigos DANE desde una fuente versionada.
- Cargar PLATANO_HARTON como variedad inicial.
- Evitar nombres territoriales duplicados sin código.
- Documentar fecha y fuente del catálogo.

### Pruebas

- municipio sin departamento es rechazado;
- código DANE repetido es rechazado;
- una variedad inactiva no puede usarse para nuevas publicaciones.

## Bloque 5. Perfiles y fincas

### Tablas

- farmer_profiles;
- buyer_profiles;
- farms;
- buyer_crop_interests;
- buyer_municipality_interests.

### Pruebas

- usuario sin rol FARMER no crea finca;
- usuario sin rol BUYER no crea intereses;
- owner_user_id inexistente es rechazado;
- municipio inexistente es rechazado;
- hectáreas negativas son rechazadas;
- la API nunca retorna contacto privado junto al perfil público.

## Bloque 6. Publicaciones y fotografías

### Tablas

- harvest_listings;
- harvest_photos.

### Pruebas

- cantidad cero o negativa es rechazada;
- precio esperado negativo es rechazado;
- publicación OPEN sin published_at es rechazada;
- fecha límite anterior a publicación es rechazada;
- no se elimina una publicación con actividad;
- orden de fotografías no se duplica;
- contenido fotográfico repetido se detecta por sha256;
- storage_key no es una URL pública.

## Bloque 7. Ofertas versionadas

### Tablas

- bids;
- bid_versions;
- bid_status_events.

### Pruebas

- un comprador solo tiene una oferta por publicación;
- dos compradores reciben etiquetas distintas dentro de la publicación;
- la etiqueta no identifica al comprador fuera de esa publicación;
- precio y cantidad negativos son rechazados;
- costo logístico es cero cuando el transporte está incluido;
- anticipo no supera el valor bruto;
- compra parcial respeta la configuración de la publicación;
- una nueva revisión crea versión 2 y no sobrescribe versión 1;
- UPDATE y DELETE de bid_versions son denegados al runtime.

## Bloque 8. Adjudicación e idempotencia

### Tablas

- listing_awards;
- listing_status_events;
- idempotency_records.

### Trabajo

- Implementar aceptación dentro de una transacción.
- Bloquear publicación y oferta con SELECT FOR UPDATE.
- Referenciar la versión vigente exacta.
- Cambiar estados e insertar historiales de forma atómica.
- Implementar reintento limitado para deadlocks o P2034.

### Pruebas

- oferta de otra publicación no puede adjudicarse;
- actor no propietario no adjudica;
- publicación vencida no adjudica;
- la misma clave de idempotencia retorna el mismo resultado;
- la misma clave con otra petición es rechazada;
- cien solicitudes concurrentes producen exactamente una adjudicación;
- la versión ganadora permanece consultable sin cambios.

## Bloque 9. Anonimato y revelación

### Trabajo

- Crear consulta o vista v_farmer_bid_comparison sin buyer_user_id.
- Denegar a adp_market acceso a user_private_contacts.
- Crear un servicio interno de revelación que exige adjudicación y propiedad.
- Registrar buyer_identity_revealed_at en el primer acceso autorizado.

### Pruebas

- respuestas de comparación no contienen ID, nombre, empresa, correo ni teléfono;
- serialización accidental del modelo completo falla una prueba de contrato;
- contacto antes de adjudicar es denegado;
- contacto de otra finca es denegado;
- contacto del ganador propio es permitido;
- cada lectura permitida o denegada genera auditoría.

## Bloque 10. Auditoría y permisos

### Tabla

- audit_events.

### Trabajo

- Crear las cuentas técnicas.
- Aplicar GRANT por tabla y operación.
- Implementar metadata por lista blanca.
- Encadenar event_hash con previous_hash.
- Exportar auditoría a almacenamiento inmutable cuando exista.

### Pruebas

- adp_market no lee tablas privadas;
- adp_auth no modifica ofertas;
- adp_audit_writer no actualiza ni elimina eventos;
- los eventos no contienen secretos;
- una alteración manual rompe la verificación de la cadena;
- una migración queda registrada.

## Bloque 11. Rendimiento y operación

### Consultas a medir

- publicaciones OPEN por variedad, municipio y fecha;
- publicaciones de una finca;
- ofertas activas de una publicación;
- ofertas de un comprador;
- versión vigente de una oferta;
- historial cronológico;
- sesiones activas de un usuario;
- eventos de auditoría por entidad y periodo.

### Criterio

- Revisar EXPLAIN de cada consulta principal.
- Evitar table scans sobre tablas de crecimiento continuo.
- No agregar índices sin una consulta que los justifique.
- Medir costo de índices en escrituras.
- Crear alertas por conexiones, espacio, replicación, errores y consultas lentas.

## Migraciones sugeridas

Los nombres definitivos llevarán la marca de tiempo generada por Prisma.

| Orden | Nombre lógico | Contenido |
|---:|---|---|
| 1 | init_identity | usuarios, contactos, credenciales y roles |
| 2 | add_auth_sessions | sesiones, tokens y MFA |
| 3 | add_geography_catalogs | departamentos, municipios y cultivos |
| 4 | add_profiles_and_farms | perfiles, fincas e intereses |
| 5 | add_harvest_listings | publicaciones y fotografías |
| 6 | add_versioned_bids | ofertas, versiones e historial |
| 7 | add_listing_awards | adjudicación y FKs compuestas |
| 8 | add_idempotency | protección de comandos |
| 9 | add_audit_events | auditoría append-only |
| 10 | harden_permissions | vistas, permisos y SQL complementario |

## Estrategia de cambios sin pérdida

~~~mermaid
flowchart LR
    E[Expandir: agregar estructura compatible] --> M[Migrar datos por lotes]
    M --> S[Cambiar lectura y escritura]
    S --> V[Verificar métricas e integridad]
    V --> C[Contraer: retirar estructura antigua]
~~~

Para renombrar o cambiar el tipo de una columna usada:

1. agregar la columna nueva;
2. escribir temporalmente en ambas;
3. migrar datos históricos;
4. comparar conteos y hashes;
5. cambiar lecturas;
6. dejar pasar al menos un despliegue estable;
7. retirar la columna antigua en otra migración.

## Matriz mínima de pruebas

| Categoría | Pruebas |
|---|---:|
| Llaves foráneas | Cada FK acepta padre válido y rechaza huérfano |
| CHECK | Cada límite tiene caso válido, borde e inválido |
| UNIQUE | Duplicados secuenciales y concurrentes |
| Estados | Todas las transiciones permitidas y prohibidas |
| Autorización | Actor correcto, actor ajeno y rol incorrecto |
| Concurrencia | Oferta revisada y adjudicación simultánea |
| Cifrado | Round-trip, clave incorrecta y rotación |
| Sesiones | Expiración, rotación, revocación y reutilización |
| Auditoría | Escritura, inmutabilidad, sanitización y cadena |
| Backup | Restauración completa y a punto en el tiempo |
| Rendimiento | EXPLAIN y prueba con volumen representativo |

## Volumen de prueba recomendado

Antes de cerrar Fase 2:

- 10.000 usuarios;
- 3 roles por usuario como caso límite;
- 5.000 fincas;
- 50.000 publicaciones;
- 20 fotografías por publicación como límite;
- 500.000 ofertas;
- 5 versiones por oferta como límite operativo;
- 5.000.000 eventos de auditoría.

No es una estimación comercial. Es un conjunto sintético para encontrar índices faltantes, problemas de paginación y consultas que crecen de forma no controlada.

## Documentación que acompaña cada migración

- propósito;
- tablas y columnas afectadas;
- impacto sobre datos existentes;
- tiempo estimado;
- bloqueo esperado;
- estrategia de reversión o migración hacia adelante;
- consultas de verificación;
- permisos nuevos o modificados.

## Criterio de salida de la Fase 2 de datos

**Estado integrado de Fase 2:** el esquema, migraciones, relaciones, restricciones, permisos, concurrencia, rendimiento y restauración están versionados y verificados sobre MySQL 8.4.11. El seguimiento general está en `../fase-2-backend.md` y la evidencia operativa en `../fase-2-operacion.md`.

- [x] Diagrama y diccionario coinciden con schema.prisma.
- [x] Todas las relaciones se crean como FOREIGN KEY reales.
- [x] Todas las reglas por fila tienen CHECK.
- [x] Las reglas de unicidad tienen índices UNIQUE.
- [x] La aceptación concurrente produce un ganador.
- [x] Las versiones de ofertas son inmutables.
- [x] La cuenta del mercado no puede leer contactos.
- [x] Contraseñas, tokens y contactos tienen el tratamiento definido.
- [x] Auditoría es append-only y no contiene secretos.
- [x] Las migraciones funcionan desde una base vacía.
- [x] La actualización desde la versión anterior está probada.
- [x] Las consultas principales cuentan con EXPLAIN revisado.
- [x] Backup completo y recuperación puntual fueron restaurados.
- [x] RPO de 15 minutos y RTO de 4 horas fueron medidos.
- [x] La documentación y las pruebas están versionadas con el código.

La base de datos no está terminada cuando las tablas existen; está terminada cuando sus restricciones, permisos, concurrencia, restauración y documentación han sido verificadas.
