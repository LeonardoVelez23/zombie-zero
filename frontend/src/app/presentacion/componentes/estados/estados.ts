import { Component, computed, input, signal } from '@angular/core';

import { EstadoSeir, Plan, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { comparacion } from '../../../dominio/reglas/planes';
import { numero, numeroCorto } from '../../utilidades/formato';
import { Area, banda, escala, trazo } from '../../utilidades/grafica';

const AREA: Area = { izquierda: 55, derecha: 675, arriba: 20, abajo: 250 };

type Opcion = 'recomendado' | 'azar' | 'ninguna';

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
  // null = el día del pico sin intervención: un mismo día para comparar los tres planes.
  protected readonly diaElegido = signal<number | null>(null);

  protected readonly plan = computed<Plan | null>(() => {
    const r = this.resultado();
    if (!r) return null;
    const { recomendado, azar, sinIntervencion } = comparacion(r);
    return { recomendado, azar, ninguna: sinIntervencion }[this.opcion()];
  });

  protected readonly dias = computed(() => this.resultado()?.escenario.dias ?? 0);

  protected readonly dia = computed(() => {
    const r = this.resultado();
    const elegido = this.diaElegido();
    if (elegido !== null || !r) return Math.min(elegido ?? 0, this.dias());
    const zombies = comparacion(r).sinIntervencion.estados.I.media;
    return zombies.indexOf(Math.max(...zombies));
  });

  private readonly poblacion = computed(() => {
    const plan = this.plan();
    return plan ? ESTADOS.reduce((total, e) => total + plan.estados[e.id].media[0], 0) : 1;
  });

  // Áreas apiladas con la media de cada estado: siempre suman la población.
  protected readonly capas = computed(() => {
    const plan = this.plan();
    if (!plan) return [];
    const e = escala(this.dias(), this.poblacion(), AREA);
    let base = plan.estados.S.media.map(() => 0);
    return APILADO.map((id) => {
      const techo = base.map((v, d) => v + plan.estados[id].media[d]);
      const capa = { id, d: banda(base, techo, e) };
      base = techo;
      return capa;
    });
  });

  // Contorno de los zombies con su rango p5–p95, para que se vean aunque sean pocos.
  protected readonly zombies = computed(() => {
    const plan = this.plan();
    if (!plan) return null;
    const maximo = Math.max(1, ...plan.estados.I.p95);
    const e = escala(this.dias(), maximo, AREA);
    return {
      linea: trazo(plan.estados.I.media, e),
      banda: banda(plan.estados.I.p5, plan.estados.I.p95, e),
      maximo,
    };
  });

  protected readonly xDia = computed(() => escala(this.dias(), 1, AREA).x(this.dia()));

  protected readonly delDia = computed(() => {
    const plan = this.plan();
    const d = this.dia();
    if (!plan) return [];
    return ESTADOS.map((info) => {
      const serie = plan.estados[info.id];
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
      texto: `${Math.round(f * 100)} %`,
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
}
