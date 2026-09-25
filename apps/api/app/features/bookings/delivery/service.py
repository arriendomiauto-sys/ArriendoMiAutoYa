import hashlib
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException

logger = logging.getLogger(__name__)

from app.models.entities import Reserva, VerificacionEntrega, ChecklistAuto, Disputa, Pago, Auto, Usuario, FirmaContrato
from app.features.vehicles.catalog.pricing_service import PricingService
from app.features.system.storage.service import StorageService
from app.features.communications.notifications.service import crear_notificacion
from app.services import referidos
from app.features.payments import cargos_service


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
        codigo_limpio = (codigo_qr_hash or "").replace("-", "").replace(" ", "").strip().lower()
        reserva = db.query(Reserva).filter(
            (Reserva.codigo_qr_hash == codigo_qr_hash) | (Reserva.codigo_qr_hash == codigo_limpio)
        ).first()
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
        # Con bloqueo de fila: dos cierres simultáneos de la misma devolución
        # leerían ambos "en_curso" y crearían dos liquidaciones.
        reserva = db.query(Reserva).filter(Reserva.id == reserva_id).with_for_update().first()
        if not reserva:
            raise HTTPException(status_code=404, detail="Reserva no encontrada")

        # Este paso es el que deja la reserva en_curso/finalizada y crea la
        # liquidación del dueño: solo vale en el momento que le toca.
        #   confirmada --(antes)--> en_curso --(despues)--> finalizada
        # Sin esto se cerraba la devolución de reservas canceladas (ya
        # reembolsadas), sin pagar o nunca entregadas, y repetir el cierre
        # generaba una liquidación nueva cada vez.
        if tipo == "antes":
            if reserva.estado == "en_curso":
                raise HTTPException(status_code=409, detail="La entrega de esta reserva ya fue registrada.")
            if reserva.estado != "confirmada":
                raise HTTPException(
                    status_code=400,
                    detail=f"No se puede registrar la entrega de una reserva en estado '{reserva.estado}'.",
                )
            # El contrato se firma ACÁ, con las dos partes juntas y después de las fotos:
            # el arrendatario firma en el teléfono del dueño (trazo + selfie) y el dueño
            # firma con su huella justo antes de enviar (POST /firmar-contrato).
            from app.features.bookings.reservations import firma_service

            if not (firma_svg or "").strip():
                raise HTTPException(
                    status_code=400,
                    detail="Falta la firma del arrendatario: el contrato se firma al entregar el auto.",
                )
            firma_dueno = (
                db.query(FirmaContrato)
                .filter(FirmaContrato.reserva_id == reserva.id, FirmaContrato.rol == "arrendador")
                .first()
            )
            if not firma_dueno:
                raise HTTPException(
                    status_code=409,
                    detail="Falta tu firma como dueño: confírmala con tu huella para entregar el auto.",
                )

            # No se entrega el auto con una garantía a punto de vencer. Acá no se renueva
            # (haría commit y soltaría el bloqueo de la fila): ya lo intentó el barrido y,
            # si no pudo, el arrendatario la renueva desde la app con su CVV.
            from app.features.payments import garantia_renovacion

            hold = garantia_renovacion.hold_vigente(db, reserva)
            if hold and garantia_renovacion.necesita_renovacion(reserva, hold):
                raise HTTPException(
                    status_code=409,
                    detail={
                        "codigo": "GARANTIA_POR_RENOVAR",
                        "mensaje": (
                            "La garantía del arrendatario vence antes de que termine el arriendo. "
                            "Pídele que la renueve desde su reserva en la app (le pedirá el código "
                            "de seguridad de su tarjeta) y vuelve a intentar la entrega."
                        ),
                    },
                )

            # El segundo conductor también maneja el auto: sus antecedentes tienen que estar
            # aprobados (certificados oficiales; ver certificados_service).
            from app.core.config import settings

            conductor = reserva.segundo_conductor
            if settings.ANTECEDENTES_OBLIGATORIOS and conductor and conductor.antecedentes_estado != "limpio":
                raise HTTPException(
                    status_code=403,
                    detail={
                        "codigo": "ANTECEDENTES_PENDIENTES_CONDUCTOR",
                        "estado": conductor.antecedentes_estado or "pendiente",
                        "mensaje": (
                            "Los antecedentes del segundo conductor aún no están aprobados: "
                            "el titular debe subir su certificado de antecedentes y su hoja de vida."
                        ),
                    },
                )
        else:
            if reserva.estado == "finalizada":
                raise HTTPException(status_code=409, detail="La devolución de esta reserva ya fue registrada.")
            if reserva.estado != "en_curso":
                raise HTTPException(
                    status_code=400,
                    detail="No se puede registrar la devolución: el arriendo no está en curso.",
                )

        if len(fotos) < 1:
            raise HTTPException(
                status_code=400,
                detail="Debe adjuntar las fotografías del checklist obligatorio del vehículo."
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
            selfie_entrega_url=selfie_entrega_url,
        )
        db.add(checklist)

        cobro_info = None
        contrato_pdf = None
        if tipo == "antes":
            cliente_firma = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
            _, pdf_bytes = firma_service.registrar_firma(
                db, reserva, cliente_firma, "arrendatario", "escrita", firma_svg=firma_svg,
            )
            if firma_service.completar_si_corresponde(db, reserva):
                contrato_pdf = pdf_bytes
            reserva.estado = "en_curso"
            mensaje = "Contrato firmado y checklist inicial registrado. Arriendo iniciado (en_curso)."
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

            # Los cargos de la devolución (combustible, km, limpieza, atraso) y las
            # multas del arriendo se cobran de la garantía más abajo (cargos_service).
            # Antes acá se registraba un `cobro_final` "capturado" con una referencia
            # inventada sin tocar ninguna tarjeta, y se le pagaba al dueño igual.
            fines_pendientes = sum(int(p.monto or 0) for p in cargos_service.cargos_pendientes(db, reserva))
            extras_devolucion = int(cobro_info["cargo_limpieza"] or 0) + int(cobro_info["cargos_adicionales"] or 0)
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

            # Gestión de la garantía retenida (hold en tarjeta de crédito):
            # Si se reporta daño o existe una disputa abierta, la garantía NO se libera
            # y se mantiene retenida para respaldar la reparación tras revisión de soporte/admin.
            #
            # El hold se registra con tipo="hold_reserva" (ver checkout_service.py),
            # nunca "garantia" -- ese tipo no existe en ningún INSERT real, así que
            # este query nunca encontraba nada y la garantía jamás se liberaba solo.
            hay_disputa = bool(es_dano_reportado or disputa_existente)
            garantia_retenida = bool(
                db.query(Pago)
                .filter(Pago.reserva_id == reserva.id, Pago.tipo == "hold_reserva", Pago.estado == "retenido")
                .first()
            )
            # Sin disputa, los extras y las multas se descuentan de la garantía (captura
            # parcial, con tope en su monto) y el resto se libera. Con disputa no se toca:
            # sigue retenida hasta que soporte resuelva.
            resultado_garantia = cargos_service.saldar_garantia(
                db, reserva, extras=extras_devolucion, cobrar=not hay_disputa
            )
            garantia_liberada = False

            if hay_disputa:
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
                    mensaje=(
                        f"El dueño reportó una diferencia o daño en la devolución ({notas}). Tu garantía se hace "
                        "efectiva mientras el equipo de soporte evalúa el caso: al resolverlo se cobra solo lo que "
                        "corresponda y te devolvemos el resto a tu tarjeta."
                    ),
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
                        mensaje="Tu reporte fue recibido exitosamente. La garantía del arrendatario quedó asegurada a la espera de presupuestos y resolución de soporte.",
                        entidad_tipo="reserva",
                        entidad_id=reserva.id,
                        commit=False,
                    )
            elif garantia_retenida:
                garantia_liberada = resultado_garantia.garantia_liberada
                cobrado = resultado_garantia.cobrado
                if resultado_garantia.captura_pendiente:
                    titulo_g = "Procesando tu garantía"
                    mensaje_g = (
                        "Estamos procesando con Mercado Pago el descuento de los cargos del arriendo de tu garantía. "
                        "Apenas se complete te avisamos y se libera el remanente."
                    )
                elif cobrado > 0:
                    titulo_g = "Descuento de tu garantía"
                    mensaje_g = (
                        f"Se descontaron ${cobrado:,} CLP de tu garantía por los cargos del arriendo "
                        f"(combustible, kilómetros, limpieza, atraso o multas). La orden de liberación del remanente "
                        f"fue procesada de inmediato en la pasarela. Dependiendo de tu banco emisor, la reversa del cupo "
                        f"suele tardar entre 24 y 72 horas hábiles en reflejarse en tu estado de cuenta."
                    )
                else:
                    titulo_g = "Garantía liberada"
                    mensaje_g = (
                        "Tu garantía ha sido liberada exitosamente tras la entrega del vehículo. "
                        "La orden de liberación fue procesada inmediatamente en la pasarela; dependiendo de tu banco "
                        "emisor (Transbank/banco), la reversa del cupo suele tardar entre 24 y 72 horas hábiles en "
                        "reflejarse en tu estado de cuenta."
                    )
                crear_notificacion(
                    db,
                    usuario_id=reserva.cliente_id,
                    tipo="pago",
                    titulo=titulo_g,
                    mensaje=mensaje_g,
                    entidad_tipo="reserva",
                    entidad_id=reserva.id,
                    commit=False,
                )

            # Al dueño solo se le liquida lo que efectivamente se cobró: su parte del arriendo
            # más el 100 % de lo capturado por sus cargos (sin comisión).
            liquidacion_final = int(cobro_info["liquidacion_dueno"]) - extras_devolucion + resultado_garantia.cobrado
            reserva.liquidacion_dueno_clp = liquidacion_final
            reserva.cargos_adicionales_clp = int(cobro_info["cargos_adicionales"]) + fines_pendientes
            reserva.monto_cobro_final = monto_cobro_final + fines_pendientes
            cobro_info["liquidacion_dueno"] = liquidacion_final

            # Registrar liquidación para el dueño.
            # Nace siempre "pendiente": el depósito real lo gestiona liquidaciones_service
            # (enganche tras el commit + barrido de fondo/admin), nunca este flujo.
            db.add(Pago(
                reserva_id=reserva.id,
                usuario_id=auto.dueno_id if auto else reserva.cliente_id,
                tipo="liquidacion_dueno",
                monto=liquidacion_final,
                estado="pendiente",
            ))

            if dueno:
                bono_pct_dueno = referidos.calcular_bono_referido_pct(dueno, config_referidos)
                if bono_pct_dueno > 0:
                    db.add(Pago(
                        reserva_id=reserva.id,
                        usuario_id=dueno.id,
                        tipo="bono_referido",
                        monto=round(liquidacion_final * bono_pct_dueno / 100),
                        estado="pendiente",
                    ))

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
            descuento_msg = (
                f" Se descontaron ${resultado_garantia.cobrado:,} CLP de la garantía por los cargos del arriendo."
                if resultado_garantia.cobrado > 0 and not hay_disputa
                else ""
            )
            garantia_msg = descuento_msg + (
                " Garantía liberada inmediatamente."
                if garantia_liberada and not descuento_msg
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

        if tipo == "antes" and contrato_pdf:
            try:
                firma_service.enviar_contrato(reserva, contrato_pdf)
            except Exception:  # noqa: BLE001 — el correo nunca bloquea la entrega
                logger.exception("[ENTREGA] No se pudo enviar el contrato firmado de %s", reserva.id)

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
