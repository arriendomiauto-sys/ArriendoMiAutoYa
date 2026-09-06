import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { useApp } from "../context/AppContext";
import { Icon } from "../components/Icon";
import { ScreenHeader, EmptyState } from "../components/ui";
import { ApiClient } from "../api/client";
import { conectarChat } from "../api/chatSocket";

// Red de seguridad, no el mecanismo principal: los mensajes llegan por
// WebSocket. Este intervalo solo corre mientras el canal en vivo no esté
// arriba (sin sesión, backend viejo, o señal cortada).
const POLL_MS = 4000;
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

  const scrollRef = useRef(null);
  // Si el usuario se desplazó hacia arriba a releer, un mensaje nuevo NO debe
  // arrastrarlo de vuelta al fondo. Solo se autodesplaza cuando ya estaba abajo.
  const alFondoRef = useRef(true);
  const canalRef = useRef(null);
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
        .then((real) => conciliarMensaje({ ...real, _clientId: msg._clientId }))
        .catch(() => marcarFallidoSiPendiente(msg._clientId));
    },
    [reservation?.id, marcarEstado, marcarFallidoSiPendiente, conciliarMensaje]
  );

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
      onMensaje: conciliarMensaje,
      onEstado: (estado) => {
        setEnVivo(estado === "conectado");
        // Al reconectar puede haberse perdido algo mientras no había canal.
        if (estado === "conectado") cargar();
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
  }, [reservation?.id, conciliarMensaje, marcarFallidoSiPendiente, cargar, dejarDeEscribir]);

  useEffect(() => {
    cargar();
    if (enVivo) return undefined;
    const t = setInterval(cargar, POLL_MS);
    return () => clearInterval(t);
  }, [cargar, enVivo]);

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
      <View style={[styles.container, { backgroundColor: c.bg }]}>
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
        style={[styles.bubbleWrap, mine ? styles.wrapMine : styles.wrapThem]}
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
          style={[
            styles.bubble,
            mine
              ? {
                  // Acento premium del dueño: mis burbujas en teal casi negro.
                  backgroundColor: esOwner ? colors.primary900 : colors.primary,
                  borderBottomRightRadius: 4,
                }
              : {
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderBottomLeftRadius: 4,
                },
            enviando && styles.bubbleEnviando,
            fallido && styles.bubbleFallido,
          ]}
        >
          <Text style={[styles.bubbleText, { color: mine && !fallido ? "#FFFFFF" : fallido ? colors.dangerText : c.text }]}>
            {m.texto}
          </Text>
          <Text
            style={[
              styles.time,
              { color: mine && !fallido ? "rgba(255,255,255,0.7)" : c.muted },
              fallido && { color: colors.dangerText, fontWeight: "700" },
            ]}
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
      style={[styles.container, { backgroundColor: c.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      // Ver LoginScreen.js: sin este KeyboardAvoidingView explícito, el
      // teclado tapaba la caja de mensaje entera — softwareKeyboardLayoutMode
      // "pan" por sí solo no alcanza.
    >
      <ScreenHeader
        title={interlocutor}
        subtitle={
          [auto.marca, auto.modelo, auto.patente].filter(Boolean).join(" · ") ||
          (enVivo ? "En línea" : "Reconectando…")
        }
        onBack={onBack}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.msgs}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        scrollEventThrottle={100}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          alFondoRef.current =
            contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
        }}
        onContentSizeChange={() => {
          if (alFondoRef.current) scrollRef.current?.scrollToEnd({ animated: true });
        }}
      >
        <View style={[styles.notice, { backgroundColor: colors.surfaceSubtle }]}>
          <Icon name="shield" size={12} color={c.muted} />
          <Text style={[styles.noticeText, { color: c.muted }]}>
            Reserva #{reservation.id.slice(0, 8).toUpperCase()}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
        ) : messages.length === 0 ? (
          <Text style={[styles.emptyMsg, { color: c.muted }]}>Aún no hay mensajes. Escribe el primero.</Text>
        ) : (
          messages.map(renderBurbuja)
        )}

        {otroEscribiendo ? (
          <View style={[styles.bubbleWrap, styles.wrapThem]}>
            <View
              style={[
                styles.bubble,
                { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: 4 },
              ]}
            >
              <Text style={[styles.bubbleText, { color: c.muted, fontStyle: "italic" }]}>escribiendo…</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.quickWrap, { borderTopColor: c.border }]} contentContainerStyle={styles.quickRow} keyboardShouldPersistTaps="handled">
        {QUICK.map((q) => (
          <TouchableOpacity
            key={q}
            style={[styles.quickChip, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={() => setInput(q)}
          >
            <Text style={[styles.quickText, { color: c.muted }]}>{q}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={[styles.inputBar, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <TextInput
          style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
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
          style={[
            styles.sendBtn,
            esOwner && { backgroundColor: colors.primary900 },
            !input.trim() && { opacity: 0.5 },
          ]}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  msgs: { padding: theme.spacing.screen, paddingBottom: theme.spacing.lg },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    marginBottom: theme.spacing.md,
  },
  noticeText: { fontSize: 11, fontWeight: "600" },
  emptyMsg: { fontSize: 13, textAlign: "center", marginTop: 20 },
  bubbleWrap: { marginBottom: theme.spacing.sm, maxWidth: "82%" },
  wrapMine: { alignSelf: "flex-end" },
  wrapThem: { alignSelf: "flex-start" },
  bubble: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: theme.radius.card },
  bubbleEnviando: { opacity: 0.6 },
  bubbleFallido: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder },
  bubbleText: { fontSize: 14, lineHeight: 19 },
  time: { fontSize: 10, marginTop: 3, textAlign: "right" },
  quickWrap: { borderTopWidth: 1, maxHeight: 46 },
  quickRow: { paddingHorizontal: theme.spacing.screen, paddingVertical: theme.spacing.sm, gap: theme.spacing.sm },
  quickChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: theme.radius.pill, borderWidth: 1 },
  quickText: { fontSize: 12, fontWeight: "500" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: theme.control.heightSm,
    maxHeight: 120,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === "ios" ? 11 : 8,
    paddingBottom: Platform.OS === "ios" ? 11 : 8,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
