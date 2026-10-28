import { Component, signal } from '@angular/core';

import { Bienvenida } from './presentacion/paginas/bienvenida/bienvenida';
import { Panel } from './presentacion/paginas/panel/panel';

// Primero la bienvenida; al pulsar "Activar centro de comando" se muestra el panel.
@Component({
  selector: 'app-root',
  imports: [Bienvenida, Panel],
  template: `
    @if (operador(); as nombre) {
      <app-panel [operador]="nombre" />
    } @else {
      <app-bienvenida (ingresar)="entrar($event)" />
    }
  `,
})
export class App {
  protected readonly operador = signal<string | null>(null);

  protected entrar(nombre: string): void {
    this.operador.set(nombre);
    window.scrollTo({ top: 0 });
  }
}
