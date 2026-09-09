import * as LocalAuthentication from "expo-local-authentication";

/** Face ID/huella disponible y con algo enrolado en el teléfono. */
export async function hayHardwareBiometrico() {
  try {
    const [tieneHardware, tieneEnrolado] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return !!(tieneHardware && tieneEnrolado);
  } catch {
    return false;
  }
}

/**
 * Confirmación biométrica puntual — Face ID/huella pedida SOLO en momentos de
 * valor legal (firma y confirmación de una reserva). Ya no existe el candado
 * general de la app: la sesión de Supabase basta para el acceso; la biometría
 * queda reservada para autorizar el arriendo de un vehículo.
 *
 * Devuelve `true` si el usuario se autenticó, `false` si canceló o falló, y
 * `true` también cuando el teléfono no tiene biometría enrolada (no se puede
 * exigir lo que el dispositivo no ofrece — el flujo no debe quedar bloqueado).
 */
export async function confirmarBiometria(
  promptMessage = "Confirma tu identidad para firmar la reserva"
) {
  try {
    if (!(await hayHardwareBiometrico())) return true;
    const resultado = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Cancelar",
    });
    return !!resultado.success;
  } catch {
    return false;
  }
}

/**
 * Método biométrico enrolado en el teléfono: `"facial"`, `"huella"` o `null`
 * si no hay ninguno. Lo usa la firma del contrato para etiquetar el método y
 * decidir qué botón mostrar.
 */
export async function tipoBiometriaDisponible() {
  try {
    if (!(await hayHardwareBiometrico())) return null;
    const tipos = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (tipos?.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "facial";
    if (tipos?.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "huella";
    return null;
  } catch {
    return null;
  }
}

/**
 * Prompt biométrico para FIRMAR. A diferencia de `confirmarBiometria`, exige un
 * éxito real: devuelve `false` si el usuario cancela o el teléfono no tiene
 * biometría (ahí el llamador debe ofrecer la firma manuscrita).
 */
export async function autenticarParaFirmar(
  promptMessage = "Confirma tu identidad para firmar el contrato"
) {
  try {
    const resultado = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Cancelar",
    });
    return !!resultado.success;
  } catch {
    return false;
  }
}
