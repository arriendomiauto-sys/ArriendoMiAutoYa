import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, Chip, Badge, Button, EmptyState, SectionLabel, ApiClient, showAlert, msjError } from "@rentacar/mobile-shared";
import { CabeceraOwner } from "../comun";

const MOTIVOS = [
  { id: "multa_tag", label: "Peaje / TAG" },
  { id: "multa_policia", label: "Multa de tránsito" },
  { id: "danio_oculto", label: "Daño oculto" },
];
const LABEL = Object.fromEntries(MOTIVOS.map((m) => [m.id, m.label]));

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
      setError(msjError(err, "No pudimos cargar tus reclamos."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarTickets();
  }, [cargarTickets]);

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const crear = async () => {
    if (enviando) return;
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
      setTickets((p) => [ticket, ...p]);
      setForm({ monto: "", reservaId: "", folio: "", descripcion: "" });
      showAlert(
        "Reclamo ingresado",
        `Ticket #${ticket.id.slice(0, 8).toUpperCase()} creado. Soporte y mediación revisarán los antecedentes contra el contrato y el checklist.`,
        [{ text: "Entendido", onPress: () => setTab("activas") }]
      );
    } catch (err) {
      showAlert("No se pudo enviar el reclamo", msjError(err, "Intenta de nuevo en unos segundos."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      style={{ paddingTop: Math.max(insets.top, 12) }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <CabeceraOwner
        titulo="Disputas y garantías"
        subtitulo="Cobro de multas, TAG o daños contra el hold"
        onBack={onBack}
      />

      <View className="flex-row gap-2 px-4 pb-3">
        <Chip label={`Mis reclamos (${tickets.length})`} selected={tab === "activas"} onPress={() => setTab("activas")} />
        <Chip label="Ingresar disputa" selected={tab === "nueva"} onPress={() => setTab("nueva")} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 32 }}
        className="px-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          tab === "activas" ? (
            <RefreshControl refreshing={cargando} onRefresh={cargarTickets} tintColor={colors.primary} />
          ) : undefined
        }
      >
        {tab === "activas" ? (
          cargando && tickets.length === 0 ? (
            <ActivityIndicator color={colors.primary} className="mt-10" />
          ) : error && tickets.length === 0 ? (
            <EmptyState
              icon="alert"
              title="No pudimos cargar tus reclamos"
              message={error}
              action="Reintentar"
              onAction={cargarTickets}
            />
          ) : tickets.length === 0 ? (
            <EmptyState
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
                <View key={d.id} className="bg-white rounded-2xl border border-gray-100 p-4 gap-2 shadow-sm mb-3">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-xs text-textMuted font-bold">Ticket #{d.id.slice(0, 8).toUpperCase()}</Text>
                    <Badge variant={badge.variant} label={badge.label} />
                  </View>
                  <Text className="text-sm font-bold text-textDark">{d.asunto}</Text>
                  <Text className="text-xs text-textMuted">{new Date(d.timestamp).toLocaleDateString("es-CL")}</Text>
                  <View className="bg-surface-subtle p-3 rounded-xl mt-0.5">
                    <Text className="text-xs text-textMuted leading-[17px]">{d.descripcion}</Text>
                  </View>
                </View>
              );
            })
          )
        ) : (
          <View className="bg-white rounded-2xl border border-gray-100 p-4 gap-2 shadow-sm mb-6">
            <Text className="text-[15px] font-bold text-textDark">Nuevo reclamo de garantía</Text>

            <View className="gap-2 mt-2">
              <SectionLabel>Tipo de cobro</SectionLabel>
              <View className="flex-row flex-wrap gap-2">
                {MOTIVOS.map((m) => (
                  <Chip key={m.id} label={m.label} selected={motivo === m.id} onPress={() => setMotivo(m.id)} />
                ))}
              </View>
            </View>

            {[
              { k: "monto", label: "Monto a cobrar (CLP)", ph: "25000", kb: "number-pad" },
              { k: "reservaId", label: "ID de la reserva (opcional)", ph: "20fa33e9-…" },
              { k: "folio", label: "Folio de citación o comprobante TAG", ph: "CIT-8921-LA" },
            ].map((fi) => (
              <View key={fi.k} className="gap-1.5 mt-3">
                <Text className="text-xs font-semibold text-textMuted uppercase tracking-wider">{fi.label}</Text>
                <TextInput
                  className="bg-white rounded-xl px-3.5 h-12 text-[15px] text-textDark border-[1.5px] border-gray-200"
                  placeholder={fi.ph}
                  placeholderTextColor={colors.textPlaceholder}
                  value={form[fi.k]}
                  onChangeText={set(fi.k)}
                  keyboardType={fi.kb || "default"}
                  autoCapitalize="none"
                />
              </View>
            ))}

            <View className="gap-1.5 mt-3">
              <Text className="text-xs font-semibold text-textMuted uppercase tracking-wider">Explicación detallada</Text>
              <TextInput
                className="bg-white rounded-xl p-3.5 min-h-[90px] text-[15px] text-textDark border-[1.5px] border-gray-200"
                style={{ textAlignVertical: "top" }}
                placeholder="Fecha, autopista o circunstancias de la infracción…"
                placeholderTextColor={colors.textPlaceholder}
                value={form.descripcion}
                onChangeText={set("descripcion")}
                multiline
              />
            </View>

            <Button label="Enviar a mediación" onPress={crear} loading={enviando} className="mt-4" />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
