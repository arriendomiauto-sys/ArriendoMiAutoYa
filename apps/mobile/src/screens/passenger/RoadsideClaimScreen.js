import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { Icon } from "../../components/Icon";

export function RoadsideClaimScreen({ onBack, onComplete }) {
  const { activeReservation } = useApp();
  const [incidentType, setIncidentType] = useState("colision"); // 'colision' | 'panne' | 'neumatico' | 'robo'
  const [description, setDescription] = useState("");
  const [thirdPartyPlate, setThirdPartyPlate] = useState("");
  const [thirdPartyDriver, setThirdPartyDriver] = useState("");
  const [thirdPartyInsurance, setThirdPartyInsurance] = useState("");
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleAddPhoto = () => {
    setPhotos((prev) => [
      ...prev,
      "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
    ]);
  };

  const handleSubmitClaim = () => {
    if (!description.trim()) {
      Alert.alert("Campo Requerido", "Por favor describe brevemente lo sucedido.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        "Reporte de Siniestro Ingresado",
        "Folio de siniestro #CLM-2026-99 creado. El equipo de siniestros de Arrienda Tu Auto ha notificado a la aseguradora y despachado el móvil de asistencia.",
        [{ text: "Entendido", onPress: onComplete || onBack }]
      );
    }, 700);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Botón Volver */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Icon name="arrow-left" size={14} color={colors.textDark} style={{ marginRight: 4 }} />
        <Text style={styles.backBtnText}>Volver</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>AUXILIO SOS Y SINIESTROS</Text>
        </View>
        <Text style={styles.title}>Reporte de Siniestro en Ruta</Text>
        <Text style={styles.subtitle}>
          Activación inmediata de seguro 15 UF y auxilio mecánico en Los Ángeles
        </Text>
      </View>

      {/* Acciones de Emergencia Rápidas */}
      <View style={styles.emergencyCard}>
        <Text style={styles.emergencyTitle}>Canales de Emergencia Inmediata</Text>
        <View style={styles.emergencyButtonsRow}>
          <TouchableOpacity
            style={styles.emergencyBtnRed}
            onPress={() =>
              Alert.alert(
                "Despachar Grúa 24/7",
                "Móvil de auxilio y remolque despachado a tu ubicación en Los Ángeles."
              )
            }
          >
            <Icon name="shield" size={14} color={colors.textWhite} style={{ marginRight: 6 }} />
            <Text style={styles.emergencyBtnText}>Solicitar Grúa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.emergencyBtnBlue}
            onPress={() =>
              Alert.alert(
                "Llamando 133",
                "Conectando con Central de Comunicaciones de Carabineros de Chile..."
              )
            }
          >
            <Icon name="shield" size={14} color={colors.textWhite} style={{ marginRight: 6 }} />
            <Text style={styles.emergencyBtnText}>Carabineros (133)</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tipo de Incidente */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tipo de Incidente</Text>
        <View style={styles.typeRow}>
          {[
            { id: "colision", label: "Colisión / Choque" },
            { id: "panne", label: "Panne Mecánica" },
            { id: "neumatico", label: "Pinchazo / Neumático" },
            { id: "robo", label: "Robo / Daño a Terceros" },
          ].map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.typeBtn,
                incidentType === t.id && styles.typeBtnActive,
              ]}
              onPress={() => setIncidentType(t.id)}
            >
              <Text
                style={[
                  styles.typeBtnText,
                  incidentType === t.id && styles.typeBtnTextActive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Descripción */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Detalle de lo Ocurrido</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Indica lugar exacto, calle, intersección y cómo ocurrió el evento..."
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Tercero Involucrado si es Colisión */}
      {incidentType === "colision" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos del Tercero Involucrado (Opcional)</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Placa Patente del Otro Auto</Text>
            <TextInput
              style={styles.input}
              placeholder="ej. ABCD-12"
              placeholderTextColor={colors.textMuted}
              value={thirdPartyPlate}
              onChangeText={setThirdPartyPlate}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nombre del Conductor Tercero</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre y Apellidos"
              placeholderTextColor={colors.textMuted}
              value={thirdPartyDriver}
              onChangeText={setThirdPartyDriver}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Compañía Aseguradora Tercero</Text>
            <TextInput
              style={styles.input}
              placeholder="ej. BCI Seguros, Mapfre, HDI"
              placeholderTextColor={colors.textMuted}
              value={thirdPartyInsurance}
              onChangeText={setThirdPartyInsurance}
            />
          </View>
        </View>
      )}

      {/* Fotos del Siniestro */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Registro Fotográfico del Daño</Text>
        <Text style={styles.cardSub}>
          Fotografías de los daños en la carrocería y el entorno para la aseguradora.
        </Text>

        <View style={styles.photosGrid}>
          {photos.map((p, idx) => (
            <View key={idx} style={styles.photoBox}>
              <Image source={{ uri: p }} style={styles.photoImg} />
            </View>
          ))}
          <TouchableOpacity style={styles.addPhotoBox} onPress={handleAddPhoto}>
            <Text style={styles.addPhotoText}>+ Foto</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.btnDisabled]}
        onPress={handleSubmitClaim}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={colors.textWhite} />
        ) : (
          <Text style={styles.submitBtnText}>Enviar Reporte y Activar Seguro →</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textDark,
  },
  header: {
    marginBottom: 12,
  },
  badgePill: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  badgePillText: {
    color: colors.danger,
    fontSize: 9,
    fontWeight: "900",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textDark,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emergencyCard: {
    backgroundColor: "rgba(15, 23, 42, 0.04)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lightCardBorder,
    marginBottom: 12,
  },
  emergencyTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textDark,
    marginBottom: 8,
  },
  emergencyButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  emergencyBtnRed: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
    paddingVertical: 10,
    borderRadius: 6,
    marginRight: 4,
  },
  emergencyBtnBlue: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 6,
    marginLeft: 4,
  },
  emergencyBtnText: {
    color: colors.textWhite,
    fontSize: 11,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.lightCard,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.lightCardBorder,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textDark,
    marginBottom: 8,
  },
  cardSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  typeBtn: {
    width: "48%",
    backgroundColor: colors.lightSurface,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.lightCardBorder,
  },
  typeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  typeBtnTextActive: {
    color: colors.textWhite,
  },
  textArea: {
    backgroundColor: colors.lightSurface,
    borderRadius: 6,
    padding: 10,
    fontSize: 11,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.lightCardBorder,
    height: 70,
    textAlignVertical: "top",
  },
  inputGroup: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 3,
  },
  input: {
    backgroundColor: colors.lightSurface,
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 11,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.lightCardBorder,
  },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  photoBox: {
    width: 60,
    height: 60,
    borderRadius: 6,
    overflow: "hidden",
    marginRight: 8,
    marginBottom: 8,
  },
  photoImg: {
    width: "100%",
    height: "100%",
  },
  addPhotoBox: {
    width: 60,
    height: 60,
    borderRadius: 6,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lightSurface,
  },
  addPhotoText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: colors.textWhite,
    fontWeight: "800",
    fontSize: 12,
  },
});
