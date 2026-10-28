import { TestBed } from '@angular/core/testing';

import { parametrosDePrueba, resultadoDePrueba } from '../../../../testing/datos';
import { casosDeUso } from '../../../app.config';
import { ConfiguracionSimulacion } from '../../../dominio/modelos/escenario';
import { ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { SimuladorRepositorio } from '../../../dominio/puertos/simulador.repositorio';
import { QueHariaFalta } from './que-haria-falta';

describe('Qué haría falta para ganar', () => {
  let pedidas: ConfiguracionSimulacion[];

  // Actuar antes no alcanza; con el doble de recursos sí gana.
  function respuesta(configuracion: ConfiguracionSimulacion): ResultadoSimulacion {
    const doble = (configuracion.escenario?.recursos?.vacunasDisponibles ?? 0) > 1000;
    return {
      ...resultadoDePrueba,
      veredicto: {
        ...resultadoDePrueba.veredicto,
        nivel: doble ? 'solida' : 'insuficiente',
        ganaAAzar: doble ? 0.97 : 0.3,
        salvadosVsNinguna: doble ? 3000 : 100,
      },
    };
  }

  async function renderizar() {
    pedidas = [];
    const simulador: SimuladorRepositorio = {
      parametros: () => Promise.resolve(parametrosDePrueba),
      simular: (c) => {
        pedidas.push(c);
        return Promise.resolve(respuesta(c));
      },
      informe: () => Promise.reject(new Error('no se usa')),
      difusion: () => Promise.reject(new Error('no se usa')),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: SimuladorRepositorio, useValue: simulador }, ...casosDeUso],
    });
    const fixture = TestBed.createComponent(QueHariaFalta);
    fixture.componentRef.setInput('resultado', resultadoDePrueba);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el };
  }

  it('no simula nada hasta que se pide', async () => {
    const { el } = await renderizar();
    expect(pedidas).toEqual([]);
    expect(el.querySelector('.calcular')?.textContent).toContain('¿Qué haría falta para ganar?');
  });

  it('simula las tres alternativas con las mismas repeticiones y destaca la que gana', async () => {
    const { fixture, el } = await renderizar();
    el.querySelector<HTMLButtonElement>('.calcular')!.click();
    await fixture.whenStable();
    expect(pedidas).toHaveLength(3);
    expect(pedidas.every((c) => c.repeticiones === resultadoDePrueba.repeticiones)).toBe(true);
    expect(el.querySelectorAll('.alternativas li')).toHaveLength(3);
    expect(el.querySelector('li.mejor strong')?.textContent).toBe('El doble de recursos');
    expect(el.querySelector('.conclusion')?.textContent).toContain('3.000');
  });
});
