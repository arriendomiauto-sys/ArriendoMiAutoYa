import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  theme,
  useApp,
  Icon,
  Button,
  Chip,
  ScreenHeader,
  SectionLabel,
  showAlert,
  ApiClient,
  CampoConSugerencias,
  buscarBancos,
  TIPOS_CUENTA_CHILE,
} from "@rentacar/mobile-shared";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const fmt = (m) => `$${Math.abs(m || 0).toLocaleString("es-CL")}`;
const fmtFecha = (t) =>
  t ? new Date(t).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" }) : "";

export function EarningsScreen({ onBack, onOpenDisputes }) {
  const insets = useSafeAreaInsets();
  const { bankAccount, updateBankAccount } = useApp();
  const [bankModal, setBankModal] = useState(false);
  const [form, setForm] = useState({
    banco: bankAccount?.banco || "",
    tipo_cuenta: bankAccount?.tipo_cuenta || "",
    numero: bankAccount?.numero || "",
    titular: bankAccount?.titular || "",
    rut: bankAccount?.rut || "",
  });
  const [savingBank, setSavingBank] = useState(false);

  const [ganancias, setGanancias] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setGanancias(await ApiClient.getMisGanancias());
    } catch (err) {
      console.warn("[EarningsScreen]", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleSaveBank = async () => {
    if (!form.banco || !form.tipo_cuenta || !form.numero || !form.titular || !form.rut) {
      showAlert("Datos incompletos", "Completa el banco, el tipo de cuenta, el número, el titular y su RUT.");
      return;
    }
    setSavingBank(true);
    try {
      await updateBankAccount(form);
      setBankModal(false);
      showAlert("Cuenta guardada", "Tus liquidaciones se depositarán en esta cuenta.");
    } catch (err) {
      showAlert("No se pudo guardar", err.message || "Verifica el RUT e intenta de nuevo.");
    } finally {
      setSavingBank(false);
    }
  };

  const saldo = ganancias?.saldo_disponible_clp ?? 0;
  const historial = ganancias?.historial ?? [];
  const porAuto = ganancias?.por_auto ?? [];
  const bonoReferidoPendiente = ganancias?.bono_referido_pendiente_clp ?? 0;

  const handlePayout = () => {
    if (!bankAccount) {
      showAlert("Falta tu cuenta bancaria", "Configura una cuenta de depósito antes de solicitar el retiro.");
      setBankModal(true);
      return;
    }
    if (saldo <= 0) {
      showAlert("Sin saldo disponible", "No tienes liquidaciones pendientes de retiro.");
      return;
    }
    showAlert(
      "Solicitar retiro",
      `Se solicitará la transferencia de ${fmt(saldo)} a tu ${bankAccount.banco} N° ${bankAccount.numero}. Nuestro equipo la procesa manualmente.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            setRequesting(true);
            try {
              await ApiClient.crearTicketSoporte(
                "Solicitud de retiro inmediato",
                `Solicito transferir mi saldo disponible (${fmt(saldo)}) a: ${bankAccount.banco}, ${bankAccount.tipo_cuenta} N° ${bankAccount.numero}, titular ${bankAccount.titular} (${bankAccount.rut}).`
              );
              showAlert("Solicitud enviada", "Quedó registrada y nuestro equipo gestionará la transferencia.");
            } catch (err) {
              showAlert("No se pudo enviar", err.message || "Intenta más tarde.");
            } finally {
              setRequesting(false);
            }
          },
        },
      ]
    );
  };

  const hoy = new Date();
  const barras = Array.from({ length: 7 }).map((_, i) => {
    const dia = new Date(hoy);
    dia.setDate(hoy.getDate() - (6 - i));
    const total = historial
      .filter((h) => {
        const f = new Date(h.timestamp);
        return f.getFullYear() === dia.getFullYear() && f.getMonth() === dia.getMonth() && f.getDate() === dia.getDate();
      })
      .reduce((s, h) => s + h.monto, 0);
    return { dia: DIAS[dia.getDay()], monto: total };
  });
  const maxBarra = Math.max(...barras.map((b) => b.monto), 1);

  return (
    <View style={styles.container}>
      <ScreenHeader
        tone="dark"
        title="Ganancias"
        subtitle="80% neto de arriendos + 100% de compensaciones"
        onBack={onBack}
        right={
          onOpenDisputes ? (
            <TouchableOpacity onPress={onOpenDisputes} style={styles.disputesBtn}>
              <Text style={styles.disputesText}>Disputas</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.balanceCard}>
          <SectionLabel tone="dark" style={{ color: "rgba(255,255,255,0.7)" }}>
            Saldo disponible para retiro
          </SectionLabel>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginVertical: 10, alignSelf: "flex-start" }} />
          ) : (
            <Text style={styles.balanceAmount}>{fmt(saldo)}</Text>
          )}
          <Text style={styles.balanceSub}>
            {ganancias ? `${ganancias.cantidad_liquidaciones} liquidación(es) en total` : "Cargando…"}
          </Text>
          {bonoReferidoPendiente > 0 ? (
            <View style={styles.bonoReferidoRow}>
              <Icon name="star" size={13} color="#FFFFFF" />
              <Text style={styles.bonoReferidoTexto}>
                + {fmt(bonoReferidoPendiente)} de bono por invitación (aparte del saldo de arriba)
              </Text>
            </View>
          ) : null}
          <View style={styles.balanceBtns}>
            <Button
              tone="dark"
              label="Solicitar retiro"
              onPress={handlePayout}
              loading={requesting}
              style={{ flex: 1.4 }}
            />
            <TouchableOpacity style={styles.bankChip} onPress={() => setBankModal(true)} activeOpacity={0.85}>
              <Text style={styles.bankChipText}>Cuenta</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="wallet" size={15} color={colors.accent} />
              <Text style={styles.cardTitle}>Cuenta de depósito</Text>
            </View>
            <TouchableOpacity onPress={() => setBankModal(true)}>
              <Text style={styles.link}>{bankAccount ? "Cambiar" : "Configurar"}</Text>
            </TouchableOpacity>
          </View>
          {bankAccount ? (
            <View style={{ gap: 2 }}>
              <Text style={styles.bankName}>{bankAccount.banco}</Text>
              <Text style={styles.bankLine}>
                {bankAccount.tipo_cuenta} · N° {bankAccount.numero}
              </Text>
              <Text style={styles.bankLineMuted}>
                {bankAccount.titular} ({bankAccount.rut})
              </Text>
            </View>
          ) : (
            <Text style={styles.bankLineMuted}>Aún no configuras una cuenta de depósito.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Últimos 7 días</Text>
          <View style={styles.bars}>
            {barras.map((b, i) => (
              <View key={i} style={styles.barCol}>
                <View style={[styles.bar, { height: Math.max((b.monto / maxBarra) * 96, b.monto > 0 ? 6 : 2) }]} />
                <Text style={styles.barDay}>{b.dia}</Text>
              </View>
            ))}
          </View>
        </View>

        {porAuto.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rendimiento de tu flota</Text>
            {porAuto.map((a, i) => (
              <View key={a.auto_id} style={[styles.fleetRow, i === porAuto.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.rowBetween}>
                  <Text style={styles.fleetName} numberOfLines={1}>
                    {a.marca} {a.modelo} · {a.patente}
                  </Text>
                  <Text style={styles.fleetEarnings}>{fmt(a.ganancia_total_clp)}</Text>
                </View>
                <View style={styles.occupancyTrack}>
                  <View
                    style={[
                      styles.occupancyFill,
                      { width: `${Math.max(a.tasa_ocupacion_pct, a.tasa_ocupacion_pct > 0 ? 4 : 0)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.fleetMeta}>
                  {a.tasa_ocupacion_pct}% de ocupación · {a.reservas_finalizadas} arriendo{a.reservas_finalizadas === 1 ? "" : "s"} finalizado{a.reservas_finalizadas === 1 ? "" : "s"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Últimas liquidaciones</Text>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 10 }} />
          ) : historial.length === 0 ? (
            <Text style={styles.bankLineMuted}>
              Aparecerán aquí cuando termines tu primer arriendo.
            </Text>
          ) : (
            historial.map((item, i) => (
              <View key={item.id} style={[styles.histRow, i === historial.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histConcept}>
                    Liquidación de arriendo
                    {item.reserva_id ? ` · ${item.reserva_id.slice(0, 8)}` : ""}
                  </Text>
                  <Text style={styles.histDate}>
                    {fmtFecha(item.timestamp)} · {item.estado === "pagado" ? "Pagada" : "Pendiente"}
                  </Text>
                </View>
                <Text style={[styles.histAmount, { color: item.estado === "pagado" ? colors.accent : colors.textSilver }]}>
                  +{fmt(item.monto)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={bankModal} transparent animationType="slide" onRequestClose={() => setBankModal(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          // Ver LoginScreen.js: sin este KeyboardAvoidingView explícito, el
          // teclado tapaba los campos de más abajo del formulario.
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.rowBetween}>
              <Text style={styles.sheetTitle}>Cuenta bancaria</Text>
              <TouchableOpacity onPress={() => setBankModal(false)} hitSlop={theme.control.hitSlop}>
                <Icon name="close" size={18} color={colors.textSilver} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetSub}>Los fondos se transfieren a esta cuenta bancaria chilena.</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              <View style={{ marginBottom: theme.spacing.md }}>
                <CampoConSugerencias
                  etiqueta="Banco"
                  valor={form.banco}
                  onChange={(v) => setForm((p) => ({ ...p, banco: v }))}
                  buscar={buscarBancos}
                  placeholder="Escribe y elige de la lista"
                />
              </View>

              <View style={{ gap: 8, marginBottom: theme.spacing.md }}>
                <SectionLabel tone="dark">Tipo de cuenta</SectionLabel>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
                  {TIPOS_CUENTA_CHILE.map((tipo) => (
                    <Chip
                      key={tipo}
                      tone="dark"
                      label={tipo}
                      selected={form.tipo_cuenta === tipo}
                      onPress={() => setForm((p) => ({ ...p, tipo_cuenta: tipo }))}
                    />
                  ))}
                </View>
              </View>

              {[
                { k: "numero", label: "Número de cuenta", ph: "", kb: "number-pad" },
                { k: "titular", label: "Nombre del titular", ph: "" },
                { k: "rut", label: "RUT del titular", ph: "12.345.678-9" },
              ].map((f) => (
                <View key={f.k} style={{ gap: 6, marginBottom: theme.spacing.md }}>
                  <SectionLabel tone="dark">{f.label}</SectionLabel>
                  <TextInput
                    style={styles.input}
                    value={form[f.k]}
                    onChangeText={(v) => setForm((p) => ({ ...p, [f.k]: v }))}
                    placeholder={f.ph}
                    placeholderTextColor={colors.textSilver}
                    keyboardType={f.kb || "default"}
                    accessibilityLabel={f.label}
                  />
                </View>
              ))}
            </ScrollView>
            <Button tone="dark" label="Guardar cuenta" onPress={handleSaveBank} loading={savingBank} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.darkBg },
  content: { paddingHorizontal: theme.spacing.screen, gap: theme.spacing.lg },
  disputesBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: theme.radius.sm, backgroundColor: colors.darkCard },
  disputesText: { fontSize: 12, fontWeight: "700", color: colors.accent },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: theme.radius.card,
    padding: theme.spacing.xl,
    gap: 4,
    ...theme.shadow.md,
  },
  balanceAmount: { fontSize: 32, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.5 },
  balanceSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: theme.spacing.md },
  bonoReferidoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -6, marginBottom: theme.spacing.md },
  bonoReferidoTexto: { fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  balanceBtns: { flexDirection: "row", gap: theme.spacing.sm, alignItems: "stretch" },
  bankChip: {
    flex: 1,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  bankChipText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    gap: theme.spacing.md,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.textWhite },
  link: { fontSize: 13, fontWeight: "700", color: colors.accent },
  bankName: { fontSize: 15, fontWeight: "700", color: colors.textWhite },
  bankLine: { fontSize: 13, color: colors.textSilver },
  bankLineMuted: { fontSize: 13, color: colors.darkTextMuted, lineHeight: 18 },
  bars: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 120, paddingTop: 8 },
  barCol: { alignItems: "center", flex: 1, gap: 6 },
  bar: { width: 16, backgroundColor: colors.accent, borderRadius: 4 },
  barDay: { fontSize: 11, color: colors.textSilver, fontWeight: "600" },
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  histConcept: { fontSize: 13, fontWeight: "600", color: colors.textWhite },
  histDate: { fontSize: 11, color: colors.darkTextMuted, marginTop: 2 },
  histAmount: { fontSize: 14, fontWeight: "800" },
  fleetRow: {
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  fleetName: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.textWhite },
  fleetEarnings: { fontSize: 14, fontWeight: "800", color: colors.accent },
  occupancyTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.darkCardSubtle,
    overflow: "hidden",
  },
  occupancyFill: { height: "100%", borderRadius: 3, backgroundColor: colors.accent },
  fleetMeta: { fontSize: 11, color: colors.darkTextMuted },
  overlay: { flex: 1, backgroundColor: "rgba(6,30,31,0.75)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.darkCard,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: colors.darkBorderStrong,
    gap: theme.spacing.md,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 999, backgroundColor: colors.darkBorderStrong, alignSelf: "center" },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: colors.textWhite },
  sheetSub: { fontSize: 13, color: colors.textSilver, marginTop: -6 },
  input: {
    backgroundColor: colors.darkCardSubtle,
    borderRadius: theme.radius.field,
    paddingHorizontal: 14,
    height: theme.control.heightSm,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    fontSize: 15,
    color: colors.textWhite,
  },
});
