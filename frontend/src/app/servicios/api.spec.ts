import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Api } from './api';
import { ParametrosRespuesta } from '../modelos/parametros';

describe('Api', () => {
  let service: Api;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Api);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch health status', () => {
    service.comprobarSalud().subscribe((res) => {
      expect(res.estado).toBe('ok');
    });

    const req = httpTesting.expectOne('http://localhost:8000/api/salud');
    expect(req.request.method).toBe('GET');
    req.flush({ estado: 'ok' });
  });

  it('should fetch parameters', () => {
    const mockRespuesta: Partial<ParametrosRespuesta> = {
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
      inicios: ['aleatorio', 'aeropuerto', 'mercado'],
    };

    service.obtenerParametros().subscribe((res) => {
      expect(res.por_defecto.n_personas).toBe(10000);
      expect(res.inicios).toContain('aeropuerto');
    });

    const req = httpTesting.expectOne('http://localhost:8000/api/parametros');
    expect(req.request.method).toBe('GET');
    req.flush(mockRespuesta);
  });
});
