import { Plan, ResultadoSimulacion } from '../modelos/resultado';

export interface Comparacion {
  recomendado: Plan;
  sinIntervencion: Plan;
  azar: Plan;
}

// Los tres planes que cuentan la historia: no hacer nada, repartir al azar y el recomendado.
export function comparacion(resultado: ResultadoSimulacion): Comparacion {
  return {
    recomendado: plan(resultado, resultado.recomendado),
    sinIntervencion: plan(resultado, 'ninguna'),
    azar: plan(resultado, 'azar'),
  };
}

function plan(resultado: ResultadoSimulacion, id: string): Plan {
  const encontrado = resultado.planes.find((p) => p.id === id);
  if (!encontrado) throw new Error(`El resultado no trae el plan "${id}"`);
  return encontrado;
}
