import { Component, computed, input, output } from '@angular/core';

import { ConfiguracionSimulacion } from '../../../dominio/modelos/escenario';
import { SimulacionGuardada } from '../../../dominio/modelos/resultado';
import { capitalizar, numero } from '../../utilidades/formato';
import { descargarInforme } from '../../utilidades/informe-descarga';

const hora = new Intl.DateTimeFormat('es-EC', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

// Últimas simulaciones guardadas en S3 (de todos los que usan la aplicación): con qué
// configuración se corrieron y qué salió. «Volver a simular» repite la misma configuración
// con la misma semilla, así que da el mismo resultado.
@Component({
  selector: 'app-historial',
  templateUrl: './historial.html',
  styleUrl: './historial.css',
  host: { class: 'panel', id: 'historial' },
})
export class Historial {
  readonly simulaciones = input<SimulacionGuardada[]>([]);
  readonly cargando = input(false);
  readonly repetir = output<ConfiguracionSimulacion>();

  protected readonly numero = numero;
  protected readonly descargar = descargarInforme;

  protected readonly filas = computed(() =>
    this.simulaciones().map((s) => ({
      id: s.id,
      cuando: hora.format(new Date(s.momento)),
      inicio: capitalizar(s.inicio),
      r0: s.plaga.r0,
      vacunas: numero(s.recursos.vacunasDisponibles),
      presupuesto: numero(s.recursos.presupuesto),
      semilla: s.semilla,
      detalle: `${numero(s.nPersonas)} personas · ${s.dias} días · ${s.repeticiones} repeticiones · detección ${Math.round(s.plaga.deteccion * 100)} % · eficacia ${Math.round(s.recursos.eficacia * 100)} %`,
      plan: s.planes.find((p) => p.id === s.recomendado)?.nombre ?? '—',
      salvados: s.salvadosVsNinguna === null ? '—' : numero(s.salvadosVsNinguna),
      configuracion: aConfiguracion(s),
      simulacion: s,
    })),
  );
}

export function aConfiguracion(s: SimulacionGuardada): ConfiguracionSimulacion {
  return {
    repeticiones: s.repeticiones,
    escenario: {
      nPersonas: s.nPersonas,
      dias: s.dias,
      semilla: s.semilla,
      inicio: s.inicio,
      casosIniciales: s.casosIniciales,
      plaga: s.plaga,
      recursos: s.recursos,
    },
  };
}
