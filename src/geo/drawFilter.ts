import type { Feature, Polygon, Position } from 'geojson'
import type { Map as MLMap } from 'maplibre-gl'
import { setOverlay } from '../map/layers'

/**
 * Dibujo de poligono liviano sin dependencias:
 * click = vertice, doble click o Enter = cerrar, Esc = cancelar.
 */
export class DrawSession {
  private pts: Position[] = []
  private active = false
  private marker: Feature[] = []

  constructor(
    private map: MLMap,
    private onDone: (poly: Feature<Polygon>) => void,
    private onCancel: () => void,
  ) {}

  private clickHandler = (e: maplibregl.MapMouseEvent) => {
    this.pts.push([e.lngLat.lng, e.lngLat.lat])
    this.render()
  }
  private dblHandler = (e: maplibregl.MapMouseEvent) => {
    e.preventDefault()
    this.finish()
  }
  private keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.cancel()
    if (e.key === 'Enter') this.finish()
  }

  start(): void {
    if (this.active) return
    this.active = true
    this.pts = []
    this.map.doubleClickZoom.disable()
    this.map.on('click', this.clickHandler)
    this.map.on('dblclick', this.dblHandler)
    window.addEventListener('keydown', this.keyHandler)
    this.map.getCanvas().style.cursor = 'crosshair'
  }

  private render(): void {
    const feats: Feature[] = this.pts.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: c },
      properties: { color: '#2d9cdb' },
    }))
    if (this.pts.length >= 2) {
      feats.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [...this.pts, this.pts[0]] },
        properties: {},
      })
    }
    if (this.pts.length >= 3) {
      feats.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...this.pts, this.pts[0]]] },
        properties: {},
      })
    }
    this.marker = feats
    setOverlay(this.map, feats)
  }

  private teardown(): void {
    this.active = false
    this.map.off('click', this.clickHandler)
    this.map.off('dblclick', this.dblHandler)
    window.removeEventListener('keydown', this.keyHandler)
    this.map.doubleClickZoom.enable()
    this.map.getCanvas().style.cursor = ''
  }

  finish(): void {
    if (!this.active) return
    if (this.pts.length < 3) return
    const poly: Feature<Polygon> = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[...this.pts, this.pts[0]]] },
      properties: {},
    }
    this.teardown()
    this.onDone(poly)
  }

  cancel(): void {
    if (!this.active) return
    this.teardown()
    this.onCancel()
  }

  get isActive(): boolean {
    return this.active
  }
}
