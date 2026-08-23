import logging
from typing import Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

class TransbankService:
    INTEGRACION_URL = "https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions"
    PRODUCCION_URL = "https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions"

    @classmethod
    def _get_base_url(cls) -> str:
        if settings.TBK_ENVIRONMENT.upper() == "PRODUCCION":
            return cls.PRODUCCION_URL
        return cls.INTEGRACION_URL

    @classmethod
    def _get_headers(cls) -> Dict[str, str]:
        return {
            "Tbk-Api-Key-Id": settings.TBK_COMMERCE_CODE,
            "Tbk-Api-Key-Secret": settings.TBK_API_KEY,
            "Content-Type": "application/json"
        }

    @classmethod
    def crear_transaccion(
        cls,
        buy_order: str,
        session_id: str,
        amount: int,
        return_url: str
    ) -> Dict[str, Any]:
        """
        Inicia una transacción en Transbank Webpay Plus (Sandbox o Producción).
        Retorna la URL del formulario de pago y el token generado.
        """
        payload = {
            "buy_order": str(buy_order),
            "session_id": str(session_id),
            "amount": int(amount),
            "return_url": return_url
        }

        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.post(
                    cls._get_base_url(),
                    headers=cls._get_headers(),
                    json=payload
                )

                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Transacción Webpay creada con éxito: BuyOrder={buy_order}, Token={data.get('token')}")
                    return {
                        "success": True,
                        "token": data.get("token"),
                        "url": data.get("url"),
                        "buy_order": buy_order,
                        "amount": amount
                    }
                else:
                    logger.error(f"Error al crear transacción Webpay ({response.status_code}): {response.text}")
                    return {
                        "success": False,
                        "error": response.text,
                        "status_code": response.status_code
                    }
        except Exception as e:
            logger.error(f"Fallo de conexión con Transbank Webpay: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    @classmethod
    def confirmar_transaccion(cls, token_ws: str) -> Dict[str, Any]:
        """
        Confirma y captura una transacción una vez que el usuario completa el pago en Webpay.
        """
        if not token_ws:
            return {"success": False, "error": "Token vacío o inválido"}

        url = f"{cls._get_base_url()}/{token_ws}"

        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.put(url, headers=cls._get_headers())

                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status")
                    response_code = data.get("response_code")
                    es_autorizada = (status == "AUTHORIZED" and response_code == 0)

                    logger.info(f"Transacción Webpay confirmada: Token={token_ws}, Estado={status}, Autorizada={es_autorizada}")

                    return {
                        "success": True,
                        "autorizada": es_autorizada,
                        "status": status,
                        "response_code": response_code,
                        "amount": data.get("amount"),
                        "buy_order": data.get("buy_order"),
                        "authorization_code": data.get("authorization_code"),
                        "card_detail": data.get("card_detail"),
                        "transaction_date": data.get("transaction_date"),
                        "raw": data
                    }
                else:
                    logger.error(f"Error al confirmar transacción Webpay ({response.status_code}): {response.text}")
                    return {
                        "success": False,
                        "error": response.text,
                        "status_code": response.status_code
                    }
        except Exception as e:
            logger.error(f"Fallo de conexión al confirmar con Transbank: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    @classmethod
    def consultar_estado(cls, token_ws: str) -> Dict[str, Any]:
        """
        Consulta el estado actual de una transacción en Webpay Plus.
        """
        url = f"{cls._get_base_url()}/{token_ws}"
        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.get(url, headers=cls._get_headers())
                if response.status_code == 200:
                    return {"success": True, "data": response.json()}
                return {"success": False, "error": response.text}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @classmethod
    def anular_o_reembolsar(cls, token_ws: str, amount: Optional[int] = None) -> Dict[str, Any]:
        """
        Reembolsa total o parcialmente un pago en Webpay Plus.
        """
        url = f"{cls._get_base_url()}/{token_ws}/refunds"
        payload = {}
        if amount is not None:
            payload["amount"] = int(amount)

        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.post(url, headers=cls._get_headers(), json=payload)
                if response.status_code == 200:
                    return {"success": True, "data": response.json()}
                return {"success": False, "error": response.text}
        except Exception as e:
            return {"success": False, "error": str(e)}
