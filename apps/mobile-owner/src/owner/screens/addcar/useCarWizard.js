import { useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ApiClient,
  showAlert,
  msjError,
  FOTOS_AUTO,
  TOTAL_FOTOS_AUTO,
  subirImagenOptimizada,
} from "@rentacar/mobile-shared";
import {
  obtenerConfiguracionTipo,
  clampTarifa,
  calcularDesgloseIva,
} from "@rentacar/mobile-shared/vehiculo/catalogoPrecios";
import { useCatalogoPrecios } from "@rentacar/mobile-shared/vehiculo/useCatalogoPrecios";
import { formatearDireccionChile } from "@rentacar/mobile-shared/utils/direccion";
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

// Borrador del wizard: se guarda en el dispositivo (no por cuenta, mismo
// criterio que el resto de las banderas locales de la app) para que salir a
// mitad de camino -- o que la app se cierre sola mientras se suben las 9
// fotos -- no obligue a empezar de cero.
const DRAFT_STORAGE_KEY = "@rentacar/addcar_draft_v1";
const DRAFT_DEBOUNCE_MS = 800;

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
  doc_certificado_gases_url: "certificado_gases",
  doc_historial_vehicular_url: "historial_vehicular",
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
    key: "doc_certificado_gases_url",
    titulo: "Certificado de emisión de gases",
    ayuda: "Certificado de revisión de gases o de control de emisiones vigente.",
    icon: "gas",
  },
  {
    key: "doc_historial_vehicular_url",
    titulo: "Historial vehicular (Autofact / CAV)",
    ayuda: "Certificado de anotaciones vigentes o informe vehicular para verificar multas y kilometraje.",
    icon: "document",
    opcional: true,
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

// El paso 2 (Tarifa) no tiene campos acá: siempre parte de un valor válido
// (clamp automático entre el mínimo y el máximo de la categoría), así que no
// hay nada que pueda quedar inválido para bloquear "Siguiente".
const CAMPOS_POR_PASO = {
  1: ["marca", "modelo", "categoria", "anio", "patente", "ubicacion_base", "punto"],
};

export function useCarWizard({ onComplete }) {
  const tipos = useCatalogoPrecios();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pasosIntentados, setPasosIntentados] = useState({});
  // Se incrementa cada vez que "Siguiente" queda bloqueado por errores del
  // paso 1: PasoVehiculo lo escucha para hacer scroll hasta el primer campo
  // con error (antes los errores solo se pintaban en rojo donde ya estaban
  // en pantalla; si el campo quedaba más abajo, tocar "Siguiente" parecía no
  // hacer nada).
  const [intentoFallidoTick, setIntentoFallidoTick] = useState(0);

  const [form, setForm] = useState(() => ({
    marca: "",
    modelo: "",
    anio: String(new Date().getFullYear()),
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

  const setField = (key, valor) => {
    let valorLimpio = valor;
    if (key === "anio") {
      valorLimpio = String(valor ?? "").replace(/[^0-9]/g, "").slice(0, 4);
    } else if (key === "patente") {
      // Antes se forzaba UN guion en una sola posición fija apenas se
      // completaban 6 caracteres sin guion -- "BRHB12" pasaba a "BRHB-12"
      // (nueva, letras juntas) sí o sí, sin dejar escribir, por ejemplo,
      // "BR-HB-12" (letras en pares) ni "AB-12-34" (antigua, dígitos en
      // pares): ambas son formatos que el backend documenta y acepta
      // explícitamente (ver validar_patente_chilena en
      // apps/api/app/core/validators.py), igual que `validarPatenteChilena`
      // acá: ninguna de las dos validaciones le importa dónde caen los
      // guiones, los ignora por completo. Ahora el campo solo pasa a
      // mayúsculas y filtra caracteres inválidos -- el guion, donde sea que
      // el dueño quiera ponerlo, queda a su criterio.
      valorLimpio = String(valor ?? "")
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, "")
        .slice(0, 9);
    }
    setForm((prev) => ({ ...prev, [key]: valorLimpio }));
  };

  // Fotos: una por casilla, se suben apenas se toman. Un Set (no un solo
  // valor) porque se puede abrir la cámara para otra casilla mientras la
  // anterior sigue subiendo -- con un único valor, el `finally` de la
  // primera subida en terminar borraba el spinner de la segunda aunque esa
  // siguiera en curso.
  const [fotosPorSlot, setFotosPorSlot] = useState({});
  const [slotsEnSubida, setSlotsEnSubida] = useState(() => new Set());
  const [camaraSlot, setCamaraSlot] = useState(null);

  // Documentos.
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [validacionDocs, setValidacionDocs] = useState({});
  const [validandoDoc, setValidandoDoc] = useState(null);

  // Cada veredicto de `validacionDocs` se calculó con la patente que había
  // en ese momento (ver `validarDocumento`). Si el dueño vuelve al paso 1 y
  // la corrige, esos veredictos quedan obsoletos -- un documento "Validado"
  // seguiría bloqueado para reemplazo aunque ya no corresponda, y uno
  // rechazado por "patente no coincide" seguiría bloqueando la publicación
  // aunque la patente ya esté bien. Se limpian para que cada documento
  // vuelva a mostrarse como pendiente de verificar con la patente nueva.
  const patenteValidadaRef = useRef(form.patente);
  useEffect(() => {
    if (form.patente === patenteValidadaRef.current) return;
    patenteValidadaRef.current = form.patente;
    setValidacionDocs((prev) => (Object.keys(prev).length ? {} : prev));
  }, [form.patente]);

  const [locatingGps, setLocatingGps] = useState(false);
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);
  const mapaRef = useRef(null);
  const referenciaEditadaAMano = useRef(false);
  const isMounted = useRef(true);
  // Token de la última petición de reverse-geocode disparada por un tap en el
  // mapa: si llega la respuesta de un tap viejo después de uno más nuevo, se
  // descarta (solo gana la última).
  const geocodeTokenRef = useRef(0);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // --- Borrador persistido -------------------------------------------
  // `null` mientras se revisa el almacenamiento (evita ofrecer -o pisar- un
  // borrador antes de saber si existe uno). Si aparece uno con contenido
  // real, se guarda acá para que la pantalla pregunte "¿retomar?" antes de
  // mostrar el wizard vacío.
  const [verificandoBorrador, setVerificandoBorrador] = useState(true);
  const [borradorPendiente, setBorradorPendiente] = useState(null);
  const draftTimerRef = useRef(null);

  useEffect(() => {
    let vivo = true;
    AsyncStorage.getItem(DRAFT_STORAGE_KEY)
      .then((raw) => {
        if (!vivo || !raw) return;
        try {
          const draft = JSON.parse(raw);
          const hayAlgo =
            draft?.form?.marca || draft?.form?.modelo || Object.keys(draft?.fotosPorSlot || {}).length;
          if (hayAlgo) setBorradorPendiente(draft);
        } catch {
          // Borrador corrupto (versión vieja, JSON roto): se ignora.
        }
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setVerificandoBorrador(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Guarda con debounce mientras el dueño escribe/sube cosas. No corre
  // mientras se está revisando o mientras hay un borrador ofrecido sin
  // decisión todavía, para no pisarlo con el formulario vacío inicial.
  useEffect(() => {
    if (verificandoBorrador || borradorPendiente) return undefined;
    clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const hayAlgo =
        form.marca || form.modelo || Object.keys(fotosPorSlot).length || Object.keys(form.docs || {}).length;
      if (!hayAlgo) {
        AsyncStorage.removeItem(DRAFT_STORAGE_KEY).catch(() => {});
        return;
      }
      AsyncStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ form, fotosPorSlot, validacionDocs, step, guardadoEn: Date.now() })
      ).catch(() => {});
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(draftTimerRef.current);
  }, [form, fotosPorSlot, validacionDocs, step, verificandoBorrador, borradorPendiente]);

  const retomarBorrador = () => {
    if (!borradorPendiente) return;
    // Merge sobre los valores por defecto (no reemplazo directo): si el
    // borrador viene de una versión más vieja de la app a la que le falte
    // algún campo nuevo, ese campo conserva su default en vez de quedar
    // `undefined`.
    if (borradorPendiente.form) setForm((prev) => ({ ...prev, ...borradorPendiente.form }));
    setFotosPorSlot(borradorPendiente.fotosPorSlot || {});
    setValidacionDocs(borradorPendiente.validacionDocs || {});
    setStep(borradorPendiente.step && borradorPendiente.step >= 1 && borradorPendiente.step <= 4 ? borradorPendiente.step : 1);
    setBorradorPendiente(null);
  };

  const descartarBorrador = () => {
    AsyncStorage.removeItem(DRAFT_STORAGE_KEY).catch(() => {});
    setBorradorPendiente(null);
  };

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

    const anioRaw = String(form.anio ?? "").trim();
    const anio = parseInt(anioRaw, 10);
    if (!anioRaw) e.anio = "Falta el año.";
    else if (!/^\d{4}$/.test(anioRaw) || Number.isNaN(anio) || anio < 2000) {
      e.anio = "Aceptamos autos del año 2000 en adelante.";
    } else if (anio > anioActual + 1) {
      e.anio = `El año no puede ser mayor a ${anioActual + 1}.`;
    }

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
    setForm((prev) => ({
      // Si el dueño ya había personalizado la tarifa en el paso 2 y vuelve a
      // cambiar la categoría (ej. para corregir algo en el paso 1), no se le
      // borra la elección en silencio: se ajusta (clamp) al rango de la
      // nueva categoría, y solo cae al precio base si su tarifa ya no cabe.
      ...prev,
      categoria: id,
      tarifa_dia: clampTarifa(prev.tarifa_dia || tipo.base, tipo),
    }));
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
      // Formato: "calle número, ciudad, comuna (si aplica), región".
      return formatearDireccionChile(rev) || respaldo;
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
      if (!isMounted.current) return;
      referenciaEditadaAMano.current = false;
      setForm((prev) => ({ ...prev, latitud: lat, longitud: lon, ubicacion_base: sector }));
      centrarMapa(lat, lon);
    } catch (err) {
      if (isMounted.current) {
        showAlert("No se pudo obtener la ubicación", msjError(err, "Toca el mapa para elegir el punto."));
      }
    } finally {
      if (isMounted.current) {
        setLocatingGps(false);
      }
    }
  };

  // Antes la única forma de fijar el punto era tocar el mapa o usar el GPS:
  // si el dueño prefería escribir la dirección directamente, no había forma
  // de que eso moviera el pin -- la geocodificación solo corría en el
  // sentido mapa → texto (describirPunto), nunca texto → mapa.
  const buscarDireccionEnMapa = async () => {
    const direccion = (form.ubicacion_base || "").trim();
    if (!direccion) return;
    if (!Location) {
      showAlert("Búsqueda no disponible", "El módulo de mapas no está disponible en este dispositivo. Marca el punto a mano.");
      return;
    }
    setBuscandoDireccion(true);
    try {
      const resultados = await Location.geocodeAsync(direccion);
      const primero = resultados?.[0];
      if (!isMounted.current) return;
      if (!primero) {
        showAlert(
          "No encontramos esa dirección",
          "Prueba con calle, número y comuna (ej. \"Av. Alemania 6370, Temuco\"), o marca el punto directo en el mapa."
        );
        return;
      }
      referenciaEditadaAMano.current = true;
      setForm((prev) => ({ ...prev, latitud: primero.latitude, longitud: primero.longitude }));
      centrarMapa(primero.latitude, primero.longitude);
    } catch (err) {
      if (isMounted.current) {
        showAlert("No se pudo buscar la dirección", msjError(err, "Marca el punto directo en el mapa."));
      }
    } finally {
      if (isMounted.current) setBuscandoDireccion(false);
    }
  };

  const fijarPunto = async (lat, lon) => {
    if (!isMounted.current) return;
    // Las coordenadas del tap actual se guardan de inmediato, sin esperar el
    // reverse geocode.
    setForm((prev) => ({ ...prev, latitud: lat, longitud: lon }));
    if (referenciaEditadaAMano.current) return;
    const token = ++geocodeTokenRef.current;
    const descripcion = await describirPunto(lat, lon);
    // Si llegó un tap más nuevo mientras esperábamos, esta respuesta quedó
    // obsoleta: se descarta para no pisar la ubicación con un texto que no
    // corresponde a las coordenadas actuales.
    if (!isMounted.current || referenciaEditadaAMano.current || geocodeTokenRef.current !== token) return;
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
      showAlert("No se pudo abrir la cámara o galería", msjError(error, "Inténtalo de nuevo."));
    }
  };

  // Sube `uri` a la casilla `slot` y deja la casilla marcada como "en subida"
  // mientras tanto. Lo comparten la captura con cámara y la carga desde la
  // galería, que solo se diferencian en de dónde sale el archivo.
  const subirFotoEnSlot = async (slot, uri) => {
    if (!uri || !slot) return;
    setSlotsEnSubida((prev) => new Set(prev).add(slot.key));
    try {
      const url = await subirImagenOptimizada(uri, {
        filename: `auto_${slot.key}_${Date.now()}.jpg`,
        bucket: "autos",
      });
      if (url) setFotosPorSlot((prev) => ({ ...prev, [slot.key]: url }));
    } catch (error) {
      showAlert("No se pudo subir la foto", msjError(error, "Revisa tu conexión e inténtalo de nuevo."));
    } finally {
      setSlotsEnSubida((prev) => {
        const next = new Set(prev);
        next.delete(slot.key);
        return next;
      });
    }
  };

  const fotoCapturada = async (uri) => {
    const slot = camaraSlot;
    setCamaraSlot(null);
    await subirFotoEnSlot(slot, uri);
  };

  // Elegir de la galería UNA foto para UNA casilla concreta. A diferencia de
  // la carga masiva que había antes, acá no hay que adivinar el orden: el
  // dueño dice explícitamente a qué toma corresponde la imagen.
  const fotoDesdeGaleriaEnSlot = (slot) => {
    if (!slot) return;
    runPicker("library", (uri) => subirFotoEnSlot(slot, uri));
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
      // Antes esto quedaba en silencio: la ranura seguía mostrando
      // "Documento listo" como si todo estuviera bien, sin que nada avisara
      // que la verificación automática no corrió. No bloquea la publicación
      // (es una falla de red/infra, no un rechazo del documento) pero sí
      // avisa y ofrece reintentar.
      setValidacionDocs((prev) => ({
        ...prev,
        [docKey]: {
          estado: "error_validacion",
          motivo: "No pudimos verificar este documento automáticamente. Reintenta, o continúa igual: quedará pendiente de revisión manual.",
          bloquea: false,
        },
      }));
    } finally {
      setValidandoDoc((actual) => (actual === docKey ? null : actual));
    }
  };

  const reintentarValidacion = (docKey) => {
    const url = form.docs[docKey];
    if (url) validarDocumento(docKey, url);
  };

  const subirDocumento = (docKey, origen) => {
    const val = validacionDocs[docKey];
    const estaValidado = val?.estado === "vigente" || val?.estado === "sin_vencimiento";
    if (estaValidado) {
      showAlert("Documento validado", "Este documento ya fue verificado y aprobado. La opción está bloqueada.");
      return;
    }
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
        showAlert("No se pudo subir el documento", msjError(error, "Revisa tu conexión e inténtalo de nuevo."));
      } finally {
        setUploadingDoc(null);
      }
    });
  };

  const quitarDocumento = (docKey) => {
    const val = validacionDocs[docKey];
    const estaValidado = val?.estado === "vigente" || val?.estado === "sin_vencimiento";
    if (estaValidado) {
      showAlert("Documento validado", "Este documento ya fue verificado y no puede ser eliminado.");
      return;
    }
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
  // Incluye `validandoDoc`: antes se podía tocar "Publicar" mientras un
  // documento todavía se estaba leyendo, publicando con un veredicto que
  // ni siquiera había llegado.
  const subiendo = !!uploadingDoc || slotsEnSubida.size > 0 || !!validandoDoc;

  const irAtras = ({ onSalir }) => {
    if (step > 1) setStep(step - 1);
    else onSalir?.();
  };

  const avanzar = () => {
    if (step === 1) {
      setPasosIntentados((prev) => ({ ...prev, [step]: true }));
      if (CAMPOS_POR_PASO[step].some((campo) => errores[campo])) {
        setIntentoFallidoTick((t) => t + 1);
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
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

  const ejecutarCreacion = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.crearAuto({
        marca: form.marca,
        modelo: form.modelo,
        anio: parseInt(form.anio, 10) || new Date().getFullYear(),
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

      // El auto ya está creado: el borrador dejó de tener sentido.
      AsyncStorage.removeItem(DRAFT_STORAGE_KEY).catch(() => {});

      const nombre = `${form.marca} ${form.modelo} (${form.patente.toUpperCase()})`;
      // `cancelable: false`: el auto ya quedó creado en el servidor en este
      // punto. Sin esto, en Android el botón/gesto de volver podía cerrar
      // la alerta sin tocar "Ver mi flota", dejando al dueño de vuelta en el
      // wizard con todo lleno y el botón "Publicar auto" listo para
      // tocarlo de nuevo -- un segundo toque chocaría con la patente ya
      // registrada.
      if (res?.documentos_verificados && res?.estado === "activo") {
        showAlert(
          "¡Auto publicado y verificado!",
          `Tu ${nombre} fue verificado automáticamente y ya está activo en el mapa del marketplace.`,
          [{ text: "Ver mi flota", onPress: onComplete }],
          { cancelable: false }
        );
      } else {
        showAlert(
          "Auto registrado — Pendiente de validación",
          `Tu ${nombre} quedó registrado como PENDIENTE. Ya recibimos tus documentos; no estará disponible para arriendo hasta que nuestro equipo los revise y apruebe.`,
          [{ text: "Ver mi flota", onPress: onComplete }],
          { cancelable: false }
        );
      }
    } catch (error) {
      // Si la conexión se corta justo después de que el servidor ya creó el
      // auto, el reintento choca con "patente duplicada" -- antes esto se
      // mostraba como un error genérico de "inténtalo de nuevo", que
      // llevaba a reintentar algo que en realidad ya se había publicado.
      const yaExiste = /ya existe.*patente|patente.*ya (está|esta) registrad/i.test(error?.message || "");
      if (yaExiste) {
        // Este caso también significa que el auto quedó publicado (de un
        // intento anterior): el borrador ya no aplica.
        AsyncStorage.removeItem(DRAFT_STORAGE_KEY).catch(() => {});
        showAlert(
          "Es posible que ya se haya publicado",
          `Perdimos la confirmación del servidor, pero un auto con la patente ${form.patente.toUpperCase()} ya está registrado -- probablemente de un intento anterior. Revisa tu flota antes de intentarlo de nuevo.`,
          [{ text: "Ver mi flota", onPress: onComplete }],
          { cancelable: false }
        );
      } else {
        showAlert("No se pudo publicar", msjError(error, "Intenta de nuevo en unos segundos."));
      }
    } finally {
      setLoading(false);
    }
  };

  const enviar = async () => {
    if (loading) return;
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
        "Faltan documentos obligatorios",
        `Debes subir ${faltan.map((d) => d.titulo.toLowerCase()).join(", ")}. Si no subes los documentos del vehículo, no quedará activo en el sistema.`
      );
      return;
    }
    ejecutarCreacion();
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
    intentoFallidoTick,
    // borrador
    verificandoBorrador,
    borradorPendiente,
    retomarBorrador,
    descartarBorrador,
    // fotos
    fotosPorSlot,
    fotosListas,
    slotsEnSubida,
    camaraSlot,
    setCamaraSlot,
    fotoCapturada,
    fotoDesdeGaleriaEnSlot,
    quitarFoto,
    // docs
    uploadingDoc,
    validacionDocs,
    validandoDoc,
    subirDocumento,
    quitarDocumento,
    reintentarValidacion,
    docsCargados,
    // categoría/tarifa
    elegirCategoria,
    ajustarTarifa,
    fijarTarifa,
    // ubicación
    mapaRef,
    locatingGps,
    usarUbicacionActual,
    buscandoDireccion,
    buscarDireccionEnMapa,
    onMapPress,
    setReferencia,
    // navegación
    irAtras,
    avanzar,
  };
}
