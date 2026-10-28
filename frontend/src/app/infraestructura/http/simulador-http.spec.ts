import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { resultadoDePrueba } from '../../../testing/datos';
import { SimuladorHttp } from './simulador-http';

describe('SimuladorHttp', () => {
  let simulador: SimuladorHttp;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SimuladorHttp, provideHttpClient(), provideHttpClientTesting()],
    });
    simulador = TestBed.inject(SimuladorHttp);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía la configuración en snake_case y devuelve el resultado en camelCase', async () => {
    const respuesta = simulador.simular({
      repeticiones: 10,
      escenario: { nPersonas: 2000, recursos: { vacunasDisponibles: 500 } },
    });

    const peticion = http.expectOne((r) => r.url.endsWith('/api/simular'));
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      repeticiones: 10,
      escenario: { n_personas: 2000, recursos: { vacunas_disponibles: 500 } },
    });
    peticion.flush({ recomendado: 'anillo', veredicto: { gana_a_azar: 0.9 } });

    expect(await respuesta).toEqual({ recomendado: 'anillo', veredicto: { ganaAAzar: 0.9 } });
  });

  it('devuelve el mensaje de error del backend', async () => {
    const respuesta = simulador.parametros();
    http
      .expectOne((r) => r.url.endsWith('/api/parametros'))
      .flush({ error: 'r0 debe estar entre 0.5 y 10.0' }, { status: 400, statusText: 'Bad Request' });

    await expect(respuesta).rejects.toThrow('r0 debe estar entre 0.5 y 10.0');
  });

  it('avisa cuando la API no está levantada', async () => {
    const respuesta = simulador.difusion({});
    http.expectOne((r) => r.url.endsWith('/api/edp')).error(new ProgressEvent('error'), { status: 0 });

    await expect(respuesta).rejects.toThrow('No se pudo conectar con la API');
  });

  it('para el informe manda solo un resumen compacto, sin mapas ni curvas', async () => {
    const respuesta = simulador.informe(resultadoDePrueba);
    const peticion = http.expectOne((r) => r.url.endsWith('/api/informe'));
    expect(peticion.request.method).toBe('POST');
    const cuerpo = peticion.request.body;
    expect(cuerpo.escenario).toEqual({ n_personas: resultadoDePrueba.escenario.nPersonas });
    expect(cuerpo.veredicto.gana_a_azar).toBe(resultadoDePrueba.veredicto.ganaAAzar);
    expect(cuerpo.planes[0].infectados).toBe(resultadoDePrueba.planes[0].infectados.media);
    expect(JSON.stringify(cuerpo)).not.toMatch(/mapa|curva|estados/);
    peticion.flush({ fuente: 'local', modelo: null, texto: 'Plantilla.' });

    expect(await respuesta).toEqual({ fuente: 'local', modelo: null, texto: 'Plantilla.' });
  });
});
