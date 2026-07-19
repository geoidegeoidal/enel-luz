import type { StyleSpecification } from 'maplibre-gl'
import { theme, BasemapMode } from '../theme'

const OMT_SOURCE = {
  type: 'vector' as const,
  url: 'https://tiles.openfreemap.org/planet',
}
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'

interface FlatPalette {
  bg: string
  park: string
  water: string
  building: string
  boundary: string
  roadMinor: string
  roadMajor: string
  roadHigh: string
  label: string
  labelCity: string
}

function flatVectorStyle(p: FlatPalette, name: string): StyleSpecification {
  return {
    version: 8,
    name,
    glyphs: GLYPHS,
    sources: { openmaptiles: OMT_SOURCE },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': p.bg } },
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        filter: ['in', 'class', 'park', 'grass', 'wood', 'cemetery', 'golf_course', 'scrub'],
        paint: { 'fill-color': p.park },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': p.water },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        paint: { 'fill-color': p.building },
      },
      {
        id: 'boundary-comuna',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['<=', 'admin_level', 6],
        minzoom: 9,
        paint: { 'line-color': p.boundary, 'line-width': 1, 'line-dasharray': [3, 3] },
      },
      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'minor', 'service', 'track'],
        minzoom: 13,
        paint: {
          'line-color': p.roadMinor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 16, 2],
        },
      },
      {
        id: 'road-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'secondary', 'tertiary', 'primary'],
        minzoom: 10,
        paint: {
          'line-color': p.roadMajor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 4],
        },
      },
      {
        id: 'road-high',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk'],
        minzoom: 8,
        paint: {
          'line-color': p.roadHigh,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 16, 6],
        },
      },
      {
        id: 'road-name',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 14,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'symbol-placement': 'line',
          'text-max-angle': 40,
        },
        paint: { 'text-color': p.label },
      },
      {
        id: 'place-suburb',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['in', 'class', 'suburb', 'neighbourhood', 'village', 'town'],
        minzoom: 11,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.08,
        },
        paint: { 'text-color': p.label },
      },
      {
        id: 'place-city',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['==', 'class', 'city'],
        minzoom: 8,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 15,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.1,
        },
        paint: { 'text-color': p.labelCity },
      },
    ],
  }
}

const DARK_PALETTE: FlatPalette = {
  bg: theme.map.bg,
  park: theme.map.park,
  water: theme.map.water,
  building: theme.map.building,
  boundary: '#2c3742',
  roadMinor: theme.map.roadMinor,
  roadMajor: theme.map.roadMajor,
  roadHigh: theme.map.roadHigh,
  label: theme.map.label,
  labelCity: theme.map.labelCity,
}

const LIGHT_PALETTE: FlatPalette = {
  bg: '#e9e7e0',
  park: '#cde0c5',
  water: '#b7d3e6',
  building: '#dcd9d0',
  boundary: '#a8a59b',
  roadMinor: '#f4f4f0',
  roadMajor: '#ffffff',
  roadHigh: '#f6c453',
  label: '#6b6b63',
  labelCity: '#141414',
}

export function flatDarkStyle(): StyleSpecification {
  return flatVectorStyle(DARK_PALETTE, 'enel-luz-flat-dark')
}

export function flatLightStyle(): StyleSpecification {
  return flatVectorStyle(LIGHT_PALETTE, 'enel-luz-flat-light')
}

/** Satelite: Esri World Imagery + capa de referencia (limites y lugares) */
export function satelliteStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'enel-luz-satellite',
    glyphs: GLYPHS,
    sources: {
      sat: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 18,
        attribution: 'Esri, Maxar, Earthstar Geographics',
      },
      satRef: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 18,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0c0f12' } },
      { id: 'sat', type: 'raster', source: 'sat' },
      { id: 'sat-ref', type: 'raster', source: 'satRef' },
    ],
  }
}

export function styleFor(mode: BasemapMode): StyleSpecification {
  if (mode === 'light') return flatLightStyle()
  if (mode === 'sat') return satelliteStyle()
  return flatDarkStyle()
}
