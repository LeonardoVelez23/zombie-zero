import pytest

from zombie.api import atender
from zombie.calibracion import manta_2020, r_de_crecimiento, segunda_ola, semanas
from zombie.config import Plaga


def test_los_datos_de_manta_cubren_2020_y_el_acumulado_no_baja():
    datos = semanas()
    assert datos[0]["fin"].startswith("2020-03") and datos[-1]["fin"].startswith("2020-12")
    acumulados = [s["acumulado"] for s in datos]
    assert acumulados == sorted(acumulados)
    assert all(s["nuevos"] >= 0 for s in datos)


def test_la_segunda_ola_va_del_valle_de_agosto_al_pico_de_noviembre():
    inicio, fin = segunda_ola()
    nuevos = {s["semana"]: s["nuevos"] for s in semanas()}
    assert nuevos[inicio] == min(nuevos[k] for k in range(27, 41))
    assert nuevos[fin] == max(v for k, v in nuevos.items() if k >= inicio)
    assert inicio < fin


def test_r_de_crecimiento_coincide_con_el_seir():
    plaga = Plaga(dias_latencia=3, dias_infeccioso=5)
    assert r_de_crecimiento(0.0, plaga) == 1.0
    assert r_de_crecimiento(0.1, plaga) == pytest.approx(1.3 * 1.5)


def test_manta_crecio_con_un_r_efectivo_muy_por_debajo_del_r0_sin_medidas():
    cal = manta_2020()
    assert cal["r_diario"] > 0
    assert 1.0 < cal["r_efectivo"] < Plaga().r0
    assert cal["ic95"][0] <= cal["r_efectivo"] <= cal["ic95"][1]
    assert len(cal["ajuste"]) == cal["ventana"][1] - cal["ventana"][0] + 1


def test_la_api_envia_la_calibracion_con_los_parametros():
    codigo, cuerpo = atender("GET", "/api/parametros", None)
    assert codigo == 200
    assert cuerpo["calibracion"]["r_efectivo"] == manta_2020()["r_efectivo"]
