import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui";
import { AdjuntarFoto } from "../components/AdjuntarFoto";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";
import { msjError } from "../utils/msjError";

const TIPOS_FALTAS = [
  { id: "fumar", label: "Fumar en el auto", sugerido: 50000, desc: "Olor a tabaco o cenizas en el interior" },
  { id: "lugar_no_acordado", label: "Lugar no acordado", sugerido: 60000, desc: "Devolución en sector no pactado" },
  { id: "mascotas", label: "Mascotas sin canil", sugerido: 25000, desc: "Pelos o suciedad en tapicería" },
  { id: "limpieza_estandar", label: "Suciedad excesiva", sugerido: 15000, desc: "Barro, arena o basura acumulada" },
  { id: "limpieza_profunda", label: "Limpieza profunda", sugerido: 35000, desc: "Manchas en tapiz o líquidos" },
  { id: "otro", label: "Otra falta", sugerido: 0, desc: "Infracción declarada con justificación" },
];

export function ReportFineModal({
  visible,
  reserva,
  onClose,
  onApplied,
}) {
  let insets = { bottom: 0, top: 0, left: 0, right: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch (e) {
    // Si corre fuera de SafeAreaProvider en tests
  }
  const [tipo, setTipo] = useState("fumar");
  const [monto, setMonto] = useState("50000");
  const [motivo, setMotivo] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const formValido = Boolean(
    monto && parseInt(monto, 10) > 0 && motivo.trim().length >= 4
  );

  if (!reserva) return null;

  const handleSelectTipo = (item) => {
    setTipo(item.id);
    if (item.sugerido > 0) {
      setMonto(item.sugerido.toString());
    }
  };

  const handleAplicar = async () => {
    if (loading) return;
    const montoNum = parseInt(monto, 10);
    if (isNaN(montoNum) || montoNum <= 0) {
      showAlert("Monto inválido", "Ingresa un monto válido para el cargo en pesos chilenos.");
      return;
    }
    if (!motivo.trim() || motivo.trim().length < 4) {
      showAlert("Motivo requerido", "Por favor ingresa una explicación detallada de la falta.");
      return;
    }

    setLoading(true);
    try {
      const res = await ApiClient.aplicarMultaReserva(reserva.id, {
        tipo,
        monto_clp: montoNum,
        motivo: motivo.trim(),
        fotos: fotoUrl.trim() ? [fotoUrl.trim()] : [],
      });
      showAlert(
        "Multa aplicada",
        `Se registró el cargo de $${montoNum.toLocaleString("es-CL")} CLP correctamente y se notificó al arrendatario.`,
        [{ text: "OK", onPress: () => { onClose(); onApplied && onApplied(res); } }]
      );
    } catch (err) {
      showAlert("No se pudo aplicar la multa", msjError(err, "Inténtalo de nuevo."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 bg-slate-900/65 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="bg-surface rounded-t-3xl max-h-[90%]" style={{ paddingBottom: Math.max(insets?.bottom || 0, 16) + 8 }}>
          <View className="w-10 h-1 rounded-full bg-borderDark self-center mt-2.5 mb-0.5" />
          <View className="flex-row items-center gap-3 px-4 pt-4 pb-3 border-b border-border">
            <View className="w-11 h-11 rounded-full bg-amber-50 items-center justify-center">
              <Icon name="alert" size={24} color={colors.warning} />
            </View>
            <View className="flex-1">
              <Text className="text-[17px] font-bold text-textDark">Reportar falta o penalización</Text>
              <Text className="text-xs text-textMuted mt-0.5">Se descontará del hold de garantía y liquidará a tu favor</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} className="p-1">
              <Icon name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 12 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-[13px] font-bold text-textMuted uppercase tracking-wider">Tipo de falta</Text>
            <View className="flex-row flex-wrap gap-2">
              {TIPOS_FALTAS.map((item) => {
                const selected = tipo === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    className={`py-2 px-3 rounded-full border items-center ${
                      selected ? "border-accent bg-accent-100" : "border-border bg-background"
                    }`}
                    onPress={() => handleSelectTipo(item)}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-[13px] font-semibold ${selected ? "text-accent-800" : "text-textDark"}`}>
                      {item.label}
                    </Text>
                    {item.sugerido > 0 && (
                      <Text className={`text-[11px] mt-0.5 ${selected ? "text-accent-800 font-bold" : "text-textMuted"}`}>
                        ${item.sugerido.toLocaleString("es-CL")}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="gap-1.5">
              <Text className="text-[13px] font-semibold text-textDark">Monto de la multa (CLP)</Text>
              <TextInput
                className="bg-background rounded-xl border border-border px-3.5 py-2.5 text-sm text-textDark"
                value={monto}
                onChangeText={setMonto}
                keyboardType="numeric"
                placeholder="ej. 50000"
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-[13px] font-semibold text-textDark">Explicación / Justificación</Text>
              <TextInput
                className="bg-background rounded-xl border border-border px-3.5 py-2.5 text-sm text-textDark min-h-[64px]"
                value={motivo}
                onChangeText={setMotivo}
                multiline
                numberOfLines={3}
                placeholder="Describe la falta observada en la entrega/devolución..."
                placeholderTextColor={colors.textPlaceholder}
              />
            </View>

            <AdjuntarFoto
              etiqueta="Foto de evidencia"
              ayuda="Sirve como prueba si el arrendatario disputa el cargo."
              url={fotoUrl}
              onUrl={setFotoUrl}
              bucket="evidencias"
            />

            <Button
              label="Aplicar cargo y notificar"
              onPress={handleAplicar}
              loading={loading}
              disabled={!formValido || loading}
              variant="primary"
              className={`mt-2 ${!formValido || loading ? "opacity-60" : "opacity-100"}`}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
