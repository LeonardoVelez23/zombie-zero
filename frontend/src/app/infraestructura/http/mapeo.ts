// La API habla en snake_case (Python); el dominio, en camelCase.

export const aCamel = (clave: string): string =>
  clave.replace(/_([a-z0-9])/g, (_, letra: string) => letra.toUpperCase());

export const aSnake = (clave: string): string =>
  clave.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);

// Renombra las claves de todos los objetos anidados; los valores y los arreglos no cambian.
export function renombrarClaves(valor: unknown, renombrar: (clave: string) => string): unknown {
  if (Array.isArray(valor)) return valor.map((v) => renombrarClaves(v, renombrar));
  if (valor === null || typeof valor !== 'object') return valor;
  return Object.fromEntries(
    Object.entries(valor).map(([clave, v]) => [renombrar(clave), renombrarClaves(v, renombrar)]),
  );
}
