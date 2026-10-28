// Coordenadas SVG de una serie diaria: el día va en x y el valor en y (y crece hacia abajo).

export interface Area {
  izquierda: number;
  derecha: number;
  arriba: number;
  abajo: number;
}

export interface Escala {
  x: (dia: number) => number;
  y: (valor: number) => number;
}

export function escala(dias: number, maximo: number, area: Area): Escala {
  const ancho = area.derecha - area.izquierda;
  const alto = area.abajo - area.arriba;
  return {
    x: (dia) => area.izquierda + (dia / Math.max(dias, 1)) * ancho,
    y: (valor) => area.abajo - (valor / Math.max(maximo, 1)) * alto,
  };
}

const punto = (e: Escala, valor: number, dia: number) =>
  `${e.x(dia).toFixed(1)} ${e.y(valor).toFixed(1)}`;

export function trazo(valores: number[], e: Escala): string {
  return valores.map((v, dia) => `${dia ? 'L' : 'M'}${punto(e, v, dia)}`).join(' ');
}

// Polígono cerrado entre dos series (banda p5–p95).
export function banda(inferior: number[], superior: number[], e: Escala): string {
  const vuelta = inferior.map((v, dia) => `L${punto(e, v, dia)}`).reverse();
  return `${trazo(superior, e)} ${vuelta.join(' ')} Z`;
}

// Día bajo el puntero en una gráfica SVG: convierte la posición en pantalla a coordenadas del
// viewBox y luego a día, acotado al rango de la serie.
export function diaEnPunto(
  evento: { clientX: number; currentTarget: EventTarget | null },
  area: Area,
  dias: number,
  anchoViewBox: number,
): number {
  const svg = evento.currentTarget as Element | null;
  const caja = svg?.getBoundingClientRect();
  if (!caja || caja.width === 0) return 0;
  const x = ((evento.clientX - caja.left) / caja.width) * anchoViewBox;
  const fraccion = (x - area.izquierda) / (area.derecha - area.izquierda);
  return Math.max(0, Math.min(dias, Math.round(fraccion * dias)));
}
