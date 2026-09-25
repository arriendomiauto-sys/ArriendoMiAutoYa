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
from typing import Any, Dict, Optional, Tuple

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
# - cancelled:  garantía soltada sin cobrar.
CANCELADO = "cancelled"
ESTADOS_OK = (APROBADO, AUTORIZADO)

# Si la cuenta de Mercado Pago es un usuario de prueba (se consulta una vez a /users/me).
_cuenta_de_prueba: Optional[bool] = None


class MercadoPagoService:
    @classmethod
    def cuenta_es_de_prueba(cls) -> bool:
        """
        `True` si el access token es de un usuario de prueba de Mercado Pago.
        Sus credenciales también empiezan con `APP_USR-`, así que no se nota en el
        token: se le pregunta a Mercado Pago (etiqueta `test_user`) y se recuerda.
        """
        global _cuenta_de_prueba
        if _cuenta_de_prueba is None and cls.credenciales_configuradas():
            resultado = cls._pedir("GET", "/users/me")
            if resultado["success"]:
                _cuenta_de_prueba = "test_user" in ((resultado["data"] or {}).get("tags") or [])
                if _cuenta_de_prueba:
                    logger.warning("[MERCADOPAGO] Las credenciales son de un USUARIO DE PRUEBA: no se cobra dinero real.")
        return bool(_cuenta_de_prueba)

    @classmethod
    def modo_prueba(cls) -> bool:
        """Sandbox: forzado por `MERCADOPAGO_TEST_MODE` o porque la cuenta es de prueba."""
        return bool(getattr(settings, "MERCADOPAGO_TEST_MODE", True)) or cls.cuenta_es_de_prueba()

    @staticmethod
    def email_de_prueba(email_real: Optional[str]) -> str:
        """
        Correo de pagador para el sandbox. Mercado Pago exige el formato
        `test_payer_[0-9]{1,10}@testuser.com` con usuarios de prueba (cualquier otro
        responde "Unauthorized use of live credentials"). Sale del correo real, así
        cada usuario tiene siempre el mismo y su propia bóveda de tarjetas.
        """
        n = int(hashlib.sha256((email_real or "").strip().lower().encode()).hexdigest(), 16) % 10**9 + 1
        return f"test_payer_{n}@testuser.com"

    @classmethod
    def resolver_email_pagador(cls, email_pagador: Optional[str] = None) -> Optional[str]:
        """En modo prueba usa el correo de pagador de prueba que corresponde al usuario."""
        if cls.modo_prueba():
            return cls.email_de_prueba(email_pagador)
        return email_pagador
    @classmethod
    def credenciales_configuradas(cls) -> bool:
        return bool((settings.MERCADOPAGO_ACCESS_TOKEN or "").strip())

    @classmethod
    def es_produccion(cls) -> bool:
        """
        Determina si el entorno es producción real.
        Mercado Pago emite credenciales para usuarios de prueba que también comienzan
        con `APP_USR-`. Por tanto, si `MERCADOPAGO_TEST_MODE` es True o el entorno no
        es 'production', se debe operar en sandbox (sandbox_init_point).
        """
        if cls.modo_prueba():
            return False
        token = (settings.MERCADOPAGO_ACCESS_TOKEN or "").strip()
        if not token.startswith("APP_USR-"):
            return False
        return getattr(settings, "ENVIRONMENT", "development").lower() == "production"

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
        headers = {**cls._headers(idempotency_key), **(kwargs.pop("headers_extra", None) or {})}
        try:
            with httpx.Client(timeout=TIMEOUT) as client:
                respuesta = client.request(metodo, f"{API_BASE}{ruta}", headers=headers, **kwargs)
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

        try:
            datos = respuesta.json()
        except ValueError:
            # Un 2xx sin JSON (proxy, página de mantenimiento): no se sabe qué pasó,
            # así que se informa como error en vez de reventar a quien llamó.
            logger.error("[MERCADOPAGO] %s %s respondió %s sin JSON: %s",
                         metodo, ruta, respuesta.status_code, respuesta.text[:300])
            return {"success": False, "error": "Respuesta inválida de Mercado Pago",
                    "status_code": respuesta.status_code}
        return {"success": True, "data": datos}

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
        url_segura = (
            return_url
            or getattr(settings, "PAGO_DEFAULT_RETURN_URL", None)
            or "https://arriendomiautoya.cl/pago/retorno"
        ).strip()
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
            "back_urls": {"success": url_segura, "pending": url_segura, "failure": url_segura},
            # Vuelve solo a la app apenas se aprueba, sin obligar al usuario a
            # tocar "volver al sitio".
            "auto_return": "approved",
            # Una garantía en cuotas no tiene sentido: el hold es uno solo.
            "payment_methods": {"installments": 1},
        }
        email = cls.resolver_email_pagador(email_pagador)
        if email:
            cuerpo["payer"] = {"email": email}
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
        pagador: Optional[Dict[str, Any]] = None,
        item: Optional[Dict[str, Any]] = None,
        device_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Cobra (o solo autoriza) contra una tarjeta ya tokenizada por el SDK de
        Mercado Pago en el cliente.

        `capturar=False` deja el pago en `authorized`: el cupo queda retenido
        en la tarjeta del arrendatario y, si nadie lo captura, se libera solo
        sin haberle cobrado nada. Ese es el hold de la garantía.

        El número de la tarjeta nunca pasa por acá: el cliente tokeniza contra
        Mercado Pago y manda solo el token.

        `pagador` ({nombre, apellido, rut, telefono, registrado_en}), `item`
        ({id, titulo, descripcion}) y `device_id` alimentan el antifraude de
        Mercado Pago: sin ellos rechaza más cobros como riesgosos
        (`cc_rejected_high_risk`). Todos son opcionales.
        """
        email = cls.resolver_email_pagador(email_pagador) or cls.email_de_prueba(None)
        cuerpo = {
            "transaction_amount": int(monto),
            "token": token_tarjeta,
            "description": descripcion,
            "installments": 1,
            "payer": {"email": email},
            "external_reference": referencia_externa,
            "capture": bool(capturar),
            "statement_descriptor": settings.MERCADOPAGO_STATEMENT_DESCRIPTOR,
        }
        if payment_method_id:
            cuerpo["payment_method_id"] = payment_method_id
        payer_extra, additional_info = cls._datos_antifraude(pagador, item, monto, descripcion)
        cuerpo["payer"].update(payer_extra)
        if additional_info:
            cuerpo["additional_info"] = additional_info

        headers_extra = {"X-meli-session-id": device_id} if device_id else None
        resultado = cls._pedir(
            "POST", "/v1/payments", json=cuerpo, idempotency_key=referencia_externa,
            headers_extra=headers_extra,
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
            return cls._si_ya_quedo(payment_id, APROBADO, resultado, monto)
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
            return cls._si_ya_quedo(payment_id, CANCELADO, resultado)
        return cls._resumen_pago(resultado["data"])

    @classmethod
    def _si_ya_quedo(
        cls, payment_id: str, estado_buscado: str, fallo: Dict[str, Any], monto: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Capturar y liberar no aceptan clave de idempotencia: si la primera
        llamada llegó a Mercado Pago pero la respuesta se perdió (timeout), el
        reintento responde error porque el pago ya cambió de estado. Antes el
        barrido reintentaba hasta que la garantía "vencía" y avisaba que no se
        había cobrado, aunque la plata ya estaba cobrada. Se consulta el pago:
        si ya está como se quería (y por el mismo monto), la operación está hecha.
        """
        actual = cls.obtener_pago(payment_id)
        if not actual.get("success") or actual.get("estado") != estado_buscado:
            return fallo
        if monto is not None and actual.get("monto") is not None and int(float(actual["monto"])) != int(monto):
            logger.error("[MERCADOPAGO] El pago %s quedó '%s' por %s y no por %s: revisar a mano.",
                         payment_id, estado_buscado, actual["monto"], monto)
            return fallo
        logger.warning("[MERCADOPAGO] El pago %s ya estaba '%s': se da por hecho.", payment_id, estado_buscado)
        return actual

    @classmethod
    def reembolsar(cls, payment_id: str, monto: Optional[int] = None) -> Dict[str, Any]:
        """
        Devuelve total o parcialmente un pago ya cobrado.

        La clave de idempotencia sale del pago y el monto: si un reembolso se
        reintenta porque la respuesta se perdió (timeout), Mercado Pago lo
        reconoce y no devuelve dos veces.
        """
        cuerpo = {"amount": int(monto)} if monto is not None else {}
        clave = f"REEMB-{payment_id}-{int(monto) if monto is not None else 'total'}"
        return cls._pedir(
            "POST", f"/v1/payments/{payment_id}/refunds", json=cuerpo, idempotency_key=clave
        )

    @classmethod
    def buscar_pagos_actualizados(cls, desde_iso: str, hasta_iso: str, offset: int = 0, limite: int = 100) -> Dict[str, Any]:
        """Pagos de la cuenta actualizados en el rango (para la conciliación)."""
        params = {
            "range": "date_last_updated", "begin_date": desde_iso, "end_date": hasta_iso,
            "sort": "date_last_updated", "criteria": "asc", "offset": offset, "limit": limite,
        }
        resultado = cls._pedir("GET", "/v1/payments/search", params=params)
        if not resultado["success"]:
            return resultado
        datos = resultado["data"] or {}
        return {
            "success": True,
            "pagos": [cls._resumen_pago(p) for p in (datos.get("results") or [])],
            "total": (datos.get("paging") or {}).get("total", 0),
        }

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
    @classmethod
    def _datos_antifraude(
        cls, pagador: Optional[Dict[str, Any]], item: Optional[Dict[str, Any]], monto: int, descripcion: str,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        `(campos extra de payer, additional_info)` del pago. En modo prueba no
        se mandan los datos reales del usuario (mismo criterio que el email).
        """
        if not pagador or cls.modo_prueba():
            return {}, {}
        payer: Dict[str, Any] = {}
        info_payer: Dict[str, Any] = {}
        if pagador.get("nombre"):
            payer["first_name"] = info_payer["first_name"] = pagador["nombre"][:255]
        if pagador.get("apellido"):
            payer["last_name"] = info_payer["last_name"] = pagador["apellido"][:255]
        if pagador.get("rut"):
            payer["identification"] = {"type": "RUT", "number": pagador["rut"]}
        if pagador.get("telefono"):
            info_payer["phone"] = {"number": pagador["telefono"]}
        if pagador.get("registrado_en"):
            info_payer["registration_date"] = pagador["registrado_en"]

        additional_info: Dict[str, Any] = {
            "items": [{
                "id": (item or {}).get("id") or "arriendo",
                "title": ((item or {}).get("titulo") or descripcion)[:255],
                "description": ((item or {}).get("descripcion") or descripcion)[:255],
                "category_id": "services",
                "quantity": 1,
                "unit_price": int(monto),
            }],
        }
        if info_payer:
            additional_info["payer"] = info_payer
        return payer, additional_info

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
