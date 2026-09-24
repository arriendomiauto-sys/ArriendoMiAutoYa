import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Share,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Icon,
  Button,
  Card,
  BackButton,
  ScreenHeader,
  SectionLabel,
  Rating,
  formatearFechaHora,
  aISOLocal,
  ApiClient,
  useFavoritos,
  urlWeb,
  Skeleton,
  usePhotoViewer,
  CarPhotoThumb,
  validarLicenciaParaAuto,
  useApp,
} from "@rentacar/mobile-shared";
import { DateSelectionScreen } from "./DateSelectionScreen";

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

// Fecha por defecto: dentro de `offsetDias` días a la hora en punto pedida.
function enDias(offsetDias, hora) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  d.setHours(hora, 0, 0, 0);
  return d;
}

// El retiro nunca puede quedar en el pasado, y la devolución tiene que ser
// posterior al retiro: el calendario deshabilita todo lo anterior en vez de
// dejar escribirlo y avisar después.
const MIN_HORAS_ARRIENDO = 1;
const masHoras = (fecha, horas) => new Date(fecha.getTime() + horas * 3600000);

// Alto del hero: arranca en el valor histórico y se ajusta al aspect-ratio
// real de cada foto (min/max para no descontrolar el layout con fotos muy
// verticales u horizontales).
const HERO_ALTURA_DEFAULT = 380;
const HERO_ALTURA_MIN = 220;
const HERO_ALTURA_MAX = 460;

const EQUIPAMIENTO_LABELS = {
  ac: "Aire acondicionado",
  bluetooth: "Bluetooth / CarPlay",
  camara_retroceso: "Cámara de retroceso",
  doble_traccion: "Tracción 4x4",
  isofix: "Anclajes ISOFIX",
};

export function CarDetailScreen({ car, onBack, onProceedToPayment }) {
  const insets = useSafeAreaInsets();
  let currentUser = null;
  try {
    const app = useApp();
    currentUser = app?.currentUser || null;
  } catch (e) {
    currentUser = null;
  }

  const estadoLicencia = useMemo(
    () => validarLicenciaParaAuto(car?.categoria, currentUser),
    [car?.categoria, currentUser]
  );

  // Step: 'detail' (ficha: solo auto y anfitrión) | 'dates' (elegir fechas,
  // pantalla propia) | 'summary' (hoja de resumen antes de pagar)
  const [step, setStep] = useState("detail");
  const [fotoActiva, setFotoActiva] = useState(0);
  const [heroW, setHeroW] = useState(0);
  const [heroAltura, setHeroAltura] = useState(HERO_ALTURA_DEFAULT);
  const [heroCargando, setHeroCargando] = useState(true);
  const aspectRatiosFotos = useRef({});
  const [hostFotoError, setHostFotoError] = useState(false);
  const { esFavorito, toggle: toggleFavorito } = useFavoritos();

  // Visor de fotos a pantalla completa (PhotoViewerProvider, montado una vez
  // en App.js): tocar la foto lo abre; adentro se puede pellizcar para hacer
  // zoom, doble tap, deslizar entre fotos y deslizar hacia abajo para cerrar.
  const abrirVisor = usePhotoViewer();

  const compartirAuto = () => {
    const precio = (car?.tarifa_dia || 0).toLocaleString("es-CL");
    Share.share({
      message:
        `${car?.marca || ""} ${car?.modelo || ""} ${car?.anio || ""} en ${car?.ubicacion_base || "Chile"} ` +
        `· $${precio}/día\n¡Arriéndalo en ArriendoMiAutoYa! ${urlWeb()}`,
    }).catch(() => {});
  };

  const [fechaInicio, setFechaInicio] = useState(() => enDias(1, 10));
  const [fechaFin, setFechaFin] = useState(() => enDias(4, 18));
  const [dateError, setDateError] = useState(null);
  const ahora = useMemo(() => new Date(), []);

  // Rangos ya reservados de este auto: el calendario los deshabilita para no
  // elegir fechas que el backend va a rechazar con un 400.
  const [rangosOcupados, setRangosOcupados] = useState([]);
  // Si ni siquiera se pudo consultar qué días están ocupados, dejar el
  // calendario abierto "confiando" en que ningún día choca sería peor que no
  // decir nada: se bloquea entero hasta poder verificar de verdad.
  const [disponibilidadError, setDisponibilidadError] = useState(false);
  useEffect(() => {
    if (!car?.id || typeof ApiClient.getDisponibilidadAuto !== "function") return;
    let vivo = true;
    ApiClient.getDisponibilidadAuto(car.id)
      .then((r) => {
        if (!vivo) return;
        setRangosOcupados(r?.rangos_ocupados || []);
        setDisponibilidadError(false);
      })
      .catch((e) => {
        if (__DEV__) console.warn("[disponibilidad] no se pudo cargar; el calendario no marcará días ocupados:", e?.message || e);
        if (vivo) setDisponibilidadError(true);
      });
    return () => {
      vivo = false;
    };
  }, [car?.id]);

  // Mover el retiro más allá de la devolución dejaría un rango imposible:
  // se arrastra la devolución manteniendo la duración elegida.
  const cambiarInicio = (nuevoInicio) => {
    setDateError(null);
    setFechaInicio(nuevoInicio);
    if (fechaFin <= nuevoInicio) {
      const duracionMs = Math.max(fechaFin - fechaInicio, 3 * 86400000);
      setFechaFin(new Date(nuevoInicio.getTime() + duracionMs));
    }
  };

  const cambiarFin = (nuevoFin) => {
    setDateError(null);
    setFechaFin(nuevoFin);
  };

  const tarifaDia = car?.tarifa_dia || 0;
  const dias = useMemo(() => calcularDias(fechaInicio, fechaFin), [fechaInicio, fechaFin]);
  // Se COBRA: días × tarifa (IVA incl.). La GARANTÍA es un hold aparte, monto
  // fijo por categoría que define el backend (cae a la estimación si el auto
  // aún no trae `monto_garantia`).
  const montoCobro = tarifaDia * dias;
  const montoGarantia = car?.monto_garantia ?? 0;
  // Desglose de IVA sobre el cobro (la tarifa ya lo incluye), solo para mostrarlo.
  const subtotalNeto = Math.round(montoCobro / 1.19);
  const ivaMonto = montoCobro - subtotalNeto;

  // Reseñas del dueño (no del auto: acá no hay calificación por vehículo,
  // solo por persona — dos autos del mismo dueño comparten reputación).
  const [calificaciones, setCalificaciones] = useState([]);
  const [cargandoResenas, setCargandoResenas] = useState(true);
  useEffect(() => {
    let vivo = true;
    if (!car?.dueno_id) {
      setCargandoResenas(false);
      return undefined;
    }
    ApiClient.getCalificaciones(car.dueno_id)
      .then((datos) => {
        if (vivo) setCalificaciones(Array.isArray(datos) ? datos : []);
      })
      .catch((err) => {
        if (vivo) console.warn("[CarDetailScreen] getCalificaciones:", err?.message);
      })
      .finally(() => {
        if (vivo) setCargandoResenas(false);
      });
    return () => {
      vivo = false;
    };
  }, [car?.dueno_id]);

  const promedioResenas = calificaciones.length
    ? calificaciones.reduce((suma, c) => suma + (c.puntaje || 0), 0) / calificaciones.length
    : null;

  const fotos = car?.fotos?.length ? car.fotos : [];
  const nombreAuto = [car?.marca, car?.modelo, car?.anio].filter(Boolean).join(" ");
  const dueno = car?.dueno;
  const duenoNombre = car?.dueno_nombre || dueno?.nombre || "Anfitrión";
  const duenoFoto = car?.dueno_foto_url || dueno?.foto_perfil_verificada_url || dueno?.foto_perfil_url || dueno?.avatar;
  const tieneDueno = Boolean(car?.dueno_id || dueno || car?.dueno_nombre);
  const CAT_LABEL = { economico: "Económico", sedan: "Sedán", suv: "SUV", camioneta: "Camioneta", premium: "Premium" };
  const TRANS_LABEL = { automatica: "Automática", mecanica: "Mecánica" };
  const FUEL_LABEL = { bencina: "Bencina", diesel: "Diésel", hibrido: "Híbrido", electrico: "Eléctrico" };
  const specs = [
    car?.transmision && { icon: "settings", label: TRANS_LABEL[car.transmision] || car.transmision },
    car?.combustible && { icon: "gas", label: FUEL_LABEL[car.combustible] || car.combustible },
    car?.asientos && { icon: "user", label: `${car.asientos} asientos` },
    car?.puertas && { icon: "car", label: `${car.puertas} puertas` },
  ].filter(Boolean);
  const equipamientoActivo = Object.entries(car?.equipamiento || {})
    .filter(([, activo]) => activo)
    .map(([key]) => EQUIPAMIENTO_LABELS[key] || key);
  const precioCLP = (n) => `$${(n || 0).toLocaleString("es-CL")}`;

  const alturaParaProporcion = (proporcion) =>
    Math.min(HERO_ALTURA_MAX, Math.max(HERO_ALTURA_MIN, heroW / proporcion));

  const irAResumen = () => {
    setDateError(null);
    if (!estadoLicencia.valida) {
      setDateError(estadoLicencia.motivo || "No cumples con los requisitos de licencia para este vehículo.");
      return;
    }
    if (disponibilidadError) {
      setDateError("No pudimos verificar qué días están disponibles. Reintenta antes de continuar.");
      return;
    }
    if (fechaInicio < new Date()) {
      setDateError("El retiro no puede quedar en el pasado. Elige una fecha y hora futura.");
      return;
    }
    if (fechaFin <= masHoras(fechaInicio, MIN_HORAS_ARRIENDO)) {
      setDateError("La devolución debe ser al menos una hora después del retiro.");
      return;
    }
    if (dias <= 0) {
      setDateError("La fecha de devolución debe ser posterior a la de retiro.");
      return;
    }
    setStep("summary");
  };

  // ---------------------------------------------------------------- DETALLE
  if (step === "detail") {
    return (
      <View className="flex-1 bg-background">
        <StatusBar barStyle="light-content" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <View
            className="bg-teal-50"
            style={{ height: heroAltura }}
            onLayout={(e) => setHeroW(e.nativeEvent.layout.width)}
          >
            {heroCargando && <Skeleton className="w-full h-full" />}
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={fotos.length > 1}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
                setFotoActiva(idx);
                const proporcion = aspectRatiosFotos.current[idx];
                if (proporcion && heroW) setHeroAltura(alturaParaProporcion(proporcion));
              }}
            >
              {fotos.map((uri, i) => (
                <TouchableOpacity
                  key={uri + i}
                  activeOpacity={0.92}
                  onPress={() => abrirVisor(fotos, i)}
                  style={heroW ? { width: heroW } : null}
                  accessibilityRole="button"
                  accessibilityLabel="Ver foto en pantalla completa"
                >
                  <Image
                    source={{ uri }}
                    className="w-full h-full"
                    style={heroW ? { width: heroW } : null}
                    resizeMode="contain"
                    onLoad={(e) => {
                      const { width, height } = e.nativeEvent?.source || e.nativeEvent || {};
                      if (!width || !height) return;
                      const proporcion = width / height;
                      aspectRatiosFotos.current[i] = proporcion;
                      if (i === fotoActiva && heroW) setHeroAltura(alturaParaProporcion(proporcion));
                    }}
                    onLoadEnd={() => setHeroCargando(false)}
                    onError={() => setHeroCargando(false)}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <BackButton
              variant="overlay"
              onPress={onBack}
              className="absolute left-4"
              style={{ top: insets.top + 8 }}
            />
            <View className="absolute right-4 flex-row gap-2" style={{ top: insets.top + 8 }}>
              <TouchableOpacity
                className="w-10 h-10 rounded-full bg-white/95 items-center justify-center shadow-sm"
                onPress={compartirAuto}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Compartir este auto"
              >
                <Icon name="share" size={18} color="#0F766E" />
              </TouchableOpacity>
              <TouchableOpacity
                className="w-10 h-10 rounded-full bg-white/95 items-center justify-center shadow-sm"
                onPress={() => toggleFavorito(car?.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={esFavorito(car?.id) ? "Quitar de favoritos" : "Agregar a favoritos"}
              >
                <Icon
                  name="heart"
                  size={18}
                  color={esFavorito(car?.id) ? "#EF4444" : "#0F766E"}
                  fill={esFavorito(car?.id) ? "#EF4444" : "none"}
                />
              </TouchableOpacity>
            </View>
            {/* Insignia "i/N": posición dentro de la galería + atajo directo al
                visor a pantalla completa. Reemplaza a los puntitos (no
                escalan bien con 9 fotos) y al botón "Ampliar" que quedaba
                duplicado con tocar la foto misma. */}
            {fotos.length > 0 && (
              <TouchableOpacity
                onPress={() => abrirVisor(fotos, fotoActiva)}
                className="absolute right-4 bottom-3.5 flex-row items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1.5 border border-white/20"
                accessibilityRole="button"
                accessibilityLabel="Ver todas las fotos en pantalla completa"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="gallery" size={13} color="#FFFFFF" />
                <Text className="text-white text-[11px] font-bold">
                  {fotos.length > 1 ? `${fotoActiva + 1}/${fotos.length}` : "Ampliar"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="p-4 gap-4">
            <View>
              <View className="flex-row items-start justify-between gap-2">
                <Text className="text-xl font-bold text-textDark flex-1">{nombreAuto || "Vehículo"}</Text>
                <View className="items-end">
                  <Text className="text-[17px] font-extrabold text-textDark">{precioCLP(tarifaDia)}</Text>
                  <Text className="text-[11.5px] text-textMuted -mt-0.5">por día</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-1 mt-1.5 flex-wrap">
                <Icon name="location" size={14} color="#64748B" />
                <Text className="text-[13px] text-textMuted">{car?.ubicacion_base || "Ubicación no informada"}</Text>
                {car?.categoria ? (
                  <>
                    <Text className="text-textMuted">·</Text>
                    <Text className="text-[13px] text-textMuted">{CAT_LABEL[car.categoria] || car.categoria}</Text>
                  </>
                ) : null}
              </View>
            </View>

            {specs.length > 0 && (
              <View className="flex-row flex-wrap gap-3">
                {specs.map((s) => (
                  <View key={s.label} className="flex-row items-center gap-1.5">
                    <Icon name={s.icon} size={15} color="#0F766E" />
                    <Text className="text-[13px] text-textDark font-medium">{s.label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Requisito de Licencia según Categoría */}
            <View className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 gap-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2 flex-1">
                  <Icon name="document" size={16} color="#0F766E" />
                  <Text className="text-[13px] font-bold text-textDark">Requisito de Conductor</Text>
                </View>
                <View className={`px-2.5 py-0.5 rounded-full ${estadoLicencia.valida ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
                  <Text className={`text-[11px] font-bold ${estadoLicencia.valida ? "text-emerald-700" : "text-amber-700"}`}>
                    {estadoLicencia.valida ? "Habilitado" : "Verificar"}
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-textMuted leading-4">
                Esta categoría requiere <Text className="font-semibold text-textDark">{estadoLicencia.requisito || "Clase B"}</Text>.
              </Text>
              {!estadoLicencia.valida && estadoLicencia.motivo ? (
                <View className="flex-row items-start gap-1.5 bg-amber-100/60 p-2 rounded-xl mt-0.5">
                  <Icon name="alert-triangle" size={13} color="#D97706" className="mt-0.5" />
                  <Text className="text-[11.5px] text-amber-900 flex-1 leading-4">{estadoLicencia.motivo}</Text>
                </View>
              ) : null}
            </View>

            {/* Sellos de Confianza, Cobertura y Certificación */}
            <View className="bg-teal-950/5 border border-teal-800/15 rounded-2xl p-3.5 gap-2.5">
              <View className="flex-row items-center gap-2">
                <Icon name="shield" size={16} color="#0F766E" />
                <Text className="text-[13px] font-bold text-textDark">Garantías y Protección</Text>
              </View>
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <Icon name="check" size={13} color="#0F766E" />
                  <Text className="text-xs text-textDark flex-1">
                    Seguro P2P con deducible fijado en 15 UF durante el arriendo.
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Icon name="check" size={13} color="#0F766E" />
                  <Text className="text-xs text-textDark flex-1">
                    SOAP y Permiso de circulación vigentes.
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Icon name="check" size={13} color="#0F766E" />
                  <Text className="text-xs text-textDark flex-1">
                    Revisión técnica y emisión de gases al día.
                  </Text>
                </View>
                {car?.doc_historial_vehicular_url || car?.verificado_seguro ? (
                  <View className="flex-row items-center gap-2">
                    <Icon name="check" size={13} color="#0F766E" />
                    <Text className="text-xs text-textDark flex-1">
                      Historial vehicular verificado (sin encargo por robo ni multas).
                    </Text>
                  </View>
                ) : null}
                <View className="flex-row items-center gap-2">
                  <Icon name="check" size={13} color="#0F766E" />
                  <Text className="text-xs text-textDark flex-1">
                    Contrato digital con firma electrónica y check-in fotográfico de 9 puntos.
                  </Text>
                </View>
              </View>
            </View>

            {/* 1. Equipamiento del vehículo */}
            {equipamientoActivo.length > 0 && (
              <View className="gap-2">
                <SectionLabel>Equipamiento</SectionLabel>
                <View className="flex-row flex-wrap gap-2">
                  {equipamientoActivo.map((label) => (
                    <View key={label} className="flex-row items-center gap-1.5 bg-teal-50 rounded-full py-1.5 px-3">
                      <Icon name="check" size={12} color="#0F766E" />
                      <Text className="text-xs font-semibold text-teal-700">{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 2. Descripción del vehículo */}
            {car?.descripcion ? <Text className="text-sm text-textMuted leading-5">{car.descripcion}</Text> : null}

            {/* 4. Calificaciones y reseñas del anfitrión */}
            {cargandoResenas ? null : calificaciones.length > 0 ? (
              <View className="gap-2">
                <SectionLabel>Calificaciones</SectionLabel>
                <View className="flex-row items-center gap-3">
                  <Text className="text-3xl font-extrabold text-textDark tracking-tight">{promedioResenas.toFixed(1)}</Text>
                  <View className="gap-0.5">
                    <View className="flex-row">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Icon
                          key={n}
                          name={n <= Math.round(promedioResenas) ? "star" : "star-outline"}
                          size={14}
                          color="#F59E0B"
                          fill={n <= Math.round(promedioResenas) ? "#F59E0B" : "none"}
                        />
                      ))}
                    </View>
                    <Text className="text-xs text-textMuted">
                      {calificaciones.length} {calificaciones.length === 1 ? "opinión" : "opiniones"}
                    </Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: 16 }}
                >
                  {calificaciones.slice(0, 10).map((r) => (
                    <View key={r.id} className="w-[220px] bg-gray-50 rounded-xl border border-border p-3 gap-1.5">
                      <View className="flex-row justify-between items-center">
                        <View className="flex-row">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Icon
                              key={n}
                              name={n <= r.puntaje ? "star" : "star-outline"}
                              size={11}
                              color="#F59E0B"
                              fill={n <= r.puntaje ? "#F59E0B" : "none"}
                            />
                          ))}
                        </View>
                        <Text className="text-[11px] text-textMuted">
                          {new Date(r.timestamp).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                        </Text>
                      </View>
                      {r.comentario ? (
                        <Text className="text-[13px] text-textDark leading-[18px]" numberOfLines={4}>
                          {r.comentario}
                        </Text>
                      ) : null}
                      <Text className="text-xs font-semibold text-textMuted">{r.autor_nombre || "Arrendatario"}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* 5. Tarjeta del anfitrión */}
            {tieneDueno ? (
              <View className="flex-row items-center gap-3 bg-teal-950 rounded-2xl p-4 overflow-hidden relative">
                <View className="absolute top-0 left-4 right-4 h-px bg-teal-400" />
                <View className="w-12 h-12 rounded-full bg-teal-500/20 items-center justify-center overflow-hidden">
                  {duenoFoto && !hostFotoError ? (
                    <Image
                      source={{ uri: duenoFoto }}
                      className="w-full h-full"
                      onError={() => setHostFotoError(true)}
                    />
                  ) : (
                    <Icon name="user" size={20} color="#F59E0B" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-white">{duenoNombre}</Text>
                  <Text className="text-[12.5px] text-teal-200 mt-0.5">Anfitrión verificado</Text>
                  {promedioResenas || dueno?.rating || car?.rating_promedio ? (
                    <Rating
                      tone="dark"
                      size="sm"
                      value={promedioResenas || dueno?.rating || car?.rating_promedio}
                      count={calificaciones.length || dueno?.viajes || car?.rating_cantidad}
                      className="mt-1"
                    />
                  ) : null}
                </View>
                <View className="w-[30px] h-[30px] rounded-lg bg-teal-500/20 items-center justify-center">
                  <Icon name="shield" size={14} color="#F59E0B" />
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View className="flex-row items-center gap-3 px-4 pt-3 bg-white border-t border-border" style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}>
          <View>
            <Text className="text-lg font-bold text-textDark">{precioCLP(tarifaDia)}</Text>
            <Text className="text-xs text-textMuted">por día</Text>
          </View>
          <Button
            label="Siguiente"
            iconRight="arrow-right"
            onPress={() => setStep("dates")}
            fullWidth={false}
            className="flex-1"
          />
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------- FECHAS
  if (step === "dates") {
    return (
      <DateSelectionScreen
        car={car}
        fechaInicio={fechaInicio}
        fechaFin={fechaFin}
        onChangeInicio={cambiarInicio}
        onChangeFin={cambiarFin}
        ahora={ahora}
        minimumDateFin={masHoras(fechaInicio, MIN_HORAS_ARRIENDO)}
        rangosOcupados={rangosOcupados}
        disponibilidadError={disponibilidadError}
        dias={dias}
        montoCobro={montoCobro}
        dateError={dateError}
        onBack={() => setStep("detail")}
        onConfirm={irAResumen}
      />
    );
  }

  // -------------------------------------------------------------- RESUMEN
  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Resumen de la reserva" onBack={() => setStep("detail")} />
      <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
        <Card className="flex-row items-center gap-3" padded>
          <CarPhotoThumb uri={fotos[0]} className="w-[76px] h-[58px] rounded-xl" />
          <View className="flex-1">
            <Text className="text-[15px] font-bold text-textDark">{nombreAuto || "Vehículo"}</Text>
            <Text className="text-[13px] text-textMuted mt-0.5">
              {formatearFechaHora(fechaInicio)} → {formatearFechaHora(fechaFin)}
            </Text>
            <Text className="text-[13px] text-textMuted mt-0.5">{car?.ubicacion_base}</Text>
          </View>
        </Card>

        {/* Desglose — el arriendo SE COBRA (IVA incl., ya en la tarifa); la
            garantía es un hold aparte que no se cobra. */}
        <Card padded className="gap-3">
          <View className="flex-row justify-between items-center">
            <Text className="text-[15px] text-textMuted">Arriendo · {dias} {dias === 1 ? "día" : "días"}</Text>
            <Text className="text-[15px] text-textDark font-medium">{precioCLP(subtotalNeto)}</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-[15px] text-textMuted">IVA 19%</Text>
            <Text className="text-[15px] text-textDark font-medium">{precioCLP(ivaMonto)}</Text>
          </View>
          {montoGarantia > 0 ? (
            <View className="flex-row justify-between items-center">
              <Text className="text-[15px] text-textMuted">Garantía retenida</Text>
              <Text className="text-[15px] text-textDark font-medium">{precioCLP(montoGarantia)}</Text>
            </View>
          ) : null}
          <View className="flex-row justify-between items-center border-t border-border pt-3">
            <Text className="text-[17px] font-bold text-textDark">Se cobra al reservar</Text>
            <Text className="text-lg font-bold text-textDark">{precioCLP(montoCobro)}</Text>
          </View>
        </Card>

        <View className="flex-row gap-2 bg-teal-50 rounded-xl p-4">
          <Icon name="shield" size={16} color="#0F766E" />
          <Text className="flex-1 text-[13px] text-teal-800 leading-[19px]">
            {montoGarantia > 0
              ? `La garantía de ${precioCLP(montoGarantia)} queda bloqueada en tu tarjeta de crédito, no se cobra. `
              : "La garantía queda bloqueada en tu tarjeta de crédito, no se cobra. "}
            Se libera cuando el dueño confirme el estado del auto al devolverlo, descontando solo cargos
            justificados (limpieza, combustible, km extra).
          </Text>
        </View>
      </ScrollView>

      <View className="px-4 pt-3 bg-white border-t border-border" style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}>
        <Button
          testID="btn-ir-a-pagar"
          label="Ir a pagar"
          iconRight="arrow-right"
          onPress={() =>
            onProceedToPayment(car, {
              fechaInicio: aISOLocal(fechaInicio),
              fechaFin: aISOLocal(fechaFin),
              dias,
              montoCobro,
              montoHold: montoGarantia,
            })
          }
        />
        <Text className="text-xs text-textMuted text-center mt-2 leading-[17px]">
          En el paso siguiente eliges el medio de pago y firmas el contrato.
        </Text>
      </View>
    </View>
  );
}

