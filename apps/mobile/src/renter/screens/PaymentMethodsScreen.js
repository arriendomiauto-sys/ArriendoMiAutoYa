import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, StatusBar, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  theme,
  Icon,
  Button,
  Card,
  ScreenHeader,
  ApiClient,
  showAlert,
  ContractSignatureModal,
  ContractModal,
  AgregarTarjetaModal,
  useTarjetas,
  useCuentaRegresiva,
  useApp,
} from "@rentacar/mobile-shared";
import { SelectorTarjeta } from "../components/SelectorTarjeta";

const clp = (n) => `$${(n || 0).toLocaleString("es-CL")}`;

export function PaymentMethodsScreen({ car: carProp, booking, onBack, onPaymentSuccess, existingReservation }) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useApp();
  const { tarjetasDebito, tarjetasCredito, agregar, recargar } = useTarjetas();

  // Reanudar una reserva `pendiente_pago` ya existente (desde "Mis reservas"
  // o el reintento en el arriendo activo) no trae `car`/`booking` por
  // separado — vienen adentro de la reserva misma.
  const car = carProp || existingReservation?.auto;
  const dias =
    booking?.dias ??
    (existingReservation?.fecha_inicio && existingReservation?.fecha_fin
      ? Math.max(1, Math.ceil((new Date(existingReservation.fecha_fin) - new Date(existingReservation.fecha_inicio)) / 86400000))
      : 0);
  const esReservaReal = !!(car?.id && (booking || existingReservation));
  const nombreAuto = [car?.marca, car?.modelo, car?.anio].filter(Boolean).join(" ");

  // Estimación mientras no exista la reserva (mismas fórmulas que el backend):
  // el cobro = días × tarifa (IVA incl.); la garantía = monto fijo por categoría.
  const tarifaDia = car?.tarifa_dia || 0;
  const cobroEstimado = tarifaDia * dias;
  const garantiaEstimada = car?.monto_garantia ?? booking?.montoHold ?? 0;

  const [reserva, setReserva] = useState(existingReservation || null);
  const cobro = reserva?.cobro?.monto ?? cobroEstimado;
  const neto = reserva?.cobro?.neto ?? Math.round(cobro / 1.19);
  const iva = reserva?.cobro?.iva ?? cobro - Math.round(cobro / 1.19);
  const garantia = reserva?.garantia?.monto ?? garantiaEstimada;

  const [tarjetaCobroId, setTarjetaCobroId] = useState(null);
  const [tarjetaGarantiaId, setTarjetaGarantiaId] = useState(null);
  const [errorCobro, setErrorCobro] = useState(null);
  const [errorGarantia, setErrorGarantia] = useState(null);

  const [modalAgregar, setModalAgregar] = useState(null); // "debito" | "credito" | null
  const [firmando, setFirmando] = useState(false);
  const [showContractPreview, setShowContractPreview] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [pendiente, setPendiente] = useState(null); // { expira_en, motivo }

  // BLOQUE TEMPORAL — PAGOS SIMULADOS (bandera del backend)
  const [pagoSimulado, setPagoSimulado] = useState(false);
  useEffect(() => {
    let vivo = true;
    ApiClient.getConfiguracionPagos()
      .then((cfg) => vivo && setPagoSimulado(!!cfg?.simulado))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  // Preselección: la tarjeta marcada como predeterminada, o la primera.
  useEffect(() => {
    if (!tarjetaCobroId && tarjetasDebito.length) {
      setTarjetaCobroId((tarjetasDebito.find((t) => t.predeterminada_cobro) || tarjetasDebito[0]).id);
    }
  }, [tarjetasDebito, tarjetaCobroId]);
  useEffect(() => {
    if (!tarjetaGarantiaId && tarjetasCredito.length) {
      setTarjetaGarantiaId(
        (tarjetasCredito.find((t) => t.predeterminada_garantia) || tarjetasCredito[0]).id
      );
    }
  }, [tarjetasCredito, tarjetaGarantiaId]);

  const listo = !!tarjetaCobroId && !!tarjetaGarantiaId && !pagando;

  const cuenta = useCuentaRegresiva(pendiente?.expira_en || reserva?.expira_en || null);

  // ── Crear la reserva (si no existe) y abrir la firma ─────────────────────
  const handleContinuar = async () => {
    if (pagando) return;
    if (!esReservaReal) {
      onPaymentSuccess(null);
      return;
    }
    if (!listo) {
      showAlert("Elige tus tarjetas", "Falta elegir la tarjeta del cobro y la de la garantía.");
      return;
    }
    setErrorCobro(null);
    setErrorGarantia(null);
    setPagando(true);
    try {
      let r = reserva;
      if (!r) {
        r = await ApiClient.crearReserva({
          auto_id: car.id,
          fecha_inicio: booking.fechaInicio,
          fecha_fin: booking.fechaFin,
          lugar_entrega_acordado: car.ubicacion_base,
        });
        setReserva(r);
      }
      const yaFirmo = Boolean(r.fecha_firma_biometrica) || (r.firmas || []).some((f) => f.rol === "arrendatario");
      setPagando(false);
      if (yaFirmo) {
        await ejecutarPago(r);
      } else {
        setFirmando(true);
      }
    } catch (error) {
      setPagando(false);
      const motivo = error.message || "";
      const esRequisito = /licencia|permiso internacional|edad mínima|residencia/i.test(motivo);
      showAlert(
        esRequisito ? "No puedes reservar este auto" : "No se pudo crear la reserva",
        esRequisito
          ? `${motivo}\n\nActualiza tus documentos desde tu perfil o escríbenos a soporte.`
          : motivo || "Intenta nuevamente en unos segundos."
      );
    }
  };

  // ── Cobro + hold ────────────────────────────────────────────────────────
  const ejecutarPago = async (r) => {
    if (pagando) return;
    setErrorCobro(null);
    setErrorGarantia(null);
    setPagando(true);
    try {
      const res = await ApiClient.pagarReserva(r.id, {
        tarjeta_cobro_id: tarjetaCobroId,
        tarjeta_garantia_id: tarjetaGarantiaId,
      });
      if (res?.estado === "confirmada") {
        onPaymentSuccess({ ...r, car, estado: "confirmada", pagoSimulado });
        return;
      }
      // "pendiente": el cobro quedó en proceso; se guarda la reserva.
      setPendiente({ expira_en: res?.expira_en || r.expira_en, motivo: res?.motivo });
    } catch (e) {
      const mensajeLimpio = (() => {
        const raw = e?.mensaje || e?.message || "";
        if (typeof raw === "string" && raw.startsWith("{")) {
          try {
            const parsed = JSON.parse(raw);
            return parsed.mensaje || parsed.message || parsed.motivo || raw;
          } catch {
            return raw;
          }
        }
        return raw;
      })();

      if (e?.codigo === "SIN_CUPO") {
        setErrorGarantia(
          `Esta tarjeta no tiene cupo para la garantía de ${clp(garantia)}. Elige otra o agrega una.`
        );
      } else if (e?.codigo === "COBRO_RECHAZADO") {
        setErrorCobro(mensajeLimpio || "El cobro fue rechazado. Prueba con otra tarjeta de débito.");
      } else if (e?.codigo === "TARJETA_TIPO_INVALIDO") {
        if (e?.campo === "cobro") {
          setErrorCobro(mensajeLimpio || "El arriendo requiere una tarjeta de débito validada.");
        } else if (e?.campo === "garantia") {
          setErrorGarantia(mensajeLimpio || "La garantía requiere una tarjeta de crédito validada.");
        } else {
          showAlert(
            "Tipo de tarjeta incorrecto",
            mensajeLimpio || "Una de las tarjetas no corresponde al tipo requerido (débito para arriendo, crédito para garantía)."
          );
        }
        recargar();
      } else if (e?.codigo === "RESERVA_EXPIRADA") {
        showAlert("Tu reserva venció", "Pasó demasiado tiempo. Vuelve a elegir las fechas.", [
          { text: "Entendido", onPress: onBack },
        ]);
      } else {
        // Falla de red / pasarela: la reserva queda pendiente y se puede reintentar.
        setPendiente({ expira_en: r.expira_en, motivo: mensajeLimpio });
      }
    } finally {
      setPagando(false);
    }
  };

  // ── Panel de reserva pendiente ──────────────────────────────────────────
  if (pendiente) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Reserva pendiente" onBack={onBack} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.pendienteBox}>
            <Icon name="clock" size={22} color={colors.warningText} />
            <Text style={styles.pendienteTitulo}>Tu reserva quedó pendiente</Text>
            <Text style={styles.pendienteTexto}>
              {pendiente.motivo ||
                "Mercado Pago no confirmó el pago al instante."}{" "}
              Guardamos la reserva y no se cobró nada todavía.
            </Text>
          </View>

          <Card padded style={styles.reservaGuardada}>
            <Text style={styles.reservaGuardadaTitulo}>{nombreAuto || "Vehículo"}</Text>
            <Text style={styles.reservaGuardadaMeta}>
              {dias} {dias === 1 ? "día" : "días"} · {clp(cobro)} + garantía {clp(garantia)}
            </Text>
            {cuenta.etiqueta ? (
              <Text style={[styles.expira, cuenta.vencido && styles.expiraVencido]}>
                {cuenta.vencido ? "La reserva venció" : `Expira en ${cuenta.etiqueta}`}
              </Text>
            ) : null}
          </Card>

          <View style={{ gap: theme.spacing.sm }}>
            <Button
              label="Reintentar el pago"
              onPress={() => {
                setPendiente(null);
                if (reserva) ejecutarPago(reserva);
              }}
              loading={pagando}
              disabled={cuenta.vencido}
            />
            <Button
              variant="secondary"
              label="Usar otra tarjeta"
              onPress={() => setPendiente(null)}
              disabled={pagando}
            />
            <Button
              variant="ghost"
              label="Ver mis reservas"
              onPress={() => onPaymentSuccess({ ...reserva, car, estado: "pendiente" })}
              disabled={pagando}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Confirmar y pagar" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {esReservaReal && (
          <Card padded style={styles.carRow}>
            {car.fotos?.[0] ? (
              <Image source={{ uri: car.fotos[0] }} style={styles.carThumb} />
            ) : (
              <View style={[styles.carThumb, styles.carThumbEmpty]}>
                <Icon name="car" size={22} color={colors.primary300} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.carName}>{nombreAuto || "Vehículo"}</Text>
              <Text style={styles.carMeta}>
                {dias} {dias === 1 ? "día" : "días"} · {car.ubicacion_base || "Los Ángeles"}
              </Text>
            </View>
          </Card>
        )}

        {pagoSimulado ? (
          <View style={styles.pruebaRow}>
            <Icon name="alert" size={18} color={colors.warningText} />
            <Text style={styles.pruebaTexto}>
              <Text style={{ fontWeight: "700" }}>Modo de prueba.</Text> No se cobra ni se retiene
              nada real: la reserva avanza como si el pago hubiera sido exitoso.
            </Text>
          </View>
        ) : null}

        <SelectorTarjeta
          titulo="Cobro del arriendo"
          subtitulo="Se cobra hoy a una tarjeta de débito."
          tarjetas={tarjetasDebito}
          seleccionadaId={tarjetaCobroId}
          onSeleccionar={(id) => {
            setTarjetaCobroId(id);
            setErrorCobro(null);
          }}
          onAgregar={() => setModalAgregar("debito")}
          error={errorCobro}
          tipoVacio="débito"
        />

        <SelectorTarjeta
          titulo="Garantía"
          subtitulo="Queda bloqueada en una tarjeta de crédito, no se cobra."
          tarjetas={tarjetasCredito}
          seleccionadaId={tarjetaGarantiaId}
          onSeleccionar={(id) => {
            setTarjetaGarantiaId(id);
            setErrorGarantia(null);
          }}
          onAgregar={() => setModalAgregar("credito")}
          error={errorGarantia}
          tipoVacio="crédito"
        />

        <Card padded style={{ gap: theme.spacing.md }}>
          <View style={styles.bdRow}>
            <Text style={styles.bdLabel}>Arriendo · {dias} {dias === 1 ? "día" : "días"}</Text>
            <Text style={styles.bdValue}>{clp(neto)}</Text>
          </View>
          <View style={styles.bdRow}>
            <Text style={styles.bdLabel}>IVA 19%</Text>
            <Text style={styles.bdValue}>{clp(iva)}</Text>
          </View>
          <View style={styles.bdRow}>
            <Text style={styles.bdLabelGris}>Garantía retenida</Text>
            <Text style={styles.bdValueGris}>{clp(garantia)}</Text>
          </View>
          <View style={[styles.bdRow, styles.bdTotal]}>
            <Text style={styles.bdTotalLabel}>Se cobra hoy</Text>
            <Text style={styles.bdTotalValue}>{clp(cobro)}</Text>
          </View>
        </Card>

        <View style={styles.secure}>
          <Icon name="shield" size={16} color={colors.accent700} />
          <Text style={styles.secureText}>
            La garantía es una retención sobre el cupo de tu tarjeta de crédito, no un cobro. Se
            libera al devolver el auto sin daños, menos cargos justificados.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        {(() => {
          const yaFirmo = Boolean(reserva?.fecha_firma_biometrica) || (reserva?.firmas || []).some((f) => f.rol === "arrendatario");
          return (
            <>
              <Button
                label={
                  yaFirmo
                    ? pagoSimulado
                      ? "Confirmar reserva"
                      : "Pagar y reservar"
                    : pagoSimulado
                    ? "Firmar y confirmar reserva"
                    : "Firmar y reservar"
                }
                iconRight="arrow-right"
                onPress={handleContinuar}
                loading={pagando}
                disabled={!listo}
              />
              <Text style={styles.footerHelp}>
                {yaFirmo
                  ? "Contrato ya firmado digitalmente. Al continuar autorizas la retención de la garantía."
                  : "Al continuar firmas el contrato de arriendo y autorizas la retención de la garantía."}
              </Text>
            </>
          );
        })()}
      </View>

      <ContractSignatureModal
        visible={firmando}
        reservaId={reserva?.id}
        parte="arrendatario"
        nombreSugerido={currentUser?.nombre}
        onVerContrato={() => setShowContractPreview(true)}
        onClose={() => {
          setFirmando(false);
          if (reserva) onPaymentSuccess({ ...reserva, car, estado: "pendiente" });
        }}
        onSigned={async () => {
          setFirmando(false);
          if (reserva) await ejecutarPago(reserva);
        }}
      />

      <ContractModal
        visible={showContractPreview}
        reservation={reserva || { id: "preview", auto: car, monto_hold: garantia }}
        onClose={() => setShowContractPreview(false)}
      />

      <AgregarTarjetaModal
        visible={!!modalAgregar}
        onClose={() => setModalAgregar(null)}
        onAgregar={agregar}
        onAgregada={(tarjeta) => {
          setModalAgregar(null);
          if (tarjeta?.tipo === "debito") setTarjetaCobroId(tarjeta.id);
          if (tarjeta?.tipo === "credito") setTarjetaGarantiaId(tarjeta.id);
        }}
        nombreTitular={currentUser?.nombre}
        rut={currentUser?.rut}
        tipoPreferido={modalAgregar || undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.screen, gap: theme.spacing.lg },

  carRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  carThumb: { width: 76, height: 58, borderRadius: theme.radius.field, backgroundColor: colors.primary100 },
  carThumbEmpty: { backgroundColor: colors.accent100, alignItems: "center", justifyContent: "center" },
  carName: { fontSize: 15, fontWeight: "700", color: colors.text },
  carMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  pruebaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningBg,
  },
  pruebaTexto: { flex: 1, fontSize: 12.5, color: colors.warningText, lineHeight: 18 },

  bdRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bdLabel: { fontSize: 15, color: colors.textMuted },
  bdValue: { fontSize: 15, color: colors.text, fontWeight: "500" },
  bdLabelGris: { fontSize: 14, color: colors.textMuted },
  bdValueGris: { fontSize: 14, color: colors.textMuted },
  bdTotal: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: theme.spacing.md },
  bdTotalLabel: { fontSize: 17, fontWeight: "700", color: colors.text },
  bdTotalValue: { fontSize: 20, fontWeight: "800", color: colors.primary, letterSpacing: -0.5 },

  secure: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  secureText: { flex: 1, fontSize: 12.5, color: colors.textMuted, lineHeight: 18 },

  footer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: theme.spacing.sm,
  },
  footerHelp: { fontSize: 12, color: colors.textMuted, textAlign: "center", lineHeight: 17 },

  // Panel pendiente
  pendienteBox: {
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
  },
  pendienteTitulo: { fontSize: 16, fontWeight: "800", color: colors.text },
  pendienteTexto: { fontSize: 13, color: colors.warningText, lineHeight: 19, textAlign: "center" },
  reservaGuardada: { gap: 4 },
  reservaGuardadaTitulo: { fontSize: 15, fontWeight: "700", color: colors.text },
  reservaGuardadaMeta: { fontSize: 13, color: colors.textMuted },
  expira: { fontSize: 13, fontWeight: "700", color: colors.primary, marginTop: 4, fontVariant: ["tabular-nums"] },
  expiraVencido: { color: colors.dangerText },
});
