import {
  booleanPointInPolygon,
  buffer as turfBuffer,
  booleanIntersects,
  centroid,
  distance,
  featureCollection,
  intersect,
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
  dedupeIncidencias,
} from '../data/model'

type Poly = Feature<Polygon | MultiPolygon>

/* ------------------------------------------------------------------ */
/* Filtro espacial global                                                */
/* ------------------------------------------------------------------ */
export interface VisibleData {
  avisos: Feature<Point>[]
  incidencias: Poly[]
  trafos: Poly[]
  descargos: Poly[]
  comunas: Poly[]
  ids: { avisos: string[]; incidencias: string[]; comunas: string[] } | null
}

export function computeVisible(
  data: AppData,
  filterPoly: Poly | null,
  selectedComuna: string | null = null,
): VisibleData {
  const selectedPoly = selectedComuna
    ? data.comunas.features.find((f) => propStr(f, 'COMUNA') === selectedComuna) ?? null
    : null
  if (selectedComuna && !selectedPoly) {
    return {
      avisos: [],
      incidencias: [],
      trafos: [],
      descargos: [],
      comunas: [],
      ids: { avisos: [], incidencias: [], comunas: [] },
    }
  }
  if (!filterPoly && !selectedPoly) {
    return {
      avisos: data.avisos.features,
      incidencias: allIncidencias(data),
      trafos: data.trafos.features,
      descargos: data.descargos.features,
      comunas: data.comunas.features,
      ids: null,
    }
  }
  let scopePoly: Poly | null = selectedPoly ?? filterPoly
  if (selectedPoly && filterPoly) {
    try {
      scopePoly = intersect(featureCollection([selectedPoly, filterPoly]) as any) as Poly | null
    } catch {
      scopePoly = null
    }
    if (!scopePoly) {
      return {
        avisos: [],
        incidencias: [],
        trafos: [],
        descargos: [],
        comunas: [],
        ids: { avisos: [], incidencias: [], comunas: [] },
      }
    }
  }
  const avisos = scopePoly
    ? (pointsWithinPolygon(data.avisos, scopePoly as any).features as Feature<Point>[])
    : data.avisos.features
  const intersectsScope = (f: Poly) => {
    try {
      return !scopePoly || booleanIntersects(f as any, scopePoly as any)
    } catch {
      return false
    }
  }
  const trafos = data.trafos.features.filter(intersectsScope)
  const descargos = data.descargos.features.filter(intersectsScope)
  const incidencias = [...trafos, ...descargos]
  const comunas = (selectedPoly ? [selectedPoly] : data.comunas.features).filter(intersectsScope)
  return {
    avisos,
    incidencias,
    trafos,
    descargos,
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

  const matching: Feature[] = []
  for (const inc of allIncidencias(data)) {
    try {
      if (booleanPointInPolygon(pt, inc as any)) matching.push(inc)
    } catch {
      /* ignorar */
    }
  }
  const incidencias = dedupeIncidencias(matching).map((inc) => {
    const eta = etaTexto(inc)
    return {
      id: incidenciaId(inc),
      estado: propStr(inc, 'ESTADOINC') || '—',
      clientes: propNum(inc, 'CLITOTAL'),
      eta: eta.texto,
      tipo: propStr(inc, 'TIPO').startsWith('DESCARGO') ? 'Descargo' : 'Incidencia',
    }
  })

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
  const intersecting = allIncidencias(data).filter((f) => {
    try {
      return booleanIntersects(f as any, zona as any)
    } catch {
      return false
    }
  })
  const incs = dedupeIncidencias(intersecting)
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
