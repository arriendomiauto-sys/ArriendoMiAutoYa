import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
} from "react-native";
import { colors, Icon } from "@rentacar/mobile-shared";

// Misma regla que app/services/pricing.py:PricingService.calcular_dias_reserva
// (redondeo hacia arriba, mínimo 1 día) — para que el total mostrado acá
// coincida con el monto_hold real que calculará el backend al reservar.
function calcularDias(fechaInicio, fechaFin) {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  if (isNaN(inicio) || isNaN(fin) || fin <= inicio) return 0;
  const ms = fin.getTime() - inicio.getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
}

function formatearFechaCorta(iso) {
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

function hoyISO(offsetDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return d.toISOString().split("T")[0];
}

const EQUIPAMIENTO_LABELS = {
  ac: "Aire acondicionado",
  bluetooth: "Bluetooth / CarPlay",
  camara_retroceso: "Cámara de retroceso",
  doble_traccion: "Tracción 4x4",
  isofix: "Anclajes ISOFIX",
};

export function CarDetailScreen({ car, onBack, onProceedToPayment }) {
  // Step: '11_detail' | '12_schedule' | '13_summary'
  const [currentStep, setCurrentStep] = useState("11_detail");

  const [fechaInicio, setFechaInicio] = useState(hoyISO(1));
  const [fechaFin, setFechaFin] = useState(hoyISO(4));
  const [horaRetiro, setHoraRetiro] = useState("10:00");
  const [horaDevolucion, setHoraDevolucion] = useState("18:00");
  const [dateError, setDateError] = useState(null);

  const tarifaDia = car?.tarifa_dia || 0;
  const dias = useMemo(() => calcularDias(fechaInicio, fechaFin), [fechaInicio, fechaFin]);
  const montoHold = tarifaDia * dias;

  const fotoPrincipal = car?.fotos?.[0];
  const nombreAuto = [car?.marca, car?.modelo, car?.anio].filter(Boolean).join(" ");
  const equipamientoActivo = Object.entries(car?.equipamiento || {})
    .filter(([, activo]) => activo)
    .map(([key]) => EQUIPAMIENTO_LABELS[key] || key);

  const handleContinuarAFechas = () => {
    setDateError(null);
    if (dias <= 0) {
      setDateError("La fecha de devolución debe ser posterior a la de retiro.");
      return;
    }
    setCurrentStep("13_summary");
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ========================================================================= */}
      {/* PANTALLA 11: FICHA DEL AUTO */}
      {/* ========================================================================= */}
      {currentStep === "11_detail" && (
        <View style={styles.screenWrapper}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Hero Photo */}
            <View style={styles.heroContainer}>
              <Image
                source={{
                  uri: fotoPrincipal || "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
                }}
                style={styles.heroImage}
                resizeMode="cover"
              />
              <TouchableOpacity style={styles.heroBackBtn} onPress={onBack}>
                <Icon name="arrow-left" size={20} color={colors.primary} />
              </TouchableOpacity>
              {car?.fotos?.length > 1 && (
                <View style={styles.paginationDots}>
                  {car.fotos.map((_, i) => (
                    <View key={i} style={[styles.dot, i === 0 ? styles.dotActive : styles.dotInactive]} />
                  ))}
                </View>
              )}
            </View>

            {/* Ficha Body */}
            <View style={styles.bodyContent}>
              <View style={styles.titleSection}>
                <Text style={styles.carName}>{nombreAuto || "Vehículo"}</Text>
                <Text style={styles.carSpecsSubtitle}>Patente {car?.patente || "—"}</Text>
              </View>

              {/* Pricing */}
              <View style={styles.pricingBoxesRow}>
                <View style={styles.pricingBox}>
                  <Text style={styles.pricingBoxLabel}>Día</Text>
                  <Text style={styles.pricingBoxValue}>${tarifaDia.toLocaleString("es-CL")}</Text>
                </View>
                <View style={styles.pricingBox}>
                  <Text style={styles.pricingBoxLabel}>Semana (aprox.)</Text>
                  <Text style={styles.pricingBoxValue}>${(tarifaDia * 7).toLocaleString("es-CL")}</Text>
                </View>
                <View style={styles.pricingBox}>
                  <Text style={styles.pricingBoxLabel}>Mes (aprox.)</Text>
                  <Text style={styles.pricingBoxValue}>${(tarifaDia * 30).toLocaleString("es-CL")}</Text>
                </View>
              </View>

              {/* Location */}
              <View style={styles.locationRow}>
                <Icon name="location" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                <Text style={styles.locationText}>{car?.ubicacion_base || "Ubicación no informada"}</Text>
              </View>

              {/* Equipamiento */}
              {equipamientoActivo.length > 0 && (
                <View style={styles.equipSection}>
                  <Text style={styles.sectionLabel}>EQUIPAMIENTO</Text>
                  <View style={styles.equipGrid}>
                    {equipamientoActivo.map((label) => (
                      <View key={label} style={styles.equipChip}>
                        <Icon name="check" size={12} color={colors.accent700} style={{ marginRight: 6 }} />
                        <Text style={styles.equipChipText}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.warningBoxNeutral}>
                <Text style={styles.warningDescNeutral}>
                  El retiro y la devolución se coordinan 100% digital: código QR y checklist fotográfico de 9 ángulos, sin mostrador.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Bar */}
          <View style={styles.bottomActionBar}>
            <View>
              <Text style={styles.bottomPriceValue}>${tarifaDia.toLocaleString("es-CL")}</Text>
              <Text style={styles.bottomPriceLabel}>por día</Text>
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setCurrentStep("12_schedule")}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>Elegir fechas</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 12: FECHAS Y HORARIOS */}
      {/* ========================================================================= */}
      {currentStep === "12_schedule" && (
        <View style={styles.screenWrapper}>
          <View style={styles.topHeaderNav}>
            <TouchableOpacity onPress={() => setCurrentStep("11_detail")}>
              <Icon name="arrow-left" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topHeaderNavTitle}>Fechas y horarios</Text>
          </View>

          <ScrollView contentContainerStyle={styles.scheduleBody} showsVerticalScrollIndicator={false}>
            <View style={styles.datesRow}>
              <View style={styles.dateGroup}>
                <Text style={styles.timeLabel}>RETIRO</Text>
                <TextInput
                  style={styles.dateInput}
                  value={fechaInicio}
                  onChangeText={setFechaInicio}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[styles.dateInput, { marginTop: 8 }]}
                  value={horaRetiro}
                  onChangeText={setHoraRetiro}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.dateGroup}>
                <Text style={styles.timeLabel}>DEVOLUCIÓN</Text>
                <TextInput
                  style={styles.dateInput}
                  value={fechaFin}
                  onChangeText={setFechaFin}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[styles.dateInput, { marginTop: 8 }]}
                  value={horaDevolucion}
                  onChangeText={setHoraDevolucion}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {dateError && (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>Fechas inválidas</Text>
                <Text style={styles.warningDesc}>{dateError}</Text>
              </View>
            )}

            {/* Subtotal Card */}
            <View style={styles.subtotalCard}>
              <View>
                <Text style={styles.subtotalTitle}>{dias > 0 ? `${dias} día${dias === 1 ? "" : "s"} de arriendo` : "Selecciona fechas válidas"}</Text>
                {dias > 0 && (
                  <Text style={styles.subtotalRange}>
                    {formatearFechaCorta(fechaInicio)} {horaRetiro} → {formatearFechaCorta(fechaFin)} {horaDevolucion}
                  </Text>
                )}
              </View>
              <Text style={styles.subtotalValue}>${montoHold.toLocaleString("es-CL")}</Text>
            </View>
          </ScrollView>

          <View style={styles.footerBar}>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={handleContinuarAFechas}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionBtnText}>Ver el resumen</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 13: RESUMEN DE LA RESERVA */}
      {/* ========================================================================= */}
      {currentStep === "13_summary" && (
        <View style={styles.screenWrapper}>
          <View style={styles.topHeaderNav}>
            <TouchableOpacity onPress={() => setCurrentStep("12_schedule")}>
              <Icon name="arrow-left" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.topHeaderNavTitle}>Resumen de la reserva</Text>
          </View>

          <ScrollView contentContainerStyle={styles.summaryBody} showsVerticalScrollIndicator={false}>
            {/* Auto Card Summary */}
            <View style={styles.carSummaryCard}>
              <View style={styles.carSummaryThumb}>
                <Image
                  source={{
                    uri: fotoPrincipal || "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
                  }}
                  style={styles.summaryCarImg}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryCarName}>{nombreAuto || "Vehículo"}</Text>
                <Text style={styles.summaryCarTime}>
                  {formatearFechaCorta(fechaInicio)} {horaRetiro} → {formatearFechaCorta(fechaFin)} {horaDevolucion}
                </Text>
                <Text style={styles.summaryCarLocation}>{car?.ubicacion_base}</Text>
              </View>
            </View>

            {/* Price Breakdown Table */}
            <View style={styles.breakdownCard}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Tarifa diaria</Text>
                <Text style={styles.breakdownValue}>${tarifaDia.toLocaleString("es-CL")}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Días de arriendo</Text>
                <Text style={styles.breakdownValue}>{dias}</Text>
              </View>
              <View style={[styles.breakdownRow, styles.breakdownDivider]}>
                <Text style={styles.breakdownTotalLabel}>Total retenido (hold)</Text>
                <Text style={styles.breakdownTotalValue}>${montoHold.toLocaleString("es-CL")}</Text>
              </View>
            </View>

            {/* Guarantee Hold Notice */}
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>No es un cobro inmediato</Text>
              <Text style={styles.warningDesc}>
                Se retiene una pre-autorización de ${montoHold.toLocaleString("es-CL")} en tu tarjeta. Se libera cuando el dueño confirme el estado del auto al devolverlo, descontando solo cargos justificados (limpieza, combustible, km extra).
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footerBar}>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() =>
                onProceedToPayment(car, {
                  fechaInicio: `${fechaInicio}T${horaRetiro}:00`,
                  fechaFin: `${fechaFin}T${horaDevolucion}:00`,
                  dias,
                  montoHold,
                })
              }
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionBtnText}>Ir a pagar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenWrapper: {
    flex: 1,
    justifyContent: "space-between",
  },
  scrollContent: {
    paddingBottom: 24,
  },
  heroContainer: {
    height: 232,
    backgroundColor: colors.primary100,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroBackBtn: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  paginationDots: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 999,
  },
  dotActive: {
    width: 20,
    backgroundColor: "#FFFFFF",
  },
  dotInactive: {
    width: 6,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  bodyContent: {
    padding: 20,
    gap: 16,
  },
  titleSection: {
    gap: 6,
  },
  carName: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: colors.text,
  },
  carSpecsSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  pricingBoxesRow: {
    flexDirection: "row",
    gap: 8,
  },
  pricingBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 2,
  },
  pricingBoxLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  pricingBoxValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    fontSize: 14,
    color: colors.textMuted,
    flex: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  equipSection: {
    gap: 8,
  },
  equipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  equipChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent100,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  equipChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.accent700,
  },
  warningBoxNeutral: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  warningDescNeutral: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  bottomActionBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 26,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  bottomPriceValue: {
    fontSize: 19,
    fontWeight: "600",
    color: colors.text,
  },
  bottomPriceLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  actionBtn: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  topHeaderNav: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topHeaderNavTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  scheduleBody: {
    padding: 20,
    gap: 18,
  },
  datesRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateGroup: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  dateInput: {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
  },
  warningBox: {
    backgroundColor: "#FFF8EC",
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8A5B0B",
  },
  warningDesc: {
    fontSize: 14,
    color: "#8A5B0B",
    lineHeight: 20,
  },
  subtotalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subtotalTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  subtotalRange: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  subtotalValue: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
  },
  footerBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryActionBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  summaryBody: {
    padding: 20,
    gap: 14,
  },
  carSummaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  carSummaryThumb: {
    width: 76,
    height: 58,
    borderRadius: 10,
    backgroundColor: colors.primary100,
    overflow: "hidden",
  },
  summaryCarImg: {
    width: "100%",
    height: "100%",
  },
  summaryCarName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  summaryCarTime: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  summaryCarLocation: {
    fontSize: 13,
    color: colors.textMuted,
  },
  breakdownCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 11,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 11,
  },
  breakdownLabel: {
    fontSize: 15,
    color: colors.textMuted,
  },
  breakdownValue: {
    fontSize: 15,
    color: colors.text,
  },
  breakdownTotalLabel: {
    fontSize: 19,
    fontWeight: "600",
    color: colors.text,
  },
  breakdownTotalValue: {
    fontSize: 19,
    fontWeight: "600",
    color: colors.text,
  },
});
