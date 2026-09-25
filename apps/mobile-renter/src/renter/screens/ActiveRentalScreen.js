import React, { useState, useEffect } from "react";
import { View, Text, StatusBar, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";

let MapView = null;
let Marker = null;
try {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
} catch (e) {
  MapView = null;
}
import {
  Icon,
  Button,
  Card,
  Badge,
  ScreenHeader,
  SectionLabel,
  MenuList,
  MenuRow,
  PreCheckinModal,
  SegundoConductorModal,
  useTelemetriaArriendo,
  LlegadaPorUbicacion,
  CarPhotoThumb,
} from "@rentacar/mobile-shared";
import { RenovarGarantiaAviso } from "../components/RenovarGarantiaAviso";

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || "").replace(/\/$/, "");

// El backend manda fechas sin zona horaria (UTC): sin la "Z" JS las leería
// como hora local. En Chile (UTC-3/-4) eso desplaza cuentas regresivas y
// ventanas de tiempo varias horas.
function instante(iso) {
  if (!iso) return null;
  const ms = new Date(/Z$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Cuenta regresiva compacta hasta la hora acordada de devolución. Reemplaza
// el texto suelto "horas restantes" por algo que se lee de un vistazo.
function restanteHasta(iso) {
  const fin = instante(iso);
  if (fin === null) return null;
  const ms = fin - Date.now();
  const vencido = ms <= 0;
  const abs = Math.abs(ms);
  const dias = Math.floor(abs / 86400000);
  const horas = Math.floor((abs % 86400000) / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  const texto = dias >= 1 ? `${dias}d ${horas}h` : horas >= 1 ? `${horas}h ${mins}m` : `${mins}m`;
  return { texto, vencido };
}

const clp = (n) => `$${(n || 0).toLocaleString("es-CL")}`;

function fechaHora(iso, largo = false) {
  const ms = instante(iso);
  if (ms === null) return "—";
  const d = new Date(ms);
  const f = d.toLocaleDateString("es-CL", largo
    ? { weekday: "long", day: "2-digit", month: "long" }
    : { day: "2-digit", month: "short" });
  const h = d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  return `${f} · ${h}`;
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
  onResumirPago,
  onUpdateReservation,
}) {
  const insets = useSafeAreaInsets();
  const [res, setRes] = useState(reservation || {});

  useEffect(() => {
    if (reservation) {
      setRes(reservation);
    }
  }, [reservation]);

  const handlePrecheckConfirmed = (updated) => {
    const nuevo = { ...res, ...updated };
    setRes(nuevo);
    onUpdateReservation?.(nuevo);
  };
  const [modalPrecheck, setModalPrecheck] = useState(false);
  // Re-render cada minuto para que las cuentas regresivas no queden congeladas.
  const [, setTic] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTic((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);
  const [modalSegundoConductor, setModalSegundoConductor] = useState(false);
  const car = res.car || res.auto || {};
  const montoHold = res.monto_hold || 0;
  const nombre = [car.marca, car.modelo, car.anio].filter(Boolean).join(" ") || "Auto";
  const [ownerFotoError, setOwnerFotoError] = useState(false);
  const duenoNombre = car.dueno_nombre || res.dueno_nombre || "Dueño del vehículo";
  const duenoFoto = car.dueno_foto_url || res.dueno_foto_url;

  // "pendiente" = pagada, esperando que el dueño confirme (plazo de 24 h). "pendiente_pago" = falta pagar.
  const [view, setView] = useState(
    res.estado === "en_curso"
      ? "detail"
      : res.estado === "confirmada"
      ? "confirmed"
      : res.estado === "pendiente"
      ? "waiting"
      : res.estado === "cancelada"
      ? "cancelled"
      : "sent"
  );

  // Telemetría GPS en tiempo real transmitida por el celular del arrendatario
  const { transmitiendo: gpsTransmitiendo, ultimaUbicacion: gpsUbicacion } = useTelemetriaArriendo(
    res.id,
    res.estado === "en_curso"
  );

  const footer = (children) => (
    <View
      className="px-4 pt-3 bg-white border-t border-border gap-2"
      style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}
    >
      {children}
    </View>
  );

  // -------------------------------------------------------------- ENVIADA
  if (view === "sent") {
    return (
      <View className="flex-1 bg-background">
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerClassName="p-8 items-center gap-4" showsVerticalScrollIndicator={false}>
          <View className="w-[76px] h-[76px] rounded-full bg-amber-50 items-center justify-center mt-8">
            <Icon name="clock" size={34} color="#F59E0B" />
          </View>
          <View className="items-center gap-2">
            <Text className="text-xl font-bold text-textDark text-center">Reserva pendiente de pago</Text>
            <Text className="text-[15px] text-textMuted leading-[22px] text-center">
              Falta elegir tarjetas y confirmar el pago para asegurar tu reserva.
            </Text>
          </View>
          <Card padded className="w-full gap-3">
            <Row label="Auto" value={nombre} />
            <Row label="Fechas" value={`${fechaHora(res.fecha_inicio)} → ${fechaHora(res.fecha_fin)}`} />
            <Row label="Garantía (hold)" value={`$${montoHold.toLocaleString("es-CL")}`} strong />
            <View className="h-px bg-border" />
            <Row label="Estado" value="Pendiente de pago" warn />
          </Card>
          <View className="w-full bg-teal-50 rounded-xl p-4 gap-1">
            <Text className="text-[13px] text-primary leading-[19px]">
              El hold es una pre-autorización, no un cobro. Se libera al devolver el auto sin daños.
            </Text>
          </View>
        </ScrollView>
        {footer(
          <>
            <Button
              label="Elegir tarjetas y pagar"
              iconRight="arrow-right"
              onPress={() => onResumirPago?.(res)}
            />
            <Button variant="ghost" size="sm" label="Seguir mirando autos" onPress={onBack} />
          </>
        )}
      </View>
    );
  }

  // ------------------------------------------------- ESPERANDO AL DUEÑO
  if (view === "waiting") {
    const plazo = res.plazo_confirmacion_dueno || res.confirmar_dueno_antes_de;
    return (
      <View className="flex-1 bg-background">
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Tu reserva" onBack={onBack} />
        <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
          <RenovarGarantiaAviso reserva={res} onRenovada={() => setRes((r) => ({ ...r, garantia_por_renovar: false }))} />
          <View className="w-[68px] h-[68px] rounded-full bg-amber-50 items-center justify-center self-center mt-4">
            <Icon name="clock" size={32} color="#F59E0B" />
          </View>
          <View className="items-center gap-1.5 px-4">
            <Text className="text-xl font-bold text-textDark text-center">Esperando la confirmación del dueño</Text>
            <Text className="text-[14px] text-textMuted leading-[21px] text-center">
              {plazo
                ? `El dueño tiene hasta ${fechaHora(plazo)} para confirmar.`
                : "El dueño tiene 24 horas para confirmar."}{" "}
              Si no lo hace, cancelamos la reserva y te devolvemos todo.
            </Text>
          </View>

          <Card padded className="gap-2.5">
            <Row label="Auto" value={nombre} />
            <Row label="Fechas" value={`${fechaHora(res.fecha_inicio)} → ${fechaHora(res.fecha_fin)}`} />
            <Row label="Estado" value="Esperando al dueño" warn />
          </Card>

          {res.cobro?.monto ? (
            <Card padded className="gap-2.5">
              <SectionLabel>Resumen del pago</SectionLabel>
              <Row label="Arriendo pagado" value={clp(res.cobro.monto)} strong />
              <Row label="Garantía retenida" value={clp(res.garantia?.monto ?? res.monto_hold)} />
              <Text className="text-xs text-textMuted leading-[17px]">
                La garantía es una retención sobre tu cupo, no un cargo. Se libera al devolver el auto sin daños (la reversa bancaria tarda entre 24 y 72 hrs hábiles).
              </Text>
            </Card>
          ) : null}
        </ScrollView>
        {footer(
          <>
            <Button variant="danger" size="sm" label="Cancelar la reserva" onPress={onCancelReservation} />
            <Button variant="ghost" size="sm" label="Seguir mirando autos" onPress={onBack} />
          </>
        )}
      </View>
    );
  }

  // ---------------------------------------------------------- CANCELADA
  if (view === "cancelled") {
    const motivo = {
      dueno_no_confirmo: "El dueño no confirmó a tiempo. Te devolvimos todo: el arriendo y la garantía.",
      no_presentacion:
        "Se canceló porque no te presentaste a retirar el auto. Se aplicó una multa que se entrega al dueño; " +
        "el resto del arriendo y la garantía se te devolvieron.",
      dueno_no_presentacion:
        "El dueño no se presentó a entregar el auto. Se le aplicó una multa y te devolvimos todo: " +
        "el arriendo y la garantía.",
      dueno_cancelo_tarde:
        "El dueño canceló con poca anticipación. Se le aplicó una multa y te devolvimos todo: el arriendo y " +
        "la garantía.",
      ninguno_se_presento:
        "Nadie se presentó a la entrega (ninguno avisó su llegada). Cancelamos la reserva sin multas " +
        "y te devolvimos todo.",
    }[res.motivo_cancelacion] || "Esta reserva fue cancelada.";
    return (
      <View className="flex-1 bg-background">
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Tu reserva" onBack={onBack} />
        <ScrollView contentContainerClassName="p-8 items-center gap-4" showsVerticalScrollIndicator={false}>
          <View className="w-[68px] h-[68px] rounded-full bg-red-50 items-center justify-center mt-8">
            <Icon name="close" size={32} color="#DC2626" />
          </View>
          <Text className="text-xl font-bold text-textDark text-center">Reserva cancelada</Text>
          <Text className="text-[15px] text-textMuted leading-[22px] text-center">{motivo}</Text>
          <Card padded className="w-full gap-3">
            <Row label="Auto" value={nombre} />
            <Row label="Fechas" value={`${fechaHora(res.fecha_inicio)} → ${fechaHora(res.fecha_fin)}`} />
          </Card>
        </ScrollView>
        {footer(<Button variant="ghost" size="sm" label="Volver" onPress={onBack} />)}
      </View>
    );
  }

  // ------------------------------------------------------------ CONFIRMADA
  if (view === "confirmed") {
    const msRetiro = instante(res.fecha_inicio);
    const msHastaRetiro = msRetiro !== null ? msRetiro - Date.now() : null;
    const faltaRetiro = restanteHasta(res.fecha_inicio);
    const dentroDe24h = msHastaRetiro !== null && msHastaRetiro <= 24 * 3600000;
    // Cancelar con 24 h o más de anticipación devuelve todo (cancelacion_service.HORAS_REEMBOLSO_TOTAL).
    const cancelaSinCosto = msHastaRetiro !== null && msHastaRetiro >= 24 * 3600000;
    const dias =
      instante(res.fecha_inicio) !== null && instante(res.fecha_fin) !== null
        ? Math.max(1, Math.round((instante(res.fecha_fin) - instante(res.fecha_inicio)) / 86400000))
        : null;

    // Solo coordenadas reales: antes, sin ubicación el mapa y "Cómo llegar" caían a
    // una coordenada fija de Los Ángeles y mandaban a la persona a otra ciudad.
    const lat = Number(res.lugar_entrega_lat ?? car.latitud);
    const lng = Number(res.lugar_entrega_lng ?? car.longitud);
    const hayCoordenadas = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
    const direccion = res.lugar_entrega_acordado || car.ubicacion_base || "";
    const abrirMapa = () => {
      const destino = hayCoordenadas ? `${lat},${lng}` : encodeURIComponent(direccion);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${destino}`);
    };

    const precheckListo = !!res.precheck_cliente_confirmado;
    const sc = res.segundo_conductor;
    const estadoSc = {
      verificado: { label: "Verificado", variant: "success" },
      requiere_revision_manual: { label: "En revisión", variant: "warning" },
      rechazado: { label: "Rechazado", variant: "danger" },
    }[sc?.estado_kyc] || { label: "Pendiente", variant: "neutral" };

    return (
      <View className="flex-1 bg-background">
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Tu reserva" onBack={onBack} />
        <ScrollView contentContainerClassName="p-4 gap-4 pb-8" showsVerticalScrollIndicator={false}>
          <RenovarGarantiaAviso reserva={res} onRenovada={() => setRes((r) => ({ ...r, garantia_por_renovar: false }))} />

          {/* Encabezado: qué auto, estado y cuánto falta para el retiro */}
          <Card padded={false} className="overflow-hidden">
            <View className="h-[150px] bg-teal-50">
              <CarPhotoThumb uri={car.fotos?.[0]} className="w-full h-full" iconSize={34} />
              <View className="absolute top-3 left-3 flex-row items-center gap-1.5 bg-white/95 rounded-full px-2.5 py-1">
                <Icon name="check" size={13} color="#0F766E" />
                <Text className="text-[12px] font-bold text-teal-800">Reserva confirmada</Text>
              </View>
            </View>
            <View className="p-4 gap-3">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-lg font-extrabold text-textDark" numberOfLines={2}>{nombre}</Text>
                  {car.patente ? <Text className="text-[13px] text-textMuted mt-0.5">Patente {car.patente}</Text> : null}
                </View>
                {faltaRetiro && !faltaRetiro.vencido ? (
                  <View className="items-end">
                    <Text className="text-[11px] font-semibold text-textMuted uppercase tracking-wide">Retiro en</Text>
                    <Text className="text-lg font-extrabold text-primary">{faltaRetiro.texto}</Text>
                  </View>
                ) : null}
              </View>

              <View className="flex-row items-stretch rounded-xl border border-border overflow-hidden">
                <View className="flex-1 p-3 gap-0.5">
                  <Text className="text-[11px] font-semibold text-textMuted uppercase tracking-wide">Retiro</Text>
                  <Text className="text-[13px] font-bold text-textDark capitalize">{fechaHora(res.fecha_inicio)}</Text>
                </View>
                <View className="w-px bg-border" />
                <View className="flex-1 p-3 gap-0.5">
                  <Text className="text-[11px] font-semibold text-textMuted uppercase tracking-wide">Devolución</Text>
                  <Text className="text-[13px] font-bold text-textDark capitalize">{fechaHora(res.fecha_fin)}</Text>
                </View>
              </View>
              {dias ? (
                <Text className="text-xs text-textMuted">
                  {dias} {dias === 1 ? "día" : "días"} de arriendo
                </Text>
              ) : null}
            </View>
          </Card>

          {/* Pasos antes del retiro, en el orden en que ocurren */}
          <SectionLabel>Antes del retiro</SectionLabel>
          <Card padded className="gap-3">
            <View className="flex-row items-start gap-3">
              <View
                className={`w-7 h-7 rounded-full items-center justify-center ${
                  precheckListo ? "bg-teal-600" : dentroDe24h ? "bg-amber-100" : "bg-slate-100"
                }`}
              >
                {precheckListo ? (
                  <Icon name="check" size={15} color="#FFFFFF" />
                ) : (
                  <Text className={`text-[13px] font-bold ${dentroDe24h ? "text-amber-800" : "text-slate-500"}`}>1</Text>
                )}
              </View>
              <View className="flex-1 gap-1">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-sm font-bold text-textDark">Confirma tu viaje</Text>
                  <Badge
                    variant={precheckListo ? "success" : dentroDe24h ? "warning" : "neutral"}
                    label={precheckListo ? "Listo" : dentroDe24h ? "Pendiente" : "24 h antes"}
                  />
                </View>
                <Text className="text-[13px] text-textMuted leading-[19px]">
                  {precheckListo
                    ? "Confirmaste tu asistencia a la entrega."
                    : dentroDe24h
                    ? "Faltan menos de 24 horas: confirma que vas a retirar el auto."
                    : "Se habilita 24 horas antes del retiro. Te avisaremos."}
                </Text>
                {!precheckListo && dentroDe24h ? (
                  <Button
                    size="sm"
                    label="Confirmar mi viaje"
                    iconRight="arrow-right"
                    onPress={() => setModalPrecheck(true)}
                    className="mt-1"
                  />
                ) : null}
              </View>
            </View>

            <View className="h-px bg-border" />

            <View className="flex-row items-start gap-3">
              <View className="w-7 h-7 rounded-full items-center justify-center bg-slate-100">
                <Text className="text-[13px] font-bold text-slate-500">2</Text>
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-sm font-bold text-textDark">Avisa tu llegada al punto de encuentro</Text>
                <Text className="text-[13px] text-textMuted leading-[19px]">
                  Desde 2 horas antes, la app confirma por ubicación que llegaste.
                </Text>
              </View>
            </View>
            <LlegadaPorUbicacion reserva={res} rol="cliente" onActualizada={handlePrecheckConfirmed} />

            <View className="h-px bg-border" />

            <View className="flex-row items-start gap-3">
              <View className="w-7 h-7 rounded-full items-center justify-center bg-slate-100">
                <Text className="text-[13px] font-bold text-slate-500">3</Text>
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-sm font-bold text-textDark">Muestra tu código de entrega</Text>
                <Text className="text-[13px] text-textMuted leading-[19px]">
                  El dueño lo escanea, registra las fotos del auto y firmas el acta en tu celular.
                </Text>
              </View>
            </View>
          </Card>

          {/* Punto de encuentro */}
          <Card padded={false} className="overflow-hidden">
            {hayCoordenadas && MapView ? (
              <View className="h-[150px] bg-teal-50">
                <MapView
                  style={{ width: "100%", height: "100%" }}
                  initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  toolbarEnabled={false}
                >
                  <Marker coordinate={{ latitude: lat, longitude: lng }} title={direccion || "Punto de encuentro"} />
                </MapView>
              </View>
            ) : null}
            <View className="p-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-teal-50 items-center justify-center">
                <Icon name="pin" size={20} color="#0F766E" />
              </View>
              <View className="flex-1">
                <Text className="text-[11px] font-semibold text-textMuted uppercase tracking-wide">Punto de encuentro</Text>
                <Text className="text-[15px] font-bold text-textDark" numberOfLines={2}>
                  {direccion || "Por coordinar con el dueño"}
                </Text>
              </View>
              {hayCoordenadas || direccion ? (
                <Button variant="secondary" size="sm" label="Cómo llegar" fullWidth={false} onPress={abrirMapa} />
              ) : null}
            </View>
          </Card>

          {/* Dueño */}
          <Card padded className="flex-row items-center gap-3">
            <View className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center overflow-hidden">
              {duenoFoto && !ownerFotoError ? (
                <Image
                  source={{ uri: duenoFoto }}
                  style={{ width: 48, height: 48, borderRadius: 24 }}
                  onError={() => setOwnerFotoError(true)}
                />
              ) : (
                <Icon name="user" size={22} color="#64748B" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-[11px] font-semibold text-textMuted uppercase tracking-wide">Tu anfitrión</Text>
              <Text className="text-[15px] font-bold text-textDark" numberOfLines={1}>{duenoNombre}</Text>
            </View>
            <Button variant="secondary" size="sm" iconLeft="chat" label="Chat" onPress={onOpenChat} fullWidth={false} />
          </Card>

          {/* Qué llevar */}
          <View className="bg-teal-50 rounded-2xl p-4 gap-2.5">
            <Text className="text-sm font-bold text-primary">Qué llevar a la entrega</Text>
            {[
              "Tu licencia de conducir física",
              "Tu carnet de identidad",
              "La tarjeta de crédito de la garantía",
            ].map((item) => (
              <View key={item} className="flex-row items-center gap-2">
                <Icon name="check" size={14} color="#0F766E" />
                <Text className="text-[13px] text-primary">{item}</Text>
              </View>
            ))}
          </View>

          {/* Pago */}
          {res.cobro?.monto ? (
            <Card padded className="gap-2.5">
              <SectionLabel>Pago</SectionLabel>
              <Row label="Arriendo pagado" value={clp(res.cobro.monto)} strong />
              <Row label="Garantía retenida" value={clp(res.garantia?.monto ?? res.monto_hold)} />
              <Text className="text-xs text-textMuted leading-[17px]">
                La garantía es una retención en tu tarjeta, no un cargo. Se libera al devolver el auto sin daños; tu
                banco tarda entre 24 y 72 horas hábiles en reflejarlo.
              </Text>
              {onOpenContract ? (
                <Button variant="ghost" size="sm" iconLeft="document" label="Ver el contrato" onPress={onOpenContract} />
              ) : null}
            </Card>
          ) : null}

          {/* Segundo conductor */}
          <Card padded className="gap-2">
            <View className="flex-row justify-between items-center gap-2">
              <Text className="text-sm font-bold text-textDark">Segundo conductor</Text>
              {sc ? <Badge label={estadoSc.label} variant={estadoSc.variant} /> : null}
            </View>
            <Text className="text-[13px] text-textMuted leading-[19px]">
              {sc
                ? sc.nombre
                  ? `${sc.nombre} · ${sc.rut || sc.numero_documento || "sin documento"}`
                  : "Verificación de identidad en curso…"
                : "¿Otra persona también va a manejar? Agrégala; debe verificar su identidad antes del retiro."}
            </Text>
            <Button
              variant="secondary"
              size="sm"
              label={sc ? "Gestionar segundo conductor" : "Agregar segundo conductor"}
              onPress={() => setModalSegundoConductor(true)}
            />
          </Card>

          {/* Cancelación, con la política clara */}
          {onCancelReservation ? (
            <View className="items-center gap-1 pt-1">
              <Button variant="ghost" size="sm" label="Cancelar la reserva" onPress={onCancelReservation} />
              <Text className="text-xs text-textMuted text-center px-6 leading-[17px]">
                {cancelaSinCosto
                  ? "Si cancelas ahora te devolvemos todo: el arriendo y la garantía."
                  : "Faltan menos de 24 horas para el retiro: si cancelas ahora, el arriendo no se devuelve."}
              </Text>
            </View>
          ) : null}
        </ScrollView>
        {footer(
          <>
            <Button label="Mostrar mi código de entrega" iconLeft="qr" onPress={onStartDelivery} />
            <Button variant="ghost" size="sm" label="Ver el detalle de la reserva" onPress={() => setView("detail")} />
          </>
        )}

        <PreCheckinModal
          visible={modalPrecheck}
          reserva={res}
          role="cliente"
          onClose={() => setModalPrecheck(false)}
          onConfirmed={handlePrecheckConfirmed}
        />

        <SegundoConductorModal
          visible={modalSegundoConductor}
          reservaId={res.id}
          initialData={res.segundo_conductor}
          onClose={() => setModalSegundoConductor(false)}
          onSaved={(nuevoSc) => {
            const nuevo = { ...res, segundo_conductor: nuevoSc };
            setRes(nuevo);
            onUpdateReservation?.(nuevo);
          }}
        />
      </View>
    );
  }

  // --------------------------------------------------------------- DETALLE
  const tieneCargosExtra = (res.cargos_adicionales_clp || 0) > 0 || (res.cargo_limpieza_clp || 0) > 0 || (res.cargo_combustible_clp || 0) > 0 || (res.cargo_atraso_clp || 0) > 0 || (res.cargo_falta_grave_clp || 0) > 0;

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScreenHeader
        title="Detalle de la reserva"
        onBack={() => setView("confirmed")}
        right={<Badge variant={res.estado === "en_curso" ? "info" : "neutral"} label={res.estado === "en_curso" ? "En curso" : res.estado || "—"} />}
      />
      <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
        <RenovarGarantiaAviso reserva={res} onRenovada={() => setRes((r) => ({ ...r, garantia_por_renovar: false }))} />
        <Card padded className="flex-row items-center gap-3">
          <CarPhotoThumb uri={car.fotos?.[0]} className="w-[76px] h-[58px] rounded-xl" />
          <View className="flex-1">
            <Text className="text-[15px] font-bold text-textDark">{nombre}</Text>
            {/* La patente recién se muestra una vez retirado el auto: antes
                de eso no hay nada que hacer con ese dato. */}
            {res.estado === "en_curso" && (
              <Text className="text-[13px] text-textMuted mt-0.5">Patente {car.patente || "—"}</Text>
            )}
          </View>
        </Card>

        {res.estado === "en_curso" && (() => {
          const cd = restanteHasta(res.fecha_fin);
          return (
            <View className={`rounded-2xl py-4 items-center gap-1 ${cd?.vencido ? "bg-amber-800" : "bg-primary"}`}>
              <Text className="text-2xl font-extrabold text-white tracking-[0.5px]">{cd ? (cd.vencido ? `Atrasado ${cd.texto}` : cd.texto) : "—"}</Text>
              <Text className="text-[11px] text-teal-200 uppercase tracking-[0.6px]">
                {cd?.vencido ? "pasada la hora de devolución" : "para la hora de devolución acordada"}
              </Text>
            </View>
          );
        })()}

        {res.estado === "en_curso" && (
          <Card padded className="gap-1.5 bg-green-50 border border-teal-700">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Icon name="pin" size={18} color="#0F766E" />
                <Text className="text-sm font-bold text-textDark">
                  Ubicación en vivo del arriendo
                </Text>
              </View>
              <Badge
                variant={gpsTransmitiendo ? "info" : "success"}
                label={gpsTransmitiendo ? "Transmitiendo..." : "En línea"}
              />
            </View>
            <Text className="text-[13px] text-textMuted">
              Tu celular comparte la ubicación en tiempo real con el dueño del vehículo durante el viaje.
            </Text>
          </Card>
        )}

        {/* Resumen: fechas, garantía y cualquier cargo aplicado, todo en una
            sola tarjeta — antes eran dos (o tres) apiladas por separado. */}
        <Card padded className="gap-3">
          <Row label="Retiro" value={fechaHora(res.fecha_inicio)} />
          <Row label="Devolución" value={fechaHora(res.fecha_fin)} />
          <View className="h-px bg-border" />
          <Row label="Garantía retenida (hold)" value={`$${montoHold.toLocaleString("es-CL")}`} warn />
          {res.monto_cobro_final > 0 && (
            <Row label="Cobro final" value={`$${res.monto_cobro_final.toLocaleString("es-CL")}`} strong />
          )}

          {tieneCargosExtra && (
            <>
              <View className="h-px bg-border" />
              <View className="flex-row items-center gap-2">
                <Icon name="alert" size={16} color="#F59E0B" />
                <Text className="text-[13px] font-bold text-textDark">
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
                <Text className="text-xs text-textMuted -mt-1">
                  Detalle: {res.motivo_multas}
                </Text>
              )}
            </>
          )}
        </Card>

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
          {/* Una vez retirado el auto, el código de entrega ya no sirve para
              nada — solo queda el de devolución, en el botón principal. */}
          {res.estado !== "en_curso" && (
            <MenuRow icon="pin" label="Mi código de entrega" onPress={onStartDelivery} />
          )}
          <MenuRow icon="calendar" label="Extender arriendo" onPress={onExtendRental} />
          <MenuRow icon="shield" label="Asistencia en ruta / siniestro" onPress={onRoadsideClaim} />
          <MenuRow icon="chat" label="Escribirle al dueño" onPress={onOpenChat} />
        </MenuList>
      </ScrollView>
      {footer(
        <>
          <Button label="Mostrar mi código de devolución" iconRight="arrow-right" onPress={onStartReturn} />
          {res.estado === "en_curso" ? (
            <Button variant="secondary" size="sm" label="Reportar un problema" iconLeft="shield" onPress={onRoadsideClaim} />
          ) : (
            <Button variant="danger" size="sm" label="Cancelar la reserva" onPress={onCancelReservation} />
          )}
        </>
      )}

      <PreCheckinModal
        visible={modalPrecheck}
        reserva={res}
        role="cliente"
        onClose={() => setModalPrecheck(false)}
        onConfirmed={handlePrecheckConfirmed}
      />

      <SegundoConductorModal
        visible={modalSegundoConductor}
        reservaId={res.id}
        initialData={res.segundo_conductor}
        onClose={() => setModalSegundoConductor(false)}
        onSaved={(sc) => {
          const nuevo = { ...res, segundo_conductor: sc };
          setRes(nuevo);
          onUpdateReservation?.(nuevo);
        }}
      />
    </View>
  );
}

function Row({ label, value, strong, warn }) {
  return (
    <View className="flex-row justify-between items-center gap-3">
      <Text className="text-sm text-textMuted">{label}</Text>
      <Text
        className={`text-sm text-textDark shrink text-right ${
          warn ? "text-amber-800 font-bold" : strong ? "font-bold" : ""
        }`}
      >
        {value}
      </Text>
    </View>
  );
}

