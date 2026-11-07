import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { ConsultarAsistente } from '../../../aplicacion/casos-uso/consultar-asistente';
import { InformeIa, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { etiquetaFuente } from '../../utilidades/ia';

// El motor ya decidió la recomendación; aquí la IA (Bedrock, o Groq de respaldo) solo la pasa a
// palabras para el alcalde, y el texto aparece a medida que se escribe. Si la IA no está
// disponible, el backend responde una plantilla y se etiqueta como texto sin IA.
@Component({
  selector: 'app-explicar-alcalde',
  templateUrl: './explicar-alcalde.html',
  styleUrl: './explicar-alcalde.css',
})
export class ExplicarAlcalde {
  readonly resultado = input.required<ResultadoSimulacion>();

  private readonly asistente = inject(ConsultarAsistente);

  protected readonly redactando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly informe = signal<InformeIa | null>(null);
  protected readonly etiqueta = computed(() => {
    const i = this.informe();
    return i ? etiquetaFuente(i) : '';
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
    const vigente = () => peticion === this.peticion;
    this.redactando.set(true);
    this.error.set(null);
    try {
      const informe = await this.asistente.ejecutar(
        { tarea: 'alcalde', resultado: this.resultado() },
        (parcial) => {
          if (vigente()) this.informe.set(parcial);
        },
      );
      if (vigente()) this.informe.set(informe);
    } catch (e) {
      if (vigente()) {
        this.informe.set(null);
        this.error.set(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (vigente()) this.redactando.set(false);
    }
  }
}
