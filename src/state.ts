import type { Feature, Polygon, MultiPolygon } from 'geojson'
import type { AppData } from './data/model'

export interface AppState {
  data: AppData | null
  /** Poligono de filtro espacial dibujado por el usuario (null = sin filtro) */
  filterPoly: Feature<Polygon | MultiPolygon> | null
  /** Comuna seleccionada desde graficos/mapa (cross-filter) */
  selectedComuna: string | null
}

type Listener = (state: AppState) => void

class Store {
  state: AppState = { data: null, filterPoly: null, selectedComuna: null }
  private listeners = new Set<Listener>()

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((fn) => fn(this.state))
  }

  toggleComuna(nombre: string | null): void {
    this.set({ selectedComuna: this.state.selectedComuna === nombre ? null : nombre })
  }
}

export const store = new Store()
