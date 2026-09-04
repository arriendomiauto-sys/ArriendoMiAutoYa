"""
Pasarela de pagos: Mercado Pago.

Reemplaza a Webpay/Transbank. Dos diferencias importantes respecto de la
integración anterior, que explican por qué esto no es una traducción campo a
campo:

1. **La confirmación no depende del navegador.** Webpay devolvía un `token_ws`
   y el backend lo confirmaba en ese mismo instante. Mercado Pago avisa por
   webhook, así que un arrendatario que paga y cierra la app antes de volver
   igual queda con la reserva confirmada. La vuelta por `back_urls` sigue
   existiendo, pero como atajo para no hacer esperar al usuario: la fuente de
   verdad es consultar el pago contra la API.

2. **La garantía se retiene de verdad.** Con `capture=false` el cobro queda
   autorizado pero no capturado: el cupo se reserva en la tarjeta del
   arrendatario y se libera solo, sin cobrarle, si nadie lo captura. Es
   exactamente lo que el negocio necesita para el hold, y con Webpay Plus no
   se podía hacer.

El entorno (prueba o producción) no se configura: lo determina el propio
access token — los de prueba empiezan con `TEST-` y los productivos con
`APP_USR-`.
"""
import hashlib
import hmac
import logging
import re
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

API_BASE = "https://api.mercadopago.com"
TIMEOUT = 15.0

# Estados de un pago en Mercado Pago que nos importan.
# - approved:   cobrado.
# - authorized: autorizado sin capturar, que es el hold de la garantía.
APROBADO = "approved"
AUTORIZADO = "authorized"
ESTADOS_OK = (APROBADO, AUTORIZADO)


class MercadoPagoService:
    @classmethod
    def credenciales_configuradas(cls) -> bool:
        return bool((settings.MERCADOPAGO_ACCESS_TOKEN or "").strip())

    @classmethod
    def es_produccion(cls) -> bool:
        """El token dice el entorno: `TEST-` es sandbox, `APP_USR-` es real."""
        return (settings.MERCADOPAGO_ACCESS_TOKEN or "").startswith("APP_USR-")

    @classmethod
    def _headers(cls, idempotency_key: Optional[str] = None) -> Dict[str, str]:
        headers = {
            "Authorization": f"Bearer {settings.MERCADOPAGO_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        }
        # Sin esta cabecera, un reintento por timeout puede cobrar dos veces:
        # Mercado Pago la usa para reconocer que es el mismo pago.
        if idempotency_key:
            headers["X-Idempotency-Key"] = idempotency_key
        return headers

    @classmethod
    def _pedir(cls, metodo: str, ruta: str, **kwargs) -> Dict[str, Any]:
        """
        Llamada HTTP con el manejo de errores unificado.

        Devuelve siempre `{success, ...}`: quien llama nunca tiene que
        distinguir entre "no hubo red" y "la API dijo que no".
        """
        if not cls.credenciales_configuradas():
            return {
                "success": False,
                "error": "Falta MERCADOPAGO_ACCESS_TOKEN: la pasarela no está configurada.",
            }

        idempotency_key = kwargs.pop("idempotency_key", None)
        try:
            with httpx.Client(timeout=TIMEOUT) as client:
                respuesta = client.request(
                    metodo, f"{API_BASE}{ruta}", headers=cls._headers(idempotency_key), **kwargs
                )
        except Exception as e:
            logger.error("[MERCADOPAGO] Fallo de conexión en %s %s: %s", metodo, ruta, e)
            return {"success": False, "error": str(e)}

        if respuesta.status_code >= 400:
            logger.error(
                "[MERCADOPAGO] %s %s respondió %s: %s",
                metodo, ruta, respuesta.status_code, respuesta.text,
            )
            return {
                "success": False,
                "error": respuesta.text,
                "status_code": respuesta.status_code,
            }

        return {"success": True, "data": respuesta.json()}

    # -----------------------------------------------------------------
    # Checkout Pro: el usuario paga en la página de Mercado Pago
    # -----------------------------------------------------------------
    @classmethod
    def crear_preferencia(
        cls,
        referencia_externa: str,
        titulo: str,
        monto: int,
        return_url: str,
        email_pagador: Optional[str] = None,
        notification_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Crea la preferencia de Checkout Pro y devuelve la URL a la que hay que
        mandar al usuario.

        `referencia_externa` es nuestro id de pago: vuelve en el webhook y en
        la redirección, y es lo que permite reconocer a qué reserva
        corresponde un aviso de Mercado Pago.
        """
        cuerpo = {
            "items": [
                {
                    "title": titulo,
                    "quantity": 1,
                    "unit_price": int(monto),
                    "currency_id": "CLP",
                }
            ],
            "external_reference": referencia_externa,
            "back_urls": {"success": return_url, "pending": return_url, "failure": return_url},
            # Vuelve solo a la app apenas se aprueba, sin obligar al usuario a
            # tocar "volver al sitio".
            "auto_return": "approved",
            # Una garantía en cuotas no tiene sentido: el hold es uno solo.
            "payment_methods": {"installments": 1},
        }
        if email_pagador:
            cuerpo["payer"] = {"email": email_pagador}
        if notification_url:
            cuerpo["notification_url"] = notification_url

        resultado = cls._pedir(
            "POST", "/checkout/preferences", json=cuerpo, idempotency_key=referencia_externa
        )
        if not resultado["success"]:
            return resultado

        datos = resultado["data"]
        # En sandbox el init_point productivo no sirve; se elige según el token.
        url = datos.get("init_point") if cls.es_produccion() else (
            datos.get("sandbox_init_point") or datos.get("init_point")
        )
        logger.info("[MERCADOPAGO] Preferencia creada: %s (ref %s)", datos.get("id"), referencia_externa)
        return {
            "success": True,
            "preferencia_id": datos.get("id"),
            "url": url,
            "monto": monto,
            "referencia_externa": referencia_externa,
        }

    # -----------------------------------------------------------------
    # Pago directo con tarjeta tokenizada (el hold de la garantía)
    # -----------------------------------------------------------------
    @classmethod
    def crear_pago_con_tarjeta(
        cls,
        token_tarjeta: str,
        monto: int,
        descripcion: str,
        email_pagador: str,
        referencia_externa: str,
        payment_method_id: Optional[str] = None,
        capturar: bool = True,
    ) -> Dict[str, Any]:
        """
        Cobra (o solo autoriza) contra una tarjeta ya tokenizada por el SDK de
        Mercado Pago en el cliente.

        `capturar=False` deja el pago en `authorized`: el cupo queda retenido
        en la tarjeta del arrendatario y, si nadie lo captura, se libera solo
        sin haberle cobrado nada. Ese es el hold de la garantía.

        El número de la tarjeta nunca pasa por acá: el cliente tokeniza contra
        Mercado Pago y manda solo el token.
        """
        cuerpo = {
            "transaction_amount": int(monto),
            "token": token_tarjeta,
            "description": descripcion,
            "installments": 1,
            "payer": {"email": email_pagador},
            "external_reference": referencia_externa,
            "capture": bool(capturar),
        }
        if payment_method_id:
            cuerpo["payment_method_id"] = payment_method_id

        resultado = cls._pedir(
            "POST", "/v1/payments", json=cuerpo, idempotency_key=referencia_externa
        )
        if not resultado["success"]:
            return resultado
        return cls._resumen_pago(resultado["data"])

    @classmethod
    def obtener_pago(cls, payment_id: str) -> Dict[str, Any]:
        """Estado actual de un pago. Es la fuente de verdad, no el redirect."""
        resultado = cls._pedir("GET", f"/v1/payments/{payment_id}")
        if not resultado["success"]:
            return resultado
        return cls._resumen_pago(resultado["data"])

    @classmethod
    def capturar_pago(cls, payment_id: str, monto: Optional[int] = None) -> Dict[str, Any]:
        """
        Cobra de verdad un hold ya autorizado.

        El monto puede ser menor al retenido — se usa cuando el arriendo
        termina con cargos por debajo de la garantía.
        """
        cuerpo: Dict[str, Any] = {"capture": True}
        if monto is not None:
            cuerpo["transaction_amount"] = int(monto)

        resultado = cls._pedir("PUT", f"/v1/payments/{payment_id}", json=cuerpo)
        if not resultado["success"]:
            return resultado
        return cls._resumen_pago(resultado["data"])

    @classmethod
    def liberar_hold(cls, payment_id: str) -> Dict[str, Any]:
        """
        Suelta una garantía retenida sin cobrarla: el arriendo terminó bien.

        Un pago autorizado se cancela; uno ya capturado hay que reembolsarlo,
        y para eso está `reembolsar`.
        """
        resultado = cls._pedir("PUT", f"/v1/payments/{payment_id}", json={"status": "cancelled"})
        if not resultado["success"]:
            return resultado
        return cls._resumen_pago(resultado["data"])

    @classmethod
    def reembolsar(cls, payment_id: str, monto: Optional[int] = None) -> Dict[str, Any]:
        """Devuelve total o parcialmente un pago ya cobrado."""
        cuerpo = {"amount": int(monto)} if monto is not None else {}
        return cls._pedir("POST", f"/v1/payments/{payment_id}/refunds", json=cuerpo)

    # -----------------------------------------------------------------
    # Webhook
    # -----------------------------------------------------------------
    @classmethod
    def firma_valida(cls, x_signature: str, x_request_id: str, data_id: str) -> bool:
        """
        Comprueba la firma del webhook de Mercado Pago.

        Sin esto, cualquiera que conozca la URL podría avisar "el pago 123 fue
        aprobado" y confirmar reservas gratis. La cabecera trae `ts` y `v1`, y
        el HMAC se calcula sobre un texto con formato fijo.

        Si no hay secreto configurado devuelve False: es preferible rechazar
        el aviso y confirmar por consulta directa a la API que aceptar algo
        que no se pudo verificar.
        """
        secreto = (settings.MERCADOPAGO_WEBHOOK_SECRET or "").strip()
        if not secreto or not x_signature:
            return False

        partes = dict(
            re.split(r"\s*=\s*", p.strip(), maxsplit=1)
            for p in x_signature.split(",")
            if "=" in p
        )
        ts = partes.get("ts")
        recibida = partes.get("v1")
        if not ts or not recibida:
            return False

        # El formato del manifiesto lo fija Mercado Pago; el id va en minúsculas.
        manifiesto = f"id:{(data_id or '').lower()};request-id:{x_request_id or ''};ts:{ts};"
        esperada = hmac.new(
            secreto.encode("utf-8"), manifiesto.encode("utf-8"), hashlib.sha256
        ).hexdigest()

        # compare_digest y no ==: una comparación normal filtra por tiempo
        # cuántos caracteres del principio coinciden.
        return hmac.compare_digest(esperada, recibida)

    # -----------------------------------------------------------------
    @staticmethod
    def _resumen_pago(datos: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normaliza la respuesta de un pago a la forma que usan los routers, para
        que ninguna pantalla ni endpoint tenga que conocer el JSON de Mercado
        Pago.
        """
        estado = datos.get("status")
        return {
            "success": True,
            "autorizada": estado in ESTADOS_OK,
            "capturado": estado == APROBADO,
            "retenido": estado == AUTORIZADO,
            "estado": estado,
            "detalle_estado": datos.get("status_detail"),
            "payment_id": str(datos.get("id")) if datos.get("id") is not None else None,
            "monto": datos.get("transaction_amount"),
            "referencia_externa": datos.get("external_reference"),
            "medio_pago": datos.get("payment_method_id"),
            "tarjeta": {
                "ultimos4": (datos.get("card") or {}).get("last_four_digits"),
                "marca": datos.get("payment_method_id"),
            },
            "raw": datos,
        }
