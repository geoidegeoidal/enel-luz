import type { Feature, Point } from 'geojson'

/**
 * Autocompletado con Photon (komoot) sobre datos OSM.
 * CORS abierto, pensado para esto. Sesgado a la zona de concesion Enel (RM).
 * Fallback: Nominatim si Photon falla.
 */

const RM_BBOX = '-71.45,-33.95,-70.20,-33.10' // minLon,minLat,maxLon,maxLat

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

async function photon(q: string): Promise<SearchPick[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=es`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`)
  const json = await res.json()
  return (json.features as PhotonFeature[]).map((f) => {
    const { label, sub } = labelOf(f.properties)
    return {
      point: { type: 'Feature', geometry: { type: 'Point', coordinates: f.geometry.coordinates }, properties: {} },
      label,
      sub,
    }
  })
}

async function nominatim(q: string): Promise<SearchPick[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=cl&bounded=0&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  const json = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>
  return json.map((r) => {
    const parts = r.display_name.split(',')
    return {
      point: {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [parseFloat(r.lon), parseFloat(r.lat)] },
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
    list.innerHTML = items
      .map(
        (it, i) => `<button type="button" role="option" class="sr-item ${i === sel ? 'selected' : ''}" data-i="${i}">
          ${it.label}<span class="sr-sub">${it.sub}</span>
        </button>`,
      )
      .join('')
    list.classList.add('open')
    list.querySelectorAll('.sr-item').forEach((el) =>
      el.addEventListener('mousedown', (e) => {
        e.preventDefault()
        pick(Number((el as HTMLElement).dataset.i))
      }),
    )
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
