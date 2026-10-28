import { Component, computed, input } from '@angular/core';

import { Plan, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { comparacion } from '../../../dominio/reglas/planes';
import { numeroCorto } from '../../utilidades/formato';
import { Area, banda, escala, trazo } from '../../utilidades/grafica';

const AREA: Area = { izquierda: 55, derecha: 675, arriba: 30, abajo: 250 };

interface Curva {
  clase: 'ninguna' | 'azar' | 'recomendado';
  etiqueta: string;
  linea: string;
  banda: string;
}

@Component({
  selector: 'app-grafica',
  templateUrl: './grafica.html',
  styleUrl: './grafica.css',
  host: { class: 'panel', id: 'resultados' },
})
export class Grafica {
  readonly resultado = input<ResultadoSimulacion | null>(null);

  protected readonly area = AREA;

  private readonly maximo = computed(() => {
    const r = this.resultado();
    return r ? Math.max(1, ...r.planes.flatMap((p) => p.curvaZombies.p95)) : 1;
  });

  protected readonly curvas = computed<Curva[]>(() => {
    const r = this.resultado();
    if (!r) return [];
    const e = escala(r.escenario.dias, this.maximo(), AREA);
    const { sinIntervencion, azar, recomendado } = comparacion(r);
    const curva = (clase: Curva['clase'], etiqueta: string, plan: Plan): Curva => ({
      clase,
      etiqueta,
      linea: trazo(plan.curvaZombies.media, e),
      banda: banda(plan.curvaZombies.p5, plan.curvaZombies.p95, e),
    });
    return [
      curva('ninguna', 'Sin intervención', sinIntervencion),
      curva('azar', 'Vacunas al azar', azar),
      curva('recomendado', `Recomendado: ${recomendado.nombre}`, recomendado),
    ];
  });

  protected readonly ejeY = computed(() => {
    const e = escala(1, this.maximo(), AREA);
    return [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      y: e.y(f * this.maximo()),
      texto: numeroCorto(f * this.maximo()),
    }));
  });

  protected readonly ejeX = computed(() => {
    const dias = this.resultado()?.escenario.dias ?? 180;
    const e = escala(dias, 1, AREA);
    return [0, 1 / 3, 2 / 3, 1].map((f) => {
      const dia = Math.round(f * dias);
      return { x: e.x(dia), texto: `Día ${dia}` };
    });
  });
}
