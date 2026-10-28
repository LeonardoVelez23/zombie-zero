"""Calibración con datos reales: casos de COVID-19 en Manta durante 2020.

Fuente: casos positivos por cantón de los informes de situación de la SNGRE (Servicio Nacional de Gestión
de Riesgos y Emergencias), recopilados en el repositorio abierto ecuacovid
(https://github.com/andrab/ecuacovid, datos_crudos/positivas/2020/cantones.csv). En `datos/` se guardan
sumados por semana ISO; un acumulado que baja por una reclasificación se mantiene en su máximo.

Manta entró en cuarentena con su primer caso (17 de marzo de 2020), así que los datos no muestran un
brote libre y no sirven para estimar el R0: miden el R efectivo con medidas. Se ajusta el crecimiento
exponencial de la segunda ola, del valle entre olas al pico, y se convierte en R con la relación de un
SEIR (Wallinga y Lipsitch, Proc R Soc B 2007): R = (1 + r·latencia)(1 + r·días infeccioso).
"""
import csv
from functools import cache
from pathlib import Path

import numpy as np

from .config import Plaga

ARCHIVO = Path(__file__).parent / "datos" / "covid_manta_2020.csv"
FUENTE = "SNGRE, casos positivos por cantón (repositorio ecuacovid)"
URL_FUENTE = "https://github.com/andrab/ecuacovid"
VALLE_ENTRE_OLAS = (27, 40)   # semanas ISO en las que se busca el mínimo antes de la segunda ola


@cache
def semanas() -> tuple[dict, ...]:
    with open(ARCHIVO, encoding="utf-8") as f:
        return tuple({"semana": int(r["semana"]), "fin": r["fin"], "acumulado": int(r["acumulado"]),
                      "nuevos": int(r["nuevos"])} for r in csv.DictReader(f))


def segunda_ola(datos=None) -> tuple[int, int]:
    """Del mínimo de casos semanales en el valle entre olas al máximo posterior."""
    datos = datos or semanas()
    valle = [s for s in datos if VALLE_ENTRE_OLAS[0] <= s["semana"] <= VALLE_ENTRE_OLAS[1]]
    inicio = min(valle, key=lambda s: s["nuevos"])["semana"]
    fin = max((s for s in datos if s["semana"] >= inicio), key=lambda s: s["nuevos"])["semana"]
    return inicio, fin


def r_de_crecimiento(r: float, plaga: Plaga) -> float:
    return (1 + r * plaga.dias_latencia) * (1 + r * plaga.dias_infeccioso)


def manta_2020(plaga: Plaga | None = None) -> dict:
    """Tasa de crecimiento diaria, R efectivo con su IC 95 % y la curva ajustada sobre la ventana."""
    plaga = plaga or Plaga()
    datos = semanas()
    inicio, fin = segunda_ola(datos)
    ventana = [s for s in datos if inicio <= s["semana"] <= fin and s["nuevos"] > 0]
    x = np.array([s["semana"] for s in ventana], dtype=float)
    y = np.log([s["nuevos"] for s in ventana])
    pendiente, intercepto = np.polyfit(x, y, 1)
    residuos = y - (intercepto + pendiente * x)
    error = np.sqrt(residuos @ residuos / (len(x) - 2) / ((x - x.mean()) @ (x - x.mean())))
    r = pendiente / 7   # por semana → por día
    bajo, alto = (pendiente - 1.96 * error) / 7, (pendiente + 1.96 * error) / 7
    return {
        "fuente": FUENTE,
        "url_fuente": URL_FUENTE,
        "semanas": list(datos),
        "ventana": [inicio, fin],
        "ajuste": [round(float(np.exp(intercepto + pendiente * s)), 1) for s in range(inicio, fin + 1)],
        "r_diario": round(float(r), 4),
        "duplicacion_dias": round(float(np.log(2) / r), 1) if r > 0 else None,
        "r_efectivo": round(r_de_crecimiento(r, plaga), 2),
        "ic95": [round(r_de_crecimiento(bajo, plaga), 2), round(r_de_crecimiento(alto, plaga), 2)],
    }
