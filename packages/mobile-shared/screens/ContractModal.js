import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Linking, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
    t: "El vehículo cuenta con programa de protección frente a siniestros con deducible de 15 UF. En caso de siniestro cubierto, el deducible se absorbe 50% por ARRIENDO MI AUTO SpA y 50% por el Arrendador, quedando exento el Arrendatario salvo dolo, negligencia grave o exclusiones.",
  },
  {
    h: "Tercera — devolución y limpieza",
    t: "El Arrendatario restituye el vehículo en idénticas condiciones de aseo y combustible. Compensación por lavado: $15.000 (suciedad estándar) o $35.000 (tapiz manchado), y $15.000 por cada cuarto de estanque faltante, transferidos íntegramente al dueño.",
  },
];

export function ContractModal({ visible, onClose, reservation }) {
  let insets = { bottom: 0, top: 0, left: 0, right: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch {
    // Si corre fuera de SafeAreaProvider en tests
  }
  const { currentUser } = useApp();

  const [descargando, setDescargando] = React.useState(false);

  const descargarPdf = async () => {
    if (descargando) return;
    setDescargando(true);
    try {
      if (Platform.OS === "web") {
        // En web sí existe URL.createObjectURL: se abre el blob en una pestaña.
        const blob = await ApiClient.descargarContratoPdfBlob(reservation.id);
        const url = URL.createObjectURL(blob);
        if (typeof window !== "undefined" && window.open) window.open(url, "_blank");
        else await Linking.openURL(url);
        return;
      }

      // Nativo: descargar el PDF autenticado a un archivo y abrir la hoja de
      // compartir del sistema (ver / guardar / imprimir). RN no tiene
      // URL.createObjectURL, por eso no se puede usar el blob directamente.
      const fileUri = await ApiClient.descargarContratoPdfArchivo(reservation?.id);
      let Sharing = null;
      try {
        Sharing = require("expo-sharing");
      } catch {
        Sharing = null;
      }
      if (Sharing && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/pdf",
          dialogTitle: "Contrato digital de arriendo",
          UTI: "com.adobe.pdf",
        });
      } else {
        // Sin hoja de compartir (raro): intentar abrir el archivo directo.
        await Linking.openURL(fileUri);
      }
    } catch (err) {
      showAlert(
        "No se pudo abrir el contrato",
        err?.message || "Inténtalo de nuevo en unos segundos."
      );
    } finally {
      setDescargando(false);
    }
  };

  const auto = reservation?.auto || reservation?.car || {};

  // Firmas reales de la reserva (POST /reservas/{id}/firmar-contrato). El
  // contrato está "firmado por las dos partes" cuando hay firma de
  // arrendatario y de arrendador.
  const firmas = Array.isArray(reservation?.firmas) ? reservation.firmas : [];
  const firmaDe = (rol) => firmas.find((f) => f.rol === rol);
  const ambasFirmas = firmaDe("arrendatario") && firmaDe("arrendador");
  const METODO_LABEL = { facial: "Face ID", huella: "huella dactilar", escrita: "firma manuscrita" };
  const fechaFirma = (() => {
    const ts = firmas
      .map((f) => f.timestamp || f.creado_en || f.fecha)
      .filter(Boolean)
      .sort()
      .pop();
    if (!ts) return null;
    const d = new Date(ts);
    return isNaN(d) ? null : d.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  })();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets?.bottom || 0, 16) + 8 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Contrato digital de arriendo</Text>
              <Text style={styles.sub}>Válido ante Carabineros y la aseguradora</Text>
            </View>
            {reservation ? (
              <TouchableOpacity
                onPress={descargarPdf}
                hitSlop={theme.control.hitSlop}
                style={styles.close}
                accessibilityRole="button"
                accessibilityLabel="Descargar o compartir el contrato en PDF"
              >
                <Icon name="share" size={18} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onClose} hitSlop={theme.control.hitSlop} style={styles.close}>
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {!reservation ? (
            <Text style={styles.empty}>Selecciona una reserva para ver su contrato.</Text>
          ) : (
            <>
              {ambasFirmas ? (
                <View style={styles.firmadoBanner}>
                  <Icon name="shield" size={16} color={colors.accent700} />
                  <Text style={styles.firmadoText}>
                    {fechaFirma
                      ? `Firmado por las dos partes el ${fechaFirma}.`
                      : "Firmado por las dos partes."}
                  </Text>
                </View>
              ) : null}

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
                    <Text style={styles.b}>Plataforma:</Text> ARRIENDO MI AUTO SpA, RUT 78.493.457-8.
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
                      {firmas.length ? (
                        firmas.map((f, i) => (
                          <Text key={f.rol || i} style={styles.stampMeta}>
                            {f.rol === "arrendador" ? "Dueño" : "Arrendatario"}:{" "}
                            {METODO_LABEL[f.metodo] || f.metodo || "firma registrada"}
                          </Text>
                        ))
                      ) : (
                        <Text style={styles.stampMeta}>Pendiente de firma de ambas partes.</Text>
                      )}
                    </View>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.footer}>
                <Button
                  label="Ver / descargar PDF"
                  onPress={descargarPdf}
                  loading={descargando}
                  style={{ flex: 1.5 }}
                />
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
  firmadoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: colors.accent100,
    borderRadius: theme.radius.field,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  firmadoText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: colors.accent800, lineHeight: 17 },
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
