import { Difusion, Escenario } from './escenario';

// Media, mediana y rango p5–p95 entre las repeticiones Monte Carlo.
export interface Estadistico {
  media: number;
  mediana: number;
  p5: number;
  p95: number;
}

export interface Serie {
  media: number[];
  mediana: number[];
  p5: number[];
  p95: number[];
}

// 🟢 S sano · 🟡 E mordido (incubando) · 🔴 I zombie (contagia) · 🔵 R exorcizado (inmune).
export type EstadoSeir = 'S' | 'E' | 'I' | 'R';

export interface Plan {
  id: string;
  nombre: string;
  tipo: 'linea_base' | 'candidato';
  descripcion: string;
  vacunacion: string;
  cierres: string[];
  vacunas: number;
  costo: number;
  infectados: Estadistico;
  pico: Estadistico;
  diaPico: number;
  curvaZombies: Serie;
  // Personas en cada estado por día (media, mediana y p5–p95 entre repeticiones).
  // Opcional: las respuestas de versiones anteriores de la API no lo traen.
  estados?: Record<EstadoSeir, Serie>;
  mapa: number[][];
  vacunasPerdidas: number;
  salvadosVsNinguna?: Estadistico;
  salvadosVsAzar?: Estadistico;
  // Fracción de brotes que gana, contada solo entre los brotes en que hubo diferencia.
  ganaANinguna?: number;
  ganaAAzar?: number;
  // Fracción de brotes que terminan igual (por ejemplo, la plaga se apagó sola antes de actuar).
  empateConNinguna?: number;
  empateConAzar?: number;
}

export interface Veredicto {
  nivel: 'solida' | 'debil' | 'insuficiente';
  ganaAAzar: number;
  empatesConAzar?: number;
  salvadosVsNinguna: number;
  salvadosVsAzar: number;
}

export interface ResultadoSimulacion {
  escenario: Escenario;
  repeticiones: number;
  r0: number;
  beta: number;
  barrios: string[];
  poblacionBarrio: number[];
  recomendado: string;
  veredicto: Veredicto;
  planes: Plan[];
}

export interface Malla {
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
  dxKm: number;
  filas: number;
  columnas: number;
}

// Zombies por celda; la fila 0 es el borde norte y la columna 0 el oeste.
export interface Fotograma {
  dia: number;
  zombies: number[][];
}

export interface EscenarioDifusion {
  id: string;
  nombre: string;
  serie: { S: number[]; E: number[]; Z: number[]; R: number[] };
  infectadosTotal: number;
  pico: number;
  diaPico: number;
  vacunasUsadas: number;
  fotogramas: Fotograma[];
}

export interface ResultadoDifusion {
  parametros: Difusion & { beta: number; sigma: number; gamma: number };
  malla: Malla;
  aeropuerto: [number, number];
  escenarios: EscenarioDifusion[];
}
