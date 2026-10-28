import { Component, computed, input, output } from '@angular/core';

import { ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { cambiosDeEscenario } from '../../../dominio/reglas/cambios';
import { comparacion } from '../../../dominio/reglas/planes';
import { capitalizar, numero, porcentaje } from '../../utilidades/formato';

// Brote Sorpresa: qué cambió en el escenario y cómo cambia la recomendación frente a la referencia
// (la primera simulación, o la que se fijó después; por ejemplo, la de la semilla del jurado).
@Component({
  selector: 'app-antes-despues',
  templateUrl: './antes-despues.html',
  styleUrl: './antes-despues.css',
  host: { class: 'panel', id: 'antes-despues' },
})
export class AntesDespues {
  readonly anterior = input.required<ResultadoSimulacion>();
  readonly actual = input.required<ResultadoSimulacion>();
  readonly fijar = output<void>();

  protected readonly numero = numero;
  protected readonly porcentaje = porcentaje;

  protected readonly cambios = computed(() =>
    cambiosDeEscenario(this.anterior().escenario, this.actual().escenario),
  );

  protected readonly columnas = computed(() =>
    [
      { titulo: 'Referencia', r: this.anterior() },
      { titulo: 'Ahora', r: this.actual() },
    ].map(({ titulo, r }) => {
      const { recomendado, sinIntervencion } = comparacion(r);
      return {
        titulo,
        plan: capitalizar(recomendado.nombre),
        infectados: recomendado.infectados,
        sinIntervenir: sinIntervencion.infectados.media,
        salvados: r.veredicto.salvadosVsNinguna,
        ganaAAzar: r.veredicto.ganaAAzar,
      };
    }),
  );

  protected readonly cambiaPlan = computed(() => {
    const [antes, ahora] = this.columnas();
    return antes.plan !== ahora.plan;
  });
}
