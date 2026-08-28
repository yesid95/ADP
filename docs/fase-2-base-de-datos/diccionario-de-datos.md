# Diccionario de datos

## Reglas globales

### Tipos estándar

| Uso | Tipo MySQL | Regla |
|---|---|---|
| UUID | CHAR(36) CHARACTER SET ascii COLLATE ascii_bin | Generado en la aplicación |
| Fecha de negocio | DATE | No contiene zona horaria |
| Instante | DATETIME(3) | Siempre UTC |
| Dinero | DECIMAL(18,2) | Nunca FLOAT o DOUBLE |
| Cantidad en kg | DECIMAL(12,3) | Valor canónico del sistema |
| Porcentaje | DECIMAL(5,2) | Entre 0 y 100 |
| Booleano | BOOLEAN | Prisma lo representa como Boolean |
| Hash SHA-256/HMAC | BINARY(32) | No se guarda como hexadecimal |
| Texto corto | VARCHAR con límite explícito | Sin VARCHAR sin longitud |
| Texto libre | TEXT | Nunca para estados o identificadores |
| Metadatos variables | JSON | Solo auditoría controlada |

### Columnas comunes

Cuando aplique, las entidades de negocio tendrán:

| Columna | Tipo | Nulo | Uso |
|---|---|---:|---|
| created_at | DATETIME(3) | No | Creación en UTC |
| updated_at | DATETIME(3) | No | Última actualización |
| deleted_at | DATETIME(3) | Sí | Borrado lógico |
| version | INT UNSIGNED | No | Bloqueo optimista |

### Reglas de nulabilidad

- NULL significa que el dato todavía no existe o no aplica.
- Una cadena vacía no reemplaza a NULL.
- Los campos obligatorios no se rellenan con valores como N/A, desconocido o 0.
- Un estado nunca es NULL.
- Los campos cifrados y sus hashes asociados se crean o eliminan juntos.

## A. Identidad y autenticación

### users

Identidad pública mínima compartida por los demás módulos.

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | CHAR(36) ASCII | No | PK |
| display_name | VARCHAR(120) | No | Nombre público, entre 2 y 120 caracteres |
| status | VARCHAR(20) | No | CHECK: PENDING, ACTIVE, SUSPENDED, DELETED |
| created_at | DATETIME(3) | No | DEFAULT CURRENT_TIMESTAMP(3) |
| updated_at | DATETIME(3) | No | Gestionado por Prisma |
| deleted_at | DATETIME(3) | Sí | Obligatorio cuando status = DELETED |
| version | INT UNSIGNED | No | DEFAULT 1, mayor que 0 |

Índices:

- PK id.
- INDEX users_status_idx (status).

### user_private_contacts

Datos de contacto cifrados. No accesible para la cuenta normal del mercado.

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| user_id | CHAR(36) ASCII | No | PK, FK → users.id, ON DELETE RESTRICT |
| email_ciphertext | VARBINARY(512) | No | AES-256-GCM en la aplicación |
| email_lookup_hash | BINARY(32) | No | UNIQUE, HMAC del correo normalizado |
| phone_ciphertext | VARBINARY(512) | Sí | Cifrado autenticado |
| phone_lookup_hash | BINARY(32) | Sí | UNIQUE, HMAC del teléfono E.164 |
| key_version | SMALLINT UNSIGNED | No | Identifica la clave usada |
| email_verified_at | DATETIME(3) | Sí | UTC |
| phone_verified_at | DATETIME(3) | Sí | UTC |
| created_at | DATETIME(3) | No | UTC |
| updated_at | DATETIME(3) | No | UTC |

Restricciones:

- phone_ciphertext y phone_lookup_hash son ambos NULL o ambos no NULL.
- La clave de cifrado nunca se almacena en esta tabla.

### password_credentials

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| user_id | CHAR(36) ASCII | No | PK, FK → users.id, ON DELETE RESTRICT |
| password_hash | VARCHAR(255) | No | Hash Argon2id completo |
| password_changed_at | DATETIME(3) | No | UTC |
| failed_login_count | SMALLINT UNSIGNED | No | DEFAULT 0 |
| locked_until | DATETIME(3) | Sí | Bloqueo temporal |
| created_at | DATETIME(3) | No | UTC |
| updated_at | DATETIME(3) | No | UTC |

El hash Argon2id contiene algoritmo, parámetros, salt y resultado. No se crean columnas separadas para el salt.

### user_roles

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| user_id | CHAR(36) ASCII | No | PK parcial, FK → users.id |
| role_code | VARCHAR(20) | No | PK parcial; CHECK: FARMER, BUYER, ADMIN |
| assigned_by_user_id | CHAR(36) ASCII | Sí | FK → users.id, ON DELETE SET NULL |
| assigned_at | DATETIME(3) | No | UTC |

Clave primaria: (user_id, role_code).

Índice adicional: user_roles_role_idx (role_code, user_id).

### auth_sessions

Cada fila representa una familia de refresh token rotatorio.

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | CHAR(36) ASCII | No | PK |
| user_id | CHAR(36) ASCII | No | FK → users.id, ON DELETE CASCADE |
| refresh_token_hash | BINARY(32) | No | UNIQUE |
| expires_at | DATETIME(3) | No | Debe ser posterior a created_at |
| last_used_at | DATETIME(3) | Sí | Última rotación o uso |
| revoked_at | DATETIME(3) | Sí | Revocación manual o por reutilización |
| rotated_from_session_id | CHAR(36) ASCII | Sí | FK autorreferente, ON DELETE SET NULL |
| ip_prefix_hash | BINARY(32) | Sí | Dato seudonimizado |
| user_agent_hash | BINARY(32) | Sí | Dato seudonimizado |
| created_at | DATETIME(3) | No | UTC |

Índices:

- UNIQUE refresh_token_hash.
- INDEX auth_sessions_user_active_idx (user_id, revoked_at, expires_at).
- INDEX auth_sessions_expiry_idx (expires_at).

### auth_tokens

Tokens de un solo uso para verificación y recuperación.

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | CHAR(36) ASCII | No | PK |
| user_id | CHAR(36) ASCII | No | FK → users.id, ON DELETE CASCADE |
| purpose | VARCHAR(30) | No | CHECK: VERIFY_EMAIL, VERIFY_PHONE, RESET_PASSWORD |
| token_hash | BINARY(32) | No | UNIQUE |
| expires_at | DATETIME(3) | No | Posterior a created_at |
| used_at | DATETIME(3) | Sí | Uso único |
| created_at | DATETIME(3) | No | UTC |

Índice: auth_tokens_user_purpose_idx (user_id, purpose, used_at, expires_at).

### mfa_factors

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | CHAR(36) ASCII | No | PK |
| user_id | CHAR(36) ASCII | No | FK → users.id, ON DELETE CASCADE |
| factor_type | VARCHAR(20) | No | CHECK: TOTP |
| secret_ciphertext | VARBINARY(512) | No | Cifrado autenticado |
| key_version | SMALLINT UNSIGNED | No | Versión de la clave |
| enabled_at | DATETIME(3) | No | UTC |
| last_used_step | BIGINT UNSIGNED | Sí | Impide reutilización del mismo código TOTP |
| revoked_at | DATETIME(3) | Sí | UTC |
| created_at | DATETIME(3) | No | UTC |

Índice: mfa_factors_user_active_idx (user_id, revoked_at).

### mfa_recovery_codes

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | CHAR(36) ASCII | No | PK |
| factor_id | CHAR(36) ASCII | No | FK → mfa_factors.id, ON DELETE CASCADE |
| code_hash | BINARY(32) | No | UNIQUE |
| used_at | DATETIME(3) | Sí | Uso único |
| created_at | DATETIME(3) | No | UTC |

## B. Territorio, perfiles y fincas

### departments

Catálogo cargado por migración o seed controlado.

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | SMALLINT UNSIGNED | No | PK |
| dane_code | CHAR(2) ASCII | No | UNIQUE |
| name | VARCHAR(100) | No | Nombre oficial |

### municipalities

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | SMALLINT UNSIGNED | No | PK |
| department_id | SMALLINT UNSIGNED | No | FK → departments.id, ON DELETE RESTRICT |
| dane_code | CHAR(5) ASCII | No | UNIQUE |
| name | VARCHAR(120) | No | Nombre oficial |

Índice: municipalities_department_name_idx (department_id, name).

### farmer_profiles

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| user_id | CHAR(36) ASCII | No | PK, FK → users.id, ON DELETE RESTRICT |
| public_bio | TEXT | Sí | Máximo lógico de 2.000 caracteres |
| verification_status | VARCHAR(20) | No | CHECK: UNVERIFIED, PENDING, VERIFIED, REJECTED |
| created_at | DATETIME(3) | No | UTC |
| updated_at | DATETIME(3) | No | UTC |

### buyer_profiles

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| user_id | CHAR(36) ASCII | No | PK, FK → users.id, ON DELETE RESTRICT |
| business_name | VARCHAR(160) | Sí | Empresa o nombre comercial |
| buyer_type | VARCHAR(30) | No | CHECK: WHOLESALER, DISTRIBUTOR, STORE, RESTAURANT, TRANSPORTER |
| description | TEXT | Sí | Máximo lógico de 2.000 caracteres |
| verification_status | VARCHAR(20) | No | CHECK: UNVERIFIED, PENDING, VERIFIED, REJECTED |
| created_at | DATETIME(3) | No | UTC |
| updated_at | DATETIME(3) | No | UTC |

Índice: buyer_profiles_type_status_idx (buyer_type, verification_status).

### farms

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | CHAR(36) ASCII | No | PK |
| owner_user_id | CHAR(36) ASCII | No | FK → users.id, ON DELETE RESTRICT |
| municipality_id | SMALLINT UNSIGNED | No | FK → municipalities.id, ON DELETE RESTRICT |
| name | VARCHAR(160) | No | Entre 2 y 160 caracteres |
| vereda | VARCHAR(120) | No | Texto normalizado |
| public_location_text | VARCHAR(200) | No | Referencia aproximada |
| description | TEXT | Sí | Máximo lógico de 2.000 caracteres |
| road_access_notes | VARCHAR(500) | Sí | Sin instrucciones privadas exactas |
| productive_hectares | DECIMAL(10,2) | Sí | CHECK mayor que 0 |
| status | VARCHAR(20) | No | CHECK: DRAFT, ACTIVE, SUSPENDED, ARCHIVED |
| created_at | DATETIME(3) | No | UTC |
| updated_at | DATETIME(3) | No | UTC |
| deleted_at | DATETIME(3) | Sí | Borrado lógico |
| version | INT UNSIGNED | No | DEFAULT 1 |

Índices:

- farms_owner_status_idx (owner_user_id, status).
- farms_municipality_status_idx (municipality_id, status).

Regla externa a CHECK: owner_user_id debe poseer el rol FARMER.

### crop_varieties

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | SMALLINT UNSIGNED | No | PK |
| code | VARCHAR(40) ASCII | No | UNIQUE |
| name | VARCHAR(100) | No | Nombre visible |
| is_active | BOOLEAN | No | DEFAULT TRUE |
| created_at | DATETIME(3) | No | UTC |

Semilla mínima: PLATANO_HARTON.

### buyer_crop_interests

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| buyer_user_id | CHAR(36) ASCII | No | PK parcial, FK → users.id |
| crop_variety_id | SMALLINT UNSIGNED | No | PK parcial, FK → crop_varieties.id |
| minimum_quantity_kg | DECIMAL(12,3) | Sí | Mayor que 0 |
| maximum_quantity_kg | DECIMAL(12,3) | Sí | Mayor o igual al mínimo |
| created_at | DATETIME(3) | No | UTC |
| updated_at | DATETIME(3) | No | UTC |

Clave primaria: (buyer_user_id, crop_variety_id).

### buyer_municipality_interests

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| buyer_user_id | CHAR(36) ASCII | No | PK parcial, FK → users.id |
| municipality_id | SMALLINT UNSIGNED | No | PK parcial, FK → municipalities.id |
| created_at | DATETIME(3) | No | UTC |

Clave primaria: (buyer_user_id, municipality_id).

## C. Publicaciones y fotografías

### harvest_listings

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | CHAR(36) ASCII | No | PK |
| farm_id | CHAR(36) ASCII | No | FK → farms.id, ON DELETE RESTRICT |
| crop_variety_id | SMALLINT UNSIGNED | No | FK → crop_varieties.id, ON DELETE RESTRICT |
| estimated_quantity_kg | DECIMAL(12,3) | No | CHECK mayor que 0 |
| available_from_date | DATE | No | Fecha agrícola |
| crop_condition_notes | VARCHAR(500) | Sí | Descripción observable |
| road_access_snapshot | VARCHAR(500) | Sí | Copia de condiciones al publicar |
| expected_price_cop_per_kg | DECIMAL(18,2) | Sí | CHECK mayor que 0 |
| allows_partial_purchase | BOOLEAN | No | DEFAULT FALSE |
| bid_deadline_at | DATETIME(3) | No | UTC |
| status | VARCHAR(20) | No | CHECK: DRAFT, OPEN, CLOSED, AWARDED, CANCELLED |
| published_at | DATETIME(3) | Sí | Obligatorio al pasar a OPEN |
| closed_at | DATETIME(3) | Sí | Obligatorio para estados terminales |
| created_at | DATETIME(3) | No | UTC |
| updated_at | DATETIME(3) | No | UTC |
| deleted_at | DATETIME(3) | Sí | Solo borrado lógico |
| version | INT UNSIGNED | No | DEFAULT 1 |

Restricciones:

- published_at es NULL cuando el estado es DRAFT.
- En OPEN, published_at no es NULL y bid_deadline_at es posterior.
- AWARDED requiere una fila en listing_awards; esta regla se valida dentro de la transacción.
- No se permite borrar físicamente una publicación con ofertas.

Índices:

- harvest_listings_status_deadline_idx (status, bid_deadline_at).
- harvest_listings_farm_created_idx (farm_id, created_at).
- harvest_listings_search_idx (crop_variety_id, status, available_from_date).

### harvest_photos

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | CHAR(36) ASCII | No | PK |
| listing_id | CHAR(36) ASCII | No | FK → harvest_listings.id |
| storage_key | VARCHAR(512) ASCII | No | Ruta interna, no URL pública |
| mime_type | VARCHAR(50) ASCII | No | CHECK: image/jpeg, image/png, image/webp |
| size_bytes | INT UNSIGNED | No | Mayor que 0 y máximo definido por configuración |
| sha256 | BINARY(32) | No | Integridad y deduplicación |
| sort_order | SMALLINT UNSIGNED | No | Orden de presentación |
| created_at | DATETIME(3) | No | UTC |

Índices:

- UNIQUE harvest_photos_order_uq (listing_id, sort_order).
- UNIQUE harvest_photos_content_uq (listing_id, sha256).

El archivo debe validarse por firma real, tamaño y análisis de malware antes de crear la fila definitiva.

## D. Ofertas y adjudicación

### bids

Identidad estable de una oferta. Las condiciones económicas viven en bid_versions.

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | CHAR(36) ASCII | No | PK |
| listing_id | CHAR(36) ASCII | No | FK → harvest_listings.id, ON DELETE RESTRICT |
| buyer_user_id | CHAR(36) ASCII | No | FK → users.id, ON DELETE RESTRICT |
| anonymous_label | VARCHAR(16) ASCII | No | Ejemplo: A, B, C |
| status | VARCHAR(20) | No | CHECK: SUBMITTED, WITHDRAWN, ACCEPTED, REJECTED, EXPIRED |
| current_version_no | SMALLINT UNSIGNED | No | Mayor que 0 |
| submitted_at | DATETIME(3) | No | UTC |
| withdrawn_at | DATETIME(3) | Sí | Solo para WITHDRAWN |
| created_at | DATETIME(3) | No | UTC |
| updated_at | DATETIME(3) | No | UTC |
| version | INT UNSIGNED | No | Bloqueo optimista |

Índices y unicidad:

- UNIQUE bids_listing_buyer_uq (listing_id, buyer_user_id).
- UNIQUE bids_listing_label_uq (listing_id, anonymous_label).
- UNIQUE bids_listing_id_uq (listing_id, id), requerido por la FK compuesta de adjudicación.
- INDEX bids_listing_status_idx (listing_id, status, submitted_at).
- INDEX bids_buyer_status_idx (buyer_user_id, status, submitted_at).

Reglas transaccionales:

- El comprador debe tener rol BUYER y estar activo.
- La publicación debe estar OPEN y no vencida.
- El comprador no puede ser propietario de la finca.
- current_version_no debe existir en bid_versions.

### bid_versions

Condiciones inmutables de una oferta.

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| bid_id | CHAR(36) ASCII | No | PK parcial, FK → bids.id, ON DELETE RESTRICT |
| version_no | SMALLINT UNSIGNED | No | PK parcial, empieza en 1 |
| unit_price_cop_per_kg | DECIMAL(18,2) | No | CHECK mayor que 0 |
| offered_quantity_kg | DECIMAL(12,3) | No | CHECK mayor que 0 |
| transport_included | BOOLEAN | No | DEFAULT FALSE |
| pickup_at_farm | BOOLEAN | No | DEFAULT FALSE |
| seller_logistics_cost_cop | DECIMAL(18,2) | No | DEFAULT 0, no negativo |
| advance_amount_cop | DECIMAL(18,2) | No | DEFAULT 0, no negativo |
| payment_term_days | SMALLINT UNSIGNED | No | Entre 0 y 365 |
| continuity_months | SMALLINT UNSIGNED | Sí | Entre 1 y 120 |
| continuity_notes | VARCHAR(500) | Sí | Requerido si continuity_months no es NULL |
| observations | TEXT | Sí | Máximo lógico de 2.000 caracteres |
| created_at | DATETIME(3) | No | UTC |

Clave primaria: (bid_id, version_no).

Restricciones:

- advance_amount_cop no supera unit_price_cop_per_kg × offered_quantity_kg.
- Si transport_included es TRUE, seller_logistics_cost_cop debe ser 0.
- Si la publicación no acepta compra parcial, la cantidad ofrecida debe cubrir la cantidad publicada.
- La cantidad ofrecida no puede superar la cantidad disponible.
- Las dos últimas reglas requieren leer la publicación y se aplican en la misma transacción que inserta la versión.
- No existe UPDATE ni DELETE de versiones mediante la cuenta de aplicación.

### listing_awards

Una fila congela el resultado comercial de una publicación.

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| listing_id | CHAR(36) ASCII | No | PK, FK → harvest_listings.id |
| bid_id | CHAR(36) ASCII | No | UNIQUE |
| bid_version_no | SMALLINT UNSIGNED | No | Versión exacta aceptada |
| accepted_by_user_id | CHAR(36) ASCII | No | FK → users.id |
| accepted_at | DATETIME(3) | No | UTC |
| buyer_identity_revealed_at | DATETIME(3) | Sí | Primer acceso autorizado al contacto |
| whatsapp_opened_at | DATETIME(3) | Sí | Intento de cierre |
| created_at | DATETIME(3) | No | UTC |

Llaves compuestas:

- FK (listing_id, bid_id) → bids(listing_id, id).
- FK (bid_id, bid_version_no) → bid_versions(bid_id, version_no).

La PK listing_id garantiza una sola adjudicación por publicación. El backend no debe confiar únicamente en un conteo previo.

## E. Historial, idempotencia y auditoría

### listing_status_events

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | BIGINT UNSIGNED | No | PK AUTO_INCREMENT |
| listing_id | CHAR(36) ASCII | No | FK → harvest_listings.id |
| from_status | VARCHAR(20) | Sí | NULL solo para creación |
| to_status | VARCHAR(20) | No | Estado nuevo |
| changed_by_user_id | CHAR(36) ASCII | Sí | FK → users.id, ON DELETE SET NULL |
| reason_code | VARCHAR(50) ASCII | Sí | Razón normalizada |
| created_at | DATETIME(3) | No | UTC |

Índice: listing_status_events_timeline_idx (listing_id, created_at, id).

### bid_status_events

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | BIGINT UNSIGNED | No | PK AUTO_INCREMENT |
| bid_id | CHAR(36) ASCII | No | FK → bids.id |
| from_status | VARCHAR(20) | Sí | NULL solo para creación |
| to_status | VARCHAR(20) | No | Estado nuevo |
| changed_by_user_id | CHAR(36) ASCII | Sí | FK → users.id, ON DELETE SET NULL |
| reason_code | VARCHAR(50) ASCII | Sí | Razón normalizada |
| created_at | DATETIME(3) | No | UTC |

Índice: bid_status_events_timeline_idx (bid_id, created_at, id).

### idempotency_records

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | CHAR(36) ASCII | No | PK |
| user_id | CHAR(36) ASCII | No | FK → users.id, ON DELETE RESTRICT |
| operation_code | VARCHAR(50) ASCII | No | SUBMIT_BID, ACCEPT_BID u otra operación sensible |
| idempotency_key_hash | BINARY(32) | No | No guarda la clave recibida |
| request_hash | BINARY(32) | No | Detecta reutilización con otro contenido |
| resource_type | VARCHAR(40) ASCII | Sí | Tipo creado |
| resource_id | CHAR(36) ASCII | Sí | Identificador creado |
| response_code | SMALLINT UNSIGNED | Sí | Resultado reutilizable |
| expires_at | DATETIME(3) | No | UTC |
| created_at | DATETIME(3) | No | UTC |

Índices:

- UNIQUE idempotency_operation_key_uq (user_id, operation_code, idempotency_key_hash).
- INDEX idempotency_expiry_idx (expires_at).

### audit_events

Registro técnico append-only. No contiene cuerpos completos de solicitudes.

| Columna | Tipo | Nulo | Clave / regla |
|---|---|---:|---|
| id | BIGINT UNSIGNED | No | PK AUTO_INCREMENT |
| occurred_at | DATETIME(3) | No | UTC |
| actor_user_id | CHAR(36) ASCII | Sí | FK → users.id, ON DELETE SET NULL |
| action_code | VARCHAR(80) ASCII | No | Acción normalizada |
| entity_type | VARCHAR(40) ASCII | No | Tipo de objetivo |
| entity_id | CHAR(36) ASCII | Sí | Identificador del objetivo |
| outcome | VARCHAR(20) ASCII | No | CHECK: SUCCESS, DENIED, FAILED |
| request_id | CHAR(36) ASCII | No | Correlación |
| ip_hash | BINARY(32) | Sí | Seudonimizado |
| metadata | JSON | Sí | Lista blanca de campos |
| previous_hash | BINARY(32) | Sí | Encadenamiento |
| event_hash | BINARY(32) | No | Evidencia de alteración |

Índices:

- audit_events_time_idx (occurred_at, id).
- audit_events_actor_idx (actor_user_id, occurred_at).
- audit_events_action_idx (action_code, occurred_at).
- audit_events_entity_idx (entity_type, entity_id, occurred_at).
- audit_events_request_idx (request_id).

La cuenta adp_audit_writer recibe INSERT y no recibe UPDATE, DELETE ni TRUNCATE.

## Datos derivados que no se almacenan

| Dato | Fórmula o fuente |
|---|---|
| Valor bruto de oferta | unit_price_cop_per_kg × offered_quantity_kg |
| Valor neto para finquero | valor bruto − seller_logistics_cost_cop |
| Porcentaje de anticipo | advance_amount_cop ÷ valor bruto × 100 |
| Compra total o parcial | Comparación entre offered_quantity_kg y estimated_quantity_kg |
| Oferta vigente | bids.current_version_no |
| Ganador | listing_awards |
| Contacto visible | Solo si existe adjudicación válida y el solicitante es propietario |

No almacenar estos valores evita divergencias cuando cambian los datos fuente.

## Política de cambios al esquema

Todo cambio debe incluir:

1. Actualización de este diccionario.
2. Actualización del diagrama afectado.
3. Migración Prisma versionada.
4. SQL manual cuando Prisma no exprese una restricción.
5. Prueba positiva y prueba de rechazo.
6. Revisión de índices y permisos.
7. Estrategia de reversión o migración hacia adelante.
