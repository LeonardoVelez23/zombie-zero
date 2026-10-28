import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { GeoJSONSource, Map as MapaLibre } from 'maplibre-gl';

import { Plan, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { numero } from '../../utilidades/formato';
import { SECTORES, estiloBase, urlDelWorker } from '../mapa/vistas';
import {
  NIVELES,
  ZonaBarrio,
  nivelDe,
  radioZona,
  zombiesGeoJSON,
  zombiesPorPunto,
  zonasGeoJSON,
} from './capas';
import { Evento, eventosDelBrote } from './eventos';

// Cada cuánto se redibujan los puntos al oscilar (ms) y cuánto dura una oscilación completa.
const CUADRO_MS = 90;
const OSCILACION_MS = 2400;

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

export { NIVELES, nivelDe } from './capas';

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
  // Zombies activos ese día (promedio de los brotes): los puntos del mapa.
  activos: number;
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
  // Día que se muestra; el panel lo lee para que los indicadores avancen con el mapa.
  readonly dia = model(0);
  protected readonly reproduciendo = signal(false);
  protected readonly velocidad = signal(VELOCIDADES[0].ms);
  protected readonly errorMapa = signal<string | null>(null);
  protected readonly numero = numero;
  // Barrio bajo el ratón y dónde mostrar su ficha (píxeles dentro del mapa).
  protected readonly hover = signal<{ nombre: string; x: number; y: number } | null>(null);

  private readonly contenedor = viewChild<ElementRef<HTMLDivElement>>('contenedor');
  private mapa: MapaLibre | null = null;
  private urlWorker: string | null = null;
  private destruido = false;
  private readonly marcadores = new Map<string, HTMLElement>();
  private temporizador: ReturnType<typeof setInterval> | null = null;
  // El estilo ya cargó y existen las capas de zonas y zombies.
  private readonly capasListas = signal(false);
  private animacion = 0;
  private fase = 0;

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
    const activos = this.filaActivos(this.plan());
    return r.barrios.map((nombre, i) => {
      const poblacion = r.poblacionBarrio[i];
      return {
        nombre,
        poblacion,
        mordidos: fila[i],
        fraccion: poblacion ? fila[i] / poblacion : 0,
        activos: activos?.[i] ?? 0,
      };
    });
  });

  // Zombies por punto: fijo para toda la simulación, así los planes se comparan a la misma escala.
  protected readonly escala = computed(() =>
    zombiesPorPunto(PLANES.map((p) => this.buscarPlan(p.id)?.mapa)),
  );

  // Barrios que tienen ubicación en el mapa, con el tamaño y el color de su zona.
  private readonly zonas = computed<(ZonaBarrio & { activos: number })[]>(() => {
    const barrios = this.barrios();
    const mayor = Math.max(1, ...barrios.map((b) => b.poblacion));
    return barrios.flatMap((b) => {
      const sector = SECTORES.find((s) => s.nombre === b.nombre);
      if (!sector) return [];
      return [
        {
          nombre: b.nombre,
          centro: sector.lngLat,
          radioKm: radioZona(b.poblacion, mayor),
          fraccion: b.fraccion,
          color: nivelDe(b.fraccion).color,
          activos: b.activos,
        },
      ];
    });
  });

  protected readonly barrioHover = computed(() => {
    const nombre = this.hover()?.nombre;
    return nombre ? (this.barrios().find((b) => b.nombre === nombre) ?? null) : null;
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

  // Zombies activos en toda la ciudad ese día: el contador del modo en vivo.
  protected readonly activosHoy = computed(() =>
    Math.round(this.barrios().reduce((suma, b) => suma + b.activos, 0)),
  );

  private readonly eventos = computed<Evento[]>(() => {
    const r = this.resultado();
    const plan = this.plan();
    return r && plan ? eventosDelBrote(r, plan) : [];
  });

  // Lo último que pasó hasta el día que se muestra, de lo más reciente a lo más antiguo.
  protected readonly eventosRecientes = computed(() =>
    this.eventos()
      .filter((e) => e.dia <= this.dia())
      .reverse()
      .slice(0, 5),
  );

  constructor() {
    const destruir = inject(DestroyRef);
    afterNextRender(() => void this.crearMapa());
    destruir.onDestroy(() => {
      this.destruido = true;
      cancelAnimationFrame(this.animacion);
      this.detener();
      this.mapa?.remove();
      if (this.urlWorker) URL.revokeObjectURL(this.urlWorker);
    });

    // Con una simulación nueva el brote se reproduce en vivo desde el día 0. Con movimiento
    // reducido se muestra directamente el último día: cómo termina el brote completo.
    effect(() => {
      const hay = !!this.resultado();
      untracked(() => {
        this.detener();
        if (hay && this.totalDias() > 0 && !prefiereMenosMovimiento()) {
          this.dia.set(0);
          this.alternarReproduccion();
        } else {
          this.dia.set(hay ? this.totalDias() : 0);
        }
      });
    });
    effect(() => this.pintar(this.barrios()));
    effect(() => {
      if (!this.capasListas()) return;
      this.fuente('zz-zonas')?.setData(zonasGeoJSON(this.zonas()));
      this.pintarZombies();
    });
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

  private filaActivos(plan: Plan | null): number[] | null {
    const filas = plan?.mapa;
    return filas?.length ? filas[Math.min(this.dia(), filas.length - 1)] : null;
  }

  private fuente(id: string): GeoJSONSource | undefined {
    return this.mapa?.getSource(id) as GeoJSONSource | undefined;
  }

  private pintarZombies(): void {
    const zonas = this.zonas();
    this.fuente('zz-zombies')?.setData(
      zombiesGeoJSON(
        zonas,
        zonas.map((z) => z.activos),
        this.escala(),
        this.fase,
      ),
    );
  }

  // Capas propias sobre el mapa base: zonas por barrio debajo y zombies activos encima.
  private agregarCapas(mapa: MapaLibre): void {
    const vacio = { type: 'FeatureCollection' as const, features: [] };
    mapa.addSource('zz-zonas', { type: 'geojson', data: vacio });
    mapa.addLayer({
      id: 'zz-zonas-relleno',
      type: 'fill',
      source: 'zz-zonas',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['interpolate', ['linear'], ['get', 'fraccion'], 0, 0.1, 0.3, 0.42],
      },
    });
    mapa.addLayer({
      id: 'zz-zonas-borde',
      type: 'line',
      source: 'zz-zonas',
      paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.75 },
    });
    mapa.addSource('zz-zombies', { type: 'geojson', data: vacio });
    mapa.addLayer({
      id: 'zz-zombies',
      type: 'circle',
      source: 'zz-zombies',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.8, 14, 4],
        'circle-color': '#ff4d6d',
        'circle-stroke-color': '#1a0610',
        'circle-stroke-width': 0.8,
        'circle-opacity': 0.9,
      },
    });

    mapa.on('mousemove', 'zz-zonas-relleno', (e) => {
      const nombre = e.features?.[0]?.properties?.['nombre'];
      mapa.getCanvas().style.cursor = 'pointer';
      if (typeof nombre === 'string') this.hover.set({ nombre, x: e.point.x, y: e.point.y });
    });
    mapa.on('mouseleave', 'zz-zonas-relleno', () => {
      mapa.getCanvas().style.cursor = '';
      this.hover.set(null);
    });

    this.capasListas.set(true);

    // Los puntos oscilan en su lugar; con movimiento reducido quedan quietos.
    if (prefiereMenosMovimiento()) return;
    let ultimo = 0;
    const cuadro = (t: number) => {
      if (this.destruido) return;
      if (t - ultimo >= CUADRO_MS) {
        ultimo = t;
        this.fase = (t % OSCILACION_MS) / OSCILACION_MS;
        this.pintarZombies();
      }
      this.animacion = requestAnimationFrame(cuadro);
    };
    this.animacion = requestAnimationFrame(cuadro);
  }

  private programar(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = setInterval(() => {
      this.dia.update((d) => Math.min(d + 1, this.totalDias()));
      if (this.dia() >= this.totalDias()) this.detener();
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
        fitBoundsOptions: { padding: { top: 60, bottom: 90, left: 70, right: 110 } },
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
      const mapa = this.mapa;
      mapa.on('load', () => this.agregarCapas(mapa));
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
        `${Math.round(28 + 8 * Math.sqrt(barrio.poblacion / mayor))}px`,
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

function prefiereMenosMovimiento(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function texto(clase: string, contenido: string): HTMLElement {
  const elemento = document.createElement('span');
  elemento.className = clase;
  elemento.textContent = contenido;
  return elemento;
}
