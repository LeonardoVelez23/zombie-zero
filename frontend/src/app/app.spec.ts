import { TestBed } from '@angular/core/testing';

import { App } from './app';
import { casosDeUso } from './app.config';
import { SimuladorRepositorio } from './dominio/puertos/simulador.repositorio';
import { parametrosDePrueba, resultadoDePrueba } from '../testing/datos';

// Motor falso: el panel pide los parámetros al arrancar.
class SimuladorFalso extends SimuladorRepositorio {
  parametros = async () => parametrosDePrueba;
  simular = async () => resultadoDePrueba;
  informe = async () => {
    throw new Error('no se usa en esta prueba');
  };
  difusion = async () => {
    throw new Error('no se usa en esta prueba');
  };
}

describe('Entrada a la aplicación', () => {
  async function renderizar() {
    TestBed.configureTestingModule({
      providers: [{ provide: SimuladorRepositorio, useClass: SimuladorFalso }, ...casosDeUso],
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  it('muestra primero la bienvenida con sus imágenes', async () => {
    const { raiz } = await renderizar();
    expect(raiz.querySelector('app-bienvenida')).not.toBeNull();
    expect(raiz.querySelector('app-panel')).toBeNull();
    const fuentes = [...raiz.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(fuentes).toEqual(['spooky_hacker.jpg', 'logo.png', 'espam_logo.jpg']);
  });

  it('el botón de ingreso lleva al panel con el nombre del operador', async () => {
    const { fixture, raiz } = await renderizar();
    raiz.querySelector<HTMLButtonElement>('.btn-spooky-orange')!.click();
    await fixture.whenStable();
    expect(raiz.querySelector('app-bienvenida')).toBeNull();
    expect(raiz.querySelector('app-panel')).not.toBeNull();
    const avatar = raiz.querySelector('.avatar')!;
    expect(avatar.textContent?.trim()).toBe('CC');
    expect(avatar.getAttribute('title')).toBe('Comité de Contención Manta');
  });

  it('la identificación no es obligatoria para entrar', async () => {
    const { fixture, raiz } = await renderizar();
    const campo = raiz.querySelector<HTMLInputElement>('#operador')!;
    campo.value = '   ';
    campo.dispatchEvent(new Event('input'));
    raiz.querySelector<HTMLButtonElement>('.btn-spooky-orange')!.click();
    await fixture.whenStable();
    expect(raiz.querySelector('app-panel')).not.toBeNull();
    expect(raiz.querySelector('.avatar')?.getAttribute('title')).toBe('Comité de Emergencia');
  });
});
