import json

from zombie.api import atender
import io
from datetime import datetime, timedelta, timezone

from zombie.guardado import guardar, historial

PEQUENO = {"escenario": {"n_personas": 1000, "dias": 60}, "repeticiones": 5}


class S3Falso:
    def __init__(self, falla=False):
        self.falla = falla
        self.subidos = []

    def put_object(self, **datos):
        if self.falla:
            raise ConnectionError("S3 no responde")
        self.subidos.append(datos | {"LastModified": datetime.now(timezone.utc)})

    def list_objects_v2(self, Bucket, Prefix):
        if self.falla:
            raise ConnectionError("S3 no responde")
        return {"Contents": [{"Key": o["Key"], "LastModified": o["LastModified"]}
                             for o in self.subidos if o["Key"].startswith(Prefix)]}

    def get_object(self, Bucket, Key):
        (objeto,) = [o for o in self.subidos if o["Key"] == Key]
        return {"Body": io.BytesIO(objeto["Body"])}


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


def test_historial_devuelve_las_mas_nuevas_primero(monkeypatch):
    monkeypatch.setenv("RESULTADOS_BUCKET", "bucket-de-prueba")
    s3 = S3Falso()
    resultado = _resultado()
    ids = [guardar(resultado, s3) for _ in range(3)]
    for i, o in enumerate(s3.subidos):   # fechas de modificación distintas y conocidas
        o["LastModified"] = datetime(2026, 10, 28, 12, i, tzinfo=timezone.utc)
    filas = historial(limite=2, cliente=s3)
    assert [f["id"] for f in filas] == [ids[2], ids[1]]
    assert filas[0]["recursos"]["presupuesto"] == resultado["escenario"]["recursos"]["presupuesto"]


def test_historial_incluye_ayer_pero_no_antes(monkeypatch):
    monkeypatch.setenv("RESULTADOS_BUCKET", "bucket-de-prueba")
    s3 = S3Falso()
    guardar(_resultado(), s3)
    hoy = datetime.now(timezone.utc)
    assert len(historial(cliente=s3, hoy=hoy + timedelta(days=1))) == 1
    assert historial(cliente=s3, hoy=hoy + timedelta(days=2)) == []


def test_historial_sin_bucket_o_si_s3_falla_esta_vacio(monkeypatch):
    monkeypatch.delenv("RESULTADOS_BUCKET", raising=False)
    assert historial(cliente=S3Falso()) == []
    monkeypatch.setenv("RESULTADOS_BUCKET", "bucket-de-prueba")
    assert historial(cliente=S3Falso(falla=True)) == []
    monkeypatch.delenv("RESULTADOS_BUCKET")
    assert atender("GET", "/api/historial", None) == (200, {"simulaciones": []})
