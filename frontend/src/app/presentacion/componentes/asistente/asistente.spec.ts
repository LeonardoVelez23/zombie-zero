import { TestBed } from '@angular/core/testing';

import { resultadoDePrueba } from '../../../../testing/datos';
import { ConsultarAsistente } from '../../../aplicacion/casos-uso/consultar-asistente';
import { InformeIa, PeticionIa } from '../../../dominio/modelos/resultado';
import { Asistente } from './asistente';

describe('Pregúntale al asistente', () => {
  let pedidos: PeticionIa[];
  let responder: (p: PeticionIa) => Promise<InformeIa>;

  async function renderizar() {
    pedidos = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ConsultarAsistente,
          useValue: {
            ejecutar: (p: PeticionIa, alEscribir?: (parcial: InformeIa) => void) => {
              pedidos.push(p);
              alEscribir?.({ fuente: 'groq', modelo: 'm', texto: 'Escribiendo' });
              return responder(p);
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Asistente);
    fixture.componentRef.setInput('resultado', resultadoDePrueba);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const preguntar = async (texto: string) => {
      const campo = raiz.querySelector<HTMLInputElement>('#pregunta-asistente')!;
      campo.value = texto;
      campo.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      raiz.querySelector<HTMLFormElement>('form')!.requestSubmit();
      await fixture.whenStable();
    };
    return { fixture, raiz, preguntar };
  }

  it('una sugerencia pregunta en un clic y muestra quién respondió', async () => {
    responder = async () => ({ fuente: 'groq', modelo: 'm', texto: 'Porque frena los contagios.' });
    const { fixture, raiz } = await renderizar();
    raiz.querySelector<HTMLButtonElement>('.sugerencia')!.click();
    await fixture.whenStable();
    expect(pedidos[0]).toMatchObject({ tarea: 'pregunta', pregunta: '¿Por qué este plan y no otro?' });
    expect(pedidos[0].conversacion).toEqual([]);
    expect(raiz.textContent).toContain('Porque frena los contagios.');
    expect(raiz.textContent).toContain('Redactado por Groq (m)');
  });

  it('las preguntas siguientes llevan la conversación previa', async () => {
    responder = async (p) => ({ fuente: 'local', modelo: null, texto: `R: ${p.pregunta}` });
    const { preguntar } = await renderizar();
    await preguntar('Primera');
    await preguntar('Segunda');
    expect(pedidos[1].conversacion).toEqual([
      { rol: 'usuario', texto: 'Primera' },
      { rol: 'asistente', texto: 'R: Primera' },
    ]);
  });

  it('si falla, devuelve la pregunta al campo para reintentar', async () => {
    responder = () => Promise.reject(new Error('sin red'));
    const { raiz, preguntar } = await renderizar();
    await preguntar('¿Y ahora?');
    expect(raiz.textContent).toContain('No se pudo responder: sin red');
    expect(raiz.querySelector<HTMLInputElement>('#pregunta-asistente')!.value).toBe('¿Y ahora?');
    expect(raiz.querySelectorAll('.conversacion li')).toHaveLength(0);
  });

  it('una simulación nueva empieza otra conversación', async () => {
    responder = async () => ({ fuente: 'local', modelo: null, texto: 'Respuesta vieja.' });
    const { fixture, raiz, preguntar } = await renderizar();
    await preguntar('Hola');
    fixture.componentRef.setInput('resultado', { ...resultadoDePrueba, repeticiones: 50 });
    await fixture.whenStable();
    expect(raiz.textContent).not.toContain('Respuesta vieja.');
    expect(raiz.querySelector('.sugerencia')).not.toBeNull();
  });
});
