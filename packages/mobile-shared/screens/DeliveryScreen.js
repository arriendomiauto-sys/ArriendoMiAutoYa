import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors } from "../theme/colors";
import { Icon } from "../components/Icon";
import { ApiClient } from "../api/client";

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

// Símbolo mostrado en el selector -> valor real que espera el backend
// (Literal["lleno","3/4","1/2","1/4","vacio"] en ChecklistRequest).
const FUEL_SYMBOL_TO_VALUE = { E: "vacio", "¼": "1/4", "½": "1/2", "¾": "3/4", F: "lleno" };

export function DeliveryScreen({ reserva, onBack, onCompleteDelivery }) {
  // Si la reserva ya está "en_curso" estamos en la devolución (checklist
  // "despues"); si no, es la entrega inicial (checklist "antes").
  const tipo = reserva?.estado === "en_curso" ? "despues" : "antes";
  const auto = reserva?.auto || {};

  // Screen sub-state
  const [stage, setStage] = useState("05_code");

  // Paso 05: validar código QR mostrado por el cliente
  const [codigoInput, setCodigoInput] = useState("");
  const [validando, setValidando] = useState(false);
  const [datosValidados, setDatosValidados] = useState(null);
  const [reservaIdActiva, setReservaIdActiva] = useState(reserva?.id || null);

  // Paso 06: confirmar/rechazar identidad
  const [confirmando, setConfirmando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");

  // Fotos reales (uno o más URLs subidos de verdad)
  const [fotos, setFotos] = useState([]);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [currentAngleIdx, setCurrentAngleIdx] = useState(0);

  // Métricas
  const [km, setKm] = useState("");
  const [fuelLevel, setFuelLevel] = useState("¾");

  // Reporte de diferencia en la devolución (se agrega como nota al checklist)
  const [damageType, setDamageType] = useState("Rayón");
  const [damageDesc, setDamageDesc] = useState("");

  // Envío del checklist final
  const [enviandoChecklist, setEnviandoChecklist] = useState(false);
  const [resultadoChecklist, setResultadoChecklist] = useState(null);

  // Calificación al cliente tras la devolución
  const [puntajeCliente, setPuntajeCliente] = useState(0);
  const [comentarioCliente, setComentarioCliente] = useState("");
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);
  const [calificacionEnviada, setCalificacionEnviada] = useState(false);

  const angle = ANGLES[currentAngleIdx] || ANGLES[0];
  const isDarkScreen = stage === "20_camera" || stage === "25_return_cam";

  const handleValidarCodigo = async () => {
    if (!codigoInput.trim()) return;
    setValidando(true);
    try {
      const resultado = await ApiClient.validarCodigoQR(codigoInput.trim());
      if (reservaIdActiva && resultado.reserva_id !== reservaIdActiva) {
        Alert.alert(
          "Código de otra reserva",
          "Este código corresponde a una reserva distinta a la que abriste. Verifica con el cliente."
        );
        return;
      }
      setDatosValidados(resultado);
      setReservaIdActiva(resultado.reserva_id);
      setStage("06_confirm");
    } catch (error) {
      Alert.alert("Código inválido", error.message);
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
        Alert.alert("No se pudo continuar", resultado.mensaje);
        return;
      }
      setStage(tipo === "antes" ? "20_camera" : "25_return_cam");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setConfirmando(false);
    }
  };

  const handleRechazarIdentidad = async () => {
    if (!motivoRechazo.trim()) {
      Alert.alert("Motivo requerido", "Describe brevemente por qué no coincide la identidad.");
      return;
    }
    setConfirmando(true);
    try {
      const resultado = await ApiClient.confirmarVerificacionIdentidad(reservaIdActiva, {
        resultado: "rechazada",
        tipo: tipo === "antes" ? "entrega" : "devolucion",
        motivo_rechazo: motivoRechazo.trim(),
      });
      Alert.alert(
        "Identidad rechazada",
        "Se bloqueó la reserva y se abrió una disputa formal para revisión de soporte/admin.",
        [{ text: "Entendido", onPress: onCompleteDelivery }]
      );
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setConfirmando(false);
    }
  };

  const handleTomarFoto = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tus fotos para el checklist.");
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (resultado.canceled || !resultado.assets?.length) return;

    setSubiendoFoto(true);
    try {
      const asset = resultado.assets[0];
      const filename = asset.fileName || `checklist-${Date.now()}.jpg`;
      const subida = await ApiClient.subirArchivoStorage(asset.uri, filename, "checklists");
      setFotos((prev) => [...prev, subida.url]);
      setCurrentAngleIdx((prev) => Math.min(ANGLES.length - 1, prev + 1));
    } catch (error) {
      Alert.alert("Error al subir foto", error.message);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const irAMetricas = () => setStage("22_metrics");

  const handleContinuarMetricas = () => {
    if (!km.trim()) {
      Alert.alert("Kilometraje requerido", "Ingresa el kilometraje actual del vehículo.");
      return;
    }
    setStage(tipo === "antes" ? "23_signature" : "26_compare");
  };

  const enviarChecklist = async (notasExtra) => {
    setEnviandoChecklist(true);
    try {
      const resultado = await ApiClient.registrarChecklist(reservaIdActiva, {
        tipo,
        fotos: fotos.length > 0 ? fotos : ["sin-foto"], // el backend exige al menos 1
        kilometraje: parseInt(km.replace(/\D/g, ""), 10) || 0,
        nivel_combustible: FUEL_SYMBOL_TO_VALUE[fuelLevel] || "3/4",
        notas: notasExtra || undefined,
      });
      setResultadoChecklist(resultado);
      setStage(tipo === "antes" ? "24_signed" : "28_done");
    } catch (error) {
      Alert.alert("No se pudo registrar el checklist", error.message);
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
      Alert.alert("No se pudo enviar la calificación", error.message);
    } finally {
      setEnviandoCalificacion(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        isDarkScreen ? styles.bgDark : styles.bgLight,
      ]}
    >
      <StatusBar
        barStyle={isDarkScreen ? "light-content" : "dark-content"}
      />

      {/* ========================================================================= */}
      {/* PASO 05: INGRESAR CÓDIGO DEL CLIENTE */}
      {/* ========================================================================= */}
      {stage === "05_code" && (
        <View style={styles.screenWrapper}>
          <View style={styles.topNavHeader}>
            <TouchableOpacity onPress={onBack}>
              <Icon name="arrow-left" size={22} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topNavTitle}>{tipo === "antes" ? "Verificar entrega" : "Verificar devolución"}</Text>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.blueNoticeRow}>
              <Icon name="shield" size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.blueNoticeText}>
                Pídele al cliente que te muestre el código de su reserva y escríbelo aquí para validar su identidad.
              </Text>
            </View>

            {auto?.marca && (
              <View style={styles.contractSummaryBox}>
                <Text style={styles.contractBoxTitle}>{auto.marca} {auto.modelo} {auto.anio}</Text>
                <View style={styles.contractRow}>
                  <Text style={styles.contractLabel}>Patente</Text>
                  <Text style={styles.contractVal}>{auto.patente}</Text>
                </View>
                <View style={styles.contractRow}>
                  <Text style={styles.contractLabel}>Lugar acordado</Text>
                  <Text style={styles.contractVal}>{reserva?.lugar_entrega_acordado}</Text>
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Código de la reserva</Text>
              <View style={styles.kmInputRow}>
                <TextInput
                  style={styles.kmTextInput}
                  value={codigoInput}
                  onChangeText={setCodigoInput}
                  placeholder="Código mostrado en el celular del cliente"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={[styles.primaryBtn, (validando || !codigoInput.trim()) && styles.btnDisabled]}
              onPress={handleValidarCodigo}
              disabled={validando || !codigoInput.trim()}
              activeOpacity={0.85}
            >
              {validando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Validar código</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PASO 06: CONFIRMAR O RECHAZAR IDENTIDAD */}
      {/* ========================================================================= */}
      {stage === "06_confirm" && datosValidados && (
        <View style={styles.screenWrapper}>
          <View style={styles.topNavHeader}>
            <TouchableOpacity onPress={() => setStage("05_code")}>
              <Icon name="arrow-left" size={22} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topNavTitle}>Confirmar identidad</Text>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.scrollContent}>
            {datosValidados.foto_perfil_verificada_url && (
              <Image source={{ uri: datosValidados.foto_perfil_verificada_url }} style={styles.perfilFoto} />
            )}

            <View style={styles.contractSummaryBox}>
              <Text style={styles.contractBoxTitle}>{datosValidados.cliente_nombre}</Text>
              <View style={styles.contractRow}>
                <Text style={styles.contractLabel}>Vehículo</Text>
                <Text style={styles.contractVal}>
                  {datosValidados.auto_marca} {datosValidados.auto_modelo} · {datosValidados.auto_patente}
                </Text>
              </View>
              <View style={styles.contractRow}>
                <Text style={styles.contractLabel}>Lugar</Text>
                <Text style={styles.contractVal}>{datosValidados.lugar_entrega_acordado}</Text>
              </View>
            </View>

            <Text style={styles.tableroInstruction}>
              Compare el rostro de la persona presente con la foto de perfil verificada.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Motivo del rechazo (si no coincide)</Text>
              <View style={styles.damageInputBox}>
                <TextInput
                  style={styles.damageTextInput}
                  value={motivoRechazo}
                  onChangeText={setMotivoRechazo}
                  placeholder="ej. La persona no coincide con la foto del carnet"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={[styles.primaryBtn, confirmando && styles.btnDisabled]}
              onPress={handleConfirmarIdentidad}
              disabled={confirmando}
              activeOpacity={0.85}
            >
              {confirmando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Confirmar identidad</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dangerBtn, confirmando && styles.btnDisabled]}
              onPress={handleRechazarIdentidad}
              disabled={confirmando}
              activeOpacity={0.85}
            >
              <Text style={styles.dangerBtnText}>No coincide</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 20: CHECKLIST DE ENTREGA — CÁMARA GUIADA */}
      {/* ========================================================================= */}
      {stage === "20_camera" && (
        <View style={styles.screenWrapper}>
          <View style={styles.camTopArea}>
            <View style={styles.camHeaderRow}>
              <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.camVehicleTitle}>Entrega · {auto.marca} {auto.modelo}</Text>
              <Text style={styles.camFraction}>{fotos.length} / {ANGLES.length}</Text>
            </View>

            <View style={styles.camBarsRow}>
              {ANGLES.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.camBarSegment,
                    idx < fotos.length ? styles.barCompleted : idx === currentAngleIdx ? styles.barActive : styles.barPending,
                  ]}
                />
              ))}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.anglePillsRow}
            >
              {ANGLES.map((a, idx) => {
                const isPast = idx < fotos.length;
                const isCurr = idx === currentAngleIdx;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[
                      styles.anglePill,
                      isPast && styles.pillPast,
                      isCurr && styles.pillCurrent,
                      !isPast && !isCurr && styles.pillFuture,
                    ]}
                    onPress={() => setCurrentAngleIdx(idx)}
                  >
                    <Text
                      style={[
                        styles.anglePillText,
                        isPast && styles.pillTextPast,
                        isCurr && styles.pillTextCurrent,
                        !isPast && !isCurr && styles.pillTextFuture,
                      ]}
                    >
                      {isPast ? `✓ ${a.name}` : a.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.camViewfinderArea}>
            {fotos[currentAngleIdx] ? (
              <Image source={{ uri: fotos[currentAngleIdx] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={styles.viewfinderGuideBox} />
            )}
            <View style={styles.viewfinderBadgeTop}>
              <Text style={styles.viewfinderBadgeText}>{angle.desc}</Text>
            </View>
            <View style={styles.viewfinderPromptBottom}>
              <Text style={styles.viewfinderPromptText}>
                Toque el botón para elegir la foto real de este ángulo desde su galería.
              </Text>
            </View>
          </View>

          <View style={styles.camShutterBar}>
            <View style={styles.shutterRow}>
              <TouchableOpacity
                onPress={() => setCurrentAngleIdx(Math.min(ANGLES.length - 1, currentAngleIdx + 1))}
              >
                <Text style={styles.skipPhotoText}>Saltar esta foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.camShutterBtn}
                onPress={handleTomarFoto}
                disabled={subiendoFoto}
                activeOpacity={0.85}
              >
                {subiendoFoto ? <ActivityIndicator color={colors.darkBg} /> : <View style={styles.camShutterInnerCircle} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.miniThumbCounter}
                onPress={() => setStage("21_review")}
              >
                <Text style={styles.thumbCounterText}>{fotos.length}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.camShutterNote}>
              Mínimo 1 foto para continuar · llevas {fotos.length} de {ANGLES.length}
            </Text>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 21: REVISIÓN DE FOTOS */}
      {/* ========================================================================= */}
      {stage === "21_review" && (
        <View style={styles.screenWrapper}>
          <View style={styles.topNavHeader}>
            <TouchableOpacity onPress={() => setStage("20_camera")}>
              <Icon name="arrow-left" size={22} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topNavTitle}>Revise las fotos ({fotos.length})</Text>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.scrollContent}>
            {fotos.length === 0 && (
              <View style={styles.warningNoticeRow}>
                <Icon name="alert" size={20} color={colors.warning} style={{ marginRight: 8 }} />
                <Text style={styles.warningNoticeDesc}>
                  Todavía no tomaste ninguna foto real. Vuelve atrás y toma al menos una.
                </Text>
              </View>
            )}
            <View style={styles.photoGrid2x4}>
              {fotos.map((url, idx) => (
                <View key={url + idx} style={styles.gridPhotoCard}>
                  <Image source={{ uri: url }} style={styles.gridPhotoThumb} />
                  <View style={styles.gridPhotoFooter}>
                    <Text style={styles.gridPhotoName}>{ANGLES[idx]?.name || `Foto ${idx + 1}`}</Text>
                    <Text style={styles.checkBadge}>✓</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={[styles.primaryBtn, fotos.length === 0 && styles.btnDisabled]}
              onPress={irAMetricas}
              disabled={fotos.length === 0}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 22: KILOMETRAJE Y COMBUSTIBLE (entrega y devolución) */}
      {/* ========================================================================= */}
      {stage === "22_metrics" && (
        <View style={styles.screenWrapper}>
          <View style={styles.topNavHeader}>
            <TouchableOpacity onPress={() => setStage(tipo === "antes" ? "21_review" : "25_return_cam")}>
              <Icon name="arrow-left" size={22} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topNavTitle}>Kilometraje y combustible</Text>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Kilometraje actual</Text>
              <View style={styles.kmInputRow}>
                <TextInput
                  style={styles.kmTextInput}
                  value={km}
                  onChangeText={setKm}
                  keyboardType="numeric"
                  placeholder="ej. 48320"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.kmSuffix}>km</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nivel de combustible</Text>
              <View style={styles.fuelButtonsRow}>
                {["E", "¼", "½", "¾", "F"].map((level) => {
                  const isSelected = fuelLevel === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[styles.fuelLevelBtn, isSelected && styles.fuelLevelBtnActive]}
                      onPress={() => setFuelLevel(level)}
                    >
                      <Text style={[styles.fuelLevelText, isSelected && styles.fuelLevelTextActive]}>{level}</Text>
                      {level === "E" && <Text style={[styles.fuelSubText, isSelected && styles.fuelSubTextActive]}>vacío</Text>}
                      {level === "F" && <Text style={[styles.fuelSubText, isSelected && styles.fuelSubTextActive]}>lleno</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleContinuarMetricas}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{tipo === "antes" ? "Ir a la firma" : "Continuar"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 23: FIRMA (entrega) */}
      {/* ========================================================================= */}
      {stage === "23_signature" && (
        <View style={styles.screenWrapper}>
          <View style={styles.topNavHeaderBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TouchableOpacity onPress={() => setStage("22_metrics")}>
                <Icon name="arrow-left" size={22} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.topNavTitle}>Firma del contrato</Text>
            </View>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.blueNoticeRow}>
              <Icon name="shield" size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.blueNoticeText}>
                Ahora firma <Text style={{ fontWeight: "700" }}>{datosValidados?.cliente_nombre || "el cliente"}</Text>. Pásele el teléfono.
              </Text>
            </View>

            <View style={styles.contractSummaryBox}>
              <Text style={styles.contractBoxTitle}>Contrato de arriendo · {auto.patente}</Text>
              <View style={styles.contractRow}>
                <Text style={styles.contractLabel}>Kilometraje de salida</Text>
                <Text style={styles.contractVal}>{km} km</Text>
              </View>
              <View style={styles.contractRow}>
                <Text style={styles.contractLabel}>Garantía retenida</Text>
                <Text style={styles.contractVal}>${(reserva?.monto_hold || 0).toLocaleString("es-CL")}</Text>
              </View>
            </View>

            <View style={styles.faceCamContainer}>
              <View style={styles.faceCamCircle}>
                <Icon name="user" size={48} color="rgba(146,227,203,0.7)" />
              </View>
              <Text style={styles.faceCamTitle}>Mire a la cámara sin lentes</Text>
              <Text style={styles.faceCamDesc}>
                Su rostro se compara con la cédula verificada al registrarse.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={[styles.primaryBtn, enviandoChecklist && styles.btnDisabled]}
              onPress={() => enviarChecklist()}
              disabled={enviandoChecklist}
              activeOpacity={0.85}
            >
              {enviandoChecklist ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Firmar y entregar las llaves</Text>}
            </TouchableOpacity>
            <Text style={styles.signFooterDisclaimer}>
              Al firmar acepta el estado registrado en las fotos.
            </Text>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 24: CONTRATO FIRMADO */}
      {/* ========================================================================= */}
      {stage === "24_signed" && (
        <View style={styles.screenWrapper}>
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.finalCenterContent}>
            <View style={styles.successCheckCircle}>
              <Icon name="check" size={38} color={colors.success} strokeWidth={2.4} />
            </View>

            <View style={styles.centerTextBox}>
              <Text style={styles.largeHeroTitle}>Contrato firmado</Text>
              <Text style={styles.heroSubText}>
                El arriendo está en curso. Devolución acordada para el {reserva?.fecha_fin ? new Date(reserva.fecha_fin).toLocaleDateString("es-CL") : "—"}.
              </Text>
            </View>

            <View style={styles.cardDetailBox}>
              <View style={styles.cardDetailRow}>
                <Text style={styles.cardDetailLabel}>Reserva</Text>
                <Text style={styles.cardDetailMono}>{(reservaIdActiva || "").slice(0, 8).toUpperCase()}</Text>
              </View>
              <View style={styles.cardDetailRow}>
                <Text style={styles.cardDetailLabel}>Registro fotográfico</Text>
                <Text style={styles.cardDetailVal}>{fotos.length} fotos</Text>
              </View>
              <View style={[styles.cardDetailRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
                <Text style={styles.cardDetailLabel}>Garantía</Text>
                <Text style={styles.guaranteeHoldText}>${(reserva?.monto_hold || 0).toLocaleString("es-CL")} retenidos</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onCompleteDelivery}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 25: CHECKLIST DE DEVOLUCIÓN — CÁMARA GUIADA */}
      {/* ========================================================================= */}
      {stage === "25_return_cam" && (
        <View style={styles.screenWrapper}>
          <View style={styles.camTopArea}>
            <View style={styles.camHeaderRow}>
              <TouchableOpacity onPress={onBack}>
                <Icon name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.camVehicleTitle}>Devolución · {auto.marca} {auto.modelo}</Text>
              <Text style={styles.camFraction}>{fotos.length} / {ANGLES.length}</Text>
            </View>

            <View style={styles.camBarsRow}>
              {ANGLES.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.camBarSegment,
                    idx < fotos.length ? styles.barCompleted : idx === currentAngleIdx ? styles.barActive : styles.barPending,
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.camViewfinderArea}>
            {fotos[currentAngleIdx] ? (
              <Image source={{ uri: fotos[currentAngleIdx] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={styles.viewfinderGuideBox} />
            )}
            <View style={styles.viewfinderBadgeTop}>
              <Text style={styles.viewfinderBadgeText}>{angle.desc}</Text>
            </View>
          </View>

          <View style={styles.camShutterBar}>
            <View style={styles.shutterRow}>
              <TouchableOpacity onPress={() => setCurrentAngleIdx(Math.min(ANGLES.length - 1, currentAngleIdx + 1))}>
                <Text style={styles.skipPhotoText}>Saltar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.camShutterBtn}
                onPress={handleTomarFoto}
                disabled={subiendoFoto}
                activeOpacity={0.85}
              >
                {subiendoFoto ? <ActivityIndicator color={colors.darkBg} /> : <View style={styles.camShutterInnerCircle} />}
              </TouchableOpacity>

              <TouchableOpacity style={styles.miniThumbCounter} onPress={irAMetricas}>
                <Text style={styles.thumbCounterText}>{fotos.length}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.camShutterNote}>
              Repita el mismo ángulo que el día de la entrega · {fotos.length} de {ANGLES.length}
            </Text>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 26: CONFIRMAR DEVOLUCIÓN */}
      {/* ========================================================================= */}
      {stage === "26_compare" && (
        <View style={styles.screenWrapper}>
          <View style={styles.topNavHeader}>
            <TouchableOpacity onPress={() => setStage("22_metrics")}>
              <Icon name="arrow-left" size={22} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topNavTitle}>Confirmar devolución</Text>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.deltaCard}>
              <View>
                <Text style={styles.deltaTitle}>Kilometraje registrado</Text>
                <Text style={styles.deltaSub}>{km} km</Text>
              </View>
            </View>
            <View style={styles.deltaCard}>
              <View>
                <Text style={styles.deltaTitle}>Combustible registrado</Text>
                <Text style={styles.deltaSub}>{fuelLevel}</Text>
              </View>
            </View>
            <View style={styles.deltaCard}>
              <View>
                <Text style={styles.deltaTitle}>Fotos de devolución</Text>
                <Text style={styles.deltaSub}>{fotos.length} de {ANGLES.length}</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={[styles.primaryBtn, enviandoChecklist && styles.btnDisabled]}
              onPress={() => enviarChecklist()}
              disabled={enviandoChecklist}
              activeOpacity={0.85}
            >
              {enviandoChecklist ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Todo en orden, cerrar arriendo</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dangerLinkBtn}
              onPress={() => setStage("27_damage")}
              activeOpacity={0.8}
            >
              <Text style={styles.dangerLinkBtnText}>Reportar daño o diferencia</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 27: REPORTAR DAÑO O DIFERENCIA */}
      {/* ========================================================================= */}
      {stage === "27_damage" && (
        <View style={styles.screenWrapper}>
          <View style={styles.topNavHeader}>
            <TouchableOpacity onPress={() => setStage("26_compare")}>
              <Icon name="arrow-left" size={22} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topNavTitle}>Reportar una diferencia</Text>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.damageSection}>
              <Text style={styles.damageSectionTitle}>Tipo de diferencia</Text>
              <View style={styles.damagePillsRow}>
                {["Rayón", "Golpe", "Vidrio", "Neumático", "Interior", "Falta combustible"].map((type) => {
                  const isSel = damageType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.damagePill, isSel && styles.damagePillSelected]}
                      onPress={() => setDamageType(type)}
                    >
                      <Text style={[styles.damagePillText, isSel && styles.damagePillTextSelected]}>{type}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.damageSection}>
              <Text style={styles.damageSectionTitle}>Qué pasó</Text>
              <View style={styles.damageInputBox}>
                <TextInput
                  style={styles.damageTextInput}
                  value={damageDesc}
                  onChangeText={setDamageDesc}
                  placeholder="Describe la diferencia encontrada"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </View>
            </View>

            <View style={styles.yellowHoldNotice}>
              <Text style={styles.yellowHoldTitle}>La garantía sigue retenida</Text>
              <Text style={styles.yellowHoldDesc}>
                Este reporte queda como nota del checklist de devolución para respaldar el cargo correspondiente.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={[styles.dangerBtn, enviandoChecklist && styles.btnDisabled]}
              onPress={() => enviarChecklist(`[${damageType}] ${damageDesc}`.trim())}
              disabled={enviandoChecklist}
              activeOpacity={0.85}
            >
              {enviandoChecklist ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.dangerBtnText}>Enviar el reporte y cerrar</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={() => setStage("26_compare")}>
              <Text style={styles.linkBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 28: DEVOLUCIÓN CONFIRMADA Y GARANTÍA */}
      {/* ========================================================================= */}
      {stage === "28_done" && (
        <View style={styles.screenWrapper}>
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.finalCenterContent}>
            <View style={styles.successCheckCircle}>
              <Icon name="check" size={38} color={colors.success} strokeWidth={2.4} />
            </View>

            <View style={styles.centerTextBox}>
              <Text style={styles.largeHeroTitle}>Devolución confirmada</Text>
              <Text style={styles.heroSubText}>El arriendo quedó cerrado y liquidado.</Text>
            </View>

            <View style={styles.guaranteeFinalCard}>
              <View style={styles.guaranteeFinalHeader}>
                <Text style={styles.guaranteeFinalLabel}>Liquidación para ti</Text>
                <View style={styles.liberadaBadge}>
                  <Text style={styles.liberadaBadgeText}>Pendiente de pago</Text>
                </View>
              </View>
              <View style={styles.guaranteeFinalRow}>
                <Text style={styles.guaranteeFinalLabel}>Monto</Text>
                <Text style={styles.guaranteeFinalValBold}>
                  ${(resultadoChecklist?.liquidacion_dueno || 0).toLocaleString("es-CL")}
                </Text>
              </View>
              {resultadoChecklist?.cargo_limpieza > 0 && (
                <View style={styles.guaranteeFinalRow}>
                  <Text style={styles.guaranteeFinalLabel}>Cargo limpieza</Text>
                  <Text style={styles.guaranteeFinalVal}>${resultadoChecklist.cargo_limpieza.toLocaleString("es-CL")}</Text>
                </View>
              )}
              {resultadoChecklist?.cargo_combustible > 0 && (
                <View style={styles.guaranteeFinalRow}>
                  <Text style={styles.guaranteeFinalLabel}>Cargo combustible</Text>
                  <Text style={styles.guaranteeFinalVal}>${resultadoChecklist.cargo_combustible.toLocaleString("es-CL")}</Text>
                </View>
              )}
              <Text style={styles.guaranteeFinalBankNote}>
                La garantía se libera al cliente tras esta inspección de devolución.
              </Text>
            </View>

            {reserva?.cliente_id && (
              <View style={styles.ratingCard}>
                {calificacionEnviada ? (
                  <Text style={styles.ratingSentText}>¡Gracias por calificar al cliente!</Text>
                ) : (
                  <>
                    <Text style={styles.ratingTitle}>¿Cómo fue tu experiencia con el cliente?</Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <TouchableOpacity key={n} onPress={() => setPuntajeCliente(n)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                          <Icon
                            name="star"
                            size={30}
                            color={n <= puntajeCliente ? colors.warning : colors.border}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={styles.ratingCommentInput}
                      placeholder="Comentario opcional"
                      placeholderTextColor={colors.textMuted}
                      value={comentarioCliente}
                      onChangeText={setComentarioCliente}
                    />
                    <TouchableOpacity
                      style={[styles.ratingSubmitBtn, (!puntajeCliente || enviandoCalificacion) && styles.btnDisabled]}
                      onPress={handleCalificarCliente}
                      disabled={!puntajeCliente || enviandoCalificacion}
                    >
                      {enviandoCalificacion ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.ratingSubmitBtnText}>Enviar calificación</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onCompleteDelivery}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgDark: {
    backgroundColor: colors.darkBg,
  },
  bgLight: {
    backgroundColor: colors.background,
  },
  screenWrapper: {
    flex: 1,
    flexDirection: "column",
  },
  bodyScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 24,
  },
  finalCenterContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: "center",
    gap: 20,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  perfilFoto: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: "center",
  },

  // Cam Header
  camTopArea: {
    padding: 16,
    gap: 12,
    backgroundColor: colors.darkBg,
  },
  camHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  camVehicleTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  camFraction: {
    fontSize: 14,
    fontFamily: "monospace",
    color: "#92E3CB",
  },
  camBarsRow: {
    flexDirection: "row",
    gap: 5,
  },
  camBarSegment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
  },
  barCompleted: {
    backgroundColor: colors.accent,
  },
  barActive: {
    backgroundColor: "#FFFFFF",
  },
  barPending: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  anglePillsRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  anglePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  pillPast: {
    backgroundColor: "rgba(47, 191, 155, 0.16)",
  },
  pillCurrent: {
    backgroundColor: "#FFFFFF",
  },
  pillFuture: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  anglePillText: {
    fontSize: 13,
  },
  pillTextPast: {
    color: "#92E3CB",
    fontWeight: "500",
  },
  pillTextCurrent: {
    color: colors.primary900,
    fontWeight: "600",
  },
  pillTextFuture: {
    color: "rgba(255, 255, 255, 0.7)",
  },

  // Cam Viewfinder
  camViewfinderArea: {
    flex: 1,
    backgroundColor: colors.darkSurface,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  viewfinderGuideBox: {
    position: "absolute",
    top: 24,
    bottom: 24,
    left: 20,
    right: 20,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.55)",
    borderStyle: "dashed",
    borderRadius: 16,
  },
  viewfinderBadgeTop: {
    position: "absolute",
    top: 22,
    backgroundColor: "rgba(6, 30, 31, 0.82)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  viewfinderBadgeText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  viewfinderPromptBottom: {
    position: "absolute",
    bottom: 22,
    left: 20,
    right: 20,
    backgroundColor: "rgba(6, 30, 31, 0.82)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  viewfinderPromptText: {
    color: "#DCEFEC",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  // Cam Shutter
  camShutterBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: colors.darkBg,
    gap: 12,
  },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skipPhotoText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#92E3CB",
  },
  camShutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  camShutterInnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: colors.darkBg,
  },
  miniThumbCounter: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary500,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    padding: 4,
  },
  thumbCounterText: {
    fontFamily: "monospace",
    fontSize: 10,
    backgroundColor: "#FFFFFF",
    color: colors.darkBg,
    paddingHorizontal: 4,
    borderRadius: 4,
    fontWeight: "700",
  },
  camShutterNote: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
  },

  // Top Nav Header
  topNavHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  topNavHeaderBetween: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  topNavTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },

  // Notices
  warningNoticeRow: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  warningNoticeDesc: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.warningText,
  },
  blueNoticeRow: {
    backgroundColor: colors.primary100,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  blueNoticeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary700,
  },

  // Photo Grid
  photoGrid2x4: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  gridPhotoCard: {
    width: "48%",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  gridPhotoThumb: {
    height: 72,
    width: "100%",
    backgroundColor: colors.surfaceSecondary,
  },
  gridPhotoFooter: {
    padding: 8,
    backgroundColor: colors.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gridPhotoName: {
    fontSize: 13,
    color: colors.text,
  },
  checkBadge: {
    color: colors.accent,
    fontWeight: "700",
  },

  // Inputs & Metrics
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  kmInputRow: {
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    boxShadow: "0 0 0 4px #E4F8F2",
  },
  kmTextInput: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  kmSuffix: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: "500",
  },
  fuelButtonsRow: {
    flexDirection: "row",
    gap: 6,
  },
  fuelLevelBtn: {
    flex: 1,
    height: 58,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  fuelLevelBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  fuelLevelText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textMuted,
  },
  fuelLevelTextActive: {
    color: "#FFFFFF",
  },
  fuelSubText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  fuelSubTextActive: {
    color: "#DCEFEC",
  },

  // Facial Verification
  contractSummaryBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  contractBoxTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  contractRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 14,
  },
  contractLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  contractVal: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
  },
  tableroInstruction: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  faceCamContainer: {
    height: 240,
    backgroundColor: colors.primary800,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 12,
  },
  faceCamCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: "rgba(146, 227, 203, 0.7)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary900,
  },
  faceCamTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  faceCamDesc: {
    fontSize: 13,
    color: colors.accent300,
    textAlign: "center",
    maxWidth: 240,
    lineHeight: 18,
  },
  signFooterDisclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },

  // Final Confirmation Center
  successCheckCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent100,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  centerTextBox: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  largeHeroTitle: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.text,
    textAlign: "center",
  },
  heroSubText: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: "center",
  },

  cardDetailBox: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  cardDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardDetailLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  cardDetailMono: {
    fontFamily: "monospace",
    fontSize: 14,
    color: colors.text,
  },
  cardDetailVal: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
  },
  guaranteeHoldText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.warningText,
  },

  deltaCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deltaTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  deltaSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Damage reporting
  damageSection: {
    gap: 8,
  },
  damageSectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  damagePillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  damagePill: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  damagePillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  damagePillText: {
    fontSize: 14,
    color: colors.text,
  },
  damagePillTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  damageInputBox: {
    minHeight: 76,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
  },
  damageTextInput: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  yellowHoldNotice: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  yellowHoldTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.warningText,
  },
  yellowHoldDesc: {
    fontSize: 14,
    color: colors.warningText,
    lineHeight: 20,
  },
  dangerBtn: {
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  dangerLinkBtn: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerLinkBtnText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "600",
  },

  // Pantalla 28 Cards
  guaranteeFinalCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  guaranteeFinalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  guaranteeFinalLabel: {
    fontSize: 15,
    color: colors.textMuted,
  },
  liberadaBadge: {
    backgroundColor: colors.accent100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  liberadaBadgeText: {
    color: colors.accent800,
    fontSize: 13,
    fontWeight: "600",
  },
  guaranteeFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  guaranteeFinalValBold: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  guaranteeFinalVal: {
    fontSize: 15,
    color: colors.text,
  },
  guaranteeFinalBankNote: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  ratingCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    gap: 12,
    alignItems: "center",
  },
  ratingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  starsRow: {
    flexDirection: "row",
    gap: 6,
  },
  ratingCommentInput: {
    width: "100%",
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.text,
  },
  ratingSubmitBtn: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingSubmitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  ratingSentText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.success,
  },

  // Bottom Action Bars
  bottomFixedBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  linkBtn: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  linkBtnText: {
    color: colors.accentDark,
    fontSize: 15,
    fontWeight: "600",
  },
});
