// Datos sintéticos con la forma del dominio, para las pruebas.
import { Parametros } from '../app/dominio/modelos/escenario';
import { Plan, ResultadoSimulacion } from '../app/dominio/modelos/resultado';

export const parametrosDePrueba: Parametros = {
  porDefecto: {
    nPersonas: 10000,
    dias: 3,
    semilla: 42,
    inicio: 'aleatorio',
    casosIniciales: 5,
    plaga: { r0: 2.5, diasLatencia: 3, diasInfeccioso: 5, deteccion: 0.7 },
    recursos: {
      presupuesto: 20000,
      costoVacuna: 10,
      vacunasDisponibles: 1000,
      vacunasPorDia: 100,
      diaInicio: 3,
      eficacia: 0.9,
      diasCierre: 14,
      cumplimientoCierre: 0.8,
      costoCierreMercado: 600,
      costoCierreColegio: 800,
    },
  },
  edpPorDefecto: { dSanos: 0.1, dZombies: 0.05, alfa: 0.02 },
  limites: {
    escenario: {
      nPersonas: [1000, 20000],
      dias: [3, 365],
      semilla: [0, 100],
      casosIniciales: [1, 100],
    },
    plaga: { r0: [0.5, 10], deteccion: [0, 1] },
    recursos: { presupuesto: [0, 1e6], vacunasDisponibles: [0, 20000], eficacia: [0, 1] },
    edp: {},
  },
  inicios: ['aleatorio', 'mercado'],
  repeticiones: { porDefecto: 50, limites: [5, 200] },
};

const plan = (id: string, tipo: Plan['tipo'], infectados: number): Plan => ({
  id,
  nombre: id,
  tipo,
  descripcion: `Plan ${id}`,
  vacunacion: id,
  cierres: [],
  vacunas: 1000,
  costo: 10000,
  infectados: { media: infectados, mediana: infectados, p5: 0, p95: infectados * 2 },
  pico: { media: 10, mediana: 10, p5: 0, p95: 20 },
  diaPico: 2,
  curvaZombies: {
    media: [5, 10, 4, 1],
    mediana: [5, 10, 4, 1],
    p5: [5, 6, 2, 0],
    p95: [5, 14, 8, 3],
  },
  mapa: [],
  vacunasPerdidas: 0,
});

export const resultadoDePrueba: ResultadoSimulacion = {
  escenario: parametrosDePrueba.porDefecto,
  repeticiones: 50,
  r0: 2.5,
  beta: 0.04,
  barrios: ['Tarqui'],
  poblacionBarrio: [10000],
  recomendado: 'anillo',
  veredicto: { nivel: 'solida', ganaAAzar: 0.98, salvadosVsNinguna: 4425, salvadosVsAzar: 3530 },
  planes: [
    plan('ninguna', 'linea_base', 4637),
    plan('azar', 'linea_base', 3741),
    {
      ...plan('anillo', 'candidato', 212),
      salvadosVsNinguna: { media: 4425, mediana: 4430, p5: 2, p95: 5331 },
      ganaAAzar: 0.98,
    },
  ],
};
