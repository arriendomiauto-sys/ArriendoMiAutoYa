import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ApiClient } from "../lib/api";

const AuthContext = createContext(null);

const ROLES_PERMITIDOS = ["admin", "manager"];

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
      const roles = me.roles_activos || [];
      if (!roles.some((r) => ROLES_PERMITIDOS.includes(r))) {
        setErrorAcceso("Tu cuenta no tiene permisos de administrador o manager.");
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

  return (
    <AuthContext.Provider
      value={{ usuario, cargando, errorAcceso, esAdmin, esManager, login, logout }}
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
