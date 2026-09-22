import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Linking, Platform } from "react-native";
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
      <View className="flex-1 bg-[#061e1f]/80 justify-end">
        <View
          className="bg-surface rounded-t-2xl max-h-[90%] p-6 gap-3"
          style={{ paddingBottom: Math.max(insets?.bottom || 0, 16) + 12 }}
        >
          <View className="w-10 h-1 rounded-full bg-border self-center" />
          <View className="flex-row items-start gap-3 pb-3 border-b border-border">
            <View className="flex-1">
              <Text className="text-[17px] font-bold text-text">Contrato digital de arriendo</Text>
              <Text className="text-xs text-textMuted mt-0.5">Válido ante Carabineros y la aseguradora</Text>
            </View>
            {reservation ? (
              <TouchableOpacity
                onPress={descargarPdf}
                hitSlop={theme.control.hitSlop}
                className="p-1"
                accessibilityRole="button"
                accessibilityLabel="Descargar o compartir el contrato en PDF"
              >
                <Icon name="share" size={18} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onClose} hitSlop={theme.control.hitSlop} className="p-1">
              <Icon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {!reservation ? (
            <Text className="text-sm text-textMuted py-6 text-center">Selecciona una reserva para ver su contrato.</Text>
          ) : (
            <>
              {ambasFirmas ? (
                <View className="flex-row items-center gap-2 bg-accent-100 rounded-xl py-2 px-3">
                  <Icon name="shield" size={16} color={colors.accent700} />
                  <Text className="flex-1 text-[12.5px] font-semibold text-accent-800 leading-[17px]">
                    {fechaFirma
                      ? `Firmado por las dos partes el ${fechaFirma}.`
                      : "Firmado por las dos partes."}
                  </Text>
                </View>
              ) : null}

              <ScrollView className="my-1" showsVerticalScrollIndicator={false}>
                <View className="bg-surfaceSubtle rounded-xl p-4 border border-border">
                  <Text className="text-xs font-extrabold text-primary">Folio digital {String(reservation.id).toUpperCase()}</Text>
                  <Text className="text-xs text-textMuted mb-3">Los Ángeles, Región del Biobío, Chile</Text>

                  <Text className="text-[13px] font-bold text-text mt-3 mb-1">Comparecen</Text>
                  <Text className="text-[13px] text-textMuted leading-[19px]">
                    <Text className="font-bold text-text">Arrendatario:</Text>{" "}
                    {currentUser?.nombre || currentUser?.email || "—"}
                    {currentUser?.rut ? `, cédula ${currentUser.rut}` : ""}.
                    {"\n"}
                    <Text className="font-bold text-text">Vehículo:</Text> {auto.marca || "—"} {auto.modelo || ""}, patente{" "}
                    {auto.patente || "—"}, año {auto.anio || "—"}.
                    {"\n"}
                    <Text className="font-bold text-text">Plataforma:</Text> ARRIENDO MI AUTO SpA, RUT 78.493.457-8.
                  </Text>

                  {CLAUSULAS.map((c) => (
                    <View key={c.h}>
                      <Text className="text-[13px] font-bold text-text mt-3 mb-1">Cláusula {c.h}</Text>
                      <Text className="text-[13px] text-textMuted leading-[19px]">{c.t}</Text>
                    </View>
                  ))}

                  <Text className="text-[13px] font-bold text-text mt-3 mb-1">Cláusula cuarta — hold de garantía</Text>
                  <Text className="text-[13px] text-textMuted leading-[19px]">
                    Se autoriza la retención (hold) de ${(reservation.monto_hold || 0).toLocaleString("es-CL")} en
                    la tarjeta registrada, liberable tras la inspección de devolución sin novedades.
                  </Text>

                  <View className="flex-row items-center gap-3 bg-emerald-50 rounded-xl border border-emerald-200 p-3 mt-4">
                    <Icon name="shield" size={18} color={colors.success} />
                    <View className="flex-1">
                      <Text className="text-xs font-extrabold text-emerald-900">Firma electrónica avanzada</Text>
                      {firmas.length ? (
                        firmas.map((f, i) => (
                          <Text key={f.rol || i} className="text-[10px] text-textMuted mt-0.5">
                            {f.rol === "arrendador" ? "Dueño" : "Arrendatario"}:{" "}
                            {METODO_LABEL[f.metodo] || f.metodo || "firma registrada"}
                          </Text>
                        ))
                      ) : (
                        <Text className="text-[10px] text-textMuted mt-0.5">Pendiente de firma de ambas partes.</Text>
                      )}
                    </View>
                  </View>
                </View>
              </ScrollView>

              <View className="flex-row gap-2">
                <Button
                  label="Ver / descargar PDF"
                  onPress={descargarPdf}
                  loading={descargando}
                  className="flex-[1.5]"
                />
                <Button variant="secondary" label="Cerrar" onPress={onClose} className="flex-1" />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
