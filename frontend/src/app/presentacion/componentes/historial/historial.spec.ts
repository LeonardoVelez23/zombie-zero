import { TestBed } from '@angular/core/testing';

import { ConfiguracionSimulacion } from '../../../dominio/modelos/escenario';
import { SimulacionGuardada } from '../../../dominio/modelos/resultado';
import { resultadoDePrueba } from '../../../../testing/datos';
import { informeHtml } from '../../utilidades/informe-descarga';
import { Historial } from './historial';

const esc = resultadoDePrueba.escenario;
const guardada: SimulacionGuardada = {
  id: 'abc',
  momento: '2026-10-28T21:40:00+00:00',
  semilla: 7,
  repeticiones: 50,
  inicio: 'mercado',
  nPersonas: esc.nPersonas,
  dias: esc.dias,
  casosIniciales: esc.casosIniciales,
  plaga: { ...esc.plaga, r0: 5 },
  recursos: esc.recursos,
  recomendado: 'anillo',
  nivel: 'solida',
  ganaAAzar: 0.9,
  salvadosVsNinguna: 4321,
  planes: [
    {
      id: 'anillo',
      nombre: 'Vacunación en anillo',
      tipo: 'candidato',
      costo: 5000,
      vacunas: 500,
      infectados: 300,
      infectadosP5: 10,
      infectadosP95: 900,
      salvados: 4321,
    },
  ],
};

describe('Resultados anteriores', () => {
  function renderizar(simulaciones: SimulacionGuardada[]) {
    const fixture = TestBed.createComponent(Historial);
    fixture.componentRef.setInput('simulaciones', simulaciones);
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  it('muestra la configuración usada y el resultado de cada simulación', () => {
    const { raiz } = renderizar([guardada]);
    const fila = raiz.querySelector('tbody tr')!.textContent!.replace(/\s+/g, ' ');
    expect(fila).toContain('Mercado · R0 5');
    expect(fila).toContain('semilla 7');
    expect(fila).toContain('Vacunación en anillo');
    expect(fila).toContain('4.321');
  });

  it('«Volver a simular» repite la misma configuración y semilla', () => {
    const { fixture, raiz } = renderizar([guardada]);
    const pedidas: ConfiguracionSimulacion[] = [];
    fixture.componentInstance.repetir.subscribe((c) => pedidas.push(c));
    raiz.querySelector<HTMLButtonElement>('.repetir')!.click();
    expect(pedidas).toEqual([
      {
        repeticiones: 50,
        escenario: {
          nPersonas: esc.nPersonas,
          dias: esc.dias,
          semilla: 7,
          inicio: 'mercado',
          casosIniciales: esc.casosIniciales,
          plaga: { ...esc.plaga, r0: 5 },
          recursos: esc.recursos,
        },
      },
    ]);
  });

  it('sin simulaciones guardadas lo dice', () => {
    const { raiz } = renderizar([]);
    expect(raiz.querySelector('.vacio')?.textContent).toContain('Todavía no hay simulaciones');
  });
});

describe('Informe en PDF', () => {
  it('trae la configuración, la recomendación, todos los planes y quién lo descargó', () => {
    const html = informeHtml(guardada, { operador: 'Jurado 3' });
    expect(html).toContain('<title>zombie-zero-20261028-2140-semilla7</title>');
    expect(html).toContain('Descargado por: <b>Jurado 3</b>');
    expect(html).toContain('Origen del brote: Mercado');
    expect(html).toContain('semilla 7');
    expect(html).toContain('R0 5');
    expect(html).toContain('<b>Plan recomendado:</b> Vacunación en anillo');
    expect(html).toContain('sólida · gana al reparto al azar en 90 %');
    expect(html).toContain('<td>Vacunación en anillo <b>(recomendado)</b></td>');
    expect(html).toContain('4.321');
  });

  it('incluye las gráficas y el texto para el alcalde, y escapa lo que escribe el usuario', () => {
    const html = informeHtml(guardada, {
      operador: '<script>x</script>',
      alcalde: 'Se recomienda vacunar en anillo.',
      graficas: [{ titulo: 'Curva de contagios', svg: '<svg viewBox="0 0 10 10"></svg>' }],
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('<div class="alcalde">Se recomienda vacunar en anillo.</div>');
    expect(html).toContain('<figcaption>Curva de contagios</figcaption>');
    expect(html).toContain('<svg viewBox="0 0 10 10"></svg>');
  });

  it('sin operador ni gráficas no deja secciones vacías', () => {
    const html = informeHtml(guardada);
    expect(html).not.toContain('Descargado por');
    expect(html).not.toContain('Gráficas');
    expect(html).not.toContain('Para el alcalde');
  });

  it('cada fila tiene su botón de PDF, que avisa al panel con la simulación', () => {
    const fixture = TestBed.createComponent(Historial);
    fixture.componentRef.setInput('simulaciones', [guardada]);
    fixture.detectChanges();
    let pedida: SimulacionGuardada | null = null;
    fixture.componentInstance.descargar.subscribe((s) => (pedida = s));
    const botones = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('tbody button'),
    ];
    expect(botones.map((b) => b.textContent?.trim())).toEqual([
      'Volver a simular',
      'Descargar PDF',
    ]);
    botones[1].click();
    expect(pedida).toBe(guardada);
  });
});
