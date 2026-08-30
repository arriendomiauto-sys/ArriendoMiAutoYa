import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { ApiClient } from "../lib/api";

const AuthContext = createContext(null);

const ROLES_PERMITIDOS = ["admin", "manager"];

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = cargando
  const [usuario, setUsuario] = useState(null);
  const [errorAcceso, setErrorAcceso] = useState(null);

  const cargarUsuario = useCallback(async (activeSession) => {
    if (!activeSession) {
      setUsuario(null);
      return;
    }
    try {
      const me = await ApiClient.getMe();
      const roles = me.roles_activos || [];
      if (!roles.some((r) => ROLES_PERMITIDOS.includes(r))) {
        setErrorAcceso("Tu cuenta no tiene permisos de administrador o manager.");
        await supabase.auth.signOut();
        setUsuario(null);
        return;
      }
      setErrorAcceso(null);
      setUsuario(me);
    } catch (err) {
      setErrorAcceso(err.message || "No se pudo validar tu sesión.");
      setUsuario(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      cargarUsuario(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      cargarUsuario(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [cargarUsuario]);

  async function login(email, password) {
    setErrorAcceso(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorAcceso(error.message);
      throw error;
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUsuario(null);
  }

  const cargando = session === undefined;
  const esAdmin = (usuario?.roles_activos || []).includes("admin");
  const esManager = (usuario?.roles_activos || []).includes("manager");

  return (
    <AuthContext.Provider
      value={{ session, usuario, cargando, errorAcceso, esAdmin, esManager, login, logout }}
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
