import { TestBed } from '@angular/core/testing';

import { Veredicto } from '../../../dominio/modelos/resultado';
<<<<<<< HEAD
import { resultadoDePrueba } from '../../../../testing/datos';
import { RelojBrote } from '../../servicios/reloj-brote';
=======
import { parametrosDePrueba, resultadoDePrueba } from '../../../../testing/datos';
import { casosDeUso } from '../../../app.config';
import { SimuladorRepositorio } from '../../../dominio/puertos/simulador.repositorio';
>>>>>>> 3b7214a35809940ebc9019e81608a4e1e94093ae
import { Informe } from './informe';

describe('Informe para el alcalde', () => {
  async function renderizar(veredicto: Partial<Veredicto>) {
    const simulador: SimuladorRepositorio = {
      parametros: () => Promise.resolve(parametrosDePrueba),
      simular: () => Promise.reject(new Error('no se usa')),
      difusion: () => Promise.reject(new Error('no se usa')),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: SimuladorRepositorio, useValue: simulador }, ...casosDeUso],
    });
    const fixture = TestBed.createComponent(Informe);
    fixture.componentRef.setInput('resultado', {
      ...resultadoDePrueba,
      veredicto: { ...resultadoDePrueba.veredicto, ...veredicto },
    });
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('con una recomendación sólida dice cuánto gana y separa los empates', async () => {
    const texto = await renderizar({ nivel: 'solida', ganaAAzar: 0.975, empatesConAzar: 0.2 });
    expect(texto).toContain('Recomendación sólida');
    expect(texto).toContain('98 %');
    expect(texto).toContain('brotes en que hubo diferencia');
    expect(texto).toContain('En 20 % de los brotes todos los planes terminaron igual');
  });

  it('dice cuántas vacunas del plan fueron a personas ya mordidas sin saberlo', async () => {
    const texto = await renderizar({ nivel: 'solida' });
    expect(texto).toContain('Nunca se vacuna a un zombie detectado');
    expect(texto).toContain('De sus 1.000 vacunas, en promedio 0 fueron');
  });

  it('avisa cuando la recomendación ya incluye un corte de vacunas', async () => {
    const fixture = TestBed.createComponent(Informe);
    const { escenario } = resultadoDePrueba;
    fixture.componentRef.setInput('resultado', {
      ...resultadoDePrueba,
      escenario: {
        ...escenario,
        recursos: { ...escenario.recursos, corteDesde: 30, corteDias: 10 },
      },
    });
    await fixture.whenStable();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('no llegan vacunas del día 30 al 39');
  });

  it('sin recursos suficientes no presenta el plan como una victoria', async () => {
    const texto = await renderizar({ nivel: 'insuficiente', ganaAAzar: 0.14, salvadosVsAzar: -31 });
    expect(texto).toContain('Recursos insuficientes');
    expect(texto).toContain('Con estos recursos ningún plan cambia el resultado');
    expect(texto).toContain('adelantando el día de inicio');
    expect(texto).not.toContain('-31');
  });

<<<<<<< HEAD
  it('mientras avanza el brote dice cuánto lleva salvado el plan; al final, solo el total', async () => {
    const reloj = TestBed.inject(RelojBrote);
    reloj.total.set(3);
    reloj.irA(1);
    const fixture = TestBed.createComponent(Informe);
    fixture.componentRef.setInput('resultado', resultadoDePrueba);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.en-curso')?.textContent).toContain('Día 1 de 3');
    reloj.irA(3);
    await fixture.whenStable();
    expect(raiz.querySelector('.en-curso')).toBeNull();
=======
  it('si ningún plan gana ofrece calcular qué haría falta', async () => {
    const texto = await renderizar({ nivel: 'insuficiente' });
    expect(texto).toContain('¿Qué haría falta para ganar?');
>>>>>>> 3b7214a35809940ebc9019e81608a4e1e94093ae
  });
});
