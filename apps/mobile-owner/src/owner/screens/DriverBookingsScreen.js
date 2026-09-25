import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  Icon,
  Chip,
  Badge,
  Button,
  EmptyState,
  ApiClient,
  RatingModal,
  GpsTrackingModal,
  PreCheckinModal,
  ReportFineModal,
  CobroPosteriorModal,
  msjError,
  LlegadaPorUbicacion,
  gananciaDelDueno,
  PORCENTAJE_DUENO,
} from "@rentacar/mobile-shared";
import { CabeceraOwner } from "../comun";

// El backend manda fechas sin zona horaria (UTC): sin la "Z" JS las leería como hora local.
function instante(iso) {
  if (!iso) return null;
  const ms = new Date(/Z$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function fechaYHora(iso) {
  const ms = instante(iso);
  if (ms === null) return "—";
  return new Date(ms).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatearFecha(iso) {
  const ms = instante(iso);
  if (ms === null) return "—";
  return new Date(ms).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

const ESTADO_BADGE = {
  confirmada: { variant: "info", label: "Por entregar" },
  en_curso: { variant: "success", label: "En curso" },
  finalizada: { variant: "neutral", label: "Finalizada" },
  cancelada: { variant: "danger", label: "Cancelada" },
  pendiente: { variant: "warning", label: "Pendiente" },
};

const FILTROS = [
  { id: "todas", label: "Todas" },
  { id: "pendiente", label: "Solicitudes" },
  { id: "confirmada", label: "Por entregar" },
  { id: "en_curso", label: "Por devolver" },
];

export function DriverBookingsScreen({ onOpenDelivery, onOpenContract, onOpenChat, noLeidos }) {
  const insets = useSafeAreaInsets();
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("todas");
  const [calificadas, setCalificadas] = useState({});
  const [reservaACalificar, setReservaACalificar] = useState(null);
  const [autoRastreo, setAutoRastreo] = useState(null);
  const [reservaParaPrecheck, setReservaParaPrecheck] = useState(null);
  const [reservaParaMulta, setReservaParaMulta] = useState(null);
  const [reservaParaCobroPosterior, setReservaParaCobroPosterior] = useState(null);
  // id de la reserva cuya solicitud (aceptar/rechazar) está en curso: evita doble-tap.
  const [procesandoSolicitud, setProcesandoSolicitud] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReservas((await ApiClient.getReservas("dueno")) || []);
    } catch (err) {
      setError(msjError(err, "No se pudieron cargar tus reservas."));
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
    // Ganancia del dueño: lo que ya se le abonó, o si aún no hay liquidación,
    // su parte de lo que el arrendatario paga por el arriendo (`monto_cobro`).
    // Nunca se calcula sobre `monto_hold`, que es la garantía retenida.
    const liquidado = item.liquidacion_dueno_clp || 0;
    const ganancia = liquidado || (item.monto_cobro ? gananciaDelDueno(item.monto_cobro) : 0);
    const badge = ESTADO_BADGE[item.estado] || ESTADO_BADGE.pendiente;
    const puedeEntregar = item.estado === "confirmada";
    const puedeDevolver = item.estado === "en_curso";
    const instanteInicio = item.fecha_inicio ? instante(item.fecha_inicio) : null;
    const msHastaRetiro = instanteInicio !== null ? instanteInicio - Date.now() : null;
    const dentroDe24h = item.estado === "confirmada" && msHastaRetiro !== null && msHastaRetiro > 0 && msHastaRetiro < 86400000;
    const debePrecheck = dentroDe24h && !item.precheck_dueno_confirmado;
    return (
      <View className="bg-white rounded-2xl border border-gray-100 p-4 gap-3 shadow-sm mb-4">
        <View className="flex-row justify-between items-center gap-2">
          <Text className="text-base font-bold text-textDark flex-1">{nombre}</Text>
          <Badge variant={badge.variant} label={badge.label} />
        </View>

        <View className="bg-surface-subtle p-3 rounded-xl gap-2">
          <View className="flex-row justify-between items-center gap-3">
            <Text className="text-[13px] text-textMuted">Fechas</Text>
            <Text className="text-[13px] font-semibold text-textDark flex-shrink text-right">
              {formatearFecha(item.fecha_inicio)} → {formatearFecha(item.fecha_fin)}
            </Text>
          </View>
          <View className="flex-row justify-between items-center gap-3">
            <Text className="text-[13px] text-textMuted">Lugar de entrega</Text>
            <Text className="text-[13px] font-semibold text-textDark flex-shrink text-right" numberOfLines={1}>
              {item.lugar_entrega_acordado || "—"}
            </Text>
          </View>
          <View className="h-[1px] bg-gray-200 my-0.5" />
          {ganancia > 0 ? (
            <View className="flex-row justify-between items-center gap-3">
              <Text className="text-[13px] text-textDark font-bold">
                {liquidado ? "Tu ganancia" : `Tu ganancia (${Math.round(PORCENTAJE_DUENO * 100)}%)`}
              </Text>
              <Text className="text-[15px] font-extrabold text-accent-700">${ganancia.toLocaleString("es-CL")}</Text>
            </View>
          ) : null}
        </View>

        {item.estado === "pendiente" && (
          <View className="gap-2">
            {item.confirmar_dueno_antes_de ? (
              <Text className="text-[13px] font-semibold text-amber-800">
                Confirma antes de {fechaYHora(item.confirmar_dueno_antes_de)}. Si no, se cancela y se devuelve todo al arrendatario.
              </Text>
            ) : null}
            <Button
              testID={`btn-aceptar-${item.id}`}
              label="Aceptar solicitud de arriendo"
              iconLeft="check"
              variant="primary"
              loading={procesandoSolicitud === item.id}
              disabled={procesandoSolicitud !== null && procesandoSolicitud !== item.id}
              onPress={async () => {
                if (procesandoSolicitud) return;
                setProcesandoSolicitud(item.id);
                try {
                  await ApiClient.actualizarEstadoReserva(item.id, "confirmada");
                  cargar();
                } catch (err) {
                  setError(msjError(err, "No se pudo aceptar la reserva."));
                } finally {
                  setProcesandoSolicitud(null);
                }
              }}
            />
            <Button
              testID={`btn-rechazar-${item.id}`}
              label="Rechazar solicitud"
              variant="secondary"
              loading={procesandoSolicitud === item.id}
              disabled={procesandoSolicitud !== null && procesandoSolicitud !== item.id}
              onPress={async () => {
                if (procesandoSolicitud) return;
                setProcesandoSolicitud(item.id);
                try {
                  await ApiClient.actualizarEstadoReserva(item.id, "cancelada");
                  cargar();
                } catch (err) {
                  setError(msjError(err, "No se pudo rechazar la reserva."));
                } finally {
                  setProcesandoSolicitud(null);
                }
              }}
            />
          </View>
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
            testID={`btn-iniciar-entrega-${auto.patente || item.id}`}
            label={puedeEntregar ? "Iniciar entrega con QR" : "Iniciar devolución con QR"}
            iconRight="arrow-right"
            variant="primary"
            onPress={() => onOpenDelivery?.(item)}
          />
        )}
        {item.estado === "confirmada" ? (
          <LlegadaPorUbicacion reserva={item} rol="dueno" onActualizada={() => cargar()} />
        ) : null}
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
    <View className="flex-1 bg-background" style={{ paddingTop: Math.max(insets.top, 12) }}>
      <CabeceraOwner
        titulo="Reservas de mis autos"
        subtitulo="Entrega y devolución verificadas por QR"
        noLeidos={noLeidos}
        onMensajes={onOpenChat}
      />

      <View className="flex-row gap-2 px-4 pb-3">
        {FILTROS.map((f) => (
          <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </View>

      {error && (
        <View className="flex-row items-center gap-2 mx-4 mb-3 bg-red-50 rounded-xl p-3">
          <Icon name="warning" size={15} color={colors.danger} />
          <Text className="text-red-700 text-[13px] flex-1">{error}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
          className="px-4"
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
