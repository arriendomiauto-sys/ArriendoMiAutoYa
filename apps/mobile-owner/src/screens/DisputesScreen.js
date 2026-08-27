import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { colors, Icon, ApiClient } from "@rentacar/mobile-shared";

const MOTIVO_LABELS = {
  multa_tag: "Peaje / TAG",
  multa_policia: "Multa Tránsito",
  danio_oculto: "Daño Oculto",
};

export function DisputesScreen({ onBack }) {
  const [activeTab, setActiveTab] = useState("activas"); // 'activas' | 'nueva'
  const [montoReclamo, setMontoReclamo] = useState("");
  const [motivo, setMotivo] = useState("multa_tag");
  const [folioMulta, setFolioMulta] = useState("");
  const [reservaId, setReservaId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);

  // No existe hoy un endpoint para que el dueño liste sus propias disputas
  // (/disputas es solo Admin/Manager) — los reclamos ingresados quedan
  // registrados como tickets de soporte, visibles para el equipo, hasta que
  // se agregue esa vista.
  const [reclamosEnviados, setReclamosEnviados] = useState([]);

  const handleCrearDisputa = async () => {
    if (!montoReclamo || !descripcion) {
      Alert.alert("Campos requeridos", "Ingresa el monto del cobro y la descripción.");
      return;
    }
    setEnviando(true);
    try {
      const detalle = [
        `Tipo de cobro: ${MOTIVO_LABELS[motivo]}`,
        `Monto a cobrar: $${parseInt(montoReclamo, 10).toLocaleString("es-CL")} CLP`,
        reservaId ? `Reserva: ${reservaId}` : null,
        folioMulta ? `Folio/comprobante: ${folioMulta}` : null,
        `Detalle: ${descripcion.trim()}`,
      ]
        .filter(Boolean)
        .join("\n");

      const ticket = await ApiClient.crearTicketSoporte(
        "Reclamo de garantía (Dueño)",
        detalle
      );
      setReclamosEnviados((prev) => [ticket, ...prev]);
      setMontoReclamo("");
      setFolioMulta("");
      setReservaId("");
      setDescripcion("");
      Alert.alert(
        "Reclamo Ingresado",
        `Ticket #${ticket.id.slice(0, 8).toUpperCase()} creado. El equipo de soporte y mediación revisará los antecedentes contra el contrato y el checklist fotográfico.`,
        [{ text: "Entendido", onPress: () => setActiveTab("activas") }]
      );
    } catch (err) {
      Alert.alert("No se pudo enviar el reclamo", err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Botón Volver */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Icon name="arrow-left" size={14} color={colors.textWhite} style={{ marginRight: 4 }} />
        <Text style={styles.backBtnText}>Volver</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>MEDIACIÓN Y GARANTÍAS</Text>
        </View>
        <Text style={styles.title}>Centro de Disputas</Text>
        <Text style={styles.subtitle}>
          Cobro de multas de tránsito, TAG o daños con cargo al hold de garantía
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "activas" && styles.tabBtnActive]}
          onPress={() => setActiveTab("activas")}
        >
          <Text style={[styles.tabBtnText, activeTab === "activas" && styles.tabBtnTextActive]}>
            Mis Reclamos ({reclamosEnviados.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "nueva" && styles.tabBtnActive]}
          onPress={() => setActiveTab("nueva")}
        >
          <Text style={[styles.tabBtnText, activeTab === "nueva" && styles.tabBtnTextActive]}>
            + Ingresar Disputa
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: LISTA */}
      {activeTab === "activas" && (
        <View>
          {reclamosEnviados.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                Aún no has ingresado reclamos en esta sesión. Usa "+ Ingresar Disputa" para
                reportar un cobro pendiente.
              </Text>
            </View>
          )}
          {reclamosEnviados.map((d) => (
            <View key={d.id} style={styles.disputeCard}>
              <View style={styles.disputeHeader}>
                <Text style={styles.disputeId}>Ticket #{d.id.slice(0, 8).toUpperCase()}</Text>
                <View style={styles.statusReview}>
                  <Text style={styles.textWarning}>
                    {d.estado === "abierto" ? "Recibido" : d.estado}
                  </Text>
                </View>
              </View>

              <Text style={styles.disputeMotivo}>{d.asunto}</Text>

              <View style={styles.disputeInfoRow}>
                <Text style={styles.disputeDate}>
                  {new Date(d.timestamp).toLocaleDateString("es-CL")}
                </Text>
              </View>

              <View style={styles.resolutionBox}>
                <Text style={styles.resolutionText}>{d.descripcion}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* TAB 2: NUEVA DISPUTA */}
      {activeTab === "nueva" && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Ingresar Nuevo Reclamo de Garantía</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tipo de Cobro</Text>
            <View style={styles.motivoRow}>
              {[
                { id: "multa_tag", label: "Peaje / TAG" },
                { id: "multa_policia", label: "Multa Tránsito" },
                { id: "danio_oculto", label: "Daño Oculto" },
              ].map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.motivoBtn, motivo === m.id && styles.motivoBtnActive]}
                  onPress={() => setMotivo(m.id)}
                >
                  <Text style={[styles.motivoBtnText, motivo === m.id && styles.motivoBtnTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Monto a Cobrar (CLP)</Text>
            <TextInput
              style={styles.input}
              placeholder="ej. 25000"
              placeholderTextColor={colors.textMuted}
              value={montoReclamo}
              onChangeText={setMontoReclamo}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>ID de la Reserva (Opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="ej. 20fa33e9-4777-..."
              placeholderTextColor={colors.textMuted}
              value={reservaId}
              onChangeText={setReservaId}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Folio de Citación o Comprobante TAG</Text>
            <TextInput
              style={styles.input}
              placeholder="ej. CIT-8921-LA"
              placeholderTextColor={colors.textMuted}
              value={folioMulta}
              onChangeText={setFolioMulta}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Explicación Detallada</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Detalla fecha, autopista o circunstancias de la infracción..."
              placeholderTextColor={colors.textMuted}
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, enviando && styles.btnDisabled]}
            onPress={handleCrearDisputa}
            disabled={enviando}
          >
            {enviando ? (
              <ActivityIndicator color={colors.dark} />
            ) : (
              <Text style={styles.submitBtnText}>Enviar a Mediación Legal →</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
    backgroundColor: colors.darkCard,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textWhite,
  },
  header: {
    marginBottom: 12,
  },
  badgePill: {
    backgroundColor: colors.accentMuted,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  badgePillText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "900",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textWhite,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSilver,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    backgroundColor: colors.darkCard,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  tabBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSilver,
  },
  tabBtnTextActive: {
    color: colors.dark,
    fontWeight: "800",
  },
  emptyBox: {
    padding: 20,
    backgroundColor: colors.darkCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textSilver,
    lineHeight: 18,
    textAlign: "center",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  disputeCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    marginBottom: 10,
  },
  disputeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  disputeId: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "700",
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  statusApproved: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusReview: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  statusText: {
    fontSize: 9,
    fontWeight: "800",
  },
  textSuccess: {
    color: colors.success,
  },
  textWarning: {
    color: colors.warning,
  },
  disputeMotivo: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textWhite,
    marginBottom: 6,
  },
  disputeInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  disputeAmount: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.accent,
  },
  disputeDate: {
    fontSize: 10,
    color: colors.textMuted,
  },
  resolutionBox: {
    backgroundColor: colors.darkCardHover,
    padding: 8,
    borderRadius: 6,
  },
  resolutionText: {
    fontSize: 10,
    color: colors.textSilver,
    lineHeight: 14,
  },
  formCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textWhite,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSilver,
    marginBottom: 4,
  },
  motivoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  motivoBtn: {
    flex: 1,
    backgroundColor: colors.darkCardHover,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: "center",
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  motivoBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  motivoBtnText: {
    fontSize: 10,
    color: colors.textSilver,
    fontWeight: "600",
  },
  motivoBtnTextActive: {
    color: colors.accent,
    fontWeight: "800",
  },
  input: {
    backgroundColor: colors.darkCardHover,
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 12,
    color: colors.textWhite,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  textArea: {
    backgroundColor: colors.darkCardHover,
    borderRadius: 6,
    padding: 10,
    fontSize: 11,
    color: colors.textWhite,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    height: 70,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 11,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 6,
  },
  submitBtnText: {
    color: colors.dark,
    fontWeight: "800",
    fontSize: 12,
  },
});
