import { SimulacionGuardada } from '../../dominio/modelos/resultado';
import { SimuladorRepositorio } from '../../dominio/puertos/simulador.repositorio';

// Últimas simulaciones guardadas (de cualquier usuario), con la configuración que se usó.
export class ObtenerHistorial {
  constructor(private readonly simulador: SimuladorRepositorio) {}

  ejecutar(): Promise<SimulacionGuardada[]> {
    return this.simulador.historial();
  }
}
