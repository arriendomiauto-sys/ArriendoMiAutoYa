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
import { hapticoExito, hapticoError } from "../utils/haptics";
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
import { styles } from "./DeliveryScreen.styles";

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
    cameraRef.current
      ?.getAvailableLensesAsync?.()
      .then((lentes) => {
        const ultraWide = (lentes || []).find((l) => /ultrawide/i.test(l));
        setLenteUltraWide(ultraWide || null);
      })
      .catch(() => {});
  }, [cameraPermission?.granted]);
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

  // Si el cliente ya firmó el contrato antes (digitalmente, por biometría o al reservar),
  // no se le vuelve a pedir la firma en la entrega:
  const clienteYaFirmo = Boolean(
    datosValidados?.arrendatario_ya_firmo ||
    reserva?.fecha_firma_biometrica ||
    (reserva?.firmas || []).some((f) => f.rol === "arrendatario")
  );

  // Calificación al cliente
  const [puntajeCliente, setPuntajeCliente] = useState(0);
  const [comentarioCliente, setComentarioCliente] = useState("");
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);
  const [calificacionEnviada, setCalificacionEnviada] = useState(false);

  const angle = ANGLES[currentAngleIdx] || ANGLES[0];

  // ---------------------------------------------------------------- handlers
  const handleValidarCodigo = async (codigoDirecto) => {
    // El escáner pasa el string leído directo; el botón manual usa el input.
    const codigo = (typeof codigoDirecto === "string" ? codigoDirecto : codigoInput).trim();
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
  const subirUnaFoto = async (idx, uriLocal) => {
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
    }
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

  // Reintenta lo que quedó en "error" al volver del segundo plano — el
  // momento típico en que alguien recupera señal es justo al destrabar el
  // teléfono de nuevo, no mientras sigue con la pantalla apagada. También se
  // reintenta si la señal vuelve sin que la app haya pasado a background (ej.
  // WiFi que se recupera mientras se sigue mirando la pantalla).
  useEffect(() => {
    const reintentarPendientes = () => {
      colaFotos.forEach((item, idx) => {
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
  }, [colaFotos]);

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
    // Si el cliente ya firmó el contrato digitalmente, no se vuelve a pedir la firma:
    if (clienteYaFirmo) {
      enviarChecklist();
      return;
    }
    setStage("23_signature");
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
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>{children}</View>
  );

  const InfoRow = ({ label, value }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );

  // Barra de avance de 3 pasos. Solo en la devolución — la entrega es un
  // trámite lineal más corto y con su propia firma al final.
  const StepBar = ({ activo }) => (
    <View style={styles.stepWrap}>
      <View style={styles.stepSegs}>
        {PASOS.map((p, i) => (
          <View
            key={p}
            style={[
              styles.stepSeg,
              i < activo && styles.stepSegDone,
              i === activo && styles.stepSegNow,
            ]}
          />
        ))}
      </View>
      <View style={styles.stepLabels}>
        {PASOS.map((p, i) => (
          <Text
            key={p}
            style={[styles.stepLbl, i === activo && styles.stepLblNow, i < activo && styles.stepLblDone]}
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
    <View style={styles.camContainer}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.camTop, { paddingTop: insets.top + 8 }]}>
        <View style={styles.camHead}>
          <TouchableOpacity onPress={onCloseBtn} hitSlop={theme.control.hitSlop}>
            <Icon name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.camTitle}>{titulo}</Text>
          <Text style={styles.camFraction}>{fotos.length}/{ANGLES.length}</Text>
        </View>
        <View style={styles.camBars}>
          {ANGLES.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.camBar,
                idx < fotos.length ? styles.barDone : idx === currentAngleIdx ? styles.barActive : styles.barPending,
              ]}
            />
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.anglePills}>
          {ANGLES.map((a, idx) => {
            const past = idx < fotos.length;
            const curr = idx === currentAngleIdx;
            return (
              <TouchableOpacity
                key={a.id}
                onPress={() => setCurrentAngleIdx(idx)}
                style={[
                  styles.anglePill,
                  past && styles.pillPast,
                  curr && styles.pillCurr,
                  !past && !curr && styles.pillFuture,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    past && { color: colors.accentDark, fontWeight: "600" },
                    curr && { color: "#FFFFFF", fontWeight: "600" },
                    !past && !curr && { color: colors.textMuted },
                  ]}
                >
                  {past ? `✓ ${a.name}` : a.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.viewfinder}>
        {fotos[currentAngleIdx] ? (
          <Image source={{ uri: fotos[currentAngleIdx] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : cameraPermission?.granted ? (
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" {...zoomProps} />
            <View style={styles.guideBox} pointerEvents="none" />
            <View style={styles.zoomRow}>
              {lenteUltraWide && (
                <TouchableOpacity
                  style={[styles.zoomChip, nivelZoom === "0.5x" && styles.zoomChipActivo]}
                  onPress={() => setNivelZoom("0.5x")}
                  accessibilityRole="button"
                  accessibilityLabel="Zoom gran angular 0.5x"
                >
                  <Text style={[styles.zoomChipText, nivelZoom === "0.5x" && styles.zoomChipTextActivo]}>0.5x</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.zoomChip, nivelZoom === "1x" && styles.zoomChipActivo]}
                onPress={() => setNivelZoom("1x")}
                accessibilityRole="button"
                accessibilityLabel="Zoom normal 1x"
              >
                <Text style={[styles.zoomChipText, nivelZoom === "1x" && styles.zoomChipTextActivo]}>1x</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.zoomChip, nivelZoom === "2x" && styles.zoomChipActivo]}
                onPress={() => setNivelZoom("2x")}
                accessibilityRole="button"
                accessibilityLabel="Zoom acercado 2x"
              >
                <Text style={[styles.zoomChipText, nivelZoom === "2x" && styles.zoomChipTextActivo]}>2x</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.camPermBox}>
            <Icon name="camera" size={34} color={colors.primary} />
            <Text style={styles.camPermTitle}>Cámara inactiva</Text>
            <Text style={styles.camPermDesc}>
              Habilita la cámara para ver y encuadrar el vehículo en vivo.
            </Text>
            <TouchableOpacity style={styles.camPermBtn} onPress={requestCameraPermission}>
              <Text style={styles.camPermBtnText}>Habilitar cámara</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.vfBadge}>
          <Text style={styles.vfBadgeText}>{angle.desc}</Text>
        </View>
      </View>

      <View style={[styles.camShutter, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <View style={styles.shutterRow}>
          <TouchableOpacity
            style={styles.galleryBtn}
            onPress={handleElegirGaleria}
            disabled={subiendoFoto}
            accessibilityRole="button"
            accessibilityLabel="Elegir foto de la galería"
          >
            <Icon name="image" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="btn-tomar-foto"
            style={styles.shutterBtn}
            onPress={handleTomarFoto}
            disabled={subiendoFoto}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Tomar foto"
          >
            {subiendoFoto ? <ActivityIndicator color="#FFFFFF" /> : <View style={styles.shutterInner} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.thumbCounter}
            onPress={onCounterPress}
            accessibilityRole="button"
            accessibilityLabel={`Ver las ${fotos.length} fotos tomadas`}
          >
            <Text style={styles.thumbCounterText}>{fotos.length}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text style={styles.camNote}>{nota}</Text>
          <TouchableOpacity
            onPress={() => setCurrentAngleIdx(Math.min(ANGLES.length - 1, currentAngleIdx + 1))}
            hitSlop={theme.control.hitSlop}
          >
            <Text style={styles.skipText}>Saltar este ángulo →</Text>
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
      <KeyboardAvoidingView style={styles.light} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title={tipo === "antes" ? "Verificar entrega" : "Verificar devolución"} onBack={onBack} />
        {esDevolucion ? <StepBar activo={0} /> : null}
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.noticeTeal}>
            <Icon name="shield" size={18} color={colors.primary} />
            <Text style={styles.noticeTealText}>
              Escanea el código QR que el cliente muestra en su celular para validar su identidad. Si
              hay poca luz, escríbelo a mano.
            </Text>
          </View>

          {auto?.marca ? (
            <Card padded style={{ gap: theme.spacing.sm }}>
              <Text style={styles.cardTitle}>{auto.marca} {auto.modelo} {auto.anio}</Text>
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
              style={styles.input}
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
      <KeyboardAvoidingView style={styles.light} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Confirmar identidad" onBack={() => setStage("05_code")} />
        {esDevolucion ? <StepBar activo={0} /> : null}
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.okRow}>
            <Icon name="check" size={15} color={colors.accentDark} />
            <Text style={styles.okRowText}>Código verificado</Text>
          </View>

          {datosValidados.foto_perfil_verificada_url ? (
            <Image source={{ uri: datosValidados.foto_perfil_verificada_url }} style={styles.perfilFoto} />
          ) : null}

          <Card padded style={{ gap: theme.spacing.sm }}>
            <Text style={styles.cardTitle}>{datosValidados.cliente_nombre}</Text>
            <InfoRow
              label="Vehículo"
              value={`${datosValidados.auto_marca} ${datosValidados.auto_modelo} · ${datosValidados.auto_patente}`}
            />
            <InfoRow label="Lugar" value={datosValidados.lugar_entrega_acordado} />
          </Card>

          {/* Segundo Conductor Verificado */}
          {datosValidados.segundo_conductor ? (
            <Card padded style={{ gap: theme.spacing.sm, borderColor: colors.primary, borderWidth: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[styles.cardTitle, { fontSize: 14 }]}>
                  Segundo conductor autorizado
                </Text>
                <Badge label="KYC verificado" variant="success" />
              </View>
              {datosValidados.segundo_conductor.foto_perfil_url ? (
                <Image
                  source={{ uri: datosValidados.segundo_conductor.foto_perfil_url }}
                  style={[styles.perfilFoto, { height: 100, borderRadius: 12, marginVertical: 6 }]}
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

          <Text style={styles.help}>
            Compara el rostro del conductor titular (y segundo conductor si aplica) con las fotos verificadas.
          </Text>

          <View style={{ gap: 6 }}>
            <SectionLabel>Motivo del rechazo (si no coincide)</SectionLabel>
            <TextInput
              style={[styles.input, styles.textarea]}
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
      <View style={styles.light}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title={`Revisa las fotos (${fotos.length})`} onBack={() => setStage("20_camera")} />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {fotos.length === 0 && (
            <View style={styles.noticeWarn}>
              <Icon name="warning" size={18} color={colors.warning} />
              <Text style={styles.noticeWarnText}>
                Todavía no tomaste ninguna foto. Vuelve atrás y toma al menos una.
              </Text>
            </View>
          )}
          <View style={styles.grid}>
            {colaFotos.map((item, idx) => (
              <View key={item.uriLocal + idx} style={styles.gridCard}>
                <Image source={{ uri: item.uriLocal }} style={styles.gridThumb} />
                <View style={styles.gridFoot}>
                  <Text style={styles.gridName} numberOfLines={1}>{ANGLES[idx]?.name || `Foto ${idx + 1}`}</Text>
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
      <KeyboardAvoidingView style={styles.light} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader
          title="Kilometraje y combustible"
          onBack={() => setStage(tipo === "antes" ? "21_review" : "25_return_cam")}
        />
        {esDevolucion ? <StepBar activo={1} /> : null}
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6 }}>
            <SectionLabel>Kilometraje actual</SectionLabel>
            <View style={styles.kmRow}>
              <TextInput
                testID="input-km"
                style={styles.kmInput}
                value={km}
                onChangeText={setKm}
                keyboardType="numeric"
                placeholder="48320"
                placeholderTextColor={colors.textPlaceholder}
              />
              <Text style={styles.kmSuffix}>km</Text>
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <SectionLabel>Nivel de combustible</SectionLabel>
            <View style={styles.fuelRow}>
              {FUEL_LEVELS.map((level) => {
                const sel = fuelLevel === level;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[styles.fuelBtn, sel && styles.fuelBtnActive]}
                    onPress={() => setFuelLevel(level)}
                  >
                    <Text style={[styles.fuelText, sel && { color: "#FFFFFF" }]}>{level}</Text>
                    {level === "E" && <Text style={[styles.fuelSub, sel && { color: colors.accent300 }]}>vacío</Text>}
                    {level === "F" && <Text style={[styles.fuelSub, sel && { color: colors.accent300 }]}>lleno</Text>}
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
              tipo === "despues"
                ? "Ver la revisión"
                : clienteYaFirmo
                ? "Confirmar y entregar llaves"
                : "Ir a la firma"
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
      <View style={styles.light}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Firma del contrato" onBack={() => setStage("22_metrics")} />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.noticeTeal}>
            <Icon name="shield" size={18} color={colors.primary} />
            <Text style={styles.noticeTealText}>
              Ahora firma <Text style={{ fontWeight: "700" }}>{datosValidados?.cliente_nombre || "el cliente"}</Text>. Pásale el teléfono.
            </Text>
          </View>

          <Card padded style={{ gap: theme.spacing.sm }}>
            <Text style={styles.cardTitle}>Contrato de arriendo · {auto.patente}</Text>
            <InfoRow label="Kilometraje de salida" value={`${km} km`} />
            <InfoRow label="Garantía retenida" value={`$${formatCLP(reserva?.monto_hold)}`} />
          </Card>

          <View>
            <SectionLabel>Firma</SectionLabel>
            <SignaturePad onChange={setFirmaSvg} />
          </View>

          <TouchableOpacity
            style={styles.faceCam}
            onPress={() => setMostrarSelfieEntrega(true)}
            activeOpacity={0.85}
            disabled={subiendoSelfieEntrega}
          >
            <View style={styles.faceCircle}>
              {selfieEntregaUrl ? (
                <Image source={{ uri: selfieEntregaUrl }} style={styles.faceCircleFoto} />
              ) : (
                <Icon name="user" size={44} color="rgba(146,227,203,0.7)" />
              )}
            </View>
            <Text style={styles.faceTitle}>
              {subiendoSelfieEntrega
                ? "Subiendo selfie…"
                : selfieEntregaUrl
                ? "Selfie capturada ✓ (toca para repetir)"
                : "Toca para tomar tu selfie"}
            </Text>
            <Text style={styles.faceDesc}>Se compara con la foto de tu cédula verificada al registrarte.</Text>
          </TouchableOpacity>
        </ScrollView>
        <Footer>
          <Button
            testID="btn-firmar-entregar"
            label="Firmar y entregar las llaves"
            onPress={() => enviarChecklist()}
            loading={enviandoChecklist}
            disabled={!firmaSvg}
          />
          <Text style={styles.footNote}>Al firmar aceptas el estado registrado en las fotos.</Text>
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
      <View style={styles.light}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.centerBody} showsVerticalScrollIndicator={false}>
          <SuccessCheck style={styles.successMark} />
          <View style={styles.centerText}>
            <Text style={styles.bigTitle}>Contrato firmado</Text>
            <Text style={styles.bigSub}>
              El arriendo está en curso. Devolución acordada para el{" "}
              {reserva?.fecha_fin ? new Date(reserva.fecha_fin).toLocaleDateString("es-CL") : "—"}.
            </Text>
          </View>
          <Card padded style={{ width: "100%", gap: theme.spacing.md }}>
            <InfoRow label="Reserva" value={(reservaIdActiva || "").slice(0, 8).toUpperCase()} />
            <InfoRow label="Registro fotográfico" value={`${fotos.length} fotos`} />
            <View style={styles.divider} />
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
      <KeyboardAvoidingView style={styles.light} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader
          title="Revisión de devolución"
          onBack={() => (mostrarDano ? setMostrarDano(false) : setStage("22_metrics"))}
        />
        <StepBar activo={1} />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.grid}>
            {colaFotos.map((item, idx) => (
              <View key={item.uriLocal + idx} style={styles.gridCardSm}>
                <Image source={{ uri: item.uriLocal }} style={styles.gridThumbSm} />
              </View>
            ))}
          </View>

          <Card padded style={{ gap: 0 }}>
            <View style={styles.deltaLine}>
              <Text style={styles.deltaLabel}>Kilometraje</Text>
              <Text style={styles.deltaVal}>{km} km</Text>
            </View>
            <View style={styles.deltaLine}>
              <Text style={styles.deltaLabel}>Combustible</Text>
              <Text style={styles.deltaVal}>{fuelLevel}</Text>
            </View>
            <View style={[styles.deltaLine, { borderBottomWidth: 0 }]}>
              <Text style={styles.deltaLabel}>Fotos de devolución</Text>
              <Text style={styles.deltaVal}>{fotos.length} de {ANGLES.length}</Text>
            </View>
          </Card>

          {/* Tarjeta de Peritaje Asistido por IA (Computer Vision) */}
          <Card padded style={styles.aiCard}>
            <View style={styles.aiHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="sparkles" size={18} color={colors.primary} />
                <Text style={styles.aiTitle}>Peritaje Asistido por IA</Text>
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
              <Text style={styles.aiLoadingText}>Analizando fotografías con Computer Vision...</Text>
            )}

            {analisisIA && (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Text style={styles.aiSubtitle}>Probabilidades estimadas por visión:</Text>

                <View style={styles.aiBars}>
                  {CATEGORIAS_IA.map((a) => ({ ...a, pct: analisisIA.probabilidades?.[a.clave] || 0 })).map((item) => (
                    <View key={item.label} style={styles.aiBarRow}>
                      <Text style={styles.aiBarLabel}>{item.label}</Text>
                      <View style={styles.aiBarTrack}>
                        <View
                          style={[
                            styles.aiBarFill,
                            {
                              width: `${Math.max(item.pct, 3)}%`,
                              backgroundColor: item.pct >= 70 ? colors.warning : item.pct >= 30 ? colors.primary : colors.accent300,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.aiBarPct, item.pct >= 70 && { fontWeight: "700", color: colors.warning }]}>
                        {item.pct}%
                      </Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.aiDiagnosis}>{analisisIA.sugerencia_dueno}</Text>

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
                <View style={styles.chipsWrap}>
                  {TIPOS_DANO.map((t) => (
                    <Chip key={t} label={t} selected={damageType === t} onPress={() => setDamageType(t)} />
                  ))}
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <SectionLabel>Qué pasó</SectionLabel>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={damageDesc}
                  onChangeText={setDamageDesc}
                  placeholder="Describe la diferencia encontrada"
                  placeholderTextColor={colors.textPlaceholder}
                  multiline
                />
              </View>

              <View style={styles.noticeWarnBox}>
                <Text style={styles.noticeWarnTitle}>La garantía sigue retenida</Text>
                <Text style={styles.noticeWarnText}>
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
      <KeyboardAvoidingView style={styles.light} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <StatusBar barStyle="dark-content" />
        <StepBar activo={2} />
        <ScrollView contentContainerStyle={styles.centerBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {enDisputa ? (
            <View style={styles.markWarn}>
              <Icon name="alert" size={30} color={colors.warning} />
            </View>
          ) : (
            <SuccessCheck style={styles.successMark} />
          )}
          <View style={styles.centerText}>
            <Text style={styles.bigTitle}>{enDisputa ? "Devolución con diferencia" : "Devolución confirmada"}</Text>
            <Text style={styles.bigSub}>
              {enDisputa
                ? "El arriendo se cierra, pero la garantía queda en revisión de soporte."
                : "El arriendo quedó cerrado y liquidado."}
            </Text>
          </View>

          {enDisputa ? (
            <View style={styles.noticeWarnBox}>
              <Text style={styles.noticeWarnTitle}>Garantía retenida · en revisión</Text>
              <Text style={styles.noticeWarnText}>
                Soporte compara las fotos de entrega y devolución y define cuánto se transfiere para la
                reparación antes de liquidar.
              </Text>
            </View>
          ) : null}

          <Card padded style={{ width: "100%", gap: theme.spacing.md }}>
            <View style={styles.rowBetween}>
              <Text style={styles.infoLabel}>Liquidación para ti</Text>
              <Badge variant={enDisputa ? "neutral" : "success"} label={enDisputa ? "En pausa por disputa" : "Depósito automático directo"} />
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.infoLabel}>Monto a transferir</Text>
              <Text style={styles.liqMonto}>${formatCLP(r.liquidacion_dueno)}</Text>
            </View>
            {r.cargo_limpieza > 0 && <InfoRow label="Cargo limpieza" value={`$${formatCLP(r.cargo_limpieza)}`} />}
            {r.cargo_combustible > 0 && <InfoRow label="Cargo combustible" value={`$${formatCLP(r.cargo_combustible)}`} />}
            {r.cargo_km_extra > 0 && <InfoRow label="Cargo km extra" value={`$${formatCLP(r.cargo_km_extra)}`} />}
            <Text style={styles.footNoteLeft}>
              {enDisputa
                ? "La garantía y liquidación quedan en pausa hasta que soporte resuelva la disputa."
                : "El dinero se transfiere de forma automática a tu cuenta bancaria registrada."}
            </Text>
          </Card>

          {reserva?.cliente_id && (
            <Card padded style={{ width: "100%", gap: theme.spacing.md, alignItems: "center" }}>
              {calificacionEnviada ? (
                <Text style={styles.ratingSent}>¡Gracias por calificar al cliente!</Text>
              ) : (
                <>
                  <Text style={styles.ratingTitle}>¿Cómo fue tu experiencia con el cliente?</Text>
                  <View style={styles.stars}>
                    {PUNTAJES_CALIFICACION.map((n) => (
                      <TouchableOpacity key={n} onPress={() => setPuntajeCliente(n)} hitSlop={theme.control.hitSlop}>
                        <Icon name="star" size={30} color={n <= puntajeCliente ? colors.warning : colors.border} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={styles.input}
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

