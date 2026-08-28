import React, { useState, useEffect } from "react";
import { KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import Seo from "../components/Seo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { supabase } from "../lib/supabase";

// Página de destino del enlace real que envía
// supabase.auth.resetPasswordForEmail() (ver mobile: AppContext.resetPassword
// + ForgotPasswordScreen). Supabase deja la sesión de recuperación en la URL
// y el cliente JS la procesa solo al cargar la página (detectSessionInUrl
// está en su valor por defecto = true acá, a diferencia del cliente mobile);
// el evento "PASSWORD_RECOVERY" es la señal de que ya se puede llamar a
// updateUser({ password }) de verdad.
function traducirErrorReset(err) {
  const msg = err?.message || "";
  if (/password should be at least/i.test(msg)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/same as the old|different from the old/i.test(msg)) return "La nueva contraseña debe ser distinta a la actual.";
  if (/failed to fetch|network/i.test(msg)) return "No se pudo conectar. Revisa tu conexión a internet.";
  return "No se pudo actualizar la contraseña. Intenta de nuevo.";
}

export default function RestablecerContrasenaPage() {
  // 'verificando' | 'listo' | 'invalido' | 'guardado'
  const [estado, setEstado] = useState("verificando");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setEstado("listo");
    });

    // Si el evento ya se disparó antes de montar el listener, la sesión de
    // recuperación puede estar ahí igual — revisamos por si acaso.
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setEstado((actual) => (actual === "verificando" ? "listo" : actual));
    });

    // El enlace es válido solo unos segundos para procesarse; si tras un rato
    // no llegó el evento, es que el link ya se usó, expiró o no vino de un
    // correo real de recuperación.
    const timeout = setTimeout(() => {
      setEstado((actual) => (actual === "verificando" ? "invalido" : actual));
    }, 4000);

    return () => {
      subscription?.subscription?.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!password || password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setGuardando(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setGuardando(false);

    if (updateError) {
      setError(traducirErrorReset(updateError));
      return;
    }
    setEstado("guardado");
  };

  return (
    <>
      <Seo title="Restablecer Contraseña" path="/restablecer-contrasena" noindex />

      <main className="min-h-screen flex items-center justify-center bg-[#061E1F] px-4">
        <div className="w-full max-w-md rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-8 shadow-2xl space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2FBF9B]/15 border border-[#2FBF9B]/30">
              <KeyRound className="h-6 w-6 text-[#2FBF9B]" />
            </div>
            <h1 className="text-xl font-black text-white">Restablecer Contraseña</h1>
          </div>

          {estado === "verificando" && (
            <p className="text-center text-sm text-slate-400">Verificando tu enlace...</p>
          )}

          {estado === "invalido" && (
            <div className="space-y-4 text-center">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-4 text-amber-300">
                <AlertTriangle className="h-6 w-6" />
                <p className="text-sm">
                  Este enlace ya no es válido — puede haber expirado o ya haberse usado.
                  Vuelve a la app y solicita uno nuevo desde "Olvidé mi contraseña".
                </p>
              </div>
            </div>
          )}

          {estado === "listo" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-center text-sm text-slate-400">
                Define tu nueva contraseña para volver a entrar desde la app.
              </p>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-300">
                  Nueva contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#061E1F] text-white border-white/10 rounded-xl"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-300">
                  Confirmar contraseña
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-[#061E1F] text-white border-white/10 rounded-xl"
                  placeholder="Repite la contraseña"
                />
              </div>

              <Button
                type="submit"
                disabled={guardando}
                className="w-full rounded-xl bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787] font-bold"
              >
                {guardando ? "Guardando..." : "Guardar Nueva Contraseña"}
              </Button>
            </form>
          )}

          {estado === "guardado" && (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2FBF9B]/15 border border-[#2FBF9B]/30">
                <CheckCircle2 className="h-6 w-6 text-[#2FBF9B]" />
              </div>
              <p className="text-sm text-slate-300">
                Tu contraseña fue actualizada. Ya puedes volver a la app e iniciar sesión
                con tu nueva contraseña.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
