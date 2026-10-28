import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { RedactarInforme } from '../../../aplicacion/casos-uso/redactar-informe';
import { InformeIa, ResultadoSimulacion } from '../../../dominio/modelos/resultado';

// El motor ya decidió la recomendación; aquí Amazon Bedrock solo la pasa a palabras para el alcalde.
// Si la IA no está disponible, el backend responde una plantilla y se etiqueta como texto sin IA.
@Component({
  selector: 'app-explicar-alcalde',
  templateUrl: './explicar-alcalde.html',
  styleUrl: './explicar-alcalde.css',
})
export class ExplicarAlcalde {
  readonly resultado = input.required<ResultadoSimulacion>();

  private readonly redactarInforme = inject(RedactarInforme);

  protected readonly redactando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly informe = signal<InformeIa | null>(null);
  protected readonly etiqueta = computed(() => {
    const i = this.informe();
    if (!i) return '';
    return i.fuente === 'bedrock'
      ? `Redactado por Amazon Bedrock (${i.modelo})`
      : 'Texto automático (sin IA)';
  });
  // Cada resultado nuevo invalida el texto y descarta respuestas que lleguen tarde.
  private peticion = 0;

  constructor() {
    effect(() => {
      this.resultado();
      untracked(() => {
        this.peticion++;
        this.informe.set(null);
        this.error.set(null);
        this.redactando.set(false);
      });
    });
  }

  protected async explicar(): Promise<void> {
    const peticion = ++this.peticion;
    this.redactando.set(true);
    this.error.set(null);
    try {
      const informe = await this.redactarInforme.ejecutar(this.resultado());
      if (peticion === this.peticion) this.informe.set(informe);
    } catch (e) {
      if (peticion === this.peticion) this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      if (peticion === this.peticion) this.redactando.set(false);
    }
  }
}
