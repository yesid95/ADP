# Roadmap por fases - ADP

## Objetivo del roadmap

Este roadmap organiza el desarrollo de **ADP - Asociacion de Plataneros** en fases incrementales. La idea es avanzar desde una demo convincente hasta una plataforma usable por finqueros, compradores y asociaciones.

El principio central es construir primero el ciclo comercial completo:

```text
Finquero publica cosecha -> comprador puja -> IA compara -> finquero acepta -> cierre por WhatsApp
```

## Fase 0 - Preparacion del proyecto

**Objetivo:** dejar el proyecto listo para trabajar en equipo.

### Alcance

- Repositorio Git configurado.
- Documentacion base.
- Stack tecnologico definido.
- Flujo de colaboracion acordado.
- Roadmap inicial.

### Entregables

- `README.md`
- `CONTRIBUTING.md`
- `.gitignore`
- `.gitattributes`
- `docs/git-workflow.md`
- `docs/llano/stack-tecnologico-seleccionado.md`
- `docs/roadmap.md`

### Criterio de salida

El equipo puede clonar el repositorio, entender la idea, crear ramas y empezar a desarrollar sin depender de explicaciones externas.

## Fase 1 - Demo navegable

**Objetivo:** construir una maqueta funcional para presentar la idea con claridad.

### Alcance

- Interfaz React mobile-first.
- Datos simulados.
- Perfil de finca platanera.
- Publicacion de una cosecha.
- Lista de compradores/pujadores anonimos.
- Tres pujas de ejemplo.
- Comparador visual de pujas.
- Pantalla de aceptacion de puja.

### Modulos

- Home/dashboard simple.
- Perfil de finquero.
- Formulario de publicacion de cosecha.
- Vista publica de cosecha.
- Bandeja de pujas anonimas.
- Comparador de valor total.

### Criterio de salida

Se puede hacer una demo de 3 minutos:

1. Ver perfil de finca.
2. Publicar cosecha.
3. Recibir tres pujas anonimas.
4. Comparar precio, transporte, anticipo y plazo de pago.
5. Elegir la mejor oferta.

## Fase 2 - MVP tecnico

**Objetivo:** convertir la demo en una aplicacion con backend y datos persistentes.

### Alcance

- Backend Node.js + Express.
- Base de datos MySQL.
- ORM Prisma.
- Autenticacion con JWT + bcrypt.
- Roles: finquero, comprador, administrador.
- CRUD de perfiles.
- CRUD de publicaciones de cosecha.
- Creacion y listado de pujas.
- Validaciones de negocio en backend.

### Modulos

- API de usuarios.
- API de perfiles de finquero.
- API de perfiles de comprador.
- API de publicaciones.
- API de pujas.
- Middleware de autenticacion.
- Validaciones de estado de publicacion.

### Criterio de salida

El sistema guarda usuarios, cosechas y pujas en MySQL. Un comprador puede ofertar y un finquero puede aceptar una sola puja valida.

## Fase 3 - Pujas anonimas en tiempo real

**Objetivo:** hacer que la experiencia de pujas se sienta viva y confiable.

### Alcance

- Integracion de Socket.IO.
- Eventos en tiempo real para nuevas pujas.
- Actualizacion de bandeja sin refrescar.
- Cierre de publicacion.
- Aceptacion de puja.
- Revelacion del comprador ganador.
- Historial basico de eventos.

### Eventos sugeridos

```text
bid:created
listing:closed
bid:accepted
bid:rejected
buyer:revealed
```

### Reglas criticas

- No revelar identidad del comprador antes de aceptar.
- No permitir pujas en publicaciones cerradas.
- No permitir aceptar dos pujas para la misma cosecha.
- Guardar auditoria basica de decisiones.

### Criterio de salida

El finquero ve pujas nuevas en vivo y puede aceptar una oferta. Solo despues de aceptarla se revela el comprador ganador.

## Fase 4 - Inteligencia artificial comercial

**Objetivo:** integrar IA donde agrega valor real al ciclo comercial.

### Alcance

- Asistente para mejorar publicaciones.
- Asistente para busqueda de cosechas.
- Comparador IA de pujas.
- Explicacion de ventajas y riesgos.
- Prompts controlados desde backend.

### Funciones IA iniciales

| Funcion | Usuario | Resultado |
|---|---|---|
| Mejorar publicacion | Finquero | Texto mas claro y comercial |
| Detectar datos faltantes | Finquero | Lista de campos recomendados |
| Buscar cosecha | Comprador | Opciones por zona, volumen y fecha |
| Comparar pujas | Finquero | Ranking explicado por valor total |

### Criterio de salida

La IA puede explicar por que una puja de menor precio puede ser mejor si incluye transporte, anticipo, compra total o pago mas rapido.

## Fase 5 - Cierre comercial y reputacion

**Objetivo:** conectar la decision de puja con una negociacion real y construir confianza.

### Alcance

- Enlace WhatsApp `wa.me` con mensaje precargado.
- Registro de contacto generado.
- Historial de pujas aceptadas.
- Calificacion simple despues del cierre.
- Reputacion basica de finqueros y compradores.

### Criterio de salida

Cuando el finquero acepta una puja, la plataforma revela el comprador, genera un mensaje de WhatsApp y registra el intento de cierre comercial.

## Fase 6 - Piloto con usuarios reales

**Objetivo:** probar la idea con productores y compradores reales o semi-reales.

### Alcance

- Cargar productores piloto.
- Cargar compradores/distribuidores piloto.
- Publicar cosechas reales o simuladas con datos verosimiles.
- Medir interes, dudas y fricciones.
- Ajustar campos de puja y publicacion.

### Metricas

- publicaciones creadas;
- pujas por publicacion;
- clics a WhatsApp;
- ofertas aceptadas;
- tiempo promedio para recibir primera puja;
- razones para aceptar o rechazar ofertas.

### Criterio de salida

El equipo tiene evidencia de que el flujo resuelve un dolor real y sabe que ajustes hacer antes de expandir.

## Fase 7 - Inteligencia comercial y prediccion

**Objetivo:** agregar analitica y prediccion cuando ya existan datos suficientes.

### Alcance

- Historial de precios por zona.
- Tendencias por fecha y volumen.
- Recomendaciones de precio de referencia.
- Scoring de compradores.
- Alertas de sobreoferta o demanda.
- Prediccion exploratoria con Python, Prophet o Scikit-learn.

### Criterio de salida

La plataforma puede orientar al productor con referencias de mercado basadas en datos propios o fuentes confiables, sin prometer predicciones sin sustento.

## Fase 8 - Escalamiento

**Objetivo:** preparar ADP para crecer mas alla del primer prototipo.

### Alcance

- Planes de suscripcion.
- Panel para asociaciones.
- Panel para administradores.
- Reportes agregados.
- Soporte para otros cultivos.
- Posible integracion de pagos.
- Posible trazabilidad de acuerdos.

### Criterio de salida

ADP puede operar como plataforma para una asociacion, feria agricola, programa municipal o red de productores.

## Prioridad recomendada

| Prioridad | Fase | Razon |
|---:|---|---|
| 1 | Fase 1 | Permite presentar rapido la idea |
| 2 | Fase 2 | Da base tecnica real |
| 3 | Fase 3 | Hace creible el sistema de pujas |
| 4 | Fase 4 | Cumple el componente IA de la actividad |
| 5 | Fase 5 | Conecta con negocio real |
| 6 | Fase 6 | Valida con usuarios |
| 7 | Fase 7 | Agrega inteligencia con datos |
| 8 | Fase 8 | Escala el modelo |

## Backlog inicial por roles

### Frontend

- Crear estructura React + Vite.
- Diseñar layout mobile-first.
- Crear pantallas de finquero.
- Crear vista de publicacion.
- Crear bandeja de pujas.
- Crear comparador visual.

### Backend

- Crear API Node.js + Express.
- Configurar Prisma + MySQL.
- Definir modelos.
- Implementar autenticacion.
- Implementar reglas de puja.
- Implementar endpoint de aceptacion.

### IA

- Definir prompts de mejora de publicacion.
- Definir prompt de comparacion de pujas.
- Crear servicio backend para IA.
- Evitar que la IA invente datos no registrados.

### Producto/documentacion

- Preparar pitch.
- Preparar demo de tres pujas.
- Definir caso piloto.
- Documentar decisiones tecnicas.
- Preparar matriz de rubrica.

## Version de demo esperada

La primera demo debe contar esta historia:

> Una finca en Casanare tiene 2.5 toneladas de platano harton listas para cosechar. El finquero publica la oferta con ayuda de IA. Tres compradores hacen pujas anonimas. La IA compara las condiciones y muestra que la mejor decision no es necesariamente la oferta mas alta, sino la que deja mejor valor neto y menor riesgo. El finquero acepta la puja y cierra por WhatsApp.
