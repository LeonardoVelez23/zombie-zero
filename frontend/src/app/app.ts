import { Component, inject, signal, computed, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Api } from './servicios/api';
import { ComparacionEstrategiasComponent } from './componentes/comparacion-estrategias/comparacion-estrategias';
import { ConfiguracionSimulacionComponent } from './componentes/configuracion-simulacion/configuracion-simulacion';
import { GraficaEpidemiologicaComponent } from './componentes/grafica-epidemiologica/grafica-epidemiologica';
import { MetricasComponent } from './componentes/metricas/metricas';
import {
  ParametrosRespuesta,
  PlanResultado,
  SimulacionPeticion,
  SimulacionRespuesta,
} from './modelos/parametros';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    ComparacionEstrategiasComponent,
    ConfiguracionSimulacionComponent,
    GraficaEpidemiologicaComponent,
    MetricasComponent,
  ],
  encapsulation: ViewEncapsulation.None,
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly title = signal('zombie-zero-ui');

  private readonly api = inject(Api);

  // Estados de conexión y parámetros
  protected readonly estadoConexion = signal<'conectando' | 'online' | 'offline'>('conectando');
  protected readonly cargandoParametros = signal<boolean>(false);
  protected readonly parametros = signal<ParametrosRespuesta | null>(null);
  protected readonly errorCarga = signal<string | null>(null);

  // Controles de configuración del dashboard
  protected readonly poblacion = signal<number>(10000);
  protected readonly duracion = signal<number>(180);
  protected readonly semilla = signal<number>(42);
  protected readonly origen = signal<string>('aleatorio');
  protected readonly estrategia = signal<string>('auto');
  protected readonly repeticiones = signal<number>(50);

  // Estados de la simulación
  protected readonly simulando = signal<boolean>(false);
  protected readonly errorSimulacion = signal<string | null>(null);
  protected readonly respuestaSimulacion = signal<SimulacionRespuesta | null>(null);

  // Plan recomendado devuelto por la API
  protected readonly planRecomendado = computed<PlanResultado | null>(() => {
    const resp = this.respuestaSimulacion();
    if (!resp || !resp.planes || resp.planes.length === 0) return null;
    return resp.planes.find((p) => p.id === resp.recomendado) ?? resp.planes[0] ?? null;
  });

  // Plan seleccionado / visualizado en métricas y gráfica
  protected readonly planVisualizado = computed<PlanResultado | null>(() => {
    const resp = this.respuestaSimulacion();
    if (!resp || !resp.planes || resp.planes.length === 0) return null;
    const strat = this.estrategia();
    if (strat && strat !== 'auto') {
      const encontrado = resp.planes.find((p) => p.id === strat || p.vacunacion === strat);
      if (encontrado) return encontrado;
    }
    return this.planRecomendado();
  });

  ngOnInit(): void {
    this.verificarYcargar();
  }

  protected reintentar(): void {
    this.verificarYcargar();
  }

  protected actualizarPoblacion(value: number): void {
    this.poblacion.set(value);
  }

  protected actualizarDuracion(value: number): void {
    this.duracion.set(value);
  }

  protected actualizarSemilla(value: number): void {
    this.semilla.set(value);
  }

  protected actualizarOrigen(value: string): void {
    this.origen.set(value);
  }

  protected actualizarEstrategia(value: string): void {
    this.estrategia.set(value);
  }

  protected seleccionarPlan(idPlan: string): void {
    this.estrategia.set(idPlan);
  }

  protected actualizarRepeticiones(value: number): void {
    this.repeticiones.set(value);
  }

  protected ejecutarSimulacion(): void {
    if (this.simulando()) return;
    if (this.estadoConexion() !== 'online') {
      this.errorSimulacion.set('No se puede ejecutar la simulación: no hay conexión con el backend.');
      return;
    }

    const errValidacion = this.validarPeticion();
    if (errValidacion) {
      this.errorSimulacion.set(errValidacion);
      return;
    }

    this.simulando.set(true);
    this.errorSimulacion.set(null);

    const porDefecto = this.parametros()?.por_defecto;

    const payload: SimulacionPeticion = {
      escenario: {
        n_personas: Math.round(this.poblacion()),
        dias: Math.round(this.duracion()),
        semilla: Math.round(this.semilla()),
        inicio: this.origen(),
        casos_iniciales: porDefecto?.casos_iniciales ?? 5,
        plaga: porDefecto?.plaga ?? {
          r0: 2.5,
          dias_latencia: 3.0,
          dias_infeccioso: 5.0,
          deteccion: 0.7,
        },
        recursos: porDefecto?.recursos ?? {
          presupuesto: 20000,
          costo_vacuna: 10.0,
          vacunas_disponibles: 1000,
          vacunas_por_dia: 100,
          dia_inicio: 3,
          eficacia: 0.9,
          dias_cierre: 14,
          cumplimiento_cierre: 0.8,
          costo_cierre_mercado: 600.0,
          costo_cierre_colegio: 800.0,
        },
      },
      repeticiones: Math.round(this.repeticiones()),
    };

    this.api.simular(payload).subscribe({
      next: (resultado) => {
        this.respuestaSimulacion.set(resultado);
        this.simulando.set(false);
        this.errorSimulacion.set(null);
      },
      error: (error) => {
        console.error('Error al simular:', error);
        this.simulando.set(false);
        const detalle = error?.error?.error || error?.message || 'Error de comunicación con el servidor.';
        this.errorSimulacion.set(`Error al simular: ${detalle}`);
      },
    });
  }

  private validarPeticion(): string | null {
    const lim = this.parametros()?.limites;
    const pMin = lim?.escenario?.n_personas?.[0] ?? 1000;
    const pMax = lim?.escenario?.n_personas?.[1] ?? 20000;
    if (this.poblacion() < pMin || this.poblacion() > pMax) {
      return `La población debe estar entre ${pMin} y ${pMax} personas.`;
    }

    const dMin = lim?.escenario?.dias?.[0] ?? 30;
    const dMax = lim?.escenario?.dias?.[1] ?? 365;
    if (this.duracion() < dMin || this.duracion() > dMax) {
      return `La duración debe estar entre ${dMin} y ${dMax} días.`;
    }

    const sMin = lim?.escenario?.semilla?.[0] ?? 0;
    const sMax = lim?.escenario?.semilla?.[1] ?? 2147483647;
    if (this.semilla() < sMin || this.semilla() > sMax) {
      return `La semilla debe estar entre ${sMin} y ${sMax}.`;
    }

    const rMin = this.parametros()?.repeticiones?.limites?.[0] ?? 5;
    const rMax = this.parametros()?.repeticiones?.limites?.[1] ?? 200;
    if (this.repeticiones() < rMin || this.repeticiones() > rMax) {
      return `Las repeticiones deben ser un entero entre ${rMin} y ${rMax}.`;
    }

    const inicios = this.parametros()?.inicios;
    if (inicios && inicios.length > 0 && !inicios.includes(this.origen())) {
      return `El punto de inicio seleccionado no es válido.`;
    }

    return null;
  }

  private verificarYcargar(): void {
    this.estadoConexion.set('conectando');
    this.errorCarga.set(null);

    this.api.comprobarSalud().subscribe({
      next: () => {
        this.estadoConexion.set('online');
        this.cargarParametros();
      },
      error: (error) => {
        console.error('Error al conectar con la API:', error);
        this.estadoConexion.set('offline');
        this.errorCarga.set('No se pudo establecer conexión con el backend en http://localhost:8000.');
      },
    });
  }

  private cargarParametros(): void {
    this.cargandoParametros.set(true);
    this.api.obtenerParametros().subscribe({
      next: (datos) => {
        this.parametros.set(datos);
        this.cargandoParametros.set(false);
        this.errorCarga.set(null);

        if (datos.por_defecto) {
          this.poblacion.set(datos.por_defecto.n_personas);
          this.duracion.set(datos.por_defecto.dias);
          this.semilla.set(datos.por_defecto.semilla);
          this.origen.set(datos.por_defecto.inicio);
        }
        if (datos.repeticiones) {
          this.repeticiones.set(datos.repeticiones.por_defecto);
        }
      },
      error: (error) => {
        console.error('Error al cargar parámetros:', error);
        this.cargandoParametros.set(false);
        this.errorCarga.set('La API está disponible, pero no se pudieron obtener los parámetros.');
      },
    });
  }

}
