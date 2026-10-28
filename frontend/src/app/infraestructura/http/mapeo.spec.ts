import { aCamel, aSnake, renombrarClaves } from './mapeo';

describe('mapeo de claves', () => {
  it('convierte entre snake_case y camelCase en ambos sentidos', () => {
    for (const [snake, camel] of [
      ['n_personas', 'nPersonas'],
      ['gana_a_azar', 'ganaAAzar'],
      ['edp_por_defecto', 'edpPorDefecto'],
      ['r0', 'r0'],
    ]) {
      expect(aCamel(snake)).toBe(camel);
      expect(aSnake(camel)).toBe(snake);
    }
  });

  it('renombra claves anidadas y deja intactos los valores y los arreglos', () => {
    const json = {
      dia_pico: 3,
      curva_zombies: { media: [1, 2] },
      planes: [{ salvados_vs_ninguna: { p5: 1 }, id: 'anillo+mercado' }],
      serie: { S: [1], Z: [2] },
    };
    expect(renombrarClaves(json, aCamel)).toEqual({
      diaPico: 3,
      curvaZombies: { media: [1, 2] },
      planes: [{ salvadosVsNinguna: { p5: 1 }, id: 'anillo+mercado' }],
      serie: { S: [1], Z: [2] },
    });
  });
});
