import { layerColors, theme, BasemapMode, UiMode } from '../theme'
import type { ToggleableLayer } from '../map/layers'
import type { AppData } from '../data/model'
import { fmtNum } from '../data/model'

/* ---------------- Iconos SVG geometricos de un color ---------------- */
const I = {
  radio: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/></svg>',
  poly: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20 4 6l8-3 8 5-2 12z" stroke="currentColor" stroke-width="2"/></svg>',
  nearest: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="currentColor" stroke-width="2"/></svg>',
  hex: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2 21 7v10l-9 5-9-5V7z" stroke="currentColor" stroke-width="2"/></svg>',
  clear: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.5"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>',
  eyeOff:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 4l16 16" stroke="currentColor" stroke-width="2"/><path d="M9.9 5.9A9.8 9.8 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17.6 17.6 0 0 1-3.3 4M6.1 7.5A16.9 16.9 0 0 0 2 12s3.5 6.5 10 6.5c1.2 0 2.3-.2 3.3-.6" stroke="currentColor" stroke-width="2"/></svg>',
  chevron:
    '<svg viewBox="0 0 24 24" fill="none"><path d="m6 15 6-6 6 6" stroke="currentColor" stroke-width="2.5"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2" stroke="currentColor" stroke-width="2"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none"><path d="M20 13.5A8.5 8.5 0 0 1 10.5 4 8.5 8.5 0 1 0 20 13.5z" fill="currentColor" stroke="none"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" stroke-width="2"/><path d="m19 19-4.5-4.5" stroke="currentColor" stroke-width="2"/></svg>',
} as const

/* ---------------- Panel de capas (estilo kepler.gl) ---------------- */

export interface ToolbarHandlers {
  onToggleLayer: (g: ToggleableLayer, visible: boolean) => void
  onBasemap: (mode: BasemapMode) => void
  onToolRadio: () => void
  onToolPoly: () => void
  onToolNearest: () => void
  onToolHexbin: (on: boolean) => void
  onClearAnalysis: () => void
  /** hover sobre una herramienta (null al salir) para describirla en el panel */
  onToolHover: (tool: 'radio' | 'poly' | 'nearest' | null) => void
}

const LAYER_ROWS: Array<{ g: ToggleableLayer | 'hexbin'; label: string; desc: string; color: string }> = [
  { g: 'comunas', label: 'Comunas', desc: 'clientes sin luz (en vivo)', color: theme.green },
  { g: 'trafos', label: 'Incidencias', desc: 'cortes confirmados (red BT)', color: layerColors.trafos },
  { g: 'descargos', label: 'Descargos', desc: 'fallas masivas (red MT)', color: layerColors.descargos },
  { g: 'avisos', label: 'Avisos', desc: 'reportes de usuarios', color: layerColors.avisos },
  { g: 'hexbin', label: 'Densidad', desc: 'concentración espacial', color: layerColors.hexbin[1] },
]

export function buildToolbar(el: HTMLElement, h: ToolbarHandlers): void {
  el.innerHTML = `
    <div class="lp-header">
      <span class="lp-title">CAPAS</span>
      <button type="button" class="lp-collapse" aria-label="Contraer panel de capas">${I.chevron}</button>
    </div>
    <div class="lp-body">
      <div class="lp-section">CORTES DE ENERGIA</div>
      <div class="lp-layers">
        ${LAYER_ROWS.map(
          (r) => `
          <div class="lp-layer ${r.g === 'hexbin' ? 'off' : ''}" data-row="${r.g}">
            <span class="lp-sw" style="background-color:${r.color}"></span>
            <div class="lp-info">
              <span class="lp-name">${r.label}</span>
              <span class="lp-desc">${r.desc}</span>
            </div>
            <span class="lp-count mono" data-count="${r.g}"></span>
            <button type="button" class="lp-eye" data-eye="${r.g}" aria-label="Mostrar u ocultar ${r.label}" aria-pressed="${r.g !== 'hexbin'}">
              <span class="eye-on">${I.eye}</span><span class="eye-off">${I.eyeOff}</span>
            </button>
          </div>`,
        ).join('')}
      </div>
      <div class="lp-section">MAPA BASE</div>
      <div class="lp-basemaps">
        <button type="button" class="lp-bm active" data-bm="dark"><span class="lp-bm-thumb bm-dark"></span>OSCURO</button>
        <button type="button" class="lp-bm" data-bm="light"><span class="lp-bm-thumb bm-light"></span>CLARO</button>
        <button type="button" class="lp-bm" data-bm="sat"><span class="lp-bm-thumb bm-sat"></span>SATELITAL</button>
      </div>
    </div>`

  /* collapse */
  el.querySelector('.lp-collapse')!.addEventListener('click', () => {
    el.classList.toggle('collapsed')
  })

  /* eye toggles */
  el.querySelectorAll<HTMLButtonElement>('[data-eye]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.eye as ToggleableLayer | 'hexbin'
      const row = el.querySelector(`[data-row="${key}"]`)!
      const on = row.classList.toggle('off') === false
      btn.setAttribute('aria-pressed', String(on))
      if (key === 'hexbin') h.onToolHexbin(on)
      else h.onToggleLayer(key, on)
    })
  })

  /* basemap switch */
  el.querySelectorAll<HTMLButtonElement>('[data-bm]').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.lp-bm').forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      h.onBasemap(btn.dataset.bm as BasemapMode)
    })
  })

  /* auto-collapse on mobile */
  if (window.innerWidth <= 768) {
    el.classList.add('collapsed')
  }
}

export function buildAnalysisTools(el: HTMLElement, h: ToolbarHandlers): void {
  el.innerHTML = `
    <button type="button" class="tb-btn tb-search" data-tool="search" title="Busca una direccion arriba para saber si esta afectada y su ETA de reposicion">${I.search}Dirección</button>
    <button type="button" class="tb-btn tb-radio" data-tool="radio" title="Click en el mapa: cuenta avisos, incidencias y clientes en un radio de 500 m">${I.radio}Radio</button>
    <button type="button" class="tb-btn tb-poly" data-tool="poly" title="Dibuja un poligono: filtra mapa y graficos a esa zona">${I.poly}Filtro zona</button>
    <button type="button" class="tb-btn tb-nearest" data-tool="nearest" title="Click en el mapa: encuentra la incidencia mas proxima con distancia y ETA">${I.nearest}Mas cercana</button>
    <button type="button" class="tb-btn tb-clear" data-clear title="Quita overlays, filtro espacial y resultados">${I.clear}Limpiar</button>
  `
  el.querySelector('[data-tool="search"]')!.addEventListener('click', () => {
    document.getElementById('search-input')?.focus()
  })
  el.querySelector('[data-tool="radio"]')!.addEventListener('click', h.onToolRadio)
  el.querySelector('[data-tool="poly"]')!.addEventListener('click', h.onToolPoly)
  el.querySelector('[data-tool="nearest"]')!.addEventListener('click', h.onToolNearest)
  el.querySelector('[data-clear]')!.addEventListener('click', h.onClearAnalysis)

  /* hover -> describir herramienta en el panel derecho */
  for (const tool of ['search', 'radio', 'poly', 'nearest'] as const) {
    const btn = el.querySelector(`[data-tool="${tool}"]`)
    if (!btn) continue
    btn.addEventListener('mouseenter', () => h.onToolHover(tool as any))
    btn.addEventListener('mouseleave', () => h.onToolHover(null))
    btn.addEventListener('focus', () => h.onToolHover(tool as any))
    btn.addEventListener('blur', () => h.onToolHover(null))
  }
}

/** Conteos de features en las filas de capas (como kepler) */
export function updateLayerCounts(el: HTMLElement, data: AppData): void {
  const counts: Record<string, number> = {
    comunas: data.comunas.features.length,
    trafos: data.trafos.features.length,
    descargos: data.descargos.features.length,
    avisos: data.avisos.features.length,
    hexbin: 0,
  }
  el.querySelectorAll('[data-count]').forEach((span) => {
    const k = (span as HTMLElement).dataset.count!
    span.textContent = counts[k] > 0 ? fmtNum(counts[k]) : '—'
  })
}

/** Marca visual de herramienta activa en el panel */
export function setPanelHexbin(el: HTMLElement, on: boolean): void {
  el.querySelector(`[data-row="hexbin"]`)?.classList.toggle('off', !on)
  el.querySelector(`[data-eye="hexbin"]`)?.setAttribute('aria-pressed', String(on))
}

/* ---------------- Toggle de tema UI (masthead) ---------------- */

export function buildThemeToggle(btn: HTMLElement, onToggle: (mode: UiMode) => void): void {
  const render = () => {
    const isDark = document.documentElement.dataset.ui === 'dark'
    btn.innerHTML = isDark ? I.sun : I.moon
    btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro')
    btn.setAttribute('title', isDark ? 'Modo claro' : 'Modo oscuro')
  }
  btn.addEventListener('click', () => {
    const next: UiMode = document.documentElement.dataset.ui === 'dark' ? 'light' : 'dark'
    onToggle(next)
    render()
  })
  render()
}

/* ---------------- Estado vacio del panel de analisis ---------------- */
export const EMPTY_ANALYSIS_HTML = `
  <div class="empty-guide">
    <div class="eg-row" id="eg-search"><span class="eg-num">01</span><span><b>Busca una direccion</b> arriba para saber si esta afectada y su ETA de reposicion.</span></div>
    <div class="eg-row" id="eg-radio"><span class="eg-num n2">02</span><span><b>Radio</b>: click en el mapa y cuenta avisos e incidencias en 500 m.</span></div>
    <div class="eg-row" id="eg-poly"><span class="eg-num n3">03</span><span><b>Filtro zona</b>: dibuja un poligono para filtrar mapa y graficos.</span></div>
    <div class="eg-row" id="eg-nearest"><span class="eg-num n4">04</span><span><b>Mas cercana</b>: localiza la incidencia mas proxima a cualquier punto.</span></div>
  </div>`

/** Resalta la fila de la guia asociada a una herramienta (hover/armado) */
export function highlightGuideRow(tool: string | null, active = false): void {
  for (const id of ['eg-search', 'eg-radio', 'eg-poly', 'eg-nearest']) {
    document.getElementById(id)?.classList.remove('eg-highlight')
    if (!active) document.getElementById(id)?.classList.remove('eg-active')
  }
  if (!tool) return
  const row = document.getElementById(`eg-${tool}`)
  row?.classList.add(active ? 'eg-active' : 'eg-highlight')
  if (active) row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

/* ---------------- Toast ---------------- */
let toastTimer: ReturnType<typeof setTimeout> | undefined

export function toast(msg: string, ms = 3200): void {
  const el = document.getElementById('toast')!
  el.textContent = msg
  el.classList.remove('hidden')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms)
}

/* ---------------- Leyenda contextual (escala graduada) ---------------- */

export type LegendMode = 'comuna' | 'hexbin' | null

export function buildLegend(el: HTMLElement, mode: LegendMode): void {
  if (!mode) {
    el.classList.add('hidden')
    el.innerHTML = ''
    return
  }

  const steps =
    mode === 'comuna'
      ? {
          title: 'COMUNAS · % CLIENTES AFECTADOS',
          items: [
            { c: theme.severity[0], l: '0–5%' },
            { c: theme.severity[1], l: '5–15%' },
            { c: theme.severity[2], l: '15–50%' },
            { c: theme.severity[3], l: '>50%' },
          ],
        }
      : {
          title: 'DENSIDAD · AVISOS POR HEXAGONO',
          items: [
            { c: layerColors.hexbin[0], l: '1–2' },
            { c: layerColors.hexbin[1], l: '3–7' },
            { c: layerColors.hexbin[2], l: '8–19' },
            { c: layerColors.hexbin[3], l: '20+' },
          ],
        }

  el.innerHTML = `
    <div class="lg-title">${steps.title}</div>
    <div class="lg-strip">
      ${steps.items
        .map(
          (i) => `<div class="lg-step"><span class="lg-block" style="background-color:${i.c}"></span><span class="lg-lab">${i.l}</span></div>`,
        )
        .join('')}
    </div>`
  el.classList.remove('hidden')
}
