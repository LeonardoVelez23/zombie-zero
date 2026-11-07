import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { ConsultarAsistente } from '../../../aplicacion/casos-uso/consultar-asistente';
import { InformeIa, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { cambiosDeEscenario } from '../../../dominio/reglas/cambios';
import { enManta } from '../../../dominio/reglas/escala';
import { comparacion } from '../../../dominio/reglas/planes';
import { capitalizar, numero, porcentaje } from '../../utilidades/formato';
import { etiquetaFuente } from '../../utilidades/ia';

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

  private readonly asistente = inject(ConsultarAsistente);
  // «Explicar el cambio»: la IA cuenta en palabras qué cambió entre las dos simulaciones.
  protected readonly explicacion = signal<InformeIa | null>(null);
  protected readonly explicando = signal(false);
  protected readonly errorExplicacion = signal<string | null>(null);
  protected readonly etiqueta = etiquetaFuente;
  private peticion = 0;

  constructor() {
    effect(() => {
      this.anterior();
      this.actual();
      untracked(() => {
        this.peticion++;
        this.explicacion.set(null);
        this.errorExplicacion.set(null);
        this.explicando.set(false);
      });
    });
  }

  protected async explicarCambio(): Promise<void> {
    const peticion = ++this.peticion;
    const vigente = () => peticion === this.peticion;
    this.explicando.set(true);
    this.errorExplicacion.set(null);
    try {
      const informe = await this.asistente.ejecutar(
        { tarea: 'comparar', resultado: this.actual(), anterior: this.anterior() },
        (parcial) => vigente() && this.explicacion.set(parcial),
      );
      if (vigente()) this.explicacion.set(informe);
    } catch (e) {
      if (vigente()) this.errorExplicacion.set(e instanceof Error ? e.message : String(e));
    } finally {
      if (vigente()) this.explicando.set(false);
    }
  }

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
        salvadosManta: enManta(r.veredicto.salvadosVsNinguna, r.escenario.nPersonas),
        ganaAAzar: r.veredicto.ganaAAzar,
      };
    }),
  );

  protected readonly cambiaPlan = computed(() => {
    const [antes, ahora] = this.columnas();
    return antes.plan !== ahora.plan;
  });
}
