import { describe, expect, it } from 'vitest'
import type { AppData } from '../data/model'
import type { Feature, MultiPolygon, Point, Polygon } from 'geojson'
import { analyzePoint, bufferStats, computeVisible } from './analysis'

const square = (
  id: string,
  clientes: number,
  delta = 0.001,
): Feature<Polygon> => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [-delta, -delta],
      [delta, -delta],
      [delta, delta],
      [-delta, delta],
      [-delta, -delta],
    ]],
  },
  properties: {
    INCIDENCIA: id,
    CLITOTAL: clientes,
    ESTADOINC: 'Asignado',
    FECHA_REPOSICION: '31-12-2099 23:59',
  },
})

const dataWith = (...incidencias: Feature<Polygon | MultiPolygon>[]): AppData => ({
  estado: { datos: '26/07 04:24', porcentaje: null },
  avisos: { type: 'FeatureCollection', features: [] },
  trafos: { type: 'FeatureCollection', features: incidencias },
  descargos: { type: 'FeatureCollection', features: [] },
  comunas: { type: 'FeatureCollection', features: [] },
  alimentadores: null,
})

const center: Feature<Point> = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [0, 0] },
  properties: {},
}

describe('deduplicación de incidencias en geoprocesos', () => {
  it('cuenta eventos y clientes una sola vez dentro del radio', () => {
    const data = dataWith(
      square('INC-1', 100),
      square('INC-1', 100, 0.0015),
      square('INC-2', 50),
    )

    const result = bufferStats(center, 500, data)

    expect(result?.incidencias).toBe(2)
    expect(result?.clientesEstimados).toBe(150)
  })

  it('devuelve un solo diagnóstico cuando varios polígonos representan el mismo evento', () => {
    const data = dataWith(square('INC-1', 100), square('INC-1', 100, 0.0015))

    const result = analyzePoint(center, data)

    expect(result.incidencias).toHaveLength(1)
    expect(result.incidencias[0]).toMatchObject({ id: 'INC-1', clientes: 100 })
  })
})

describe('cross-filter comunal', () => {
  it('limita avisos, eventos y comunas al polígono seleccionado', () => {
    const santiago = square('COM-SCL', 0, 1)
    santiago.properties = { COMUNA: 'SANTIAGO' }
    const providencia: Feature<Polygon> = {
      ...square('COM-PRO', 0, 1),
      properties: { COMUNA: 'PROVIDENCIA' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[9, 9], [11, 9], [11, 11], [9, 11], [9, 9]]],
      },
    }
    const outsideEvent: Feature<Polygon> = {
      ...square('INC-OUT', 20),
      geometry: providencia.geometry,
    }
    const data = dataWith(square('INC-IN', 10), outsideEvent)
    data.comunas.features = [santiago, providencia]
    const insideDescargo = square('DESC-IN', 5)
    insideDescargo.properties = { ...insideDescargo.properties, TIPO: 'DESCARGO' }
    const outsideDescargo: Feature<Polygon> = {
      ...square('DESC-OUT', 5),
      properties: { ...outsideEvent.properties, INCIDENCIA: 'DESC-OUT', TIPO: 'DESCARGO' },
      geometry: providencia.geometry,
    }
    data.descargos.features = [insideDescargo, outsideDescargo]
    data.avisos.features = [
      { ...center, properties: { CODIGO: 'AV-IN' } },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [10, 10] },
        properties: { CODIGO: 'AV-OUT' },
      },
    ]

    const result = computeVisible(data, null, 'SANTIAGO')

    expect(result.avisos.map((f) => f.properties?.CODIGO)).toEqual(['AV-IN'])
    expect(result.incidencias.map((f) => f.properties?.INCIDENCIA)).toEqual(['INC-IN', 'DESC-IN'])
    expect(result.trafos.map((f) => f.properties?.INCIDENCIA)).toEqual(['INC-IN'])
    expect(result.descargos.map((f) => f.properties?.INCIDENCIA)).toEqual(['DESC-IN'])
    expect(result.comunas.map((f) => f.properties?.COMUNA)).toEqual(['SANTIAGO'])
    expect(result.ids).toEqual({
      avisos: ['AV-IN'],
      incidencias: ['INC-IN', 'DESC-IN'],
      comunas: ['SANTIAGO'],
    })
  })

  it('usa la intersección geométrica real entre comuna y área dibujada', () => {
    const santiago = square('COM-SCL', 0, 1)
    santiago.properties = { COMUNA: 'SANTIAGO' }
    const farArea: Feature<Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[[9, 9], [11, 9], [11, 11], [9, 11], [9, 9]]],
      },
    }
    const splitEvent: Feature<MultiPolygon> = {
      type: 'Feature',
      properties: { INCIDENCIA: 'INC-SPLIT', CLITOTAL: '10', TIPO: 'TRAFO' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [santiago.geometry.coordinates, farArea.geometry.coordinates],
      },
    }
    const data = dataWith(splitEvent)
    data.comunas.features = [santiago]

    const result = computeVisible(data, farArea, 'SANTIAGO')

    expect(result.avisos).toEqual([])
    expect(result.incidencias).toEqual([])
    expect(result.comunas).toEqual([])
  })

  it('incluye todas las geometrias publicadas para una misma comuna', () => {
    const west = square('COM-COL-W', 0, 1)
    west.properties = { COMUNA: 'COLINA' }
    const east: Feature<Polygon> = {
      type: 'Feature',
      properties: { COMUNA: 'COLINA' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[9, 9], [11, 9], [11, 11], [9, 11], [9, 9]]],
      },
    }
    const westEvent = square('INC-W', 10)
    const eastEvent: Feature<Polygon> = {
      ...square('INC-E', 20),
      geometry: east.geometry,
    }
    const data = dataWith(westEvent, eastEvent)
    data.comunas.features = [west, east]
    data.avisos.features = [
      { ...center, properties: { CODIGO: 'AV-W' } },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [10, 10] },
        properties: { CODIGO: 'AV-E' },
      },
    ]

    const result = computeVisible(data, null, 'COLINA')

    expect(result.comunas).toHaveLength(2)
    expect(result.avisos).toHaveLength(2)
    expect(result.incidencias).toHaveLength(2)
    expect(result.ids?.comunas).toEqual(['COLINA'])
  })
})
