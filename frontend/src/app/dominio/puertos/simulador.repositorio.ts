import {
  ConfiguracionDifusion,
  ConfiguracionSimulacion,
  Parametros,
} from '../modelos/escenario';
import {
  InformeIa,
  PeticionIa,
  ResultadoDifusion,
  ResultadoSimulacion,
  SimulacionGuardada,
} from '../modelos/resultado';

// Puerto hacia el motor de simulación. Clase abstracta para que sirva de token de inyección.
export abstract class SimuladorRepositorio {
  abstract parametros(): Promise<Parametros>;
  abstract simular(configuracion: ConfiguracionSimulacion): Promise<ResultadoSimulacion>;
  abstract difusion(configuracion: ConfiguracionDifusion): Promise<ResultadoDifusion>;
  // El asistente con IA. `alEscribir` recibe el texto acumulado a medida que la IA lo escribe.
  abstract asistente(
    peticion: PeticionIa,
    alEscribir?: (parcial: InformeIa) => void,
  ): Promise<InformeIa>;
  abstract historial(): Promise<SimulacionGuardada[]>;
}
