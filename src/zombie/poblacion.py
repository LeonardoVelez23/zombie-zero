"""Red de contactos sintética de Manta.

Cada persona pertenece a un barrio y a un grupo de edad. Los contactos se
organizan en capas (hogar, colegio, trabajo, bus, mercado); cada capa tiene un
peso que escala la probabilidad de contagio por día de contacto.
Los números se justifican en docs/supuestos.md.
"""
from dataclasses import dataclass

import numpy as np

BARRIOS = ("Tarqui", "Manta", "Los Esteros", "Eloy Alfaro", "San Mateo", "Rural")
PESO_BARRIO = np.array([0.30, 0.25, 0.18, 0.15, 0.07, 0.05])

EDADES = ("menor", "escolar", "adulto", "mayor")   # 0-4, 5-17, 18-64, 65+
PESO_EDAD = np.array([0.08, 0.20, 0.63, 0.09])
MENOR, ESCOLAR, ADULTO, MAYOR = range(4)

CAPAS = ("hogar", "colegio", "trabajo", "bus", "mercado")
PESO_CAPA = np.array([1.0, 0.5, 0.4, 0.2, 0.15])
HOGAR, COLEGIO, TRABAJO, BUS, MERCADO = range(5)

TAM_HOGAR = 3.5          # personas por hogar en promedio
TAM_AULA = 30
TAM_TRABAJO = 8
FRAC_EMPLEO = 0.6        # adultos con trabajo fuera de casa
FRAC_BUS = 0.5           # escolares y adultos que usan bus a diario
CONTACTOS_BUS = 4
FRAC_MERCADO = 0.3       # adultos y mayores que van al Mercado Central
CONTACTOS_MERCADO = 6


@dataclass
class Red:
    n: int
    barrio: np.ndarray       # índice en BARRIOS
    edad: np.ndarray         # índice en EDADES
    va_mercado: np.ndarray   # bool
    origen: np.ndarray       # aristas dirigidas (cada contacto aparece en ambos sentidos),
    destino: np.ndarray      # ordenadas por origen
    peso: np.ndarray         # peso de la capa de cada arista
    capa: np.ndarray
    indptr: np.ndarray       # aristas de la persona i: indptr[i]:indptr[i+1]
    fuerza: np.ndarray       # suma de pesos de contacto de cada persona

    def aristas_de(self, personas: np.ndarray) -> np.ndarray:
        """Índices de todas las aristas que salen de `personas`."""
        inicios = self.indptr[personas]
        largos = self.indptr[personas + 1] - inicios
        total = int(largos.sum())
        if total == 0:
            return np.empty(0, dtype=np.int64)
        desplazamiento = np.repeat(inicios - np.cumsum(largos) + largos, largos)
        return desplazamiento + np.arange(total)


def _pares_en_grupos(grupos: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    """Todos los pares dentro de cada grupo (contacto de todos con todos)."""
    a, b = [], []
    for g in grupos:
        if len(g) < 2:
            continue
        i, j = np.triu_indices(len(g), 1)
        a.append(g[i])
        b.append(g[j])
    if not a:
        return np.empty(0, dtype=np.int64), np.empty(0, dtype=np.int64)
    return np.concatenate(a), np.concatenate(b)


def _partir(miembros: np.ndarray, tam: int, rng: np.random.Generator) -> list[np.ndarray]:
    miembros = rng.permutation(miembros)
    return [miembros[k:k + tam] for k in range(0, len(miembros), tam)]


def _hogares(miembros: np.ndarray, rng: np.random.Generator) -> list[np.ndarray]:
    miembros = rng.permutation(miembros)
    tams = 1 + rng.poisson(TAM_HOGAR - 1, size=len(miembros))
    cortes = np.cumsum(tams)
    return np.split(miembros, cortes[cortes < len(miembros)])


def _aleatorios(miembros: np.ndarray, k: int, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    """Cada miembro conoce a k miembros al azar del mismo grupo (bus, mercado)."""
    if len(miembros) < 2:
        return np.empty(0, dtype=np.int64), np.empty(0, dtype=np.int64)
    a = np.repeat(miembros, k)
    b = rng.choice(miembros, size=len(a))
    distintos = a != b
    return a[distintos], b[distintos]


def construir_red(n: int, semilla: int) -> Red:
    rng = np.random.default_rng(np.random.SeedSequence([semilla, 0xC17A]))
    barrio = rng.choice(len(BARRIOS), size=n, p=PESO_BARRIO)
    edad = rng.choice(len(EDADES), size=n, p=PESO_EDAD)
    todos = np.arange(n)

    pares = []  # (a, b, capa)

    def agregar(ab, capa):
        pares.append((ab[0], ab[1], np.full(len(ab[0]), capa)))

    for b in range(len(BARRIOS)):
        del_barrio = todos[barrio == b]
        agregar(_pares_en_grupos(_hogares(del_barrio, rng)), HOGAR)
        escolares = del_barrio[edad[del_barrio] == ESCOLAR]
        agregar(_pares_en_grupos(_partir(escolares, TAM_AULA, rng)), COLEGIO)
        en_bus = del_barrio[np.isin(edad[del_barrio], (ESCOLAR, ADULTO))]
        en_bus = en_bus[rng.random(len(en_bus)) < FRAC_BUS]
        agregar(_aleatorios(en_bus, CONTACTOS_BUS, rng), BUS)

    # El trabajo mezcla barrios: un grupo de trabajo puede tener gente de toda la ciudad.
    adultos = todos[edad == ADULTO]
    empleados = adultos[rng.random(len(adultos)) < FRAC_EMPLEO]
    agregar(_pares_en_grupos(_partir(empleados, TAM_TRABAJO, rng)), TRABAJO)

    clientes = todos[np.isin(edad, (ADULTO, MAYOR))]
    va_mercado = np.zeros(n, dtype=bool)
    va_mercado[clientes[rng.random(len(clientes)) < FRAC_MERCADO]] = True
    agregar(_aleatorios(todos[va_mercado], CONTACTOS_MERCADO, rng), MERCADO)

    a = np.concatenate([p[0] for p in pares])
    b = np.concatenate([p[1] for p in pares])
    capa = np.concatenate([p[2] for p in pares])

    origen = np.concatenate([a, b])
    destino = np.concatenate([b, a])
    capa = np.concatenate([capa, capa])
    orden = np.argsort(origen, kind="stable")
    origen, destino, capa = origen[orden], destino[orden], capa[orden]
    peso = PESO_CAPA[capa]

    indptr = np.zeros(n + 1, dtype=np.int64)
    np.cumsum(np.bincount(origen, minlength=n), out=indptr[1:])
    fuerza = np.bincount(origen, weights=peso, minlength=n)

    return Red(n=n, barrio=barrio, edad=edad, va_mercado=va_mercado,
               origen=origen, destino=destino, peso=peso, capa=capa,
               indptr=indptr, fuerza=fuerza)
