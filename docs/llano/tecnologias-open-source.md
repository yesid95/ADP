# Tecnologias y piezas open source para Plataneros del Llano

## Objetivo

Este documento identifica tecnologias y proyectos open source que pueden funcionar como piezas de Lego para construir **Plataneros del Llano** sin desarrollar todo desde cero.

La idea base es combinar:

- una plataforma web movil;
- perfiles de productores y compradores;
- publicaciones de cosecha;
- pujas anonimas;
- asistente IA para publicar y buscar;
- comparador inteligente de pujas;
- cierre comercial por WhatsApp.

## Recomendacion ejecutiva

Para un MVP rapido y defendible:

| Capa | Recomendacion |
|---|---|
| Frontend | Next.js + React |
| UI | Tailwind CSS + shadcn/ui |
| Backend y base de datos | Supabase o PostgreSQL + API propia |
| Tiempo real | Supabase Realtime o WebSockets |
| Pujas | Adaptar logica de Auktiva o auction-website |
| IA conversacional | Dify si se quiere acelerar con plataforma visual; API propia si se quiere mas control |
| Prediccion/precios | Empezar con reglas y scoring; luego integrar Prophet/Scikit-learn |
| Cierre comercial | WhatsApp con enlace `wa.me` al inicio |
| Trazabilidad | Registro auditable interno; blockchain solo opcional |

## Arquitectura sugerida

```text
Next.js web app
  |
  |-- Perfil de finquero
  |-- Publicacion de cosecha
  |-- Buscador de compradores
  |-- Bandeja de pujas anonimas
  |-- Comparador IA
  |
Supabase / PostgreSQL
  |
  |-- usuarios
  |-- fincas
  |-- cosechas
  |-- pujas
  |-- mensajes
  |-- reputacion
  |
Servicio IA
  |
  |-- mejorar publicacion
  |-- buscar cosechas
  |-- comparar pujas
  |-- explicar mejor oferta
  |
WhatsApp
  |
  |-- cierre comercial
```

## Piezas open source evaluadas

### 1. Auktiva

Repositorio: https://github.com/thomsa/auktiva

**Para que sirve:** plataforma de subastas con pujas en tiempo real, pujas anonimas y manejo de subastas privadas o publicas.

**Como nos serviria:**

- logica de pujas;
- estados de subasta;
- anonimato;
- actualizacion en tiempo real;
- panel de gestion.

**Limitacion:** esta orientada a subastas de articulos, no a cosechas agricolas ni ofertas con condiciones logisticas. Habria que cambiar el modelo de `item` por `cosecha` y el modelo de `bid` por `puja compuesta`.

**Veredicto:** muy buena pieza para estudiar o adaptar el modulo de pujas.

### 2. auction-website

Repositorio: https://github.com/hmellor/auction-website

**Para que sirve:** sistema open source de subastas con React/Vite, Firebase y pujas en tiempo real.

**Como nos serviria:**

- prototipo rapido de subasta;
- login anonimo o ligero;
- actualizaciones en vivo;
- reglas de seguridad sobre pujas;
- despliegue sencillo.

**Limitacion:** esta pensado para eventos o subastas simples. No trae perfiles agricolas, comparador de valor total ni flujo comprador-productor.

**Veredicto:** buena opcion si se quiere hacer una demo muy rapida, pero menos alineada a arquitectura productiva de largo plazo.

### 3. Shaket Protocol

Repositorio: https://github.com/shaketlabs/shaket

**Para que sirve:** protocolo open source para negociacion y subastas entre agentes. Maneja coordinadores, rondas, ofertas, estado y auditoria de eventos.

**Como nos serviria:**

- modelar pujas como negociaciones estructuradas;
- representar compradores y vendedores con agentes;
- guardar historial de ofertas;
- probar escenarios donde varios compradores compiten;
- separar la decision humana de la coordinacion automatica.

**Limitacion:** no es una app lista para usuarios finales. Es una pieza tecnica para el motor de negociacion.

**Veredicto:** excelente para una version avanzada o para justificar innovacion tecnica. Para MVP visual, puede ser demasiado tecnico si se integra desde el dia uno.

### 4. Mercur / MedusaJS

Repositorio: https://github.com/mercurjs/mercur

**Para que sirve:** plataforma marketplace multi-vendedor construida sobre MedusaJS.

**Como nos serviria:**

- usuarios vendedores/compradores;
- catalogo;
- panel de vendedor;
- arquitectura marketplace;
- base para escalar a varios cultivos.

**Limitacion:** un marketplace e-commerce tradicional no trae pujas anonimas ni negociacion agricola por condiciones. Puede ser mas pesado que lo necesario para un hackathon.

**Veredicto:** buena referencia para arquitectura marketplace, no necesariamente la mejor base para el MVP.

### 5. FarmConnect

Repositorio: https://github.com/CodeMayorTech/FarmConnect

**Para que sirve:** plataforma agritech con registro de agricultores, acceso a mercado, clima, recomendaciones y canales de baja conectividad.

**Como nos serviria:**

- inspiracion para contexto rural;
- enfoque mobile/WhatsApp/SMS;
- marketplace agricultor-comprador;
- panel para agregadores o instituciones.

**Limitacion:** es amplio: clima, asesoria, financiamiento, enfermedades, mercado. Podria distraer del flujo principal de pujas.

**Veredicto:** buena referencia de producto rural, no copiar todo.

### 6. AgriCast

Repositorio: https://github.com/chirdekaran262/AgriCast

**Para que sirve:** plataforma de prediccion de precios agricolas con React, Spring Boot, FastAPI, PostgreSQL y Prophet.

**Como nos serviria:**

- arquitectura separada para ML;
- ejemplo de servicio FastAPI para predicciones;
- uso de Prophet para series de tiempo;
- tablero de precios historicos y pronostico.

**Limitacion:** esta en etapa temprana y depende de datos historicos. Para platano en Casanare, primero necesitariamos datos confiables.

**Veredicto:** util como referencia para modulo futuro de precios, no como nucleo del MVP.

### 7. Crop Price Analysis

Repositorio: https://github.com/Divya-Rag/Crop-Price-Analysis

**Para que sirve:** analisis de precios y recomendacion de mercados con Python, Pandas, visualizaciones y Scikit-learn.

**Como nos serviria:**

- idea de scoring de mercados;
- limpieza de datos;
- comparacion de estabilidad de precios;
- prediccion simple con regresion;
- recomendacion tipo "donde conviene vender".

**Limitacion:** es un proyecto de analisis, no una plataforma web completa.

**Veredicto:** buena pieza para aprender el scoring de recomendacion, no para copiar como app principal.

### 8. Dify

Repositorio: https://github.com/langgenius/dify

**Para que sirve:** plataforma open source para construir aplicaciones LLM, workflows, RAG, agentes, gestion de modelos y observabilidad.

**Como nos serviria:**

- crear rapido el asistente para finqueros;
- diseñar flujos de preguntas para completar publicaciones;
- crear asistente para compradores;
- exponer API del agente a la app principal.

**Limitacion:** su licencia open source tiene condiciones adicionales. Hay que revisar bien si se piensa usar comercialmente.

**Veredicto:** buena opcion para acelerar IA si no queremos programar todo el flujo desde cero.

### 9. Flowise

Repositorio: https://github.com/FlowiseAI/Flowise

**Para que sirve:** construccion visual de agentes y flujos LLM.

**Advertencia importante:** segun anuncio oficial consultado el 27 de agosto de 2026, Flowise entro en congelamiento de desarrollo el 29 de julio de 2026 y el fin de vida oficial esta anunciado para el 31 de agosto de 2026.

**Veredicto:** aunque fue muy popular, no conviene elegirlo como pieza central nueva en este momento. Solo lo usaria si se acepta mantener un fork propio.

### 10. Rasa

Repositorio: https://github.com/RasaHQ/rasa

**Para que sirve:** framework open source historico para asistentes conversacionales.

**Advertencia:** Rasa Open Source aparece en modo mantenimiento, con orientacion hacia nuevos productos de Rasa.

**Veredicto:** no seria mi primera opcion para este prototipo. Mejor Dify o un servicio IA propio.

## Que pieza usar para cada funcionalidad

| Funcionalidad | Opcion recomendada | Alternativa |
|---|---|---|
| Perfiles de finqueros | Construir propio en Next.js + DB | Adaptar marketplace existente |
| Publicaciones de cosecha | Construir propio | Mercur/Medusa como referencia |
| Pujas anonimas | Adaptar Auktiva o auction-website | Motor propio simple |
| Pujas con condiciones | Motor propio sobre modelo de puja compuesta | Shaket para version avanzada |
| Busqueda de cosechas | SQL + filtros + ranking | Meilisearch/Tantivy si escala |
| Tiempo real | Supabase Realtime | Socket.IO |
| IA para redaccion | Dify o API propia | LangChain/LangGraph |
| IA para comparar pujas | API propia con reglas + LLM | Shaket + agentes |
| Prediccion de precios | Prophet/FastAPI futuro | Scikit-learn/XGBoost cuando haya datos |
| WhatsApp | Enlace `wa.me` | WhatsApp Business API |
| Pagos | Fuera del MVP | Wompi/MercadoPago/Stripe despues |

## Stack recomendado para construir rapido

### Opcion A: MVP rapido tipo hackathon

- Next.js
- Supabase:
  - Auth;
  - Postgres;
  - Storage para fotos;
  - Realtime para pujas;
- Tailwind CSS + shadcn/ui;
- API IA propia con OpenAI u otro proveedor compatible;
- WhatsApp por enlace;
- datos simulados o cargados manualmente.

**Ventaja:** rapido, coherente y demostrable.

**Desventaja:** menos control si luego se quiere infraestructura totalmente propia.

### Opcion B: MVP mas controlado y extensible

- Next.js frontend;
- FastAPI backend;
- PostgreSQL;
- WebSockets o Supabase Realtime;
- Python para scoring y predicciones;
- servicio IA propio;
- WhatsApp por enlace.

**Ventaja:** muy flexible para integrar ML agricola.

**Desventaja:** mas trabajo inicial.

### Opcion C: Lego sobre proyectos existentes

- Auktiva o auction-website para pujas;
- Dify para IA;
- Next.js propio para interfaz agricola;
- PostgreSQL/Supabase para datos.

**Ventaja:** reutiliza piezas ya funcionando.

**Desventaja:** integrar piezas heterogeneas puede tomar mas que construir un MVP pequeño propio.

## Decision recomendada

Para este proyecto, recomiendo:

1. **No copiar un marketplace completo.** Es demasiado pesado y no trae la logica especial de pujas con valor agregado.
2. **Usar Auktiva o auction-website como referencia tecnica para pujas anonimas y tiempo real.**
3. **Construir el dominio agricola propio:** finca, cosecha, comprador, puja compuesta, comparador.
4. **Usar Dify o un servicio IA propio para el chatbot.**
5. **Dejar prediccion de precios como fase 2**, porque sin datos historicos locales se vuelve especulativa.

## MVP tecnico concreto

### Entidades minimas

- User
- FarmerProfile
- BuyerProfile
- CropListing
- Bid
- BidComparison
- MessageOrContactRequest

### Campos clave de puja

- price_total;
- includes_transport;
- pickup_at_farm;
- advance_payment_percent;
- payment_days;
- buys_full_lot;
- recurring_offer;
- notes;
- buyer_id oculto hasta aceptacion;
- status.

### Scoring inicial sin ML

Antes de hacer predicciones sofisticadas, se puede crear un scoring interpretable:

```text
score =
  precio_neto_estimado * 0.45
  + beneficio_logistico * 0.20
  + rapidez_pago * 0.15
  + compra_total * 0.10
  + continuidad * 0.10
```

La IA no decide por el productor. Explica el ranking:

```text
La puja B no es la mas alta, pero puede ser la mas conveniente porque recoge en finca,
paga anticipo y compra todo el lote. Esto reduce costos y riesgo para el productor.
```

## Roadmap tecnologico

### Fase 1: Demo

- Datos mock.
- Perfil de finca.
- Publicacion de cosecha.
- Tres pujas anonimas.
- Comparador IA o simulador de comparacion.
- Cierre por WhatsApp.

### Fase 2: MVP real

- Login.
- Base de datos real.
- Fotos de cosecha.
- Pujas en tiempo real.
- Chat IA para crear publicaciones.
- Busqueda para compradores.

### Fase 3: Inteligencia comercial

- Historial de precios.
- Scoring por municipio/ruta.
- Alertas para compradores.
- Reputacion.
- Prediccion de precio si hay suficientes datos.

### Fase 4: Plataforma expandible

- Otros cultivos.
- Asociaciones.
- Panel institucional.
- API para compradores grandes.
- Integracion de pagos o contratos.

## Fuentes consultadas

- Auktiva: https://github.com/thomsa/auktiva
- auction-website: https://github.com/hmellor/auction-website
- Shaket Protocol: https://github.com/shaketlabs/shaket
- Mercur marketplace: https://github.com/mercurjs/mercur
- FarmConnect: https://github.com/CodeMayorTech/FarmConnect
- AgriCast: https://github.com/chirdekaran262/AgriCast
- Crop Price Analysis: https://github.com/Divya-Rag/Crop-Price-Analysis
- Dify: https://github.com/langgenius/dify
- Flowise: https://github.com/FlowiseAI/Flowise
- Anuncio de fin de vida de Flowise: https://flowiseai.com/sunset
- Rasa Open Source: https://github.com/RasaHQ/rasa
- Supabase Realtime: https://supabase.com/docs/guides/realtime
- Next.js Docs: https://nextjs.org/docs
- Prisma + Next.js: https://www.prisma.io/docs/guides/frameworks/nextjs
