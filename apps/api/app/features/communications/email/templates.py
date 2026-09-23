"""
Contenido de los correos transaccionales (Resend): versión HTML y su par en
texto plano. Separado de `service.py` para que el armado del contenido no se
mezcle con el envío/reintentos.

`_layout` es el único lugar con la marca (logo, colores, encabezado, pie de
página) — los clientes de correo no soportan CSS externo ni casi nada de
flexbox/grid, así que todo va con estilos inline y una tabla como esqueleto.

Cada plantilla HTML tiene su par `*_texto()`: Resend manda ambas versiones en
el mismo envío (multipart), y un correo solo-HTML sin alternativa en texto es
una señal que los filtros de spam penalizan.
"""

MARCA = "ArriendoMiAutoYa"
TEAL = "#0F3D3E"
MENTA = "#2FBF9B"
TEXTO_MUTED = "#6B7280"
FONDO = "#F4F6F5"

FRONTEND_URL = "https://arriendomiautoya.cl"
LOGO_URL = f"{FRONTEND_URL}/logo.png"

PIE_TEXTO = f"Este correo se generó automáticamente, no hace falta responderlo. {FRONTEND_URL}"


def _layout(titulo: str, cuerpo_html: str) -> str:
    return f"""\
<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:{FONDO};font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{FONDO};padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:{TEAL};padding:16px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:10px;">
                      <img src="{LOGO_URL}" width="28" height="28" alt="{MARCA}" style="display:block;border-radius:7px;border:0;">
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="color:#FFFFFF;font-size:17px;font-weight:700;letter-spacing:-0.2px;">{MARCA}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:19px;color:{TEAL};">{titulo}</h1>
                {cuerpo_html}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;border-top:1px solid #E5E7EB;">
                <p style="margin:0;font-size:11px;color:{TEXTO_MUTED};line-height:16px;">
                  Este correo se generó automáticamente, no hace falta responderlo.
                  <a href="{FRONTEND_URL}" style="color:{TEXTO_MUTED};">arriendomiautoya.cl</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def aviso_reserva(titulo: str, mensaje: str) -> str:
    """Correo simple con el mismo texto que la notificación de la app. Se escapa: el texto lleva datos del auto."""
    from html import escape

    cuerpo = f"""\
                <p style="margin:0 0 12px;font-size:14px;color:#1F2937;line-height:21px;">Hola,</p>
                <p style="margin:0 0 12px;font-size:14px;color:#1F2937;line-height:21px;">{escape(mensaje)}</p>
                <p style="margin:0;font-size:12px;color:{TEXTO_MUTED};line-height:18px;">
                  Puedes ver el detalle en la app, en Mis reservas.
                </p>"""
    return _layout(escape(titulo), cuerpo)


def aviso_reserva_texto(titulo: str, mensaje: str) -> str:
    return (
        f"{MARCA}\n\n"
        f"{titulo}\n\n"
        f"Hola,\n\n"
        f"{mensaje}\n\n"
        f"Puedes ver el detalle en la app, en Mis reservas.\n\n"
        f"--\n{PIE_TEXTO}"
    )


def contrato_firmado(patente: str) -> str:
    cuerpo = f"""\
                <p style="margin:0 0 12px;font-size:14px;color:#1F2937;line-height:21px;">Hola,</p>
                <p style="margin:0 0 12px;font-size:14px;color:#1F2937;line-height:21px;">
                  Adjuntamos el contrato de arriendo firmado por ambas partes.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 4px;">
                  <tr>
                    <td style="font-size:12px;color:{TEXTO_MUTED};padding-right:8px;">Vehículo</td>
                    <td style="font-size:14px;font-weight:700;color:{TEAL};">{patente}</td>
                  </tr>
                </table>"""
    return _layout("Tu contrato de arriendo", cuerpo)


def contrato_firmado_texto(patente: str) -> str:
    return (
        f"{MARCA}\n\n"
        f"Tu contrato de arriendo\n\n"
        f"Hola,\n\n"
        f"Adjuntamos el contrato de arriendo firmado por ambas partes.\n\n"
        f"Vehículo: {patente}\n\n"
        f"--\n{PIE_TEXTO}"
    )


def deposito_realizado(*, monto_fmt: str, banco: str, numero_enmascarado: str) -> str:
    cuerpo = f"""\
                <p style="margin:0 0 16px;font-size:14px;color:#1F2937;line-height:21px;">
                  Depositamos tu ganancia en tu cuenta de cobro.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{FONDO};border-radius:10px;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;color:{TEXTO_MUTED};">Monto depositado</p>
                      <p style="margin:0 0 14px;font-size:26px;font-weight:800;color:{TEAL};">{monto_fmt}</p>
                      <p style="margin:0;font-size:13px;color:#1F2937;">{banco} · Cuenta ····{numero_enmascarado}</p>
                    </td>
                  </tr>
                </table>"""
    return _layout("Depósito enviado", cuerpo)


def bienvenida() -> str:
    cuerpo = f"""\
                <p style="margin:0 0 12px;font-size:14px;color:#1F2937;line-height:21px;">Hola,</p>
                <p style="margin:0 0 12px;font-size:14px;color:#1F2937;line-height:21px;">
                  Gracias por registrarte en {MARCA}. Ya puedes explorar autos disponibles cerca de ti o publicar el tuyo para empezar a generar ingresos.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{FONDO};border-radius:10px;margin:8px 0 12px;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <p style="margin:0;font-size:12px;color:{TEXTO_MUTED};line-height:18px;">
                        Antes de arrendar o publicar un auto, verifica tu identidad desde la app: toma menos de 60 segundos.
                      </p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:12px;color:{TEXTO_MUTED};line-height:18px;">
                  Si tú no creaste esta cuenta, puedes ignorar este correo.
                </p>"""
    return _layout("¡Tu cuenta está lista!", cuerpo)


def bienvenida_texto() -> str:
    return (
        f"{MARCA}\n\n"
        f"¡Tu cuenta está lista!\n\n"
        f"Hola,\n\n"
        f"Gracias por registrarte en {MARCA}. Ya puedes explorar autos disponibles cerca de ti "
        f"o publicar el tuyo para empezar a generar ingresos.\n\n"
        f"Antes de arrendar o publicar un auto, verifica tu identidad desde la app: toma menos de 60 segundos.\n\n"
        f"Si tú no creaste esta cuenta, puedes ignorar este correo.\n\n"
        f"--\n{PIE_TEXTO}"
    )


def deposito_realizado_texto(*, monto_fmt: str, banco: str, numero_enmascarado: str) -> str:
    return (
        f"{MARCA}\n\n"
        f"Depósito enviado\n\n"
        f"Depositamos tu ganancia en tu cuenta de cobro.\n\n"
        f"Monto depositado: {monto_fmt}\n"
        f"{banco} · Cuenta ····{numero_enmascarado}\n\n"
        f"--\n{PIE_TEXTO}"
    )
