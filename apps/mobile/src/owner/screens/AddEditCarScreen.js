import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  theme,
  Icon,
  Button,
  ScreenHeader,
  SectionLabel,
  ApiClient,
  showAlert,
} from "@rentacar/mobile-shared";

// Marcas con presencia real en Chile (para el autocompletado de "Marca").
const CAR_BRANDS = [
  "Audi", "BAIC", "BMW", "BYD", "Changan", "Chery", "Chevrolet", "Chrysler",
  "Citroën", "DFSK", "Dodge", "Fiat", "Ford", "Foton", "Great Wall", "Haval",
  "Honda", "Hyundai", "Isuzu", "JAC", "Jeep", "Jetour", "Kia", "Land Rover",
  "Lexus", "Mahindra", "Maxus", "Mazda", "Mercedes-Benz", "MG", "Mini",
  "Mitsubishi", "Nissan", "Opel", "Peugeot", "Porsche", "RAM", "Renault",
  "Skoda", "SsangYong", "Subaru", "Suzuki", "Toyota", "Volkswagen", "Volvo",
];

// Documentos legales del auto que el backend exige para publicar.
const DOCS = [
  {
    key: "doc_inscripcion_url",
    titulo: "Certificado de inscripción",
    ayuda: "El padrón del Registro Civil, a nombre del dueño de la cuenta.",
    icon: "document",
  },
  {
    key: "doc_permiso_circulacion_url",
    titulo: "Permiso de circulación",
    ayuda: "Vigente para el período en curso.",
    icon: "receipt",
  },
  {
    key: "doc_soap_url",
    titulo: "Seguro Obligatorio (SOAP)",
    ayuda: "Póliza al día que cubre el año en curso.",
    icon: "shield",
  },
  {
    key: "doc_revision_tecnica_url",
    titulo: "Revisión técnica",
    ayuda: "Certificado de planta vigente (y de gases si corresponde).",
    icon: "check",
  },
];

const STEPS = ["Vehículo", "Tarifa", "Fotos", "Documentos"];

// Input de marca con lista de sugerencias filtrada por lo que escribe el usuario.
function MarcaInput({ value, onChange, onFocus }) {
  const [open, setOpen] = useState(false);
  const q = (value || "").trim().toLowerCase();
  const matches = q.length === 0 ? CAR_BRANDS : CAR_BRANDS.filter((b) => b.toLowerCase().includes(q));
  const yaCoincide = matches.length === 1 && matches[0].toLowerCase() === q;
  const mostrarLista = open && matches.length > 0 && !yaCoincide;

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Marca</Text>
      <TextInput
        style={styles.input}
        placeholder="Escribe y elige de la lista"
        placeholderTextColor={colors.textSilver}
        value={value}
        onChangeText={(t) => {
          onChange(t);
          setOpen(true);
        }}
        onFocus={(e) => {
          setOpen(true);
          onFocus && onFocus(e);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoCapitalize="words"
        autoCorrect={false}
      />
      {mostrarLista && (
        <View style={styles.suggestBox}>
          <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled style={styles.suggestScroll}>
            {matches.slice(0, 8).map((b) => (
              <TouchableOpacity
                key={b}
                style={styles.suggestRow}
                onPress={() => {
                  onChange(b);
                  setOpen(false);
                }}
              >
                <Text style={styles.suggestText}>{b}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// Slot de carga de un documento (foto o archivo desde galería/cámara).
function DocSlot({ doc, uri, uploading, onPick, onClear }) {
  return (
    <View style={styles.docSlot}>
      <View style={[styles.docIcon, uri && styles.docIconDone]}>
        <Icon name={uri ? "check" : doc.icon} size={18} color={uri ? colors.primary900 : colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.docTitle}>{doc.titulo}</Text>
        <Text style={styles.docHelp}>{uri ? "Documento cargado" : doc.ayuda}</Text>
      </View>
      {uploading ? (
        <ActivityIndicator color={colors.accent} />
      ) : uri ? (
        <TouchableOpacity onPress={onClear} hitSlop={theme.control.hitSlop} style={styles.docAction}>
          <Icon name="trash" size={16} color={colors.textSilver} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={onPick} style={styles.docAddBtn} activeOpacity={0.85}>
          <Text style={styles.docAddText}>Subir</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function AddEditCarScreen({ onBack, onComplete }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(null); // key del doc en subida

  const scrollRef = useRef(null);
  const contentRef = useRef(null);

  const [form, setForm] = useState({
    marca: "",
    modelo: "",
    anio: "2023",
    patente: "",
    tarifa_dia: "35000",
    ubicacion_base: "Plaza de Armas, Los Ángeles",
    equipamiento: { ac: true, bluetooth: true, isofix: false, doble_traccion: false, camara_retroceso: true },
    fotos: [],
    docs: {},
  });

  const tarifaNum = parseInt(form.tarifa_dia, 10) || 35000;
  const gananciaNeta = Math.round(tarifaNum * 0.8);
  const docsCargados = DOCS.filter((d) => form.docs[d.key]).length;

  const handleFieldFocus = (e) => {
    const node = e && e.target;
    if (!node || !node.measureLayout || !contentRef.current || !scrollRef.current) return;
    setTimeout(() => {
      node.measureLayout(
        contentRef.current,
        (x, y) => {
          scrollRef.current && scrollRef.current.scrollTo({ y: Math.max(y - 90, 0), animated: true });
        },
        () => {}
      );
    }, 60);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!form.marca || !form.modelo || !form.patente) {
        showAlert("Faltan datos", "Ingresa la marca, el modelo y la patente.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      if (form.fotos.length < 2) {
        showAlert("Faltan fotos", "Sube al menos 2 fotos del vehículo para continuar.");
        return;
      }
      setStep(4);
    } else {
      handleSubmit();
    }
  };

  const pickImage = async (onUri) => {
    const opciones = [
      { text: "Tomar foto", onPress: () => runPicker("camera", onUri) },
      { text: "Elegir de galería", onPress: () => runPicker("library", onUri) },
      { text: "Cancelar", style: "cancel" },
    ];
    showAlert("Agregar archivo", "¿De dónde lo tomamos?", opciones);
  };

  const runPicker = async (source, onUri) => {
    try {
      let result;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          showAlert("Permiso requerido", "Activa la cámara para tomar la foto.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          showAlert("Permiso requerido", "Necesitamos acceso a tus fotos.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
      }
      if (result.canceled || !result.assets?.length) return;
      onUri(result.assets[0].uri);
    } catch (error) {
      showAlert("No se pudo abrir la cámara", error.message || "Inténtalo de nuevo.");
    }
  };

  const handleAddPhotos = () => {
    showAlert("Agregar fotos del auto", "¿De dónde quieres sacar las fotos?", [
      { text: "Tomar foto", onPress: () => pickPhotos("camera") },
      { text: "Elegir de galería", onPress: () => pickPhotos("library") },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const pickPhotos = async (source) => {
    try {
      let result;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          showAlert("Permiso requerido", "Activa la cámara para tomar fotos del vehículo.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          showAlert("Permiso requerido", "Necesitamos acceso a tus fotos.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          selectionLimit: 8,
          quality: 0.7,
        });
      }
      if (result.canceled || !result.assets?.length) return;

      setUploadingPhoto(true);
      const nuevas = [];
      for (const asset of result.assets) {
        const filename = `auto_${Date.now()}_${nuevas.length}.jpg`;
        const uploaded = await ApiClient.subirArchivoStorage(asset.uri, filename, "autos");
        if (uploaded?.url) nuevas.push(uploaded.url);
      }
      if (nuevas.length) setForm((prev) => ({ ...prev, fotos: [...prev.fotos, ...nuevas] }));
    } catch (error) {
      showAlert("Error al subir la foto", error.message || "Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePickDoc = (docKey) => {
    pickImage(async (uri) => {
      setUploadingDoc(docKey);
      try {
        const filename = `${docKey}_${Date.now()}.jpg`;
        const uploaded = await ApiClient.subirArchivoStorage(uri, filename, "documentos-autos");
        if (uploaded?.url) {
          setForm((prev) => ({ ...prev, docs: { ...prev.docs, [docKey]: uploaded.url } }));
        }
      } catch (error) {
        showAlert("No se pudo subir el documento", error.message || "Revisa tu conexión e inténtalo de nuevo.");
      } finally {
        setUploadingDoc(null);
      }
    });
  };

  const handleRemovePhoto = (index) => {
    setForm((prev) => ({ ...prev, fotos: prev.fotos.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async () => {
    const faltan = DOCS.filter((d) => !form.docs[d.key]);
    if (faltan.length) {
      showAlert(
        "Faltan documentos",
        `Sube ${faltan.map((d) => d.titulo.toLowerCase()).join(", ")} para publicar el auto.`
      );
      return;
    }
    setLoading(true);
    try {
      await ApiClient.crearAuto({
        marca: form.marca,
        modelo: form.modelo,
        anio: parseInt(form.anio, 10) || 2023,
        patente: form.patente.toUpperCase(),
        tarifa_dia: tarifaNum,
        ubicacion_base: form.ubicacion_base,
        fotos: form.fotos,
        equipamiento: form.equipamiento,
        ...form.docs,
      });
      showAlert(
        "Auto publicado",
        `Tu ${form.marca} ${form.modelo} (${form.patente.toUpperCase()}) ya está en el marketplace. Revisamos los documentos y te avisamos.`,
        [{ text: "Ver mi flota", onPress: onComplete }]
      );
    } catch (error) {
      showAlert("No se pudo publicar", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <ScreenHeader
        tone="dark"
        title="Publicar un auto"
        subtitle={`Paso ${step} de 4 · ${STEPS[step - 1]}`}
        onBack={() => (step > 1 ? setStep(step - 1) : onBack())}
      />

      <View style={styles.stepTrack}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.stepBar, step >= i + 1 && styles.stepBarActive]} />
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View ref={contentRef} collapsable={false}>
          {step === 1 && (
            <View style={styles.card}>
              <MarcaInput
                value={form.marca}
                onChange={(t) => setForm((prev) => ({ ...prev, marca: t }))}
                onFocus={handleFieldFocus}
              />
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Modelo</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ej. RAV4, Tucson, Swift"
                  placeholderTextColor={colors.textSilver}
                  value={form.modelo}
                  onChangeText={(t) => setForm((prev) => ({ ...prev, modelo: t }))}
                  onFocus={handleFieldFocus}
                />
              </View>
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Año</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2023"
                    placeholderTextColor={colors.textSilver}
                    value={form.anio}
                    onChangeText={(t) => setForm((prev) => ({ ...prev, anio: t }))}
                    onFocus={handleFieldFocus}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Patente</Text>
                  <TextInput
                    style={[styles.input, styles.patenteInput]}
                    placeholder="ABCD-12"
                    placeholderTextColor={colors.textSilver}
                    value={form.patente}
                    onChangeText={(t) => setForm((prev) => ({ ...prev, patente: t }))}
                    onFocus={handleFieldFocus}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Sector de entrega</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ej. Plaza de Armas, Los Ángeles"
                  placeholderTextColor={colors.textSilver}
                  value={form.ubicacion_base}
                  onChangeText={(t) => setForm((prev) => ({ ...prev, ubicacion_base: t }))}
                  onFocus={handleFieldFocus}
                />
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.card}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Tarifa por día (CLP)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="35000"
                  placeholderTextColor={colors.textSilver}
                  value={form.tarifa_dia}
                  onChangeText={(t) => setForm((prev) => ({ ...prev, tarifa_dia: t }))}
                  onFocus={handleFieldFocus}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.profitBox}>
                <Text style={styles.profitLabel}>Recibes por día (80%)</Text>
                <Text style={styles.profitAmount}>${gananciaNeta.toLocaleString("es-CL")}</Text>
                <Text style={styles.profitDesc}>
                  La plataforma retiene 20% por seguro, verificación y soporte 24/7.
                </Text>
              </View>

              <SectionLabel tone="dark" style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }}>
                Equipamiento
              </SectionLabel>
              {[
                { key: "ac", label: "Aire acondicionado / climatizador" },
                { key: "bluetooth", label: "Audio Bluetooth / Apple CarPlay" },
                { key: "camara_retroceso", label: "Cámara y sensores de retroceso" },
                { key: "doble_traccion", label: "Tracción 4x4 / AWD" },
                { key: "isofix", label: "Anclajes ISOFIX para silla de bebé" },
              ].map((item) => {
                const active = form.equipamiento[item.key];
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={styles.equipRow}
                    onPress={() =>
                      setForm((prev) => ({
                        ...prev,
                        equipamiento: { ...prev.equipamiento, [item.key]: !active },
                      }))
                    }
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, active && styles.checkboxActive]}>
                      {active && <Icon name="check" size={12} color={colors.primary900} />}
                    </View>
                    <Text style={styles.equipLabel}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {step === 3 && (
            <View style={styles.card}>
              <Text style={styles.cardHeading}>Fotos del vehículo</Text>
              <Text style={styles.cardHelp}>
                Al menos 2 fotos reales con buena luz: frente, lado e interior aceleran la aprobación.
              </Text>

              <View style={styles.photosGrid}>
                {form.fotos.map((f, i) => (
                  <View key={f + i} style={styles.photoBox}>
                    <Image source={{ uri: f }} style={styles.photoImg} />
                    <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => handleRemovePhoto(i)}>
                      <Icon name="close" size={12} color={colors.textWhite} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={handleAddPhotos}
                disabled={uploadingPhoto}
                activeOpacity={0.85}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <>
                    <Icon name="camera" size={18} color={colors.accent} />
                    <Text style={styles.uploadBtnText}>
                      {form.fotos.length ? "Agregar más fotos" : "Tomar o elegir fotos"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.count}>{form.fotos.length} de mínimo 2</Text>
            </View>
          )}

          {step === 4 && (
            <View style={styles.card}>
              <Text style={styles.cardHeading}>Documentos del vehículo</Text>
              <Text style={styles.cardHelp}>
                Los 4 son obligatorios para publicar. Un ejecutivo los revisa antes de dejar el auto activo.
              </Text>
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                {DOCS.map((doc) => (
                  <DocSlot
                    key={doc.key}
                    doc={doc}
                    uri={form.docs[doc.key]}
                    uploading={uploadingDoc === doc.key}
                    onPick={() => handlePickDoc(doc.key)}
                    onClear={() =>
                      setForm((prev) => {
                        const next = { ...prev.docs };
                        delete next[doc.key];
                        return { ...prev, docs: next };
                      })
                    }
                  />
                ))}
              </View>
              <Text style={styles.count}>{docsCargados} de 4 documentos</Text>
            </View>
          )}

          <Button
            tone="dark"
            label={step === 4 ? "Publicar auto" : "Continuar"}
            iconRight={step === 4 ? undefined : "arrow-right"}
            onPress={handleNext}
            loading={loading}
            disabled={uploadingPhoto || !!uploadingDoc}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.darkBg },
  content: { paddingHorizontal: theme.spacing.screen, paddingTop: theme.spacing.sm, gap: theme.spacing.lg },
  stepTrack: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: theme.spacing.screen,
    marginBottom: theme.spacing.md,
  },
  stepBar: { flex: 1, height: 4, borderRadius: 999, backgroundColor: colors.darkBorder },
  stepBarActive: { backgroundColor: colors.accent },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    gap: theme.spacing.md,
  },
  cardHeading: { fontSize: 17, fontWeight: "700", color: colors.textWhite },
  cardHelp: { fontSize: 13, color: colors.textSilver, lineHeight: 19, marginTop: -4 },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    color: colors.textSilver,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.darkCardSubtle,
    borderRadius: theme.radius.field,
    paddingHorizontal: 14,
    height: theme.control.height,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    fontSize: 15,
    color: colors.textWhite,
  },
  patenteInput: { letterSpacing: 3, fontWeight: "700" },
  row: { flexDirection: "row", gap: theme.spacing.md },
  suggestBox: {
    marginTop: 4,
    backgroundColor: colors.darkCard,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.darkBorderStrong,
    overflow: "hidden",
  },
  suggestScroll: { maxHeight: 220 },
  suggestRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  suggestText: { color: colors.textWhite, fontSize: 15, fontWeight: "500" },
  profitBox: {
    backgroundColor: colors.darkCardSubtle,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: "rgba(47, 191, 155, 0.3)",
    gap: 2,
  },
  profitLabel: { fontSize: 12, color: colors.textSilver, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  profitAmount: { fontSize: 26, fontWeight: "800", color: colors.accent, letterSpacing: -0.5 },
  profitDesc: { fontSize: 12, color: colors.darkTextMuted, lineHeight: 16, marginTop: 4 },
  equipRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingVertical: 7 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.darkBorderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  equipLabel: { fontSize: 14, color: colors.textWhite, flex: 1 },
  photosGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  photoBox: { width: "31%", aspectRatio: 1, borderRadius: theme.radius.sm, overflow: "hidden", position: "relative" },
  photoImg: { width: "100%", height: "100%" },
  photoRemoveBtn: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: colors.darkCardSubtle,
    paddingVertical: 14,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.darkBorderStrong,
    borderStyle: "dashed",
  },
  uploadBtnText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  count: { color: colors.darkTextMuted, fontSize: 12, textAlign: "center" },
  docSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: colors.darkCardSubtle,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    padding: theme.spacing.md,
  },
  docIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(47, 191, 155, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  docIconDone: { backgroundColor: colors.accent },
  docTitle: { fontSize: 14, fontWeight: "600", color: colors.textWhite },
  docHelp: { fontSize: 12, color: colors.darkTextMuted, marginTop: 2, lineHeight: 16 },
  docAction: { padding: 6 },
  docAddBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(47, 191, 155, 0.16)",
  },
  docAddText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
});
