import React, { useState } from "react";
import { useRouter } from "next/router";
import Seo from "../components/Seo";
import { ShieldCheck, LogIn } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { supabase } from "../lib/supabase";

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sinPermiso = router.query.error === "sin_permiso";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Credenciales inválidas. Verifica tu correo y contraseña.");
      setLoading(false);
      return;
    }

    const next = typeof router.query.next === "string" ? router.query.next : "/admin";
    router.push(next);
  };

  return (
    <>
      <Seo title="Acceso Staff" path="/staff-login" noindex />

      <main className="min-h-screen flex items-center justify-center bg-[#061E1F] px-4">
        <div className="w-full max-w-md rounded-3xl border border-[#2FBF9B]/20 bg-[#0E3736] p-8 shadow-2xl space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2FBF9B]/15 border border-[#2FBF9B]/30">
              <ShieldCheck className="h-6 w-6 text-[#2FBF9B]" />
            </div>
            <h1 className="text-xl font-black text-white">Acceso de Staff</h1>
            <p className="text-sm text-slate-400">
              Panel exclusivo para Administradores y Managers de sucursal.
            </p>
          </div>

          {sinPermiso && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-xs text-amber-300">
              Tu cuenta no tiene permisos de Admin o Manager para acceder a ese panel.
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-300">
                Correo
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#061E1F] text-white border-white/10 rounded-xl"
                placeholder="tu@arriendatuauto.cl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-300">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#061E1F] text-white border-white/10 rounded-xl"
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full gap-2 rounded-xl bg-[#2FBF9B] text-[#061E1F] hover:bg-[#28A787] font-bold"
            >
              <LogIn className="h-4 w-4" />
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </div>
      </main>
    </>
  );
}
