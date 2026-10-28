import json

from zombie.api import atender
from zombie.guardado import guardar

PEQUENO = {"escenario": {"n_personas": 1000, "dias": 60}, "repeticiones": 5}


class S3Falso:
    def __init__(self, falla=False):
        self.falla = falla
        self.subidos = []

    def put_object(self, **datos):
        if self.falla:
            raise ConnectionError("S3 no responde")
        self.subidos.append(datos)


def _resultado():
    codigo, res = atender("POST", "/api/simular", json.dumps(PEQUENO))
    assert codigo == 200
    return res


def test_sin_bucket_no_guarda(monkeypatch):
    monkeypatch.delenv("RESULTADOS_BUCKET", raising=False)
    s3 = S3Falso()
    assert guardar(_resultado(), s3) is None
    assert s3.subidos == []


def test_guarda_un_resumen_por_fecha(monkeypatch):
    monkeypatch.setenv("RESULTADOS_BUCKET", "bucket-de-prueba")
    s3 = S3Falso()
    resultado = _resultado()
    id_ = guardar(resultado, s3)
    (subido,) = s3.subidos
    assert subido["Bucket"] == "bucket-de-prueba"
    assert subido["Key"].startswith("simulaciones/fecha=") and subido["Key"].endswith(f"/{id_}.json")
    fila = json.loads(subido["Body"])
    assert "\n" not in subido["Body"].decode()   # una línea: Athena lee una fila por línea
    assert fila["semilla"] == 42 and fila["n_personas"] == 1000
    assert fila["recomendado"] == resultado["recomendado"]
    assert {p["id"] for p in fila["planes"]} == {p["id"] for p in resultado["planes"]}
    assert "curva_zombies" not in subido["Body"].decode()   # sin las series pesadas


def test_si_s3_falla_la_simulacion_sigue(monkeypatch):
    monkeypatch.setenv("RESULTADOS_BUCKET", "bucket-de-prueba")
    assert guardar(_resultado(), S3Falso(falla=True)) is None
