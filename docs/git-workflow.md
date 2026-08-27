# Configuracion Git para ADP

## Nombre del repositorio

Repositorio sugerido en GitHub:

```text
ADP
```

Descripcion sugerida:

```text
Asociacion de Plataneros: marketplace con IA para publicar cosechas, recibir pujas anonimas y comparar ofertas por valor real.
```

## Recomendacion al crear el repositorio en GitHub

En la pantalla de GitHub:

- Repository name: `ADP`
- Description: usar la descripcion sugerida.
- Visibility: `Public` si el proyecto se va a presentar abiertamente; `Private` si aun quieren trabajar cerrado con el equipo.
- Add README: `Off`, porque ya tenemos README local.
- Add .gitignore: `No .gitignore`, porque ya tenemos uno local.
- Add license: puede quedar pendiente hasta decidir licencia.

## Inicializacion local

Comandos usados o esperados:

```bash
git init
git branch -M main
git add .
git commit -m "chore: configura base documental de ADP"
```

## Conexion con GitHub

Despues de crear el repositorio vacio en GitHub, conectar el remoto:

```bash
git remote add origin https://github.com/yesid95/ADP.git
git push -u origin main
```

Si ya existe el remoto:

```bash
git remote set-url origin https://github.com/yesid95/ADP.git
git push -u origin main
```

## Flujo para el equipo

1. Clonar el repositorio.
2. Crear una rama por tarea.
3. Hacer commits pequenos.
4. Subir la rama.
5. Abrir pull request.
6. Revisar y mezclar a `main`.

## Nombres de ramas

```text
feature/perfil-finquero
feature/publicacion-cosecha
feature/pujas-anonimas
feature/comparador-ia
feature/cierre-whatsapp
docs/pitch
fix/validacion-pujas
```

## Protecciones recomendadas para GitHub

Cuando el repositorio ya este creado:

- Proteger rama `main`.
- Requerir pull request antes de mezclar.
- Evitar pushes directos a `main`.
- Revisar que no se suban secretos.
- Usar Issues para repartir tareas.

## Archivos importantes

- `README.md`: resumen ejecutivo del proyecto.
- `CONTRIBUTING.md`: reglas de colaboracion.
- `.gitignore`: archivos que no deben versionarse.
- `.gitattributes`: normalizacion de finales de linea.
- `docs/`: documentacion del proyecto.
