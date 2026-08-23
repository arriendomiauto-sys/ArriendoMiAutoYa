import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { colors } from "../../../theme/colors";
import { Icon } from "../../../shared/components/Icon";

export function CarDetailScreen({
  car,
  onBack,
  onProceedToPayment,
}) {
  // Step: '11_detail' | '12_schedule' | '13_summary'
  const [currentStep, setCurrentStep] = useState("11_detail");

  // Booking states
  const [rentalDays, setRentalDays] = useState(4);
  const [returnTime, setReturnTime] = useState("21:30");
  const isNightSurcharge = returnTime >= "21:00";

  const activeCar = car || {
    marca: "Suzuki",
    modelo: "Swift",
    ano: 2023,
    precio_diario: 38000,
    rating_promedio: 4.8,
    comuna: "Providencia",
    direccion_entrega: "Av. Providencia 2145",
  };

  const dailyRate = activeCar.precio_diario || 38000;
  const surcharge = isNightSurcharge ? 6000 : 0;
  const subtotal = dailyRate * rentalDays + surcharge;
  const iva = Math.round(subtotal * 0.19);
  const total = subtotal + iva;
  const guarantee = 150000;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ========================================================================= */}
      {/* PANTALLA 11: FICHA DEL AUTO */}
      {/* ========================================================================= */}
      {currentStep === "11_detail" && (
        <View style={styles.screenWrapper}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* 232px Hero Photo */}
            <View style={styles.heroContainer}>
              <Image
                source={{
                  uri:
                    activeCar.foto_principal_url ||
                    "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
                }}
                style={styles.heroImage}
                resizeMode="cover"
              />
              <TouchableOpacity style={styles.heroBackBtn} onPress={onBack}>
                <Icon name="arrow-left" size={20} color={colors.primary} />
              </TouchableOpacity>
              <View style={styles.paginationDots}>
                <View style={[styles.dot, styles.dotActive]} />
                <View style={[styles.dot, styles.dotInactive]} />
                <View style={[styles.dot, styles.dotInactive]} />
              </View>
            </View>

            {/* Ficha Body */}
            <View style={styles.bodyContent}>
              <View style={styles.titleSection}>
                <View style={styles.titleRow}>
                  <Text style={styles.carName}>
                    {activeCar.marca} {activeCar.modelo} {activeCar.ano || 2023}
                  </Text>
                  <View style={styles.ratingBox}>
                    <Icon name="star" size={15} color="#2FBF9B" style={{ marginRight: 3 }} />
                    <Text style={styles.ratingNumber}>
                      {activeCar.rating_promedio || 4.8}
                    </Text>
                  </View>
                </View>
                <Text style={styles.carSpecsSubtitle}>
                  {activeCar.transmision || "Automático"} · 5 puertas · 4 asientos · Bencina
                </Text>
              </View>

              {/* 3 Pricing Plans */}
              <View style={styles.pricingBoxesRow}>
                <View style={styles.pricingBox}>
                  <Text style={styles.pricingBoxLabel}>Día</Text>
                  <Text style={styles.pricingBoxValue}>${dailyRate.toLocaleString("es-CL")}</Text>
                </View>
                <View style={styles.pricingBox}>
                  <Text style={styles.pricingBoxLabel}>Semana</Text>
                  <Text style={styles.pricingBoxValue}>$228.000</Text>
                </View>
                <View style={styles.pricingBox}>
                  <Text style={styles.pricingBoxLabel}>Mes</Text>
                  <Text style={styles.pricingBoxValue}>$820.000</Text>
                </View>
              </View>

              {/* Verified Owner Card */}
              <View style={styles.ownerCard}>
                <Image
                  source={{
                    uri: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
                  }}
                  style={styles.ownerAvatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ownerName}>Rodrigo Muñoz</Text>
                  <Text style={styles.ownerDetails}>4,8 · 31 arriendos · verificado</Text>
                </View>
                <Icon name="arrow-right" size={20} color={colors.textMuted} />
              </View>

              {/* Mini Availability Calendar */}
              <View style={styles.availabilitySection}>
                <Text style={styles.sectionLabel}>DISPONIBILIDAD</Text>
                <View style={styles.calendarCard}>
                  <View style={styles.calendarDaysHeader}>
                    {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                      <Text key={i} style={styles.calendarDayName}>{d}</Text>
                    ))}
                  </View>
                  <View style={styles.calendarGrid}>
                    <Text style={styles.dayMuted}>8</Text>
                    <Text style={styles.dayMuted}>9</Text>
                    <Text style={styles.dayNormal}>10</Text>
                    <Text style={styles.dayNormal}>11</Text>
                    <Text style={styles.daySelectedStart}>12</Text>
                    <Text style={styles.daySelectedMid}>13</Text>
                    <Text style={styles.daySelectedMid}>14</Text>
                    <Text style={styles.daySelectedMid}>15</Text>
                    <Text style={styles.daySelectedEnd}>16</Text>
                    <Text style={styles.dayNormal}>17</Text>
                    <Text style={styles.dayNormal}>18</Text>
                    <Text style={styles.dayDisabled}>19</Text>
                    <Text style={styles.dayDisabled}>20</Text>
                    <Text style={styles.dayNormal}>21</Text>
                  </View>
                </View>
              </View>

              {/* Location Tag */}
              <View style={styles.locationRow}>
                <Icon name="location" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                <Text style={styles.locationText}>
                  Cerca de Av. Providencia con Los Leones
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Bar */}
          <View style={styles.bottomActionBar}>
            <View>
              <Text style={styles.bottomPriceValue}>${dailyRate.toLocaleString("es-CL")}</Text>
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
            {/* Calendar Widget */}
            <View style={styles.scheduleCalendarCard}>
              <Text style={styles.calendarMonthTitle}>Agosto 2026</Text>
              <View style={styles.calendarDaysHeader}>
                {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                  <Text key={i} style={styles.calendarDayName}>{d}</Text>
                ))}
              </View>
              <View style={styles.calendarGrid}>
                <Text style={styles.dayMuted}>3</Text>
                <Text style={styles.dayMuted}>4</Text>
                <Text style={styles.dayMuted}>5</Text>
                <Text style={styles.dayMuted}>6</Text>
                <Text style={styles.dayMuted}>7</Text>
                <Text style={styles.dayMuted}>8</Text>
                <Text style={styles.dayMuted}>9</Text>
                <Text style={styles.dayNormal}>10</Text>
                <Text style={styles.dayNormal}>11</Text>
                <Text style={styles.daySelectedStart}>12</Text>
                <Text style={styles.daySelectedMid}>13</Text>
                <Text style={styles.daySelectedMid}>14</Text>
                <Text style={styles.daySelectedMid}>15</Text>
                <Text style={styles.daySelectedEnd}>16</Text>
              </View>
            </View>

            {/* Time Pickers */}
            <View style={styles.timePickersRow}>
              <View style={styles.timePickerBox}>
                <Text style={styles.timeLabel}>RETIRO</Text>
                <View style={styles.timeInput}>
                  <Text style={styles.timeInputText}>10:00</Text>
                </View>
              </View>

              <View style={styles.timePickerBox}>
                <Text style={styles.timeLabel}>DEVOLUCIÓN</Text>
                <View style={styles.timeInputFocused}>
                  <Text style={styles.timeInputText}>{returnTime}</Text>
                </View>
              </View>
            </View>

            {/* Nocturnal Surcharge Notice */}
            {isNightSurcharge && (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>Recargo por horario nocturno</Text>
                <Text style={styles.warningDesc}>
                  Devolver después de las 21:00 suma $6.000. Puede cambiar la hora para evitarlo.
                </Text>
              </View>
            )}

            {/* Subtotal Card */}
            <View style={styles.subtotalCard}>
              <View>
                <Text style={styles.subtotalTitle}>{rentalDays} días de arriendo</Text>
                <Text style={styles.subtotalRange}>12 ago 10:00 → 16 ago {returnTime}</Text>
              </View>
              <Text style={styles.subtotalValue}>${subtotal.toLocaleString("es-CL")}</Text>
            </View>
          </ScrollView>

          <View style={styles.footerBar}>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => setCurrentStep("13_summary")}
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
                    uri:
                      activeCar.foto_principal_url ||
                      "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
                  }}
                  style={styles.summaryCarImg}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryCarName}>
                  {activeCar.marca} {activeCar.modelo} {activeCar.ano || 2023}
                </Text>
                <Text style={styles.summaryCarTime}>12 ago 10:00 → 16 ago {returnTime}</Text>
                <Text style={styles.summaryCarLocation}>{activeCar.direccion_entrega || "Av. Providencia 2145"}</Text>
              </View>
            </View>

            {/* Price Breakdown Table */}
            <View style={styles.breakdownCard}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Tarifa diaria</Text>
                <Text style={styles.breakdownValue}>${dailyRate.toLocaleString("es-CL")}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Días de arriendo</Text>
                <Text style={styles.breakdownValue}>{rentalDays}</Text>
              </View>
              {isNightSurcharge && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Recargo horario nocturno</Text>
                  <Text style={styles.breakdownValue}>$6.000</Text>
                </View>
              )}
              <View style={[styles.breakdownRow, styles.breakdownDivider]}>
                <Text style={styles.breakdownLabel}>Subtotal</Text>
                <Text style={styles.breakdownValue}>${subtotal.toLocaleString("es-CL")}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>IVA 19%</Text>
                <Text style={styles.breakdownValue}>${iva.toLocaleString("es-CL")}</Text>
              </View>
              <View style={[styles.breakdownRow, styles.breakdownDivider]}>
                <Text style={styles.breakdownTotalLabel}>Total a pagar</Text>
                <Text style={styles.breakdownTotalValue}>${total.toLocaleString("es-CL")}</Text>
              </View>
            </View>

            {/* Guarantee Hold Notice */}
            <View style={styles.warningBox}>
              <View style={styles.guaranteeHeader}>
                <Text style={styles.guaranteeTitle}>Garantía retenida</Text>
                <Text style={styles.guaranteeAmount}>${guarantee.toLocaleString("es-CL")}</Text>
              </View>
              <Text style={styles.warningDesc}>
                No es un cobro. Se libera cuando el dueño confirme el estado del auto al devolverlo.
              </Text>
            </View>

            {/* Cancellation Terms */}
            <View style={styles.termsCard}>
              <Text style={styles.termsText}>
                Cancelación sin costo hasta 24 horas antes del retiro. Después se retiene el 30%.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footerBar}>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => onProceedToPayment(activeCar, total, guarantee)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionBtnText}>Ir a pagar</Text>
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
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  carName: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: colors.text,
  },
  ratingBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingNumber: {
    fontSize: 15,
    fontWeight: "600",
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
  ownerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  ownerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  ownerDetails: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  availabilitySection: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  calendarCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  calendarDaysHeader: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 6,
  },
  calendarDayName: {
    fontSize: 11,
    color: colors.textMuted,
    width: 28,
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  dayMuted: {
    width: 28,
    textAlign: "center",
    paddingVertical: 6,
    color: "#9CA3AF",
    fontSize: 13,
  },
  dayNormal: {
    width: 28,
    textAlign: "center",
    paddingVertical: 6,
    color: colors.text,
    fontSize: 13,
  },
  daySelectedStart: {
    width: 28,
    textAlign: "center",
    paddingVertical: 6,
    backgroundColor: colors.primary,
    color: "#FFFFFF",
    fontWeight: "600",
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    fontSize: 13,
  },
  daySelectedMid: {
    width: 28,
    textAlign: "center",
    paddingVertical: 6,
    backgroundColor: colors.primary100,
    color: colors.primary,
    fontSize: 13,
  },
  daySelectedEnd: {
    width: 28,
    textAlign: "center",
    paddingVertical: 6,
    backgroundColor: colors.primary,
    color: "#FFFFFF",
    fontWeight: "600",
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    fontSize: 13,
  },
  dayDisabled: {
    width: 28,
    textAlign: "center",
    paddingVertical: 6,
    color: "#D1D5DB",
    textDecorationLine: "line-through",
    fontSize: 13,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    fontSize: 14,
    color: colors.textMuted,
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
  scheduleCalendarCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  calendarMonthTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 12,
    color: colors.text,
  },
  timePickersRow: {
    flexDirection: "row",
    gap: 12,
  },
  timePickerBox: {
    flex: 1,
    gap: 6,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  timeInput: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  timeInputFocused: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  timeInputText: {
    fontSize: 16,
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
  guaranteeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  guaranteeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8A5B0B",
  },
  guaranteeAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8A5B0B",
  },
  termsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  termsText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
  },
});
