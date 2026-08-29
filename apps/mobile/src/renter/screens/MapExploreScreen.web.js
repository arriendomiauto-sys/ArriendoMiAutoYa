import React from "react";
import { View, Text, StyleSheet, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, Icon, Button } from "@rentacar/mobile-shared";

// react-native-maps es un módulo nativo y no existe en web. La versión web
// muestra una alternativa; el mapa real vive en MapExploreScreen.js (nativo).
export function MapExploreScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
        <View style={styles.icon}>
          <Icon name="pin" size={30} color={colors.primary} />
        </View>
        <Text style={styles.title}>El mapa está en la app</Text>
        <Text style={styles.text}>
          La vista de mapa usa mapas nativos y no está disponible en la versión web.
          Abre Arrienda Tu Auto en tu teléfono para explorar los autos en el mapa.
        </Text>
        <Button
          label="Volver al listado"
          onPress={onBack}
          fullWidth={false}
          style={{ marginTop: theme.spacing.md }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", paddingHorizontal: theme.spacing.xxl, gap: theme.spacing.md },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center" },
  text: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
});
