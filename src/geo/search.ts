import type { Feature, Point } from 'geojson'

/**
 * Autocompletado con Photon (komoot) sobre datos OSM.
 * CORS abierto, pensado para esto. Sesgado a la zona de concesion Enel (RM).
 * Fallback: Nominatim si Photon falla.
 */

/** Área de concesión usada por el visor: minLon, minLat, maxLon, maxLat. */
export const RM_BBOX = [-71.45, -33.95, -70.2, -33.1] as const
const RM_BBOX_PARAM = RM_BBOX.join(',')
const RM_VIEWBOX_PARAM = `${RM_BBOX[0]},${RM_BBOX[3]},${RM_BBOX[2]},${RM_BBOX[1]}`

export interface SearchPick {
  point: Feature<Point>
  label: string
  sub: string
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    district?: string
    city?: string
    county?: string
    state?: string
  }
}

function labelOf(p: PhotonFeature['properties']): { label: string; sub: string } {
  const label = [p.name, p.street && `${p.street} ${p.housenumber ?? ''}`.trim()]
    .filter(Boolean)
    .join(' · ')
  const sub = [p.district, p.city ?? p.county, p.state].filter(Boolean).join(', ')
  return { label: label || sub || 'Resultado', sub }
}

export function isInsideRm([lon, lat]: [number, number]): boolean {
  return lon >= RM_BBOX[0] && lon <= RM_BBOX[2] && lat >= RM_BBOX[1] && lat <= RM_BBOX[3]
}

export function buildPhotonUrl(q: string): string {
  const params = new URLSearchParams({
    q,
    limit: '6',
    lang: 'es',
    bbox: RM_BBOX_PARAM,
    countrycode: 'CL',
    lon: '-70.66',
    lat: '-33.45',
    zoom: '10',
  })
  return `https://photon.komoot.io/api/?${params}`
}

export function buildNominatimUrl(q: string): string {
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '6',
    countrycodes: 'cl',
    viewbox: RM_VIEWBOX_PARAM,
    bounded: '1',
    q,
  })
  return `https://nominatim.openstreetmap.org/search?${params}`
}

async function photon(q: string): Promise<SearchPick[]> {
  const res = await fetch(buildPhotonUrl(q))
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`)
  const json = await res.json()
  return (json.features as PhotonFeature[])
    .filter((f) => isInsideRm(f.geometry.coordinates))
    .map((f) => {
      const { label, sub } = labelOf(f.properties)
      return {
        point: { type: 'Feature', geometry: { type: 'Point', coordinates: f.geometry.coordinates }, properties: {} },
        label,
        sub,
      }
    })
}

async function nominatim(q: string): Promise<SearchPick[]> {
  const res = await fetch(buildNominatimUrl(q), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  const json = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>
  return json
    .map((r) => ({ ...r, coords: [parseFloat(r.lon), parseFloat(r.lat)] as [number, number] }))
    .filter((r) => isInsideRm(r.coords))
    .map((r) => {
      const parts = r.display_name.split(',')
      return {
        point: {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: r.coords },
          properties: {},
        },
        label: parts.slice(0, 2).join(',').trim(),
        sub: parts.slice(2, 5).join(',').trim(),
      }
    })
}

export function attachSearch(
  input: HTMLInputElement,
  list: HTMLElement,
  onPick: (pick: SearchPick) => void,
): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let items: SearchPick[] = []
  let sel = -1

  const close = () => {
    list.classList.remove('open')
    list.innerHTML = ''
    items = []
    sel = -1
  }

  const render = () => {
    const buttons = items.map((it, i) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('role', 'option')
      button.setAttribute('aria-selected', String(i === sel))
      button.className = `sr-item ${i === sel ? 'selected' : ''}`
      button.dataset.i = String(i)
      button.append(document.createTextNode(it.label))
      const sub = document.createElement('span')
      sub.className = 'sr-sub'
      sub.textContent = it.sub
      button.append(sub)
      button.addEventListener('mousedown', (e) => {
        e.preventDefault()
        pick(i)
      })
      return button
    })
    list.replaceChildren(...buttons)
    list.classList.add('open')
  }

  const pick = (i: number) => {
    const it = items[i]
    if (!it) return
    input.value = it.label
    close()
    onPick(it)
  }

  const run = async (q: string) => {
    try {
      items = await photon(q)
    } catch {
      try {
        items = await nominatim(q)
      } catch {
        items = []
      }
    }
    items.length ? render() : close()
  }

  input.addEventListener('input', () => {
    clearTimeout(timer)
    const q = input.value.trim()
    if (q.length < 3) return close()
    timer = setTimeout(() => run(q), 350)
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return close()
    if (e.key === 'ArrowDown') {
      sel = Math.min(sel + 1, items.length - 1)
      render()
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      sel = Math.max(sel - 1, -1)
      render()
      e.preventDefault()
    } else if (e.key === 'Enter') {
      if (sel >= 0) pick(sel)
      else if (items.length) pick(0)
    }
  })

  input.addEventListener('blur', () => setTimeout(close, 150))
}
