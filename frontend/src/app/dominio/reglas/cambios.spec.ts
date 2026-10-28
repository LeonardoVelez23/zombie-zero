import { parametrosDePrueba } from '../../../testing/datos';
import { Escenario } from '../modelos/escenario';
import { cambiosDeEscenario } from './cambios';

const base = parametrosDePrueba.porDefecto;

describe('Cambios entre escenarios', () => {
  it('sin cambios no hay nada que contar', () => {
    expect(cambiosDeEscenario(base, base)).toEqual([]);
  });

  it('describe las sorpresas del jurado en palabras', () => {
    const sorpresa: Escenario = {
      ...base,
      inicio: 'mercado',
      plaga: { ...base.plaga, r0: 5 },
      recursos: { ...base.recursos, vacunasDisponibles: 500, eficacia: 0.45 },
    };
    expect(cambiosDeEscenario(base, sorpresa)).toEqual([
      { parametro: 'R0', antes: '2,5', ahora: '5' },
      { parametro: 'Vacunas', antes: '1.000', ahora: '500' },
      { parametro: 'Inicio', antes: 'aleatorio', ahora: 'mercado' },
      { parametro: 'Eficacia', antes: '90 %', ahora: '45 %' },
    ]);
  });

  it('el corte de vacunas se cuenta como un solo cambio', () => {
    const corte = { ...base, recursos: { ...base.recursos, corteDesde: 3, corteDias: 30 } };
    expect(cambiosDeEscenario(base, corte)).toEqual([
      { parametro: 'Corte de vacunas', antes: 'sin corte', ahora: '30 días desde el día 3' },
    ]);
  });
});
