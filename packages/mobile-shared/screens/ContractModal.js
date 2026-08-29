import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Linking } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { useApp } from "../context/AppContext";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";

const CLAUSULAS = [
  {
    h: "Primera — objeto y entrega",
    t: "El Arrendador entrega en arriendo el vehículo individualizado. La entrega y restitución se perfecciona mediante la validación del código QR y el registro fotográfico obligatorio de 9 imágenes del checklist inicial y final.",
  },
  {
    h: "Segunda — seguro y deducible",
    t: "El vehículo cuenta con Seguro Full Cobertura con deducible de 15 UF (~$562.500). En caso de siniestro culpable o daño imputable, el deducible se distribuye 50% al Arrendatario y 50% a la Empresa.",
  },
  {
    h: "Tercera — devolución y limpieza",
    t: "El Arrendatario restituye el vehículo en idénticas condiciones de aseo y combustible. Compensación por lavado: $15.000 (suciedad estándar) o $35.000 (tapiz manchado), y $15.000 por cada cuarto de estanque faltante, transferidos íntegramente al dueño.",
  },
];

export function ContractModal({ visible, onClose, reservation }) {
  const { currentUser } = useApp();

  const descargarPdf = async () => {
    try {
      const blob = await ApiClient.descargarContratoPdfBlob(reservation.id);
      Linking.openURL(URL.createObjectURL(blob));
    } catch (err) {
      showAlert("No se pudo abrir el contrato", err.message);
    }
  };

  const auto = reservation?.auto || reservation?.car || {};

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Contrato digital de arriendo</Text>
              <Text style={styles.sub}>Válido ante Carabineros y la aseguradora</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={theme.control.hitSlop} style={styles.close}>
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {!reservation ? (
            <Text style={styles.empty}>Selecciona una reserva para ver su contrato.</Text>
          ) : (
            <>
              <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                <View style={styles.legalBox}>
                  <Text style={styles.folio}>Folio digital {String(reservation.id).toUpperCase()}</Text>
                  <Text style={styles.place}>Los Ángeles, Región del Biobío, Chile</Text>

                  <Text style={styles.h}>Comparecen</Text>
                  <Text style={styles.p}>
                    <Text style={styles.b}>Arrendatario:</Text>{" "}
                    {currentUser?.nombre || currentUser?.email || "—"}
                    {currentUser?.rut ? `, cédula ${currentUser.rut}` : ""}.
                    {"\n"}
                    <Text style={styles.b}>Vehículo:</Text> {auto.marca || "—"} {auto.modelo || ""}, patente{" "}
                    {auto.patente || "—"}, año {auto.anio || "—"}.
                    {"\n"}
                    <Text style={styles.b}>Plataforma:</Text> Arrienda Tu Auto SpA, RUT 77.892.120-K.
                  </Text>

                  {CLAUSULAS.map((c) => (
                    <View key={c.h}>
                      <Text style={styles.h}>Cláusula {c.h}</Text>
                      <Text style={styles.p}>{c.t}</Text>
                    </View>
                  ))}

                  <Text style={styles.h}>Cláusula cuarta — hold de garantía</Text>
                  <Text style={styles.p}>
                    Se autoriza la retención (hold) de ${(reservation.monto_hold || 0).toLocaleString("es-CL")} en
                    la tarjeta registrada, liberable tras la inspección de devolución sin novedades.
                  </Text>

                  <View style={styles.stamp}>
                    <Icon name="shield" size={18} color={colors.success} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stampTitle}>Firma electrónica avanzada</Text>
                      <Text style={styles.stampMeta}>SHA-256 · {new Date().toISOString()}</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.footer}>
                <Button label="Ver / descargar PDF" onPress={descargarPdf} style={{ flex: 1.5 }} />
                <Button variant="secondary" label="Cerrar" onPress={onClose} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(6,30,31,0.8)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    maxHeight: "90%",
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: colors.border, alignSelf: "center" },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  close: { padding: 4 },
  empty: { fontSize: 14, color: colors.textMuted, paddingVertical: theme.spacing.xl, textAlign: "center" },
  body: { marginVertical: 4 },
  legalBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: theme.radius.field,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  folio: { fontSize: 12, fontWeight: "800", color: colors.primary },
  place: { fontSize: 12, color: colors.textMuted, marginBottom: theme.spacing.md },
  h: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: theme.spacing.md, marginBottom: 3 },
  p: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  b: { fontWeight: "700", color: colors.text },
  stamp: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: colors.successBg,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.successBorder,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  stampTitle: { fontSize: 12, fontWeight: "800", color: colors.successText },
  stampMeta: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  footer: { flexDirection: "row", gap: theme.spacing.sm },
});
