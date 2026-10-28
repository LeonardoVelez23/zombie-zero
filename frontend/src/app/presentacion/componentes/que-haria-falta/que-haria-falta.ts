import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { SimularBrote } from '../../../aplicacion/casos-uso/simular-brote';
import { ResultadoSimulacion, Veredicto } from '../../../dominio/modelos/resultado';
import { Alternativa, alternativas } from '../../../dominio/reglas/alternativas';
import { enManta } from '../../../dominio/reglas/escala';
import { comparacion } from '../../../dominio/reglas/planes';
import { capitalizar, numero, porcentaje } from '../../utilidades/formato';

interface Respuesta {
  alternativa: Alternativa;
  plan: string;
  nivel: Veredicto['nivel'];
  infectados: number;
  salvados: number;
  salvadosManta: number;
  ganaAAzar: number;
}

// Cuando ningún plan gana con los recursos actuales (por ejemplo, el Brote Sorpresa "R0 doble"),
// simula qué decisión de la ciudad cambiaría el resultado: actuar antes, conseguir más recursos o ambas.
@Component({
  selector: 'app-que-haria-falta',
  templateUrl: './que-haria-falta.html',
  styleUrl: './que-haria-falta.css',
})
export class QueHariaFalta {
  readonly resultado = input.required<ResultadoSimulacion>();

  private readonly simularBrote = inject(SimularBrote);

  protected readonly numero = numero;
  protected readonly porcentaje = porcentaje;
  protected readonly calculando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly respuestas = signal<Respuesta[] | null>(null);
  // Cada resultado nuevo invalida lo calculado y descarta respuestas que lleguen tarde.
  private peticion = 0;

  constructor() {
    effect(() => {
      this.resultado();
      untracked(() => {
        this.peticion++;
        this.respuestas.set(null);
        this.error.set(null);
        this.calculando.set(false);
      });
    });
  }

  // El cambio más simple que ya gana (las alternativas vienen de menor a mayor esfuerzo);
  // si ninguna gana, la que deja menos infectados.
  protected readonly mejor = computed(() => {
    const lista = this.respuestas();
    if (!lista?.length) return null;
    return (
      lista.find((r) => r.nivel === 'solida') ??
      [...lista].sort((a, b) => a.infectados - b.infectados)[0]
    );
  });

  protected async calcular(): Promise<void> {
    const r = this.resultado();
    const peticion = ++this.peticion;
    this.calculando.set(true);
    this.error.set(null);
    try {
      const lista = await Promise.all(
        alternativas(r.escenario).map(async (alternativa) => {
          const res = await this.simularBrote.ejecutar({
            repeticiones: r.repeticiones,
            escenario: alternativa.escenario,
          });
          const { recomendado } = comparacion(res);
          return {
            alternativa,
            plan: capitalizar(recomendado.nombre),
            nivel: res.veredicto.nivel,
            infectados: recomendado.infectados.media,
            salvados: res.veredicto.salvadosVsNinguna,
            salvadosManta: enManta(res.veredicto.salvadosVsNinguna, res.escenario.nPersonas),
            ganaAAzar: res.veredicto.ganaAAzar,
          };
        }),
      );
      if (peticion === this.peticion) this.respuestas.set(lista);
    } catch (e) {
      if (peticion === this.peticion) this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      if (peticion === this.peticion) this.calculando.set(false);
    }
  }
}
