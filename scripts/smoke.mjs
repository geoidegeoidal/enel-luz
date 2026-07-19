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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
await sleep(2500)

const mapState = await page.evaluate(() => window.__mapDebug?.())
console.log('mapState.rendered:', mapState?.rendered, '| comunas:', mapState?.comunasRendered)

// 2) busqueda Photon: escribir y esperar resultados
await page.click('#search-input')
await page.type('#search-input', 'Apoquindo 4500', { delay: 25 })
let searchOk = false
try {
  await page.waitForSelector('#search-results .sr-item', { timeout: 8000 })
  searchOk = true
  await page.click('#search-results .sr-item')
  await sleep(1500)
} catch {
  console.log('search: sin resultados a tiempo')
}
const affected = await page.evaluate(
  () => document.querySelector('#analysis-body .verdict')?.textContent?.trim() ?? 'sin verdict',
)
console.log('search:', searchOk, '| verdict:', affected)

// 3) herramienta "Mas cercana": armar y click en centro del mapa
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('#toolbar button')]
  btns.find((b) => b.textContent.includes('Mas cercana'))?.click()
})
await sleep(400)
await page.mouse.click(700, 500)
await sleep(1500)
const nearest = await page.evaluate(
  () => document.querySelector('#analysis-body .verdict')?.textContent?.trim() ?? 'sin verdict',
)
console.log('nearest verdict:', nearest)

// 4) herramienta "Radio"
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('#toolbar button')]
  btns.find((b) => b.textContent.trim().startsWith('Radio'))?.click()
})
await sleep(400)
await page.mouse.click(700, 500)
await sleep(1500)
const radio = await page.evaluate(
  () => document.querySelector('#analysis-body .verdict')?.textContent?.trim() ?? 'sin verdict',
)
console.log('radio verdict:', radio)

// 5) hexbin toggle
await page.evaluate(() => {
  ;[...document.querySelectorAll('#toolbar button')].find((b) => b.textContent.includes('Densidad'))?.click()
})
await sleep(1800)
const hex = await page.evaluate(() => window.__mapDebug?.())
console.log('hexbin rendered features:', hex?.rendered)

await page.screenshot({ path: SHOT })
console.log('--- logs relevantes ---')
logs
  .filter((l) => !l.includes('ResizeObserver') && !l.includes('404'))
  .slice(0, 25)
  .forEach((l) => console.log(l))
await browser.close()
