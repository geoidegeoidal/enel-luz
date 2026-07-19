import {
  booleanPointInPolygon,
  buffer as turfBuffer,
  booleanIntersects,
  centroid,
  distance,
  pointsWithinPolygon,
} from '@turf/turf'
import type { Feature, Point, Polygon, MultiPolygon } from 'geojson'
import {
  AppData,
  allIncidencias,
  propStr,
  propNum,
  etaTexto,
  incidenciaId,
} from '../data/model'

type Poly = Feature<Polygon | MultiPolygon>

/* ------------------------------------------------------------------ */
/* Filtro espacial global                                                */
/* ------------------------------------------------------------------ */
export interface VisibleData {
  avisos: Feature[]
  incidencias: Feature[]
  comunas: Feature[]
  ids: { avisos: string[]; incidencias: string[]; comunas: string[] } | null
}

export function computeVisible(data: AppData, filterPoly: Poly | null): VisibleData {
  if (!filterPoly) {
    return {
      avisos: data.avisos.features,
      incidencias: allIncidencias(data),
      comunas: data.comunas.features,
      ids: null,
    }
  }
  const avisos = pointsWithinPolygon(data.avisos, filterPoly as any).features
  const incidencias = allIncidencias(data).filter((f) => booleanIntersects(f as any, filterPoly as any))
  const comunas = data.comunas.features.filter((f) => booleanIntersects(f as any, filterPoly as any))
  return {
    avisos,
    incidencias,
    comunas,
    ids: {
      avisos: avisos.map((f) => propStr(f, 'CODIGO')).filter(Boolean),
      incidencias: incidencias.map(incidenciaId).filter(Boolean),
      comunas: comunas.map((f) => propStr(f, 'COMUNA')).filter(Boolean),
    },
  }
}

/* ------------------------------------------------------------------ */
/* ¿Mi direccion esta afectada?                                          */
/* ------------------------------------------------------------------ */
export interface AffectedResult {
  afectada: boolean
  comuna: { nombre: string; pct: number; clientes: number } | null
  incidencias: Array<{ id: string; estado: string; clientes: number; eta: string; tipo: string }>
  avisosCercanos: number
}

export function analyzePoint(pt: Feature<Point>, data: AppData, radioM = 250): AffectedResult {
  let comuna: AffectedResult['comuna'] = null
  for (const c of data.comunas.features) {
    try {
      if (booleanPointInPolygon(pt, c as any)) {
        comuna = {
          nombre: propStr(c, 'COMUNA'),
          pct: propNum(c, 'PORCENTAJE'),
          clientes: propNum(c, 'CLIENTESAFECTADOS'),
        }
        break
      }
    } catch {
      /* geometria invalida -> ignorar */
    }
  }

  const incidencias: AffectedResult['incidencias'] = []
  for (const inc of allIncidencias(data)) {
    try {
      if (booleanPointInPolygon(pt, inc as any)) {
        const eta = etaTexto(inc)
        incidencias.push({
          id: incidenciaId(inc),
          estado: propStr(inc, 'ESTADOINC') || '—',
          clientes: propNum(inc, 'CLITOTAL'),
          eta: eta.texto,
          tipo: propStr(inc, 'TIPO').startsWith('DESCARGO') ? 'Descargo' : 'Incidencia',
        })
      }
    } catch {
      /* ignorar */
    }
  }

  const zona = turfBuffer(pt, radioM, { units: 'meters' })
  const avisosCercanos = zona ? pointsWithinPolygon(data.avisos, zona as any).features.length : 0

  return {
    afectada: incidencias.length > 0 || avisosCercanos > 0,
    comuna,
    incidencias,
    avisosCercanos,
  }
}

/* ------------------------------------------------------------------ */
/* Radio de analisis (buffer)                                            */
/* ------------------------------------------------------------------ */
export interface BufferResult {
  zona: Poly
  avisos: number
  incidencias: number
  clientesEstimados: number
}

export function bufferStats(center: Feature<Point>, radioM: number, data: AppData): BufferResult | null {
  const zona = turfBuffer(center, radioM, { units: 'meters' }) as Poly | undefined
  if (!zona) return null
  const avisos = pointsWithinPolygon(data.avisos, zona as any).features.length
  const incs = allIncidencias(data).filter((f) => {
    try {
      return booleanIntersects(f as any, zona as any)
    } catch {
      return false
    }
  })
  return {
    zona,
    avisos,
    incidencias: incs.length,
    clientesEstimados: incs.reduce((acc, f) => acc + propNum(f, 'CLITOTAL'), 0),
  }
}

/* ------------------------------------------------------------------ */
/* Incidencia mas cercana                                                */
/* ------------------------------------------------------------------ */
export interface NearestResult {
  feature: Feature
  distanciaM: number
  id: string
  eta: string
  clientes: number
  estado: string
  line: Feature
}

export function nearestIncidencia(pt: Feature<Point>, data: AppData): NearestResult | null {
  let best: { f: Feature; d: number } | null = null
  for (const inc of allIncidencias(data)) {
    try {
      const c = centroid(inc as any)
      const d = distance(pt, c, { units: 'meters' })
      if (!best || d < best.d) best = { f: inc, d }
    } catch {
      /* ignorar */
    }
  }
  if (!best) return null
  const c = centroid(best.f as any)
  return {
    feature: best.f,
    distanciaM: best.d,
    id: incidenciaId(best.f),
    eta: etaTexto(best.f).texto,
    clientes: propNum(best.f, 'CLITOTAL'),
    estado: propStr(best.f, 'ESTADOINC') || '—',
    line: {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [pt.geometry.coordinates, c.geometry.coordinates] },
      properties: {},
    },
  }
}
