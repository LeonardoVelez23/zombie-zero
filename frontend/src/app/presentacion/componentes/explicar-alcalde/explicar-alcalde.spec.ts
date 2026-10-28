import { TestBed } from '@angular/core/testing';

import { casosDeUso } from '../../../app.config';
import { InformeIa, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { SimuladorRepositorio } from '../../../dominio/puertos/simulador.repositorio';
import { parametrosDePrueba, resultadoDePrueba } from '../../../../testing/datos';
import { ExplicarAlcalde } from './explicar-alcalde';

describe('Explicar al alcalde', () => {
  let responder: () => Promise<InformeIa>;
  let pedidos: ResultadoSimulacion[];

  async function renderizar() {
    pedidos = [];
    const simulador: SimuladorRepositorio = {
      parametros: () => Promise.resolve(parametrosDePrueba),
      simular: () => Promise.reject(new Error('no se usa')),
      difusion: () => Promise.reject(new Error('no se usa')),
      historial: () => Promise.resolve([]),
      informe: (resultado) => {
        pedidos.push(resultado);
        return responder();
      },
    };
    TestBed.configureTestingModule({
      providers: [{ provide: SimuladorRepositorio, useValue: simulador }, ...casosDeUso],
    });
    const fixture = TestBed.createComponent(ExplicarAlcalde);
    fixture.componentRef.setInput('resultado', resultadoDePrueba);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const explicar = async () => {
      raiz.querySelector<HTMLButtonElement>('button.explicar')!.click();
      await fixture.whenStable();
      return raiz.textContent ?? '';
    };
    return { fixture, raiz, explicar };
  }

  it('no llama a la IA hasta que se pide', async () => {
    responder = () => Promise.resolve({ fuente: 'local', modelo: null, texto: 'x' });
    const { raiz } = await renderizar();
    expect(raiz.textContent).toContain('Explicar al alcalde');
    expect(pedidos).toHaveLength(0);
  });

  it('muestra el texto de Bedrock con el modelo que lo redactó', async () => {
    responder = () =>
      Promise.resolve({ fuente: 'bedrock', modelo: 'amazon.nova-micro-v1:0', texto: 'Se recomienda vacunar.' });
    const { explicar } = await renderizar();
    const texto = await explicar();
    expect(pedidos).toEqual([resultadoDePrueba]);
    expect(texto).toContain('Se recomienda vacunar.');
    expect(texto).toContain('Redactado por Amazon Bedrock (amazon.nova-micro-v1:0)');
  });

  it('etiqueta la plantilla de respaldo como texto sin IA', async () => {
    responder = () => Promise.resolve({ fuente: 'local', modelo: null, texto: 'Plantilla fija.' });
    const { explicar } = await renderizar();
    const texto = await explicar();
    expect(texto).toContain('Plantilla fija.');
    expect(texto).toContain('Texto automático (sin IA)');
    expect(texto).not.toContain('Bedrock');
  });

  it('si la API falla lo dice y deja volver a intentarlo', async () => {
    responder = () => Promise.reject(new Error('No se pudo conectar con la API'));
    const { raiz, explicar } = await renderizar();
    const texto = await explicar();
    expect(texto).toContain('No se pudo redactar el informe: No se pudo conectar con la API');
    expect(raiz.querySelector('button.explicar')).not.toBeNull();
  });

  it('una simulación nueva borra el texto anterior', async () => {
    responder = () => Promise.resolve({ fuente: 'local', modelo: null, texto: 'Texto viejo.' });
    const { fixture, explicar } = await renderizar();
    await explicar();
    fixture.componentRef.setInput('resultado', { ...resultadoDePrueba, repeticiones: 50 });
    await fixture.whenStable();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain('Texto viejo.');
    expect(texto).toContain('Explicar al alcalde');
  });
});
