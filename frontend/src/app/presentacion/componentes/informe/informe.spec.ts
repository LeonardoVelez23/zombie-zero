import { TestBed } from '@angular/core/testing';

import { Veredicto } from '../../../dominio/modelos/resultado';
import { resultadoDePrueba } from '../../../../testing/datos';
import { Informe } from './informe';

describe('Informe para el alcalde', () => {
  async function renderizar(veredicto: Partial<Veredicto>) {
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

  it('sin recursos suficientes no presenta el plan como una victoria', async () => {
    const texto = await renderizar({ nivel: 'insuficiente', ganaAAzar: 0.14, salvadosVsAzar: -31 });
    expect(texto).toContain('Recursos insuficientes');
    expect(texto).toContain('Con estos recursos ningún plan cambia el resultado');
    expect(texto).toContain('adelantando el día de inicio');
    expect(texto).not.toContain('-31');
  });
});
