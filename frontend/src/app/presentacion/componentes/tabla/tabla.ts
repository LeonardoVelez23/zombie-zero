import { Component, computed, input, signal } from '@angular/core';

import { ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { numero, porcentaje } from '../../utilidades/formato';

// Planes que se ven además de las líneas base y el recomendado, hasta pulsar «Ver todos».
const MEJORES = 3;

@Component({
  selector: 'app-tabla',
  templateUrl: './tabla.html',
  styleUrl: './tabla.css',
  host: { class: 'panel', id: 'estrategias' },
})
export class Tabla {
  readonly resultado = input<ResultadoSimulacion | null>(null);

  protected readonly numero = numero;
  protected readonly porcentaje = porcentaje;
  protected readonly verTodos = signal(false);

  // Por defecto: las dos líneas base, el recomendado y los mejores del resto (menos infectados),
  // en el orden original de la tabla.
  protected readonly visibles = computed(() => {
    const r = this.resultado();
    if (!r) return [];
    if (this.verTodos()) return r.planes;
    const mejores = new Set(
      r.planes
        .filter((p) => p.tipo !== 'linea_base' && p.id !== r.recomendado)
        .sort((a, b) => a.infectados.media - b.infectados.media)
        .slice(0, MEJORES)
        .map((p) => p.id),
    );
    return r.planes.filter(
      (p) => p.tipo === 'linea_base' || p.id === r.recomendado || mejores.has(p.id),
    );
  });
}
