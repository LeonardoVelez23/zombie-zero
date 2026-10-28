import { Component, computed, inject, input, signal } from '@angular/core';

import { EstadoSeir, Plan, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { comparacion } from '../../../dominio/reglas/planes';
import { RelojBrote } from '../../servicios/reloj-brote';
import { numero, numeroCorto } from '../../utilidades/formato';
import { Area, banda, diaEnPunto, escala, trazo } from '../../utilidades/grafica';

const AREA: Area = { izquierda: 55, derecha: 675, arriba: 20, abajo: 250 };
const ANCHO = 700;

type Opcion = 'recomendado' | 'azar' | 'ninguna';
// Líneas: una curva por estado en número de personas (como el gráfico "Populations" de NetLogo).
// Áreas: los cuatro estados apilados, que siempre suman la población.
type Vista = 'lineas' | 'areas';

export interface InfoEstado {
  id: EstadoSeir;
  emoji: string;
  nombre: string;
  explicacion: string;
}

// De abajo hacia arriba en la gráfica apilada: exorcizados, zombies, mordidos y sanos.
export const ESTADOS: InfoEstado[] = [
  { id: 'S', emoji: '🟢', nombre: 'Sanos', explicacion: 'Pueden ser mordidos' },
  { id: 'E', emoji: '🟡', nombre: 'Mordidos', explicacion: 'Incuban, aún no contagian' },
  { id: 'I', emoji: '🔴', nombre: 'Zombies', explicacion: 'Contagian a sus contactos' },
  { id: 'R', emoji: '🔵', nombre: 'Exorcizados', explicacion: 'Ya no contagian y son inmunes' },
];
const APILADO: EstadoSeir[] = ['R', 'I', 'E', 'S'];

@Component({
  selector: 'app-estados',
  templateUrl: './estados.html',
  styleUrl: './estados.css',
  host: { class: 'panel', id: 'estados' },
})
export class Estados {
  readonly resultado = input<ResultadoSimulacion | null>(null);

  protected readonly area = AREA;
  protected readonly estados = ESTADOS;
  protected readonly numero = numero;
  protected readonly opciones: { id: Opcion; nombre: string }[] = [
    { id: 'recomendado', nombre: 'Plan recomendado' },
    { id: 'azar', nombre: 'Vacunas al azar' },
    { id: 'ninguna', nombre: 'Sin intervención' },
  ];
  protected readonly opcion = signal<Opcion>('recomendado');
  protected readonly vista = signal<Vista>('lineas');
  protected readonly vistas: { id: Vista; nombre: string }[] = [
    { id: 'lineas', nombre: 'Líneas' },
    { id: 'areas', nombre: 'Áreas' },
  ];
  // El día lo marca la línea de tiempo del panel: el mismo para todas las pantallas.
  private readonly reloj = inject(RelojBrote);

  protected readonly plan = computed<Plan | null>(() => {
    const r = this.resultado();
    if (!r) return null;
    const { recomendado, azar, sinIntervencion } = comparacion(r);
    return { recomendado, azar, ninguna: sinIntervencion }[this.opcion()];
  });

  // Puede faltar si la API es anterior a este panel (respuesta sin `estados`).
  protected readonly estadosPlan = computed(() => this.plan()?.estados ?? null);

  protected readonly dias = computed(() => this.resultado()?.escenario.dias ?? 0);

  protected readonly dia = computed(() => Math.min(this.reloj.dia(), this.dias()));

  // Día del pico sin intervención: el mismo que usan los indicadores y la línea de tiempo.
  protected readonly diaPico = computed(() => {
    const r = this.resultado();
    return r ? Math.min(Math.round(comparacion(r).sinIntervencion.diaPico), this.dias()) : 0;
  });

  private readonly poblacion = computed(() => {
    const estados = this.estadosPlan();
    return estados ? ESTADOS.reduce((total, e) => total + estados[e.id].media[0], 0) : 1;
  });

  // Áreas apiladas con la media de cada estado: siempre suman la población.
  protected readonly capas = computed(() => {
    const estados = this.estadosPlan();
    if (!estados) return [];
    const e = escala(this.dias(), this.poblacion(), AREA);
    let base = estados.S.media.map(() => 0);
    return APILADO.map((id) => {
      const techo = base.map((v, d) => v + estados[id].media[d]);
      const capa = { id, d: banda(base, techo, e) };
      base = techo;
      return capa;
    });
  });

  // Una línea por estado con su banda p5–p95, en personas sobre toda la población.
  protected readonly lineas = computed(() => {
    const estados = this.estadosPlan();
    if (!estados) return [];
    const e = escala(this.dias(), this.poblacion(), AREA);
    return ESTADOS.map(({ id }) => ({
      id,
      linea: trazo(estados[id].media, e),
      banda: banda(estados[id].p5, estados[id].p95, e),
    }));
  });

  // Contorno de los zombies con su rango p5–p95, para que se vean aunque sean pocos.
  protected readonly zombies = computed(() => {
    const zombies = this.estadosPlan()?.I;
    if (!zombies) return null;
    const maximo = Math.max(1, ...zombies.p95);
    const e = escala(this.dias(), maximo, AREA);
    return {
      linea: trazo(zombies.media, e),
      banda: banda(zombies.p5, zombies.p95, e),
      maximo,
    };
  });

  protected readonly xDia = computed(() => escala(this.dias(), 1, AREA).x(this.dia()));

  protected readonly delDia = computed(() => {
    const estados = this.estadosPlan();
    const d = this.dia();
    if (!estados) return [];
    return ESTADOS.map((info) => {
      const serie = estados[info.id];
      return {
        ...info,
        media: serie.media[d],
        p5: serie.p5[d],
        p95: serie.p95[d],
        fraccion: serie.media[d] / this.poblacion(),
      };
    });
  });

  protected readonly resumen = computed(() => {
    const [s, e, i, r] = this.delDia().map((x) => numero(x.media));
    return `El día ${this.dia()}, en promedio hay ${s} sanos, ${e} mordidos, ${i} zombies y ${r} exorcizados.`;
  });

  protected readonly ejeY = computed(() =>
    [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      y: AREA.abajo - f * (AREA.abajo - AREA.arriba),
      texto:
        this.vista() === 'lineas'
          ? numero(Math.round(f * this.poblacion()))
          : `${Math.round(f * 100)} %`,
    })),
  );

  protected readonly ejeX = computed(() => {
    const e = escala(this.dias(), 1, AREA);
    return [0, 1 / 3, 2 / 3, 1].map((f) => {
      const dia = Math.round(f * this.dias());
      return { x: e.x(dia), texto: `Día ${dia}` };
    });
  });

  protected readonly maximoZombies = computed(() => numeroCorto(this.zombies()?.maximo ?? 0));

  protected elegirPlan(opcion: Opcion): void {
    this.opcion.set(opcion);
  }

  protected irAlPico(): void {
    this.reloj.irA(this.diaPico());
  }

  // Clic o arrastre sobre una gráfica: todas las pantallas saltan a ese día.
  protected elegirDia(evento: PointerEvent): void {
    if (evento.type === 'pointermove' && !evento.buttons) return;
    this.reloj.irA(diaEnPunto(evento, AREA, this.dias(), ANCHO));
  }
}
