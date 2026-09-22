import React, { useRef, useState } from "react";
import { View, PanResponder, Text, TouchableOpacity } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../theme/colors";

/**
 * Pad de firma dibujada con el dedo, en SVG puro (react-native-svg, ya
 * bundleado en Expo Go — no hace falta una librería de captura de pantalla
 * ni un rebuild nativo). Guarda el trazo como un `d` de SVG, no como
 * imagen: es liviano y perfectamente reproducible en el PDF del contrato
 * más adelante si hace falta.
 */
export function SignaturePad({ onChange, height = 180 }) {
  const [trazos, setTrazos] = useState([]); // Array<Array<{x,y}>>
  const trazosRef = useRef([]);
  const trazoActual = useRef([]);

  const emitir = (siguientes) => {
    trazosRef.current = siguientes;
    setTrazos(siguientes);
    const vacio = siguientes.length === 0 || siguientes.every((t) => t.length < 2);
    onChange && onChange(vacio ? null : aPathD(siguientes));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        trazoActual.current = [{ x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY }];
        const siguientes = [...trazosRef.current, trazoActual.current];
        trazosRef.current = siguientes;
        setTrazos(siguientes);
      },
      onPanResponderMove: (evt) => {
        trazoActual.current = [
          ...trazoActual.current,
          { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY },
        ];
        const siguientes = [...trazosRef.current.slice(0, -1), trazoActual.current];
        trazosRef.current = siguientes;
        setTrazos(siguientes);
      },
      onPanResponderRelease: () => {
        const siguientes = [...trazosRef.current.slice(0, -1), trazoActual.current];
        emitir(siguientes);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        const siguientes = [...trazosRef.current.slice(0, -1), trazoActual.current];
        emitir(siguientes);
      },
    })
  ).current;

  const limpiar = () => {
    trazoActual.current = [];
    emitir([]);
  };

  const vacio = trazos.length === 0 || trazos.every((t) => t.length < 2);

  return (
    <View className="gap-2">
      <View
        testID="pad-firma"
        className="border-[1.5px] border-dashed border-gray-300 rounded-xl bg-white overflow-hidden items-center justify-center"
        style={{ height }}
        {...panResponder.panHandlers}
      >
        {vacio && <Text className="text-sm text-gray-400">Firma aquí con el dedo</Text>}
        <Svg className="absolute inset-0">
          {trazos.map(
            (t, i) =>
              t.length > 1 && (
                <Path key={i} d={trazoAPathD(t)} stroke={colors.text} strokeWidth={2.5} fill="none" />
              )
          )}
        </Svg>
      </View>
      <TouchableOpacity onPress={limpiar} className="self-center p-1.5" disabled={vacio}>
        <Text className={`text-[13px] font-semibold ${vacio ? "text-gray-400" : "text-primary-700"}`}>
          Borrar y firmar de nuevo
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function trazoAPathD(trazo) {
  return trazo
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

function aPathD(trazos) {
  return trazos
    .filter((t) => t.length > 1)
    .map(trazoAPathD)
    .join(" ");
}
