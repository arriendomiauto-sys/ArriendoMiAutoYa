import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function RequireAuth({ children }) {
  const { cargando, usuario, errorAcceso } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!cargando && !usuario && router.pathname !== "/login") {
      router.replace("/login");
    }
  }, [cargando, usuario, router]);

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Cargando…
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        {errorAcceso || "Redirigiendo al login…"}
      </div>
    );
  }

  return children;
}
