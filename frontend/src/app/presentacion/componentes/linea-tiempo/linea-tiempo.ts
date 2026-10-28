import { Component, computed, inject, input } from '@angular/core';

import { ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { hitosDelBrote } from '../../../dominio/reglas/dias';
import { RelojBrote, VELOCIDADES } from '../../servicios/reloj-brote';

// Barra fija con el día que muestran todas las pantallas: reproducir, velocidad,
// deslizador y saltos a los días clave del brote.
@Component({
  selector: 'app-linea-tiempo',
  templateUrl: './linea-tiempo.html',
  styleUrl: './linea-tiempo.css',
})
export class LineaTiempo {
  readonly resultado = input<ResultadoSimulacion | null>(null);

  protected readonly reloj = inject(RelojBrote);
  protected readonly velocidades = VELOCIDADES;

  protected readonly hitos = computed(() => {
    const r = this.resultado();
    return r ? hitosDelBrote(r) : [];
  });

  // Posición de cada hito sobre el deslizador, en porcentaje.
  protected posicion(dia: number): number {
    const total = this.reloj.total();
    return total ? (dia / total) * 100 : 0;
  }
}
