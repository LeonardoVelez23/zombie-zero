import { Plan, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { resultadoDePrueba } from '../../../../testing/datos';
import { eventosDelBrote } from './eventos';

// Tarqui (10.000 personas): llega el día 1, alerta el 2 (≥ 5 %), fuera de control el 3 (≥ 20 %).
const resultado: ResultadoSimulacion = {
  ...resultadoDePrueba,
  escenario: {
    ...resultadoDePrueba.escenario,
    recursos: {
      ...resultadoDePrueba.escenario.recursos,
      diaInicio: 1,
      corteDesde: 2,
      corteDias: 1,
    },
  },
};

const plan = (cambios: Partial<Plan>): Plan => ({
  ...resultadoDePrueba.planes[0],
  mapaAfectados: [[0], [3], [600], [2500]],
  mapa: [[0], [3], [40], [10]],
  ...cambios,
});

const textos = (p: Plan) => eventosDelBrote(resultado, p).map((e) => `D${e.dia} ${e.texto}`);

describe('Eventos del brote', () => {
  it('cuenta cuándo llega la plaga a cada barrio y cuándo cambia de nivel', () => {
    expect(textos(plan({ vacunas: 0 }))).toEqual([
      'D0 El brote empieza en un punto al azar de la ciudad.',
      'D1 Llega la plaga a Tarqui.',
      'D2 Tarqui entra en alerta.',
      'D2 Pico del brote: 40 zombies activos.',
      'D3 Tarqui queda fuera de control.',
    ]);
  });

  it('anuncia las vacunas, el corte de entregas y los cierres del plan', () => {
    const acciones = eventosDelBrote(resultado, plan({ vacunas: 500, cierres: ['mercado'] }))
      .filter((e) => e.tipo === 'accion')
      .map((e) => `D${e.dia} ${e.texto}`);
    expect(acciones).toEqual([
      'D1 Empiezan las vacunas: hasta 100 por día.',
      'D1 Se cierra el mercado.',
      'D2 Se cortan las entregas de vacunas por 1 día.',
      'D3 Vuelven a llegar vacunas.',
    ]);
  });

  it('sin datos por barrio solo queda el inicio del brote', () => {
    expect(textos(plan({ vacunas: 0, mapa: [], mapaAfectados: [] }))).toEqual([
      'D0 El brote empieza en un punto al azar de la ciudad.',
    ]);
  });
});
