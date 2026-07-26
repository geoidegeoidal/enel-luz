/* Smoke test con Chrome real via CDP: carga, interacciones y screenshot */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PAGE_URL = process.argv[2] ?? 'http://localhost:4173/'
const SHOT = process.argv[3] ?? 'C:\\Users\\Tokyotech\\AppData\\Local\\Temp\\opencode\\smoke.png'

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--window-size=1680,1000'],
  defaultViewport: { width: 1680, height: 1000 },
})
const page = await browser.newPage()
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url().slice(0, 110)} ${r.failure()?.errorText}`))
await page.setRequestInterception(true)
page.on('request', (request) => {
  const url = request.url()
  if (url.startsWith('https://photon.komoot.io/api/') && url.includes('Apoquindo')) {
    void request.respond({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-73.25, -39.81] },
            properties: { name: 'Apoquindo fuera de RM', city: 'La Union' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-70.57, -33.41] },
            properties: {
              name: 'Apoquindo 4500',
              district: '<img src=x onerror="window.__xss=1">',
              city: 'Las Condes',
            },
          },
        ],
      }),
    })
  } else {
    void request.continue()
  }
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const assert = (condition, message) => {
  if (!condition) throw new Error(`[smoke] ${message}`)
}

await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 60_000 })

// 1) esperar render completo
const t0 = Date.now()
let ready = false
while (Date.now() - t0 < 30_000) {
  ready = await page.evaluate(
    () => document.querySelectorAll('#panel-charts canvas').length >= 4 && !!window.__mapDebug,
  )
  if (ready) break
  await sleep(500)
}
console.log('ready:', ready)
assert(ready, 'la aplicación no alcanzó el estado listo')
await sleep(2500)

const mapState = await page.evaluate(() => window.__mapDebug?.())
console.log('mapState.rendered:', mapState?.rendered, '| comunas:', mapState?.comunasRendered)
assert(mapState?.layers?.includes('ly-comunas-fill'), 'faltan capas de datos')

// 2) cross-filter: una comuna gobierna contexto, mapa y panel; luego se puede limpiar
await page.evaluate((nombre) => window.__selectComunaDebug?.(nombre), mapState?.firstComuna)
await sleep(900)
const scoped = await page.evaluate(() => ({
  selected: window.__mapDebug?.().selectedComuna,
  visible: window.__mapDebug?.().visibleSummary,
  label: document.querySelector('#scope-label')?.textContent?.trim(),
  clearVisible: !document.querySelector('#scope-clear')?.classList.contains('hidden'),
  chartCount: document.querySelectorAll('#panel-charts canvas').length,
}))
assert(scoped.selected === mapState?.firstComuna, 'la comuna no quedo seleccionada')
assert(
  scoped.label?.includes(mapState?.firstComuna?.replaceAll('_', ' ')),
  'el contexto no refleja la comuna',
)
assert(scoped.clearVisible, 'no se ofrecio restaurar la vista RM')
assert(scoped.visible?.comunas === 1, 'el alcance no se limito a una comuna')
assert(scoped.visible?.avisos <= mapState?.visibleSummary?.avisos, 'aumentaron avisos al filtrar')
assert(scoped.visible?.eventos <= mapState?.visibleSummary?.eventos, 'aumentaron eventos al filtrar')
assert(scoped.chartCount === 4, 'los graficos desaparecieron durante el cross-filter')
await page.click('#scope-clear')
await sleep(500)
const restored = await page.evaluate(() => window.__mapDebug?.())
assert(restored?.selectedComuna === null, 'el cross-filter no se limpio')
assert(
  restored?.visibleSummary?.avisos === mapState?.visibleSummary?.avisos &&
    restored?.visibleSummary?.eventos === mapState?.visibleSummary?.eventos,
  'la vista RM no restauro sus conteos',
)

// 3) reporte regional y comunal: mismo alcance, dos paginas y mapa operacional
await page.click('#report-open')
await page.waitForSelector('#report-root')
const regionalReport = await page.evaluate(() => ({
  pages: document.querySelectorAll('#report-root .report-page').length,
  scope: document.querySelector('#report-root .report-meta')?.textContent,
  comunaPaths: document.querySelectorAll('#report-root .report-map-comuna').length,
  operationalGroups: document.querySelectorAll(
    '#report-root .report-map-incidencia-markers, #report-root .report-map-avisos',
  ).length,
  mapLegend: document.querySelector('#report-root .report-map-legend')?.textContent,
  printLabel: document.querySelector('#report-print')?.textContent?.trim(),
}))
assert(regionalReport.pages === 2, 'el reporte RM no tiene dos paginas')
assert(regionalReport.scope?.includes('RM'), 'el reporte RM no declara su alcance')
assert(regionalReport.comunaPaths > 0, 'el reporte RM no genero mapa vectorial')
assert(
  regionalReport.operationalGroups === 2 &&
    regionalReport.mapLegend?.includes('incidencia') &&
    regionalReport.mapLegend?.includes('aviso'),
  'el mapa del reporte no incluye sus capas operacionales',
)
assert(
  regionalReport.printLabel === 'IMPRIMIR / GUARDAR PDF',
  'el reporte no ofrece exportacion PDF',
)
await page.click('#report-close')
await page.evaluate((nombre) => window.__selectComunaDebug?.(nombre), mapState?.firstComuna)
await sleep(500)
await page.click('#report-open')
await page.waitForSelector('#report-root')
const communeReportScope = await page.evaluate(
  () => document.querySelector('#report-root .report-meta')?.textContent ?? '',
)
assert(
  communeReportScope.includes(mapState?.firstComuna?.replaceAll('_', ' ')),
  'el reporte comunal no conserva el alcance',
)
await page.click('#report-close')
await page.click('#scope-clear')
await sleep(400)

// 4) busqueda Photon: escribir y esperar resultados
await page.click('#search-input')
await page.type('#search-input', 'Apoquindo 4500', { delay: 25 })
let searchOk = false
try {
  await page.waitForSelector('#search-results .sr-item', { timeout: 8000 })
  searchOk = true
} catch {
  console.log('search: sin resultados a tiempo')
}
if (searchOk) {
  const safeSearchDom = await page.evaluate(
    () => !document.querySelector('#search-results img') && !window.__xss,
  )
  assert(safeSearchDom, 'el geocoder inyectó HTML en los resultados')
  await page.click('#search-results .sr-item')
  await sleep(1500)
}
const affected = await page.evaluate(
  () => document.querySelector('#analysis-body .verdict')?.textContent?.trim() ?? 'sin verdict',
)
console.log('search:', searchOk, '| verdict:', affected)
assert(searchOk, 'el buscador no devolvió resultados')
const searchState = await page.evaluate(() => window.__mapDebug?.())
const [lon, lat] = searchState?.center ?? []
assert(
  lon >= -71.45 && lon <= -70.2 && lat >= -33.95 && lat <= -33.1,
  `la búsqueda salió de la RM: ${lon},${lat}`,
)

// 5) herramienta "Mas cercana": armar y click en centro del mapa
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('#analysis-tools button')]
  btns.find((b) => b.textContent.includes('Mas cercana'))?.click()
})
await sleep(400)
await page.mouse.click(700, 500)
await sleep(1500)
const nearest = await page.evaluate(
  () => document.querySelector('#analysis-body .verdict')?.textContent?.trim() ?? 'sin verdict',
)
console.log('nearest verdict:', nearest)
assert(nearest.includes('INCIDENCIA MAS CERCANA'), 'la herramienta de incidencia cercana no respondió')

// 6) herramienta "Radio"
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('#analysis-tools button')]
  btns.find((b) => b.textContent.trim().startsWith('Radio'))?.click()
})
await sleep(400)
await page.mouse.click(700, 500)
await sleep(1500)
const radio = await page.evaluate(
  () => document.querySelector('#analysis-body .verdict')?.textContent?.trim() ?? 'sin verdict',
)
console.log('radio verdict:', radio)
assert(radio.includes('RADIO DE'), 'la herramienta de radio no respondió')

// 7) hexbin toggle
await page.evaluate(() => {
  document.querySelector('[data-eye="hexbin"]')?.click()
})
await sleep(1800)
const hex = await page.evaluate(() => window.__mapDebug?.())
console.log('hexbin rendered features:', hex?.rendered)
assert(hex?.hexbinVisibility === 'visible', 'la capa hexbin no quedó visible')

// 8) tema UI + reporte: el PDF usa SVG de impresion y foco aislado aun en dark
await page.click('#theme-toggle')
await sleep(400)
const darkMode = await page.evaluate(() => window.__mapDebug?.().uiMode)
assert(darkMode === 'dark', 'el modo oscuro de la UI no se aplicó')
await page.click('#report-open')
await page.waitForSelector('#report-root')
const darkReport = await page.evaluate(() => ({
  svgCount: document.querySelectorAll('#report-root .report-chart-svg').length,
  appInert: document.querySelector('#app')?.hasAttribute('inert'),
  activeId: document.activeElement?.id,
}))
assert(darkReport.svgCount === 2, 'el reporte no usa graficos SVG dedicados')
assert(darkReport.appInert, 'el dashboard no quedo inert bajo el dialogo')
assert(darkReport.activeId === 'report-print', 'el foco no entro al dialogo')
await page.keyboard.down('Shift')
await page.keyboard.press('Tab')
await page.keyboard.up('Shift')
const trappedFocus = await page.evaluate(() => document.activeElement?.id)
assert(trappedFocus === 'report-close', 'el foco no cicla dentro del dialogo')
await page.keyboard.press('Escape')
const reportClosed = await page.evaluate(() => ({
  root: !!document.querySelector('#report-root'),
  appInert: document.querySelector('#app')?.hasAttribute('inert'),
}))
assert(!reportClosed.root && !reportClosed.appInert, 'el dialogo no restauro la app')
await page.click('#theme-toggle')
await sleep(250)

await page.screenshot({ path: SHOT })
console.log('--- logs relevantes ---')
logs
  .filter((l) => !l.includes('ResizeObserver') && !l.includes('404'))
  .slice(0, 25)
  .forEach((l) => console.log(l))
await browser.close()
