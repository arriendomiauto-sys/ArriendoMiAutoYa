import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { CameraView } from "expo-camera";

// ============================================================================
// Lector de QR del reverso de la cédula chilena
// Extrae de forma rápida el número de serie / documento (usando NativeWind)
// ============================================================================
export function IdCardQrScanner({ permission, onRequestPermission, onDetected, onSkip }) {
  // Manejo de permisos de cámara no otorgados
  if (!permission?.granted) {
    return (
      <View className="flex-1 justify-center items-center p-6 bg-primary-900">
        <Text className="text-white text-base text-center mb-5">
          Necesitamos acceso a la cámara para escanear el QR del carnet.
        </Text>
        <TouchableOpacity
          className="bg-accent-500 px-6 py-3 rounded-xl active:opacity-80"
          onPress={onRequestPermission}
        >
          <Text className="text-primary-900 font-bold">Permitir cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity className="mt-6 p-2.5 active:opacity-70" onPress={onSkip}>
          <Text className="text-white/70 text-sm underline">Continuar sin escanear QR</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Cámara activa detectando código de barras / QR
  return (
    <View className="flex-1 bg-black">
      <CameraView
        className="absolute inset-0"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onDetected}
      />
      <View className="absolute inset-0 justify-center items-center px-8 bg-primary-900/60">
        <View className="w-[220px] h-[220px] border-2 border-accent-500 rounded-2xl bg-transparent" />
        <Text className="text-white text-[15px] font-bold mt-5 text-center">
          Apunta al código QR del reverso de tu carnet
        </Text>
        <TouchableOpacity className="mt-6 p-2.5 active:opacity-70" onPress={onSkip}>
          <Text className="text-white/70 text-sm underline">Saltar este paso</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
