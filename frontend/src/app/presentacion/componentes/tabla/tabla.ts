import { Component, input } from '@angular/core';

import { ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { numero, porcentaje } from '../../utilidades/formato';

@Component({
  selector: 'app-tabla',
  templateUrl: './tabla.html',
  styleUrl: './tabla.css',
  host: { class: 'panel', id: 'estrategias' },
})
export class Tabla {
  readonly resultado = input<ResultadoSimulacion | null>(null);

  protected readonly numero = numero;
  protected readonly porcentaje = porcentaje;
}
