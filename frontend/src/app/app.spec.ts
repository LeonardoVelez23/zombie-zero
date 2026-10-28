import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { Api } from './servicios/api';
import { ParametrosRespuesta } from './modelos/parametros';

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

  const apiMock = {
    comprobarSalud: () => of({ estado: 'ok' }),
    obtenerParametros: () => of(mockParametros),
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
});
