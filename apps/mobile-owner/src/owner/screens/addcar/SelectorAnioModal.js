import React from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from "react-native";
import { colors, theme, Icon } from "@rentacar/mobile-shared";

export function SelectorAnioModal({ visible, anioSeleccionado, onSelect, onClose }) {
  const anioActual = new Date().getFullYear();
  const anioMaximo = anioActual + 1; // ej. 2027
  const anioMinimo = 2000;

  // Generar lista decreciente de años: 2027, 2026, 2025 ... 2000
  const anios = React.useMemo(() => {
    const lista = [];
    for (let a = anioMaximo; a >= anioMinimo; a--) {
      lista.push(a);
    }
    return lista;
  }, [anioMaximo]);

  // Años frecuentes para selección rápida en chips
  const aniosFrecuentes = React.useMemo(() => {
    return [anioActual, anioActual - 1, anioActual - 2, anioActual - 3, anioActual - 4, anioActual - 5];
  }, [anioActual]);

  const seleccionadoNum = parseInt(anioSeleccionado, 10);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={estilos.overlay}>
          <TouchableWithoutFeedback>
            <View style={estilos.contenedor}>
              {/* Barra superior de arrastre / cabecera */}
              <View style={estilos.dragHandle} />

              <View style={estilos.cabecera}>
                <View>
                  <Text style={estilos.titulo}>Año de fabricación</Text>
                  <Text style={estilos.subtitulo}>
                    Aceptamos modelos desde el {anioMinimo} al {anioMaximo}
                  </Text>
                </View>
                <TouchableOpacity
                  style={estilos.btnCerrar}
                  onPress={onClose}
                  hitSlop={theme.control.hitSlop}
                  accessibilityLabel="Cerrar selector de año"
                >
                  <Icon name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Acceso rápido a años recientes */}
              <Text style={estilos.seccionLabel}>Más recientes</Text>
              <View style={estilos.chipsRapidos}>
                {aniosFrecuentes.map((a) => {
                  const esActivo = seleccionadoNum === a;
                  return (
                    <TouchableOpacity
                      key={a}
                      style={[estilos.chip, esActivo && estilos.chipActivo]}
                      onPress={() => {
                        onSelect(String(a));
                        onClose();
                      }}
                      accessibilityLabel={`Año ${a}`}
                      activeOpacity={0.8}
                    >
                      <Text style={[estilos.chipTexto, esActivo && estilos.chipTextoActivo]}>
                        {a}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Lista completa de años */}
              <Text style={estilos.seccionLabel}>Todos los años ({anioMaximo} - {anioMinimo})</Text>
              <ScrollView
                style={estilos.scroll}
                contentContainerStyle={estilos.scrollContent}
                showsVerticalScrollIndicator={true}
              >
                {anios.map((a) => {
                  const esActivo = seleccionadoNum === a;
                  return (
                    <TouchableOpacity
                      key={a}
                      style={[estilos.filaAnio, esActivo && estilos.filaAnioActiva]}
                      onPress={() => {
                        onSelect(String(a));
                        onClose();
                      }}
                      accessibilityLabel={`Año ${a}`}
                      activeOpacity={0.7}
                    >
                      <Text style={[estilos.textoAnio, esActivo && estilos.textoAnioActivo]}>
                        {a}
                      </Text>
                      {esActivo ? (
                        <View style={estilos.badgeSeleccion}>
                          <Icon name="check" size={14} color={colors.white} />
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 25, 20, 0.55)",
    justifyContent: "flex-end",
  },
  contenedor: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "75%",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    alignSelf: "center",
    marginBottom: 14,
  },
  cabecera: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  titulo: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitulo: {
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  btnCerrar: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
  },
  seccionLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 8,
    marginTop: 6,
  },
  chipsRapidos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipTexto: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  chipTextoActivo: {
    color: colors.white,
  },
  scroll: {
    maxHeight: 260,
  },
  scrollContent: {
    paddingBottom: 16,
    gap: 4,
  },
  filaAnio: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  filaAnioActiva: {
    backgroundColor: colors.primary100,
  },
  textoAnio: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  textoAnioActivo: {
    color: colors.primary,
    fontWeight: "800",
  },
  badgeSeleccion: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
