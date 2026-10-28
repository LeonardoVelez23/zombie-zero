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
