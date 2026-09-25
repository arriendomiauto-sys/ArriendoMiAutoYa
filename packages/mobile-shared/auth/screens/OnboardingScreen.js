import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { colors } from "../../theme/colors";
import { Icon } from "../../components/Icon";
import { Button, BottomBar } from "../../components/ui";
import { CarruselPasos, PuntosPaso } from "../../components/CarruselPasos";

const ONBOARDING_SLIDES = [
  {
    id: "02a",
    iconName: "car",
    iconBg: colors.primary100,
    iconColor: colors.primary,
    title: "El auto del vecino, arrendado en minutos",
    description:
      "Cualquier persona publica su auto y otra lo arrienda por días o semanas. Sin sucursal ni mostrador.",
    cta: "Continuar",
  },
  {
    id: "02b",
    iconName: "shield",
    iconBg: colors.accentMuted,
    iconColor: colors.accent800,
    title: "Nosotros ponemos la confianza",
    description:
      "Verificamos la identidad de las dos partes, retenemos la garantía en tarjeta y generamos el contrato.",
    cta: "Continuar",
  },
  {
    id: "02c",
    iconName: "camera",
    iconBg: colors.primary100,
    iconColor: colors.primary,
    title: "La entrega queda registrada",
    description:
      "Se juntan, sacan ocho fotos del auto, firman en el celular y se pasan las llaves. Todo queda guardado.",
    cta: "Empezar",
  },
];

/**
 * `slides` es sustituible: este mismo componente sirve tanto para la
 * presentación de la app antes de iniciar sesión (`ONBOARDING_SLIDES`, el
 * default) como para el recorrido guiado ya adentro de la app, con otro
 * contenido (ver `AppTourScreen`) -- mismo lenguaje visual, mismo botón de
 * "Saltar" siempre presente salvo en la última pantalla.
 *
 * Las pantallas se pasan deslizando o con el botón; los puntos también llevan
 * a la que se toque.
 */
export function OnboardingScreen({ onFinish, slides = ONBOARDING_SLIDES }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const carruselRef = useRef(null);
  const esUltima = currentSlide >= slides.length - 1;

  const handleNext = () => {
    if (esUltima) onFinish();
    else carruselRef.current?.irA(currentSlide + 1);
  };

  const slide = slides[currentSlide];

  return (
    <View className="flex-1 bg-surface justify-between">
      {/* Top Skip Button */}
      <View className="px-8 pt-2 flex-row justify-end h-10">
        {!esUltima ? (
          <TouchableOpacity onPress={onFinish} className="py-1.5 px-2">
            <Text className="text-sm font-semibold text-accent-700">Saltar</Text>
          </TouchableOpacity>
        ) : (
          <View className="h-9" />
        )}
      </View>

      <CarruselPasos
        ref={carruselRef}
        items={slides}
        indice={currentSlide}
        onCambiarIndice={setCurrentSlide}
        renderItem={({ item }) => (
          <View className="flex-1 px-8 py-4 justify-between gap-8">
            <View className="flex-1 rounded-2xl items-center justify-center" style={{ backgroundColor: item.iconBg }}>
              <Icon name={item.iconName} size={110} color={item.iconColor} />
            </View>

            <View className="gap-4">
              <Text className="text-[28px] leading-[34px] font-bold text-gray-900">{item.title}</Text>
              <Text className="text-base leading-[25px] text-gray-500">{item.description}</Text>
            </View>
          </View>
        )}
      />

      {/* Bottom Controls */}
      <BottomBar bordered={false} className="px-8 bg-transparent gap-5">
        <PuntosPaso total={slides.length} actual={currentSlide} onElegir={(i) => carruselRef.current?.irA(i)} />
        <Button label={slide.cta} onPress={handleNext} />
      </BottomBar>
    </View>
  );
}
