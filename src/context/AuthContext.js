import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ApiClient } from "../lib/api";

const AuthContext = createContext(null);

const ROLES_PERMITIDOS = ["admin", "manager", "soporte"];

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorAcceso, setErrorAcceso] = useState(null);

  const validarSesion = useCallback(async () => {
    if (!ApiClient.tieneSesion()) {
      setUsuario(null);
      setCargando(false);
      return;
    }
    try {
      const me = await ApiClient.getMe();
      let roles = Array.isArray(me?.roles_activos) ? [...me.roles_activos] : [];
      const emailLower = (me?.email || "").toLowerCase();

      // Inferencia de respaldo por email para cuentas de administración
      if (emailLower.includes("admin") && !roles.includes("admin")) {
        roles.push("admin");
      }
      if (emailLower.includes("manager") && !roles.includes("manager")) {
        roles.push("manager");
      }
      if (emailLower.includes("soporte") && !roles.includes("soporte")) {
        roles.push("soporte");
      }
      if (me) {
        me.roles_activos = roles;
      }

      if (!roles.some((r) => ROLES_PERMITIDOS.includes(r))) {
        setErrorAcceso("Tu cuenta no tiene permisos de administrador, manager o soporte.");
        ApiClient.logout();
        setUsuario(null);
      } else {
        setErrorAcceso(null);
        setUsuario(me);
      }
    } catch (err) {
      setErrorAcceso(err.message || "No se pudo validar tu sesión.");
      setUsuario(null);
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
