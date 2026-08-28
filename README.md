# ADP - Asociación de Plataneros

**ADP**, por **Asociación de Plataneros**, es una plataforma comercial con IA para que finqueros publiquen cosechas de plátano y reciban pujas anónimas de compradores, distribuidores o aliados logísticos.

La propuesta busca resolver un problema simple pero fuerte: el productor no siempre necesita la oferta mas alta, sino la oferta que mas le conviene en valor real, considerando precio, transporte, anticipo, recoleccion, tiempo de pago, compra total y continuidad comercial.

## Estado del proyecto

**Fase actual:** Fase 1 terminada; Fase 2 en desarrollo en la rama `codex/fase-2-backend`.

La demo funcional está implementada como una aplicación **React + Vite** con datos simulados, estado en memoria y pruebas automáticas. Permite recorrer el flujo principal del producto:

```text
Finquero publica cosecha -> compradores hacen pujas anonimas -> IA compara -> finquero acepta -> cierre por WhatsApp
```

### Implementado en Fase 1

- Perfil de finca con fotografías locales de cultivo de plátano hartón.
- Formulario validado de publicación con carga temporal de fotografías.
- Asistente simulado que genera un texto comercial usando los datos del formulario.
- Vista pública de la cosecha y recorrido guiado hacia mercado y pujas.
- Compradores sugeridos y tres pujas anónimas con condiciones diferentes.
- Comparador de precio bruto, valor neto, transporte, anticipo y plazo de pago.
- Recomendación IA simulada para elegir por valor total.
- Confirmación de una única puja, bloqueo del proceso y revelación del comprador ganador.
- Cierre por WhatsApp con mensaje dinámico y destinatario opcional por entorno.
- Acción para reiniciar y repetir la demo.

### Avance de Fase 2 en la rama dedicada

- Backend Node.js + Express y TypeScript estricto.
- Prisma para MySQL 8.4 con 25 modelos, migración inicial, llaves foráneas y restricciones reales.
- Registro, verificación de correo, Argon2id, JWT corto y refresh token rotatorio.
- Separación y cifrado autenticado de contactos privados.
- Fincas, publicaciones y ofertas con versiones inmutables.
- Adjudicación única protegida por transacción serializable, bloqueo de filas e idempotencia.
- Auditoría autenticada y pruebas unitarias/contractuales del backend.

Antes de considerar terminada la fase faltan la validación integral sobre MySQL 8.4, MFA operativo, correo real, cuentas de base de datos con privilegios separados, pruebas de concurrencia y restauración de respaldos.

El diseño completo está en `docs/fase-2-base-de-datos/README.md`.

La implementación ejecutable y su estado están en `backend/README.md` y `docs/fase-2-backend.md`.

### Estado verificable de cierre de Fase 2

La rama ya contiene el núcleo ejecutable: 25 modelos Prisma, migración inicial, autenticación y sesiones, cifrado de contactos, fincas, publicaciones, ofertas versionadas, adjudicación transaccional, idempotencia y pruebas sin base. Esto todavía no equivale a una Fase 2 terminada.

| Frente de cierre | Estado actual | Evidencia que falta para cerrarlo |
|---|---|---|
| MySQL 8.4 real | Pendiente de integración | Migración y seed desde cero, ciclo completo y CI con MySQL |
| API CRUD | Parcial | Perfiles, intereses, edición/archivo, fotografías e historial propio |
| Autenticación y administración | Parcial | Correo real, recuperación de contraseña, administración y MFA TOTP |
| Seguridad efectiva en MySQL | Parcial | Cuentas separadas, GRANT, vistas, inmutabilidad y auditoría encadenada |
| Integración y concurrencia | Pendiente | Autorización con base real y carrera concurrente de adjudicación |
| Frontend persistente | Pendiente | Sustituir datos simulados por autenticación y API real |
| Operación y recuperación | Pendiente | EXPLAIN, volumen, observabilidad, backup, PITR y restauración medida |

El detalle, orden de ejecución y criterio de salida están en `docs/fase-2-backend.md`. Las fases 3 a 5 —tiempo real, IA real y reputación— no forman parte de esta puerta de cierre.

## Ejecutar el proyecto

### Requisitos

- Node.js 20 o superior.
- npm o pnpm.

### Instalacion

Con npm:

```bash
npm install
```

Con pnpm:

```bash
pnpm install
```

### Modo desarrollo

```bash
npm run dev
```

Luego abrir:

```text
http://127.0.0.1:5173
```

### WhatsApp opcional

Copia `.env.example` como `.env` y define el número en formato internacional, solo con dígitos:

```env
VITE_WHATSAPP_NUMBER=573001112233
```

Si la variable queda vacía, WhatsApp abre el mensaje precargado sin seleccionar destinatario.

### Compilar para produccion

```bash
npm run build
```

### Verificación

```bash
npm run lint
npm test
npm run build
npm run backend:validate
```

Las pruebas cubren el bloqueo previo a la publicación, la mejora de texto, la carga temporal de imágenes, la publicación, la habilitación de compradores y pujas, la aceptación única, la revelación del ganador, WhatsApp y el reinicio de la demo.

### Estructura actual

```text
src/App.jsx              Orquestación y estado de la demo
src/components/          Formulario, perfil, mercado, pujas y confirmación
src/data/                Datos simulados de finca, compradores y ofertas
src/lib/                 Validación, formato, IA simulada y WhatsApp
src/App.test.jsx         Pruebas de interacción
public/assets/           Fotografías locales de plátano hartón
backend/                 API, modelos Prisma, migraciones y pruebas de Fase 2
docs/fase-1-demo.md      Estado y límites de la Fase 1
docs/fase-2-backend.md   Estado y límites actuales del backend
```

### Vista previa de produccion

```bash
npm run preview
```

## Concepto

Un finquero crea su perfil, publica una cosecha y recibe pujas anonimas. La IA ayuda a mejorar la publicacion y luego compara las ofertas para que el productor pueda decidir con mas informacion.

La identidad del comprador se mantiene anonima mientras la puja esta abierta. Cuando el finquero acepta una oferta, se revela el comprador y las partes cierran la negociacion por chat o WhatsApp.

## Usuarios

- **Finqueros:** publican cosechas, reciben pujas y eligen la mejor oferta.
- **Compradores mayoristas:** buscan volumen, ubicacion, fecha y calidad.
- **Distribuidores:** encuentran producto y proponen condiciones logisticas.
- **Asociaciones:** agrupan publicaciones de varios productores.
- **Instituciones:** pueden usar datos agregados para entender oferta, demanda y zonas productivas.

## Donde entra la IA

- Ayuda al finquero a redactar publicaciones claras.
- Sugiere datos faltantes: cantidad, fecha, fotos, acceso vial, condiciones de cargue.
- Ayuda al comprador a buscar cosechas segun zona, volumen y fecha.
- Compara pujas por valor total, no solo por precio.
- Resume ventajas, riesgos y condiciones de cada oferta.

## MVP

La primera version debe concentrarse en:

- perfiles de finqueros;
- publicaciones de cosecha;
- buscador para compradores;
- pujas anonimas;
- asistente IA para publicaciones;
- comparador IA de pujas;
- cierre por WhatsApp.

## Roadmap

El desarrollo se organizara por fases:

1. Preparacion del proyecto.
2. Demo navegable.
3. MVP tecnico con backend y MySQL.
4. Pujas anonimas en tiempo real.
5. Inteligencia artificial comercial.
6. Cierre por WhatsApp y reputacion.
7. Piloto con usuarios reales.
8. Inteligencia comercial, prediccion y escalamiento.

Ver detalle en `docs/roadmap.md`.

## Documentacion

La guia principal del proyecto esta en:

- `CONTRIBUTING.md`
- `docs/roadmap.md`
- `docs/fase-1-demo.md`
- `docs/fase-2-base-de-datos/README.md`
- `docs/fase-2-base-de-datos/modelo-relacional.md`
- `docs/fase-2-base-de-datos/diccionario-de-datos.md`
- `docs/fase-2-base-de-datos/logica-e-integridad.md`
- `docs/fase-2-base-de-datos/seguridad-de-la-informacion.md`
- `docs/fase-2-base-de-datos/plan-de-implementacion.md`
- `docs/fase-2-backend.md`
- `backend/README.md`
- `docs/git-workflow.md`
- `docs/llano/guia-proyecto-plataneros.md`
- `docs/llano/plataneros-marketplace-pujas.md`
- `docs/llano/stack-tecnologico-seleccionado.md`
- `docs/llano/diagramas/plataneros-marketplace-pujas.puml`

## Frase guia

> No es otro marketplace agricola. Es un sistema de negociacion inteligente para que el finquero elija la oferta que mas le conviene en terminos reales: precio, transporte, anticipo, riesgo, recoleccion y continuidad comercial.
