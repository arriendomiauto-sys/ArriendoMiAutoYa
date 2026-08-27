import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors, useApp, Icon, ApiClient, showAlert } from "@rentacar/mobile-shared";

const INCIDENT_LABELS = {
  colision: "Colisión / Choque",
  panne: "Panne Mecánica",
  neumatico: "Pinchazo / Neumático",
  robo: "Robo / Daño a Terceros",
};

export function RoadsideClaimScreen({ onBack, onComplete }) {
  const { activeReservation } = useApp();
  const [incidentType, setIncidentType] = useState("colision"); // 'colision' | 'panne' | 'neumatico' | 'robo'
  const [description, setDescription] = useState("");
  const [thirdPartyPlate, setThirdPartyPlate] = useState("");
  const [thirdPartyDriver, setThirdPartyDriver] = useState("");
  const [thirdPartyInsurance, setThirdPartyInsurance] = useState("");
  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAddPhoto = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      showAlert("Permiso requerido", "Necesitamos acceso a tus fotos para adjuntar el daño.");
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (resultado.canceled || !resultado.assets?.length) return;

    setUploadingPhoto(true);
    try {
      const asset = resultado.assets[0];
      const filename = asset.fileName || `siniestro-${Date.now()}.jpg`;
      const subida = await ApiClient.subirArchivoStorage(asset.uri, filename, "evidencias");
      setPhotos((prev) => [...prev, subida.url]);
    } catch (err) {
      showAlert("No se pudo subir la foto", err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLlamarCarabineros = () => {
    Linking.openURL("tel:133");
  };

  const handleSubmitClaim = async () => {
    if (!description.trim()) {
      showAlert("Campo Requerido", "Por favor describe brevemente lo sucedido.");
      return;
    }

    setLoading(true);
    try {
      const detalle = [
        `Tipo: ${INCIDENT_LABELS[incidentType]}`,
        activeReservation?.id ? `Reserva: ${activeReservation.id}` : null,
        `Descripción: ${description.trim()}`,
        thirdPartyPlate ? `Patente tercero: ${thirdPartyPlate}` : null,
        thirdPartyDriver ? `Conductor tercero: ${thirdPartyDriver}` : null,
        thirdPartyInsurance ? `Aseguradora tercero: ${thirdPartyInsurance}` : null,
        photos.length ? `Fotos adjuntas: ${photos.join(", ")}` : "Sin fotos adjuntas",
      ]
        .filter(Boolean)
        .join("\n");

      const ticket = await ApiClient.crearTicketSoporte(
        "Auxilio en ruta / Siniestro",
        detalle
      );
      setLoading(false);
      showAlert(
        "Reporte Ingresado",
        `Ticket #${ticket.id.slice(0, 8).toUpperCase()} creado. El equipo de soporte revisará tu caso y coordinará auxilio y/o la aseguradora.`,
        [{ text: "Entendido", onPress: onComplete || onBack }]
      );
    } catch (err) {
      setLoading(false);
      showAlert("No se pudo enviar el reporte", err.message);
    }
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
            onPress={async () => {
              try {
                await ApiClient.crearTicketSoporte(
                  "Solicitud de grúa urgente",
                  `Solicitud de grúa/auxilio mecánico.${
                    activeReservation?.id ? ` Reserva: ${activeReservation.id}.` : ""
                  } Tipo de incidente: ${INCIDENT_LABELS[incidentType]}.`
                );
                showAlert(
                  "Solicitud enviada",
                  "Se notificó al equipo de soporte para coordinar la grúa. Te contactarán a la brevedad."
                );
              } catch (err) {
                showAlert("No se pudo enviar la solicitud", err.message);
              }
            }}
          >
            <Icon name="shield" size={14} color={colors.textWhite} style={{ marginRight: 6 }} />
            <Text style={styles.emergencyBtnText}>Solicitar Grúa</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.emergencyBtnBlue} onPress={handleLlamarCarabineros}>
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
          <TouchableOpacity style={styles.addPhotoBox} onPress={handleAddPhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.addPhotoText}>+ Foto</Text>
            )}
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
