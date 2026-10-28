import { ConfiguracionSimulacion } from '../../dominio/modelos/escenario';
import { ResultadoSimulacion } from '../../dominio/modelos/resultado';
import { SimuladorRepositorio } from '../../dominio/puertos/simulador.repositorio';

// Compara todos los planes con el mismo presupuesto (Monte Carlo pareado).
export class SimularBrote {
  constructor(private readonly simulador: SimuladorRepositorio) {}

  ejecutar(configuracion: ConfiguracionSimulacion): Promise<ResultadoSimulacion> {
    return this.simulador.simular(configuracion);
  }
}
