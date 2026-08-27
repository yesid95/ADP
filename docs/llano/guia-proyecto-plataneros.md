# Guia del proyecto - Plataneros del Llano

## Nota base

Este proyecto nace de una idea simple y comercialmente potente: crear una red social o marketplace para que finqueros plataneros publiquen sus cosechas y reciban pujas anonimas de compradores, distribuidores o aliados logisticos.

El productor conserva el control de la decision. La plataforma no obliga a aceptar la puja mas alta; le ayuda a entender cual oferta le conviene mas segun precio, transporte, anticipo, forma de pago, recoleccion, compra total, continuidad y riesgo.

## Vision

Convertir la comercializacion del platano en una negociacion mas transparente, competitiva e inteligente para el productor rural.

La plataforma debe ayudar a que el finquero pase de depender de pocos compradores conocidos a recibir ofertas comparables de una red mas amplia.

## Problema a resolver

En muchas cadenas agricolas, el productor pierde poder de negociacion porque:

- no tiene acceso facil a varios compradores;
- no sabe como publicar bien su cosecha;
- no puede comparar ofertas de forma estructurada;
- el transporte puede comerse buena parte de la ganancia;
- el pago tardio aumenta el riesgo;
- los acuerdos quedan dispersos por llamadas o WhatsApp;
- una oferta aparentemente alta puede ser peor en terminos netos.

## Propuesta de valor

### Para el finquero

- Publicar cosechas de forma facil.
- Recibir pujas anonimas.
- Comparar ofertas por valor real.
- Reducir dependencia de intermediarios.
- Conseguir mejores condiciones logisticas y de pago.
- Cerrar por WhatsApp cuando elija una puja.

### Para el comprador o distribuidor

- Encontrar cosechas disponibles por zona, fecha, volumen y calidad.
- Ahorrar tiempo buscando productores.
- Recibir recomendaciones segun necesidades de compra.
- Crear relacion con proveedores recurrentes.

### Para asociaciones o instituciones

- Visualizar oferta productiva.
- Agrupar productores.
- Medir movimiento comercial.
- Identificar zonas con sobreoferta o demanda.

## Flujo principal

1. El finquero crea su perfil.
2. Registra finca, municipio, vereda, cultivos y datos de contacto.
3. Publica una cosecha de platano.
4. La IA le ayuda a mejorar la publicacion.
5. Compradores buscan cosechas disponibles.
6. Compradores hacen pujas anonimas.
7. La IA compara las pujas por valor total.
8. El finquero acepta una oferta.
9. Se revela la identidad del comprador ganador.
10. Las partes cierran por chat o WhatsApp.

## MVP funcional

La primera version debe ser pequena, demostrable y centrada en el ciclo comercial.

### Modulos

| Modulo | Funcion |
|---|---|
| Perfil de finquero | Datos de finca, ubicacion, descripcion, cultivos y contacto |
| Publicacion de cosecha | Cantidad, fecha, fotos, acceso vial, precio esperado y condiciones |
| Buscador de cosechas | Filtros por municipio, volumen, fecha y tipo de platano |
| Pujas anonimas | Ofertas con precio, transporte, pago, recoleccion y observaciones |
| Asistente IA de publicacion | Mejora texto y detecta datos faltantes |
| Comparador IA de pujas | Resume mejor valor neto, riesgos y ventajas |
| Cierre comercial | Enlace a WhatsApp o chat interno simple |

## Datos principales

### Finquero

- id;
- nombre;
- nombre de finca;
- municipio;
- vereda;
- ubicacion aproximada;
- descripcion;
- telefono/WhatsApp;
- cultivos;
- reputacion;
- fecha de registro.

### Publicacion de cosecha

- id;
- finquero_id;
- tipo de platano;
- cantidad estimada;
- unidad;
- fecha estimada de cosecha;
- municipio/vereda;
- estado del cultivo;
- fotos;
- acceso vial;
- precio esperado opcional;
- acepta compra parcial;
- fecha limite para pujas;
- estado: abierta, cerrada, adjudicada.

### Puja

- id;
- publicacion_id;
- comprador_id;
- precio ofrecido;
- incluye transporte;
- recoge en finca;
- anticipo;
- plazo de pago;
- compra total o parcial;
- continuidad ofrecida;
- observaciones;
- estado: enviada, aceptada, rechazada.

### Comprador

- id;
- nombre o empresa;
- tipo: mayorista, distribuidor, tienda, restaurante, transportador;
- municipios de interes;
- volumen buscado;
- telefono/WhatsApp;
- reputacion.

## Logica de comparacion de pujas

La IA debe explicar, no imponer.

Debe comparar:

- precio bruto;
- costo logistico para el finquero;
- precio neto estimado;
- anticipo;
- plazo de pago;
- riesgo;
- compra total o parcial;
- continuidad comercial;
- confianza o reputacion del comprador.

Ejemplo de criterio:

```text
Valor estimado = precio ofrecido
               - costo logistico asumido por el finquero
               + valor del anticipo
               + valor de compra recurrente
               - riesgo por pago tardio
```

## Rol del chatbot

### Chat para finqueros

Ejemplos:

- "Ayudame a publicar mi cosecha."
- "Tengo 2 toneladas listas en 10 dias."
- "Que datos me faltan?"
- "Cual puja me conviene mas?"
- "Redacta una publicacion mas clara."

### Chat para compradores

Ejemplos:

- "Busco platano harton cerca de Yopal."
- "Necesito 3 toneladas esta semana."
- "Muestrame opciones donde pueda recoger en finca."
- "Cual cosecha tiene mejor costo total?"

## Modelo de negocio

El modelo inicial recomendado es una suscripcion economica para finqueros.

| Fuente | Pagador | Descripcion |
|---|---|---|
| Suscripcion basica | Finquero | Perfil y publicaciones limitadas |
| Suscripcion productor | Finquero | Publicaciones recurrentes, IA y comparador |
| Pago por publicacion | Finquero ocasional | Una cosecha publicada sin mensualidad |
| Comprador Pro | Comprador/distribuidor | Alertas, filtros avanzados y busqueda inteligente |
| Plan asociacion | Asociacion/cooperativa | Gestion de varios productores |
| Datos agregados | Instituciones | Reportes de oferta, demanda y zonas productivas |

## Rubrica de la actividad

| Criterio | Potencial |
|---|---|
| Pertinencia territorial | Alto: se enfoca en una cadena agricola real del Llano |
| Innovacion y creatividad | Medio-alto: pujas anonimas y comparacion por valor total |
| Viabilidad tecnica | Muy alto: se puede prototipar con web, base de datos, IA y WhatsApp |
| Impacto potencial | Alto: mejora negociacion, ingresos netos y acceso a compradores |
| Presentacion | Alto: la demo de una cosecha y tres pujas es clara |

## Demo sugerida

1. Crear perfil de una finca platanera.
2. Publicar una cosecha: 2.5 toneladas de platano harton disponibles en 8 dias.
3. Usar IA para mejorar la publicacion.
4. Mostrar tres pujas anonimas.
5. Pedir a la IA comparar las ofertas.
6. Elegir una puja.
7. Revelar comprador y abrir WhatsApp.

## Roadmap corto

### Version 0.1

- Maqueta navegable.
- Datos simulados.
- Perfil de finquero.
- Publicacion de cosecha.
- Pujas anonimas.
- Comparador visual de pujas.

### Version 0.2

- Chat IA para mejorar publicaciones.
- Buscador inteligente para compradores.
- Enlaces a WhatsApp.
- Reputacion basica.

### Version 0.3

- Panel para asociaciones.
- Alertas para compradores.
- Historial de transacciones.
- Reportes de mercado.

## Principios de producto

- El finquero decide.
- La IA recomienda, no reemplaza el criterio humano.
- La mejor oferta es la de mayor valor neto, no necesariamente la de mayor precio.
- La plataforma debe ser simple y usable desde celular.
- WhatsApp debe ser aliado, no enemigo.
- Empezar con platano antes de expandir a otros cultivos.

## Preguntas pendientes

- Zona piloto: Yopal, Tauramena, Aguazul, Maní u otra.
- Tipo de platano inicial: harton, dominico harton u otros.
- Cobro inicial: mensualidad, pago por publicacion o freemium.
- Las pujas deben tener tiempo limite fijo o definido por el finquero.
- La reputacion debe mostrarse antes o despues de aceptar una puja.
- La plataforma debe iniciar solo con platano o dejar arquitectura para otros cultivos.

## Definicion corta para presentar

**Plataneros del Llano** es una red comercial con IA donde finqueros publican cosechas de platano y compradores hacen pujas anonimas. La IA ayuda a redactar mejores publicaciones y a comparar ofertas por valor total: precio, transporte, anticipo, recoleccion, plazo de pago y continuidad. Asi el productor puede elegir la oferta que mas le conviene, no solo la que parece mas alta.
