import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  theme,
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
  PhotoViewer,
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

  // Visor de fotos a pantalla completa (PhotoViewer, compartido): tocar la
  // foto lo abre; adentro se puede pellizcar para hacer zoom, doble tap,
  // deslizar entre fotos y deslizar hacia abajo para cerrar.
  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const abrirZoom = (i) => {
    setZoomIndex(i);
    setZoomVisible(true);
  };
  const cerrarZoom = () => setZoomVisible(false);

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
        // Que falle no debe romper la ficha; el backend igual valida al reservar.
        // Pero en dev sí conviene verlo: si el endpoint no responde (404 de un
        // backend viejo, red caída) el calendario queda sin días bloqueados y
        // "deja elegir" fechas ocupadas sin ninguna señal visible.
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
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}>
          <View
            style={[styles.hero, { height: heroAltura }]}
            onLayout={(e) => setHeroW(e.nativeEvent.layout.width)}
          >
            {heroCargando && <Skeleton style={styles.heroImg} />}
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
                  onPress={() => abrirZoom(i)}
                  style={heroW ? { width: heroW } : null}
                  accessibilityRole="button"
                  accessibilityLabel="Ver foto en pantalla completa"
                >
                  <Image
                    source={{ uri }}
                    style={[styles.heroImg, heroW ? { width: heroW } : null]}
                    resizeMode="contain"
                    onLoad={(e) => {
                      const { width, height } = e.nativeEvent.source || {};
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
              style={[styles.heroBack, { top: insets.top + 8 }]}
            />
            <View style={[styles.heroActions, { top: insets.top + 8 }]}>
              <TouchableOpacity
                style={styles.heroActionBtn}
                onPress={compartirAuto}
                hitSlop={theme.control.hitSlop}
                accessibilityRole="button"
                accessibilityLabel="Compartir este auto"
              >
                <Icon name="share" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroActionBtn}
                onPress={() => toggleFavorito(car?.id)}
                hitSlop={theme.control.hitSlop}
                accessibilityRole="button"
                accessibilityLabel={esFavorito(car?.id) ? "Quitar de favoritos" : "Agregar a favoritos"}
              >
                <Icon
                  name="heart"
                  size={18}
                  color={esFavorito(car?.id) ? colors.danger : colors.primary}
                  fill={esFavorito(car?.id) ? colors.danger : "none"}
                />
              </TouchableOpacity>
            </View>
            {fotos.length > 1 && (
              <View style={styles.dots}>
                {fotos.map((_, i) => (
                  <View key={i} style={[styles.dot, i === fotoActiva ? styles.dotOn : styles.dotOff]} />
                ))}
              </View>
            )}
            {fotos.length > 0 && (
              <View style={styles.zoomBadge} pointerEvents="none">
                <Icon name="search" size={15} color={colors.primary} />
              </View>
            )}
          </View>

          <View style={styles.body}>
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.carName}>{nombreAuto || "Vehículo"}</Text>
                <View style={styles.priceTag}>
                  <Text style={styles.priceTagAmount}>{precioCLP(tarifaDia)}</Text>
                  <Text style={styles.priceTagPer}>por día</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Icon name="location" size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>{car?.ubicacion_base || "Ubicación no informada"}</Text>
                {car?.categoria ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>{CAT_LABEL[car.categoria] || car.categoria}</Text>
                  </>
                ) : null}
              </View>
            </View>

            {specs.length > 0 && (
              <View style={styles.specsRow}>
                {specs.map((s) => (
                  <View key={s.label} style={styles.specItem}>
                    <Icon name={s.icon} size={15} color={colors.primary} />
                    <Text style={styles.specText}>{s.label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 1. Equipamiento del vehículo */}
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

            {/* 2. Descripción del vehículo */}
            {car?.descripcion ? <Text style={styles.descripcion}>{car.descripcion}</Text> : null}

            {/* 4. Calificaciones y reseñas del anfitrión */}
            {cargandoResenas ? null : calificaciones.length > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                <SectionLabel>Calificaciones</SectionLabel>
                <View style={styles.ratingSummaryRow}>
                  <Text style={styles.ratingSummaryNum}>{promedioResenas.toFixed(1)}</Text>
                  <View style={{ gap: 2 }}>
                    <View style={{ flexDirection: "row" }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Icon
                          key={n}
                          name={n <= Math.round(promedioResenas) ? "star" : "star-outline"}
                          size={14}
                          color={colors.accent500}
                          fill={n <= Math.round(promedioResenas) ? colors.accent500 : "none"}
                        />
                      ))}
                    </View>
                    <Text style={styles.ratingSummarySub}>
                      {calificaciones.length} {calificaciones.length === 1 ? "opinión" : "opiniones"}
                    </Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.spacing.screen }}
                >
                  {calificaciones.slice(0, 10).map((r) => (
                    <View key={r.id} style={styles.reviewCard}>
                      <View style={styles.reviewHead}>
                        <View style={{ flexDirection: "row" }}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Icon
                              key={n}
                              name={n <= r.puntaje ? "star" : "star-outline"}
                              size={11}
                              color={colors.accent500}
                              fill={n <= r.puntaje ? colors.accent500 : "none"}
                            />
                          ))}
                        </View>
                        <Text style={styles.reviewFecha}>
                          {new Date(r.timestamp).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                        </Text>
                      </View>
                      {r.comentario ? (
                        <Text style={styles.reviewTexto} numberOfLines={4}>
                          {r.comentario}
                        </Text>
                      ) : null}
                      <Text style={styles.reviewAutor}>{r.autor_nombre || "Arrendatario"}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* 5. Tarjeta del anfitrión */}
            {tieneDueno ? (
              <View style={styles.hostCardDark}>
                <View style={styles.hostHairline} />
                <View style={styles.hostAvatarDark}>
                  {duenoFoto && !hostFotoError ? (
                    <Image
                      source={{ uri: duenoFoto }}
                      style={styles.hostAvatarImg}
                      onError={() => setHostFotoError(true)}
                    />
                  ) : (
                    <Icon name="user" size={20} color={colors.accent500} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hostNameDark}>{duenoNombre}</Text>
                  <Text style={styles.hostSubDark}>Anfitrión verificado</Text>
                  {promedioResenas || dueno?.rating || car?.rating_promedio ? (
                    <Rating
                      tone="dark"
                      size="sm"
                      value={promedioResenas || dueno?.rating || car?.rating_promedio}
                      count={calificaciones.length || dueno?.viajes || car?.rating_cantidad}
                      style={{ marginTop: 4 }}
                    />
                  ) : null}
                </View>
                <View style={styles.hostShield}>
                  <Icon name="shield" size={14} color={colors.accent500} />
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View>
            <Text style={styles.barPrice}>{precioCLP(tarifaDia)}</Text>
            <Text style={styles.barPer}>por día</Text>
          </View>
          <Button
            label="Siguiente"
            iconRight="arrow-right"
            onPress={() => setStep("dates")}
            fullWidth={false}
            style={{ flex: 1 }}
          />
        </View>

        <PhotoViewer visible={zoomVisible} photos={fotos} initialIndex={zoomIndex} onClose={cerrarZoom} />
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Resumen de la reserva" onBack={() => setStep("detail")} />
      <ScrollView contentContainerStyle={styles.stepBody} showsVerticalScrollIndicator={false}>
        <Card style={styles.sumCarCard} padded>
          {fotos[0] ? (
            <Image source={{ uri: fotos[0] }} style={styles.sumThumb} />
          ) : (
            <View style={[styles.sumThumb, styles.sumThumbEmpty]}>
              <Icon name="car" size={22} color={colors.primary300} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.sumName}>{nombreAuto || "Vehículo"}</Text>
            <Text style={styles.sumMeta}>
              {formatearFechaHora(fechaInicio)} → {formatearFechaHora(fechaFin)}
            </Text>
            <Text style={styles.sumMeta}>{car?.ubicacion_base}</Text>
          </View>
        </Card>

        {/* Desglose — el arriendo SE COBRA (IVA incl., ya en la tarifa); la
            garantía es un hold aparte que no se cobra. */}
        <Card padded style={{ gap: theme.spacing.md }}>
          <View style={styles.bdRow}>
            <Text style={styles.bdLabel}>Arriendo · {dias} {dias === 1 ? "día" : "días"}</Text>
            <Text style={styles.bdValue}>{precioCLP(subtotalNeto)}</Text>
          </View>
          <View style={styles.bdRow}>
            <Text style={styles.bdLabel}>IVA 19%</Text>
            <Text style={styles.bdValue}>{precioCLP(ivaMonto)}</Text>
          </View>
          {montoGarantia > 0 ? (
            <View style={styles.bdRow}>
              <Text style={styles.bdLabel}>Garantía retenida</Text>
              <Text style={styles.bdValue}>{precioCLP(montoGarantia)}</Text>
            </View>
          ) : null}
          <View style={[styles.bdRow, styles.bdTotal]}>
            <Text style={styles.bdTotalLabel}>Se cobra al reservar</Text>
            <Text style={styles.bdTotalValue}>{precioCLP(montoCobro)}</Text>
          </View>
        </Card>

        <View style={styles.holdBox}>
          <Icon name="shield" size={16} color={colors.accent700} />
          <Text style={styles.holdText}>
            {montoGarantia > 0
              ? `La garantía de ${precioCLP(montoGarantia)} queda bloqueada en tu tarjeta de crédito, no se cobra. `
              : "La garantía queda bloqueada en tu tarjeta de crédito, no se cobra. "}
            Se libera cuando el dueño confirme el estado del auto al devolverlo, descontando solo cargos
            justificados (limpieza, combustible, km extra).
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
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
        <Text style={styles.footerHelp}>
          En el paso siguiente eliges el medio de pago y firmas el contrato.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  hero: { backgroundColor: colors.primary100 },
  zoomBadge: {
    position: "absolute",
    right: theme.spacing.screen,
    bottom: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.sm,
  },
  heroImg: { width: "100%", height: "100%" },
  heroBack: {
    position: "absolute",
    left: theme.spacing.screen,
  },
  heroActions: {
    position: "absolute",
    right: theme.spacing.screen,
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  heroActionBtn: {
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
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: theme.spacing.sm },
  carName: { ...theme.typography.title, color: colors.text, flex: 1 },
  priceTag: { alignItems: "flex-end" },
  priceTagAmount: { fontSize: 17, fontWeight: "800", color: colors.text },
  priceTagPer: { fontSize: 11.5, color: colors.textMuted, marginTop: -1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, flexWrap: "wrap" },
  specsRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
  specItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  specText: { fontSize: 13, color: colors.text, fontWeight: "500" },
  descripcion: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  metaText: { fontSize: 13, color: colors.textMuted },
  metaDot: { color: colors.textMuted },

  // Tarjeta del anfitrión — bloque premium pino oscuro con hairline menta.
  hostCardDark: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: colors.primary900,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    overflow: "hidden",
  },
  hostHairline: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: colors.accent500,
  },
  hostAvatarDark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(47,191,155,0.18)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  hostAvatarImg: { width: "100%", height: "100%" },
  hostNameDark: { fontSize: 15, fontWeight: "600", color: colors.textWhite },
  hostSubDark: { fontSize: 12.5, color: colors.accent200, marginTop: 2 },
  hostShield: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(47,191,155,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  ratingSummaryRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  ratingSummaryNum: { fontSize: 32, fontWeight: "800", color: colors.text, letterSpacing: -1 },
  ratingSummarySub: { fontSize: 12, color: colors.textMuted },
  reviewCard: {
    width: 220,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    padding: theme.spacing.md,
    gap: 6,
  },
  reviewHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewFecha: { fontSize: 11, color: colors.textMuted },
  reviewTexto: { fontSize: 13, color: colors.text, lineHeight: 18 },
  reviewAutor: { fontSize: 12, fontWeight: "600", color: colors.textMuted },

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

  footer: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerHelp: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: theme.spacing.sm,
    lineHeight: 17,
  },

  sumCarCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  sumThumb: { width: 76, height: 58, borderRadius: theme.radius.field, backgroundColor: colors.primary100 },
  sumThumbEmpty: { backgroundColor: colors.accent100, alignItems: "center", justifyContent: "center" },
  sumName: { fontSize: 15, fontWeight: "700", color: colors.text },
  sumMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  bdRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bdLabel: { fontSize: 15, color: colors.textMuted },
  bdValue: { fontSize: 15, color: colors.text, fontWeight: "500" },
  bdTotal: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: theme.spacing.md },
  bdTotalLabel: { fontSize: 17, fontWeight: "700", color: colors.text },
  bdTotalValue: { fontSize: 18, fontWeight: "700", color: colors.text },

  // Caja menta "garantía retenida" del resumen (dirección Lote 3, pantalla 20).
  holdBox: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    backgroundColor: colors.accent100,
    borderRadius: theme.radius.field,
    padding: theme.spacing.lg,
  },
  holdText: { flex: 1, fontSize: 13, color: colors.accent800, lineHeight: 19 },
});
