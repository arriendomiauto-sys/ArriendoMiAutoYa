import os
import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY


def clausula_peajes_tag(dias_cobro_posterior_peajes: int) -> str:
    """
    Cláusula que autoriza el cobro posterior de peajes y multas.

    Es la pieza legal que hace viable el cobro: no existe API nacional de TAG y
    las autopistas urbanas son de flujo libre, así que la boleta llega semanas
    después y siempre a nombre del titular de la patente. Sin esta autorización
    expresa la plataforma no puede cargarle nada al arrendatario una vez
    cerrada la reserva.
    """
    return (
        "<b>QUINTA — PEAJES, TAG Y MULTAS DE TRÁNSITO:</b> Los consumos de autopistas concesionadas (TAG y pórticos "
        "de flujo libre) y las infracciones cursadas por fotorradar u otros controles se notifican semanas después "
        "del hecho y siempre a nombre del titular de la patente, no del conductor. Por ello, el Arrendatario "
        "<b>autoriza expresamente</b> a Arrienda Tu Auto SpA a cargar a su tarjeta registrada los peajes y multas "
        f"generados entre la entrega y la devolución del vehículo, dentro de los <b>{dias_cobro_posterior_peajes} días</b> "
        "siguientes al término del arriendo. Todo cargo se respaldará con la boleta de la concesionaria o el parte "
        "cursado, que quedará disponible en el historial de la reserva. Vencido ese plazo, la plataforma no podrá "
        "imputar nuevos cargos por este concepto al Arrendatario."
    )

class ContractService:
    @staticmethod
    def generar_contrato_pdf(
        reserva_id: str,
        dueno_nombre: str,
        dueno_rut: str,
        dueno_telefono: str,
        cliente_nombre: str,
        cliente_rut: str,
        cliente_telefono: str,
        auto_marca: str,
        auto_modelo: str,
        auto_anio: int,
        auto_patente: str,
        fecha_inicio: datetime,
        fecha_fin: datetime,
        lugar_entrega: str,
        tarifa_dia_clp: int,
        dias: int,
        monto_total_estimado_clp: int,
        valor_uf_clp: float = 38000.0,
        dias_cobro_posterior_peajes: int = 60,
        output_path: str = None
    ) -> bytes:
        """
        Genera un contrato de arriendo temporal de vehículo motorizado P2P en PDF
        conforme a las leyes chilenas, póliza de deducible de 15 UF (50/50) y políticas de entrega.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            output_path or buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()

        # Estilos personalizados
        title_style = ParagraphStyle(
            "ContractTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#0F172A")
        )
        subtitle_style = ParagraphStyle(
            "ContractSubtitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=14,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#E11D2A")
        )
        section_heading = ParagraphStyle(
            "SectionHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#0F172A"),
            spaceBefore=8,
            spaceAfter=4
        )
        body_style = ParagraphStyle(
            "ContractBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            alignment=TA_JUSTIFY,
            textColor=colors.HexColor("#1E293B")
        )
        bold_body = ParagraphStyle(
            "BoldBody",
            parent=body_style,
            fontName="Helvetica-Bold"
        )

        story = []

        # 1. Cabecera del Documento
        story.append(Paragraph("CONTRATO DE ARRIENDO TEMPORAL DE VEHÍCULO MOTORIZADO (PEER-TO-PEER)", title_style))
        story.append(Paragraph(f"ARRIENDA TU AUTO CHILE SpA • CÓDIGO DE RESERVA: {reserva_id[:8].upper()}", subtitle_style))
        story.append(Spacer(1, 8))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#E11D2A"), spaceAfter=10))

        # 2. Comparecencia / Partes
        f_inicio_str = fecha_inicio.strftime("%d/%m/%Y %H:%M") if hasattr(fecha_inicio, "strftime") else str(fecha_inicio)
        f_fin_str = fecha_fin.strftime("%d/%m/%Y %H:%M") if hasattr(fecha_fin, "strftime") else str(fecha_fin)

        intro_text = (
            f"En la ciudad de Los Ángeles, Región del Biobío, Chile, comparecen por una parte como <b>ARRENDADOR (DUEÑO)</b> "
            f"don/doña <b>{dueno_nombre}</b>, Cédula de Identidad N° <b>{dueno_rut}</b>, fono {dueno_telefono}; y por la otra parte como "
            f"<b>ARRENDATARIO (CLIENTE)</b> don/doña <b>{cliente_nombre}</b>, Cédula de Identidad N° <b>{cliente_rut}</b>, "
            f"fono {cliente_telefono}; con la intermediación digital y garantía de la plataforma <b>Arrienda Tu Auto Chile SpA</b> "
            f"(RUT 77.891.234-5). Las partes convienen celebrar el presente contrato de arriendo bajo las siguientes cláusulas:"
        )
        story.append(Paragraph(intro_text, body_style))
        story.append(Spacer(1, 8))

        # 3. Tabla Resumen del Vehículo y Condiciones
        data_vehiculo = [
            [
                Paragraph("<b>Vehículo Arrendado:</b>", bold_body),
                Paragraph(f"{auto_marca} {auto_modelo} ({auto_anio})", body_style),
                Paragraph("<b>Patente Única:</b>", bold_body),
                Paragraph(f"<b>{auto_patente}</b>", bold_body)
            ],
            [
                Paragraph("<b>Fecha/Hora Inicio:</b>", bold_body),
                Paragraph(f_inicio_str, body_style),
                Paragraph("<b>Fecha/Hora Devolución:</b>", bold_body),
                Paragraph(f_fin_str, body_style)
            ],
            [
                Paragraph("<b>Lugar de Entrega:</b>", bold_body),
                Paragraph(lugar_entrega, body_style),
                Paragraph("<b>Duración / Tarifa:</b>", bold_body),
                Paragraph(f"{dias} días • ${tarifa_dia_clp:,.0f} CLP/día", body_style)
            ],
            [
                Paragraph("<b>Subtotal Arriendo:</b>", bold_body),
                Paragraph(f"<b>${monto_total_estimado_clp:,.0f} CLP</b>", bold_body),
                Paragraph("<b>Hold de Garantía:</b>", bold_body),
                Paragraph("<b>$800.000 CLP (Retenido)</b>", bold_body)
            ]
        ]
        t = Table(data_vehiculo, colWidths=[110, 150, 110, 170])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
            ("BOX", (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING", (0,0), (-1,-1), 6),
            ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ]))
        story.append(t)
        story.append(Spacer(1, 10))

        # 4. Cláusulas Principales
        clausula1 = (
            "<b>PRIMERA — OBJETO Y ENTREGA PRESENCIAL (P2P):</b> El Arrendador entrega en arriendo temporal el vehículo antes individualizado al Arrendatario. "
            "La entrega se efectúa de forma directa entre las partes, mediando verificación de identidad humana con código QR y foto oficial cacheada. "
            "El Arrendatario es el único conductor autorizado y declara poseer licencia chilena Clase B vigente."
        )
        story.append(Paragraph(clausula1, body_style))
        story.append(Spacer(1, 5))

        clausula2 = (
            "<b>SEGUNDA — CHECKLIST OBLIGATORIO DE 9 FOTOGRAFÍAS:</b> Antes de la entrega de llaves y al momento de la devolución, es condición esencial "
            "completar el checklist digital con un mínimo de <b>nueve (9) fotografías obligatorias</b>: 4 del exterior (frontal, trasera, lateral izquierdo, "
            "lateral derecho), 3 del interior (asientos delanteros, traseros y maletero), 1 del tablero (odómetro y nivel de combustible) y 1 de limpieza de alfombras/piso. "
            "Dichas fotografías constituyen la prueba fehaciente del estado del móvil para todo efecto legal o resolución de disputas."
        )
        story.append(Paragraph(clausula2, body_style))
        story.append(Spacer(1, 5))

        clausula3 = (
            "<b>TERCERA — POLÍTICA DE LIMPIEZA, COMBUSTIBLE Y KILOMETRAJE:</b> "
            "a) <u>Higiene</u>: El vehículo debe ser restituido en el mismo estado de aseo. De presentarse suciedad estándar (barro, polvo excesivo) o profunda (manchas en tapiz), "
            "se aplicará un cargo automático de $15.000 CLP o $35.000 CLP respectivamente, el cual se transfiere íntegramente (100%) al Arrendador para costear el lavado. "
            "El Arrendatario puede evitar este cobro lavando el auto antes de la devolución. "
            "b) <u>Combustible</u>: Se devolverá con el mismo nivel; cada 1/4 faltante se cobrará a $15.000 CLP transferidos al dueño. "
            "c) <u>Kilometraje</u>: Se incluyen 250 km por día de arriendo. El kilómetro excedente se factura a $120 CLP/km."
        )
        story.append(Paragraph(clausula3, body_style))
        story.append(Spacer(1, 5))

        deducible_pesos = 15 * valor_uf_clp
        mitad_deducible = deducible_pesos / 2
        clausula4 = (
            f"<b>CUARTA — SEGURO Y COBERTURA DE DEDUCIBLE (15 UF 50/50):</b> El móvil cuenta con póliza de seguro full cobertura con deducible fijado en "
            f"<b>15 UF</b> (~${deducible_pesos:,.0f} CLP al valor UF de referencia). En caso de siniestro, choque, hurto o daño amparado por la póliza, "
            f"el deducible se divide en partes iguales: <b>50% a cargo de Arrienda Tu Auto SpA (~${mitad_deducible:,.0f} CLP)</b> y <b>50% a cargo del Arrendador (~${mitad_deducible:,.0f} CLP)</b>. "
            f"El Arrendatario responderá con su Hold de Garantía de $800.000 CLP ante dolo, negligencia grave, consumo de alcohol/drogas o exclusiones directas de la póliza."
        )
        story.append(Paragraph(clausula4, body_style))
        story.append(Spacer(1, 5))

        story.append(Paragraph(clausula_peajes_tag(dias_cobro_posterior_peajes), body_style))
        story.append(Spacer(1, 5))

        clausula5 = (
            "<b>SEXTA — DEVOLUCIÓN, ATRASOS Y JURISDICCIÓN:</b> Se otorga un período de gracia de 30 minutos respecto de la hora de término pactada. "
            "Posterior a dicho lapso, se facturará la fracción horaria o el día adicional correspondiente. "
            "Para todos los efectos legales, las partes fijan su domicilio en la comuna de Los Ángeles, sometiéndose a la competencia de sus Tribunales de Justicia."
        )
        story.append(Paragraph(clausula5, body_style))
        story.append(Spacer(1, 14))

        # 5. Firmas Digitales
        firmas_data = [
            [
                Paragraph(f"____________________________________<br/><b>ARRENDADOR (DUEÑO)</b><br/>{dueno_nombre}<br/>RUT: {dueno_rut}<br/><i>Firmado Digitalmente con Clave / OTP</i>", body_style),
                Paragraph(f"____________________________________<br/><b>ARRENDATARIO (CLIENTE)</b><br/>{cliente_nombre}<br/>RUT: {cliente_rut}<br/><i>Firmado Digitalmente tras Enrolamiento OCR</i>", body_style)
            ]
        ]
        t_firmas = Table(firmas_data, colWidths=[270, 270])
        t_firmas.setStyle(TableStyle([
            ("ALIGN", (0,0), (-1,-1), "CENTER"),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
        ]))
        story.append(t_firmas)

        # Construir PDF
        doc.build(story)

        if not output_path:
            return buffer.getvalue()
        return None
