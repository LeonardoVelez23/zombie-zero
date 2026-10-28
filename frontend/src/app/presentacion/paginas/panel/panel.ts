import {
  ApplicationRef,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import { ObtenerHistorial } from '../../../aplicacion/casos-uso/obtener-historial';
import { ModelarDifusion } from '../../../aplicacion/casos-uso/modelar-difusion';
import { ObtenerParametros } from '../../../aplicacion/casos-uso/obtener-parametros';
import { SimularBrote } from '../../../aplicacion/casos-uso/simular-brote';
import { ConfiguracionSimulacion, Parametros } from '../../../dominio/modelos/escenario';
import {
  ResultadoDifusion,
  ResultadoSimulacion,
  SimulacionGuardada,
  Veredicto,
} from '../../../dominio/modelos/resultado';
import { mordidosHasta, salvadosHasta } from '../../../dominio/reglas/dias';
import { POBLACION_MANTA, enManta, factorManta } from '../../../dominio/reglas/escala';
import { comparacion } from '../../../dominio/reglas/planes';
import { AntesDespues } from '../../componentes/antes-despues/antes-despues';
import { Controles } from '../../componentes/controles/controles';
import { Grafica } from '../../componentes/grafica/grafica';
import { Guia } from '../../componentes/guia/guia';
import { Historial, aConfiguracion } from '../../componentes/historial/historial';
import { MapaBarrios } from '../../componentes/mapa-barrios/mapa-barrios';
import { Informe } from '../../componentes/informe/informe';
import { LineaTiempo } from '../../componentes/linea-tiempo/linea-tiempo';
import { Estados } from '../../componentes/estados/estados';
import { Mapa } from '../../componentes/mapa/mapa';
import { Tabla } from '../../componentes/tabla/tabla';
import { RelojBrote } from '../../servicios/reloj-brote';
import { numero, porcentaje } from '../../utilidades/formato';
import {
  GraficaInforme,
  capturarLeyenda,
  capturarSvg,
  imprimirInforme,
  informeHtml,
} from '../../utilidades/informe-descarga';

// Mismo texto que la tarjeta de recomendación (componentes/informe).
const NIVELES: Record<Veredicto['nivel'], string> = {
  solida: 'Recomendación sólida',
  debil: 'Recomendación débil',
  insuficiente: 'Recursos insuficientes',
};

interface Indicador {
  etiqueta: string;
  valor: string;
  unidad?: string;
  // La misma cifra llevada a toda Manta (la red simulada es una muestra de la ciudad).
  manta?: string;
  nota: string;
  color: 'violet' | 'red' | 'green' | 'orange';
  icono: string;
}

type ModeloMapa = 'red' | 'edp';
type GraficaId = 'curva' | 'estados';

const GRAFICAS: { id: GraficaId; nombre: string }[] = [
  { id: 'curva', nombre: 'Curva de contagios' },
  { id: 'estados', nombre: 'Estados SEIR' },
];

const MODELOS: { id: ModeloMapa; nombre: string }[] = [
  { id: 'red', nombre: 'Modelo de red' },
  { id: 'edp', nombre: 'Modelo EDP (contraste)' },
];

@Component({
  selector: 'app-panel',
  imports: [
    AntesDespues,
    Controles,
    Grafica,
    Estados,
    Informe,
    LineaTiempo,
    Mapa,
    MapaBarrios,
    Tabla,
    Guia,
    Historial,
  ],
  templateUrl: './panel.html',
  styleUrl: './panel.css',
  // Un reloj por panel: todas sus pantallas de resultados muestran el mismo día.
  providers: [RelojBrote],
})
export class Panel implements OnInit {
  // Nombre que el operador o jurado escribió en la bienvenida (solo se muestra).
  readonly operador = input('');

  protected readonly iniciales = computed(() => {
    // Ignora palabras cortas como "de" o "la" cuando hay otras palabras relevantes.
    const nombre = this.operador().trim();
    const palabras = nombre.split(/\s+/).filter((p) => p.length > 2);
    const relevantes = palabras.length ? palabras : nombre.split(/\s+/).filter(Boolean);

    return (
      relevantes
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('') || 'ZZ'
    );
  });

  // En pantallas estrechas la barra empieza plegada (carril de iconos); abierta, se superpone al
  // contenido. En escritorio empieza abierta, como siempre.
  protected readonly sidebarPlegada = signal(pantallaEstrecha());

  protected alternarSidebar(): void {
    this.sidebarPlegada.update((plegada) => !plegada);
  }

  // Enlace del menú lateral elegido (los enlaces son anclas a secciones de esta misma pantalla).
  protected readonly seccionActiva = signal('dashboard');

  // Ir a una sección desde el menú. En pantallas estrechas la barra abierta tapa el contenido,
  // así que se vuelve a plegar (queda el carril de iconos para seguir navegando).
  protected irA(seccion: string): void {
    this.seccionActiva.set(seccion);
    if (pantallaEstrecha()) this.sidebarPlegada.set(true);
  }

  private readonly obtenerParametros = inject(ObtenerParametros);
  private readonly simularBrote = inject(SimularBrote);
  private readonly modelarDifusion = inject(ModelarDifusion);
  private readonly obtenerHistorial = inject(ObtenerHistorial);
  private readonly appRef = inject(ApplicationRef);
  private readonly controles = viewChild(Controles);

  protected readonly parametros = signal<Parametros | null>(null);
  protected readonly resultado = signal<ResultadoSimulacion | null>(null);
  // Resultado contra el que se compara (Brote Sorpresa): la primera simulación, hasta que se fije otra.
  protected readonly referencia = signal<ResultadoSimulacion | null>(null);
  protected readonly difusion = signal<ResultadoDifusion | null>(null);
  protected readonly simulando = signal(false);
  protected readonly calculandoDifusion = signal(false);
  protected readonly error = signal<string | null>(null);
  // Día que muestran todas las pantallas: los indicadores cuentan lo ocurrido hasta ese día.
  protected readonly reloj = inject(RelojBrote);
  protected readonly errorDifusion = signal<string | null>(null);
  // Últimas simulaciones guardadas en S3 (de todos); vacío si la API no las tiene.
  protected readonly historial = signal<SimulacionGuardada[]>([]);

  // Modelo que muestra el mapa principal: el de red (el que decide) o la EDP de contraste.
  protected readonly modelos = MODELOS;
  protected readonly modeloMapa = signal<ModeloMapa>('red');

  // Las dos gráficas grandes comparten lugar: se ve una a la vez.
  protected readonly graficas = GRAFICAS;
  protected readonly grafica = signal<GraficaId>('curva');

  // El mismo escenario en los dos modelos: infectados sin intervenir y con la intervención de cada uno.
  protected readonly contraste = computed(() => {
    const r = this.resultado();
    const d = this.difusion();
    if (!r || !d) return null;
    const { sinIntervencion, recomendado } = comparacion(r);
    const edp = (id: string) => d.escenarios.find((e) => e.id === id)?.infectadosTotal ?? 0;
    const fila = (nombre: string, plan: string, sin: number, con: number) => ({
      nombre,
      plan,
      sin: numero(sin),
      con: numero(con),
      salvados: Math.max(0, sin - con),
    });
    const red = fila(
      'Red (decide)',
      recomendado.nombre,
      sinIntervencion.infectados.media,
      recomendado.infectados.media,
    );
    const zonas = fila(
      'EDP (contraste)',
      'Vacunar por zonas',
      edp('ninguna'),
      edp('vacunacion_zonal'),
    );
    return {
      filas: [red, zonas].map((f) => ({ ...f, salvados: numero(f.salvados) })),
      veces: zonas.salvados > 0 ? Math.round(red.salvados / zonas.salvados) : null,
    };
  });

  // El mapa EDP usa el escenario de la última simulación (o el por defecto si aún no hay).
  private ultimaConfiguracion: ConfiguracionSimulacion = {};

  // Número de la última petición enviada: si una respuesta vieja llega tarde, se descarta
  // para que no reemplace el resultado de una configuración más reciente.
  private peticionSimulacion = 0;
  private peticionDifusion = 0;

  // Tamaño de la muestra simulada: contexto de todas las cifras (antes ocupaba una tarjeta entera).
  protected readonly contextoPoblacion = computed(() => {
    const poblacion =
      this.resultado()?.escenario.nPersonas ?? this.parametros()?.porDefecto.nPersonas;
    if (!poblacion) return null;
    return (
      `Muestra de ${numero(poblacion)} personas · representa a ${numero(POBLACION_MANTA)} ` +
      `habitantes de Manta (1 : ${Math.round(factorManta(poblacion))})`
    );
  });

  // Si las cifras de las tarjetas son parciales (la línea de tiempo va por un día intermedio)
  // o el resultado final del brote completo.
  protected readonly estadoCifras = computed(() => {
    const r = this.resultado();
    if (!r) return null;
    const dias = r.escenario.dias;
    const dia = Math.min(this.reloj.dia(), dias);
    return { parcial: dia < dias, dia, dias, repeticiones: r.repeticiones };
  });

  protected readonly indicadores = computed<Indicador[]>(() => {
    const r = this.resultado();
    if (!r) {
      const pendiente = 'Ejecuta una simulación';
      return [
        {
          etiqueta: 'SALVADOS FRENTE AL AZAR',
          valor: '—',
          nota: pendiente,
          color: 'violet',
          icono: '⇄',
        },
        {
          etiqueta: 'INFECTADOS SIN INTERVENIR',
          valor: '—',
          nota: pendiente,
          color: 'red',
          icono: '⌁',
        },
        {
          etiqueta: 'INFECTADOS CON EL PLAN',
          valor: '—',
          nota: pendiente,
          color: 'green',
          icono: '✓',
        },
        { etiqueta: 'PERSONAS SALVADAS', valor: '—', nota: pendiente, color: 'orange', icono: '✚' },
      ];
    }
    const { sinIntervencion, recomendado, azar } = comparacion(r);
    // Mientras se reproduce el brote se muestran los mordidos acumulados hasta ese día;
    // en el último día, los totales de la simulación (son los mismos valores).
    const dia = this.reloj.dia();
    const dias = r.escenario.dias;
    const enCurso = dia < dias;
    const sin = mordidosHasta(sinIntervencion, dia, dias);
    const con = mordidosHasta(recomendado, dia, dias);
    const salvados = enCurso
      ? salvadosHasta(recomendado, sinIntervencion, dia, dias)
      : r.veredicto.salvadosVsNinguna;
    // Las mismas cifras que ya trae la API: salvados frente al azar y el veredicto del motor.
    const v = r.veredicto;
    const salvadosAzar = enCurso ? salvadosHasta(recomendado, azar, dia, dias) : v.salvadosVsAzar;
    const manta = (valor: number) =>
      `≈ ${numero(enManta(valor, r.escenario.nPersonas))} en toda Manta`;
    const pico = `pico hacia el día ${Math.round(sinIntervencion.diaPico)}`;
    return [
      {
        etiqueta: 'SALVADOS FRENTE AL AZAR',
        valor: numero(salvadosAzar),
        manta: manta(salvadosAzar),
        nota: enCurso
          ? `Hasta el día ${dia}, frente a repartir las vacunas al azar`
          : `${NIVELES[v.nivel]} · gana al azar en ${porcentaje(v.ganaAAzar)} de los brotes con diferencia`,
        color: 'violet',
        icono: '⇄',
      },
      {
        etiqueta: 'INFECTADOS SIN INTERVENIR',
        valor: numero(sin),
        manta: manta(sin),
        nota: enCurso
          ? `Día ${dia} de ${r.escenario.dias} · ${pico}`
          : `Pico hacia el día ${Math.round(sinIntervencion.diaPico)}`,
        color: 'red',
        icono: '⌁',
      },
      {
        etiqueta: 'INFECTADOS CON EL PLAN',
        valor: numero(con),
        manta: manta(con),
        nota: recomendado.nombre,
        color: 'green',
        icono: '✓',
      },
      {
        etiqueta: 'PERSONAS SALVADAS',
        valor: numero(salvados),
        manta: manta(salvados),
        nota: enCurso
          ? `Hasta el día ${dia}, frente a no intervenir`
          : 'Frente a no intervenir (media)',
        color: 'orange',
        icono: '✚',
      },
    ];
  });

  async ngOnInit(): Promise<void> {
    try {
      this.parametros.set(await this.obtenerParametros.ejecutar());
    } catch (e) {
      this.error.set(mensaje(e));
    }
    void this.cargarHistorial();
  }

  // Sin historial la aplicación sigue igual: un fallo aquí no se muestra como error.
  protected async cargarHistorial(): Promise<void> {
    try {
      this.historial.set(await this.obtenerHistorial.ejecutar());
    } catch {
      this.historial.set([]);
    }
  }

  protected async simular(configuracion: ConfiguracionSimulacion): Promise<void> {
    const peticion = ++this.peticionSimulacion;
    const vigente = () => peticion === this.peticionSimulacion;
    this.simulando.set(true);
    this.error.set(null);
    try {
      const resultado = await this.simularBrote.ejecutar(configuracion);
      if (!vigente()) return;
      if (!this.referencia()) this.referencia.set(resultado);
      this.ultimaConfiguracion = configuracion;
      this.resultado.set(resultado);
      this.reloj.nuevoBrote(resultado.escenario.dias);
      // La EDP anterior era de otro escenario: se descarta (y también la que esté en camino).
      this.peticionDifusion++;
      this.difusion.set(null);
      this.errorDifusion.set(null);
      this.calculandoDifusion.set(false);
      if (this.modeloMapa() === 'edp') void this.calcularDifusion();
      // La simulación recién guardada aparece en «Resultados anteriores».
      void this.cargarHistorial();
    } catch (e) {
      if (vigente()) this.error.set(mensaje(e));
    } finally {
      if (vigente()) this.simulando.set(false);
    }
  }

  // «Volver a simular» desde el historial: el formulario muestra los valores que se usaron.
  protected async repetir(configuracion: ConfiguracionSimulacion): Promise<void> {
    this.controles()?.cargar(configuracion);
    await this.simular(configuracion);
  }

  // PDF de una simulación guardada con sus gráficas. Si no es la que está en pantalla, se vuelve a
  // simular con la misma semilla (da el mismo resultado) para dibujar sus gráficas.
  protected async descargarPdf(s: SimulacionGuardada): Promise<void> {
    const configuracion = aConfiguracion(s);
    const actual = this.resultado();
    const enPantalla =
      actual !== null &&
      actual.repeticiones === s.repeticiones &&
      canonico(actual.escenario) === canonico(configuracion.escenario);
    const alcalde = enPantalla
      ? (document.querySelector('app-explicar-alcalde .informe-ia')?.textContent ?? null)
      : null;
    if (!enPantalla) {
      await this.repetir(configuracion);
      if (this.error()) return;
    }
    // Las gráficas se copian con el brote completo (último día) y se deja todo como estaba.
    const pestana = this.grafica();
    const dia = this.reloj.dia();
    this.reloj.irA(s.dias);
    const graficas: GraficaInforme[] = [];
    for (const g of GRAFICAS) {
      this.grafica.set(g.id);
      this.appRef.tick();
      const svg = mayorSvg('#graficas');
      const leyenda = capturarLeyenda([
        ...document.querySelectorAll(
          '#graficas .chart-legend > span, #graficas .leyenda-estados > li',
        ),
      ]);
      if (svg) graficas.push({ titulo: g.nombre, svg: capturarSvg(svg), leyenda });
    }
    this.grafica.set(pestana);
    this.reloj.irA(dia);
    imprimirInforme(informeHtml(s, { operador: this.operador(), alcalde, graficas }));
  }

  protected elegirModelo(modelo: ModeloMapa): void {
    this.modeloMapa.set(modelo);
    if (modelo !== 'edp') return;
    // Sin el mapa de red a la vista, todas las pantallas saltan al brote completo
    // (la línea de tiempo sigue disponible para recorrerlo).
    const r = this.resultado();
    if (r) this.reloj.irA(r.escenario.dias);
    if (!this.difusion() && !this.calculandoDifusion()) void this.calcularDifusion();
  }

  protected async calcularDifusion(): Promise<void> {
    const peticion = ++this.peticionDifusion;
    const vigente = () => peticion === this.peticionDifusion;
    this.calculandoDifusion.set(true);
    this.errorDifusion.set(null);
    try {
      const difusion = await this.modelarDifusion.ejecutar({
        escenario: this.ultimaConfiguracion.escenario,
      });
      if (vigente()) this.difusion.set(difusion);
    } catch (e) {
      if (vigente()) this.errorDifusion.set(mensaje(e));
    } finally {
      if (vigente()) this.calculandoDifusion.set(false);
    }
  }
}

// Mismo corte que el CSS del panel (panel.css, @media max-width: 760px).
function pantallaEstrecha(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches;
}

const mensaje = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// JSON con las claves ordenadas: compara configuraciones sin importar el orden de los campos.
function canonico(valor: unknown): string {
  return JSON.stringify(valor, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

// La gráfica principal de una sección: el SVG más grande (los demás son iconos o leyendas).
function mayorSvg(selector: string): SVGSVGElement | null {
  const svgs = [...document.querySelectorAll<SVGSVGElement>(`${selector} svg`)];
  const area = (e: SVGSVGElement) =>
    e.getBoundingClientRect().width * e.getBoundingClientRect().height;
  return svgs.sort((a, b) => area(b) - area(a))[0] ?? null;
}
