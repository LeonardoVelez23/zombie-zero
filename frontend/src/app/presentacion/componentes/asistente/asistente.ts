import { Component, effect, inject, input, signal, untracked } from '@angular/core';

import { ConsultarAsistente } from '../../../aplicacion/casos-uso/consultar-asistente';
import { InformeIa, MensajeIa, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { etiquetaFuente } from '../../utilidades/ia';

interface Mensaje extends MensajeIa {
  // Solo en las respuestas: quién las redactó y si se cortaron.
  informe?: InformeIa;
}

// Preguntas frecuentes, a un clic.
const SUGERENCIAS = [
  '¿Por qué este plan y no otro?',
  '¿Qué pasa si llegan la mitad de las vacunas?',
  '¿Qué haría falta para salvar a más personas?',
];
// Mensajes anteriores que acompañan a cada pregunta (el backend acepta hasta 6).
const CONTEXTO = 6;
const MAX_PREGUNTA = 500;

// Preguntas sobre la simulación en pantalla. La IA responde solo con sus cifras y, si se pregunta
// por un escenario que no se simuló, sugiere qué cambiar y volver a simular.
@Component({
  selector: 'app-asistente',
  templateUrl: './asistente.html',
  styleUrl: './asistente.css',
  host: { class: 'panel', id: 'asistente' },
})
export class Asistente {
  readonly resultado = input.required<ResultadoSimulacion>();

  private readonly asistente = inject(ConsultarAsistente);

  protected readonly sugerencias = SUGERENCIAS;
  protected readonly maxPregunta = MAX_PREGUNTA;
  protected readonly mensajes = signal<Mensaje[]>([]);
  protected readonly pregunta = signal('');
  protected readonly escribiendo = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly etiqueta = etiquetaFuente;
  private peticion = 0;

  constructor() {
    // Otra simulación: la conversación hablaba de cifras que ya no están en pantalla.
    effect(() => {
      this.resultado();
      untracked(() => {
        this.peticion++;
        this.mensajes.set([]);
        this.error.set(null);
        this.escribiendo.set(false);
      });
    });
  }

  protected async preguntar(texto = this.pregunta()): Promise<void> {
    const pregunta = texto.trim();
    if (!pregunta || this.escribiendo()) return;
    const peticion = ++this.peticion;
    const vigente = () => peticion === this.peticion;
    // Solo pares completos (pregunta y respuesta), para que la conversación empiece por el usuario.
    const anteriores = this.mensajes()
      .filter((m) => m.texto)
      .slice(-CONTEXTO)
      .map(({ rol, texto }) => ({ rol, texto }));
    const conversacion = anteriores[0]?.rol === 'asistente' ? anteriores.slice(1) : anteriores;

    this.mensajes.update((ms) => [
      ...ms,
      { rol: 'usuario', texto: pregunta },
      { rol: 'asistente', texto: '' },
    ]);
    this.pregunta.set('');
    this.error.set(null);
    this.escribiendo.set(true);
    const responder = (informe: InformeIa) =>
      this.mensajes.update((ms) => [
        ...ms.slice(0, -1),
        { rol: 'asistente', texto: informe.texto, informe },
      ]);
    try {
      const informe = await this.asistente.ejecutar(
        { tarea: 'pregunta', resultado: this.resultado(), pregunta, conversacion },
        (parcial) => vigente() && responder(parcial),
      );
      if (vigente()) responder(informe);
    } catch (e) {
      if (!vigente()) return;
      // Sin respuesta: se quita la pregunta para poder reintentarla.
      this.mensajes.update((ms) => ms.slice(0, -2));
      this.pregunta.set(pregunta);
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      if (vigente()) this.escribiendo.set(false);
    }
  }

  protected escribir(evento: Event): void {
    this.pregunta.set((evento.target as HTMLInputElement).value);
  }
}
