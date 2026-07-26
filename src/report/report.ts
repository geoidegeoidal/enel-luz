import type { Feature, MultiPolygon, Point, Polygon, Position } from 'geojson'
import type { VisibleData } from '../geo/analysis'
import {
  type AppData,
  type Kpis,
  type OperationalIndicators,
  aggregateComunas,
  computeKpis,
  computeOperationalIndicators,
  dedupeIncidencias,
  fmtFecha,
  fmtEnelHour,
  fmtNum,
  enelHourStart,
  incidenciaId,
  incidenciaInicio,
  parseFecha,
  prettyName,
  propNum,
  propStr,
} from '../data/model'
import { severityColor, theme } from '../theme'

type Poly = Feature<Polygon | MultiPolygon>

export interface ReportMapLayers {
  incidencias?: Poly[]
  avisos?: Feature<Point>[]
}

export interface ReportComuna {
  nombre: string
  clientes: number
  total: number
  porcentaje: number
}

export interface ReportEvent {
  id: string
  tipo: string
  clientes: number
  inicio: string
  reposicion: string
  estadoEta: 'vencida' | 'proxima' | 'programada' | 'sin-eta'
}

export interface ReportModel {
  scope: string
  generatedAt: string
  snapshotAt: string
  freshness: string
  kpis: Kpis
  operational: OperationalIndicators
  comunas: ReportComuna[]
  events: ReportEvent[]
  status: { tone: 'red' | 'amber' | 'green'; label: string; detail: string }
}

export interface ReportInput {
  data: AppData
  visible: VisibleData
  scopeLabel: string
  now?: Date
}

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}

const esc = (value: unknown): string =>
  String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char])

function formatGeneratedAt(date: Date): string {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function formatFreshness(data: AppData, now: Date): string {
  if (!data.estado.fetchedAt) return 'frescura no disponible'
  const fetched = new Date(data.estado.fetchedAt)
  if (Number.isNaN(fetched.getTime())) return 'frescura no disponible'
  const minutes = Math.max(0, Math.round((now.getTime() - fetched.getTime()) / 60000))
  if (minutes < 1) return 'descargado hace menos de 1 min'
  if (minutes < 60) return `descargado hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `descargado hace ${hours} h ${minutes % 60} min`
}

function etaState(feature: Feature, now: Date): ReportEvent['estadoEta'] {
  const eta = parseFecha(propStr(feature, 'FECHA_REPOSICION'))
  if (!eta) return 'sin-eta'
  if (eta.getTime() <= now.getTime()) return 'vencida'
  if (eta.getTime() - now.getTime() <= 2 * 60 * 60 * 1000) return 'proxima'
  return 'programada'
}

export function buildReportModel({
  data,
  visible,
  scopeLabel,
  now = new Date(),
}: ReportInput): ReportModel {
  const kpis = computeKpis(data, visible)
  const operational = computeOperationalIndicators(visible, now)
  const comunas = aggregateComunas(visible.comunas)
    .map((comuna) => ({
      nombre: prettyName(comuna.nombre),
      clientes: comuna.clientesAfectados,
      total: comuna.clientesTotal,
      porcentaje: comuna.porcentaje,
    }))
    .sort((a, b) => b.clientes - a.clientes || a.nombre.localeCompare(b.nombre, 'es-CL'))

  const events = dedupeIncidencias(visible.incidencias)
    .map((feature) => {
      const eta = parseFecha(propStr(feature, 'FECHA_REPOSICION'))
      const type = propStr(feature, 'TIPO').toUpperCase()
      return {
        id: incidenciaId(feature) || 'SIN ID',
        tipo: type.startsWith('DESCARGO') ? 'Descargo' : 'Incidencia',
        clientes: propNum(feature, 'CLITOTAL'),
        inicio: fmtFecha(incidenciaInicio(feature)),
        reposicion: eta ? fmtFecha(eta) : 'Sin ETA',
        estadoEta: etaState(feature, now),
      } satisfies ReportEvent
    })
    .sort((a, b) => {
      const priority = { vencida: 0, proxima: 1, programada: 2, 'sin-eta': 3 }
      return priority[a.estadoEta] - priority[b.estadoEta] || b.clientes - a.clientes
    })

  let status: ReportModel['status']
  if (operational.etaVencidas > 0) {
    status = {
      tone: 'red',
      label: 'ATENCION OPERATIVA',
      detail: `${fmtNum(operational.etaVencidas)} ETA vencida${operational.etaVencidas === 1 ? '' : 's'} requiere${operational.etaVencidas === 1 ? '' : 'n'} reestimacion.`,
    }
  } else if (operational.sinEta > 0 || operational.delta60m > 0) {
    status = {
      tone: 'amber',
      label: operational.sinEta > 0 ? 'SEGUIMIENTO REQUERIDO' : 'PRESION EN AUMENTO',
      detail:
        operational.sinEta > 0
          ? `${fmtNum(operational.sinEta)} evento${operational.sinEta === 1 ? '' : 's'} no tiene${operational.sinEta === 1 ? '' : 'n'} ETA publicada.`
          : `La ultima hora suma ${fmtNum(operational.delta60m)} inicio${operational.delta60m === 1 ? '' : 's'} mas que la hora previa.`,
    }
  } else {
    status = {
      tone: 'green',
      label: 'SIN ETA VENCIDAS',
      detail: `Presion de ultima hora: ${fmtNum(operational.nuevos60m)} avisos e inicios activos.`,
    }
  }

  return {
    scope: scopeLabel,
    generatedAt: formatGeneratedAt(now),
    snapshotAt: data.estado.datos,
    freshness: formatFreshness(data, now),
    kpis,
    operational,
    comunas,
    events,
    status,
  }
}

function geometryPositions(feature: Poly): Position[] {
  const positions: Position[] = []
  const walk = (value: unknown): void => {
    if (
      Array.isArray(value) &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      positions.push(value as Position)
      return
    }
    if (Array.isArray(value)) value.forEach(walk)
  }
  walk(feature.geometry.coordinates)
  return positions
}

function polygonRings(feature: Poly): Position[][] {
  if (feature.geometry.type === 'Polygon') return feature.geometry.coordinates
  return feature.geometry.coordinates.flat()
}

export function buildScopeMapSvg(
  comunas: Poly[],
  width = 760,
  height = 500,
  layers: ReportMapLayers = {},
): string {
  if (!comunas.length) {
    return `<svg class="report-map-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sin geometria para el alcance"><rect width="${width}" height="${height}" fill="#f2f0e9"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="14" fill="#6b6b63">SIN GEOMETRIA EN EL ALCANCE</text></svg>`
  }
  const all = comunas.flatMap(geometryPositions)
  const minX = Math.min(...all.map((point) => point[0]))
  const maxX = Math.max(...all.map((point) => point[0]))
  const minY = Math.min(...all.map((point) => point[1]))
  const maxY = Math.max(...all.map((point) => point[1]))
  const pad = 14
  const dataWidth = Math.max(0.0001, maxX - minX)
  const dataHeight = Math.max(0.0001, maxY - minY)
  const scale = Math.min((width - 2 * pad) / dataWidth, (height - 2 * pad) / dataHeight)
  const drawnWidth = dataWidth * scale
  const drawnHeight = dataHeight * scale
  const xOffset = (width - drawnWidth) / 2
  const yOffset = (height - drawnHeight) / 2
  const statsByName = new Map(
    aggregateComunas(comunas).map((comuna) => [comuna.nombre, comuna]),
  )
  const project = ([x, y]: Position) => [
    xOffset + (x - minX) * scale,
    height - yOffset - (y - minY) * scale,
  ]
  const comunaPaths = comunas
    .map((feature) => {
      const path = polygonRings(feature)
        .map((ring) =>
          ring
            .map((point, index) => {
              const [x, y] = project(point)
              return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
            })
            .join(' ') + ' Z',
        )
        .join(' ')
      const name = prettyName(propStr(feature, 'COMUNA'))
      const pct = statsByName.get(propStr(feature, 'COMUNA'))?.porcentaje ?? propNum(feature, 'PORCENTAJE')
      return `<path class="report-map-comuna" d="${path}" fill="${severityColor(pct)}" stroke="#141414" stroke-width="0.8" vector-effect="non-scaling-stroke" fill-rule="evenodd"><title>${esc(name)}: ${pct.toFixed(2)}%</title></path>`
    })
    .join('')

  const incidentes = dedupeIncidencias(
    (layers.incidencias ?? []).filter(
      (feature) => !propStr(feature, 'TIPO').toUpperCase().startsWith('DESCARGO'),
    ),
  )
  const incidentOutlines = incidentes
    .map((feature) =>
      polygonRings(feature)
        .map((ring) => {
          const path =
            ring
              .map((point, index) => {
                const [x, y] = project(point)
                return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
              })
              .join(' ') + ' Z'
          return `<path d="${path}" fill="none" stroke="#ea6a00" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
        })
        .join(''),
    )
    .join('')
  const incidentMarkers = incidentes
    .map((feature) => {
      const points = geometryPositions(feature)
      if (!points.length) return ''
      const center: Position = [
        points.reduce((sum, point) => sum + point[0], 0) / points.length,
        points.reduce((sum, point) => sum + point[1], 0) / points.length,
      ]
      const [x, y] = project(center)
      const size = Math.min(8, 4.5 + Math.log10(Math.max(1, propNum(feature, 'CLITOTAL'))) * 1.2)
      const id = incidenciaId(feature) || 'SIN ID'
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><title>Incidencia ${esc(id)}: ${fmtNum(propNum(feature, 'CLITOTAL'))} clientes</title><path d="M0,-${size.toFixed(1)} L${size.toFixed(1)},0 L0,${size.toFixed(1)} L-${size.toFixed(1)},0 Z" fill="#ea6a00" stroke="#141414" stroke-width="1.1" vector-effect="non-scaling-stroke"/></g>`
    })
    .join('')
  const avisoMarkers = (layers.avisos ?? [])
    .map((feature) => {
      const [x, y] = feature.geometry.coordinates
      if (x < minX || x > maxX || y < minY || y > maxY) return ''
      const [px, py] = project([x, y])
      const code = propStr(feature, 'CODIGO') || 'SIN CODIGO'
      return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.25" fill="#00a0dc" stroke="#ffffff" stroke-width="0.75" vector-effect="non-scaling-stroke"><title>Aviso ${esc(code)}</title></circle>`
    })
    .join('')

  const incidentCount = incidentes.length
  const avisoCount = layers.avisos?.length ?? 0
  return `<svg class="report-map-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Mapa operacional del alcance: ${incidentCount} ${incidentCount === 1 ? 'incidencia' : 'incidencias'} y ${avisoCount} ${avisoCount === 1 ? 'aviso' : 'avisos'}"><rect width="${width}" height="${height}" fill="#f2f0e9"/><g class="report-map-comunas">${comunaPaths}</g><g class="report-map-incidencias">${incidentOutlines}</g><g class="report-map-avisos">${avisoMarkers}</g><g class="report-map-incidencia-markers">${incidentMarkers}</g></svg>`
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—'
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return `${hours}h ${String(mins).padStart(2, '0')}m`
}

export function buildTimelineReportSvg(
  visible: VisibleData,
  now = new Date(),
  width = 1100,
  height = 190,
): string {
  const hourMs = 60 * 60 * 1000
  const nowHour = enelHourStart(now)
  const buckets = Array.from({ length: 25 }, (_, index) => ({
    start: new Date(nowHour.getTime() + (index - 12) * hourMs),
    avisos: 0,
    incidencias: 0,
    reposiciones: 0,
    vencidas: 0,
  }))
  const bucketFor = (date: Date | null) => {
    if (!date) return null
    const offset = Math.floor((date.getTime() - nowHour.getTime()) / hourMs)
    return offset < -12 || offset > 12 ? null : buckets[offset + 12]
  }
  for (const aviso of visible.avisos) {
    const date = parseFecha(propStr(aviso, 'FECHA_INI'))
    if (date && date.getTime() <= now.getTime()) {
      const bucket = bucketFor(date)
      if (bucket) bucket.avisos++
    }
  }
  for (const event of dedupeIncidencias(visible.incidencias)) {
    const start = incidenciaInicio(event)
    if (start && start.getTime() <= now.getTime()) {
      const bucket = bucketFor(start)
      if (bucket) bucket.incidencias++
    }
    const eta = parseFecha(propStr(event, 'FECHA_REPOSICION'))
    const bucket = bucketFor(eta)
    if (eta && bucket) {
      if (eta.getTime() <= now.getTime()) bucket.vencidas++
      else bucket.reposiciones++
    }
  }

  const left = 44
  const right = 12
  const top = 28
  const bottom = 28
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const slot = plotWidth / buckets.length
  const barWidth = Math.max(3, slot * 0.58)
  const maxValue = Math.max(
    1,
    ...buckets.map(
      (bucket) =>
        bucket.avisos + bucket.incidencias + bucket.reposiciones + bucket.vencidas,
    ),
  )
  const tickStep = Math.max(1, Math.ceil(maxValue / 4))
  const yMax = Math.ceil(maxValue / tickStep) * tickStep
  const grid = Array.from({ length: Math.floor(yMax / tickStep) + 1 }, (_, index) => {
    const value = index * tickStep
    const y = top + plotHeight - (value / yMax) * plotHeight
    return `<line x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}" stroke="#d8d5cb" stroke-width="1"/><text x="${left - 7}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="#6b6b63" font-family="IBM Plex Mono,monospace" font-size="9">${value}</text>`
  }).join('')
  const series = [
    ['avisos', theme.cyan],
    ['incidencias', theme.orange],
    ['reposiciones', theme.green],
    ['vencidas', theme.red],
  ] as const
  const bars = buckets
    .map((bucket, index) => {
      const x = left + index * slot + (slot - barWidth) / 2
      let yBottom = top + plotHeight
      return series
        .map(([key, color]) => {
          const value = bucket[key]
          if (!value) return ''
          const segmentHeight = (value / yMax) * plotHeight
          yBottom -= segmentHeight
          return `<rect x="${x.toFixed(1)}" y="${yBottom.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${segmentHeight.toFixed(1)}" fill="${color}"/>`
        })
        .join('')
    })
    .join('')
  const labels = [0, 4, 8, 12, 16, 20, 24]
    .map((index) => {
      const x = left + (index + 0.5) * slot
      const label = index === 12 ? 'AHORA' : fmtEnelHour(buckets[index].start)
      return `<text x="${x.toFixed(1)}" y="${height - 8}" text-anchor="middle" fill="${index === 12 ? '#141414' : '#6b6b63'}" font-family="IBM Plex Mono,monospace" font-size="9" font-weight="${index === 12 ? '700' : '400'}">${label}</text>`
    })
    .join('')
  const nowX = left + 12.5 * slot
  const legend = [
    ['avisos', theme.cyan],
    ['inicios', theme.orange],
    ['ETA', theme.green],
    ['vencidas', theme.red],
  ]
    .map(
      ([label, color], index) =>
        `<rect x="${left + index * 94}" y="4" width="10" height="10" fill="${color}"/><text x="${left + 16 + index * 94}" y="13" fill="#6b6b63" font-family="IBM Plex Mono,monospace" font-size="9">${label}</text>`,
    )
    .join('')
  return `<svg class="report-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Reloj operativo de avisos, inicios y reposiciones"><rect width="${width}" height="${height}" fill="#ffffff"/>${legend}${grid}${bars}<line x1="${nowX.toFixed(1)}" y1="${top}" x2="${nowX.toFixed(1)}" y2="${top + plotHeight}" stroke="#141414" stroke-width="1.2" stroke-dasharray="4 3"/>${labels}</svg>`
}

export function buildEtaReportSvg(
  incidencias: Feature[],
  now = new Date(),
  width = 420,
  height = 500,
): string {
  const rows = dedupeIncidencias(incidencias)
    .map((feature) => {
      const eta = parseFecha(propStr(feature, 'FECHA_REPOSICION'))
      const minutes = eta ? Math.round((eta.getTime() - now.getTime()) / 60000) : null
      return {
        id: incidenciaId(feature) || 'SIN ID',
        minutes,
        clientes: propNum(feature, 'CLITOTAL'),
      }
    })
    .sort((a, b) => {
      if (a.minutes === null) return b.minutes === null ? b.clientes - a.clientes : 1
      if (b.minutes === null) return -1
      return a.minutes - b.minutes
    })
    .slice(0, 9)
  if (!rows.length) {
    return `<svg class="report-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sin eventos para escala ETA"><rect width="${width}" height="${height}" fill="#fff"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#6b6b63" font-family="IBM Plex Mono,monospace" font-size="11">SIN EVENTOS EN EL ALCANCE</text></svg>`
  }

  const left = 98
  const right = 18
  const top = 26
  const bottom = 26
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const maxAbs = Math.max(60, ...rows.map((row) => Math.abs(row.minutes ?? 0)))
  const xFor = (minutes: number) => left + ((minutes + maxAbs) / (2 * maxAbs)) * plotWidth
  const zeroX = xFor(0)
  const rowHeight = plotHeight / rows.length
  const ticks = [-1, -0.5, 0, 0.5, 1]
    .map((factor) => {
      const minutes = Math.round(maxAbs * factor)
      const x = xFor(minutes)
      const label =
        minutes === 0
          ? 'AHORA'
          : `${minutes > 0 ? '+' : '-'}${formatDuration(Math.abs(minutes))}`
      return `<line x1="${x.toFixed(1)}" y1="${top}" x2="${x.toFixed(1)}" y2="${top + plotHeight}" stroke="${minutes === 0 ? '#141414' : '#d8d5cb'}" stroke-width="1" ${minutes === 0 ? 'stroke-dasharray="4 3"' : ''}/><text x="${x.toFixed(1)}" y="${height - 8}" text-anchor="middle" fill="${minutes === 0 ? '#141414' : '#6b6b63'}" font-family="IBM Plex Mono,monospace" font-size="8.5">${label}</text>`
    })
    .join('')
  const marks = rows
    .map((row, index) => {
      const centerY = top + (index + 0.5) * rowHeight
      const value = row.minutes ?? 0
      const endX = xFor(value)
      const x = Math.min(zeroX, endX)
      const barWidth = Math.max(row.minutes === null ? 2 : 3, Math.abs(endX - zeroX))
      const color =
        row.minutes === null
          ? '#6b6b63'
          : row.minutes <= 0
            ? theme.red
            : row.minutes <= 120
              ? theme.amber
              : theme.green
      const text =
        row.minutes === null
          ? 'SIN ETA'
          : row.minutes <= 0
            ? `VENCIDA ${formatDuration(Math.abs(row.minutes))}`
            : `+${formatDuration(row.minutes)}`
      const labelX = row.minutes !== null && row.minutes > 0 ? endX + 4 : zeroX + 4
      const shortId = row.id.length > 12 ? `…${row.id.slice(-11)}` : row.id
      return `<text x="${left - 7}" y="${(centerY + 3).toFixed(1)}" text-anchor="end" fill="#6b6b63" font-family="IBM Plex Mono,monospace" font-size="8.5">${esc(shortId)}</text><rect x="${x.toFixed(1)}" y="${(centerY - Math.min(8, rowHeight * 0.28)).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.min(16, rowHeight * 0.56).toFixed(1)}" fill="${color}"/><text x="${Math.min(width - right - 2, labelX).toFixed(1)}" y="${(centerY + 3).toFixed(1)}" fill="#141414" font-family="IBM Plex Mono,monospace" font-size="8.5" font-weight="600">${text}</text>`
    })
    .join('')
  return `<svg class="report-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Escala de reposicion por evento"><rect width="${width}" height="${height}" fill="#fff"/>${ticks}${marks}</svg>`
}

function kpiCell(label: string, value: string, context: string, tone = ''): string {
  return `<div class="report-kpi ${tone}">
    <strong>${esc(value)}</strong>
    <span>${esc(label)}</span>
    <small>${esc(context)}</small>
  </div>`
}

function opCell(label: string, value: string, tone = ''): string {
  return `<div class="report-op ${tone}">
    <strong>${esc(value)}</strong>
    <span>${esc(label)}</span>
  </div>`
}

function chartFigure(title: string, svg: string, className = ''): string {
  return `<figure class="report-figure ${className}">
    <figcaption>${esc(title)}</figcaption>
    ${svg || '<div class="report-empty">GRAFICO NO DISPONIBLE</div>'}
  </figure>`
}

function pageHeader(model: ReportModel, section: string): string {
  return `<header class="report-head">
    <div class="report-brand">
      <span class="report-bolt" aria-hidden="true">ϟ</span>
      <span><strong>LUZ·RM</strong><small>CENTRO DE CONTROL DE CORTES</small></span>
    </div>
    <div class="report-section">
      <span>REPORTE OPERATIVO</span>
      <strong>${esc(section)}</strong>
    </div>
    <div class="report-meta">
      <span>ALCANCE <strong>${esc(model.scope)}</strong></span>
      <span>DATOS <strong>${esc(model.snapshotAt)}</strong></span>
      <span>EMITIDO <strong>${esc(model.generatedAt)}</strong></span>
    </div>
  </header>`
}

function pageFooter(page: number): string {
  return `<footer class="report-foot">
    <span>FUENTE: GeoJSON publicos de mapaemergencia.enel.com, espejo automatico best-effort.</span>
    <span>LUZ·RM · PROYECTO INDEPENDIENTE · ENEL SOLO IDENTIFICA LA FUENTE</span>
    <strong>${String(page).padStart(2, '0')} / 02</strong>
  </footer>`
}

function buildReportHtml(
  model: ReportModel,
  visible: VisibleData,
  now: Date,
): string {
  const k = model.kpis
  const o = model.operational
  const topEvents = model.events.slice(0, 8)
  const topComunas = model.comunas.slice(0, 9)
  const map = buildScopeMapSvg(visible.comunas, 760, 500, {
    incidencias: visible.trafos,
    avisos: visible.avisos,
  })
  const timeline = buildTimelineReportSvg(visible, now)
  const eta = buildEtaReportSvg(visible.incidencias, now)
  const statusTone = `tone-${model.status.tone}`
  return `
    <div class="report-toolbar" role="toolbar" aria-label="Acciones del reporte">
      <div>
        <strong>REPORTE LISTO</strong>
        <span>${esc(model.scope)} · snapshot ${esc(model.snapshotAt)}</span>
      </div>
      <button id="report-print" class="primary" type="button">IMPRIMIR / GUARDAR PDF</button>
      <button id="report-close" type="button">CERRAR</button>
    </div>
    <main class="report-document">
      <article class="report-page">
        ${pageHeader(model, 'SITUACION ACTUAL')}
        <section class="report-kpi-band" aria-label="Indicadores clave del reporte">
          ${kpiCell('Clientes afectados', fmtNum(k.clientesAfectados), `de ${fmtNum(k.clientesTotales)}`, 'hero')}
          ${kpiCell('Suministro afectado', `${k.porcentajeClientes.toFixed(2)}%`, 'suma del alcance', 'amber')}
          ${kpiCell('Incidencias activas', fmtNum(k.incidencias), `${fmtNum(k.descargos)} descargos`, 'orange')}
          ${kpiCell('Avisos de clientes', fmtNum(k.avisos), 'reportes individuales', 'cyan')}
          ${kpiCell('Descargos', fmtNum(k.descargos), 'eventos unicos', 'red')}
          ${kpiCell('Comunas incluidas', fmtNum(k.comunasAfectadas), model.scope, 'green')}
        </section>
        <section class="report-page-one">
          <div class="report-map-panel">
            <div class="report-block-title">
              <span>01 · TERRITORIO</span>
              <strong>Situacion territorial</strong>
            </div>
            ${map}
            <div class="report-map-legend" aria-label="Leyenda territorial y operacional">
              <div class="report-legend-group">
                <strong>SEVERIDAD</strong>
                <span><i class="green"></i>0-5%</span>
                <span><i class="amber"></i>5-15%</span>
                <span><i class="orange"></i>15-50%</span>
                <span><i class="red"></i>&gt;50%</span>
              </div>
              <div class="report-legend-group operational">
                <span><i class="incident"></i>${fmtNum(k.incidencias)} ${k.incidencias === 1 ? 'incidencia' : 'incidencias'}</span>
                <span><i class="notice"></i>${fmtNum(k.avisos)} ${k.avisos === 1 ? 'aviso' : 'avisos'}</span>
              </div>
            </div>
          </div>
          <div class="report-summary-panel">
            <div class="report-status ${statusTone}">
              <small>LECTURA EJECUTIVA</small>
              <strong>${esc(model.status.label)}</strong>
              <span>${esc(model.status.detail)}</span>
            </div>
            <div class="report-block-title">
              <span>02 · RITMO</span>
              <strong>Indicadores operativos</strong>
            </div>
            <div class="report-op-grid">
              ${opCell('Presion 60m', fmtNum(o.nuevos60m), 'cyan')}
              ${opCell('vs hora previa', `${o.delta60m > 0 ? '+' : ''}${fmtNum(o.delta60m)}`, o.delta60m > 0 ? 'red' : o.delta60m < 0 ? 'green' : '')}
              ${opCell('Edad P50', formatDuration(o.edadMedianaMin))}
              ${opCell('Edad P90', formatDuration(o.edadP90Min), 'amber')}
              ${opCell('ETA vencidas', fmtNum(o.etaVencidas), 'red')}
              ${opCell('Sin ETA', fmtNum(o.sinEta))}
            </div>
            <div class="report-reading">
              <h2>CLAVES DEL SNAPSHOT</h2>
              <p><b>${fmtNum(k.clientesAfectados)}</b> clientes aparecen afectados dentro de <b>${esc(model.scope)}</b>.</p>
              <p>La carga activa reúne <b>${fmtNum(model.events.length)}</b> eventos únicos y <b>${fmtNum(k.avisos)}</b> avisos.</p>
              <p>El dato fue publicado a las <b>${esc(model.snapshotAt)}</b>; ${esc(model.freshness)}.</p>
              <p class="report-caution">Este reporte es una fotografía operacional, no un histórico ni una confirmación de reposición efectiva.</p>
            </div>
          </div>
        </section>
        ${pageFooter(1)}
      </article>
      <article class="report-page">
        ${pageHeader(model, 'TIEMPO Y PRIORIDADES')}
        <section class="report-clock-panel">
          <div class="report-block-title">
            <span>03 · VENTANA ±12 H</span>
            <strong>Reloj operativo centrado en AHORA</strong>
          </div>
          ${chartFigure('Avisos, inicios y reposiciones programadas', timeline, 'clock')}
        </section>
        <section class="report-priority-grid">
          <div>
            <div class="report-block-title">
              <span>04 · REPOSICION</span>
              <strong>Escala ETA</strong>
            </div>
            ${chartFigure('Eventos ordenados por urgencia', eta, 'eta')}
          </div>
          <div>
            <div class="report-block-title">
              <span>05 · EVENTOS</span>
              <strong>Prioridad operacional</strong>
            </div>
            <table class="report-table events">
              <thead><tr><th>ID</th><th>TIPO</th><th>CLIENTES</th><th>REPOSICION</th></tr></thead>
              <tbody>
                ${
                  topEvents.length
                    ? topEvents
                        .map(
                          (event) => `<tr>
                            <td title="${esc(event.id)}">${esc(event.id.slice(-11))}</td>
                            <td>${esc(event.tipo)}</td>
                            <td>${fmtNum(event.clientes)}</td>
                            <td><span class="eta-state ${event.estadoEta}">${esc(event.reposicion)}</span></td>
                          </tr>`,
                        )
                        .join('')
                    : '<tr><td colspan="4">Sin eventos en el alcance</td></tr>'
                }
              </tbody>
            </table>
          </div>
          <div>
            <div class="report-block-title">
              <span>06 · TERRITORIO</span>
              <strong>Comunas con mayor impacto</strong>
            </div>
            <table class="report-table comunas">
              <thead><tr><th>COMUNA</th><th>CLIENTES</th><th>% LOCAL</th></tr></thead>
              <tbody>
                ${
                  topComunas.length
                    ? topComunas
                        .map(
                          (comuna) => `<tr>
                            <td>${esc(comuna.nombre)}</td>
                            <td>${fmtNum(comuna.clientes)}</td>
                            <td><span class="severity-dot" style="background:${severityColor(comuna.porcentaje)}"></span>${comuna.porcentaje.toFixed(2)}%</td>
                          </tr>`,
                        )
                        .join('')
                    : '<tr><td colspan="3">Sin comunas en el alcance</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </section>
        <section class="report-method">
          <strong>METODO</strong>
          <span>Eventos deduplicados por INCIDENCIA. CLITOTAL usa el maximo por evento. Fechas interpretadas en America/Santiago. FECHA_REPOSICION es una ETA y puede ser reestimada.</span>
        </section>
        ${pageFooter(2)}
      </article>
    </main>`
}

let reportRoot: HTMLElement | null = null
let previousFocus: HTMLElement | null = null

export function closeOperationalReport(): void {
  if (!reportRoot) return
  reportRoot.remove()
  reportRoot = null
  document.body.classList.remove('report-ready')
  const app = document.getElementById('app')
  app?.removeAttribute('aria-hidden')
  app?.removeAttribute('inert')
  previousFocus?.focus()
  previousFocus = null
}

export function openOperationalReport(input: ReportInput): void {
  closeOperationalReport()
  previousFocus = document.activeElement as HTMLElement | null
  const now = input.now ?? new Date()
  const model = buildReportModel({ ...input, now })
  const root = document.createElement('section')
  root.id = 'report-root'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-label', `Reporte operativo ${model.scope}`)
  root.innerHTML = buildReportHtml(model, input.visible, now)
  document.body.append(root)
  reportRoot = root
  document.body.classList.add('report-ready')
  const app = document.getElementById('app')
  app?.setAttribute('aria-hidden', 'true')
  app?.setAttribute('inert', '')
  root.querySelector<HTMLButtonElement>('#report-close')?.addEventListener('click', closeOperationalReport)
  root.querySelector<HTMLButtonElement>('#report-print')?.addEventListener('click', () => window.print())
  root.querySelector<HTMLButtonElement>('#report-print')?.focus()
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (event) => {
    if (!reportRoot) return
    if (event.key === 'Escape') {
      closeOperationalReport()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = [
      ...reportRoot.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'),
    ]
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })
}
