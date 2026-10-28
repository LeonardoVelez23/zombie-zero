import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { PASOS_GUIA, PasoGuia } from './pasos-guia';
import { EstadoGuia, PreferenciaGuia } from './preferencia-guia';

interface Caja {
  top: number;
  left: number;
  width: number;
  height: number;
}

type Modo = 'centrada' | 'flotante' | 'anclada';

const MARGEN = 12;
const HOLGURA_FOCO = 6;
const ANCHO_MOVIL = 640;

// Recorrido guiado opcional. Solo observa la página: busca elementos por selector,
// los resalta y los explica. No pulsa controles, no cambia datos ni llama a la API.
// Nunca se abre sola: únicamente con el botón «Ver recorrido».
@Component({
  selector: 'app-guia',
  templateUrl: './guia.html',
  styleUrl: './guia.css',
})
export class Guia {
  private readonly preferencia = inject(PreferenciaGuia);
  private readonly injector = inject(Injector);

  protected readonly pasos = PASOS_GUIA;
  protected readonly abierta = signal(false);
  protected readonly indice = signal(0);
  protected readonly estado = signal<EstadoGuia | null>(this.preferencia.leer());

  protected readonly paso = computed<PasoGuia>(() => this.pasos[this.indice()]);
  protected readonly esPrimero = computed(() => this.indice() === 0);
  protected readonly esUltimo = computed(() => this.indice() === this.pasos.length - 1);

  // Recuadro resaltado y posición de la tarjeta, en coordenadas de la ventana.
  protected readonly foco = signal<Caja | null>(null);
  protected readonly modo = signal<Modo>('centrada');
  protected readonly posicion = signal<{ top: number; left: number } | null>(null);

  private readonly disparador = viewChild.required<ElementRef<HTMLButtonElement>>('disparador');
  private readonly tarjeta = viewChild<ElementRef<HTMLElement>>('tarjeta');
  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');

  private quitarEscuchas: (() => void) | null = null;
  private cuadroPendiente = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dejarDeEscuchar());
  }

  protected abrir(): void {
    this.abierta.set(true);
    this.escuchar();
    this.irAlPaso(0);
  }

  protected siguiente(): void {
    if (!this.esUltimo()) this.irAlPaso(this.indice() + 1);
  }

  protected anterior(): void {
    if (!this.esPrimero()) this.irAlPaso(this.indice() - 1);
  }

  protected saltar(): void {
    this.cerrar('saltada');
  }

  protected finalizar(): void {
    this.cerrar('completada');
  }

  protected alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.saltar();
    } else if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      this.siguiente();
    } else if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      this.anterior();
    }
  }

  private cerrar(estado: EstadoGuia): void {
    this.preferencia.guardar(estado);
    this.estado.set(estado);
    this.abierta.set(false);
    this.foco.set(null);
    this.dejarDeEscuchar();
    this.disparador().nativeElement.focus();
  }

  private irAlPaso(indice: number): void {
    this.indice.set(indice);
    this.acercar(this.objetivo());
    // Tras pintar la tarjeta ya se conoce su tamaño: se coloca y se lleva el foco al título.
    afterNextRender(
      () => {
        this.medir();
        this.titulo()?.nativeElement.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  // Se busca en cada medición: el panel puede haber reemplazado el elemento (p. ej. al cargar parámetros).
  private objetivo(): Element | null {
    for (const selector of this.paso().objetivos) {
      const elemento = document.querySelector(selector);
      if (elemento && visible(elemento)) return elemento;
    }
    return null;
  }

  // Desplaza la página solo si el elemento no está entero a la vista.
  private acercar(elemento: Element | null): void {
    if (!elemento || typeof elemento.scrollIntoView !== 'function') return;
    const r = elemento.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight) return;
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    elemento.scrollIntoView({
      behavior: reducido ? 'auto' : 'smooth',
      block: r.height > window.innerHeight * 0.8 ? 'start' : 'center',
    });
  }

  private medir(): void {
    if (!this.abierta()) return;
    const elemento = this.objetivo();
    const alto = window.innerHeight;
    const ancho = window.innerWidth;

    if (!elemento) {
      this.foco.set(null);
      this.colocar('centrada');
      return;
    }

    const r = elemento.getBoundingClientRect();
    const top = Math.max(r.top - HOLGURA_FOCO, 4);
    const left = Math.max(r.left - HOLGURA_FOCO, 4);
    const bottom = Math.min(r.bottom + HOLGURA_FOCO, alto - 4);
    const right = Math.min(r.right + HOLGURA_FOCO, ancho - 4);
    this.foco.set({ top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) });

    if (ancho <= ANCHO_MOVIL) {
      this.colocar('anclada');
      return;
    }

    const tarjeta = this.tarjeta()?.nativeElement;
    const th = tarjeta?.offsetHeight || 240;
    const tw = tarjeta?.offsetWidth || 360;
    const ajustarX = (x: number) => Math.min(Math.max(x, MARGEN), ancho - tw - MARGEN);
    const ajustarY = (y: number) => Math.min(Math.max(y, MARGEN), alto - th - MARGEN);

    if (bottom + MARGEN + th <= alto) {
      this.colocar('flotante', { top: bottom + MARGEN, left: ajustarX(left) });
    } else if (top - MARGEN - th >= 0) {
      this.colocar('flotante', { top: top - MARGEN - th, left: ajustarX(left) });
    } else if (right + MARGEN + tw <= ancho) {
      this.colocar('flotante', { top: ajustarY(top), left: right + MARGEN });
    } else if (left - MARGEN - tw >= 0) {
      this.colocar('flotante', { top: ajustarY(top), left: left - MARGEN - tw });
    } else {
      this.colocar('anclada');
    }
  }

  private colocar(modo: Modo, posicion: { top: number; left: number } | null = null): void {
    this.modo.set(modo);
    this.posicion.set(posicion);
  }

  // Mientras la guía está abierta, el resaltado sigue al elemento al desplazar o redimensionar.
  private escuchar(): void {
    if (this.quitarEscuchas) return;
    const programar = () => {
      cancelAnimationFrame(this.cuadroPendiente);
      this.cuadroPendiente = requestAnimationFrame(() => this.medir());
    };
    window.addEventListener('scroll', programar, { passive: true, capture: true });
    window.addEventListener('resize', programar, { passive: true });
    this.quitarEscuchas = () => {
      window.removeEventListener('scroll', programar, { capture: true });
      window.removeEventListener('resize', programar);
      cancelAnimationFrame(this.cuadroPendiente);
    };
  }

  private dejarDeEscuchar(): void {
    this.quitarEscuchas?.();
    this.quitarEscuchas = null;
  }
}

const visible = (elemento: Element): boolean => {
  const r = elemento.getBoundingClientRect();
  return r.width > 0 || r.height > 0;
};
