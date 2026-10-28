// Capas del mapa por barrio, como GeoJSON: funciones puras para poder probarlas sin MapLibre.
//
// - Zona: un círculo alrededor del centro de cada barrio. Su tamaño es la población del barrio y
//   su color, la fracción que ya fue mordida (mismos niveles que los marcadores).
// - Zombies: un punto por cada `escala` zombies activos ese día en el barrio, repartidos dentro de
//   su zona. La posición de cada punto es fija (el k-ésimo punto de un barrio siempre está en el
//   mismo lugar) y solo oscila un poco para que se vea vivo; no representa movimiento real.

import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';

// Color de cada barrio según la fracción de su población que ya fue mordida.
export const NIVELES = [
  { desde: 0.2, nombre: 'Fuera de control', rango: '≥ 20 %', color: '#f43f5e' },
  { desde: 0.05, nombre: 'En alerta', rango: '5–20 %', color: '#ffba52' },
  { desde: 0, nombre: 'Contenido', rango: '< 5 %', color: '#4ade80' },
];

export const nivelDe = (fraccion: number) => NIVELES.find((n) => fraccion >= n.desde)!;

export type LngLat = [number, number];

export interface ZonaBarrio {
  nombre: string;
  centro: LngLat;
  radioKm: number;
  fraccion: number;
  color: string;
}

// Puntos máximos por barrio en el día de más zombies: por encima de esto cada punto vale más de uno.
export const PUNTOS_POR_BARRIO = 150;

const KM_POR_GRADO_LAT = 110.57;
const kmPorGradoLng = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

// Radio de la zona en km: crece con la raíz de la población para que el área sea proporcional.
export function radioZona(poblacion: number, mayorPoblacion: number): number {
  return 0.5 + 1.3 * Math.sqrt(poblacion / Math.max(1, mayorPoblacion));
}

function desplazar([lng, lat]: LngLat, estKm: number, norteKm: number): LngLat {
  return [lng + estKm / kmPorGradoLng(lat), lat + norteKm / KM_POR_GRADO_LAT];
}

export function circulo(centro: LngLat, radioKm: number, lados = 48): LngLat[] {
  const anillo = Array.from({ length: lados }, (_, i) => {
    const angulo = (2 * Math.PI * i) / lados;
    return desplazar(centro, radioKm * Math.cos(angulo), radioKm * Math.sin(angulo));
  });
  return [...anillo, anillo[0]];
}

export function zonasGeoJSON(zonas: ZonaBarrio[]): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: zonas.map((z) => ({
      type: 'Feature',
      properties: { nombre: z.nombre, fraccion: z.fraccion, color: z.color },
      geometry: { type: 'Polygon', coordinates: [circulo(z.centro, z.radioKm)] },
    })),
  };
}

// Zombies que representa cada punto: el mismo para todos los planes y días de una simulación,
// así comparar planes en el mapa es comparar cantidades reales.
export function zombiesPorPunto(mapas: (number[][] | undefined)[]): number {
  let mayor = 0;
  for (const mapa of mapas)
    for (const dia of mapa ?? []) for (const v of dia) mayor = Math.max(mayor, v);
  return Math.max(1, Math.ceil(mayor / PUNTOS_POR_BARRIO));
}

// Pseudoaleatorio fijo a partir de dos enteros (en [0, 1)): mismas entradas, mismo punto.
function azarFijo(a: number, b: number): number {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function zombiesGeoJSON(
  zonas: ZonaBarrio[],
  activos: number[],
  escala: number,
  fase = 0,
): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  zonas.forEach((zona, i) => {
    const cantidad = Math.round((activos[i] ?? 0) / escala);
    for (let k = 0; k < cantidad; k++) {
      // Raíz del radio: reparte los puntos de forma pareja por el área del círculo.
      const distancia = 0.9 * zona.radioKm * Math.sqrt(azarFijo(i + 1, k));
      const angulo = 2 * Math.PI * azarFijo(k, i + 7);
      const vaiven = 2 * Math.PI * (fase + azarFijo(i + 3, k + 11));
      const temblor = 0.06 * zona.radioKm;
      features.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: desplazar(
            zona.centro,
            distancia * Math.cos(angulo) + temblor * Math.cos(vaiven),
            distancia * Math.sin(angulo) + temblor * Math.sin(vaiven),
          ),
        },
      });
    }
  });
  return { type: 'FeatureCollection', features };
}

// Corredores de contagio: mordidas entre dos barrios, sumando ambos sentidos, en todo el brote.
// Por debajo de una mordida en promedio no se dibuja la línea.
export interface Corredor {
  a: string;
  b: string;
  mordidas: number;
}

export function corredoresDe(nombres: string[], matriz: number[][] | undefined): Corredor[] {
  if (!matriz) return [];
  const lista: Corredor[] = [];
  nombres.forEach((a, i) =>
    nombres.forEach((b, j) => {
      if (j <= i) return;
      const mordidas = (matriz[i]?.[j] ?? 0) + (matriz[j]?.[i] ?? 0);
      if (mordidas >= 1) lista.push({ a, b, mordidas });
    }),
  );
  return lista.sort((x, y) => y.mordidas - x.mordidas);
}

// El grosor va de 1 a 9 px según las mordidas, con el mismo máximo para todos los planes.
// Los corredores con menos del 10 % del mayor no se dibujan, para que se lean los importantes.
export function corredoresGeoJSON(
  corredores: Corredor[],
  centros: Record<string, LngLat>,
  mayor: number,
): FeatureCollection<LineString> {
  const features = corredores.flatMap((c): Feature<LineString>[] => {
    const desde = centros[c.a];
    const hasta = centros[c.b];
    if (!desde || !hasta || c.mordidas < 0.1 * mayor) return [];
    return [
      {
        type: 'Feature',
        properties: {
          mordidas: Math.round(c.mordidas),
          ancho: 1 + (8 * c.mordidas) / Math.max(1, mayor),
        },
        geometry: { type: 'LineString', coordinates: [desde, hasta] },
      },
    ];
  });
  return { type: 'FeatureCollection', features };
}
