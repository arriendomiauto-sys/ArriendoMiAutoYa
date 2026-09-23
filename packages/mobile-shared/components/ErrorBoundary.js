import React from "react";
import { View, Text, StatusBar } from "react-native";
import { colors } from "../theme/colors";
import { Icon } from "./Icon";
import { Button } from "./ui";

function capturarEnSentry(error, info) {
  try {
    const Sentry = require("@sentry/react-native");
    Sentry.captureException?.(error, { extra: { componentStack: info?.componentStack } });
  } catch (e) {
    // Sentry no inicializado (sin DSN) o no disponible en este binario: no es crítico.
  }
}

/**
 * Red de seguridad para toda la app: sin esto, cualquier excepción no
 * capturada durante un render (un campo con forma inesperada en la
 * respuesta del backend, un `undefined` que se coló, etc.) tumba TODO el
 * árbol de React y deja al usuario con la pantalla en blanco -- sin ninguna
 * forma de recuperarse salvo forzar el cierre de la app.
 *
 * Tiene que ser un componente de clase: `componentDidCatch` y
 * `getDerivedStateFromError` no tienen equivalente en hooks.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
    capturarEnSentry(error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <View className="flex-1 bg-surface justify-between px-8 py-[34px]">
          <StatusBar barStyle="dark-content" />

          <View className="flex-1 items-center justify-center gap-2.5">
            <View className="w-[68px] h-[68px] rounded-full items-center justify-center bg-amber-50 border border-amber-200">
              <Icon name="alert-triangle" size={32} color={colors.warningText} strokeWidth={2} />
            </View>
            <Text className="text-2xl font-bold text-gray-900 mt-1">Algo salió mal</Text>
            <Text className="text-sm text-gray-500 text-center max-w-[280px]">
              Tuvimos un problema inesperado. Puedes intentar de nuevo; si sigue pasando, cierra y
              vuelve a abrir la app.
            </Text>
          </View>

          <Button
            testID="btn-reintentar-error-boundary"
            label="Reintentar"
            onPress={() => this.setState({ error: null })}
          />
        </View>
      );
    }
    return this.props.children;
  }
}
