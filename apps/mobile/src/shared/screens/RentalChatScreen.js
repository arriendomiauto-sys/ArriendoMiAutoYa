import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from "react-native";
import { colors } from "../../theme/colors";
import { useApp } from "../../context/AppContext";
import { Icon } from "../components/Icon";

export function RentalChatScreen({ onBack, reservation }) {
  const { mode, currentUser } = useApp();
  const isDriver = mode === "conductor";

  const res = reservation || {
    id: "reserva-demo-1",
    auto: {
      marca: "Toyota",
      modelo: "RAV4 Limited 4x4",
      patente: "BBCL-10",
      ubicacion_base: "Plaza de Armas, Los Ángeles",
    },
    cliente_nombre: "Carlos Mendoza",
    dueno_nombre: "Patricio Morales",
  };

  const interlocutorName = isDriver
    ? res.cliente_nombre || "Carlos Mendoza"
    : res.dueno_nombre || "Patricio Morales";

  const interlocutorAvatar = isDriver
    ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400"
    : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400";

  const [messages, setMessages] = useState([
    {
      id: "1",
      sender: "them",
      text: "Hola, ¿cómo estás? Te espero en la entrada principal de Plaza de Armas (frente a la Catedral) para la entrega.",
      time: "10:14",
    },
    {
      id: "2",
      sender: "me",
      text: "Excelente, voy en camino. Llegaré en 5 minutos con mi carnet y la app lista para el escaneo QR.",
      time: "10:16",
    },
    {
      id: "3",
      sender: "them",
      text: "Perfecto, el auto está limpio y con estanque 4/4 completo. Nos vemos aquí.",
      time: "10:17",
    },
  ]);

  const [inputText, setInputText] = useState("");

  const handleSend = (textToSend = inputText) => {
    if (!textToSend.trim()) return;
    const newMsg = {
      id: String(Date.now()),
      sender: "me",
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, newMsg]);
    setInputText("");

    // Simulated reply after 1s
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: "them",
          text: "Recibido, gracias por confirmar.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }, 1200);
  };

  const quickReplies = [
    "Ya llegué al punto de encuentro",
    "Estoy a 5 minutos del lugar",
    "¿Podrías enviarme la ubicación GPS exacta?",
    "Listo para la entrega del vehículo",
  ];

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
          <Image source={{ uri: interlocutorAvatar }} style={styles.avatar} />
          <View style={{ marginLeft: 10 }}>
            <Text style={[styles.interlocutorName, isDriver ? styles.textWhite : styles.textDark]}>
              {interlocutorName}
            </Text>
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.statusText}>En línea • {res.auto?.marca} {res.auto?.modelo}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.callBtn}
          onPress={() =>
            Alert.alert(
              "Llamada Segura",
              `Conectando llamada cifrada con ${interlocutorName} vía Arrienda Tu Auto...`
            )
          }
        >
          <Icon name="key" size={14} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Mensajes */}
      <ScrollView
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.securityNotice}>
          <Icon name="shield" size={12} color={colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.securityText}>
            Chat cifrado para la coordinación de la reserva {res.id?.toUpperCase() || "RES-88"}
          </Text>
        </View>

        {messages.map((m) => {
          const isMe = m.sender === "me";
          return (
            <View
              key={m.id}
              style={[
                styles.bubbleWrapper,
                isMe ? styles.bubbleWrapperMe : styles.bubbleWrapperThem,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  isMe
                    ? isDriver
                      ? styles.bubbleMeDriver
                      : styles.bubbleMePassenger
                    : isDriver
                    ? styles.bubbleThemDriver
                    : styles.bubbleThemPassenger,
                ]}
              >
                <Text
                  style={[
                    styles.msgText,
                    isMe
                      ? isDriver
                        ? styles.msgTextMeDriver
                        : styles.msgTextMePassenger
                      : isDriver
                      ? styles.msgTextThemDriver
                      : styles.msgTextThemPassenger,
                  ]}
                >
                  {m.text}
                </Text>
                <Text
                  style={[
                    styles.timeText,
                    isMe
                      ? isDriver
                        ? styles.timeTextMeDriver
                        : styles.timeTextMePassenger
                      : styles.timeTextThem,
                  ]}
                >
                  {m.time}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Respuestas Rápidas */}
      <View style={styles.quickRepliesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRepliesScroll}>
          {quickReplies.map((q, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.quickChip, isDriver ? styles.quickChipDriver : styles.quickChipPassenger]}
              onPress={() => handleSend(q)}
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
          onSubmitEditing={() => handleSend()}
        />
        <TouchableOpacity
          style={[styles.sendButton, isDriver ? styles.sendButtonDriver : styles.sendButtonPassenger]}
          onPress={() => handleSend()}
        >
          <Text style={[styles.sendButtonText, isDriver && { color: colors.dark }]}>Enviar</Text>
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
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  interlocutorName: {
    fontSize: 12,
    fontWeight: "800",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 1,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 4,
  },
  statusText: {
    fontSize: 9,
    color: colors.textMuted,
  },
  callBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.accentMuted,
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
