# Fase 1 - Demo navegable terminada

## Estado

La Fase 1 cuenta con una demo React/Vite funcional, responsive y verificable con pruebas automáticas. Los datos, compradores, pujas e identidades son simulados y viven únicamente durante la sesión.

## Recorrido implementado

1. Ver el perfil de Finca La Esperanza.
2. Completar y validar los datos de una cosecha de plátano hartón.
3. Cargar hasta tres fotografías temporales o utilizar los activos locales de demostración.
4. Generar y aplicar un texto comercial mediante IA simulada.
5. Publicar la cosecha y revisar su vista pública.
6. Consultar tres compradores sugeridos y tres pujas anónimas.
7. Comparar precio bruto, valor neto, transporte, anticipo y plazo de pago.
8. Confirmar una puja, bloquear las demás y revelar únicamente al comprador ganador.
9. Abrir WhatsApp con un mensaje de cierre generado para la oferta seleccionada.
10. Reiniciar el estado para repetir la presentación.

## Imágenes

Las fotografías anteriores de bananos fueron reemplazadas por tres activos locales generados específicamente para mostrar plátano hartón verde:

- cultivo platanero en Casanare;
- racimo recién cosechado;
- lote clasificado y listo para cargue.

La carga de imágenes del formulario usa URLs temporales del navegador y no persiste archivos, comportamiento intencional para esta fase sin backend.

## WhatsApp

El destinatario se configura opcionalmente mediante `VITE_WHATSAPP_NUMBER`, usando formato internacional sin el signo `+`. Si la variable no existe, se abre WhatsApp con el mensaje precargado y sin destinatario.

## Ejecutar y verificar

```bash
npm install
npm run dev
```

La aplicación queda disponible en `http://127.0.0.1:5173`.

Los criterios técnicos se validan con:

```bash
npm run lint
npm test
npm run build
```

## Límite de la fase

No se incluyen backend, base de datos, autenticación, persistencia, pujas en tiempo real ni integración con un servicio de IA. Esos elementos pertenecen a las fases posteriores del roadmap.
