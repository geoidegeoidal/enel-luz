import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
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
  incidenciaInicio,
  dedupeIncidencias,
  enelHourStart,
  fmtEnelHour,
  fmtEnelDayHour,
  type OperationalIndicators,
} from '../data/model'

echarts.use([BarChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer])

export interface ChartCtx {
  onComunaSelect: (nombre: string) => void
  onIncidenciaSelect: (id: string) => void
}

const MONO = "'IBM Plex Mono', 'Consolas', monospace"
const SANS = "'IBM Plex Sans', 'Segoe UI', Arial, sans-serif"

const fmtDuration = (minutes: number): string => {
  const mins = Math.max(0, Math.round(minutes))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${hours}h`
}

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}
const escHtml = (value: unknown): string =>
  String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char])

const axisText = () => ({ color: ui.ink2, fontSize: 10, fontFamily: MONO })
const splitLine = () => ({ lineStyle: { color: ui.lineSoft, width: 1 } })
const axisLine = () => ({ lineStyle: { color: ui.lineSoft } })

const tooltipBase = () => ({
  backgroundColor: ui.panel,
  borderColor: ui.ink,
  borderWidth: 1,
  textStyle: { color: ui.ink, fontSize: 12, fontFamily: SANS },
  extraCssText: 'border-radius:0;',
  confine: true,
})

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
      grid: { left: 6, right: 78, top: 8, bottom: 4, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { ...axisText(), formatter: (v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`) },
        splitLine: splitLine(),
        axisLine: axisLine(),
      },
      yAxis: {
        type: 'category',
        data: rows.map((r) => r.display),
        axisLabel: { ...axisText(), fontFamily: SANS, fontSize: 10.5, color: ui.ink },
        axisLine: axisLine(),
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
            formatter: (p: any) => {
              const row = rows[p.dataIndex]
              return `${fmtNum(p.value)} · ${row.pct.toFixed(1)}%`
            },
          },
        },
      ],
      tooltip: {
        ...tooltipBase(),
        formatter: (p: any) => {
          const r = rows[p.dataIndex]
          return `<b>${escHtml(p.name)}</b><br/>Clientes afectados: <b>${fmtNum(p.value)}</b><br/>Afectacion comunal: <b>${r.pct.toFixed(1)}%</b>`
        },
      },
    } as EChartsCoreOption)
  }
  return { update }
}

/* ---------------- Reloj operativo: presión pasada + ETA futura ---------------- */

export function initTimelineChart(el: HTMLElement) {
  const chart = makeChart(el)

  const update = (avisos: Feature[], incidencias: Feature[]) => {
    const hourMs = 60 * 60 * 1000
    const now = new Date()
    const nowHour = enelHourStart(now)
    const buckets = Array.from({ length: 25 }, (_, i) => {
      const offset = i - 12
      const start = new Date(nowHour.getTime() + offset * hourMs)
      return { offset, start, avisos: 0, incidencias: 0, reposiciones: 0, vencidas: 0 }
    })
    const bucketFor = (d: Date | null) => {
      if (!d) return null
      const offset = Math.floor((d.getTime() - nowHour.getTime()) / hourMs)
      return offset < -12 || offset > 12 ? null : buckets[offset + 12]
    }
    avisos.forEach((f) => {
      const d = parseFecha(propStr(f, 'FECHA_INI'))
      if (d && d.getTime() <= now.getTime()) {
        const bucket = bucketFor(d)
        if (bucket) bucket.avisos++
      }
    })
    const uniqueInc = dedupeIncidencias(incidencias)
    uniqueInc.forEach((f) => {
      const start = incidenciaInicio(f)
      if (start && start.getTime() <= now.getTime()) {
        const bucket = bucketFor(start)
        if (bucket) bucket.incidencias++
      }
      const eta = parseFecha(propStr(f, 'FECHA_REPOSICION'))
      const etaBucket = bucketFor(eta)
      if (eta && etaBucket) {
        if (eta.getTime() <= now.getTime()) etaBucket.vencidas++
        else etaBucket.reposiciones++
      }
    })
    const labels = buckets.map((b) => fmtEnelHour(b.start))
    chart.setOption({
      grid: { left: 6, right: 10, top: 24, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          ...axisText(),
          fontSize: 9,
          interval: 3,
          formatter: (v: string, i: number) => (i === 12 ? 'AHORA' : v),
        },
        axisLine: axisLine(),
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: axisText(),
        splitLine: splitLine(),
        axisLine: axisLine(),
      },
      series: [
        {
          name: 'Avisos',
          type: 'bar',
          stack: 'operacion',
          data: buckets.map((b) => b.avisos),
          itemStyle: { color: theme.cyan },
          barMaxWidth: 12,
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: { color: ui.ink, width: 1 },
            label: {
              show: true,
              formatter: 'AHORA',
              color: ui.ink,
              fontFamily: MONO,
              fontSize: 9,
            },
            data: [{ xAxis: labels[12] }],
          },
        },
        {
          name: 'Inicios',
          type: 'bar',
          stack: 'operacion',
          data: buckets.map((b) => b.incidencias),
          itemStyle: { color: theme.orange },
          barMaxWidth: 12,
        },
        {
          name: 'ETA futuras',
          type: 'bar',
          stack: 'operacion',
          data: buckets.map((b) => b.reposiciones),
          itemStyle: { color: theme.green },
          barMaxWidth: 12,
        },
        {
          name: 'ETA vencidas',
          type: 'bar',
          stack: 'operacion',
          data: buckets.map((b) => b.vencidas),
          itemStyle: { color: theme.red },
          barMaxWidth: 12,
        },
      ],
      tooltip: {
        ...tooltipBase(),
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: ui.ink } },
        formatter: (ps: any[]) => {
          const b = buckets[ps[0]?.dataIndex ?? 0]
          const t = fmtEnelDayHour(b.start)
          const lines = ps
            .filter((p) => Number(p.value) > 0)
            .map((p) => `${p.seriesName}: <b style="font-family:${MONO}">${p.value}</b>`)
            .join('<br/>')
          return `<b>${t}</b><br/>${lines || 'Sin actividad registrada'}`
        },
      },
    } as EChartsCoreOption)
  }
  return { update }
}

/* ---------------- Escala de reposición y antigüedad ---------------- */

export function initEtaChart(el: HTMLElement, ctx: ChartCtx) {
  const chart = makeChart(el)
  let lastRows: Array<{
    id: string
    minutos: number | null
    texto: string
    color: string
    clientes: number
  }> = []
  chart.on('click', (p: any) => {
    const id = lastRows[p?.dataIndex]?.id
    if (id) ctx.onIncidenciaSelect(id)
  })

  const update = (incidencias: Feature[]) => {
    const now = Date.now()
    const rows = dedupeIncidencias(incidencias)
      .map((f) => {
        const id = incidenciaId(f) || 'SIN ID'
        const eta = parseFecha(propStr(f, 'FECHA_REPOSICION'))
        const minutos = eta ? Math.round((eta.getTime() - now) / 60000) : null
        const texto =
          minutos === null
            ? 'SIN ETA'
            : minutos <= 0
              ? `VENCIDA ${fmtDuration(Math.abs(minutos))}`
              : `+${fmtDuration(minutos)}`
        const color =
          minutos === null ? ui.ink2 : minutos <= 0 ? theme.red : minutos <= 120 ? theme.amber : theme.green
        return { id, minutos, texto, color, clientes: propNum(f, 'CLITOTAL') }
      })
      .sort((a, b) => {
        if (a.minutos === null) return b.minutos === null ? b.clientes - a.clientes : 1
        if (b.minutos === null) return -1
        return a.minutos - b.minutos
      })
      .slice(0, 9)
      .reverse()
    lastRows = rows
    const maxAbs = Math.max(60, ...rows.map((r) => Math.abs(r.minutos ?? 0)))
    chart.setOption({
      grid: { left: 6, right: 82, top: 14, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        min: -maxAbs,
        max: maxAbs,
        axisLabel: {
          ...axisText(),
          formatter: (v: number) => (v === 0 ? 'AHORA' : `${v > 0 ? '+' : '−'}${fmtDuration(Math.abs(v))}`),
        },
        splitLine: splitLine(),
        axisLine: axisLine(),
      },
      yAxis: {
        type: 'category',
        data: rows.map((r) => r.id),
        axisLabel: {
          ...axisText(),
          fontSize: 9,
          formatter: (v: string) => (v.length > 13 ? `…${v.slice(-12)}` : v),
        },
        axisLine: axisLine(),
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: rows.map((r) => ({
            value: r.minutos ?? 0,
            itemStyle: { color: r.color },
          })),
          barMaxWidth: 11,
          label: {
            show: true,
            position: 'right',
            color: ui.ink,
            fontSize: 9,
            fontFamily: MONO,
            fontWeight: 600,
            formatter: (p: any) => rows[p.dataIndex]?.texto ?? '',
          },
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: { color: ui.ink, width: 1 },
            label: { show: false },
            data: [{ xAxis: 0 }],
          },
        },
      ],
      tooltip: {
        ...tooltipBase(),
        formatter: (p: any) => {
          const row = rows[p.dataIndex]
          return `<b>${escHtml(row.id)}</b><br/>Reposicion: <b>${row.texto}</b><br/>Clientes asociados: <b>${fmtNum(row.clientes)}</b>`
        },
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
      byId.set(id, Math.max(byId.get(id) ?? 0, propNum(f, 'CLITOTAL')))
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
        axisLabel: { ...axisText(), formatter: (v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`) },
        splitLine: splitLine(),
        axisLine: axisLine(),
      },
      yAxis: {
        type: 'category',
        data: rows.map((r) => r.id),
        axisLabel: {
          ...axisText(),
          fontSize: 9,
          formatter: (v: string) => (v.length > 10 ? `..${v.slice(-9)}` : v),
        },
        axisLine: axisLine(),
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
        ...tooltipBase(),
        formatter: (p: any) => `${escHtml(p.name)}<br/>Clientes: <b style="font-family:${MONO}">${fmtNum(p.value)}</b>`,
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

export function renderOperationalIndicators(
  el: HTMLElement,
  indicators: OperationalIndicators,
): void {
  const age = (value: number | null) => (value === null ? '—' : fmtDuration(value))
  const delta = indicators.delta60m
  const rows = [
    { label: 'Presion 60m', value: fmtNum(indicators.nuevos60m), tone: 'cyan' },
    {
      label: 'vs hora previa',
      value: `${delta > 0 ? '+' : ''}${fmtNum(delta)}`,
      tone: delta > 0 ? 'red' : delta < 0 ? 'green' : 'neutral',
    },
    { label: 'Edad P50', value: age(indicators.edadMedianaMin), tone: 'neutral' },
    { label: 'Edad P90', value: age(indicators.edadP90Min), tone: 'amber' },
    { label: 'ETA vencidas', value: fmtNum(indicators.etaVencidas), tone: 'red' },
    { label: 'Sin ETA', value: fmtNum(indicators.sinEta), tone: 'neutral' },
  ]
  el.innerHTML = rows
    .map(
      (row) => `<div class="op-stat op-${row.tone}">
        <span class="op-value">${row.value}</span>
        <span class="op-label">${row.label}</span>
      </div>`,
    )
    .join('')
}

export function updateAllCharts(
  charts: {
    comunas: { update: (f: Feature[]) => void }
    timeline: { update: (a: Feature[], i: Feature[]) => void }
    eta: { update: (i: Feature[]) => void }
    ranking: { update: (i: Feature[]) => void }
  },
  data: AppData,
  visible: { avisos: Feature[]; incidencias: Feature[]; comunas: Feature[] },
): void {
  charts.comunas.update(visible.comunas)
  charts.timeline.update(visible.avisos, visible.incidencias)
  charts.eta.update(visible.incidencias)
  charts.ranking.update(visible.incidencias)
  void data
}
