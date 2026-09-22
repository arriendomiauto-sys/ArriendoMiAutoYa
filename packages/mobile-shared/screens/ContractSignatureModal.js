import React from "react";
import {
  View,
  Text,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  let insets = { bottom: 0, top: 0, left: 0, right: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch {
    // Si corre fuera de SafeAreaProvider en tests
  }
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
        className="flex-1 bg-[#061e1f]/80 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          className="bg-surface rounded-t-2xl max-h-[92%] p-6 gap-2"
          style={{ paddingBottom: Math.max(insets?.bottom || 0, 32) }}
        >
          <View className="w-10 h-1 rounded-full bg-border self-center" />
          <View className="flex-row pb-2">
            <View className="flex-1">
              <Text className="text-lg font-extrabold text-text">Firma del contrato</Text>
              <Text className="text-[12.5px] text-textMuted mt-1 leading-[17px]">
                Firmas como {parte === "arrendador" ? "dueño del vehículo" : "arrendatario"}. Tu firma
                queda registrada con fecha y hora.
              </Text>
            </View>
          </View>

          <ScrollView
            className="my-1"
            contentContainerStyle={{ paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!modoManual && biometria ? (
              <View className="items-center gap-1.5 py-3">
                <View className="w-16 h-16 rounded-full bg-accent-100 items-center justify-center mb-0.5">
                  <Icon
                    name={biometria === "facial" ? "user" : "shield"}
                    size={26}
                    color={colors.accent700}
                  />
                </View>
                <Text className="text-base font-extrabold text-text">
                  {biometria === "facial" ? "Confirma con Face ID" : "Confirma con tu huella"}
                </Text>
                <Text className="text-[12.5px] leading-[18px] text-textMuted text-center px-3">
                  Tu huella o rostro no salen del teléfono. Solo se usan para firmar este contrato con
                  fecha y hora.
                </Text>
              </View>
            ) : null}

            <View className="flex-row gap-2 items-start bg-surfaceSubtle rounded-xl border border-border p-3">
              <Icon name="document" size={18} color={colors.primary} />
              <Text className="flex-1 text-[12.5px] leading-[18px] text-textSecondary">
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
                className="mt-1"
              />
            ) : null}

            <View className="mt-3">
              <Checkbox
                testID="check-acepta-contrato"
                checked={acepta}
                onToggle={() => setAcepta((v) => !v)}
                label="He leído y acepto los términos del contrato de arriendo."
              />
            </View>

            {modoManual ? (
              <View className="mt-4 gap-2">
                <Text className="text-xs font-bold text-textMuted tracking-wider">Firma manuscrita</Text>
                <SignaturePad onChange={setFirmaSvg} />
                <Field
                  testID="input-nombre-firma"
                  label="Nombre completo"
                  value={nombre}
                  onChangeText={setNombre}
                  placeholder="Como aparece en tu cédula"
                  autoCapitalize="words"
                />
                <Text className="text-[11.5px] leading-4 text-textMuted">
                  Se guarda tu firma, tu nombre y la fecha y hora exactas como respaldo legal.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View className="gap-2 pt-2">
            {cargandoBiometria ? (
              <Button label="Preparando…" loading disabled />
            ) : modoManual ? (
              <>
                <Button testID="btn-firmar-continuar" label="Firmar y continuar" onPress={firmarAMano} loading={enviando} />
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
