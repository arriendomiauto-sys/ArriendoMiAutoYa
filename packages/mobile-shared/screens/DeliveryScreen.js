import React, { useState, useEffect } from "react";
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
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { Button, Card, Badge, Chip, ScreenHeader, SectionLabel } from "../components/ui";
import { SignaturePad } from "../components/SignaturePad";
import { ApiClient } from "../api/client";
import { elegirImagen, subirImagenOptimizada } from "../utils/imagenes";
import { showAlert } from "../utils/alert";
import { guardarColaFotos, leerColaFotos, borrarColaFotos } from "../utils/colaFotosOffline";

const ANGLES = [
  { id: 1, name: "Frontal", desc: "Parte delantera completa" },
  { id: 2, name: "Lateral izq.", desc: "Costado del conductor" },
  { id: 3, name: "Trasera", desc: "Parte trasera completa" },
  { id: 4, name: "Lateral der.", desc: "Costado del copiloto" },
  { id: 5, name: "Asientos", desc: "Asientos delanteros y traseros" },
  { id: 6, name: "Tablero int.", desc: "Consola central y volante" },
  { id: 7, name: "Maletero", desc: "Maletero abierto" },
  { id: 8, name: "Tablero km", desc: "Odómetro y combustible nítido" },
];

// Símbolo del selector -> valor que espera el backend
// (Literal["lleno","3/4","1/2","1/4","vacio"] en ChecklistRequest).
const FUEL_SYMBOL_TO_VALUE = { E: "vacio", "¼": "1/4", "½": "1/2", "¾": "3/4", F: "lleno" };
const FUEL_LEVELS = ["E", "¼", "½", "¾", "F"];

export function DeliveryScreen({ reserva, onBack, onCompleteDelivery }) {
  const insets = useSafeAreaInsets();
  // Reserva "en_curso" => devolución (checklist "despues"); si no, entrega ("antes").
  const tipo = reserva?.estado === "en_curso" ? "despues" : "antes";
  const auto = reserva?.auto || reserva?.car || {};

  const [stage, setStage] = useState("05_code");

  // 05: validar código QR
  const [codigoInput, setCodigoInput] = useState("");
  const [validando, setValidando] = useState(false);
  const [datosValidados, setDatosValidados] = useState(null);
  const [reservaIdActiva, setReservaIdActiva] = useState(reserva?.id || null);

  // 06: confirmar/rechazar identidad
  const [confirmando, setConfirmando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");

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

  // Métricas
  const [km, setKm] = useState("");
  const [fuelLevel, setFuelLevel] = useState("¾");

  // Reporte de diferencia en devolución
  const [damageType, setDamageType] = useState("Rayón");
  const [damageDesc, setDamageDesc] = useState("");

  // Envío del checklist
  const [enviandoChecklist, setEnviandoChecklist] = useState(false);
  const [resultadoChecklist, setResultadoChecklist] = useState(null);

  // Firma del contrato (solo entrega/"antes"): trazo SVG capturado en el pad.
  const [firmaSvg, setFirmaSvg] = useState(null);

  // Calificación al cliente
  const [puntajeCliente, setPuntajeCliente] = useState(0);
  const [comentarioCliente, setComentarioCliente] = useState("");
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);
  const [calificacionEnviada, setCalificacionEnviada] = useState(false);

  const angle = ANGLES[currentAngleIdx] || ANGLES[0];

  // ---------------------------------------------------------------- handlers
  const handleValidarCodigo = async () => {
    if (!codigoInput.trim()) return;
    setValidando(true);
    try {
      const resultado = await ApiClient.validarCodigoQR(codigoInput.trim());
      if (reservaIdActiva && resultado.reserva_id !== reservaIdActiva) {
        showAlert("Código de otra reserva", "Este código corresponde a otra reserva. Verifica con el cliente.");
        return;
      }
      setDatosValidados(resultado);
      setReservaIdActiva(resultado.reserva_id);
      setStage("06_confirm");
    } catch (error) {
      showAlert("Código inválido", error.message);
    } finally {
      setValidando(false);
    }
  };

  const handleConfirmarIdentidad = async () => {
    setConfirmando(true);
    try {
      const resultado = await ApiClient.confirmarVerificacionIdentidad(reservaIdActiva, {
        resultado: "confirmada",
        tipo: tipo === "antes" ? "entrega" : "devolucion",
      });
      if (resultado.siguiente_paso !== "checklist_fotos") {
        showAlert("No se pudo continuar", resultado.mensaje);
        return;
      }
      setStage(tipo === "antes" ? "20_camera" : "25_return_cam");
    } catch (error) {
      showAlert("Error", error.message);
    } finally {
      setConfirmando(false);
    }
  };

  const handleRechazarIdentidad = async () => {
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
      showAlert(
        "Identidad rechazada",
        "Se bloqueó la reserva y se abrió una disputa formal para revisión de soporte.",
        [{ text: "Entendido", onPress: onCompleteDelivery }]
      );
    } catch (error) {
      showAlert("Error", error.message);
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
    setSubiendoFoto(true);
    let uri;
    try {
      uri = await elegirImagen({
        origen: "camera",
        motivoPermiso: "Necesitamos la cámara para registrar el estado del vehículo.",
      });
    } finally {
      setSubiendoFoto(false);
    }
    if (!uri) return; // canceló o no dio permiso: no es un error que avisar

    const idx = colaFotos.length;
    const nuevaCola = [...colaFotos, { uriLocal: uri, url: null, estado: "subiendo" }];
    setColaFotos(nuevaCola);
    setCurrentAngleIdx((prev) => Math.min(ANGLES.length - 1, prev + 1));
    guardarColaFotos(reservaIdActiva, tipo, nuevaCola);

    // La subida corre en paralelo: no bloquea seguir sacando la siguiente
    // foto. Si falla, la foto sigue en pantalla marcada "error" y se
    // reintenta sola — no hace falta que el usuario la vuelva a tomar.
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
  // teléfono de nuevo, no mientras sigue con la pantalla apagada.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado !== "active") return;
      colaFotos.forEach((item, idx) => {
        if (item.estado === "error") subirUnaFoto(idx, item.uriLocal);
      });
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaFotos]);

  const irAMetricas = () => setStage("22_metrics");

  const handleContinuarMetricas = () => {
    if (!km.trim()) {
      showAlert("Kilometraje requerido", "Ingresa el kilometraje actual del vehículo.");
      return;
    }
    setStage(tipo === "antes" ? "23_signature" : "26_compare");
  };

  const enviarChecklist = async (notasExtra) => {
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
      });
      setResultadoChecklist(resultado);
      borrarColaFotos(reservaIdActiva, tipo);
      setStage(tipo === "antes" ? "24_signed" : "28_done");
    } catch (error) {
      showAlert("No se pudo registrar el checklist", error.message);
    } finally {
      setEnviandoChecklist(false);
    }
  };

  const handleCalificarCliente = async () => {
    if (!puntajeCliente || !reserva?.cliente_id) return;
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
      showAlert("No se pudo enviar la calificación", error.message);
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

  // ---------------------------------------------------------------- cámara
  const renderCamara = ({ titulo, nota, onCloseBtn, onCounterPress }) => (
    <View style={styles.camContainer}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.camTop, { paddingTop: insets.top + 8 }]}>
        <View style={styles.camHead}>
          <TouchableOpacity onPress={onCloseBtn} hitSlop={theme.control.hitSlop}>
            <Icon name="close" size={22} color="#FFFFFF" />
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
                    past && { color: colors.accent300, fontWeight: "500" },
                    curr && { color: colors.primary900, fontWeight: "600" },
                    !past && !curr && { color: "rgba(255,255,255,0.7)" },
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
        ) : (
          <View style={styles.guideBox} />
        )}
        <View style={styles.vfBadge}>
          <Text style={styles.vfBadgeText}>{angle.desc}</Text>
        </View>
      </View>

      <View style={[styles.camShutter, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <View style={styles.shutterRow}>
          <TouchableOpacity onPress={() => setCurrentAngleIdx(Math.min(ANGLES.length - 1, currentAngleIdx + 1))}>
            <Text style={styles.skipText}>Saltar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shutterBtn}
            onPress={handleTomarFoto}
            disabled={subiendoFoto}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Tomar foto"
          >
            {subiendoFoto ? <ActivityIndicator color={colors.darkBg} /> : <View style={styles.shutterInner} />}
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
        <Text style={styles.camNote}>{nota}</Text>
      </View>
    </View>
  );

  // ================================================================ STAGES

  if (stage === "05_code") {
    return (
      <KeyboardAvoidingView style={styles.light} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title={tipo === "antes" ? "Verificar entrega" : "Verificar devolución"} onBack={onBack} />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.noticeTeal}>
            <Icon name="shield" size={18} color={colors.primary} />
            <Text style={styles.noticeTealText}>
              Pídele al cliente el código de su reserva y escríbelo aquí para validar su identidad.
            </Text>
          </View>

          {auto?.marca ? (
            <Card padded style={{ gap: theme.spacing.sm }}>
              <Text style={styles.cardTitle}>{auto.marca} {auto.modelo} {auto.anio}</Text>
              <InfoRow label="Patente" value={auto.patente} />
              <InfoRow label="Lugar acordado" value={reserva?.lugar_entrega_acordado} />
            </Card>
          ) : null}

          <View style={{ gap: 6 }}>
            <SectionLabel>Código de la reserva</SectionLabel>
            <TextInput
              style={styles.input}
              value={codigoInput}
              onChangeText={setCodigoInput}
              placeholder="Código mostrado en el celular del cliente"
              placeholderTextColor={colors.textPlaceholder}
              autoCapitalize="none"
            />
          </View>
        </ScrollView>
        <Footer>
          <Button label="Validar código" onPress={handleValidarCodigo} loading={validando} disabled={!codigoInput.trim()} />
        </Footer>
      </KeyboardAvoidingView>
    );
  }

  if (stage === "06_confirm" && datosValidados) {
    return (
      <KeyboardAvoidingView style={styles.light} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Confirmar identidad" onBack={() => setStage("05_code")} />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
            <Card padded style={{ gap: theme.spacing.sm, marginTop: 10, borderColor: colors.primary, borderWidth: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[styles.cardTitle, { fontSize: 14 }]}>
                  Segundo Conductor Autorizado
                </Text>
                <Badge label="KYC Verificado" variant="success" />
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
      nota: `Repite el mismo ángulo que la entrega · ${fotos.length} de ${ANGLES.length}`,
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
          <Button label="Continuar" onPress={irAMetricas} disabled={fotos.length === 0} />
        </Footer>
      </View>
    );
  }

  if (stage === "22_metrics") {
    return (
      <KeyboardAvoidingView style={styles.light} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader
          title="Kilometraje y combustible"
          onBack={() => setStage(tipo === "antes" ? "21_review" : "25_return_cam")}
        />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6 }}>
            <SectionLabel>Kilometraje actual</SectionLabel>
            <View style={styles.kmRow}>
              <TextInput
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
          <Button label={tipo === "antes" ? "Ir a la firma" : "Continuar"} onPress={handleContinuarMetricas} />
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
            <InfoRow label="Garantía retenida" value={`$${(reserva?.monto_hold || 0).toLocaleString("es-CL")}`} />
          </Card>

          <View>
            <SectionLabel>Firma</SectionLabel>
            <SignaturePad onChange={setFirmaSvg} />
          </View>

          <View style={styles.faceCam}>
            <View style={styles.faceCircle}>
              <Icon name="user" size={44} color="rgba(146,227,203,0.7)" />
            </View>
            <Text style={styles.faceTitle}>Mira a la cámara sin lentes</Text>
            <Text style={styles.faceDesc}>Tu rostro se compara con la cédula verificada al registrarte.</Text>
          </View>
        </ScrollView>
        <Footer>
          <Button
            label="Firmar y entregar las llaves"
            onPress={() => enviarChecklist()}
            loading={enviandoChecklist}
            disabled={!firmaSvg}
          />
          <Text style={styles.footNote}>Al firmar aceptas el estado registrado en las fotos.</Text>
        </Footer>
      </View>
    );
  }

  if (stage === "24_signed") {
    return (
      <View style={styles.light}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.centerBody} showsVerticalScrollIndicator={false}>
          <View style={styles.successCircle}>
            <Icon name="check" size={36} color={colors.accent700} />
          </View>
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
            <InfoRow label="Garantía" value={`$${(reserva?.monto_hold || 0).toLocaleString("es-CL")} retenidos`} />
          </Card>
        </ScrollView>
        <Footer>
          <Button label="Listo" onPress={onCompleteDelivery} />
        </Footer>
      </View>
    );
  }

  if (stage === "26_compare") {
    return (
      <View style={styles.light}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Confirmar devolución" onBack={() => setStage("22_metrics")} />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {[
            { t: "Kilometraje registrado", s: `${km} km` },
            { t: "Combustible registrado", s: fuelLevel },
            { t: "Fotos de devolución", s: `${fotos.length} de ${ANGLES.length}` },
          ].map((d) => (
            <Card key={d.t} padded style={styles.deltaCard}>
              <Text style={styles.deltaTitle}>{d.t}</Text>
              <Text style={styles.deltaSub}>{d.s}</Text>
            </Card>
          ))}
        </ScrollView>
        <Footer>
          <Button label="Todo en orden, cerrar arriendo" onPress={() => enviarChecklist()} loading={enviandoChecklist} />
          <Button variant="ghost" size="sm" label="Reportar daño o diferencia" onPress={() => setStage("27_damage")} />
        </Footer>
      </View>
    );
  }

  if (stage === "27_damage") {
    return (
      <KeyboardAvoidingView style={styles.light} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Reportar una diferencia" onBack={() => setStage("26_compare")} />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ gap: theme.spacing.sm }}>
            <SectionLabel>Tipo de diferencia</SectionLabel>
            <View style={styles.chipsWrap}>
              {["Rayón", "Golpe", "Vidrio", "Neumático", "Interior", "Falta combustible"].map((t) => (
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
              Este reporte queda como nota del checklist de devolución para respaldar el cargo correspondiente.
            </Text>
          </View>
        </ScrollView>
        <Footer>
          <Button
            variant="danger"
            label="Enviar el reporte y cerrar"
            onPress={() => enviarChecklist(`[${damageType}] ${damageDesc}`.trim())}
            loading={enviandoChecklist}
          />
          <Button variant="ghost" size="sm" label="Cancelar" onPress={() => setStage("26_compare")} />
        </Footer>
      </KeyboardAvoidingView>
    );
  }

  if (stage === "28_done") {
    const r = resultadoChecklist || {};
    return (
      <KeyboardAvoidingView style={styles.light} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.centerBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.successCircle}>
            <Icon name="check" size={36} color={colors.accent700} />
          </View>
          <View style={styles.centerText}>
            <Text style={styles.bigTitle}>Devolución confirmada</Text>
            <Text style={styles.bigSub}>El arriendo quedó cerrado y liquidado.</Text>
          </View>

          <Card padded style={{ width: "100%", gap: theme.spacing.md }}>
            <View style={styles.rowBetween}>
              <Text style={styles.infoLabel}>Liquidación para ti</Text>
              <Badge variant="warning" label="Pendiente de pago" />
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.infoLabel}>Monto</Text>
              <Text style={styles.liqMonto}>${(r.liquidacion_dueno || 0).toLocaleString("es-CL")}</Text>
            </View>
            {r.cargo_limpieza > 0 && <InfoRow label="Cargo limpieza" value={`$${r.cargo_limpieza.toLocaleString("es-CL")}`} />}
            {r.cargo_combustible > 0 && <InfoRow label="Cargo combustible" value={`$${r.cargo_combustible.toLocaleString("es-CL")}`} />}
            <Text style={styles.footNoteLeft}>
              La garantía se libera al cliente tras esta inspección de devolución.
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
                    {[1, 2, 3, 4, 5].map((n) => (
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
          <Button label="Listo" onPress={onCompleteDelivery} />
        </Footer>
      </KeyboardAvoidingView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  light: { flex: 1, backgroundColor: colors.background },
  body: { padding: theme.spacing.screen, gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  centerBody: { padding: theme.spacing.xxl, alignItems: "center", gap: theme.spacing.lg },
  centerText: { alignItems: "center", gap: theme.spacing.sm },
  bigTitle: { ...theme.typography.title, color: colors.text, textAlign: "center" },
  bigSub: { fontSize: 15, color: colors.textMuted, lineHeight: 22, textAlign: "center" },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent100,
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing.sm,
  },
  perfilFoto: { width: 96, height: 96, borderRadius: 48, alignSelf: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.md },
  infoLabel: { fontSize: 14, color: colors.textMuted },
  infoValue: { fontSize: 14, color: colors.text, fontWeight: "500", flexShrink: 1, textAlign: "right" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  divider: { height: 1, backgroundColor: colors.border },
  help: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  input: {
    minHeight: theme.control.height,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  textarea: { minHeight: 90, textAlignVertical: "top" },
  noticeTeal: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    backgroundColor: colors.primary100,
    borderRadius: theme.radius.field,
    padding: theme.spacing.lg,
  },
  noticeTealText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.primary },
  noticeWarn: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: theme.radius.field,
    padding: theme.spacing.lg,
  },
  noticeWarnText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.warningText },
  noticeWarnBox: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: theme.radius.field,
    padding: theme.spacing.lg,
    gap: 4,
  },
  noticeWarnTitle: { fontSize: 14, fontWeight: "700", color: colors.warningText },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
  gridCard: {
    width: "47%",
    borderRadius: theme.radius.field,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  gridThumb: { height: 84, width: "100%", backgroundColor: colors.surfaceSecondary },
  gridFoot: { padding: theme.spacing.sm, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 },
  gridName: { fontSize: 13, color: colors.text, flex: 1 },
  kmRow: {
    height: theme.control.height,
    borderWidth: 1.5,
    borderColor: colors.primary200,
    borderRadius: theme.radius.field,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: theme.spacing.sm,
  },
  kmInput: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.text },
  kmSuffix: { fontSize: 16, color: colors.textMuted, fontWeight: "500" },
  fuelRow: { flexDirection: "row", gap: 6 },
  fuelBtn: {
    flex: 1,
    height: 58,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  fuelBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  fuelText: { fontSize: 16, fontWeight: "600", color: colors.textMuted },
  fuelSub: { fontSize: 10, color: colors.textMuted },
  faceCam: {
    height: 230,
    backgroundColor: colors.primary800,
    borderRadius: theme.radius.card,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  faceCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: "rgba(146,227,203,0.7)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary900,
  },
  faceTitle: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  faceDesc: { fontSize: 13, color: colors.accent300, textAlign: "center", maxWidth: 240, lineHeight: 18 },
  deltaCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  deltaTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  deltaSub: { fontSize: 14, color: colors.textMuted },
  liqMonto: { fontSize: 16, fontWeight: "800", color: colors.text },
  footNote: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
  footNoteLeft: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: theme.spacing.sm,
  },
  ratingTitle: { fontSize: 15, fontWeight: "600", color: colors.text, textAlign: "center" },
  ratingSent: { fontSize: 14, fontWeight: "600", color: colors.success },
  stars: { flexDirection: "row", gap: 6 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  footer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: theme.spacing.sm,
  },

  // ---- cámara ----
  camContainer: { flex: 1, backgroundColor: colors.darkBg },
  camTop: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, gap: theme.spacing.md },
  camHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  camTitle: { fontSize: 15, fontWeight: "600", color: "#FFFFFF", flex: 1, marginHorizontal: theme.spacing.md },
  camFraction: { fontSize: 14, color: colors.accent300, fontWeight: "600" },
  camBars: { flexDirection: "row", gap: 5 },
  camBar: { flex: 1, height: 4, borderRadius: 999 },
  barDone: { backgroundColor: colors.accent },
  barActive: { backgroundColor: "#FFFFFF" },
  barPending: { backgroundColor: "rgba(255,255,255,0.22)" },
  anglePills: { flexDirection: "row", gap: theme.spacing.sm, paddingVertical: 2 },
  anglePill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: theme.radius.pill },
  pillPast: { backgroundColor: "rgba(47,191,155,0.16)" },
  pillCurr: { backgroundColor: "#FFFFFF" },
  pillFuture: { backgroundColor: "rgba(255,255,255,0.12)" },
  pillText: { fontSize: 13 },
  viewfinder: {
    flex: 1,
    backgroundColor: colors.darkSurface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  guideBox: {
    position: "absolute",
    top: 24,
    bottom: 24,
    left: 20,
    right: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    borderStyle: "dashed",
    borderRadius: theme.radius.card,
  },
  vfBadge: {
    position: "absolute",
    top: 22,
    backgroundColor: "rgba(6,30,31,0.82)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.radius.field,
  },
  vfBadgeText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  camShutter: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.lg, backgroundColor: colors.darkBg, gap: theme.spacing.md },
  shutterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skipText: { fontSize: 15, fontWeight: "600", color: colors.accent300 },
  shutterBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: colors.darkBg },
  thumbCounter: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.field,
    backgroundColor: colors.primary500,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbCounterText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  camNote: { fontSize: 13, color: "rgba(255,255,255,0.6)", textAlign: "center" },
});
