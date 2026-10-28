import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { ModelarDifusion } from '../../../aplicacion/casos-uso/modelar-difusion';
import { ObtenerParametros } from '../../../aplicacion/casos-uso/obtener-parametros';
import { SimularBrote } from '../../../aplicacion/casos-uso/simular-brote';
import { ConfiguracionSimulacion, Parametros } from '../../../dominio/modelos/escenario';
import { ResultadoDifusion, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { comparacion } from '../../../dominio/reglas/planes';
import { Controles } from '../../componentes/controles/controles';
import { Grafica } from '../../componentes/grafica/grafica';
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
  imports: [Controles, Grafica, Estados, Informe, Mapa, Tabla],
  templateUrl: './panel.html',
  styleUrl: './panel.css',
})
export class Panel implements OnInit {
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
        { etiqueta: 'INFECTADOS SIN INTERVENIR', valor: '—', nota: pendiente, color: 'red', icono: '⌁' },
        { etiqueta: 'INFECTADOS CON EL PLAN', valor: '—', nota: pendiente, color: 'green', icono: '✓' },
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
    this.simulando.set(true);
    this.error.set(null);
    try {
      this.resultado.set(await this.simularBrote.ejecutar(configuracion));
      this.ultimaConfiguracion = configuracion;
    } catch (e) {
      this.error.set(mensaje(e));
    } finally {
      this.simulando.set(false);
    }
  }

  protected async calcularDifusion(): Promise<void> {
    this.calculandoDifusion.set(true);
    this.errorDifusion.set(null);
    try {
      this.difusion.set(
        await this.modelarDifusion.ejecutar({ escenario: this.ultimaConfiguracion.escenario }),
      );
    } catch (e) {
      this.errorDifusion.set(mensaje(e));
    } finally {
      this.calculandoDifusion.set(false);
    }
  }
}

const mensaje = (error: unknown): string => (error instanceof Error ? error.message : String(error));
