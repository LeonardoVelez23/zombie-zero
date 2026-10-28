import {
  ConfiguracionDifusion,
  ConfiguracionSimulacion,
  Parametros,
} from '../modelos/escenario';
import {
  InformeIa,
  ResultadoDifusion,
  ResultadoSimulacion,
  SimulacionGuardada,
} from '../modelos/resultado';

// Puerto hacia el motor de simulación. Clase abstracta para que sirva de token de inyección.
export abstract class SimuladorRepositorio {
  abstract parametros(): Promise<Parametros>;
  abstract simular(configuracion: ConfiguracionSimulacion): Promise<ResultadoSimulacion>;
  abstract difusion(configuracion: ConfiguracionDifusion): Promise<ResultadoDifusion>;
  abstract informe(resultado: ResultadoSimulacion): Promise<InformeIa>;
  abstract historial(): Promise<SimulacionGuardada[]>;
}
