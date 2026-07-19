import { hexGrid, collect, bbox } from '@turf/turf'
import type { FeatureCollection, Point } from 'geojson'

/** Grilla hexagonal de densidad de avisos. cellSide en km. */
export function buildHexbin(avisos: FeatureCollection<Point>, cellSideKm = 0.8): FeatureCollection {
  if (!avisos.features.length) return { type: 'FeatureCollection', features: [] }
  const grid = hexGrid(bbox(avisos as any) as [number, number, number, number], cellSideKm, {
    units: 'kilometers',
  })
  const withCounts = collect(grid as any, avisos as any, 'CODIGO', 'values')
  for (const f of withCounts.features) {
    const vals = (f.properties as any)?.values
    ;(f.properties as any).count = Array.isArray(vals) ? vals.length : 0
  }
  withCounts.features = withCounts.features.filter((f) => (f.properties as any).count > 0)
  return withCounts as FeatureCollection
}
