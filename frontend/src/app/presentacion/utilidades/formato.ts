const entero = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 0 });
const compacto = new Intl.NumberFormat('es-EC', { notation: 'compact', maximumFractionDigits: 1 });

export const numero = (valor: number): string => entero.format(valor);

export const numeroCorto = (valor: number): string => compacto.format(valor);

export const porcentaje = (fraccion: number): string => `${Math.round(fraccion * 100)} %`;

export const capitalizar = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1);
