import React, { useState } from "react";
import { View, Text, ScrollView, StatusBar, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import {
  useRegistroCuenta,
  PASO_CUENTA,
  PASO_CODIGO,
  PASO_EXITO,
  SegmentosPaso,
  RequisitosContrasena,
  CodigoVerificacion,
  SugerenciaCodigo,
  ReenvioCodigo,
  EncabezadoCentrado,
  ResumenCuenta,
  formatearCelular,
  BotonesOAuth,
  AlertaInline,
  normalizarTelefonoCompleto,
  LegalModal,
  Icon,
  BackButton,
} from "@rentacar/mobile-shared";
import { OwnerField } from "./OwnerField";

function Titulo({ titulo, subtitulo }) {
  return (
    <View className="gap-1 mb-1">
      <Text className="text-2xl font-bold text-textDark tracking-tight">
        {titulo}
      </Text>
      <Text className="text-[13px] leading-[18px] text-textMuted">{subtitulo}</Text>
    </View>
  );
}

/**
 * Registro minimalista de la app de Dueño en 2 pasos:
 * 1. Datos de cuenta + Aceptación obligatoria de términos y condiciones.
 * 2. Verificación del código de 6 dígitos enviado por correo.
 * Estilo minimalista coherente con el login, 100% NativeWind, sin emojis ni elementos invasivos.
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
    const camposValidos = r.validar();
    if (!camposValidos) return;
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
    await r.aceptarYCrear();
  };

  if (paso === PASO_EXITO) {
    return (
      <View className="flex-1 bg-background px-6 pt-16 pb-8 gap-5">
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
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
        <TouchableOpacity
          testID="btn-ir-panel"
          onPress={irALogin}
          activeOpacity={0.85}
          className="h-[52px] rounded-2xl bg-[#0F3D3E] items-center justify-center shadow-sm"
        >
          <Text className="text-white font-bold text-[15px]">Ir a mi panel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-6 pt-5 pb-8 gap-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Barra superior minimalista */}
        <View className="flex-row items-center justify-between mb-1">
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

        {/* Barra de progreso */}
        <SegmentosPaso actual={r.numeroDePaso} total={r.totalPasos} />

        {/* PASO 1: Datos de la cuenta */}
        {paso === PASO_CUENTA ? (
          <>
            {/* Badge de auto de dueño */}
            <View className="flex-row items-center gap-2 mt-1">
              <View className="w-11 h-11 rounded-2xl bg-[#0F3D3E] items-center justify-center">
                <Icon name="car" size={20} color="#10B981" />
              </View>
              <Text className="text-xs font-bold text-[#0F3D3E] uppercase tracking-wider">Para dueños</Text>
            </View>

            <Titulo
              titulo="Crea tu cuenta de dueño"
              subtitulo="Ingresa tus datos tal como aparecen en tu cédula."
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
            <View className="flex-row gap-3">
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
              returnKeyType="next"
              onSubmitEditing={handleContinuarPaso1}
              {...r.campo("telefono")}
            />

            {/* Código de Colaborador / Invitación */}
            <View className="gap-1.5">
              <OwnerField
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
                  ¿Te invitó un colaborador? Ingresa su código para beneficios mutuos.
                </Text>
              )}
            </View>

            {/* Caja de Términos y Condiciones */}
            <View className="bg-slate-50 border border-slate-200 rounded-2xl p-4 gap-2">
              <View className="flex-row items-start gap-3">
                <TouchableOpacity
                  testID="checkbox-terminos"
                  onPress={handleToggleTerminos}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: terminosAceptados }}
                  className={`w-5 h-5 rounded-md border mt-0.5 items-center justify-center ${
                    terminosAceptados
                      ? "bg-[#0F3D3E] border-[#0F3D3E]"
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
                      className="font-bold text-[#0F3D3E] underline"
                    >
                      Términos de Servicio
                    </Text>{" "}
                    y la{" "}
                    <Text
                      onPress={() => abrirLegal("privacidad")}
                      className="font-bold text-[#0F3D3E] underline"
                    >
                      Política de Privacidad
                    </Text>
                    .
                  </Text>
                  {!haRevisadoTerminos ? (
                    <Text className="text-[11px] text-amber-700 font-medium mt-1">
                      Toca el enlace para leer los términos antes de continuar.
                    </Text>
                  ) : null}
                </View>
              </View>

              {errorTerminos ? (
                <Text className="text-[11.5px] text-red-600 font-medium pl-1">
                  {errorTerminos}
                </Text>
              ) : null}
            </View>

            <View className="flex-grow min-h-[4px]" />

            {/* Botón principal */}
            <TouchableOpacity
              testID="btn-continuar"
              onPress={handleContinuarPaso1}
              disabled={loading}
              activeOpacity={0.85}
              className="h-[52px] rounded-2xl bg-[#0F3D3E] items-center justify-center shadow-sm"
            >
              {loading ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text className="text-white font-bold text-[15px]">Creando cuenta...</Text>
                </View>
              ) : (
                <Text className="text-white font-bold text-[15px]">Continuar</Text>
              )}
            </TouchableOpacity>

            {r.avisoCorreoExistente ? (
              <TouchableOpacity
                testID="btn-ir-login"
                onPress={irALogin}
                activeOpacity={0.7}
                accessibilityRole="button"
                className="h-[52px] rounded-2xl border border-slate-200 bg-white items-center justify-center"
              >
                <Text className="text-[14px] font-semibold text-[#0F3D3E]">
                  Ir a iniciar sesión
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <BotonesOAuth preferredMode="owner" compact titulo="o regístrate con" />
                <TouchableOpacity
                  className="h-10 items-center justify-center"
                  onPress={irALogin}
                  activeOpacity={0.7}
                >
                  <Text className="text-[13.5px] text-textMuted">
                    ¿Ya tienes cuenta? <Text className="font-bold text-[#0F3D3E]">Entrar</Text>
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
              inputRef={codigo.inputRef}
              error={codigo.error}
              onCambiar={codigo.cambiarCodigo}
            />

            <View className="flex-grow min-h-[8px]" />

            <TouchableOpacity
              testID="btn-verificar"
              onPress={codigo.verificar}
              disabled={loading}
              activeOpacity={0.85}
              className="h-[52px] rounded-2xl bg-[#0F3D3E] items-center justify-center shadow-sm"
            >
              {loading ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text className="text-white font-bold text-[15px]">Verificando...</Text>
                </View>
              ) : (
                <Text className="text-white font-bold text-[15px]">Verificar y activar cuenta</Text>
              )}
            </TouchableOpacity>

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
                ¿Correo equivocado? <Text className="font-bold text-[#0F3D3E]">Cambiarlo</Text>
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
