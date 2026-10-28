export type Rango = [number, number];

export interface Plaga {
  r0: number;
  diasLatencia: number;
  diasInfeccioso: number;
  deteccion: number;
}

export interface Recursos {
  presupuesto: number;
  costoVacuna: number;
  vacunasDisponibles: number;
  vacunasPorDia: number;
  diaInicio: number;
  // Imprevisto: no llegan vacunas desde `corteDesde` durante `corteDias` días (0 = sin corte).
  corteDesde: number;
  corteDias: number;
  eficacia: number;
  diasCierre: number;
  cumplimientoCierre: number;
  costoCierreMercado: number;
  costoCierreColegio: number;
}

export interface Escenario {
  nPersonas: number;
  dias: number;
  semilla: number;
  inicio: string;
  casosIniciales: number;
  plaga: Plaga;
  recursos: Recursos;
}

// Parámetros propios del modelo de difusión espacial (EDP).
export interface Difusion {
  dSanos: number;
  dZombies: number;
  alfa: number;
}

// Casos reales de COVID-19 en Manta (2020) y el R efectivo que se ajusta con ellos (ver docs/supuestos.md).
export interface SemanaCasos {
  semana: number;
  fin: string;
  acumulado: number;
  nuevos: number;
}

export interface Calibracion {
  fuente: string;
  urlFuente: string;
  semanas: SemanaCasos[];
  ventana: [number, number];
  ajuste: number[];
  rDiario: number;
  duplicacionDias: number | null;
  rEfectivo: number;
  ic95: [number, number];
}

export interface Parametros {
  porDefecto: Escenario;
  edpPorDefecto: Difusion;
  limites: {
    escenario: Record<string, Rango>;
    plaga: Record<string, Rango>;
    recursos: Record<string, Rango>;
    edp: Record<string, Rango>;
  };
  inicios: string[];
  repeticiones: { porDefecto: number; limites: Rango };
  calibracion?: Calibracion;
}

// Lo que no se indica toma el valor por defecto del simulador.
export type EscenarioParcial = Partial<Omit<Escenario, 'plaga' | 'recursos'>> & {
  plaga?: Partial<Plaga>;
  recursos?: Partial<Recursos>;
};

export interface ConfiguracionSimulacion {
  repeticiones?: number;
  escenario?: EscenarioParcial;
}

export interface ConfiguracionDifusion {
  escenario?: EscenarioParcial;
  edp?: Partial<Difusion>;
}
