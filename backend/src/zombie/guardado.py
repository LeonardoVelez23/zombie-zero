"""Guarda un resumen de cada simulación en S3 para consultarlo después con Athena.

Solo si está definida la variable RESULTADOS_BUCKET (en Lambda la pone infra/template.yaml).
Es de mejor esfuerzo: si S3 falla o tarda, la simulación se entrega igual.
Se guarda un resumen en una línea JSON (sin curvas ni mapas, que pesan cientos de kB),
particionado por fecha para que Athena lea solo los días que se consultan:
    simulaciones/fecha=AAAA-MM-DD/<id>.json
Ver docs/resultados.md.
"""
import json
import os
import uuid
from datetime import datetime, timezone

CONEXION_S = 1
LECTURA_S = 2

_s3 = None


def resumen(resultado: dict, id_: str, momento: datetime) -> dict:
    """Lo que se guarda de una simulación: el escenario completo y las cifras de cada plan."""
    esc = resultado["escenario"]
    veredicto = resultado.get("veredicto") or {}
    return {
        "id": id_,
        "momento": momento.isoformat(timespec="seconds"),
        "semilla": esc["semilla"],
        "repeticiones": resultado["repeticiones"],
        "inicio": esc["inicio"],
        "n_personas": esc["n_personas"],
        "dias": esc["dias"],
        "casos_iniciales": esc["casos_iniciales"],
        "plaga": esc["plaga"],
        "recursos": esc["recursos"],
        "recomendado": resultado.get("recomendado"),
        "nivel": veredicto.get("nivel"),
        "gana_a_azar": veredicto.get("gana_a_azar"),
        "salvados_vs_ninguna": veredicto.get("salvados_vs_ninguna"),
        "planes": [
            {
                "id": p["id"],
                "nombre": p["nombre"],
                "tipo": p["tipo"],
                "costo": p["costo"],
                "vacunas": p["vacunas"],
                "infectados": p["infectados"]["media"],
                "infectados_p5": p["infectados"]["p5"],
                "infectados_p95": p["infectados"]["p95"],
                "salvados": (p.get("salvados_vs_ninguna") or {}).get("media"),
            }
            for p in resultado["planes"]
        ],
    }


def guardar(resultado: dict, cliente=None) -> str | None:
    """Sube el resumen a S3 y devuelve su id; None si no hay bucket configurado o si falló."""
    bucket = os.environ.get("RESULTADOS_BUCKET", "")
    if not bucket:
        return None
    try:
        momento = datetime.now(timezone.utc)
        id_ = uuid.uuid4().hex
        cuerpo = json.dumps(resumen(resultado, id_, momento), ensure_ascii=False)
        (cliente or _cliente()).put_object(
            Bucket=bucket,
            Key=f"simulaciones/fecha={momento:%Y-%m-%d}/{id_}.json",
            Body=cuerpo.encode("utf-8"),
            ContentType="application/json",
        )
        return id_
    except Exception as error:   # noqa: BLE001 - guardar nunca debe tumbar la simulación
        print(f"No se guardó el resultado: {type(error).__name__}")
        return None


def _cliente():
    global _s3
    if _s3 is None:
        import boto3   # viene incluido en el runtime de Python de Lambda
        from botocore.config import Config
        _s3 = boto3.client("s3", config=Config(
            connect_timeout=CONEXION_S, read_timeout=LECTURA_S,
            retries={"total_max_attempts": 1, "mode": "standard"}))
    return _s3
