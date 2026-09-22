import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { ApiClient } from "../api/client";
import { showAlert } from "../utils/alert";
import { msjError } from "../utils/msjError";

export function AdminPromoterInviteModal({ visible, onClose }) {
  const [cargando, setCargando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [invitaciones, setInvitaciones] = useState([]);
  const [ultimaInvitacion, setUltimaInvitacion] = useState(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (visible) {
      cargarInvitaciones();
    } else {
      setUltimaInvitacion(null);
    }
  }, [visible]);

  const cargarInvitaciones = async () => {
    setCargando(true);
    try {
      const items = await ApiClient.getInvitacionesPromotores();
      setInvitaciones(items || []);
    } catch (err) {
      // Ignora silenciosamente o muestra error si aplica
    } finally {
      setCargando(false);
    }
  };

  const generarCodigo = async () => {
    setGenerando(true);
    try {
      const res = await ApiClient.crearInvitacionPromotor("Invitación desde app móvil");
      setUltimaInvitacion(res);
      await cargarInvitaciones();
    } catch (err) {
      showAlert("Error al generar", msjError(err, "No se pudo crear la invitación."));
    } finally {
      setGenerando(false);
    }
  };

  const copiarLink = async (link) => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const compartir = (inv) => {
    if (!inv) return;
    Share.share({
      message:
        `¡Has sido invitado como Promotor Oficial en Arriendo Mi Auto Ya!\n\n` +
        `Tendrás acceso al panel de colaboradores para invitar a nuevos usuarios y obtener beneficios exclusivos.\n\n` +
        `Usa este enlace de un solo uso para registrarte y activar tu rol:\n${inv.link}\n` +
        `O ingresa el código: ${inv.codigo}`,
    }).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titulo}>Invitar Promotores</Text>
              <Text style={styles.subtitulo}>
                Genera códigos de un solo uso para nombrar nuevos promotores.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.btnCerrar}>
              <Icon name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Botón Acción Principal */}
            <View style={styles.actionCard}>
              <Button
                label={generando ? "Generando código..." : "Generar invitación de Promotor"}
                iconLeft="plus"
                tone="dark"
                onPress={generarCodigo}
                disabled={generando}
              />
              <Text style={styles.actionAviso}>
                Cada enlace es de un solo uso y activará automáticamente el rol de promotor en ambas apps (owner y renter) a la persona invitada.
              </Text>
            </View>

            {/* Código Recién Generado */}
            {ultimaInvitacion ? (
              <View style={styles.nuevaCard}>
                <View style={styles.nuevaHeader}>
                  <Icon name="check-circle" size={16} color="#0F3D3E" />
                  <Text style={styles.nuevaTitulo}>Invitación activa generada</Text>
                </View>
                <Text style={styles.nuevaCodigo}>{ultimaInvitacion.codigo}</Text>
                <Text style={styles.nuevaLink} numberOfLines={1}>{ultimaInvitacion.link}</Text>

                <View style={styles.nuevaBotones}>
                  <TouchableOpacity
                    style={styles.btnSecundario}
                    onPress={() => copiarLink(ultimaInvitacion.link)}
                  >
                    <Icon name={copiado ? "check" : "copy"} size={14} color="#0F3D3E" />
                    <Text style={styles.btnSecundarioTexto}>
                      {copiado ? "Copiado" : "Copiar Link"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnPrimario}
                    onPress={() => compartir(ultimaInvitacion)}
                  >
                    <Icon name="share" size={14} color="#FFFFFF" />
                    <Text style={styles.btnPrimarioTexto}>Compartir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Historial de Invitaciones */}
            <View style={styles.historialSeccion}>
              <Text style={styles.historialTitulo}>Historial de invitaciones a promotores</Text>

              {cargando ? (
                <ActivityIndicator size="small" color="#0F3D3E" style={{ marginVertical: 16 }} />
              ) : invitaciones.length === 0 ? (
                <Text style={styles.historialVacio}>
                  Aún no has generado códigos de promotor.
                </Text>
              ) : (
                invitaciones.map((inv) => (
                  <View key={inv.id || inv.codigo} style={styles.invItem}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.invCodigoRow}>
                        <Text style={styles.invCodigo}>{inv.codigo}</Text>
                        <View
                          style={[
                            styles.invEstadoBadge,
                            inv.usado ? styles.invEstadoUsado : styles.invEstadoActivo,
                          ]}
                        >
                          <Text
                            style={[
                              styles.invEstadoTexto,
                              inv.usado ? styles.invEstadoTextoUsado : styles.invEstadoTextoActivo,
                            ]}
                          >
                            {inv.usado ? "Canjeado" : "Disponible"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.invDetalle}>
                        {inv.usado
                          ? `Usado por ${inv.usado_por_nombre || "Usuario"}`
                          : "Pendiente de registro"}
                      </Text>
                    </View>

                    {!inv.usado ? (
                      <TouchableOpacity
                        style={styles.btnItemCompartir}
                        onPress={() => compartir(inv)}
                      >
                        <Icon name="share" size={16} color="#0F3D3E" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  titulo: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitulo: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  btnCerrar: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  actionCard: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  actionAviso: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
    marginTop: 10,
    textAlign: "center",
  },
  nuevaCard: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  nuevaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  nuevaTitulo: {
    fontSize: 13,
    fontWeight: "700",
    color: "#166534",
  },
  nuevaCodigo: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F3D3E",
    letterSpacing: 2,
    marginBottom: 4,
  },
  nuevaLink: {
    fontSize: 12,
    color: "#166534",
    marginBottom: 12,
  },
  nuevaBotones: {
    flexDirection: "row",
    gap: 10,
  },
  btnSecundario: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#0F3D3E",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  btnSecundarioTexto: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F3D3E",
  },
  btnPrimario: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F3D3E",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  btnPrimarioTexto: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  historialSeccion: {
    marginTop: 8,
    marginBottom: 24,
  },
  historialTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 12,
  },
  historialVacio: {
    fontSize: 13,
    color: "#94A3B8",
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 12,
  },
  invItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  invCodigoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  invCodigo: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 1,
  },
  invEstadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  invEstadoActivo: {
    backgroundColor: "#DCFCE7",
  },
  invEstadoUsado: {
    backgroundColor: "#F1F5F9",
  },
  invEstadoTexto: {
    fontSize: 11,
    fontWeight: "700",
  },
  invEstadoTextoActivo: {
    color: "#166534",
  },
  invEstadoTextoUsado: {
    color: "#64748B",
  },
  invDetalle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
  },
  btnItemCompartir: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },
});
