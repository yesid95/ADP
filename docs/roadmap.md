# Roadmap por fases - ADP

## Objetivo del roadmap

Este roadmap organiza el desarrollo de **ADP - Asociacion de Plataneros** en fases incrementales. La idea es avanzar desde una demo convincente hasta una plataforma usable por finqueros, compradores y asociaciones.

El principio central es construir primero el ciclo comercial completo:

```text
Finquero publica cosecha -> comprador puja -> IA compara -> finquero acepta -> cierre por WhatsApp
```

## Estado actual

| Fase | Estado | Resultado |
|---|---|---|
| Fase 0 | Terminada | Repositorio, documentación y flujo de trabajo disponibles |
| Fase 1 | Terminada y verificada | Demo React/Vite navegable, responsive y cubierta por pruebas |
| Fase 2 | En desarrollo | Núcleo backend implementado; faltan siete frentes de integración, seguridad, frontend y operación para cerrar la fase |

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

**Estado:** terminada y verificada como demo React/Vite. Ver `docs/fase-1-demo.md`.

### Alcance

- Interfaz React mobile-first.
- Datos simulados.
- Perfil de finca platanera.
- Publicacion de una cosecha.
- Lista de compradores/pujadores anonimos.
- Tres pujas de ejemplo.
- Comparador visual de pujas.
- Pantalla de aceptacion de puja.
- Asistente de redacción simulado.
- Fotografías locales de plátano hartón y carga temporal de imágenes.
- Revelación del comprador ganador y cierre por WhatsApp.
- Pruebas automáticas del recorrido principal.

### Modulos

- Home/dashboard simple.
- Perfil de finquero.
- Formulario de publicacion de cosecha.
- Vista publica de cosecha.
- Bandeja de pujas anonimas.
- Comparador de valor total.

### Criterio de salida alcanzado

Se puede hacer una demo de 3 minutos:

1. Ver perfil de finca.
2. Publicar cosecha.
3. Recibir tres pujas anonimas.
4. Comparar precio, transporte, anticipo y plazo de pago.
5. Elegir la mejor oferta.
6. Confirmar la aceptación y revelar al comprador ganador.
7. Abrir WhatsApp con el mensaje de cierre precargado.

## Fase 2 - MVP tecnico

**Objetivo:** convertir la demo en una aplicacion con backend y datos persistentes.

### Alcance

- Backend Node.js + Express.
- Base de datos MySQL 8.4 con InnoDB.
- ORM Prisma con migraciones y llaves foráneas reales.
- Autenticación con Argon2id, JWT de acceso corto y refresh token rotatorio.
- Roles: finquero, comprador, administrador.
- MFA obligatorio para administradores.
- Contactos privados cifrados y separados del módulo de mercado.
- CRUD de perfiles.
- CRUD de publicaciones de cosecha.
- Creación de pujas con versiones inmutables.
- Adjudicación única mediante transacción y restricciones.
- Validaciones de negocio en backend y base de datos.
- Auditoría append-only, permisos mínimos y respaldos restaurables.

### Modulos

- API de usuarios.
- API de perfiles de finquero.
- API de perfiles de comprador.
- API de publicaciones.
- API de pujas.
- Middleware de autenticacion.
- Validaciones de estado de publicacion.
- Módulo de sesiones y seguridad.
- Módulo de auditoría.

### Diseño de datos

La especificación de tablas, relaciones, columnas, tipos, índices, seguridad y lógica transaccional está en `docs/fase-2-base-de-datos/README.md`.

### Criterio de salida

El sistema guarda usuarios, fincas, cosechas y ofertas en MySQL. Un comprador puede ofertar y revisar sus condiciones sin borrar el historial, y un finquero puede aceptar una sola oferta válida aun bajo solicitudes concurrentes. Los contactos permanecen cifrados y ocultos hasta la adjudicación, y el esquema puede restaurarse desde respaldos probados.

El estado verificable de los siete frentes de cierre se mantiene en `docs/fase-2-backend.md`. Mientras MySQL real, CRUD, MFA, permisos, concurrencia, frontend persistente y restauración no estén demostrados, la fase permanece en desarrollo.

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

## Prioridad recomendada desde el estado actual

| Prioridad | Fase | Razon |
|---:|---|---|
| 1 | Fase 2 | Da base técnica real y persistencia a la demo validada |
| 2 | Fase 3 | Hace confiable el sistema de pujas en vivo |
| 3 | Fase 4 | Integra IA comercial real |
| 4 | Fase 5 | Conecta la decisión con reputación y cierre comercial |
| 5 | Fase 6 | Valida el producto con usuarios |
| 6 | Fase 7 | Agrega inteligencia basada en datos |
| 7 | Fase 8 | Escala el modelo |

## Backlog inicial por roles

### Frontend

- [x] Crear estructura React + Vite.
- [x] Diseñar layout mobile-first.
- [x] Crear pantalla de perfil de finca.
- [x] Crear formulario y vista pública de la cosecha.
- [x] Crear mercado de compradores sugeridos.
- [x] Crear bandeja y comparador visual de pujas.
- [x] Implementar aceptación única, revelación y WhatsApp.
- [x] Añadir pruebas de interacción y activos locales de plátano.

### Backend

- [x] Crear base de API Node.js + Express.
- [x] Configurar Prisma para MySQL.
- [x] Definir modelos y migración inicial.
- [x] Implementar núcleo de autenticación y sesiones.
- [x] Implementar reglas y versiones de oferta.
- [x] Implementar endpoint transaccional de aceptación.
- [x] Validar ciclo completo contra MySQL 8.4 en CI.
- [ ] Separar cuentas MySQL y completar hardening de producción.
- [x] Documentar arquitectura, relaciones, columnas, seguridad y plan de pruebas de la base de datos.

### IA

- [x] Implementar simulación determinista de mejora de publicación.
- [x] Implementar recomendación simulada de la mejor oferta.
- [ ] Definir prompts para la integración real.
- [ ] Crear servicio backend para IA.
- [ ] Evitar que la IA invente datos no registrados.

### Producto/documentacion

- [ ] Preparar pitch.
- [x] Preparar demo de tres pujas.
- [ ] Definir caso piloto.
- [x] Documentar estado y decisiones técnicas de la Fase 1.
- [ ] Preparar matriz de rúbrica.

## Versión de demo implementada

La demo actual cuenta esta historia:

> Una finca en Casanare tiene 2.5 toneladas de plátano hartón listas para cosechar. El finquero publica la oferta con ayuda de IA simulada. Tres compradores hacen pujas anónimas. El comparador muestra que la mejor decisión no es necesariamente la oferta más alta, sino la de mejores condiciones y menor riesgo. El finquero confirma la puja, conoce al comprador ganador y abre el cierre por WhatsApp.
