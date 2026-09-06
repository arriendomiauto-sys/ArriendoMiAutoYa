import React from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { colors, theme, Icon, FOTOS_AUTO, TOTAL_FOTOS_AUTO } from "@rentacar/mobile-shared";
import { TituloPaso, BarraProgreso } from "./comun";
import { EncuadreAuto } from "./encuadres";

export function PasoFotos({ wizard }) {
  const { fotosPorSlot, slotEnSubida, setCamaraSlot, quitarFoto, uploadingPhoto, progresoGaleria } = wizard;
  const listas = FOTOS_AUTO.filter((s) => fotosPorSlot[s.key]).length;
  const completas = listas === TOTAL_FOTOS_AUTO;

  return (
    <ScrollView contentContainerStyle={estilos.scroll} showsVerticalScrollIndicator={false}>
      <TituloPaso
        titulo="9 fotos, guiadas una por una"
        bajada="Copia el encuadre de cada ejemplo para que tu ficha se vea pareja."
      />

      <BarraProgreso hechos={listas} total={TOTAL_FOTOS_AUTO} etiqueta="listas" />

      {/* Instructivo */}
      <View style={estilos.instructivo}>
        <View style={estilos.instructivoRef}>
          <EncuadreAuto tipo="lateral" size={64} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={estilos.instructivoTitulo}>Antes de empezar</Text>
          <Text style={estilos.instructivoTexto}>
            Luz de día · auto limpio · a 3 metros · auto completo dentro del marco · sin personas ni
            otros autos detrás. En el frontal y la trasera tapamos la patente antes de publicar.
          </Text>
        </View>
      </View>

      {FOTOS_AUTO.map((slot, i) => {
        const url = fotosPorSlot[slot.key];
        const subiendo = slotEnSubida === slot.key;
        return (
          <View key={slot.key} style={estilos.shot}>
            {url ? (
              <View style={estilos.thumbWrap}>
                <Image source={{ uri: url }} style={estilos.thumb} />
                <View style={estilos.thumbCheck}>
                  <Icon name="check" size={10} color="#FFFFFF" />
                </View>
              </View>
            ) : (
              <View style={estilos.ref}>
                {subiendo ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <EncuadreAuto tipo={slot.key} size={44} color={colors.primary} />
                )}
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={estilos.nombre}>{`${i + 1} · ${slot.titulo}`}</Text>
              <Text style={estilos.hint} numberOfLines={2}>
                {slot.camara?.hint || slot.ayuda}
              </Text>
            </View>

            {url ? (
              <TouchableOpacity
                style={estilos.accionListo}
                onPress={() => quitarFoto(slot.key)}
                hitSlop={theme.control.hitSlop}
                accessibilityLabel={`Rehacer foto ${slot.titulo}`}
              >
                <Icon name="check" size={16} color={colors.accentDark} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={estilos.accion}
                onPress={() => setCamaraSlot(slot)}
                disabled={subiendo || uploadingPhoto}
                accessibilityLabel={`Tomar foto ${slot.titulo}`}
              >
                <Icon name="camera" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      <TouchableOpacity
        style={estilos.galeria}
        onPress={wizard.fotosDesdeGaleria}
        disabled={uploadingPhoto || completas}
        activeOpacity={0.85}
      >
        {uploadingPhoto ? (
          <>
            <ActivityIndicator color={colors.primary} />
            <Text style={estilos.galeriaTexto}>
              {progresoGaleria
                ? `Subiendo ${progresoGaleria.listas} de ${progresoGaleria.total}…`
                : "Subiendo…"}
            </Text>
          </>
        ) : (
          <>
            <Icon name="camera" size={16} color={colors.primary} />
            <Text style={estilos.galeriaTexto}>
              {completas ? "Fotos completas" : "Ya las tengo: elegir de la galería"}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  scroll: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    paddingBottom: 40,
    gap: theme.spacing.md,
  },
  instructivo: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.primary,
    borderRadius: theme.radius.card,
    padding: theme.spacing.md,
    ...theme.shadow.md,
  },
  instructivoRef: {
    width: 92,
    height: 72,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  instructivoTitulo: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  instructivoTexto: { fontSize: 12, color: "rgba(255,255,255,0.82)", lineHeight: 17, marginTop: 4 },
  shot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
  },
  ref: {
    width: 78,
    height: 58,
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.primary200,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbWrap: { width: 78, height: 58 },
  thumb: { width: 78, height: 58, borderRadius: 10, backgroundColor: colors.surfaceSecondary },
  thumbCheck: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  nombre: { fontSize: 14, fontWeight: "700", color: colors.text },
  hint: { fontSize: 11.5, color: colors.textMuted, lineHeight: 15, marginTop: 2 },
  accion: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  accionListo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent100,
    alignItems: "center",
    justifyContent: "center",
  },
  galeria: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.primary200,
    borderStyle: "dashed",
  },
  galeriaTexto: { fontSize: 13, fontWeight: "600", color: colors.primary },
});
