import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { Map as MapaLibre } from 'maplibre-gl';

import { Plan, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { SECTORES, estiloBase, urlDelWorker } from '../mapa/vistas';

type PlanMapa = 'ninguna' | 'azar' | 'recomendado';

const PLANES: { id: PlanMapa; nombre: string }[] = [
  { id: 'ninguna', nombre: 'Sin intervenir' },
  { id: 'azar', nombre: 'Vacunas al azar' },
  { id: 'recomendado', nombre: 'Plan recomendado' },
];

// Milisegundos entre un día y el siguiente (180 días duran ~22 s a 1×).
const VELOCIDADES = [
  { nombre: '1×', ms: 120 },
  { nombre: '2×', ms: 60 },
  { nombre: '4×', ms: 30 },
];

// Color de cada barrio según la fracción de su población que ya fue mordida.
export const NIVELES = [
  { desde: 0.2, nombre: 'Fuera de control', rango: '≥ 20 %', color: '#f43f5e' },
  { desde: 0.05, nombre: 'En alerta', rango: '5–20 %', color: '#ffba52' },
  { desde: 0, nombre: 'Contenido', rango: '< 5 %', color: '#4ade80' },
];

export const nivelDe = (fraccion: number) => NIVELES.find((n) => fraccion >= n.desde)!;

// Encuadre justo de los seis barrios (más cerca que el mapa EDP, que muestra todo el cantón).
const LIMITES_BARRIOS: [number, number, number, number] = [
  Math.min(...SECTORES.map((s) => s.lngLat[0])),
  Math.min(...SECTORES.map((s) => s.lngLat[1])),
  Math.max(...SECTORES.map((s) => s.lngLat[0])),
  Math.max(...SECTORES.map((s) => s.lngLat[1])),
];

// Lado en que va el nombre de cada barrio: los cuatro urbanos están a pocos km y se taparían.
const LADO_ETIQUETA: Record<string, 'arriba' | 'abajo' | 'izquierda' | 'derecha'> = {
  Manta: 'arriba',
  Tarqui: 'izquierda',
  'Los Esteros': 'derecha',
  'Eloy Alfaro': 'abajo',
  'San Mateo': 'abajo',
  Rural: 'abajo',
};

export interface Barrio {
  nombre: string;
  poblacion: number;
  mordidos: number;
  fraccion: number;
}

@Component({
  selector: 'app-mapa-barrios',
  templateUrl: './mapa-barrios.html',
  styleUrl: './mapa-barrios.css',
  host: { class: 'panel', id: 'mapa-brote' },
})
export class MapaBarrios {
  readonly resultado = input<ResultadoSimulacion | null>(null);

  protected readonly planes = PLANES;
  protected readonly velocidades = VELOCIDADES;
  protected readonly niveles = NIVELES;
  protected readonly nivelDe = nivelDe;
  protected readonly planElegido = signal<PlanMapa>('recomendado');
  protected readonly dia = signal(0);
  protected readonly reproduciendo = signal(false);
  protected readonly velocidad = signal(VELOCIDADES[0].ms);
  protected readonly errorMapa = signal<string | null>(null);

  private readonly contenedor = viewChild<ElementRef<HTMLDivElement>>('contenedor');
  private mapa: MapaLibre | null = null;
  private urlWorker: string | null = null;
  private destruido = false;
  private readonly marcadores = new Map<string, HTMLElement>();
  private temporizador: ReturnType<typeof setInterval> | null = null;

  private readonly plan = computed(() => this.buscarPlan(this.planElegido()));
  private readonly sinIntervenir = computed(() => this.buscarPlan('ninguna'));

  protected readonly etiquetaPlan = computed(() => {
    const elegido = this.planElegido();
    if (elegido === 'recomendado') return this.plan()?.nombre ?? 'el plan recomendado';
    return elegido === 'azar' ? 'vacunas al azar' : 'ningún plan';
  });
  protected readonly totalDias = computed(() => (this.plan()?.mapaAfectados?.length ?? 1) - 1);

  // Barrios del día elegido con la fracción de su población que ya fue mordida.
  protected readonly barrios = computed<Barrio[]>(() => {
    const r = this.resultado();
    const fila = this.fila(this.plan());
    if (!r || !fila) return [];
    return r.barrios.map((nombre, i) => {
      const poblacion = r.poblacionBarrio[i];
      return {
        nombre,
        poblacion,
        mordidos: fila[i],
        fraccion: poblacion ? fila[i] / poblacion : 0,
      };
    });
  });

  // Fracción de toda la ciudad mordida ese día, con el plan elegido y sin intervenir.
  protected readonly resumen = computed(() => {
    const r = this.resultado();
    const conPlan = this.fila(this.plan());
    const sinPlan = this.fila(this.sinIntervenir());
    if (!r || !conPlan || !sinPlan) return null;
    const total = r.poblacionBarrio.reduce((a, b) => a + b, 0);
    const suma = (fila: number[]) => fila.reduce((a, b) => a + b, 0);
    return { conPlan: suma(conPlan) / total, sinPlan: suma(sinPlan) / total };
  });

  constructor() {
    const destruir = inject(DestroyRef);
    afterNextRender(() => void this.crearMapa());
    destruir.onDestroy(() => {
      this.destruido = true;
      this.detener();
      this.mapa?.remove();
      if (this.urlWorker) URL.revokeObjectURL(this.urlWorker);
    });

    // Con una simulación nueva se muestra el último día: cómo termina el brote completo.
    effect(() => {
      const total = this.resultado() ? this.totalDias() : 0;
      this.detener();
      this.dia.set(total);
    });
    effect(() => this.pintar(this.barrios()));
  }

  protected porcentaje(fraccion: number): string {
    return `${Math.round(fraccion * 100)} %`;
  }

  protected alternarReproduccion(): void {
    if (this.reproduciendo()) {
      this.detener();
      return;
    }
    if (this.totalDias() < 1) return;
    if (this.dia() >= this.totalDias()) this.dia.set(0);
    this.reproduciendo.set(true);
    this.programar();
  }

  protected cambiarVelocidad(ms: number): void {
    this.velocidad.set(ms);
    if (this.reproduciendo()) this.programar();
  }

  protected elegirDia(dia: number): void {
    this.detener();
    this.dia.set(dia);
  }

  private buscarPlan(id: PlanMapa): Plan | null {
    const r = this.resultado();
    const buscado = id === 'recomendado' ? r?.recomendado : id;
    return r?.planes.find((p) => p.id === buscado) ?? null;
  }

  private fila(plan: Plan | null): number[] | null {
    const filas = plan?.mapaAfectados;
    return filas?.length ? filas[Math.min(this.dia(), filas.length - 1)] : null;
  }

  private programar(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = setInterval(() => {
      if (this.dia() >= this.totalDias()) {
        this.detener();
        return;
      }
      this.dia.update((d) => d + 1);
    }, this.velocidad());
  }

  private detener(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
    this.reproduciendo.set(false);
  }

  private async crearMapa(): Promise<void> {
    const elemento = this.contenedor()?.nativeElement;
    if (!elemento) return;
    try {
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
        style: estiloBase('oscuro'),
        bounds: LIMITES_BARRIOS,
        fitBoundsOptions: { padding: { top: 60, bottom: 70, left: 70, right: 110 } },
        minZoom: 9,
        maxZoom: 16,
        attributionControl: { compact: true },
      });
      this.mapa.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

      // Un marcador por barrio: el tamaño del círculo es su población; el color, cuánto se mordió.
      for (const sector of SECTORES) {
        const marca = document.createElement('div');
        marca.className = `barrio-mapa etiqueta-${LADO_ETIQUETA[sector.nombre] ?? 'abajo'}`;
        new maplibre.Marker({ element: marca }).setLngLat(sector.lngLat).addTo(this.mapa);
        this.marcadores.set(sector.nombre, marca);
      }
      this.pintar(this.barrios());
      this.mapa.on('error', () =>
        this.errorMapa.set('No se pudo cargar parte del mapa base. Revisa la conexión a internet.'),
      );
    } catch (e) {
      // Sin WebGL el panel sigue funcionando con la lista de barrios.
      this.errorMapa.set('Este navegador no puede mostrar el mapa (necesita WebGL).');
      console.warn('No se pudo crear el mapa por barrio', e);
    }
  }

  private pintar(barrios: Barrio[]): void {
    const mayor = Math.max(1, ...barrios.map((b) => b.poblacion));
    for (const [nombre, marca] of this.marcadores) {
      const barrio = barrios.find((b) => b.nombre === nombre);
      marca.hidden = !barrio;
      if (!barrio) continue;
      marca.style.setProperty(
        '--diametro',
        `${Math.round(22 + 22 * Math.sqrt(barrio.poblacion / mayor))}px`,
      );
      marca.style.setProperty('--color', nivelDe(barrio.fraccion).color);
      marca.replaceChildren(
        texto('barrio-circulo', this.porcentaje(barrio.fraccion)),
        texto('barrio-nombre', barrio.nombre),
      );
      marca.setAttribute(
        'aria-label',
        `${barrio.nombre}: ${this.porcentaje(barrio.fraccion)} mordido`,
      );
    }
  }
}

function texto(clase: string, contenido: string): HTMLElement {
  const elemento = document.createElement('span');
  elemento.className = clase;
  elemento.textContent = contenido;
  return elemento;
}
