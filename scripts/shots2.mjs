/* Verificacion: panel kepler, dark mode UI, basemap claro, satelital */
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
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle2', timeout: 60_000 })
await page.waitForFunction(() => !!window.__mapDebug, { timeout: 30_000 })
await new Promise((r) => setTimeout(r, 3500))

// 1) estado inicial: panel kepler + leyenda comuna
await page.screenshot({ path: OUT + 'v2_panel.png' })

// 2) basemap CLARO
await page.evaluate(() => {
  ;[...document.querySelectorAll('.lp-bm')].find((b) => b.dataset.bm === 'light')?.click()
})
await new Promise((r) => setTimeout(r, 4500))
await page.screenshot({ path: OUT + 'v2_light_map.png' })
const lightState = await page.evaluate(() => window.__mapDebug())
console.log('light basemap rendered:', lightState.rendered, '| comunas:', lightState.comunasRendered)

// 3) basemap SATELITAL
await page.evaluate(() => {
  ;[...document.querySelectorAll('.lp-bm')].find((b) => b.dataset.bm === 'sat')?.click()
})
await new Promise((r) => setTimeout(r, 5000))
await page.screenshot({ path: OUT + 'v2_sat.png' })
const satState = await page.evaluate(() => window.__mapDebug())
console.log('sat basemap rendered:', satState.rendered, '| comunas:', satState.comunasRendered)

// 4) UI DARK MODE (volver a basemap oscuro primero)
await page.evaluate(() => {
  ;[...document.querySelectorAll('.lp-bm')].find((b) => b.dataset.bm === 'dark')?.click()
})
await new Promise((r) => setTimeout(r, 2000))
await page.click('#theme-toggle')
await new Promise((r) => setTimeout(r, 1500))
await page.screenshot({ path: OUT + 'v2_dark_ui.png' })

// 5) dark UI + hexbin (leyenda contextual densidad)
await page.evaluate(() => {
  ;[...document.querySelectorAll('[data-eye]')].find((b) => b.dataset.eye === 'hexbin')?.click()
})
await new Promise((r) => setTimeout(r, 2000))
await page.screenshot({ path: OUT + 'v2_dark_hex.png' })

console.log('pageerrors:', errors.length ? errors : 'ninguno')
await browser.close()
console.log('shots OK')
