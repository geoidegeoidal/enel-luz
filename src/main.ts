import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import '@fontsource/ibm-plex-mono/700.css'
import './style.css'
import type { Feature, Point, Polygon } from 'geojson'
import { applyTheme, layerColors, applyUiMode, BasemapMode } from './theme'
import { loadAll, reloadIfChanged } from './data/loader'
import {
  AppData,
  computeKpis,
  propStr,
  fmtNum,
  allIncidencias,
  incidenciaId,
  prettyName,
} from './data/model'
import { store } from './state'
import { createMap } from './map/map'
import { styleFor } from './map/basemap'
import {
  addDataLayers,
  updateData,
  setLayerVisibility,
  applyIdFilter,
  highlightComuna,
  flyToFeature,
  setOverlay,
  setHexbinData,
  adaptLayersToBasemap,
  ToggleableLayer,
} from './map/layers'
import {
  initComunaChart,
  initTimelineChart,
  initEstadosChart,
  initRankingChart,
  renderKpis,
  updateAllCharts,
} from './charts/charts'
import { attachSearch, SearchPick } from './geo/search'
import { computeVisible, analyzePoint, bufferStats, nearestIncidencia } from './geo/analysis'
import { buildHexbin } from './geo/hexbin'
import { DrawSession } from './geo/drawFilter'
import {
  buildToolbar,
  buildAnalysisTools,
  buildThemeToggle,
  buildLegend,
  toast,
  EMPTY_ANALYSIS_HTML,
  updateLayerCounts,
  setPanelHexbin,
  highlightGuideRow,
  type LegendMode,
} from './ui/ui'

applyTheme()

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T

/* ------------------------------------------------------------------ */
/* Panel de analisis — renderers                                         */
/* ------------------------------------------------------------------ */
function fact(label: string, value: string): string {
  return `<div class="fact"><span class="f-label">${label}</span><span class="f-value">${value}</span></div>`
}

function renderAffected(r: ReturnType<typeof analyzePoint>, label: string): void {
  const incs = r.incidencias
    .map((i) => fact(`${i.tipo} ${i.id}`, `${i.estado} · ${fmtNum(i.clientes)} cli · ETA ${i.eta}`))
    .join('')
  $('analysis-body').innerHTML = `
    <div class="verdict ${r.afectada ? 'v-danger' : 'v-ok'}">
      <small>DIAGNOSTICO DE DIRECCION</small>
      ${r.afectada ? 'CON AFECTACION' : 'SIN AFECTACION DIRECTA'}
    </div>
    ${fact('Direccion', label)}
    ${r.comuna ? fact('Comuna', `${prettyName(r.comuna.nombre)} (${r.comuna.pct.toFixed(1)}% afectada)`) : fact('Comuna', 'Fuera de zona afectada')}
    ${fact('Avisos en 250 m', fmtNum(r.avisosCercanos))}
    ${incs}
    <div class="analysis-actions">
      <button type="button" id="aa-radio">Radio de analisis aqui</button>
    </div>`
  $('aa-radio')?.addEventListener('click', () => armRadio(lastSearchPoint))
}

function renderBuffer(r: NonNullable<ReturnType<typeof bufferStats>>, radioM: number): void {
  $('analysis-body').innerHTML = `
    <div class="verdict v-warn"><small>GEOPROCESO</small>RADIO DE ${fmtNum(radioM)} m</div>
    ${fact('Avisos dentro', fmtNum(r.avisos))}
    ${fact('Incidencias intersectando', fmtNum(r.incidencias))}
    ${fact('Clientes afectados (est.)', fmtNum(r.clientesEstimados))}
    <div class="analysis-actions"><button type="button" id="aa-clear">Limpiar</button></div>`
  $('aa-clear')?.addEventListener('click', clearAnalysis)
}

function renderNearest(r: NonNullable<ReturnType<typeof nearestIncidencia>>): void {
  $('analysis-body').innerHTML = `
    <div class="verdict v-warn"><small>GEOPROCESO</small>INCIDENCIA MAS CERCANA</div>
    ${fact('ID', r.id)}
    ${fact('Distancia', `${fmtNum(Math.round(r.distanciaM))} m`)}
    ${fact('Estado', r.estado)}
    ${fact('Clientes', fmtNum(r.clientes))}
    ${fact('Reposicion', r.eta)}
    <div class="analysis-actions">
      <button type="button" id="aa-fly">Ver en mapa</button>
      <button type="button" id="aa-clear2">Limpiar</button>
    </div>`
  $('aa-fly')?.addEventListener('click', () => map && flyToFeature(map, r.feature))
  $('aa-clear2')?.addEventListener('click', clearAnalysis)
}

/* ------------------------------------------------------------------ */
/* Estado global de la vista                                             */
/* ------------------------------------------------------------------ */
type Tool = 'radio' | 'nearest' | null
let armedTool: Tool = null
let lastSearchPoint: Feature<Point> | null = null
let drawSession: DrawSession | null = null
let map: ReturnType<typeof createMap> | null = null
let hexOn = false
let layersAddedOnce = false
let overlayFeatures: Feature[] = []
let currentBasemap: BasemapMode = 'dark'

const layerState: Record<ToggleableLayer, boolean> = {
  comunas: true,
  trafos: true,
  descargos: true,
  avisos: true,
  alimentadores: false,
  hexbin: false,
}

const RADIO_DEFAULT_M = 500

function applyOverlay(feats: Feature[]): void {
  overlayFeatures = feats
  if (map) setOverlay(map, feats)
}

/** Restaura visibilidad, hexbin, overlay y highlight tras cambiar de basemap */
function restoreMapState(): void {
  if (!map) return
  for (const g of Object.keys(layerState) as ToggleableLayer[]) {
    setLayerVisibility(map, g, layerState[g])
  }
  const data = store.state.data
  if (hexOn && data) setHexbinData(map, buildHexbin(data.avisos))
  setOverlay(map, overlayFeatures)
  adaptLayersToBasemap(map, currentBasemap)
  if (store.state.selectedComuna) highlightComuna(map, store.state.selectedComuna)
}

function refreshLegend(): void {
  const modes: LegendMode[] = []
  if (hexOn) modes.push('hexbin')
  if (layerState.comunas) modes.push('comuna')
  buildLegend($('map-legend'), modes)
}

/* ------------------------------------------------------------------ */
/* Herramientas                                                          */
/* ------------------------------------------------------------------ */
function showHint(text: string, onCancel?: () => void): void {
  $('draw-hint-text').textContent = text
  $('draw-hint').classList.remove('hidden')
  $('draw-cancel').onclick = () => {
    hideHint()
    onCancel?.()
  }
}
function hideHint(): void {
  $('draw-hint').classList.add('hidden')
}

function armRadio(center?: Feature<Point> | null): void {
  armedTool = 'radio'
  if (map) map.getCanvas().style.cursor = 'crosshair'
  showHint('Haz click en el mapa para centrar el radio de analisis', disarm)
  highlightGuideRow('radio', true)
  if (center && map) runRadio(center)
}

function armNearest(): void {
  armedTool = 'nearest'
  if (map) map.getCanvas().style.cursor = 'crosshair'
  showHint('Haz click en el mapa para encontrar la incidencia mas cercana', disarm)
  highlightGuideRow('nearest', true)
}

function armPoly(): void {
  if (!map) return
  drawSession?.cancel()
  drawSession = new DrawSession(
    map,
    (poly) => {
      hideHint()
      store.set({ filterPoly: poly })
      toast('Filtro espacial aplicado')
    },
    () => hideHint(),
  )
  drawSession.start()
  showHint('Click para agregar vertices · doble click o Enter para cerrar · Esc cancela', () =>
    drawSession?.cancel(),
  )
  highlightGuideRow('poly', true)
}

function disarm(): void {
  armedTool = null
  drawSession?.cancel()
  drawSession = null
  if (map) map.getCanvas().style.cursor = ''
  hideHint()
  highlightGuideRow(null)
}

function clearAnalysis(): void {
  disarm()
  applyOverlay([])
  if (store.state.filterPoly) store.set({ filterPoly: null })
  $('analysis-body').innerHTML = EMPTY_ANALYSIS_HTML
}

function runRadio(center: Feature<Point>): void {
  const data = store.state.data
  if (!data || !map) return
  const r = bufferStats(center, RADIO_DEFAULT_M, data)
  disarm()
  if (!r) return
  applyOverlay([r.zona, { ...center, properties: { color: layerColors.searchMarker } }])
  renderBuffer(r, RADIO_DEFAULT_M)
}

function runNearest(pt: Feature<Point>): void {
  const data = store.state.data
  if (!data || !map) return
  const r = nearestIncidencia(pt, data)
  disarm()
  if (!r) return toast('Sin incidencias activas')
  applyOverlay([r.line, { ...pt, properties: { color: layerColors.searchMarker } }])
  renderNearest(r)
}

function onMapClickForTools(e: maplibregl.MapMouseEvent): void {
  const pt: Feature<Point> = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] },
    properties: {},
  }
  if (armedTool === 'radio') runRadio(pt)
  else if (armedTool === 'nearest') runNearest(pt)
}

/* ------------------------------------------------------------------ */
/* Hexbin                                                                */
/* ------------------------------------------------------------------ */
function toggleHexbin(on: boolean): void {
  const data = store.state.data
  hexOn = on
  layerState.hexbin = on
  if (!data || !map) return
  if (on) {
    setHexbinData(map, buildHexbin(data.avisos))
    setLayerVisibility(map, 'hexbin', true)
    toast('Densidad de avisos activada')
  } else {
    setLayerVisibility(map, 'hexbin', false)
  }
  refreshLegend()
}

/* ------------------------------------------------------------------ */
/* Filtro espacial -> mapa + graficos                                    */
/* ------------------------------------------------------------------ */
function refreshViews(): void {
  const { data, filterPoly } = store.state
  if (!data || !map) return
  const visible = computeVisible(data, filterPoly)
  applyIdFilter(map, visible.ids)
  updateAllCharts(charts, data, visible)
}

/* ------------------------------------------------------------------ */
/* Auto-refresh                                                          */
/* ------------------------------------------------------------------ */
const POLL_S = 60
let countdown = POLL_S
let lastPollAt = 0
let pollErrors = 0
let pollTimer: ReturnType<typeof setInterval> | undefined

async function tickRefresh({ manual = false } = {}): Promise<void> {
  const data = store.state.data
  if (!data) return
  if (!manual) lastPollAt = Date.now()
  const btn = $('refresh-now')
  if (manual && btn) btn.classList.add('loading')
  try {
    const fresh = await reloadIfChanged(data.estado.datos)
    countdown = POLL_S
    pollErrors = 0
    if (fresh) {
      applyNewData(fresh)
      const fill = $('refresh-fill')
      fill.classList.add('flash')
      setTimeout(() => fill.classList.remove('flash'), 2000)
      toast(`Datos actualizados \u2713 \u2014 ${fresh.estado.datos}`, 3200)
      if (btn) {
        btn.classList.add('success')
        setTimeout(() => btn.classList.remove('success'), 1500)
      }
    } else if (manual) {
      toast('Datos ya estan al dia', 1800)
    }
  } catch (err) {
    pollErrors++
    if (pollErrors >= 3) {
      toast(`Sin conexion al espejo (${pollErrors} intentos fallidos)`, 4500)
    }
    if (manual) toast('No se pudo actualizar: revise conexion', 3000)
    console.warn('[tickRefresh]', err)
  } finally {
    if (btn) btn.classList.remove('loading')
  }
}

function fmtFreshness(diffMs: number): string {
  const s = Math.max(0, Math.round(diffMs / 1000))
  if (s < 60) return `hace ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m}m ${String(s % 60).padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  return `hace ${h}h ${m % 60}m`
}

function updateFreshness(): void {
  const data = store.state.data
  const el = $('datos-freshness')
  if (!data?.estado?.fetchedAt || !el) return
  const fetched = new Date(data.estado.fetchedAt).getTime()
  if (!Number.isFinite(fetched)) return
  const diff = Date.now() - fetched
  el.textContent = fmtFreshness(diff)
  const dtMin = diff / 60000
  el.classList.toggle('fresh', dtMin < 2)
  el.classList.toggle('stale', dtMin > 7)
}

function startPolling(): void {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    tickClock()
    if (!document.hidden) countdown--
    if (countdown <= 0) void tickRefresh()
    const fill = $('refresh-fill')
    if (fill) fill.style.width = `${Math.max(0, (countdown / POLL_S) * 100)}%`
    if (!document.hidden) updateFreshness()
  }, 1000)
}

function tickClock(): void {
  const clock = $('local-clock')
  if (!clock) return
  const p = (n: number) => String(n).padStart(2, '0')
  const now = new Date()
  clock.textContent = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`
}

function stopPolling(): void {
  if (!pollTimer) return
  clearInterval(pollTimer)
  pollTimer = undefined
}

function applyNewData(data: AppData): void {
  store.set({ data })
  if (map) {
    updateData(map, data)
    if (hexOn) setHexbinData(map, buildHexbin(data.avisos))
  }
  $('estado-fecha').textContent = data.estado.datos
  renderKpis($('kpis'), computeKpis(data))
  updateLayerCounts($('toolbar'), data)
  refreshViews()
  updateFreshness()
}

/* ------------------------------------------------------------------ */
/* Boot                                                                  */
/* ------------------------------------------------------------------ */
let charts: ReturnType<typeof buildCharts>

function buildCharts() {
  const ctx = {
    onComunaSelect: (nombre: string) => store.toggleComuna(nombre),
    onIncidenciaSelect: (id: string) => {
      const data = store.state.data
      if (!data || !map) return
      const f = allIncidencias(data).find((x) => incidenciaId(x) === id)
      if (f) flyToFeature(map, f)
    },
  }
  return {
    comunas: initComunaChart($('chart-comunas'), ctx),
    timeline: initTimelineChart($('chart-timeline')),
    estados: initEstadosChart($('chart-estados')),
    ranking: initRankingChart($('chart-ranking'), ctx),
  }
}

async function boot(): Promise<void> {
  refreshLegend()

  const data = await loadAll()
  store.set({ data })
  $('estado-fecha').textContent = data.estado.datos
  $('analysis-body').innerHTML = EMPTY_ANALYSIS_HTML
  renderKpis($('kpis'), computeKpis(data))

  charts = buildCharts()
  refreshViews() // graficos al instante, sin esperar tiles del mapa

  map = createMap($('map'), 'dark')
  map.on('style.load', () => {
    const first = !layersAddedOnce
    addDataLayers(
      map!,
      store.state.data!,
      { onComunaClick: (nombre) => store.toggleComuna(nombre), onIncidenciaClick: () => {} },
      { attachHandlers: first },
    )
    layersAddedOnce = true
    restoreMapState()
    refreshViews()
    ;(window as any).__mapDebug = () => ({
      layers: map!.getStyle().layers.map((l: any) => l.id),
      rendered: map!.queryRenderedFeatures().length,
      comunasRendered: map!.queryRenderedFeatures(undefined, { layers: ['ly-comunas-fill'] })
        .length,
    })
  })
  map.on('click', onMapClickForTools)
  map.on('error', (e) => console.error('[mapa]', e?.error?.message ?? e))

  /* Buscador */
  attachSearch($('search-input') as HTMLInputElement, $('search-results'), (pick: SearchPick) => {
    lastSearchPoint = pick.point
    const dataNow = store.state.data
    if (!dataNow || !map) return
    applyOverlay([{ ...pick.point, properties: { color: layerColors.searchMarker } }])
    map.flyTo({ center: pick.point.geometry.coordinates as [number, number], zoom: 14.5 })
    renderAffected(analyzePoint(pick.point, dataNow), pick.label)
  })

  /* Panel de capas */
  const toolbarHandlers = {
    onToggleLayer: (g: ToggleableLayer | 'hexbin', v: boolean) => {
      if (g === 'hexbin') return // type guard, handled via toggleHexbin below if needed
      layerState[g] = v
      if (map) setLayerVisibility(map, g, v)
      refreshLegend()
    },
    onBasemap: (mode: BasemapMode) => {
      currentBasemap = mode
      // diff:false => reemplazo completo, que siempre emite 'style.load'
      map?.setStyle(styleFor(mode), { diff: false })
      toast(`Mapa base: ${mode === 'sat' ? 'Satelital' : mode === 'light' ? 'Claro' : 'Oscuro'}`)
    },
    onToolRadio: () => armRadio(),
    onToolPoly: armPoly,
    onToolNearest: armNearest,
    onToolHexbin: (on: boolean) => {
      setPanelHexbin($('toolbar'), on)
      toggleHexbin(on)
    },
    onClearAnalysis: clearAnalysis,
    onToolHover: (tool: 'radio' | 'poly' | 'nearest' | null) => highlightGuideRow(tool),
  }
  buildToolbar($('toolbar'), toolbarHandlers)
  buildAnalysisTools($('analysis-tools'), toolbarHandlers)
  updateLayerCounts($('toolbar'), data)

  /* Toggle claro/oscuro del chrome */
  buildThemeToggle($('theme-toggle'), () => {
    applyUiMode(document.documentElement.dataset.ui === 'dark' ? 'light' : 'dark')
    refreshViews() // re-render graficos con la nueva paleta
  })

  /* Cross-filter de comuna seleccionada */
  let lastComuna: string | null = null
  store.subscribe((s) => {
    if (s.selectedComuna !== lastComuna) {
      lastComuna = s.selectedComuna
      if (map) {
        highlightComuna(map, s.selectedComuna)
        if (s.selectedComuna && s.data) {
          const f = s.data.comunas.features.find((c) => propStr(c, 'COMUNA') === s.selectedComuna)
          if (f) flyToFeature(map, f)
        }
      }
    }
    refreshViews()
  })

  /* Reloj local, polling con pausa en background, freshness marker y boton manual */
  tickClock()
  updateFreshness()
  startPolling()

  /* Al volver al tab, refresh inmediato si hace >5s del ultimo poll + restart del reloj */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling()
    } else {
      tickClock()
      updateFreshness()
      if (Date.now() - lastPollAt > 5000) {
        lastPollAt = Date.now()
        void tickRefresh()
      }
      startPolling()
    }
  })

  /* Botón manual: refresh explicito sin esperar al tick */
  $('refresh-now').addEventListener('click', () => {
    void tickRefresh({ manual: true })
  })
}

boot().catch((err) => {
  console.error(err)
  $('analysis-body').innerHTML = `<div class="verdict v-danger">ERROR AL CARGAR DATOS</div><p class="muted">${String(
    err?.message ?? err,
  )}</p>`
})
