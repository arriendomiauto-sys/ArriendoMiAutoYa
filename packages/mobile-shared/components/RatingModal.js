import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";
import { msjError } from "../utils/msjError";

/**
 * Calificar a la contraparte de una reserva ya finalizada, desde el
 * historial — para cuando no se calificó en el momento (en la entrega, si
 * es el dueño, o porque el arrendatario no tiene ningún paso equivalente
 * hoy). Reutiliza el mismo POST /calificaciones que ya usa DeliveryScreen.
 */
export function RatingModal({
  visible,
  onClose,
  reservaId,
  autorRol, // "cliente" | "dueno"
  destinatarioId,
  destinatarioNombre,
  onSubmitted,
}) {
  let insets = { bottom: 0, top: 0, left: 0, right: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch (e) {
    // Si corre fuera de SafeAreaProvider en tests
  }
  const [puntaje, setPuntaje] = useState(5);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cerrar = () => {
    if (enviando) return;
    setPuntaje(5);
    setComentario("");
    onClose();
  };

  const enviar = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const calificacion = await ApiClient.crearCalificacion({
        reserva_id: reservaId,
        autor_rol: autorRol,
        destinatario_id: destinatarioId,
        puntaje,
        comentario: comentario.trim() || undefined,
      });
      onSubmitted && onSubmitted(calificacion);
      setPuntaje(5);
      setComentario("");
      onClose();
    } catch (err) {
      showAlert("No se pudo enviar la calificación", msjError(err, "Inténtalo de nuevo."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={cerrar}>
      <KeyboardAvoidingView
        className="flex-1 bg-slate-900/65 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="bg-surface rounded-t-3xl" style={{ paddingBottom: Math.max(insets?.bottom || 0, 16) + 8 }}>
          <View className="w-10 h-1 rounded-full bg-borderDark self-center mt-2.5 mb-0.5" />
          <View className="flex-row items-center gap-3 px-4 pt-4 pb-3 border-b border-border">
            <View className="w-11 h-11 rounded-full bg-accent-100 items-center justify-center">
              <Icon name="star" size={22} color={colors.accent700} fill={colors.accent700} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-textDark">Califica tu arriendo</Text>
              <Text className="text-[13px] text-textMuted mt-0.5">
                {destinatarioNombre ? `¿Cómo te fue con ${destinatarioNombre}?` : "¿Cómo te fue?"}
              </Text>
            </View>
            <TouchableOpacity onPress={cerrar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} className="p-1">
              <Icon name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View className="p-4 gap-4">
            <View className="flex-row justify-center gap-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setPuntaje(n)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${n} estrella${n === 1 ? "" : "s"}`}
                >
                  <Icon
                    name="star"
                    size={34}
                    color={n <= puntaje ? colors.accent700 : colors.border}
                    fill={n <= puntaje ? colors.accent700 : "none"}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              className="border border-border rounded-xl p-3 text-sm text-textDark min-h-[80px]"
              placeholder="Cuéntanos cómo te fue (opcional)"
              placeholderTextColor={colors.textMuted}
              value={comentario}
              onChangeText={setComentario}
              multiline
              numberOfLines={3}
              style={{ textAlignVertical: "top" }}
            />

            <Button label="Enviar calificación" onPress={enviar} loading={enviando} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
