import React, { useState } from "react";
import { View, Text, ScrollView, StatusBar, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import {
  useRegistroCuenta,
  PASO_CUENTA,
  PASO_CODIGO,
  PASO_EXITO,
  SegmentosPaso,
  RequisitosContrasena,
  CodigoVerificacion,
  ReenvioCodigo,
  EncabezadoCentrado,
  ResumenCuenta,
  formatearCelular,
  BotonesOAuth,
  AlertaInline,
  normalizarTelefonoCompleto,
  LegalModal,
  Icon,
} from "@rentacar/mobile-shared";
import { OwnerAuthHero } from "./OwnerAuthHero";
import { OwnerGradientButton } from "./OwnerGradientButton";
import { OwnerField } from "./OwnerField";

function Titulo({ titulo, subtitulo }) {
  return (
    <View className="gap-1">
      <Text className="text-[21px] font-bold text-textDark tracking-tight">
        {titulo}
      </Text>
      <Text className="text-[13px] leading-[18px] text-textMuted">{subtitulo}</Text>
    </View>
  );
}

/**
 * Registro de la app de Dueño en 2 pasos:
 * 1. Datos de cuenta + Aceptación obligatoria de términos y condiciones.
 * 2. Verificación del código de 6 dígitos enviado por correo.
 * 100% NativeWind, sin RUT ni fecha de nacimiento (se capturan en verificación KYC posterior).
 */
export function OwnerRegisterScreen({ onNavigate }) {
  const r = useRegistroCuenta({ role: "owner" });
  const { paso, form, loading, codigo } = r;
  const irALogin = () => onNavigate("login");

  // Control de lectura y aceptación de términos obligatoria
  const [modalLegalVisible, setModalLegalVisible] = useState(false);
  const [tipoLegal, setTipoLegal] = useState("terminos");
  const [haRevisadoTerminos, setHaRevisadoTerminos] = useState(false);
  const [terminosAceptados, setTerminosAceptados] = useState(false);
  const [errorTerminos, setErrorTerminos] = useState(null);

  const abrirLegal = (tipo) => {
    setTipoLegal(tipo);
    setModalLegalVisible(true);
    setHaRevisadoTerminos(true);
    if (errorTerminos) setErrorTerminos(null);
  };

  const handleToggleTerminos = () => {
    if (!haRevisadoTerminos) {
      abrirLegal("terminos");
      return;
    }
    setTerminosAceptados((prev) => !prev);
    if (errorTerminos) setErrorTerminos(null);
  };

  const handleContinuarPaso1 = async () => {
    if (!haRevisadoTerminos) {
      setErrorTerminos("Debes abrir y revisar los Términos y Condiciones antes de continuar.");
      abrirLegal("terminos");
      return;
    }
    if (!terminosAceptados) {
      setErrorTerminos("Debes aceptar los Términos y Condiciones para crear tu cuenta de dueño.");
      return;
    }
    setErrorTerminos(null);
    await r.continuar();
  };

  if (paso === PASO_EXITO) {
    return (
      <View className="flex-1 bg-background px-5 pt-12 pb-6 gap-5">
        <StatusBar barStyle="dark-content" />
        <EncabezadoCentrado icono="check" titulo="Cuenta de dueño creada">
          Hola, {form.nombre.trim()}. Desde tu panel podrás publicar tus autos y gestionar tus ganancias.
        </EncabezadoCentrado>
        <ResumenCuenta
          filas={[
            { etiqueta: "Correo", valor: form.email.trim() },
            { etiqueta: "Celular", valor: normalizarTelefonoCompleto(form.telefono) },
          ]}
        />
        <View className="flex-grow min-h-[16px]" />
        <OwnerGradientButton testID="btn-ir-panel" label="Ir a mi panel" onPress={irALogin} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />

      {/* Cabecera superior moderna de Dueño */}
      <OwnerAuthHero
        variant="compact"
        pasoLabel={`Paso ${r.numeroDePaso} de ${r.totalPasos}`}
        onBack={() => r.volver(irALogin)}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-5 pt-3 pb-6 gap-3.5"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Barra de progreso de 2 pasos */}
        <SegmentosPaso actual={r.numeroDePaso} total={r.totalPasos} />

        {/* PASO 1: Datos de la cuenta */}
        {paso === PASO_CUENTA ? (
          <>
            <Titulo
              titulo="Crea tu cuenta de dueño"
              subtitulo="Escribe tu nombre y correo tal como aparecen en tu cédula."
            />

            {r.avisoCorreoExistente ? (
              <AlertaInline
                testID="aviso-correo-existente"
                titulo="Ese correo ya está registrado"
                mensaje="¿Eres tú? Inicia sesión o restablece tu contraseña."
              />
            ) : null}

            {r.errorEnvio ? (
              <AlertaInline
                testID="aviso-error-creacion"
                titulo={r.errorEnvio.titulo}
                mensaje={r.errorEnvio.mensaje}
              />
            ) : null}

            {/* Nombre y Apellido lado a lado */}
            <View className="flex-row gap-2.5">
              <OwnerField
                testID="input-nombre"
                className="flex-1"
                label="Nombre"
                placeholder="Nombre"
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
              <OwnerField
                testID="input-apellido"
                ref={r.refs.apellidoRef}
                className="flex-1"
                label="Apellido"
                placeholder="Apellido"
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

            {/* Correo */}
            <OwnerField
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

            {/* Contraseña */}
            <View className="gap-1.5">
              <OwnerField
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

            {/* Celular */}
            <OwnerField
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
              returnKeyType="done"
              onSubmitEditing={handleContinuarPaso1}
              {...r.campo("telefono")}
            />

            {/* Caja de Términos y Condiciones */}
            <View className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 gap-2.5">
              <View className="flex-row items-start gap-2.5">
                <TouchableOpacity
                  onPress={handleToggleTerminos}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: terminosAceptados }}
                  className={`w-5 h-5 rounded border mt-0.5 items-center justify-center ${
                    terminosAceptados
                      ? "bg-primary-700 border-primary-700"
                      : "bg-white border-slate-300"
                  }`}
                >
                  {terminosAceptados ? (
                    <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} />
                  ) : null}
                </TouchableOpacity>

                <View className="flex-1">
                  <Text className="text-xs text-textDark leading-[18px]">
                    He leído y acepto los{" "}
                    <Text
                      onPress={() => abrirLegal("terminos")}
                      className="font-bold text-accent-700 underline"
                    >
                      Términos de Servicio
                    </Text>{" "}
                    y la{" "}
                    <Text
                      onPress={() => abrirLegal("privacidad")}
                      className="font-bold text-accent-700 underline"
                    >
                      Política de Privacidad
                    </Text>
                    .
                  </Text>
                  {!haRevisadoTerminos ? (
                    <Text className="text-[11px] text-amber-700 font-medium mt-1">
                      ⚠️ Toca el enlace para leer los términos antes de aceptar.
                    </Text>
                  ) : null}
                </View>
              </View>

              {errorTerminos ? (
                <Text className="text-[11.5px] text-danger-600 font-medium pl-1">
                  {errorTerminos}
                </Text>
              ) : null}
            </View>

            <View className="flex-grow min-h-[4px]" />

            {/* Botón de envío */}
            <OwnerGradientButton
              testID="btn-continuar"
              label="Continuar"
              onPress={handleContinuarPaso1}
              loading={loading}
            />

            {r.avisoCorreoExistente ? (
              <TouchableOpacity
                testID="btn-ir-login"
                onPress={irALogin}
                activeOpacity={0.7}
                accessibilityRole="button"
                className="h-[46px] rounded-full border-[1.5px] border-slate-200 bg-surface items-center justify-center"
              >
                <Text className="text-[13.5px] font-semibold text-primary-700">
                  Ir a iniciar sesión
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <BotonesOAuth preferredMode="owner" compact redondeado titulo="o regístrate con" />
                <TouchableOpacity
                  className="h-9 items-center justify-center"
                  onPress={irALogin}
                  activeOpacity={0.7}
                >
                  <Text className="text-[13px] text-textMuted">
                    ¿Ya tienes cuenta? <Text className="font-bold text-accent-700">Entrar</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </>
        ) : null}

        {/* PASO 2: Verificación OTP del correo */}
        {paso === PASO_CODIGO ? (
          <>
            <EncabezadoCentrado icono="mail" titulo="Revisa tu correo">
              Enviamos un código de 6 dígitos a{"\n"}
              <Text className="font-semibold text-textDark">{form.email.trim()}</Text>
            </EncabezadoCentrado>

            <CodigoVerificacion
              digitos={codigo.digitos}
              casillasRef={codigo.casillasRef}
              error={codigo.error}
              onCambiar={codigo.cambiarDigito}
              onTecla={codigo.teclaDigito}
            />

            <View className="flex-grow min-h-[8px]" />

            <OwnerGradientButton
              testID="btn-verificar"
              label="Verificar y activar cuenta"
              onPress={codigo.verificar}
              loading={loading}
            />

            <ReenvioCodigo
              segundos={codigo.tiempoReenvio}
              deshabilitado={loading}
              onReenviar={codigo.reenviar}
            />

            <TouchableOpacity
              className="h-10 items-center justify-center"
              onPress={r.irACuenta}
              activeOpacity={0.7}
            >
              <Text className="text-[13.5px] text-textMuted">
                ¿Correo equivocado? <Text className="font-bold text-accent-700">Cambiarlo</Text>
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>

      {/* Modal interactivo de lectura de Términos y Privacidad */}
      <LegalModal
        visible={modalLegalVisible}
        doc={tipoLegal}
        onClose={() => setModalLegalVisible(false)}
        onAccept={() => {
          setModalLegalVisible(false);
          setHaRevisadoTerminos(true);
          setTerminosAceptados(true);
          setErrorTerminos(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}
