import { Component, computed, inject, input } from '@angular/core';

import { Plan, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { comparacion } from '../../../dominio/reglas/planes';
import { RelojBrote } from '../../servicios/reloj-brote';
import { numero, numeroCorto } from '../../utilidades/formato';
import { Area, banda, diaEnPunto, escala, trazo } from '../../utilidades/grafica';

const AREA: Area = { izquierda: 55, derecha: 675, arriba: 30, abajo: 250 };
const ANCHO = 700;

type Clase = 'ninguna' | 'azar' | 'recomendado';

interface Curva {
  clase: Clase;
  etiqueta: string;
  // Curva completa (tenue, de fondo) y banda p5–p95.
  linea: string;
  banda: string;
  serie: number[];
}

@Component({
  selector: 'app-grafica',
  templateUrl: './grafica.html',
  styleUrl: './grafica.css',
  host: { class: 'panel', id: 'resultados' },
})
export class Grafica {
  readonly resultado = input<ResultadoSimulacion | null>(null);

  private readonly reloj = inject(RelojBrote);

  protected readonly area = AREA;
  protected readonly numero = numero;

  private readonly maximo = computed(() => {
    const r = this.resultado();
    return r ? Math.max(1, ...r.planes.flatMap((p) => p.curvaZombies.p95)) : 1;
  });

  private readonly escala = computed(() =>
    escala(this.resultado()?.escenario.dias ?? 1, this.maximo(), AREA),
  );

  // No depende del día: las curvas completas se calculan una sola vez por simulación.
  protected readonly curvas = computed<Curva[]>(() => {
    const r = this.resultado();
    if (!r) return [];
    const e = this.escala();
    const { sinIntervencion, azar, recomendado } = comparacion(r);
    const curva = (clase: Clase, etiqueta: string, plan: Plan): Curva => ({
      clase,
      etiqueta,
      linea: trazo(plan.curvaZombies.media, e),
      banda: banda(plan.curvaZombies.p5, plan.curvaZombies.p95, e),
      serie: plan.curvaZombies.media,
    });
    return [
      curva('ninguna', 'Sin intervención', sinIntervencion),
      curva('azar', 'Vacunas al azar', azar),
      curva('recomendado', `Recomendado: ${recomendado.nombre}`, recomendado),
    ];
  });

  protected readonly dia = computed(() =>
    Math.min(this.reloj.dia(), this.resultado()?.escenario.dias ?? 0),
  );

  // Tramo recorrido hasta el día de la línea de tiempo: se dibuja a medida que avanza el brote.
  protected readonly recorrido = computed(() => {
    const e = this.escala();
    const hasta = this.dia() + 1;
    return this.curvas().map((c) => ({ clase: c.clase, linea: trazo(c.serie.slice(0, hasta), e) }));
  });

  // Línea vertical del día con un punto y el valor de cada plan.
  protected readonly cursor = computed(() => {
    if (!this.resultado()) return null;
    const e = this.escala();
    const d = this.dia();
    const x = e.x(d);
    return {
      x,
      dia: d,
      // Etiqueta a la izquierda de la línea cuando el día está cerca del borde derecho.
      alinear: x > AREA.derecha - 60 ? 'end' : 'start',
      puntos: this.curvas().map((c) => {
        const valor = c.serie[Math.min(d, c.serie.length - 1)] ?? 0;
        return { clase: c.clase, etiqueta: c.etiqueta, valor, y: e.y(valor) };
      }),
    };
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

  // Clic o arrastre sobre la gráfica: todas las pantallas saltan a ese día.
  protected elegirDia(evento: PointerEvent): void {
    if (evento.type === 'pointermove' && !evento.buttons) return;
    const dias = this.resultado()?.escenario.dias ?? 0;
    this.reloj.irA(diaEnPunto(evento, AREA, dias, ANCHO));
  }
}
