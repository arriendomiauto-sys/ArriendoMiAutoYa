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
  Chip,
  ScreenHeader,
  SectionLabel,
  ApiClient,
  DocumentCameraModal,
  FOTOS_AUTO,
  TOTAL_FOTOS_AUTO,
  subirImagenOptimizada,
  subirImagenesOptimizadas,
  showAlert,
} from "@rentacar/mobile-shared";

let MapView = null;
let Marker = null;
try {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
} catch (e) {
  MapView = null;
}

let Location = null;
try {
  Location = require("expo-location");
} catch (e) {
  Location = null;
}

const TRANSMISIONES = [
  { v: "automatica", label: "Automática" },
  { v: "mecanica", label: "Mecánica" },
];
const COMBUSTIBLES = [
  { v: "bencina", label: "Bencina" },
  { v: "diesel", label: "Diésel" },
  { v: "hibrido", label: "Híbrido" },
  { v: "electrico", label: "Eléctrico" },
];
const CATEGORIAS = [
  { v: "economico", label: "Económico" },
  { v: "sedan", label: "Sedán" },
  { v: "suv", label: "SUV" },
  { v: "camioneta", label: "Camioneta" },
  { v: "premium", label: "Premium" },
];

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
// Que tipo de documento espera el backend en cada campo — el motor de
// validacion responde por tipo (ver app/features/verificacion_vehiculos).
const TIPO_POR_CAMPO = {
  doc_inscripcion_url: "padron",
  doc_permiso_circulacion_url: "permiso_circulacion",
  doc_soap_url: "soap",
  doc_seguro_url: "seguro",
  doc_revision_tecnica_url: "revision_tecnica",
};

const DOCS = [
  {
    key: "doc_inscripcion_url",
    titulo: "Certificado de inscripción (Padrón)",
    ayuda: "Padrón del Registro Civil con folio y patente visible.",
    icon: "document",
  },
  {
    key: "doc_permiso_circulacion_url",
    titulo: "Permiso de circulación",
    ayuda: "Permiso municipal al día para el período en curso.",
    icon: "receipt",
  },
  {
    key: "doc_soap_url",
    titulo: "Seguro Obligatorio (SOAP)",
    ayuda: "Póliza vigente con cobertura del año en curso.",
    icon: "shield",
  },
  {
    key: "doc_revision_tecnica_url",
    titulo: "Revisión técnica o Certificado",
    ayuda: "Certificado de planta PRT o de homologación vigente.",
    icon: "check",
  },
  {
    key: "doc_seguro_url",
    titulo: "Seguro del auto (opcional)",
    ayuda: "Póliza comercial vigente, si tienes una además del SOAP.",
    icon: "shield",
    opcional: true,
  },
];

const DOCS_OBLIGATORIOS = DOCS.filter((d) => !d.opcional);

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

// Tarjeta de un documento legal del auto: muestra la miniatura de lo ya
// cargado y ofrece las dos formas de adjuntarlo a la vista con botones bien dimensionados.
// Colores del veredicto que devuelve el motor de documentos del backend.
const TONO_VALIDACION = {
  vigente: "ok",
  sin_vencimiento: "ok",
  por_vencer: "aviso",
  vencido: "error",
  patente_no_coincide: "error",
  tipo_incorrecto: "error",
};

function DocSlot({ doc, uri, uploading, validando, validacion, onCamera, onFile, onClear }) {
  const tono = validacion ? TONO_VALIDACION[validacion.estado] || "aviso" : null;
  const textoValidacion = (() => {
    if (validando) return "Leyendo el documento…";
    if (!validacion) return null;
    if (validacion.motivo) return validacion.motivo;
    if (validacion.vencimiento) {
      const [a, m, d] = validacion.vencimiento.split("-");
      return `Vigente hasta el ${d}-${m}-${a}`;
    }
    return "Documento verificado";
  })();

  return (
    <View style={[styles.docSlot, uri && styles.docSlotDone, tono === "error" && styles.docSlotError]}>
      <View style={styles.docHeadRow}>
        {uri ? (
          <Image source={{ uri }} style={styles.docThumb} />
        ) : (
          <View style={styles.docIcon}>
            <Icon name={doc.icon} size={18} color={colors.accent} />
          </View>
        )}

        <View style={{ flex: 1, paddingRight: 6 }}>
          <Text style={styles.docTitle}>{doc.titulo}</Text>
          <Text style={[styles.docHelp, uri && { color: colors.accent, fontWeight: "600" }]}>
            {uri ? "✓ Documento listo" : doc.ayuda}
          </Text>
        </View>

        {uploading ? (
          <ActivityIndicator color={colors.accent} size="small" />
        ) : uri ? (
          <TouchableOpacity onPress={onClear} hitSlop={theme.control.hitSlop} style={styles.docAction}>
            <Icon name="trash" size={18} color="#EF4444" />
          </TouchableOpacity>
        ) : null}
      </View>

      {textoValidacion ? (
        <View style={styles.docValidacion}>
          <Icon
            name={tono === "error" ? "alert" : tono === "ok" ? "check" : "history"}
            size={13}
            color={tono === "error" ? colors.danger : tono === "ok" ? colors.accent : colors.warningAccent}
          />
          <Text
            style={[
              styles.docValidacionTexto,
              tono === "error" && { color: colors.danger },
              tono === "ok" && { color: colors.accent },
            ]}
          >
            {textoValidacion}
          </Text>
        </View>
      ) : null}

      {!uri && !uploading ? (
        <View style={styles.docActions}>
          <TouchableOpacity style={styles.docBtn} onPress={onCamera} activeOpacity={0.85}>
            <Icon name="camera" size={16} color={colors.accent} />
            <Text style={styles.docBtnText}>Fotografiar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.docBtn} onPress={onFile} activeOpacity={0.85}>
            <Icon name="document" size={16} color={colors.accent} />
            <Text style={styles.docBtnText}>Desde galería</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

export function AddEditCarScreen({ onBack, onComplete }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  // Fotos del auto: una por casilla (ver FOTOS_AUTO). Se suben apenas se
  // toman, no todas juntas al final, así el paso no termina en una espera
  // larga con nueve archivos en cola.
  const [fotosPorSlot, setFotosPorSlot] = useState({}); // { [key]: url }
  const [slotEnSubida, setSlotEnSubida] = useState(null); // key de la foto subiendo
  const [camaraSlot, setCamaraSlot] = useState(null); // toma con la cámara abierta
  const [progresoGaleria, setProgresoGaleria] = useState(null); // { listas, total }
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(null); // key del doc en subida
  // Veredicto del motor de documentos por campo: { [key]: {estado, motivo,
  // vencimiento, bloquea} }. Se pide apenas se sube cada documento, para que
  // un permiso vencido se vea ahi mismo y no al intentar publicar.
  const [validacionDocs, setValidacionDocs] = useState({});
  const [validandoDoc, setValidandoDoc] = useState(null);
  const [locatingGps, setLocatingGps] = useState(false);

  const scrollRef = useRef(null);
  const contentRef = useRef(null);

  const [form, setForm] = useState({
    marca: "",
    modelo: "",
    anio: "2023",
    patente: "",
    tarifa_dia: "35000",
    ubicacion_base: "Plaza de Armas, Los Ángeles",
    latitud: -37.4697,
    longitud: -72.3536,
    transmision: "automatica",
    combustible: "bencina",
    categoria: "sedan",
    asientos: "5",
    puertas: "4",
    equipamiento: { ac: true, bluetooth: true, isofix: false, doble_traccion: false, camara_retroceso: true },
    fotos: [],
    docs: {},
  });

  const tarifaNum = parseInt(form.tarifa_dia, 10) || 35000;
  const gananciaNeta = Math.round(tarifaNum * 0.8);
  const docsCargados = DOCS_OBLIGATORIOS.filter((d) => form.docs[d.key]).length;
  const docsBloqueantes = DOCS.filter((d) => validacionDocs[d.key]?.bloquea);

  // El orden de FOTOS_AUTO es el que ve el arrendatario en la ficha: frontal
  // primero, después laterales, interior y detalle.
  const fotosOrdenadas = FOTOS_AUTO.map((s) => fotosPorSlot[s.key]).filter(Boolean);
  const fotosListas = fotosOrdenadas.length;

  const handleUseCurrentLocation = async () => {
    setLocatingGps(true);
    try {
      if (!Location) {
        showAlert("GPS no disponible", "El módulo de ubicación no está disponible en este dispositivo.");
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showAlert("Permiso requerido", "Activa el permiso de ubicación para obtener tus coordenadas actuales.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: 3 });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      let sectorLegible = `Punto GPS (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
      try {
        const [rev] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (rev) {
          const partes = [rev.street, rev.name, rev.district || rev.subregion || rev.city].filter(Boolean);
          if (partes.length) sectorLegible = partes.join(", ");
        }
      } catch {}

      setForm((prev) => ({
        ...prev,
        latitud: lat,
        longitud: lon,
        ubicacion_base: sectorLegible,
      }));
      showAlert(
        "Ubicación GPS capturada",
        `Se fijó el punto de entrega:\n${sectorLegible}\n\nRecuerda preferir siempre lugares públicos concurridos.`
      );
    } catch (err) {
      showAlert("No se pudo obtener la ubicación", err.message || "Toca el mapa para elegir el punto.");
    } finally {
      setLocatingGps(false);
    }
  };

  const handleMapPress = (e) => {
    const coord = e?.nativeEvent?.coordinate;
    if (coord?.latitude && coord?.longitude) {
      setForm((prev) => ({
        ...prev,
        latitud: coord.latitude,
        longitud: coord.longitude,
      }));
    }
  };

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
      const faltantes = FOTOS_AUTO.filter((slot) => !fotosPorSlot[slot.key]);
      if (faltantes.length) {
        showAlert(
          "Faltan fotos del auto",
          `Necesitamos las ${TOTAL_FOTOS_AUTO} fotos para publicar. Te falta: ${faltantes
            .map((slot) => slot.titulo.toLowerCase())
            .join(", ")}.`
        );
        return;
      }
      setStep(4);
    } else {
      handleSubmit();
    }
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
      showAlert("No se pudo abrir la cámara o galería", error.message || "Inténtalo de nuevo.");
    }
  };

  // Foto confirmada en la camara guiada: se optimiza y sube de inmediato, y
  // la casilla queda lista mientras el dueno saca la siguiente.
  const handleFotoCapturada = async (uri) => {
    const slot = camaraSlot;
    setCamaraSlot(null);
    if (!uri || !slot) return;

    setSlotEnSubida(slot.key);
    try {
      const url = await subirImagenOptimizada(uri, {
        filename: `auto_${slot.key}_${Date.now()}.jpg`,
        bucket: "autos",
      });
      if (url) setFotosPorSlot((prev) => ({ ...prev, [slot.key]: url }));
    } catch (error) {
      showAlert("No se pudo subir la foto", error.message || "Revisa tu conexion e intentalo de nuevo.");
    } finally {
      setSlotEnSubida(null);
    }
  };

  // Atajo para quien ya tiene las fotos hechas: llena las casillas vacias en
  // orden. Se suben en paralelo (de a 3) porque aca si son varias juntas.
  const handleFotosDesdeGaleria = async () => {
    const vacias = FOTOS_AUTO.filter((s) => !fotosPorSlot[s.key]);
    if (!vacias.length) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showAlert("Permiso requerido", "Necesitamos acceso a tus fotos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: vacias.length,
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;

      const seleccion = result.assets.slice(0, vacias.length);
      setUploadingPhoto(true);
      setProgresoGaleria({ listas: 0, total: seleccion.length });

      const urls = await subirImagenesOptimizadas(
        seleccion.map((asset, i) => ({
          uri: asset.uri,
          filename: `auto_${vacias[i].key}_${Date.now()}_${i}.jpg`,
        })),
        {
          bucket: "autos",
          onProgreso: (listas, total) => setProgresoGaleria({ listas, total }),
        }
      );

      setFotosPorSlot((prev) => {
        const next = { ...prev };
        urls.forEach((url, i) => {
          if (url) next[vacias[i].key] = url;
        });
        return next;
      });

      const fallidas = urls.filter((u) => !u).length;
      if (fallidas) {
        showAlert(
          "Algunas fotos no subieron",
          `${fallidas} de ${urls.length} quedaron pendientes. Repitelas desde su casilla.`
        );
      }
    } catch (error) {
      showAlert("Error al subir las fotos", error.message || "Revisa tu conexion e intentalo de nuevo.");
    } finally {
      setUploadingPhoto(false);
      setProgresoGaleria(null);
    }
  };

  const handleQuitarFoto = (key) => {
    setFotosPorSlot((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Manda el documento recien subido al motor de validacion del backend, que
  // responde que documento es, de que patente y hasta cuando vale. Es
  // best-effort: si falla, publicar vuelve a validarlo del lado del servidor.
  const validarDocumento = async (docKey, url) => {
    const patente = (form.patente || "").toUpperCase().trim();
    if (!patente || !url) return;

    setValidandoDoc(docKey);
    try {
      const res = await ApiClient.validarDocumentosAuto({ patente, [docKey]: url });
      const veredicto = (res?.documentos || []).find((d) => d.tipo === TIPO_POR_CAMPO[docKey]);
      if (veredicto) {
        setValidacionDocs((prev) => ({ ...prev, [docKey]: veredicto }));
      }
    } catch (error) {
      console.warn("[AddEditCar] No se pudo validar el documento:", error.message);
    } finally {
      setValidandoDoc((actual) => (actual === docKey ? null : actual));
    }
  };

  // `origen`: "camera" | "library". El documento se sube en el momento, con la
  // misma optimizacion que las fotos (un permiso de circulacion fotografiado
  // pesa lo mismo que una foto del auto).
  const subirDocumento = (docKey, origen) => {
    runPicker(origen, async (uri) => {
      setUploadingDoc(docKey);
      try {
        const url = await subirImagenOptimizada(uri, {
          filename: `${docKey}_${Date.now()}.jpg`,
          bucket: "documentos-autos",
          // Un documento se lee: conviene mas resolucion que en una foto del auto.
          maxAncho: 2000,
          calidad: 0.75,
        });
        if (url) {
          setForm((prev) => ({ ...prev, docs: { ...prev.docs, [docKey]: url } }));
          validarDocumento(docKey, url);
        }
      } catch (error) {
        showAlert("No se pudo subir el documento", error.message || "Revisa tu conexion e intentalo de nuevo.");
      } finally {
        setUploadingDoc(null);
      }
    });
  };

  const handleSubmit = async () => {
    // Lo que el motor de documentos ya rechazo no se manda: el backend
    // responderia 400 igual, pero el dueno merece saber cual y por que.
    if (docsBloqueantes.length) {
      showAlert(
        "Documentos que no sirven para publicar",
        docsBloqueantes.map((d) => validacionDocs[d.key].motivo).join("\n\n")
      );
      return;
    }

    const faltan = DOCS_OBLIGATORIOS.filter((d) => !form.docs[d.key]);
    if (faltan.length) {
      showAlert(
        "Faltan documentos",
        `Sube ${faltan.map((d) => d.titulo.toLowerCase()).join(", ")} para publicar el auto.`
      );
      return;
    }
    setLoading(true);
    try {
      const res = await ApiClient.crearAuto({
        marca: form.marca,
        modelo: form.modelo,
        anio: parseInt(form.anio, 10) || 2023,
        patente: form.patente.toUpperCase(),
        tarifa_dia: tarifaNum,
        ubicacion_base: form.ubicacion_base,
        latitud: form.latitud,
        longitud: form.longitud,
        transmision: form.transmision,
        combustible: form.combustible,
        categoria: form.categoria,
        asientos: parseInt(form.asientos, 10) || undefined,
        puertas: parseInt(form.puertas, 10) || undefined,
        fotos: fotosOrdenadas,
        equipamiento: form.equipamiento,
        ...form.docs,
      });

      if (res?.documentos_verificados) {
        showAlert(
          "¡Auto publicado y verificado!",
          `Tu ${form.marca} ${form.modelo} (${form.patente.toUpperCase()}) fue verificado automáticamente con éxito y ya está activo en el mapa del marketplace.`,
          [{ text: "Ver mi flota", onPress: onComplete }]
        );
      } else {
        showAlert(
          "Auto registrado — En revisión",
          `Tu ${form.marca} ${form.modelo} (${form.patente.toUpperCase()}) quedó registrado. Los documentos fueron enviados a revisión por nuestro equipo de soporte. Te avisaremos apenas quede habilitado.`,
          [{ text: "Ver mi flota", onPress: onComplete }]
        );
      }
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

              {/* Banner de Recomendación de Seguridad en Puntos Públicos */}
              <View style={styles.securityBanner}>
                <View style={styles.securityIconBox}>
                  <Icon name="shield" size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.securityTitle}>Punto de entrega seguro</Text>
                  <Text style={styles.securityDesc}>
                    Por seguridad de ambas partes, te sugerimos fijar el punto de
                    entrega en un lugar público y concurrido (cercanías de una
                    estación de Metro, servicentro Copec/Shell, centro comercial o comisaría).
                  </Text>
                </View>
              </View>

              {/* Selector de Ubicación */}
              <View style={styles.field}>
                <View style={styles.locationHeaderRow}>
                  <Text style={styles.fieldLabel}>Sector / Punto de entrega</Text>
                  <TouchableOpacity
                    style={styles.gpsBtn}
                    onPress={handleUseCurrentLocation}
                    disabled={locatingGps}
                    activeOpacity={0.8}
                  >
                    {locatingGps ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <>
                        <Icon name="pin" size={13} color={colors.accent} />
                        <Text style={styles.gpsBtnText}>Mi ubicación GPS</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="ej. Metro Tobalaba / Copec Plaza Principal"
                  placeholderTextColor={colors.textSilver}
                  value={form.ubicacion_base}
                  onChangeText={(t) => setForm((prev) => ({ ...prev, ubicacion_base: t }))}
                  onFocus={handleFieldFocus}
                />
              </View>

              {/* Mapa Interactivo de Posicionamiento */}
              {MapView ? (
                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.miniMap}
                    region={{
                      latitude: form.latitud || -37.4697,
                      longitude: form.longitud || -72.3536,
                      latitudeDelta: 0.02,
                      longitudeDelta: 0.02,
                    }}
                    onPress={handleMapPress}
                  >
                    {Marker && (
                      <Marker
                        coordinate={{
                          latitude: form.latitud || -37.4697,
                          longitude: form.longitud || -72.3536,
                        }}
                        draggable
                        onDragEnd={handleMapPress}
                        title={form.ubicacion_base || "Punto de entrega"}
                      />
                    )}
                  </MapView>
                  <View style={styles.mapHintBadge}>
                    <Icon name="pin" size={12} color="#FFFFFF" />
                    <Text style={styles.mapHintText}>Toca el mapa o arrastra el marcador para fijar el punto</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.noMapBox}>
                  <Icon name="pin" size={18} color={colors.accent} />
                  <Text style={styles.noMapText}>
                    Coordenadas fijadas: {Number(form.latitud || 0).toFixed(4)}, {Number(form.longitud || 0).toFixed(4)}
                  </Text>
                </View>
              )}
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
                Ficha técnica
              </SectionLabel>
              <Text style={styles.specGroupLabel}>Transmisión</Text>
              <View style={styles.chipsRow}>
                {TRANSMISIONES.map((o) => (
                  <Chip
                    key={o.v}
                    tone="dark"
                    label={o.label}
                    selected={form.transmision === o.v}
                    onPress={() => setForm((p) => ({ ...p, transmision: o.v }))}
                  />
                ))}
              </View>
              <Text style={styles.specGroupLabel}>Combustible</Text>
              <View style={styles.chipsRow}>
                {COMBUSTIBLES.map((o) => (
                  <Chip
                    key={o.v}
                    tone="dark"
                    label={o.label}
                    selected={form.combustible === o.v}
                    onPress={() => setForm((p) => ({ ...p, combustible: o.v }))}
                  />
                ))}
              </View>
              <Text style={styles.specGroupLabel}>Categoría</Text>
              <View style={styles.chipsRow}>
                {CATEGORIAS.map((o) => (
                  <Chip
                    key={o.v}
                    tone="dark"
                    label={o.label}
                    selected={form.categoria === o.v}
                    onPress={() => setForm((p) => ({ ...p, categoria: o.v }))}
                  />
                ))}
              </View>
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Asientos</Text>
                  <TextInput
                    style={styles.input}
                    value={form.asientos}
                    onChangeText={(t) => setForm((p) => ({ ...p, asientos: t }))}
                    onFocus={handleFieldFocus}
                    keyboardType="number-pad"
                    placeholder="5"
                    placeholderTextColor={colors.textSilver}
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Puertas</Text>
                  <TextInput
                    style={styles.input}
                    value={form.puertas}
                    onChangeText={(t) => setForm((p) => ({ ...p, puertas: t }))}
                    onFocus={handleFieldFocus}
                    keyboardType="number-pad"
                    placeholder="4"
                    placeholderTextColor={colors.textSilver}
                  />
                </View>
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
              <Text style={styles.cardHeading}>Fotos del vehiculo</Text>
              <Text style={styles.cardHelp}>
                Son {TOTAL_FOTOS_AUTO} tomas guiadas, una por casilla: cada una abre la camara con el
                encuadre que corresponde. En el frente y la parte trasera tapamos la patente antes de
                publicar.
              </Text>

              <View style={styles.fotosGrid}>
                {FOTOS_AUTO.map((slot, i) => {
                  const url = fotosPorSlot[slot.key];
                  const subiendo = slotEnSubida === slot.key;
                  return (
                    <TouchableOpacity
                      key={slot.key}
                      style={[styles.fotoSlot, url && styles.fotoSlotDone]}
                      onPress={() => setCamaraSlot(slot)}
                      disabled={subiendo || uploadingPhoto}
                      activeOpacity={0.85}
                    >
                      {url ? <Image source={{ uri: url }} style={styles.fotoSlotImg} /> : null}

                      {!url && !subiendo ? (
                        <View style={styles.fotoSlotVacio}>
                          <Icon name={slot.icon} size={20} color={colors.accent} />
                          <Text style={styles.fotoSlotAyuda} numberOfLines={2}>
                            {slot.ayuda}
                          </Text>
                        </View>
                      ) : null}

                      {subiendo ? (
                        <View style={styles.fotoSlotOverlay}>
                          <ActivityIndicator color={colors.accent} />
                        </View>
                      ) : null}

                      {url && !subiendo ? (
                        <TouchableOpacity
                          style={styles.fotoQuitar}
                          onPress={() => handleQuitarFoto(slot.key)}
                          hitSlop={theme.control.hitSlop}
                        >
                          <Icon name="close" size={11} color={colors.textWhite} />
                        </TouchableOpacity>
                      ) : null}

                      <View style={styles.fotoSlotFooter}>
                        <Text style={styles.fotoSlotNum}>{url ? "OK" : String(i + 1)}</Text>
                        <Text style={styles.fotoSlotTitulo} numberOfLines={1}>
                          {slot.titulo}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={handleFotosDesdeGaleria}
                disabled={uploadingPhoto || fotosListas === TOTAL_FOTOS_AUTO}
                activeOpacity={0.85}
              >
                {uploadingPhoto ? (
                  <>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.uploadBtnText}>
                      {progresoGaleria
                        ? `Subiendo ${progresoGaleria.listas} de ${progresoGaleria.total}...`
                        : "Subiendo..."}
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon name="camera" size={18} color={colors.accent} />
                    <Text style={styles.uploadBtnText}>
                      {fotosListas === TOTAL_FOTOS_AUTO
                        ? "Fotos completas"
                        : "Ya las tengo: elegir de la galeria"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.count}>
                {fotosListas} de {TOTAL_FOTOS_AUTO} fotos
              </Text>
            </View>
          )}

          {step === 4 && (
            <View style={styles.card}>
              <Text style={styles.cardHeading}>Documentos del vehiculo</Text>
              <Text style={styles.cardHelp}>
                Los {DOCS_OBLIGATORIOS.length} primeros son obligatorios. Al subir cada uno lo leemos
                para confirmar que es de este auto y que sigue vigente.
              </Text>
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                {DOCS.map((doc) => (
                  <DocSlot
                    key={doc.key}
                    doc={doc}
                    uri={form.docs[doc.key]}
                    uploading={uploadingDoc === doc.key}
                    onCamera={() => subirDocumento(doc.key, "camera")}
                    onFile={() => subirDocumento(doc.key, "library")}
                    validando={validandoDoc === doc.key}
                    validacion={validacionDocs[doc.key]}
                    onClear={() => {
                      setForm((prev) => {
                        const next = { ...prev.docs };
                        delete next[doc.key];
                        return { ...prev, docs: next };
                      });
                      setValidacionDocs((prev) => {
                        const next = { ...prev };
                        delete next[doc.key];
                        return next;
                      });
                    }}
                  />
                ))}
              </View>
              <Text style={styles.count}>
                {docsCargados} de {DOCS_OBLIGATORIOS.length} documentos obligatorios
              </Text>
            </View>
          )}

          <Button
            tone="dark"
            label={step === 4 ? "Publicar auto" : "Continuar"}
            iconRight={step === 4 ? undefined : "arrow-right"}
            onPress={handleNext}
            loading={loading}
            disabled={uploadingPhoto || !!uploadingDoc || !!slotEnSubida}
          />
        </View>
      </ScrollView>

      <DocumentCameraModal
        visible={!!camaraSlot}
        variant="vehiculo"
        config={camaraSlot?.camara}
        onClose={() => setCamaraSlot(null)}
        onCaptured={handleFotoCapturada}
      />
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
  specGroupLabel: { fontSize: 13, color: colors.textSilver, fontWeight: "600", marginTop: 4 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
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
  fotosGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  fotoSlot: {
    width: "31.5%",
    aspectRatio: 0.86,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
    position: "relative",
    backgroundColor: colors.darkCardSubtle,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  fotoSlotDone: { borderColor: colors.accent },
  fotoSlotImg: { width: "100%", height: "100%" },
  fotoSlotVacio: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6 },
  fotoSlotAyuda: { fontSize: 10, color: colors.darkTextMuted, textAlign: "center", lineHeight: 13 },
  fotoSlotOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6,30,31,0.6)",
  },
  fotoQuitar: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(6,30,31,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  fotoSlotFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 5,
    paddingVertical: 4,
    backgroundColor: "rgba(6,30,31,0.78)",
  },
  fotoSlotNum: { fontSize: 9, fontWeight: "800", color: colors.accent },
  fotoSlotTitulo: { flex: 1, fontSize: 10, fontWeight: "600", color: colors.textWhite },
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
    backgroundColor: colors.darkCardSubtle,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(47, 191, 155, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  docIconDone: { backgroundColor: colors.accent },
  docSlotDone: { borderColor: colors.accent, backgroundColor: "rgba(47, 191, 155, 0.06)" },
  docSlotError: { borderColor: colors.danger },
  docValidacion: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: theme.spacing.sm,
  },
  docValidacionTexto: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: colors.darkTextMuted,
  },
  docHeadRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, width: "100%" },
  docThumb: { width: 44, height: 44, borderRadius: theme.radius.sm, backgroundColor: colors.darkCardSubtle, borderWidth: 1, borderColor: colors.accent },
  docActions: { flexDirection: "row", gap: theme.spacing.sm, marginTop: 4, width: "100%" },
  docBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.darkBorderStrong,
    backgroundColor: colors.darkCard,
  },
  docBtnText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  docTitle: { fontSize: 14, fontWeight: "600", color: colors.textWhite },
  docHelp: { fontSize: 12, color: colors.darkTextMuted, marginTop: 2, lineHeight: 16 },
  docAction: { padding: 6 },
  securityBanner: {
    flexDirection: "row",
    gap: theme.spacing.md,
    backgroundColor: "rgba(47, 191, 155, 0.08)",
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: "rgba(47, 191, 155, 0.3)",
    padding: theme.spacing.md,
    marginTop: 4,
    marginBottom: 4,
  },
  securityIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(47, 191, 155, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  securityTitle: { fontSize: 13, fontWeight: "700", color: colors.accent, marginBottom: 2 },
  securityDesc: { fontSize: 12, color: colors.textSilver, lineHeight: 17 },
  locationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(47, 191, 155, 0.15)",
  },
  gpsBtnText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  mapContainer: {
    height: 180,
    borderRadius: theme.radius.field,
    overflow: "hidden",
    marginTop: 6,
    position: "relative",
    borderWidth: 1,
    borderColor: colors.darkBorderStrong,
  },
  miniMap: { width: "100%", height: "100%" },
  mapHintBadge: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(10, 15, 29, 0.82)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  mapHintText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
  noMapBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.darkCardSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    marginTop: 4,
  },
  noMapText: { color: colors.textSilver, fontSize: 13, fontWeight: "500" },
});
