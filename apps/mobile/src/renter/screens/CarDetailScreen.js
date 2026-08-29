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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, theme, Icon, Button, Card, ScreenHeader, SectionLabel } from "@rentacar/mobile-shared";

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
  const insets = useSafeAreaInsets();
  // Step: 'detail' | 'schedule' | 'summary'
  const [step, setStep] = useState("detail");
  const [fotoActiva, setFotoActiva] = useState(0);
  const [heroW, setHeroW] = useState(0);

  const [fechaInicio, setFechaInicio] = useState(hoyISO(1));
  const [fechaFin, setFechaFin] = useState(hoyISO(4));
  const [horaRetiro, setHoraRetiro] = useState("10:00");
  const [horaDevolucion, setHoraDevolucion] = useState("18:00");
  const [dateError, setDateError] = useState(null);

  const tarifaDia = car?.tarifa_dia || 0;
  const dias = useMemo(() => calcularDias(fechaInicio, fechaFin), [fechaInicio, fechaFin]);
  const montoHold = tarifaDia * dias;

  const fotos = car?.fotos?.length ? car.fotos : ["https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800"];
  const nombreAuto = [car?.marca, car?.modelo, car?.anio].filter(Boolean).join(" ");
  const dueno = car?.dueno;
  const equipamientoActivo = Object.entries(car?.equipamiento || {})
    .filter(([, activo]) => activo)
    .map(([key]) => EQUIPAMIENTO_LABELS[key] || key);
  const precioCLP = (n) => `$${(n || 0).toLocaleString("es-CL")}`;

  const irAResumen = () => {
    setDateError(null);
    if (dias <= 0) {
      setDateError("La fecha de devolución debe ser posterior a la de retiro.");
      return;
    }
    setStep("summary");
  };

  // ---------------------------------------------------------------- DETALLE
  if (step === "detail") {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}>
          <View style={styles.hero} onLayout={(e) => setHeroW(e.nativeEvent.layout.width)}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={fotos.length > 1}
              onMomentumScrollEnd={(e) =>
                setFotoActiva(Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width))
              }
            >
              {fotos.map((uri, i) => (
                <Image
                  key={uri + i}
                  source={{ uri }}
                  style={[styles.heroImg, heroW ? { width: heroW } : null]}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.heroBack, { top: insets.top + 8 }]}
              onPress={onBack}
              hitSlop={theme.control.hitSlop}
            >
              <Icon name="arrow-left" size={20} color={colors.primary} />
            </TouchableOpacity>
            {fotos.length > 1 && (
              <View style={styles.dots}>
                {fotos.map((_, i) => (
                  <View key={i} style={[styles.dot, i === fotoActiva ? styles.dotOn : styles.dotOff]} />
                ))}
              </View>
            )}
          </View>

          <View style={styles.body}>
            <View>
              <Text style={styles.carName}>{nombreAuto || "Vehículo"}</Text>
              <View style={styles.metaRow}>
                <Icon name="location" size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>{car?.ubicacion_base || "Ubicación no informada"}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>Patente {car?.patente || "—"}</Text>
              </View>
            </View>

            {dueno ? (
              <Card style={styles.hostCard} padded>
                <View style={styles.hostAvatar}>
                  {dueno.avatar ? (
                    <Image source={{ uri: dueno.avatar }} style={styles.hostAvatarImg} />
                  ) : (
                    <Icon name="user" size={20} color={colors.textMuted} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hostName}>{dueno.nombre}</Text>
                  <Text style={styles.hostMeta}>
                    {dueno.rating ? `★ ${dueno.rating}` : "Anfitrión"}
                    {dueno.viajes ? ` · ${dueno.viajes} arriendos` : ""}
                  </Text>
                </View>
                {dueno.verificado ? (
                  <View style={styles.verifBadge}>
                    <Icon name="shield" size={13} color={colors.accent800} />
                    <Text style={styles.verifText}>Verificado</Text>
                  </View>
                ) : null}
              </Card>
            ) : null}

            <View style={styles.priceRow}>
              {[
                { l: "Día", v: tarifaDia },
                { l: "Semana", v: tarifaDia * 7 },
                { l: "Mes", v: tarifaDia * 30 },
              ].map((p, i) => (
                <View key={p.l} style={[styles.priceCell, i === 0 && styles.priceCellFirst]}>
                  <Text style={styles.priceCellLabel}>{p.l}</Text>
                  <Text style={styles.priceCellValue}>{precioCLP(p.v)}</Text>
                </View>
              ))}
            </View>

            {equipamientoActivo.length > 0 && (
              <View style={{ gap: theme.spacing.sm }}>
                <SectionLabel>Equipamiento</SectionLabel>
                <View style={styles.equipGrid}>
                  {equipamientoActivo.map((label) => (
                    <View key={label} style={styles.equipChip}>
                      <Icon name="check" size={12} color={colors.accent700} />
                      <Text style={styles.equipText}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <Card style={styles.noteCard} padded elevated={false}>
              <Icon name="shield" size={18} color={colors.primary} />
              <Text style={styles.noteText}>
                Retiro y devolución 100% digital: código QR y checklist fotográfico de 9 ángulos, sin mostrador.
                La garantía se retiene, no se cobra.
              </Text>
            </Card>
          </View>
        </ScrollView>

        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View>
            <Text style={styles.barPrice}>{precioCLP(tarifaDia)}</Text>
            <Text style={styles.barPer}>por día</Text>
          </View>
          <Button label="Elegir fechas" onPress={() => setStep("schedule")} fullWidth={false} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  // --------------------------------------------------------------- FECHAS
  if (step === "schedule") {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Fechas y horarios" onBack={() => setStep("detail")} />
        <ScrollView contentContainerStyle={styles.stepBody} showsVerticalScrollIndicator={false}>
          <View style={styles.datesRow}>
            {[
              { label: "Retiro", fecha: fechaInicio, setFecha: setFechaInicio, hora: horaRetiro, setHora: setHoraRetiro },
              { label: "Devolución", fecha: fechaFin, setFecha: setFechaFin, hora: horaDevolucion, setHora: setHoraDevolucion },
            ].map((g) => (
              <View key={g.label} style={{ flex: 1, gap: 6 }}>
                <SectionLabel>{g.label}</SectionLabel>
                <TextInput
                  style={styles.input}
                  value={g.fecha}
                  onChangeText={g.setFecha}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={colors.textPlaceholder}
                />
                <TextInput
                  style={styles.input}
                  value={g.hora}
                  onChangeText={g.setHora}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.textPlaceholder}
                />
              </View>
            ))}
          </View>

          {dateError && (
            <View style={styles.warnBox}>
              <Text style={styles.warnTitle}>Fechas inválidas</Text>
              <Text style={styles.warnText}>{dateError}</Text>
            </View>
          )}

          <Card style={styles.subtotalCard} padded>
            <View style={{ flex: 1 }}>
              <Text style={styles.subtotalTitle}>
                {dias > 0 ? `${dias} ${dias === 1 ? "día" : "días"} de arriendo` : "Elige fechas válidas"}
              </Text>
              {dias > 0 && (
                <Text style={styles.subtotalRange}>
                  {formatearFechaCorta(fechaInicio)} {horaRetiro} → {formatearFechaCorta(fechaFin)} {horaDevolucion}
                </Text>
              )}
            </View>
            <Text style={styles.subtotalValue}>{precioCLP(montoHold)}</Text>
          </Card>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <Button label="Ver el resumen" onPress={irAResumen} />
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------- RESUMEN
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Resumen de la reserva" onBack={() => setStep("schedule")} />
      <ScrollView contentContainerStyle={styles.stepBody} showsVerticalScrollIndicator={false}>
        <Card style={styles.sumCarCard} padded>
          <Image source={{ uri: fotos[0] }} style={styles.sumThumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sumName}>{nombreAuto || "Vehículo"}</Text>
            <Text style={styles.sumMeta}>
              {formatearFechaCorta(fechaInicio)} {horaRetiro} → {formatearFechaCorta(fechaFin)} {horaDevolucion}
            </Text>
            <Text style={styles.sumMeta}>{car?.ubicacion_base}</Text>
          </View>
        </Card>

        <Card padded style={{ gap: theme.spacing.md }}>
          <View style={styles.bdRow}>
            <Text style={styles.bdLabel}>Tarifa diaria</Text>
            <Text style={styles.bdValue}>{precioCLP(tarifaDia)}</Text>
          </View>
          <View style={styles.bdRow}>
            <Text style={styles.bdLabel}>Días de arriendo</Text>
            <Text style={styles.bdValue}>{dias}</Text>
          </View>
          <View style={[styles.bdRow, styles.bdTotal]}>
            <Text style={styles.bdTotalLabel}>Total retenido (hold)</Text>
            <Text style={styles.bdTotalValue}>{precioCLP(montoHold)}</Text>
          </View>
        </Card>

        <View style={styles.warnBox}>
          <Text style={styles.warnTitle}>No es un cobro inmediato</Text>
          <Text style={styles.warnText}>
            Se retiene una pre-autorización de {precioCLP(montoHold)} en tu tarjeta. Se libera cuando el dueño
            confirme el estado del auto al devolverlo, descontando solo cargos justificados (limpieza,
            combustible, km extra).
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Button
          label="Ir a pagar"
          iconRight="arrow-right"
          onPress={() =>
            onProceedToPayment(car, {
              fechaInicio: `${fechaInicio}T${horaRetiro}:00`,
              fechaFin: `${fechaFin}T${horaDevolucion}:00`,
              dias,
              montoHold,
            })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  hero: { height: 260, backgroundColor: colors.primary100 },
  heroImg: { width: "100%", height: "100%" },
  heroBack: {
    position: "absolute",
    left: theme.spacing.screen,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.sm,
  },
  dots: { position: "absolute", bottom: 14, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { height: 6, borderRadius: 999 },
  dotOn: { width: 20, backgroundColor: "#FFFFFF" },
  dotOff: { width: 6, backgroundColor: "rgba(255,255,255,0.6)" },

  body: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  carName: { ...theme.typography.title, color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, flexWrap: "wrap" },
  metaText: { fontSize: 13, color: colors.textMuted },
  metaDot: { color: colors.textMuted },

  hostCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  hostAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  hostAvatarImg: { width: "100%", height: "100%" },
  hostName: { fontSize: 15, fontWeight: "600", color: colors.text },
  hostMeta: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  verifBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accent100,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
  },
  verifText: { fontSize: 11, fontWeight: "700", color: colors.accent800 },

  priceRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  priceCell: { flex: 1, alignItems: "center", paddingVertical: theme.spacing.md, gap: 3, borderLeftWidth: 1, borderLeftColor: colors.border },
  priceCellFirst: { borderLeftWidth: 0 },
  priceCellLabel: { fontSize: 12, color: colors.textMuted },
  priceCellValue: { fontSize: 15, fontWeight: "700", color: colors.text },

  equipGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  equipChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent100,
    borderRadius: theme.radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  equipText: { fontSize: 12, fontWeight: "600", color: colors.accent700 },

  noteCard: { flexDirection: "row", gap: theme.spacing.md, backgroundColor: colors.primary100, borderColor: colors.primary200 },
  noteText: { flex: 1, fontSize: 13, color: colors.primary, lineHeight: 19 },

  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  barPrice: { fontSize: 18, fontWeight: "700", color: colors.text },
  barPer: { fontSize: 12, color: colors.textMuted },

  stepBody: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  datesRow: { flexDirection: "row", gap: theme.spacing.md },
  input: {
    height: theme.control.heightSm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
  },
  warnBox: { backgroundColor: colors.warningBg, borderRadius: theme.radius.field, padding: theme.spacing.lg, gap: 4 },
  warnTitle: { fontSize: 14, fontWeight: "700", color: colors.warningText },
  warnText: { fontSize: 13, color: colors.warningText, lineHeight: 19 },

  subtotalCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  subtotalTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  subtotalRange: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  subtotalValue: { fontSize: 18, fontWeight: "700", color: colors.text },

  footer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  sumCarCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  sumThumb: { width: 76, height: 58, borderRadius: theme.radius.field, backgroundColor: colors.primary100 },
  sumName: { fontSize: 15, fontWeight: "700", color: colors.text },
  sumMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  bdRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bdLabel: { fontSize: 15, color: colors.textMuted },
  bdValue: { fontSize: 15, color: colors.text, fontWeight: "500" },
  bdTotal: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: theme.spacing.md },
  bdTotalLabel: { fontSize: 17, fontWeight: "700", color: colors.text },
  bdTotalValue: { fontSize: 18, fontWeight: "700", color: colors.text },
});
