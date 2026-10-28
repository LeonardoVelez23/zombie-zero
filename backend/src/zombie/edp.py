"""Modelo clásico de contraste: SEIR zombie con difusión espacial (EDP).

No reemplaza al modelo de red (modelo.py): sirve para compararlo con un modelo
continuo de la literatura. Resuelve en una cuadrícula sobre Manta un sistema SEIR
zombie con difusión espacial, en la línea de Munz et al. (2009):

    ∂S/∂t = D_S ∇²S − β S Z / N − v S
    ∂E/∂t = D_S ∇²E + β S Z / N − σ E
    ∂Z/∂t = D_Z ∇²Z + σ E − α S Z / N − γ Z
    ∂R/∂t = D_S ∇²R + γ Z + α S Z / N + v S

- N es la población local de la celda (contagio por frecuencia), así que β se
  calibra con el mismo R0 que la red: R0 = β / (γ + α).
- Los zombies eliminados por la población (α) pasan a R, como en Munz et al.,
  para que la población total se conserve.
- Los mordidos se ven sanos y se mueven como ellos (D_S); los zombies, con D_Z.
- La vacunación v(x, y, t) reparte las dosis del día en proporción a los zombies
  de cada celda ("vacunar por zonas"): la EDP no distingue personas, así que la
  dosis llega a todos los de la celda y solo protege a los sanos.
- Bordes sin flujo: nadie entra ni sale de la zona poblada.
Se integra con diferencias finitas y Euler explícito, con pasos que respetan la
estabilidad de la difusión (D·dt/dx² ≤ 0,2).
"""
import math
from dataclasses import asdict, dataclass

import numpy as np

from .config import Escenario
from .poblacion import BARRIOS, PESO_BARRIO

# Centro aproximado (lon, lat) de cada sector. "Rural" agrupa San Lorenzo y Santa Marianita.
UBICACION = {
    "Tarqui": (-80.7142, -0.9639),
    "Manta": (-80.7300, -0.9480),
    "Los Esteros": (-80.6914, -0.9623),
    "Eloy Alfaro": (-80.7080, -0.9790),
    "San Mateo": (-80.8112, -0.9595),
    "Rural": (-80.8650, -1.0350),
}
AEROPUERTO = (-80.6788, -0.9461)   # Aeropuerto Internacional Eloy Alfaro (aproximado)
DISPERSION_KM = {"Rural": 3.0}     # ancho de la mancha de población de cada sector
DISPERSION_URBANA_KM = 1.0
KM_POR_GRADO = 111.0
# Un fotograma del mapa por día, para animarlo día a día. Cada fotograma pesa ~22 KB en JSON y Lambda
# responde hasta 6 MB, así que en simulaciones de más de 180 días se guarda uno cada 2 o más días.
MAX_FOTOGRAMAS = 181


@dataclass(frozen=True)
class Difusion:
    """Parámetros propios de la EDP. Son supuestos ajustables (ver docs/supuestos.md)."""
    d_sanos: float = 0.1     # km²/día: movilidad neta de sanos, mordidos y exorcizados
    d_zombies: float = 0.05  # km²/día: los zombies se mueven más lento
    alfa: float = 0.02       # 1/día: zombies eliminados por la población


@dataclass(frozen=True)
class Malla:
    lon_min: float = -80.92
    lon_max: float = -80.64
    lat_min: float = -1.08
    lat_max: float = -0.92
    dx_km: float = 0.5

    @property
    def forma(self) -> tuple[int, int]:
        return (round((self.lat_max - self.lat_min) * KM_POR_GRADO / self.dx_km),
                round((self.lon_max - self.lon_min) * KM_POR_GRADO / self.dx_km))

    def celda(self, lon: float, lat: float) -> tuple[int, int]:
        """Fila y columna de un punto; la fila 0 es el borde norte."""
        return (int((self.lat_max - lat) * KM_POR_GRADO / self.dx_km),
                int((lon - self.lon_min) * KM_POR_GRADO / self.dx_km))

    def distancia_km(self, a: tuple[int, int], b: tuple[int, int]) -> float:
        return math.dist(a, b) * self.dx_km


def densidad(malla: Malla, n: int) -> np.ndarray:
    """Personas por celda: una mancha gaussiana por sector con su peso del Censo 2022."""
    filas, cols = malla.forma
    f, c = np.mgrid[0:filas, 0:cols]
    dens = np.zeros((filas, cols))
    for barrio, peso in zip(BARRIOS, PESO_BARRIO):
        fc, cc = malla.celda(*UBICACION[barrio])
        ancho = DISPERSION_KM.get(barrio, DISPERSION_URBANA_KM) / malla.dx_km
        mancha = np.exp(-((f - fc) ** 2 + (c - cc) ** 2) / (2 * ancho**2))
        dens += peso * mancha / mancha.sum()
    dens[dens < 1e-3 * dens.max()] = 0   # fuera de la zona poblada
    dens[[0, -1], :] = dens[:, [0, -1]] = 0
    return n * dens / dens.sum()


def _vecinos(poblada: np.ndarray) -> list:
    """Para cada dirección, las celdas pobladas cuyo vecino también lo está."""
    return [(d, poblada & np.roll(poblada, d, axis=(0, 1)))
            for d in ((1, 0), (-1, 0), (0, 1), (0, -1))]


def _laplaciano(u: np.ndarray, vecinos: list, dx: float) -> np.ndarray:
    lap = np.zeros_like(u)
    for d, ambos in vecinos:
        lap += ambos * (np.roll(u, d, axis=(0, 1)) - u)
    return lap / dx**2


def _caso_inicial(esc: Escenario, malla: Malla, n_celda: np.ndarray) -> np.ndarray:
    if esc.inicio == "aeropuerto":
        punto = AEROPUERTO
    elif esc.inicio == "mercado":
        punto = UBICACION["Tarqui"]   # Mercado Central
    else:
        punto = UBICACION.get(esc.inicio)
    if punto is None:   # aleatorio o colegio: repartidos según la población
        return esc.casos_iniciales * n_celda / n_celda.sum()
    caso = np.zeros_like(n_celda)
    caso[malla.celda(*punto)] = esc.casos_iniciales
    return caso


def _simular(esc: Escenario, dif: Difusion, malla: Malla, n_celda: np.ndarray, vacunar: bool) -> dict:
    plaga, rec = esc.plaga, esc.recursos
    sigma, gamma, alfa = 1 / plaga.dias_latencia, 1 / plaga.dias_infeccioso, dif.alfa
    beta = plaga.r0 * (gamma + alfa)
    vecinos = _vecinos(n_celda > 0)

    # Los casos iniciales salen de la población sana de toda la ciudad.
    S = n_celda * (1 - esc.casos_iniciales / n_celda.sum())
    caso = _caso_inicial(esc, malla, n_celda)
    E, Z, R = np.zeros_like(S), np.zeros_like(S), np.zeros_like(S)
    if esc.inicio == "aeropuerto":
        E += caso   # el equipo de rescate recién mordido
    else:
        Z += caso
    infectados = caso.sum()

    pasos = max(10, math.ceil(5 * max(dif.d_sanos, dif.d_zombies) / malla.dx_km**2))
    dt = 1 / pasos
    stock = min(rec.vacunas_disponibles, int(rec.presupuesto // rec.costo_vacuna))
    usadas = 0.0
    serie = np.zeros((esc.dias + 1, 4))
    fotogramas = []
    cada_dias = math.ceil(esc.dias / (MAX_FOTOGRAMAS - 1))

    def registrar(dia):
        serie[dia] = S.sum(), E.sum(), Z.sum(), R.sum()
        if dia % cada_dias == 0:
            fotogramas.append({"dia": dia, "zombies": Z.round(2).tolist()})

    registrar(0)
    for dia in range(1, esc.dias + 1):
        if vacunar and dia >= rec.dia_inicio and usadas < stock and Z.sum() > 1e-9:
            n_loc = S + E + Z + R
            reparto = np.minimum(min(rec.vacunas_por_dia, stock - usadas) * Z / Z.sum(), n_loc)
            protegidos = rec.eficacia * reparto * np.divide(S, n_loc, out=np.zeros_like(S), where=n_loc > 0)
            S -= protegidos
            R += protegidos
            usadas += reparto.sum()
        for _ in range(pasos):
            n_loc = S + E + Z + R
            sanos = np.divide(S, n_loc, out=np.zeros_like(S), where=n_loc > 0)
            mordidas, eliminados = beta * sanos * Z, alfa * sanos * Z
            dS = dif.d_sanos * _laplaciano(S, vecinos, malla.dx_km) - mordidas
            dE = dif.d_sanos * _laplaciano(E, vecinos, malla.dx_km) + mordidas - sigma * E
            dZ = dif.d_zombies * _laplaciano(Z, vecinos, malla.dx_km) + sigma * E - eliminados - gamma * Z
            dR = dif.d_sanos * _laplaciano(R, vecinos, malla.dx_km) + gamma * Z + eliminados
            S, E, Z, R = S + dt * dS, E + dt * dE, Z + dt * dZ, R + dt * dR
            infectados += dt * mordidas.sum()
        registrar(dia)

    zombies = serie[:, 2]
    return {
        "serie": {k: serie[:, i].round(2).tolist() for i, k in enumerate("SEZR")},
        "infectados_total": round(float(infectados), 1),
        "pico": round(float(zombies.max()), 1),
        "dia_pico": int(zombies.argmax()),
        "vacunas_usadas": round(usadas),
        "fotogramas": fotogramas,
    }


def resolver(esc: Escenario, dif: Difusion = Difusion(), malla: Malla = Malla()) -> dict:
    """Corre la EDP sin intervención y vacunando por zonas, con los parámetros del escenario."""
    n_celda = densidad(malla, esc.n_personas)
    gamma = 1 / esc.plaga.dias_infeccioso
    filas, cols = malla.forma
    return {
        "modelo": "edp",
        "parametros": {
            **asdict(dif),
            "beta": round(esc.plaga.r0 * (gamma + dif.alfa), 4),
            "sigma": round(1 / esc.plaga.dias_latencia, 4),
            "gamma": round(gamma, 4),
        },
        "malla": {**asdict(malla), "filas": filas, "columnas": cols},
        "aeropuerto": AEROPUERTO,
        "escenarios": [
            {"id": "ninguna", "nombre": "Sin intervención",
             **_simular(esc, dif, malla, n_celda, vacunar=False)},
            {"id": "vacunacion_zonal", "nombre": "Vacunar por zonas",
             **_simular(esc, dif, malla, n_celda, vacunar=True)},
        ],
    }
