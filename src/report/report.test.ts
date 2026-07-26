import { describe, expect, it } from 'vitest'
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson'
import type { AppData } from '../data/model'
import type { VisibleData } from '../geo/analysis'
import {
  buildEtaReportSvg,
  buildReportModel,
  buildScopeMapSvg,
  buildTimelineReportSvg,
} from './report'

type Poly = Feature<Polygon | MultiPolygon>

const polygon = (
  x: number,
  properties: Record<string, unknown>,
): Poly => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [x, 0],
        [x + 1, 0],
        [x + 1, 1],
        [x, 1],
        [x, 0],
      ],
    ],
  },
  properties,
})

const point = (code: string): Feature<Point> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [0.5, 0.5] },
  properties: { CODIGO: code, FECHA_INI: '26-07-2026 11:45' },
})

function fixture(): { data: AppData; visible: VisibleData } {
  const comunas = [
    polygon(0, {
      COMUNA: 'COMUNA_UNO',
      CLIENTESAFECTADOS: 100,
      CLIENTESTOTAL: 1000,
      PORCENTAJE: 10,
    }),
    polygon(1, {
      COMUNA: 'COMUNA_DOS',
      CLIENTESAFECTADOS: 25,
      CLIENTESTOTAL: 500,
      PORCENTAJE: 5,
    }),
  ]
  const trafos = [
    polygon(0, {
      INCIDENCIA: 'INC-1',
      TIPO: 'FALLA',
      CLITOTAL: 80,
      FECHA_INICIO: '26-07-2026 10:00',
      FECHA_REPOSICION: '26-07-2026 11:30',
    }),
    polygon(0.1, {
      INCIDENCIA: 'INC-1',
      TIPO: 'FALLA',
      CLITOTAL: 120,
      FECHA_INICIO: '26-07-2026 10:00',
      FECHA_REPOSICION: '26-07-2026 11:30',
    }),
  ]
  const descargos = [
    polygon(1, {
      INCIDENCIA: 'DESC-1',
      TIPO: 'DESCARGO',
      CLITOTAL: 40,
      FECHA_INICIO: '26-07-2026 11:00',
      FECHA_REPOSICION: '26-07-2026 14:30',
    }),
  ]
  const avisos = [point('A-1'), point('A-2')]
  const data: AppData = {
    estado: {
      datos: '26/07 11:50',
      porcentaje: 8,
      fetchedAt: '2026-07-26T15:55:00.000Z',
    },
    avisos: { type: 'FeatureCollection', features: avisos },
    trafos: { type: 'FeatureCollection', features: trafos },
    descargos: { type: 'FeatureCollection', features: descargos },
    comunas: { type: 'FeatureCollection', features: comunas },
    alimentadores: null,
  }
  const visible: VisibleData = {
    avisos,
    trafos,
    descargos,
    incidencias: [...trafos, ...descargos],
    comunas,
    ids: null,
  }
  return { data, visible }
}

describe('reporte operativo', () => {
  it('construye un snapshot deduplicado y prioriza ETA vencidas', () => {
    const { data, visible } = fixture()
    const model = buildReportModel({
      data,
      visible,
      scopeLabel: 'RM',
      now: new Date('2026-07-26T16:00:00.000Z'),
    })

    expect(model.kpis.incidencias).toBe(1)
    expect(model.kpis.descargos).toBe(1)
    expect(model.events).toHaveLength(2)
    expect(model.events[0]).toMatchObject({
      id: 'INC-1',
      clientes: 120,
      estadoEta: 'vencida',
    })
    expect(model.status.tone).toBe('red')
    expect(model.freshness).toBe('descargado hace 5 min')
    expect(model.comunas.map((item) => item.nombre)).toEqual(['COMUNA UNO', 'COMUNA DOS'])
  })

  it('genera un mapa SVG operacional con severidad, incidencias y avisos', () => {
    const { visible } = fixture()
    const svg = buildScopeMapSvg(visible.comunas, 400, 200, {
      incidencias: visible.trafos,
      avisos: visible.avisos,
    })

    expect(svg).toContain('aria-label="Mapa operacional del alcance: 1 incidencia y 2 avisos"')
    expect(svg).toContain('<title>COMUNA UNO: 10.00%</title>')
    expect(svg).toContain('fill="#e3a008"')
    expect(svg).toContain('class="report-map-incidencias"')
    expect(svg).toContain('fill="#ea6a00"')
    expect((svg.match(/class="report-map-comuna"/g) ?? [])).toHaveLength(2)
    expect((svg.match(/<circle /g) ?? [])).toHaveLength(2)
  })

  it('genera graficos SVG de impresion independientes del tema de pantalla', () => {
    const { visible } = fixture()
    const now = new Date('2026-07-26T16:00:00.000Z')
    const timeline = buildTimelineReportSvg(visible, now)
    const eta = buildEtaReportSvg(visible.incidencias, now)

    expect(timeline).toContain('class="report-chart-svg"')
    expect(timeline).toContain('fill="#ffffff"')
    expect(timeline).toContain('AHORA')
    expect(eta).toContain('aria-label="Escala de reposicion por evento"')
    expect(eta).toContain('#e4002b')
  })

  it('marca como seguimiento requerido cuando existen eventos sin ETA', () => {
    const { data, visible } = fixture()
    for (const event of visible.incidencias) {
      if (event.properties) event.properties.FECHA_REPOSICION = ''
    }
    const model = buildReportModel({
      data,
      visible,
      scopeLabel: 'RM',
      now: new Date('2026-07-26T16:00:00.000Z'),
    })

    expect(model.operational.sinEta).toBe(2)
    expect(model.status).toMatchObject({
      tone: 'amber',
      label: 'SEGUIMIENTO REQUERIDO',
    })
  })
})
