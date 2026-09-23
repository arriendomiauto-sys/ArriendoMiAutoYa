import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  AppState,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../theme/colors";
import { useApp } from "../context/AppContext";
import { Icon } from "../components/Icon";
import { ScreenHeader, EmptyState } from "../components/ui";
import { ApiClient } from "../api/client";
import { conectarChat } from "../api/chatSocket";
import { avisarCambioChat } from "../utils/chatEvents";

// Outbox persistente: lo que el usuario escribió y el servidor todavía no
// confirmó se guarda en disco por reserva. Si cierra la app (o la mata el SO)
// con un mensaje a medio enviar, al volver lo ve como "no se envió" y se
// reintenta solo al recuperar el canal. Se limpia cuando ya no queda nada
// pendiente.
const outboxKey = (reservaId) => `@rentacar/chat_outbox/${reservaId}`;

async function leerOutbox(reservaId) {
  try {
    const raw = await AsyncStorage.getItem(outboxKey(reservaId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function guardarOutbox(reservaId, mensajes) {
  try {
    const pendientes = mensajes.filter(
      (m) => m._estado === "enviando" || m._estado === "fallido"
    );
    if (pendientes.length === 0) {
      await AsyncStorage.removeItem(outboxKey(reservaId));
    } else {
      await AsyncStorage.setItem(outboxKey(reservaId), JSON.stringify(pendientes));
    }
  } catch {
    /* si el almacenamiento falla, la cola sigue viva en memoria */
  }
}

// Red de seguridad, no el mecanismo principal: los mensajes llegan por
// WebSocket. Este intervalo solo corre mientras el canal en vivo no esté
// arriba (sin sesión, backend viejo, o señal cortada). Cada 2 s como
// máximo de espera cuando se cayó a REST.
const POLL_MS = 2000;
// Cada cuánto se reafirma "estoy escribiendo" mientras se teclea, y cuánto se
// espera sin teclas para avisar que se dejó de escribir.
const ESCRIBIR_MS = 2500;
const QUICK = [
  "Ya llegué al punto de encuentro",
  "Estoy a 5 minutos",
  "¿Me envías la ubicación exacta?",
  "Listo para la entrega",
];

let contadorClientId = 0;
const nuevoClientId = () =>
  `c${Date.now().toString(36)}${(contadorClientId++).toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;

export function RentalChatScreen({ onBack, reservation, variant = "renter" }) {
  const { currentUser } = useApp();
  const insets = useSafeAreaInsets();
  // El dueño ya no tiene tema oscuro: misma base clara que el arrendatario.
  // `variant` solo decide el texto ("Arrendatario" vs "Dueño del vehículo")
  // y un acento premium en las burbujas propias.
  const esOwner = variant === "owner";

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [enVivo, setEnVivo] = useState(false);
  const [otroEscribiendo, setOtroEscribiendo] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        setKeyboardVisible(true);
        setTimeout(() => {
          if (alFondoRef.current) {
            scrollRef.current?.scrollToEnd({ animated: false });
          }
        }, 80);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollRef = useRef(null);
  // Si el usuario se desplazó hacia arriba a releer, un mensaje nuevo NO debe
  // arrastrarlo de vuelta al fondo. Solo se autodesplaza cuando ya estaba abajo.
  const alFondoRef = useRef(true);
  const canalRef = useRef(null);
  // Espejo de `messages` para leerlo desde callbacks del canal sin recrearlos.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const escribirRef = useRef({ activo: false, timer: null });
  const otroEscribeTimerRef = useRef(null);

  // ---- cola optimista ------------------------------------------------------

  const marcarEstado = useCallback((clientId, estado) => {
    setMessages((prev) =>
      prev.map((m) => (m._clientId === clientId ? { ...m, _estado: estado } : m))
    );
  }, []);

  // Degrada a "fallido" SOLO un mensaje que sigue "enviando". Si el broadcast
  // `nuevo_mensaje` o el ACK ya lo conciliaron como "enviado", un ACK que llega
  // tarde —o su timeout de 12 s— no debe resucitarlo como fallido: se vería
  // "No se envió" en un mensaje que sí llegó y el reintento lo duplicaría en el
  // servidor.
  const marcarFallidoSiPendiente = useCallback((clientId) => {
    setMessages((prev) =>
      prev.map((m) =>
        m._clientId === clientId && m._estado === "enviando"
          ? { ...m, _estado: "fallido" }
          : m
      )
    );
  }, []);

  // Un mensaje puede llegar por varios caminos (ACK del envío, broadcast
  // `nuevo_mensaje`, refresco REST). Se concilia contra el optimista en vez de
  // agregarlo aparte, para que no aparezca dos veces.
  const conciliarMensaje = useCallback((nuevo) => {
    if (!nuevo?.id) return;
    setMessages((prev) => {
      const cid = nuevo._clientId;
      const idxOptimista = prev.findIndex(
        (m) =>
          m._estado === "enviando" &&
          ((cid && m._clientId === cid) ||
            (!cid && m.autor_id === nuevo.autor_id && m.texto === nuevo.texto))
      );
      if (idxOptimista !== -1) {
        const copia = prev.slice();
        copia[idxOptimista] = {
          ...nuevo,
          _clientId: prev[idxOptimista]._clientId,
          _estado: "enviado",
        };
        return copia;
      }
      if (prev.some((m) => m.id === nuevo.id)) return prev;
      return [...prev, { ...nuevo, _estado: "enviado" }];
    });
  }, []);

  const cargar = useCallback(async () => {
    if (!reservation?.id) return;
    try {
      const server = (await ApiClient.getMensajes(reservation.id)) || [];
      setMessages((prev) => {
        // Se conservan los optimistas que todavía no llegaron al servidor
        // (enviando / fallido), para no perder lo que el usuario escribió
        // cuando el canal estaba caído.
        const optimistasVivos = prev.filter(
          (m) =>
            m._estado &&
            m._estado !== "enviado" &&
            !server.some((s) => s.autor_id === m.autor_id && s.texto === m.texto)
        );
        return [...server, ...optimistasVivos];
      });
    } catch {
      /* el polling reintenta */
    } finally {
      setLoading(false);
    }
  }, [reservation?.id]);

  const intentarEnviar = useCallback(
    (msg) => {
      marcarEstado(msg._clientId, "enviando");
      const canal = canalRef.current;
      // 1) Canal en vivo: el ACK / broadcast concilian; si no llega, el propio
      //    canal avisa por `onEnvioResuelto` y se marca "fallido".
      if (canal && canal.enviar(msg.texto, msg._clientId)) return;
      // 2) REST (canal caído). Sin `await` que bloquee la interfaz: el mensaje
      //    ya está en pantalla como "enviando".
      ApiClient.enviarMensaje(reservation.id, msg.texto)
        .then((real) => {
          conciliarMensaje({ ...real, _clientId: msg._clientId });
          avisarCambioChat();
        })
        .catch(() => marcarFallidoSiPendiente(msg._clientId));
    },
    [reservation?.id, marcarEstado, marcarFallidoSiPendiente, conciliarMensaje]
  );

  // Reintenta todo lo que quedó sin enviar (de esta sesión o rehidratado del
  // outbox de una sesión anterior). Se llama al recuperar el canal en vivo.
  const reintentarPendientes = useCallback(() => {
    messagesRef.current
      .filter((m) => m._estado === "fallido")
      .forEach((m) => intentarEnviar(m));
  }, [intentarEnviar]);

  // ---- persistencia offline del outbox --------------------------------------

  // Al abrir la conversación se rehidrata lo que quedó pendiente en disco. Se
  // marca "fallido" (no "enviando"): ya no hay ningún envío en curso, así que
  // el usuario puede tocar para reintentar y `reintentarPendientes` lo reenvía
  // solo en cuanto haya canal. `cargar()` los descarta si el texto ya está en
  // el servidor (se envió pero se perdió el ACK antes de cerrar la app).
  useEffect(() => {
    if (!reservation?.id) return;
    let vivo = true;
    leerOutbox(reservation.id).then((pend) => {
      if (!vivo || pend.length === 0) return;
      setMessages((prev) => {
        const conocidos = new Set(prev.map((m) => m._clientId));
        const nuevos = pend
          .filter((m) => m._clientId && !conocidos.has(m._clientId))
          .map((m) => ({ ...m, _estado: "fallido" }));
        return nuevos.length ? [...nuevos, ...prev] : prev;
      });
    });
    return () => {
      vivo = false;
    };
  }, [reservation?.id]);

  // Cada cambio en la lista persiste (o limpia) el subconjunto pendiente.
  useEffect(() => {
    if (!reservation?.id) return;
    guardarOutbox(reservation.id, messages);
  }, [messages, reservation?.id]);

  // ---- escritura en vivo -------------------------------------------------

  const dejarDeEscribir = useCallback(() => {
    clearTimeout(escribirRef.current.timer);
    if (escribirRef.current.activo) {
      escribirRef.current.activo = false;
      canalRef.current?.escribir(false);
    }
  }, []);

  const avisarEscribiendo = useCallback(
    (texto) => {
      const canal = canalRef.current;
      if (!canal) return;
      if (texto && !escribirRef.current.activo) {
        escribirRef.current.activo = true;
        canal.escribir(true);
      }
      clearTimeout(escribirRef.current.timer);
      escribirRef.current.timer = setTimeout(dejarDeEscribir, ESCRIBIR_MS);
    },
    [dejarDeEscribir]
  );

  // ---- canal en vivo ----------------------------------------------------

  useEffect(() => {
    if (!reservation?.id) return undefined;
    const canal = conectarChat(reservation.id, {
      onMensaje: (nuevo) => {
        conciliarMensaje(nuevo);
        avisarCambioChat();
      },
      onEstado: (estado) => {
        setEnVivo(estado === "conectado");
        // Al reconectar puede haberse perdido algo mientras no había canal:
        // se refresca el historial y se reintenta lo que quedó pendiente.
        if (estado === "conectado") {
          cargar();
          reintentarPendientes();
        }
      },
      onEnvioResuelto: ({ clientId, ok }) => {
        if (!ok) marcarFallidoSiPendiente(clientId);
      },
      onEscribiendo: (activo) => {
        setOtroEscribiendo(activo);
        clearTimeout(otroEscribeTimerRef.current);
        if (activo) {
          otroEscribeTimerRef.current = setTimeout(() => setOtroEscribiendo(false), 5000);
        }
      },
    });
    canalRef.current = canal;
    return () => {
      dejarDeEscribir();
      clearTimeout(otroEscribeTimerRef.current);
      canal.cerrar();
      canalRef.current = null;
    };
  }, [reservation?.id, conciliarMensaje, marcarFallidoSiPendiente, cargar, dejarDeEscribir, reintentarPendientes]);

  useEffect(() => {
    cargar();
    if (enVivo) return undefined;
    const t = setInterval(cargar, POLL_MS);
    return () => clearInterval(t);
  }, [cargar, enVivo]);

  // Al volver al primer plano el SO pudo matar el WebSocket (datos móviles,
  // suspensión). En vez de esperar el backoff y el siguiente poll, se refresca
  // ya el historial y se despereza el canal de una.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") {
        cargar();
        canalRef.current?.reconectar?.();
      }
    });
    return () => sub.remove();
  }, [cargar]);

  const handleSend = () => {
    const texto = input.trim();
    if (!texto || !reservation?.id) return;
    const clientId = nuevoClientId();
    const optimista = {
      id: clientId,
      _clientId: clientId,
      _estado: "enviando",
      reserva_id: reservation.id,
      autor_id: currentUser?.id,
      texto,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimista]);
    setInput("");
    dejarDeEscribir();
    // Mandar un mensaje propio siempre baja la vista al fondo.
    alFondoRef.current = true;
    intentarEnviar(optimista);
  };

  const auto = reservation?.auto || reservation?.car || {};
  const interlocutor = esOwner ? "Arrendatario" : "Dueño del vehículo";

  const c = {
    bg: colors.background,
    surface: colors.surface,
    border: colors.border,
    text: colors.text,
    muted: colors.textMuted,
    input: colors.surface,
  };

  if (!reservation?.id) {
    return (
      <View className="flex-1" style={{ backgroundColor: c.bg }}>
        <ScreenHeader title="Mensajes" onBack={onBack} />
        <EmptyState
          icon="chat"
          title="No tienes una conversación activa"
          message={
            esOwner
              ? "Elige una reserva desde tus solicitudes para chatear con el arrendatario."
              : "Cuando tengas un arriendo activo o confirmado, podrás coordinar aquí con el dueño."
          }
        />
      </View>
    );
  }

  const renderBurbuja = (m) => {
    const mine = m.autor_id === currentUser?.id;
    const fallido = m._estado === "fallido";
    const enviando = m._estado === "enviando";
    const Wrapper = fallido ? TouchableOpacity : View;
    return (
      <Wrapper
        key={m._clientId || m.id}
        className={`mb-2 max-w-[82%] ${mine ? "self-end" : "self-start"}`}
        {...(fallido
          ? {
              onPress: () => intentarEnviar(m),
              accessibilityRole: "button",
              accessibilityLabel: "Reintentar enviar el mensaje",
              activeOpacity: 0.8,
            }
          : {})}
      >
        <View
          className={`py-2.5 px-3.5 rounded-2xl ${
            mine
              ? esOwner
                ? "bg-primary-900 rounded-br"
                : "bg-primary rounded-br"
              : "rounded-bl border"
          } ${enviando ? "opacity-60" : ""} ${
            fallido ? "bg-red-50 border border-red-300" : ""
          }`}
          style={
            !mine
              ? {
                  backgroundColor: c.surface,
                  borderColor: c.border,
                }
              : undefined
          }
        >
          <Text
            className={`text-[14px] leading-[19px] ${
              mine && !fallido
                ? "text-white"
                : fallido
                ? "text-red-700 font-medium"
                : ""
            }`}
            style={!mine && !fallido ? { color: c.text } : undefined}
          >
            {m.texto}
          </Text>
          <Text
            className={`text-[10px] mt-0.5 text-right ${
              mine && !fallido
                ? "text-white/70"
                : fallido
                ? "text-red-600 font-bold"
                : ""
            }`}
            style={!mine && !fallido ? { color: c.muted } : undefined}
          >
            {fallido
              ? "No se envió · toca para reintentar"
              : enviando
              ? "Enviando…"
              : new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      </Wrapper>
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader
        title={interlocutor}
        subtitle={
          [
            // La patente del auto recién se muestra al arrendatario cuando ya
            // lo retiró (o el viaje terminó) — antes de eso no hay nada que
            // hacer con ese dato y solo expone información de más.
            [
              auto.marca,
              auto.modelo,
              (esOwner || ["en_curso", "finalizada"].includes(reservation?.estado)) ? auto.patente : null,
            ]
              .filter(Boolean)
              .join(" · ") || null,
            enVivo ? null : "Reconectando…",
          ]
            .filter(Boolean)
            .join(" · ") || "En línea"
        }
        onBack={onBack}
      />

      <FlatList
        ref={scrollRef}
        className="flex-1"
        data={loading ? [] : messages}
        keyExtractor={(item) => item._clientId || item.id}
        renderItem={({ item }) => renderBurbuja(item)}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "flex-end",
          padding: 16,
          paddingBottom: 8,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        scrollEventThrottle={100}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          alFondoRef.current =
            contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
        }}
        onContentSizeChange={() => {
          if (alFondoRef.current) scrollRef.current?.scrollToEnd({ animated: true });
        }}
        ListHeaderComponent={
          <View className="flex-row items-center justify-center gap-1.5 self-center py-1.5 px-3 rounded-full mb-3 bg-gray-100">
            <Icon name="shield" size={12} color={c.muted} />
            <Text className="text-[11px] font-semibold" style={{ color: c.muted }}>
              Reserva #{reservation.id.slice(0, 8).toUpperCase()}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.accent} className="mt-5" />
          ) : (
            <Text className="text-[13px] text-center mt-5" style={{ color: c.muted }}>Aún no hay mensajes. Escribe el primero.</Text>
          )
        }
        ListFooterComponent={
          otroEscribiendo ? (
            <View className="mb-2 max-w-[82%] self-start">
              <View
                className="py-2.5 px-3.5 rounded-2xl rounded-bl border"
                style={{ backgroundColor: c.surface, borderColor: c.border }}
              >
                <Text className="text-[14px] leading-[19px] italic" style={{ color: c.muted }}>escribiendo…</Text>
              </View>
            </View>
          ) : null
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-t max-h-[46px]"
        style={{ borderTopColor: c.border }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        {QUICK.map((q) => (
          <TouchableOpacity
            key={q}
            className="py-1.5 px-3 rounded-full border"
            style={{ backgroundColor: c.surface, borderColor: c.border }}
            onPress={() => setInput(q)}
          >
            <Text className="text-xs font-medium" style={{ color: c.muted }}>{q}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View
        className="flex-row items-end gap-2 px-4 pt-3 border-t"
        style={{
          backgroundColor: c.surface,
          borderTopColor: c.border,
          paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 12),
        }}
      >
        <TextInput
          className="flex-1 min-h-[40px] max-h-[120px] rounded-xl border-[1.5px] px-4 text-[15px]"
          style={{
            backgroundColor: c.input,
            borderColor: c.border,
            color: c.text,
            paddingTop: Platform.OS === "ios" ? 11 : 8,
            paddingBottom: Platform.OS === "ios" ? 11 : 8,
          }}
          placeholder="Escribe un mensaje…"
          placeholderTextColor={c.muted}
          value={input}
          onChangeText={(t) => {
            setInput(t);
            avisarEscribiendo(t);
          }}
          onSubmitEditing={handleSend}
          onBlur={dejarDeEscribir}
          returnKeyType="send"
          blurOnSubmit={false}
          multiline
        />
        <TouchableOpacity
          className={`w-11 h-11 rounded-full items-center justify-center ${
            esOwner ? "bg-primary-900" : "bg-primary"
          } ${!input.trim() ? "opacity-50" : ""}`}
          onPress={handleSend}
          disabled={!input.trim()}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
        >
          <Icon name="arrow-right" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
