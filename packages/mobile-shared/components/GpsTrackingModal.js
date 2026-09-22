import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
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
      <View className="flex-1 bg-black/45 justify-end">
        <View
          className="bg-white rounded-t-[20px] px-5 pt-4 max-h-[90%] gap-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 12 }}
        >
          {/* Cabecera */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-lg font-extrabold text-gray-900">Ubicación en vivo</Text>
              <Text className="text-[13px] text-gray-500 mt-0.5">
                {nombreAuto || "Vehículo"} {patente ? `· ${patente}` : ""}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1.5 rounded-2xl bg-gray-100">
              <Icon name="x" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Banner de alerta de señal (30m / 1h) */}
          {alerta && (
            <View
              className={`flex-row items-center gap-2.5 p-2.5 rounded-lg border ${
                estadoSenal === "alerta_critica"
                  ? "bg-rose-50 border-rose-500"
                  : "bg-amber-50 border-amber-500"
              }`}
            >
              <Icon
                name={estadoSenal === "alerta_critica" ? "alert" : "clock"}
                size={18}
                color={estadoSenal === "alerta_critica" ? colors.dangerText : colors.warningText}
              />
              <Text
                className={`text-[13px] font-semibold flex-1 ${
                  estadoSenal === "alerta_critica" ? "text-rose-700" : "text-amber-700"
                }`}
              >
                {alerta}
              </Text>
            </View>
          )}

          {/* Estado de conexión badge */}
          <View className="flex-row items-center justify-between">
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
              <Text className="text-[11px] text-gray-500">Transmitido desde el celular del conductor</Text>
            )}
          </View>

          {/* Mapa */}
          <View className="h-[220px] rounded-xl overflow-hidden bg-gray-50 border border-gray-200">
            {cargando ? (
              <View className="flex-1 items-center justify-center p-4 gap-2">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="text-[13px] text-gray-500">Localizando vehículo...</Text>
              </View>
            ) : error ? (
              <View className="flex-1 items-center justify-center p-4 gap-2">
                <Icon name="alert" size={32} color={colors.warning} />
                <Text className="text-[13px] text-rose-600 text-center">{error}</Text>
                <Button label="Reintentar" size="sm" variant="secondary" onPress={cargarUbicacion} />
              </View>
            ) : lat && lng && MapView ? (
              <MapView
                className="w-full h-full"
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
              <View className="flex-1 items-center justify-center p-4 gap-2">
                <Icon name="pin" size={32} color={colors.primary} />
                <Text className="text-[13px] text-gray-500">
                  Coordenadas: {lat?.toFixed(4)}, {lng?.toFixed(4)}
                </Text>
              </View>
            )}
          </View>

          {/* Datos de telemetría */}
          {posicion && !cargando && (
            <Card padded className="bg-gray-50">
              <View className="flex-row justify-around">
                <View className="items-center">
                  <Text className="text-[11px] text-gray-500 uppercase tracking-wide">Último reporte</Text>
                  <Text className="text-[15px] font-bold text-gray-900 mt-0.5">{formatearHora(posicion.timestamp)}</Text>
                </View>
                <View className="items-center">
                  <Text className="text-[11px] text-gray-500 uppercase tracking-wide">Velocidad</Text>
                  <Text className="text-[15px] font-bold text-gray-900 mt-0.5">
                    {posicion.velocidad ? `${Math.round(posicion.velocidad * 3.6)} km/h` : "0 km/h"}
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-[11px] text-gray-500 uppercase tracking-wide">Precisión</Text>
                  <Text className="text-[15px] font-bold text-gray-900 mt-0.5">
                    {posicion.precision ? `±${Math.round(posicion.precision)} m` : "Alta"}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {/* Botones de acción */}
          <View className="flex-row gap-2.5 mt-1">
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
