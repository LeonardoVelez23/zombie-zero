import { Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';

import { ResultadoDifusion } from '../../../dominio/modelos/resultado';
import { numero } from '../../utilidades/formato';

const CELDA = 8; // píxeles por celda de la malla

@Component({
  selector: 'app-mapa',
  templateUrl: './mapa.html',
  styleUrl: './mapa.css',
  host: { class: 'panel', id: 'mapa' },
})
export class Mapa {
  readonly resultado = input<ResultadoDifusion | null>(null);
  readonly cargando = input(false);
  readonly error = input<string | null>(null);
  readonly ejecutar = output<void>();

  protected readonly numero = numero;
  protected readonly escenarioElegido = signal(0);
  protected readonly fotogramaElegido = signal(0);

  private readonly lienzo = viewChild<ElementRef<HTMLCanvasElement>>('lienzo');

  protected readonly escenario = computed(() => {
    const escenarios = this.resultado()?.escenarios ?? [];
    return escenarios[Math.min(this.escenarioElegido(), escenarios.length - 1)] ?? null;
  });

  protected readonly fotograma = computed(() => {
    const fotogramas = this.escenario()?.fotogramas ?? [];
    return fotogramas[Math.min(this.fotogramaElegido(), fotogramas.length - 1)] ?? null;
  });

  // Mismo máximo para todos los días del escenario: así el color se compara entre fotogramas.
  private readonly maximo = computed(() => {
    let maximo = 1e-9;
    for (const f of this.escenario()?.fotogramas ?? []) {
      for (const fila of f.zombies) for (const valor of fila) maximo = Math.max(maximo, valor);
    }
    return maximo;
  });

  constructor() {
    effect(() => this.dibujar());
  }

  private dibujar(): void {
    const canvas = this.lienzo()?.nativeElement;
    const resultado = this.resultado();
    const fotograma = this.fotograma();
    if (!canvas || !resultado || !fotograma) return;

    const { malla, aeropuerto } = resultado;
    canvas.width = malla.columnas * CELDA;
    canvas.height = malla.filas * CELDA;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#070a1d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const maximo = this.maximo();
    fotograma.zombies.forEach((fila, f) =>
      fila.forEach((valor, c) => {
        if (valor <= 0) return;
        ctx.fillStyle = `rgba(251, 75, 105, ${Math.sqrt(valor / maximo).toFixed(3)})`;
        ctx.fillRect(c * CELDA, f * CELDA, CELDA, CELDA);
      }),
    );

    const [lon, lat] = aeropuerto;
    const x = ((lon - malla.lonMin) / (malla.lonMax - malla.lonMin)) * canvas.width;
    const y = ((malla.latMax - lat) / (malla.latMax - malla.latMin)) * canvas.height;
    ctx.strokeStyle = '#ff9900';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 5, y - 5, 10, 10);
  }
}
