import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { colors } from "../theme/colors";
import { useApp } from "../context/AppContext";
import { Icon } from "../components/Icon";
import { ApiClient } from "../api/client";

const POLL_MS = 4000;

export function RentalChatScreen({ onBack, reservation, variant = "renter" }) {
  const { currentUser } = useApp();
  const isDriver = variant === "owner";

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const interlocutorLabel = isDriver ? "Arrendatario" : "Dueño del vehículo";
  const auto = reservation?.auto || {};

  const cargar = useCallback(async () => {
    if (!reservation?.id) return;
    try {
      const data = await ApiClient.getMensajes(reservation.id);
      setMessages(data || []);
    } catch {
      // silencioso: el polling reintenta solo
    } finally {
      setLoading(false);
    }
  }, [reservation?.id]);

  useEffect(() => {
    cargar();
    const interval = setInterval(cargar, POLL_MS);
    return () => clearInterval(interval);
  }, [cargar]);

  const handleSend = async () => {
    const texto = inputText.trim();
    if (!texto || !reservation?.id) return;
    setSending(true);
    setInputText("");
    try {
      const nuevo = await ApiClient.enviarMensaje(reservation.id, texto);
      setMessages((prev) => [...prev, nuevo]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setInputText(texto); // devolvemos el texto si falló el envío
    } finally {
      setSending(false);
    }
  };

  const quickReplies = [
    "Ya llegué al punto de encuentro",
    "Estoy a 5 minutos del lugar",
    "¿Podrías enviarme la ubicación exacta?",
    "Listo para la entrega del vehículo",
  ];

  if (!reservation?.id) {
    return (
      <View style={[styles.container, isDriver ? styles.bgDriver : styles.bgPassenger, styles.emptyCenter]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Icon name="arrow-left" size={14} color={isDriver ? colors.textWhite : colors.textDark} style={{ marginRight: 4 }} />
          <Text style={[styles.backBtnText, isDriver ? styles.textWhite : styles.textDark]}>Volver</Text>
        </TouchableOpacity>
        <Icon name="chat" size={32} color={colors.textMuted} style={{ marginTop: 40 }} />
        <Text style={[styles.emptyText, isDriver ? styles.textWhite : styles.textDark]}>
          No tienes una conversación activa
        </Text>
        <Text style={styles.emptySub}>
          {isDriver
            ? "Selecciona una reserva desde tus solicitudes para chatear con el arrendatario."
            : "Cuando tengas un arriendo activo o confirmado, podrás coordinar aquí con el dueño."}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDriver ? styles.bgDriver : styles.bgPassenger]}>
      {/* Header del Chat */}
      <View style={[styles.header, isDriver ? styles.headerDriver : styles.headerPassenger]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Icon name="arrow-left" size={14} color={isDriver ? colors.textWhite : colors.textDark} style={{ marginRight: 4 }} />
          <Text style={[styles.backBtnText, isDriver ? styles.textWhite : styles.textDark]}>
            Volver
          </Text>
        </TouchableOpacity>

        <View style={styles.interlocutorRow}>
          <View style={styles.avatarPlaceholder}>
            <Icon name="user" size={16} color={colors.accent} />
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={[styles.interlocutorName, isDriver ? styles.textWhite : styles.textDark]}>
              {interlocutorLabel}
            </Text>
            <Text style={styles.statusText}>{auto.marca} {auto.modelo} {auto.patente ? `• ${auto.patente}` : ""}</Text>
          </View>
        </View>
      </View>

      {/* Mensajes */}
      <ScrollView
        ref={scrollRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={styles.securityNotice}>
          <Icon name="shield" size={12} color={colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.securityText}>
            Coordinación de la reserva #{reservation.id.slice(0, 8).toUpperCase()}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
        ) : messages.length === 0 ? (
          <Text style={styles.emptyMsgText}>Aún no hay mensajes. Escribe el primero.</Text>
        ) : (
          messages.map((m) => {
            const isMe = m.autor_id === currentUser?.id;
            return (
              <View
                key={m.id}
                style={[styles.bubbleWrapper, isMe ? styles.bubbleWrapperMe : styles.bubbleWrapperThem]}
              >
                <View
                  style={[
                    styles.bubble,
                    isMe ? (isDriver ? styles.bubbleMeDriver : styles.bubbleMePassenger) : (isDriver ? styles.bubbleThemDriver : styles.bubbleThemPassenger),
                  ]}
                >
                  <Text
                    style={[
                      styles.msgText,
                      isMe ? (isDriver ? styles.msgTextMeDriver : styles.msgTextMePassenger) : (isDriver ? styles.msgTextThemDriver : styles.msgTextThemPassenger),
                    ]}
                  >
                    {m.texto}
                  </Text>
                  <Text
                    style={[
                      styles.timeText,
                      isMe ? (isDriver ? styles.timeTextMeDriver : styles.timeTextMePassenger) : styles.timeTextThem,
                    ]}
                  >
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Respuestas Rápidas */}
      <View style={styles.quickRepliesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRepliesScroll}>
          {quickReplies.map((q, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.quickChip, isDriver ? styles.quickChipDriver : styles.quickChipPassenger]}
              onPress={() => setInputText(q)}
            >
              <Text style={[styles.quickChipText, isDriver ? styles.textSilver : styles.textSecondary]}>
                {q}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Barra de Entrada */}
      <View style={[styles.inputBar, isDriver ? styles.inputBarDriver : styles.inputBarPassenger]}>
        <TextInput
          style={[styles.textInput, isDriver ? styles.textInputDriver : styles.textInputPassenger]}
          placeholder="Escribe un mensaje de coordinación..."
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendButton, isDriver ? styles.sendButtonDriver : styles.sendButtonPassenger]}
          onPress={handleSend}
          disabled={sending || !inputText.trim()}
        >
          {sending ? (
            <ActivityIndicator size="small" color={isDriver ? colors.dark : "#FFFFFF"} />
          ) : (
            <Text style={[styles.sendButtonText, isDriver && { color: colors.dark }]}>Enviar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgPassenger: {
    backgroundColor: colors.lightBg,
  },
  bgDriver: {
    backgroundColor: colors.darkBg,
  },
  emptyCenter: {
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
  },
  emptyMsgText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerPassenger: {
    backgroundColor: colors.lightCard,
    borderBottomColor: colors.lightCardBorder,
  },
  headerDriver: {
    backgroundColor: colors.darkCard,
    borderBottomColor: colors.darkBorder,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingRight: 8,
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  interlocutorRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 4,
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentMuted,
  },
  interlocutorName: {
    fontSize: 12,
    fontWeight: "800",
  },
  statusText: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  securityNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.04)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 14,
  },
  securityText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "500",
  },
  bubbleWrapper: {
    marginBottom: 10,
    maxWidth: "80%",
  },
  bubbleWrapperMe: {
    alignSelf: "flex-end",
  },
  bubbleWrapperThem: {
    alignSelf: "flex-start",
  },
  bubble: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  bubbleMePassenger: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 2,
  },
  bubbleMeDriver: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: 2,
  },
  bubbleThemPassenger: {
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightCardBorder,
    borderBottomLeftRadius: 2,
  },
  bubbleThemDriver: {
    backgroundColor: colors.darkCard,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    borderBottomLeftRadius: 2,
  },
  msgText: {
    fontSize: 12,
    lineHeight: 16,
  },
  msgTextMePassenger: {
    color: colors.textWhite,
  },
  msgTextMeDriver: {
    color: colors.dark,
    fontWeight: "600",
  },
  msgTextThemPassenger: {
    color: colors.textDark,
  },
  msgTextThemDriver: {
    color: colors.textWhite,
  },
  timeText: {
    fontSize: 8,
    marginTop: 4,
    textAlign: "right",
  },
  timeTextMePassenger: {
    color: colors.textSilver,
  },
  timeTextMeDriver: {
    color: "rgba(15, 23, 42, 0.6)",
  },
  timeTextThem: {
    color: colors.textMuted,
  },
  quickRepliesContainer: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.lightCardBorder,
  },
  quickRepliesScroll: {
    paddingHorizontal: 16,
  },
  quickChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
  },
  quickChipPassenger: {
    backgroundColor: colors.lightCard,
    borderColor: colors.lightCardBorder,
  },
  quickChipDriver: {
    backgroundColor: colors.darkCard,
    borderColor: colors.darkBorder,
  },
  quickChipText: {
    fontSize: 10,
    fontWeight: "600",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  inputBarPassenger: {
    backgroundColor: colors.lightCard,
    borderTopColor: colors.lightCardBorder,
  },
  inputBarDriver: {
    backgroundColor: colors.darkCard,
    borderTopColor: colors.darkBorder,
  },
  textInput: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  textInputPassenger: {
    backgroundColor: colors.lightSurface,
    borderColor: colors.lightCardBorder,
    color: colors.textDark,
  },
  textInputDriver: {
    backgroundColor: colors.darkCardHover,
    borderColor: colors.darkBorder,
    color: colors.textWhite,
  },
  sendButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    minWidth: 64,
    alignItems: "center",
  },
  sendButtonPassenger: {
    backgroundColor: colors.primary,
  },
  sendButtonDriver: {
    backgroundColor: colors.accent,
  },
  sendButtonText: {
    color: colors.textWhite,
    fontWeight: "800",
    fontSize: 11,
  },
  textWhite: { color: colors.textWhite },
  textDark: { color: colors.textDark },
  textSilver: { color: colors.textSilver },
  textSecondary: { color: colors.textSecondary },
});
