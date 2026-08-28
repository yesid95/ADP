# Fase 2: arquitectura de datos y seguridad

## Propósito

Este conjunto de documentos define la base de datos de la Fase 2 de ADP antes de implementar el backend. Su función es evitar que las tablas, relaciones, nombres, tipos de datos y reglas críticas se decidan de forma improvisada durante el desarrollo.

El alcance se limita a:

- modelo relacional;
- diccionario de tablas y columnas;
- conexiones entre aplicación, base de datos y servicios de seguridad;
- integridad referencial y reglas transaccionales;
- protección de credenciales, contactos y ubicación;
- permisos técnicos, auditoría, respaldos y restauración;
- migraciones y pruebas de la capa de datos.

No forman parte de este alcance la interfaz, Socket.IO, inteligencia artificial, reputación, pagos ni analítica predictiva.

## Resultado esperado

Al terminar esta parte de la Fase 2, la base de datos debe poder rechazar estados imposibles aunque exista un error en el backend. Los siguientes casos deben quedar impedidos por diseño:

- una oferta sin publicación o sin comprador;
- una publicación asociada a una finca inexistente;
- valores negativos o ambiguos;
- dos ofertas activas del mismo comprador sobre la misma publicación;
- una adjudicación que apunte a una oferta de otra publicación;
- dos adjudicaciones para la misma cosecha;
- cambios silenciosos en las condiciones de una oferta aceptada;
- exposición del correo o teléfono del comprador antes de adjudicar;
- modificación o eliminación de los eventos de auditoría por la aplicación.

## Decisiones técnicas

| Tema | Decisión de Fase 2 |
|---|---|
| Motor | MySQL 8.4 LTS con InnoDB |
| ORM | Prisma con relaciones respaldadas por llaves foráneas reales |
| Codificación | utf8mb4 |
| Fechas y horas | DATETIME(3) en UTC |
| Identificadores de negocio | UUID en CHAR(36) con juego de caracteres ASCII |
| Historial interno | BIGINT UNSIGNED AUTO_INCREMENT |
| Dinero | DECIMAL(18,2), nunca FLOAT ni DOUBLE |
| Cantidad agrícola | Kilogramos en DECIMAL(12,3) |
| Moneda inicial | COP, expresada en el nombre de cada columna monetaria |
| Eliminación | Borrado lógico para datos de negocio; RESTRICT para relaciones históricas |
| Contraseñas | Argon2id |
| Contactos | Cifrado autenticado en la aplicación y hash ciego para búsquedas |
| Sesiones | JWT de acceso corto más refresh token rotatorio almacenado únicamente como hash |
| Fotos | Almacenamiento privado de objetos; MySQL conserva metadatos y storage_key |
| Ubicación | Departamento, municipio, vereda y referencia aproximada; sin coordenadas exactas |
| Auditoría | Registro append-only y cuenta con permiso exclusivo de INSERT |

## Convenciones de nombres

- Código y base de datos en inglés.
- Documentación explicativa en español.
- Tablas en plural y snake_case.
- Llaves foráneas con el patrón entidad_id.
- Marcas de tiempo con el sufijo _at.
- Códigos de estado con el sufijo _status o _code.
- Cifrado con el sufijo _ciphertext.
- Índices ciegos con el sufijo _lookup_hash.
- Montos monetarios con unidad y moneda explícitas, por ejemplo unit_price_cop_per_kg.
- Cantidades con la unidad explícita, por ejemplo estimated_quantity_kg.

Se evitan nombres ambiguos como amount, value, location, date o type sin contexto.

## Arquitectura y conexiones

~~~mermaid
flowchart LR
    FE[React / cliente móvil] -->|HTTPS + JWT corto| API[Node.js + Express]

    subgraph Backend
        API --> AUTH[Módulo de identidad]
        API --> MARKET[Módulo de mercado]
        API --> AUDIT[Módulo de auditoría]
        MARKET --> FILES[Módulo de fotografías]
    end

    AUTH -->|cuenta adp_auth| IDDB[(Tablas privadas de identidad)]
    MARKET -->|cuenta adp_market| COREDB[(Tablas del mercado)]
    AUDIT -->|cuenta adp_audit_writer| LOGDB[(Auditoría append-only)]

    IDDB --- MYSQL[(MySQL 8.4 / InnoDB)]
    COREDB --- MYSQL
    LOGDB --- MYSQL

    AUTH -->|cifrar / descifrar| KEYS[Gestor de secretos o KMS]
    FILES -->|objetos privados| OBJECTS[Almacenamiento de imágenes]
    MYSQL -->|backup cifrado + binlog| BACKUP[Repositorio de respaldos]

    classDef sensitive fill:#fbe9e7,stroke:#b23c17,color:#111;
    classDef data fill:#e8f5e9,stroke:#2e7d32,color:#111;
    classDef service fill:#e3f2fd,stroke:#1565c0,color:#111;

    class IDDB,LOGDB,KEYS,BACKUP sensitive;
    class COREDB,MYSQL,OBJECTS data;
    class API,AUTH,MARKET,AUDIT,FILES service;
~~~

### Lectura del diagrama

1. El frontend nunca se conecta directamente a MySQL.
2. El backend valida autenticación, rol, propiedad del recurso y estado de negocio.
3. Identidad y mercado usan credenciales de base de datos diferentes.
4. El usuario del mercado no puede leer contraseñas, sesiones ni contactos privados.
5. Las claves de cifrado permanecen fuera de la base de datos.
6. Las fotografías se guardan fuera de MySQL y no tienen URL pública permanente.
7. La auditoría se escribe con una cuenta sin permisos de actualización o eliminación.

## Capas de defensa

~~~mermaid
flowchart TD
    R[Solicitud] --> T[TLS y límites de tráfico]
    T --> A[Autenticación y sesión]
    A --> Z[Autorización por rol + relación + estado]
    Z --> V[Validación de entrada]
    V --> P[Consultas parametrizadas con Prisma]
    P --> C[CHECK + UNIQUE + FOREIGN KEY]
    C --> X[Transacción y bloqueo]
    X --> E[Auditoría sin secretos]
    E --> B[Backup cifrado y restauración probada]
~~~

Ninguna capa se considera suficiente por sí sola. Un UUID no autoriza, el cifrado no evita modificaciones inválidas y una validación de React no protege el backend.

## Índice de documentación

1. [Modelo relacional](./modelo-relacional.md): entidades, cardinalidades y relaciones.
2. [Diccionario de datos](./diccionario-de-datos.md): columnas, tipos, nulabilidad, claves e índices.
3. [Lógica e integridad](./logica-e-integridad.md): estados, transacciones y adjudicación única.
4. [Seguridad de la información](./seguridad-de-la-informacion.md): clasificación, cifrado, permisos, auditoría y respaldos.
5. [Plan de implementación](./plan-de-implementacion.md): migraciones, pruebas y criterio de salida.

## Fuentes técnicas

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [MySQL 8.4 Security](https://dev.mysql.com/doc/refman/8.4/en/security.html)
- [MySQL Foreign Keys](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html)
- [MySQL CHECK Constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html)
- [Prisma Transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [Prisma Relation Mode](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/relation-mode)

## Estado del documento

Este diseño es la especificación de referencia de la capa de datos para la Fase 2. Cualquier cambio de tabla, nombre, tipo, relación o regla crítica debe actualizar primero estos documentos y luego la migración correspondiente.
