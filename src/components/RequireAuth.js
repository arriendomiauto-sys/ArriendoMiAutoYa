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

  if (cargando || !usuario) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--muted)", fontSize: 13 }}>
        {cargando ? "Cargando…" : errorAcceso || "Redirigiendo al ingreso…"}
      </div>
    );
  }

  return children;
}
