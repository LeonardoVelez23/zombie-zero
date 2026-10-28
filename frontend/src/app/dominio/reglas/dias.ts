import { Plan, ResultadoSimulacion } from '../modelos/resultado';

// Personas mordidas en total hasta `dia` (promedio de los brotes simulados).
// En el último día (o si la API no trae el detalle por barrio) se usa el total de la
// simulación, que es la cifra con la que se decide el plan.
export function mordidosHasta(plan: Plan, dia: number, dias: number): number {
  const fila = plan.mapaAfectados?.[Math.max(0, dia)];
  return dia < dias && fila ? fila.reduce((a, b) => a + b, 0) : plan.infectados.media;
}

// Personas que el plan evitó que fueran mordidas hasta `dia`, frente a no intervenir.
export function salvadosHasta(plan: Plan, ninguna: Plan, dia: number, dias: number): number {
  return Math.max(0, mordidosHasta(ninguna, dia, dias) - mordidosHasta(plan, dia, dias));
}

// Días clave del brote para saltar directo a ellos en la línea de tiempo.
export interface Hito {
  dia: number;
  nombre: string;
}

export function hitosDelBrote(resultado: ResultadoSimulacion): Hito[] {
  const dias = resultado.escenario.dias;
  const ninguna = resultado.planes.find((p) => p.id === 'ninguna');
  const intermedios: Hito[] = [
    { dia: Math.round(resultado.escenario.recursos.diaInicio), nombre: 'Se empieza a actuar' },
  ];
  if (ninguna)
    intermedios.push({ dia: Math.round(ninguna.diaPico), nombre: 'Pico sin intervenir' });
  // «Inicio» y «Final» siempre están; un hito intermedio que cae en el mismo día que otro
  // (por ejemplo, actuar desde el día 0) se omite para que las etiquetas no se encimen.
  const usados = new Set([0, dias]);
  const enMedio = intermedios
    .sort((a, b) => a.dia - b.dia)
    .filter((h) => h.dia > 0 && h.dia < dias && !usados.has(h.dia) && usados.add(h.dia));
  return [{ dia: 0, nombre: 'Inicio' }, ...enMedio, { dia: dias, nombre: 'Final' }];
}
