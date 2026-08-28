# Lógica, estados e integridad

## Principio

La lógica crítica no puede depender de una pantalla ni de una secuencia de consultas sin protección. Debe existir defensa complementaria en:

1. autorización del backend;
2. validación del comando;
3. transacción;
4. bloqueo o aislamiento;
5. restricciones CHECK, UNIQUE y FOREIGN KEY;
6. historial y auditoría.

## 1. Estado de una publicación

~~~mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> OPEN: publicar
    DRAFT --> CANCELLED: descartar
    OPEN --> AWARDED: aceptar oferta
    OPEN --> CLOSED: vencer plazo / cerrar sin ganador
    OPEN --> CANCELLED: cancelar con razón
    AWARDED --> [*]
    CLOSED --> [*]
    CANCELLED --> [*]
~~~

### Reglas

- DRAFT no aparece en búsquedas públicas.
- OPEN requiere finca activa, cantidad positiva, fecha disponible, fecha límite futura y al menos la información mínima.
- Solo OPEN recibe nuevas ofertas o versiones.
- AWARDED requiere exactamente una fila en listing_awards.
- CLOSED, AWARDED y CANCELLED son estados terminales en Fase 2.
- Cancelar una publicación con ofertas cambia esas ofertas a REJECTED dentro de la misma transacción.
- No existe una operación para volver de AWARDED a OPEN.

## 2. Estado de una oferta

~~~mermaid
stateDiagram-v2
    [*] --> SUBMITTED
    SUBMITTED --> SUBMITTED: agregar versión antes del plazo
    SUBMITTED --> WITHDRAWN: retirar por comprador
    SUBMITTED --> ACCEPTED: adjudicar
    SUBMITTED --> REJECTED: gana otra oferta o se cancela
    SUBMITTED --> EXPIRED: vence la publicación
    WITHDRAWN --> [*]
    ACCEPTED --> [*]
    REJECTED --> [*]
    EXPIRED --> [*]
~~~

### Reglas

- Un comprador tiene como máximo una fila BIDS por publicación.
- Puede agregar versiones mientras la oferta esté SUBMITTED y la publicación OPEN.
- Una versión anterior nunca se actualiza ni elimina.
- Solo la versión indicada por current_version_no participa en la comparación.
- ACCEPTED requiere una adjudicación que apunte a esa oferta y versión.
- Cuando una oferta gana, todas las demás SUBMITTED pasan a REJECTED.

## 3. Publicar una cosecha

~~~mermaid
sequenceDiagram
    actor Farmer as Finquero
    participant API
    participant DB as MySQL

    Farmer->>API: Publicar borrador
    API->>API: Validar sesión, rol y propiedad
    API->>DB: BEGIN
    API->>DB: SELECT finca FOR UPDATE
    DB-->>API: Finca activa y propietario
    API->>DB: Validar datos y actualizar DRAFT → OPEN
    API->>DB: Insertar listing_status_events
    API->>DB: Insertar audit_events
    API->>DB: COMMIT
    API-->>Farmer: Publicación abierta
~~~

Condiciones de entrada:

- usuario ACTIVE con rol FARMER;
- propietario de la finca;
- finca ACTIVE;
- cantidad mayor que cero;
- fecha límite posterior al instante actual;
- precio esperado, si existe, mayor que cero;
- al menos una fotografía válida si el producto decide hacerla obligatoria.

## 4. Enviar o revisar una oferta

~~~mermaid
sequenceDiagram
    actor Buyer as Comprador
    participant API
    participant DB as MySQL

    Buyer->>API: Enviar condiciones + clave de idempotencia
    API->>API: Validar sesión, rol y formato
    API->>DB: BEGIN
    API->>DB: Buscar idempotency_record
    alt Petición ya procesada con el mismo hash
        DB-->>API: Recurso existente
        API->>DB: ROLLBACK de lectura
        API-->>Buyer: Misma respuesta anterior
    else Petición nueva
        API->>DB: SELECT publicación FOR UPDATE
        DB-->>API: Estado, plazo, cantidad y propietario
        API->>API: Validar comprador, cantidades y condiciones
        API->>DB: Crear BIDS o nueva BID_VERSION
        API->>DB: Actualizar current_version_no
        API->>DB: Insertar idempotencia, historial y auditoría
        API->>DB: COMMIT
        API-->>Buyer: Oferta registrada
    end
~~~

### Cálculos

~~~text
gross_amount_cop =
    unit_price_cop_per_kg × offered_quantity_kg

net_amount_cop =
    gross_amount_cop − seller_logistics_cost_cop

advance_percent =
    advance_amount_cop ÷ gross_amount_cop × 100
~~~

Estos valores se calculan al consultar. No son columnas persistidas.

### Compra parcial

- Si allows_partial_purchase es FALSE, offered_quantity_kg debe ser igual a estimated_quantity_kg.
- Si es TRUE, la cantidad ofrecida puede ser menor, pero nunca mayor.
- La comparación usa kilogramos como unidad canónica; la UI puede mostrar toneladas dividiendo por 1.000.
- La Fase 2 adjudica una sola oferta. Adjudicaciones parciales múltiples pertenecen a una ampliación posterior.

## 5. Aceptación atómica de una oferta

Esta es la operación más crítica del sistema.

~~~mermaid
sequenceDiagram
    actor Farmer as Finquero
    participant API
    participant DB as MySQL / InnoDB
    participant Identity as Módulo de identidad

    Farmer->>API: Aceptar bid_id + idempotency_key
    API->>API: Validar JWT, rol FARMER y formato
    API->>DB: BEGIN con aislamiento SERIALIZABLE
    API->>DB: SELECT publicación y finca FOR UPDATE
    DB-->>API: Propietario, estado y fecha límite
    API->>DB: SELECT oferta y versión vigente FOR UPDATE
    DB-->>API: Oferta SUBMITTED de esa publicación
    API->>DB: INSERT listing_awards
    Note over DB: PK listing_id impide un segundo ganador
    API->>DB: UPDATE publicación → AWARDED
    API->>DB: UPDATE ganadora → ACCEPTED
    API->>DB: UPDATE restantes → REJECTED
    API->>DB: INSERT eventos, idempotencia y auditoría
    API->>DB: COMMIT
    API->>Identity: Solicitar contacto cifrado del ganador
    Identity-->>API: Contacto autorizado
    API-->>Farmer: Ganador revelado
~~~

### Orden obligatorio

1. Iniciar transacción.
2. Bloquear la publicación y su finca.
3. Confirmar que el actor es el propietario.
4. Confirmar status OPEN y fecha límite vigente.
5. Bloquear la oferta y su versión actual.
6. Confirmar que pertenece a esa publicación y está SUBMITTED.
7. Insertar listing_awards.
8. Actualizar estados.
9. Insertar historiales, idempotencia y auditoría.
10. Confirmar.
11. Revelar el contacto mediante el módulo de identidad.

La revelación ocurre después de COMMIT. Si falla la lectura del contacto, la adjudicación sigue siendo válida y puede consultarse nuevamente; nunca se revierte una adjudicación válida por un fallo de presentación.

## 6. Por qué solo una adjudicación puede ganar

~~~mermaid
flowchart TD
    A[Solicitud A] --> L[SELECT listing FOR UPDATE]
    B[Solicitud B] --> L
    L --> C{¿Sigue OPEN?}
    C -->|Sí, primera solicitud| I[INSERT listing_awards]
    I --> W[Publicación AWARDED]
    W --> OK[COMMIT]
    C -->|No, segunda solicitud| R[Rechazar ALREADY_AWARDED]
    I -. colisión extrema .-> U[PK listing_id rechaza duplicado]
~~~

Existen tres defensas:

1. bloqueo de la fila;
2. validación de estado dentro de la transacción;
3. PK de listing_awards como garantía final.

Si MySQL detecta un deadlock o Prisma devuelve P2034, el servicio reintenta la transacción completa un número limitado de veces con espera aleatoria. Nunca reintenta únicamente el INSERT final.

## 7. Anonimato y revelación

### Antes de adjudicar

El finquero puede recibir:

- bid_id;
- anonymous_label;
- condiciones de la versión vigente;
- fecha de envío;
- estado;
- resumen calculado.

No recibe:

- buyer_user_id;
- display_name del comprador;
- business_name;
- correo;
- teléfono;
- identificadores que permitan enlazar ofertas de distintas publicaciones.

La etiqueta anónima se genera por publicación. Un mismo comprador no conserva la misma letra en otras cosechas.

### Después de adjudicar

El contacto solo se entrega si:

1. existe listing_awards;
2. la publicación pertenece al finquero solicitante;
3. la oferta ganadora corresponde al comprador solicitado;
4. el usuario y la adjudicación no están suspendidos por seguridad.

El módulo adp_market no tiene SELECT sobre user_private_contacts. Solicita el contacto al módulo adp_auth después de comprobar la relación.

## 8. Matriz de invariantes

| Invariante | Backend | CHECK | UNIQUE / PK | FK | Transacción |
|---|:---:|:---:|:---:|:---:|:---:|
| Cantidad y precio positivos | Sí | Sí |  |  |  |
| Finca y comprador existentes | Sí |  |  | Sí |  |
| Propietario con rol FARMER | Sí |  |  | Parcial | Sí |
| Comprador con rol BUYER | Sí |  |  | Parcial | Sí |
| Una oferta por comprador/publicación | Sí |  | Sí | Sí |  |
| Versión pertenece a oferta | Sí |  | PK | Sí |  |
| Oferta pertenece a publicación adjudicada | Sí |  | UNIQUE compuesto | FK compuesta | Sí |
| Una adjudicación por publicación | Sí |  | PK | Sí | Sí |
| No ofertar después del plazo | Sí |  |  |  | Sí |
| Versión aceptada inmutable | Sí |  |  | Sí | Permisos |
| Contacto oculto antes de adjudicar | Sí |  |  | Relación | Sí |
| Reintento sin duplicar operación | Sí |  | UNIQUE | Sí | Sí |

Una FK no puede comprobar roles ni fechas de negocio. Esas reglas se validan dentro de la transacción, mientras la fila relevante está bloqueada.

## 9. Errores de dominio

El backend debe convertir fallos de integridad en códigos estables:

| Código | Situación |
|---|---|
| LISTING_NOT_OPEN | La publicación no está abierta |
| LISTING_DEADLINE_PASSED | Venció el plazo |
| NOT_FARM_OWNER | El actor no posee la finca |
| BUYER_ROLE_REQUIRED | Falta rol de comprador |
| SELF_BIDDING_FORBIDDEN | El propietario intenta ofertar |
| BID_ALREADY_EXISTS | El comprador ya tiene oferta |
| BID_QUANTITY_INVALID | Cantidad incompatible |
| BID_VERSION_STALE | Se intentó aceptar una versión que ya cambió |
| ALREADY_AWARDED | La publicación ya tiene ganador |
| IDEMPOTENCY_KEY_REUSED | Misma clave con contenido diferente |
| CONTACT_NOT_REVEALABLE | Aún no existe relación para revelar contacto |
| CONCURRENT_UPDATE | Conflicto de versionado optimista |

No se devuelven al cliente nombres de tablas, consultas SQL, stack traces ni detalles de restricciones internas.

## 10. Propiedad y autorización

La autorización combina rol, relación y estado:

| Acción | Rol | Relación requerida | Estado requerido |
|---|---|---|---|
| Crear finca | FARMER | usuario autenticado | usuario ACTIVE |
| Editar finca | FARMER | owner_user_id | finca no archivada |
| Publicar cosecha | FARMER | propietario de finca | DRAFT + finca ACTIVE |
| Crear oferta | BUYER | no ser propietario | publicación OPEN |
| Revisar oferta | BUYER | buyer_user_id | SUBMITTED + plazo vigente |
| Comparar ofertas | FARMER | propietario de finca | OPEN |
| Aceptar oferta | FARMER | propietario de finca | OPEN + oferta SUBMITTED |
| Ver contacto ganador | FARMER | propietario + adjudicación | AWARDED |
| Ver contacto propio | BUYER | mismo user_id | usuario ACTIVE |

Conocer un UUID no concede acceso. Cada consulta debe limitarse por la relación esperada, no consultar el recurso y autorizarlo después de haber expuesto datos.
