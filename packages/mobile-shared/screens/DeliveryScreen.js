import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Image,
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { Button, Card, Badge, Chip, ScreenHeader, SectionLabel } from "../components/ui";
import { SignaturePad } from "../components/SignaturePad";
import { SuccessCheck, SuccessFlash } from "../components/SuccessCheck";
import { QRScannerModal } from "../components/QRScannerModal";
import { SelfieLivenessModal } from "../components/SelfieLivenessModal";
import { ApiClient } from "../api/client";
import { elegirImagen, subirImagenOptimizada } from "../utils/imagenes";
import { showAlert } from "../utils/alert";
import { msjError } from "../utils/msjError";
import { formatearMilesEnVivo } from "../utils/formato";
import { hapticoExito, hapticoError } from "../utils/haptics";
import { tipoBiometriaDisponible, autenticarParaFirmar } from "../hooks/biometria";
import { guardarColaFotos, leerColaFotos, borrarColaFotos } from "../utils/colaFotosOffline";
import NetInfo from "@react-native-community/netinfo";
import { E2E_TEST_MODE, fotoFixtureE2E } from "../utils/e2e";
import {
  ANGLES,
  FUEL_SYMBOL_TO_VALUE,
  FUEL_LEVELS,
  PASOS,
  TIPOS_DANO,
  PUNTAJES_CALIFICACION,
  CATEGORIAS_IA,
  formatCLP,
} from "./DeliveryScreen.constantes";

export function DeliveryScreen({ reserva, onBack, onCompleteDelivery, onOpenDisputes }) {
  const insets = useSafeAreaInsets();
  // Reserva "en_curso" => devolución (checklist "despues"); si no, entrega ("antes").
  const tipo = reserva?.estado === "en_curso" ? "despues" : "antes";
  const esDevolucion = tipo === "despues";
  const auto = reserva?.auto || reserva?.car || {};

  const [stage, setStage] = useState("05_code");

  // 05: validar código QR (escaneado con la cámara o escrito a mano)
  const [codigoInput, setCodigoInput] = useState("");
  const [scanQR, setScanQR] = useState(false);
  const [validando, setValidando] = useState(false);
  const [datosValidados, setDatosValidados] = useState(null);
  const [reservaIdActiva, setReservaIdActiva] = useState(reserva?.id || null);

  // 06: confirmar/rechazar identidad
  const [confirmando, setConfirmando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");

  // Destello de confirmación (check animado + vibración) tras validar el
  // código QR y tras verificar la identidad. Es una capa no bloqueante: la
  // pantalla siguiente ya está montada debajo y el destello se retira solo.
  const [flashExito, setFlashExito] = useState(null);

  // Fotos del checklist. `colaFotos` es la fuente de verdad — cada entrada
  // es { uriLocal, url, estado: "subiendo"|"subida"|"error" } — y `fotos`
  // (solo los URI locales) se deriva de ahí para no tocar el resto de la
  // pantalla, que ya usaba `fotos.length`/`fotos.map(...)` para todo:
  // progreso, miniaturas y el conteo "N de 8".
  //
  // La foto se muestra apenas se toma (con su URI local, que Image renderiza
  // igual que uno remoto) y la subida corre en segundo plano. Si falla, la
  // foto NO desaparece: queda marcada "error" y se reintenta sola — antes,
  // un fallo de red borraba la foto recién tomada sin dejar rastro.
  const [colaFotos, setColaFotos] = useState([]);
  const fotos = colaFotos.map((item) => item.uriLocal);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [currentAngleIdx, setCurrentAngleIdx] = useState(0);

  // Cámara en vivo y permisos
  const cameraRef = useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Zoom rápido (0.5x/1x/2x). El prop `zoom` de expo-camera es 0-1 (porcentaje
  // del zoom digital máximo del equipo, no un múltiplo real), así que "2x" es
  // una aproximación razonable, no un valor calibrado. "0.5x" (gran angular
  // real) solo existe en iPhones con esa lente física, vía `selectedLens`
  // (API de solo iOS) — en el resto de los equipos ese botón ni se muestra.
  const ZOOM_DIGITAL_2X = 0.1;
  const [nivelZoom, setNivelZoom] = useState("1x");
  const [lenteUltraWide, setLenteUltraWide] = useState(null);
  useEffect(() => {
    if (!cameraPermission?.granted) return;
    // El <CameraView> (y por lo tanto cameraRef) solo existe montado durante
    // los stages de cámara — si el permiso ya estaba concedido al entrar a la
    // pantalla, este efecto correría antes de que el ref apunte a nada. Por
    // eso depende también de `stage` y se re-ejecuta al entrar a cada stage
    // de cámara, cuando el ref ya es real.
    if (stage !== "20_camera" && stage !== "25_return_cam") return;
    cameraRef.current
      ?.getAvailableLensesAsync?.()
      .then((lentes) => {
        const ultraWide = (lentes || []).find((l) => /ultrawide/i.test(l));
        setLenteUltraWide(ultraWide || null);
      })
      .catch(() => {});
  }, [cameraPermission?.granted, stage]);
  const zoomProps =
    nivelZoom === "0.5x" && lenteUltraWide
      ? { zoom: 0, selectedLens: lenteUltraWide }
      : nivelZoom === "2x"
      ? { zoom: ZOOM_DIGITAL_2X }
      : { zoom: 0 };

  // Métricas
  const [km, setKm] = useState("");
  const [fuelLevel, setFuelLevel] = useState("¾");

  // Reporte de diferencia en devolución. `mostrarDano` expande la sección de
  // reporte dentro de la misma pantalla de revisión — antes era el stage
  // aparte "27_damage".
  const [mostrarDano, setMostrarDano] = useState(false);
  const [damageType, setDamageType] = useState("Rayón");
  const [damageDesc, setDamageDesc] = useState("");

  // Envío del checklist
  const [enviandoChecklist, setEnviandoChecklist] = useState(false);
  const [resultadoChecklist, setResultadoChecklist] = useState(null);

  // Peritaje asistido por IA (Computer Vision)
  const [analisisIA, setAnalisisIA] = useState(null);
  const [cargandoIA, setCargandoIA] = useState(false);

  useEffect(() => {
    if (stage === "26_review" && tipo === "despues" && !analisisIA && !cargandoIA && reservaIdActiva) {
      setCargandoIA(true);
      const urlsSubidas = colaFotos.map((f) => f.url).filter(Boolean);
      ApiClient.analizarDanosIA(reservaIdActiva, {
        fotos_despues: urlsSubidas,
        notas: damageDesc || undefined,
      })
        .then((data) => {
          setAnalisisIA(data);
        })
        .catch(() => {
          // Fallback silencioso sin bloquear la experiencia
        })
        .finally(() => {
          setCargandoIA(false);
        });
    }
  }, [stage, tipo, reservaIdActiva]);

  // Firma del contrato (solo entrega/"antes"): trazo SVG capturado en el pad.
  const [firmaSvg, setFirmaSvg] = useState(null);

  // Selfie de verificación en la firma: antes era un ícono decorativo que
  // prometía comparar el rostro con la cédula sin capturar nada de verdad.
  const [mostrarSelfieEntrega, setMostrarSelfieEntrega] = useState(false);
  const [selfieEntregaUrl, setSelfieEntregaUrl] = useState(null);
  const [subiendoSelfieEntrega, setSubiendoSelfieEntrega] = useState(false);

  // El contrato se firma SIEMPRE acá, con las dos partes juntas y después de las
  // fotos: primero el arrendatario (trazo + selfie en este teléfono) y después el
  // dueño con su huella (o a mano si su teléfono no tiene biometría).
  const [biometriaDueno, setBiometriaDueno] = useState(undefined); // "huella" | "facial" | null
  const [firmaDuenoSvg, setFirmaDuenoSvg] = useState(null);
  const [firmandoDueno, setFirmandoDueno] = useState(false);
  useEffect(() => {
    let vivo = true;
    tipoBiometriaDisponible().then((t) => vivo && setBiometriaDueno(t || null));
    return () => {
      vivo = false;
    };
  }, []);

  // Calificación al cliente
  const [puntajeCliente, setPuntajeCliente] = useState(0);
  const [comentarioCliente, setComentarioCliente] = useState("");
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);
  const [calificacionEnviada, setCalificacionEnviada] = useState(false);

  const angle = ANGLES[currentAngleIdx] || ANGLES[0];

  // ---------------------------------------------------------------- handlers
  const handleValidarCodigo = async (codigoDirecto) => {
    // El escáner pasa el string leído directo; el botón manual usa el input.
    const raw = (typeof codigoDirecto === "string" ? codigoDirecto : codigoInput) || "";
    const codigo = raw.replace(/[-\s]/g, "").trim();
    if (!codigo || validando) return;
    setValidando(true);
    try {
      const resultado = await ApiClient.validarCodigoQR(codigo);
      if (reservaIdActiva && resultado.reserva_id !== reservaIdActiva) {
        hapticoError();
        showAlert("Código de otra reserva", "Este código corresponde a otra reserva. Verifica con el cliente.");
        return;
      }
      setDatosValidados(resultado);
      setReservaIdActiva(resultado.reserva_id);
      hapticoExito();
      setFlashExito("Código verificado");
      setStage("06_confirm");
    } catch (error) {
      hapticoError();
      showAlert("Código inválido", msjError(error, "Intenta de nuevo."));
    } finally {
      setValidando(false);
    }
  };

  const handleConfirmarIdentidad = async () => {
    if (confirmando) return;
    setConfirmando(true);
    try {
      const resultado = await ApiClient.confirmarVerificacionIdentidad(reservaIdActiva, {
        resultado: "confirmada",
        tipo: tipo === "antes" ? "entrega" : "devolucion",
      });
      if (resultado.siguiente_paso !== "checklist_fotos") {
        hapticoError();
        showAlert("No se pudo continuar", resultado.mensaje);
        return;
      }
      hapticoExito();
      setFlashExito("Identidad verificada");
      setStage(tipo === "antes" ? "20_camera" : "25_return_cam");
    } catch (error) {
      hapticoError();
      showAlert("Error", msjError(error, "Intenta de nuevo en unos segundos."));
    } finally {
      setConfirmando(false);
    }
  };

  const handleRechazarIdentidad = async () => {
    if (confirmando) return;
    if (!motivoRechazo.trim()) {
      showAlert("Motivo requerido", "Describe brevemente por qué no coincide la identidad.");
      return;
    }
    setConfirmando(true);
    try {
      await ApiClient.confirmarVerificacionIdentidad(reservaIdActiva, {
        resultado: "rechazada",
        tipo: tipo === "antes" ? "entrega" : "devolucion",
        motivo_rechazo: motivoRechazo.trim(),
      });
      hapticoError();
      showAlert(
        "Identidad rechazada",
        "Se bloqueó la reserva y se abrió una disputa formal para revisión de soporte.",
        [{ text: "Entendido", onPress: onCompleteDelivery }]
      );
    } catch (error) {
      showAlert("Error", msjError(error, "Intenta de nuevo en unos segundos."));
    } finally {
      setConfirmando(false);
    }
  };

  /**
   * Marca el estado de una foto en la cola y persiste el resultado. Vive
   * aparte porque la usan tanto la subida recién tomada como el reintento
   * (mount, vuelta a primer plano, o justo antes de enviar el checklist).
   */
  const marcarEnCola = (idx, cambios) => {
    setColaFotos((prev) => {
      const siguiente = prev.map((item, i) => (i === idx ? { ...item, ...cambios } : item));
      guardarColaFotos(reservaIdActiva, tipo, siguiente);
      return siguiente;
    });
  };

  /**
   * Sube una foto de la cola. Se puede llamar muchas veces sobre la misma
   * (reintentos): no importa si ya estaba "error" o recién se tomó. Devuelve
   * la URL si quedó subida, o null si falló — lo usa enviarChecklist() para
   * saber con qué URLs cuenta de verdad antes de mandar el checklist, sin
   * depender de releer el estado de React (que en ese punto puede estar
   * desactualizado frente a varias subidas corriendo a la vez).
   */
  // Subidas en curso por índice: si ya hay una subida corriendo para ese idx
  // (ej. la que lanzó handleTomarFoto en segundo plano), una segunda llamada
  // (ej. desde enviarChecklist) reutiliza esa misma promesa en vez de subir
  // el archivo dos veces en paralelo.
  const subidasEnCursoRef = useRef({});

  const subirUnaFoto = (idx, uriLocal) => {
    if (subidasEnCursoRef.current[idx]) {
      return subidasEnCursoRef.current[idx];
    }
    const promesa = (async () => {
      marcarEnCola(idx, { estado: "subiendo" });
      try {
        // Las fotos del checklist se toman en la calle, muchas veces con señal
        // mala. Sin optimizar son 3-8 MB cada una: optimizadas bajan a
        // 200-400 KB y el paso deja de sentirse trancado.
        const url = await subirImagenOptimizada(uriLocal, {
          filename: `checklist-${Date.now()}-${idx}.jpg`,
          bucket: "checklists",
        });
        marcarEnCola(idx, { estado: "subida", url });
        return url;
      } catch (error) {
        marcarEnCola(idx, { estado: "error" });
        return null;
      } finally {
        delete subidasEnCursoRef.current[idx];
      }
    })();
    subidasEnCursoRef.current[idx] = promesa;
    return promesa;
  };

  const handleTomarFoto = async () => {
    if (subiendoFoto) return;
    setSubiendoFoto(true);
    let uri = null;
    try {
      if (E2E_TEST_MODE) {
        // Test automatizado (Maestro): no hay nadie apuntando la cámara a un
        // auto real. Se usa una foto fija en vez de abrir la cámara nativa.
        uri = await fotoFixtureE2E();
      } else if (cameraPermission?.granted && cameraRef.current?.takePictureAsync) {
        try {
          const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
          uri = photo?.uri || null;
        } catch (camErr) {
          console.warn("takePictureAsync no disponible o falló:", camErr);
        }
      }
      if (!uri) {
        uri = await elegirImagen({
          origen: "camera",
          motivoPermiso: "Necesitamos la cámara para registrar el estado del vehículo.",
        });
      }
    } finally {
      setSubiendoFoto(false);
    }
    if (!uri) return; // canceló o no dio permiso: no es un error que avisar

    const idx = colaFotos.length;
    const nuevaCola = [...colaFotos, { uriLocal: uri, url: null, estado: "subiendo" }];
    setColaFotos(nuevaCola);
    setCurrentAngleIdx((prev) => Math.min(ANGLES.length - 1, prev + 1));
    guardarColaFotos(reservaIdActiva, tipo, nuevaCola);

    subirUnaFoto(idx, uri);
  };

  const handleElegirGaleria = async () => {
    if (subiendoFoto) return;
    setSubiendoFoto(true);
    let uri = null;
    try {
      uri = await elegirImagen({
        origen: "library",
        motivoPermiso: "Necesitamos acceso a tus fotos para adjuntar el estado del vehículo.",
      });
    } finally {
      setSubiendoFoto(false);
    }
    if (!uri) return;

    const idx = colaFotos.length;
    const nuevaCola = [...colaFotos, { uriLocal: uri, url: null, estado: "subiendo" }];
    setColaFotos(nuevaCola);
    setCurrentAngleIdx((prev) => Math.min(ANGLES.length - 1, prev + 1));
    guardarColaFotos(reservaIdActiva, tipo, nuevaCola);

    subirUnaFoto(idx, uri);
  };

  // Al entrar a la pantalla, si había una cola sin terminar de esta misma
  // reserva y tipo (la app se cerró o se quedó sin señal a mitad de camino),
  // se recupera junto con sus fotos locales y se reintenta lo que faltaba.
  useEffect(() => {
    if (!reservaIdActiva) return;
    let vivo = true;
    leerColaFotos(reservaIdActiva, tipo).then((guardada) => {
      if (!vivo || !guardada || !guardada.length) return;
      setColaFotos(guardada);
      setCurrentAngleIdx((prev) => Math.max(prev, Math.min(ANGLES.length - 1, guardada.length)));
      guardada.forEach((item, idx) => {
        if (item.estado !== "subida") subirUnaFoto(idx, item.uriLocal);
      });
    });
    return () => {
      vivo = false;
    };
    // Se dispara una sola vez por reserva/tipo: restaurar la cola no debe
    // repetirse en cada re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservaIdActiva, tipo]);

  // `colaFotos` en un ref: los listeners de abajo se montan una sola vez (no
  // se recrean en cada foto ni en cada cambio de estado "subiendo"/"subida")
  // y leen el valor más reciente a través del ref en vez de quedar atados a
  // la cola que existía cuando se suscribieron.
  const colaFotosRef = useRef(colaFotos);
  useEffect(() => {
    colaFotosRef.current = colaFotos;
  }, [colaFotos]);

  // Reintenta lo que quedó en "error" al volver del segundo plano — el
  // momento típico en que alguien recupera señal es justo al destrabar el
  // teléfono de nuevo, no mientras sigue con la pantalla apagada. También se
  // reintenta si la señal vuelve sin que la app haya pasado a background (ej.
  // WiFi que se recupera mientras se sigue mirando la pantalla).
  useEffect(() => {
    const reintentarPendientes = () => {
      colaFotosRef.current.forEach((item, idx) => {
        if (item.estado === "error") subirUnaFoto(idx, item.uriLocal);
      });
    };
    const subAppState = AppState.addEventListener("change", (estado) => {
      if (estado === "active") reintentarPendientes();
    });
    const unsubNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected) reintentarPendientes();
    });
    return () => {
      subAppState.remove();
      unsubNetInfo();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const irAMetricas = () => setStage("22_metrics");

  const handleContinuarMetricas = () => {
    if (!km.trim()) {
      showAlert("Kilometraje requerido", "Ingresa el kilometraje actual del vehículo.");
      return;
    }
    if (tipo === "despues") {
      setStage("26_review");
      return;
    }
    setStage("23_signature");
  };

  const firmarYEntregar = async () => {
    if (enviandoChecklist || firmandoDueno) return;
    if (!firmaSvg) {
      showAlert("Falta la firma del arrendatario", "Pídele que firme en el recuadro antes de continuar.");
      return;
    }
    let metodo = biometriaDueno;
    const extra = {};
    if (biometriaDueno) {
      const ok = await autenticarParaFirmar("Confirma con tu huella que entregas el auto");
      if (!ok) {
        showAlert("No se confirmó tu firma", "Vuelve a intentarlo con tu huella para entregar el auto.");
        return;
      }
    } else {
      if (!firmaDuenoSvg) {
        showAlert("Falta tu firma", "Tu teléfono no tiene huella configurada: firma a mano en tu recuadro.");
        return;
      }
      metodo = "escrita";
      extra.firma_svg = firmaDuenoSvg;
    }
    setFirmandoDueno(true);
    try {
      await ApiClient.firmarContrato(reservaIdActiva, { metodo, acepta_terminos: true, ...extra });
    } catch (error) {
      hapticoError();
      showAlert("No se pudo registrar tu firma", msjError(error, "Intenta de nuevo en unos segundos."));
      return;
    } finally {
      setFirmandoDueno(false);
    }
    await enviarChecklist();
  };

  const enviarChecklist = async (notasExtra) => {
    if (enviandoChecklist) return;
    setEnviandoChecklist(true);
    try {
      // Último intento de lo que haya quedado sin subir antes de mandar el
      // checklist — la mayoría de las veces ya subió sola en el trayecto
      // hasta acá (el useEffect de AppState reintenta cada vez que el
      // teléfono vuelve a primer plano).
      const urls = await Promise.all(
        colaFotos.map((item, idx) =>
          item.estado === "subida" ? item.url : subirUnaFoto(idx, item.uriLocal)
        )
      );
      const urlsListas = urls.filter(Boolean);

      if (colaFotos.length > 0 && urlsListas.length < colaFotos.length) {
        const faltan = colaFotos.length - urlsListas.length;
        showAlert(
          "Todavía sin conexión",
          `${faltan} foto${faltan === 1 ? "" : "s"} no se ${faltan === 1 ? "ha" : "han"} podido subir. ` +
            "No se perdieron — quedan guardadas en el teléfono y se reintentan solas. Vuelve a enviar cuando recuperes señal."
        );
        return;
      }

      const resultado = await ApiClient.registrarChecklist(reservaIdActiva, {
        tipo,
        fotos: urlsListas.length > 0 ? urlsListas : ["sin-foto"],
        kilometraje: parseInt(km.replace(/\D/g, ""), 10) || 0,
        nivel_combustible: FUEL_SYMBOL_TO_VALUE[fuelLevel] || "3/4",
        notas: notasExtra || undefined,
        firma_svg: tipo === "antes" ? firmaSvg || undefined : undefined,
        selfie_entrega_url: tipo === "antes" ? selfieEntregaUrl || undefined : undefined,
      });
      setResultadoChecklist(resultado);
      borrarColaFotos(reservaIdActiva, tipo);
      hapticoExito();
      setStage(tipo === "antes" ? "24_signed" : "28_done");
    } catch (error) {
      hapticoError();
      showAlert("No se pudo registrar el checklist", msjError(error, "Intenta de nuevo en unos segundos."));
    } finally {
      setEnviandoChecklist(false);
    }
  };

  const handleCalificarCliente = async () => {
    if (enviandoCalificacion || !puntajeCliente || !reserva?.cliente_id) return;
    setEnviandoCalificacion(true);
    try {
      await ApiClient.crearCalificacion({
        reserva_id: reservaIdActiva,
        autor_rol: "dueno",
        destinatario_id: reserva.cliente_id,
        puntaje: puntajeCliente,
        comentario: comentarioCliente.trim() || undefined,
      });
      setCalificacionEnviada(true);
    } catch (error) {
      showAlert("No se pudo enviar la calificación", msjError(error, "Intenta de nuevo en unos segundos."));
    } finally {
      setEnviandoCalificacion(false);
    }
  };

  // ---------------------------------------------------------------- helpers UI
  const Footer = ({ children }) => (
    <View className="px-4 pt-3 bg-surface border-t border-border gap-2" style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}>{children}</View>
  );

  const InfoRow = ({ label, value }) => (
    <View className="flex-row justify-between items-center gap-3">
      <Text className="text-sm text-textMuted">{label}</Text>
      <Text className="text-sm text-text font-medium flex-shrink text-right" numberOfLines={1}>{value}</Text>
    </View>
  );

  // Barra de avance de 3 pasos. Solo en la devolución — la entrega es un
  // trámite lineal más corto y con su propia firma al final.
  const StepBar = ({ activo }) => (
    <View className="px-4 pt-2 pb-3 bg-surface border-b border-border gap-1.5">
      <View className="flex-row gap-1.5">
        {PASOS.map((p, i) => (
          <View
            key={p}
            className={`flex-1 h-1 rounded-full ${
              i < activo ? "bg-primary" : i === activo ? "bg-accent" : "bg-border"
            }`}
          />
        ))}
      </View>
      <View className="flex-row justify-between">
        {PASOS.map((p, i) => (
          <Text
            key={p}
            className={`text-[11px] font-semibold flex-1 text-center ${
              i === activo ? "text-primary" : i < activo ? "text-accent-700" : "text-gray-400"
            }`}
          >
            {i + 1} {p}
          </Text>
        ))}
      </View>
    </View>
  );

  // ---------------------------------------------------------------- cámara
  // Chrome claro y translúcido en vez del negro sólido de antes: el registro
  // de los 8 ángulos se hace de pie junto al auto, muchas veces a contraluz,
  // y el fondo oscuro competía con la escena. Ahora el texto va oscuro sobre
  // vidrio blanco, la caja guía y el obturador en el teal de marca.
  const renderCamara = ({ titulo, nota, onCloseBtn, onCounterPress }) => (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <View className="px-4 pb-3 gap-3 bg-surface border-b border-border" style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={onCloseBtn} hitSlop={theme.control.hitSlop}>
            <Icon name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-[15px] font-bold text-text flex-1 mx-3">{titulo}</Text>
          <Text className="text-sm text-primary font-bold">{fotos.length}/{ANGLES.length}</Text>
        </View>
        <View className="flex-row gap-1.5">
          {ANGLES.map((_, idx) => (
            <View
              key={idx}
              className={`flex-1 h-1 rounded-full ${
                idx < fotos.length ? "bg-accent" : idx === currentAngleIdx ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}>
          {ANGLES.map((a, idx) => {
            const past = idx < fotos.length;
            const curr = idx === currentAngleIdx;
            return (
              <TouchableOpacity
                key={a.id}
                onPress={() => setCurrentAngleIdx(idx)}
                className={`py-1.5 px-3 rounded-full ${
                  past ? "bg-accent-100" : curr ? "bg-primary" : "bg-surface-secondary"
                }`}
              >
                <Text
                  className={`text-[13px] ${
                    past ? "text-accent-700 font-semibold" : curr ? "text-white font-semibold" : "text-textMuted"
                  }`}
                >
                  {past ? `✓ ${a.name}` : a.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View className="flex-1 bg-surface-secondary items-center justify-center overflow-hidden">
        {fotos[currentAngleIdx] ? (
          <Image source={{ uri: fotos[currentAngleIdx] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : cameraPermission?.granted ? (
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" {...zoomProps} />
            <View className="absolute top-6 bottom-6 left-5 right-5 border-2 border-primary-300 border-dashed rounded-2xl" pointerEvents="none" />
            <View className="absolute bottom-3.5 self-center flex-row gap-2 bg-[#061e1f]/60 rounded-full p-1">
              {lenteUltraWide && (
                <TouchableOpacity
                  className={`w-9 h-9 rounded-full items-center justify-center ${nivelZoom === "0.5x" ? "bg-accent" : ""}`}
                  onPress={() => setNivelZoom("0.5x")}
                  accessibilityRole="button"
                  accessibilityLabel="Zoom gran angular 0.5x"
                >
                  <Text className={`text-[12.5px] font-bold ${nivelZoom === "0.5x" ? "text-text" : "text-white"}`}>0.5x</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className={`w-9 h-9 rounded-full items-center justify-center ${nivelZoom === "1x" ? "bg-accent" : ""}`}
                onPress={() => setNivelZoom("1x")}
                accessibilityRole="button"
                accessibilityLabel="Zoom normal 1x"
              >
                <Text className={`text-[12.5px] font-bold ${nivelZoom === "1x" ? "text-text" : "text-white"}`}>1x</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`w-9 h-9 rounded-full items-center justify-center ${nivelZoom === "2x" ? "bg-accent" : ""}`}
                onPress={() => setNivelZoom("2x")}
                accessibilityRole="button"
                accessibilityLabel="Zoom acercado 2x"
              >
                <Text className={`text-[12.5px] font-bold ${nivelZoom === "2x" ? "text-text" : "text-white"}`}>2x</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View className="p-6 items-center justify-center gap-2 bg-white/95 rounded-2xl mx-6 border border-border">
            <Icon name="camera" size={34} color={colors.primary} />
            <Text className="text-base font-bold text-text">Cámara inactiva</Text>
            <Text className="text-[13px] text-textMuted text-center leading-[18px]">
              Habilita la cámara para ver y encuadrar el vehículo en vivo.
            </Text>
            <TouchableOpacity className="mt-1.5 bg-primary px-5 py-2.5 rounded-xl" onPress={requestCameraPermission}>
              <Text className="text-white font-bold text-sm">Habilitar cámara</Text>
            </TouchableOpacity>
          </View>
        )}
        <View className="absolute top-[22px] bg-white/90 py-2.5 px-4 rounded-xl border border-border">
          <Text className="text-text text-[15px] font-semibold">{angle.desc}</Text>
        </View>
      </View>

      <View className="px-6 pt-4 bg-surface border-t border-border gap-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            className="w-[52px] h-[52px] rounded-xl bg-primary-100 border-[1.5px] border-primary-200 items-center justify-center"
            onPress={handleElegirGaleria}
            disabled={subiendoFoto}
            accessibilityRole="button"
            accessibilityLabel="Elegir foto de la galería"
          >
            <Icon name="image" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="btn-tomar-foto"
            className="w-[72px] h-[72px] rounded-full bg-primary items-center justify-center"
            onPress={handleTomarFoto}
            disabled={subiendoFoto}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Tomar foto"
          >
            {subiendoFoto ? <ActivityIndicator color="#FFFFFF" /> : <View className="w-[60px] h-[60px] rounded-full border-[3px] border-white" />}
          </TouchableOpacity>
          <TouchableOpacity
            className="w-[52px] h-[52px] rounded-xl bg-accent-100 items-center justify-center"
            onPress={onCounterPress}
            accessibilityRole="button"
            accessibilityLabel={`Ver las ${fotos.length} fotos tomadas`}
          >
            <Text className="text-sm font-extrabold text-accent-700">{fotos.length}</Text>
          </TouchableOpacity>
        </View>
        <View className="items-center gap-1">
          <Text className="text-[13px] text-textMuted text-center">{nota}</Text>
          <TouchableOpacity
            onPress={() => setCurrentAngleIdx(Math.min(ANGLES.length - 1, currentAngleIdx + 1))}
            hitSlop={theme.control.hitSlop}
          >
            <Text className="text-[13px] font-bold text-accent-700">Saltar este ángulo →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {flashExito ? (
        <SuccessFlash label={flashExito} onDone={() => setFlashExito(null)} />
      ) : null}
    </View>
  );

  // ================================================================ STAGES

  if (stage === "05_code") {
    return (
      <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title={tipo === "antes" ? "Verificar entrega" : "Verificar devolución"} onBack={onBack} />
        {esDevolucion ? <StepBar activo={0} /> : null}
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View className="flex-row gap-2 bg-primary-100 rounded-xl p-4">
            <Icon name="shield" size={18} color={colors.primary} />
            <Text className="flex-1 text-sm leading-5 text-primary">
              Escanea el código QR que el cliente muestra en su celular para validar su identidad. Si
              hay poca luz, escríbelo a mano.
            </Text>
          </View>

          {auto?.marca ? (
            <Card padded style={{ gap: theme.spacing.sm }}>
              <Text className="text-[15px] font-bold text-text">{auto.marca} {auto.modelo} {auto.anio}</Text>
              <InfoRow label="Patente" value={auto.patente} />
              <InfoRow label="Lugar acordado" value={reserva?.lugar_entrega_acordado} />
            </Card>
          ) : null}

          <Button
            testID="btn-escanear-qr"
            label="Escanear QR del cliente"
            iconLeft="camera"
            onPress={() => setScanQR(true)}
            loading={validando}
          />

          <View style={{ gap: 6 }}>
            <SectionLabel>¿Sin cámara? Escribe el código</SectionLabel>
            <TextInput
              testID="input-codigo-entrega"
              className="min-h-[48px] border-[1.5px] border-border rounded-xl bg-surface px-4 py-3.5 text-[15px] text-text"
              value={codigoInput}
              onChangeText={setCodigoInput}
              placeholder="Código mostrado en el celular del cliente"
              placeholderTextColor={colors.textPlaceholder}
              autoCapitalize="none"
              onSubmitEditing={() => handleValidarCodigo()}
              returnKeyType="go"
            />
          </View>
        </ScrollView>
        <Footer>
          <Button
            testID="btn-validar-codigo"
            label="Validar código escrito"
            variant="secondary"
            onPress={() => handleValidarCodigo()}
            loading={validando}
            disabled={!codigoInput.trim()}
          />
        </Footer>

        <QRScannerModal
          visible={scanQR}
          titulo={tipo === "antes" ? "Escanear código de entrega" : "Escanear código de devolución"}
          onClose={() => setScanQR(false)}
          onLeido={(data) => {
            setScanQR(false);
            setCodigoInput(data);
            handleValidarCodigo(data);
          }}
        />
      </KeyboardAvoidingView>
    );
  }

  if (stage === "06_confirm" && datosValidados) {
    return (
      <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Confirmar identidad" onBack={() => setStage("05_code")} />
        {esDevolucion ? <StepBar activo={0} /> : null}
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center gap-1.5 self-start bg-accent-100 py-1.5 px-3 rounded-full">
            <Icon name="check" size={15} color={colors.accentDark} />
            <Text className="text-[13px] font-bold text-accent-700">Código verificado</Text>
          </View>

          {datosValidados.foto_perfil_verificada_url ? (
            <Image source={{ uri: datosValidados.foto_perfil_verificada_url }} className="w-24 h-24 rounded-full self-center" />
          ) : null}

          <Card padded style={{ gap: theme.spacing.sm }}>
            <Text className="text-[15px] font-bold text-text">{datosValidados.cliente_nombre}</Text>
            <InfoRow
              label="Vehículo"
              value={`${datosValidados.auto_marca} ${datosValidados.auto_modelo} · ${datosValidados.auto_patente}`}
            />
            <InfoRow label="Lugar" value={datosValidados.lugar_entrega_acordado} />
          </Card>

          {/* Segundo Conductor Verificado */}
          {datosValidados.segundo_conductor ? (
            <Card padded style={{ gap: theme.spacing.sm, borderColor: colors.primary, borderWidth: 1 }}>
              <View className="flex-row justify-between items-center">
                <Text className="text-sm font-bold text-text">
                  Segundo conductor autorizado
                </Text>
                <Badge label="KYC verificado" variant="success" />
              </View>
              {datosValidados.segundo_conductor.foto_perfil_url ? (
                <Image
                  source={{ uri: datosValidados.segundo_conductor.foto_perfil_url }}
                  className="w-24 self-center"
                  style={{ height: 100, borderRadius: 12, marginVertical: 6 }}
                />
              ) : null}
              <InfoRow label="Nombre" value={datosValidados.segundo_conductor.nombre} />
              <InfoRow
                label="Documento"
                value={datosValidados.segundo_conductor.rut || datosValidados.segundo_conductor.numero_documento || "—"}
              />
              <InfoRow
                label="Licencia"
                value={`${datosValidados.segundo_conductor.licencia_clase || "B"} · ${datosValidados.segundo_conductor.licencia_numero || "—"}`}
              />
            </Card>
          ) : null}

          <Text className="text-sm text-textMuted leading-5">
            Compara el rostro del conductor titular (y segundo conductor si aplica) con las fotos verificadas.
          </Text>

          <View style={{ gap: 6 }}>
            <SectionLabel>Motivo del rechazo (si no coincide)</SectionLabel>
            <TextInput
              className="min-h-[90px] border-[1.5px] border-border rounded-xl bg-surface px-4 py-3.5 text-[15px] text-text"
              style={{ textAlignVertical: "top" }}
              value={motivoRechazo}
              onChangeText={setMotivoRechazo}
              placeholder="ej. La persona no coincide con la foto del carnet"
              placeholderTextColor={colors.textPlaceholder}
              multiline
            />
          </View>
        </ScrollView>
        <Footer>
          <Button label="Confirmar identidad" onPress={handleConfirmarIdentidad} loading={confirmando} />
          <Button variant="danger" label="No coincide" onPress={handleRechazarIdentidad} disabled={confirmando} />
        </Footer>

        {flashExito ? (
          <SuccessFlash label={flashExito} onDone={() => setFlashExito(null)} />
        ) : null}
      </KeyboardAvoidingView>
    );
  }

  if (stage === "20_camera") {
    return renderCamara({
      titulo: `Entrega · ${auto.marca || ""} ${auto.modelo || ""}`,
      nota: `Mínimo 1 foto para continuar · llevas ${fotos.length} de ${ANGLES.length}`,
      onCloseBtn: onBack,
      onCounterPress: () => setStage("21_review"),
    });
  }

  if (stage === "25_return_cam") {
    return renderCamara({
      titulo: `Devolución · ${auto.marca || ""} ${auto.modelo || ""}`,
      nota: `Repite el mismo ángulo de la entrega · ${fotos.length} de ${ANGLES.length}`,
      onCloseBtn: onBack,
      onCounterPress: irAMetricas,
    });
  }

  if (stage === "21_review") {
    return (
      <View className="flex-1 bg-background">
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title={`Revisa las fotos (${fotos.length})`} onBack={() => setStage("20_camera")} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {fotos.length === 0 && (
            <View className="flex-row gap-2 bg-warning-bg border border-warning-border rounded-xl p-4">
              <Icon name="warning" size={18} color={colors.warning} />
              <Text className="flex-1 text-sm leading-5 text-warning-text">
                Todavía no tomaste ninguna foto. Vuelve atrás y toma al menos una.
              </Text>
            </View>
          )}
          <View className="flex-row flex-wrap gap-3">
            {colaFotos.map((item, idx) => (
              <View key={item.uriLocal + idx} className="w-[47%] rounded-xl overflow-hidden border border-border bg-surface">
                <Image source={{ uri: item.uriLocal }} className="h-[84px] w-full bg-surface-secondary" />
                <View className="p-2 flex-row justify-between items-center gap-1.5">
                  <Text className="text-[13px] text-text flex-1" numberOfLines={1}>{ANGLES[idx]?.name || `Foto ${idx + 1}`}</Text>
                  {item.estado === "subida" ? (
                    <Icon name="check" size={13} color={colors.accent} />
                  ) : item.estado === "subiendo" ? (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  ) : (
                    // "error": la foto sigue ahí (nunca se perdió), solo
                    // falta que suba. Tocar el ícono reintenta al toque, sin
                    // esperar a que vuelva sola con la señal.
                    <TouchableOpacity
                      onPress={() => subirUnaFoto(idx, item.uriLocal)}
                      hitSlop={theme.control.hitSlop}
                      accessibilityRole="button"
                      accessibilityLabel="Reintentar subida"
                    >
                      <Icon name="alert" size={13} color={colors.warning} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
        <Footer>
          <Button testID="btn-continuar-fotos" label="Continuar" onPress={irAMetricas} disabled={fotos.length === 0} />
        </Footer>
      </View>
    );
  }

  if (stage === "22_metrics") {
    return (
      <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader
          title="Kilometraje y combustible"
          onBack={() => setStage(tipo === "antes" ? "21_review" : "25_return_cam")}
        />
        {esDevolucion ? <StepBar activo={1} /> : null}
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6 }}>
            <SectionLabel>Kilometraje actual</SectionLabel>
            <View className="h-[48px] border-[1.5px] border-primary-200 rounded-xl bg-surface flex-row items-center px-4 gap-2">
              <TextInput
                testID="input-km"
                className="flex-1 text-lg font-bold text-text"
                value={formatearMilesEnVivo(km)}
                onChangeText={(t) => setKm(t.replace(/\D/g, ""))}
                keyboardType="numeric"
                placeholder="48320"
                placeholderTextColor={colors.textPlaceholder}
              />
              <Text className="text-base text-textMuted font-medium">km</Text>
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <SectionLabel>Nivel de combustible</SectionLabel>
            <View className="flex-row gap-1.5">
              {FUEL_LEVELS.map((level) => {
                const sel = fuelLevel === level;
                return (
                  <TouchableOpacity
                    key={level}
                    className={`flex-1 h-[58px] border-[1.5px] rounded-xl items-center justify-center gap-0.5 ${
                      sel ? "bg-primary border-primary" : "border-border bg-surface"
                    }`}
                    onPress={() => setFuelLevel(level)}
                  >
                    <Text className={`text-base font-semibold ${sel ? "text-white" : "text-textMuted"}`}>{level}</Text>
                    {level === "E" && <Text className={`text-[10px] ${sel ? "text-accent-300" : "text-textMuted"}`}>vacío</Text>}
                    {level === "F" && <Text className={`text-[10px] ${sel ? "text-accent-300" : "text-textMuted"}`}>lleno</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
        <Footer>
          <Button
            testID="btn-continuar-metrics"
            label={
              tipo === "despues" ? "Ver la revisión" : "Ir a la firma del contrato"
            }
            onPress={handleContinuarMetricas}
            loading={enviandoChecklist}
          />
        </Footer>
      </KeyboardAvoidingView>
    );
  }

  if (stage === "23_signature") {
    return (
      <View className="flex-1 bg-background">
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Firma del contrato" onBack={() => setStage("22_metrics")} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <View className="flex-row gap-2 bg-primary-100 rounded-xl p-4">
            <Icon name="shield" size={18} color={colors.primary} />
            <Text className="flex-1 text-sm leading-5 text-primary">
              Las fotos quedaron registradas. Ahora firman los dos: primero{" "}
              <Text style={{ fontWeight: "700" }}>{datosValidados?.cliente_nombre || "el arrendatario"}</Text> (pásale el
              teléfono) y al final tú, con tu huella.
            </Text>
          </View>

          <Card padded style={{ gap: theme.spacing.sm }}>
            <Text className="text-[15px] font-bold text-text">Contrato de arriendo · {auto.patente}</Text>
            <InfoRow label="Kilometraje de salida" value={`${formatearMilesEnVivo(km)} km`} />
            <InfoRow label="Garantía retenida" value={`$${formatCLP(reserva?.monto_hold)}`} />
          </Card>

          <View>
            <SectionLabel>Firma del arrendatario</SectionLabel>
            <SignaturePad onChange={setFirmaSvg} />
          </View>

          <TouchableOpacity
            className="h-[230px] bg-primary-800 rounded-2xl items-center justify-center p-4 gap-3"
            onPress={() => setMostrarSelfieEntrega(true)}
            activeOpacity={0.85}
            disabled={subiendoSelfieEntrega}
          >
            <View className="w-[104px] h-[104px] rounded-full border-2 border-[rgba(146,227,203,0.7)] border-dashed items-center justify-center bg-primary-900 overflow-hidden">
              {selfieEntregaUrl ? (
                <Image source={{ uri: selfieEntregaUrl }} className="w-full h-full" />
              ) : (
                <Icon name="user" size={44} color="rgba(146,227,203,0.7)" />
              )}
            </View>
            <Text className="text-base font-semibold text-white">
              {subiendoSelfieEntrega
                ? "Subiendo selfie…"
                : selfieEntregaUrl
                ? "Selfie capturada ✓ (toca para repetir)"
                : "Toca para tomar tu selfie"}
            </Text>
            <Text className="text-[13px] text-accent-300 text-center max-w-[240px] leading-[18px]">Se compara con la foto de tu cédula verificada al registrarte.</Text>
          </TouchableOpacity>

          {biometriaDueno === null ? (
            <View>
              <SectionLabel>Tu firma (dueño)</SectionLabel>
              <SignaturePad onChange={setFirmaDuenoSvg} />
            </View>
          ) : (
            <View className="flex-row items-center gap-2 bg-slate-50 rounded-xl p-3 border border-border">
              <Icon name="shield" size={16} color={colors.primary} />
              <Text className="flex-1 text-[13px] text-textMuted leading-[18px]">
                Al final firmas tú: te pediremos tu huella para confirmar la entrega.
              </Text>
            </View>
          )}
        </ScrollView>
        <Footer>
          <Button
            testID="btn-firmar-entregar"
            label={biometriaDueno ? "Firmar con mi huella y entregar" : "Firmar y entregar las llaves"}
            onPress={firmarYEntregar}
            loading={enviandoChecklist || firmandoDueno}
            disabled={!firmaSvg || (biometriaDueno === null && !firmaDuenoSvg)}
          />
          <Text className="text-xs text-textMuted text-center">Al firmar, ambos aceptan el contrato y el estado del auto registrado en las fotos.</Text>
        </Footer>

        <SelfieLivenessModal
          visible={mostrarSelfieEntrega}
          onClose={() => setMostrarSelfieEntrega(false)}
          onCaptured={async ({ frontalUri }) => {
            setMostrarSelfieEntrega(false);
            if (!frontalUri) return;
            setSubiendoSelfieEntrega(true);
            try {
              const url = await subirImagenOptimizada(frontalUri, {
                filename: `selfie-entrega-${Date.now()}.jpg`,
                bucket: "checklists",
              });
              setSelfieEntregaUrl(url);
            } catch (err) {
              showAlert("No se pudo subir la selfie", msjError(err, "Intenta de nuevo."));
            } finally {
              setSubiendoSelfieEntrega(false);
            }
          }}
        />
      </View>
    );
  }

  if (stage === "24_signed") {
    return (
      <View className="flex-1 bg-background">
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={{ padding: 32, alignItems: "center", gap: 16 }} showsVerticalScrollIndicator={false}>
          <SuccessCheck className="mt-2" />
          <View className="items-center gap-2">
            <Text className="text-xl font-bold text-text text-center">Contrato firmado</Text>
            <Text className="text-[15px] text-textMuted leading-[22px] text-center">
              El arriendo está en curso. Devolución acordada para el{" "}
              {reserva?.fecha_fin ? new Date(reserva.fecha_fin).toLocaleDateString("es-CL") : "—"}.
            </Text>
          </View>
          <Card padded style={{ width: "100%", gap: theme.spacing.md }}>
            <InfoRow label="Reserva" value={(reservaIdActiva || "").slice(0, 8).toUpperCase()} />
            <InfoRow label="Registro fotográfico" value={`${fotos.length} fotos`} />
            <View className="h-[1px] bg-border" />
            <InfoRow label="Garantía" value={`$${formatCLP(reserva?.monto_hold)} retenidos`} />
          </Card>
        </ScrollView>
        <Footer>
          <Button label="Listo" onPress={onCompleteDelivery} />
        </Footer>
      </View>
    );
  }

  if (stage === "26_review") {
    return (
      <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader
          title="Revisión de devolución"
          onBack={() => (mostrarDano ? setMostrarDano(false) : setStage("22_metrics"))}
        />
        <StepBar activo={1} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View className="flex-row flex-wrap gap-3">
            {colaFotos.map((item, idx) => (
              <View key={item.uriLocal + idx} className="w-[22%] aspect-square rounded-lg overflow-hidden bg-surface-secondary">
                <Image source={{ uri: item.uriLocal }} className="w-full h-full" />
              </View>
            ))}
          </View>

          <Card padded style={{ gap: 0 }}>
            <View className="flex-row justify-between items-center py-2.5 border-b border-border">
              <Text className="text-sm text-textMuted">Kilometraje</Text>
              <Text className="text-sm font-semibold text-text">{formatearMilesEnVivo(km)} km</Text>
            </View>
            <View className="flex-row justify-between items-center py-2.5 border-b border-border">
              <Text className="text-sm text-textMuted">Combustible</Text>
              <Text className="text-sm font-semibold text-text">{fuelLevel}</Text>
            </View>
            <View className="flex-row justify-between items-center py-2.5">
              <Text className="text-sm text-textMuted">Fotos de devolución</Text>
              <Text className="text-sm font-semibold text-text">{fotos.length} de {ANGLES.length}</Text>
            </View>
          </Card>

          {/* Tarjeta de Peritaje Asistido por IA (Computer Vision) */}
          <Card padded className="gap-2 border-[1.5px] border-primary bg-surface">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Icon name="sparkles" size={18} color={colors.primary} />
                <Text className="text-sm font-bold text-text">Peritaje Asistido por IA</Text>
              </View>
              {cargandoIA ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Badge
                  variant={analisisIA?.anomalia_detectada ? "warning" : "success"}
                  label={analisisIA?.anomalia_detectada ? "Posible diferencia" : "Sin novedades"}
                />
              )}
            </View>

            {cargandoIA && (
              <Text className="text-[13px] text-textMuted italic py-1">Analizando fotografías con Computer Vision...</Text>
            )}

            {analisisIA && (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Text className="text-xs font-semibold text-textMuted">Probabilidades estimadas por visión:</Text>

                <View className="gap-1.5 py-0.5">
                  {CATEGORIAS_IA.map((a) => ({ ...a, pct: analisisIA.probabilidades?.[a.clave] || 0 })).map((item) => (
                    <View key={item.label} className="flex-row items-center gap-2">
                      <Text className="w-[68px] text-xs text-text font-medium">{item.label}</Text>
                      <View className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                        <View
                          className="h-full rounded"
                          style={{
                            width: `${Math.max(item.pct, 3)}%`,
                            backgroundColor: item.pct >= 70 ? colors.warning : item.pct >= 30 ? colors.primary : colors.accent300,
                          }}
                        />
                      </View>
                      <Text className={`w-9 text-xs font-semibold text-right ${item.pct >= 70 ? "text-warning font-bold" : "text-text"}`}>
                        {item.pct}%
                      </Text>
                    </View>
                  ))}
                </View>

                <Text className="text-[12.5px] text-textMuted leading-[18px] mt-0.5">{analisisIA.sugerencia_dueno}</Text>

                {analisisIA.anomalia_detectada && !mostrarDano && (
                  <Button
                    variant="secondary"
                    size="sm"
                    label="✦ Cargar sugerencia de la IA"
                    onPress={() => {
                      setMostrarDano(true);
                      const primerDano = analisisIA.danos_detectados?.[0];
                      if (primerDano) {
                        setDamageType(
                          primerDano.tipo.includes("Rayón")
                            ? "Rayón"
                            : primerDano.tipo.includes("Golpe") || primerDano.tipo.includes("Abolladura")
                            ? "Golpe"
                            : "Otro"
                        );
                        setDamageDesc(primerDano.descripcion);
                      }
                    }}
                  />
                )}
              </View>
            )}
          </Card>

          {mostrarDano ? (
            <>
              <View style={{ gap: theme.spacing.sm }}>
                <SectionLabel>Tipo de diferencia</SectionLabel>
                <View className="flex-row flex-wrap gap-2">
                  {TIPOS_DANO.map((t) => (
                    <Chip key={t} label={t} selected={damageType === t} onPress={() => setDamageType(t)} />
                  ))}
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <SectionLabel>Qué pasó</SectionLabel>
                <TextInput
                  className="min-h-[90px] border-[1.5px] border-border rounded-xl bg-surface px-4 py-3.5 text-[15px] text-text"
                  style={{ textAlignVertical: "top" }}
                  value={damageDesc}
                  onChangeText={setDamageDesc}
                  placeholder="Describe la diferencia encontrada"
                  placeholderTextColor={colors.textPlaceholder}
                  multiline
                />
              </View>

              <View className="w-full bg-warning-bg border border-warning-border rounded-xl p-4 gap-1">
                <Text className="text-sm font-bold text-warning-text">La garantía sigue retenida</Text>
                <Text className="flex-1 text-sm leading-5 text-warning-text">
                  Se abre una disputa con estas {fotos.length} fotos como evidencia. Soporte revisa y define
                  cuánto se transfiere para la reparación. No es un cobro directo.
                </Text>
              </View>
            </>
          ) : null}
        </ScrollView>
        <Footer>
          {mostrarDano ? (
            <>
              <Button
                variant="danger"
                label="Enviar reporte y cerrar"
                onPress={() => enviarChecklist(`[${damageType}] ${damageDesc}`.trim())}
                loading={enviandoChecklist}
              />
              <Button variant="ghost" size="sm" label="Cancelar" onPress={() => setMostrarDano(false)} />
            </>
          ) : (
            <>
              <Button label="Todo en orden, cerrar arriendo" onPress={() => enviarChecklist()} loading={enviandoChecklist} />
              <Button variant="ghost" size="sm" label="Reportar una diferencia" onPress={() => setMostrarDano(true)} />
            </>
          )}
        </Footer>
      </KeyboardAvoidingView>
    );
  }

  if (stage === "28_done") {
    const r = resultadoChecklist || {};
    const enDisputa = r.estado_reserva === "disputada";
    return (
      <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <StatusBar barStyle="dark-content" />
        <StepBar activo={2} />
        <ScrollView contentContainerStyle={{ padding: 32, alignItems: "center", gap: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {enDisputa ? (
            <View className="w-16 h-16 rounded-full bg-warning-bg items-center justify-center mt-2">
              <Icon name="alert" size={30} color={colors.warning} />
            </View>
          ) : (
            <SuccessCheck className="mt-2" />
          )}
          <View className="items-center gap-2">
            <Text className="text-xl font-bold text-text text-center">{enDisputa ? "Devolución con diferencia" : "Devolución confirmada"}</Text>
            <Text className="text-[15px] text-textMuted leading-[22px] text-center">
              {enDisputa
                ? "El arriendo se cierra, pero la garantía queda en revisión de soporte."
                : "El arriendo quedó cerrado y liquidado."}
            </Text>
          </View>

          {enDisputa ? (
            <View className="w-full bg-warning-bg border border-warning-border rounded-xl p-4 gap-1">
              <Text className="text-sm font-bold text-warning-text">Garantía retenida · en revisión</Text>
              <Text className="flex-1 text-sm leading-5 text-warning-text">
                Soporte compara las fotos de entrega y devolución y define cuánto se transfiere para la
                reparación antes de liquidar.
              </Text>
            </View>
          ) : null}

          <Card padded style={{ width: "100%", gap: theme.spacing.md }}>
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-textMuted">Liquidación para ti</Text>
              <Badge variant={enDisputa ? "neutral" : "success"} label={enDisputa ? "En pausa por disputa" : "Depósito automático directo"} />
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-textMuted">Monto a transferir</Text>
              <Text className="text-base font-extrabold text-text">${formatCLP(r.liquidacion_dueno)}</Text>
            </View>
            {r.cargo_limpieza > 0 && <InfoRow label="Cargo limpieza" value={`$${formatCLP(r.cargo_limpieza)}`} />}
            {r.cargo_combustible > 0 && <InfoRow label="Cargo combustible" value={`$${formatCLP(r.cargo_combustible)}`} />}
            {r.cargo_km_extra > 0 && <InfoRow label="Cargo km extra" value={`$${formatCLP(r.cargo_km_extra)}`} />}
            <Text className="text-xs text-textMuted leading-[17px] border-t border-border pt-2">
              {enDisputa
                ? "La garantía y liquidación quedan en pausa hasta que soporte resuelva la disputa."
                : "El dinero se transfiere de forma automática a tu cuenta bancaria registrada."}
            </Text>
          </Card>

          {reserva?.cliente_id && (
            <Card padded style={{ width: "100%", gap: theme.spacing.md, alignItems: "center" }}>
              {calificacionEnviada ? (
                <Text className="text-sm font-semibold text-success">¡Gracias por calificar al cliente!</Text>
              ) : (
                <>
                  <Text className="text-[15px] font-semibold text-text text-center">¿Cómo fue tu experiencia con el cliente?</Text>
                  <View className="flex-row gap-1.5">
                    {PUNTAJES_CALIFICACION.map((n) => (
                      <TouchableOpacity key={n} onPress={() => setPuntajeCliente(n)} hitSlop={theme.control.hitSlop}>
                        <Icon name="star" size={30} color={n <= puntajeCliente ? colors.warning : colors.border} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    className="min-h-[48px] border-[1.5px] border-border rounded-xl bg-surface px-4 py-3.5 text-[15px] text-text self-stretch"
                    placeholder="Comentario opcional"
                    placeholderTextColor={colors.textPlaceholder}
                    value={comentarioCliente}
                    onChangeText={setComentarioCliente}
                  />
                  <Button
                    label="Enviar calificación"
                    onPress={handleCalificarCliente}
                    loading={enviandoCalificacion}
                    disabled={!puntajeCliente}
                  />
                </>
              )}
            </Card>
          )}
        </ScrollView>
        <Footer>
          <Button
            label={enDisputa ? "Ver la disputa" : "Listo"}
            onPress={enDisputa && onOpenDisputes ? onOpenDisputes : onCompleteDelivery}
          />
        </Footer>
      </KeyboardAvoidingView>
    );
  }

  return null;
}

