import { Component, computed, inject, input } from '@angular/core';

import { ResultadoSimulacion, Veredicto } from '../../../dominio/modelos/resultado';
import { salvadosHasta } from '../../../dominio/reglas/dias';
import { POBLACION_MANTA, enManta } from '../../../dominio/reglas/escala';
import { comparacion } from '../../../dominio/reglas/planes';
import { RelojBrote } from '../../servicios/reloj-brote';
import { numero, porcentaje } from '../../utilidades/formato';
import { QueHariaFalta } from '../que-haria-falta/que-haria-falta';

const TITULOS: Record<Veredicto['nivel'], string> = {
  solida: 'Recomendación sólida',
  debil: 'Recomendación débil',
  insuficiente: 'Recursos insuficientes',
};

@Component({
  selector: 'app-informe',
  imports: [QueHariaFalta],
  templateUrl: './informe.html',
  styleUrl: './informe.css',
  host: { class: 'panel' },
})
export class Informe {
  readonly resultado = input<ResultadoSimulacion | null>(null);

  protected readonly numero = numero;
  protected readonly porcentaje = porcentaje;
  protected readonly titulos = TITULOS;
  protected readonly poblacionManta = POBLACION_MANTA;
  protected readonly enManta = enManta;

  private readonly reloj = inject(RelojBrote);

  protected readonly recomendado = computed(() => {
    const r = this.resultado();
    return r ? comparacion(r).recomendado : null;
  });

  // Mientras se reproduce el brote: cuánto lleva salvado el plan recomendado hasta ese día.
  // La recomendación en sí se decide con el brote completo.
  protected readonly enCurso = computed(() => {
    const r = this.resultado();
    if (!r) return null;
    const dia = this.reloj.dia();
    const dias = r.escenario.dias;
    if (dia >= dias) return null;
    const { recomendado, sinIntervencion } = comparacion(r);
    return { dia, dias, salvados: salvadosHasta(recomendado, sinIntervencion, dia, dias) };
  });
}
