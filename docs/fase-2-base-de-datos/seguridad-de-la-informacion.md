# Seguridad de la información

## Objetivo

Proteger la confidencialidad, integridad y disponibilidad de los datos de ADP frente a:

- robo de una copia de la base de datos;
- acceso indebido entre usuarios;
- filtración accidental desde logs o respuestas;
- inyección SQL;
- abuso de credenciales de servicio;
- modificación de ofertas o adjudicaciones;
- pérdida de datos;
- carga de archivos maliciosos;
- errores de programación y concurrencia.

La seguridad se implementa por capas. No existe una única configuración que resuelva todos los riesgos.

## 1. Clasificación de datos

| Nivel | Ejemplos | Tratamiento |
|---|---|---|
| Público | variedad de cultivo, cantidad publicada, municipio, fecha disponible | Visible según estado de publicación |
| Interno | IDs, estados, métricas técnicas, historial operacional | Solo backend y personal autorizado |
| Confidencial | correo, teléfono, nombre de comprador antes de adjudicar, IP seudonimizada | Cifrado, acceso mínimo y auditoría |
| Secreto | contraseñas, tokens, secreto MFA, claves de cifrado, credenciales MySQL | Hash o gestor de secretos; nunca logs |
| Crítico de negocio | condiciones de oferta, versión aceptada, adjudicación | Integridad transaccional y append-only |

### Minimización

- No se almacenan coordenadas exactas de fincas.
- No se almacena una copia de conversaciones de WhatsApp.
- No se almacenan tokens en texto plano.
- No se guarda PII dentro de audit_events.metadata.
- No se copia producción hacia desarrollo o pruebas.
- No se recopila un documento de identidad en Fase 2.

## 2. Modelo de amenazas

~~~mermaid
flowchart LR
    A[Atacante externo] -->|credenciales robadas / inyección| API[API]
    U[Usuario legítimo] -->|IDOR / abuso de rol| API
    D[Desarrollador o servicio] -->|permiso excesivo| DB[(MySQL)]
    X[Copia robada] -->|backup o dump| DB
    F[Archivo hostil] -->|imagen falsa| STORE[Objetos]

    API --> C1[Autenticación + autorización]
    API --> C2[Prisma parametrizado]
    DB --> C3[FK + CHECK + UNIQUE + transacciones]
    DB --> C4[Cifrado de PII + permisos mínimos]
    DB --> C5[Auditoría + backup]
    STORE --> C6[Firma, tamaño, malware y acceso privado]
~~~

| Amenaza | Control principal | Control de respaldo |
|---|---|---|
| SQL injection | Consultas parametrizadas de Prisma | Cuenta sin DDL ni privilegios administrativos |
| IDOR | Autorización por propietario y relación | Consultas filtradas por actor |
| Robo de dump | PII cifrada fuera de MySQL | Claves separadas y rotables |
| Robo de contraseña | Argon2id | MFA para administración y límites de intentos |
| Robo de refresh token | Hash, expiración y rotación | Revocación de familia por reutilización |
| Dos adjudicaciones | Bloqueo y transacción | PK listing_awards.listing_id |
| Cambio de oferta ganadora | Versiones inmutables | FK a la versión aceptada |
| Filtración por logs | Lista de exclusión y sanitización | Revisión automatizada |
| Cuenta MySQL comprometida | Menor privilegio | Segmentación de red y TLS |
| Pérdida de datos | Backup cifrado + binlog | Pruebas periódicas de restauración |
| Imagen maliciosa | Validación real y análisis | Almacenamiento privado sin ejecución |

## 3. Contraseñas

### Decisión

- Algoritmo: Argon2id.
- Parámetro inicial: memoria 64 MiB, 3 iteraciones, paralelismo 1.
- Salt aleatorio generado por la biblioteca.
- Longitud de contraseña permitida: 12 a 128 caracteres.
- No truncar silenciosamente.
- Comparación mediante biblioteca segura.
- Rehash en el siguiente login cuando cambien los parámetros.

PASSWORD_CREDENTIALS.password_hash conserva la cadena Argon2id completa. La contraseña original nunca entra en MySQL ni en logs.

OWASP recomienda Argon2id para aplicaciones nuevas y considera bcrypt una alternativa para sistemas heredados: [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

### Intentos fallidos

- Límite de tráfico por IP y cuenta en el backend.
- failed_login_count ayuda a detectar ataques, pero no reemplaza el limitador externo.
- locked_until aplica un bloqueo temporal progresivo.
- No revelar si un correo existe.
- Registrar éxito, fallo y bloqueo sin guardar la contraseña.

## 4. Cifrado de contactos

### Flujo de escritura

~~~mermaid
sequenceDiagram
    participant API
    participant KMS as Gestor de claves
    participant DB as MySQL

    API->>API: Normalizar correo o teléfono
    API->>KMS: Obtener clave de datos por versión
    KMS-->>API: Clave temporal
    API->>API: AES-256-GCM con nonce aleatorio
    API->>API: HMAC-SHA-256 para lookup_hash
    API->>DB: Guardar ciphertext, lookup_hash y key_version
    API->>API: Borrar material sensible de memoria cuando sea posible
~~~

### Reglas criptográficas

- AES-256-GCM con nonce aleatorio de 96 bits.
- La autenticación incluye como AAD: nombre de tabla, user_id, nombre de campo y key_version.
- La columna ciphertext contiene nonce, contenido cifrado y tag.
- El índice ciego usa HMAC-SHA-256 con una clave distinta a la de cifrado.
- La clave maestra no vive en variables versionadas, Prisma, MySQL ni imágenes de contenedor.
- key_version permite rotar claves sin detener el sistema.
- La rotación reescribe los datos por lotes y conserva auditoría.

[OWASP Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) recomienda minimizar datos sensibles, usar modos autenticados como GCM y separar las claves de los datos cifrados.

## 5. Sesiones y tokens

### Configuración inicial

| Elemento | Decisión |
|---|---|
| Access token | JWT firmado, 10 minutos |
| Refresh token | Aleatorio de al menos 256 bits |
| Persistencia refresh | Solo SHA-256 en auth_sessions |
| Vigencia refresh | 30 días absolutos |
| Rotación | En cada uso |
| Reutilización | Revocar toda la familia y exigir login |
| Logout | Revocar sesión actual |
| Cambio de contraseña | Revocar todas las sesiones |
| Suspensión de usuario | Revocar todas las sesiones |
| Transporte web | Cookie Secure, HttpOnly y SameSite o encabezado protegido según cliente |

Los JWT de acceso no contienen correo, teléfono, empresa ni otros datos sensibles. Contienen identificador de usuario, audiencia, emisor, expiración e identificador de sesión.

Nunca se registran access tokens, refresh tokens, cookies de sesión o códigos de recuperación. [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## 6. Autorización

### Regla

Toda solicitud debe validar:

1. usuario autenticado y ACTIVE;
2. rol necesario;
3. relación con el recurso;
4. estado actual del recurso;
5. campos concretos que puede leer o modificar.

~~~mermaid
flowchart TD
    S[Solicitud autenticada] --> R{¿Rol permitido?}
    R -->|No| D[DENIED + auditoría]
    R -->|Sí| O{¿Propietario o participante?}
    O -->|No| D
    O -->|Sí| E{¿Estado permite la acción?}
    E -->|No| D
    E -->|Sí| F[Consulta filtrada por relación]
    F --> M[Respuesta con campos permitidos]
~~~

Las reglas se niegan por defecto y se validan en cada petición. Un rol amplio no reemplaza la comprobación de propiedad. [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

### Limitación de MySQL

MySQL no ofrece una política de seguridad por fila equivalente a RLS para este diseño. Por eso:

- el backend debe filtrar por owner_user_id o buyer_user_id;
- los contactos se separan en una tabla sin permiso para adp_market;
- las lecturas de finquero usan una proyección segura que no incluye buyer_user_id;
- las relaciones críticas se respaldan con FKs y transacciones;
- las pruebas de autorización son obligatorias.

La base protege estructura y exposición por tabla; la aplicación conserva la responsabilidad de identificar correctamente al actor.

## 7. Usuarios y permisos de MySQL

~~~mermaid
flowchart TB
    MIG[adp_migrator] -->|DDL durante despliegue| ALL[(Esquema ADP)]
    AUTH[adp_auth] -->|DML limitado| ID[Identidad, sesiones y MFA]
    MARKET[adp_market] -->|DML limitado| CORE[Perfiles, fincas, publicaciones y ofertas]
    WRITER[adp_audit_writer] -->|INSERT| AUDIT[Auditoría]
    READER[adp_auditor] -->|SELECT| AUDIT
    BACKUP[adp_backup] -->|respaldo mínimo| ALL
~~~

| Cuenta | Permitido | Prohibido |
|---|---|---|
| adp_migrator | DDL en despliegue | Uso por el servidor en ejecución |
| adp_auth | DML de identidad, sesiones, MFA y perfil propio | Tablas de operación comercial, DDL |
| adp_market | DML del mercado y SELECT público de users | Contactos, contraseñas, sesiones, MFA, DDL |
| adp_audit_writer | INSERT en audit_events y EXECUTE del bloqueo de cabeza | SELECT masivo, UPDATE, DELETE, TRUNCATE |
| adp_auditor | SELECT de auditoría | Escritura |
| adp_backup | Operaciones mínimas de respaldo | Login interactivo normal |

Ninguna cuenta de aplicación recibe FILE, PROCESS, SUPER, GRANT OPTION, CREATE USER, DROP, ALTER o acceso al esquema mysql.

## 8. Configuración y red de MySQL

- Puerto 3306 solo en red privada.
- Firewall permite únicamente hosts de aplicación, migración y backup.
- require_secure_transport activado.
- Certificados verificados por el cliente.
- local_infile desactivado.
- Credenciales individuales por entorno.
- Producción, staging y desarrollo en instancias o bases separadas.
- Rotación de credenciales y revocación al salir un integrante.
- Logs generales y slow query log protegidos y sin exposición pública.
- Binary logs cifrados si la infraestructura lo permite.
- Root reservado a administración excepcional.

Las recomendaciones generales de menor privilegio, protección de archivos, TLS y recuperación están documentadas en [MySQL 8.4 Security](https://dev.mysql.com/doc/refman/8.4/en/security.html).

## 9. Auditoría y logs

### Eventos mínimos

- login exitoso, fallido o bloqueado;
- creación, rotación y revocación de sesión;
- cambio y recuperación de contraseña;
- habilitación o revocación de MFA;
- asignación de rol ADMIN;
- creación, publicación o cancelación de cosecha;
- creación, revisión o retiro de oferta;
- adjudicación;
- intento de segunda adjudicación;
- acceso permitido o denegado al contacto ganador;
- cambio de permisos;
- ejecución de migración;
- restauración de backup.

### Datos que jamás se registran

- contraseñas;
- JWT;
- refresh tokens;
- cookies;
- códigos de recuperación;
- secreto TOTP;
- claves de cifrado;
- cadena de conexión;
- correo o teléfono en claro;
- cuerpo completo de una petición;
- contenido binario de imágenes.

### Protección

- metadata se construye desde una lista blanca.
- Saltos de línea y caracteres de control se sanitizan.
- El request_id relaciona eventos sin copiar la solicitud.
- previous_hash y event_hash permiten detectar alteración.
- Un trigger rechaza eventos cuyo previous_hash no coincide con la cabeza; otro avanza la cabeza después del INSERT.
- Las cuentas de aplicación solo ejecutan el procedimiento de bloqueo y no actualizan directamente la cabeza.
- Se exporta una copia hacia almacenamiento inmutable cuando exista infraestructura.
- Retención operativa inicial: 365 días para eventos de seguridad, sujeta a revisión legal y de privacidad.

[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) desaconseja registrar tokens, contraseñas, secretos y PII sensible.

## 10. Fotografías

- Bucket o contenedor privado.
- storage_key aleatorio; nunca usa el nombre original como ruta.
- URL firmada de corta duración para lectura.
- Verificación de firma real del archivo, no solo Content-Type.
- Tipos permitidos: JPEG, PNG y WebP.
- Límite inicial: 10 MB por archivo y máximo configurable por publicación.
- Re-encode seguro antes de publicar.
- Eliminación de metadatos EXIF, especialmente GPS.
- Análisis de malware.
- sha256 para integridad y deduplicación.
- El servidor nunca ejecuta ni sirve el archivo como HTML.

## 11. Backups y continuidad

### Objetivos iniciales

| Métrica | Objetivo |
|---|---|
| RPO | Máximo 15 minutos de datos |
| RTO | Restauración operativa en máximo 4 horas |
| Backup completo | Diario |
| Recuperación puntual | Binary log continuo |
| Retención diaria | 35 días |
| Retención mensual | 12 meses, sujeta a política legal |
| Prueba de restauración | Trimestral y antes de cambios de alto riesgo |

### Reglas

- Backups cifrados con clave distinta a la instancia.
- Copia en una ubicación o cuenta separada.
- Acceso de backup sin permisos administrativos innecesarios.
- Verificación automática de integridad.
- La prueba restaura en una red aislada.
- Los datos restaurados no se conectan a servicios externos.
- Se documenta tiempo real de restauración y pérdida observada.
- Un backup no se considera válido hasta que haya sido restaurado.

## 12. Seguridad de migraciones

- Prisma Migrate genera archivos versionados.
- Producción ejecuta prisma migrate deploy, nunca db push.
- La cuenta runtime no puede ejecutar migraciones.
- Cada migración se prueba sobre una copia sin PII.
- Cambios destructivos se dividen en expandir, migrar y contraer.
- Una columna no se elimina en el mismo despliegue que deja de usarse.
- Los CHECK, vistas, triggers o permisos no expresables por Prisma se guardan como SQL dentro de la migración.
- Se revisa el SQL generado antes de fusionar.
- Las migraciones registran versión, autor técnico, hora y resultado.

## 13. Pruebas de seguridad

| Prueba | Resultado requerido |
|---|---|
| adp_market consulta user_private_contacts | Permiso denegado |
| Finquero consulta oferta ajena | 404 o denegación sin filtrar existencia |
| Finquero solicita contacto antes de adjudicar | Denegado y auditado |
| Finquero solicita contacto de su ganador | Permitido y auditado |
| Reutilización de refresh token rotado | Familia revocada |
| Entrada SQL en filtros | Tratada como valor, no como consulta |
| Segundo INSERT de adjudicación | Rechazado |
| UPDATE de bid_versions | Rechazado para la cuenta runtime |
| UPDATE o DELETE de audit_events | Rechazado |
| Backup sin clave | Ilegible |
| Archivo con extensión JPG pero firma distinta | Rechazado |
| Imagen con EXIF GPS | Metadatos eliminados |
| Token o contraseña en logs | Prueba falla |

## 14. Respuesta a incidentes

Si se sospecha compromiso:

1. revocar sesiones;
2. rotar credenciales del servicio afectado;
3. bloquear acceso de red;
4. preservar auditoría y logs;
5. determinar tablas y periodo afectados;
6. rotar claves de cifrado si corresponde;
7. restaurar o reparar desde una fuente verificada;
8. comprobar integridad de adjudicaciones e historiales;
9. documentar causa y controles correctivos;
10. seguir el procedimiento legal y de comunicación aplicable.

No se borran logs ni se modifica la evidencia durante la investigación.
