import hashlib
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

from app.models.entities import Reserva, VerificacionEntrega, ChecklistAuto, Disputa, Pago, Auto, Usuario
from app.features.vehicles.catalog.pricing_service import PricingService
from app.features.system.storage.service import StorageService
from app.features.communications.notifications.service import crear_notificacion
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

        # Generar hash único para el QR con vigencia estricta de 2 minutos (120s)
        ahora = datetime.now(timezone.utc)
        expira_en = ahora + timedelta(minutes=2)
        raw = f"{reserva_id}:{ahora.isoformat()}:{uuid.uuid4()}"
        qr_hash = hashlib.sha256(raw.encode()).hexdigest()[:32]
        
        reserva.codigo_qr_hash = qr_hash
        reserva.codigo_qr_expira_en = expira_en
        db.commit()
        db.refresh(reserva)

        cliente = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()

        return {
            "reserva_id": reserva.id,
            "codigo_qr_hash": qr_hash,
            "expira_en": expira_en,
            "validez_segundos": 120,
            "foto_perfil_verificada_url": _foto_perfil_vigente(cliente, db),
            "segundo_conductor": _segundo_conductor_info(reserva, db),
            "instrucciones": "Muestra este código QR al dueño en el momento de la entrega o devolución."
        }

    @staticmethod
    def validar_codigo_qr(codigo_qr_hash: str, db: Session) -> Dict[str, Any]:
        reserva = db.query(Reserva).filter(Reserva.codigo_qr_hash == codigo_qr_hash).first()
        if not reserva:
            raise HTTPException(status_code=404, detail="Código QR inválido o expirado")

        # Validación estricta de expiración (2 minutos)
        if reserva.codigo_qr_expira_en:
            expira_con_tz = reserva.codigo_qr_expira_en
            if expira_con_tz.tzinfo is None:
                expira_con_tz = expira_con_tz.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > expira_con_tz:
                reserva.codigo_qr_hash = None
                reserva.codigo_qr_expira_en = None
                db.commit()
                raise HTTPException(
                    status_code=400,
                    detail="El código QR ha expirado (validez máxima de 2 minutos). Genera uno nuevo en la app."
                )

        if reserva.estado not in ["confirmada", "en_curso"]:
            raise HTTPException(
                status_code=400, 
                detail=f"La reserva se encuentra en estado '{reserva.estado}', no está lista para entrega o devolución."
            )

        auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
        cliente = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()

        from app.models.entities import FirmaContrato
        firma_cliente = (
            db.query(FirmaContrato)
            .filter(
                FirmaContrato.reserva_id == reserva.id,
                FirmaContrato.rol == "arrendatario",
            )
            .first()
        )
        arrendatario_ya_firmo = bool(firma_cliente or reserva.fecha_firma_biometrica)

        return {
            "reserva_id": reserva.id,
            "auto_marca": auto.marca if auto else "Desconocido",
            "auto_modelo": auto.modelo if auto else "Desconocido",
            "auto_patente": auto.patente if auto else "Desconocido",
            "cliente_nombre": cliente.nombre if cliente else "Cliente",
            "foto_perfil_verificada_url": _foto_perfil_vigente(cliente, db),
            "segundo_conductor": _segundo_conductor_info(reserva, db),
            "estado_reserva": reserva.estado,
            "lugar_entrega_acordado": reserva.lugar_entrega_acordado,
            "arrendatario_ya_firmo": arrendatario_ya_firmo,
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
        selfie_entrega_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
        if not reserva:
            raise HTTPException(status_code=404, detail="Reserva no encontrada")

        if len(fotos) < 1:
            raise HTTPException(
                status_code=400,
                detail="Debe adjuntar las fotografías del checklist obligatorio del vehículo."
            )

        # El contrato tiene que estar firmado por el arrendatario antes de
        # entregar el vehículo. Vale como firma cualquiera de las dos vías:
        #  - una firma ya registrada vía POST /reservas/{id}/firmar-contrato
        #    (huella / facial / escrita, hecha en el teléfono del cliente), o
        #  - el trazo `firma_svg` que se captura en persona en esta entrega.
        if tipo == "antes":
            from app.models.entities import FirmaContrato

            firma_cliente = (
                db.query(FirmaContrato)
                .filter(
                    FirmaContrato.reserva_id == reserva_id,
                    FirmaContrato.rol == "arrendatario",
                )
                .first()
            )
            if not firma_cliente and not (firma_svg or "").strip():
                raise HTTPException(
                    status_code=400,
                    detail="El arrendatario aún no firmó el contrato. No se puede registrar la entrega.",
                )
            # Firma capturada en persona y sin registro previo: se deja
            # constancia como firma manuscrita del arrendatario.
            if not firma_cliente and (firma_svg or "").strip():
                db.add(FirmaContrato(
                    reserva_id=reserva_id,
                    usuario_id=reserva.cliente_id,
                    rol="arrendatario",
                    metodo="escrita",
                    firma_svg=firma_svg,
                    hash_contrato_sha256=reserva.hash_contrato_sha256,
                    firmado_en=datetime.now(timezone.utc),
                ))

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
            selfie_entrega_url=selfie_entrega_url,
        )
        db.add(checklist)

        cobro_info = None
        if tipo == "antes":
            reserva.estado = "en_curso"
            if not reserva.fecha_firma_biometrica:
                reserva.fecha_firma_biometrica = datetime.now(timezone.utc)
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
            # Detección de reporte de daños o anomalías en la devolución
            es_dano_reportado = bool(
                notas and (
                    notas.strip().startswith("[")
                    or any(palabra in notas.lower() for palabra in (
                        "daño", "dano", "golpe", "rayón", "rayon", "choque",
                        "vidrio", "neumático", "neumatico", "avería", "averia", "siniestro"
                    ))
                )
            )
            disputa_existente = (
                db.query(Disputa)
                .filter(Disputa.reserva_id == reserva.id, Disputa.estado == "abierta")
                .first()
            )

            dueno = db.query(Usuario).filter(Usuario.id == auto.dueno_id).first() if auto else None

            # Registrar liquidación para el dueño (incluye el 100% de compensaciones por limpieza, combustible y km).
            # Nace siempre "pendiente": el depósito real lo gestiona liquidaciones_service
            # (enganche tras el commit + barrido de fondo/admin), nunca este flujo.
            pago_liq = Pago(
                reserva_id=reserva.id,
                usuario_id=auto.dueno_id if auto else reserva.cliente_id,
                tipo="liquidacion_dueno",
                monto=cobro_info["liquidacion_dueno"],
                estado="pendiente",
            )
            db.add(pago_cobro)
            db.add(pago_liq)

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

            # Gestión de la garantía retenida (hold en tarjeta de crédito):
            # Si se reporta daño o existe una disputa abierta, la garantía NO se libera
            # y se mantiene retenida para respaldar la reparación tras revisión de soporte/admin.
            pago_garantia = (
                db.query(Pago)
                .filter(Pago.reserva_id == reserva.id, Pago.tipo == "garantia", Pago.estado == "retenido")
                .first()
            )
            garantia_liberada = False

            if es_dano_reportado or disputa_existente:
                if not disputa_existente:
                    disputa = Disputa(
                        reserva_id=reserva.id,
                        tipo="dano",
                        estado="abierta",
                        motivo=f"Reporte en devolución: {notas}",
                        evidencia_fotos=fotos or [],
                        foto_evidencia_url=fotos[0] if fotos else None,
                    )
                    db.add(disputa)
                reserva.estado = "disputada"
                crear_notificacion(
                    db,
                    usuario_id=reserva.cliente_id,
                    tipo="disputa",
                    titulo="Garantía retenida por reporte en devolución",
                    mensaje=f"El dueño reportó una diferencia o daño en la devolución ({notas}). Tu garantía se mantendrá retenida mientras el equipo de soporte evalúa el caso.",
                    entidad_tipo="reserva",
                    entidad_id=reserva.id,
                    commit=False,
                )
                if auto and auto.dueno_id:
                    crear_notificacion(
                        db,
                        usuario_id=auto.dueno_id,
                        tipo="disputa",
                        titulo="Reporte de daño registrado",
                        mensaje="Tu reporte fue recibido exitosamente. La garantía del arrendatario permanecerá retenida a la espera de presupuestos y resolución de soporte.",
                        entidad_tipo="reserva",
                        entidad_id=reserva.id,
                        commit=False,
                    )
            elif pago_garantia:
                try:
                    from app.features.payments.mercadopago_service import MercadoPagoService
                    from app.services import pagos_simulados
                    ref = pago_garantia.referencia_pago
                    if ref and not pagos_simulados.es_pago_simulado(ref):
                        MercadoPagoService.liberar_hold(ref)
                    pago_garantia.estado = "liberado"
                    garantia_liberada = True
                    crear_notificacion(
                        db,
                        usuario_id=reserva.cliente_id,
                        tipo="pago",
                        titulo="Garantía liberada",
                        mensaje=f"Tu garantía de ${pago_garantia.monto:,} CLP ha sido liberada exitosamente tras la entrega del vehículo.",
                        entidad_tipo="reserva",
                        entidad_id=reserva.id,
                        commit=False,
                    )
                except Exception as e:
                    logger.error("[DELIVERY] Error al liberar hold de garantía para reserva %s: %s", reserva.id, e)

            # La notificación al dueño sobre su liquidación (transferida o a la
            # espera de cuenta bancaria) la emite ahora liquidaciones_service.

            # Incentivo por entrega en óptimas condiciones:
            # Sin daños reportados, combustible igual o mayor al recibido, vehículo limpio y sin atraso
            devolucion_optima = (
                not es_dano_reportado
                and not disputa_existente
                and comb_inicial is not None
                and nivel_combustible is not None
                and nivel_combustible >= comb_inicial
                and str(estado_limpieza).lower() in ("optimo", "limpio", "excelente", "bueno")
                and cargo_atraso == 0
            )

            limpieza_msg = f" Cargo por limpieza: ${cargo_limpieza:,} CLP." if cargo_limpieza > 0 else ""
            comb_msg = f" Combustible faltante: ${cargo_combustible:,} CLP." if cargo_combustible > 0 else ""
            garantia_msg = (
                " Garantía liberada inmediatamente."
                if garantia_liberada
                else (" Garantía retenida por reporte de daño." if es_dano_reportado else "")
            )
            premio_msg = " ¡Felicitaciones por entregar el vehículo en óptimas condiciones! Tienes un beneficio en tu próximo arriendo." if devolucion_optima else ""

            if devolucion_optima:
                crear_notificacion(
                    db,
                    usuario_id=reserva.cliente_id,
                    tipo="premio",
                    titulo="¡Vehículo devuelto en óptimas condiciones!",
                    mensaje="Entregaste el vehículo con el estanque completo y en excelente estado. Tu garantía fue liberada de inmediato y cuentas con un beneficio especial en tu próximo arriendo.",
                    entidad_tipo="reserva",
                    entidad_id=reserva.id,
                    commit=False,
                )

            mensaje = f"Checklist final completado. Arriendo finalizado.{limpieza_msg}{comb_msg}{garantia_msg}{premio_msg}"

        db.commit()
        db.refresh(reserva)

        # Enganche con el depósito automático al dueño: best-effort, nunca
        # bloquea el cierre de la devolución (no-op salvo BCI_PAYOUTS_HABILITADO).
        # Solo en una devolución que quedó "finalizada": si hubo daño/disputa la
        # reserva pasa a "disputada" y la liquidación no se paga hasta resolverla.
        if tipo != "antes" and reserva.estado == "finalizada":
            try:
                from app.features.payments import liquidaciones_service
                pago_liq_row = (
                    db.query(Pago)
                    .filter(Pago.reserva_id == reserva.id, Pago.tipo == "liquidacion_dueno")
                    .order_by(Pago.timestamp.desc())
                    .first()
                )
                if pago_liq_row:
                    liquidaciones_service.intentar_liquidar(db, pago_liq_row)
            except Exception:  # noqa: BLE001
                logger.exception("[DELIVERY] intentar_liquidar falló (no bloqueante)")

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
