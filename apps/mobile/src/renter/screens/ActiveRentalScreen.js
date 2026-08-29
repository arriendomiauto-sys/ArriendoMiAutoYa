import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
} from "react-native";
import { colors, Icon } from "@rentacar/mobile-shared";

function formatearFechaHora(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const fecha = d.toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "long" });
    const hora = d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    return `${fecha} · ${hora}`;
  } catch {
    return iso;
  }
}

function formatearFechaCorta(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const fecha = d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
    const hora = d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    return `${fecha} · ${hora}`;
  } catch {
    return iso;
  }
}

export function ActiveRentalScreen({
  reservation,
  onBack,
  onStartDelivery,
  onStartReturn,
  onExtendRental,
  onRoadsideClaim,
  onCancelReservation,
  onOpenChat,
  onOpenContract,
}) {
  const res = reservation || {};
  // El auto viaja como `car` (recién reservado, ver PaymentMethodsScreen)
  // o como `auto` (al venir de GET /reservas / RentalHistoryScreen).
  const car = res.car || res.auto || {};
  const montoHold = res.monto_hold || 0;

  // Screen sub-mode: '15_sent' | '16_confirmed' | '18_detail'
  const [viewState, setViewState] = useState(
    res.estado === "en_curso"
      ? "18_detail"
      : res.estado === "confirmada"
      ? "16_confirmed"
      : "15_sent"
  );

  const nombreAuto = [car.marca, car.modelo, car.anio].filter(Boolean).join(" ");

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ========================================================================= */}
      {/* PANTALLA 15: SOLICITUD ENVIADA */}
      {/* ========================================================================= */}
      {viewState === "15_sent" && (
        <View style={styles.screenWrapper}>
          <ScrollView contentContainerStyle={styles.sentBody} showsVerticalScrollIndicator={false}>
            <View style={styles.clockCircle}>
              <Icon name="clock" size={36} color="#D97706" />
            </View>

            <View style={styles.textBoxCenter}>
              <Text style={styles.sentTitle}>Solicitud enviada</Text>
              <Text style={styles.sentSub}>
                El dueño tiene 12 horas para responder. Le avisamos apenas conteste.
              </Text>
            </View>

            <View style={styles.cardInfo}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Auto</Text>
                <Text style={styles.infoVal}>{nombreAuto || "—"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Fechas</Text>
                <Text style={styles.infoVal}>
                  {formatearFechaCorta(res.fecha_inicio)} → {formatearFechaCorta(res.fecha_fin)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Total (hold)</Text>
                <Text style={styles.infoValBold}>${montoHold.toLocaleString("es-CL")}</Text>
              </View>
              <View style={[styles.infoRow, styles.infoDivider]}>
                <Text style={styles.infoLabel}>Estado del cobro</Text>
                <Text style={styles.chargeStateText}>Autorizado, no cobrado</Text>
              </View>
            </View>

            <View style={styles.tealNoticeBox}>
              <Text style={styles.tealNoticeText}>
                Si el dueño no acepta, se libera el monto completo sin ningún cargo.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.bottomBarStacked}>
            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={() => setViewState("16_confirmed")}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryActionBtnText}>Simular Aceptación del Dueño</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tertiaryLink}
              onPress={onBack}
              activeOpacity={0.7}
            >
              <Text style={styles.tertiaryLinkText}>Seguir mirando autos</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 16: RESERVA CONFIRMADA */}
      {/* ========================================================================= */}
      {viewState === "16_confirmed" && (
        <View style={styles.screenWrapper}>
          <ScrollView contentContainerStyle={styles.confirmedBody} showsVerticalScrollIndicator={false}>
            <View style={styles.confirmedHeaderBox}>
              <View style={styles.checkCircle}>
                <Icon name="check" size={34} color="#197A63" />
              </View>
              <View style={{ gap: 8, alignItems: "center" }}>
                <Text style={styles.confirmedTitle}>Reserva confirmada</Text>
                <Text style={styles.confirmedSub}>Ya puede coordinar el retiro con el dueño.</Text>
              </View>
            </View>

            {/* Punto de encuentro */}
            <View style={styles.cardBox}>
              <Text style={styles.cardBoxLabel}>PUNTO DE ENCUENTRO</Text>
              <View style={styles.miniMapVisual}>
                <View style={styles.miniMapPin}>
                  <Icon name="location" size={26} color={colors.primary} />
                </View>
              </View>
              <Text style={styles.meetingAddress}>
                {res.lugar_entrega_acordado || car.ubicacion_base || "Por coordinar"}
              </Text>
              <Text style={styles.meetingTime}>{formatearFechaHora(res.fecha_inicio)}</Text>
            </View>

            {/* Owner Contact Card — sin datos reales de contacto del dueño
                todavía (BookingOut no expone nombre/teléfono), así que no
                se inventa uno: se deriva al chat en la app. */}
            <View style={styles.ownerContactRow}>
              <View style={[styles.ownerContactAvatar, styles.ownerContactAvatarPlaceholder]}>
                <Icon name="user" size={20} color={colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ownerContactName}>Dueño del vehículo</Text>
                <Text style={styles.ownerContactPhone}>Coordina por el chat de la reserva</Text>
              </View>
              <TouchableOpacity
                style={styles.chatActionBtn}
                onPress={onOpenChat}
                activeOpacity={0.8}
              >
                <Icon name="chat" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Lleve su licencia notice */}
            <View style={styles.licenseNoticeBox}>
              <Text style={styles.licenseNoticeTitle}>Lleve su licencia</Text>
              <Text style={styles.licenseNoticeDesc}>
                El dueño registrará el checklist fotográfico de 9 ángulos y usted firmará el contrato en su celular.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.bottomBarStacked}>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={onStartDelivery}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionBtnText}>Mostrar mi código de entrega</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tertiaryLink}
              onPress={() => setViewState("18_detail")}
              activeOpacity={0.7}
            >
              <Text style={styles.tertiaryLinkText}>Ver el detalle de la reserva</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* PANTALLA 18: DETALLE DE LA RESERVA */}
      {/* ========================================================================= */}
      {viewState === "18_detail" && (
        <View style={styles.screenWrapper}>
          {/* Top Header */}
          <View style={styles.detailTopHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TouchableOpacity onPress={() => setViewState("16_confirmed")}>
                <Icon name="arrow-left" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.detailNavTitle}>Detalle de la reserva</Text>
            </View>
            <View style={styles.inProgressBadge}>
              <Text style={styles.inProgressText}>{res.estado === "en_curso" ? "En curso" : res.estado || "—"}</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.detailBody} showsVerticalScrollIndicator={false}>
            {/* Auto Card */}
            <View style={styles.carMiniCard}>
              <View style={styles.carMiniThumb}>
                <Image
                  source={{
                    uri: car.fotos?.[0] || "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
                  }}
                  style={styles.carMiniImg}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.carMiniTitle}>{nombreAuto || "—"}</Text>
                <Text style={styles.carMiniSub}>Patente {car.patente || "—"}</Text>
              </View>
            </View>

            {/* Spec Breakdown */}
            <View style={styles.specCard}>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Retiro</Text>
                <Text style={styles.specVal}>{formatearFechaCorta(res.fecha_inicio)}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Devolución</Text>
                <Text style={styles.specVal}>{formatearFechaCorta(res.fecha_fin)}</Text>
              </View>
              <View style={[styles.specRow, styles.specDivider]}>
                <Text style={styles.specLabel}>Garantía retenida (hold)</Text>
                <Text style={styles.specGuarantee}>${montoHold.toLocaleString("es-CL")}</Text>
              </View>
              {res.monto_cobro_final > 0 && (
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Cobro final</Text>
                  <Text style={styles.specValBold}>${res.monto_cobro_final.toLocaleString("es-CL")}</Text>
                </View>
              )}
            </View>

            {/* Document Links Menu */}
            <View style={styles.docMenuCard}>
              <TouchableOpacity
                style={styles.docMenuItem}
                onPress={onOpenContract}
                activeOpacity={0.75}
              >
                <Text style={styles.docMenuText}>Ver el contrato firmado</Text>
                <Icon name="arrow-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.docMenuItem}
                onPress={onStartDelivery}
                activeOpacity={0.75}
              >
                <Text style={styles.docMenuText}>Mi código de entrega</Text>
                <Icon name="arrow-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.docMenuItem}
                onPress={onExtendRental}
                activeOpacity={0.75}
              >
                <Text style={styles.docMenuText}>Extender arriendo</Text>
                <Icon name="arrow-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.docMenuItem}
                onPress={onRoadsideClaim}
                activeOpacity={0.75}
              >
                <Text style={styles.docMenuText}>Asistencia en ruta / reportar siniestro</Text>
                <Icon name="arrow-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.docMenuItem, { borderBottomWidth: 0 }]}
                onPress={onOpenChat}
                activeOpacity={0.75}
              >
                <Text style={styles.docMenuText}>Escribirle al dueño</Text>
                <Icon name="arrow-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Bottom Actions */}
          <View style={styles.bottomBarStacked}>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={onStartReturn}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionBtnText}>Mostrar mi código de devolución</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dangerActionBtn}
              onPress={onCancelReservation}
              activeOpacity={0.85}
            >
              <Text style={styles.dangerActionBtnText}>Cancelar la reserva</Text>
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
  sentBody: {
    padding: 24,
    alignItems: "center",
    gap: 22,
  },
  clockCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FFF8EC",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 36,
  },
  textBoxCenter: {
    alignItems: "center",
    gap: 10,
  },
  sentTitle: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: colors.text,
  },
  sentSub: {
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 25,
    textAlign: "center",
  },
  cardInfo: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  infoLabel: {
    fontSize: 15,
    color: colors.textMuted,
  },
  infoVal: {
    fontSize: 15,
    color: colors.text,
  },
  infoValBold: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  chargeStateText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8A5B0B",
  },
  tealNoticeBox: {
    width: "100%",
    backgroundColor: colors.primary100,
    borderRadius: 12,
    padding: 14,
  },
  tealNoticeText: {
    fontSize: 14,
    color: colors.primary,
    lineHeight: 20,
  },
  bottomBarStacked: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
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
  secondaryActionBtn: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionBtnText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "600",
  },
  tertiaryLink: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  tertiaryLinkText: {
    color: colors.accent700,
    fontSize: 15,
    fontWeight: "600",
  },
  confirmedBody: {
    padding: 20,
    gap: 18,
  },
  confirmedHeaderBox: {
    alignItems: "center",
    gap: 14,
    paddingTop: 8,
  },
  checkCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#E4F8F2",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmedTitle: {
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: colors.text,
  },
  confirmedSub: {
    fontSize: 15,
    color: colors.textMuted,
  },
  cardBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardBoxLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  miniMapVisual: {
    height: 96,
    borderRadius: 12,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  miniMapPin: {
    alignItems: "center",
  },
  meetingAddress: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  meetingTime: {
    fontSize: 14,
    color: colors.textMuted,
  },
  ownerContactRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  ownerContactAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  ownerContactAvatarPlaceholder: {
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerContactName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  ownerContactPhone: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  chatActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  licenseNoticeBox: {
    backgroundColor: colors.primary100,
    borderRadius: 12,
    padding: 14,
    gap: 5,
  },
  licenseNoticeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  licenseNoticeDesc: {
    fontSize: 14,
    color: colors.primary,
    lineHeight: 20,
  },
  detailTopHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailNavTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  inProgressBadge: {
    backgroundColor: colors.primary100,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  inProgressText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  detailBody: {
    padding: 20,
    gap: 14,
  },
  carMiniCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  carMiniThumb: {
    width: 76,
    height: 58,
    borderRadius: 10,
    backgroundColor: colors.primary100,
    overflow: "hidden",
  },
  carMiniImg: {
    width: "100%",
    height: "100%",
  },
  carMiniTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  carMiniSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  specCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 11,
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  specDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 11,
  },
  specLabel: {
    fontSize: 15,
    color: colors.textMuted,
  },
  specVal: {
    fontSize: 15,
    color: colors.text,
  },
  specValBold: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  specGuarantee: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8A5B0B",
  },
  docMenuCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  docMenuItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  docMenuText: {
    fontSize: 15,
    color: colors.text,
  },
  dangerActionBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerActionBtnText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "600",
  },
});
