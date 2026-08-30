import { useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, usuario, errorAcceso } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  if (usuario) {
    router.replace("/");
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-tealDark">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lg"
      >
        <h1 className="mb-1 text-lg font-semibold text-brand-tealDark">
          Panel de administrador
        </h1>
        <p className="mb-6 text-sm text-slate-400">ArriendoMiAutoYa — acceso restringido</p>

        <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-mint focus:outline-none"
        />

        <label className="mb-1 block text-xs font-medium text-slate-500">Contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-mint focus:outline-none"
        />

        {(error || errorAcceso) && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
            {error || errorAcceso}
          </div>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-md bg-brand-mint py-2 text-sm font-medium text-brand-tealDark hover:bg-brand-mintHover disabled:opacity-60"
        >
          {cargando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
