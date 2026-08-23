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
} from "react-native";
import { colors } from "../../../theme/colors";
import { Icon } from "../../../shared/components/Icon";

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

export function DeliveryScreen({ onBack, onCompleteDelivery }) {
  // Screen sub-state: '20_camera' | '21_review' | '22_metrics' | '23_signature' | '24_signed' | '25_return_cam' | '26_compare' | '27_damage' | '28_done'
  const [stage, setStage] = useState("20_camera");

  // Step 20 camera
  const [currentAngleIdx, setCurrentAngleIdx] = useState(2); // 3 of 8 (Trasera)

  // Step 22 metrics
  const [km, setKm] = useState("48.320");
  const [fuelLevel, setFuelLevel] = useState("¾");

  // Step 27 damage reporting
  const [damageType, setDamageType] = useState("Rayón");
  const [damageDesc, setDamageDesc] = useState(
    "Rayón de unos 15 cm en la puerta trasera izquierda. No estaba el día de la entrega."
  );

  // Step 28 rating
  const [rating, setRating] = useState(5);

  const angle = ANGLES[currentAngleIdx] || ANGLES[2];

  const isDarkScreen = stage === "20_camera" || stage === "25_return_cam";

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
      {/* PANTALLA 20: CHECKLIST DE ENTREGA — CÁMARA GUIADA */}
      {/* ========================================================================= */}
      {stage === "20_camera" && (
        <View style={styles.screenWrapper}>
          <View style={styles.camTopArea}>
            <View style={styles.camHeaderRow}>
              <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.camVehicleTitle}>Entrega · Suzuki Swift</Text>
              <Text style={styles.camFraction}>{currentAngleIdx + 1} / 8</Text>
            </View>

            {/* 8 Dot bars */}
            <View style={styles.camBarsRow}>
              {ANGLES.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.camBarSegment,
                    idx < currentAngleIdx
                      ? styles.barCompleted
                      : idx === currentAngleIdx
                      ? styles.barActive
                      : styles.barPending,
                  ]}
                />
              ))}
            </View>

            {/* Step Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.anglePillsRow}
            >
              {ANGLES.map((a, idx) => {
                const isPast = idx < currentAngleIdx;
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

          {/* Viewfinder with silhouette */}
          <View style={styles.camViewfinderArea}>
            <View style={styles.viewfinderGuideBox} />
            <View style={styles.viewfinderBadgeTop}>
              <Text style={styles.viewfinderBadgeText}>{angle.desc}</Text>
            </View>
            <View style={styles.viewfinderPromptBottom}>
              <Text style={styles.viewfinderPromptText}>
                Retroceda unos pasos hasta que entren las dos luces y la patente dentro de la guía.
              </Text>
            </View>
          </View>

          {/* Shutter Area */}
          <View style={styles.camShutterBar}>
            <View style={styles.shutterRow}>
              <TouchableOpacity onPress={() => setCurrentAngleIdx(Math.min(7, currentAngleIdx + 1))}>
                <Text style={styles.skipPhotoText}>Saltar esta foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.camShutterBtn}
                onPress={() => {
                  if (currentAngleIdx < 7) {
                    setCurrentAngleIdx(currentAngleIdx + 1);
                  } else {
                    setStage("21_review");
                  }
                }}
                activeOpacity={0.85}
              >
                <View style={styles.camShutterInnerCircle} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.miniThumbCounter}
                onPress={() => setStage("21_review")}
              >
                <Text style={styles.thumbCounterText}>{currentAngleIdx + 1}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.camShutterNote}>
              Puede volver a cualquier foto antes de confirmar
            </Text>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 21: REVISIÓN DE LAS 8 FOTOS */}
      {/* ========================================================================= */}
      {stage === "21_review" && (
        <View style={styles.screenWrapper}>
          <View style={styles.topNavHeader}>
            <TouchableOpacity onPress={() => setStage("20_camera")}>
              <Icon name="arrow-left" size={22} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topNavTitle}>Revise las 8 fotos</Text>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.warningNoticeRow}>
              <Icon name="alert" size={20} color={colors.warning} style={{ marginRight: 8 }} />
              <Text style={styles.warningNoticeDesc}>
                La foto del maletero salió oscura. Puede repetirla o dejarla así.
              </Text>
            </View>

            <View style={styles.photoGrid2x4}>
              {ANGLES.map((a) => {
                const isDark = a.name === "Maletero";
                return (
                  <View
                    key={a.id}
                    style={[styles.gridPhotoCard, isDark && styles.gridCardWarning]}
                  >
                    <View
                      style={[
                        styles.gridPhotoThumb,
                        isDark && styles.gridPhotoThumbDark,
                      ]}
                    >
                      {isDark && <Text style={styles.darkTagText}>oscura</Text>}
                    </View>
                    <View style={styles.gridPhotoFooter}>
                      <Text style={styles.gridPhotoName}>{a.name}</Text>
                      {isDark ? (
                        <Text style={styles.repeatBadge}>Repetir</Text>
                      ) : (
                        <Text style={styles.checkBadge}>✓</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setStage("22_metrics")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Continuar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => {
                setCurrentAngleIdx(6); // Maletero
                setStage("20_camera");
              }}
            >
              <Text style={styles.linkBtnText}>Repetir la del maletero</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 22: KILOMETRAJE Y COMBUSTIBLE */}
      {/* ========================================================================= */}
      {stage === "22_metrics" && (
        <View style={styles.screenWrapper}>
          <View style={styles.topNavHeader}>
            <TouchableOpacity onPress={() => setStage("21_review")}>
              <Icon name="arrow-left" size={22} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topNavTitle}>Kilometraje y combustible</Text>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.scrollContent}>
            {/* Foto del Tablero Preview */}
            <View style={styles.tableroCard}>
              <View style={styles.tableroMockPhoto}>
                <Icon name="camera" size={28} color={colors.textMuted} />
                <Text style={styles.mockPhotoText}>foto del tablero</Text>
              </View>
              <Text style={styles.tableroInstruction}>
                Copie los datos directamente desde esta foto.
              </Text>
            </View>

            {/* Input Km */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Kilometraje actual</Text>
              <View style={styles.kmInputRow}>
                <TextInput
                  style={styles.kmTextInput}
                  value={km}
                  onChangeText={setKm}
                  keyboardType="numeric"
                />
                <Text style={styles.kmSuffix}>km</Text>
              </View>
            </View>

            {/* Selector Combustible */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nivel de combustible</Text>
              <View style={styles.fuelButtonsRow}>
                {["E", "¼", "½", "¾", "F"].map((level) => {
                  const isSelected = fuelLevel === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.fuelLevelBtn,
                        isSelected && styles.fuelLevelBtnActive,
                      ]}
                      onPress={() => setFuelLevel(level)}
                    >
                      <Text
                        style={[
                          styles.fuelLevelText,
                          isSelected && styles.fuelLevelTextActive,
                        ]}
                      >
                        {level}
                      </Text>
                      {level === "E" && (
                        <Text style={[styles.fuelSubText, isSelected && styles.fuelSubTextActive]}>vacío</Text>
                      )}
                      {level === "F" && (
                        <Text style={[styles.fuelSubText, isSelected && styles.fuelSubTextActive]}>lleno</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Fuel Notice */}
            <View style={styles.cardInfoBox}>
              <Text style={styles.cardInfoTitle}>Se devuelve con {fuelLevel} de tanque</Text>
              <Text style={styles.cardInfoDesc}>
                Si vuelve con menos, se descuenta de la garantía según el precio de bencina del día.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setStage("23_signature")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Ir a la firma</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 23: FIRMA CON VERIFICACIÓN FACIAL */}
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
            <Text style={styles.stepFractionText}>2 / 2</Text>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.blueNoticeRow}>
              <Icon name="shield" size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.blueNoticeText}>
                Ahora firma <Text style={{ fontWeight: "700" }}>Camila Aravena</Text>, la arrendataria. Pásele el teléfono.
              </Text>
            </View>

            {/* Contract Summary Box */}
            <View style={styles.contractSummaryBox}>
              <Text style={styles.contractBoxTitle}>Contrato de arriendo · BBFK-42</Text>
              <View style={styles.contractRow}>
                <Text style={styles.contractLabel}>Del 12 al 16 de agosto</Text>
                <Text style={styles.contractVal}>4 días</Text>
              </View>
              <View style={styles.contractRow}>
                <Text style={styles.contractLabel}>Kilometraje de salida</Text>
                <Text style={styles.contractVal}>48.320 km</Text>
              </View>
              <View style={styles.contractRow}>
                <Text style={styles.contractLabel}>Garantía retenida</Text>
                <Text style={styles.contractVal}>$150.000</Text>
              </View>
              <TouchableOpacity style={{ marginTop: 4 }}>
                <Text style={styles.contractLink}>Leer el contrato completo</Text>
              </TouchableOpacity>
            </View>

            {/* Facial Verification Camera View */}
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
              style={styles.primaryBtn}
              onPress={() => setStage("24_signed")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Firmar y entregar las llaves</Text>
            </TouchableOpacity>
            <Text style={styles.signFooterDisclaimer}>
              Al firmar acepta el estado registrado en las 8 fotos.
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
                El arriendo está en curso. Camila tiene el auto hasta el sábado 16 a las 18:00.
              </Text>
            </View>

            <View style={styles.cardDetailBox}>
              <View style={styles.cardDetailRow}>
                <Text style={styles.cardDetailLabel}>Contrato</Text>
                <Text style={styles.cardDetailMono}>AMY-2026-04871</Text>
              </View>
              <View style={styles.cardDetailRow}>
                <Text style={styles.cardDetailLabel}>Firmado</Text>
                <Text style={styles.cardDetailVal}>12 ago · 09:53</Text>
              </View>
              <View style={styles.cardDetailRow}>
                <Text style={styles.cardDetailLabel}>Registro fotográfico</Text>
                <Text style={styles.cardDetailVal}>8 fotos</Text>
              </View>
              <View style={[styles.cardDetailRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
                <Text style={styles.cardDetailLabel}>Garantía</Text>
                <Text style={styles.guaranteeHoldText}>$150.000 retenidos</Text>
              </View>
            </View>

            <View style={styles.yellowReminderBox}>
              <Text style={styles.yellowReminderText}>
                La devolución es el sábado 16 a las 18:00 en Av. Providencia 2145. Le avisaremos una hora antes.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setStage("25_return_cam")}
              activeOpacity={0.85}
            >
              <Icon name="document" size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.secondaryBtnText}>Ver el PDF del contrato</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setStage("25_return_cam")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Continuar a Devolución (Demo)</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 25: CHECKLIST DE DEVOLUCIÓN */}
      {/* ========================================================================= */}
      {stage === "25_return_cam" && (
        <View style={styles.screenWrapper}>
          <View style={styles.camTopArea}>
            <View style={styles.camHeaderRow}>
              <TouchableOpacity onPress={() => setStage("24_signed")}>
                <Icon name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.camVehicleTitle}>Devolución · Suzuki Swift</Text>
              <Text style={styles.camFraction}>5 / 8</Text>
            </View>

            <View style={styles.camBarsRow}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => (
                <View
                  key={idx}
                  style={[
                    styles.camBarSegment,
                    idx < 4 ? styles.barCompleted : idx === 4 ? styles.barActive : styles.barPending,
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.camViewfinderArea}>
            <View style={styles.viewfinderGuideBox} />
            <View style={styles.viewfinderBadgeTop}>
              <Text style={styles.viewfinderBadgeText}>Asientos delanteros</Text>
            </View>

            {/* Thumbnail comparison overlay */}
            <View style={styles.comparisonFloatingThumb}>
              <View style={styles.comparisonMockImg} />
              <View style={styles.comparisonTag}>
                <Text style={styles.comparisonTagText}>Cómo estaba el 12 ago</Text>
              </View>
            </View>
          </View>

          <View style={styles.camShutterBar}>
            <View style={styles.shutterRow}>
              <TouchableOpacity onPress={() => setStage("26_compare")}>
                <Text style={styles.skipPhotoText}>Saltar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.camShutterBtn}
                onPress={() => setStage("26_compare")}
                activeOpacity={0.85}
              >
                <View style={styles.camShutterInnerCircle} />
              </TouchableOpacity>

              <View style={styles.miniThumbCounter}>
                <Text style={styles.thumbCounterText}>4</Text>
              </View>
            </View>
            <Text style={styles.camShutterNote}>
              Repita el mismo ángulo que el día de la entrega
            </Text>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 26: COMPARACIÓN LADO A LADO */}
      {/* ========================================================================= */}
      {stage === "26_compare" && (
        <View style={styles.screenWrapper}>
          <View style={styles.topNavHeader}>
            <TouchableOpacity onPress={() => setStage("25_return_cam")}>
              <Icon name="arrow-left" size={22} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topNavTitle}>Entrega vs. devolución</Text>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.compareHeadersRow}>
              <Text style={styles.compareColHeader}>12 ago · entrega</Text>
              <Text style={styles.compareColHeader}>16 ago · devolución</Text>
            </View>

            {/* Comparison Item 1: Frontal */}
            <View style={styles.compareItemBox}>
              <View style={styles.comparePhotosRow}>
                <View style={styles.compareThumb} />
                <View style={styles.compareThumb} />
              </View>
              <View style={styles.compareStatusRow}>
                <Text style={styles.compareAngleName}>Frontal</Text>
                <Text style={styles.noDiffText}>Sin diferencias</Text>
              </View>
            </View>

            {/* Comparison Item 2: Lateral Izq with damage tag */}
            <View style={styles.compareItemBox}>
              <View style={styles.comparePhotosRow}>
                <View style={styles.compareThumb} />
                <View style={[styles.compareThumb, styles.compareThumbDamaged]}>
                  <View style={styles.damageBoxRedMarker} />
                </View>
              </View>
              <View style={styles.compareStatusRow}>
                <Text style={styles.compareAngleName}>Lateral izquierdo</Text>
                <Text style={styles.markedByOwnerText}>Marcada por el dueño</Text>
              </View>
            </View>

            {/* Comparison Item 3: Trasera */}
            <View style={styles.compareItemBox}>
              <View style={styles.comparePhotosRow}>
                <View style={styles.compareThumb} />
                <View style={styles.compareThumb} />
              </View>
              <View style={styles.compareStatusRow}>
                <Text style={styles.compareAngleName}>Trasera</Text>
                <Text style={styles.noDiffText}>Sin diferencias</Text>
              </View>
            </View>

            {/* Km Difference Card */}
            <View style={styles.deltaCard}>
              <View>
                <Text style={styles.deltaTitle}>Kilometraje</Text>
                <Text style={styles.deltaSub}>48.320 → 48.941</Text>
              </View>
              <Text style={styles.deltaValue}>+621 km</Text>
            </View>

            {/* Fuel Difference Card */}
            <View style={styles.deltaCard}>
              <View>
                <Text style={styles.deltaTitle}>Combustible</Text>
                <Text style={styles.deltaSub}>¾ → ½</Text>
              </View>
              <Text style={styles.deltaWarningVal}>Falta ¼</Text>
            </View>
          </ScrollView>

          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setStage("28_done")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Todo en orden, liberar garantía</Text>
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
            {/* Photo with damage tap marker */}
            <View style={styles.damagePhotoCard}>
              <View style={styles.damagePhotoCanvas}>
                <View style={styles.damageTapMarker} />
              </View>
              <Text style={styles.damagePhotoHelp}>
                Lateral izquierdo · toque la foto para marcar la zona
              </Text>
            </View>

            {/* Damage Type Pills */}
            <View style={styles.damageSection}>
              <Text style={styles.damageSectionTitle}>Tipo de diferencia</Text>
              <View style={styles.damagePillsRow}>
                {["Rayón", "Golpe", "Vidrio", "Neumático", "Interior", "Falta combustible"].map(
                  (type) => {
                    const isSel = damageType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[styles.damagePill, isSel && styles.damagePillSelected]}
                        onPress={() => setDamageType(type)}
                      >
                        <Text style={[styles.damagePillText, isSel && styles.damagePillTextSelected]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>
            </View>

            {/* Damage Description */}
            <View style={styles.damageSection}>
              <Text style={styles.damageSectionTitle}>Qué pasó</Text>
              <View style={styles.damageInputBox}>
                <TextInput
                  style={styles.damageTextInput}
                  value={damageDesc}
                  onChangeText={setDamageDesc}
                  multiline
                />
              </View>
            </View>

            <View style={styles.yellowHoldNotice}>
              <Text style={styles.yellowHoldTitle}>La garantía sigue retenida</Text>
              <Text style={styles.yellowHoldDesc}>
                Camila tiene 48 horas para responder. Si no hay acuerdo, revisamos el caso con las fotos de ambas partes.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={() => setStage("28_done")}
              activeOpacity={0.85}
            >
              <Text style={styles.dangerBtnText}>Enviar el reporte</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => setStage("26_compare")}
            >
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
            {/* Top Check Badge */}
            <View style={styles.successCheckCircle}>
              <Icon name="check" size={38} color={colors.success} strokeWidth={2.4} />
            </View>

            {/* Title & Subtitle */}
            <View style={styles.centerTextBox}>
              <Text style={styles.largeHeroTitle}>Devolución confirmada</Text>
              <Text style={styles.heroSubText}>
                Rodrigo revisó el auto y no reportó diferencias. El arriendo quedó cerrado.
              </Text>
            </View>

            {/* Guarantee Release Card */}
            <View style={styles.guaranteeFinalCard}>
              <View style={styles.guaranteeFinalHeader}>
                <Text style={styles.guaranteeFinalLabel}>Garantía</Text>
                <View style={styles.liberadaBadge}>
                  <Text style={styles.liberadaBadgeText}>Liberada</Text>
                </View>
              </View>
              <View style={styles.guaranteeFinalRow}>
                <Text style={styles.guaranteeFinalLabel}>Monto</Text>
                <Text style={styles.guaranteeFinalValBold}>$150.000</Text>
              </View>
              <View style={styles.guaranteeFinalRow}>
                <Text style={styles.guaranteeFinalLabel}>Descuentos</Text>
                <Text style={styles.guaranteeFinalVal}>$0</Text>
              </View>
              <Text style={styles.guaranteeFinalBankNote}>
                El banco puede tardar hasta 5 días hábiles en mostrar la liberación en su cupo.
              </Text>
            </View>

            {/* Rating Widget with Real SVG Stars */}
            <View style={styles.ratingWidgetCard}>
              <Text style={styles.ratingWidgetTitle}>¿Cómo fue con Rodrigo?</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Icon
                      name="star"
                      size={34}
                      color={star <= rating ? colors.accent : colors.primary200}
                      fill={star <= rating ? colors.accent : colors.primary100}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Bottom Fixed Action Bar */}
          <View style={styles.bottomFixedBar}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onCompleteDelivery}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Calificar a Rodrigo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkBtn}
              onPress={onCompleteDelivery}
              activeOpacity={0.8}
            >
              <Text style={styles.linkBtnText}>Ver el detalle del arriendo</Text>
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
  stepFractionText: {
    fontFamily: "monospace",
    fontSize: 13,
    color: colors.textMuted,
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
  gridCardWarning: {
    borderColor: colors.warning,
    borderWidth: 1.5,
  },
  gridPhotoThumb: {
    height: 72,
    backgroundColor: colors.surfaceSecondary,
  },
  gridPhotoThumbDark: {
    backgroundColor: "#4B5563",
    alignItems: "center",
    justifyContent: "center",
  },
  darkTagText: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "#D1D5DB",
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
  repeatBadge: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "600",
  },

  // Inputs & Metrics
  tableroCard: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tableroMockPhoto: {
    height: 120,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  mockPhotoText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: "monospace",
  },
  tableroInstruction: {
    padding: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
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
    fontSize: 24,
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
  cardInfoBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  cardInfoTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  cardInfoDesc: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
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
  contractLink: {
    fontSize: 14,
    color: colors.accentDark,
    fontWeight: "600",
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
  yellowReminderBox: {
    width: "100%",
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 12,
    padding: 14,
  },
  yellowReminderText: {
    fontSize: 14,
    color: colors.warningText,
    lineHeight: 20,
  },

  // Comparison View
  comparisonFloatingThumb: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 130,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  comparisonMockImg: {
    height: 70,
    backgroundColor: colors.surfaceSecondary,
  },
  comparisonTag: {
    backgroundColor: "rgba(6, 30, 31, 0.92)",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  comparisonTagText: {
    fontSize: 11,
    color: colors.accent300,
  },

  compareHeadersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  compareColHeader: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  compareItemBox: {
    gap: 8,
  },
  comparePhotosRow: {
    flexDirection: "row",
    gap: 12,
  },
  compareThumb: {
    flex: 1,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compareThumbDamaged: {
    borderColor: colors.danger,
    borderWidth: 1.5,
    position: "relative",
  },
  damageBoxRedMarker: {
    position: "absolute",
    top: 24,
    left: 20,
    width: 44,
    height: 26,
    borderWidth: 2,
    borderColor: colors.danger,
    borderRadius: 6,
  },
  compareStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  compareAngleName: {
    fontSize: 14,
    color: colors.text,
  },
  noDiffText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.success,
  },
  markedByOwnerText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.danger,
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
  deltaValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  deltaWarningVal: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.warning,
  },

  // Damage reporting
  damagePhotoCard: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  damagePhotoCanvas: {
    height: 110,
    backgroundColor: colors.primary100,
    position: "relative",
  },
  damageTapMarker: {
    position: "absolute",
    top: 34,
    left: 112,
    width: 64,
    height: 36,
    borderWidth: 2.5,
    borderColor: colors.danger,
    borderRadius: 8,
  },
  damagePhotoHelp: {
    padding: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
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
    height: 76,
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
  ratingWidgetCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  ratingWidgetTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 12,
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
  secondaryBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: colors.primary,
    fontSize: 15,
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
