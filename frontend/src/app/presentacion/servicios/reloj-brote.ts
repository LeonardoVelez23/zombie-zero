import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

// Milisegundos entre un día y el siguiente (180 días duran ~22 s a 1×).
export const VELOCIDADES = [
  { nombre: '1×', ms: 120 },
  { nombre: '2×', ms: 60 },
  { nombre: '4×', ms: 30 },
];

/**
 * Reloj del brote: el día que muestran todas las pantallas de resultados a la vez
 * (indicadores, mapa, gráficas, tabla e informe). El panel crea uno propio; los
 * componentes sueltos (por ejemplo en pruebas) usan el de la raíz.
 */
@Injectable({ providedIn: 'root' })
export class RelojBrote {
  readonly dia = signal(0);
  readonly total = signal(0);
  readonly reproduciendo = signal(false);
  readonly velocidad = signal(VELOCIDADES[0].ms);
  readonly alFinal = computed(() => this.dia() >= this.total());

  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pausar());
  }

  /**
   * Con una simulación nueva el brote se reproduce en vivo desde el día 0. Con movimiento
   * reducido se muestra directamente el último día: cómo termina el brote completo.
   */
  nuevoBrote(total: number): void {
    this.pausar();
    this.total.set(Math.max(0, total));
    if (this.total() > 0 && !prefiereMenosMovimiento()) {
      this.dia.set(0);
      this.alternar();
    } else {
      this.dia.set(this.total());
    }
  }

  irA(dia: number): void {
    this.pausar();
    this.dia.set(this.acotar(dia));
  }

  alternar(): void {
    if (this.reproduciendo()) {
      this.pausar();
      return;
    }
    if (this.total() < 1) return;
    if (this.alFinal()) this.dia.set(0);
    this.reproduciendo.set(true);
    this.programar();
  }

  cambiarVelocidad(ms: number): void {
    this.velocidad.set(ms);
    if (this.reproduciendo()) this.programar();
  }

  pausar(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
    this.reproduciendo.set(false);
  }

  private acotar(dia: number): number {
    return Math.max(0, Math.min(Math.round(dia), this.total()));
  }

  private programar(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = setInterval(() => {
      this.dia.update((d) => this.acotar(d + 1));
      if (this.alFinal()) this.pausar();
    }, this.velocidad());
  }
}

export function prefiereMenosMovimiento(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
