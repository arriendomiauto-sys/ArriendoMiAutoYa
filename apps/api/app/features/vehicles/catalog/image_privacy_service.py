import io
import re
import base64
import logging
from typing import Optional, List, Tuple

import httpx

from app.core.config import settings
from app.core.vision import VISION_REST_URL, credenciales_vision

logger = logging.getLogger(__name__)

# Patentes chilenas: formato nuevo BBBB·11 (4 letras + 2 dígitos) y
# formatos antiguos BB·1111 / BB·BB·11. Se comparan sin separadores.
_PLACA_RE = re.compile(r"^(?:[A-Z]{4}\d{2}|[A-Z]{2}\d{4}|[A-Z]{2}[A-Z]{2}\d{2})$")
_SOLO_LETRAS_RE = re.compile(r"^[A-Z]{2,4}$")
_SOLO_DIGITOS_RE = re.compile(r"^\d{2,4}$")


def _norm(texto: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (texto or "").upper())


def _bbox(vertices: List[dict]) -> Optional[Tuple[int, int, int, int]]:
    xs = [v.get("x", 0) for v in vertices]
    ys = [v.get("y", 0) for v in vertices]
    if not xs or not ys:
        return None
    return (min(xs), min(ys), max(xs), max(ys))


def _solapan_vertical(a, b) -> bool:
    return not (a[3] < b[1] or b[3] < a[1])


class ImagePrivacy:
    @classmethod
    def _vision_text_annotations(cls, image_bytes: bytes) -> Optional[list]:
        if settings.USE_OCR_MOCK:
            return None
        api_key, tiene_creds = credenciales_vision()
        if not api_key and not tiene_creds:
            return None
        try:
            if api_key:
                payload = {
                    "requests": [{
                        "image": {"content": base64.b64encode(image_bytes).decode("utf-8")},
                        "features": [{"type": "TEXT_DETECTION"}],
                    }]
                }
                with httpx.Client(timeout=20.0) as client:
                    resp = client.post(f"{VISION_REST_URL}?key={api_key}", json=payload)
                if resp.status_code == 200:
                    return resp.json().get("responses", [{}])[0].get("textAnnotations", []) or []
                logger.warning(f"TEXT_DETECTION REST {resp.status_code}: {resp.text[:200]}")
                return None
            # SDK / service account
            from google.cloud import vision
            client = vision.ImageAnnotatorClient()
            r = client.text_detection(image=vision.Image(content=image_bytes))
            out = []
            for a in r.text_annotations:
                out.append({
                    "description": a.description,
                    "boundingPoly": {"vertices": [{"x": v.x, "y": v.y} for v in a.bounding_poly.vertices]},
                })
            return out
        except Exception as e:
            logger.error(f"Fallo TEXT_DETECTION para censura de patentes: {e}")
            return None

    @classmethod
    def censurar_patentes(cls, image_bytes: bytes) -> bytes:
        """
        Detecta placas patentes en la foto (Google Vision TEXT_DETECTION) y
        las tapa con un rectángulo negro. Best-effort: si Vision no está
        disponible o no encuentra ninguna, devuelve la imagen original.
        Siempre re-codifica a JPEG cuando censura.
        """
        if not image_bytes:
            return image_bytes

        anns = cls._vision_text_annotations(image_bytes)
        if not anns:
            return image_bytes

        # anns[0] es el texto completo; el resto son palabras sueltas.
        tokens = []
        for w in anns[1:]:
            b = _bbox(w.get("boundingPoly", {}).get("vertices", []))
            if b:
                tokens.append((_norm(w.get("description", "")), b))

        cajas: List[Tuple[int, int, int, int]] = []

        def _union(bs):
            return (min(b[0] for b in bs), min(b[1] for b in bs),
                    max(b[2] for b in bs), max(b[3] for b in bs))

        n = len(tokens)
        for i in range(n):
            t0, b0 = tokens[i]
            # 1. Un solo token ya es la patente completa: "BBCL10".
            if _PLACA_RE.match(t0):
                cajas.append(b0)
                continue
            # 2. Patente partida: token de letras + (separador opcional) +
            #    token de dígitos, en la misma línea. Los separadores como
            #    "-" o "·" normalizan a "" y no estorban al unir.
            if not _SOLO_LETRAS_RE.match(t0):
                continue
            for j in range(i + 1, min(i + 5, n)):
                tj, bj = tokens[j]
                # Solo se encadenan trozos de letras/dígitos en la misma
                # línea (LL LL DD, BBCL - 10, etc.); cualquier otra cosa corta.
                if not _solapan_vertical(b0, bj):
                    break
                if tj and not (_SOLO_LETRAS_RE.match(tj) or _SOLO_DIGITOS_RE.match(tj)):
                    break
                unido = "".join(tk for tk, _ in tokens[i:j + 1])
                if len(unido) > 8:
                    break
                if _PLACA_RE.match(unido):
                    cajas.append(_union([bb for _, bb in tokens[i:j + 1]]))
                    break

        if not cajas:
            return image_bytes

        try:
            from PIL import Image, ImageDraw
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            draw = ImageDraw.Draw(img)
            W, H = img.size
            for (x0, y0, x1, y1) in cajas:
                m = max(6, int((x1 - x0) * 0.08))
                draw.rectangle(
                    [max(0, x0 - m), max(0, y0 - m), min(W, x1 + m), min(H, y1 + m)],
                    fill=(17, 17, 17),
                )
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            logger.info(f"Censuradas {len(cajas)} posible(s) patente(s) en foto de auto.")
            return buf.getvalue()
        except Exception as e:
            logger.error(f"Fallo al dibujar la censura de patente: {e}")
            return image_bytes
