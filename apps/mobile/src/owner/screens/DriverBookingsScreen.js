import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  theme,
  Icon,
  Chip,
  Badge,
  Button,
  EmptyState,
  ApiClient,
  RatingModal,
  ContractSignatureModal,
  GpsTrackingModal,
  PreCheckinModal,
  ReportFineModal,
  CobroPosteriorModal,
} from "@rentacar/mobile-shared";
import { CabeceraOwner, oc } from "../comun";

function formatearFecha(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

const ESTADO_BADGE = {
  confirmada: { variant: "info", label: "Por entregar" },
  en_curso: { variant: "success", label: "En curso" },
  finalizada: { variant: "neutral", label: "Finalizada" },
  cancelada: { variant: "danger", label: "Cancelada" },
  pendiente: { variant: "warning", label: "Pendiente" },
};

const FILTROS = [
  { id: "confirmada", label: "Por entregar" },
  { id: "en_curso", label: "Por devolver" },
  { id: "todas", label: "Todas" },
];

// El backend confirma la reserva de inmediato al crearla — esta pantalla
// lista las reservas reales de los autos del dueño y da entrada al flujo de
// entrega/devolución con QR.
export function DriverBookingsScreen({ onOpenDelivery, onOpenContract, onOpenChat, noLeidos }) {
  const insets = useSafeAreaInsets();
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("confirmada");
  const [calificadas, setCalificadas] = useState({});
  const [reservaACalificar, setReservaACalificar] = useState(null);
  const [reservaAFirmar, setReservaAFirmar] = useState(null);
  const [autoRastreo, setAutoRastreo] = useState(null);
  const [reservaParaPrecheck, setReservaParaPrecheck] = useState(null);
  const [reservaParaMulta, setReservaParaMulta] = useState(null);
  const [reservaParaCobroPosterior, setReservaParaCobroPosterior] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReservas((await ApiClient.getReservas("dueno")) || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtered = reservas.filter((r) => (filter === "todas" ? true : r.estado === filter));

  useEffect(() => {
    const pendientes = filtered.filter(
      (r) => r.estado === "finalizada" && calificadas[r.id] === undefined
    );
    if (pendientes.length === 0) return;
    let vivo = true;
    Promise.all(
      pendientes.map((r) =>
        ApiClient.getCalificacionesDeReserva(r.id).then((cs) => [
          r.id,
          (cs || []).some((c) => c.autor_rol === "dueno"),
        ])
      )
    ).then((pares) => {
      if (!vivo) return;
      setCalificadas((prev) => ({ ...prev, ...Object.fromEntries(pares) }));
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.map((r) => r.id).join(",")]);

  const renderItem = ({ item }) => {
    const auto = item.auto || {};
    const nombre = [auto.marca, auto.modelo, auto.anio].filter(Boolean).join(" ") || "Auto";
    const ganancia = Math.round((item.monto_hold || 0) * 0.85);
    const badge = ESTADO_BADGE[item.estado] || ESTADO_BADGE.pendiente;
    const puedeEntregar = item.estado === "confirmada";
    const puedeDevolver = item.estado === "en_curso";
    // El dueño firma su parte del contrato antes de entregar el vehículo.
    const yaFirmoDueno = (item.firmas || []).some((f) => f.rol === "arrendador");
    const debeFirmar = !yaFirmoDueno && ["pendiente", "confirmada"].includes(item.estado);
    // Verificación 24h antes: solo tiene sentido mientras falta menos de un
    // día para el retiro y el dueño todavía no la confirmó.
    const msHastaRetiro = item.fecha_inicio ? new Date(item.fecha_inicio).getTime() - Date.now() : null;
    const dentroDe24h = item.estado === "confirmada" && msHastaRetiro !== null && msHastaRetiro > 0 && msHastaRetiro < 86400000;
    const debePrecheck = dentroDe24h && !item.precheck_dueno_confirmado;

    return (
      <View style={[oc.card, styles.card]}>
        <View style={styles.cardHead}>
          <Text style={styles.carName}>{nombre}</Text>
          <Badge variant={badge.variant} label={badge.label} />
        </View>

        <View style={[oc.seccionSuave, styles.detail]}>
          <View style={styles.row}>
            <Text style={styles.label}>Fechas</Text>
            <Text style={styles.value}>
              {formatearFecha(item.fecha_inicio)} → {formatearFecha(item.fecha_fin)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Lugar de entrega</Text>
            <Text style={styles.value} numberOfLines={1}>
              {item.lugar_entrega_acordado || "—"}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.text, fontWeight: "700" }]}>Tu ganancia (85%)</Text>
            <Text style={styles.earnings}>${ganancia.toLocaleString("es-CL")}</Text>
          </View>
        </View>

        {debeFirmar && (
          <Button
            label="Firmar el contrato"
            iconLeft="document"
            onPress={() => setReservaAFirmar(item)}
          />
        )}
        {debePrecheck && (
          <Button
            variant="secondary"
            size="sm"
            label="Confirmar entrega de mañana"
            iconLeft="check"
            onPress={() => setReservaParaPrecheck(item)}
          />
        )}
        {(puedeEntregar || puedeDevolver) && (
          <Button
            label={puedeEntregar ? "Iniciar entrega con QR" : "Iniciar devolución con QR"}
            iconRight="arrow-right"
            variant={debeFirmar ? "secondary" : "primary"}
            onPress={() => onOpenDelivery?.(item)}
          />
        )}
        {item.estado === "en_curso" && auto.id && (
          <Button
            variant="secondary"
            size="sm"
            label="Ver ubicación en vivo"
            iconLeft="pin"
            onPress={() => setAutoRastreo({ ...auto, reservaId: item.id })}
          />
        )}
        {item.estado === "finalizada" && calificadas[item.id] === false && (
          <Button
            variant="secondary"
            size="sm"
            label="Calificar a este arrendatario"
            iconLeft="star"
            onPress={() => setReservaACalificar(item)}
          />
        )}
        {item.estado === "finalizada" && (
          <Button
            variant="secondary"
            size="sm"
            label="Reportar falta o penalización"
            iconLeft="alert"
            onPress={() => setReservaParaMulta(item)}
          />
        )}
        {item.estado === "finalizada" && (
          <Button
            variant="ghost"
            size="sm"
            label="Reportar peaje o fotomulta"
            onPress={() => setReservaParaCobroPosterior(item)}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          label="Ver contrato de esta reserva"
          onPress={() => onOpenContract?.(item)}
        />
      </View>
    );
  };

  return (
    <View style={[oc.screen, { paddingTop: Math.max(insets.top, 12) }]}>
      <CabeceraOwner
        titulo="Reservas de mis autos"
        subtitulo="Entrega y devolución verificadas por QR"
        noLeidos={noLeidos}
        onMensajes={onOpenChat}
      />

      <View style={styles.filters}>
        {FILTROS.map((f) => (
          <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Icon name="warning" size={15} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[oc.listContent, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} tintColor={colors.primary} />}
          renderItem={renderItem}
          ListEmptyComponent={
            <EmptyState
              icon="calendar"
              title={filter === "todas" ? "Sin reservas todavía" : "Nada en este estado"}
              message="Cuando alguien reserve tus autos, las reservas aparecerán aquí para coordinar la entrega."
            />
          }
        />
      )}

      <RatingModal
        visible={!!reservaACalificar}
        onClose={() => setReservaACalificar(null)}
        reservaId={reservaACalificar?.id}
        autorRol="dueno"
        destinatarioId={reservaACalificar?.cliente_id}
        destinatarioNombre="tu arrendatario"
        onSubmitted={() => {
          setCalificadas((prev) => ({ ...prev, [reservaACalificar.id]: true }));
          setReservaACalificar(null);
        }}
      />

      <ContractSignatureModal
        visible={!!reservaAFirmar}
        reservaId={reservaAFirmar?.id}
        parte="arrendador"
        onClose={() => setReservaAFirmar(null)}
        onSigned={() => {
          setReservaAFirmar(null);
          cargar();
        }}
        onVerContrato={reservaAFirmar ? () => onOpenContract?.(reservaAFirmar) : undefined}
      />

      <GpsTrackingModal
        visible={!!autoRastreo}
        autoId={autoRastreo?.id}
        patente={autoRastreo?.patente}
        nombreAuto={[autoRastreo?.marca, autoRastreo?.modelo].filter(Boolean).join(" ")}
        onClose={() => setAutoRastreo(null)}
      />

      <PreCheckinModal
        visible={!!reservaParaPrecheck}
        reserva={reservaParaPrecheck}
        role="dueno"
        onClose={() => setReservaParaPrecheck(null)}
        onConfirmed={() => {
          setReservaParaPrecheck(null);
          cargar();
        }}
      />

      <ReportFineModal
        visible={!!reservaParaMulta}
        reserva={reservaParaMulta}
        onClose={() => setReservaParaMulta(null)}
        onApplied={() => {
          setReservaParaMulta(null);
          cargar();
        }}
      />

      <CobroPosteriorModal
        visible={!!reservaParaCobroPosterior}
        reserva={reservaParaCobroPosterior}
        onClose={() => setReservaParaCobroPosterior(null)}
        onCobrado={() => {
          setReservaParaCobroPosterior(null);
          cargar();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.screen,
    paddingBottom: theme.spacing.md,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: theme.spacing.screen,
    marginBottom: theme.spacing.md,
    backgroundColor: colors.dangerBg,
    borderRadius: theme.radius.field,
    padding: theme.spacing.md,
  },
  errorText: { color: colors.dangerText, fontSize: 13, flex: 1 },
  card: { padding: theme.spacing.lg, gap: theme.spacing.md },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm },
  carName: { fontSize: 16, fontWeight: "700", color: colors.text, flex: 1 },
  detail: { gap: theme.spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.md },
  label: { fontSize: 13, color: colors.textMuted },
  value: { fontSize: 13, fontWeight: "600", color: colors.text, flexShrink: 1, textAlign: "right" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  earnings: { fontSize: 15, fontWeight: "800", color: colors.accentDark },
});
