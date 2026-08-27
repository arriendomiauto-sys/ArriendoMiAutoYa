import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { supabase } from "./supabase";
import { fetchApi } from "./api";

/**
 * Protege una página de staff (Admin/Manager): exige sesión de Supabase y
 * que el usuario autenticado tenga alguno de los `rolesPermitidos` en su
 * fila real de `usuarios` (roles_activos), no un check decorativo en el
 * cliente — el backend igual rechaza cada endpoint si el rol no calza.
 * Redirige a /staff-login si no hay sesión o el rol no alcanza.
 */
export function useStaffAuth(rolesPermitidos) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [staffUser, setStaffUser] = useState(null);

  const verificar = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setAuthorized(false);
      setLoading(false);
      router.replace(`/staff-login?next=${encodeURIComponent(router.asPath)}`);
      return;
    }

    try {
      const perfil = await fetchApi("/usuarios/me");
      const roles = perfil.roles_activos || [];
      const tieneAcceso = rolesPermitidos.some((r) => roles.includes(r));
      if (!tieneAcceso) {
        setAuthorized(false);
        setLoading(false);
        router.replace("/staff-login?error=sin_permiso");
        return;
      }
      setStaffUser(perfil);
      setAuthorized(true);
    } catch {
      setAuthorized(false);
      router.replace("/staff-login");
    } finally {
      setLoading(false);
    }
  }, [router, rolesPermitidos]);

  useEffect(() => {
    verificar();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      verificar();
    });
    return () => subscription?.subscription?.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/staff-login");
  };

  return { loading, authorized, staffUser, logout };
}
