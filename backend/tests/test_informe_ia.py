import json

import pytest

from zombie import informe_ia
from zombie.api import atender
from zombie.informe_ia import ResumenInvalido, redactar, resumir

RESULTADO = {
    "escenario": {"n_personas": 5000},
    "repeticiones": 100,
    "recomendado": "centralidad",
    "veredicto": {"nivel": "solida", "gana_a_azar": 0.9, "empates_con_azar": 0.1,
                  "salvados_vs_ninguna": 812.4, "salvados_vs_azar": 120.0},
    "planes": [
        {"id": "ninguna", "nombre": "Sin intervención", "tipo": "linea_base", "vacunas": 0, "costo": 0,
         "infectados": {"media": 3100.0, "p5": 2900.0}},
        {"id": "centralidad", "nombre": "Vacunar superpropagadores", "tipo": "candidato", "vacunas": 1000,
         "costo": 5000, "infectados": {"media": 2287.6}, "salvados_vs_ninguna": {"media": 812.4},
         "salvados_vs_azar": {"media": 120.0}, "gana_a_azar": 0.9, "mapa": [[1, 2], [3, 4]]},
    ],
}


@pytest.fixture
def bedrock(monkeypatch):
    """Cliente de Bedrock falso: guarda la petición y responde lo que se le indique."""
    llamadas = []

    class Cliente:
        def __init__(self, responder):
            self.responder = responder

        def converse(self, **peticion):
            llamadas.append(peticion)
            return self.responder()

    def usar(responder):
        monkeypatch.setattr(informe_ia, "ACTIVA", True)
        monkeypatch.setattr(informe_ia, "_cliente", lambda: Cliente(responder))
        return llamadas
    return usar


def test_resumen_solo_lleva_lo_necesario_y_la_cifra_de_manta():
    resumen = resumir(RESULTADO)
    plan = resumen["planes"][1]
    assert plan["infectados_media"] == 2287.6 and plan["salvados_vs_ninguna"] == 812.4
    assert "mapa" not in plan
    # 812,4 de 5.000 llevado a 271.145 habitantes y redondeado a centenas, como en la interfaz.
    assert resumen["en_manta"]["salvados_vs_ninguna"] == 44_100


@pytest.mark.parametrize("cambio", [
    {"planes": []},
    {"planes": "muchos"},
    {"veredicto": {"nivel": "excelente"}},
    {"recomendado": 5},
    {"escenario": {}},
    {"planes": [{"id": "x", "nombre": "x", "infectados": "muchos"}]},
])
def test_rechaza_resultados_mal_formados(cambio):
    with pytest.raises(ResumenInvalido):
        resumir({**RESULTADO, **cambio})


def test_sin_ia_responde_con_la_plantilla(monkeypatch):
    monkeypatch.setattr(informe_ia, "ACTIVA", False)
    informe = redactar(RESULTADO)
    assert informe["fuente"] == "local" and informe["modelo"] is None
    assert "Vacunar superpropagadores" in informe["texto"]
    assert "44.100 en toda Manta" in informe["texto"]
    assert "no una garantía" in informe["texto"]


def test_plantilla_insuficiente_no_presenta_el_plan_como_victoria(monkeypatch):
    monkeypatch.setattr(informe_ia, "ACTIVA", False)
    resultado = {**RESULTADO, "veredicto": {**RESULTADO["veredicto"], "nivel": "insuficiente"}}
    assert "ningún plan supera" in redactar(resultado)["texto"]


def test_con_bedrock_manda_solo_el_resumen_y_devuelve_su_texto(bedrock):
    llamadas = bedrock(lambda: {"output": {"message": {"content": [{"text": " Texto del asesor. "}]}}})
    informe = redactar(RESULTADO)
    assert informe == {"fuente": "bedrock", "modelo": informe_ia.MODELO, "texto": "Texto del asesor."}
    mensaje = llamadas[0]["messages"][0]["content"][0]["text"]
    assert mensaje.startswith("<datos>") and "mapa" not in mensaje
    assert llamadas[0]["inferenceConfig"]["maxTokens"] == 400


def test_si_bedrock_falla_cae_a_la_plantilla(bedrock):
    def fallar():
        raise RuntimeError("AccessDeniedException")
    bedrock(fallar)
    assert redactar(RESULTADO)["fuente"] == "local"


def test_ruta_del_informe(monkeypatch):
    monkeypatch.setattr(informe_ia, "ACTIVA", False)
    codigo, respuesta = atender("POST", "/api/informe", json.dumps(RESULTADO))
    assert codigo == 200 and respuesta["fuente"] == "local"
    assert atender("POST", "/api/informe", json.dumps({"planes": []}))[0] == 400
    assert atender("POST", "/api/informe", "x" * 60_000)[0] == 400
