# Modelo relacional de la Fase 2

## Cómo leer este documento

Las líneas de los diagramas representan cardinalidad:

| Símbolo | Significado |
|---|---|
| uno a cero o uno | La relación es opcional y como máximo existe un registro |
| uno a muchos | Un padre puede tener varios hijos |
| uno a uno o más | Debe existir por lo menos un hijo |

Los diagramas muestran las relaciones y las columnas principales. El tipo exacto, la nulabilidad y cada índice están definidos en el [diccionario de datos](./diccionario-de-datos.md).

## 1. Identidad, roles y sesiones

~~~mermaid
erDiagram
    USERS {
        string id PK
        string display_name
        string status
        datetime created_at
        datetime deleted_at
    }

    USER_PRIVATE_CONTACTS {
        string user_id PK, FK
        binary email_ciphertext
        binary email_lookup_hash UK
        binary phone_ciphertext
        binary phone_lookup_hash UK
        int key_version
    }

    PASSWORD_CREDENTIALS {
        string user_id PK, FK
        string password_hash
        int failed_login_count
        datetime locked_until
    }

    USER_ROLES {
        string user_id PK, FK
        string role_code PK
        datetime assigned_at
    }

    AUTH_SESSIONS {
        string id PK
        string user_id FK
        binary refresh_token_hash UK
        datetime expires_at
        datetime revoked_at
    }

    AUTH_TOKENS {
        string id PK
        string user_id FK
        string purpose
        binary token_hash UK
        datetime expires_at
        datetime used_at
    }

    MFA_FACTORS {
        string id PK
        string user_id FK
        string factor_type
        binary secret_ciphertext
        datetime enabled_at
    }

    MFA_RECOVERY_CODES {
        string id PK
        string factor_id FK
        binary code_hash
        datetime used_at
    }

    USERS ||--o| USER_PRIVATE_CONTACTS : protege
    USERS ||--o| PASSWORD_CREDENTIALS : autentica
    USERS ||--o{ USER_ROLES : posee
    USERS ||--o{ AUTH_SESSIONS : mantiene
    USERS ||--o{ AUTH_TOKENS : recibe
    USERS ||--o{ MFA_FACTORS : configura
    MFA_FACTORS ||--o{ MFA_RECOVERY_CODES : recupera
~~~

### Decisiones

- USERS contiene únicamente identidad pública mínima y estado.
- USER_PRIVATE_CONTACTS separa correo y teléfono para negar su lectura al módulo de mercado.
- PASSWORD_CREDENTIALS no comparte tabla con perfiles ni contactos.
- USER_ROLES permite que una persona tenga más de un rol.
- Los tokens completos nunca se almacenan; se compara su hash.
- Los factores MFA se cifran y los códigos de recuperación se guardan como hash.

## 2. Perfiles, territorio y mercado

~~~mermaid
erDiagram
    USERS {
        string id PK
        string display_name
        string status
    }

    FARMER_PROFILES {
        string user_id PK, FK
        text public_bio
        string verification_status
    }

    BUYER_PROFILES {
        string user_id PK, FK
        string business_name
        string buyer_type
        string verification_status
    }

    DEPARTMENTS {
        int id PK
        string dane_code UK
        string name
    }

    MUNICIPALITIES {
        int id PK
        int department_id FK
        string dane_code UK
        string name
    }

    FARMS {
        string id PK
        string owner_user_id FK
        int municipality_id FK
        string name
        string vereda
        string status
    }

    CROP_VARIETIES {
        int id PK
        string code UK
        string name
        boolean is_active
    }

    BUYER_CROP_INTERESTS {
        string buyer_user_id PK, FK
        int crop_variety_id PK, FK
        decimal minimum_quantity_kg
        decimal maximum_quantity_kg
    }

    BUYER_MUNICIPALITY_INTERESTS {
        string buyer_user_id PK, FK
        int municipality_id PK, FK
    }

    HARVEST_LISTINGS {
        string id PK
        string farm_id FK
        int crop_variety_id FK
        decimal estimated_quantity_kg
        decimal expected_price_cop_per_kg
        datetime bid_deadline_at
        string status
    }

    HARVEST_PHOTOS {
        string id PK
        string listing_id FK
        string storage_key
        binary sha256
        int sort_order
    }

    BIDS {
        string id PK
        string listing_id FK
        string buyer_user_id FK
        string anonymous_label
        int current_version_no
        string status
    }

    BID_VERSIONS {
        string bid_id PK, FK
        int version_no PK
        decimal unit_price_cop_per_kg
        decimal offered_quantity_kg
        decimal advance_amount_cop
        int payment_term_days
    }

    LISTING_AWARDS {
        string listing_id PK, FK
        string bid_id UK, FK
        int bid_version_no FK
        string accepted_by_user_id FK
        datetime accepted_at
    }

    USERS ||--o| FARMER_PROFILES : amplía
    USERS ||--o| BUYER_PROFILES : amplía
    USERS ||--o{ FARMS : posee
    DEPARTMENTS ||--|{ MUNICIPALITIES : contiene
    MUNICIPALITIES ||--o{ FARMS : ubica
    USERS ||--o{ BUYER_CROP_INTERESTS : busca
    CROP_VARIETIES ||--o{ BUYER_CROP_INTERESTS : interesa
    USERS ||--o{ BUYER_MUNICIPALITY_INTERESTS : busca
    MUNICIPALITIES ||--o{ BUYER_MUNICIPALITY_INTERESTS : interesa
    FARMS ||--o{ HARVEST_LISTINGS : publica
    CROP_VARIETIES ||--o{ HARVEST_LISTINGS : clasifica
    HARVEST_LISTINGS ||--o{ HARVEST_PHOTOS : evidencia
    HARVEST_LISTINGS ||--o{ BIDS : recibe
    USERS ||--o{ BIDS : realiza
    BIDS ||--|{ BID_VERSIONS : versiona
    HARVEST_LISTINGS ||--o| LISTING_AWARDS : adjudica
    BIDS ||--o| LISTING_AWARDS : gana
    BID_VERSIONS ||--o| LISTING_AWARDS : congela
    USERS ||--o{ LISTING_AWARDS : acepta
~~~

### Camino principal de relaciones

~~~mermaid
flowchart LR
    U[Usuario finquero] --> F[Finca]
    F --> L[Publicación]
    L --> B[Oferta anónima]
    C[Usuario comprador] --> B
    B --> V[Versiones inmutables]
    L --> A[Adjudicación única]
    V --> A
    A --> R[Revelación controlada del contacto]
~~~

### Por qué las ofertas tienen versiones

Una oferta puede corregirse antes de la fecha límite. Sobrescribir la misma fila destruiría la evidencia de lo ofrecido originalmente y permitiría discusiones sobre cuál condición fue aceptada.

La solución es:

1. BIDS identifica la oferta del comprador para una publicación.
2. BID_VERSIONS almacena cada conjunto de condiciones.
3. BIDS.current_version_no señala la versión vigente.
4. LISTING_AWARDS referencia de forma permanente la versión exacta aceptada.
5. Las filas de BID_VERSIONS son append-only.

## 3. Historial, idempotencia y auditoría

~~~mermaid
erDiagram
    USERS {
        string id PK
    }

    HARVEST_LISTINGS {
        string id PK
    }

    BIDS {
        string id PK
    }

    LISTING_STATUS_EVENTS {
        bigint id PK
        string listing_id FK
        string from_status
        string to_status
        string changed_by_user_id FK
        datetime created_at
    }

    BID_STATUS_EVENTS {
        bigint id PK
        string bid_id FK
        string from_status
        string to_status
        string changed_by_user_id FK
        datetime created_at
    }

    IDEMPOTENCY_RECORDS {
        string id PK
        string user_id FK
        string operation_code
        binary idempotency_key_hash
        binary request_hash
        string resource_id
        datetime expires_at
    }

    AUDIT_EVENTS {
        bigint id PK
        string actor_user_id FK
        string action_code
        string entity_type
        string entity_id
        string outcome
        binary previous_hash
        binary event_hash
        datetime occurred_at
    }

    HARVEST_LISTINGS ||--o{ LISTING_STATUS_EVENTS : registra
    BIDS ||--o{ BID_STATUS_EVENTS : registra
    USERS ||--o{ LISTING_STATUS_EVENTS : ejecuta
    USERS ||--o{ BID_STATUS_EVENTS : ejecuta
    USERS ||--o{ IDEMPOTENCY_RECORDS : protege
    USERS ||--o{ AUDIT_EVENTS : origina
~~~

### Diferencia entre historial y auditoría

| Mecanismo | Propósito | Contenido |
|---|---|---|
| Eventos de estado | Reconstruir el ciclo de vida del negocio | Estado anterior, estado nuevo, actor y razón |
| Auditoría | Investigar seguridad y acciones sensibles | Acción, resultado, entidad, solicitud y evidencia de integridad |
| Idempotencia | Evitar efectos duplicados | Operación, hash de la petición y recurso resultante |

AUDIT_EVENTS no reemplaza el historial del dominio. Tampoco debe convertirse en una copia indiscriminada de solicitudes, porque podría filtrar datos personales o tokens.

## Relaciones que la base debe reforzar

| Relación | Cardinalidad | Regla |
|---|---|---|
| usuario → contacto privado | 1 : 0..1 | Solo usuarios registrados |
| usuario → roles | 1 : N | Sin roles duplicados |
| departamento → municipios | 1 : N | Código DANE único |
| finquero → fincas | 1 : N | El propietario debe tener rol FARMER |
| finca → publicaciones | 1 : N | No se elimina una finca con historial |
| publicación → ofertas | 1 : N | Una oferta por comprador |
| oferta → versiones | 1 : 1..N | Las versiones no se actualizan |
| publicación → adjudicación | 1 : 0..1 | Una sola adjudicación |
| adjudicación → versión | 1 : 1 | Condiciones aceptadas congeladas |
| entidad → eventos de estado | 1 : N | Eventos append-only |

## Acciones de borrado

| Relación | Acción recomendada |
|---|---|
| users → sesiones y tokens temporales | CASCADE solo durante una purga administrativa controlada |
| users → perfiles, fincas, ofertas o adjudicaciones | RESTRICT y borrado lógico |
| harvest_listings → fotografías | CASCADE únicamente si se elimina físicamente un borrador sin actividad |
| publicaciones, ofertas y adjudicaciones históricas | RESTRICT |
| actor de auditoría eliminado | SET NULL, conservando el evento |

El backend normal no tendrá una operación de eliminación física para publicaciones, ofertas o adjudicaciones.

## Límites deliberados de Fase 2

- No existe tabla REVIEWS ni puntuación de reputación.
- No existe tabla de pagos.
- No existe almacenamiento de coordenadas exactas.
- No existe una tabla de resultados generados por IA.
- No se persiste un valor neto calculado: se deriva de los términos de la oferta.
- No se usa JSON para modelar campos principales del dominio.

Estas exclusiones evitan introducir datos sin fuente, relaciones débiles o duplicación de información.
