from dataclasses import replace

import numpy as np
import pytest

from zombie.config import Escenario
from zombie.estrategias import Estrategia, crear
from zombie.modelo import E, I, calibrar_beta, casos_iniciales, estimar_r0, simular
from zombie.montecarlo import _veredicto, comparar
from zombie.poblacion import TRABAJO, construir_red

ESC = Escenario(n_personas=3000, dias=120)


@pytest.fixture(scope="module")
def red():
    return construir_red(ESC.n_personas, ESC.semilla)


@pytest.fixture(scope="module")
def beta(red):
    return calibrar_beta(red, ESC.plaga)


def test_red_simetrica_y_sin_lazos(red):
    assert (red.origen != red.destino).all()
    ida = set(zip(red.origen.tolist(), red.destino.tolist()))
    assert all((b, a) in ida for a, b in ida)


def test_aristas_de_coincide_con_busqueda_directa(red):
    personas = np.array([0, 5, 17])
    esperado = np.flatnonzero(np.isin(red.origen, personas))
    assert np.array_equal(np.sort(red.aristas_de(personas)), esperado)


def test_calibracion_da_el_r0_pedido(red, beta):
    assert estimar_r0(red, beta, ESC.plaga) == pytest.approx(ESC.plaga.r0, rel=1e-3)


def test_misma_semilla_mismo_resultado(red, beta):
    a = simular(red, ESC, crear("anillo", red), beta, 3)
    b = simular(construir_red(ESC.n_personas, ESC.semilla), ESC, crear("anillo", red), beta, 3)
    assert np.array_equal(a.serie, b.serie)


def test_otra_semilla_otro_resultado(red, beta):
    a = simular(red, ESC, crear("ninguna", red), beta, 0)
    b = simular(red, ESC, crear("ninguna", red), beta, 1)
    assert not np.array_equal(a.serie, b.serie)


def test_la_poblacion_se_conserva(red, beta):
    res = simular(red, ESC, crear("azar", red), beta, 0)
    assert (res.serie.sum(axis=1) == red.n).all()


@pytest.mark.parametrize("nombre", ["azar", "centralidad", "anillo"])
def test_respeta_el_limite_de_vacunas(red, beta, nombre):
    res = simular(red, ESC, crear(nombre, red), beta, 0)
    assert res.vacunas_usadas <= ESC.recursos.vacunas_disponibles


class VacunaZombies(Estrategia):
    def elegir(self, obs, dosis, rng):
        return obs.zombies[:dosis]


def test_prohibido_vacunar_zombies(red, beta):
    with pytest.raises(ValueError, match="zombie"):
        simular(red, ESC, VacunaZombies(), beta, 0)


class AnotaDias(Estrategia):
    """Anillo que anota en qué días le tocó decidir."""

    def __init__(self, red):
        self.anillo, self.dias = crear("anillo", red), []

    def elegir(self, obs, dosis, rng):
        self.dias.append(obs.dia)
        return self.anillo.elegir(obs, dosis, rng)


def test_durante_el_corte_no_llegan_vacunas(red, beta):
    corte = replace(ESC, inicio="aleatorio", casos_iniciales=30, plaga=replace(ESC.plaga, r0=4.0),
                    recursos=replace(ESC.recursos, dia_inicio=10, vacunas_por_dia=5,
                                     corte_desde=15, corte_dias=20))
    estrategia = AnotaDias(red)
    simular(red, corte, estrategia, beta, 0)
    assert estrategia.dias[0] == 10
    assert not any(15 <= d < 35 for d in estrategia.dias)
    assert 35 in estrategia.dias  # al reanudarse vuelve a decidir con el brote de ese día


def test_un_corte_de_vacunas_no_ayuda(red, beta):
    corte = replace(ESC, recursos=replace(ESC.recursos, corte_desde=ESC.recursos.dia_inicio,
                                          corte_dias=30))
    anillo = crear("anillo", red)
    normal = np.mean([simular(red, ESC, anillo, beta, r).infectados_total for r in range(10)])
    cortado = np.mean([simular(red, corte, anillo, beta, r).infectados_total for r in range(10)])
    assert cortado >= normal


def test_estrategia_supera_lineas_base():
    res = comparar(ESC, repeticiones=30)
    inf = {d["id"]: d["infectados"]["media"] for d in res["planes"]}
    assert inf[res["recomendado"]] < inf["azar"] < inf["ninguna"]
    assert res["veredicto"]["nivel"] == "solida"


def test_los_empates_no_cuentan_como_derrotas():
    # Sin vacunas ni dinero para cierres, todos los planes son "no hacer nada": empatan siempre.
    sin_recursos = replace(ESC, recursos=replace(ESC.recursos, vacunas_disponibles=0, presupuesto=0))
    res = comparar(sin_recursos, repeticiones=5)
    v = res["veredicto"]
    assert v["empates_con_azar"] == 1.0
    assert v["gana_a_azar"] == 0.0
    assert v["nivel"] == "insuficiente"


def test_no_es_solida_si_en_promedio_no_supera_al_azar():
    mejor = {"gana_a_azar": 0.9, "empate_con_azar": 0.0,
             "salvados_vs_ninguna": {"media": 300.0}, "salvados_vs_azar": {"media": -20.0}}
    assert _veredicto(mejor)["nivel"] == "insuficiente"


def test_ningun_plan_se_pasa_del_presupuesto():
    res = comparar(ESC, repeticiones=2)
    for d in res["planes"]:
        assert d["costo"] <= ESC.recursos.presupuesto
        assert d["vacunas"] <= ESC.recursos.vacunas_disponibles


def test_azar_y_estrategia_usan_las_mismas_vacunas():
    res = comparar(ESC, repeticiones=2)
    vacunas = {d["id"]: d["vacunas"] for d in res["planes"]}
    assert vacunas["azar"] == vacunas["anillo"] == vacunas["centralidad"]


def test_sin_deteccion_el_anillo_no_ve_zombies(red, beta):
    ciego = replace(ESC, plaga=replace(ESC.plaga, deteccion=0.0))
    anillo = simular(red, ciego, crear("anillo", red), beta, 0)
    centralidad = simular(red, ciego, crear("centralidad", red), beta, 0)
    assert np.array_equal(anillo.serie, centralidad.serie)


def test_cerrar_todo_por_completo_frena_el_contagio(red, beta):
    estricto = replace(ESC, recursos=replace(ESC.recursos, cumplimiento_cierre=1.0, dias_cierre=200))
    nada = crear("ninguna", red)
    abiertos = np.mean([simular(red, estricto, nada, beta, r).infectados_total for r in range(10)])
    cerrados = np.mean([simular(red, estricto, nada, beta, r, ("mercado", "colegio")).infectados_total
                        for r in range(10)])
    assert cerrados < abiertos


def test_aeropuerto_muerde_a_un_equipo_de_rescate(red):
    aeropuerto = replace(ESC, inicio="aeropuerto", casos_iniciales=5)
    equipo = casos_iniciales(red, aeropuerto, np.random.default_rng(0))
    assert len(equipo) == 5
    # Todos se conocen del trabajo: son el mismo equipo.
    trabajo = set(zip(red.origen[red.capa == TRABAJO].tolist(), red.destino[red.capa == TRABAJO].tolist()))
    assert all((a, b) in trabajo for a in equipo for b in equipo if a != b)


def test_aeropuerto_empieza_con_mordidos_sin_detectar(red, beta):
    aeropuerto = replace(ESC, inicio="aeropuerto", casos_iniciales=5)
    res = simular(red, aeropuerto, crear("anillo", red), beta, 0)
    assert res.serie[0, E] == 5 and res.serie[0, I] == 0


def test_brote_sorpresa_cambia_parametros():
    sorpresa = replace(ESC, inicio="mercado",
                       plaga=replace(ESC.plaga, r0=5.0),
                       recursos=replace(ESC.recursos, vacunas_disponibles=150, eficacia=0.5))
    res = comparar(sorpresa, repeticiones=10)
    assert res["r0"] == pytest.approx(5.0, rel=1e-2)
    assert res["veredicto"]["nivel"] in ("solida", "debil", "insuficiente")


def test_el_lote_da_lo_mismo_que_cada_repeticion_sola(red, beta):
    """Vectorizar no cambia el resultado: la repetición r es la misma sola o dentro de un lote."""
    from zombie.modelo import simular_lote
    lote = simular_lote(red, ESC, crear("anillo", red), beta, [5, 2, 9])
    for k, r in enumerate([5, 2, 9]):
        sola = simular(red, ESC, crear("anillo", red), beta, r)
        assert np.array_equal(lote.serie[k], sola.serie)
        assert lote.vacunas_usadas[k] == sola.vacunas_usadas


def test_la_poblacion_se_conserva_en_el_lote(red, beta):
    from zombie.modelo import simular_lote
    lote = simular_lote(red, ESC, crear("azar", red), beta, range(20))
    assert (lote.serie.sum(axis=2) == red.n).all()


def test_monte_carlo_reporta_media_mediana_y_rango():
    res = comparar(ESC, repeticiones=10)
    for d in res["planes"]:
        for clave in ("infectados", "pico"):
            r = d[clave]
            assert r["p5"] <= r["mediana"] <= r["p95"]
            assert r["p5"] <= r["media"] <= r["p95"]
        if "salvados_vs_ninguna" in d:
            assert "mediana" in d["salvados_vs_ninguna"]


def test_misma_semilla_mismo_monte_carlo():
    a = comparar(ESC, repeticiones=8)
    b = comparar(ESC, repeticiones=8)
    assert a == b


def test_reporta_los_cuatro_estados_dia_a_dia():
    """La API muestra S, E, I, R cada día: la media de los cuatro suma la población."""
    res = comparar(ESC, repeticiones=6)
    for d in res["planes"]:
        estados = d["estados"]
        assert set(estados) == {"S", "E", "I", "R"}
        for serie in estados.values():
            assert len(serie["media"]) == ESC.dias + 1
            assert all(a <= b <= c for a, b, c in zip(serie["p5"], serie["media"], serie["p95"]))
        suma = np.sum([estados[k]["media"] for k in "SEIR"], axis=0)
        assert np.allclose(suma, ESC.n_personas, atol=0.5)
        assert estados["I"]["media"] == d["curva_zombies"]["media"]
        # Día 0: el brote empieza con los casos iniciales y nadie exorcizado.
        assert estados["R"]["media"][0] == 0
        assert estados["E"]["media"][0] + estados["I"]["media"][0] == ESC.casos_iniciales


def test_en_paralelo_da_lo_mismo_que_en_serie(monkeypatch):
    import multiprocessing.context

    iniciados = []
    original = multiprocessing.context.ForkProcess.start

    def contar(proceso):
        iniciados.append(proceso)
        original(proceso)

    monkeypatch.setattr(multiprocessing.context.ForkProcess, "start", contar)
    serie = comparar(ESC, repeticiones=10, procesos=1)
    assert iniciados == []          # con un proceso no se crea ningún trabajador
    paralelo = comparar(ESC, repeticiones=10, procesos=4)
    assert len(iniciados) == 4      # la ruta en paralelo sí se ejecutó
    assert paralelo == serie
