import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  StatusBar,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { colors, theme, useApp, Icon, Button, Card, ScreenHeader, SectionLabel, Chip, ApiClient, showAlert } from "@rentacar/mobile-shared";

const TIPOS = [
  { id: "colision", label: "Colisión / choque" },
  { id: "panne", label: "Panne mecánica" },
  { id: "neumatico", label: "Pinchazo" },
  { id: "robo", label: "Robo / daño a terceros" },
];
const LABEL = Object.fromEntries(TIPOS.map((t) => [t.id, t.label]));

export function RoadsideClaimScreen({ onBack, onComplete }) {
  const insets = useSafeAreaInsets();
  const { activeReservation } = useApp();
  const [tipo, setTipo] = useState("colision");
  const [descripcion, setDescripcion] = useState("");
  const [tercero, setTercero] = useState({ patente: "", conductor: "", aseguradora: "" });
  const [fotos, setFotos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const addFoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showAlert("Permiso requerido", "Necesitamos la cámara para adjuntar el daño.");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (r.canceled || !r.assets?.length) return;
    setSubiendo(true);
    try {
      const a = r.assets[0];
      const up = await ApiClient.subirArchivoStorage(a.uri, a.fileName || `siniestro-${Date.now()}.jpg`, "evidencias");
      setFotos((p) => [...p, up.url]);
    } catch (err) {
      showAlert("No se pudo subir la foto", err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const solicitarGrua = async () => {
    try {
      await ApiClient.crearTicketSoporte(
        "Solicitud de grúa urgente",
        `Auxilio mecánico.${activeReservation?.id ? ` Reserva: ${activeReservation.id}.` : ""} Incidente: ${LABEL[tipo]}.`
      );
      showAlert("Solicitud enviada", "Se notificó a soporte para coordinar la grúa. Te contactarán a la brevedad.");
    } catch (err) {
      showAlert("No se pudo enviar", err.message);
    }
  };

  const enviarReporte = async () => {
    if (!descripcion.trim()) {
      showAlert("Falta la descripción", "Describe brevemente lo sucedido.");
      return;
    }
    setEnviando(true);
    try {
      const detalle = [
        `Tipo: ${LABEL[tipo]}`,
        activeReservation?.id ? `Reserva: ${activeReservation.id}` : null,
        `Descripción: ${descripcion.trim()}`,
        tercero.patente ? `Patente tercero: ${tercero.patente}` : null,
        tercero.conductor ? `Conductor tercero: ${tercero.conductor}` : null,
        tercero.aseguradora ? `Aseguradora tercero: ${tercero.aseguradora}` : null,
        fotos.length ? `Fotos: ${fotos.join(", ")}` : "Sin fotos adjuntas",
      ].filter(Boolean).join("\n");
      const ticket = await ApiClient.crearTicketSoporte("Auxilio en ruta / siniestro", detalle);
      showAlert(
        "Reporte ingresado",
        `Ticket #${ticket.id.slice(0, 8).toUpperCase()} creado. Soporte revisará tu caso y coordinará auxilio y/o aseguradora.`,
        [{ text: "Entendido", onPress: onComplete || onBack }]
      );
    } catch (err) {
      showAlert("No se pudo enviar el reporte", err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Auxilio en ruta" subtitle="Siniestros y asistencia 24/7" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.emergency}>
          <Button variant="danger" label="Solicitar grúa" iconLeft="shield" onPress={solicitarGrua} style={{ flex: 1 }} />
          <Button label="Carabineros 133" onPress={() => Linking.openURL("tel:133")} style={{ flex: 1 }} />
        </View>

        <Card padded style={{ gap: theme.spacing.md }}>
          <SectionLabel>Tipo de incidente</SectionLabel>
          <View style={styles.chips}>
            {TIPOS.map((t) => (
              <Chip key={t.id} label={t.label} selected={tipo === t.id} onPress={() => setTipo(t.id)} />
            ))}
          </View>
        </Card>

        <Card padded style={{ gap: theme.spacing.sm }}>
          <SectionLabel>Detalle de lo ocurrido</SectionLabel>
          <TextInput
            style={styles.textarea}
            placeholder="Lugar exacto, calle, intersección y cómo ocurrió…"
            placeholderTextColor={colors.textPlaceholder}
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
          />
        </Card>

        {tipo === "colision" && (
          <Card padded style={{ gap: theme.spacing.md }}>
            <SectionLabel>Tercero involucrado (opcional)</SectionLabel>
            {[
              { k: "patente", label: "Patente del otro auto", cap: "characters" },
              { k: "conductor", label: "Nombre del conductor" },
              { k: "aseguradora", label: "Aseguradora del tercero" },
            ].map((f) => (
              <View key={f.k} style={{ gap: 6 }}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  value={tercero[f.k]}
                  onChangeText={(v) => setTercero((p) => ({ ...p, [f.k]: v }))}
                  placeholderTextColor={colors.textPlaceholder}
                  autoCapitalize={f.cap || "sentences"}
                />
              </View>
            ))}
          </Card>
        )}

        <Card padded style={{ gap: theme.spacing.md }}>
          <SectionLabel>Registro fotográfico del daño</SectionLabel>
          <View style={styles.photos}>
            {fotos.map((p, i) => (
              <Image key={i} source={{ uri: p }} style={styles.photo} />
            ))}
            <TouchableOpacity style={styles.addPhoto} onPress={addFoto} disabled={subiendo}>
              {subiendo ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="camera" size={20} color={colors.primary} />}
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Button label="Enviar reporte y activar seguro" iconRight="arrow-right" onPress={enviarReporte} loading={enviando} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  emergency: { flexDirection: "row", gap: theme.spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  textarea: {
    minHeight: 90,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    backgroundColor: colors.surface,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: "top",
  },
  fieldLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  input: {
    height: theme.control.heightSm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
  },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  photo: { width: 64, height: 64, borderRadius: theme.radius.sm },
  addPhoto: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary100,
  },
  footer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
