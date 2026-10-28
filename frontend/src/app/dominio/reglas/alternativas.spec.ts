import { parametrosDePrueba } from '../../../testing/datos';
import { alternativas } from './alternativas';

const base = {
  ...parametrosDePrueba.porDefecto,
  recursos: { ...parametrosDePrueba.porDefecto.recursos, diaInicio: 21 },
};

describe('Alternativas cuando ningún plan gana', () => {
  it('propone actuar antes, el doble de recursos y las dos cosas', () => {
    const [antes, recursos, ambas] = alternativas(base);
    expect(antes.escenario.recursos.diaInicio).toBe(11);
    expect(antes.escenario.recursos.vacunasDisponibles).toBe(1000);
    expect(recursos.escenario.recursos).toEqual(
      expect.objectContaining({
        diaInicio: 21,
        vacunasDisponibles: 2000,
        vacunasPorDia: 200,
        presupuesto: 40000,
      }),
    );
    expect(ambas.escenario.recursos).toEqual(
      expect.objectContaining({ diaInicio: 11, vacunasDisponibles: 2000 }),
    );
  });

  it('no cambia la plaga ni la semilla: solo lo que la ciudad puede decidir', () => {
    for (const a of alternativas(base)) {
      expect(a.escenario.plaga).toEqual(base.plaga);
      expect(a.escenario.semilla).toBe(base.semilla);
      expect(a.escenario.inicio).toBe(base.inicio);
    }
  });

  it('nunca propone empezar antes del día 1', () => {
    const temprano = { ...base, recursos: { ...base.recursos, diaInicio: 1 } };
    expect(alternativas(temprano)[0].escenario.recursos.diaInicio).toBe(1);
  });
});
