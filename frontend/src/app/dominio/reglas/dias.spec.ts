import { resultadoDePrueba } from '../../../testing/datos';
import { Plan } from '../modelos/resultado';
import { hitosDelBrote, mordidosHasta, salvadosHasta } from './dias';

const con = (plan: Plan, mapaAfectados: number[][]): Plan => ({ ...plan, mapaAfectados });
const [ninguna, anillo] = ['ninguna', 'anillo'].map((id) =>
  resultadoDePrueba.planes.find((p) => p.id === id)!,
);

describe('Cifras por día', () => {
  const sin = con(ninguna, [
    [5, 0],
    [100, 200],
    [900, 1000],
    [0, 0],
  ]);
  const plan = con(anillo, [
    [5, 0],
    [40, 10],
    [100, 50],
    [0, 0],
  ]);

  it('suma los mordidos de todos los barrios hasta ese día', () => {
    expect(mordidosHasta(sin, 1, 3)).toBe(300);
    expect(mordidosHasta(plan, 2, 3)).toBe(150);
  });

  it('en el último día usa el total de la simulación', () => {
    expect(mordidosHasta(sin, 3, 3)).toBe(ninguna.infectados.media);
  });

  it('sin detalle por barrio usa el total de la simulación', () => {
    expect(mordidosHasta(ninguna, 1, 3)).toBe(ninguna.infectados.media);
  });

  it('los salvados son la diferencia con no intervenir, nunca negativa', () => {
    expect(salvadosHasta(plan, sin, 1, 3)).toBe(250);
    expect(salvadosHasta(sin, plan, 1, 3)).toBe(0);
  });

  it('los hitos van en orden y sin días repetidos', () => {
    const hitos = hitosDelBrote(resultadoDePrueba);
    expect(hitos.map((h) => h.dia)).toEqual(
      [...new Set(hitos.map((h) => h.dia))].sort((a, b) => a - b),
    );
    expect(hitos[0]).toEqual({ dia: 0, nombre: 'Inicio' });
    expect(hitos.at(-1)).toEqual({ dia: resultadoDePrueba.escenario.dias, nombre: 'Final' });
    expect(hitos.some((h) => h.nombre === 'Pico sin intervenir')).toBe(true);
  });

  it('si se actúa el último día se conserva «Final»', () => {
    // Datos de prueba: 3 días, se actúa el día 3 y el pico sin intervenir es el día 2.
    expect(hitosDelBrote(resultadoDePrueba).map((h) => h.nombre)).toEqual([
      'Inicio',
      'Pico sin intervenir',
      'Final',
    ]);
  });
});
