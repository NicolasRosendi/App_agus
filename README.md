# VELOX // UNDERGROUND

Red social de autos con juntadas privadas y mapa táctico. Demo **PWA** (web app instalable en Android e iOS) inspirada en Velox, con estética Need for Speed Carbon + Watch Dogs + graffiti noventoso.

**Stack:** Node + Express (API + estáticos) · React 18 + Vite · Leaflet (mapa) · three.js / react-three-fiber (3D).

## Qué trae la demo

| Módulo | Qué hace |
| --- | --- |
| **Feed** | Posts con foto o arte generado, likes (doble tap), comentarios, tags. Ranking "Para vos" personalizado por intereses + seguidos. |
| **Reels** | Videos verticales con scroll snap, autoplay del visible, likes y comentarios. |
| **Mapa táctico** | Reportes estilo Waze (cámaras, radares, controles, calles rotas, accidentes, obras) con confirmar/desmentir; talleres, tuning, lavaderos, estaciones y gomerías estilo blips de GTA; capas personalizables; vista 3D inclinada. |
| **Ruta fantasma** | Ruta predictiva que pide alternativas a OSRM, puntúa cada una según los reportes que cruza (y lo que cada usuario eligió evitar) y, si hace falta, prueba desvíos con waypoints fantasma alrededor del obstáculo. |
| **Juntadas** | Modo *underground* (zona cifrada en el mapa, se pide acceso) o *fantasma* (invisible, solo con código). La coordenada exacta **nunca sale del servidor** hasta que el usuario está aprobado (y opcionalmente hasta X horas antes). |
| **Panel de ops** | El organizador controla todo: cola de validación, motor de reglas automático (rep mínima, patente verificada, categorías, crews de confianza, modo estricto, lista de espera con promoción automática), códigos de invitación (usos, vencimiento, auto-aprobación), broadcast, revelar ubicación, check-in por pase, expulsar/banear, co-organizadores, log de operaciones. |
| **Perfil / Garage** | Autos con foto + patente (enmascarada para terceros, "verificado" con foto+patente), garage 3D con selector de color, nivel por reputación, badges. |
| **Modo pasos** | Teaser: puntos acumulados por reportar/validar y recompensas bloqueadas (descuentos en talleres/lavaderos/estaciones). |

Usuarios demo (clave `velox`): **ghost** (organizador), **turbo_vale** (piloto), **drift_kid** (novato), **nyx**, **v8bruno**. Código de invitación de ejemplo para la juntada fantasma: `NYX-0451`.

## Correr local

```bash
npm run install:all
npm run dev:server   # API en :4000
npm run dev:client   # Vite en :5173 (proxy /api → :4000)
```

Producción local: `npm run build && npm start` → http://localhost:4000

## Deploy en Render

El repo incluye `render.yaml` (Blueprint). En Render: **New → Blueprint** → elegir este repo → branch `main`. Crea un Web Service Node con:

- Build: `npm run build`
- Start: `npm start`
- Health check: `/api/health`
- `JWT_SECRET` autogenerado

> Para la demo los datos viven en `server/data/db.json` y los archivos subidos en `server/uploads/`. En Render el disco es efímero: cada deploy/reinicio vuelve a sembrar los datos de ejemplo. Para producción: Postgres + almacenamiento de objetos (S3/R2).

Variables opcionales: `OSRM_URL` (motor de rutas propio; por defecto el servidor público de OSRM), `DATA_DIR`, `UPLOAD_DIR`.

## Instalar en el celular

- **Android (Chrome):** menú ⋮ → *Instalar app*.
- **iPhone (Safari):** Compartir → *Agregar a inicio*.

Para publicar en las stores más adelante, el mismo frontend se puede empaquetar con Capacitor sin reescribirlo.

## Estructura

```
server/src
  index.js         Express: API + estáticos del cliente
  db.js / seed.js  Store JSON + datos de ejemplo (CABA)
  automation.js    Motor de reglas de las juntadas
  routes/          auth, users, feed, map, meets, routing
client/src
  pages/           Login, Feed, Reels, MapPage, Meets, MeetDetail, MeetOps, CreateMeet, Profile, Garage, Steps, Settings
  components/      Scene3D (three.js), TacticalMap, PassCard, RulesEditor, PostCard…
  styles/          global.css (sistema visual) + screens.css
```

## Próximos pasos sugeridos

- Base de datos real y storage de medios.
- Verificación de patente (OCR + revisión manual) y validación de identidad.
- Tiempo real (WebSockets) para alertas y broadcasts.
- Modo pasos: tracking de distancia en segundo plano (requiere app nativa vía Capacitor).
- Push notifications.
