import { Parametros } from '../../dominio/modelos/escenario';
import { SimuladorRepositorio } from '../../dominio/puertos/simulador.repositorio';

// Valores por defecto y límites con los que la interfaz arma sus controles.
export class ObtenerParametros {
  constructor(private readonly simulador: SimuladorRepositorio) {}

  ejecutar(): Promise<Parametros> {
    return this.simulador.parametros();
  }
}
