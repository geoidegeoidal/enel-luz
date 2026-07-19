/* Verificacion: hover en herramienta, reloj local, leyenda sin tapar creditos */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'C:\\Users\\Tokyotech\\AppData\\Local\\Temp\\opencode\\'

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--window-size=1680,1000'],
  defaultViewport: { width: 1680, height: 1000 },
})
const page = await browser.newPage()
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle2', timeout: 60_000 })
await page.waitForFunction(() => !!window.__mapDebug, { timeout: 30_000 })
await new Promise((r) => setTimeout(r, 3000))

// reloj local corriendo
const c1 = await page.evaluate(() => document.querySelector('#local-clock')?.textContent)
await new Promise((r) => setTimeout(r, 2500))
const c2 = await page.evaluate(() => document.querySelector('#local-clock')?.textContent)
console.log('reloj:', c1, '->', c2, '| corre:', c1 !== c2)

// hover sobre "Filtro zona" -> resalta fila 03
await page.hover('[data-tool="poly"]')
await new Promise((r) => setTimeout(r, 600))
const hl = await page.evaluate(
  () => document.querySelector('#eg-poly')?.classList.contains('eg-highlight') ?? false,
)
console.log('hover poly -> fila 03 resaltada:', hl)
await page.screenshot({ path: OUT + 'v3_hover.png' })

// click en "Mas cercana" -> fila 04 activa
await page.click('[data-tool="nearest"]')
await new Promise((r) => setTimeout(r, 600))
const act = await page.evaluate(
  () => document.querySelector('#eg-nearest')?.classList.contains('eg-active') ?? false,
)
console.log('click nearest -> fila 04 activa:', act)
await page.screenshot({ path: OUT + 'v3_active.png' })

// leyenda vs creditos: caja de leyenda no debe tapar attribution
const overlap = await page.evaluate(() => {
  const lg = document.querySelector('#map-legend')?.getBoundingClientRect()
  const attr = document.querySelector('.maplibregl-ctrl-attrib')?.getBoundingClientRect()
  if (!lg || !attr) return 'n/a'
  return !(lg.bottom > attr.top && lg.right > attr.left)
})
console.log('leyenda no tapa creditos:', overlap)

await browser.close()
console.log('OK')
