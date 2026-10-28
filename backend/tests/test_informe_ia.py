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


@pytest.fixture(autouse=True)
def limpiar_estado():
    """El cupo por minuto y la caché viven en el módulo: cada prueba empieza de cero."""
    informe_ia._llamadas.clear()
    informe_ia._cache.clear()


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
    {"escenario": {"n_personas": float("nan")}},
    {"escenario": {"n_personas": float("inf")}},
    {"repeticiones": 10**400},
    {"veredicto": {**RESULTADO["veredicto"], "salvados_vs_ninguna": 1e300}},
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


@pytest.mark.parametrize("cuerpo", [
    '{"escenario": {"n_personas": NaN}, "repeticiones": 100}',
    '{"escenario": {"n_personas": 5000}, "repeticiones": Infinity}',
    '{"escenario": {"n_personas": 1' + '0' * 400 + '}, "repeticiones": 100}',
])
def test_cifras_no_finitas_o_enormes_dan_400_y_no_500(cuerpo):
    datos = json.loads(cuerpo)
    codigo, respuesta = atender("POST", "/api/informe", json.dumps({**RESULTADO, **datos}))
    assert codigo == 400 and "error" in respuesta


def test_el_limite_del_cuerpo_se_mide_en_bytes_utf8(monkeypatch):
    monkeypatch.setattr(informe_ia, "ACTIVA", False)
    # 30.000 caracteres pero 60.000 bytes: antes pasaba el control de 50.000.
    relleno = {**RESULTADO, "relleno": "ñ" * 30_000}
    cuerpo = json.dumps(relleno, ensure_ascii=False)
    assert len(cuerpo) < 50_000 < len(cuerpo.encode("utf-8"))
    assert atender("POST", "/api/informe", cuerpo)[0] == 400


def test_los_reintentos_de_bedrock_caben_en_el_limite_de_la_lambda():
    peor_caso = informe_ia.INTENTOS * (informe_ia.CONEXION_S + informe_ia.LECTURA_S)
    assert peor_caso + 10 < informe_ia.LIMITE_LAMBDA_S   # margen para el resto de la petición


def test_pasado_el_cupo_por_minuto_responde_la_plantilla(bedrock, monkeypatch):
    monkeypatch.setattr(informe_ia, "LLAMADAS_POR_MINUTO", 2)
    llamadas = bedrock(lambda: {"output": {"message": {"content": [{"text": "IA"}]}}})
    fuentes = []
    for i in range(3):   # resultados distintos para que no los sirva la caché
        resultado = {**RESULTADO, "repeticiones": 100 + i}
        fuentes.append(redactar(resultado)["fuente"])
    assert fuentes == ["bedrock", "bedrock", "local"]
    assert len(llamadas) == 2


def test_el_cupo_se_libera_al_pasar_el_minuto():
    informe_ia._llamadas.extend([0.0] * informe_ia.LLAMADAS_POR_MINUTO)
    assert not informe_ia._hay_cupo(59.0)
    assert informe_ia._hay_cupo(60.0)


def test_el_mismo_resultado_no_vuelve_a_pagar_bedrock(bedrock):
    llamadas = bedrock(lambda: {"output": {"message": {"content": [{"text": "IA"}]}}})
    assert redactar(RESULTADO) == redactar(RESULTADO)
    assert len(llamadas) == 1


def test_un_fallo_de_bedrock_no_queda_en_la_cache(bedrock):
    def fallar():
        raise RuntimeError("ThrottlingException")
    llamadas = bedrock(fallar)
    redactar(RESULTADO)
    redactar(RESULTADO)
    assert len(llamadas) == 2
