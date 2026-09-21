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
} from "@rentacar/mobile-shared";

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || "").replace(/\/$/, "");

// Cuenta regresiva compacta hasta la hora acordada de devolución. Reemplaza
// el texto suelto "horas restantes" por algo que se lee de un vistazo.
function restanteHasta(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
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
    setRes((prev) => {
      const nuevo = { ...prev, ...updated };
      onUpdateReservation?.(nuevo);
      return nuevo;
    });
  };
  const [modalPrecheck, setModalPrecheck] = useState(false);
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
          <Card padded style={{ width: "100%", gap: 12 }}>
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
    const plazo = res.confirmar_dueno_antes_de;
    return (
      <View className="flex-1 bg-background">
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Tu reserva" onBack={onBack} />
        <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
          <View className="items-center gap-2">
            <View className="w-[68px] h-[68px] rounded-full bg-amber-50 items-center justify-center">
              <Icon name="clock" size={32} color="#F59E0B" />
            </View>
            <Text className="text-xl font-bold text-textDark text-center">Esperando la confirmación del dueño</Text>
            <Text className="text-[15px] text-textMuted leading-[22px] text-center">
              {plazo
                ? `El dueño tiene hasta ${fechaHora(plazo)} para confirmar.`
                : "El dueño tiene 24 horas para confirmar."}{" "}
              Si no lo hace, cancelamos la reserva y te devolvemos todo.
            </Text>
          </View>

          <Card padded style={{ gap: 10 }}>
            <Row label="Auto" value={nombre} />
            <Row label="Fechas" value={`${fechaHora(res.fecha_inicio)} → ${fechaHora(res.fecha_fin)}`} />
            <Row label="Estado" value="Esperando al dueño" warn />
          </Card>

          {res.cobro?.monto ? (
            <Card padded style={{ gap: 10 }}>
              <SectionLabel>Resumen del pago</SectionLabel>
              <Row label="Cobrado hoy" value={clp(res.cobro.monto)} strong />
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
          <Card padded style={{ width: "100%", gap: 12 }}>
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
    return (
      <View className="flex-1 bg-background">
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Tu arriendo" onBack={onBack} />
        <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
          <View className="items-center gap-2">
            <View className="w-[68px] h-[68px] rounded-full bg-teal-50 items-center justify-center">
              <Icon name="check" size={32} color="#0F766E" />
            </View>
            <Text className="text-xl font-bold text-textDark text-center">Reserva confirmada</Text>
            <Text className="text-[15px] text-textMuted leading-[22px] text-center">Ya puedes coordinar el retiro con el dueño.</Text>
          </View>

          {/* Resumen del pago: solo si la reserva trae el desglose del cobro */}
          {res.cobro?.monto ? (
            <Card padded style={{ gap: 10 }}>
              <SectionLabel>Resumen del pago</SectionLabel>
              <Row label="Cobrado hoy" value={clp(res.cobro.monto)} strong />
              <Row label="Garantía retenida" value={clp(res.garantia?.monto ?? res.monto_hold)} />
              <Text className="text-xs text-textMuted leading-[17px]">
                La garantía es una retención sobre tu cupo, no un cargo. Se libera al devolver el auto sin daños (la reversa bancaria tarda entre 24 y 72 hrs hábiles).
              </Text>
            </Card>
          ) : null}

          {/* Llegada al punto de encuentro, comprobada por ubicación (desde 2 h antes de la entrega) */}
          <LlegadaPorUbicacion reserva={res} rol="cliente" onActualizada={handlePrecheckConfirmed} />

          {/* Tarjeta de Verificación / Pre-Checkin 24h */}
          {(() => {
            const msHastaRetiro = res.fecha_inicio ? new Date(res.fecha_inicio).getTime() - Date.now() : null;
            const dentroDe24h = msHastaRetiro !== null && msHastaRetiro <= 24 * 3600000;

            return (
              <Card padded style={{ gap: 8, backgroundColor: res.precheck_cliente_confirmado ? "#CCFBF1" : "#FFFFFF" }}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Icon name="check" size={18} color={res.precheck_cliente_confirmado ? "#115E59" : "#64748B"} />
                    <Text className="text-sm font-bold text-textDark">
                      Verificación 24h antes
                    </Text>
                  </View>
                  <Badge
                    variant={res.precheck_cliente_confirmado ? "success" : dentroDe24h ? "warning" : "default"}
                    label={res.precheck_cliente_confirmado ? "Confirmado" : dentroDe24h ? "Pendiente" : "Próximamente"}
                  />
                </View>
                <Text className="text-[13px] text-textMuted">
                  {res.precheck_cliente_confirmado
                    ? "Has confirmado tu viaje y asistencia para la entrega."
                    : dentroDe24h
                    ? "Faltan menos de 24 horas para tu viaje. Confirma tu asistencia y condiciones de viaje."
                    : "La confirmación de viaje se habilitará automáticamente 24 horas antes del retiro."}
                </Text>
                {!res.precheck_cliente_confirmado && dentroDe24h && (
                  <Button
                    variant="secondary"
                    size="sm"
                    label="Completar verificación de viaje"
                    iconRight="arrow-right"
                    onPress={() => setModalPrecheck(true)}
                  />
                )}
              </Card>
            );
          })()}

          <Card padded style={{ gap: 12 }}>
            <SectionLabel>Punto de encuentro</SectionLabel>
            <View className="h-[140px] rounded-xl overflow-hidden bg-teal-50 items-center justify-center">
              {MapView ? (
                <MapView
                  style={{ width: "100%", height: "100%" }}
                  className="w-full h-full"
                  initialRegion={{
                    latitude: Number(res.lugar_entrega_lat || car.latitud || -37.4697),
                    longitude: Number(res.lugar_entrega_lng || car.longitud || -72.3536),
                    latitudeDelta: 0.015,
                    longitudeDelta: 0.015,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Marker
                    coordinate={{
                      latitude: Number(res.lugar_entrega_lat || car.latitud || -37.4697),
                      longitude: Number(res.lugar_entrega_lng || car.longitud || -72.3536),
                    }}
                    title={res.lugar_entrega_acordado || car.ubicacion_base || "Punto de encuentro"}
                  />
                </MapView>
              ) : (
                <Icon name="pin" size={26} color="#0F766E" />
              )}
            </View>
            <View className="flex-row justify-between items-center">
              <View className="flex-1 mr-2">
                <Text className="text-[15px] font-bold text-textDark">
                  {res.lugar_entrega_acordado || car.ubicacion_base || "Por coordinar"}
                </Text>
                <Text className="text-[13px] text-textMuted capitalize">{fechaHora(res.fecha_inicio, true)}</Text>
              </View>
              <Button
                variant="secondary"
                size="sm"
                label="Cómo llegar"
                iconLeft="pin"
                fullWidth={false}
                onPress={() => {
                  const lat = Number(res.lugar_entrega_lat || car.latitud || -37.4697);
                  const lng = Number(res.lugar_entrega_lng || car.longitud || -72.3536);
                  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
                }}
              />
            </View>
          </Card>

          <Card padded className="flex-row items-center gap-3">
            <View className="w-11 h-11 rounded-full bg-slate-100 items-center justify-center">
              {duenoFoto && !ownerFotoError ? (
                <Image
                  source={{ uri: duenoFoto }}
                  style={{ width: 44, height: 44, borderRadius: 22 }}
                  onError={() => setOwnerFotoError(true)}
                />
              ) : (
                <Icon name="user" size={20} color="#64748B" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-textDark">{duenoNombre}</Text>
              <Text className="text-[13px] text-textMuted mt-0.5">Coordina por el chat de la reserva</Text>
            </View>
            <Button variant="secondary" size="sm" iconLeft="chat" label="Chat" onPress={onOpenChat} fullWidth={false} />
          </Card>

          {/* Segundo Conductor */}
          <Card padded style={{ gap: 6 }}>
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-2">
                <Icon name="user" size={18} color="#0F766E" />
                <Text className="text-sm font-bold text-textDark">
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
              <Text className="text-[13px] text-textMuted">
                {res.segundo_conductor.nombre} (Doc: {res.segundo_conductor.rut || res.segundo_conductor.numero_documento || "—"})
              </Text>
            ) : (
              <Text className="text-xs text-textMuted">
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

          <View className="w-full bg-teal-50 rounded-xl p-4 gap-1">
            <Text className="text-sm font-bold text-primary">Lleva tu licencia</Text>
            <Text className="text-[13px] text-primary leading-[19px]">
              El dueño registrará el checklist fotográfico de 8 ángulos y firmarás el contrato en tu celular.
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
          onConfirmed={handlePrecheckConfirmed}
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
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScreenHeader
        title="Detalle de la reserva"
        onBack={() => setView("confirmed")}
        right={<Badge variant={res.estado === "en_curso" ? "info" : "neutral"} label={res.estado === "en_curso" ? "En curso" : res.estado || "—"} />}
      />
      <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
        <Card padded className="flex-row items-center gap-3">
          {car.fotos?.[0] ? (
            <Image source={{ uri: car.fotos[0] }} className="w-[76px] h-[58px] rounded-xl bg-teal-50" />
          ) : (
            <View className="w-[76px] h-[58px] rounded-xl bg-amber-50 items-center justify-center">
              <Icon name="car" size={22} color="#5EEAD4" />
            </View>
          )}
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
          <Card padded style={{ gap: 6, backgroundColor: "#F0FDF4", borderColor: "#0F766E", borderWidth: 1 }}>
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
        <Card padded style={{ gap: 12 }}>
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
          setRes((prev) => ({ ...prev, segundo_conductor: sc }));
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

