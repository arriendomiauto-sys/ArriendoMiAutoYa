import React, { useState, useEffect } from "react";
import Link from "next/link";
import Seo from "../components/Seo";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { supabase } from "../lib/supabase";
import {
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

export default function RestablecerContrasena() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // 1. Detectar si la URL trae un error explícito de Supabase (ej: enlace expirado)
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      const fullParams = new URLSearchParams(
        hash.startsWith("#") ? hash.substring(1) : search
      );

      const errorDescription = fullParams.get("error_description");
      if (errorDescription) {
        setErrorMsg(
          decodeURIComponent(errorDescription).replace(/\+/g, " ") ||
            "El enlace de recuperación ha expirado o es inválido."
        );
        setVerifying(false);
        return;
      }
    }

    // 2. Escuchar cambios de autenticación (PASSWORD_RECOVERY event de Supabase)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setSessionActive(true);
        setVerifying(false);
        setErrorMsg("");
      }
    });

    // 3. Comprobar si ya existe sesión activa
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session) {
          setSessionActive(true);
        }
      })
      .catch((err) => {
        console.warn("[Restablecer] Error al verificar sesión:", err);
      })
      .finally(() => {
        setVerifying(false);
      });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!password || password.length < 8) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden. Verifícalas e inténtalo nuevamente.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
    } catch (err) {
      console.error("[Restablecer] Error al actualizar clave:", err);
      setErrorMsg(
        err.message ||
          "No fue posible actualizar la contraseña. El enlace puede haber expirado."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Seo
        title="Restablecer Contraseña - Arriendo Mi Auto Ya"
        description="Actualiza tu contraseña de forma segura para acceder a tu cuenta de Arriendo Mi Auto Ya."
        path="/restablecer-contrasena"
        noindex
      />

      <Navbar />

      <main className="min-h-[85vh] bg-white text-brand-ink flex items-center justify-center pt-28 pb-20 relative overflow-hidden">
        {/* Glow de ambientación verde menta */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[360px] bg-brand-teal/10 rounded-full filter blur-[120px] pointer-events-none" />

        <div className="container max-w-lg mx-auto px-4 sm:px-6 relative z-10">
          <div className="bg-white border border-brand-line rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
            {/* Header del formulario */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-tealTint text-brand-tealInk border border-brand-teal/20 mb-2">
                {success ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                ) : (
                  <KeyRound className="w-7 h-7" />
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-brand-ink">
                {success ? "¡Contraseña Actualizada!" : "Nueva Contraseña"}
              </h1>
              <p className="text-xs sm:text-sm text-[#63645f]">
                {success
                  ? "Tu clave se modificó con éxito. Ya puedes ingresar a la app."
                  : "Ingresa tu nueva contraseña para recuperar el acceso a tu cuenta."}
              </p>
            </div>

            {/* Estado de carga inicial */}
            {verifying && !errorMsg && (
              <div className="py-8 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-brand-teal border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-gray-500 font-medium">
                  Validando enlace de recuperación...
                </p>
              </div>
            )}

            {/* Error de enlace inválido o expirado */}
            {!verifying && errorMsg && !sessionActive && !success && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-left flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-800 space-y-1">
                    <p className="font-bold">Enlace no válido o expirado</p>
                    <p className="text-red-700 leading-relaxed">
                      {errorMsg ||
                        "El enlace de recuperación es inválido o ya fue utilizado. Solicita uno nuevo desde la aplicación móvil."}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <Link href="/" className="w-full block">
                    <Button className="w-full rounded-2xl py-5 text-xs font-black bg-brand-teal text-[#04231b] hover:bg-[#12b78d]">
                      Ir al Inicio
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Formulario de restablecimiento */}
            {!verifying && !success && (sessionActive || !errorMsg) && (
              <form onSubmit={handleSubmit} className="space-y-5">
                {errorMsg && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Campo 1: Nueva Contraseña */}
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-brand-ink uppercase tracking-wider block">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      required
                      minLength={8}
                      className="pl-10 pr-10 py-5 rounded-xl border-gray-200 focus:border-brand-teal focus:ring-brand-teal text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Debe contener al menos 8 caracteres.
                  </p>
                </div>

                {/* Campo 2: Confirmar Contraseña */}
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-brand-ink uppercase tracking-wider block">
                    Confirmar nueva contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite tu nueva contraseña"
                      required
                      minLength={8}
                      className="pl-10 pr-10 py-5 rounded-xl border-gray-200 focus:border-brand-teal focus:ring-brand-teal text-sm"
                    />
                  </div>
                </div>

                {/* Botón de Enviar */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl py-6 text-xs font-black bg-brand-teal text-[#04231b] hover:bg-[#12b78d] shadow-lg shadow-brand-teal/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                >
                  {loading ? (
                    <span className="flex items-center gap-2 justify-center">
                      <div className="w-4 h-4 border-2 border-[#04231b] border-t-transparent rounded-full animate-spin" />
                      Actualizando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 justify-center">
                      <span>Guardar Nueva Contraseña</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>
            )}

            {/* Pantalla de Éxito */}
            {success && (
              <div className="space-y-6 pt-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-800 flex gap-3 items-center text-left">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                  <p>
                    Tu clave se actualizó de manera segura. Ya puedes volver a la app de <strong>Arriendo Mi Auto Ya</strong> e iniciar sesión.
                  </p>
                </div>

                <div className="space-y-3">
                  <a
                    href="arriendatuauto://login"
                    className="w-full block"
                  >
                    <Button className="w-full rounded-2xl py-5 text-xs font-black bg-brand-teal text-[#04231b] hover:bg-[#12b78d] shadow-md flex items-center justify-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      <span>Abrir la App Móvil</span>
                    </Button>
                  </a>

                  <Link href="/" className="w-full block">
                    <Button
                      variant="outline"
                      className="w-full rounded-2xl py-5 text-xs font-bold border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      Volver a la Página Principal
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Pie de seguridad */}
          <div className="text-center pt-6 text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Conexión cifrada de extremo a extremo · Arriendo Mi Auto Ya</span>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
