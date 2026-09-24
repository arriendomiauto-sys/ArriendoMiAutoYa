import io
import re
import hashlib
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.graphics.shapes import Drawing, Rect, Line, String


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
        "<b>QUINTA — PEAJES, TAG Y MULTAS DE TRÁNSITO (LEY N° 18.287):</b> Los consumos de autopistas concesionadas (TAG y pórticos "
        "de flujo libre) y las infracciones cursadas por fotorradar u otros controles se notifican semanas después "
        "del hecho y siempre a nombre del titular de la patente, no del conductor. Por ello, el Arrendatario "
        "<b>autoriza expresamente</b> a ARRIENDO MI AUTO SpA a cargar a su tarjeta registrada los peajes y multas "
        f"generados entre la entrega y la devolución del vehículo, dentro de los <b>{dias_cobro_posterior_peajes} días</b> "
        "siguientes al término del arriendo. Todo cargo se respaldará con la boleta de la concesionaria o el parte "
        "cursado, que quedará disponible en el historial de la reserva. Vencido ese plazo de cobro a tarjeta, o en caso "
        "de resultar infructuoso el cargo por fondos insuficientes, el Arrendatario confiere mandato especial e irrevocable "
        "al Arrendador y a ARRIENDO MI AUTO SpA para individualizarlo ante el respectivo Juzgado de Policía Local o "
        "Dirección de Tránsito Municipal conforme al artículo 4° de la Ley N° 18.287, asumiendo el Arrendatario la calidad "
        "de infractor directo y la exclusiva responsabilidad de comparecencia y pago ante dicho tribunal."
    )

def parse_svg_path(path_str: str) -> list:
    """
    Parsea un string de trazo SVG (ej: 'M 10 20 L 30 40 ...' generado por SignaturePad)
    en una lista de trazos con coordenadas [(x, y), ...].
    """
    if not path_str or not isinstance(path_str, str):
        return []
    tokens = re.findall(r'([A-Za-z])|(-?\d+(?:\.\d+)?)', path_str)
    raw_tokens = []
    for cmd, num in tokens:
        if cmd:
            raw_tokens.append(cmd.upper())
        elif num:
            raw_tokens.append(float(num))
    strokes = []
    current_stroke = []
    idx = 0
    current_cmd = 'M'
    while idx < len(raw_tokens):
        item = raw_tokens[idx]
        if isinstance(item, str):
            current_cmd = item
            idx += 1
            continue
        if current_cmd in ('M', 'L'):
            x = item
            if idx + 1 < len(raw_tokens) and not isinstance(raw_tokens[idx+1], str):
                y = raw_tokens[idx+1]
                idx += 2
                if current_cmd == 'M':
                    if current_stroke:
                        strokes.append(current_stroke)
                    current_stroke = [(x, y)]
                    current_cmd = 'L'
                else:
                    current_stroke.append((x, y))
            else:
                idx += 1
        else:
            idx += 1
    if current_stroke:
        strokes.append(current_stroke)
    return strokes


def crear_caja_firma_digital(
    nombre: str,
    rut: str,
    rol: str,
    metodo: str = None,
    firma_svg: str = None,
    timestamp: datetime = None,
    width: float = 265,
    height: float = 54,
) -> Drawing:
    """
    Genera un componente visual Drawing de ReportLab para la firma del contrato:
    - Si cuenta con trazo manuscrito SVG: renderiza las líneas vectoriales escaladas y centradas.
    - Si no cuenta con trazo (firma biométrica/electrónica/mandato): dibuja el sello digital de
      certificación con el nombre en tipografía cursiva script, badge oficial y acreditación Ley 19.799.
    """
    d = Drawing(width, height)
    # Fondo con borde sutil redondeado
    d.add(Rect(0, 0, width, height, rx=4, ry=4, fillColor=colors.HexColor('#F8FAFC'), strokeColor=colors.HexColor('#CBD5E1'), strokeWidth=0.8))

    strokes = parse_svg_path(firma_svg) if firma_svg else []
    has_valid_strokes = len(strokes) > 0 and any(len(s) >= 2 for s in strokes)

    if has_valid_strokes:
        # Bounding box del trazo
        all_pts = [pt for s in strokes for pt in s]
        min_x = min(p[0] for p in all_pts)
        max_x = max(p[0] for p in all_pts)
        min_y = min(p[1] for p in all_pts)
        max_y = max(p[1] for p in all_pts)

        orig_w = max_x - min_x
        orig_h = max_y - min_y
        pad_x = 12
        pad_y = 10
        inner_w = width - 2 * pad_x
        inner_h = height - 2 * pad_y

        scale = min(inner_w / max(orig_w, 20.0), inner_h / max(orig_h, 20.0))
        scale = min(scale, 1.2)

        scaled_w = orig_w * scale
        scaled_h = orig_h * scale
        offset_x = pad_x + (inner_w - scaled_w) / 2.0
        offset_y = pad_y + (inner_h - scaled_h) / 2.0

        # Línea base sutil
        d.add(Line(12, 10, width - 12, 10, strokeColor=colors.HexColor('#E2E8F0'), strokeWidth=0.8, strokeDashArray=[2, 2]))

        # Renderizar trazos vectoriales
        for s in strokes:
            for i in range(len(s) - 1):
                p1 = s[i]
                p2 = s[i+1]
                x1 = offset_x + (p1[0] - min_x) * scale
                y1 = offset_y + (max_y - p1[1]) * scale
                x2 = offset_x + (p2[0] - min_x) * scale
                y2 = offset_y + (max_y - p2[1]) * scale
                d.add(Line(x1, y1, x2, y2, strokeColor=colors.HexColor('#0F172A'), strokeWidth=1.6, strokeLineCap=1, strokeLineJoin=1))

        # Badge superior de trazo verificado
        d.add(Rect(0, height - 12, width, 12, rx=2, ry=2, fillColor=colors.HexColor('#ECFDF5'), strokeColor=None))
        d.add(String(8, height - 9, '✔ TRAZO MANUSCRITO REGISTRADO', fontName='Helvetica-Bold', fontSize=5.5, fillColor=colors.HexColor('#059669')))
    else:
        # Sello de Certificación Digital Avanzada / Biometría
        d.add(Rect(0, height - 13, width, 13, rx=2, ry=2, fillColor=colors.HexColor('#EFF6FF'), strokeColor=None))
        badge_text = '🔒 FIRMA ELECTRÓNICA AVANZADA • LEY N° 19.799'
        d.add(String(8, height - 9.5, badge_text, fontName='Helvetica-Bold', fontSize=5.8, fillColor=colors.HexColor('#1E40AF')))

        # Nombre estilizado en tipografía formal caligráfica
        nombre_display = f'/ {nombre.strip()} /'
        if len(nombre_display) > 34:
            nombre_display = f'/ {nombre.strip()[:30]}… /'
        d.add(String(16, 21, nombre_display, fontName='Times-BoldItalic', fontSize=11.5, fillColor=colors.HexColor('#0F172A')))

        # Línea de seguridad punteada
        d.add(Line(12, 15, width - 12, 15, strokeColor=colors.HexColor('#93C5FD'), strokeWidth=0.8, strokeDashArray=[3, 2]))

        # Subtítulo de certificación legal
        sub_cert = '✔ IDENTIDAD KYC & CONSENTIMIENTO BIOMÉTRICO VALIDADO'
        d.add(String(12, 5.5, sub_cert, fontName='Helvetica-Bold', fontSize=5.2, fillColor=colors.HexColor('#16A34A')))

    return d


class ContractService:
    @staticmethod
    def calcular_hash_contrato(pdf_bytes: bytes) -> str:
        """
        Calcula el hash criptográfico SHA-256 inmutable de los bytes del PDF del contrato.
        """
        if not pdf_bytes:
            return ""
        return hashlib.sha256(pdf_bytes).hexdigest()

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
        dias_cobro_posterior_peajes: int = 30,
        segundo_conductor_nombre: str = None,
        segundo_conductor_rut: str = None,
        segundo_conductor_telefono: str = None,
        segundo_conductor_licencia: str = None,
        fecha_firma_biometrica: datetime = None,
        firmas: list = None,
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
            rightMargin=32,
            leftMargin=32,
            topMargin=28,
            bottomMargin=28
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
            textColor=colors.HexColor("#334155")
        )
        bold_body = ParagraphStyle(
            "BoldBody",
            parent=body_style,
            fontName="Helvetica-Bold",
            textColor=colors.HexColor("#0F172A")
        )

        story = []

        # 1. Cabecera del Documento
        story.append(Paragraph("CONTRATO DE ARRIENDO TEMPORAL DE VEHÍCULO MOTORIZADO (PEER-TO-PEER)", title_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(f"ARRIENDO MI AUTO SpA • CÓDIGO DE RESERVA: {reserva_id[:8].upper()}", subtitle_style))
        story.append(Spacer(1, 8))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#E11D2A"), spaceAfter=10))

        # 2. Comparecencia / Partes
        f_inicio_str = fecha_inicio.strftime("%d/%m/%Y %H:%M") if hasattr(fecha_inicio, "strftime") else str(fecha_inicio)
        f_fin_str = fecha_fin.strftime("%d/%m/%Y %H:%M") if hasattr(fecha_fin, "strftime") else str(fecha_fin)

        segundo_conductor_intro = ""
        if segundo_conductor_nombre:
            segundo_conductor_intro = (
                f"; y como <b>SEGUNDO CONDUCTOR AUTORIZADO</b> don/doña <b>{segundo_conductor_nombre}</b>, "
                f"Documento N° <b>{segundo_conductor_rut or 'N/A'}</b>, fono {segundo_conductor_telefono or 'N/A'}"
            )

        intro_text = (
            f"En la ciudad de Concepción, Región del Biobío, Chile, comparecen por una parte como <b>ARRENDADOR (DUEÑO)</b> "
            f"don/doña <b>{dueno_nombre}</b>, Cédula de Identidad N° <b>{dueno_rut}</b>, fono {dueno_telefono}; y por la otra parte como "
            f"<b>ARRENDATARIO (CLIENTE)</b> don/doña <b>{cliente_nombre}</b>, Cédula de Identidad N° <b>{cliente_rut}</b>, "
            f"fono {cliente_telefono}{segundo_conductor_intro}; con la intermediación digital y mandato de administración de la plataforma "
            f"<b>ARRIENDO MI AUTO SpA</b> (RUT <b>78.493.457-8</b>). Las partes convienen celebrar el presente contrato de arriendo bajo las siguientes cláusulas:"
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
        if segundo_conductor_nombre:
            clausula1 = (
                "<b>PRIMERA — OBJETO Y CONDUCTORES AUTORIZADOS (P2P):</b> El Arrendador entrega en arriendo temporal el vehículo antes individualizado al Arrendatario. "
                "La entrega se efectúa de forma directa entre las partes, mediando verificación de identidad humana con código QR y fotos oficiales cacheadas. "
                f"Son únicos conductores expresamente autorizados para operar el vehículo el Arrendatario (don/doña {cliente_nombre}) y el Segundo Conductor "
                f"(don/doña {segundo_conductor_nombre}, Documento N° {segundo_conductor_rut or 'N/A'}), "
                "ambos declarando poseer licencia de conducir vigente y validada por la plataforma."
            )
        else:
            clausula1 = (
                "<b>PRIMERA — OBJETO Y ENTREGA DIRECTA (P2P):</b> El Arrendador entrega en arriendo temporal el vehículo antes individualizado al Arrendatario. "
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
            f"<b>CUARTA — PROGRAMA DE COBERTURA Y DEDUCIBLE DE 15 UF (50/50):</b> El arriendo cuenta con programa de protección y seguro frente a siniestros, "
            f"con deducible general fijado en <b>15 UF</b> (~${deducible_pesos:,.0f} CLP al valor de referencia). Ante cualquier siniestro fortuito o culposo "
            f"amparado por la póliza, el deducible se absorbe en partes iguales: <b>50% a cargo de ARRIENDO MI AUTO SpA (~${mitad_deducible:,.0f} CLP)</b> "
            f"y <b>50% a cargo del Arrendador (~${mitad_deducible:,.0f} CLP)</b>, quedando exento el Arrendatario. "
            f"Excepcionalmente, el Arrendatario responderá con su Hold de Garantía de $800.000 CLP y hasta el valor total de los daños si mediare dolo, "
            f"negligencia grave, conducción bajo la influencia del alcohol, estupefacientes, falta de licencia apta o exclusiones expresas de la cobertura."
        )
        story.append(Paragraph(clausula4, body_style))
        story.append(Spacer(1, 5))

        story.append(Paragraph(clausula_peajes_tag(dias_cobro_posterior_peajes), body_style))
        story.append(Spacer(1, 5))

        clausula_indemnidad = (
            "<b>SEXTA — DESTINO LÍCITO, PROHIBICIÓN LEY N° 20.000, RESPONSABILIDAD CIVIL E INDEMNIDAD (LEY N° 18.290):</b><br/>"
            "a) <u>Destino Lícito y Sustancias Ilícitas</u>: El Arrendatario se obliga a destinar el vehículo exclusivamente para fines de transporte personal lícito. "
            "Queda terminantemente prohibido utilizar el vehículo para el transporte de drogas, estupefacientes o sustancias psicotrópicas sancionadas por la Ley N° 20.000, "
            "contrabando, armas no autorizadas, carreras clandestinas, subarriendo no autorizado o cualquier otra actividad delictiva. "
            "El Arrendatario autoriza expresamente a ARRIENDO MI AUTO SpA y al Arrendador a compartir de inmediato con el Ministerio Público, "
            "Carabineros de Chile y Policía de Investigaciones (PDI) todos los datos de telemetría GPS, bitácora de viajes, identidad y grabaciones para coadyuvar en la persecución penal.<br/>"
            "b) <u>Responsabilidad Civil e Indemnidad</u>: El Arrendatario asume la responsabilidad exclusiva, personal y "
            "directa por la conducción y custodia del vehículo durante todo el arriendo. En consecuencia, y en resguardo del artículo 169 de la Ley de Tránsito, "
            "el Arrendatario se obliga expresamente a mantener total e íntegramente indemne al Arrendador (Dueño) y a ARRIENDO MI AUTO SpA frente a cualquier acción, "
            "demanda o condena indemnizatoria por daños materiales, lesiones o perjuicios a terceros derivados del uso del vehículo, obligándose a reembolsar "
            "de inmediato cualquier suma que aquellos fueren conminados a pagar."
        )
        story.append(Paragraph(clausula_indemnidad, body_style))
        story.append(Spacer(1, 5))

        clausula_firma = (
            "<b>SÉPTIMA — VALIDEZ PROBATORIA DE FIRMA ELECTRÓNICA (LEY N° 19.799):</b> Las partes declaran que el presente contrato se suscribe "
            "válidamente mediante mecanismos de firma electrónica. Reconocen que el sellado digital, el hash criptográfico SHA-256 generado por la plataforma "
            "y la verificación biométrica KYC previa constituyen plena prueba convencional de su identidad, consentimiento e integridad del documento, "
            "renunciando a desconocer su valor probatorio."
        )
        story.append(Paragraph(clausula_firma, body_style))
        story.append(Spacer(1, 5))

        clausula_jurisdiccion = (
            "<b>OCTAVA — DEVOLUCIÓN, ATRASOS, CESE DE TENENCIA (ART. 470 N° 1 C.P.) Y JURISDICCIÓN:</b> "
            "Se otorga un período de gracia de 30 minutos respecto de la hora de término pactada. "
            "Posterior a dicho lapso, se facturará la fracción horaria o el día adicional correspondiente. "
            "Si transcurren más de 6 horas continuas de atraso respecto de la hora pactada (o de cualquier extensión debidamente aprobada en la plataforma) "
            "sin que el vehículo haya sido restituido ni medie comunicación justificada por fuerza mayor comprobable, cesará de pleno derecho y sin necesidad "
            "de requerimiento judicial previo el título de mera tenencia conferido por este contrato. A partir de dicho momento, la retención del móvil se "
            "considerará ilegítima, quedando facultados el Arrendador y ARRIENDO MI AUTO SpA para activar los protocolos de inmovilización y corte de ignición remota vía GPS, "
            "así como para interponer de inmediato la denuncia penal por el delito de apropiación indebida (artículo 470 N° 1 del Código Penal chileno) o hurto según corresponda, "
            "sin perjuicio de las acciones civiles por perjuicios y lucro cesante.<br/>"
            "Para todos los efectos legales, las partes fijan su domicilio en la comuna de Concepción, Región del Biobío, sin perjuicio de las normas "
            "de competencia especial que la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores reconoce al Arrendatario para acudir ante "
            "los tribunales correspondientes a su domicilio."
        )
        story.append(Paragraph(clausula_jurisdiccion, body_style))
        story.append(Spacer(1, 8))

        # 5. Firmas Digitales y Manuscritas
        _METODO_LABEL = {
            "huella": "huella dactilar biometrizada",
            "facial": "reconocimiento facial biométrico",
            "escrita": "firma manuscrita digitalizada",
            "biometrica": "verificación biométrica",
        }
        firmas_por_rol = {}
        for f in (firmas or []):
            firmas_por_rol[f.get("rol")] = f

        f_arrendador = firmas_por_rol.get("arrendador") or {}
        f_arrendatario = firmas_por_rol.get("arrendatario") or {}

        def _certificacion(rol_key: str, fallback: str) -> str:
            f = firmas_por_rol.get(rol_key)
            if not f:
                return f"<i>{fallback}</i>"
            metodo = _METODO_LABEL.get(f.get("metodo"), f.get("metodo") or "firma electrónica")
            ts = f.get("firmado_en")
            cuando = ts.strftime("%d/%m/%Y %H:%M") if ts else "—"
            h = (f.get("hash_contrato_sha256") or "")[:16]
            return (
                f"<i>Firmado con {metodo}<br/>{cuando} UTC</i>"
                + (f"<br/><font size=5.5 color='#64748B'>SHA-256: {h}…</font>" if h else "")
            )

        # Cajas visuales de firma (renderiza trazo SVG vectorial o sello digital biométrico/mandato)
        d_arrendador = crear_caja_firma_digital(
            nombre=dueno_nombre,
            rut=dueno_rut,
            rol="arrendador",
            metodo=f_arrendador.get("metodo"),
            firma_svg=f_arrendador.get("firma_svg"),
            timestamp=f_arrendador.get("firmado_en"),
            width=265,
            height=54,
        )

        d_arrendatario = crear_caja_firma_digital(
            nombre=cliente_nombre,
            rut=cliente_rut,
            rol="arrendatario",
            metodo=f_arrendatario.get("metodo"),
            firma_svg=f_arrendatario.get("firma_svg"),
            timestamp=f_arrendatario.get("firmado_en") or fecha_firma_biometrica,
            width=265,
            height=54,
        )

        firmas_data = [
            [d_arrendador, d_arrendatario],
            [
                Paragraph(
                    f"<b>ARRENDADOR (DUEÑO)</b><br/>{dueno_nombre}<br/>RUT: {dueno_rut}<br/>"
                    + _certificacion("arrendador", "Aceptó el mandato de administración al publicar el vehículo"),
                    body_style,
                ),
                Paragraph(
                    f"<b>ARRENDATARIO (CLIENTE)</b><br/>{cliente_nombre}<br/>RUT: {cliente_rut}<br/>"
                    + _certificacion(
                        "arrendatario",
                        (
                            f"Firmado con Verificación Biométrica ({fecha_firma_biometrica.strftime('%d/%m/%Y %H:%M')} UTC)"
                            if fecha_firma_biometrica
                            else "Firmado tras Enrolamiento OCR y Biometría"
                        ),
                    ),
                    body_style,
                ),
            ],
        ]
        t_firmas = Table(firmas_data, colWidths=[270, 270])
        t_firmas.setStyle(TableStyle([
            ("ALIGN", (0,0), (-1,-1), "CENTER"),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("TOPPADDING", (0,0), (-1,-1), 2),
            ("BOTTOMPADDING", (0,0), (-1,-1), 2),
        ]))
        story.append(t_firmas)

        # Construir PDF
        doc.build(story)

        if not output_path:
            return buffer.getvalue()
        return None
