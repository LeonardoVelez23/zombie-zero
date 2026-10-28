export interface EstadoSalud {
  estado: string;
}

export interface PlagaParametros {
  r0: number;
  dias_latencia: number;
  dias_infeccioso: number;
  deteccion: number;
}

export interface RecursosParametros {
  presupuesto: number;
  costo_vacuna: number;
  vacunas_disponibles: number;
  vacunas_por_dia: number;
  dia_inicio: number;
  eficacia: number;
  dias_cierre: number;
  cumplimiento_cierre: number;
  costo_cierre_mercado: number;
  costo_cierre_colegio: number;
}

export interface EscenarioParametros {
  n_personas: number;
  dias: number;
  semilla: number;
  inicio: string;
  casos_iniciales: number;
  plaga: PlagaParametros;
  recursos: RecursosParametros;
}

export interface EdpParametros {
  d_sanos: number;
  d_zombies: number;
  alfa: number;
}

export type RangoLimite = [number, number];

export interface LimitesEscenario {
  n_personas: RangoLimite;
  dias: RangoLimite;
  semilla: RangoLimite;
  casos_iniciales: RangoLimite;
}

export interface LimitesPlaga {
  r0: RangoLimite;
  dias_latencia: RangoLimite;
  dias_infeccioso: RangoLimite;
  deteccion: RangoLimite;
}

export interface LimitesRecursos {
  presupuesto: RangoLimite;
  costo_vacuna: RangoLimite;
  vacunas_disponibles: RangoLimite;
  vacunas_por_dia: RangoLimite;
  dia_inicio: RangoLimite;
  eficacia: RangoLimite;
  dias_cierre: RangoLimite;
  cumplimiento_cierre: RangoLimite;
  costo_cierre_mercado: RangoLimite;
  costo_cierre_colegio: RangoLimite;
}

export interface LimitesEdp {
  d_sanos: RangoLimite;
  d_zombies: RangoLimite;
  alfa: RangoLimite;
}

export interface LimitesParametros {
  escenario: LimitesEscenario;
  plaga: LimitesPlaga;
  recursos: LimitesRecursos;
  edp: LimitesEdp;
}

export interface RepeticionesParametros {
  por_defecto: number;
  limites: RangoLimite;
}

export interface ParametrosRespuesta {
  por_defecto: EscenarioParametros;
  edp_por_defecto: EdpParametros;
  limites: LimitesParametros;
  inicios: string[];
  repeticiones: RepeticionesParametros;
}
