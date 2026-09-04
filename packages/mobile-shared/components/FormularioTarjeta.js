import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput } from "react-native";
import { colors } from "../theme/colors";
import { theme } from "../theme/tokens";
import { Icon } from "./Icon";

/**
 * Formulario de tarjeta de crédito.
 *
 * Vive como componente aparte porque se usa en dos lugares: dentro del
 * enrolamiento (la tarjeta se pide junto con el KYC, para que un problema no
 * parta el flujo en dos) y desde el perfil, cuando el usuario quiere
 * cambiarla.
 *
 * El número NUNCA sale del teléfono: se valida acá, se tokeniza, y al backend
 * viajan solo el token, los últimos cuatro dígitos y la marca.
 */

const MARCAS = [
  { id: "visa", nombre: "Visa", patron: /^4/ },
  { id: "mastercard", nombre: "Mastercard", patron: /^(5[1-5]|2[2-7])/ },
  { id: "amex", nombre: "American Express", patron: /^3[47]/ },
  { id: "diners", nombre: "Diners", patron: /^3(0[0-5]|[68])/ },
];

export function detectarMarca(numero) {
  const limpio = (numero || "").replace(/\D/g, "");
  return MARCAS.find((m) => m.patron.test(limpio))?.id || "otra";
}

/**
 * Algoritmo de Luhn: atrapa el dígito mal tecleado antes de mandar nada.
 * Es la misma verificación que hace la pasarela, hecha acá para no gastarle
 * un intento al usuario.
 */
export function numeroTarjetaValido(numero) {
  const limpio = (numero || "").replace(/\D/g, "");
  if (limpio.length < 13 || limpio.length > 19) return false;

  let suma = 0;
  let alternar = false;
  for (let i = limpio.length - 1; i >= 0; i -= 1) {
    let d = parseInt(limpio[i], 10);
    if (alternar) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    alternar = !alternar;
  }
  return suma % 10 === 0;
}

/** Acepta MM/AA y comprueba que no esté vencida. */
export function vencimientoValido(valor, ahora = new Date()) {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec((valor || "").trim());
  if (!m) return false;

  const mes = parseInt(m[1], 10);
  const anio = 2000 + parseInt(m[2], 10);
  if (mes < 1 || mes > 12) return false;

  // Vence al final del mes indicado.
  const finDeMes = new Date(anio, mes, 0, 23, 59, 59);
  return finDeMes >= ahora;
}

export function formatearNumero(valor) {
  const limpio = (valor || "").replace(/\D/g, "").slice(0, 19);
  return limpio.replace(/(.{4})/g, "$1 ").trim();
}

export function formatearVencimiento(valor) {
  const limpio = (valor || "").replace(/\D/g, "").slice(0, 4);
  return limpio.length <= 2 ? limpio : `${limpio.slice(0, 2)}/${limpio.slice(2)}`;
}

/**
 * Datos listos para el backend a partir de lo que se escribió en el formulario.
 *
 * BLOQUE TEMPORAL: mientras no exista la pasarela real, el token se arma acá
 * con una marca reconocible. Cuando se conecte Mercado Pago, esto se reemplaza
 * por la tokenización de la pasarela y el resto del flujo no cambia.
 */
export function tokenizarTarjeta({ numero, nombre }) {
  const limpio = (numero || "").replace(/\D/g, "");
  return {
    tarjeta_token: `SIMULADO-TARJ-${limpio.slice(-4)}-${Date.now().toString(36).toUpperCase()}`,
    tarjeta_ultimos4: limpio.slice(-4),
    tarjeta_marca: detectarMarca(numero),
    tarjeta_titular: (nombre || "").trim() || undefined,
  };
}

/**
 * `nombreTitular`: el nombre verificado del dueño de la cuenta (viene de la
 * cédula). Cuando se pasa, el campo "Nombre del titular" deja de ser un
 * texto libre — por protocolo de seguridad la tarjeta solo puede ser del
 * dueño de la cuenta, así que en vez de pedirle que lo escriba (y arriesgar
 * un typo que la mande a revisión manual sin necesidad) se usa ese nombre
 * directamente y se muestra de solo lectura.
 */
export function FormularioTarjeta({ valor, onChange, errores = {}, onFocus, nombreTitular }) {
  const [tocado, setTocado] = useState({});
  const marca = detectarMarca(valor.numero);
  const nombreMarca = MARCAS.find((m) => m.id === marca)?.nombre;

  useEffect(() => {
    if (nombreTitular && valor.nombre !== nombreTitular) {
      onChange({ ...valor, nombre: nombreTitular });
    }
    // Solo importa reaccionar a que cambie el nombre verificado, no a cada
    // tecla de `valor` — evitaría el ciclo de onChange llamando de vuelta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombreTitular]);

  const set = (campo) => (texto) => onChange({ ...valor, [campo]: texto });
  const marcarTocado = (campo) => () => setTocado((prev) => ({ ...prev, [campo]: true }));
  const errorDe = (campo) => (tocado[campo] || errores.mostrarTodos ? errores[campo] : null);

  return (
    <View style={styles.contenedor}>
      <View style={styles.campo}>
        <View style={styles.etiquetaFila}>
          <Text style={styles.etiqueta}>Número de la tarjeta</Text>
          {nombreMarca ? <Text style={styles.marca}>{nombreMarca}</Text> : null}
        </View>
        <TextInput
          style={[styles.input, errorDe("numero") && styles.inputError]}
          value={valor.numero}
          onChangeText={(t) => set("numero")(formatearNumero(t))}
          onBlur={marcarTocado("numero")}
          onFocus={onFocus}
          placeholder="4242 4242 4242 4242"
          placeholderTextColor={colors.textPlaceholder}
          keyboardType="number-pad"
          autoComplete="cc-number"
          textContentType="creditCardNumber"
          maxLength={23}
        />
        {errorDe("numero") ? (
          <Text style={styles.error} accessibilityRole="alert">
            {errorDe("numero")}
          </Text>
        ) : null}
      </View>

      <View style={styles.fila}>
        <View style={[styles.campo, { flex: 1 }]}>
          <Text style={styles.etiqueta}>Vence</Text>
          <TextInput
            style={[styles.input, errorDe("vencimiento") && styles.inputError]}
            value={valor.vencimiento}
            onChangeText={(t) => set("vencimiento")(formatearVencimiento(t))}
            onBlur={marcarTocado("vencimiento")}
            onFocus={onFocus}
            placeholder="MM/AA"
            placeholderTextColor={colors.textPlaceholder}
            keyboardType="number-pad"
            maxLength={5}
          />
          {errorDe("vencimiento") ? (
            <Text style={styles.error} accessibilityRole="alert">
              {errorDe("vencimiento")}
            </Text>
          ) : null}
        </View>

        <View style={[styles.campo, { flex: 1 }]}>
          <Text style={styles.etiqueta}>Código de seguridad</Text>
          <TextInput
            style={[styles.input, errorDe("cvv") && styles.inputError]}
            value={valor.cvv}
            onChangeText={(t) => set("cvv")(t.replace(/\D/g, "").slice(0, 4))}
            onBlur={marcarTocado("cvv")}
            onFocus={onFocus}
            placeholder="123"
            placeholderTextColor={colors.textPlaceholder}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
          />
          {errorDe("cvv") ? (
            <Text style={styles.error} accessibilityRole="alert">
              {errorDe("cvv")}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Nombre del titular</Text>
        {nombreTitular ? (
          <View style={[styles.input, styles.inputBloqueado]}>
            <Text style={styles.inputBloqueadoTexto}>{nombreTitular}</Text>
          </View>
        ) : (
          <TextInput
            style={styles.input}
            value={valor.nombre}
            onChangeText={set("nombre")}
            onFocus={onFocus}
            placeholder="Como aparece en la tarjeta"
            placeholderTextColor={colors.textPlaceholder}
            autoCapitalize="words"
          />
        )}
        {nombreTitular ? (
          <Text style={styles.ayudaBloqueo}>
            Por seguridad, la tarjeta debe estar a tu propio nombre.
          </Text>
        ) : null}
      </View>

      <View style={styles.nota}>
        <Icon name="shield" size={16} color={colors.accent700} />
        <Text style={styles.notaTexto}>
          No guardamos el número de tu tarjeta. Solo quedan los últimos 4 dígitos para que la
          reconozcas.
        </Text>
      </View>
    </View>
  );
}

/** Errores del formulario. Vacío = listo para enviar. */
export function validarFormularioTarjeta(valor) {
  const e = {};
  if (!valor.numero?.trim()) e.numero = "Ingresa el número de tu tarjeta.";
  else if (!numeroTarjetaValido(valor.numero)) e.numero = "Revisa el número: alguno de los dígitos no cuadra.";

  if (!valor.vencimiento?.trim()) e.vencimiento = "Falta la fecha.";
  else if (!vencimientoValido(valor.vencimiento)) e.vencimiento = "Fecha inválida o vencida.";

  const cvv = (valor.cvv || "").replace(/\D/g, "");
  if (!cvv) e.cvv = "Falta el código.";
  else if (cvv.length < 3) e.cvv = "Son 3 o 4 dígitos.";

  return e;
}

const styles = StyleSheet.create({
  contenedor: { gap: theme.spacing.md },
  campo: { gap: 6 },
  fila: { flexDirection: "row", gap: theme.spacing.md },
  etiquetaFila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  etiqueta: { fontSize: 12, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.4 },
  marca: { fontSize: 12, fontWeight: "700", color: colors.primary },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: theme.radius.field,
    paddingHorizontal: theme.spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  inputBloqueado: { backgroundColor: colors.surfaceSubtle, justifyContent: "center" },
  inputBloqueadoTexto: { fontSize: 15, color: colors.textMuted, fontWeight: "600" },
  ayudaBloqueo: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  error: { fontSize: 12, lineHeight: 17, color: colors.danger },
  nota: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  notaTexto: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
