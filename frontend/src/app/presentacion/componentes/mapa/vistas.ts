import type { StyleSpecification } from 'maplibre-gl';

// Fondos del mapa: teselas ráster públicas, cada una con su atribución obligatoria.
// Todas viven en un solo estilo y se cambia su visibilidad, así la capa de zombies no se pierde
// al cambiar de vista.

export type VistaId = 'satelite' | 'hibrido' | 'calles' | 'oscuro';

export interface Vista {
  id: VistaId;
  nombre: string;
  capas: string[];
}

export const VISTAS: Vista[] = [
  { id: 'satelite', nombre: 'Satélite', capas: ['satelite'] },
  { id: 'hibrido', nombre: 'Satélite + calles', capas: ['satelite-hibrido', 'etiquetas', 'vias'] },
  { id: 'calles', nombre: 'Calles', capas: ['calles'] },
  { id: 'oscuro', nombre: 'Oscuro', capas: ['oscuro', 'oscuro-etiquetas'] },
];

// Encuadre inicial: todo el cantón Manta, de San Mateo y la zona rural (oeste) a Los Esteros (este). [oeste, sur, este, norte]
export const LIMITES_MANTA: [number, number, number, number] = [-80.9, -1.06, -80.66, -0.93];

// Centro aproximado de cada sector; los mismos que usa el modelo EDP (backend/src/zombie/edp.py, UBICACION).
export const SECTORES: { nombre: string; lngLat: [number, number] }[] = [
  { nombre: 'Tarqui', lngLat: [-80.7142, -0.9639] },
  { nombre: 'Manta', lngLat: [-80.73, -0.948] },
  { nombre: 'Los Esteros', lngLat: [-80.6914, -0.9623] },
  { nombre: 'Eloy Alfaro', lngLat: [-80.708, -0.979] },
  { nombre: 'San Mateo', lngLat: [-80.8112, -0.9595] },
  { nombre: 'Rural', lngLat: [-80.865, -1.035] },
];

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const ATRIBUCION_ESRI =
  'Imágenes © Esri, Maxar, Earthstar Geographics y la comunidad de usuarios GIS';
const ATRIBUCION_OSM =
  '© <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>';

export function estiloBase(inicial: VistaId): StyleSpecification {
  const visible = (vista: VistaId) =>
    ({ visibility: inicial === vista ? 'visible' : 'none' }) as const;
  return {
    version: 8,
    sources: {
      satelite: {
        type: 'raster',
        tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
        tileSize: 256,
        maxzoom: 19,
        attribution: ATRIBUCION_ESRI,
      },
      etiquetas: {
        type: 'raster',
        tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
        tileSize: 256,
        maxzoom: 19,
      },
      vias: {
        type: 'raster',
        tiles: [`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`],
        tileSize: 256,
        maxzoom: 19,
      },
      calles: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: ATRIBUCION_OSM,
      },
      // Esri Dark Gray: los mosaicos raster de CARTO ahora piden una clave de API.
      oscuro: {
        type: 'raster',
        tiles: [`${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`],
        tileSize: 256,
        maxzoom: 16,
        attribution: 'Mapa base © Esri, HERE, Garmin, colaboradores de OpenStreetMap',
      },
      'oscuro-etiquetas': {
        type: 'raster',
        tiles: [`${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`],
        tileSize: 256,
        maxzoom: 16,
      },
    },
    layers: [
      { id: 'satelite', type: 'raster', source: 'satelite', layout: visible('satelite') },
      { id: 'satelite-hibrido', type: 'raster', source: 'satelite', layout: visible('hibrido') },
      { id: 'vias', type: 'raster', source: 'vias', layout: visible('hibrido') },
      { id: 'etiquetas', type: 'raster', source: 'etiquetas', layout: visible('hibrido') },
      { id: 'calles', type: 'raster', source: 'calles', layout: visible('calles') },
      { id: 'oscuro', type: 'raster', source: 'oscuro', layout: visible('oscuro') },
      {
        id: 'oscuro-etiquetas',
        type: 'raster',
        source: 'oscuro-etiquetas',
        layout: visible('oscuro'),
      },
    ],
  };
}

// MapLibre carga su worker desde una URL; se arma desde el archivo publicado junto a la web.
export async function urlDelWorker(): Promise<string> {
  const respuesta = await fetch('maplibre-gl-worker.mjs');
  if (!respuesta.ok) throw new Error(`No se pudo cargar el worker del mapa (${respuesta.status})`);
  const codigo = new Blob([await respuesta.text()], { type: 'text/javascript' });
  return URL.createObjectURL(codigo);
}
