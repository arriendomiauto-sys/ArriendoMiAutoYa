import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { ApiClient } from "../../api/client";
import { Icon } from "../../components/Icon";

export function AddEditCarScreen({ onBack, onComplete }) {
  const { addCar, currentUser } = useApp();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    marca: "",
    modelo: "",
    anio: "2023",
    patente: "",
    tarifa_dia: "35000",
    ubicacion_base: "Plaza de Armas, Los Ángeles",
    equipamiento: {
      ac: true,
      bluetooth: true,
      isofix: false,
      doble_traccion: false,
      camara_retroceso: true,
    },
    fotos: [
      "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
      "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800",
    ],
  });

  const tarifaNum = parseInt(form.tarifa_dia, 10) || 35000;
  const gananciaNeta = Math.round(tarifaNum * 0.8);

  const handleNext = () => {
    if (step === 1) {
      if (!form.marca || !form.modelo || !form.patente) {
        Alert.alert("Campos Requeridos", "Ingresa la marca, modelo y placa patente.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const nuevoAuto = {
        id: `auto-${Date.now()}`,
        dueno_id: currentUser?.id || "dueno-1",
        marca: form.marca,
        modelo: form.modelo,
        anio: parseInt(form.anio, 10) || 2023,
        patente: form.patente.toUpperCase(),
        tarifa_dia: tarifaNum,
        ubicacion_base: form.ubicacion_base,
        fotos: form.fotos,
        disponible: true,
      };

      try {
        await ApiClient.crearAuto(nuevoAuto);
      } catch {
        // Offline
      }

      addCar(nuevoAuto);

      Alert.alert(
        "Vehículo Publicado",
        `Tu ${form.marca} ${form.modelo} (${form.patente.toUpperCase()}) ya está disponible para recibir arriendos en Los Ángeles.`,
        [{ text: "Ver en mi Flota", onPress: onComplete }]
      );
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Botón Volver */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => (step > 1 ? setStep(step - 1) : onBack())}
      >
        <Text style={styles.backBtnText}>← Volver</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>PUBLICAR VEHÍCULO</Text>
        </View>
        <Text style={styles.title}>Nuevo Auto en Arriendo</Text>
        <Text style={styles.subtitle}>
          Paso {step} de 3 • Flota de Los Ángeles, Chile
        </Text>
      </View>

      {/* Stepper */}
      <View style={styles.stepTrack}>
        <View style={[styles.stepBar, step >= 1 && styles.stepBarActive]} />
        <View style={[styles.stepBar, step >= 2 && styles.stepBarActive]} />
        <View style={[styles.stepBar, step >= 3 && styles.stepBarActive]} />
      </View>

      {/* PASO 1: DATOS BÁSICOS */}
      {step === 1 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Identificación del Vehículo</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Marca</Text>
            <TextInput
              style={styles.input}
              placeholder="ej. Toyota, Hyundai, Suzuki"
              placeholderTextColor={colors.textMuted}
              value={form.marca}
              onChangeText={(t) => setForm({ ...form, marca: t })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Modelo</Text>
            <TextInput
              style={styles.input}
              placeholder="ej. RAV4 4x4, Tucson, Swift"
              placeholderTextColor={colors.textMuted}
              value={form.modelo}
              onChangeText={(t) => setForm({ ...form, modelo: t })}
            />
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
              <Text style={styles.inputLabel}>Año</Text>
              <TextInput
                style={styles.input}
                placeholder="2023"
                placeholderTextColor={colors.textMuted}
                value={form.anio}
                onChangeText={(t) => setForm({ ...form, anio: t })}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
              <Text style={styles.inputLabel}>Placa Patente</Text>
              <TextInput
                style={[styles.input, styles.patenteInput]}
                placeholder="ABCD-12"
                placeholderTextColor={colors.textMuted}
                value={form.patente}
                onChangeText={(t) => setForm({ ...form, patente: t })}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Sector de Entrega en Los Ángeles</Text>
            <TextInput
              style={styles.input}
              placeholder="ej. Plaza de Armas, Av. Alemania, Terminal"
              placeholderTextColor={colors.textMuted}
              value={form.ubicacion_base}
              onChangeText={(t) => setForm({ ...form, ubicacion_base: t })}
            />
          </View>
        </View>
      )}

      {/* PASO 2: TARIFAS & EQUIPAMIENTO */}
      {step === 2 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Tarifas y Equipamiento</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tarifa por Día (CLP)</Text>
            <TextInput
              style={styles.input}
              placeholder="35000"
              placeholderTextColor={colors.textMuted}
              value={form.tarifa_dia}
              onChangeText={(t) => setForm({ ...form, tarifa_dia: t })}
              keyboardType="number-pad"
            />
          </View>

          {/* Simulador de Ganancia 80% */}
          <View style={styles.profitSimulator}>
            <View style={styles.profitHeader}>
              <Text style={styles.profitTitle}>Tu Ganancia Neta Estimada (80%)</Text>
              <Text style={styles.profitAmount}>
                ${gananciaNeta.toLocaleString("es-CL")} CLP / día
              </Text>
            </View>
            <Text style={styles.profitDesc}>
              La plataforma retiene sólo el 20% para gestión de seguro 15 UF, verificación de identidad y soporte 24/7.
            </Text>
          </View>

          {/* Checklist de Equipamiento */}
          <Text style={[styles.inputLabel, { marginTop: 10 }]}>Equipamiento Incluido</Text>
          {[
            { key: "ac", label: "Aire Acondicionado / Climatizador" },
            { key: "bluetooth", label: "Audio Bluetooth / Apple CarPlay" },
            { key: "camara_retroceso", label: "Cámara y Sensores de Retroceso" },
            { key: "doble_traccion", label: "Tracción 4x4 / All-Wheel Drive" },
            { key: "isofix", label: "Anclajes ISOFIX para Silla de Bebé" },
          ].map((item) => {
            const active = form.equipamiento[item.key];
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.equipRow}
                onPress={() =>
                  setForm({
                    ...form,
                    equipamiento: {
                      ...form.equipamiento,
                      [item.key]: !active,
                    },
                  })
                }
              >
                <View style={[styles.checkbox, active && styles.checkboxActive]}>
                  {active && <Icon name="check" size={10} color={colors.dark} />}
                </View>
                <Text style={styles.equipLabel}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* PASO 3: FOTOGRAFÍAS */}
      {step === 3 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Fotografías del Vehículo</Text>
          <Text style={styles.sectionDesc}>
            Sube al menos 2 fotos con buena iluminación para acelerar la aprobación.
          </Text>

          <View style={styles.photosGrid}>
            {form.fotos.map((f, i) => (
              <View key={i} style={styles.photoBox}>
                <Image source={{ uri: f }} style={styles.photoImg} />
                <View style={styles.photoBadge}>
                  <Text style={styles.photoBadgeText}>Foto {i + 1}</Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.addPhotoBtn}
            onPress={() =>
              Alert.alert("Foto Agregada", "Se ha simulado la carga de una nueva fotografía.")
            }
          >
            <Text style={styles.addPhotoText}>+ Agregar otra fotografía</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Botón Siguiente / Publicar */}
      <TouchableOpacity
        style={[styles.nextBtn, loading && styles.btnDisabled]}
        onPress={handleNext}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={colors.dark} />
        ) : (
          <Text style={styles.nextBtnText}>
            {step === 3 ? "Publicar Auto Ahora →" : "Continuar →"}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBg,
  },
  content: {
    padding: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    marginBottom: 10,
    backgroundColor: colors.darkCard,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSilver,
  },
  header: {
    marginBottom: 14,
  },
  badgePill: {
    backgroundColor: colors.accentMuted,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  badgePillText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "900",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textWhite,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSilver,
    marginTop: 2,
  },
  stepTrack: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  stepBar: {
    flex: 1,
    height: 3,
    backgroundColor: colors.darkBorder,
    marginHorizontal: 2,
    borderRadius: 2,
  },
  stepBarActive: {
    backgroundColor: colors.accent,
  },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textWhite,
    marginBottom: 12,
  },
  sectionDesc: {
    fontSize: 11,
    color: colors.textSilver,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSilver,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.darkCardHover,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    fontSize: 13,
    color: colors.textWhite,
  },
  patenteInput: {
    letterSpacing: 2,
    fontWeight: "800",
  },
  rowInputs: {
    flexDirection: "row",
  },
  profitSimulator: {
    backgroundColor: colors.darkCardHover,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    marginBottom: 12,
  },
  profitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  profitTitle: {
    fontSize: 11,
    color: colors.textSilver,
    fontWeight: "600",
  },
  profitAmount: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.accent,
  },
  profitDesc: {
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 14,
  },
  equipRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkText: {
    color: colors.dark,
    fontSize: 10,
    fontWeight: "900",
  },
  equipLabel: {
    fontSize: 11,
    color: colors.textSilver,
  },
  photosGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  photoBox: {
    width: "48%",
    height: 100,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  photoImg: {
    width: "100%",
    height: "100%",
  },
  photoBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  photoBadgeText: {
    color: colors.textWhite,
    fontSize: 9,
    fontWeight: "700",
  },
  addPhotoBtn: {
    backgroundColor: colors.darkCardHover,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  addPhotoText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  nextBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  nextBtnText: {
    color: colors.dark,
    fontSize: 13,
    fontWeight: "800",
  },
});
