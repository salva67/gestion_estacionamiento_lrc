# Estacionamiento del Club

Sistema de reserva de estacionamiento para días de partido: los socios reservan su
lugar y pagan por transferencia al alias del club, y el día del partido el personal
de acceso registra los ingresos con el código QR de cada reserva.

## Las tres pantallas

| URL | Quién la usa | Protegida |
|---|---|---|
| `/` | Los socios: reservan y pagan | No |
| `/acceso.html` | Personal en la entrada el día de partido | Sí (usuario y contraseña) |
| `/admin.html` | El club: partidos, pagos, recaudación | Sí (usuario y contraseña) |

## Correr en una PC

```
npm install
npm start
```

Abre en `http://localhost:3000`. Usuario y contraseña por defecto para admin/acceso:
`club` / `cambiame`.

Los datos (partidos y reservas) se guardan en `data.json`. La primera vez se crea con
datos de ejemplo; para arrancar de cero, borrar ese archivo y reiniciar.

## Configuración (variables de entorno)

| Variable | Qué hace | Valor por defecto |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `DATA_FILE` | Ruta del archivo de datos | `data.json` junto al código |
| `ADMIN_USER` | Usuario de admin y acceso | `club` |
| `ADMIN_PASS` | Contraseña de admin y acceso | `cambiame` |
| `SEED` | Con `off`, arranca sin datos de ejemplo (usar en producción) | genera datos de ejemplo |

## Deploy en Railway (recomendado para uso real)

1. Subir este proyecto a un repositorio de GitHub (sin `node_modules` ni `data.json`;
   el `.gitignore` ya los excluye).
2. En [railway.app](https://railway.app): **New Project → Deploy from GitHub repo**.
3. En el servicio, pestaña **Settings → Volumes**: agregar un volumen montado en `/data`
   (ahí viven las reservas y sobreviven a los reinicios).
4. En **Variables**, definir:
   - `DATA_FILE` = `/data/data.json`
   - `ADMIN_USER` = el usuario que elijan
   - `ADMIN_PASS` = una contraseña fuerte
5. Railway detecta Node automáticamente y ejecuta `npm start`. En **Settings →
   Networking → Generate Domain** se obtiene la URL pública con HTTPS.

Al entrar por primera vez, ir a `/admin.html`, cargar el alias real del club y crear
el primer partido.

## Deploy en Render (demo gratuita)

Igual de simple (**New → Web Service** desde el repo de GitHub), pero en el plan
gratuito la app se duerme tras 15 minutos sin uso y **los datos se borran en cada
reinicio**. Sirve para mostrar el sistema, no para vender lugares reales.
