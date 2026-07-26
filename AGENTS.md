# AGENTS.md — Contexto del proyecto (para agentes/modelos)

> Este archivo documenta qué es el proyecto, cómo funciona end-to-end, qué se
> decidió y por qué, y las trampas ya resueltas. Léelo completo antes de tocar código.
>
> **Continuidad cross-session**: leyó `HANDOFF.md` (en este repo) antes de
> tocar código. Contiene estado de la última sesión, pendientes, bloqueantes
> y próximos pasos. Sin él, perdés contexto entre sesiones. Actualizálo al
> final de cada sesión de trabajo.

## Qué es esto

**LUZ·RM — Centro de control de cortes de energía** (zona RM; datos operativos
publicados por Enel Chile).
Visor de "control de mando" 100% client-side, open source (MIT), deployado en
GitHub Pages. Proyecto **independiente**, sin afiliación con Enel. La palabra
“Enel” se usa únicamente para identificar la fuente de datos.

- Repo: `enel-luz` (público)
- Producción: GitHub Pages (deploy vía GitHub Actions)
- Usuario GitHub: `geoidegeoidal`

## Fuente de datos (hallazgo clave de la investigación)

La página oficial de cortes de Enel (`enel.cl/.../mapa-en-linea-cortes.html`,
protegida por Imperva/Incapsula) embebe un iframe con la app
`https://mapaemergencia.enel.com/mapa.html`. Esa app (Google Maps + jQuery)
**no usa un API**: lee **archivos GeoJSON planos** regenerados por Enel cada
pocos minutos en el directorio fijo `galeria/documento/`:

| Archivo remoto | Espejo local (`public/data/`) | Contenido |
|---|---|---|
| `me-capa-estado.txt` | `estado.json` | Heartbeat: `{datos:"DD/MM HH:mm", porcentaje}` — timestamp de publicación (hora Chile UTC-4) |
| `me-capa-avisos.txt` | `avisos.geojson` | Avisos de clientes (Point). ~4-5k features, ~2,2 MB |
| `me-capa-trafosAfectados.txt` | `trafos.geojson` | Incidencias/trafos (Polygon). `INCIDENCIA` se repite entre trafos del mismo evento |
| `me-capa-descargos.txt` | `descargos.geojson` | Descargos = fallas agrupadas (Polygon) |
| `me-capa-comunasAfectadas.txt` | `comunas.geojson` | Comunas (Polygon): `PORCENTAJE`, `CLIENTESAFECTADOS`, `CLIENTESTOTAL` |
| `me-capa-alimAfectados.txt` | `alimentadores.geojson` | OPCIONAL, suele dar 404 |

- Campos de fechas: `FECHA_INI`, `FECHA_INICIO`, `FECHA_REPOSICION` en formato
  `DD-MM-YYYY HH:mm` (parse flexible en `src/data/model.ts: parseFecha`).
- Nombres de comuna vienen con underscore (`LA_FLORIDA`) → `prettyName()` solo
  para display; los filtros usan el valor crudo.
- `INCIDENCIA` agrupa varios trafos del mismo evento → el ranking agrega por ID
  sumando `CLITOTAL`.

## Pipeline de datos (espejo)

El servidor **no envía cabeceras CORS** → el browser no puede leer Enel directo.
Solución adoptada (decidida con el usuario): **espejo con GitHub Actions**.

- `scripts/fetch-data.mjs`: compara `datos` remoto vs local; si cambió descarga
  las capas (User-Agent de browser, reintentos, 404 tolerado en opcionales).
  Escribe `estado.json` AL FINAL (es el marcador de commit). `--force` fuerza.
- `.github/workflows/update-data.yml`: cron `*/5 * * * *` (best-effort, GitHub
  puede atrasarlo; se desactiva tras 60 días sin actividad del repo → reactivar
  manualmente en Actions). Commit solo si hay cambios. **Costo $0 en repo público**.
- `.github/workflows/deploy.yml`: build Vite → Pages en cada push a `main`.
  Los commits automáticos de datos SÍ deben disparar un rebuild completo porque GitHub
  Pages sirve un artefacto estático (`dist/`) que debe recompilarse para incluir el nuevo JSON.

## Stack y estructura

Vite 6 + TypeScript vanilla (sin framework). Sin backend propio.

- **Mapa**: MapLibre GL JS. Basemaps propios en `src/map/basemap.ts`:
  vectorial flat dark/light sobre OpenFreeMap (OpenMapTiles, glyphs en
  `tiles.openfreemap.org/fonts/`) y satelital (raster Esri World Imagery +
  capa Reference de etiquetas). Cambio con `map.setStyle(style, {diff:false})`.
- **Gráficos**: Apache ECharts tree-shaken (`src/charts/charts.ts`).
  El reloj operativo usa 25 buckets horarios centrados en “AHORA” (−12/+12 h)
  y combina inicios del snapshot activo con ETA futuras/vencidas. La escala de
  reposición ordena eventos únicos por minutos respecto de la hora actual.
- **Geoprocesos client-side**: Turf.js (`src/geo/`): point-in-polygon
  (¿dirección afectada?), buffer 500 m, filtro por polígono dibujado
  (`drawFilter.ts` propio, sin maplibre-gl-draw), hexbin (`hexGrid`+`collect`),
  incidencia más cercana (distancia a centroides).
- **Geocoding**: Photon (`photon.komoot.io`, CORS abierto, bbox RM) con
  fallback Nominatim (`src/geo/search.ts`).
- **Fuentes**: IBM Plex Sans/Mono vía @fontsource (self-hosted).
- Estado central mínimo: `src/state.ts` (store con pub/sub: data, filterPoly,
  selectedComuna). `selectedComuna` es un cross-filter real: limita mapa,
  clusters, hexbin, KPIs y todos los gráficos al polígono comunal.

### Archivos clave

- `src/theme.ts`: tokens (paletas UI_LIGHT/UI_DARK, colores señal, severidad
  0-5/5-15/15-50/+50). `ui` es la paleta activa MUTABLE (los gráficos la leen
  en cada render; `applyUiMode` la cambia y persiste en localStorage).
- `src/map/layers.ts`: fuentes/capas de datos, popups, filtros por ID,
  visibilidad, `adaptLayersToBasemap` (bordes/labels de comuna blancos en
  satelital), highlight de comuna.
- `src/ui/ui.ts`: panel de capas estilo kepler.gl (eye-toggles, conteos,
  collapse, thumbnails de basemap), leyenda contextual (escala graduada que
  cambia comuna↔hexbin), guía numerada con highlight por herramienta, toast.
- `src/main.ts`: orquestador. `restoreMapState()` re-aplica visibilidad/hexbin/
  overlay/highlight tras cambiar basemap. Auto-refresh: poll `estado.json` c/60 s
  con barra de progreso; reloj local + timestamp DATOS en masthead.
- `src/report/report.ts`: modelo y plantilla client-side del reporte operativo
  RM/comuna. Genera mapa SVG operacional con severidad, incidencias activas y
  avisos, dos páginas A4 apaisadas y vista previa; el botón de impresión permite
  guardar PDF sin enviar datos fuera del navegador.
- `.interface-design/system.md`: sistema visual persistente (tokens, retícula,
  patrones de dashboard y reporte). Leerlo antes de diseñar componentes nuevos.
- `scripts/smoke.mjs`, `scripts/shots*.mjs`: tests E2E con puppeteer-core +
  Chrome instalado (headless). `smoke.mjs` verifica carga, búsqueda, radio,
  nearest, hexbin y reportes RM/comuna. `__mapDebug` (window) expone estado del
  mapa para los tests.

## Diseño (exigencia del usuario)

**Flat design estricto**: rellenos sólidos de un color, CERO gradientes/sombras/
biseles (`box-shadow: none !important` global), bordes 1px, iconos geométricos
de un color, jerarquía por bloques de color + tamaño + tipografía, contraste
≥4.5:1, foco con anillo 2px, animaciones solo opacity/transform.
Dirección: "panel de instrumentos suizo" — UI clara papel+tinta (o dark mode)
con el mapa como viewport oscuro enmarcado. **No volver a la estética oscura
genérica tipo "AI slop"** (fue rechazada explícitamente).

## Trampas ya resueltas (no repetir)

1. **CORS**: Enel no envía `Access-Control-Allow-Origin` → siempre espejo.
2. **SPA fallback**: dev/preview devuelve `index.html` (200) para archivos
   inexistentes → `loader.ts` valida que la respuesta empiece con `{`/`[` y
   trata HTML como null para capas opcionales.
3. **`setStyle` con `diff:true` NO re-emite `style.load`** → capas de datos
   desaparecían al cambiar basemap. Usar `{diff:false}` y re-añadir todo en el
   handler de `style.load` (handlers de eventos del mapa sobreviven al setStyle;
   NO volver a adjuntarlos: flag `attachHandlers`).
4. **OpenMapTiles no tiene source-layer `globallandcover`** (schema Mapbox) —
   usar `landuse`, `water`, `transportation`, `boundary`, `place`, `building`.
5. **`INCIDENCIA` duplicado entre trafos**: Un evento genera múltiples polígonos. **NO SUMAR `CLITOTAL`** entre ellos, porque ese campo ya trae el total del evento; usar `Math.max` o deduplicar por ID para gráficos y KPIs o se inflarán masivamente las cifras.
6. **Especificidad CSS**: la clase `.active` genérica de `button` ensuciaba los
   thumbnails de basemap → backgrounds explícitos.
7. **`headless=new` + `--virtual-time-budget` NO espera tiles ni WebGL** → los
   screenshots de Chrome headless "pelados" eran falsos negativos; usar
   puppeteer-core con esperas reales para verificar.
8. Timestamp `datos` = **hora local Chile (UTC-4)**, no UTC. Enel republica
   cada pocos minutos.
9. **GitHub Pages con Vite no se actualiza sin rebuild completo**: Originalmente se excluyó `public/data/**` en `deploy.yml` creyendo que GitHub Pages serviría los JSON sueltos. FALSO. Al usar un action para el deploy (`deploy-pages`), se sirve exclusivamente un artefacto (`dist/`) generado por Vite. Los cambios de datos *deben* disparar el deploy para que el artefacto resultante los incluya.
10. **Geocoding fuera de RM**: declarar un bbox no sirve si no se envía. Photon
    usa `bbox=minLon,minLat,maxLon,maxLat`; Nominatim requiere `viewbox` +
    `bounded=1`. Mantener además la validación client-side `isInsideRm()` para
    descartar respuestas defectuosas de cualquiera de los proveedores.
11. **Los filtros de capa no recortan las fuentes**: filtrar solo las capas
    renderizadas no cambia los clusters y puede volver a mostrar polígonos
    duplicados de una incidencia que cruza el alcance. Para un filtro espacial,
    reemplazar `src-avisos`, `src-trafos` y `src-descargos` por sus
    FeatureCollections visibles; restaurar las colecciones completas al limpiar.
12. **Deduplicar también en geoprocesos**: la regla de `INCIDENCIA` duplicada no
    aplica solo a KPIs y gráficos. Diagnóstico por punto, buffers y cualquier
    agregación futura deben usar `dedupeIncidencias()` antes de contar eventos o
    sumar `CLITOTAL`.
13. **El reloj operativo NO es historia persistida**: los inicios, edades y
    presión horaria se derivan únicamente de eventos todavía presentes en el
    snapshot activo. No rotularlos como “histórico” ni inferir reposiciones
    efectivas; `FECHA_REPOSICION` es una ETA y puede estar vencida/reestimándose.
14. **Comuna + polígono exige intersección geométrica real**: comprobar que una
    incidencia toca ambos polígonos por separado produce falsos positivos. Crear
    primero `intersect(comuna, filtro)` y evaluar todos los features contra esa
    geometría común; si no existe intersección, el alcance queda vacío.
15. **Fechas Enel siempre en `America/Santiago`**: los campos sin offset no
    pertenecen a la zona horaria del navegador. Parsear, agrupar y rotular horas
    explícitamente en Chile; los gráficos temporales se recalculan cada minuto
    aunque no cambie el snapshot.
16. **Una comuna puede venir en varias geometrías**: no usar `find(COMUNA)` ni
    sumar `CLIENTESTOTAL` por feature. El alcance debe combinar todas las
    geometrías del mismo nombre; KPIs, ranking y reportes suman afectados pero
    usan el máximo `CLIENTESTOTAL` una sola vez (`aggregateComunas()`).

## Comandos

```bash
npm install
npm run fetch-data    # espejo a public/data/ (--force para forzar)
npm run dev           # desarrollo (sirve public/ directo)
npm test              # regresiones unitarias (Vitest)
npm run build         # producción a dist/ (incluye copia de public/data)
npm run preview       # sirve dist/
node scripts/smoke.mjs http://localhost:4173/   # E2E (requiere preview corriendo)
node scripts/report-pdf.mjs http://localhost:4173/ RM output/pdf/reporte-rm.pdf
```

## Deploy (ya configurado)

Repo público → Actions gratis ilimitados + Pages gratis.
Pages: `build_type: workflow` (el deploy lo hace `deploy.yml`, no "branch").
Secrets: ninguno (usa `GITHUB_TOKEN` automático con `permissions: pages/id-token`).

## Pendientes / ideas futuras (no implementado)

- Snapshots históricos / replay de emergencia (decidido NO hacerlo: repo liviano).
- Alimentadores: la capa remota casi siempre da 404; el código ya la tolera.
- Service worker / offline. Web Workers para parse de avisos si crece mucho.
