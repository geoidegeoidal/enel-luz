/**
 * Espejo de datos publicos de Enel (mapaemergencia.enel.com) -> public/data/
 * Corre localmente (npm run fetch-data) y en GitHub Actions (cada 5 min).
 * Solo escribe archivos si el timestamp de estado cambio (o con --force).
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const BASE = 'https://mapaemergencia.enel.com/galeria/documento/'
const OUT_DIR = new URL('../public/data/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const FORCE = process.argv.includes('--force')

const FILES = [
  { src: 'me-capa-avisos.txt', out: 'avisos.geojson', required: true },
  { src: 'me-capa-trafosAfectados.txt', out: 'trafos.geojson', required: true },
  { src: 'me-capa-descargos.txt', out: 'descargos.geojson', required: true },
  { src: 'me-capa-comunasAfectadas.txt', out: 'comunas.geojson', required: true },
  { src: 'me-capa-alimAfectados.txt', out: 'alimentadores.geojson', required: false },
]

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

async function fetchJson(url, { retries = 3 } = {}) {
  let lastErr
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json,text/plain,*/*' },
        signal: AbortSignal.timeout(60_000),
      })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      return JSON.parse(text)
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)))
    }
  }
  throw lastErr
}

async function readCurrentStamp() {
  try {
    const raw = await readFile(join(OUT_DIR, 'estado.json'), 'utf8')
    return JSON.parse(raw)?.datos ?? null
  } catch {
    return null
  }
}

const main = async () => {
  await mkdir(OUT_DIR, { recursive: true })

  const estado = await fetchJson(BASE + 'me-capa-estado.txt')
  if (!estado || estado.errorCode !== 0) throw new Error('estado invalido o no disponible')

  const stamp = estado.datos
  const current = await readCurrentStamp()
  console.log(`[fetch-data] remoto: "${stamp}" | local: "${current}"`)

  if (!FORCE && stamp === current) {
    console.log('[fetch-data] sin cambios, nada que hacer')
    return
  }

  const summary = {}
  for (const f of FILES) {
    const data = await fetchJson(BASE + f.src)
    if (data === null) {
      if (f.required) throw new Error(`capa requerida no disponible: ${f.src}`)
      console.log(`[fetch-data] ${f.src}: 404 (opcional, se omite)`)
      continue
    }
    if (data.type !== 'FeatureCollection') throw new Error(`formato inesperado en ${f.src}`)
    await writeFile(join(OUT_DIR, f.out), JSON.stringify(data))
    summary[f.out] = data.features?.length ?? 0
    console.log(`[fetch-data] ${f.out}: ${summary[f.out]} features`)
  }

  const estadoOut = { datos: stamp, porcentaje: estado.porcentaje ?? null, fetchedAt: new Date().toISOString() }
  await writeFile(join(OUT_DIR, 'estado.json'), JSON.stringify(estadoOut))
  console.log(`[fetch-data] OK -> estado.json "${stamp}"`, summary)
}

main().catch((err) => {
  console.error('[fetch-data] ERROR:', err.message)
  process.exit(1)
})
