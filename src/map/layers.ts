import type { Feature, FeatureCollection, Point, Position } from 'geojson'
import { maplibregl } from './map'
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl'
import { theme, layerColors, ui, BasemapMode } from '../theme'
import {
  AppData,
  propStr,
  propNum,
  etaTexto,
  fmtFecha,
  parseFecha,
  fmtNum,
  incidenciaId,
  prettyName,
} from '../data/model'

/* ------------------------------------------------------------------ */
/* IDs                                                                   */
/* ------------------------------------------------------------------ */
const S = {
  avisos: 'src-avisos',
  trafos: 'src-trafos',
  descargos: 'src-descargos',
  comunas: 'src-comunas',
  alimentadores: 'src-alimentadores',
  hexbin: 'src-hexbin',
  overlay: 'src-overlay',
} as const

export const L = {
  comunasFill: 'ly-comunas-fill',
  comunasLine: 'ly-comunas-line',
  comunasLabel: 'ly-comunas-label',
  descargosFill: 'ly-descargos-fill',
  descargosLine: 'ly-descargos-line',
  trafosFill: 'ly-trafos-fill',
  trafosLine: 'ly-trafos-line',
  alimentadoresLine: 'ly-alimentadores-line',
  hexbinFill: 'ly-hexbin-fill',
  hexbinLine: 'ly-hexbin-line',
  avisosCluster: 'ly-avisos-cluster',
  avisosClusterCount: 'ly-avisos-cluster-count',
  avisosPoints: 'ly-avisos-points',
  overlayFill: 'ly-overlay-fill',
  overlayLine: 'ly-overlay-line',
  overlayPoints: 'ly-overlay-points',
} as const

const DATA_LAYERS = [
  L.comunasFill,
  L.comunasLine,
  L.comunasLabel,
  L.descargosFill,
  L.descargosLine,
  L.trafosFill,
  L.trafosLine,
  L.alimentadoresLine,
  L.hexbinFill,
  L.hexbinLine,
  L.avisosCluster,
  L.avisosClusterCount,
  L.avisosPoints,
] as const

export interface LayerCallbacks {
  onComunaClick?: (nombre: string) => void
  onIncidenciaClick?: (id: string) => void
}

/* ------------------------------------------------------------------ */
/* Setup inicial                                                         */
/* ------------------------------------------------------------------ */
export function addDataLayers(
  map: MLMap,
  data: AppData,
  cb: LayerCallbacks = {},
  { attachHandlers = true }: { attachHandlers?: boolean } = {},
): void {
  map.addSource(S.avisos, {
    type: 'geojson',
    data: data.avisos,
    cluster: true,
    clusterMaxZoom: 13,
    clusterRadius: 45,
  })
  map.addSource(S.trafos, { type: 'geojson', data: data.trafos })
  map.addSource(S.descargos, { type: 'geojson', data: data.descargos })
  map.addSource(S.comunas, { type: 'geojson', data: data.comunas })
  map.addSource(S.alimentadores, {
    type: 'geojson',
    data: data.alimentadores ?? { type: 'FeatureCollection', features: [] },
  })
  map.addSource(S.hexbin, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addSource(S.overlay, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })

  const sev = theme.severity
  const [s1, s2, s3] = theme.severityStops

  /* Comunas — coropleta por % afectados */
  map.addLayer({
    id: L.comunasFill,
    type: 'fill',
    source: S.comunas,
    paint: {
      'fill-color': [
        'step',
        ['to-number', ['get', 'PORCENTAJE'], 0],
        sev[0],
        s1,
        sev[1],
        s2,
        sev[2],
        s3,
        sev[3],
      ],
      'fill-opacity': 0.55,
    },
  })
  map.addLayer({
    id: L.comunasLine,
    type: 'line',
    source: S.comunas,
    paint: { 'line-color': '#0c0f12', 'line-width': 1.5 },
  })
  map.addLayer({
    id: L.comunasLabel,
    type: 'symbol',
    source: S.comunas,
    minzoom: 10.5,
    layout: {
      'text-field': ['get', 'COMUNA'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11,
      'text-transform': 'uppercase',
    },
    paint: { 'text-color': '#0c0f12' },
  })

  /* Trafos (incidencias) */
  map.addLayer({
    id: L.trafosFill,
    type: 'fill',
    source: S.trafos,
    paint: { 'fill-color': layerColors.trafos, 'fill-opacity': 0.45 },
  })
  map.addLayer({
    id: L.trafosLine,
    type: 'line',
    source: S.trafos,
    paint: { 'line-color': layerColors.trafos, 'line-width': 1.5 },
  })

  /* Descargos */
  map.addLayer({
    id: L.descargosFill,
    type: 'fill',
    source: S.descargos,
    paint: { 'fill-color': layerColors.descargos, 'fill-opacity': 0.5 },
  })
  map.addLayer({
    id: L.descargosLine,
    type: 'line',
    source: S.descargos,
    paint: { 'line-color': layerColors.descargos, 'line-width': 2 },
  })

  /* Alimentadores */
  map.addLayer({
    id: L.alimentadoresLine,
    type: 'line',
    source: S.alimentadores,
    layout: { visibility: 'none' },
    paint: { 'line-color': layerColors.alimentadores, 'line-width': 2.5 },
  })

  /* Hexbin */
  map.addLayer({
    id: L.hexbinFill,
    type: 'fill',
    source: S.hexbin,
    layout: { visibility: 'none' },
    paint: {
      'fill-color': [
        'step',
        ['get', 'count'],
        layerColors.hexbin[0],
        3,
        layerColors.hexbin[1],
        8,
        layerColors.hexbin[2],
        20,
        layerColors.hexbin[3],
      ],
      'fill-opacity': 0.75,
    },
  })
  map.addLayer({
    id: L.hexbinLine,
    type: 'line',
    source: S.hexbin,
    layout: { visibility: 'none' },
    paint: { 'line-color': '#0c0f12', 'line-width': 1 },
  })

  /* Avisos — cluster + puntos */
  map.addLayer({
    id: L.avisosCluster,
    type: 'circle',
    source: S.avisos,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': layerColors.cluster,
      'circle-radius': ['step', ['get', 'point_count'], 14, 25, 18, 100, 24],
    },
  })
  map.addLayer({
    id: L.avisosClusterCount,
    type: 'symbol',
    source: S.avisos,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
    },
    paint: { 'text-color': '#0c0f12' },
  })
  map.addLayer({
    id: L.avisosPoints,
    type: 'circle',
    source: S.avisos,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': layerColors.avisos,
      'circle-radius': 4,
      'circle-stroke-color': '#0c0f12',
      'circle-stroke-width': 1,
    },
  })

  /* Overlay de analisis (buffer, rutas, marcadores) — siempre arriba */
  map.addLayer({
    id: L.overlayFill,
    type: 'fill',
    source: S.overlay,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': layerColors.analysis, 'fill-opacity': 0.18 },
  })
  map.addLayer({
    id: L.overlayLine,
    type: 'line',
    source: S.overlay,
    filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']],
    paint: { 'line-color': layerColors.analysis, 'line-width': 2 },
  })
  map.addLayer({
    id: L.overlayPoints,
    type: 'circle',
    source: S.overlay,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-color': ['coalesce', ['get', 'color'], layerColors.searchMarker],
      'circle-radius': 8,
      'circle-stroke-color': '#0c0f12',
      'circle-stroke-width': 2,
    },
  })

  if (attachHandlers) attachPopups(map, cb)
}

/* ------------------------------------------------------------------ */
/* Actualizacion de datos (auto-refresh)                                 */
/* ------------------------------------------------------------------ */
export function updateData(map: MLMap, data: AppData): void {
  ;(map.getSource(S.avisos) as GeoJSONSource)?.setData(data.avisos)
  ;(map.getSource(S.trafos) as GeoJSONSource)?.setData(data.trafos)
  ;(map.getSource(S.descargos) as GeoJSONSource)?.setData(data.descargos)
  ;(map.getSource(S.comunas) as GeoJSONSource)?.setData(data.comunas)
  ;(map.getSource(S.alimentadores) as GeoJSONSource)?.setData(
    data.alimentadores ?? { type: 'FeatureCollection', features: [] },
  )
}

/* ------------------------------------------------------------------ */
/* Visibilidad                                                           */
/* ------------------------------------------------------------------ */
export type ToggleableLayer =
  | 'comunas'
  | 'trafos'
  | 'descargos'
  | 'avisos'
  | 'alimentadores'
  | 'hexbin'

const GROUPS: Record<ToggleableLayer, string[]> = {
  comunas: [L.comunasFill, L.comunasLine, L.comunasLabel],
  trafos: [L.trafosFill, L.trafosLine],
  descargos: [L.descargosFill, L.descargosLine],
  avisos: [L.avisosCluster, L.avisosClusterCount, L.avisosPoints],
  alimentadores: [L.alimentadoresLine],
  hexbin: [L.hexbinFill, L.hexbinLine],
}

export function setLayerVisibility(map: MLMap, group: ToggleableLayer, visible: boolean): void {
  for (const id of GROUPS[group]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
  }
}

export function setHexbinData(map: MLMap, fc: FeatureCollection): void {
  ;(map.getSource(S.hexbin) as GeoJSONSource)?.setData(fc)
}

/* ------------------------------------------------------------------ */
/* Filtro espacial (poligono dibujado)                                   */
/* ------------------------------------------------------------------ */
export function applyIdFilter(
  map: MLMap,
  ids: { avisos: string[]; incidencias: string[]; comunas: string[] } | null,
): void {
  const avFilter: any = ids ? ['in', ['get', 'CODIGO'], ['literal', ids.avisos]] : true
  const incFilter: any = ids ? ['in', ['get', 'INCIDENCIA'], ['literal', ids.incidencias]] : true
  const comFilter: any = ids ? ['in', ['get', 'COMUNA'], ['literal', ids.comunas]] : true

  for (const id of [L.avisosPoints]) if (map.getLayer(id)) map.setFilter(id, ['all', ['!', ['has', 'point_count']], avFilter])
  for (const id of [L.trafosFill, L.trafosLine, L.descargosFill, L.descargosLine])
    if (map.getLayer(id)) map.setFilter(id, incFilter)
  for (const id of [L.comunasFill, L.comunasLine, L.comunasLabel])
    if (map.getLayer(id)) map.setFilter(id, comFilter)
}

/* ------------------------------------------------------------------ */
/* Highlight (cross-filter desde graficos) + adaptacion a basemap        */
/* ------------------------------------------------------------------ */
let comunaBaseColor = '#0c0f12'

/** Ajusta bordes/etiquetas de comunas segun el mapa base (legibilidad) */
export function adaptLayersToBasemap(map: MLMap, mode: BasemapMode): void {
  comunaBaseColor = mode === 'sat' ? '#ffffff' : '#0c0f12'
  if (map.getLayer(L.comunasLine)) highlightComuna(map, __selectedComuna)
  if (map.getLayer(L.comunasLabel)) {
    map.setPaintProperty(L.comunasLabel, 'text-color', comunaBaseColor)
  }
}

let __selectedComuna: string | null = null

export function highlightComuna(map: MLMap, nombre: string | null): void {
  __selectedComuna = nombre
  if (!map.getLayer(L.comunasLine)) return
  map.setPaintProperty(L.comunasLine, 'line-width', [
    'case',
    ['==', ['get', 'COMUNA'], nombre ?? ''],
    3.5,
    1.5,
  ])
  map.setPaintProperty(L.comunasLine, 'line-color', [
    'case',
    ['==', ['get', 'COMUNA'], nombre ?? ''],
    ui.ink,
    comunaBaseColor,
  ])
}

export function flyToFeature(map: MLMap, feature: Feature): void {
  const coords: Position[] = []
  const walk = (c: any) => {
    if (typeof c?.[0] === 'number') coords.push(c as Position)
    else if (Array.isArray(c)) c.forEach(walk)
  }
  walk((feature.geometry as any)?.coordinates)
  if (!coords.length) return
  const bounds = coords.reduce(
    (b, c) => b.extend(c as [number, number]),
    new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]),
  )
  if (feature.geometry.type === 'Point') map.flyTo({ center: coords[0] as [number, number], zoom: 15 })
  else map.fitBounds(bounds, { padding: 60, maxZoom: 15 })
}

/* ------------------------------------------------------------------ */
/* Overlay helpers                                                       */
/* ------------------------------------------------------------------ */
export function setOverlay(map: MLMap, features: Feature[]): void {
  ;(map.getSource(S.overlay) as GeoJSONSource)?.setData({ type: 'FeatureCollection', features })
}

export function clearOverlay(map: MLMap): void {
  setOverlay(map, [])
}

/* ------------------------------------------------------------------ */
/* Popups                                                                */
/* ------------------------------------------------------------------ */
function row(label: string, value: string): string {
  return `<div class="popup-row"><span class="p-label">${label}</span><span class="p-value">${value}</span></div>`
}

function esc(s: string): string {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function avisoPopup(f: Feature): string {
  const eta = etaTexto(f)
  return `<div class="popup-title">AVISO ${esc(propStr(f, 'CODIGO'))}</div>
    ${row('Direccion', esc(propStr(f, 'DIRECCION')) || '—')}
    ${row('Inicio', fmtFecha(parseFecha(propStr(f, 'FECHA_INI'))))}
    ${row('Reposicion', `<span class="chip ${eta.vencida ? 'ch-warn' : 'ch-ok'}">${esc(eta.texto)}</span>`)}
    ${row('Evento', esc(propStr(f, 'COD_EVENTO')) || '—')}`
}

function incidenciaPopup(f: Feature): string {
  const eta = etaTexto(f)
  const tipo = propStr(f, 'TIPO').startsWith('DESCARGO') ? 'DESCARGO' : 'INCIDENCIA'
  const estado = propStr(f, 'ESTADOINC') || '—'
  return `<div class="popup-title">${tipo} ${esc(incidenciaId(f))}</div>
    ${row('Estado', `<span class="chip ${estado === 'Asignado' ? 'ch-ok' : 'ch-warn'}">${esc(estado)}</span>`)}
    ${row('Clientes', fmtNum(propNum(f, 'CLITOTAL')))}
    ${row('Tension', esc(propStr(f, 'TENSION')) || '—')}
    ${row('Inicio', fmtFecha(parseFecha(propStr(f, 'FECHA_INICIO'))))}
    ${row('Reposicion', `<span class="chip ${eta.vencida ? 'ch-warn' : 'ch-ok'}">${esc(eta.texto)}</span>`)}
    ${row('N aviso/tp', esc(propStr(f, 'numpos')) || '—')}`
}

function comunaPopup(f: Feature): string {
  const pct = propNum(f, 'PORCENTAJE')
  return `<div class="popup-title">COMUNA ${esc(prettyName(propStr(f, 'COMUNA')))}</div>
    ${row('Clientes afectados', fmtNum(propNum(f, 'CLIENTESAFECTADOS')))}
    ${row('Clientes totales', fmtNum(propNum(f, 'CLIENTESTOTAL')))}
    ${row('Afectacion', `<span class="chip ${pct >= 15 ? 'ch-danger' : pct >= 5 ? 'ch-warn' : 'ch-ok'}">${pct.toFixed(1)}%</span>`)}
    ${row('Centro', esc(propStr(f, 'CENTRO')) || '—')}`
}

function attachPopups(map: MLMap, cb: LayerCallbacks): void {
  const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '320px' })

  const interactive: Array<{ layer: string; html: (f: Feature) => string; onClick?: (f: Feature) => void }> = [
    {
      layer: L.comunasFill,
      html: comunaPopup,
      onClick: (f) => cb.onComunaClick?.(propStr(f, 'COMUNA')),
    },
    { layer: L.trafosFill, html: incidenciaPopup, onClick: (f) => cb.onIncidenciaClick?.(incidenciaId(f)) },
    { layer: L.descargosFill, html: incidenciaPopup, onClick: (f) => cb.onIncidenciaClick?.(incidenciaId(f)) },
    { layer: L.avisosPoints, html: avisoPopup },
  ]

  for (const { layer, html, onClick } of interactive) {
    map.on('click', layer, (e) => {
      const f = e.features?.[0] as unknown as Feature | undefined
      if (!f) return
      onClick?.(f)
      const geom: any = f.geometry
      const at: [number, number] =
        geom.type === 'Point' ? geom.coordinates : [e.lngLat.lng, e.lngLat.lat]
      popup.setLngLat(at).setHTML(html(f)).addTo(map)
    })
    map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
  }

  /* Click en cluster -> zoom expand */
  map.on('click', L.avisosCluster, async (e) => {
    const f = e.features?.[0]
    if (!f) return
    const src = map.getSource(S.avisos) as GeoJSONSource
    const zoom = await src.getClusterExpansionZoom((f.properties as any).cluster_id)
    map.easeTo({ center: (f.geometry as any).coordinates, zoom })
  })
}

export { DATA_LAYERS, S as SOURCES }
