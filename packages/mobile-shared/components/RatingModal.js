import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";

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
      showAlert("No se pudo enviar la calificación", err.message || "Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={cerrar}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Icon name="star" size={22} color={colors.accent700} fill={colors.accent700} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Califica tu arriendo</Text>
              <Text style={styles.subtitle}>
                {destinatarioNombre ? `¿Cómo te fue con ${destinatarioNombre}?` : "¿Cómo te fue?"}
              </Text>
            </View>
            <TouchableOpacity onPress={cerrar} hitSlop={theme.control.hitSlop} style={styles.closeBtn}>
              <Icon name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setPuntaje(n)}
                  hitSlop={theme.control.hitSlop}
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
              style={styles.input}
              placeholder="Cuéntanos cómo te fue (opcional)"
              placeholderTextColor={colors.textMuted}
              value={comentario}
              onChangeText={setComentario}
              multiline
              numberOfLines={3}
            />

            <Button label="Enviar calificación" onPress={enviar} loading={enviando} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 15, 29, 0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent100,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  closeBtn: { padding: 4 },
  body: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: theme.spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    padding: theme.spacing.md,
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: "top",
  },
});
