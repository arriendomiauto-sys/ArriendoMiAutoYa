import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ApiClient } from "../lib/api";

const AuthContext = createContext(null);

const ROLES_PERMITIDOS = ["admin", "manager", "soporte"];

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorAcceso, setErrorAcceso] = useState(null);

  const validarSesion = useCallback(async () => {
    // No hay localStorage que avisar "tengo sesión": el refresh token vive en
    // una cookie httpOnly (ilegible por JS), así que la única forma correcta
    // de saber si hay sesión al recargar es preguntarle a la API. getMe()
    // dispara el flujo: si el access token en memoria está vacío y la cookie
    // existe, la API responde 401 sin Authorization y request() renueva vía
    // cookie y reintenta automáticamente. Si la cookie no está o expiró,
    // el error sale marcado como UNAUTHORIZED y acá se cae a logout silencioso.
    try {
      const me = await ApiClient.getMe();
      const roles = Array.isArray(me?.roles_activos) ? [...me.roles_activos] : [];

      if (!roles.some((r) => ROLES_PERMITIDOS.includes(r))) {
        setErrorAcceso("Tu cuenta no tiene permisos de administrador, manager o soporte.");
        ApiClient.logout();
        setUsuario(null);
      } else {
        setErrorAcceso(null);
        setUsuario(me);
      }
    } catch (err) {
      setUsuario(null);
      if (err?.code !== "UNAUTHORIZED") {
        setErrorAcceso(err.message || "No se pudo validar tu sesión.");
      } else {
        // Sin sesión válida (cookie ausente/expirada): pantalla de login
        // tranquila, sin un error que asuste al empezar.
        setErrorAcceso(null);
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    validarSesion();
  }, [validarSesion]);

  async function login(email, password) {
    setErrorAcceso(null);
    try {
      await ApiClient.login(email, password);
    } catch (err) {
      setErrorAcceso(err.message);
      throw err;
    }
    await validarSesion();
  }

  function logout() {
    ApiClient.logout();
    setUsuario(null);
  }

  const esAdmin = (usuario?.roles_activos || []).includes("admin");
  const esManager = (usuario?.roles_activos || []).includes("manager");
  const esSoporte = (usuario?.roles_activos || []).includes("soporte");

  return (
    <AuthContext.Provider
      value={{ usuario, cargando, errorAcceso, esAdmin, esManager, esSoporte, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
