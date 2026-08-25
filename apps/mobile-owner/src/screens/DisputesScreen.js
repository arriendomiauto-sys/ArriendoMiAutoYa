import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { colors, Icon } from "@rentacar/mobile-shared";

export function DisputesScreen({ onBack }) {
  const [activeTab, setActiveTab] = useState("activas"); // 'activas' | 'nueva'
  const [montoReclamo, setMontoReclamo] = useState("");
  const [motivo, setMotivo] = useState("multa_tag");
  const [folioMulta, setFolioMulta] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const disputasMock = [
    {
      id: "DSP-101",
      reservaId: "RES-CL-2026-88",
      motivo: "Cobro TAG Autopista del Itata no declarado",
      monto: "$8.400 CLP",
      fecha: "12 Ago 2026",
      estado: "aprobada",
      resolucion: "Hold descontado y transferido al dueño.",
    },
    {
      id: "DSP-102",
      reservaId: "RES-CL-2026-74",
      motivo: "Parte empadronado Juzgado de Policía Local Los Ángeles",
      monto: "$48.200 CLP",
      fecha: "05 Ago 2026",
      estado: "en_revision",
      resolucion: "En mediación con equipo legal de Arrienda Tu Auto.",
    },
  ];

  const handleCrearDisputa = () => {
    if (!montoReclamo || !descripcion) {
      Alert.alert("Campos requeridos", "Ingresa el monto del cobro y la descripción.");
      return;
    }
    Alert.alert(
      "Disputa Ingresada",
      "El equipo de soporte y mediación legal revisará los antecedentes y contrastará con el contrato y checklist fotográfico.",
      [{ text: "Entendido", onPress: () => setActiveTab("activas") }]
    );
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
            Mis Reclamos ({disputasMock.length})
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
          {disputasMock.map((d) => (
            <View key={d.id} style={styles.disputeCard}>
              <View style={styles.disputeHeader}>
                <Text style={styles.disputeId}>{d.id} • {d.reservaId}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    d.estado === "aprobada" ? styles.statusApproved : styles.statusReview,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      d.estado === "aprobada" ? styles.textSuccess : styles.textWarning,
                    ]}
                  >
                    {d.estado === "aprobada" ? "Aprobada y Cobrada" : "En Mediación"}
                  </Text>
                </View>
              </View>

              <Text style={styles.disputeMotivo}>{d.motivo}</Text>

              <View style={styles.disputeInfoRow}>
                <Text style={styles.disputeAmount}>{d.monto}</Text>
                <Text style={styles.disputeDate}>{d.fecha}</Text>
              </View>

              <View style={styles.resolutionBox}>
                <Text style={styles.resolutionText}>Resolución: {d.resolucion}</Text>
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

          <TouchableOpacity style={styles.submitBtn} onPress={handleCrearDisputa}>
            <Text style={styles.submitBtnText}>Enviar a Mediación Legal →</Text>
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
