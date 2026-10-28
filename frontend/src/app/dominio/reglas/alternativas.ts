import { Escenario } from '../modelos/escenario';

// Cuando ningún plan gana con los recursos actuales: variantes del mismo escenario que cambian lo
// que la ciudad sí puede decidir (cuándo actuar y cuántos recursos conseguir), no la plaga.
export interface Alternativa {
  id: 'antes' | 'recursos' | 'ambas';
  titulo: string;
  detalle: string;
  escenario: Escenario;
}

const n = (v: number) => new Intl.NumberFormat('es-EC').format(v);

// En orden de menor a mayor esfuerzo para la ciudad.
export function alternativas(e: Escenario): Alternativa[] {
  const r = e.recursos;
  const dia = Math.max(1, Math.round(r.diaInicio / 2));
  const antes = { ...r, diaInicio: dia };
  const doble = {
    presupuesto: r.presupuesto * 2,
    vacunasDisponibles: r.vacunasDisponibles * 2,
    vacunasPorDia: r.vacunasPorDia * 2,
  };
  return [
    {
      id: 'antes',
      titulo: 'Actuar antes',
      detalle: `Empezar el día ${dia} en lugar del día ${r.diaInicio}`,
      escenario: { ...e, recursos: antes },
    },
    {
      id: 'recursos',
      titulo: 'El doble de recursos',
      detalle: `${n(doble.vacunasDisponibles)} vacunas (${n(doble.vacunasPorDia)} por día) y ${n(doble.presupuesto)} USD`,
      escenario: { ...e, recursos: { ...r, ...doble } },
    },
    {
      id: 'ambas',
      titulo: 'Las dos cosas',
      detalle: `Empezar el día ${dia} con el doble de recursos`,
      escenario: { ...e, recursos: { ...antes, ...doble } },
    },
  ];
}
