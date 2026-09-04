import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";
import { ApiClient } from "../api/client";

let MapView = null;
let Marker = null;
try {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
} catch (e) {
  MapView = null;
}

/**
 * Ubicación GPS en vivo de un auto, para el dueño (o admin).
 *
 * "En vivo" quiere decir "la última posición que el equipo reportó", no un
 * tracking continuo: cada apertura pide una lectura nueva al proveedor GPS.
 * Sin equipo instalado o sin consentimiento, el backend responde con el
 * motivo exacto (403/404) y acá se muestra tal cual — no hay nada que
 * inventar mientras no exista un proveedor real contratado.
 */
export function GPSMapModal({ visible, onClose, autoId, nombreAuto }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [posicion, setPosicion] = useState(null);

  const cargar = useCallback(async () => {
    if (!autoId) return;
    setCargando(true);
    setError(null);
    try {
      const datos = await ApiClient.getPosicionGPS(autoId);
      setPosicion(datos?.posicion || null);
    } catch (err) {
      setError(err.message || "No se pudo obtener la ubicación.");
    } finally {
      setCargando(false);
    }
  }, [autoId]);

  useEffect(() => {
    if (visible) cargar();
  }, [visible, cargar]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Ubicación GPS</Text>
              {nombreAuto ? <Text style={styles.sub}>{nombreAuto}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={theme.control.hitSlop} style={styles.close}>
              <Icon name="close" size={18} color={colors.textSilver} />
            </TouchableOpacity>
          </View>

          {cargando ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 40 }} />
          ) : error ? (
            <View style={styles.avisoBox}>
              <Icon name="alert" size={22} color={colors.warning} />
              <Text style={styles.avisoText}>{error}</Text>
              <TouchableOpacity style={styles.reintentar} onPress={cargar} activeOpacity={0.8}>
                <Text style={styles.reintentarText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : !posicion ? (
            <View style={styles.avisoBox}>
              <Icon name="pin" size={22} color={colors.textSilver} />
              <Text style={styles.avisoText}>Sin datos de posición todavía.</Text>
            </View>
          ) : (
            <>
              {MapView ? (
                <View style={styles.mapBox}>
                  <MapView
                    style={StyleSheet.absoluteFill}
                    region={{
                      latitude: posicion.latitud,
                      longitude: posicion.longitud,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                  >
                    {Marker && <Marker coordinate={{ latitude: posicion.latitud, longitude: posicion.longitud }} />}
                  </MapView>
                </View>
              ) : (
                <View style={styles.avisoBox}>
                  <Icon name="pin" size={22} color={colors.accent} />
                  <Text style={styles.avisoText}>
                    {posicion.latitud.toFixed(5)}, {posicion.longitud.toFixed(5)}
                  </Text>
                </View>
              )}

              <View style={styles.datos}>
                {posicion.velocidad_kmh != null ? (
                  <View style={styles.dato}>
                    <Text style={styles.datoLabel}>Velocidad</Text>
                    <Text style={styles.datoValor}>{Math.round(posicion.velocidad_kmh)} km/h</Text>
                  </View>
                ) : null}
                {posicion.timestamp ? (
                  <View style={styles.dato}>
                    <Text style={styles.datoLabel}>Actualizado</Text>
                    <Text style={styles.datoValor}>
                      {new Date(posicion.timestamp).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                ) : null}
              </View>

              <TouchableOpacity style={styles.refrescarBtn} onPress={cargar} activeOpacity={0.85}>
                <Icon name="settings" size={14} color={colors.accent} />
                <Text style={styles.refrescarText}>Actualizar posición</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(6,30,31,0.8)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.darkCard,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
    maxHeight: "85%",
  },
  handle: { width: 40, height: 4, borderRadius: 999, backgroundColor: colors.darkBorder, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
  title: { fontSize: 17, fontWeight: "700", color: colors.textWhite },
  sub: { fontSize: 12, color: colors.textSilver, marginTop: 2 },
  close: { padding: 4 },
  mapBox: { height: 220, borderRadius: theme.radius.field, overflow: "hidden", backgroundColor: colors.darkCardSubtle },
  avisoBox: { alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.xxl },
  avisoText: { fontSize: 13, color: colors.textSilver, textAlign: "center" },
  reintentar: { marginTop: 4, paddingVertical: 8, paddingHorizontal: 16, borderRadius: theme.radius.pill, backgroundColor: colors.darkCardSubtle },
  reintentarText: { fontSize: 13, fontWeight: "600", color: colors.accent },
  datos: { flexDirection: "row", gap: theme.spacing.lg },
  dato: { flex: 1, backgroundColor: colors.darkCardSubtle, borderRadius: theme.radius.field, padding: theme.spacing.md, gap: 2 },
  datoLabel: { fontSize: 11, color: colors.textSilver, textTransform: "uppercase", letterSpacing: 0.4 },
  datoValor: { fontSize: 15, fontWeight: "700", color: colors.textWhite },
  refrescarBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  refrescarText: { fontSize: 13, fontWeight: "600", color: colors.accent },
});
