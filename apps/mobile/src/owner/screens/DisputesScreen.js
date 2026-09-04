import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, Chip, Badge, Button, EmptyState, ScreenHeader, SectionLabel, ApiClient, showAlert } from "@rentacar/mobile-shared";

const MOTIVOS = [
  { id: "multa_tag", label: "Peaje / TAG" },
  { id: "multa_policia", label: "Multa de tránsito" },
  { id: "danio_oculto", label: "Daño oculto" },
];
const LABEL = Object.fromEntries(MOTIVOS.map((m) => [m.id, m.label]));

// Estados que devuelve TicketSoporte.estado, traducidos al badge que ve el
// dueño. Antes esto vivía solo en memoria del componente: cerrar la app
// perdía el historial completo de reclamos, y el estado real (si soporte ya
// lo resolvió, si escaló a disputa formal) nunca se reflejaba.
const ESTADO_BADGE = {
  abierto: { variant: "warning", label: "Recibido" },
  en_revision: { variant: "info", label: "En revisión" },
  cerrado: { variant: "success", label: "Cerrado" },
  escalado_a_disputa: { variant: "danger", label: "Escalado a disputa" },
};

export function DisputesScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("activas");
  const [motivo, setMotivo] = useState("multa_tag");
  const [form, setForm] = useState({ monto: "", reservaId: "", folio: "", descripcion: "" });
  const [enviando, setEnviando] = useState(false);

  const [tickets, setTickets] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargarTickets = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await ApiClient.getMisTicketsSoporte();
      setTickets(Array.isArray(datos) ? datos : []);
      setError(null);
    } catch (err) {
      setError(err.message || "No pudimos cargar tus reclamos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarTickets();
  }, [cargarTickets]);

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const crear = async () => {
    if (!form.monto || !form.descripcion) {
      showAlert("Campos requeridos", "Ingresa el monto del cobro y la descripción.");
      return;
    }
    setEnviando(true);
    try {
      const detalle = [
        `Tipo de cobro: ${LABEL[motivo]}`,
        `Monto: $${parseInt(form.monto, 10).toLocaleString("es-CL")}`,
        form.reservaId ? `Reserva: ${form.reservaId}` : null,
        form.folio ? `Folio/comprobante: ${form.folio}` : null,
        `Detalle: ${form.descripcion.trim()}`,
      ].filter(Boolean).join("\n");
      const ticket = await ApiClient.crearTicketSoporte("Reclamo de garantía (Dueño)", detalle);
      // Se agrega de inmediato (no hace falta esperar el próximo refresco
      // para verlo) y de todos modos queda persistido en el backend.
      setTickets((p) => [ticket, ...p]);
      setForm({ monto: "", reservaId: "", folio: "", descripcion: "" });
      showAlert(
        "Reclamo ingresado",
        `Ticket #${ticket.id.slice(0, 8).toUpperCase()} creado. Soporte y mediación revisarán los antecedentes contra el contrato y el checklist.`,
        [{ text: "Entendido", onPress: () => setTab("activas") }]
      );
    } catch (err) {
      showAlert("No se pudo enviar el reclamo", err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScreenHeader
        tone="dark"
        title="Disputas y garantías"
        subtitle="Cobro de multas, TAG o daños contra el hold"
        onBack={onBack}
      />

      <View style={styles.tabs}>
        <Chip tone="dark" label={`Mis reclamos (${tickets.length})`} selected={tab === "activas"} onPress={() => setTab("activas")} />
        <Chip tone="dark" label="Ingresar disputa" selected={tab === "nueva"} onPress={() => setTab("nueva")} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          tab === "activas" ? (
            <RefreshControl refreshing={cargando} onRefresh={cargarTickets} tintColor={colors.accent} />
          ) : undefined
        }
      >
        {tab === "activas" ? (
          cargando && tickets.length === 0 ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
          ) : error && tickets.length === 0 ? (
            <EmptyState
              tone="dark"
              icon="alert"
              title="No pudimos cargar tus reclamos"
              message={error}
              action="Reintentar"
              onAction={cargarTickets}
            />
          ) : tickets.length === 0 ? (
            <EmptyState
              tone="dark"
              icon="document"
              title="Sin reclamos todavía"
              message="Usa 'Ingresar disputa' para reportar un cobro pendiente contra la garantía."
              action="Ingresar disputa"
              onAction={() => setTab("nueva")}
            />
          ) : (
            tickets.map((d) => {
              const badge = ESTADO_BADGE[d.estado] || { variant: "warning", label: d.estado };
              return (
                <View key={d.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.ticketId}>Ticket #{d.id.slice(0, 8).toUpperCase()}</Text>
                    <Badge variant={badge.variant} label={badge.label} />
                  </View>
                  <Text style={styles.asunto}>{d.asunto}</Text>
                  <Text style={styles.fecha}>{new Date(d.timestamp).toLocaleDateString("es-CL")}</Text>
                  <View style={styles.detalle}>
                    <Text style={styles.detalleText}>{d.descripcion}</Text>
                  </View>
                </View>
              );
            })
          )
        ) : (
          <View style={styles.card}>
            <Text style={styles.formTitle}>Nuevo reclamo de garantía</Text>

            <View style={{ gap: 8 }}>
              <SectionLabel tone="dark">Tipo de cobro</SectionLabel>
              <View style={styles.motivos}>
                {MOTIVOS.map((m) => (
                  <Chip key={m.id} tone="dark" label={m.label} selected={motivo === m.id} onPress={() => setMotivo(m.id)} />
                ))}
              </View>
            </View>

            {[
              { k: "monto", label: "Monto a cobrar (CLP)", ph: "25000", kb: "number-pad" },
              { k: "reservaId", label: "ID de la reserva (opcional)", ph: "20fa33e9-…" },
              { k: "folio", label: "Folio de citación o comprobante TAG", ph: "CIT-8921-LA" },
            ].map((fi) => (
              <View key={fi.k} style={{ gap: 6, marginTop: theme.spacing.md }}>
                <Text style={styles.label}>{fi.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={fi.ph}
                  placeholderTextColor={colors.textSilver}
                  value={form[fi.k]}
                  onChangeText={set(fi.k)}
                  keyboardType={fi.kb || "default"}
                  autoCapitalize="none"
                />
              </View>
            ))}

            <View style={{ gap: 6, marginTop: theme.spacing.md }}>
              <Text style={styles.label}>Explicación detallada</Text>
              <TextInput
                style={styles.textarea}
                placeholder="Fecha, autopista o circunstancias de la infracción…"
                placeholderTextColor={colors.textSilver}
                value={form.descripcion}
                onChangeText={set("descripcion")}
                multiline
              />
            </View>

            <Button tone="dark" label="Enviar a mediación" onPress={crear} loading={enviando} style={{ marginTop: theme.spacing.lg }} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.darkBg },
  tabs: { flexDirection: "row", gap: theme.spacing.sm, paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.md },
  body: { padding: theme.spacing.screen, gap: theme.spacing.md, paddingBottom: theme.spacing.xxxl },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    gap: theme.spacing.sm,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ticketId: { fontSize: 12, color: colors.darkTextMuted, fontWeight: "700" },
  asunto: { fontSize: 14, fontWeight: "700", color: colors.textWhite },
  fecha: { fontSize: 12, color: colors.darkTextMuted },
  detalle: { backgroundColor: colors.darkCardSubtle, borderRadius: theme.radius.field, padding: theme.spacing.md },
  detalleText: { fontSize: 12, color: colors.textSilver, lineHeight: 17 },
  formTitle: { fontSize: 15, fontWeight: "700", color: colors.textWhite },
  motivos: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  label: { fontSize: 12, fontWeight: "600", color: colors.textSilver, textTransform: "uppercase", letterSpacing: 0.4 },
  input: {
    backgroundColor: colors.darkCardSubtle,
    borderRadius: theme.radius.field,
    paddingHorizontal: 14,
    height: theme.control.heightSm,
    fontSize: 15,
    color: colors.textWhite,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  textarea: {
    backgroundColor: colors.darkCardSubtle,
    borderRadius: theme.radius.field,
    padding: 14,
    minHeight: 90,
    fontSize: 15,
    color: colors.textWhite,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    textAlignVertical: "top",
  },
});
