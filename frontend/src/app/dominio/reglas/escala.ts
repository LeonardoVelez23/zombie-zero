// La red simulada es una muestra de Manta: 271.145 habitantes según el Censo 2022 del INEC
// (docs/supuestos.md). Los resultados se leen como proporciones y se llevan a toda la ciudad.
export const POBLACION_MANTA = 271_145;

export const factorManta = (nPersonas: number): number => POBLACION_MANTA / Math.max(1, nPersonas);

// Redondeado a centenas: con una muestra no tiene sentido dar cifras al detalle.
export const enManta = (valor: number, nPersonas: number): number =>
  Math.round((valor * factorManta(nPersonas)) / 100) * 100;
