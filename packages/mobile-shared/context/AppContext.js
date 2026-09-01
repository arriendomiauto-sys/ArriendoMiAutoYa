import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiClient, MOCK_CARS } from "../api/client";
import { supabase } from "../api/supabase";

const AppContext = createContext();

// Clave de persistencia del modo activo (arrendatario vs. dueño). La misma
// cuenta puede operar en los dos roles; `mode` decide qué experiencia
// (RenterApp / OwnerApp) se muestra y el usuario alterna entre ellas desde
// su perfil. Se elige por primera vez en el registro.
const MODE_STORAGE_KEY = "@rentacar/mode";
const VALID_MODES = ["renter", "owner"];

// Cuánto se mantiene la pantalla de transición tapando el árbol nuevo. No es
// una espera artificial: RenterApp y OwnerApp son árboles completos distintos
// (tab bar, listas, mapas) y montarlos toma varios frames — sin la tapa se ve
// el cambio de tema claro/oscuro a medio pintar.
const SWITCH_MS = 700;
// Tras iniciar/cerrar sesión el árbol destino también necesita un frame o dos.
const SESSION_SWITCH_MS = 400;

const TITULOS_MODO = {
  renter: { title: "Entrando al modo arrendatario", subtitle: "Cargando tu búsqueda de autos y tus reservas." },
  owner: { title: "Entrando al modo dueño", subtitle: "Cargando tu flota, tus ganancias y tus solicitudes." },
};

/**
 * Contexto de aplicación compartido por toda la app.
 *
 * La app es un solo binario con dos experiencias: arrendatario ("renter") y
 * dueño ("owner"). `mode` indica cuál está activa; `setMode` la cambia y la
 * persiste. No hay cuentas distintas por rol — es la misma sesión de
 * Supabase en ambos modos.
 */
export function AppProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const [mode, setModeState] = useState("renter");

  // Transición activa: { mode, title, subtitle } o null. La consume la app
  // para tapar el cambio de rol o de cuenta con <SwitchingScreen>.
  const [transition, setTransition] = useState(null);
  const transitionTimer = useRef(null);
  // El modo actual también en un ref: setMode necesita compararlo sin
  // recrearse en cada cambio (lo consumen callbacks memorizados).
  const modeRef = useRef("renter");

  const endTransition = useCallback((delay = SESSION_SWITCH_MS) => {
    clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => setTransition(null), delay);
  }, []);

  useEffect(() => () => clearTimeout(transitionTimer.current), []);

  // Rehidrata el modo elegido en la sesión anterior antes de pintar la app.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(MODE_STORAGE_KEY)
      .then((saved) => {
        if (!alive || !VALID_MODES.includes(saved)) return;
        modeRef.current = saved;
        setModeState(saved);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Cambia de rol. `silent` omite la pantalla de transición (registro y
   * rehidratación, donde no hay una experiencia anterior que reemplazar).
   */
  const setMode = useCallback(
    (next, { silent = false } = {}) => {
      if (!VALID_MODES.includes(next)) return;
      const cambia = modeRef.current !== next;
      modeRef.current = next;
      setModeState(next);
      AsyncStorage.setItem(MODE_STORAGE_KEY, next).catch(() => {});

      if (!cambia || silent) return;
      // El modo se aplica ya: el árbol destino monta DEBAJO de la pantalla de
      // transición y aparece completo cuando esta se retira.
      setTransition({ mode: next, ...TITULOS_MODO[next] });
      endTransition(SWITCH_MS);
    },
    [endTransition]
  );

  const [cars, setCars] = useState(MOCK_CARS);
  const [loading, setLoading] = useState(false);
  // Motivo por el que el catálogo no se pudo cargar (o null si todo bien).
  // Lo consume Marketplace para mostrar un error con reintento en vez de
  // una lista vacía que se lee como "no hay autos publicados".
  const [carsError, setCarsError] = useState(null);

  const [reservations, setReservations] = useState([]);
  const [activeReservation, setActiveReservation] = useState(null);

  const [notifications, setNotifications] = useState([]);

  const [paymentMethods, setPaymentMethods] = useState([]);
  const bankAccount = currentUser?.cuenta_bancaria || null;

  const syncProfile = useCallback(async () => {
    try {
      const profile = await ApiClient.getMe();
      setCurrentUser(profile);
    } catch (err) {
      // El usuario existe en Supabase Auth pero aún no completó el
      // enrolamiento (fila en `usuarios` sin RUT/nombre). Las pantallas de
      // KYC se encargan de completarlo llamando a completarEnrolamiento().
      console.warn("[AppContext] No se pudo sincronizar el perfil:", err.message);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedCars = await ApiClient.getAutos();
      setCars(Array.isArray(fetchedCars) ? fetchedCars : []);
      setCarsError(null);
    } catch (err) {
      // getAutos solo tira cuando el servidor respondió con error (sin
      // conexión ya devuelve los autos de demo). Mostrar MOCK_CARS acá haría
      // creer que el catálogo está sano y llevaría a fichas de autos que no
      // existen, así que se vacía la lista y se guarda el motivo.
      setCars([]);
      setCarsError(err?.message || "No pudimos cargar los autos disponibles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setIsLoggedIn(!!session);
      if (session) syncProfile();
      setAuthLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      if (session) {
        syncProfile();
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [syncProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Notificaciones in-app: se traen del backend al iniciar sesión y se
  // refrescan por polling suave mientras la sesión está activa.
  const cargarNotificaciones = useCallback(async () => {
    try {
      const data = await ApiClient.getNotificaciones();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      /* se reintenta en el próximo tick */
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setNotifications([]);
      return;
    }
    cargarNotificaciones();
    // Push: registra el token del dispositivo (best-effort, cachea el intento).
    import("../utils/push")
      .then((m) => m.registrarPushToken(ApiClient))
      .catch(() => {});
    const t = setInterval(cargarNotificaciones, 30000);
    return () => clearInterval(t);
  }, [isLoggedIn, cargarNotificaciones]);

  const register = async (email, password, preferredMode) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // El rol elegido en el registro fija el modo con el que arranca la app.
    if (VALID_MODES.includes(preferredMode)) setMode(preferredMode, { silent: true });

    // Supabase NO devuelve error si el correo ya tiene una cuenta — por
    // diseño, para no dejar enumerar qué correos están registrados. En vez
    // de eso responde 200 con session=null y, la señal confiable, un
    // user.identities vacío (ver docs de Supabase Auth). Sin este chequeo
    // el flujo caía directo a "confirma tu correo" como si la cuenta fuera
    // nueva — dejaba "crear" la misma cuenta las veces que quisieras, sin
    // avisar nunca que ya existía.
    const yaExistia = !data?.session && (data?.user?.identities?.length ?? 0) === 0;
    if (yaExistia) {
      const err = new Error("User already registered");
      err.code = "already_registered";
      throw err;
    }

    return data;
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Credenciales OK: desde aquí la app va a cambiar de cuenta, así que la
    // transición tapa el salto de AuthFlow a la experiencia del usuario.
    setTransition({
      mode: modeRef.current,
      title: "Entrando a tu cuenta",
      subtitle: "Cargando tu perfil y tus arriendos.",
    });
    try {
      await syncProfile();
    } finally {
      endTransition();
    }
    return data;
  };

  const resetPassword = async (email) => {
    const webUrl = process.env.EXPO_PUBLIC_WEB_URL;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: webUrl ? `${webUrl}/restablecer-contrasena` : undefined,
    });
    if (error) throw error;
  };

  const logout = async () => {
    setTransition({
      mode: modeRef.current,
      title: "Cerrando sesión",
      subtitle: "Saliendo de forma segura de tu cuenta.",
    });
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setActiveReservation(null);
    } finally {
      endTransition();
    }
  };

  const completeEnrolment = async (enrolamientoData) => {
    const profile = await ApiClient.completarEnrolamiento(enrolamientoData);
    setCurrentUser(profile);
    return profile;
  };

  const updateBankAccount = async (cuentaBancaria) => {
    const profile = await ApiClient.actualizarCuentaBancaria(cuentaBancaria);
    setCurrentUser(profile);
    return profile;
  };

  const addReservation = (newRes) => {
    setReservations((prev) => [newRes, ...prev]);
    setActiveReservation(newRes);
  };

  const markNotificationAsRead = (notifId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, leido: true } : n))
    );
    ApiClient.marcarNotificacionLeida(notifId).catch(() => {});
  };

  const clearAllNotifications = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, leido: true })));
    ApiClient.marcarTodasNotificacionesLeidas().catch(() => {});
  };

  const addPaymentMethod = (card) => {
    setPaymentMethods((prev) => [
      ...prev,
      { id: `pm-${Date.now()}`, ...card, es_principal: prev.length === 0 },
    ]);
  };

  const removePaymentMethod = (cardId) => {
    setPaymentMethods((prev) => prev.filter((p) => p.id !== cardId));
  };

  return (
    <AppContext.Provider
      value={{
        isLoggedIn,
        authLoading,
        mode,
        setMode,
        transition,
        login,
        logout,
        register,
        resetPassword,
        completeEnrolment,
        currentUser,
        setCurrentUser,
        syncProfile,
        cars,
        carsError,
        setCars,
        reservations,
        setReservations,
        activeReservation,
        setActiveReservation,
        addReservation,
        bankAccount,
        updateBankAccount,
        paymentMethods,
        addPaymentMethod,
        removePaymentMethod,
        notifications,
        setNotifications,
        cargarNotificaciones,
        markNotificationAsRead,
        clearAllNotifications,
        loading,
        loadData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
