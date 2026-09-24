import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Icon, Badge, EmptyState, ScreenHeader, ApiClient, RatingModal, msjError, useCuentaRegresiva, CarPhotoThumb } from "@rentacar/mobile-shared";

function formatearRango(inicio, fin) {
  if (!inicio || !fin) return "—";
  const opts = { day: "numeric", month: "short" };
  return `${new Date(inicio).toLocaleDateString("es-CL", opts)} – ${new Date(fin).toLocaleDateString("es-CL", opts)}`;
}

const BADGE = {
  en_curso: { variant: "info", label: "En curso" },
  pendiente: { variant: "warning", label: "Esperando al dueño" },
  confirmada: { variant: "warning", label: "Confirmada" },
  finalizada: { variant: "neutral", label: "Finalizada" },
  cancelada: { variant: "danger", label: "Cancelada" },
};

const TABS = [
  { id: "todas", label: "Todas", estados: null },
  { id: "pendientes", label: "Pendientes", estados: ["pendiente_pago"] },
  { id: "activas", label: "Activas", estados: ["en_curso"] },
  { id: "proximas", label: "Próximas", estados: ["pendiente", "confirmada"] },
  { id: "pasadas", label: "Pasadas", estados: ["finalizada", "cancelada"] },
];

export function RentalHistoryScreen({ onSelectReservation, onBack, onContinuarPago, onExplorar }) {
  const [tab, setTab] = useState("todas");
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);
  // reservaId -> true si el cliente ya calificó esa reserva.
  const [calificadas, setCalificadas] = useState({});
  const [reservaACalificar, setReservaACalificar] = useState(null);

  // `refresco` separa las dos formas de recargar: la carga inicial muestra el
  // spinner de pantalla completa y el pull-to-refresh el del RefreshControl.
  // Antes refreshing quedaba fijo en false y el refresco nunca se veía.
  const cargar = useCallback(
    async ({ refresco = false } = {}) => {
      if (refresco) setRefrescando(true);
      else setLoading(true);
      setError(null);
      try {
        setReservas((await ApiClient.getReservas("cliente")) || []);
      } catch (err) {
        setError(msjError(err, "No se pudieron cargar tus reservas."));
      } finally {
        setLoading(false);
        setRefrescando(false);
      }
    },
    []
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const estados = TABS.find((t) => t.id === tab)?.estados || null;
  const filtradas = estados ? reservas.filter((r) => estados.includes(r.estado)) : reservas;

  // Solo se necesita saber si ya se calificó para las finalizadas de la
  // pestaña "pasadas" — se consulta ahí en vez de para todo el historial.
  useEffect(() => {
    if (tab !== "pasadas") return;
    const pendientes = filtradas.filter(
      (r) => r.estado === "finalizada" && calificadas[r.id] === undefined
    );
    if (pendientes.length === 0) return;
    let vivo = true;
    Promise.all(
      pendientes.map((r) =>
        ApiClient.getCalificacionesDeReserva(r.id).then((cs) => [
          r.id,
          (cs || []).some((c) => c.autor_rol === "cliente"),
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
  }, [tab, filtradas.map((r) => r.id).join(",")]);

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Mis reservas" onBack={onBack} />

      <View className="flex-row gap-8 px-4 border-b border-border">
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            className="pt-2"
            onPress={() => setTab(t.id)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.id }}
            accessibilityLabel={t.label}
          >
            <Text className={`text-[15px] pb-2.5 ${tab === t.id ? "font-semibold text-textDark" : "text-textMuted"}`}>
              {t.label}
            </Text>
            <View className={`h-[2.5px] rounded-full ${tab === t.id ? "bg-primary" : "bg-transparent"}`} />
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#0F766E" className="mt-10" />
      ) : error ? (
        <EmptyState icon="warning" title="No se pudo cargar" message={error} action="Reintentar" onAction={cargar} />
      ) : (
        <ScrollView
          contentContainerClassName="p-4 gap-3"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => cargar({ refresco: true })} tintColor="#0F766E" />
          }
        >
          {filtradas.map((r) => {
            const auto = r.auto || {};
            const badge = BADGE[r.estado] || BADGE.confirmada;
            const nombre = [auto.marca, auto.modelo, auto.anio].filter(Boolean).join(" ") || "Auto";
            return (
              <TouchableOpacity
                key={r.id}
                className="bg-white border border-border rounded-2xl p-3 flex-row items-center gap-3 shadow-sm"
                onPress={() => onSelectReservation(r)}
                activeOpacity={0.85}
              >
                <CarPhotoThumb uri={auto.fotos?.[0]} className="w-[76px] h-[60px] rounded-xl" />
                <View className="flex-1 gap-1">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="text-[15px] font-bold text-textDark flex-1" numberOfLines={1}>{nombre}</Text>
                    <Badge variant={badge.variant} label={badge.label} />
                  </View>
                  <Text className="text-[13px] text-textMuted">
                    {formatearRango(r.fecha_inicio, r.fecha_fin)}
                    {r.lugar_entrega_acordado ? ` · ${r.lugar_entrega_acordado}` : ""}
                  </Text>
                  {r.estado === "en_curso" && (
                    <Text className="text-[13px] font-semibold text-amber-800">
                      Garantía retenida · ${(r.monto_hold || 0).toLocaleString("es-CL")}
                    </Text>
                  )}
                  {r.estado === "pendiente_pago" && (
                    <PendienteRow reserva={r} onContinuar={() => onContinuarPago?.(r)} />
                  )}
                  {r.estado === "finalizada" && calificadas[r.id] === false && (
                    <TouchableOpacity
                      className="flex-row items-center gap-1 mt-0.5 self-start"
                      onPress={() => setReservaACalificar(r)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="star" size={14} color="#B45309" fill="#B45309" />
                      <Text className="text-[13px] font-semibold text-amber-800">Calificar este arriendo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {filtradas.length === 0 && (
            <EmptyState
              icon="calendar"
              title="Nada por aquí"
              message={
                tab === "todas"
                  ? "Todavía no tienes reservas."
                  : tab === "pendientes"
                  ? "No tienes reservas esperando pago."
                  : tab === "activas"
                  ? "No tienes arriendos en curso ahora mismo."
                  : tab === "proximas"
                  ? "No tienes reservas próximas ni esperando al dueño."
                  : "Aún no tienes arriendos finalizados o cancelados."
              }
              action={onExplorar ? "Explorar autos" : undefined}
              onAction={onExplorar}
            />
          )}
        </ScrollView>
      )}

      <RatingModal
        visible={!!reservaACalificar}
        onClose={() => setReservaACalificar(null)}
        reservaId={reservaACalificar?.id}
        autorRol="cliente"
        destinatarioId={reservaACalificar?.auto?.dueno_id}
        destinatarioNombre={[reservaACalificar?.auto?.marca, reservaACalificar?.auto?.modelo].filter(Boolean).join(" ")}
        onSubmitted={() => {
          setCalificadas((prev) => ({ ...prev, [reservaACalificar.id]: true }));
          setReservaACalificar(null);
        }}
      />
    </View>
  );
}

// Cuenta regresiva + "Continuar pago" para una reserva que quedó
// pendiente_pago — antes esta pestaña no existía y la reserva no aparecía
// en ningún lado hasta que expiraba sola.
function PendienteRow({ reserva, onContinuar }) {
  const cuenta = useCuentaRegresiva(reserva.expira_en);
  return (
    <View className="gap-1.5 mt-1">
      <Text className={`text-[13px] font-semibold ${cuenta.vencido ? "text-red-600" : "text-amber-800"}`}>
        {cuenta.vencido ? "Expiró" : cuenta.etiqueta ? `Expira en ${cuenta.etiqueta}` : "Pendiente de pago"}
      </Text>
      {!cuenta.vencido && (
        <TouchableOpacity
          className="flex-row items-center gap-1 mt-0.5 self-start"
          onPress={onContinuar}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="arrow-right" size={14} color="#B45309" />
          <Text className="text-[13px] font-semibold text-amber-800">Continuar pago</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

