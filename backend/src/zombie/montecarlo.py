"""Monte Carlo: muchas repeticiones por plan, con promedios y rangos.

Un plan combina una estrategia de vacunación con cierres de lugares, y debe caber
en el presupuesto: lo que no se gasta en cierres se gasta en vacunas.

La repetición r usa la misma semilla para todos los planes, así que la diferencia
entre dos planes en la repetición r se debe solo al plan (comparación pareada).
El resultado es un dict listo para serializar a JSON.
"""
from dataclasses import dataclass
from itertools import combinations

import numpy as np

from .config import Escenario, Recursos
from .estrategias import CANDIDATAS, ESTRATEGIAS, crear
from .modelo import CERRABLES, E, I, R, S, calibrar_beta, estimar_r0, simular_lote
from .poblacion import BARRIOS, construir_red


@dataclass(frozen=True)
class Plan:
    vacunacion: str
    cierres: tuple[str, ...] = ()

    @property
    def id(self) -> str:
        return "+".join((self.vacunacion, *self.cierres))

    @property
    def nombre(self) -> str:
        if not self.cierres:
            return self.vacunacion
        return f"{self.vacunacion} + cerrar {' y '.join(self.cierres)}"

    def costo_cierres(self, rec: Recursos) -> float:
        por_dia = {"mercado": rec.costo_cierre_mercado, "colegio": rec.costo_cierre_colegio}
        return sum(por_dia[lugar] * rec.dias_cierre for lugar in self.cierres)

    def vacunas(self, rec: Recursos) -> int:
        """Lo que sobra del presupuesto tras los cierres se gasta en vacunas, hasta agotar el stock."""
        if self.vacunacion == "ninguna":
            return 0
        alcanza = int((rec.presupuesto - self.costo_cierres(rec)) // rec.costo_vacuna)
        return max(0, min(rec.vacunas_disponibles, alcanza))

    def costo(self, rec: Recursos) -> float:
        return self.costo_cierres(rec) + self.vacunas(rec) * rec.costo_vacuna


LINEAS_BASE = (Plan("ninguna"), Plan("azar"))


def planes_candidatos(rec: Recursos) -> list[Plan]:
    """Toda estrategia de vacunación propia, sola o con cada combinación de cierres que quepa."""
    planes = []
    for k in range(len(CERRABLES) + 1):
        for cierres in combinations(CERRABLES, k):
            for vacunacion in CANDIDATAS:
                plan = Plan(vacunacion, cierres)
                if plan.costo_cierres(rec) <= rec.presupuesto:
                    planes.append(plan)
    return planes


# Los cuatro estados del modelo, en el orden de modelo.S, E, I, R:
# 🟢 S sano · 🟡 E mordido (incubando) · 🔴 I zombie (contagia) · 🔵 R exorcizado (inmune).
ESTADOS = {"S": S, "E": E, "I": I, "R": R}

# Repeticiones que se simulan juntas en un lote (acota la memoria: ~40 MB por lote de 10.000 personas).
TAM_LOTE = 250


def _rango(valores: np.ndarray, eje=0) -> dict:
    return {
        "media": np.mean(valores, axis=eje).round(1).tolist(),
        "mediana": np.median(valores, axis=eje).round(1).tolist(),
        "p5": np.percentile(valores, 5, axis=eje).round(1).tolist(),
        "p95": np.percentile(valores, 95, axis=eje).round(1).tolist(),
    }


def comparar(esc: Escenario, repeticiones: int = 100, planes: list[Plan] | None = None) -> dict:
    rec = esc.recursos
    red = construir_red(esc.n_personas, esc.semilla)
    beta = calibrar_beta(red, esc.plaga)
    planes = planes if planes is not None else [*LINEAS_BASE, *planes_candidatos(rec)]

    totales = {}
    resumen = []
    for plan in planes:
        estrategia = crear(plan.vacunacion, red)
        vacunas = plan.vacunas(rec)
        tot = np.zeros(repeticiones)
        curvas = np.zeros((repeticiones, esc.dias + 1))
        series = np.zeros((repeticiones, esc.dias + 1, 4))   # personas en S, E, I, R cada día
        mapa = np.zeros((esc.dias + 1, len(BARRIOS)))
        perdidas = np.zeros(repeticiones)
        for desde in range(0, repeticiones, TAM_LOTE):
            hasta = min(desde + TAM_LOTE, repeticiones)
            lote = simular_lote(red, esc, estrategia, beta, range(desde, hasta), plan.cierres, vacunas)
            tot[desde:hasta] = lote.infectados_total
            curvas[desde:hasta] = lote.serie[:, :, I]
            series[desde:hasta] = lote.serie
            mapa += lote.serie_barrio.sum(axis=0)
            perdidas[desde:hasta] = lote.vacunas_perdidas
        totales[plan.id] = tot
        resumen.append({
            "id": plan.id,
            "nombre": plan.nombre,
            "tipo": "linea_base" if plan in LINEAS_BASE else "candidato",
            "descripcion": ESTRATEGIAS[plan.vacunacion].descripcion,
            "vacunacion": plan.vacunacion,
            "cierres": list(plan.cierres),
            "vacunas": vacunas,
            "costo": plan.costo(rec),
            "infectados": _rango(tot),
            "curva_zombies": _rango(curvas),
            "estados": {nombre: _rango(series[:, :, k]) for nombre, k in ESTADOS.items()},
            "pico": _rango(curvas.max(axis=1)),
            "dia_pico": float(curvas.argmax(axis=1).mean().round(1)),
            "vacunas_perdidas": float(perdidas.mean().round(1)),
            "mapa": (mapa / repeticiones).round(2).tolist(),
        })

    for datos in resumen:
        for base in LINEAS_BASE:
            if base.id in totales and base.id != datos["id"]:
                salvados = totales[base.id] - totales[datos["id"]]
                datos[f"salvados_vs_{base.id}"] = _rango(salvados)
                datos[f"gana_a_{base.id}"] = float((salvados > 0).mean())

    candidatos = [d for d in resumen if d["tipo"] == "candidato"]
    mejor = min(candidatos, key=lambda d: d["infectados"]["media"]) if candidatos else None
    return {
        "escenario": esc.a_dict(),
        "repeticiones": repeticiones,
        "beta": round(beta, 5),
        "r0": round(estimar_r0(red, beta, esc.plaga), 3),
        "barrios": list(BARRIOS),
        "poblacion_barrio": np.bincount(red.barrio, minlength=len(BARRIOS)).tolist(),
        "planes": resumen,
        "recomendado": mejor["id"] if mejor else None,
        "veredicto": _veredicto(mejor),
    }


def _veredicto(mejor: dict | None) -> dict | None:
    """Qué tan confiable es la recomendación frente a repartir lo mismo al azar.

    "solida": gana al azar en al menos 80 % de los brotes simulados.
    "debil": gana más veces de las que pierde, pero no siempre.
    "insuficiente": con estos recursos ningún plan cambia el resultado de forma consistente.
    """
    if mejor is None:
        return None
    gana = mejor.get("gana_a_azar", 0.0)
    nivel = "solida" if gana >= 0.8 else "debil" if gana > 0.5 else "insuficiente"
    return {
        "nivel": nivel,
        "gana_a_azar": gana,
        "salvados_vs_ninguna": mejor["salvados_vs_ninguna"]["media"],
        "salvados_vs_azar": mejor["salvados_vs_azar"]["media"],
    }
