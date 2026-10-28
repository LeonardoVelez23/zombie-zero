import { SimulacionGuardada } from '../../dominio/modelos/resultado';
import { capitalizar, numero, porcentaje } from './formato';

const LINEA = '='.repeat(72);

const NIVELES: Record<string, string> = {
  solida: 'sólida',
  debil: 'débil',
  insuficiente: 'insuficiente',
};

// Informe de una simulación guardada, en texto plano: se abre en cualquier equipo sin programas extra.
export function informeTexto(s: SimulacionGuardada): string {
  const { plaga: p, recursos: r } = s;
  const recomendado = s.planes.find((plan) => plan.id === s.recomendado);
  const corte = r.corteDias
    ? `sin vacunas desde el día ${r.corteDesde} durante ${r.corteDias} días`
    : 'ninguno';
  const planes = s.planes.map(
    (plan) =>
      `- ${plan.nombre}${plan.id === s.recomendado ? ' (RECOMENDADO)' : ''}${plan.tipo === 'linea_base' ? ' (línea base)' : ''}: ` +
      `${numero(plan.infectados)} infectados (${numero(plan.infectadosP5)}–${numero(plan.infectadosP95)}), ` +
      `${plan.salvados === null ? 'sin dato de salvados' : `${numero(plan.salvados)} salvados`}, ` +
      `costo $${numero(plan.costo)}, ${numero(plan.vacunas)} vacunas`,
  );
  return [
    LINEA,
    '                         Z O M B I E   Z E R O',
    '              Informe de simulación · Manta, Ecuador',
    LINEA,
    '',
    `Fecha: ${new Date(s.momento).toLocaleString('es-EC')}`,
    `Id: ${s.id}`,
    '',
    'CONFIGURACIÓN',
    `- Origen del brote: ${capitalizar(s.inicio)}`,
    `- Población simulada: ${numero(s.nPersonas)} personas · ${s.dias} días · ${s.casosIniciales} casos iniciales`,
    `- Monte Carlo: ${s.repeticiones} repeticiones · semilla ${s.semilla}`,
    `- Plaga: R0 ${p.r0} · latencia ${p.diasLatencia} días · contagia ${p.diasInfeccioso} días · detección ${porcentaje(p.deteccion)}`,
    `- Recursos: presupuesto $${numero(r.presupuesto)} · ${numero(r.vacunasDisponibles)} vacunas a $${numero(r.costoVacuna)} · ` +
      `${numero(r.vacunasPorDia)} por día desde el día ${r.diaInicio} · eficacia ${porcentaje(r.eficacia)}`,
    `- Cierres: ${r.diasCierre} días, cumplimiento ${porcentaje(r.cumplimientoCierre)} · ` +
      `mercado $${numero(r.costoCierreMercado)}/día · colegio $${numero(r.costoCierreColegio)}/día`,
    `- Imprevisto: ${corte}`,
    '',
    'RESULTADO',
    `- Plan recomendado: ${recomendado?.nombre ?? 'ninguno'}`,
    `- Confianza: ${s.nivel ? NIVELES[s.nivel] ?? s.nivel : '—'}` +
      (s.ganaAAzar === null ? '' : ` (gana al reparto al azar en ${porcentaje(s.ganaAAzar)} de los brotes con diferencia)`),
    `- Personas salvadas frente a no intervenir: ${s.salvadosVsNinguna === null ? '—' : numero(s.salvadosVsNinguna)}`,
    '',
    'TODOS LOS PLANES (mismo presupuesto; infectados: media y rango p5–p95)',
    ...planes,
    '',
    'Con la misma configuración y la misma semilla se obtiene el mismo resultado.',
    'Población sintética: resultados de un modelo, no una predicción.',
    '',
  ].join('\n');
}

export function nombreInforme(s: SimulacionGuardada): string {
  const fecha = s.momento.slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  return `zombie-zero-${fecha}-semilla${s.semilla}.txt`;
}

export function descargarInforme(s: SimulacionGuardada): void {
  const url = URL.createObjectURL(new Blob([informeTexto(s)], { type: 'text/plain;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreInforme(s);
  enlace.click();
  URL.revokeObjectURL(url);
}
