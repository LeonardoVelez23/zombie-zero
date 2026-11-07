import { TestBed } from '@angular/core/testing';

import { resultadoDePrueba } from '../../../../testing/datos';
import { ConsultarAsistente } from '../../../aplicacion/casos-uso/consultar-asistente';
import { InformeIa, PeticionIa, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { AntesDespues } from './antes-despues';

describe('Antes y después del Brote Sorpresa', () => {
  let pedidos: PeticionIa[];

  function renderizar(actual: ResultadoSimulacion) {
    pedidos = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ConsultarAsistente,
          useValue: {
            ejecutar: async (peticion: PeticionIa, alEscribir?: (p: InformeIa) => void) => {
              pedidos.push(peticion);
              alEscribir?.({ fuente: 'groq', modelo: 'm', texto: 'Antes se' });
              return { fuente: 'groq', modelo: 'm', texto: 'Antes se vacunaba menos.' };
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(AntesDespues);
    fixture.componentRef.setInput('anterior', resultadoDePrueba);
    fixture.componentRef.setInput('actual', actual);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, texto: el.textContent?.replace(/\s+/g, ' ') ?? '' };
  }

  it('muestra qué cambió y que la recomendación cambia de plan', () => {
    const { el, texto } = renderizar({
      ...resultadoDePrueba,
      escenario: {
        ...resultadoDePrueba.escenario,
        plaga: { ...resultadoDePrueba.escenario.plaga, r0: 5 },
      },
      recomendado: 'azar',
    });
    expect(texto).toContain('La recomendación cambia');
    expect(texto).toContain('R0 2,5 → 5');
    const planes = [...el.querySelectorAll('.plan')].map((p) => p.textContent?.trim());
    expect(planes).toEqual(['Anillo', 'Azar']);
  });

  it('con el mismo escenario lo dice y la recomendación se mantiene', () => {
    const { texto } = renderizar(resultadoDePrueba);
    expect(texto).toContain('La recomendación se mantiene');
    expect(texto).toContain('Misma configuración');
  });

  it('el botón fija el resultado actual como referencia', () => {
    const { fixture, el } = renderizar(resultadoDePrueba);
    let fijado = false;
    fixture.componentInstance.fijar.subscribe(() => (fijado = true));
    el.querySelector<HTMLButtonElement>('.fijar')!.click();
    expect(fijado).toBe(true);
  });

  it('explica el cambio con la IA solo cuando se pide', async () => {
    const actual = { ...resultadoDePrueba, repeticiones: 50 };
    const { fixture, el } = renderizar(actual);
    expect(pedidos).toHaveLength(0);
    el.querySelector<HTMLButtonElement>('button.explicar')!.click();
    await fixture.whenStable();
    expect(pedidos[0]).toEqual({ tarea: 'comparar', resultado: actual, anterior: resultadoDePrueba });
    expect(el.textContent).toContain('Antes se vacunaba menos.');
    expect(el.textContent).toContain('Redactado por Groq (m)');
  });
});
