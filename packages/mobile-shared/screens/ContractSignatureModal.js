import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { Button, Checkbox, Field } from "../components/ui";
import { SignaturePad } from "../components/SignaturePad";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";
import { tipoBiometriaDisponible, autenticarParaFirmar } from "../hooks/biometria";

// ============================================================================
// Modal de firma del contrato de arriendo
// ----------------------------------------------------------------------------
// La firma admite tres métodos, en este orden de preferencia:
//   1. Reconocimiento facial (Face ID) — si el teléfono lo tiene enrolado
//   2. Huella dactilar
//   3. Firma manuscrita + nombre (siempre disponible, es el respaldo)
// En los tres casos el backend guarda método, instante UTC, hash del PDF y el
// contexto de red para respaldo legal (POST /reservas/{id}/firmar-contrato).
// ============================================================================

const LABEL_BIOMETRIA = {
  facial: { texto: "Firmar con Face ID", prompt: "Confirma tu identidad para firmar el contrato" },
  huella: { texto: "Firmar con huella", prompt: "Confirma tu identidad para firmar el contrato" },
};

export function ContractSignatureModal({
  visible,
  reservaId,
  parte = "arrendatario", // solo para el copy; el backend deduce el rol
  nombreSugerido = "",
  onClose,
  onSigned,
  onVerContrato,
}) {
  const [acepta, setAcepta] = React.useState(false);
  const [biometria, setBiometria] = React.useState(undefined); // undefined = cargando
  const [modoManual, setModoManual] = React.useState(false);
  const [firmaSvg, setFirmaSvg] = React.useState(null);
  const [nombre, setNombre] = React.useState(nombreSugerido || "");
  const [enviando, setEnviando] = React.useState(false);

  // Bloque: al abrir, detectar qué biometría hay enrolada
  React.useEffect(() => {
    if (!visible) return;
    let vivo = true;
    setAcepta(false);
    setModoManual(false);
    setFirmaSvg(null);
    setNombre(nombreSugerido || "");
    tipoBiometriaDisponible().then((t) => {
      if (!vivo) return;
      setBiometria(t); // "facial" | "huella" | null
      if (!t) setModoManual(true); // sin biometría: directo a la firma manuscrita
    });
    return () => {
      vivo = false;
    };
  }, [visible, nombreSugerido]);

  // Bloque: enviar la firma al backend
  const registrarFirma = async (metodo, extra = {}) => {
    if (enviando) return;
    setEnviando(true);
    try {
      const firma = await ApiClient.firmarContrato(reservaId, {
        metodo,
        acepta_terminos: true,
        ...extra,
      });
      onSigned && onSigned(firma);
    } catch (err) {
      showAlert("No se pudo registrar la firma", err?.message || "Inténtalo de nuevo en unos segundos.");
    } finally {
      setEnviando(false);
    }
  };

  // Bloque: firma biométrica (facial / huella)
  const firmarConBiometria = async () => {
    if (!acepta) {
      showAlert("Falta tu confirmación", "Marca que leíste y aceptas el contrato para firmar.");
      return;
    }
    const cfg = LABEL_BIOMETRIA[biometria];
    const ok = await autenticarParaFirmar(cfg?.prompt);
    if (!ok) {
      showAlert(
        "No se pudo confirmar tu identidad",
        "Puedes reintentar o firmar a mano en su lugar.",
        [
          { text: "Firmar a mano", onPress: () => setModoManual(true) },
          { text: "Reintentar", style: "cancel" },
        ]
      );
      return;
    }
    await registrarFirma(biometria);
  };

  // Bloque: firma manuscrita
  const firmarAMano = async () => {
    if (!acepta) {
      showAlert("Falta tu confirmación", "Marca que leíste y aceptas el contrato para firmar.");
      return;
    }
    if (!firmaSvg) {
      showAlert("Falta tu firma", "Dibuja tu firma en el recuadro antes de continuar.");
      return;
    }
    if (!nombre.trim()) {
      showAlert("Falta tu nombre", "Escribe tu nombre completo tal como aparece en tu cédula.");
      return;
    }
    await registrarFirma("escrita", { firma_svg: firmaSvg, nombre_firmante: nombre.trim() });
  };

  const cargandoBiometria = biometria === undefined;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Firma del contrato</Text>
              <Text style={styles.sub}>
                Firmas como {parte === "arrendador" ? "dueño del vehículo" : "arrendatario"}. Tu firma
                queda registrada con fecha y hora.
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingBottom: theme.spacing.md }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!modoManual && biometria ? (
              <View style={styles.bioHero}>
                <View style={styles.bioCircle}>
                  <Icon
                    name={biometria === "facial" ? "user" : "shield"}
                    size={26}
                    color={colors.accent700}
                  />
                </View>
                <Text style={styles.bioHeroTitle}>
                  {biometria === "facial" ? "Confirma con Face ID" : "Confirma con tu huella"}
                </Text>
                <Text style={styles.bioHeroText}>
                  Tu huella o rostro no salen del teléfono. Solo se usan para firmar este contrato con
                  fecha y hora.
                </Text>
              </View>
            ) : null}

            <View style={styles.legalBox}>
              <Icon name="document" size={18} color={colors.primary} />
              <Text style={styles.legalText}>
                Contrato de arriendo temporal de vehículo · deducible 15 UF (50/50) · jurisdicción
                Los Ángeles, Chile.
              </Text>
            </View>

            {onVerContrato ? (
              <Button
                variant="ghost"
                size="sm"
                label="Leer el contrato completo"
                iconLeft="document"
                onPress={onVerContrato}
                style={{ marginTop: 4 }}
              />
            ) : null}

            <View style={{ marginTop: theme.spacing.md }}>
              <Checkbox
                checked={acepta}
                onToggle={() => setAcepta((v) => !v)}
                label="He leído y acepto los términos del contrato de arriendo."
              />
            </View>

            {modoManual ? (
              <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
                <Text style={styles.sectionLabel}>Firma manuscrita</Text>
                <SignaturePad onChange={setFirmaSvg} />
                <Field
                  label="Nombre completo"
                  value={nombre}
                  onChangeText={setNombre}
                  placeholder="Como aparece en tu cédula"
                  autoCapitalize="words"
                />
                <Text style={styles.hint}>
                  Se guarda tu firma, tu nombre y la fecha y hora exactas como respaldo legal.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {cargandoBiometria ? (
              <Button label="Preparando…" loading disabled />
            ) : modoManual ? (
              <>
                <Button label="Firmar y continuar" onPress={firmarAMano} loading={enviando} />
                {biometria ? (
                  <Button
                    variant="secondary"
                    label={LABEL_BIOMETRIA[biometria].texto}
                    onPress={() => setModoManual(false)}
                    disabled={enviando}
                  />
                ) : null}
              </>
            ) : (
              <>
                <Button
                  label={LABEL_BIOMETRIA[biometria].texto}
                  iconLeft={biometria === "facial" ? "user" : "shield"}
                  onPress={firmarConBiometria}
                  loading={enviando}
                />
                <Button
                  variant="secondary"
                  label="Firmar a mano"
                  onPress={() => setModoManual(true)}
                  disabled={enviando}
                />
              </>
            )}
            <Button variant="ghost" label="Ahora no" onPress={onClose} disabled={enviando} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(6,30,31,0.8)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    maxHeight: "92%",
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: colors.border, alignSelf: "center" },
  header: { flexDirection: "row", paddingBottom: theme.spacing.sm },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  sub: { fontSize: 12.5, color: colors.textMuted, marginTop: 3, lineHeight: 17 },
  body: { marginVertical: 4 },
  bioHero: { alignItems: "center", gap: 6, paddingVertical: theme.spacing.md },
  bioCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  bioHeroTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  bioHeroText: { fontSize: 12.5, lineHeight: 18, color: colors.textMuted, textAlign: "center", paddingHorizontal: theme.spacing.md },
  legalBox: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
    backgroundColor: colors.surfaceSubtle,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    padding: theme.spacing.md,
  },
  legalText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.4 },
  hint: { fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
  footer: { gap: theme.spacing.sm, paddingTop: theme.spacing.sm },
});
