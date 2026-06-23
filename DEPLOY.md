# Publicar en GitHub + Netlify

Objetivo: que cada cambio se publique solo. Subimos el proyecto a un repositorio
**privado** de GitHub y conectamos Netlify para que se actualice en cada cambio.

## 1) Subir a GitHub (con GitHub Desktop — sin terminal)

1. Instalá **GitHub Desktop**: https://desktop.github.com  → iniciá sesión con tu cuenta.
2. *File → Add local repository* → elegí la carpeta `picking-app`.
   - Si pregunta por crear un repositorio acá, decí que sí (*create a repository*).
3. Te va a mostrar los archivos. Escribí un resumen (ej. "primera versión") y
   *Commit to main*.
4. Botón **Publish repository**.
   - **Importante:** dejá tildado **"Keep this code private"**.
5. Listo: el código está en GitHub (privado).

## 2) Conectar Netlify (deploy automático)

1. Entrá a https://app.netlify.com → *Add new site → Import an existing project*.
2. Elegí **GitHub** y autorizá el acceso al repositorio que creaste.
3. Configuración de build:
   - **Build command:** (dejar vacío)
   - **Publish directory:** `.`  (la raíz del repo)
4. *Deploy site*. En ~1 minuto te da una URL `https://....netlify.app`.
   - Esa URL tiene HTTPS, así que la **cámara del celular funciona**.
5. (Opcional) Renombrá el sitio o ponele un dominio en *Site settings → Domain*.

## 3) Cómo se actualiza de ahora en más

1. Cuando cambiamos algo en los archivos, abrís **GitHub Desktop**.
2. Vas a ver los cambios → escribí un resumen → *Commit to main* → *Push origin*.
3. Netlify detecta el push y publica solo en ~1 minuto.

## Notas

- El repo es **privado** a propósito: `catalog.js` tiene tu lista de productos y
  `config.js` la clave pública de Supabase.
- Antes de compartir la URL con todo el depósito conviene agregar un **PIN** de
  acceso simple (lo podemos hacer cuando quieras).
- Los pedidos viven en Supabase (proyecto "Pedidos Deposito BM"), no en Netlify;
  por eso el deploy no afecta los datos.
