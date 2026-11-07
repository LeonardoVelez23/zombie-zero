"""Base del informe con IA: valida y resume la simulación, y configura Amazon Bedrock.

Recibe el resultado de una simulación ya hecha (no vuelve a simular) y deja solo las cifras que
necesita el modelo. Aquí viven el cliente de Bedrock, su tope por minuto, la caché y la plantilla
sin IA del alcalde; las tareas y la cadena Bedrock → Groq → plantilla están en asistente_ia.py.
Ver docs/api.md.
"""
import math
import os
import time
from collections import OrderedDict, deque

from .montecarlo import LINEAS_BASE

MODELO = os.environ.get("MODELO_IA", "amazon.nova-micro-v1:0")
ACTIVA = os.environ.get("IA_ACTIVA", "false") == "true"

# Misma escala que la interfaz (frontend/src/app/dominio/reglas/escala.ts): Censo 2022 del INEC.
POBLACION_MANTA = 271_145
NIVELES = ("solida", "debil", "insuficiente")
MAX_PLANES = 64
MAX_TEXTO = 120
# Ninguna cifra de una simulación llega a esto; más grande es un error o un abuso.
MAX_CIFRA = 1e9

# Tope de gasto: el endpoint es público y cada llamada a Bedrock se cobra. Cada contenedor de la
# Lambda llama a Bedrock como mucho LLAMADAS_POR_MINUTO veces; pasado eso responde la plantilla.
# Con el límite de 10 ejecuciones simultáneas de una cuenta nueva y ~$0,0001 por llamada, el peor
# caso es 10 × 4 × 60 × 24 × $0,0001 ≈ $5,80 al día, y el AWS Budget avisa (docs/costos.md).
LLAMADAS_POR_MINUTO = int(os.environ.get("IA_LLAMADAS_POR_MINUTO", "4"))
# Peor caso de Bedrock: 2 intentos × (3 s + 12 s) + espera entre intentos ≈ 31 s, por debajo de los 60 s
# de la Lambda y de CloudFront: si Bedrock no responde, todavía da tiempo de devolver la plantilla.
CONEXION_S, LECTURA_S, INTENTOS = 3, 12, 2
LIMITE_LAMBDA_S = 60
# El mismo resultado pedido otra vez no vuelve a pagar Bedrock.
TAM_CACHE = 256
_llamadas: deque[float] = deque()
_cache: OrderedDict[str, dict] = OrderedDict()

class ResumenInvalido(ValueError):
    pass


def _cifra(valor) -> float:
    """Un número de la simulación: acepta el valor suelto o un rango {media, p5, ...}."""
    if isinstance(valor, dict):
        valor = valor.get("media")
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        raise ResumenInvalido("Las cifras del resultado deben ser números")
    try:
        numero = float(valor)   # un entero enorme no cabe en un float: OverflowError
    except OverflowError:
        raise ResumenInvalido("Las cifras del resultado son demasiado grandes") from None
    # json.loads acepta NaN e Infinity: se rechazan antes de redondear o convertir a entero.
    if not math.isfinite(numero) or abs(numero) > MAX_CIFRA:
        raise ResumenInvalido("Las cifras del resultado deben ser números finitos y razonables")
    return round(numero, 3)


def _texto(valor) -> str:
    if not isinstance(valor, str):
        raise ResumenInvalido("Los nombres del resultado deben ser texto")
    return valor[:MAX_TEXTO]


def _en_manta(valor: float, n_personas: int) -> int:
    return int(round(valor * POBLACION_MANTA / max(1, n_personas) / 100) * 100)


def resumir(resultado: dict) -> dict:
    """Valida el resultado que manda la interfaz y deja solo lo que necesita el modelo.

    Menos datos son menos tokens y menos margen para que el modelo invente.
    """
    if not isinstance(resultado, dict):
        raise ResumenInvalido("El resultado debe ser un objeto JSON")
    try:
        planes, veredicto = resultado["planes"], resultado["veredicto"]
        n_personas = int(_cifra(resultado["escenario"]["n_personas"]))
        repeticiones = int(_cifra(resultado["repeticiones"]))
        recomendado = _texto(resultado["recomendado"])
        nivel = veredicto["nivel"]
    except (KeyError, TypeError):
        raise ResumenInvalido("Faltan campos del resultado de la simulación") from None
    if not isinstance(planes, list) or not 0 < len(planes) <= MAX_PLANES:
        raise ResumenInvalido(f"planes debe ser una lista de 1 a {MAX_PLANES} planes")
    if nivel not in NIVELES:
        raise ResumenInvalido(f"nivel debe ser uno de: {', '.join(NIVELES)}")
    if n_personas < 1:
        raise ResumenInvalido("n_personas debe ser positivo")

    resumen_planes = []
    for plan in planes:
        if not isinstance(plan, dict):
            raise ResumenInvalido("Cada plan debe ser un objeto")
        try:
            datos = {
                "id": _texto(plan["id"]),
                "nombre": _texto(plan["nombre"]),
                "tipo": "linea_base" if plan.get("tipo") == "linea_base" else "candidato",
                "vacunas": int(_cifra(plan.get("vacunas", 0))),
                "costo": _cifra(plan.get("costo", 0)),
                "infectados_media": _cifra(plan["infectados"]),
            }
        except KeyError:
            raise ResumenInvalido("Cada plan necesita id, nombre e infectados") from None
        # Las claves salen del id de cada línea base, igual que en montecarlo.comparar.
        for base in LINEAS_BASE:
            if f"salvados_vs_{base.id}" in plan:
                datos[f"salvados_vs_{base.id}"] = _cifra(plan[f"salvados_vs_{base.id}"])
            if f"gana_a_{base.id}" in plan:
                datos[f"gana_a_{base.id}"] = _cifra(plan[f"gana_a_{base.id}"])
        resumen_planes.append(datos)

    salvados = _cifra(veredicto.get("salvados_vs_ninguna", 0))
    return {
        "personas_simuladas": n_personas,
        "brotes_simulados": repeticiones,
        "recomendado": recomendado,
        "veredicto": {
            "nivel": nivel,
            "gana_a_azar": _cifra(veredicto.get("gana_a_azar", 0)),
            "empates_con_azar": _cifra(veredicto.get("empates_con_azar", 0)),
            "salvados_vs_ninguna": salvados,
            "salvados_vs_azar": _cifra(veredicto.get("salvados_vs_azar", 0)),
        },
        "en_manta": {
            "habitantes": POBLACION_MANTA,
            "salvados_vs_ninguna": _en_manta(salvados, n_personas),
        },
        "planes": resumen_planes,
    }


def _texto_plantilla(resumen: dict) -> str:
    """Respaldo sin IA: frases fijas con las mismas cifras."""
    v = resumen["veredicto"]
    plan = next((p for p in resumen["planes"] if p["id"] == resumen["recomendado"]), None)
    nombre = plan["nombre"] if plan else resumen["recomendado"]
    salvados = f"{round(v['salvados_vs_ninguna']):,}".replace(",", ".")
    manta = f"{resumen['en_manta']['salvados_vs_ninguna']:,}".replace(",", ".")
    gana = f"{round(v['gana_a_azar'] * 100)} %"
    brotes = resumen["brotes_simulados"]
    if v["nivel"] == "insuficiente":
        return (f"Con estos recursos ningún plan supera de forma consistente al reparto de vacunas al azar. "
                f"La mejor opción disponible es {nombre}, que salva en promedio {salvados} personas de la "
                f"muestra frente a no intervenir. Para cambiar el resultado hacen falta más vacunas o actuar antes.")
    confianza = "sólida" if v["nivel"] == "solida" else "débil"
    return (f"Se recomienda {nombre}. En {brotes} brotes simulados ganó al reparto al azar en {gana} de los "
            f"casos en que hubo diferencia, una recomendación {confianza}. Frente a no intervenir salva en "
            f"promedio {salvados} personas de la muestra, unas {manta} en toda Manta. "
            f"Es un promedio de simulaciones, no una garantía.")


def _cliente():
    import boto3   # viene incluido en el runtime de Python de Lambda; en local solo hace falta con IA_ACTIVA
    from botocore.config import Config
    return boto3.client("bedrock-runtime", config=Config(
        connect_timeout=CONEXION_S, read_timeout=LECTURA_S,
        retries={"total_max_attempts": INTENTOS, "mode": "standard"}))


def _hay_cupo(ahora: float) -> bool:
    """Ventana deslizante de un minuto: True y cuenta la llamada si todavía queda cupo."""
    while _llamadas and ahora - _llamadas[0] >= 60:
        _llamadas.popleft()
    if len(_llamadas) >= LLAMADAS_POR_MINUTO:
        return False
    _llamadas.append(ahora)
    return True


def redactar(resultado: dict) -> dict:
    """«Explicar al alcalde» en un solo JSON: Bedrock, Groq de respaldo y si no, la plantilla.

    La cadena de proveedores, el cupo y la caché están en asistente_ia (que usa este módulo).
    """
    from .asistente_ia import responder   # importación diferida: asistente_ia importa este módulo
    return responder({"tarea": "alcalde", "resultado": resultado})
