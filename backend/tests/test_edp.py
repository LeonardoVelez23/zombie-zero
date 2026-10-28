from dataclasses import replace

import numpy as np
import pytest

from zombie.config import Escenario
from zombie.edp import AEROPUERTO, Difusion, Malla, resolver

ESC = Escenario(dias=120, inicio="aeropuerto")


@pytest.fixture(scope="module")
def res():
    return resolver(ESC)


def _escenario(res, id_):
    return next(e for e in res["escenarios"] if e["id"] == id_)


def test_la_poblacion_se_conserva(res):
    for esc in res["escenarios"]:
        totales = np.array([esc["serie"][k] for k in "SEZR"]).sum(axis=0)
        assert np.allclose(totales, ESC.n_personas, atol=0.05)  # la serie viene redondeada


def test_aeropuerto_empieza_con_mordidos(res):
    serie = _escenario(res, "ninguna")["serie"]
    assert serie["E"][0] == pytest.approx(ESC.casos_iniciales)
    assert serie["Z"][0] == 0


def test_la_mancha_sale_del_aeropuerto(res):
    malla = Malla()
    primero = np.array(_escenario(res, "ninguna")["fotogramas"][1]["zombies"])
    fila, col = np.unravel_index(primero.argmax(), primero.shape)
    assert malla.distancia_km((fila, col), malla.celda(*AEROPUERTO)) < 3


def test_vacunar_por_zonas_reduce_contagios_sin_pasarse_del_stock(res):
    nada, vacunas = _escenario(res, "ninguna"), _escenario(res, "vacunacion_zonal")
    assert vacunas["infectados_total"] < nada["infectados_total"]
    assert vacunas["vacunas_usadas"] <= ESC.recursos.vacunas_disponibles


def test_con_r0_bajo_el_brote_no_despega():
    bajo = replace(ESC, plaga=replace(ESC.plaga, r0=0.8))
    assert _escenario(resolver(bajo), "ninguna")["infectados_total"] < 50


def test_mas_movilidad_esparce_mas_la_plaga():
    def celdas_con_zombies(d):
        r = resolver(ESC, Difusion(d_sanos=d, d_zombies=d))
        dia_30 = next(f for f in _escenario(r, "ninguna")["fotogramas"] if f["dia"] == 30)
        return (np.array(dia_30["zombies"]) > 0.01).sum()
    assert celdas_con_zombies(1.0) > celdas_con_zombies(0.01)


def test_un_fotograma_por_dia(res):
    dias = [f["dia"] for f in _escenario(res, "ninguna")["fotogramas"]]
    assert dias == list(range(ESC.dias + 1))


def test_un_año_cabe_en_la_respuesta_de_lambda():
    import json
    largo = resolver(replace(ESC, dias=365))
    dias = [f["dia"] for f in _escenario(largo, "ninguna")["fotogramas"]]
    assert dias[:3] == [0, 3, 6]
    assert len(json.dumps(largo)) < 6 * 1024 * 1024
