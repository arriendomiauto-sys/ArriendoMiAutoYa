import React, { useState } from "react";
import { View, Text, StyleSheet, StatusBar, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import {
  colors,
  theme,
  Icon,
  Button,
  Card,
  Badge,
  ScreenHeader,
  SectionLabel,
  MenuList,
  MenuRow,
  ApiClient,
  showAlert,
  PreCheckinModal,
  SegundoConductorModal,
} from "@rentacar/mobile-shared";

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || "").replace(/\/$/, "");

function fechaHora(iso, largo = false) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const f = d.toLocaleDateString("es-CL", largo
      ? { weekday: "long", day: "2-digit", month: "long" }
      : { day: "2-digit", month: "short" });
    const h = d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    return `${f} · ${h}`;
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
  const insets = useSafeAreaInsets();
  const [res, setRes] = useState(reservation || {});
  const [modalPrecheck, setModalPrecheck] = useState(false);
  const [modalSegundoConductor, setModalSegundoConductor] = useState(false);
  const car = res.car || res.auto || {};
  const montoHold = res.monto_hold || 0;
  const nombre = [car.marca, car.modelo, car.anio].filter(Boolean).join(" ") || "Auto";

  const [view, setView] = useState(
    res.estado === "en_curso" ? "detail" : res.estado === "confirmada" ? "confirmed" : "sent"
  );
  const [pagando, setPagando] = useState(false);

  const footer = (children) => (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>{children}</View>
  );

  // La reserva "pendiente" sigue esperando que se autorice la garantía en Mercado Pago.
  const reintentarPago = async () => {
    if (!res.id) return;
    setPagando(true);
    try {
      const returnUrl = WEB_URL ? `${WEB_URL}/pago/retorno` : "https://arriendatuauto.cl/pago/retorno";
      const inicio = await ApiClient.iniciarPago(montoHold, "hold_reserva", res.id, returnUrl);
      if (!inicio?.url) throw new Error("La pasarela de pago no está disponible.");
      const redirect = Linking.createURL("pago-retorno");
      const r = await WebBrowser.openAuthSessionAsync(inicio.url, redirect);
      if (r.type === "success" && r.url) {
        const { queryParams } = Linking.parse(r.url);
        const confirm = await ApiClient.confirmarPago(
          queryParams?.payment_id || queryParams?.collection_id,
          inicio.pago_id
        );
        if (confirm?.autorizada) {
          setView("confirmed");
          return;
        }
      }
      showAlert("Pago no completado", "La garantía no quedó autorizada. Tu reserva sigue pendiente.");
    } catch (e) {
      showAlert("No se pudo abrir el pago", e.message || "Inténtalo de nuevo.");
    } finally {
      setPagando(false);
    }
  };

  // -------------------------------------------------------------- ENVIADA
  if (view === "sent") {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.centerBody} showsVerticalScrollIndicator={false}>
          <View style={styles.iconCircleWarn}>
            <Icon name="clock" size={34} color={colors.warning} />
          </View>
          <View style={styles.centerText}>
            <Text style={styles.bigTitle}>Reserva pendiente de pago</Text>
            <Text style={styles.bigSub}>
              Falta autorizar la garantía en Mercado Pago para confirmar tu reserva.
            </Text>
          </View>
          <Card padded style={{ width: "100%", gap: theme.spacing.md }}>
            <Row label="Auto" value={nombre} />
            <Row label="Fechas" value={`${fechaHora(res.fecha_inicio)} → ${fechaHora(res.fecha_fin)}`} />
            <Row label="Garantía (hold)" value={`$${montoHold.toLocaleString("es-CL")}`} strong />
            <View style={styles.divider} />
            <Row label="Estado" value="Pendiente de pago" warn />
          </Card>
          <View style={styles.noteTeal}>
            <Text style={styles.noteTealText}>
              El hold es una pre-autorización, no un cobro. Se libera al devolver el auto sin daños.
            </Text>
          </View>
        </ScrollView>
        {footer(
          <>
            <Button label="Pagar con Mercado Pago" iconRight="arrow-right" onPress={reintentarPago} loading={pagando} />
            <Button variant="ghost" size="sm" label="Seguir mirando autos" onPress={onBack} />
          </>
        )}
      </View>
    );
  }

  // ------------------------------------------------------------ CONFIRMADA
  if (view === "confirmed") {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.centerText}>
            <View style={styles.iconCircleOk}>
              <Icon name="check" size={32} color={colors.accent700} />
            </View>
            <Text style={styles.bigTitle}>Reserva confirmada</Text>
            <Text style={styles.bigSub}>Ya puedes coordinar el retiro con el dueño.</Text>
          </View>

          {/* Tarjeta de Verificación / Pre-Checkin 24h */}
          <Card padded style={{ gap: theme.spacing.sm, backgroundColor: res.precheck_cliente_confirmado ? colors.accent100 : colors.surface }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="check" size={18} color={res.precheck_cliente_confirmado ? colors.accentDark : colors.textMuted} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                  Verificación 24h antes
                </Text>
              </View>
              <Badge
                variant={res.precheck_cliente_confirmado ? "success" : "warning"}
                label={res.precheck_cliente_confirmado ? "Confirmado" : "Pendiente"}
              />
            </View>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>
              {res.precheck_cliente_confirmado
                ? "Has confirmado tu viaje y asistencia para mañana."
                : "Confirma tu asistencia y lugar de encuentro 24 horas antes del inicio."}
            </Text>
            {!res.precheck_cliente_confirmado && (
              <Button
                variant="secondary"
                size="sm"
                label="Completar verificación de viaje"
                iconRight="arrow-right"
                onPress={() => setModalPrecheck(true)}
              />
            )}
          </Card>

          <Card padded style={{ gap: theme.spacing.md }}>
            <SectionLabel>Punto de encuentro</SectionLabel>
            <View style={styles.miniMap}>
              <Icon name="pin" size={26} color={colors.primary} />
            </View>
            <Text style={styles.meetAddr}>
              {res.lugar_entrega_acordado || car.ubicacion_base || "Por coordinar"}
            </Text>
            <Text style={styles.meetTime}>{fechaHora(res.fecha_inicio, true)}</Text>
          </Card>

          <Card padded style={styles.ownerRow}>
            <View style={styles.ownerAvatar}>
              <Icon name="user" size={20} color={colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ownerName}>Dueño del vehículo</Text>
              <Text style={styles.ownerSub}>Coordina por el chat de la reserva</Text>
            </View>
            <Button variant="secondary" size="sm" iconLeft="chat" label="Chat" onPress={onOpenChat} fullWidth={false} />
          </Card>

          {/* Segundo Conductor */}
          <Card padded style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="user" size={18} color={colors.primary} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                  Segundo Conductor
                </Text>
              </View>
              {res.segundo_conductor ? (
                <Badge
                  label={
                    res.segundo_conductor.estado_kyc === "verificado"
                      ? "Verificado"
                      : res.segundo_conductor.estado_kyc === "requiere_revision_manual"
                      ? "En revisión"
                      : "Pendiente"
                  }
                  variant={
                    res.segundo_conductor.estado_kyc === "verificado"
                      ? "success"
                      : res.segundo_conductor.estado_kyc === "requiere_revision_manual"
                      ? "warning"
                      : "neutral"
                  }
                />
              ) : null}
            </View>
            {res.segundo_conductor ? (
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                {res.segundo_conductor.nombre} (Doc: {res.segundo_conductor.rut || res.segundo_conductor.numero_documento || "—"})
              </Text>
            ) : (
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                ¿Otra persona manejará el vehículo? Asígnala con verificación KYC previa.
              </Text>
            )}
            <Button
              variant="secondary"
              size="sm"
              label={res.segundo_conductor ? "Gestionar segundo conductor" : "+ Asignar segundo conductor"}
              onPress={() => setModalSegundoConductor(true)}
              style={{ marginTop: 4 }}
            />
          </Card>

          <View style={styles.noteTeal}>
            <Text style={styles.noteTealTitle}>Lleva tu licencia</Text>
            <Text style={styles.noteTealText}>
              El dueño registrará el checklist fotográfico de 9 ángulos y firmarás el contrato en tu celular.
            </Text>
          </View>
        </ScrollView>
        {footer(
          <>
            <Button label="Mostrar mi código de entrega" iconRight="arrow-right" onPress={onStartDelivery} />
            <Button variant="ghost" size="sm" label="Ver el detalle de la reserva" onPress={() => setView("detail")} />
          </>
        )}

        <PreCheckinModal
          visible={modalPrecheck}
          reserva={res}
          role="cliente"
          onClose={() => setModalPrecheck(false)}
          onConfirmed={(updated) => {
            setRes((prev) => ({ ...prev, ...updated }));
          }}
        />

        <SegundoConductorModal
          visible={modalSegundoConductor}
          reservaId={res.id}
          initialData={res.segundo_conductor}
          onClose={() => setModalSegundoConductor(false)}
          onSaved={(sc) => {
            setRes((prev) => ({ ...prev, segundo_conductor: sc }));
          }}
        />
      </View>
    );
  }

  // --------------------------------------------------------------- DETALLE
  const tieneCargosExtra = (res.cargos_adicionales_clp || 0) > 0 || (res.cargo_limpieza_clp || 0) > 0 || (res.cargo_combustible_clp || 0) > 0 || (res.cargo_atraso_clp || 0) > 0 || (res.cargo_falta_grave_clp || 0) > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader
        title="Detalle de la reserva"
        onBack={() => setView("confirmed")}
        right={<Badge variant={res.estado === "en_curso" ? "info" : "neutral"} label={res.estado === "en_curso" ? "En curso" : res.estado || "—"} />}
      />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Card padded style={styles.carRow}>
          <Image
            source={{ uri: car.fotos?.[0] || "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800" }}
            style={styles.carThumb}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.carTitle}>{nombre}</Text>
            <Text style={styles.carSub}>Patente {car.patente || "—"}</Text>
          </View>
        </Card>

        <Card padded style={{ gap: theme.spacing.md }}>
          <Row label="Retiro" value={fechaHora(res.fecha_inicio)} />
          <Row label="Devolución" value={fechaHora(res.fecha_fin)} />
          <View style={styles.divider} />
          <Row label="Garantía retenida (hold)" value={`$${montoHold.toLocaleString("es-CL")}`} warn />
          {res.monto_cobro_final > 0 && (
            <Row label="Cobro final" value={`$${res.monto_cobro_final.toLocaleString("es-CL")}`} strong />
          )}
        </Card>

        {/* Desglose de penalizaciones y multas */}
        {tieneCargosExtra && (
          <Card padded style={{ gap: theme.spacing.sm, borderColor: colors.warning, borderWidth: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="alert" size={18} color={colors.warning} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Cargos y penalizaciones aplicadas
              </Text>
            </View>
            {res.cargo_limpieza_clp > 0 && (
              <Row label="Limpieza" value={`$${res.cargo_limpieza_clp.toLocaleString("es-CL")}`} />
            )}
            {res.cargo_combustible_clp > 0 && (
              <Row label="Combustible faltante" value={`$${res.cargo_combustible_clp.toLocaleString("es-CL")}`} />
            )}
            {res.cargo_atraso_clp > 0 && (
              <Row label="Atraso en devolución" value={`$${res.cargo_atraso_clp.toLocaleString("es-CL")}`} />
            )}
            {res.cargo_falta_grave_clp > 0 && (
              <Row label="Faltas / Infracciones" value={`$${res.cargo_falta_grave_clp.toLocaleString("es-CL")}`} />
            )}
            {res.motivo_multas && (
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                Detalle: {res.motivo_multas}
              </Text>
            )}
          </Card>
        )}

        <MenuList>
          <MenuRow icon="document" label="Ver el contrato firmado" onPress={onOpenContract} />
          <MenuRow
            icon="user"
            label={
              res.segundo_conductor
                ? `Segundo conductor (${res.segundo_conductor.estado_kyc === "verificado" ? "Verificado" : "En revisión"})`
                : "Asignar segundo conductor (KYC)"
            }
            onPress={() => setModalSegundoConductor(true)}
          />
          <MenuRow icon="pin" label="Mi código de entrega" onPress={onStartDelivery} />
          <MenuRow icon="calendar" label="Extender arriendo" onPress={onExtendRental} />
          <MenuRow icon="shield" label="Asistencia en ruta / siniestro" onPress={onRoadsideClaim} />
          <MenuRow icon="chat" label="Escribirle al dueño" onPress={onOpenChat} />
        </MenuList>
      </ScrollView>
      {footer(
        <>
          <Button label="Mostrar mi código de devolución" iconRight="arrow-right" onPress={onStartReturn} />
          <Button variant="danger" size="sm" label="Cancelar la reserva" onPress={onCancelReservation} />
        </>
      )}

      <PreCheckinModal
        visible={modalPrecheck}
        reserva={res}
        role="cliente"
        onClose={() => setModalPrecheck(false)}
        onConfirmed={(updated) => {
          setRes((prev) => ({ ...prev, ...updated }));
        }}
      />

      <SegundoConductorModal
        visible={modalSegundoConductor}
        reservaId={res.id}
        initialData={res.segundo_conductor}
        onClose={() => setModalSegundoConductor(false)}
        onSaved={(sc) => {
          setRes((prev) => ({ ...prev, segundo_conductor: sc }));
        }}
      />
    </View>
  );
}

function Row({ label, value, strong, warn }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          strong && { fontWeight: "700" },
          warn && { color: colors.warningText, fontWeight: "700" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  centerBody: { padding: theme.spacing.xxl, alignItems: "center", gap: theme.spacing.lg },
  centerText: { alignItems: "center", gap: theme.spacing.sm },
  iconCircleWarn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.warningBg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing.xxl,
  },
  iconCircleOk: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.accent100,
    alignItems: "center",
    justifyContent: "center",
  },
  bigTitle: { ...theme.typography.title, color: colors.text, textAlign: "center" },
  bigSub: { fontSize: 15, color: colors.textMuted, lineHeight: 22, textAlign: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.md },
  rowLabel: { fontSize: 14, color: colors.textMuted },
  rowValue: { fontSize: 14, color: colors.text, flexShrink: 1, textAlign: "right" },
  divider: { height: 1, backgroundColor: colors.border },
  noteTeal: { width: "100%", backgroundColor: colors.primary100, borderRadius: theme.radius.field, padding: theme.spacing.lg, gap: 4 },
  noteTealTitle: { fontSize: 14, fontWeight: "700", color: colors.primary },
  noteTealText: { fontSize: 13, color: colors.primary, lineHeight: 19 },
  miniMap: {
    height: 96,
    borderRadius: theme.radius.field,
    backgroundColor: colors.primary100,
    alignItems: "center",
    justifyContent: "center",
  },
  meetAddr: { fontSize: 15, fontWeight: "700", color: colors.text },
  meetTime: { fontSize: 13, color: colors.textMuted, textTransform: "capitalize" },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  ownerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerName: { fontSize: 15, fontWeight: "700", color: colors.text },
  ownerSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  carRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  carThumb: { width: 76, height: 58, borderRadius: theme.radius.field, backgroundColor: colors.primary100 },
  carTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  carSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  footer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: theme.spacing.sm,
  },
});
