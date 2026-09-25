import React from "react";
import { colors } from "../theme/colors";
import { OnboardingScreen } from "../auth/screens/OnboardingScreen";

// Recorrido guiado YA DENTRO de la app, distinto del onboarding de antes de
// iniciar sesión (ese explica qué es la app; este explica dónde está cada
// cosa una vez adentro, pestaña por pestaña). Reutiliza el mismo componente
// visual (carrusel + botón "Saltar" + puntos), solo cambia el contenido.
const TOUR_RENTER = [
  {
    id: "tour-renter-explorar",
    iconName: "search",
    iconBg: colors.primary100,
    iconColor: colors.primary,
    title: "Encuentra tu próximo auto",
    description:
      "Busca por mapa o por lista, filtra por categoría y revisa disponibilidad en tiempo real.",
    cta: "Continuar",
  },
  {
    id: "tour-renter-arriendos",
    iconName: "calendar",
    iconBg: colors.accentMuted,
    iconColor: colors.accent800,
    title: "Todo tu arriendo, en un solo lugar",
    description:
      "Coordina la entrega, muestra tu código de entrega y revisa el historial de tus viajes en \"Mis Arriendos\".",
    cta: "Continuar",
  },
  {
    id: "tour-renter-mensajes",
    iconName: "chat",
    iconBg: colors.primary100,
    iconColor: colors.primary,
    title: "Coordina directo con el dueño",
    description: "Resuelve dudas, confirma el punto de encuentro y deja todo por escrito en el chat de la reserva.",
    cta: "Continuar",
  },
  {
    id: "tour-renter-perfil",
    iconName: "user",
    iconBg: colors.accentMuted,
    iconColor: colors.accent800,
    title: "Verifica tu identidad una vez",
    description:
      "Sube tu carnet, tu licencia, tus antecedentes y tu hoja de vida, y agrega tu tarjeta desde \"Mi Perfil\". Así ya puedes reservar cuando quieras.",
    cta: "Empezar",
  },
];

const TOUR_OWNER = [
  {
    id: "tour-owner-flota",
    iconName: "car",
    iconBg: colors.primary100,
    iconColor: colors.primary,
    title: "Publica y gestiona tus autos",
    description: "Sube fotos, fija tu tarifa y pausa o activa la disponibilidad de cada vehículo desde \"Mi Flota\".",
    cta: "Continuar",
  },
  {
    id: "tour-owner-solicitudes",
    iconName: "calendar",
    iconBg: colors.accentMuted,
    iconColor: colors.accent800,
    title: "Acepta y entrega arriendos",
    description:
      "Revisa quién quiere arrendar, confirma la reserva y registra la entrega con el checklist fotográfico.",
    cta: "Continuar",
  },
  {
    id: "tour-owner-ganancias",
    iconName: "dollar",
    iconBg: colors.primary100,
    iconColor: colors.primary,
    title: "Sigue tus ingresos de cerca",
    description: "Consulta cuánto generó cada auto y a qué cuenta bancaria se te transfiere el dinero.",
    cta: "Continuar",
  },
  {
    id: "tour-owner-perfil",
    iconName: "user",
    iconBg: colors.accentMuted,
    iconColor: colors.accent800,
    title: "Verifica tu identidad una vez",
    description: "Confirma quién eres desde \"Mi Perfil\" para poder publicar autos y recibir tus pagos sin problemas.",
    cta: "Empezar",
  },
];

/** `role`: "renter" | "owner" -- elige qué recorrido mostrar. */
export function AppTourScreen({ role = "renter", onFinish }) {
  const slides = role === "owner" ? TOUR_OWNER : TOUR_RENTER;
  return <OnboardingScreen slides={slides} onFinish={onFinish} />;
}
