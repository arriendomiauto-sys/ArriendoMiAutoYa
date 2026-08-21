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
} from "react-native";
import { colors } from "../../theme/colors";
import { Icon } from "../../components/Icon";

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

  return (
    <SafeAreaView
      style={[
        styles.container,
        stage === "20_camera" || stage === "25_return_cam"
          ? styles.bgDark
          : styles.bgLight,
      ]}
    >
      <StatusBar
        barStyle={
          stage === "20_camera" || stage === "25_return_cam"
            ? "light-content"
            : "dark-content"
        }
      />

      {/* ========================================================================= */}
      {/* PANTALLA 20: CHECKLIST DE ENTREGA — CÁMARA GUIADA */}
      {/* ========================================================================= */}
      {stage === "20_camera" && (
        <View style={styles.screenWrapper}>
          <View style={styles.camTopArea}>
            <View style={styles.camHeaderRow}>
              <TouchableOpacity onPress={onBack}>
                <Icon name="x" size={22} color="#FFFFFF" />
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.anglePillsRow}>
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

              <View style={styles.miniThumbCounter}>
                <Text style={styles.thumbCounterText}>{currentAngleIdx}</Text>
              </View>
            </View>
            <Text style={styles.camShutterNote}>
              Puede volver a cualquier foto antes de confirmar
            </Text>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 21: REVISIÓN DE FOTOS — AVISA, NO BLOQUEA */}
      {/* ========================================================================= */}
      {stage === "21_review" && (
        <View style={styles.screenWrapper}>
          <View style={styles.topNavHeader}>
            <TouchableOpacity onPress={() => setStage("20_camera")}>
              <Icon name="arrow-left" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topNavTitle}>Revise las 8 fotos</Text>
          </View>

          <ScrollView contentContainerStyle={styles.reviewBody} showsVerticalScrollIndicator={false}>
            {/* Warning notice */}
            <View style={styles.warningNoticeRow}>
              <Icon name="alert-circle" size={20} color="#D97706" style={{ marginRight: 10 }} />
              <Text style={styles.warningNoticeDesc}>
                La foto del maletero salió oscura. Puede repetirla o dejarla así.
              </Text>
            </View>

            {/* 2x4 Photo Grid */}
            <View style={styles.photoGrid2x4}>
              {ANGLES.map((a) => {
                const isDarkNotice = a.name === "Maletero";
                return (
                  <View
                    key={a.id}
                    style={[
                      styles.gridPhotoCard,
                      isDarkNotice && styles.gridCardWarning,
                    ]}
                  >
                    <View
                      style={[
                        styles.gridPhotoThumb,
                        isDarkNotice && styles.gridPhotoThumbDark,
                      ]}
                    >
                      {isDarkNotice && <Text style={styles.darkTagText}>oscura</Text>}
                    </View>
                    <View style={styles.gridPhotoMeta}>
                      <Text style={styles.gridPhotoName}>{a.name}</Text>
                      {isDarkNotice ? (
                        <Text style={styles.repeatText}>Repetir</Text>
                      ) : (
                        <Text style={styles.checkDoneText}>✓</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footerBarStacked}>
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
                setCurrentAngleIdx(6);
                setStage("20_camera");
              }}
              activeOpacity={0.8}
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
              <Icon name="arrow-left" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topNavTitle}>Kilometraje y combustible</Text>
          </View>

          <ScrollView contentContainerStyle={styles.metricsBody} showsVerticalScrollIndicator={false}>
            <View style={styles.odometerPhotoCard}>
              <View style={styles.odometerPhotoThumb}>
                <Text style={styles.odometerPhotoText}>foto del tablero</Text>
              </View>
              <Text style={styles.odometerPhotoHelp}>Copie los datos desde esta foto.</Text>
            </View>

            {/* Kilometraje Input */}
            <View style={styles.metricGroup}>
              <Text style={styles.metricLabel}>KILOMETRAJE</Text>
              <View style={styles.kmInputBox}>
                <TextInput
                  style={styles.kmInput}
                  value={km}
                  onChangeText={setKm}
                  keyboardType="numeric"
                />
                <Text style={styles.kmSuffix}>km</Text>
              </View>
            </View>

            {/* Combustible Quarters Selector */}
            <View style={styles.metricGroup}>
              <Text style={styles.metricLabel}>COMBUSTIBLE</Text>
              <View style={styles.fuelBoxesRow}>
                {[
                  { label: "E", sub: "vacío" },
                  { label: "¼" },
                  { label: "½" },
                  { label: "¾" },
                  { label: "F", sub: "lleno" },
                ].map((item) => {
                  const isSelected = fuelLevel === item.label;
                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={[
                        styles.fuelBox,
                        isSelected && styles.fuelBoxSelected,
                      ]}
                      onPress={() => setFuelLevel(item.label)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.fuelBoxLabel,
                          isSelected && styles.fuelBoxLabelSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.sub && (
                        <Text
                          style={[
                            styles.fuelBoxSub,
                            isSelected && styles.fuelBoxSubSelected,
                          ]}
                        >
                          {item.sub}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.fuelPolicyCard}>
              <Text style={styles.fuelPolicyTitle}>Se devuelve con ¾ de tanque</Text>
              <Text style={styles.fuelPolicyDesc}>
                Si vuelve con menos, se descuenta de la garantía según el precio de bencina del día.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footerBar}>
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
                <Icon name="arrow-left" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.topNavTitle}>Firma del contrato</Text>
            </View>
            <Text style={styles.topFraction}>2 / 2</Text>
          </View>

          <ScrollView contentContainerStyle={styles.signatureBody} showsVerticalScrollIndicator={false}>
            <View style={styles.handoverNotice}>
              <Icon name="shield" size={20} color={colors.primary} style={{ marginRight: 10 }} />
              <Text style={styles.handoverNoticeText}>
                Ahora firma <Text style={{ fontWeight: "700" }}>Camila Aravena</Text>, la arrendataria. Pásele el teléfono.
              </Text>
            </View>

            <View style={styles.contractSummaryCard}>
              <Text style={styles.contractSummaryTitle}>Contrato de arriendo · BBFK-42</Text>
              <View style={styles.contractSummaryRow}>
                <Text style={styles.contractLabel}>Del 12 al 16 de agosto</Text>
                <Text style={styles.contractVal}>4 días</Text>
              </View>
              <View style={styles.contractSummaryRow}>
                <Text style={styles.contractLabel}>Kilometraje de salida</Text>
                <Text style={styles.contractVal}>48.320 km</Text>
              </View>
              <View style={styles.contractSummaryRow}>
                <Text style={styles.contractLabel}>Garantía retenida</Text>
                <Text style={styles.contractVal}>$150.000</Text>
              </View>
              <Text style={styles.readContractLink}>Leer el contrato completo</Text>
            </View>

            <View style={styles.darkFaceCamCanvas}>
              <View style={styles.faceCamCircle}>
                <Text style={styles.faceCamCircleText}>cámara frontal</Text>
              </View>
              <Text style={styles.faceCamTitle}>Mire a la cámara sin lentes</Text>
              <Text style={styles.faceCamSub}>
                Su rostro se compara con la cédula verificada al registrarse.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footerBarStacked}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setStage("24_signed")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Firmar y entregar las llaves</Text>
            </TouchableOpacity>
            <Text style={styles.signDisclaimerText}>
              Al firmar acepta el estado registrado en las 8 fotos.
            </Text>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 24: CONTRATO FIRMADO / ENTREGA EXITOSA */}
      {/* ========================================================================= */}
      {stage === "24_signed" && (
        <View style={styles.screenWrapper}>
          <ScrollView contentContainerStyle={styles.signedBody} showsVerticalScrollIndicator={false}>
            <View style={styles.successCheckCircle}>
              <Icon name="check" size={38} color="#197A63" />
            </View>

            <View style={styles.textBoxCenter}>
              <Text style={styles.signedMainTitle}>Contrato firmado</Text>
              <Text style={styles.signedMainSub}>
                El arriendo está en curso. Camila tiene el auto hasta el sábado 16 a las 18:00.
              </Text>
            </View>

            <View style={styles.contractSpecsBox}>
              <View style={styles.contractSpecRow}>
                <Text style={styles.contractSpecLabel}>Contrato</Text>
                <Text style={styles.contractSpecCode}>AMY-2026-04871</Text>
              </View>
              <View style={styles.contractSpecRow}>
                <Text style={styles.contractSpecLabel}>Firmado</Text>
                <Text style={styles.contractSpecVal}>12 ago · 09:53</Text>
              </View>
              <View style={styles.contractSpecRow}>
                <Text style={styles.contractSpecLabel}>Registro fotográfico</Text>
                <Text style={styles.contractSpecVal}>8 fotos</Text>
              </View>
              <View style={[styles.contractSpecRow, styles.contractSpecDivider]}>
                <Text style={styles.contractSpecLabel}>Garantía</Text>
                <Text style={styles.contractSpecGuarantee}>$150.000 retenidos</Text>
              </View>
            </View>

            <View style={styles.returnNoticeYellowBox}>
              <Text style={styles.returnNoticeYellowText}>
                La devolución es el sábado 16 a las 18:00 en Av. Providencia 2145. Le avisaremos una hora antes.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footerBarStacked}>
            <TouchableOpacity
              style={styles.secondaryBtnPdf}
              onPress={() => setStage("25_return_cam")}
              activeOpacity={0.85}
            >
              <Icon name="document" size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.secondaryBtnPdfText}>Ver el PDF del contrato</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setStage("25_return_cam")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Simular Día de Devolución</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 25: CHECKLIST DE DEVOLUCIÓN — FOTO ORIGINAL AL LADO */}
      {/* ========================================================================= */}
      {stage === "25_return_cam" && (
        <View style={styles.screenWrapper}>
          <View style={styles.camTopArea}>
            <View style={styles.camHeaderRow}>
              <TouchableOpacity onPress={() => setStage("24_signed")}>
                <Icon name="x" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.camVehicleTitle}>Devolución · Suzuki Swift</Text>
              <Text style={styles.camFraction}>5 / 8</Text>
            </View>

            <View style={styles.camBarsRow}>
              <View style={[styles.camBarSegment, styles.barCompleted]} />
              <View style={[styles.camBarSegment, styles.barCompleted]} />
              <View style={[styles.camBarSegment, styles.barCompleted]} />
              <View style={[styles.camBarSegment, styles.barCompleted]} />
              <View style={[styles.camBarSegment, styles.barActive]} />
              <View style={[styles.camBarSegment, styles.barPending]} />
              <View style={[styles.camBarSegment, styles.barPending]} />
              <View style={[styles.camBarSegment, styles.barPending]} />
            </View>
          </View>

          <View style={styles.camViewfinderArea}>
            <View style={styles.viewfinderGuideBox} />
            <View style={styles.viewfinderBadgeTop}>
              <Text style={styles.viewfinderBadgeText}>Asientos delanteros</Text>
            </View>

            {/* Thumbnail showing original photo */}
            <View style={styles.originalThumbOverlay}>
              <View style={styles.originalThumbImg} />
              <View style={styles.originalThumbTag}>
                <Text style={styles.originalThumbTagText}>Cómo estaba el 12 ago</Text>
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
              <Icon name="arrow-left" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topNavTitle}>Entrega vs. devolución</Text>
          </View>

          <ScrollView contentContainerStyle={styles.compareBody} showsVerticalScrollIndicator={false}>
            <View style={styles.compareDateLabels}>
              <Text style={styles.compareDateText}>12 ago · entrega</Text>
              <Text style={styles.compareDateText}>16 ago · devolución</Text>
            </View>

            {/* Frontal comparison */}
            <View style={styles.comparePairGroup}>
              <View style={styles.compareThumbsRow}>
                <View style={styles.compareThumb} />
                <View style={styles.compareThumb} />
              </View>
              <View style={styles.compareMetaRow}>
                <Text style={styles.compareAngleName}>Frontal</Text>
                <Text style={styles.noDiffText}>Sin diferencias</Text>
              </View>
            </View>

            {/* Lateral Izq comparison (with marked difference) */}
            <View style={styles.comparePairGroup}>
              <View style={styles.compareThumbsRow}>
                <View style={styles.compareThumb} />
                <View style={[styles.compareThumb, styles.compareThumbDamaged]}>
                  <View style={styles.damageBoxOutline} />
                </View>
              </View>
              <View style={styles.compareMetaRow}>
                <Text style={styles.compareAngleName}>Lateral izquierdo</Text>
                <Text style={styles.markedByOwnerText}>Marcada por el dueño</Text>
              </View>
            </View>

            {/* Trasera comparison */}
            <View style={styles.comparePairGroup}>
              <View style={styles.compareThumbsRow}>
                <View style={styles.compareThumb} />
                <View style={styles.compareThumb} />
              </View>
              <View style={styles.compareMetaRow}>
                <Text style={styles.compareAngleName}>Trasera</Text>
                <Text style={styles.noDiffText}>Sin diferencias</Text>
              </View>
            </View>

            {/* Kilometraje Delta */}
            <View style={styles.deltaCard}>
              <View>
                <Text style={styles.deltaTitle}>Kilometraje</Text>
                <Text style={styles.deltaSub}>48.320 → 48.941</Text>
              </View>
              <Text style={styles.deltaValue}>+621 km</Text>
            </View>

            {/* Combustible Delta */}
            <View style={styles.deltaCard}>
              <View>
                <Text style={styles.deltaTitle}>Combustible</Text>
                <Text style={styles.deltaSub}>¾ → ½</Text>
              </View>
              <Text style={styles.deltaWarningVal}>Falta ¼</Text>
            </View>
          </ScrollView>

          <View style={styles.footerBarStacked}>
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
              <Icon name="arrow-left" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topNavTitle}>Reportar una diferencia</Text>
          </View>

          <ScrollView contentContainerStyle={styles.damageBody} showsVerticalScrollIndicator={false}>
            <View style={styles.damagePhotoCard}>
              <View style={styles.damagePhotoCanvas}>
                <View style={styles.damageTapMarker} />
              </View>
              <Text style={styles.damagePhotoHelp}>
                Lateral izquierdo · toque la foto para marcar la zona
              </Text>
            </View>

            <View style={styles.damageSection}>
              <Text style={styles.damageSectionTitle}>TIPO DE DIFERENCIA</Text>
              <View style={styles.damagePillsRow}>
                {["Rayón", "Golpe", "Vidrio", "Neumático", "Interior", "Falta combustible"].map(
                  (type) => {
                    const isSelected = damageType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.damagePill,
                          isSelected && styles.damagePillSelected,
                        ]}
                        onPress={() => setDamageType(type)}
                      >
                        <Text
                          style={[
                            styles.damagePillText,
                            isSelected && styles.damagePillTextSelected,
                          ]}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>
            </View>

            <View style={styles.damageSection}>
              <Text style={styles.damageSectionTitle}>QUÉ PASÓ</Text>
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

          <View style={styles.footerBarStacked}>
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
              activeOpacity={0.8}
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
          <ScrollView contentContainerStyle={styles.finalDoneBody} showsVerticalScrollIndicator={false}>
            <View style={styles.successCheckCircle}>
              <Icon name="check" size={38} color="#197A63" />
            </View>

            <View style={styles.textBoxCenter}>
              <Text style={styles.signedMainTitle}>Devolución confirmada</Text>
              <Text style={styles.signedMainSub}>
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

            {/* Rating Widget */}
            <View style={styles.ratingWidgetCard}>
              <Text style={styles.ratingWidgetTitle}>¿Cómo fue con Rodrigo?</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    activeOpacity={0.8}
                  >
                    <Icon
                      name="star"
                      size={34}
                      color={star <= rating ? "#2FBF9B" : "#C2DBDB"}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footerBarStacked}>
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
    backgroundColor: "#061E1F",
  },
  bgLight: {
    backgroundColor: colors.background,
  },
  screenWrapper: {
    flex: 1,
    justifyContent: "space-between",
  },
  camTopArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 12,
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
    fontFamily: "monospace",
    fontSize: 14,
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
    backgroundColor: "#2FBF9B",
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
    paddingTop: 2,
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
  },
  pillTextCurrent: {
    color: "#061E1F",
    fontWeight: "600",
  },
  pillTextFuture: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  camViewfinderArea: {
    flex: 1,
    backgroundColor: "#0E3736",
    borderRadius: 20,
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
  },
  viewfinderGuideBox: {
    ...StyleSheet.absoluteFillObject,
    margin: 20,
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
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  viewfinderPromptBottom: {
    position: "absolute",
    bottom: 22,
    left: 20,
    right: 20,
    backgroundColor: "rgba(6, 30, 31, 0.82)",
    padding: 12,
    borderRadius: 12,
  },
  viewfinderPromptText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#DCEFEC",
    textAlign: "center",
  },
  originalThumbOverlay: {
    position: "absolute",
    bottom: 22,
    right: 20,
    width: 132,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  originalThumbImg: {
    height: 70,
    backgroundColor: colors.primary100,
  },
  originalThumbTag: {
    backgroundColor: "rgba(6, 30, 31, 0.92)",
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  originalThumbTagText: {
    fontSize: 12,
    color: "#92E3CB",
  },
  camShutterBar: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 16,
    backgroundColor: "#061E1F",
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
    borderColor: "#061E1F",
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
    color: "#061E1F",
    paddingHorizontal: 3,
    borderRadius: 4,
  },
  camShutterNote: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
  },
  topNavHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topNavHeaderBetween: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topNavTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  topFraction: {
    fontFamily: "monospace",
    fontSize: 13,
    color: colors.textMuted,
  },
  reviewBody: {
    padding: 20,
    gap: 16,
  },
  warningNoticeRow: {
    backgroundColor: "#FFF8EC",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  warningNoticeDesc: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: "#8A5B0B",
  },
  photoGrid2x4: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  gridPhotoCard: {
    width: "48%",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridCardWarning: {
    borderWidth: 1.5,
    borderColor: "#D97706",
  },
  gridPhotoThumb: {
    height: 70,
    backgroundColor: colors.primary100,
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
  gridPhotoMeta: {
    padding: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gridPhotoName: {
    fontSize: 13,
    color: colors.text,
  },
  checkDoneText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2FBF9B",
  },
  repeatText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#D97706",
  },
  footerBarStacked: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  linkBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  linkBtnText: {
    color: colors.accent700,
    fontSize: 15,
    fontWeight: "600",
  },
  metricsBody: {
    padding: 20,
    gap: 24,
  },
  odometerPhotoCard: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  odometerPhotoThumb: {
    height: 130,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  odometerPhotoText: {
    fontFamily: "monospace",
    fontSize: 11,
    color: colors.textMuted,
  },
  odometerPhotoHelp: {
    padding: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  metricGroup: {
    gap: 8,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  kmInputBox: {
    height: 60,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  kmInput: {
    fontSize: 26,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  kmSuffix: {
    fontSize: 16,
    color: colors.textMuted,
  },
  fuelBoxesRow: {
    flexDirection: "row",
    gap: 8,
  },
  fuelBox: {
    flex: 1,
    height: 64,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  fuelBoxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  fuelBoxLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.textMuted,
  },
  fuelBoxLabelSelected: {
    color: "#FFFFFF",
  },
  fuelBoxSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  fuelBoxSubSelected: {
    color: "#FFFFFF",
  },
  fuelPolicyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  fuelPolicyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  fuelPolicyDesc: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  footerBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  signatureBody: {
    padding: 20,
    gap: 18,
  },
  handoverNotice: {
    backgroundColor: colors.primary100,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  handoverNoticeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
  },
  contractSummaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  contractSummaryTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  contractSummaryRow: {
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
  },
  readContractLink: {
    fontSize: 14,
    color: colors.accent700,
    fontWeight: "600",
    paddingTop: 4,
  },
  darkFaceCamCanvas: {
    height: 220,
    backgroundColor: "#0A2E2F",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 16,
  },
  faceCamCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: "rgba(146, 227, 203, 0.7)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  faceCamCircleText: {
    fontFamily: "monospace",
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.45)",
  },
  faceCamTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  faceCamSub: {
    fontSize: 13,
    color: "#92E3CB",
    textAlign: "center",
    lineHeight: 18,
  },
  signDisclaimerText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },
  signedBody: {
    padding: 24,
    alignItems: "center",
    gap: 22,
  },
  successCheckCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#E4F8F2",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  signedMainTitle: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: colors.text,
  },
  signedMainSub: {
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 25,
    textAlign: "center",
  },
  contractSpecsBox: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  contractSpecRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  contractSpecDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  contractSpecLabel: {
    fontSize: 15,
    color: colors.textMuted,
  },
  contractSpecCode: {
    fontFamily: "monospace",
    fontSize: 15,
    color: colors.text,
  },
  contractSpecVal: {
    fontSize: 15,
    color: colors.text,
  },
  contractSpecGuarantee: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8A5B0B",
  },
  returnNoticeYellowBox: {
    width: "100%",
    backgroundColor: "#FFF8EC",
    borderRadius: 12,
    padding: 14,
  },
  returnNoticeYellowText: {
    fontSize: 14,
    color: "#8A5B0B",
    lineHeight: 20,
  },
  secondaryBtnPdf: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnPdfText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "600",
  },
  compareBody: {
    padding: 20,
    gap: 12,
  },
  compareDateLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  compareDateText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  comparePairGroup: {
    gap: 6,
    marginBottom: 6,
  },
  compareThumbsRow: {
    flexDirection: "row",
    gap: 12,
  },
  compareThumb: {
    flex: 1,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.primary100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compareThumbDamaged: {
    borderWidth: 1.5,
    borderColor: "#DC2626",
    position: "relative",
  },
  damageBoxOutline: {
    position: "absolute",
    top: 26,
    left: 22,
    width: 44,
    height: 26,
    borderWidth: 2,
    borderColor: "#DC2626",
    borderRadius: 6,
  },
  compareMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  compareAngleName: {
    fontSize: 14,
    color: colors.text,
  },
  noDiffText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#197A63",
  },
  markedByOwnerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#DC2626",
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
  },
  deltaValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  deltaWarningVal: {
    fontSize: 15,
    fontWeight: "600",
    color: "#D97706",
  },
  dangerLinkBtn: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerLinkBtnText: {
    color: "#DC2626",
    fontSize: 15,
    fontWeight: "600",
  },
  damageBody: {
    padding: 20,
    gap: 12,
  },
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
    borderColor: "#DC2626",
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
    backgroundColor: "#FFF8EC",
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  yellowHoldTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8A5B0B",
  },
  yellowHoldDesc: {
    fontSize: 14,
    color: "#8A5B0B",
    lineHeight: 20,
  },
  dangerBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  finalDoneBody: {
    padding: 24,
    alignItems: "center",
    gap: 22,
  },
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
    backgroundColor: "#E4F8F2",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  liberadaBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#125A49",
  },
  guaranteeFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  guaranteeFinalValBold: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  guaranteeFinalVal: {
    fontSize: 15,
    color: colors.text,
  },
  guaranteeFinalBankNote: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  ratingWidgetCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  ratingWidgetTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  starsRow: {
    flexDirection: "row",
    gap: 8,
  },
});
