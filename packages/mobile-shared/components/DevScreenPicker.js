import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Icon } from "./Icon";

/**
 * Selector de pantallas en modo desarrollo (__DEV__).
 * Permite visualizar e interactuar directamente con cualquier pantalla
 * individual de la aplicación con un solo toque, sin tener que navegar
 * todo el flujo o iniciar sesión.
 */
export function DevScreenPicker({ screens = [], children }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [pantallaActivaId, setPantallaActivaId] = useState(null);

  // Solo se activa en entorno de desarrollo local
  if (!__DEV__) {
    return children;
  }

  const pantallaActual = screens.find((s) => s.id === pantallaActivaId);

  return (
    <View style={{ flex: 1 }}>
      {/* Si hay una pantalla seleccionada, la renderizamos directamente */}
      {pantallaActual ? (
        <View style={{ flex: 1 }}>
          {pantallaActual.render({
            onBack: () => setPantallaActivaId(null),
          })}

          {/* Barra flotante superior para volver al selector o a la app */}
          <SafeAreaView
            style={{
              position: "absolute",
              top: 4,
              left: 12,
              right: 12,
              zIndex: 99999,
              pointerEvents: "box-none",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "rgba(15, 23, 42, 0.92)",
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 24,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <View
                  style={{
                    backgroundColor: "#0D9488",
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "700" }}>DEV</Text>
                </View>
                <Text
                  style={{ color: "#FFF", fontSize: 13, fontWeight: "600" }}
                  numberOfLines={1}
                >
                  {pantallaActual.nombre}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setModalAbierto(true)}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.15)",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ color: "#5EEAD4", fontSize: 12, fontWeight: "600" }}>Cambiar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPantallaActivaId(null)}
                  style={{
                    backgroundColor: "#EF4444",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>Salir</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      ) : (
        <>
          {children}

          {/* Botón flotante para abrir el menú DEV */}
          <TouchableOpacity
            onPress={() => setModalAbierto(true)}
            activeOpacity={0.85}
            style={{
              position: "absolute",
              bottom: 84,
              right: 16,
              zIndex: 99998,
              backgroundColor: "#0F172A",
              borderWidth: 1.5,
              borderColor: "#14B8A6",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 6,
              elevation: 8,
            }}
          >
            <Icon name="search" size={14} color="#5EEAD4" />
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>
              Ver pantalla
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Modal selector de pantallas */}
      <Modal
        visible={modalAbierto}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalAbierto(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0F172A" }}>
          <StatusBar barStyle="light-content" />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: "#1E293B",
            }}
          >
            <View>
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                Selector de Pantallas DEV
              </Text>
              <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 2 }}>
                Toca cualquier pantalla para inspeccionarla de forma aislada
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setModalAbierto(false)}
              style={{
                backgroundColor: "#334155",
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "bold" }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            {screens.map((pantalla) => {
              const esActiva = pantallaActivaId === pantalla.id;
              return (
                <TouchableOpacity
                  key={pantalla.id}
                  onPress={() => {
                    setPantallaActivaId(pantalla.id);
                    setModalAbierto(false);
                  }}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: esActiva ? "#115E59" : "#1E293B",
                    borderWidth: 1,
                    borderColor: esActiva ? "#14B8A6" : "#334155",
                    padding: 14,
                    borderRadius: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {pantalla.categoria ? (
                        <Text
                          style={{
                            color: "#5EEAD4",
                            fontSize: 10,
                            fontWeight: "700",
                            textTransform: "uppercase",
                          }}
                        >
                          {pantalla.categoria} ·
                        </Text>
                      ) : null}
                      <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>
                        {pantalla.nombre}
                      </Text>
                    </View>
                    {pantalla.descripcion ? (
                      <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 3 }}>
                        {pantalla.descripcion}
                      </Text>
                    ) : null}
                  </View>

                  <View
                    style={{
                      backgroundColor: esActiva ? "#14B8A6" : "#334155",
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "bold" }}>→</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
