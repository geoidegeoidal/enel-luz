/* Capturas editoriales reproducibles para el README. */
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = './assets/'
const PAGE_URL = process.argv[2] ?? 'http://localhost:4173/'

await mkdir(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--window-size=1680,1000'],
  defaultViewport: { width: 1680, height: 1000, deviceScaleFactor: 1 },
})

try {
  const page = await browser.newPage()
  await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 60_000 })
  await page.waitForFunction(
    () => document.querySelectorAll('#panel-charts canvas').length >= 4 && !!window.__mapDebug,
    { timeout: 30_000 },
  )
  await new Promise((resolve) => setTimeout(resolve, 4_000))

  await page.screenshot({ path: `${OUT}final_initial.png` })

  const indicators = await page.$('#ops-panel')
  if (!indicators) throw new Error('No se encontro #ops-panel')
  await indicators.screenshot({ path: `${OUT}panel_indicators.png` })

  await page.evaluate(() => {
    const sidebar = document.querySelector('#sidebar')
    if (sidebar) sidebar.scrollTop = sidebar.scrollHeight
  })
  await new Promise((resolve) => setTimeout(resolve, 800))
  await page.screenshot({ path: `${OUT}final_charts.png` })

  await page.evaluate(() => {
    const sidebar = document.querySelector('#sidebar')
    if (sidebar) sidebar.scrollTop = 0
  })
  await page.click('#search-input')
  await page.type('#search-input', 'Manuel Montt 024', { delay: 20 })
  try {
    await page.waitForSelector('#search-results .sr-item', { timeout: 8_000 })
    await page.click('#search-results .sr-item')
  } catch {
    // El proveedor de geocoding puede no responder durante una captura local.
  }
  await new Promise((resolve) => setTimeout(resolve, 2_000))
  await page.screenshot({ path: `${OUT}final_diag.png` })

  await page.click('#report-open')
  await page.waitForSelector('#report-root .report-page:nth-of-type(2)', { timeout: 10_000 })
  const reportPage = await page.$('#report-root .report-page:first-of-type')
  if (!reportPage) throw new Error('No se encontro la primera pagina del reporte')
  await reportPage.screenshot({ path: `${OUT}panel_report.png` })

  console.log('README shots OK')
} finally {
  await browser.close()
}
