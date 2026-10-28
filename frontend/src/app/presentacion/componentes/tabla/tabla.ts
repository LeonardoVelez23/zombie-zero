import { Component, computed, inject, input } from '@angular/core';

import { Plan, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { mordidosHasta, salvadosHasta } from '../../../dominio/reglas/dias';
import { RelojBrote } from '../../servicios/reloj-brote';
import { numero, porcentaje } from '../../utilidades/formato';

@Component({
  selector: 'app-tabla',
  templateUrl: './tabla.html',
  styleUrl: './tabla.css',
  host: { class: 'panel', id: 'estrategias' },
})
export class Tabla {
  readonly resultado = input<ResultadoSimulacion | null>(null);

  private readonly reloj = inject(RelojBrote);

  protected readonly numero = numero;
  protected readonly porcentaje = porcentaje;

  protected readonly dia = computed(() =>
    Math.min(this.reloj.dia(), this.resultado()?.escenario.dias ?? 0),
  );

  // Mordidos y salvados de cada plan hasta el día de la línea de tiempo.
  protected readonly alDia = computed(() => {
    const r = this.resultado();
    const ninguna = r?.planes.find((p) => p.id === 'ninguna');
    if (!r || !ninguna) return new Map<string, { mordidos: number; salvados: number | null }>();
    const d = this.dia();
    const dias = r.escenario.dias;
    return new Map(
      r.planes.map((p: Plan) => [
        p.id,
        {
          mordidos: mordidosHasta(p, d, dias),
          salvados: p.id === 'ninguna' ? null : salvadosHasta(p, ninguna, d, dias),
        },
      ]),
    );
  });
}
