import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";
import { Button, Card, Badge } from "./ui";
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

export function GpsTrackingModal({ visible, autoId, patente, nombreAuto, onClose }) {
  const insets = useSafeAreaInsets();
  const [cargando, setCargando] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const cargarUbicacion = useCallback(async () => {
    if (!autoId) return;
    setCargando(true);
    setError(null);
    try {
      const res = await ApiClient.getPosicionGpsAuto(autoId);
      setData(res);
    } catch (err) {
      setError(err?.mensaje || err?.message || "No se pudo obtener la ubicación en vivo.");
    } finally {
      setCargando(false);
    }
  }, [autoId]);

  useEffect(() => {
    if (visible && autoId) {
      cargarUbicacion();
    }
  }, [visible, autoId, cargarUbicacion]);

  if (!visible) return null;

  const posicion = data?.posicion;
  const lat = posicion?.latitud ? Number(posicion.latitud) : null;
  const lng = posicion?.longitud ? Number(posicion.longitud) : null;
  const estadoSenal = data?.estado_senal || "en_linea";
  const alerta = data?.alerta;
  const minutosSinSenal = data?.minutos_sin_senal ?? 0;

  const abrirEnGoogleMaps = () => {
    if (lat && lng) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    }
  };

  const formatearHora = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          {/* Cabecera */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Ubicación en vivo</Text>
              <Text style={styles.sub}>
                {nombreAuto || "Vehículo"} {patente ? `· ${patente}` : ""}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="x" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Banner de alerta de señal (30m / 1h) */}
          {alerta && (
            <View
              style={[
                styles.alertaBanner,
                estadoSenal === "alerta_critica" ? styles.alertaCritica : styles.alertaPreventiva,
              ]}
            >
              <Icon
                name={estadoSenal === "alerta_critica" ? "alert" : "clock"}
                size={18}
                color={estadoSenal === "alerta_critica" ? colors.dangerText : colors.warningText}
              />
              <Text
                style={[
                  styles.alertaTexto,
                  estadoSenal === "alerta_critica"
                    ? { color: colors.dangerText }
                    : { color: colors.warningText },
                ]}
              >
                {alerta}
              </Text>
            </View>
          )}

          {/* Estado de conexión badge */}
          <View style={styles.estadoRow}>
            <Badge
              variant={
                estadoSenal === "en_linea"
                  ? "success"
                  : estadoSenal === "alerta_sin_senal"
                  ? "warning"
                  : "danger"
              }
              label={
                estadoSenal === "en_linea"
                  ? "En línea"
                  : estadoSenal === "alerta_sin_senal"
                  ? `Sin señal (${minutosSinSenal} min)`
                  : `Alerta Crítica (${minutosSinSenal} min)`
              }
            />
            {posicion?.fuente === "celular_arrendatario" && (
              <Text style={styles.fuenteText}>Transmitido desde el celular del conductor</Text>
            )}
          </View>

          {/* Mapa */}
          <View style={styles.mapContainer}>
            {cargando ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.cargandoText}>Localizando vehículo...</Text>
              </View>
            ) : error ? (
              <View style={styles.centerContainer}>
                <Icon name="alert" size={32} color={colors.warning} />
                <Text style={styles.errorText}>{error}</Text>
                <Button label="Reintentar" size="sm" variant="secondary" onPress={cargarUbicacion} />
              </View>
            ) : lat && lng && MapView ? (
              <MapView
                style={styles.mapaVista}
                initialRegion={{
                  latitude: lat,
                  longitude: lng,
                  latitudeDelta: 0.015,
                  longitudeDelta: 0.015,
                }}
              >
                <Marker
                  coordinate={{ latitude: lat, longitude: lng }}
                  title={nombreAuto || "Vehículo"}
                  description={`Última vez: ${formatearHora(posicion?.timestamp)}`}
                />
              </MapView>
            ) : (
              <View style={styles.centerContainer}>
                <Icon name="pin" size={32} color={colors.primary} />
                <Text style={styles.cargandoText}>
                  Coordenadas: {lat?.toFixed(4)}, {lng?.toFixed(4)}
                </Text>
              </View>
            )}
          </View>

          {/* Datos de telemetría */}
          {posicion && !cargando && (
            <Card padded style={styles.datosCard}>
              <View style={styles.datosGrid}>
                <View style={styles.datoCol}>
                  <Text style={styles.datoLabel}>Último reporte</Text>
                  <Text style={styles.datoVal}>{formatearHora(posicion.timestamp)}</Text>
                </View>
                <View style={styles.datoCol}>
                  <Text style={styles.datoLabel}>Velocidad</Text>
                  <Text style={styles.datoVal}>
                    {posicion.velocidad ? `${Math.round(posicion.velocidad * 3.6)} km/h` : "0 km/h"}
                  </Text>
                </View>
                <View style={styles.datoCol}>
                  <Text style={styles.datoLabel}>Precisión</Text>
                  <Text style={styles.datoVal}>
                    {posicion.precision ? `±${Math.round(posicion.precision)} m` : "Alta"}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {/* Botones de acción */}
          <View style={styles.footerBtns}>
            {lat && lng && (
              <Button
                variant="secondary"
                label="Ver en Google Maps"
                iconLeft="pin"
                onPress={abrirEnGoogleMaps}
                style={{ flex: 1 }}
              />
            )}
            <Button
              variant="primary"
              label="Actualizar"
              iconLeft="refresh"
              loading={cargando}
              onPress={cargarUbicacion}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: "90%",
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  sub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: colors.background,
  },
  alertaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  alertaPreventiva: {
    backgroundColor: colors.warningLight || "#fffbeb",
    borderColor: colors.warning || "#f59e0b",
  },
  alertaCritica: {
    backgroundColor: colors.dangerLight || "#fef2f2",
    borderColor: colors.danger || "#ef4444",
  },
  alertaTexto: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  estadoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fuenteText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  mapContainer: {
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // width/height explícitos en vez de StyleSheet.absoluteFillObject: en
  // Android con New Architecture, un MapView (SurfaceView nativo) posicionado
  // solo con position:absolute a veces mide 0 y queda en blanco — el patrón
  // que sí funciona en este código es el selector de ubicación al publicar
  // auto (PasoVehiculo.js), con porcentaje explícito sobre un padre de alto fijo.
  mapaVista: { width: "100%", height: "100%" },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 8,
  },
  cargandoText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: 13,
    color: colors.dangerText,
    textAlign: "center",
  },
  datosCard: {
    backgroundColor: colors.background,
  },
  datosGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  datoCol: {
    alignItems: "center",
  },
  datoLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  datoVal: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  footerBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
});
