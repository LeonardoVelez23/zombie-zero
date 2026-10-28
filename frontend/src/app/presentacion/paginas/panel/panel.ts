import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { ModelarDifusion } from '../../../aplicacion/casos-uso/modelar-difusion';
import { ObtenerParametros } from '../../../aplicacion/casos-uso/obtener-parametros';
import { SimularBrote } from '../../../aplicacion/casos-uso/simular-brote';
import { ConfiguracionSimulacion, Parametros } from '../../../dominio/modelos/escenario';
import { ResultadoDifusion, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { comparacion } from '../../../dominio/reglas/planes';
import { Controles } from '../../componentes/controles/controles';
import { Grafica } from '../../componentes/grafica/grafica';
import { MapaBarrios } from '../../componentes/mapa-barrios/mapa-barrios';
import { Informe } from '../../componentes/informe/informe';
import { Estados } from '../../componentes/estados/estados';
import { Mapa } from '../../componentes/mapa/mapa';
import { Tabla } from '../../componentes/tabla/tabla';
import { numero } from '../../utilidades/formato';

interface Indicador {
  etiqueta: string;
  valor: string;
  unidad?: string;
  nota: string;
  color: 'violet' | 'red' | 'green' | 'orange';
  icono: string;
}

@Component({
  selector: 'app-panel',
  imports: [Controles, Grafica, Estados, Informe, Mapa, MapaBarrios, Tabla],
  templateUrl: './panel.html',
  styleUrl: './panel.css',
})
export class Panel implements OnInit {
  // Nombre que el operador o jurado escribió en la bienvenida (solo se muestra).
  readonly operador = input('');

  protected readonly iniciales = computed(() => {
    // Se saltan palabras cortas como "de" o "la": "Comité de Contención Manta" -> "CC".
    const palabras = this.operador().split(/\s+/).filter((p) => p.length > 2);
    return palabras.length ? palabras.slice(0, 2).map((p) => p[0].toUpperCase()).join('') : 'ZZ';
  });

  protected readonly sidebarPlegada = signal(false);

  protected alternarSidebar(): void {
    this.sidebarPlegada.update((plegada) => !plegada);
  }

  private readonly obtenerParametros = inject(ObtenerParametros);
  private readonly simularBrote = inject(SimularBrote);
  private readonly modelarDifusion = inject(ModelarDifusion);

  protected readonly parametros = signal<Parametros | null>(null);
  protected readonly resultado = signal<ResultadoSimulacion | null>(null);
  protected readonly difusion = signal<ResultadoDifusion | null>(null);
  protected readonly simulando = signal(false);
  protected readonly calculandoDifusion = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorDifusion = signal<string | null>(null);

  // El mapa EDP usa el escenario de la última simulación (o el por defecto si aún no hay).
  private ultimaConfiguracion: ConfiguracionSimulacion = {};

  // Número de la última petición enviada: si una respuesta vieja llega tarde, se descarta
  // para que no reemplace el resultado de una configuración más reciente.
  private peticionSimulacion = 0;
  private peticionDifusion = 0;

  protected readonly indicadores = computed<Indicador[]>(() => {
    const r = this.resultado();
    const poblacion = r?.escenario.nPersonas ?? this.parametros()?.porDefecto.nPersonas;
    const tarjetaPoblacion: Indicador = {
      etiqueta: 'POBLACIÓN SIMULADA',
      valor: poblacion ? numero(poblacion) : '—',
      unidad: 'hab.',
      nota: 'Red de contactos sintética de Manta',
      color: 'violet',
      icono: '⌂',
    };
    if (!r) {
      const pendiente = 'Ejecuta una simulación';
      return [
        tarjetaPoblacion,
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
    const { sinIntervencion, recomendado } = comparacion(r);
    return [
      tarjetaPoblacion,
      {
        etiqueta: 'INFECTADOS SIN INTERVENIR',
        valor: numero(sinIntervencion.infectados.media),
        nota: `Pico hacia el día ${Math.round(sinIntervencion.diaPico)}`,
        color: 'red',
        icono: '⌁',
      },
      {
        etiqueta: 'INFECTADOS CON EL PLAN',
        valor: numero(recomendado.infectados.media),
        nota: recomendado.nombre,
        color: 'green',
        icono: '✓',
      },
      {
        etiqueta: 'PERSONAS SALVADAS',
        valor: numero(r.veredicto.salvadosVsNinguna),
        nota: 'Frente a no intervenir (media)',
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
  }

  protected async simular(configuracion: ConfiguracionSimulacion): Promise<void> {
    const peticion = ++this.peticionSimulacion;
    const vigente = () => peticion === this.peticionSimulacion;
    this.simulando.set(true);
    this.error.set(null);
    try {
      const resultado = await this.simularBrote.ejecutar(configuracion);
      if (!vigente()) return;
      this.resultado.set(resultado);
      this.ultimaConfiguracion = configuracion;
    } catch (e) {
      if (vigente()) this.error.set(mensaje(e));
    } finally {
      if (vigente()) this.simulando.set(false);
    }
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

const mensaje = (error: unknown): string => (error instanceof Error ? error.message : String(error));
