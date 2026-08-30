import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { useApp } from "../context/AppContext";
import { Icon } from "../components/Icon";
import { ScreenHeader, EmptyState } from "../components/ui";
import { ApiClient } from "../api/client";

const POLL_MS = 4000;
const QUICK = [
  "Ya llegué al punto de encuentro",
  "Estoy a 5 minutos",
  "¿Me envías la ubicación exacta?",
  "Listo para la entrega",
];

export function RentalChatScreen({ onBack, reservation, variant = "renter" }) {
  const { currentUser } = useApp();
  const insets = useSafeAreaInsets();
  const tone = variant === "owner" ? "dark" : "light";
  const dark = tone === "dark";

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const auto = reservation?.auto || reservation?.car || {};
  const interlocutor = dark ? "Arrendatario" : "Dueño del vehículo";

  const cargar = useCallback(async () => {
    if (!reservation?.id) return;
    try {
      setMessages((await ApiClient.getMensajes(reservation.id)) || []);
    } catch {
      /* el polling reintenta */
    } finally {
      setLoading(false);
    }
  }, [reservation?.id]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, POLL_MS);
    return () => clearInterval(t);
  }, [cargar]);

  const handleSend = async () => {
    const texto = input.trim();
    if (!texto || !reservation?.id) return;
    setSending(true);
    setInput("");
    try {
      const nuevo = await ApiClient.enviarMensaje(reservation.id, texto);
      setMessages((prev) => [...prev, nuevo]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setInput(texto);
    } finally {
      setSending(false);
    }
  };

  const c = {
    bg: dark ? colors.darkBg : colors.background,
    surface: dark ? colors.darkCard : colors.surface,
    border: dark ? colors.darkBorder : colors.border,
    text: dark ? colors.textWhite : colors.text,
    muted: dark ? colors.textSilver : colors.textMuted,
    input: dark ? colors.darkCardSubtle : colors.surface,
  };

  if (!reservation?.id) {
    return (
      <View style={[styles.container, { backgroundColor: c.bg }]}>
        <ScreenHeader tone={tone} title="Mensajes" onBack={onBack} />
        <EmptyState
          tone={tone}
          icon="chat"
          title="No tienes una conversación activa"
          message={
            dark
              ? "Elige una reserva desde tus solicitudes para chatear con el arrendatario."
              : "Cuando tengas un arriendo activo o confirmado, podrás coordinar aquí con el dueño."
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ScreenHeader
        tone={tone}
        title={interlocutor}
        subtitle={[auto.marca, auto.modelo, auto.patente].filter(Boolean).join(" · ")}
        onBack={onBack}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.msgs}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={[styles.notice, { backgroundColor: dark ? colors.darkCardSubtle : colors.surfaceSubtle }]}>
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
          messages.map((m) => {
            const mine = m.autor_id === currentUser?.id;
            return (
              <View key={m.id} style={[styles.bubbleWrap, mine ? styles.wrapMine : styles.wrapThem]}>
                <View
                  style={[
                    styles.bubble,
                    mine
                      ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                      : { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: 4 },
                  ]}
                >
                  <Text style={[styles.bubbleText, { color: mine ? "#FFFFFF" : c.text }]}>{m.texto}</Text>
                  <Text style={[styles.time, { color: mine ? "rgba(255,255,255,0.7)" : c.muted }]}>
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.quickWrap, { borderTopColor: c.border }]} contentContainerStyle={styles.quickRow}>
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
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]}
          onPress={handleSend}
          disabled={sending || !input.trim()}
        >
          {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="arrow-right" size={18} color="#FFFFFF" />}
        </TouchableOpacity>
      </View>
    </View>
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
  bubbleText: { fontSize: 14, lineHeight: 19 },
  time: { fontSize: 10, marginTop: 3, textAlign: "right" },
  quickWrap: { borderTopWidth: 1, maxHeight: 46 },
  quickRow: { paddingHorizontal: theme.spacing.screen, paddingVertical: theme.spacing.sm, gap: theme.spacing.sm },
  quickChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: theme.radius.pill, borderWidth: 1 },
  quickText: { fontSize: 12, fontWeight: "500" },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    height: theme.control.heightSm,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: theme.spacing.lg,
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
