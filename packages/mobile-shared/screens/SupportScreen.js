import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { ScreenHeader, Chip, Button, Card } from "../components/ui";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";

const FAQ = [
  {
    id: "1",
    q: "¿Cómo funciona la cobertura y el deducible de 15 UF?",
    a: "Cada arriendo cuenta con Seguro Full Cobertura. En caso de daño culpable, el deducible de 15 UF (~$562.500) se comparte 50/50 entre el arrendatario y la plataforma. Nunca pagas más de $281.250 de deducible.",
  },
  {
    id: "2",
    q: "¿Cómo se realiza la entrega y devolución?",
    a: "Es 100% digital. El dueño escanea el código QR en tu pantalla y se hace el registro fotográfico obligatorio de 9 imágenes del estado del vehículo y el kilometraje.",
  },
  {
    id: "3",
    q: "¿Cuándo se libera el hold de garantía?",
    a: "Automáticamente tras la inspección de devolución, si el auto vuelve con el mismo combustible y sin daños.",
  },
  {
    id: "4",
    q: "¿Qué hago si tengo una panne o accidente en ruta?",
    a: "Usa Asistencia SOS 24/7 en la app para despachar grúa inmediata, o llama a Carabineros (133).",
  },
];

const TABS = [
  { id: "faq", label: "Preguntas" },
  { id: "bot", label: "Asistente" },
  { id: "ticket", label: "Ticket" },
];

export function SupportScreen({ onBack, variant = "renter" }) {
  const tone = variant === "owner" ? "dark" : "light";
  const dark = tone === "dark";
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState("faq");
  const [openFaq, setOpenFaq] = useState(null);
  const [messages, setMessages] = useState([
    { id: "1", sender: "bot", text: "Hola, soy el asistente de Arrienda Tu Auto. ¿En qué te ayudo con tu arriendo o tu vehículo?" },
  ]);
  const [input, setInput] = useState("");
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);

  const c = {
    bg: dark ? colors.darkBg : colors.background,
    surface: dark ? colors.darkCard : colors.surface,
    border: dark ? colors.darkBorder : colors.border,
    text: dark ? colors.textWhite : colors.text,
    muted: dark ? colors.textSilver : colors.textMuted,
    input: dark ? colors.darkCardSubtle : colors.surface,
  };

  const send = () => {
    if (!input.trim()) return;
    const q = input.toLowerCase();
    setMessages((p) => [...p, { id: String(Date.now()), sender: "user", text: input }]);
    setInput("");
    setTimeout(() => {
      let r = "Derivé tu consulta a nuestro equipo. Un ejecutivo se contactará a la brevedad.";
      if (q.match(/seguro|deducible|15 uf/)) r = "Todos los arriendos incluyen Seguro Full Cobertura con deducible protegido de 15 UF compartido 50/50.";
      else if (q.match(/qr|entrega|retiro/)) r = "Para retirar el auto, muestra tu código QR al dueño. La entrega registra las 9 fotos del checklist.";
      else if (q.match(/limpieza|combustible|bencina/)) r = "El combustible faltante se cobra a $15.000 por cuarto de estanque. El lavado estándar cuesta $15.000.";
      else if (q.match(/sos|grúa|emergencia/)) r = "Para emergencias en ruta, usa 'Asistencia SOS 24/7' o llama al +56 9 8765 4321.";
      setMessages((p) => [...p, { id: String(Date.now() + 1), sender: "bot", text: r }]);
    }, 450);
  };

  const enviarTicket = async () => {
    if (!asunto.trim() || !descripcion.trim()) {
      showAlert("Campos requeridos", "Completa el asunto y la descripción.");
      return;
    }
    setEnviando(true);
    try {
      await ApiClient.crearTicketSoporte(asunto.trim(), descripcion.trim());
      showAlert("Ticket enviado", "Tu requerimiento quedó registrado. Te responderemos por email y notificación.");
      setAsunto("");
      setDescripcion("");
    } catch (err) {
      showAlert("No se pudo enviar", err.message || "Intenta de nuevo en unos segundos.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ScreenHeader tone={tone} title="Centro de ayuda" subtitle="Atención 24/7" onBack={onBack} />

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Chip key={t.id} tone={tone} label={t.label} selected={tab === t.id} onPress={() => setTab(t.id)} />
        ))}
      </View>

      {tab === "faq" && (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {FAQ.map((item) => {
            const open = openFaq === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.faq, { backgroundColor: c.surface, borderColor: c.border }]}
                onPress={() => setOpenFaq(open ? null : item.id)}
                activeOpacity={0.8}
              >
                <View style={styles.faqHead}>
                  <Text style={[styles.faqQ, { color: c.text }]}>{item.q}</Text>
                  <Icon name={open ? "chevron-up" : "chevron-down"} size={16} color={c.muted} />
                </View>
                {open ? <Text style={[styles.faqA, { color: c.muted, borderTopColor: c.border }]}>{item.a}</Text> : null}
              </TouchableOpacity>
            );
          })}

          <Card tone={tone} padded style={{ gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Contacto directo</Text>
            <TouchableOpacity
              style={styles.contactRow}
              onPress={() => showAlert("WhatsApp de soporte", "Abriendo chat con un ejecutivo (+56 9 8765 4321)…")}
            >
              <Icon name="chat" size={16} color={colors.success} />
              <Text style={[styles.contactText, { color: colors.success }]}>WhatsApp · +56 9 8765 4321</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactRow}
              onPress={() => showAlert("Central de emergencias", "Conectando con auxilio en ruta y grúa 24/7…")}
            >
              <Icon name="shield" size={16} color={colors.danger} />
              <Text style={[styles.contactText, { color: colors.danger }]}>Emergencia 24/7 · 600 800 9000</Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      )}

      {tab === "bot" && (
        <View style={styles.botWrap}>
          <ScrollView contentContainerStyle={styles.botMsgs} showsVerticalScrollIndicator={false}>
            {messages.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.bubble,
                  m.sender === "user"
                    ? { backgroundColor: colors.primary, alignSelf: "flex-end", borderBottomRightRadius: 4 }
                    : { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, alignSelf: "flex-start", borderBottomLeftRadius: 4 },
                ]}
              >
                <Text style={[styles.bubbleText, { color: m.sender === "user" ? "#FFFFFF" : c.text }]}>{m.text}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) + 8, borderTopColor: c.border, backgroundColor: c.surface }]}>
            <TextInput
              style={[styles.chatInput, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
              placeholder="Escribe tu consulta…"
              placeholderTextColor={c.muted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={send}>
              <Icon name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {tab === "ticket" && (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Card tone={tone} padded style={{ gap: theme.spacing.md }}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Ingresar un ticket</Text>
            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { color: c.muted }]}>Asunto</Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
                placeholder="ej. Consulta sobre liquidación o garantía"
                placeholderTextColor={c.muted}
                value={asunto}
                onChangeText={setAsunto}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { color: c.muted }]}>Descripción</Text>
              <TextInput
                style={[styles.textarea, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
                placeholder="Explica tu situación con el mayor detalle posible…"
                placeholderTextColor={c.muted}
                value={descripcion}
                onChangeText={setDescripcion}
                multiline
              />
            </View>
            <Button tone={tone} label="Enviar ticket" onPress={enviarTicket} loading={enviando} />
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.screen,
    paddingBottom: theme.spacing.md,
  },
  body: { padding: theme.spacing.screen, gap: theme.spacing.sm, paddingBottom: theme.spacing.xxxl },
  faq: { borderRadius: theme.radius.card, borderWidth: 1, padding: theme.spacing.lg },
  faqHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.md },
  faqQ: { flex: 1, fontSize: 14, fontWeight: "600" },
  faqA: { fontSize: 13, lineHeight: 19, marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTopWidth: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  contactRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  contactText: { fontSize: 14, fontWeight: "600" },
  botWrap: { flex: 1 },
  botMsgs: { padding: theme.spacing.screen, gap: theme.spacing.sm },
  bubble: { maxWidth: "82%", padding: theme.spacing.md, borderRadius: theme.radius.card },
  bubbleText: { fontSize: 14, lineHeight: 19 },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
  },
  chatInput: {
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
  label: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  input: {
    height: theme.control.height,
    borderRadius: theme.radius.field,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  textarea: {
    minHeight: 110,
    borderRadius: theme.radius.field,
    borderWidth: 1.5,
    padding: 16,
    fontSize: 15,
    textAlignVertical: "top",
  },
});
