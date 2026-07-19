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

/** Parse flexible: "DD-MM-YYYY HH:mm" | "DD/MM/YY" | ISO | sin hora */
export function parseFecha(value?: string | null): Date | null {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  const iso = new Date(raw)
  if (!raw.includes('/') && !raw.includes('-')) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return Number.isNaN(iso.getTime()) ? null : iso
  const [datePart, timePart = '00:00'] = raw.split(/\s+/)
  const d = datePart.split(/[-/]/)
  if (d.length !== 3) return null
  const [dd, mm] = [parseInt(d[0], 10), parseInt(d[1], 10) - 1]
  const yy = d[2].length === 2 ? `20${d[2]}` : d[2]
  const [hh, mi] = timePart.split(':').map((x) => parseInt(x, 10) || 0)
  const out = new Date(parseInt(yy, 10), mm, dd, hh, mi)
  return Number.isNaN(out.getTime()) ? null : out
}

export function fmtFecha(d: Date | null): string {
  if (!d) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Texto de ETA de reposicion respetando si ya vencio */
export function etaTexto(f: Feature): { texto: string; vencida: boolean } {
  const repo = parseFecha(propStr(f, 'FECHA_REPOSICION'))
  if (!repo) return { texto: 'Sin estimacion', vencida: false }
  if (repo.getTime() <= Date.now()) return { texto: `En reestimacion (${fmtFecha(repo)})`, vencida: true }
  return { texto: fmtFecha(repo), vencida: false }
}

export function computeKpis(data: AppData): Kpis {
  let clientesAfectados = 0
  let clientesTotales = 0
  for (const f of data.comunas.features) {
    clientesAfectados += propNum(f, 'CLIENTESAFECTADOS')
    clientesTotales += propNum(f, 'CLIENTESTOTAL')
  }
  const incidencias =
    data.trafos.features.filter((f) => propStr(f, 'TIPO').startsWith('TRAFO')).length +
    data.descargos.features.length
  return {
    clientesAfectados,
    clientesTotales,
    porcentajeClientes: clientesTotales > 0 ? (clientesAfectados / clientesTotales) * 100 : 0,
    avisos: data.avisos.features.length,
    incidencias,
    descargos: data.descargos.features.length,
    comunasAfectadas: data.comunas.features.length,
  }
}

export const fmtNum = (n: number): string => n.toLocaleString('es-CL')

/** Incidencias unificadas (trafos + descargos) con su tipo normalizado */
export function allIncidencias(data: AppData): Feature<Polygon | MultiPolygon>[] {
  return [...data.trafos.features, ...data.descargos.features]
}

export const incidenciaId = (f: Feature): string =>
  propStr(f, 'INCIDENCIA') || propStr(f, 'CODIGO') || propStr(f, 'numpos')

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
