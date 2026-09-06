import { useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ApiClient,
  showAlert,
  FOTOS_AUTO,
  TOTAL_FOTOS_AUTO,
  subirImagenOptimizada,
  subirImagenesOptimizadas,
} from "@rentacar/mobile-shared";
import {
  obtenerConfiguracionTipo,
  clampTarifa,
  calcularDesgloseIva,
} from "@rentacar/mobile-shared/vehiculo/catalogoPrecios";
import { useCatalogoPrecios } from "@rentacar/mobile-shared/vehiculo/useCatalogoPrecios";
import { validarPatenteChilena } from "@rentacar/shared-schemas";

// Mapa nativo y GPS: opcionales, la app sigue si el módulo no está.
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

export const MAPA = { MapView, Marker };
// Centro inicial de la cámara del mapa (zona de operación), no un punto por
// defecto del auto: sin que el dueño toque el mapa no hay pin.
export const PUNTO_INICIAL = { latitude: -37.4697, longitude: -72.3536 };
export const PUEDE_FIJAR_PUNTO = !!MapView || !!Location;

// Documentos legales que el backend exige. `tipo` es lo que responde el
// motor de validación (app/features/verificacion_vehiculos).
export const TIPO_POR_CAMPO = {
  doc_inscripcion_url: "padron",
  doc_permiso_circulacion_url: "permiso_circulacion",
  doc_soap_url: "soap",
  doc_seguro_url: "seguro",
  doc_revision_tecnica_url: "revision_tecnica",
};

export const DOCS = [
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
    titulo: "Seguro del auto",
    ayuda: "Póliza comercial vigente, si tienes una además del SOAP.",
    icon: "shield",
    opcional: true,
  },
];

export const DOCS_OBLIGATORIOS = DOCS.filter((d) => !d.opcional);

const CAMPOS_POR_PASO = {
  1: ["marca", "modelo", "categoria", "anio", "patente", "ubicacion_base", "punto"],
  2: ["tarifa_dia"],
};

export function useCarWizard({ onComplete }) {
  const tipos = useCatalogoPrecios();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pasosIntentados, setPasosIntentados] = useState({});

  const [form, setForm] = useState(() => ({
    marca: "",
    modelo: "",
    anio: "2023",
    patente: "",
    categoria: "sedan",
    tarifa_dia: obtenerConfiguracionTipo("sedan", tipos).base,
    ubicacion_base: "",
    latitud: null,
    longitud: null,
    transmision: "automatica",
    combustible: "bencina",
    asientos: "5",
    puertas: "4",
    equipamiento: { ac: true, bluetooth: true, isofix: false, doble_traccion: false, camara_retroceso: true },
    docs: {},
    // Limpieza de UI de GPS: la casilla de consentimiento se ocultó hasta la
    // nueva definición formal del módulo. Se deja en `true` para no romper la
    // publicación con el backend actual, que aún lo exige.
    gps_consentimiento: true,
  }));

  const setField = (key, valor) => setForm((prev) => ({ ...prev, [key]: valor }));

  // Fotos: una por casilla, se suben apenas se toman.
  const [fotosPorSlot, setFotosPorSlot] = useState({});
  const [slotEnSubida, setSlotEnSubida] = useState(null);
  const [camaraSlot, setCamaraSlot] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [progresoGaleria, setProgresoGaleria] = useState(null);

  // Documentos.
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [validacionDocs, setValidacionDocs] = useState({});
  const [validandoDoc, setValidandoDoc] = useState(null);

  const [locatingGps, setLocatingGps] = useState(false);
  const mapaRef = useRef(null);
  const referenciaEditadaAMano = useRef(false);

  const anioActual = new Date().getFullYear();

  const configTipo = useMemo(
    () => obtenerConfiguracionTipo(form.categoria, tipos),
    [form.categoria, tipos]
  );
  const tarifaActual = clampTarifa(form.tarifa_dia || configTipo.base, configTipo);
  const desglose = useMemo(() => calcularDesgloseIva(tarifaActual), [tarifaActual]);

  const fotosOrdenadas = FOTOS_AUTO.map((s) => fotosPorSlot[s.key]).filter(Boolean);
  const fotosListas = fotosOrdenadas.length;

  const docsCargados = DOCS_OBLIGATORIOS.filter((d) => form.docs[d.key]).length;
  const docsBloqueantes = DOCS.filter((d) => validacionDocs[d.key]?.bloquea);

  const tienePunto =
    typeof form.latitud === "number" && typeof form.longitud === "number";

  // --- Validación ---------------------------------------------------------
  const errores = (() => {
    const e = {};
    if (!form.marca.trim()) e.marca = "Elige la marca de tu auto.";
    if (!form.modelo.trim()) e.modelo = "Escribe el modelo, como aparece en el padrón.";
    if (!form.categoria) e.categoria = "Selecciona el tipo de vehículo.";

    const anio = parseInt(form.anio, 10);
    if (!String(form.anio).trim()) e.anio = "Falta el año.";
    else if (Number.isNaN(anio) || anio < 2000) e.anio = "Aceptamos autos del año 2000 en adelante.";
    else if (anio > anioActual + 1) e.anio = `El año no puede ser mayor a ${anioActual + 1}.`;

    if (!form.patente.trim()) e.patente = "Falta la patente.";
    else if (!validarPatenteChilena(form.patente)) {
      e.patente = "Revisa el formato: 4 letras y 2 números (BBCL-10) o 2 letras y 4 números (AB-12-34).";
    }

    if (!form.ubicacion_base.trim()) e.ubicacion_base = "Escribe una referencia del punto de entrega.";
    if (PUEDE_FIJAR_PUNTO && !tienePunto) {
      e.punto = "Fija el punto en el mapa o usa tu ubicación actual.";
    }

    return e;
  })();

  const errorDe = (campo) => {
    const paso = Object.keys(CAMPOS_POR_PASO).find((k) => CAMPOS_POR_PASO[k].includes(campo));
    return pasosIntentados[paso] ? errores[campo] : null;
  };

  // --- Categoría / tarifa ------------------------------------------------
  const elegirCategoria = (id) => {
    const tipo = obtenerConfiguracionTipo(id, tipos);
    setForm((prev) => ({ ...prev, categoria: id, tarifa_dia: tipo.base }));
  };
  const ajustarTarifa = (delta) => {
    setForm((prev) => ({
      ...prev,
      tarifa_dia: clampTarifa((prev.tarifa_dia || configTipo.base) + delta, configTipo),
    }));
  };
  const fijarTarifa = (valor) => setField("tarifa_dia", clampTarifa(valor, configTipo));

  // --- Ubicación --------------------------------------------------------
  const describirPunto = async (lat, lon) => {
    const respaldo = `Punto (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
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

  const centrarMapa = (lat, lon) => {
    if (!mapaRef.current) return;
    mapaRef.current.animateCamera({ center: { latitude: lat, longitude: lon } }, { duration: 350 });
  };

  const usarUbicacionActual = async () => {
    setLocatingGps(true);
    try {
      if (!Location) {
        showAlert("Ubicación no disponible", "El módulo de ubicación no está disponible en este dispositivo.");
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showAlert("Permiso requerido", "Activa el permiso de ubicación para obtener tus coordenadas actuales.");
        return;
      }
      const precisionAlta = Location.Accuracy?.High ?? 4;
      const pos = await Location.getCurrentPositionAsync({ accuracy: precisionAlta });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const sector = await describirPunto(lat, lon);
      referenciaEditadaAMano.current = false;
      setForm((prev) => ({ ...prev, latitud: lat, longitud: lon, ubicacion_base: sector }));
      centrarMapa(lat, lon);
    } catch (err) {
      showAlert("No se pudo obtener la ubicación", err.message || "Toca el mapa para elegir el punto.");
    } finally {
      setLocatingGps(false);
    }
  };

  const fijarPunto = async (lat, lon) => {
    setForm((prev) => ({ ...prev, latitud: lat, longitud: lon }));
    if (referenciaEditadaAMano.current) return;
    const descripcion = await describirPunto(lat, lon);
    if (referenciaEditadaAMano.current) return;
    setForm((prev) => ({ ...prev, ubicacion_base: descripcion }));
  };

  const onMapPress = (e) => {
    const coord = e?.nativeEvent?.coordinate;
    if (coord && coord.latitude !== undefined && coord.longitude !== undefined) {
      fijarPunto(coord.latitude, coord.longitude);
    }
  };

  const setReferencia = (t) => {
    referenciaEditadaAMano.current = true;
    setField("ubicacion_base", t);
  };

  // --- Fotos -----------------------------------------------------------
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

  const fotoCapturada = async (uri) => {
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
      showAlert("No se pudo subir la foto", error.message || "Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSlotEnSubida(null);
    }
  };

  const fotosDesdeGaleria = async () => {
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
        { bucket: "autos", onProgreso: (listas, total) => setProgresoGaleria({ listas, total }) }
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
          `${fallidas} de ${urls.length} quedaron pendientes. Repítelas desde su casilla.`
        );
      }
    } catch (error) {
      showAlert("Error al subir las fotos", error.message || "Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setUploadingPhoto(false);
      setProgresoGaleria(null);
    }
  };

  const quitarFoto = (key) =>
    setFotosPorSlot((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  // --- Documentos ----------------------------------------------------
  const validarDocumento = async (docKey, url) => {
    const patente = (form.patente || "").toUpperCase().trim();
    if (!patente || !url) return;
    setValidandoDoc(docKey);
    try {
      const res = await ApiClient.validarDocumentosAuto({ patente, [docKey]: url });
      const veredicto = (res?.documentos || []).find((d) => d.tipo === TIPO_POR_CAMPO[docKey]);
      if (veredicto) setValidacionDocs((prev) => ({ ...prev, [docKey]: veredicto }));
    } catch (error) {
      console.warn("[addcar] no se pudo validar el documento:", error.message);
    } finally {
      setValidandoDoc((actual) => (actual === docKey ? null : actual));
    }
  };

  const subirDocumento = (docKey, origen) => {
    runPicker(origen, async (uri) => {
      setUploadingDoc(docKey);
      try {
        const url = await subirImagenOptimizada(uri, {
          filename: `${docKey}_${Date.now()}.jpg`,
          bucket: "documentos-autos",
          maxAncho: 2000,
          calidad: 0.75,
        });
        if (url) {
          setForm((prev) => ({ ...prev, docs: { ...prev.docs, [docKey]: url } }));
          validarDocumento(docKey, url);
        }
      } catch (error) {
        showAlert("No se pudo subir el documento", error.message || "Revisa tu conexión e inténtalo de nuevo.");
      } finally {
        setUploadingDoc(null);
      }
    });
  };

  const quitarDocumento = (docKey) => {
    setForm((prev) => {
      const next = { ...prev.docs };
      delete next[docKey];
      return { ...prev, docs: next };
    });
    setValidacionDocs((prev) => {
      const next = { ...prev };
      delete next[docKey];
      return next;
    });
  };

  // --- Navegación / envío -------------------------------------------
  const subiendo = uploadingPhoto || !!uploadingDoc || !!slotEnSubida;

  const irAtras = ({ onSalir }) => {
    if (step > 1) setStep(step - 1);
    else onSalir?.();
  };

  const avanzar = () => {
    if (step === 1 || step === 2) {
      setPasosIntentados((prev) => ({ ...prev, [step]: true }));
      if (CAMPOS_POR_PASO[step].some((campo) => errores[campo])) return;
      setStep(step + 1);
      return;
    }
    if (step === 3) {
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
      return;
    }
    enviar();
  };

  const enviar = async () => {
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
        tarifa_dia: tarifaActual,
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

      const nombre = `${form.marca} ${form.modelo} (${form.patente.toUpperCase()})`;
      if (res?.documentos_verificados) {
        showAlert(
          "¡Auto publicado y verificado!",
          `Tu ${nombre} fue verificado automáticamente y ya está activo en el mapa del marketplace.`,
          [{ text: "Ver mi flota", onPress: onComplete }]
        );
      } else {
        showAlert(
          "Auto registrado — En revisión",
          `Tu ${nombre} quedó registrado. Los documentos fueron enviados a revisión por nuestro equipo. Te avisaremos apenas quede habilitado.`,
          [{ text: "Ver mi flota", onPress: onComplete }]
        );
      }
    } catch (error) {
      showAlert("No se pudo publicar", error.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    // estado
    step,
    form,
    setField,
    setForm,
    loading,
    subiendo,
    tipos,
    configTipo,
    tarifaActual,
    desglose,
    tienePunto,
    errores,
    errorDe,
    // fotos
    fotosPorSlot,
    fotosListas,
    slotEnSubida,
    camaraSlot,
    setCamaraSlot,
    uploadingPhoto,
    progresoGaleria,
    fotoCapturada,
    fotosDesdeGaleria,
    quitarFoto,
    // docs
    uploadingDoc,
    validacionDocs,
    validandoDoc,
    subirDocumento,
    quitarDocumento,
    docsCargados,
    // categoría/tarifa
    elegirCategoria,
    ajustarTarifa,
    fijarTarifa,
    // ubicación
    mapaRef,
    locatingGps,
    usarUbicacionActual,
    onMapPress,
    setReferencia,
    // navegación
    irAtras,
    avanzar,
  };
}
