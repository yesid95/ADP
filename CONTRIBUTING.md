# Guia de colaboracion

## Proyecto

El proyecto se llama **ADP**, por **Asociacion de Plataneros**.

ADP es una plataforma comercial con IA para que finqueros plataneros publiquen cosechas, reciban pujas anonimas y elijan la mejor oferta segun valor real: precio, transporte, anticipo, recoleccion, plazo de pago y continuidad comercial.

## Flujo de trabajo en Git

Usaremos una rama principal estable:

```text
main
```

Cada integrante debe trabajar en ramas separadas:

```text
feature/nombre-corto
fix/nombre-corto
docs/nombre-corto
```

Ejemplos:

```text
feature/perfil-finquero
feature/pujas-anonimas
feature/comparador-ia
docs/modelo-negocio
fix/validacion-puja
```

## Reglas basicas

- No trabajar directamente sobre `main`.
- Antes de iniciar una tarea, traer los ultimos cambios de `main`.
- Hacer commits pequenos y claros.
- Abrir pull request para integrar cambios.
- No subir `.env`, claves API, contrasenas ni tokens.
- Documentar decisiones importantes en `docs/`.

## Estilo de commits

Usaremos mensajes simples:

```text
docs: agrega guia de negocio
feat: crea perfil de finquero
feat: agrega pujas anonimas
fix: corrige validacion de fecha limite
chore: configura gitignore
```

## Stack acordado

```text
Frontend: React + Vite + Tailwind CSS
Backend: Node.js + Express
Base de datos: MySQL
ORM: Prisma
Tiempo real: Socket.IO
Autenticacion: JWT + bcrypt
IA: servicio externo consumido desde backend
Cierre comercial: WhatsApp wa.me
```

## Primer MVP

El primer objetivo del equipo es demostrar:

1. Perfil de finquero.
2. Publicacion de cosecha.
3. Busqueda de cosechas.
4. Tres pujas anonimas.
5. Comparador IA de pujas.
6. Aceptacion de una puja.
7. Cierre por WhatsApp.
