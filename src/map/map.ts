import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { styleFor } from './basemap'
import type { BasemapMode } from '../theme'

export function createMap(container: HTMLElement, basemap: BasemapMode = 'dark'): maplibregl.Map {
  const map = new maplibregl.Map({
    container,
    style: styleFor(basemap),
    center: [-70.66, -33.45],
    zoom: 10,
    minZoom: 8,
    maxZoom: 18,
    attributionControl: { compact: true },
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
  map.getCanvas().setAttribute('aria-label', 'Mapa de cortes de energia')
  return map
}

export { maplibregl }
