# Fase 1 - Demo navegable implementada

## Estado

La Fase 1 ya cuenta con una primera demo React/Vite en la raiz del proyecto.

## Alcance implementado

- Interfaz mobile-first.
- Navegacion por secciones: finca, cosecha, mercado y pujas.
- Perfil de finca platanera con datos simulados.
- Publicacion de cosecha de platano harton.
- Asistente simulado para mejorar el texto comercial de la publicacion.
- Compradores sugeridos por zona y necesidad.
- Tres pujas anonimas con condiciones diferentes.
- Comparador visual de precio bruto, valor neto, transporte, anticipo y plazo de pago.
- Recomendacion IA simulada para explicar la mejor puja.
- Aceptacion de una puja.
- Enlace de cierre por WhatsApp.

## Archivos principales

- `package.json`
- `vite.config.js`
- `index.html`
- `src/main.jsx`
- `src/App.jsx`
- `src/styles.css`

## Pendiente tecnico

La instalacion de dependencias con `npm install` presento problemas de descarga en el entorno local por verificacion de certificado del registro npm y luego quedo sin progreso visible. El codigo fuente de la demo queda preparado para validarse cuando npm pueda instalar dependencias correctamente.

## Como ejecutar

Cuando las dependencias esten instaladas:

```bash
npm install
npm run dev
```

Luego abrir:

```text
http://127.0.0.1:5173
```

## Criterio de revision

La demo debe permitir contar esta historia:

> Una finca de Casanare publica 2.5 toneladas de platano harton. Tres compradores hacen pujas anonimas. La IA muestra que la mejor oferta no siempre es la de mayor precio bruto, sino la de mayor valor neto y menor riesgo para el productor.
