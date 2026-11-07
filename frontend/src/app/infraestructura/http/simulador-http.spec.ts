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

  describe('asistente', () => {
    afterEach(() => vi.unstubAllGlobals());

    // Respuesta con el cuerpo en varios trozos, cortados donde caiga (como llega por la red).
    function responderSse(trozos: string[], status = 200) {
      const pedidos: { url: string; cuerpo: Record<string, unknown> }[] = [];
      vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
        pedidos.push({ url, cuerpo: JSON.parse(init.body as string) });
        const cuerpo = new ReadableStream<Uint8Array>({
          start(control) {
            for (const t of trozos) control.enqueue(new TextEncoder().encode(t));
            control.close();
          },
        });
        return new Response(cuerpo, { status });
      });
      return pedidos;
    }

    const sse = (evento: object) => `data: ${JSON.stringify(evento)}\n\n`;

    it('manda un resumen compacto y entrega el texto a medida que llega', async () => {
      const flujo =
        sse({ tipo: 'inicio', fuente: 'groq', modelo: 'openai/gpt-oss-120b' }) +
        sse({ tipo: 'texto', texto: 'Vacunar ' }) +
        sse({ tipo: 'texto', texto: 'superpropagadores.' }) +
        sse({ tipo: 'fin' });
      const pedidos = responderSse([flujo.slice(0, 50), flujo.slice(50, 97), flujo.slice(97)]);
      const parciales: string[] = [];

      const informe = await simulador.asistente(
        { tarea: 'pregunta', resultado: resultadoDePrueba, pregunta: '¿Por qué?', conversacion: [] },
        (p) => parciales.push(p.texto),
      );

      expect(informe).toEqual({
        fuente: 'groq',
        modelo: 'openai/gpt-oss-120b',
        texto: 'Vacunar superpropagadores.',
      });
      expect(parciales.at(-1)).toBe('Vacunar superpropagadores.');
      expect(parciales.length).toBeGreaterThan(1);
      const { url, cuerpo } = pedidos[0];
      expect(url).toMatch(/\/api\/asistente\/stream$/);
      expect(cuerpo['tarea']).toBe('pregunta');
      expect(cuerpo['pregunta']).toBe('¿Por qué?');
      const resultado = cuerpo['resultado'] as Record<string, any>;
      expect(resultado['escenario'].n_personas).toBe(resultadoDePrueba.escenario.nPersonas);
      expect(resultado['veredicto'].gana_a_azar).toBe(resultadoDePrueba.veredicto.ganaAAzar);
      expect(JSON.stringify(cuerpo)).not.toMatch(/mapa|curva|estados/);
    });

    it('quita las marcas de markdown que se cuelan', async () => {
      responderSse([
        sse({ tipo: 'inicio', fuente: 'groq', modelo: 'm' }) +
          sse({ tipo: 'texto', texto: '## Plan\nVacunar **anillo** ya.' }) +
          sse({ tipo: 'fin' }),
      ]);
      const informe = await simulador.asistente({ tarea: 'informe', resultado: resultadoDePrueba });
      expect(informe.texto).toBe('Plan\nVacunar anillo ya.');
    });

    it('si la IA se corta conserva el texto y el aviso', async () => {
      responderSse([
        sse({ tipo: 'inicio', fuente: 'bedrock', modelo: 'nova' }) +
          sse({ tipo: 'texto', texto: 'A medias' }) +
          sse({ tipo: 'aviso', aviso: 'La IA se interrumpió.' }) +
          sse({ tipo: 'fin' }),
      ]);
      const informe = await simulador.asistente({ tarea: 'alcalde', resultado: resultadoDePrueba });
      expect(informe.texto).toBe('A medias');
      expect(informe.aviso).toBe('La IA se interrumpió.');
    });

    it('un 400 muestra el error de la API', async () => {
      responderSse([JSON.stringify({ error: 'tarea debe ser una de: alcalde' })], 400);
      await expect(
        simulador.asistente({ tarea: 'alcalde', resultado: resultadoDePrueba }),
      ).rejects.toThrow('tarea debe ser una de: alcalde');
    });

    it('sin conexión lo dice', async () => {
      vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
      await expect(
        simulador.asistente({ tarea: 'alcalde', resultado: resultadoDePrueba }),
      ).rejects.toThrow('No se pudo conectar con la API');
    });
  });
});
