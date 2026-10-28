import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { Api } from './servicios/api';
import { ParametrosRespuesta, SimulacionRespuesta } from './modelos/parametros';

describe('App', () => {
  const mockParametros: ParametrosRespuesta = {
    por_defecto: {
      n_personas: 10000,
      dias: 180,
      semilla: 42,
      inicio: 'aleatorio',
      casos_iniciales: 5,
      plaga: { r0: 2.5, dias_latencia: 3, dias_infeccioso: 5, deteccion: 0.7 },
      recursos: {
        presupuesto: 20000,
        costo_vacuna: 10,
        vacunas_disponibles: 1000,
        vacunas_por_dia: 100,
        dia_inicio: 3,
        eficacia: 0.9,
        dias_cierre: 14,
        cumplimiento_cierre: 0.8,
        costo_cierre_mercado: 600,
        costo_cierre_colegio: 800,
      },
    },
    edp_por_defecto: { d_sanos: 0.1, d_zombies: 0.05, alfa: 0.02 },
    limites: {
      escenario: {
        n_personas: [1000, 20000],
        dias: [30, 365],
        semilla: [0, 2147483647],
        casos_iniciales: [1, 100],
      },
      plaga: {
        r0: [0.5, 10],
        dias_latencia: [1, 21],
        dias_infeccioso: [1, 21],
        deteccion: [0, 1],
      },
      recursos: {
        presupuesto: [0, 1000000],
        costo_vacuna: [0.01, 10000],
        vacunas_disponibles: [0, 20000],
        vacunas_por_dia: [1, 20000],
        dia_inicio: [0, 365],
        eficacia: [0, 1],
        dias_cierre: [0, 365],
        cumplimiento_cierre: [0, 1],
        costo_cierre_mercado: [0, 1000000],
        costo_cierre_colegio: [0, 1000000],
      },
      edp: {
        d_sanos: [0, 5],
        d_zombies: [0, 5],
        alfa: [0, 1],
      },
    },
    inicios: ['aleatorio', 'aeropuerto', 'mercado', 'colegio', 'Tarqui', 'Manta', 'Los Esteros', 'Eloy Alfaro', 'San Mateo', 'Rural'],
    repeticiones: { por_defecto: 50, limites: [5, 200] },
  };

  const mockSimulacion: SimulacionRespuesta = {
    escenario: mockParametros.por_defecto,
    repeticiones: 50,
    beta: 0.0461,
    r0: 2.5,
    barrios: ['Tarqui', 'Manta', 'Los Esteros', 'Eloy Alfaro', 'San Mateo', 'Rural'],
    poblacion_barrio: [2999, 2571, 1749, 1490, 742, 449],
    planes: [
      {
        id: 'ninguna',
        nombre: 'ninguna',
        tipo: 'linea_base',
        descripcion: 'Línea base: no se vacuna a nadie.',
        vacunacion: 'ninguna',
        cierres: [],
        vacunas: 0,
        costo: 0,
        infectados: { media: 4636.8, p5: 8.4, p95: 5354.1 },
        curva_zombies: {
          media: [5, 4, 3, 2, 1],
          p5: [5, 3, 2, 1, 0],
          p95: [5, 5, 4, 3, 2],
        },
        pico: { media: 409.6, p5: 5, p95: 523.8 },
        dia_pico: 85.9,
        vacunas_perdidas: 0,
        mapa: [],
      },
      {
        id: 'anillo',
        nombre: 'anillo',
        tipo: 'candidato',
        descripcion: 'Vacuna a los contactos de los zombies.',
        vacunacion: 'anillo',
        cierres: [],
        vacunas: 1000,
        costo: 10000,
        infectados: { media: 211.7, p5: 5.4, p95: 1248.9 },
        curva_zombies: {
          media: [5, 3, 2, 2, 1],
          p5: [5, 2, 1, 0, 0],
          p95: [5, 4, 3, 3, 2],
        },
        pico: { media: 18.3, p5: 5, p95: 97.7 },
        dia_pico: 26.8,
        vacunas_perdidas: 2.5,
        mapa: [],
        salvados_vs_ninguna: { media: 4425.1, p5: 2.4, p95: 5331.8 },
        gana_a_ninguna: 0.98,
        salvados_vs_azar: { media: 3529.4, p5: 2.4, p95: 4477.5 },
        gana_a_azar: 0.98,
      },
    ],
    recomendado: 'anillo',
    veredicto: {
      nivel: 'solida',
      gana_a_azar: 0.98,
      salvados_vs_ninguna: 4425.1,
      salvados_vs_azar: 3529.4,
    },
  };

  const apiMock = {
    comprobarSalud: () => of({ estado: 'ok' }),
    obtenerParametros: () => of(mockParametros),
    simular: () => of(mockSimulacion),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: Api, useValue: apiMock }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Centro de control');
  });

  it('should execute simulation and update results', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    app['ejecutarSimulacion']();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(app['respuestaSimulacion']()).toBeTruthy();
    expect(app['planRecomendado']()?.id).toBe('anillo');
    expect(app['graficaCalculada']()).toBeTruthy();
  });
});
