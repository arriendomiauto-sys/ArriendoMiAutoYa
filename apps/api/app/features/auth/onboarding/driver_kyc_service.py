import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.entities import ConductorAdicional, Reserva, TicketSoporte, Usuario
from app.core.validators import validar_documento_identidad
from app.features.auth.ocr.ocr_engine import OCRService
from app.features.auth.onboarding.license_service import evaluar_licencia_usuario
from app.features.vehicles.catalog.pricing_service import PricingService
from app.features.system.storage.service import StorageService

logger = logging.getLogger(__name__)


class ConductorKycService:
    """
    Servicio de verificación KYC completo para el Segundo Conductor / Conductor Adicional.
    
    Verifica:
    1. Cédula de Identidad / Carnet chileno (Módulo 11) o DNI/Pasaporte extranjero.
    2. OCR de carnet frontal y trasero.
    3. Licencia de conducir (vigencia hasta fin de reserva, clase B o equivalente, edad mínima).
    4. Selfie de validación biométrica facial.
    5. Consolidación de soporte: si hay dudas, abre un solo ticket de soporte para revisión manual.
    """

    @staticmethod
    def renovar_fotos_conductor(conductor: Optional[ConductorAdicional], db: Session) -> Optional[ConductorAdicional]:
        """
        Renueva las URLs firmadas de Supabase Storage de las fotos del conductor si vencen pronto.
        """
        if not conductor:
            return None
        
        cambiado = False
        for campo in ["carnet_frontal_url", "carnet_trasero_url", "licencia_url", "selfie_url"]:
            url_actual = getattr(conductor, campo, None)
            if url_actual:
                renovada = StorageService.renovar_si_vence_pronto(url_actual)
                if renovada and renovada != url_actual:
                    setattr(conductor, campo, renovada)
                    cambiado = True
        
        if cambiado:
            db.commit()
            db.refresh(conductor)
        return conductor

    @classmethod
    def procesar_kyc_conductor(
        cls,
        conductor: ConductorAdicional,
        reserva: Reserva,
        db: Session,
        crear_ticket_si_falla: bool = True
    ) -> Dict[str, Any]:
        """
        Ejecuta el flujo completo de validación y KYC para el segundo conductor.
        """
        es_chileno = (conductor.tipo_documento or "rut").lower() == "rut"
        numero_identidad = conductor.rut if es_chileno else conductor.numero_documento

        # 1. Validación de formato de documento de identidad
        valido_doc, motivo_doc = validar_documento_identidad(
            conductor.tipo_documento,
            numero_identidad,
            conductor.pais_documento or ("CL" if es_chileno else None)
        )
        if not valido_doc:
            conductor.estado_kyc = "rechazado"
            conductor.notas_auditoria = motivo_doc
            db.commit()
            return {
                "estado_kyc": "rechazado",
                "motivo": motivo_doc,
                "confianza_ocr": 0.0,
            }

        # 2. Identidad (cédula + selfie) y Licencia de Conducir
        #
        # Ambas tienen su propia sesión hosted de Didit, independientes entre
        # sí (crear_sesion_verificacion_segundo_conductor para la identidad,
        # crear_sesion_verificacion_licencia_segundo_conductor para la
        # licencia — workflows distintos, pueden aprobarse en momentos
        # distintos). Lo que Didit ya aprobó NO se vuelve a pasar por el OCR
        # casero de Google Vision; solo lo que falte por Didit cae a mano.
        identidad_por_didit = conductor.verificacion_externa_estado == "aprobada"
        licencia_por_didit = conductor.licencia_verificacion_externa_estado == "aprobada"

        resultado_ocr = {}
        if identidad_por_didit:
            lic_a_soporte = False
            if not licencia_por_didit and conductor.licencia_url:
                lic_bytes = OCRService.descargar_imagen_bytes(conductor.licencia_url)
                texto_lic, _ = OCRService.llamar_google_vision_api(lic_bytes) if lic_bytes else (None, 0.0)
                api_key, tiene_creds = OCRService._credenciales_vision()
                vision_on = bool(api_key or tiene_creds) and not settings.USE_OCR_MOCK
                lic_a_soporte = (
                    (vision_on and bool(lic_bytes) and not texto_lic)
                    or (bool(texto_lic) and OCRService.clasificar_documento(texto_lic) != "licencia")
                )
            resultado_ocr = {
                "estado_recomendado": "verificado",
                "documentos_legibles": True,
                "confianza_ocr": 0.99,
                "licencia_a_soporte": lic_a_soporte,
                "motivo": None,
            }
        elif conductor.carnet_frontal_url:
            try:
                resultado_ocr = OCRService.procesar_documentos_enrolamiento(
                    carnet_frontal_url=conductor.carnet_frontal_url,
                    carnet_trasero_url=conductor.carnet_trasero_url,
                    # Con la licencia ya aprobada por Didit no se le vuelve a
                    # pasar la URL al OCR casero — evita que Vision la
                    # reclasifique y la mande a revisión sin necesidad.
                    licencia_url=None if licencia_por_didit else conductor.licencia_url,
                    rut_usuario=conductor.rut,
                    selfie_url=conductor.selfie_url,
                    tipo_documento=conductor.tipo_documento,
                    pais_documento=conductor.pais_documento,
                )
                if licencia_por_didit:
                    resultado_ocr["licencia_a_soporte"] = False
            except Exception as e:
                logger.error("Error ejecutando OCR para conductor adicional: %s", e)
                resultado_ocr = {
                    "estado_recomendado": "requiere_revision_manual",
                    "motivo": f"Fallo al procesar OCR: {str(e)}",
                    "confianza_ocr": 0.5,
                }
        elif licencia_por_didit:
            # La licencia ya está por Didit pero aún falta la identidad
            # (cédula/selfie): no hay nada más que evaluar todavía.
            conductor.estado_kyc = "pendiente"
            conductor.notas_auditoria = "Falta la verificación de identidad (cédula + selfie)."
            db.commit()
            return {
                "estado_kyc": "pendiente",
                "motivo": conductor.notas_auditoria,
                "confianza_ocr": 0.0,
            }
        else:
            # Si aún no subió fotos ni tiene identidad por Didit, queda pendiente
            conductor.estado_kyc = "pendiente"
            conductor.notas_auditoria = "Faltan documentos por subir (cédula frontal y licencia)."
            db.commit()
            return {
                "estado_kyc": "pendiente",
                "motivo": conductor.notas_auditoria,
                "confianza_ocr": 0.0,
            }

        conductor.confianza_ocr = resultado_ocr.get("confianza_ocr", 0.95)

        # Si el OCR rechazó tajantemente (ej. imagen no válida, no es carnet)
        if resultado_ocr.get("estado_recomendado") == "rechazado":
            conductor.estado_kyc = "rechazado"
            conductor.notas_auditoria = resultado_ocr.get("motivo") or "Documentos ilegibles o no válidos."
            db.commit()
            return {
                "estado_kyc": "rechazado",
                "motivo": conductor.notas_auditoria,
                "confianza_ocr": conductor.confianza_ocr,
            }

        # 3. Evaluación de Licencia de Conducir (edad mínima, vigencia fin reserva, convenios)
        # Creamos un pseudo-usuario temporal para evaluar las reglas de licencia
        pseudo_user = Usuario(
            nombre=conductor.nombre,
            rut=conductor.rut,
            tipo_documento=conductor.tipo_documento,
            numero_documento=conductor.numero_documento,
            pais_documento=conductor.pais_documento,
            fecha_nacimiento=conductor.fecha_nacimiento,
            licencia_pais_emisor=conductor.licencia_pais_emisor or ("CL" if es_chileno else None),
            licencia_numero=conductor.licencia_numero,
            licencia_clase=conductor.licencia_clase or ("B" if es_chileno else None),
            licencia_vencimiento=conductor.licencia_vencimiento,
            pic_url=conductor.pic_url,
            pic_vencimiento=conductor.pic_vencimiento,
            es_residente_chile=conductor.es_residente_chile,
            fecha_inicio_residencia=conductor.fecha_inicio_residencia,
        )

        config = PricingService.obtener_configuracion(db)
        evaluacion_licencia = evaluar_licencia_usuario(
            pseudo_user,
            fecha_fin_reserva=reserva.fecha_fin,
            edad_minima=getattr(config, "edad_minima_arriendo", None) or 21,
        )

        # 4. Consolidación de problemas para revisión manual
        problemas: List[str] = []

        if resultado_ocr.get("estado_recomendado") == "requiere_revision_manual":
            problemas.append(
                f"Documento de identidad: {resultado_ocr.get('motivo') or 'requiere revisión manual'}."
            )

        if not evaluacion_licencia.get("permitido", False):
            problemas.append(f"Licencia de conducir: {evaluacion_licencia.get('motivo')}")

        if resultado_ocr.get("licencia_a_soporte") and conductor.licencia_url:
            problemas.append(
                f"Licencia de conducir: el OCR no la reconoció automáticamente. URL: {conductor.licencia_url}"
            )

        # 5. Determinación de estado final
        if problemas:
            conductor.estado_kyc = "requiere_revision_manual"
            conductor.notas_auditoria = " | ".join(problemas)

            if crear_ticket_si_falla:
                db.add(TicketSoporte(
                    usuario_id=reserva.cliente_id,
                    asunto=f"Revisión manual de Segundo Conductor (Reserva {reserva.id[:8]})",
                    descripcion=(
                        f"Segundo conductor '{conductor.nombre}' asignado a la reserva {reserva.id} "
                        f"requiere revisión manual de soporte ({len(problemas)} observaciones):\n\n"
                        + "\n".join(f"- {p}" for p in problemas)
                        + f"\n\nDocumentos adjuntos:\n"
                        + f"- Carnet frente: {conductor.carnet_frontal_url}\n"
                        + f"- Carnet reverso: {conductor.carnet_trasero_url}\n"
                        + f"- Licencia: {conductor.licencia_url}\n"
                        + f"- Selfie: {conductor.selfie_url}"
                    ),
                ))
        else:
            conductor.estado_kyc = "verificado"
            conductor.notas_auditoria = "Verificación KYC automática completada exitosamente."

        db.commit()
        db.refresh(conductor)

        return {
            "estado_kyc": conductor.estado_kyc,
            "motivo": conductor.notas_auditoria,
            "confianza_ocr": conductor.confianza_ocr,
            "problemas": problemas,
        }
