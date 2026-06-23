# Sistema de pedidos

La **oficina** carga el Excel del pedido, el **depósito** lo pickea desde el navegador, y todo se sincroniza en vivo. Los pedidos se guardan en **Supabase** (proyecto "Pedidos Deposito BM"), así que la PC y cualquier celular ven los mismos datos al instante. Falta solo publicarlo en Netlify para tener HTTPS (cámara) y acceso desde cualquier lado.

## Cómo correrlo

Necesitás servirlo desde `localhost` (no abrir el archivo directo), para que las dos pestañas compartan datos y la cámara funcione.

1. Abrí una terminal en esta carpeta (`picking-app`).
2. Ejecutá un servidor local. Con Python (ya instalado en la mayoría de las PC):

   ```
   python -m http.server 8080
   ```

3. Abrí en el navegador: **http://localhost:8080**

## Cómo probarlo

1. Entrá a **Oficina**. Hacé clic en *"generá un pedido de prueba"* o arrastrá `pedido-ejemplo-8087.xlsx`.
2. Revisá la previsualización (cruza cada SKU con la lista de precios y le pone nombre, EAN y DUN) y creá el pedido.
3. Abrí **Depósito** en otra pestaña. Vas a ver el pedido.
4. Pickeá: escribí/escaneá un EAN o DUN, o tocá *Pickear / Parcial / Sin stock*.
5. Volvé a la pestaña de Oficina: el avance se actualiza solo.

## Archivos

- `index.html` — pantalla de inicio (Oficina / Depósito)
- `office.html` — carga de Excel, cruce con catálogo, tablero de pedidos
- `warehouse.html` — pantalla de picking (escaneo, parcial, sin stock)
- `catalog.js` — 1.144 productos (SKU → EAN / DUN / nombre)
- `config.js` — conexión a Supabase (URL + clave pública)
- `store.js` — datos en Supabase con sincronización en vivo (realtime)
- `store-local-backup.js` — versión vieja solo-local (respaldo, no se usa)
- `pedido-ejemplo-8087.xlsx` — pedido de ejemplo para probar la carga

## Notas

- El cruce SKU → EAN/DUN sale de *Listado Precios BM Import AR*: 766 SKUs, todos con EAN, 764 con DUN.
- El lector de la lista de Excel detecta solo las columnas de SKU y cantidad. Cuando me pases el archivo de pedido real (`37658 - 8087.xlsx`), lo ajusto exacto.
- La cámara funciona en `localhost`; en el celular vía Netlify necesitará HTTPS (que Netlify da gratis).
