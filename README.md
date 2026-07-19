# ENEL·LUZ — Centro de Control de Cortes de Energía

Visor de **control de mando** para los cortes de energía de Enel Chile (zona RM),
**100% client-side**: sin backend propio, todo el procesamiento ocurre en tu navegador.

> ⚠️ Proyecto **no oficial**, sin afiliación con Enel. Los datos provienen de los
> archivos GeoJSON públicos que alimentan el
> [mapa oficial de cortes](https://www.enel.cl/es/clientes/emergencias/mapa-en-linea-cortes.html),
> espejados en este repo cada 5 minutos.

![flat design](https://img.shields.io/badge/dise%C3%B1o-flat-141414)
![client-side](https://img.shields.io/badge/procesamiento-100%25%20browser-12a150)
![datos](https://img.shields.io/badge/datos-espejo%20c%2F5%20min-00a0dc)

## Características

**🗺️ Mapa (MapLibre GL)**
- 3 mapas base: vectorial **flat oscuro**, vectorial **flat claro** y **satelital** (Esri World Imagery)
- Coropleta de comunas por % de clientes afectados, incidencias, descargos y ~5.000 avisos con clustering
- Bordes/etiquetas que se adaptan al basemap para legibilidad

**🎛️ Panel de capas estilo kepler.gl**
- Eye-toggles con conteo de features por capa, panel colapsable
- Selector de basemap con thumbnails reales

**📊 Tablero en vivo (Apache ECharts)**
- Banda KPI: clientes afectados, % suministro, incidencias, avisos, descargos, comunas
- Clientes por comuna (coloreado por severidad), inicios por hora, donut de estados, ranking por evento
- Cross-filtering: click en el gráfico → zoom y highlight en el mapa

**🧭 Geoprocesos en el navegador (Turf.js)**
- **¿Mi dirección está afectada?** — buscador OSM (Photon) → point-in-polygon + ETA de reposición
- **Radio de análisis** — buffer 500 m: avisos, incidencias y clientes dentro
- **Filtro por zona** — dibuja un polígono y filtra mapa + gráficos
- **Densidad (hexbin)** — grilla hexagonal de concentración de avisos
- **Incidencia más cercana** — desde cualquier click, con distancia y ETA

**🌗 UI**
- Modo claro / oscuro con un clic (persistente), tipografía IBM Plex Sans/Mono
- Flat design estricto: cero sombras/gradientes, jerarquía por bloques de color
- Leyenda contextual (cambia según la capa activa), reloj local + timestamp de datos
- Auto-refresh: verifica datos nuevos cada 60 s y recarga solo si cambiaron

## Arquitectura

```
Enel (GeoJSON públicos, sin CORS)
   │  GitHub Actions cron */5 min  (.github/workflows/update-data.yml)
   ▼
public/data/*.geojson          ← espejo mismo-origen, commit solo si hay cambios
   │  build estático (Vite + TS vanilla)
   ▼
GitHub Pages                   (.github/workflows/deploy.yml)
```

Costo total: **$0** (Actions y Pages son gratis en repos públicos).

## Desarrollo

```bash
npm install
npm run fetch-data   # descarga/actualiza el espejo en public/data/
npm run dev          # http://localhost:5173
npm run build        # build de producción a dist/
npm run preview      # sirve dist/ en http://localhost:4173
```

Test E2E (requiere Chrome + `npm run preview` corriendo):

```bash
node scripts/smoke.mjs http://localhost:4173/
```

## Deploy propio (fork)

1. Haz fork o sube este código a un repo **público**
2. **Settings → Pages → Build and deployment → GitHub Actions**
3. Listo: `deploy.yml` publica en cada push a `main` y `update-data.yml`
   mantiene los datos frescos solo (sus commits no disparan rebuilds)

> GitHub desactiva los workflows programados tras 60 días sin actividad del
> repo; se reactivan con un clic en la pestaña Actions.

## Stack

Vite 6 · TypeScript vanilla · MapLibre GL JS · Apache ECharts · Turf.js ·
OpenFreeMap/OpenMapTiles (OSM) · Esri World Imagery · Photon (geocoding OSM) ·
IBM Plex (self-hosted)

## Documentación para agentes

[`AGENTS.md`](AGENTS.md) contiene el contexto completo del proyecto: fuente de
datos, decisiones de arquitectura, trampas ya resueltas y convenciones.

## Licencia

MIT — ver [LICENSE](LICENSE). Los datos pertenecen a Enel Chile; los mapas a
© OpenStreetMap contributors / OpenMapTiles / Esri según corresponda.
