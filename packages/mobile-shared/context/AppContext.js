import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiClient } from "../api/client";
import { supabase, vigilarSesionEnPrimerPlano } from "../api/supabase";
import { iniciarSesionConProveedor } from "../utils/oauth";
import { urlWeb } from "../utils/webUrl";
import { limpiarCacheTarjetas } from "../hooks/useTarjetas";
import { esErrorDeRedAuth } from "../utils/authErrors";

// Máximo que se espera a que responda la revisión de la sesión al abrir la app.
const TIMEOUT_SESION_MS = 8000;

const AppContext = createContext();

// Clave de persistencia del modo activo (arrendatario vs. dueño). La misma
// cuenta puede operar en los dos roles; `mode` decide qué experiencia
// (RenterApp / OwnerApp) se muestra y el usuario alterna entre ellas desde
// su perfil. Se elige por primera vez en el registro.
const MODE_STORAGE_KEY = "@rentacar/mode";
const VALID_MODES = ["renter", "owner"];

// Las pantallas de presentación (onboarding) son para explicar la app la
// primera vez. Una vez vistas se marcan acá y no vuelven a aparecer, ni
// siquiera al cerrar sesión: no son parte del login, son material de
// bienvenida.
const ONBOARDING_STORAGE_KEY = "@rentacar/onboarding_visto";

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
export function AppProvider({ children, initialMode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  // Resultado de revisar la sesión guardada al abrir la app: "revisando" |
  // "listo" | "sin_conexion". `sin_conexion` NO es "sin sesión": la revisión no
  // pudo completarse por la red, así que no se sabe si hay sesión y no se debe
  // mandar a la persona al login como si la hubiera perdido.
  const [sesionEstado, setSesionEstado] = useState("revisando");
  const [currentUser, setCurrentUser] = useState(null);

  const [mode, setModeState] = useState(initialMode || "renter");

  // null = todavía no se sabe (se está leyendo del almacenamiento). El flujo
  // de autenticación espera a que deje de ser null para decidir si muestra
  // el onboarding, así no parpadea.
  const [onboardingVisto, setOnboardingVisto] = useState(null);

  // Transición activa: { mode, title, subtitle } o null. La consume la app
  // para tapar el cambio de rol o de cuenta con <SwitchingScreen>.
  const [transition, setTransition] = useState(null);

  // Deep link pendiente por consumir: { tipo, entidadId } o null. Lo produce
  // el listener global de notificaciones push (no hay router/navigate acá,
  // la navegación es manual por estado) y lo consume RenterApp/OwnerApp,
  // el que esté montado según `mode`.
  const [pendingDeepLink, setPendingDeepLink] = useState(null);
  const clearPendingDeepLink = useCallback(() => setPendingDeepLink(null), []);
  const transitionTimer = useRef(null);
  // El modo actual también en un ref: setMode necesita compararlo sin
  // recrearse en cada cambio (lo consumen callbacks memorizados).
  const modeRef = useRef(initialMode || "renter");

  const endTransition = useCallback((delay = SESSION_SWITCH_MS) => {
    clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => setTransition(null), delay);
  }, []);

  useEffect(() => () => clearTimeout(transitionTimer.current), []);

  // Listener global de respuesta a notificaciones push: se registra una sola
  // vez por toda la vida del proceso (deps [] a propósito). Cubre cold start
  // (getLastNotificationResponseAsync, dentro de la función) y warm/background.
  useEffect(() => {
    let dejarDeEscuchar = () => {};
    import("../utils/push")
      .then((m) => {
        dejarDeEscuchar = m.registrarListenerNotificaciones?.((response) => {
          const data = response?.notification?.request?.content?.data;
          if (!data?.tipo) return;
          setPendingDeepLink({ tipo: data.tipo, entidadId: data.entidad_id || null });
        }) || (() => {});
      })
      .catch(() => {});
    return () => dejarDeEscuchar();
  }, []);

  // Rehidrata el modo elegido en la sesión anterior y si ya se vio el
  // onboarding, antes de pintar la app. Si `initialMode` viene fijo (apps
  // separadas mobile-renter/mobile-owner, cada una con un solo rol posible),
  // el modo NUNCA se lee ni se sobreescribe desde el storage — evita que una
  // instalación vieja del binario único deje un valor guardado que no aplica.
  useEffect(() => {
    let alive = true;
    const claves = initialMode ? [ONBOARDING_STORAGE_KEY] : [MODE_STORAGE_KEY, ONBOARDING_STORAGE_KEY];
    AsyncStorage.multiGet(claves)
      .then((pares) => {
        if (!alive) return;
        const guardado = Object.fromEntries(pares);
        if (!initialMode) {
          const modoGuardado = guardado[MODE_STORAGE_KEY];
          if (VALID_MODES.includes(modoGuardado)) {
            modeRef.current = modoGuardado;
            setModeState(modoGuardado);
          }
        }
        setOnboardingVisto(guardado[ONBOARDING_STORAGE_KEY] === "1");
      })
      .catch(() => {
        // Si el almacenamiento falla se muestra el onboarding: es preferible
        // repetirlo a dejar la app trancada esperando una lectura que no llega.
        if (alive) setOnboardingVisto(false);
      });
    return () => {
      alive = false;
    };
  }, [initialMode]);

  /** Marca el onboarding como visto para que no vuelva a aparecer. */
  const marcarOnboardingVisto = useCallback(() => {
    setOnboardingVisto(true);
    AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "1").catch(() => {});
  }, []);

  /**
   * Cambia de rol. `silent` omite la pantalla de transición (registro y
   * rehidratación, donde no hay una experiencia anterior que reemplazar).
   */
  const setMode = useCallback(
    (next, { silent = false } = {}) => {
      // En apps separadas (initialMode fijo), el rol no se conmuta en caliente.
      if (initialMode) return;
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
    [initialMode, endTransition]
  );

  // La primera carga del catálogo parte vacía: el marketplace muestra el
  // skeleton (lista vacía + loading) y un fallo de red deja `carsError` para
  // la tarjeta de reintento — nunca autos de ejemplo.
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  // Motivo por el que el catálogo no se pudo cargar (o null si todo bien).
  // Lo consume Marketplace para mostrar un error con reintento en vez de
  // una lista vacía que se lee como "no hay autos publicados".
  const [carsError, setCarsError] = useState(null);

  const [reservations, setReservations] = useState([]);
  const [activeReservation, setActiveReservation] = useState(null);
  // Espejo de activeReservation legible desde un callback memorizado sin
  // que ese callback tenga que recrearse cada vez que cambia (mismo patrón
  // que modeRef más arriba).
  const activeReservationRef = useRef(null);
  useEffect(() => {
    activeReservationRef.current = activeReservation;
  }, [activeReservation]);

  const [notifications, setNotifications] = useState([]);

  const bankAccount = currentUser?.cuenta_bancaria || null;

  // Última vez que el perfil se sincronizó con éxito (boot, login, KYC o
  // resync por foreground) — la usa el efecto de abajo para no repreguntar
  // /usuarios/me en cada vuelta a primer plano.
  const ultimoSyncPerfilRef = useRef(0);

  const syncProfile = useCallback(async () => {
    try {
      const profile = await ApiClient.getMe();
      setCurrentUser(profile);
      ultimoSyncPerfilRef.current = Date.now();
      // Quienes llaman a syncProfile con `await` (KYC tras volver de Didit,
      // editores de perfil) necesitan el perfil recién sincronizado: el
      // setCurrentUser no actualiza las variables que ya capturaron del hook.
      // Retornarlo hace que `updatedProfile` en useKycFlow deje de ser
      // siempre undefined y el veredicto del webhook se lea de verdad.
      return profile;
    } catch (err) {
      // Un 401 acá es distinto de cualquier otro fallo: `isLoggedIn` se pone
      // en true apenas hay un token guardado y sin vencer localmente, pero
      // eso no confirma que la cuenta siga existiendo — un JWT firmado sigue
      // "vigente" aunque la cuenta se haya borrado en Supabase Auth. Recién
      // acá, contra el backend, se sabe si la cuenta detrás del token es
      // real. Sin este chequeo la sesión quedaba en isLoggedIn=true con
      // currentUser=null para siempre: la app mostraba el dashboard de una
      // cuenta que ya no existe, vacío y roto.
      if (err?.status === 401) {
        await supabase.auth.signOut().catch(() => {});
        setCurrentUser(null);
        setIsLoggedIn(false);
        limpiarCacheTarjetas();
        return;
      }
      // El usuario existe en Supabase Auth pero aún no completó el
      // enrolamiento (fila en `usuarios` sin RUT/nombre). Las pantallas de
      // KYC se encargan de completarlo llamando a completarEnrolamiento().
      console.warn("[AppContext] No se pudo sincronizar el perfil:", err.message);
    }
  }, []);

  // `true` mientras CUALQUIER flujo (login, login social, o el propio
  // listener de abajo reaccionando a un evento de sesión) ya está
  // sincronizando el perfil bajo su propia transición — evita que dos
  // llamadas concurrentes (p. ej. login() Y el evento SIGNED_IN que ese
  // mismo login dispara) arranquen dos transiciones o se pisen una a la
  // otra al terminar.
  const sincronizandoSesionRef = useRef(false);

  /**
   * Unifica "hay un cambio de sesión con currentUser todavía desactualizado"
   * bajo la misma pantalla de transición que ya usan login/logout/cambio de
   * rol. Sin esto, cualquier camino que NO pase por login()/loginConProveedor()
   * explícitos (el registro, o el propio listener onAuthStateChange
   * reaccionando solo) dejaba a RenterApp/OwnerApp montar de inmediato con
   * currentUser=null durante todo el round-trip de GET /usuarios/me —
   * banners de "verifica tu identidad" falsos para gente ya verificada.
   */
  const sincronizarSesionConTransicion = useCallback(async () => {
    if (sincronizandoSesionRef.current) {
      // Ya hay otro flujo cubriendo esto con su propia transición.
      await syncProfile();
      return;
    }
    sincronizandoSesionRef.current = true;
    setTransition({
      mode: modeRef.current,
      title: "Entrando a tu cuenta",
      subtitle: "Cargando tu perfil y tus arriendos.",
      exito: true,
    });
    try {
      await syncProfile();
    } finally {
      sincronizandoSesionRef.current = false;
      endTransition();
    }
  }, [syncProfile, endTransition]);

function precargarImagenes(urls) {
  try {
    const { Image } = require("react-native");
    if (typeof Image?.prefetch === "function" && Array.isArray(urls)) {
      urls.forEach((u) => {
        if (typeof u === "string" && u.startsWith("http")) {
          Image.prefetch(u).catch(() => {});
        }
      });
    }
  } catch {
    // Si prefetch no está disponible o falla, ignora silenciosamente
  }
}

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedCars = await ApiClient.getAutos();
      const lista = Array.isArray(fetchedCars) ? fetchedCars : [];
      setCars(lista);
      setCarsError(null);
      const fotosParaPrecargar = lista.slice(0, 6).map((c) => c.fotos?.[0]).filter(Boolean);
      if (fotosParaPrecargar.length > 0) {
        precargarImagenes(fotosParaPrecargar);
      }
    } catch (err) {
      // getAutos propaga cualquier fallo (de red o del servidor): acá se
      // vacía la lista y se guarda el motivo para que el marketplace muestre
      // la tarjeta de error con reintento, en vez de creer que no hay autos
      // publicados o mostrar un catálogo falso.
      setCars([]);
      setCarsError(err?.message || "No pudimos cargar los autos disponibles.");
    } finally {
      setLoading(false);
    }
  }, []);

  const montadoRef = useRef(true);
  const idTimeoutSesionRef = useRef(null);

  // Revisa la sesión guardada. Se llama al abrir la app y desde
  // `reintentarSesion` (botón "Reintentar" de la pantalla "Sin conexión").
  const revisarSesion = useCallback(async () => {
    setSesionEstado("revisando");
    setAuthLoading(true);

    // Con mala señal, `supabase.auth.getSession()` puede quedar COLGADA en
    // vez de rechazar (intenta refrescar el token contra la red y esa
    // promesa nunca se resuelve ni se rechaza) — el try/catch de abajo no
    // sirve de nada ahí porque nunca dispara. Sin este timeout, ese caso
    // dejaba `authLoading` en true para siempre: la app se quedaba pegada
    // en "Cargando tu sesión" sin ningún error que lo explicara. Si vence,
    // NO se asume que no hay sesión (podría haberla): queda "sin_conexion".
    const seColgo = new Promise((resolve) => {
      idTimeoutSesionRef.current = setTimeout(() => resolve("timeout"), TIMEOUT_SESION_MS);
    });

    try {
      const resultado = await Promise.race([
        supabase.auth.getSession().then(({ data, error }) => ({ data, error })),
        seColgo,
      ]);
      if (!montadoRef.current) return;
      // Cuando el refresco del token falla por la red, supabase-js NO lanza:
      // devuelve `session: null` junto a un `AuthRetryableFetchError`. Leerlo
      // como "sin sesión" mandaba al login a quien sí tenía una.
      if (resultado === "timeout" || esErrorDeRedAuth(resultado.error)) {
        console.warn("[AppContext] No se pudo revisar la sesión por la red; se ofrece reintentar.");
        setSesionEstado("sin_conexion");
        return;
      }
      const haySesion = !!resultado.data?.session;
      setIsLoggedIn(haySesion);
      // Se espera a que termine: si no, `authLoading` bajaba en el mismo
      // tick y el dashboard alcanzaba a pintarse un frame antes de que
      // syncProfile() confirmara (o desmintiera, con un 401) que la cuenta
      // sigue existiendo. Mejor mantener la pantalla de carga hasta saberlo.
      if (haySesion) await syncProfile();
      if (montadoRef.current) setSesionEstado("listo");
    } catch (err) {
      // Sin este catch, cualquier falla leyendo la sesión (almacenamiento
      // corrupto, cliente mal configurado) dejaba authLoading en true para
      // siempre: la app se quedaba pegada en "Cargando tu sesión".
      console.warn("[AppContext] No se pudo recuperar la sesión:", err?.message);
      if (montadoRef.current) {
        setIsLoggedIn(false);
        setSesionEstado("listo");
      }
    } finally {
      clearTimeout(idTimeoutSesionRef.current);
      if (montadoRef.current) setAuthLoading(false);
    }
  }, [syncProfile]);

  useEffect(() => {
    montadoRef.current = true;
    revisarSesion();

    const { data: subscription } = supabase.auth.onAuthStateChange((evento, session) => {
      setIsLoggedIn(!!session);
      if (!session) {
        setCurrentUser(null);
        return;
      }
      // TOKEN_REFRESHED se dispara cada vez que se renueva el token (cada hora
      // aprox.) y no cambia nada del perfil: volver a pedirlo en cada refresco
      // es tráfico y re-render de más.
      //
      // Para el resto de los eventos (SIGNED_IN de un registro, un magic
      // link, o el mismo login() de abajo disparando este mismo evento):
      // sin la transición acá, `isLoggedIn` pasaba a true en este mismo
      // tick y RenterApp/OwnerApp montaban de inmediato con currentUser
      // todavía null durante todo el round-trip de GET /usuarios/me —
      // banners de "verifica tu identidad" falsos para gente ya verificada.
      // No se espera esta llamada (el callback no es async): el guard de
      // `sincronizandoSesionRef` adentro es lo que evita pisar la
      // transición si login()/loginConProveedor() ya están cubriendo esto.
      if (evento !== "TOKEN_REFRESHED") sincronizarSesionConTransicion();
    });

    // Mantiene el token vivo mientras la app está en primer plano.
    const dejarDeVigilar = vigilarSesionEnPrimerPlano();

    return () => {
      montadoRef.current = false;
      clearTimeout(idTimeoutSesionRef.current);
      subscription?.subscription?.unsubscribe();
      dejarDeVigilar();
    };
  }, [revisarSesion, sincronizarSesionConTransicion]);

  // Si un admin cambia el rol/KYC/perfil de este usuario mientras ya está
  // adentro de la app, syncProfile se ejecuta silenciosamente (sin modales ni
  // interrupciones) al volver a primer plano o periódicamente cada 25s,
  // manteniendo currentUser y el estado de la app siempre sincronizado.
  const INTERVALO_RESYNC_PERFIL_MS = 5 * 1000;
  useEffect(() => {
    let estadoPrevio = AppState.currentState;
    const sub = AppState.addEventListener("change", (nuevoEstado) => {
      const volvioAPrimerPlano =
        (estadoPrevio === "background" || estadoPrevio === "inactive") &&
        nuevoEstado === "active";
      estadoPrevio = nuevoEstado;
      if (!volvioAPrimerPlano || !isLoggedIn) return;
      if (Date.now() - ultimoSyncPerfilRef.current < INTERVALO_RESYNC_PERFIL_MS) return;
      syncProfile().catch(() => {});
    });

    // Polling suave en primer plano para detectar cambios sin interacción del usuario
    let timerPolling = null;
    if (isLoggedIn) {
      timerPolling = setInterval(() => {
        if (AppState.currentState === "active") {
          syncProfile().catch(() => {});
        }
      }, 25000);
    }

    return () => {
      sub?.remove?.();
      if (timerPolling) clearInterval(timerPolling);
    };
  }, [isLoggedIn, syncProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Notificaciones in-app: se traen del backend al iniciar sesión y se
  // refrescan por polling suave mientras la sesión está activa.
  //
  // markNotificationAsRead marca "leído" en el estado local antes de que
  // confirme el POST (optimista). Si ese POST sigue en vuelo (ApiClient ya
  // reintenta solo con backoff) cuando cae el próximo poll de acá, el poll
  // traía el estado viejo del servidor y lo pisaba sin avisar — la
  // notificación volvía a verse como no leída sin que nada fallara a la
  // vista. `notifsPendientesRef` guarda los ids marcados localmente cuya
  // confirmación todavía no llegó (ni en éxito ni en fallo definitivo); acá
  // se los fuerza a `leido:true` para que el poll no los revierta mientras
  // se resuelven.
  const notifsPendientesRef = useRef(new Set());
  const cargarNotificaciones = useCallback(async () => {
    try {
      const data = await ApiClient.getNotificaciones();
      const lista = Array.isArray(data) ? data : [];
      setNotifications(
        notifsPendientesRef.current.size === 0
          ? lista
          : lista.map((n) =>
              notifsPendientesRef.current.has(n.id) ? { ...n, leido: true } : n
            )
      );
    } catch {
      /* se reintenta en el próximo tick */
    }
  }, []);

  // Reservas reales del arrendatario: antes solo se llenaban al pagar o al
  // tocar una del historial, así que el perfil mostraba "0 arriendos"
  // siempre y un arriendo en curso desaparecía al reabrir la app. Se cargan
  // al iniciar sesión y quedan disponibles para refrescar a mano.
  const cargarReservas = useCallback(async () => {
    try {
      const data = await ApiClient.getReservas("cliente");
      const lista = Array.isArray(data) ? data : [];
      setReservations(lista);
      if (!activeReservationRef.current) {
        const enCurso = lista.find((r) => r.estado === "en_curso" || r.estado === "confirmada");
        if (enCurso) setActiveReservation(enCurso);
      } else {
        const idActual = activeReservationRef.current.id;
        const actualizada = lista.find((r) => r.id === idActual);
        if (actualizada) setActiveReservation(actualizada);
      }
    } catch {
      /* se reintenta en el próximo login o refresh manual */
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setNotifications([]);
      return;
    }
    cargarNotificaciones();
    cargarReservas();
    // Push: registra el token del dispositivo (best-effort, cachea el intento).
    import("../utils/push")
      .then((m) => m.registrarPushToken(ApiClient))
      .catch(() => {});
    const t = setInterval(cargarNotificaciones, 30000);
    return () => clearInterval(t);
  }, [isLoggedIn, cargarNotificaciones, cargarReservas]);

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
    await sincronizarSesionConTransicion();
    return data;
  };

  /**
   * Login/registro con un proveedor social (Google, Apple, Facebook).
   * `onAuthStateChange` de este contexto ya reacciona a la sesión nueva;
   * acá solo se dispara el flujo, se fija el modo elegido y se espera al
   * perfil para no pintar el dashboard antes de tiempo.
   */
  const loginConProveedor = async (provider, preferredMode) => {
    const sesion = await iniciarSesionConProveedor(provider);

    if (VALID_MODES.includes(preferredMode)) setMode(preferredMode, { silent: true });

    await sincronizarSesionConTransicion();
    return sesion;
  };

  const resetPassword = async (email) => {
    // El enlace viaja por correo y se abre en el navegador del usuario, no en
    // la app: siempre tiene que apuntar a la web pública. Sin `redirectTo`
    // Supabase usa su Site URL, que en un proyecto recién configurado es
    // http://localhost:3000 — un enlace muerto para quien recibe el correo.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: urlWeb("restablecer-contrasena"),
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
      // En un dispositivo compartido, si el token push de este usuario queda
      // asociado a su cuenta después de cerrar sesión, el siguiente que se
      // loguea en el mismo dispositivo puede terminar recibiendo pushes
      // dirigidos al primero. Se limpia ANTES de signOut porque el PUT
      // necesita el access token todavía vigente; best-effort — un fallo acá
      // no debe trabar el cierre de sesión (el backend igual se lo "roba" al
      // próximo usuario que registre ese mismo token, ver PUT /push-token).
      await ApiClient.registrarPushToken(null).catch(() => {});
      await supabase.auth.signOut();
      setCurrentUser(null);
      setActiveReservation(null);
      limpiarCacheTarjetas();
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
    notifsPendientesRef.current.add(notifId);
    ApiClient.marcarNotificacionLeida(notifId)
      .catch((err) => {
        // ApiClient ya reintentó solo (backoff de red/timeout) — si llegó
        // acá es un fallo definitivo. Se loguea en vez de tragarlo en
        // silencio; el próximo poll va a mostrar la notificación como no
        // leída otra vez (correcto: el servidor nunca confirmó el cambio).
        console.warn("[notificaciones] no se pudo marcar como leída:", notifId, err?.message);
      })
      .finally(() => {
        notifsPendientesRef.current.delete(notifId);
      });
  };

  const clearAllNotifications = () => {
    setNotifications((prev) => {
      prev.forEach((n) => {
        if (!n.leido) notifsPendientesRef.current.add(n.id);
      });
      return prev.map((n) => ({ ...n, leido: true }));
    });
    ApiClient.marcarTodasNotificacionesLeidas()
      .catch((err) => {
        console.warn("[notificaciones] no se pudo marcar todas como leídas:", err?.message);
      })
      .finally(() => {
        notifsPendientesRef.current.clear();
      });
  };

  return (
    <AppContext.Provider
      value={{
        isLoggedIn,
        authLoading,
        sesionEstado,
        reintentarSesion: revisarSesion,
        onboardingVisto,
        marcarOnboardingVisto,
        mode,
        setMode,
        transition,
        pendingDeepLink,
        clearPendingDeepLink,
        login,
        loginConProveedor,
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
        cargarReservas,
        activeReservation,
        setActiveReservation,
        addReservation,
        bankAccount,
        updateBankAccount,
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
