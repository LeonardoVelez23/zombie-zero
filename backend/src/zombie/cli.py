"""Línea de comandos: corre la comparación y muestra la recomendación.

Ejemplos:
    python -m zombie.cli
    python -m zombie.cli --r0 5 --vacunas 500 --inicio mercado --semilla 7
    python -m zombie.cli --n-sims 200 --json > resultado.json

Brote Sorpresa (todo cambia por bandera, sin tocar el código):
    el doble de contagiosa        --r0 5
    la mitad de vacunas           --vacunas 500
    brote en el mercado           --inicio mercado
    vacuna que cubre a medias     --eficacia-vacuna 0.5
"""
import argparse
import json
import time
from dataclasses import replace

from .config import Escenario
from .montecarlo import comparar

N_SIMS_POR_DEFECTO = 1000   # lo que pide el reto; en la API es menor por el límite de 60 s de Lambda


def _argumentos() -> argparse.Namespace:
    base = Escenario()
    p, r = base.plaga, base.recursos
    a = argparse.ArgumentParser(description="Simulador de la plaga zombie en Manta")
    a.add_argument("--semilla", type=int, default=base.semilla)
    a.add_argument("--n-sims", "--repeticiones", dest="repeticiones", type=int, default=N_SIMS_POR_DEFECTO,
                   help=f"simulaciones Monte Carlo por plan (por defecto {N_SIMS_POR_DEFECTO})")
    a.add_argument("--personas", type=int, default=base.n_personas)
    a.add_argument("--dias", type=int, default=base.dias)
    a.add_argument("--inicio", default=base.inicio)
    a.add_argument("--casos", type=int, default=base.casos_iniciales)
    a.add_argument("--r0", type=float, default=p.r0)
    a.add_argument("--deteccion", type=float, default=p.deteccion)
    a.add_argument("--presupuesto", type=float, default=r.presupuesto)
    a.add_argument("--vacunas", type=int, default=r.vacunas_disponibles)
    a.add_argument("--por-dia", type=int, default=r.vacunas_por_dia)
    a.add_argument("--dia-inicio", type=int, default=r.dia_inicio)
    a.add_argument("--eficacia-vacuna", "--eficacia", dest="eficacia", type=float, default=r.eficacia,
                   help="fracción en que la vacuna reduce el riesgo de ser mordido (0 a 1)")
    a.add_argument("--json", action="store_true", help="imprime el resultado completo en JSON")
    return a.parse_args()


def main() -> None:
    a = _argumentos()
    base = Escenario()
    esc = replace(
        base,
        semilla=a.semilla, n_personas=a.personas, dias=a.dias,
        inicio=a.inicio, casos_iniciales=a.casos,
        plaga=replace(base.plaga, r0=a.r0, deteccion=a.deteccion),
        recursos=replace(base.recursos, presupuesto=a.presupuesto, vacunas_disponibles=a.vacunas,
                         vacunas_por_dia=a.por_dia, dia_inicio=a.dia_inicio, eficacia=a.eficacia),
    )
    inicio = time.perf_counter()
    res = comparar(esc, a.repeticiones)
    if a.json:
        print(json.dumps(res, ensure_ascii=False))
        return

    print(f"R0 {res['r0']} · beta {res['beta']} · {a.repeticiones} repeticiones · "
          f"semilla {a.semilla} · {time.perf_counter() - inicio:.1f} s\n")
    print("Infectados totales, pico de zombies y salvados frente a no intervenir: media / mediana (p5-p95)\n")
    print(f"{'plan':<30} {'vacunas':>7} {'costo':>7} {'infectados':>24} {'pico':>18} "
          f"{'salvados':>22} {'gana al azar':>12}")

    def rango(r: dict) -> str:
        return f"{r['media']:,.0f} / {r['mediana']:,.0f} ({r['p5']:,.0f}-{r['p95']:,.0f})"

    for d in res["planes"]:
        salvados = d.get("salvados_vs_ninguna")
        gana = d.get("gana_a_azar")
        print(f"{d['nombre']:<30} {d['vacunas']:>7} {d['costo']:>7,.0f} {rango(d['infectados']):>24} "
              f"{rango(d['pico']):>18} {rango(salvados) if salvados else '-':>22} "
              f"{f'{gana:.0%}' if gana is not None else '-':>12}")
    v = res["veredicto"]
    print(f"\nRecomendación: {res['recomendado']} · confianza {v['nivel']} "
          f"(gana al azar en {v['gana_a_azar']:.0%} de los brotes)")


if __name__ == "__main__":
    main()
