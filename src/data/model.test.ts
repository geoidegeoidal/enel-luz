import { describe, expect, it } from 'vitest'
import type { Feature, Point, Polygon } from 'geojson'
import {
  computeKpis,
  computeOperationalIndicators,
  parseFecha,
  type AppData,
  type DataScope,
} from './model'

const point = (properties: Record<string, unknown>): Feature<Point> => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates: [-70.65, -33.45] },
})

const polygon = (properties: Record<string, unknown>): Feature<Polygon> => ({
  type: 'Feature',
  properties,
  geometry: {
    type: 'Polygon',
    coordinates: [[[-70.7, -33.5], [-70.6, -33.5], [-70.6, -33.4], [-70.7, -33.5]]],
  },
})

describe('indicadores operativos', () => {
  const descargo = polygon({
    INCIDENCIA: 'INC-3',
    CLITOTAL: '10',
    FECHA_INICIO: '26-07-2026 08:00',
    FECHA_REPOSICION: '',
    TIPO: 'DESCARGO',
  })
  const scope: DataScope = {
    avisos: [
      point({ FECHA_INI: '26-07-2026 11:30' }),
      point({ FECHA_INI: '26-07-2026 10:30' }),
    ],
    incidencias: [
      polygon({
        INCIDENCIA: 'INC-1',
        CLITOTAL: '100',
        FECHA_INICIO: '26-07-2026 11:15',
        FECHA_REPOSICION: '26-07-2026 11:45',
        TIPO: 'TRAFO',
      }),
      polygon({
        INCIDENCIA: 'INC-1',
        CLITOTAL: '100',
        FECHA_INICIO: '26-07-2026 11:15',
        FECHA_REPOSICION: '26-07-2026 11:45',
        TIPO: 'TRAFO',
      }),
      polygon({
        INCIDENCIA: 'INC-2',
        CLITOTAL: '40',
        FECHA_INICIO: '26-07-2026 10:15',
        FECHA_REPOSICION: '26-07-2026 14:00',
        TIPO: 'TRAFO',
      }),
      descargo,
    ],
    trafos: [
      polygon({
        INCIDENCIA: 'INC-1',
        CLITOTAL: '100',
        FECHA_INICIO: '26-07-2026 11:15',
        FECHA_REPOSICION: '26-07-2026 11:45',
        TIPO: 'TRAFO',
      }),
      polygon({
        INCIDENCIA: 'INC-1',
        CLITOTAL: '100',
        FECHA_INICIO: '26-07-2026 11:15',
        FECHA_REPOSICION: '26-07-2026 11:45',
        TIPO: 'TRAFO',
      }),
      polygon({
        INCIDENCIA: 'INC-2',
        CLITOTAL: '40',
        FECHA_INICIO: '26-07-2026 10:15',
        FECHA_REPOSICION: '26-07-2026 14:00',
        TIPO: 'TRAFO',
      }),
    ],
    descargos: [descargo],
    comunas: [
      polygon({ COMUNA: 'SANTIAGO', CLIENTESAFECTADOS: '150', CLIENTESTOTAL: '1000' }),
    ],
  }

  it('calcula presión, edades y ETA sobre eventos únicos', () => {
    const result = computeOperationalIndicators(scope, new Date('2026-07-26T16:00:00.000Z'))
    expect(result).toEqual({
      nuevos60m: 2,
      delta60m: 0,
      edadMedianaMin: 105,
      edadP90Min: 213,
      etaVencidas: 1,
      sinEta: 1,
    })
  })

  it('interpreta las fechas Enel en America/Santiago y calcula la mediana continua', () => {
    expect(parseFecha('26-07-2026 12:00')?.toISOString()).toBe('2026-07-26T16:00:00.000Z')
    expect(parseFecha('2026-07-26 12:00')?.toISOString()).toBe('2026-07-26T16:00:00.000Z')
    expect(parseFecha('15-01-2026 12:00')?.toISOString()).toBe('2026-01-15T15:00:00.000Z')

    const twoEvents = {
      ...scope,
      incidencias: [scope.incidencias[0], scope.incidencias[2]],
    }
    expect(
      computeOperationalIndicators(twoEvents, new Date('2026-07-26T16:00:00.000Z'))
        .edadMedianaMin,
    ).toBe(75)
  })

  it('calcula KPIs del alcance sin inflar incidencias duplicadas', () => {
    const data = {
      avisos: { type: 'FeatureCollection', features: scope.avisos },
      trafos: { type: 'FeatureCollection', features: scope.trafos },
      descargos: { type: 'FeatureCollection', features: scope.descargos },
      comunas: { type: 'FeatureCollection', features: scope.comunas },
      alimentadores: null,
      estado: { datos: '26/07 12:00', porcentaje: null },
    } as AppData
    const result = computeKpis(data, scope)
    expect(result.incidencias).toBe(2)
    expect(result.descargos).toBe(1)
    expect(result.avisos).toBe(2)
    expect(result.clientesAfectados).toBe(150)
    expect(computeKpis(data).descargos).toBe(1)
  })
})
