# Stack tecnologico seleccionado

## Decision

Para el proyecto **ADP - Asociacion de Plataneros** vamos a trabajar con:

```text
Frontend: React + Vite + Tailwind CSS
Backend: Node.js + Express
Base de datos: MySQL
ORM: Prisma
Tiempo real: Socket.IO
Autenticacion: JWT corto + refresh rotatorio + Argon2id
Imagenes: almacenamiento de objetos privado; local solo para demo
IA: servicio externo consumido desde el backend
Cierre comercial: enlaces de WhatsApp wa.me
```

Este stack es suficiente para construir un MVP funcional de marketplace agricola con perfiles, publicaciones de cosecha, pujas anonimas, comparacion asistida por IA y cierre comercial por WhatsApp.

## Opinion tecnica

**Node.js + React + MySQL es un stack viable y coherente** para este proyecto. No esta sobredimensionado y permite avanzar rapido.

React permite construir una interfaz clara y mobile-first. Node.js funciona bien para APIs, logica de negocio y comunicacion en tiempo real. MySQL cubre sin problema las entidades principales del sistema: usuarios, perfiles, cosechas, pujas, estados, historial y suscripciones.

## Por que este stack sirve para ADP

| Necesidad del proyecto | Tecnologia seleccionada | Justificacion |
|---|---|---|
| Interfaz movil para finqueros y compradores | React + Vite | Rapido para desarrollar, facil de probar y desplegar |
| Estilos simples y responsivos | Tailwind CSS | Permite crear una UI limpia sin mucha complejidad inicial |
| API del sistema | Node.js + Express | Suficiente para CRUD, autenticacion, pujas y reglas de negocio |
| Datos relacionales | MySQL | Ideal para usuarios, publicaciones, pujas y estados transaccionales |
| Acceso ordenado a la base de datos | Prisma | Facilita modelos, consultas, migraciones y mantenimiento |
| Pujas en tiempo real | Socket.IO | Permite que el finquero vea pujas sin refrescar la pantalla |
| Seguridad de identidad | JWT corto + refresh rotatorio + Argon2id | Sesiones revocables y contraseñas con hash resistente |
| Fotos de cosechas | Almacenamiento de objetos privado | Conserva evidencia sin exponer archivos permanentemente |
| Asistente inteligente | API IA desde backend | Centraliza prompts, reglas y control de datos |
| Cierre comercial | WhatsApp `wa.me` | Evita integrar pagos o mensajeria compleja desde el MVP |

## Piezas que no se nos pueden escapar

### 1. Tiempo real

Las pujas necesitan comportamiento en vivo. Si un comprador hace una oferta, el finquero debe verla sin actualizar manualmente.

Tecnologia:

```text
Socket.IO
```

Uso:

- nueva puja recibida;
- publicacion cerrada;
- puja aceptada;
- notificacion al comprador ganador.

### 2. Reglas de puja en backend

La logica de pujas no debe vivir solo en React. El backend debe validar:

- que la publicacion este abierta;
- que no haya pasado la fecha limite;
- que el comprador tenga rol valido;
- que el monto sea valido;
- que la puja tenga condiciones completas;
- que solo una puja pueda ser aceptada;
- que la identidad del comprador no se revele antes de aceptar.

### 3. Anonimato

El sistema debe mostrar al finquero:

```text
Pujador A
Pujador B
Pujador C
```

Pero no debe revelar nombre, telefono o empresa hasta que el finquero acepte una puja.

En base de datos se guarda el comprador real mediante `buyer_id`, pero las consultas del finquero no exponen ese identificador ni los datos privados mientras la publicación esté abierta. Correo y teléfono viven cifrados en una tabla separada, y la cuenta del módulo de mercado no puede leerla. La identidad solo se revela después de crear una adjudicación válida.

### 4. IA como modulo separado

La IA no debe estar mezclada en toda la aplicacion. Debe iniciar con dos funciones claras:

1. **Mejorar publicacion de cosecha**
   - redactar mejor descripcion;
   - detectar datos faltantes;
   - sugerir fotos o informacion importante;
   - ordenar la informacion comercial.

2. **Comparar pujas**
   - explicar precio bruto;
   - estimar valor neto;
   - considerar transporte;
   - considerar anticipo;
   - considerar plazo de pago;
   - considerar compra total o parcial;
   - considerar continuidad comercial.

La IA recomienda, pero el finquero decide.

### 5. WhatsApp

Para el MVP, no se necesita integrar la API oficial de WhatsApp Business. Basta con generar enlaces:

```text
https://wa.me/<numero>?text=<mensaje>
```

Esto permite cerrar la negociacion por un canal que los usuarios ya conocen.

### 6. Fotos y evidencia

Cada publicacion de cosecha debe permitir subir imagenes:

- cultivo;
- racimos;
- acceso vial;
- zona de cargue;
- finca o lote.

Para demo se puede usar almacenamiento local. Para una version mas realista se recomienda Cloudinary.

### 7. Autenticacion y roles

Roles minimos:

- finquero;
- comprador;
- administrador.

Cada rol debe ver pantallas distintas.

El finquero publica y acepta pujas.  
El comprador busca y oferta.  
El administrador modera usuarios, publicaciones y reportes.

Las contraseñas usan Argon2id. Los tokens de renovación se guardan únicamente como hash, se rotan en cada uso y pueden revocarse. Los administradores requieren MFA.

### 8. Historial y reputacion

Aunque sea simple, desde el inicio se debe guardar:

- publicaciones creadas;
- pujas recibidas;
- pujas aceptadas;
- pujas rechazadas;
- cierres por WhatsApp;
- historial de compradores;
- calificaciones futuras.

Esto permite construir confianza y evitar que todo se pierda en conversaciones externas.

### 9. Ubicacion

No necesitamos mapas complejos desde el primer prototipo. Pero si debemos guardar:

- departamento;
- municipio;
- vereda;
- ubicacion aproximada;
- acceso vial;
- distancia aproximada a centros de compra.

## Referencias open source

La plataforma se construira con tecnologia propia sobre el stack seleccionado, pero tomando como referencia proyectos open source ya existentes.

| Referencia | Uso en el proyecto |
|---|---|
| Auktiva | Referencia para subastas, pujas anonimas y actualizaciones en tiempo real |
| auction-website | Referencia para una subasta ligera con React/Firebase y pujas en vivo |
| Shaket Protocol | Referencia conceptual para negociacion estructurada entre agentes |
| Dify | Referencia o posible pieza para construir flujos de IA conversacional |
| AgriCast | Referencia futura para prediccion de precios agricolas |
| Crop Price Analysis | Referencia para scoring de mercados y analisis de precios |
| FarmConnect | Referencia de producto agritech orientado a agricultores y compradores |

## Que construiremos nosotros

No vamos a copiar un marketplace generico completo. Vamos a construir el dominio propio del proyecto:

- perfiles de finqueros;
- perfiles de compradores;
- publicaciones de cosecha de platano;
- pujas anonimas;
- comparador de valor total;
- flujo de aceptacion;
- cierre por WhatsApp;
- pantallas mobile-first.

Las referencias open source se usaran como inspiracion tecnica y funcional, especialmente para no empezar desde cero en logicas conocidas como subastas, tiempo real, asistentes IA y prediccion futura.

## Modulos del MVP

| Modulo | Prioridad |
|---|---|
| Registro/login | Alta |
| Perfil de finquero | Alta |
| Perfil de comprador | Alta |
| Publicacion de cosecha | Alta |
| Buscador de cosechas | Alta |
| Pujas anonimas | Alta |
| Comparador IA de pujas | Alta |
| Cierre por WhatsApp | Alta |
| Reputacion | Media |
| Pagos integrados | Baja para MVP |
| Prediccion de precios | Fase 7 |
| Blockchain/trazabilidad | Opcional después del MVP |

## Arquitectura inicial

```text
React + Vite
    |
    | HTTP REST
    v
Node.js + Express
    |
    | Prisma
    v
MySQL

Socket.IO
    |
    | eventos de pujas
    v
Frontend en tiempo real

Backend
    |
    | requests controlados
    v
Servicio IA

Backend
    |
    | enlace generado
    v
WhatsApp wa.me
```

La especificación vigente de conexiones, cuentas técnicas, tablas, restricciones y transacciones está en `../fase-2-base-de-datos/README.md`.

## Entidades iniciales

```text
User
UserPrivateContact
PasswordCredential
UserRole
FarmerProfile
BuyerProfile
Farm
CropVariety
HarvestListing
HarvestPhoto
Bid
BidVersion
ListingAward
IdempotencyRecord
AuditEvent
```

## Decision sobre prediccion

La prediccion de precios no debe ser el centro del MVP. Para predecir bien se necesitan datos historicos confiables por zona, fecha, calidad, volumen y mercado.

En la primera version usaremos:

- reglas de negocio;
- scoring de pujas;
- comparacion asistida por IA;
- explicacion de valor neto.

La predicción puede entrar en la Fase 7 cuando existan datos propios suficientes y verificables.

## Decision sobre blockchain

Blockchain no es necesaria para el MVP de pujas. Puede aparecer despues si se quiere registrar:

- origen de la cosecha;
- puja aceptada;
- acuerdo comercial;
- certificacion de productor;
- trazabilidad de lote.

Para la actividad, basta mencionar que la arquitectura puede dejar un registro auditable, pero el valor principal esta en la negociacion comercial inteligente.

## Resumen para presentar

Vamos a desarrollar **ADP - Asociacion de Plataneros** usando **React, Node.js y MySQL**, complementado con **Prisma, Socket.IO, JWT de acceso corto, Argon2id, almacenamiento privado de imágenes, servicio IA y WhatsApp**.

La plataforma se apoyara en referencias open source de subastas, marketplaces, IA y prediccion agricola, pero construira su propio flujo especializado para productores de platano: publicacion de cosechas, pujas anonimas, comparacion inteligente por valor total y cierre comercial.

La meta tecnica del MVP es demostrar que un finquero puede publicar una cosecha, recibir tres pujas anonimas, pedir a la IA que compare las ofertas y aceptar la mejor segun sus condiciones reales.
