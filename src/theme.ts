/**
 * Tema flat design — direccion "panel de instrumentos suizo":
 * papel calido + tinta + bloques de color senal. El mapa es el
 * unico campo oscuro (viewport). Cero gradientes, cero sombras.
 */
export const theme = {
  // UI clara
  paper: '#f2f0e9',
  panel: '#ffffff',
  ink: '#141414',
  ink2: '#6b6b63',
  line: '#141414',
  lineSoft: '#d8d5cb',

  // Colores senal
  red: '#e4002b',
  amber: '#e3a008',
  orange: '#ea6a00',
  green: '#12a150',
  cyan: '#00a0dc',
  violet: '#6c4fd8',

  // Semanticos
  accent: '#141414', // accion primaria = tinta (swiss)
  ok: '#12a150',
  warn: '#e3a008',
  danger: '#e4002b',
  info: '#00a0dc',
  focus: '#141414',

  /** Escala de severidad por % clientes afectados (vivid, funciona en claro y oscuro) */
  severity: ['#12a150', '#e3a008', '#ea6a00', '#e4002b'],
  severityStops: [5, 15, 50],

  /** Paleta categorica para graficos */
  chart: ['#141414', '#00a0dc', '#e3a008', '#ea6a00', '#e4002b', '#6c4fd8', '#12a150'],

  /** Campo oscuro del mapa */
  map: {
    bg: '#13171c',
    water: '#16324a',
    park: '#1b2b22',
    building: '#232c36',
    roadMinor: '#2c3742',
    roadMajor: '#46586c',
    roadHigh: '#5f7d9e',
    label: '#8fa0b0',
    labelCity: '#d5dee7',
  },
} as const

/** Colores de las capas de datos */
export const layerColors = {
  avisos: '#00a0dc',
  cluster: '#00a0dc',
  trafos: '#ea6a00',
  descargos: '#e4002b',
  comunasLine: '#0c0f12',
  alimentadores: '#6c4fd8',
  hexbin: ['#232c36', '#00a0dc', '#ea6a00', '#e4002b'],
  analysis: '#00a0dc',
  searchMarker: '#e3a008',
} as const

/** Paletas de UI (el chrome de la app; el mapa tiene su propio modo) */
export interface UiPalette {
  paper: string
  panel: string
  ink: string
  ink2: string
  lineSoft: string
  focus: string
  masthead: string
}

export const UI_LIGHT: UiPalette = {
  paper: '#f2f0e9',
  panel: '#ffffff',
  ink: '#141414',
  ink2: '#6b6b63',
  lineSoft: '#d8d5cb',
  focus: '#141414',
  masthead: '#141414',
}

export const UI_DARK: UiPalette = {
  paper: '#17191d',
  panel: '#1f2227',
  ink: '#eceae2',
  ink2: '#93918a',
  lineSoft: '#3a3d43',
  focus: '#eceae2',
  masthead: '#0d0f12',
}

export type UiMode = 'light' | 'dark'

/** Paleta UI activa (mutable: los graficos la leen en cada render) */
export const ui: UiPalette = { ...UI_LIGHT }

/** Inyecta las custom properties CSS en :root */
export function applyTheme(): void {
  const r = document.documentElement.style
  const statics: Record<string, string> = {
    red: theme.red,
    amber: theme.amber,
    orange: theme.orange,
    green: theme.green,
    cyan: theme.cyan,
    violet: theme.violet,
    ok: theme.ok,
    warn: theme.warn,
    danger: theme.danger,
    info: theme.info,
    'map-bg': theme.map.bg,
  }
  for (const [k, v] of Object.entries(statics)) r.setProperty(`--${k}`, v)
  applyUiMode((localStorage.getItem('enel-luz-ui') as UiMode) ?? 'light')
}

/** Cambia el modo claro/oscuro del chrome de la app */
export function applyUiMode(mode: UiMode): void {
  const p = mode === 'dark' ? UI_DARK : UI_LIGHT
  Object.assign(ui, p)
  const r = document.documentElement.style
  r.setProperty('--paper', p.paper)
  r.setProperty('--panel', p.panel)
  r.setProperty('--ink', p.ink)
  r.setProperty('--ink-2', p.ink2)
  r.setProperty('--line', p.ink)
  r.setProperty('--line-soft', p.lineSoft)
  r.setProperty('--focus', p.focus)
  r.setProperty('--masthead', p.masthead)
  document.documentElement.dataset.ui = mode
  localStorage.setItem('enel-luz-ui', mode)
}

export type BasemapMode = 'dark' | 'light' | 'sat'

/** Color de severidad para un porcentaje dado */
export function severityColor(pct: number): string {
  const [a, b, c] = theme.severityStops
  if (pct < a) return theme.severity[0]
  if (pct < b) return theme.severity[1]
  if (pct < c) return theme.severity[2]
  return theme.severity[3]
}
