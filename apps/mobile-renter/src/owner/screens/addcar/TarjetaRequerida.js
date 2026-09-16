import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, Icon, Button, ScreenHeader } from "@rentacar/mobile-shared";

/**
 * Sin tarjeta validada el backend rechaza la publicación. Descubrirlo después
 * de 4 pasos, 9 fotos y 5 documentos sería la peor forma de enterarse: se
 * avisa antes de entrar y se dice qué hacer.
 */
export function TarjetaRequerida({ estado, onBack }) {
  const insets = useSafeAreaInsets();
  const enRevision = estado === "requiere_revision_manual";
  const rechazada = estado === "rechazada";

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <ScreenHeader title="Publicar un auto" onBack={onBack} />
      <View style={styles.caja}>
        <View style={styles.icono}>
          <Icon name={enRevision ? "clock" : "card"} size={30} color={colors.primary} />
        </View>
        <Text style={styles.titulo}>
          {enRevision ? "Estamos revisando tu tarjeta" : "Primero registra tu tarjeta"}
        </Text>
        <Text style={styles.texto}>
          {enRevision
            ? "Apenas quede validada podrás publicar tu auto. Te avisamos por notificación."
            : rechazada
              ? "Tu tarjeta fue rechazada. Registra otra desde tu perfil y vuelve a intentarlo."
              : "Necesitamos una tarjeta de crédito validada antes de publicar. Es de donde se cobran el deducible, los cargos de la devolución y los peajes que llegan a nombre de la patente."}
        </Text>
        {!enRevision ? (
          <Text style={styles.pista}>La registras en tu perfil, en Métodos de pago.</Text>
        ) : null}
        <Button label="Entendido" onPress={onBack} style={{ marginTop: theme.spacing.lg }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  caja: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xxl,
  },
  icono: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary100,
    marginBottom: theme.spacing.sm,
  },
  titulo: { color: colors.text, fontSize: 19, fontWeight: "800", textAlign: "center" },
  texto: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  pista: { color: colors.primary, fontSize: 13, fontWeight: "700", textAlign: "center" },
});
