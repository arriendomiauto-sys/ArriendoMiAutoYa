import hashlib
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.entities import Reserva, VerificacionEntrega, ChecklistAuto, Disputa, Pago, Auto, Usuario
from app.services.pricing import PricingService
from app.services.storage import StorageService
from app.services import referidos


def _foto_perfil_vigente(cliente: Optional[Usuario], db: Session) -> Optional[str]:
    """
    La URL firmada de la selfie expira a los 7 días — sin renovarla, el
    dueño deja de poder ver la foto del cliente justo en el momento en que
    más importa: comparándola en persona antes de entregarle las llaves.
    """
    if not cliente:
        return None
    renovada = StorageService.renovar_si_vence_pronto(cliente.foto_perfil_verificada_url)
    if renovada and renovada != cliente.foto_perfil_verificada_url:
        cliente.foto_perfil_verificada_url = renovada
        db.commit()
    return cliente.foto_perfil_verificada_url

def _foto_segundo_conductor_vigente(conductor, db: Session) -> Optional[str]:
    if not conductor or not conductor.selfie_url:
        return None
    renovada = StorageService.renovar_si_vence_pronto(conductor.selfie_url)
    if renovada and renovada != conductor.selfie_url:
        conductor.selfie_url = renovada
        db.commit()
    return conductor.selfie_url

def _notificar_si_es_primera_finalizada(reserva: Reserva, db: Session) -> None:
    """
    Si esta es la primera Reserva "finalizada" del cliente (o del dueño del
    auto, según quién de los dos fue el invitado), refresca el reloj de
    bono de quien lo invitó. Se cuenta DESPUÉS del commit que puso
    reserva.estado = "finalizada", así que "== 1" significa que esta es la
    primera — evita depender de un flag aparte para no re-disparar.
    """
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()

    cliente = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    if cliente and cliente.referido_por_id:
        total_cliente = db.query(Reserva).filter(
            Reserva.cliente_id == cliente.id, Reserva.estado == "finalizada"
        ).count()
        if total_cliente == 1:
            referidos.notificar_primera_actividad(cliente, db)

    dueno = db.query(Usuario).filter(Usuario.id == auto.dueno_id).first() if auto else None
    if dueno and dueno.referido_por_id:
        total_dueno = db.query(Reserva).join(Auto, Reserva.auto_id == Auto.id).filter(
            Auto.dueno_id == dueno.id, Reserva.estado == "finalizada"
        ).count()
        if total_dueno == 1:
            referidos.notificar_primera_actividad(dueno, db)


def _segundo_conductor_info(reserva: Reserva, db: Session) -> Optional[Dict[str, Any]]:
    conductor = reserva.segundo_conductor
    if not conductor:
        return None
    return {
        "id": conductor.id,
        "nombre": conductor.nombre,
        "rut": conductor.rut,
        "tipo_documento": conductor.tipo_documento,
        "numero_documento": conductor.numero_documento,
        "licencia_clase": conductor.licencia_clase,
        "licencia_numero": conductor.licencia_numero,
        "estado_kyc": conductor.estado_kyc,
        "foto_perfil_url": _foto_segundo_conductor_vigente(conductor, db),
    }

class DeliveryService:
    @staticmethod
    def generar_codigo_qr(reserva_id: str, db: Session) -> Dict[str, Any]:
        reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
        if not reserva:
            raise HTTPException(status_code=404, detail="Reserva no encontrada")
        
        if reserva.estado not in ["confirmada", "en_curso"]:
            raise HTTPException(status_code=400, detail=f"No se puede generar código en estado '{reserva.estado}'")

        # Generar hash único para el QR
        raw = f"{reserva_id}:{datetime.now(timezone.utc).isoformat()}:{uuid.uuid4()}"
        qr_hash = hashlib.sha256(raw.encode()).hexdigest()[:32]
        
        reserva.codigo_qr_hash = qr_hash
        db.commit()
        db.refresh(reserva)

        cliente = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()

        return {
            "reserva_id": reserva.id,
            "codigo_qr_hash": qr_hash,
            "foto_perfil_verificada_url": _foto_perfil_vigente(cliente, db),
            "segundo_conductor": _segundo_conductor_info(reserva, db),
            "instrucciones": "Muestra este código QR al dueño en el momento de la entrega o devolución."
        }

    @staticmethod
    def validar_codigo_qr(codigo_qr_hash: str, db: Session) -> Dict[str, Any]:
        reserva = db.query(Reserva).filter(Reserva.codigo_qr_hash == codigo_qr_hash).first()
        if not reserva:
            raise HTTPException(status_code=404, detail="Código QR inválido o expirado")

        if reserva.estado not in ["confirmada", "en_curso"]:
            raise HTTPException(
                status_code=400, 
                detail=f"La reserva se encuentra en estado '{reserva.estado}', no está lista para entrega o devolución."
            )

        auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
        cliente = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()

        return {
            "reserva_id": reserva.id,
            "auto_marca": auto.marca if auto else "Desconocido",
            "auto_modelo": auto.modelo if auto else "Desconocido",
            "auto_patente": auto.patente if auto else "Desconocido",
            "cliente_nombre": cliente.nombre if cliente else "Cliente",
            "foto_perfil_verificada_url": _foto_perfil_vigente(cliente, db),
            "segundo_conductor": _segundo_conductor_info(reserva, db),
            "estado_reserva": reserva.estado,
            "lugar_entrega_acordado": reserva.lugar_entrega_acordado
        }

    @staticmethod
    def confirmar_verificacion(
        reserva_id: str,
        resultado: str,
        tipo: str,
        dueno_id: str,
        db: Session,
        foto_evidencia_url: Optional[str] = None,
        motivo_rechazo: Optional[str] = None
    ) -> Dict[str, Any]:
        reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
        if not reserva:
            raise HTTPException(status_code=404, detail="Reserva no encontrada")

        if resultado == "rechazada":
            if not motivo_rechazo:
                raise HTTPException(status_code=400, detail="Debe indicar el motivo del rechazo de identidad.")
            
            # Registrar verificación fallida
            verificacion = VerificacionEntrega(
                reserva_id=reserva_id,
                tipo=tipo,
                resultado="rechazada",
                foto_evidencia_url=foto_evidencia_url,
                motivo_rechazo=motivo_rechazo,
                dueno_id_que_verifica=dueno_id
            )
            db.add(verificacion)

            # Cambiar estado a disputada
            reserva.estado = "disputada"

            # Crear Disputa formal para revisión de Admin
            disputa = Disputa(
                reserva_id=reserva_id,
                tipo="no_coincidencia_identidad",
                estado="abierta",
                motivo=f"Rechazo en {tipo}: {motivo_rechazo}",
                foto_evidencia_url=foto_evidencia_url,
                evidencia_fotos=[foto_evidencia_url] if foto_evidencia_url else []
            )
            db.add(disputa)
            db.commit()
            db.refresh(disputa)

            return {
                "mensaje": "Identidad rechazada. La reserva ha sido bloqueada y se ha abierto una disputa para revisión de soporte/admin.",
                "estado_reserva": "disputada",
                "siguiente_paso": "bloqueado_esperando_resolucion",
                "disputa_id": disputa.id
            }

        # Resultado confirmado
        verificacion = VerificacionEntrega(
            reserva_id=reserva_id,
            tipo=tipo,
            resultado="confirmada",
            dueno_id_que_verifica=dueno_id
        )
        db.add(verificacion)
        db.commit()

        return {
            "mensaje": "Identidad confirmada exitosamente.",
            "estado_reserva": reserva.estado,
            "siguiente_paso": "checklist_fotos",
            "disputa_id": None
        }

    @staticmethod
    def registrar_checklist(
        reserva_id: str,
        tipo: str,
        fotos: List[str],
        kilometraje: int,
        nivel_combustible: str,
        notas: Optional[str],
        db: Session,
        estado_limpieza: str = "limpio",
        cargo_limpieza_clp: Optional[int] = None,
        firma_svg: Optional[str] = None,
    ) -> Dict[str, Any]:
        reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
        if not reserva:
            raise HTTPException(status_code=404, detail="Reserva no encontrada")

        if len(fotos) < 1:
            raise HTTPException(
                status_code=400,
                detail="Debe adjuntar las fotografías del checklist obligatorio del vehículo."
            )

        # La app ya deshabilita el botón de "Firmar y entregar las llaves"
        # sin un trazo — esto es la misma exigencia del lado servidor, para
        # no depender solo de que el cliente se comporte.
        if tipo == "antes" and not (firma_svg or "").strip():
            raise HTTPException(
                status_code=400,
                detail="Falta la firma del contrato antes de registrar la entrega.",
            )

        cargo_limpieza = cargo_limpieza_clp if cargo_limpieza_clp is not None else PricingService.obtener_cargo_limpieza(estado_limpieza, db)

        checklist = ChecklistAuto(
            reserva_id=reserva_id,
            tipo=tipo,
            fotos=fotos,
            kilometraje=kilometraje,
            nivel_combustible=nivel_combustible,
            estado_limpieza=estado_limpieza,
            cargo_limpieza_clp=cargo_limpieza,
            notas=notas,
            firma_svg=firma_svg,
        )
        db.add(checklist)

        cobro_info = None
        if tipo == "antes":
            reserva.estado = "en_curso"
            mensaje = "Checklist inicial completado con éxito. Arriendo iniciado (en_curso)."
        else: # "despues" (devolución)
            reserva.estado = "finalizada"
            auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
            tarifa_dia = auto.tarifa_dia if auto else 35000
            dias = PricingService.calcular_dias_reserva(reserva.fecha_inicio, reserva.fecha_fin)

            # Buscar checklist inicial para contrastar odómetro y combustible
            checklist_inicial = db.query(ChecklistAuto).filter(
                ChecklistAuto.reserva_id == reserva_id,
                ChecklistAuto.tipo == "antes"
            ).first()

            km_inicial = checklist_inicial.kilometraje if checklist_inicial else kilometraje
            comb_inicial = checklist_inicial.nivel_combustible if checklist_inicial else nivel_combustible

            # Calcular cobros adicionales
            cargo_combustible = PricingService.calcular_cargo_combustible(comb_inicial, nivel_combustible, db)
            cargo_km_extra = PricingService.calcular_cargo_km_extra(km_inicial, kilometraje, dias, db)
            cargo_atraso = PricingService.calcular_cargo_atraso(reserva.fecha_fin, datetime.now(timezone.utc), tarifa_dia, db)

            cobro_info = PricingService.calcular_cobro_final(
                tarifa_dia=tarifa_dia,
                dias=dias,
                estado_limpieza=estado_limpieza,
                cargo_combustible=cargo_combustible,
                cargo_km_extra=cargo_km_extra,
                cargo_atraso=cargo_atraso,
                db=db
            )

            # Bono/descuento de invitación (ver app/services/referidos.py):
            # el descuento del cliente reduce lo que se le cobra a él, nunca
            # lo que recibe el dueño (la diferencia la absorbe la
            # plataforma); el bono del dueño va como Pago aparte, nunca
            # modifica pago_liq — así ambos quedan auditables y reversibles
            # sin tocar el cálculo de comisión normal.
            config_referidos = PricingService.obtener_configuracion(db)
            cliente = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
            descuento_pct_cliente = referidos.calcular_bono_referido_pct(cliente, config_referidos) if cliente else 0.0
            monto_cobro_final = round(cobro_info["monto_total_cobro"] * (1 - descuento_pct_cliente / 100))

            reserva.monto_cobro_final = monto_cobro_final
            reserva.cargo_limpieza_clp = cobro_info["cargo_limpieza"]
            reserva.cargo_combustible_clp = cargo_combustible
            reserva.cargo_km_extra_clp = cargo_km_extra
            reserva.cargo_atraso_clp = cargo_atraso
            reserva.cargos_adicionales_clp = cobro_info["cargos_adicionales"]
            reserva.liquidacion_dueno_clp = cobro_info["liquidacion_dueno"]

            # Registrar cobro final al cliente (ya con su descuento aplicado)
            pago_cobro = Pago(
                reserva_id=reserva.id,
                usuario_id=reserva.cliente_id,
                tipo="cobro_final",
                monto=monto_cobro_final,
                estado="capturado",
                referencia_pago=f"MP-{uuid.uuid4().hex[:8].upper()}"
            )
            # Registrar liquidación para el dueño (incluye el 100% de compensaciones por limpieza, combustible y km)
            pago_liq = Pago(
                reserva_id=reserva.id,
                usuario_id=auto.dueno_id if auto else reserva.cliente_id,
                tipo="liquidacion_dueno",
                monto=cobro_info["liquidacion_dueno"],
                estado="pendiente"
            )
            db.add(pago_cobro)
            db.add(pago_liq)

            dueno = db.query(Usuario).filter(Usuario.id == auto.dueno_id).first() if auto else None
            if dueno:
                bono_pct_dueno = referidos.calcular_bono_referido_pct(dueno, config_referidos)
                if bono_pct_dueno > 0:
                    db.add(Pago(
                        reserva_id=reserva.id,
                        usuario_id=dueno.id,
                        tipo="bono_referido",
                        monto=round(cobro_info["liquidacion_dueno"] * bono_pct_dueno / 100),
                        estado="pendiente",
                    ))

            limpieza_msg = f" Cargo por limpieza: ${cargo_limpieza:,} CLP." if cargo_limpieza > 0 else ""
            comb_msg = f" Combustible faltante: ${cargo_combustible:,} CLP." if cargo_combustible > 0 else ""
            mensaje = f"Checklist final completado. Arriendo finalizado.{limpieza_msg}{comb_msg}"

        db.commit()
        db.refresh(reserva)

        if reserva.estado == "finalizada":
            _notificar_si_es_primera_finalizada(reserva, db)

        return {
            "mensaje": mensaje,
            "estado_reserva": reserva.estado,
            "monto_cobro_final": cobro_info["monto_total_cobro"] if cobro_info else None,
            "cargo_limpieza": cobro_info["cargo_limpieza"] if cobro_info else None,
            "cargo_combustible": cobro_info["cargo_combustible"] if cobro_info else None,
            "cargo_km_extra": cobro_info["cargo_km_extra"] if cobro_info else None,
            "cargo_atraso": cobro_info["cargo_atraso"] if cobro_info else None,
            "liquidacion_dueno": cobro_info["liquidacion_dueno"] if cobro_info else None
        }
