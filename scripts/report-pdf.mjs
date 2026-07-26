/* Genera un PDF de verificacion desde el reporte client-side. */
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PAGE_URL = process.argv[2] ?? 'http://localhost:4173/'
const SCOPE = process.argv[3] ?? 'RM'
const OUTPUT = process.argv[4] ?? './output/pdf/luz-rm-reporte-rm.pdf'

await mkdir(dirname(OUTPUT), { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--window-size=1680,1000'],
  defaultViewport: { width: 1680, height: 1000 },
})

try {
  const page = await browser.newPage()
  await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 60_000 })
  await page.waitForFunction(
    () => document.querySelectorAll('#panel-charts canvas').length >= 4 && !!window.__mapDebug,
    { timeout: 30_000 },
  )
  if (SCOPE !== 'RM') {
    await page.evaluate((scope) => window.__selectComunaDebug?.(scope), SCOPE)
    await page.waitForFunction(
      (scope) =>
        document.querySelector('#scope-label')?.textContent?.includes(scope.replaceAll('_', ' ')),
      { timeout: 10_000 },
      SCOPE,
    )
  }
  await page.click('#report-open')
  await page.waitForSelector('#report-root .report-page:nth-of-type(2)', { timeout: 10_000 })
  await page.emulateMediaType('print')
  await page.pdf({
    path: OUTPUT,
    printBackground: true,
    preferCSSPageSize: true,
    landscape: true,
    format: 'A4',
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  })
  console.log(`report PDF OK: ${OUTPUT}`)
} finally {
  await browser.close()
}
