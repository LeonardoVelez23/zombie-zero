import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { ImageSource, Map as MapaLibre, Marker } from 'maplibre-gl';

import { ResultadoDifusion } from '../../../dominio/modelos/resultado';
import { numero } from '../../utilidades/formato';
import { LIMITES_MANTA, SECTORES, VISTAS, VistaId, estiloBase } from './vistas';

// Velocidades de la animación del mapa: milisegundos entre un fotograma y el siguiente
// (uno por día: 180 días duran ~22 s a 1×).
const VELOCIDADES = [
  { nombre: '1×', ms: 120 },
  { nombre: '2×', ms: 60 },
  { nombre: '4×', ms: 30 },
];

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
  protected readonly vistas = VISTAS;
  protected readonly vista = signal<VistaId>('satelite');
  protected readonly opacidad = signal(0.6);
  protected readonly escenarioElegido = signal(0);
  protected readonly fotogramaElegido = signal(0);
  protected readonly mapaListo = signal(false);
  protected readonly errorMapa = signal<string | null>(null);
  protected readonly velocidades = VELOCIDADES;
  protected readonly reproduciendo = signal(false);
  protected readonly velocidad = signal(VELOCIDADES[0].ms);
  private temporizador: ReturnType<typeof setInterval> | null = null;

  private readonly contenedor = viewChild<ElementRef<HTMLDivElement>>('contenedor');
  private mapa: MapaLibre | null = null;
  private urlWorker: string | null = null;
  private destruido = false;
  private marcadorAeropuerto: Marker | null = null;
  private crearMarcador: ((lngLat: [number, number]) => Marker) | null = null;
  private readonly lienzo = document.createElement('canvas');

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
    const destruir = inject(DestroyRef);
    afterNextRender(() => void this.crearMapa());
    destruir.onDestroy(() => {
      this.destruido = true;
      this.detener();
      this.liberar();
    });

    effect(() => this.mostrarVista(this.vista()));
    effect(() => this.dibujarZombies());
    effect(() => {
      const opacidad = this.opacidad();
      if (this.mapaListo() && this.mapa?.getLayer('zombies')) {
        this.mapa.setPaintProperty('zombies', 'raster-opacity', opacidad);
      }
    });
  }

  // MapLibre se carga aparte (import dinámico) para no inflar la carga inicial del panel.
  private async crearMapa(): Promise<void> {
    const elemento = this.contenedor()?.nativeElement;
    if (!elemento) return;
    try {
      // Si el componente se destruye durante una de las esperas, no se crea el mapa.
      const maplibre = await import('maplibre-gl');
      if (this.destruido) return;
      const urlWorker = await urlDelWorker();
      if (this.destruido) {
        URL.revokeObjectURL(urlWorker);
        return;
      }
      this.urlWorker = urlWorker;
      maplibre.setWorkerUrl(urlWorker);
      this.mapa = new maplibre.Map({
        container: elemento,
        style: estiloBase(this.vista()),
        bounds: LIMITES_MANTA,
        fitBoundsOptions: { padding: 24 },
        minZoom: 9,
        maxZoom: 18,
        attributionControl: { compact: true },
      });
      this.mapa.addControl(new maplibre.NavigationControl({ visualizePitch: false }), 'top-right');
      this.mapa.addControl(new maplibre.ScaleControl({ unit: 'metric' }), 'bottom-left');
      this.mapa.addControl(new maplibre.FullscreenControl(), 'top-right');
      this.crearMarcador = (lngLat) =>
        new maplibre.Marker({ element: marca('aeropuerto', '✈ Aeropuerto') }).setLngLat(lngLat);

      for (const s of SECTORES) {
        new maplibre.Marker({ element: marca('sector', s.nombre) })
          .setLngLat(s.lngLat)
          .addTo(this.mapa);
      }
      this.mapa.on('load', () => this.mapaListo.set(true));
      // Fallos del estilo o de mosaicos del mapa base (sin conexión, servicio caído): se avisa en
      // el panel para que no quede un mapa en blanco sin explicación.
      this.mapa.on('error', (e) => {
        console.warn('Mapa:', e.error?.message ?? e);
        this.errorMapa.set('No se pudo cargar parte del mapa base. Revisa la conexión a internet.');
      });
    } catch (e) {
      // Sin WebGL (navegadores muy viejos o pruebas en jsdom) el panel sigue funcionando.
      this.errorMapa.set('Este navegador no puede mostrar el mapa (necesita WebGL).');
      console.warn('No se pudo crear el mapa', e);
    }
  }

  // Animación: avanza un día por cada tic hasta el último y se detiene; si ya estaba al final,
  // vuelve a empezar desde el día 0.
  protected alternarReproduccion(): void {
    if (this.reproduciendo()) {
      this.detener();
      return;
    }
    const total = this.escenario()?.fotogramas.length ?? 0;
    if (total < 2) return;
    if (this.fotogramaElegido() >= total - 1) this.fotogramaElegido.set(0);
    this.reproduciendo.set(true);
    this.programar();
  }

  protected cambiarVelocidad(ms: number): void {
    this.velocidad.set(ms);
    if (this.reproduciendo()) this.programar();
  }

  private programar(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = setInterval(() => this.avanzar(), this.velocidad());
  }

  private avanzar(): void {
    const siguiente = this.fotogramaElegido() + 1;
    if (siguiente >= (this.escenario()?.fotogramas.length ?? 0)) {
      this.detener();
      return;
    }
    this.fotogramaElegido.set(siguiente);
  }

  private detener(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
    this.reproduciendo.set(false);
  }

  private liberar(): void {
    this.mapa?.remove();
    this.mapa = null;
    if (this.urlWorker) URL.revokeObjectURL(this.urlWorker);
    this.urlWorker = null;
  }

  private mostrarVista(vista: VistaId): void {
    if (!this.mapaListo() || !this.mapa) return;
    for (const v of VISTAS) {
      for (const capa of v.capas) {
        this.mapa.setLayoutProperty(capa, 'visibility', v.id === vista ? 'visible' : 'none');
      }
    }
  }

  // Pinta los zombies del día en un lienzo (un píxel por celda de 0,5 km) y lo pega sobre Manta con las
  // coordenadas reales de la malla; MapLibre lo estira con interpolación lineal, así la mancha queda suave.
  private dibujarZombies(): void {
    const mapa = this.mapa;
    const resultado = this.resultado();
    const fotograma = this.fotograma();
    const maximo = this.maximo();
    if (!this.mapaListo() || !mapa) return;

    if (!resultado || !fotograma) {
      if (mapa.getLayer('zombies')) mapa.setLayoutProperty('zombies', 'visibility', 'none');
      this.marcadorAeropuerto?.remove();
      return;
    }

    const { malla, aeropuerto } = resultado;
    this.lienzo.width = malla.columnas;
    this.lienzo.height = malla.filas;
    const ctx = this.lienzo.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.lienzo.width, this.lienzo.height);
    fotograma.zombies.forEach((fila, f) =>
      fila.forEach((valor, c) => {
        if (valor <= 0) return;
        const intensidad = Math.sqrt(valor / maximo);
        if (intensidad < 0.02) return;
        ctx.fillStyle = `rgba(255, 45, 85, ${intensidad.toFixed(3)})`;
        ctx.fillRect(c, f, 1, 1);
      }),
    );

    const url = this.lienzo.toDataURL('image/png');
    const coordenadas: [[number, number], [number, number], [number, number], [number, number]] = [
      [malla.lonMin, malla.latMax],
      [malla.lonMax, malla.latMax],
      [malla.lonMax, malla.latMin],
      [malla.lonMin, malla.latMin],
    ];
    const fuente = mapa.getSource<ImageSource>('zombies');
    if (fuente) {
      fuente.updateImage({ url, coordinates: coordenadas });
      mapa.setLayoutProperty('zombies', 'visibility', 'visible');
    } else {
      mapa.addSource('zombies', { type: 'image', url, coordinates: coordenadas });
      mapa.addLayer({
        id: 'zombies',
        type: 'raster',
        source: 'zombies',
        paint: {
          'raster-opacity': this.opacidad(),
          'raster-fade-duration': 0,
          'raster-resampling': 'linear',
        },
      });
    }

    this.marcadorAeropuerto?.remove();
    this.marcadorAeropuerto = this.crearMarcador?.(aeropuerto).addTo(mapa) ?? null;
  }
}

// El worker de MapLibre se copia junto al build (angular.json, "assets"). Se carga como Blob
// para no depender del tipo MIME con que S3/CloudFront sirvan los archivos .mjs.
async function urlDelWorker(): Promise<string> {
  const respuesta = await fetch('maplibre-gl-worker.mjs');
  if (!respuesta.ok) throw new Error(`No se pudo cargar el worker del mapa (${respuesta.status})`);
  const codigo = new Blob([await respuesta.text()], { type: 'text/javascript' });
  return URL.createObjectURL(codigo);
}

function marca(tipo: 'sector' | 'aeropuerto', texto: string): HTMLElement {
  const elemento = document.createElement('div');
  elemento.className = `marca-mapa marca-${tipo}`;
  elemento.textContent = texto;
  return elemento;
}
