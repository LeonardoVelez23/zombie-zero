import { Escenario } from '../modelos/escenario';

// Qué cambió entre dos escenarios, en palabras: lo que el jurado alteró en el Brote Sorpresa.
export interface Cambio {
  parametro: string;
  antes: string;
  ahora: string;
}

const decimal = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 });
const n = (v: number) => decimal.format(v);
const pct = (v: number) => `${Math.round(v * 100)} %`;

interface Campo {
  parametro: string;
  valor: (e: Escenario) => number | string;
  formato?: (v: number) => string;
}

const CAMPOS: Campo[] = [
  { parametro: 'R0', valor: (e) => e.plaga.r0 },
  { parametro: 'Vacunas', valor: (e) => e.recursos.vacunasDisponibles },
  { parametro: 'Inicio', valor: (e) => e.inicio },
  { parametro: 'Eficacia', valor: (e) => e.recursos.eficacia, formato: pct },
  {
    parametro: 'Corte de vacunas',
    valor: (e) =>
      e.recursos.corteDias > 0
        ? `${e.recursos.corteDias} días desde el día ${e.recursos.corteDesde}`
        : 'sin corte',
  },
  { parametro: 'Detección', valor: (e) => e.plaga.deteccion, formato: pct },
  { parametro: 'Población', valor: (e) => e.nPersonas },
  { parametro: 'Casos iniciales', valor: (e) => e.casosIniciales },
  { parametro: 'Presupuesto', valor: (e) => e.recursos.presupuesto, formato: (v) => `${n(v)} USD` },
  { parametro: 'Vacunas por día', valor: (e) => e.recursos.vacunasPorDia },
  { parametro: 'Día de inicio', valor: (e) => e.recursos.diaInicio },
  { parametro: 'Duración', valor: (e) => e.dias, formato: (v) => `${v} días` },
  { parametro: 'Semilla', valor: (e) => e.semilla },
];

export function cambiosDeEscenario(antes: Escenario, ahora: Escenario): Cambio[] {
  return CAMPOS.flatMap(({ parametro, valor, formato = n }) => {
    const a = valor(antes);
    const b = valor(ahora);
    if (a === b) return [];
    const texto = (v: number | string) => (typeof v === 'number' ? formato(v) : v);
    return [{ parametro, antes: texto(a), ahora: texto(b) }];
  });
}
