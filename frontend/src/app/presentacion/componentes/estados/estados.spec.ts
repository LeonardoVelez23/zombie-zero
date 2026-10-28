import { TestBed } from '@angular/core/testing';

import { resultadoDePrueba } from '../../../../testing/datos';
import { Estados } from './estados';

describe('Estados SEIR día a día', () => {
  async function renderizar() {
    const fixture = TestBed.createComponent(Estados);
    fixture.componentRef.setInput('resultado', resultadoDePrueba);
    await fixture.whenStable();
    return { fixture, panel: fixture.nativeElement as HTMLElement };
  }

  const contadores = (panel: HTMLElement) =>
    Array.from(panel.querySelectorAll('.contador strong')).map((e) => e.textContent?.trim());

  it('muestra los cuatro estados el día del pico sin intervención', async () => {
    const { panel } = await renderizar();
    const nombres = Array.from(panel.querySelectorAll('.contador .nombre')).map(
      (e) => e.textContent,
    );
    expect(nombres.join(' ')).toContain('Sanos (S)');
    expect(nombres.join(' ')).toContain('Mordidos (E)');
    expect(nombres.join(' ')).toContain('Zombies (I)');
    expect(nombres.join(' ')).toContain('Exorcizados (R)');
    // Datos de prueba: sin intervención el pico es el día 1 (recomendado: S 9.980 · E 10 · I 10 · R 0).
    expect(panel.textContent).toContain('Día 1 de 3');
    expect(contadores(panel)).toEqual(['9.980', '10', '10', '0']);
    // Por defecto, una línea por estado con su banda (como el gráfico "Populations" de NetLogo).
    expect(panel.querySelectorAll('path.linea-estado').length).toBe(4);
    expect(panel.querySelectorAll('path.banda-estado').length).toBe(4);
    expect(panel.querySelectorAll('path.capa').length).toBe(0);
    expect(panel.querySelector('path.linea-acumulado')).not.toBeNull();
  });

  it('el resumen suma a todos los que ya fueron mordidos (población − sanos)', async () => {
    const { panel } = await renderizar();
    // Día 1 del plan recomendado: 10.000 personas y 9.980 sanos.
    expect(panel.querySelector('.resumen')?.textContent).toContain(
      'en total ya fueron mordidas 20 personas',
    );
  });

  it('se puede cambiar a las áreas apiladas, con el eje en porcentaje', async () => {
    const { fixture, panel } = await renderizar();
    const botones = Array.from(panel.querySelectorAll<HTMLButtonElement>('.opcion'));
    botones.find((b) => b.textContent?.trim() === 'Áreas')!.click();
    await fixture.whenStable();
    expect(panel.querySelectorAll('path.capa').length).toBe(4);
    expect(panel.querySelectorAll('path.linea-estado').length).toBe(0);
    expect(panel.querySelector('.graficas .axis-labels')?.textContent).toContain('100 %');
  });

  it('cambia de día con el deslizador', async () => {
    const { fixture, panel } = await renderizar();
    const deslizador = panel.querySelector<HTMLInputElement>('.deslizador input')!;
    deslizador.value = '3';
    deslizador.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(contadores(panel)).toEqual(['9.968', '1', '1', '30']);
    expect(panel.querySelector('.resumen')?.textContent).toContain('El día 3');
  });

  it('si la API no trae estados avisa en lugar de fallar', async () => {
    const sinEstados = {
      ...resultadoDePrueba,
      planes: resultadoDePrueba.planes.map(({ estados: _omitido, ...plan }) => plan),
    };
    const fixture = TestBed.createComponent(Estados);
    fixture.componentRef.setInput('resultado', sinEstados);
    await fixture.whenStable();
    const panel = fixture.nativeElement as HTMLElement;
    expect(panel.textContent).toContain('La API no envió los estados');
    expect(panel.querySelectorAll('.contador').length).toBe(0);
  });

  it('sin resultado invita a simular', async () => {
    const fixture = TestBed.createComponent(Estados);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Ejecuta una simulación');
  });
});
