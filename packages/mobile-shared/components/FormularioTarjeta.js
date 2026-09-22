import React, { useState, useEffect } from "react";
import { View, Text, TextInput } from "react-native";
import { colors } from "../theme/colors";
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

// La tokenización real vive en `api/mercadopago.js` (`crearCardToken`): el
// número va app -> api.mercadopago.com y nunca a nuestro backend.

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
    <View className="gap-4">
      <View className="gap-1.5">
        <View className="flex-row justify-between items-center">
          <Text className="text-xs font-bold text-gray-500 tracking-wider">Número de la tarjeta</Text>
          {nombreMarca ? <Text className="text-xs font-bold text-primary-700">{nombreMarca}</Text> : null}
        </View>
        <TextInput
          className={`h-12 border-[1.5px] rounded-xl px-4 text-[15px] text-gray-900 bg-white ${
            errorDe("numero") ? "border-danger-600" : "border-gray-200"
          }`}
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
          <Text className="text-xs leading-[17px] text-danger-600" accessibilityRole="alert">
            {errorDe("numero")}
          </Text>
        ) : null}
      </View>

      <View className="flex-row gap-4">
        <View className="flex-1 gap-1.5">
          <Text className="text-xs font-bold text-gray-500 tracking-wider">Vence</Text>
          <TextInput
            className={`h-12 border-[1.5px] rounded-xl px-4 text-[15px] text-gray-900 bg-white ${
              errorDe("vencimiento") ? "border-danger-600" : "border-gray-200"
            }`}
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
            <Text className="text-xs leading-[17px] text-danger-600" accessibilityRole="alert">
              {errorDe("vencimiento")}
            </Text>
          ) : null}
        </View>

        <View className="flex-1 gap-1.5">
          <Text className="text-xs font-bold text-gray-500 tracking-wider">Código de seguridad</Text>
          <TextInput
            className={`h-12 border-[1.5px] rounded-xl px-4 text-[15px] text-gray-900 bg-white ${
              errorDe("cvv") ? "border-danger-600" : "border-gray-200"
            }`}
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
            <Text className="text-xs leading-[17px] text-danger-600" accessibilityRole="alert">
              {errorDe("cvv")}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="gap-1.5">
        <Text className="text-xs font-bold text-gray-500 tracking-wider">Nombre del titular</Text>
        {nombreTitular ? (
          <View className="h-12 border-[1.5px] border-gray-200 rounded-xl px-4 bg-gray-50 justify-center">
            <Text className="text-[15px] text-gray-500 font-semibold">{nombreTitular}</Text>
          </View>
        ) : (
          <TextInput
            className="h-12 border-[1.5px] border-gray-200 rounded-xl px-4 text-[15px] text-gray-900 bg-white"
            value={valor.nombre}
            onChangeText={set("nombre")}
            onFocus={onFocus}
            placeholder="Como aparece en la tarjeta"
            placeholderTextColor={colors.textPlaceholder}
            autoCapitalize="words"
          />
        )}
        {nombreTitular ? (
          <Text className="text-xs text-gray-500 mt-0.5">
            Por seguridad, la tarjeta debe estar a tu propio nombre.
          </Text>
        ) : null}
      </View>

      <View className="flex-row items-start gap-2">
        <Icon name="shield" size={16} color={colors.accent700} />
        <Text className="flex-1 text-xs leading-[17px] text-gray-500">
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
