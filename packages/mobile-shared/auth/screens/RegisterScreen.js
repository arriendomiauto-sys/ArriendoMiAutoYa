import React from "react";
import { View, Text, ScrollView, StatusBar, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { Button, Field, BackButton } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { BotonesOAuth } from "../../components/BotonesOAuth";
import { AlertaInline } from "../../components/AlertaInline";
import { formatearCelular } from "../register/validaciones";
import {
  useRegistroCuenta,
  PASO_CUENTA,
  PASO_TERMINOS,
  PASO_CODIGO,
  PASO_EXITO,
} from "../register/useRegistroCuenta";
import {
  SegmentosPaso,
  RequisitosContrasena,
  CodigoVerificacion,
  ReenvioCodigo,
  EncabezadoCentrado,
  ResumenCuenta,
  SugerenciaCodigo,
} from "../register/RegistroPiezas";
import { PasoTerminos } from "../register/PasoTerminos";
import { normalizarTelefonoCompleto } from "../../utils/formato";

function Titulo({ titulo, subtitulo }) {
  return (
    <View className="gap-1.5">
      <Text className="text-2xl font-bold text-textDark" style={{ letterSpacing: -0.5 }}>
        {titulo}
      </Text>
      <Text className="text-[13px] leading-[18px] text-textMuted">{subtitulo}</Text>
    </View>
  );
}

/**
 * Registro de la app de arrendatario, en tres pasos cortos (ver
 * `useRegistroCuenta`): tu cuenta, los términos y la verificación del correo.
 * Layout limpio, sin cabecera, igual que su login. No pide RUT ni fecha de
 * nacimiento: se toman de la cédula en la verificación de identidad.
 */
export function RegisterScreen({ onNavigate, role = "renter" }) {
  const r = useRegistroCuenta({ role });
  const { paso, form, loading, codigo } = r;
  const irALogin = () => onNavigate("login");

  if (paso === PASO_EXITO) {
    return (
      <View className="flex-1 bg-background px-5 pt-16 pb-6 gap-5">
        <StatusBar barStyle="dark-content" />
        <EncabezadoCentrado icono="check" titulo="Cuenta creada">
          Hola, {form.nombre.trim()}. Ya puedes buscar autos cerca de ti.
        </EncabezadoCentrado>
        <ResumenCuenta
          filas={[
            { etiqueta: "Correo", valor: form.email.trim() },
            { etiqueta: "Celular", valor: normalizarTelefonoCompleto(form.telefono) },
          ]}
        />
        <View className="flex-grow min-h-[16px]" />
        <Button testID="btn-empezar" label="Empezar" onPress={irALogin} />
      </View>
    );
  }

  const barraDePasos = (
    <>
      <View className="flex-row items-center justify-between">
        {/* Desde el paso 1 no hay retorno: el registro es la raíz del flujo.
            Desde el paso 2 sí, para corregir el correo antes del código. */}
        {paso === PASO_CUENTA ? (
          <View className="w-10 h-10" />
        ) : (
          <BackButton onPress={() => r.volver(irALogin)} />
        )}
        <Text className="text-xs font-semibold text-textMuted">
          Paso {r.numeroDePaso} de {r.totalPasos}
        </Text>
      </View>
      <SegmentosPaso actual={r.numeroDePaso} total={r.totalPasos} />
    </>
  );

  // Los términos se leen en su propia pantalla, con el botón fijo abajo.
  if (paso === PASO_TERMINOS) {
    return (
      <View className="flex-1 bg-background px-5 pt-4 pb-6 gap-4">
        <StatusBar barStyle="dark-content" />
        {barraDePasos}
        <PasoTerminos error={r.errorEnvio}>
          {({ puedeAceptar }) => (
            <Button
              testID="btn-aceptar-terminos"
              label={puedeAceptar ? "Acepto y crear cuenta" : "Lee los dos documentos hasta el final"}
              onPress={r.aceptarYCrear}
              disabled={!puedeAceptar}
              loading={loading}
            />
          )}
        </PasoTerminos>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-5 pt-4 pb-6 gap-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {barraDePasos}

        {paso === PASO_CUENTA ? (
          <>
            <Titulo titulo="Crea tu cuenta" subtitulo="Escribe tu nombre como aparece en tu cédula." />

            {r.avisoCorreoExistente ? (
              <AlertaInline
                testID="aviso-correo-existente"
                titulo="Ese correo ya tiene una cuenta"
                mensaje="¿Eres tú? Inicia sesión o cambia tu contraseña."
              />
            ) : null}

            <View className="flex-row gap-2.5">
              <Field
                testID="input-nombre"
                style={{ flex: 1 }}
                label="Nombre"
                value={form.nombre}
                onChangeText={r.cambiar("nombre")}
                onBlur={r.alSalir("nombre")}
                autoCapitalize="words"
                autoComplete="name-given"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => r.refs.apellidoRef.current?.focus()}
                {...r.campo("nombre")}
              />
              <Field
                testID="input-apellido"
                ref={r.refs.apellidoRef}
                style={{ flex: 1 }}
                label="Apellido"
                value={form.apellido}
                onChangeText={r.cambiar("apellido")}
                onBlur={r.alSalir("apellido")}
                autoCapitalize="words"
                autoComplete="name-family"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => r.refs.emailRef.current?.focus()}
                {...r.campo("apellido")}
              />
            </View>

            <Field
              testID="input-email"
              ref={r.refs.emailRef}
              label="Correo"
              iconLeft="mail"
              placeholder="nombre@correo.cl"
              value={form.email}
              onChangeText={r.cambiar("email")}
              onBlur={r.alSalir("email")}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => r.refs.passwordRef.current?.focus()}
              {...r.campo("email")}
            />

            <View className="gap-2">
              <Field
                testID="input-password"
                ref={r.refs.passwordRef}
                label="Contraseña"
                iconLeft="lock"
                placeholder="••••••••••"
                value={form.password}
                onChangeText={r.cambiar("password")}
                onBlur={r.alSalir("password")}
                secure
                revealIcon
                autoComplete="password-new"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => r.refs.telefonoRef.current?.focus()}
                {...r.campo("password")}
              />
              <RequisitosContrasena contrasena={form.password} />
            </View>

            <Field
              testID="input-telefono"
              ref={r.refs.telefonoRef}
              label="Celular"
              prefix="+56"
              placeholder="9 1234 5678"
              value={form.telefono}
              onChangeText={r.cambiar("telefono")}
              onBlur={r.alSalir("telefono")}
              format={formatearCelular}
              maxLength={11}
              keyboardType="phone-pad"
              autoComplete="tel"
              returnKeyType="next"
              onSubmitEditing={r.continuar}
              {...r.campo("telefono")}
            />

            {/* Código de Colaborador / Invitación */}
            <View className="gap-1.5">
              <Field
                testID="input-codigo-colaborador"
                label="Código de colaborador (opcional)"
                iconLeft="gift"
                placeholder="Ej: ABC12345"
                value={r.codigoReferido}
                onChangeText={(val) => r.setCodigoReferido(val.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <SugerenciaCodigo
                sugerencia={r.sugerenciaCodigo}
                onUsar={r.usarSugerenciaCodigo}
                onDescartar={r.descartarSugerenciaCodigo}
              />
              {r.codigoDetectadoAutomaticamente ? (
                <View className="flex-row items-center gap-1.5 px-1">
                  <Icon name="check" size={13} color="#10B981" strokeWidth={2.5} />
                  <Text className="text-[11.5px] text-emerald-700 font-medium">
                    Código de colaborador detectado del enlace
                  </Text>
                </View>
              ) : (
                <Text className="text-[11.5px] text-textMuted px-1">
                  ¿Te invitó un colaborador? Ingresa su código para beneficios de bienvenida.
                </Text>
              )}
            </View>

            <View className="flex-grow min-h-[8px]" />
            <Button testID="btn-continuar" label="Continuar" onPress={r.continuar} />

            {r.avisoCorreoExistente ? (
              <Button testID="btn-ir-login" variant="outline" size="sm" label="Ir a iniciar sesión" onPress={irALogin} />
            ) : (
              <>
                <BotonesOAuth preferredMode={role} compact titulo="o regístrate con" />
                <TouchableOpacity
                  className="h-10 items-center justify-center"
                  onPress={irALogin}
                  activeOpacity={0.7}
                >
                  <Text className="text-[13.5px] text-textMuted">
                    ¿Ya tienes cuenta? <Text className="font-bold text-accent-700">Entrar</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </>
        ) : null}

        {paso === PASO_CODIGO ? (
          <>
            <EncabezadoCentrado icono="mail" titulo="Revisa tu correo">
              Enviamos un código de 6 dígitos a{"\n"}
              <Text className="font-semibold text-textDark">{form.email.trim()}</Text>
            </EncabezadoCentrado>

            <CodigoVerificacion
              digitos={codigo.digitos}
              inputRef={codigo.inputRef}
              error={codigo.error}
              onCambiar={codigo.cambiarCodigo}
            />

            <View className="flex-grow min-h-[8px]" />
            <Button testID="btn-verificar" label="Verificar" onPress={codigo.verificar} loading={loading} />
            <ReenvioCodigo segundos={codigo.tiempoReenvio} deshabilitado={loading} onReenviar={codigo.reenviar} />
            <TouchableOpacity className="h-10 items-center justify-center" onPress={r.irACuenta} activeOpacity={0.7}>
              <Text className="text-[13.5px] text-textMuted">
                ¿Correo equivocado? <Text className="font-bold text-accent-700">Cambiarlo</Text>
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
