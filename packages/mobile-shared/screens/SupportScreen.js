import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { colors } from "../theme/colors";
import { Icon } from "../components/Icon";

const FAQ_ITEMS = [
  {
    id: "1",
    pregunta: "¿Cómo funciona la cobertura y deducible de 15 UF?",
    respuesta:
      "Cada arriendo cuenta con Seguro Full Cobertura. En caso de daño culpable, el deducible fijado en 15 UF (~$562.500 CLP) se comparte en partes iguales (50% el arrendatario y 50% la plataforma). El cliente nunca pagará más de $281.250 CLP de deducible.",
  },
  {
    id: "2",
    pregunta: "¿Cómo se realiza la entrega y devolución del auto?",
    respuesta:
      "La entrega física es 100% digital. El dueño escanea el código QR en la pantalla del arrendatario y se realiza el registro fotográfico obligatorio de 9 imágenes del estado exterior, interior y kilometraje del vehículo.",
  },
  {
    id: "3",
    pregunta: "¿Cuándo se libera el hold de garantía?",
    respuesta:
      "La retención temporal (hold) se desbloquea automáticamente tras la inspección de devolución si el auto es devuelto con el mismo combustible y sin daños.",
  },
  {
    id: "4",
    pregunta: "¿Qué hago en caso de panne o accidente en ruta?",
    respuesta:
      "Puedes presionar el botón de Auxilio SOS 24/7 en la aplicación para despachar grúa inmediata o conectar directamente con Carabineros de Chile (133).",
  },
];

export function SupportScreen({ onBack, variant = "renter" }) {
  const isDriver = variant === "owner";

  const [selectedFaq, setSelectedFaq] = useState(null);
  const [activeTab, setActiveTab] = useState("faq"); // 'faq' | 'bot' | 'ticket'

  // Chatbot State
  const [messages, setMessages] = useState([
    {
      id: "1",
      sender: "bot",
      text: "Hola, soy el Asistente Virtual de Arrienda Tu Auto. ¿En qué te puedo ayudar hoy con tu arriendo o vehículo en Los Ángeles?",
    },
  ]);
  const [inputText, setInputText] = useState("");

  // Ticket Form
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMsg = { id: String(Date.now()), sender: "user", text: inputText };
    setMessages((prev) => [...prev, userMsg]);
    const query = inputText.toLowerCase();
    setInputText("");

    setTimeout(() => {
      let botReply =
        "He derivado tu consulta a nuestro equipo de atención en Los Ángeles. Un ejecutivo se contactará contigo a la brevedad.";

      if (query.includes("seguro") || query.includes("deducible") || query.includes("15 uf")) {
        botReply =
          "Todos nuestros arriendos incluyen Seguro Full Cobertura con deducible protegido de 15 UF compartido 50/50 entre la plataforma y el cliente.";
      } else if (query.includes("qr") || query.includes("entrega") || query.includes("retiro")) {
        botReply =
          "Para retirar el auto, muestra tu código QR en la pestaña 'Mi Código' al dueño. La entrega requiere registrar las 9 fotos del checklist.";
      } else if (query.includes("limpieza") || query.includes("combustible") || query.includes("bencina")) {
        botReply =
          "El combustible faltante se cobra a $15.000 CLP por cuarto de estanque. El lavado estándar tiene un costo de $15.000 CLP.";
      } else if (query.includes("sos") || query.includes("grúa") || query.includes("emergencia")) {
        botReply =
          "Para emergencias en ruta, pulsa el botón 'Asistencia SOS 24/7' o llama al +56 9 8765 4321.";
      }

      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 1), sender: "bot", text: botReply },
      ]);
    }, 500);
  };

  const handleSendTicket = () => {
    if (!ticketSubject || !ticketDescription) {
      Alert.alert("Campos Requeridos", "Por favor completa el asunto y la descripción.");
      return;
    }
    Alert.alert(
      "Ticket Creado",
      "Tu requerimiento ha sido registrado con el folio #TK-" + Math.floor(1000 + Math.random() * 9000) + ". Te responderemos por email y notificación."
    );
    setTicketSubject("");
    setTicketDescription("");
  };

  return (
    <View
      style={[styles.container, isDriver ? styles.bgDriver : styles.bgPassenger]}
    >
      {/* Botón Volver */}
      {onBack && (
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text
            style={[
              styles.backBtnText,
              isDriver ? styles.textWhite : styles.textDark,
            ]}
          >
            ← Volver
          </Text>
        </TouchableOpacity>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text
          style={[styles.title, isDriver ? styles.textWhite : styles.textDark]}
        >
          Centro de Ayuda y Asistencia
        </Text>
        <Text
          style={[
            styles.subtitle,
            isDriver ? styles.textSilver : styles.textSecondary,
          ]}
        >
          Atención al cliente 24/7 en Los Ángeles, Región del Biobío
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {[
          { id: "faq", label: "Preguntas Frecuentes" },
          { id: "bot", label: "Asistente Virtual" },
          { id: "ticket", label: "Crear Ticket" },
        ].map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[
              styles.tabBtn,
              activeTab === t.id &&
                (isDriver ? styles.tabBtnActiveDriver : styles.tabBtnActivePassenger),
            ]}
            onPress={() => setActiveTab(t.id)}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === t.id &&
                  (isDriver ? styles.tabBtnTextActiveDriver : styles.tabBtnTextActivePassenger),
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* TAB 1: FAQ */}
      {activeTab === "faq" && (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          {FAQ_ITEMS.map((item) => {
            const isOpen = selectedFaq === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.faqCard,
                  isDriver ? styles.cardDriver : styles.cardPassenger,
                ]}
                onPress={() => setSelectedFaq(isOpen ? null : item.id)}
                activeOpacity={0.8}
              >
                <View style={styles.faqHeader}>
                  <Text
                    style={[
                      styles.faqQuestion,
                      isDriver ? styles.textWhite : styles.textDark,
                    ]}
                  >
                    {item.pregunta}
                  </Text>
                  <Text style={styles.faqToggleText}>{isOpen ? "▲" : "▼"}</Text>
                </View>
                {isOpen && (
                  <Text
                    style={[
                      styles.faqAnswer,
                      isDriver ? styles.textSilver : styles.textSecondary,
                    ]}
                  >
                    {item.respuesta}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Contacto Directo */}
          <View style={[styles.contactCard, isDriver ? styles.cardDriver : styles.cardPassenger]}>
            <Text style={[styles.contactTitle, isDriver ? styles.textWhite : styles.textDark]}>
              Canales de Contacto Directo
            </Text>
            <TouchableOpacity
              style={styles.contactRow}
              onPress={() =>
                Alert.alert(
                  "WhatsApp de Soporte",
                  "Abriendo chat directo con ejecutivo en Los Ángeles (+56 9 8765 4321)..."
                )
              }
            >
              <Icon name="chat" size={15} color={colors.success} style={{ marginRight: 8 }} />
              <Text style={[styles.contactLink, { color: colors.success }]}>
                WhatsApp Directo: +56 9 8765 4321
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactRow}
              onPress={() =>
                Alert.alert(
                  "Central de Emergencias",
                  "Conectando con auxilio en ruta y grúa 24/7..."
                )
              }
            >
              <Icon name="shield" size={15} color={colors.danger} style={{ marginRight: 8 }} />
              <Text style={[styles.contactLink, { color: colors.danger }]}>
                Teléfono de Emergencia 24/7: 600 800 9000
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* TAB 2: CHATBOT */}
      {activeTab === "bot" && (
        <View style={styles.botContainer}>
          <ScrollView style={styles.botMessages} showsVerticalScrollIndicator={false}>
            {messages.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.msgBubble,
                  m.sender === "user" ? styles.msgUser : styles.msgBot,
                ]}
              >
                <Text
                  style={[
                    styles.msgText,
                    m.sender === "user" ? styles.msgTextUser : styles.msgTextBot,
                  ]}
                >
                  {m.text}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.inputBar}>
            <TextInput
              style={[
                styles.chatInput,
                isDriver ? styles.inputDriver : styles.inputPassenger,
              ]}
              placeholder="Escribe tu consulta sobre seguros, QR o arriendos..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
              <Text style={styles.sendBtnText}>Enviar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* TAB 3: TICKET */}
      {activeTab === "ticket" && (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.ticketCard, isDriver ? styles.cardDriver : styles.cardPassenger]}>
            <Text style={[styles.ticketTitle, isDriver ? styles.textWhite : styles.textDark]}>
              Ingresar Ticket de Atención
            </Text>

            <Text style={[styles.inputLabel, isDriver ? styles.textSilver : styles.textSecondary]}>
              Asunto del Requerimiento
            </Text>
            <TextInput
              style={[
                styles.ticketInput,
                isDriver ? styles.inputDriver : styles.inputPassenger,
              ]}
              placeholder="ej. Consulta sobre liquidación o garantía"
              placeholderTextColor={colors.textMuted}
              value={ticketSubject}
              onChangeText={setTicketSubject}
            />

            <Text
              style={[
                styles.inputLabel,
                isDriver ? styles.textSilver : styles.textSecondary,
                { marginTop: 10 },
              ]}
            >
              Descripción Detallada
            </Text>
            <TextInput
              style={[
                styles.ticketTextArea,
                isDriver ? styles.inputDriver : styles.inputPassenger,
              ]}
              placeholder="Explica tu situación con el mayor detalle posible..."
              placeholderTextColor={colors.textMuted}
              value={ticketDescription}
              onChangeText={setTicketDescription}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity style={styles.submitTicketBtn} onPress={handleSendTicket}>
              <Text style={styles.submitTicketBtnText}>Enviar Ticket de Soporte →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  bgPassenger: {
    backgroundColor: colors.lightBg,
  },
  bgDriver: {
    backgroundColor: colors.darkBg,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    backgroundColor: colors.lightSurface,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: colors.lightCardBorder,
  },
  tabBtnActivePassenger: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabBtnActiveDriver: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  tabBtnTextActivePassenger: {
    color: colors.textWhite,
  },
  tabBtnTextActiveDriver: {
    color: colors.dark,
    fontWeight: "900",
  },
  tabContent: {
    flex: 1,
  },
  faqCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  cardPassenger: {
    backgroundColor: colors.lightCard,
    borderColor: colors.lightCardBorder,
  },
  cardDriver: {
    backgroundColor: colors.darkCard,
    borderColor: colors.darkBorder,
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: {
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },
  faqToggleText: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 8,
  },
  faqAnswer: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.lightCardBorder,
  },
  contactCard: {
    borderRadius: 10,
    padding: 14,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
  },
  contactTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 10,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  contactLink: {
    fontSize: 11,
    fontWeight: "700",
  },
  botContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  botMessages: {
    flex: 1,
    marginBottom: 10,
  },
  msgBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  msgUser: {
    backgroundColor: colors.primary,
    alignSelf: "flex-end",
    borderBottomRightRadius: 2,
  },
  msgBot: {
    backgroundColor: colors.lightCard,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: colors.lightCardBorder,
  },
  msgText: {
    fontSize: 12,
    lineHeight: 16,
  },
  msgTextUser: {
    color: colors.textWhite,
  },
  msgTextBot: {
    color: colors.textDark,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
  },
  chatInput: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 12,
    borderWidth: 1,
    marginRight: 6,
  },
  inputPassenger: {
    backgroundColor: colors.lightCard,
    borderColor: colors.lightCardBorder,
    color: colors.textDark,
  },
  inputDriver: {
    backgroundColor: colors.darkCard,
    borderColor: colors.darkBorder,
    color: colors.textWhite,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  sendBtnText: {
    color: colors.textWhite,
    fontWeight: "800",
    fontSize: 11,
  },
  ticketCard: {
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
  },
  ticketTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  ticketInput: {
    height: 42,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 12,
    borderWidth: 1,
  },
  ticketTextArea: {
    height: 90,
    borderRadius: 6,
    padding: 10,
    fontSize: 12,
    borderWidth: 1,
    textAlignVertical: "top",
  },
  submitTicketBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 14,
  },
  submitTicketBtnText: {
    color: colors.textWhite,
    fontWeight: "800",
    fontSize: 12,
  },
  textWhite: { color: colors.textWhite },
  textDark: { color: colors.textDark },
  textSilver: { color: colors.textSilver },
  textSecondary: { color: colors.textSecondary },
});
