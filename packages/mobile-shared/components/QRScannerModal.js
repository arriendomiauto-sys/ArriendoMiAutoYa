import React, { useRef, useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  Animated,
  Easing,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";
import { hapticoExito } from "../utils/haptics";

/**
 * Modal escáner de QR moderno y de alta fidelidad.
 * Proporciona:
 * - Solicitud proactiva de permisos de cámara con pantalla de rescate estilizada.
 * - Enfoque tipo recorte 4 lados con marco iluminado y esquinas estilizadas.
 * - Láser de escaneo animado suave con haz difuso y línea de precisión.
 * - Toggle de linterna rápida para condiciones de baja luz.
 * - Botón destacado para alternar a ingreso manual de código alfanumérico.
 */
export function QRScannerModal({
  visible,
  titulo = "Escanear código QR",
  hint = "Enfoca el código QR que el usuario muestra en su pantalla.",
  onClose,
  onLeido,
}) {
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const leidoRef = useRef(false);

  // Animación del haz láser de escaneo
  const scanAnim = useRef(new Animated.Value(0)).current;
  const WINDOW_SIZE = Math.min(Math.round(SCREEN_W * 0.72), 270);

  useEffect(() => {
    if (visible) {
      leidoRef.current = false;
      setTorch(false);

      // Iniciar barrido del láser
      scanAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();

      // Solicitar permiso de cámara proactivamente si aún no se ha otorgado
      if (permission && !permission.granted && permission.canAskAgain !== false) {
        requestPermission();
      }

      return () => loop.stop();
    }
  }, [visible, permission?.granted]);

  const manejarLectura = (evento) => {
    const data = (evento?.data || "").trim();
    if (leidoRef.current || !data) return;
    leidoRef.current = true;
    hapticoExito();
    onLeido?.(data);
  };

  const cerrar = () => {
    leidoRef.current = false;
    setTorch(false);
    onClose?.();
  };

  const laserTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, WINDOW_SIZE - 16],
  });

  const renderContenido = () => {
    if (!visible) return null;

    if (!permission) {
      return (
        <View className="flex-1 items-center justify-center px-8 bg-[#0A0F1D]">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-[#94A3B8] text-[15px] font-medium mt-3.5">Iniciando cámara...</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View className="flex-1 items-center justify-center px-8 bg-[#0A0F1D]">
          <View className="w-20 h-20 rounded-full bg-blue-600/15 border border-blue-600/30 items-center justify-center mb-4">
            <Icon name="camera" size={40} color={colors.primary} />
          </View>
          <Text className="text-white text-xl font-bold text-center mb-2">Permiso de cámara necesario</Text>
          <Text className="text-[#94A3B8] text-sm text-center leading-[21px] max-w-[300px] mb-6">
            Para validar la entrega de forma instantánea, necesitamos acceso a la cámara de tu
            dispositivo para escanear el código QR.
          </Text>
          <TouchableOpacity
            className="bg-primary-700 px-7 py-3.5 rounded-xl w-full max-w-[280px] items-center shadow-lg shadow-primary-700/30"
            onPress={requestPermission}
            activeOpacity={0.85}
          >
            <Text className="text-white font-bold text-[15px]">Habilitar cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={cerrar}
            className="flex-row items-center mt-4.5 py-2"
            activeOpacity={0.7}
          >
            <Icon name="edit" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
            <Text className="text-[#94A3B8] text-sm font-medium underline">Escribir código de 8 caracteres a mano</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="flex-1">
        <CameraView
          key={visible ? "qr-camera-live" : "qr-camera-closed"}
          className="absolute inset-0"
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={manejarLectura}
        />

        {/* Máscara de oscurecimiento 4 lados */}
        <View className="absolute inset-0" pointerEvents="box-none">
          {/* Parte superior */}
          <View className="bg-[rgba(10,15,29,0.76)] flex-1" />

          {/* Fila central con visor */}
          <View style={{ flexDirection: "row", height: WINDOW_SIZE }}>
            <View className="bg-[rgba(10,15,29,0.76)] flex-1" />

            {/* Recuadro de Enfoque */}
            <View
              className="rounded-3xl overflow-hidden relative border border-white/15 bg-transparent"
              style={{ width: WINDOW_SIZE, height: WINDOW_SIZE }}
            >
              {/* 4 esquinas de alta visibilidad */}
              <View className="absolute w-8 h-8 border-primary-700 top-[-1px] left-[-1px] border-t-[4.5px] border-l-[4.5px] rounded-tl-[22px]" />
              <View className="absolute w-8 h-8 border-primary-700 top-[-1px] right-[-1px] border-t-[4.5px] border-r-[4.5px] rounded-tr-[22px]" />
              <View className="absolute w-8 h-8 border-primary-700 bottom-[-1px] left-[-1px] border-b-[4.5px] border-l-[4.5px] rounded-bl-[22px]" />
              <View className="absolute w-8 h-8 border-primary-700 bottom-[-1px] right-[-1px] border-b-[4.5px] border-r-[4.5px] rounded-br-[22px]" />

              {/* Punto y cruz central sutil */}
              <View className="absolute top-1/2 left-1/2 w-5 h-5 -ml-2.5 -mt-2.5 items-center justify-center opacity-30">
                <View className="absolute w-4 h-[1.5px] bg-white" />
                <View className="absolute h-4 w-[1.5px] bg-white" />
              </View>

              {/* Láser de escaneo animado */}
              <Animated.View
                className="absolute left-2 right-2 h-[18px] justify-center"
                style={{
                  transform: [{ translateY: laserTranslateY }],
                }}
              >
                <View className="h-[2.5px] bg-primary-700 rounded-sm shadow-lg shadow-primary-700" />
                <View className="absolute left-0 right-0 h-3.5 bg-primary-700 opacity-20 rounded-full" />
              </Animated.View>
            </View>

            <View className="bg-[rgba(10,15,29,0.76)] flex-1" />
          </View>

          {/* Parte inferior */}
          <View className="bg-[rgba(10,15,29,0.76)]" style={{ flex: 1.35 }} />
        </View>

        {/* Barra superior flotante */}
        <View className="absolute left-4 right-4 flex-row items-center justify-between" style={{ top: insets.top + 8 }}>
          <TouchableOpacity
            onPress={cerrar}
            className="w-11 h-11 rounded-full bg-slate-900/70 border border-white/15 items-center justify-center"
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar escáner"
          >
            <Icon name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View className="flex-1 items-center px-3">
            <Text className="text-white text-base font-bold tracking-tight" numberOfLines={1}>
              {titulo}
            </Text>
            <View className="flex-row items-center bg-slate-900/60 px-2.5 py-[3px] rounded-xl mt-1 border border-white/10">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
              <Text className="text-[#94A3B8] text-[11px] font-semibold">Escáner activo</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setTorch((prev) => !prev)}
            className={`w-11 h-11 rounded-full border items-center justify-center ${
              torch
                ? "bg-amber-500/25 border-amber-500 shadow-md shadow-amber-500/60"
                : "bg-slate-900/70 border-white/15"
            }`}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={torch ? "Apagar linterna" : "Encender linterna"}
          >
            <Icon
              name="zap"
              size={20}
              color={torch ? "#FBBF24" : "#FFFFFF"}
              fill={torch ? "#FBBF24" : "none"}
            />
          </TouchableOpacity>
        </View>

        {/* Barra inferior flotante */}
        <View
          className="absolute left-5 right-5 items-center gap-3"
          style={{ bottom: Math.max(insets.bottom, 16) + 16 }}
        >
          <View className="flex-row items-center bg-slate-900/80 px-4 py-2.5 rounded-full border border-white/15 max-w-[92%]">
            <Icon name="sparkles" size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text className="text-slate-100 text-[13px] font-medium text-center shrink">{hint}</Text>
          </View>

          <TouchableOpacity
            className="flex-row items-center justify-center px-5 py-3 rounded-xl bg-white/15 border border-white/30 w-full max-w-[290px]"
            onPress={cerrar}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Ingresar código manual"
          >
            <Icon name="edit" size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text className="text-white text-sm font-semibold tracking-wide">Ingresar código a mano</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={cerrar}
      statusBarTranslucent
      transparent={false}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View className="flex-1 bg-[#0A0F1D]" style={{ width: SCREEN_W, height: SCREEN_H }}>
        {renderContenido()}
      </View>
    </Modal>
  );
}
