import type { AppData, Estado } from './model'

const BASE = 'data/'

async function getJson<T>(path: string, { optional = false } = {}): Promise<T | null> {
  const res = await fetch(`${BASE}${path}?t=${Date.now()}`, { cache: 'no-cache' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status} al cargar ${path}`)
  const text = await res.text()
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    // Dev/preview devuelve index.html (SPA fallback) para archivos inexistentes
    if (optional) return null
    throw new Error(`Respuesta no-JSON al cargar ${path}`)
  }
  return JSON.parse(text) as T
}

export async function loadEstado(): Promise<Estado> {
  const e = await getJson<Estado>('estado.json')
  if (!e) throw new Error('estado.json no disponible')
  return e
}

export async function loadAll(): Promise<AppData> {
  const estado = await loadEstado()
  const [avisos, trafos, descargos, comunas, alimentadores] = await Promise.all([
    getJson<AppData['avisos']>('avisos.geojson'),
    getJson<AppData['trafos']>('trafos.geojson'),
    getJson<AppData['descargos']>('descargos.geojson'),
    getJson<AppData['comunas']>('comunas.geojson'),
    getJson<AppData['alimentadores']>('alimentadores.geojson', { optional: true }),
  ])
  if (!avisos || !trafos || !descargos || !comunas) {
    throw new Error('Faltan capas de datos en el espejo')
  }
  return { estado, avisos, trafos, descargos, comunas, alimentadores: alimentadores ?? null }
}

/** Devuelve data nueva solo si el timestamp remoto cambio */
export async function reloadIfChanged(currentStamp: string): Promise<AppData | null> {
  const estado = await loadEstado()
  if (estado.datos === currentStamp) return null
  return loadAll()
}
