import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StatusBar, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Icon,
  Button,
  Card,
  ScreenHeader,
  ApiClient,
  showAlert,
  ContractModal,
  AgregarTarjetaModal,
  msjError,
  useTarjetas,
  useCuentaRegresiva,
  useApp,
  CarPhotoThumb,
  hapticoExito,
  hapticoError,
  configMercadoPago,
  tokenizarTarjetaGuardada,
} from "@rentacar/mobile-shared";
import { SelectorTarjeta } from "../components/SelectorTarjeta";

const clp = (n) => `$${(n || 0).toLocaleString("es-CL")}`;

export function PaymentMethodsScreen({ car: carProp, booking, onBack, onPaymentSuccess, existingReservation }) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useApp();
  const { validadas, tarjetasDebito, tarjetasCredito, agregar, recargar } = useTarjetas();

  // Reanudar una reserva `pendiente_pago` ya existente (desde "Mis reservas"
  // o el reintento en el arriendo activo) no trae `car`/`booking` por
  // separado — vienen adentro de la reserva misma.
  const car = carProp || existingReservation?.auto;
  const dias =
    booking?.dias ??
    (existingReservation?.fecha_inicio && existingReservation?.fecha_fin
      ? Math.max(1, Math.ceil((new Date(existingReservation.fecha_fin) - new Date(existingReservation.fecha_inicio)) / 86400000))
      : 0);
  const esReservaReal = !!(car?.id && (booking || existingReservation));
  const nombreAuto = [car?.marca, car?.modelo, car?.anio].filter(Boolean).join(" ");

  // Estimación mientras no exista la reserva (mismas fórmulas que el backend):
  // el cobro = días × tarifa (IVA incl.); la garantía = monto fijo por categoría.
  const tarifaDia = car?.tarifa_dia || 0;
  const cobroEstimado = tarifaDia * dias;
  const garantiaEstimada = car?.monto_garantia ?? booking?.montoHold ?? 0;

  const [reserva, setReserva] = useState(existingReservation || null);
  const cobro = reserva?.cobro?.monto ?? cobroEstimado;
  const neto = reserva?.cobro?.neto ?? Math.round(cobro / 1.19);
  const iva = reserva?.cobro?.iva ?? cobro - Math.round(cobro / 1.19);
  const garantia = reserva?.garantia?.monto ?? garantiaEstimada;

  const [tarjetaCobroId, setTarjetaCobroId] = useState(null);
  const [tarjetaGarantiaId, setTarjetaGarantiaId] = useState(null);
  const [errorCobro, setErrorCobro] = useState(null);
  const [errorGarantia, setErrorGarantia] = useState(null);
  // Mercado Pago pide el CVV en cada cobro a una tarjeta guardada. No se guarda
  // en ningún lado: se usa para generar el token y se olvida al salir.
  const [cvvCobro, setCvvCobro] = useState("");
  const [cvvGarantia, setCvvGarantia] = useState("");

  const [modalAgregar, setModalAgregar] = useState(null); // "debito" | "credito" | null
  const [showContractPreview, setShowContractPreview] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [pendiente, setPendiente] = useState(null); // { expira_en, motivo }
  // Guarda síncrona anti doble-tap: `pagando` (estado de React) puede no
  // haberse re-renderizado todavía cuando llega un segundo tap muy rápido;
  // esta ref sí bloquea de inmediato, sin esperar el próximo render.
  const pagandoRef = useRef(false);

  // BLOQUE TEMPORAL — PAGOS SIMULADOS (bandera del backend)
  const [pagoSimulado, setPagoSimulado] = useState(false);
  useEffect(() => {
    let vivo = true;
    ApiClient.getConfiguracionPagos()
      .then((cfg) => vivo && setPagoSimulado(!!cfg?.simulado))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  // El cobro del arriendo acepta débito o crédito; la garantía es siempre un
  // hold en crédito y no puede repetir la misma tarjeta que el cobro.
  // Memoizado: sin esto, el array se recreaba en cada render y el useEffect
  // de preselección de abajo (que depende de esta lista) se re-ejecutaba de
  // más aunque el contenido no hubiera cambiado.
  const tarjetasCobro = useMemo(
    () => validadas.filter((t) => t.id !== tarjetaGarantiaId),
    [validadas, tarjetaGarantiaId]
  );

  // Preselección: la tarjeta marcada como predeterminada, o la primera —
  // prefiere débito si hay (evita "gastar" cupo de crédito sin necesidad).
  useEffect(() => {
    if (!tarjetaCobroId && tarjetasCobro.length) {
      setTarjetaCobroId(
        (tarjetasDebito.find((t) => t.predeterminada_cobro) || tarjetasDebito[0] || tarjetasCobro[0]).id
      );
    }
  }, [tarjetasCobro, tarjetasDebito, tarjetaCobroId]);
  useEffect(() => {
    if (!tarjetaGarantiaId && tarjetasCredito.length) {
      setTarjetaGarantiaId(
        (tarjetasCredito.find((t) => t.predeterminada_garantia) || tarjetasCredito[0]).id
      );
    }
  }, [tarjetasCredito, tarjetaGarantiaId]);

  // Si ambos selectores terminan apuntando a la misma tarjeta (p. ej. el
  // usuario cambia la garantía a la que ya estaba usando para el cobro),
  // limpia el cobro en vez de dejar seleccionado un id que ya no aparece
  // en su lista (el backend igual lo rechazaría con TARJETA_TIPO_INVALIDO).
  useEffect(() => {
    if (tarjetaCobroId && tarjetaCobroId === tarjetaGarantiaId) {
      setTarjetaCobroId(null);
    }
  }, [tarjetaCobroId, tarjetaGarantiaId]);

  // Al cambiar de tarjeta, el CVV escrito ya no corresponde.
  useEffect(() => setCvvCobro(""), [tarjetaCobroId]);
  useEffect(() => setCvvGarantia(""), [tarjetaGarantiaId]);

  const pedirCvv = !pagoSimulado && configMercadoPago().puedeContactarMP;
  const cvvOk = (c) => c.length >= 3;
  const cvvsListos = !pedirCvv || (cvvOk(cvvCobro) && cvvOk(cvvGarantia));
  const listo = !!tarjetaCobroId && !!tarjetaGarantiaId && cvvsListos && !pagando;

  const cuenta = useCuentaRegresiva(pendiente?.expira_en || reserva?.expira_en || null);

  // ── Crear la reserva (si no existe) y abrir la firma ─────────────────────
  const handleContinuar = async () => {
    if (pagandoRef.current) return;
    if (!esReservaReal) {
      onPaymentSuccess(null);
      return;
    }
    if (!listo) {
      showAlert(
        "Completa tus tarjetas",
        cvvsListos
          ? "Falta elegir la tarjeta del cobro y la de la garantía."
          : "Escribe el código de seguridad (CVV) de las dos tarjetas."
      );
      return;
    }
    setErrorCobro(null);
    setErrorGarantia(null);
    pagandoRef.current = true;
    setPagando(true);
    try {
      let r = reserva;
      if (!r) {
        r = await ApiClient.crearReserva({
          auto_id: car.id,
          fecha_inicio: booking.fechaInicio,
          fecha_fin: booking.fechaFin,
          lugar_entrega_acordado: car.ubicacion_base,
        });
        setReserva(r);
      }
      // El contrato NO se firma al pagar: se firma en la entrega, con el dueño,
      // después de revisar el auto. Acá se paga directo.
      pagandoRef.current = false;
      setPagando(false);
      await ejecutarPago(r);
    } catch (error) {
      pagandoRef.current = false;
      setPagando(false);
      const motivo = msjError(error, "Intenta nuevamente en unos segundos.");
      const esRequisito = /licencia|permiso internacional|edad mínima|residencia/i.test(
        error?.message || ""
      );
      showAlert(
        esRequisito ? "No puedes reservar este auto" : "No se pudo crear la reserva",
        esRequisito
          ? `${motivo}\n\nActualiza tus documentos desde tu perfil o escríbenos a soporte.`
          : motivo
      );
    }
  };

  // ── Cobro + hold ────────────────────────────────────────────────────────
  const ejecutarPago = async (r) => {
    if (pagandoRef.current) return;
    setErrorCobro(null);
    setErrorGarantia(null);
    pagandoRef.current = true;
    setPagando(true);
    try {
      // Tokens nuevos en cada intento: son de un solo uso.
      let token_cobro = null;
      let token_garantia = null;
      if (pedirCvv) {
        const porId = (id) => validadas.find((t) => t.id === id);
        try {
          token_garantia = await tokenizarTarjetaGuardada({
            cardId: porId(tarjetaGarantiaId)?.mp_card_id, cvv: cvvGarantia,
          });
        } catch (e) {
          setErrorGarantia(e?.message || "No pudimos validar el código de seguridad de esta tarjeta.");
          return;
        }
        try {
          token_cobro = await tokenizarTarjetaGuardada({
            cardId: porId(tarjetaCobroId)?.mp_card_id, cvv: cvvCobro,
          });
        } catch (e) {
          setErrorCobro(e?.message || "No pudimos validar el código de seguridad de esta tarjeta.");
          return;
        }
      }
      const res = await ApiClient.pagarReserva(r.id, {
        tarjeta_cobro_id: tarjetaCobroId,
        tarjeta_garantia_id: tarjetaGarantiaId,
        token_cobro,
        token_garantia,
      });
      if (res?.estado === "confirmada") {
        hapticoExito();
        onPaymentSuccess({ ...r, car, estado: "confirmada", pagoSimulado });
        return;
      }
      // Pagada, pero el dueño todavía tiene que confirmar (plazo de 24 h): la reserva queda "pendiente".
      if (res?.estado === "esperando_dueno") {
        hapticoExito();
        onPaymentSuccess({
          ...r, car, estado: "pendiente", confirmar_dueno_antes_de: res.confirmar_antes_de, pagoSimulado,
        });
        return;
      }
      // "pendiente": el cobro quedó en proceso; se guarda la reserva.
      setPendiente({ expira_en: res?.expira_en || r.expira_en, motivo: res?.motivo });
    } catch (e) {
      hapticoError();
      const mensajeLimpio = (() => {
        const raw = e?.mensaje || e?.message || "";
        if (typeof raw === "string" && raw.startsWith("{")) {
          try {
            const parsed = JSON.parse(raw);
            return parsed.mensaje || parsed.message || parsed.motivo || raw;
          } catch {
            return raw;
          }
        }
        return raw;
      })();

      const codigo = e?.codigo || e?.detail?.codigo;
      const campo = e?.campo || e?.detail?.campo;

      if (codigo === "CVV_INVALIDO") {
        if (campo === "garantia") {
          setCvvGarantia("");
          setErrorGarantia(mensajeLimpio || "El código de seguridad es incorrecto. Revísalo y reintenta.");
        } else {
          setCvvCobro("");
          setErrorCobro(mensajeLimpio || "El código de seguridad es incorrecto. Revísalo y reintenta.");
        }
      } else if (codigo === "SIN_CUPO") {
        setErrorGarantia(
          `Esta tarjeta no tiene cupo disponible para la retención de garantía (${clp(garantia)}). Puedes seleccionar otra o agregar una tarjeta de crédito con cupo.`
        );
      } else if (codigo === "COBRO_RECHAZADO") {
        setErrorCobro(mensajeLimpio || "El cobro fue rechazado. Prueba con otra tarjeta.");
      } else if (codigo === "TARJETA_TIPO_INVALIDO") {
        if (campo === "cobro") {
          setErrorCobro(
            mensajeLimpio || "El arriendo requiere una tarjeta de débito o crédito validada, distinta de la garantía."
          );
        } else if (campo === "garantia") {
          setErrorGarantia(mensajeLimpio || "La garantía requiere una tarjeta de crédito validada.");
        } else {
          showAlert(
            "Tipo de tarjeta incorrecto",
            mensajeLimpio || "Una de las tarjetas no corresponde al tipo requerido (débito o crédito para el arriendo, crédito para la garantía)."
          );
        }
        recargar();
      } else if (codigo === "RESERVA_EXPIRADA") {
        showAlert("Tu reserva venció", "Pasó demasiado tiempo. Vuelve a elegir las fechas.", [
          { text: "Entendido", onPress: onBack },
        ]);
      } else {
        // Falla de red / pasarela: la reserva queda pendiente y se puede reintentar.
        setPendiente({ expira_en: r.expira_en, motivo: mensajeLimpio });
      }
    } finally {
      pagandoRef.current = false;
      setPagando(false);
    }
  };

  // ── Panel de reserva pendiente ──────────────────────────────────────────
  if (pendiente) {
    return (
      <View className="flex-1 bg-background">
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Reserva pendiente" onBack={onBack} />
        <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
          <View className="items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-2xl p-4">
            <Icon name="clock" size={22} color="#B45309" />
            <Text className="text-base font-extrabold text-textDark">Tu reserva quedó pendiente</Text>
            <Text className="text-[13px] text-amber-800 leading-[19px] text-center">
              {pendiente.motivo ||
                "Mercado Pago no confirmó el pago al instante."}{" "}
              Guardamos la reserva y no se cobró nada todavía.
            </Text>
          </View>

          <Card padded className="gap-1">
            <Text className="text-[15px] font-bold text-textDark">{nombreAuto || "Vehículo"}</Text>
            <Text className="text-[13px] text-textMuted">
              {dias} {dias === 1 ? "día" : "días"} · {clp(cobro)} + garantía {clp(garantia)}
            </Text>
            {cuenta.etiqueta ? (
              <Text className={`text-[13px] font-bold mt-1 ${cuenta.vencido ? "text-red-600" : "text-primary"}`}>
                {cuenta.vencido ? "La reserva venció" : `Expira en ${cuenta.etiqueta}`}
              </Text>
            ) : null}
          </Card>

          <View className="gap-2">
            <Button
              label="Reintentar el pago"
              onPress={() => {
                setPendiente(null);
                if (reserva) ejecutarPago(reserva);
              }}
              loading={pagando}
              disabled={cuenta.vencido}
            />
            <Button
              variant="secondary"
              label="Usar otra tarjeta"
              onPress={() => setPendiente(null)}
              disabled={pagando}
            />
            <Button
              variant="ghost"
              label="Ver mis reservas"
              onPress={() => onPaymentSuccess({ ...reserva, car, estado: "pendiente_pago" })}
              disabled={pagando}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScreenHeader title="Confirmar y pagar" onBack={onBack} />

      <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
        {esReservaReal && (
          <Card padded className="flex-row items-center gap-3">
            <CarPhotoThumb uri={car.fotos?.[0]} className="w-[76px] h-[58px] rounded-xl" />
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-textDark">{nombreAuto || "Vehículo"}</Text>
              <Text className="text-[13px] text-textMuted mt-0.5">
                {dias} {dias === 1 ? "día" : "días"}{car.ubicacion_base ? ` · ${car.ubicacion_base}` : ""}
              </Text>
            </View>
          </Card>
        )}

        {pagoSimulado ? (
          <View className="flex-row items-start gap-2 p-3 rounded-xl border border-amber-300 bg-amber-50">
            <Icon name="alert" size={18} color="#B45309" />
            <Text className="flex-1 text-[12.5px] text-amber-800 leading-[18px]">
              <Text className="font-bold">Modo de prueba.</Text> No se cobra ni se retiene
              nada real: la reserva avanza como si el pago hubiera sido exitoso.
            </Text>
          </View>
        ) : null}

        {(errorCobro || errorGarantia) && cuenta.etiqueta && !cuenta.vencido ? (
          <View className="flex-row items-start gap-2 p-3 rounded-xl border border-red-200 bg-red-50">
            <Icon name="clock" size={16} color="#B91C1C" />
            <Text className="flex-1 text-[12.5px] text-red-800 leading-[18px]">
              <Text className="font-bold">Tu reserva vence en {cuenta.etiqueta}.</Text> Guardamos el auto para ti
              mientras eliges otra tarjeta.
            </Text>
          </View>
        ) : null}

        <SelectorTarjeta
          titulo="Cobro del arriendo"
          subtitulo="Se cobra hoy a una tarjeta de débito o crédito."
          insignia={pagoSimulado ? undefined : "Mercado Pago"}
          tarjetas={tarjetasCobro}
          seleccionadaId={tarjetaCobroId}
          onSeleccionar={(id) => {
            setTarjetaCobroId(id);
            setErrorCobro(null);
          }}
          onAgregar={() => setModalAgregar(tarjetasDebito.length ? "credito" : "debito")}
          error={errorCobro}
          tipoVacio="débito o crédito"
          pedirCvv={pedirCvv}
          cvv={cvvCobro}
          onCvv={(v) => {
            setCvvCobro(v);
            setErrorCobro(null);
          }}
        />

        <SelectorTarjeta
          titulo="Garantía"
          subtitulo="Retención temporal en tarjeta de crédito. No genera cargo si el auto se restituye conforme."
          insignia="Solo crédito"
          tarjetas={tarjetasCredito}
          seleccionadaId={tarjetaGarantiaId}
          onSeleccionar={(id) => {
            setTarjetaGarantiaId(id);
            setErrorGarantia(null);
          }}
          onAgregar={() => setModalAgregar("credito")}
          error={errorGarantia}
          tipoVacio="crédito"
          pedirCvv={pedirCvv}
          cvv={cvvGarantia}
          onCvv={(v) => {
            setCvvGarantia(v);
            setErrorGarantia(null);
          }}
        />

        <Card padded className="gap-3">
          <View className="flex-row justify-between items-center">
            <Text className="text-[15px] text-textMuted">Arriendo · {dias} {dias === 1 ? "día" : "días"}</Text>
            <Text className="text-[15px] text-textDark font-medium">{clp(neto)}</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-[15px] text-textMuted">IVA 19%</Text>
            <Text className="text-[15px] text-textDark font-medium">{clp(iva)}</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-sm text-textMuted">Garantía (no es un cobro)</Text>
            <Text className="text-sm text-textMuted">{clp(garantia)}</Text>
          </View>
          <View className="flex-row justify-between items-center border-t border-border pt-3">
            <Text className="text-[17px] font-bold text-textDark">Se cobra hoy</Text>
            <Text className="text-xl font-extrabold text-primary tracking-[-0.5px]">{clp(cobro)}</Text>
          </View>
        </Card>

        <View className="flex-row items-start gap-2">
          <Icon name="shield" size={16} color="#B45309" />
          <Text className="flex-1 text-[12.5px] text-textMuted leading-[18px]">
            La garantía es una retención sobre el cupo de tu tarjeta de crédito, no un cobro. Se
            libera al devolver el auto sin daños (la reversa en tu banco tarda entre 24 y 72 hrs hábiles).
          </Text>
        </View>
      </ScrollView>

      <View
        className="px-4 pt-3 bg-white border-t border-border gap-2"
        style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}
      >
        {(() => {
          return (
            <>
              <Button
                testID="btn-confirmar-pago"
                label={pagoSimulado ? "Confirmar reserva" : "Pagar y reservar"}
                iconRight="arrow-right"
                onPress={handleContinuar}
                loading={pagando}
                disabled={!listo}
              />
              {pagoSimulado ? null : (
                <View className="flex-row items-center justify-center gap-1.5">
                  <Icon name="lock" size={12} color="#125A49" />
                  <Text className="text-[11px] font-semibold text-accent-800">Pago procesado por Mercado Pago</Text>
                </View>
              )}
              <Text className="text-xs text-textMuted text-center leading-[17px]">
                Al pagar autorizas la retención de la garantía. El contrato lo firman tú y el dueño en la
                entrega, después de revisar el auto.{" "}
                <Text className="font-semibold text-primary" onPress={() => setShowContractPreview(true)}>
                  Ver el contrato
                </Text>
              </Text>
            </>
          );
        })()}
      </View>

      <ContractModal
        visible={showContractPreview}
        reservation={reserva || { id: "preview", auto: car, monto_hold: garantia }}
        onClose={() => setShowContractPreview(false)}
      />

      <AgregarTarjetaModal
        visible={!!modalAgregar}
        onClose={() => setModalAgregar(null)}
        onAgregar={agregar}
        onAgregada={(tarjeta) => {
          setModalAgregar(null);
          if (tarjeta?.tipo === "debito") {
            setTarjetaCobroId(tarjeta.id);
            setErrorCobro(null);
          }
          if (tarjeta?.tipo === "credito") {
            setTarjetaGarantiaId(tarjeta.id);
            setErrorGarantia(null);
          }
        }}
        nombreTitular={currentUser?.nombre}
        rut={currentUser?.rut}
        tipoPreferido={modalAgregar || undefined}
      />
    </View>
  );
}

