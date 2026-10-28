import { ConfiguracionDifusion } from '../../dominio/modelos/escenario';
import { ResultadoDifusion } from '../../dominio/modelos/resultado';
import { SimuladorRepositorio } from '../../dominio/puertos/simulador.repositorio';

// Modelo de contraste (EDP espacial): no decide la recomendación.
export class ModelarDifusion {
  constructor(private readonly simulador: SimuladorRepositorio) {}

  ejecutar(configuracion: ConfiguracionDifusion): Promise<ResultadoDifusion> {
    return this.simulador.difusion(configuracion);
  }
}
