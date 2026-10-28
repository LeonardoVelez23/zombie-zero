import { POBLACION_MANTA, enManta, factorManta } from './escala';

describe('Escala a toda Manta', () => {
  it('5.000 personas simuladas representan a Manta a escala 1:54', () => {
    expect(Math.round(factorManta(5000))).toBe(54);
  });

  it('lleva un resultado de la muestra a toda la ciudad, redondeado a centenas', () => {
    expect(enManta(5000, 5000)).toBe(271_100);
    expect(enManta(546, 5000)).toBe(29_600);
    expect(enManta(0, 5000)).toBe(0);
  });

  it('usa la población del Censo 2022', () => {
    expect(POBLACION_MANTA).toBe(271_145);
  });
});
