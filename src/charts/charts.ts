import * as echarts from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import type { Feature } from 'geojson'
import { theme, ui, severityColor } from '../theme'
import {
  AppData,
  Kpis,
  allIncidencias,
  propStr,
  propNum,
  parseFecha,
  fmtNum,
  incidenciaId,
  prettyName,
} from '../data/model'

echarts.use([BarChart, PieChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer])

export interface ChartCtx {
  onComunaSelect: (nombre: string) => void
  onIncidenciaSelect: (id: string) => void
}

const MONO = "'IBM Plex Mono', 'Consolas', monospace"
const SANS = "'IBM Plex Sans', 'Segoe UI', Arial, sans-serif"

const axisText = { color: ui.ink2, fontSize: 10, fontFamily: MONO }
const splitLine = { lineStyle: { color: ui.lineSoft, width: 1 } }
const axisLine = { lineStyle: { color: ui.lineSoft } }

const tooltipBase = {
  backgroundColor: ui.panel,
  borderColor: ui.ink,
  borderWidth: 1,
  textStyle: { color: ui.ink, fontSize: 12, fontFamily: SANS },
  extraCssText: 'border-radius:0;',
  confine: true,
}

function makeChart(el: HTMLElement) {
  const c = echarts.init(el, undefined, { renderer: 'canvas' })
  const ro = new ResizeObserver(() => c.resize())
  ro.observe(el)
  return c
}

/* ---------------- Barras: clientes afectados por comuna ---------------- */

export function initComunaChart(el: HTMLElement, ctx: ChartCtx) {
  const chart = makeChart(el)
  let lastRows: Array<{ nombre: string; display: string }> = []
  chart.on('click', (p: any) => {
    const raw = lastRows[p?.dataIndex]?.nombre
    if (raw) ctx.onComunaSelect(raw)
  })

  const update = (comunas: Feature[]) => {
    const rows = comunas
      .map((f) => ({
        nombre: propStr(f, 'COMUNA'),
        display: prettyName(propStr(f, 'COMUNA')),
        afectados: propNum(f, 'CLIENTESAFECTADOS'),
        pct: propNum(f, 'PORCENTAJE'),
      }))
      .sort((a, b) => b.afectados - a.afectados)
      .slice(0, 12)
      .reverse()
    lastRows = rows

    chart.setOption({
      grid: { left: 6, right: 46, top: 8, bottom: 4, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { ...axisText, formatter: (v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`) },
        splitLine,
        axisLine,
      },
      yAxis: {
        type: 'category',
        data: rows.map((r) => r.display),
        axisLabel: { ...axisText, fontFamily: SANS, fontSize: 10.5, color: ui.ink },
        axisLine,
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: rows.map((r) => ({
            value: r.afectados,
            itemStyle: {
              color: severityColor(r.pct),
            },
          })),
          barMaxWidth: 13,
          label: {
            show: true,
            position: 'right',
            color: ui.ink,
            fontSize: 10,
            fontFamily: MONO,
            fontWeight: 600,
            formatter: (p: any) => fmtNum(p.value),
          },
        },
      ],
      tooltip: {
        ...tooltipBase,
        formatter: (p: any) => {
          const r = rows[p.dataIndex]
          return `<b>${p.name}</b><br/>Clientes afectados: <b>${fmtNum(p.value)}</b><br/>Afectacion comunal: <b>${r.pct.toFixed(1)}%</b>`
        },
      },
    } as EChartsCoreOption)
  }
  return { update }
}

/* ---------------- Timeline: inicios por hora ---------------- */

export function initTimelineChart(el: HTMLElement) {
  const chart = makeChart(el)

  const update = (avisos: Feature[], incidencias: Feature[]) => {
    const buckets = new Map<string, { avisos: number; incidencias: number; sort: number }>()
    const key = (d: Date) => {
      const p = (n: number) => String(n).padStart(2, '0')
      return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:00`
    }
    const bump = (d: Date | null, kind: 'avisos' | 'incidencias') => {
      if (!d) return
      const k = key(d)
      if (!buckets.has(k)) buckets.set(k, { avisos: 0, incidencias: 0, sort: d.getTime() })
      buckets.get(k)![kind]++
    }
    avisos.forEach((f) => bump(parseFecha(propStr(f, 'FECHA_INI')), 'avisos'))
    incidencias.forEach((f) => bump(parseFecha(propStr(f, 'FECHA_INICIO')), 'incidencias'))

    const ordered = [...buckets.entries()].sort((a, b) => a[1].sort - b[1].sort).slice(-24)
    chart.setOption({
      grid: { left: 6, right: 10, top: 10, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category',
        data: ordered.map(([k]) => k),
        axisLabel: {
          ...axisText,
          fontSize: 9,
          rotate: 50,
          interval: 2,
          formatter: (v: string) => v.split(' ')[1] ?? v,
        },
        axisLine,
        axisTick: { show: false },
      },
      yAxis: { type: 'value', axisLabel: axisText, splitLine, axisLine },
      series: [
        {
          name: 'Avisos',
          type: 'bar',
          stack: 't',
          data: ordered.map(([, v]) => v.avisos),
          itemStyle: { color: theme.cyan },
          barMaxWidth: 14,
        },
        {
          name: 'Incidencias',
          type: 'bar',
          stack: 't',
          data: ordered.map(([, v]) => v.incidencias),
          itemStyle: { color: theme.orange },
          barMaxWidth: 14,
        },
      ],
      tooltip: {
        ...tooltipBase,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: ui.ink } },
        formatter: (ps: any[]) => {
          const t = ps[0]?.axisValue ?? ''
          const lines = ps
            .map((p) => `${p.seriesName}: <b style="font-family:${MONO}">${p.value}</b>`)
            .join('<br/>')
          return `<b>${t}</b><br/>${lines}`
        },
      },
    } as EChartsCoreOption)
  }
  return { update }
}

/* ---------------- Donut: estados de incidencia ---------------- */

export function initEstadosChart(el: HTMLElement) {
  const chart = makeChart(el)

  const update = (incidencias: Feature[]) => {
    const counts = new Map<string, number>()
    incidencias.forEach((f) => {
      const e = propStr(f, 'ESTADOINC') || 'Sin estado'
      counts.set(e, (counts.get(e) ?? 0) + 1)
    })
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const total = rows.reduce((a, [, v]) => a + v, 0)
    // Top 4 + "Otros" para no saturar la dona en ancho medio
    const top = rows.slice(0, 4)
    const rest = rows.slice(4).reduce((a, [, v]) => a + v, 0)
    const slices: Array<[string, number]> = rest > 0 ? [...top, ['Otros', rest]] : top
    chart.setOption({
      series: [
        {
          type: 'pie',
          radius: ['52%', '76%'],
          center: ['50%', '50%'],
          data: slices.map(([name, value], i) => ({
            name,
            value,
            itemStyle: {
              color: name === 'Otros' ? ui.lineSoft : theme.chart[i % theme.chart.length],
              borderColor: ui.panel,
              borderWidth: 2,
            },
          })),
          label: {
            color: ui.ink,
            fontSize: 9.5,
            fontFamily: SANS,
            formatter: (p: any) => `${p.name}\n${p.value}`,
          },
          labelLine: { lineStyle: { color: ui.ink2 }, length: 6, length2: 6 },
        },
      ],
      title: {
        text: fmtNum(total),
        subtext: 'TOTAL',
        left: 'center',
        top: '40%',
        textStyle: { fontFamily: MONO, fontSize: 20, fontWeight: 700, color: ui.ink },
        subtextStyle: { fontFamily: SANS, fontSize: 8.5, color: ui.ink2 },
        itemGap: 0,
      },
      tooltip: {
        ...tooltipBase,
        formatter: (p: any) => `${p.name}: <b style="font-family:${MONO}">${p.value}</b> (${p.percent}%)`,
      },
    } as EChartsCoreOption)
  }
  return { update }
}

/* ---------------- Ranking: top incidencias por clientes ---------------- */

export function initRankingChart(el: HTMLElement, ctx: ChartCtx) {
  const chart = makeChart(el)
  chart.on('click', (p: any) => p?.name && ctx.onIncidenciaSelect(String(p.name)))

  const update = (incidencias: Feature[]) => {
    // Agregar por INCIDENCIA: varios trafos pueden pertenecer al mismo evento
    const byId = new Map<string, number>()
    for (const f of incidencias) {
      const id = incidenciaId(f)
      if (!id) continue
      byId.set(id, (byId.get(id) ?? 0) + propNum(f, 'CLITOTAL'))
    }
    const rows = [...byId.entries()]
      .map(([id, clientes]) => ({ id, clientes }))
      .sort((a, b) => b.clientes - a.clientes)
      .slice(0, 7)
      .reverse()
    chart.setOption({
      grid: { left: 6, right: 44, top: 8, bottom: 4, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { ...axisText, formatter: (v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`) },
        splitLine,
        axisLine,
      },
      yAxis: {
        type: 'category',
        data: rows.map((r) => r.id),
        axisLabel: {
          ...axisText,
          fontSize: 9,
          formatter: (v: string) => (v.length > 10 ? `..${v.slice(-9)}` : v),
        },
        axisLine,
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: rows.map((r, i) => ({
            value: r.clientes,
            itemStyle: { color: i === rows.length - 1 ? theme.danger : ui.ink },
          })),
          barMaxWidth: 12,
          label: {
            show: true,
            position: 'right',
            color: ui.ink,
            fontSize: 10,
            fontFamily: MONO,
            fontWeight: 600,
            formatter: (p: any) => fmtNum(p.value),
          },
        },
      ],
      tooltip: {
        ...tooltipBase,
        formatter: (p: any) => `${p.name}<br/>Clientes: <b style="font-family:${MONO}">${fmtNum(p.value)}</b>`,
      },
    } as EChartsCoreOption)
  }
  return { update }
}

/* ---------------- KPI band ---------------- */

interface KpiDef {
  key: keyof Kpis
  label: string
  valueClass: string
  fmt: (n: number) => string
  context?: (k: Kpis) => string
}

const KPI_DEFS: KpiDef[] = [
  {
    key: 'clientesAfectados',
    label: 'Clientes afectados',
    valueClass: '',
    fmt: fmtNum,
    context: (k) => `de ${fmtNum(k.clientesTotales)} clientes`,
  },
  {
    key: 'porcentajeClientes',
    label: '% suministro afectado',
    valueClass: 'v-amber',
    fmt: (n) => `${n.toFixed(2)}%`,
    context: () => 'suma comunas afectadas',
  },
  {
    key: 'incidencias',
    label: 'Incidencias activas',
    valueClass: 'v-orange',
    fmt: fmtNum,
    context: (k) => `${fmtNum(k.descargos)} descargos`,
  },
  {
    key: 'avisos',
    label: 'Avisos de clientes',
    valueClass: 'v-cyan',
    fmt: fmtNum,
    context: () => 'reportes individuales',
  },
  {
    key: 'descargos',
    label: 'Descargos',
    valueClass: 'v-red',
    fmt: fmtNum,
    context: () => 'fallas agrupadas',
  },
  {
    key: 'comunasAfectadas',
    label: 'Comunas afectadas',
    valueClass: 'v-green',
    fmt: fmtNum,
    context: () => 'concesion Enel RM',
  },
]

export function renderKpis(el: HTMLElement, kpis: Kpis): void {
  el.innerHTML = KPI_DEFS.map((d, i) => {
    const hero = i === 0 ? ' k-hero' : ''
    const vc = d.valueClass ? ` ${d.valueClass}` : ''
    return `<div class="kpi${hero}">
      <span class="kpi-value${vc}">${d.fmt(kpis[d.key] as number)}</span>
      <span class="kpi-label">${d.label}</span>
      <span class="kpi-context">${d.context ? d.context(kpis) : ''}</span>
    </div>`
  }).join('')
}

export function updateAllCharts(
  charts: {
    comunas: { update: (f: Feature[]) => void }
    timeline: { update: (a: Feature[], i: Feature[]) => void }
    estados: { update: (i: Feature[]) => void }
    ranking: { update: (i: Feature[]) => void }
  },
  data: AppData,
  visible: { avisos: Feature[]; incidencias: Feature[]; comunas: Feature[] },
): void {
  charts.comunas.update(visible.comunas)
  charts.timeline.update(visible.avisos, visible.incidencias)
  charts.estados.update(visible.incidencias)
  charts.ranking.update(visible.incidencias)
  void data
}
