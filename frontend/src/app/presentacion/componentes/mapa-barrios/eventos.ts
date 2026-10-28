import { Plan, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { NIVELES } from './capas';

// Lo que pasa en el brote, día a día, contado a partir del promedio de los brotes simulados.
// No hay datos nuevos: todo sale de las mismas series que pinta el mapa.

export type TipoEvento = 'inicio' | 'llegada' | 'alerta' | 'control' | 'accion' | 'pico';

export interface Evento {
  dia: number;
  tipo: TipoEvento;
  texto: string;
}

const LUGARES: Record<string, string> = {
  aleatorio: 'un punto al azar de la ciudad',
  aeropuerto: 'el aeropuerto',
  mercado: 'el mercado',
  colegio: 'un colegio',
};

const CIERRES: Record<string, { cierra: string; reabre: string }> = {
  mercado: { cierra: 'Se cierra el mercado.', reabre: 'Reabre el mercado.' },
  colegio: { cierra: 'Se cierran los colegios.', reabre: 'Reabren los colegios.' },
};

const [FUERA_DE_CONTROL, EN_ALERTA] = NIVELES;

export function eventosDelBrote(r: ResultadoSimulacion, plan: Plan): Evento[] {
  const eventos: Evento[] = [];
  const recursos = r.escenario.recursos;
  const afectados = plan.mapaAfectados ?? [];
  const inicio = r.escenario.inicio;

  eventos.push({
    dia: 0,
    tipo: 'inicio',
    texto: `El brote empieza en ${LUGARES[inicio] ?? inicio}.`,
  });

  // Por barrio: cuándo llega la plaga (1 mordido en promedio) y cuándo cambia de nivel.
  r.barrios.forEach((barrio, i) => {
    const poblacion = r.poblacionBarrio[i] || 1;
    const primerDia = (condicion: (mordidos: number) => boolean) =>
      afectados.findIndex((fila) => condicion(fila[i]));
    const llegada = primerDia((m) => m >= 1);
    if (llegada > 0)
      eventos.push({ dia: llegada, tipo: 'llegada', texto: `Llega la plaga a ${barrio}.` });
    const alerta = primerDia((m) => m / poblacion >= EN_ALERTA.desde);
    if (alerta >= 0)
      eventos.push({ dia: alerta, tipo: 'alerta', texto: `${barrio} entra en alerta.` });
    const control = primerDia((m) => m / poblacion >= FUERA_DE_CONTROL.desde);
    if (control >= 0) {
      eventos.push({ dia: control, tipo: 'control', texto: `${barrio} queda fuera de control.` });
    }
  });

  // Decisiones del plan, en los días en que el motor las aplica.
  if (plan.vacunas > 0) {
    eventos.push({
      dia: recursos.diaInicio,
      tipo: 'accion',
      texto: `Empiezan las vacunas: hasta ${recursos.vacunasPorDia} por día.`,
    });
  }
  if (plan.vacunas > 0 && recursos.corteDias > 0) {
    eventos.push({
      dia: recursos.corteDesde,
      tipo: 'accion',
      texto: `Se cortan las entregas de vacunas por ${recursos.corteDias} ${recursos.corteDias === 1 ? 'día' : 'días'}.`,
    });
    eventos.push({
      dia: recursos.corteDesde + recursos.corteDias,
      tipo: 'accion',
      texto: 'Vuelven a llegar vacunas.',
    });
  }
  for (const lugar of plan.cierres) {
    const cierre = CIERRES[lugar] ?? { cierra: `Se cierra ${lugar}.`, reabre: `Reabre ${lugar}.` };
    eventos.push({ dia: recursos.diaInicio, tipo: 'accion', texto: cierre.cierra });
    eventos.push({
      dia: recursos.diaInicio + recursos.diasCierre,
      tipo: 'accion',
      texto: cierre.reabre,
    });
  }

  // Pico: el día con más zombies activos en toda la ciudad.
  const activos = (plan.mapa ?? []).map((fila) => fila.reduce((a, b) => a + b, 0));
  const pico = activos.reduce((mejor, v, dia) => (v > activos[mejor] ? dia : mejor), 0);
  if (activos[pico] >= 1) {
    eventos.push({
      dia: pico,
      tipo: 'pico',
      texto: `Pico del brote: ${Math.round(activos[pico])} zombies activos.`,
    });
  }

  const ultimoDia = r.escenario.dias;
  return eventos.filter((e) => e.dia <= ultimoDia).sort((a, b) => a.dia - b.dia);
}
