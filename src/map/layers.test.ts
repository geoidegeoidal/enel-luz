import { describe, expect, it, vi } from 'vitest'
import type { Feature, Point, Polygon } from 'geojson'
import type { Map as MLMap } from 'maplibre-gl'
import { applyIdFilter, L, SOURCES } from './layers'

describe('filtro espacial de avisos', () => {
  it('reemplaza la fuente para que los clusters agreguen solo puntos visibles', () => {
    const aviso: Feature<Point> = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-70.65, -33.45] },
      properties: { CODIGO: 'AV-1' },
    }
    const event: Feature<Polygon> = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-70.7, -33.5], [-70.6, -33.5], [-70.6, -33.4], [-70.7, -33.5]]],
      },
      properties: { INCIDENCIA: 'INC-1' },
    }
    const sources = {
      [SOURCES.avisos]: { setData: vi.fn() },
      [SOURCES.trafos]: { setData: vi.fn() },
      [SOURCES.descargos]: { setData: vi.fn() },
    }
    const map = {
      getSource: vi.fn((id: string) => sources[id as keyof typeof sources] ?? null),
      getLayer: vi.fn(() => ({})),
      setFilter: vi.fn(),
    } as unknown as MLMap

    applyIdFilter(
      map,
      { avisos: ['AV-1'], incidencias: ['INC-1'], comunas: ['SANTIAGO'] },
      [aviso],
      [event],
      [event],
    )

    expect(sources[SOURCES.avisos].setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [aviso],
    })
    expect(sources[SOURCES.trafos].setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [event],
    })
    expect(sources[SOURCES.descargos].setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [event],
    })
    expect(map.setFilter).toHaveBeenCalledWith(L.avisosPoints, ['!', ['has', 'point_count']])
    expect(map.setFilter).toHaveBeenCalledWith(L.trafosFill, [
      'in',
      ['coalesce', ['get', 'INCIDENCIA'], ['get', 'CODIGO'], ['get', 'numpos'], ''],
      ['literal', ['INC-1']],
    ])

    const fullAvisos = [
      aviso,
      {
        ...aviso,
        properties: { CODIGO: 'AV-2' },
      },
    ]
    applyIdFilter(map, null, fullAvisos, [event], [event])
    expect(sources[SOURCES.avisos].setData).toHaveBeenLastCalledWith({
      type: 'FeatureCollection',
      features: fullAvisos,
    })
  })
})
