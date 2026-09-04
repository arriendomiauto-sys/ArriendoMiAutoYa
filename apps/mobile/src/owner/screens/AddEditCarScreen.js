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
  useApp,
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
  CampoConSugerencias,
  TIPOS_VEHICULO,
  PASO_PRECIO_CLP,
  TARIFA_MINIMA_CLP,
  TARIFA_MAXIMA_CLP,
  redondearATramo5000,
  obtenerConfiguracionTipo,
  calcularDesgloseIva,
} from "@rentacar/mobile-shared";
import { validarPatenteChilena } from "@rentacar/shared-schemas";
import {
  buscarMarcas,
  buscarModelos,
  esMarcaConocida,
  normalizarMarca,
} from "@rentacar/mobile-shared/vehiculo/catalogo";

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

// Centro del mapa la primera vez, solo para que la cámara arranque en la zona
// donde opera la flota. No es un punto por defecto del auto: mientras el dueño
// no toque el mapa no hay pin y no se puede publicar.
const PUNTO_INICIAL = { latitude: -37.4697, longitude: -72.3536 };

// Si no hay ni mapa nativo ni GPS, no hay manera de marcar el punto exacto.
const PUEDE_FIJAR_PUNTO = !!MapView || !!Location;

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

/**
 * Mensaje de error bajo un campo.
 *
 * Reemplaza a las alertas modales de "Faltan datos", que interrumpían y no
 * decían cuál campo estaba mal. Lleva rol de alerta para que un lector de
 * pantalla lo anuncie en vez de dejarlo solo en el color rojo.
 */
function MensajeError({ texto }) {
  if (!texto) return null;
  return (
    <Text style={styles.mensajeError} accessibilityRole="alert">
      {texto}
    </Text>
  );
}

/**
 * Lo que el dueño va a necesitar, dicho antes de empezar.
 *
 * El flujo pide 8 fotos y 4 documentos legales, pero eso recién aparecía en
 * los pasos 3 y 4: el dueño llegaba hasta ahí y se encontraba con que tenía
 * que ir a buscar el padrón. Decirlo al principio evita el abandono a mitad
 * de camino.
 */
function QueNecesitas() {
  return (
    <View style={styles.necesitasCard}>
      <Text style={styles.necesitasTitulo}>Ten a mano antes de empezar</Text>
      {[
        { icon: "camera", texto: `${TOTAL_FOTOS_AUTO} fotos del auto, guiadas paso a paso` },
        { icon: "document", texto: "Padrón, permiso de circulación, SOAP y revisión técnica" },
        { icon: "clock", texto: "Unos 5 minutos. Puedes salir y retomar después" },
      ].map((item) => (
        <View key={item.icon} style={styles.necesitasFila}>
          <Icon name={item.icon} size={16} color={colors.accent} />
          <Text style={styles.necesitasTexto}>{item.texto}</Text>
        </View>
      ))}
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

/**
 * Bloqueo por falta de tarjeta.
 *
 * El backend rechaza la publicación sin tarjeta validada, pero descubrirlo al
 * final —después de cuatro pasos, ocho fotos y cuatro documentos— sería la
 * peor forma de enterarse. Se avisa antes de empezar y se dice qué hacer.
 */
function TarjetaRequerida({ estado, onBack }) {
  const enRevision = estado === "requiere_revision_manual";
  const rechazada = estado === "rechazada";

  return (
    <View style={styles.container}>
      <ScreenHeader tone="dark" title="Publicar un auto" onBack={onBack} />
      <View style={styles.bloqueoCaja}>
        <View style={styles.bloqueoIcono}>
          <Icon name={enRevision ? "clock" : "card"} size={30} color={colors.accent} />
        </View>
        <Text style={styles.bloqueoTitulo}>
          {enRevision ? "Estamos revisando tu tarjeta" : "Primero registra tu tarjeta"}
        </Text>
        <Text style={styles.bloqueoTexto}>
          {enRevision
            ? "Apenas quede validada podrás publicar tu auto. Te avisamos por notificación."
            : rechazada
              ? "Tu tarjeta fue rechazada. Registra otra desde tu perfil y vuelve a intentarlo."
              : "Necesitamos una tarjeta de crédito validada antes de publicar. Es de donde se cobran el deducible, los cargos de la devolución y los peajes que llegan a nombre de la patente."}
        </Text>
        {!enRevision ? (
          <Text style={styles.bloqueoPista}>
            La registras en tu perfil, en Métodos de pago.
          </Text>
        ) : null}
        <Button label="Entendido" onPress={onBack} tone="dark" style={{ marginTop: theme.spacing.lg }} />
      </View>
    </View>
  );
}

export function AddEditCarScreen({ onBack, onComplete }) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useApp();
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
  const mapaRef = useRef(null);
  // Una vez que el dueño escribe su propia referencia, el geocodificador deja
  // de pisarla.
  const referenciaEditadaAMano = useRef(false);

  const [form, setForm] = useState({
    marca: "",
    modelo: "",
    anio: "2023",
    patente: "",
    categoria: "sedan",
    tarifa_dia: "40000",
    // Sin punto por defecto: si todos los autos nacen en Plaza de Armas,
    // todos los pines caen encima del mismo lugar y el mapa deja de decir
    // dónde está cada auto. El dueño fija el punto con el GPS o tocando el
    // mapa, y sin eso no puede avanzar.
    ubicacion_base: "",
    latitud: null,
    longitud: null,
    transmision: "automatica",
    combustible: "bencina",
    asientos: "5",
    puertas: "4",
    equipamiento: { ac: true, bluetooth: true, isofix: false, doble_traccion: false, camara_retroceso: true },
    fotos: [],
    docs: {},
    gps_consentimiento: false,
  });

  // Los errores se calculan siempre, pero solo se muestran cuando el usuario
  // ya intentó avanzar de ese paso: no tiene sentido pintar de rojo un
  // formulario recién abierto.
  const [pasosIntentados, setPasosIntentados] = useState({});
  const anioActual = new Date().getFullYear();

  const errores = (() => {
    const e = {};
    if (!form.marca.trim()) e.marca = "Elige la marca de tu auto.";
    if (!form.modelo.trim()) e.modelo = "Escribe el modelo, como aparece en el padrón.";
    if (!form.categoria) e.categoria = "Selecciona el tipo de vehículo.";

    const anio = parseInt(form.anio, 10);
    if (!form.anio.trim()) e.anio = "Falta el año.";
    else if (Number.isNaN(anio) || anio < 2000) e.anio = "Aceptamos autos del año 2000 en adelante.";
    else if (anio > anioActual + 1) e.anio = `El año no puede ser mayor a ${anioActual + 1}.`;

    if (!form.patente.trim()) e.patente = "Falta la patente.";
    else if (!validarPatenteChilena(form.patente)) {
      e.patente = "Revisa el formato: 4 letras y 2 números (BBCL-10) o 2 letras y 4 números (AB-12-34).";
    }

    if (!form.ubicacion_base.trim()) {
      e.ubicacion_base = "Escribe una referencia del punto de entrega.";
    }
    // Solo se exige el punto si el dispositivo tiene con qué fijarlo. Sin
    // mapa nativo ni GPS no habría forma de cumplir el requisito y el dueño
    // quedaría encerrado en el paso 1: en ese caso el auto se publica sin
    // coordenadas y el mapa de búsqueda lo cuenta aparte, en vez de inventarle
    // una posición.
    if (PUEDE_FIJAR_PUNTO && (typeof form.latitud !== "number" || typeof form.longitud !== "number")) {
      e.punto = "Fija el punto en el mapa o usa tu ubicación GPS.";
    }

    const tarifa = parseInt(form.tarifa_dia, 10);
    if (!form.tarifa_dia || !form.tarifa_dia.trim()) {
      e.tarifa_dia = "Define cuánto quieres cobrar por día.";
    } else if (Number.isNaN(tarifa) || tarifa < TARIFA_MINIMA_CLP) {
      e.tarifa_dia = `La tarifa mínima es de $${TARIFA_MINIMA_CLP.toLocaleString("es-CL")} CLP al día.`;
    } else if (tarifa % PASO_PRECIO_CLP !== 0) {
      e.tarifa_dia = `La tarifa debe ser en tramos de $${PASO_PRECIO_CLP.toLocaleString("es-CL")} CLP (ej. $35.000, $40.000).`;
    }

    return e;
  })();

  const CAMPOS_POR_PASO = {
    1: ["marca", "modelo", "categoria", "anio", "patente", "ubicacion_base", "punto"],
    2: ["tarifa_dia"],
  };
  const errorDe = (campo) => {
    const paso = Object.keys(CAMPOS_POR_PASO).find((k) => CAMPOS_POR_PASO[k].includes(campo));
    return pasosIntentados[paso] ? errores[campo] : null;
  };

  const tienePunto = typeof form.latitud === "number" && typeof form.longitud === "number";

  const configTipo = obtenerConfiguracionTipo(form.categoria);
  const tarifaNum = redondearATramo5000(form.tarifa_dia || configTipo.tarifaDefault);
  const desgloseFinanciero = calcularDesgloseIva(tarifaNum);
  const gananciaNeta = desgloseFinanciero.gananciaDueno;
  const docsCargados = DOCS_OBLIGATORIOS.filter((d) => form.docs[d.key]).length;
  const docsBloqueantes = DOCS.filter((d) => validacionDocs[d.key]?.bloquea);

  // El orden de FOTOS_AUTO es el que ve el arrendatario en la ficha: frontal
  // primero, después laterales, interior y detalle.
  const fotosOrdenadas = FOTOS_AUTO.map((s) => fotosPorSlot[s.key]).filter(Boolean);
  const fotosListas = fotosOrdenadas.length;

  /**
   * Nombre legible de un punto, para que el dueño reconozca dónde quedó el pin.
   * Si el reverse geocoding falla devuelve las coordenadas: feo pero exacto, y
   * mejor que dejar la referencia vacía.
   */
  const describirPunto = async (lat, lon) => {
    const respaldo = `Punto GPS (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
    if (!Location) return respaldo;
    try {
      const [rev] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (!rev) return respaldo;
      const partes = [rev.street, rev.name, rev.district || rev.subregion || rev.city].filter(Boolean);
      return partes.length ? partes.join(", ") : respaldo;
    } catch {
      return respaldo;
    }
  };

  /** Mueve la cámara sin tocar el zoom que el usuario haya elegido. */
  const centrarMapa = (lat, lon) => {
    if (!mapaRef.current) return;
    mapaRef.current.animateCamera({ center: { latitude: lat, longitude: lon } }, { duration: 350 });
  };

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
      // Accuracy.High (4), no Balanced (3): Balanced resuelve con ~100 m de
      // error, suficiente para "en qué ciudad estás" pero no para un punto de
      // encuentro. 100 m son dos cuadras, y el arrendatario termina llamando
      // para preguntar dónde es.
      const precisionAlta = Location.Accuracy?.High ?? 4;
      const pos = await Location.getCurrentPositionAsync({ accuracy: precisionAlta });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      // A diferencia del toque en el mapa, acá sí se pisa lo escrito: tocar
      // "Mi ubicación GPS" es pedir explícitamente que se use esa dirección.
      const sectorLegible = await describirPunto(lat, lon);
      referenciaEditadaAMano.current = false;
      setForm((prev) => ({
        ...prev,
        latitud: lat,
        longitud: lon,
        ubicacion_base: sectorLegible,
      }));
      // Recentrar el mapa es la confirmación visible de que el punto quedó
      // fijado, y deja ver al tiro si cayó donde el dueño esperaba.
      centrarMapa(lat, lon);
    } catch (err) {
      showAlert("No se pudo obtener la ubicación", err.message || "Toca el mapa para elegir el punto.");
    } finally {
      setLocatingGps(false);
    }
  };

  const fijarPunto = async (lat, lon) => {
    setForm((prev) => ({ ...prev, latitud: lat, longitud: lon }));

    // La referencia escrita tiene que seguir al pin: si el texto dice "Plaza
    // de Armas" y el pin está en otro barrio, el arrendatario le cree al texto
    // y llega al lugar equivocado.
    //
    // Pero solo se rellena mientras el dueño no haya escrito la suya: "Copec
    // Av. Alemania" le dice más al arrendatario que el nombre de calle que
    // devuelve el geocodificador, y pisárselo cada vez que corre el pin unos
    // metros sería insufrible.
    if (referenciaEditadaAMano.current) return;
    const descripcion = await describirPunto(lat, lon);
    if (referenciaEditadaAMano.current) return;
    setForm((prev) => ({ ...prev, ubicacion_base: descripcion }));
  };

  const handleMapPress = (e) => {
    const coord = e?.nativeEvent?.coordinate;
    // Se compara contra undefined y no por valor verdadero: una coordenada 0
    // es legítima y `if (coord.latitude)` la descartaba.
    if (coord && coord.latitude !== undefined && coord.longitude !== undefined) {
      fijarPunto(coord.latitude, coord.longitude);
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

  // Sin tarjeta validada no tiene sentido dejar entrar al asistente: el
  // backend va a rechazar la publicación igual.
  if (currentUser && currentUser.tarjeta_estado !== "validada") {
    return <TarjetaRequerida estado={currentUser.tarjeta_estado} onBack={onBack} />;
  }

  const handleNext = () => {
    if (step === 1 || step === 2) {
      setPasosIntentados((prev) => ({ ...prev, [step]: true }));
      // Los errores quedan visibles bajo cada campo: la alerta anterior decía
      // "faltan datos" sin señalar cuál, y la patente mal escrita no se
      // detectaba hasta el final, con las fotos y los documentos ya subidos.
      if (CAMPOS_POR_PASO[step].some((campo) => errores[campo])) return;
      setStep(step + 1);
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

    // Instalar un GPS en el auto de otra persona requiere su consentimiento
    // por escrito: sin eso el backend tampoco acepta la publicación.
    if (!form.gps_consentimiento) {
      showAlert(
        "Falta autorizar el GPS",
        "Para publicar tu auto necesitamos tu autorización para instalar y monitorear el dispositivo GPS."
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
        gps_consentimiento: form.gps_consentimiento,
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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      // Android ya no redimensiona la ventana con el teclado (ver app.json,
      // softwareKeyboardLayoutMode) — esto es lo que ahora la esquiva.
      // Detalle completo en LoginScreen.js.
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
              <QueNecesitas />
              <CampoConSugerencias
                etiqueta="Marca"
                valor={form.marca}
                onChange={(t) =>
                  setForm((prev) => ({
                    ...prev,
                    marca: t,
                    // Cambiar de marca invalida el modelo: un Swift no existe
                    // en Toyota, y dejarlo escrito confunde más que ayudar.
                    modelo: normalizarMarca(t) === normalizarMarca(prev.marca) ? prev.modelo : "",
                  }))
                }
                onFocus={handleFieldFocus}
                buscar={buscarMarcas}
                placeholder="Escribe y elige de la lista"
                error={errorDe("marca")}
              />
              <MensajeError texto={errorDe("marca")} />

              <CampoConSugerencias
                etiqueta="Modelo"
                valor={form.modelo}
                onChange={(t) => setForm((prev) => ({ ...prev, modelo: t }))}
                onFocus={handleFieldFocus}
                buscar={(q) => buscarModelos(form.marca, q)}
                placeholder={
                  esMarcaConocida(form.marca) ? "Elige el modelo" : "ej. RAV4, Tucson, Swift"
                }
                ayuda={
                  esMarcaConocida(form.marca)
                    ? null
                    : "Elige primero la marca y te sugerimos sus modelos."
                }
                error={errorDe("modelo")}
              />
              <MensajeError texto={errorDe("modelo")} />

              {/* Selector Destacado de Tipo de Vehículo */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Tipo de vehículo / Categoría</Text>
                <View style={styles.tipoVehiculoGrid}>
                  {TIPOS_VEHICULO.map((tipo) => {
                    const seleccionado = form.categoria === tipo.id;
                    return (
                      <TouchableOpacity
                        key={tipo.id}
                        style={[styles.tipoCard, seleccionado && styles.tipoCardSelected]}
                        onPress={() => {
                          setForm((prev) => {
                            const configAnterior = obtenerConfiguracionTipo(prev.categoria);
                            const tarifaActual = parseInt(prev.tarifa_dia, 10);
                            const debiaActualizar =
                              !prev.tarifa_dia || tarifaActual === configAnterior.tarifaDefault;
                            return {
                              ...prev,
                              categoria: tipo.id,
                              tarifa_dia: debiaActualizar ? tipo.tarifaDefault.toString() : prev.tarifa_dia,
                            };
                          });
                        }}
                        activeOpacity={0.85}
                      >
                        <View style={styles.tipoCardTop}>
                          <View style={[styles.tipoIconBox, seleccionado && styles.tipoIconBoxSelected]}>
                            <Icon
                              name={tipo.icon}
                              size={15}
                              color={seleccionado ? colors.accent : colors.textSilver}
                            />
                          </View>
                          <Text style={[styles.tipoTitle, seleccionado && styles.tipoTitleSelected]}>
                            {tipo.label}
                          </Text>
                          {seleccionado && (
                            <View style={styles.tipoCheckBadge}>
                              <Icon name="check" size={10} color={colors.primary900} />
                            </View>
                          )}
                        </View>
                        <Text style={styles.tipoDesc}>{tipo.descripcion}</Text>
                        <View style={styles.tipoFooter}>
                          <Text style={styles.tipoRango}>
                            Sugerido: ${tipo.rangoMin.toLocaleString("es-CL")} - ${tipo.rangoMax.toLocaleString("es-CL")} / día
                          </Text>
                          <Text style={styles.tipoEjemplos}>Ej. {tipo.ejemplos}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <MensajeError texto={errorDe("categoria")} />
              </View>

              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Año</Text>
                  <TextInput
                    style={[styles.input, errorDe("anio") && styles.inputError]}
                    placeholder="2023"
                    placeholderTextColor={colors.textSilver}
                    value={form.anio}
                    onChangeText={(t) => setForm((prev) => ({ ...prev, anio: t }))}
                    onFocus={handleFieldFocus}
                    keyboardType="number-pad"
                  />
                  <MensajeError texto={errorDe("anio")} />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Patente</Text>
                  <TextInput
                    style={[styles.input, styles.patenteInput, errorDe("patente") && styles.inputError]}
                    placeholder="ABCD-12"
                    placeholderTextColor={colors.textSilver}
                    value={form.patente}
                    onChangeText={(t) => setForm((prev) => ({ ...prev, patente: t }))}
                    onFocus={handleFieldFocus}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={9}
                  />
                  <MensajeError texto={errorDe("patente")} />
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
                  style={[styles.input, errorDe("ubicacion_base") && styles.inputError]}
                  placeholder="ej. Copec Av. Alemania / Plaza de Armas"
                  placeholderTextColor={colors.textSilver}
                  value={form.ubicacion_base}
                  onChangeText={(t) => {
                    referenciaEditadaAMano.current = true;
                    setForm((prev) => ({ ...prev, ubicacion_base: t }));
                  }}
                  onFocus={handleFieldFocus}
                />
                <MensajeError texto={errorDe("ubicacion_base")} />
              </View>

              {/* Mapa Interactivo de Posicionamiento */}
              {MapView ? (
                <View style={styles.mapContainer}>
                  <MapView
                    ref={mapaRef}
                    style={styles.miniMap}
                    initialRegion={{
                      latitude: form.latitud ?? PUNTO_INICIAL.latitude,
                      longitude: form.longitud ?? PUNTO_INICIAL.longitude,
                      latitudeDelta: 0.02,
                      longitudeDelta: 0.02,
                    }}
                    onPress={handleMapPress}
                    showsUserLocation
                    showsMyLocationButton={false}
                  >
                    {Marker && tienePunto && (
                      <Marker
                        coordinate={{ latitude: form.latitud, longitude: form.longitud }}
                        draggable
                        onDragEnd={handleMapPress}
                        title={form.ubicacion_base || "Punto de entrega"}
                      />
                    )}
                  </MapView>
                  <View style={[styles.mapHintBadge, tienePunto && styles.mapHintBadgeOk]}>
                    <Icon name={tienePunto ? "check" : "pin"} size={12} color="#FFFFFF" />
                    <Text style={styles.mapHintText}>
                      {tienePunto
                        ? `Punto fijado en ${form.latitud.toFixed(5)}, ${form.longitud.toFixed(5)}`
                        : "Toca el mapa para fijar el punto de entrega"}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.noMapBox}>
                  <Icon name="pin" size={18} color={colors.accent} />
                  <Text style={styles.noMapText}>
                    {tienePunto
                      ? `Coordenadas fijadas: ${form.latitud.toFixed(5)}, ${form.longitud.toFixed(5)}`
                      : Location
                      ? 'Usa "Mi ubicación GPS" para fijar el punto de entrega.'
                      : "Sin mapa en este dispositivo. Tu auto se publica igual, pero no aparecerá en el mapa de búsqueda hasta que fijes el punto desde la app instalada."}
                  </Text>
                </View>
              )}
              <MensajeError texto={errorDe("punto")} />
            </View>
          )}

          {step === 2 && (
            <View style={styles.card}>
              {/* Resumen de Categoría y Rango Sugerido */}
              <View style={styles.tarifaHeaderBox}>
                <View style={styles.tarifaCatBadge}>
                  <Icon name={configTipo.icon} size={14} color={colors.accent} />
                  <Text style={styles.tarifaCatText}>{configTipo.label}</Text>
                </View>
                <Text style={styles.tarifaRangoInfo}>
                  Sugerido: ${configTipo.rangoMin.toLocaleString("es-CL")} a ${configTipo.rangoMax.toLocaleString("es-CL")} / día (IVA incl.)
                </Text>
              </View>

              {/* Control de Tarifa con Stepper en Tramos de $5.000 */}
              <View style={styles.tarifaCardPrincipal}>
                <Text style={styles.tarifaCardTitle}>Tarifa diaria del vehículo</Text>
                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      const actual = parseInt(form.tarifa_dia, 10) || configTipo.tarifaDefault;
                      const nuevo = Math.max(TARIFA_MINIMA_CLP, actual - PASO_PRECIO_CLP);
                      setForm((p) => ({ ...p, tarifa_dia: nuevo.toString() }));
                    }}
                    activeOpacity={0.8}
                    accessibilityLabel="Disminuir tarifa en cinco mil pesos"
                  >
                    <Icon name="minus" size={18} color={colors.accent} />
                    <Text style={styles.stepperBtnText}>-$5.000</Text>
                  </TouchableOpacity>

                  <View style={styles.stepperValueBox}>
                    <Text style={styles.stepperMonto}>${tarifaNum.toLocaleString("es-CL")}</Text>
                    <Text style={styles.stepperMontoSub}>CLP / día (IVA 19% incl.)</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      const actual = parseInt(form.tarifa_dia, 10) || configTipo.tarifaDefault;
                      const nuevo = Math.min(TARIFA_MAXIMA_CLP, actual + PASO_PRECIO_CLP);
                      setForm((p) => ({ ...p, tarifa_dia: nuevo.toString() }));
                    }}
                    activeOpacity={0.8}
                    accessibilityLabel="Aumentar tarifa en cinco mil pesos"
                  >
                    <Icon name="plus" size={18} color={colors.accent} />
                    <Text style={styles.stepperBtnText}>+$5.000</Text>
                  </TouchableOpacity>
                </View>

                {/* Píldoras de Precios Sugeridos para la Categoría */}
                <Text style={styles.pillsLabel}>Precios sugeridos en tramos de $5.000 ({configTipo.labelCorto}):</Text>
                <View style={styles.pillsRow}>
                  {configTipo.preciosSugeridos.map((precio) => {
                    const esActivo = parseInt(form.tarifa_dia, 10) === precio;
                    return (
                      <TouchableOpacity
                        key={precio}
                        style={[styles.precioPill, esActivo && styles.precioPillActive]}
                        onPress={() => setForm((p) => ({ ...p, tarifa_dia: precio.toString() }))}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.precioPillText, esActivo && styles.precioPillTextActive]}>
                          ${precio.toLocaleString("es-CL")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Ajuste manual directo con auto-redondeo a múltiplos de $5.000 */}
                <View style={styles.inputManualRow}>
                  <Text style={styles.inputManualLabel}>O escribe un monto directo:</Text>
                  <TextInput
                    style={[styles.inputManual, errorDe("tarifa_dia") && styles.inputError]}
                    placeholder="ej. 45000"
                    placeholderTextColor={colors.textSilver}
                    value={form.tarifa_dia}
                    onChangeText={(t) => setForm((prev) => ({ ...prev, tarifa_dia: t }))}
                    onBlur={() => {
                      if (form.tarifa_dia) {
                        const redondeado = redondearATramo5000(form.tarifa_dia);
                        setForm((prev) => ({ ...prev, tarifa_dia: redondeado.toString() }));
                      }
                    }}
                    onFocus={handleFieldFocus}
                    keyboardType="number-pad"
                  />
                </View>
                <MensajeError texto={errorDe("tarifa_dia")} />
              </View>

              {/* Desglose Financiero con IVA (19%) y Liquidación al Dueño (80%) */}
              <View style={styles.profitBox}>
                <View style={styles.profitHeadRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profitLabel}>Recibes por día (80%)</Text>
                    <Text style={styles.profitAmount}>${desgloseFinanciero.gananciaDueno.toLocaleString("es-CL")}</Text>
                  </View>
                  <View style={styles.ivaBadge}>
                    <Text style={styles.ivaBadgeText}>IVA 19% Incluido</Text>
                  </View>
                </View>

                <View style={styles.desgloseDivider} />

                <View style={styles.desgloseFila}>
                  <Text style={styles.desgloseTxt}>Tarifa diaria cobrada al cliente:</Text>
                  <Text style={styles.desgloseVal}>${desgloseFinanciero.tarifaBruta.toLocaleString("es-CL")}</Text>
                </View>
                <View style={styles.desgloseFila}>
                  <Text style={styles.desgloseTxtSub}>• Valor neto:</Text>
                  <Text style={styles.desgloseValSub}>${desgloseFinanciero.subtotalNeto.toLocaleString("es-CL")}</Text>
                </View>
                <View style={styles.desgloseFila}>
                  <Text style={styles.desgloseTxtSub}>• IVA (19%):</Text>
                  <Text style={styles.desgloseValSub}>${desgloseFinanciero.ivaMonto.toLocaleString("es-CL")}</Text>
                </View>
                <View style={styles.desgloseFila}>
                  <Text style={styles.desgloseTxtSub}>• Comisión plataforma (20%):</Text>
                  <Text style={styles.desgloseValSub}>-${desgloseFinanciero.comisionPlataforma.toLocaleString("es-CL")}</Text>
                </View>

                <Text style={styles.profitDesc}>
                  La plataforma retiene 20% por cobertura de seguro, verificación de identidad y soporte 24/7.
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

              <TouchableOpacity
                style={[styles.gpsConsent, form.gps_consentimiento && styles.gpsConsentOn]}
                onPress={() =>
                  setForm((prev) => ({ ...prev, gps_consentimiento: !prev.gps_consentimiento }))
                }
                activeOpacity={0.85}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: form.gps_consentimiento }}
              >
                <View style={[styles.gpsBox, form.gps_consentimiento && styles.gpsBoxOn]}>
                  {form.gps_consentimiento && <Icon name="check" size={13} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.gpsTitle}>Autorizo la instalación del GPS</Text>
                  <Text style={styles.gpsHelp}>
                    Equipo en comodato, sin costo inicial. Puedes ver la posición de tu auto desde la
                    app y pedir el retiro del equipo cuando salgas de la plataforma. El corte remoto de
                    motor es exclusivo de la plataforma y solo ante no devolución o disputa formal.
                  </Text>
                </View>
              </TouchableOpacity>
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
  mensajeError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  inputError: { borderColor: colors.danger },
  necesitasCard: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.field,
    backgroundColor: colors.darkCardSubtle,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    marginBottom: theme.spacing.md,
  },
  bloqueoCaja: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xxl,
  },
  bloqueoIcono: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.darkCardSubtle,
    marginBottom: theme.spacing.sm,
  },
  bloqueoTitulo: { color: colors.textWhite, fontSize: 19, fontWeight: "800", textAlign: "center" },
  bloqueoTexto: { color: colors.textSilver, fontSize: 14, lineHeight: 20, textAlign: "center" },
  bloqueoPista: { color: colors.accent, fontSize: 13, fontWeight: "700", textAlign: "center" },
  necesitasTitulo: { color: colors.textWhite, fontSize: 14, fontWeight: "700" },
  necesitasFila: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  necesitasTexto: { flex: 1, color: colors.textSilver, fontSize: 13, lineHeight: 18 },
  gpsConsent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    backgroundColor: colors.darkCardSubtle,
  },
  gpsConsentOn: { borderColor: colors.accent },
  gpsBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.darkBorder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  gpsBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  gpsTitle: { color: colors.textWhite, fontSize: 14, fontWeight: "700" },
  gpsHelp: { color: colors.darkTextMuted, fontSize: 12, lineHeight: 17 },
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
  mapHintBadgeOk: { backgroundColor: "rgba(16, 122, 87, 0.92)" },
  mapHintText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
  fieldHint: { fontSize: 12, lineHeight: 16, color: colors.textSilver },
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
  // Estilos del Selector de Tipo de Vehículo
  tipoVehiculoGrid: {
    gap: 8,
    marginTop: 4,
  },
  tipoCard: {
    backgroundColor: colors.darkCardSubtle,
    borderRadius: theme.radius.card,
    borderWidth: 1.5,
    borderColor: colors.darkBorder,
    padding: 12,
    gap: 4,
  },
  tipoCardSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(47, 191, 155, 0.08)",
  },
  tipoCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tipoIconBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  tipoIconBoxSelected: {
    backgroundColor: "rgba(47, 191, 155, 0.2)",
  },
  tipoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textWhite,
    flex: 1,
  },
  tipoTitleSelected: {
    color: colors.accent,
  },
  tipoCheckBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  tipoDesc: {
    fontSize: 12,
    color: colors.textSilver,
    lineHeight: 16,
    marginTop: 2,
  },
  tipoFooter: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    gap: 2,
  },
  tipoRango: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent,
  },
  tipoEjemplos: {
    fontSize: 11,
    color: colors.darkTextMuted,
    fontStyle: "italic",
  },
  // Estilos de Tarifa & Stepper de $5.000
  tarifaHeaderBox: {
    backgroundColor: "rgba(47, 191, 155, 0.08)",
    padding: 12,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: "rgba(47, 191, 155, 0.25)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  tarifaCatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(47, 191, 155, 0.2)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  tarifaCatText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
  },
  tarifaRangoInfo: {
    fontSize: 12,
    color: colors.textSilver,
    fontWeight: "500",
  },
  tarifaCardPrincipal: {
    backgroundColor: colors.darkCardSubtle,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    padding: 14,
    gap: 12,
  },
  tarifaCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textWhite,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.darkBg,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.darkBorderStrong,
    padding: 6,
  },
  stepperBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "rgba(47, 191, 155, 0.15)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: "rgba(47, 191, 155, 0.3)",
  },
  stepperBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
  },
  stepperValueBox: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  stepperMonto: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.textWhite,
    letterSpacing: -0.5,
  },
  stepperMontoSub: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.accent,
    marginTop: 1,
  },
  pillsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSilver,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  precioPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.darkBg,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  precioPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  precioPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSilver,
  },
  precioPillTextActive: {
    color: colors.primary900,
    fontWeight: "800",
  },
  inputManualRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  inputManualLabel: {
    fontSize: 12,
    color: colors.textSilver,
    flex: 1,
  },
  inputManual: {
    backgroundColor: colors.darkBg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    height: 38,
    borderWidth: 1,
    borderColor: colors.darkBorderStrong,
    fontSize: 14,
    fontWeight: "700",
    color: colors.textWhite,
    width: 120,
    textAlign: "right",
  },
  // Desglose Financiero con IVA 19%
  profitHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ivaBadge: {
    backgroundColor: "rgba(47, 191, 155, 0.15)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(47, 191, 155, 0.3)",
  },
  ivaBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  desgloseDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 6,
  },
  desgloseFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  desgloseTxt: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textWhite,
  },
  desgloseVal: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textWhite,
  },
  desgloseTxtSub: {
    fontSize: 11,
    color: colors.textSilver,
  },
  desgloseValSub: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSilver,
  },
});
