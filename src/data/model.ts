import type { FeatureCollection, Feature, Point, MultiPolygon, Polygon, Position } from 'geojson'

export interface Estado {
  datos: string
  porcentaje: number | null
  fetchedAt?: string
}

export interface AppData {
  estado: Estado
  avisos: FeatureCollection<Point>
  trafos: FeatureCollection<Polygon | MultiPolygon>
  descargos: FeatureCollection<Polygon | MultiPolygon>
  comunas: FeatureCollection<Polygon | MultiPolygon>
  alimentadores: FeatureCollection | null
}

export interface Kpis {
  clientesAfectados: number
  clientesTotales: number
  porcentajeClientes: number
  avisos: number
  incidencias: number
  descargos: number
  comunasAfectadas: number
}

export interface DataScope {
  avisos: Feature<Point>[]
  incidencias: Feature<Polygon | MultiPolygon>[]
  trafos: Feature<Polygon | MultiPolygon>[]
  descargos: Feature<Polygon | MultiPolygon>[]
  comunas: Feature<Polygon | MultiPolygon>[]
}

export interface OperationalIndicators {
  nuevos60m: number
  delta60m: number
  edadMedianaMin: number | null
  edadP90Min: number | null
  etaVencidas: number
  sinEta: number
}

export interface ComunaStats {
  nombre: string
  clientesAfectados: number
  clientesTotal: number
  porcentaje: number
}

type Props = Record<string, any>

export const props = (f: Feature): Props => (f.properties ?? {}) as Props

const num = (v: any): number => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v)
  return Number.isFinite(n) ? n : 0
}

export const propNum = (f: Feature, key: string): number => num(props(f)[key])
export const propStr = (f: Feature, key: string): string => String(props(f)[key] ?? '').trim()

/** Nombres de despliegue: datos vienen con guion bajo ("LA_FLORIDA") */
export const prettyName = (s: string): string => s.replace(/_/g, ' ')

export const ENEL_TIME_ZONE = 'America/Santiago'

interface EnelDateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const enelDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ENEL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function enelParts(date: Date): EnelDateParts {
  const parts = Object.fromEntries(
    enelDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )
  return parts as unknown as EnelDateParts
}

function enelOffsetMs(date: Date): number {
  const p = enelParts(date)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime()
}

function enelDate(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const wallClockAsUtc = Date.UTC(year, monthIndex, day, hour, minute)
  let result = new Date(wallClockAsUtc)
  for (let i = 0; i < 2; i++) {
    result = new Date(wallClockAsUtc - enelOffsetMs(result))
  }
  return result
}

/** Parse flexible: "DD-MM-YYYY HH:mm" | "DD/MM/YY" | ISO | sin hora */
export function parseFecha(value?: string | null): Date | null {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  if (!raw.includes('/') && !raw.includes('-')) return null
  const ymd = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?/,
  )
  if (ymd) {
    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
      const iso = new Date(raw)
      return Number.isNaN(iso.getTime()) ? null : iso
    }
    return enelDate(
      Number(ymd[1]),
      Number(ymd[2]) - 1,
      Number(ymd[3]),
      Number(ymd[4] ?? 0),
      Number(ymd[5] ?? 0),
    )
  }
  const [datePart, timePart = '00:00'] = raw.split(/\s+/)
  const d = datePart.split(/[-/]/)
  if (d.length !== 3) return null
  const [dd, mm] = [parseInt(d[0], 10), parseInt(d[1], 10) - 1]
  const yy = d[2].length === 2 ? `20${d[2]}` : d[2]
  const [hh, mi] = timePart.split(':').map((x) => parseInt(x, 10) || 0)
  const out = enelDate(parseInt(yy, 10), mm, dd, hh, mi)
  return Number.isNaN(out.getTime()) ? null : out
}

export function fmtFecha(d: Date | null): string {
  if (!d) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  const parts = enelParts(d)
  return `${p(parts.day)}-${p(parts.month)} ${p(parts.hour)}:${p(parts.minute)}`
}

export function enelHourStart(d: Date): Date {
  const parts = enelParts(d)
  return enelDate(parts.year, parts.month - 1, parts.day, parts.hour, 0)
}

export function fmtEnelHour(d: Date): string {
  return String(enelParts(d).hour).padStart(2, '0') + ':00'
}

export function fmtEnelDayHour(d: Date): string {
  const parts = enelParts(d)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(parts.day)}/${p(parts.month)} ${p(parts.hour)}:00`
}

/** Texto de ETA de reposicion respetando si ya vencio */
export function etaTexto(f: Feature): { texto: string; vencida: boolean } {
  const repo = parseFecha(propStr(f, 'FECHA_REPOSICION'))
  if (!repo) return { texto: 'Sin estimacion', vencida: false }
  if (repo.getTime() <= Date.now()) return { texto: `En reestimacion (${fmtFecha(repo)})`, vencida: true }
  return { texto: fmtFecha(repo), vencida: false }
}

export function incidenciaInicio(f: Feature): Date | null {
  return parseFecha(propStr(f, 'FECHA_INICIO')) ?? parseFecha(propStr(f, 'FECHA_INIDESC'))
}

export function computeKpis(data: AppData, scope?: DataScope): Kpis {
  const comunas = scope?.comunas ?? data.comunas.features
  const avisos = scope?.avisos ?? data.avisos.features
  const trafos = scope?.trafos ?? data.trafos.features
  const descargos = scope?.descargos ?? data.descargos.features
  const comunaStats = aggregateComunas(comunas)
  const clientesAfectados = comunaStats.reduce((sum, comuna) => sum + comuna.clientesAfectados, 0)
  const clientesTotales = comunaStats.reduce((sum, comuna) => sum + comuna.clientesTotal, 0)
  const incidencias = dedupeIncidencias(
    trafos.filter((f) => !propStr(f, 'TIPO').toUpperCase().startsWith('DESCARGO')),
  ).length
  return {
    clientesAfectados,
    clientesTotales,
    porcentajeClientes: clientesTotales > 0 ? (clientesAfectados / clientesTotales) * 100 : 0,
    avisos: avisos.length,
    incidencias,
    descargos: dedupeIncidencias(descargos).length,
    comunasAfectadas: comunaStats.length,
  }
}

/**
 * Agrega las filas de comuna por nombre. Enel puede publicar mas de una
 * geometria para la misma comuna, repitiendo CLIENTESTOTAL en cada fila.
 */
export function aggregateComunas(features: Feature[]): ComunaStats[] {
  const grouped = new Map<string, ComunaStats>()
  for (const feature of features) {
    const nombre = propStr(feature, 'COMUNA')
    if (!nombre) continue
    const current = grouped.get(nombre) ?? {
      nombre,
      clientesAfectados: 0,
      clientesTotal: 0,
      porcentaje: 0,
    }
    current.clientesAfectados += propNum(feature, 'CLIENTESAFECTADOS')
    current.clientesTotal = Math.max(current.clientesTotal, propNum(feature, 'CLIENTESTOTAL'))
    grouped.set(nombre, current)
  }
  for (const comuna of grouped.values()) {
    comuna.porcentaje =
      comuna.clientesTotal > 0 ? (comuna.clientesAfectados / comuna.clientesTotal) * 100 : 0
  }
  return [...grouped.values()]
}

export function computeOperationalIndicators(
  scope: DataScope,
  now = new Date(),
): OperationalIndicators {
  const nowMs = now.getTime()
  const hour = 60 * 60 * 1000
  const starts = [
    ...scope.avisos.map((f) => parseFecha(propStr(f, 'FECHA_INI'))),
    ...dedupeIncidencias(scope.incidencias).map(incidenciaInicio),
  ].filter((d): d is Date => !!d && d.getTime() <= nowMs)
  const countBetween = (from: number, to: number) =>
    starts.filter((d) => d.getTime() > from && d.getTime() <= to).length
  const nuevos60m = countBetween(nowMs - hour, nowMs)
  const previos60m = countBetween(nowMs - 2 * hour, nowMs - hour)

  const uniqueInc = dedupeIncidencias(scope.incidencias)
  const ages = uniqueInc
    .map(incidenciaInicio)
    .filter((d): d is Date => !!d && d.getTime() <= nowMs)
    .map((d) => Math.max(0, (nowMs - d.getTime()) / 60000))
    .sort((a, b) => a - b)
  const percentile = (p: number): number | null => {
    if (!ages.length) return null
    const position = (ages.length - 1) * p
    const lower = Math.floor(position)
    const upper = Math.ceil(position)
    const weight = position - lower
    return Math.round(ages[lower] * (1 - weight) + ages[upper] * weight)
  }

  let etaVencidas = 0
  let sinEta = 0
  for (const inc of uniqueInc) {
    const eta = parseFecha(propStr(inc, 'FECHA_REPOSICION'))
    if (!eta) sinEta++
    else if (eta.getTime() <= nowMs) etaVencidas++
  }

  return {
    nuevos60m,
    delta60m: nuevos60m - previos60m,
    edadMedianaMin: percentile(0.5),
    edadP90Min: percentile(0.9),
    etaVencidas,
    sinEta,
  }
}

export const fmtNum = (n: number): string => n.toLocaleString('es-CL')

/** Incidencias unificadas (trafos + descargos) con su tipo normalizado */
export function allIncidencias(data: AppData): Feature<Polygon | MultiPolygon>[] {
  return [...data.trafos.features, ...data.descargos.features]
}

export const incidenciaId = (f: Feature): string =>
  propStr(f, 'INCIDENCIA') || propStr(f, 'CODIGO') || propStr(f, 'numpos')

/**
 * Deduplica eventos conservando la geometría con mayor CLITOTAL.
 * Enel repite INCIDENCIA entre varios polígonos/trafos y CLITOTAL ya contiene
 * el total del evento, por lo que nunca debe sumarse entre duplicados.
 */
export function dedupeIncidencias<T extends Feature>(features: T[]): T[] {
  const byId = new Map<string, T>()
  const withoutId: T[] = []
  for (const feature of features) {
    const id = incidenciaId(feature)
    if (!id) {
      withoutId.push(feature)
      continue
    }
    const current = byId.get(id)
    if (!current || propNum(feature, 'CLITOTAL') > propNum(current, 'CLITOTAL')) {
      byId.set(id, feature)
    }
  }
  return [...byId.values(), ...withoutId]
}

/** Centroide simple de una feature polygonal (promedio de coordenadas, sin turf) */
export function roughCentroid(f: Feature): Position {
  const coords: Position[] = []
  const walk = (c: any) => {
    if (typeof c?.[0] === 'number') coords.push(c as Position)
    else if (Array.isArray(c)) c.forEach(walk)
  }
  walk((f.geometry as any)?.coordinates)
  if (!coords.length) return [-70.66, -33.45]
  let x = 0
  let y = 0
  for (const [cx, cy] of coords) {
    x += cx
    y += cy
  }
  return [x / coords.length, y / coords.length]
}
