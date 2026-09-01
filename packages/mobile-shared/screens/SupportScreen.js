import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "../components/Icon";
import { ScreenHeader, Chip, Button, Card, Badge, EmptyState } from "../components/ui";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";

// Canales reales de atención. Se configuran por entorno para no tener que
// tocar el código al cambiar de número; los valores por defecto son los que
// ya mostraba la pantalla.
const WHATSAPP = process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP || "56987654321";
const TELEFONO = process.env.EXPO_PUBLIC_SUPPORT_PHONE || "6008009000";
const WHATSAPP_VISIBLE = "+56 9 8765 4321";
const TELEFONO_VISIBLE = "600 800 9000";

// El centro de ayuda no tiene asistente automático: no hay backend de
// conversación al que conectarlo. En vez de simular respuestas, la pantalla
// resuelve con lo que sí es real — preguntas frecuentes, tickets contra
// /soporte y los canales directos de atención.
const FAQ_RENTER = [
  {
    id: "cobertura",
    q: "¿Cómo funciona la cobertura y el deducible de 15 UF?",
    a: "Cada arriendo cuenta con Seguro Full Cobertura. En caso de daño culpable, el deducible de 15 UF (~$562.500) se comparte 50/50 entre el arrendatario y la plataforma. Nunca pagas más de $281.250 de deducible.",
  },
  {
    id: "entrega",
    q: "¿Cómo se realiza la entrega y devolución?",
    a: "Es 100% digital. El dueño escanea el código QR en tu pantalla y se hace el registro fotográfico obligatorio de 9 imágenes del estado del vehículo y el kilometraje.",
  },
  {
    id: "hold",
    q: "¿Cuándo se libera el hold de garantía?",
    a: "Automáticamente tras la inspección de devolución, si el auto vuelve con el mismo combustible y sin daños.",
  },
  {
    id: "cargos",
    q: "¿Qué cargos extra pueden aplicarse al devolver?",
    a: "Combustible faltante: $15.000 por cuarto de estanque. Lavado estándar: $15.000. Ambos quedan en el detalle del arriendo antes de cobrarse.",
  },
  {
    id: "sos",
    q: "¿Qué hago si tengo una panne o accidente en ruta?",
    a: "Usa Asistencia SOS 24/7 en la app para despachar grúa inmediata, o llama a Carabineros (133).",
  },
];

const FAQ_OWNER = [
  {
    id: "liquidacion",
    q: "¿Cuándo recibo el pago de un arriendo?",
    a: "La liquidación se genera al cerrar la inspección de devolución y se transfiere a la cuenta bancaria registrada en tu perfil. El detalle queda en Ganancias.",
  },
  {
    id: "danos",
    q: "El auto volvió con daños, ¿qué hago?",
    a: "Registra el daño en la inspección de devolución con fotos y abre un reclamo desde Garantías y reclamos. Con eso se retiene la garantía y el caso pasa a evaluación.",
  },
  {
    id: "documentos",
    q: "¿Qué documentos necesita mi auto para publicarse?",
    a: "Permiso de circulación vigente, revisión técnica al día y SOAP. Se verifican antes de que el auto quede visible para arrendar.",
  },
  {
    id: "cobertura-owner",
    q: "¿Mi auto queda cubierto durante el arriendo?",
    a: "Sí. Todo arriendo corre con Seguro Full Cobertura, y el deducible de 15 UF se comparte 50/50 entre el arrendatario y la plataforma — nunca sale de tu bolsillo.",
  },
  {
    id: "cancelar",
    q: "¿Puedo rechazar o cancelar una solicitud?",
    a: "Sí, mientras la reserva no esté entregada. Las cancelaciones reiteradas afectan tu posición en los resultados de búsqueda.",
  },
];

const TABS = [
  { id: "faq", label: "Preguntas" },
  { id: "nuevo", label: "Nuevo ticket" },
  { id: "mis", label: "Mis tickets" },
];

const ESTADO_TICKET = {
  abierto: { label: "Abierto", variant: "info" },
  en_revision: { label: "En revisión", variant: "warning" },
  cerrado: { label: "Cerrado", variant: "success" },
};

function formatearFecha(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

// Abre un canal externo (WhatsApp / teléfono). Si el dispositivo no puede
// manejarlo — web sin app de teléfono, emulador — se muestra el dato para
// contactar a mano, en vez de dejar el botón sin efecto.
async function abrirCanal(url, titulo, datoVisible) {
  try {
    const soportado = await Linking.canOpenURL(url);
    if (!soportado) throw new Error("canal no soportado");
    await Linking.openURL(url);
  } catch {
    showAlert(titulo, `No se pudo abrir la aplicación en este dispositivo. Contáctanos en ${datoVisible}.`);
  }
}

export function SupportScreen({ onBack, variant = "renter" }) {
  const tone = variant === "owner" ? "dark" : "light";
  const dark = tone === "dark";
  const faqs = variant === "owner" ? FAQ_OWNER : FAQ_RENTER;

  const [tab, setTab] = useState("faq");
  const [openFaq, setOpenFaq] = useState(null);

  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [tickets, setTickets] = useState([]);
  const [cargandoTickets, setCargandoTickets] = useState(false);
  const [errorTickets, setErrorTickets] = useState(null);

  const c = {
    bg: dark ? colors.darkBg : colors.background,
    surface: dark ? colors.darkCard : colors.surface,
    border: dark ? colors.darkBorder : colors.border,
    text: dark ? colors.textWhite : colors.text,
    muted: dark ? colors.darkTextMuted : colors.textMuted,
    input: dark ? colors.darkCardSubtle : colors.surface,
  };

  const cargarTickets = useCallback(async () => {
    setCargandoTickets(true);
    setErrorTickets(null);
    try {
      const data = await ApiClient.getMisTicketsSoporte();
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorTickets(err.message || "No se pudieron cargar tus tickets.");
    } finally {
      setCargandoTickets(false);
    }
  }, []);

  // Se traen recién al abrir la pestaña: el centro de ayuda se usa muchas
  // veces solo para leer las preguntas frecuentes.
  useEffect(() => {
    if (tab === "mis") cargarTickets();
  }, [tab, cargarTickets]);

  const enviarTicket = async () => {
    if (!asunto.trim() || !descripcion.trim()) {
      showAlert("Campos requeridos", "Completa el asunto y la descripción.");
      return;
    }
    setEnviando(true);
    try {
      const ticket = await ApiClient.crearTicketSoporte(asunto.trim(), descripcion.trim());
      setAsunto("");
      setDescripcion("");
      // El ticket recién creado se muestra de inmediato en la lista: antes el
      // usuario solo veía una alerta y no le quedaba rastro de su solicitud.
      if (ticket?.id) setTickets((prev) => [ticket, ...prev.filter((t) => t.id !== ticket.id)]);
      setTab("mis");
      showAlert("Ticket enviado", "Tu requerimiento quedó registrado. Te responderemos por email y notificación.");
    } catch (err) {
      showAlert("No se pudo enviar", err.message || "Intenta de nuevo en unos segundos.");
    } finally {
      setEnviando(false);
    }
  };

  const contacto = (
    <Card tone={tone} padded style={{ gap: theme.spacing.md }}>
      <Text style={[styles.cardTitle, { color: c.text }]}>Hablar con una persona</Text>
      <Text style={[styles.cardHint, { color: c.muted }]}>
        No hay asistente automático: te responde el equipo de soporte.
      </Text>
      <TouchableOpacity
        style={styles.contactRow}
        accessibilityRole="button"
        onPress={() => abrirCanal(`https://wa.me/${WHATSAPP}`, "WhatsApp de soporte", WHATSAPP_VISIBLE)}
      >
        <Icon name="chat" size={16} color={colors.success} />
        <Text style={[styles.contactText, { color: colors.success }]}>WhatsApp · {WHATSAPP_VISIBLE}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.contactRow}
        accessibilityRole="button"
        onPress={() => abrirCanal(`tel:${TELEFONO}`, "Central de emergencias", TELEFONO_VISIBLE)}
      >
        <Icon name="shield" size={16} color={colors.danger} />
        <Text style={[styles.contactText, { color: colors.danger }]}>
          Emergencia 24/7 · {TELEFONO_VISIBLE}
        </Text>
      </TouchableOpacity>
    </Card>
  );

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
          {faqs.map((item) => {
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
            <Text style={[styles.cardTitle, { color: c.text }]}>¿No está tu pregunta?</Text>
            <Text style={[styles.cardHint, { color: c.muted }]}>
              Abre un ticket y el equipo de soporte te responde por email y notificación.
            </Text>
            <Button tone={tone} variant="secondary" label="Abrir un ticket" onPress={() => setTab("nuevo")} />
          </Card>

          {contacto}
        </ScrollView>
      )}

      {tab === "nuevo" && (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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

          {contacto}
        </ScrollView>
      )}

      {tab === "mis" && (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={cargandoTickets && tickets.length > 0}
              onRefresh={cargarTickets}
              tintColor={dark ? colors.accent : colors.primary}
            />
          }
        >
          {cargandoTickets && tickets.length === 0 ? (
            <ActivityIndicator
              style={{ marginTop: theme.spacing.xxl }}
              color={dark ? colors.accent : colors.primary}
            />
          ) : errorTickets ? (
            <Card tone={tone} padded style={{ gap: theme.spacing.md }}>
              <Text style={[styles.cardTitle, { color: c.text }]}>No pudimos cargar tus tickets</Text>
              <Text style={[styles.cardHint, { color: c.muted }]}>{errorTickets}</Text>
              <Button tone={tone} variant="secondary" label="Reintentar" onPress={cargarTickets} />
            </Card>
          ) : tickets.length === 0 ? (
            <EmptyState
              tone={tone}
              icon="help"
              title="Aún no tienes tickets"
              message="Cuando abras un requerimiento vas a poder seguir su estado acá."
              action="Abrir un ticket"
              onAction={() => setTab("nuevo")}
            />
          ) : (
            tickets.map((t) => {
              const estado = ESTADO_TICKET[t.estado] || { label: t.estado || "—", variant: "neutral" };
              return (
                <Card key={t.id} tone={tone} padded style={{ gap: theme.spacing.sm }}>
                  <View style={styles.ticketHead}>
                    <Text style={[styles.ticketAsunto, { color: c.text }]}>{t.asunto}</Text>
                    <Badge label={estado.label} variant={estado.variant} />
                  </View>
                  <Text style={[styles.ticketDesc, { color: c.muted }]} numberOfLines={4}>
                    {t.descripcion}
                  </Text>
                  <View style={styles.ticketMeta}>
                    <Text style={[styles.ticketFecha, { color: c.muted }]}>{formatearFecha(t.timestamp)}</Text>
                    {t.escalado_a_disputa ? <Badge label="Escalado a disputa" variant="warning" /> : null}
                  </View>
                </Card>
              );
            })
          )}

          {contacto}
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
  cardHint: { fontSize: 13, lineHeight: 19 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  contactText: { fontSize: 14, fontWeight: "600" },
  ticketHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  ticketAsunto: { flex: 1, fontSize: 15, fontWeight: "700" },
  ticketDesc: { fontSize: 13, lineHeight: 19 },
  ticketMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  ticketFecha: { fontSize: 12 },
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
