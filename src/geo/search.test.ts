import { describe, expect, it } from 'vitest'
import {
  RM_BBOX,
  buildNominatimUrl,
  buildPhotonUrl,
  isInsideRm,
} from './search'

describe('búsqueda acotada a la Región Metropolitana', () => {
  it('configura Photon con bbox, país y sesgo hacia Santiago', () => {
    const url = new URL(buildPhotonUrl('Apoquindo 4500'))

    expect(url.searchParams.get('q')).toBe('Apoquindo 4500')
    expect(url.searchParams.get('bbox')).toBe(RM_BBOX.join(','))
    expect(url.searchParams.get('countrycode')).toBe('CL')
    expect(url.searchParams.get('lon')).toBe('-70.66')
    expect(url.searchParams.get('lat')).toBe('-33.45')
  })

  it('configura Nominatim con viewbox estricta como fallback', () => {
    const url = new URL(buildNominatimUrl('Apoquindo 4500'))

    expect(url.searchParams.get('bounded')).toBe('1')
    expect(url.searchParams.get('countrycodes')).toBe('cl')
    expect(url.searchParams.get('viewbox')).toBe('-71.45,-33.1,-70.2,-33.95')
  })

  it('rechaza coordenadas fuera de la RM aunque el proveedor las devuelva', () => {
    expect(isInsideRm([-70.58, -33.42])).toBe(true)
    expect(isInsideRm([-73.25, -39.81])).toBe(false)
    expect(isInsideRm([-70.3, -34.2])).toBe(false)
  })
})
