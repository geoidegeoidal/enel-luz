/* Capturas de verificacion: estado inicial + sidebar scrolleado */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = './assets/'

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--window-size=1680,1000'],
  defaultViewport: { width: 1680, height: 1000 },
})
const page = await browser.newPage()
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle2', timeout: 60_000 })
await page.waitForFunction(() => !!window.__mapDebug, { timeout: 30_000 })
await new Promise((r) => setTimeout(r, 4000))

// 1) estado inicial (guia + mapa default)
await page.screenshot({ path: OUT + 'final_initial.png' })

// 2) sidebar abajo (donut + ranking)
await page.evaluate(() => {
  document.querySelector('#sidebar').scrollTop = 99999
})
await new Promise((r) => setTimeout(r, 800))
await page.screenshot({ path: OUT + 'final_charts.png' })

// 3) busqueda + diagnostico (estado con tarjeta)
await page.click('#search-input')
await page.type('#search-input', 'Manuel Montt 024', { delay: 25 })
try {
  await page.waitForSelector('#search-results .sr-item', { timeout: 8000 })
  await page.click('#search-results .sr-item')
} catch {}
await new Promise((r) => setTimeout(r, 2200))
await page.screenshot({ path: OUT + 'final_diag.png' })

await browser.close()
console.log('shots OK')
