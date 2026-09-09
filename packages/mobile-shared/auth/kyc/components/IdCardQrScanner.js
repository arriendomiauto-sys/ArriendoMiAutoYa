import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { CameraView } from "expo-camera";
import { colors } from "../../../theme/colors";

// ============================================================================
// Lector de QR del reverso de la cédula chilena
// Extrae de forma rápida el número de serie / documento
// ============================================================================
export function IdCardQrScanner({ permission, onRequestPermission, onDetected, onSkip }) {
  // Manejo de permisos de cámara no otorgados
  if (!permission?.granted) {
    return (
      <View style={styles.permissionBox}>
        <Text style={styles.permissionText}>
          Necesitamos acceso a la cámara para escanear el QR del carnet.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={onRequestPermission}>
          <Text style={styles.permissionBtnText}>Permitir cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>Continuar sin escanear QR</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Cámara activa detectando código de barras / QR
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onDetected}
      />
      <View style={styles.overlay}>
        <View style={styles.scanBox} />
        <Text style={styles.scanLabel}>Apunta al código QR del reverso de tu carnet</Text>
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>Saltar este paso</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: "rgba(6,30,31,0.6)",
  },
  scanBox: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: colors.accent500,
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  scanLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 20,
    textAlign: "center",
  },
  skipBtn: {
    marginTop: 24,
    padding: 10,
  },
  skipText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  permissionBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: colors.primary900,
  },
  permissionText: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  permissionBtn: {
    backgroundColor: colors.accent500,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: colors.primary900,
    fontWeight: "700",
  },
});
