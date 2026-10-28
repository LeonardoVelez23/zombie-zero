import { Component, computed, input } from '@angular/core';

import { ResultadoSimulacion, Veredicto } from '../../../dominio/modelos/resultado';
import { POBLACION_MANTA, enManta } from '../../../dominio/reglas/escala';
import { comparacion } from '../../../dominio/reglas/planes';
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

  protected readonly recomendado = computed(() => {
    const r = this.resultado();
    return r ? comparacion(r).recomendado : null;
  });
}
