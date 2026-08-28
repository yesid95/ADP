# ADP - Asociacion de Plataneros

**ADP**, por **Asociacion de Plataneros**, es una plataforma comercial con IA para que finqueros publiquen cosechas de platano y reciban pujas anonimas de compradores, distribuidores o aliados logisticos.

La propuesta busca resolver un problema simple pero fuerte: el productor no siempre necesita la oferta mas alta, sino la oferta que mas le conviene en valor real, considerando precio, transporte, anticipo, recoleccion, tiempo de pago, compra total y continuidad comercial.

## Estado del proyecto

**Fase actual:** Fase 1 - Demo navegable.

La primera demo ya esta implementada como una aplicacion **React + Vite** con datos simulados. Permite revisar el flujo principal del producto:

```text
Finquero publica cosecha -> compradores hacen pujas anonimas -> IA compara -> finquero acepta -> cierre por WhatsApp
```

### Implementado en Fase 1

- Pantalla de perfil de finca.
- Publicacion de cosecha de platano harton.
- Asistente simulado para mejorar el texto comercial de la publicacion.
- Busqueda/mercado con compradores sugeridos.
- Tres pujas anonimas con condiciones diferentes.
- Comparador visual de precio bruto, valor neto, transporte, anticipo y plazo de pago.
- Recomendacion IA simulada para elegir por valor total.
- Accion para aceptar una puja.
- Enlace de cierre por WhatsApp.

### Pendiente para Fase 2

- Backend Node.js + Express.
- Base de datos MySQL.
- Prisma.
- Autenticacion.
- Pujas reales persistidas.
- Socket.IO para tiempo real.
- Integracion real del servicio IA.

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

### Compilar para produccion

```bash
npm run build
```

### Vista previa de produccion

```bash
npm run preview
```

## Nota de instalacion local

Durante la implementacion, la instalacion de dependencias en esta maquina fallo por verificacion de certificado contra el registro de npm:

```text
UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

Si aparece el mismo problema, se puede probar temporalmente:

```bash
npm install --strict-ssl=false
```

o:

```bash
pnpm config set strict-ssl false
pnpm install
```

Esa configuracion debe usarse solo si la red local o el certificado corporativo bloquea la descarga normal de dependencias.

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
- `docs/git-workflow.md`
- `docs/llano/guia-proyecto-plataneros.md`
- `docs/llano/plataneros-marketplace-pujas.md`
- `docs/llano/stack-tecnologico-seleccionado.md`
- `docs/llano/diagramas/plataneros-marketplace-pujas.puml`

## Frase guia

> No es otro marketplace agricola. Es un sistema de negociacion inteligente para que el finquero elija la oferta que mas le conviene en terminos reales: precio, transporte, anticipo, riesgo, recoleccion y continuidad comercial.
