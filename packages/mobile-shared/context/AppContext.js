import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { ApiClient, MOCK_CARS } from "../api/client";
import { supabase } from "../api/supabase";

const AppContext = createContext();

/**
 * Contexto de aplicación compartido por mobile-owner y mobile-renter.
 * La identidad de rol (dueño vs. arrendatario) ya no vive aquí: cada app
 * es su propio binario independiente, así que no hay "mode" ni
 * "toggleMode"/"onSwitchApp" — eso se eliminó al separar las apps.
 */
export function AppProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const [cars, setCars] = useState(MOCK_CARS);
  const [loading, setLoading] = useState(false);

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
      setCars(fetchedCars);
    } catch {
      setCars(MOCK_CARS);
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

  const register = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await syncProfile();
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setActiveReservation(null);
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

  const addCar = async (carData) => {
    const created = await ApiClient.crearAuto(carData);
    setCars((prev) => [created, ...prev]);
    return created;
  };

  const addReservation = (newRes) => {
    setReservations((prev) => [newRes, ...prev]);
    setActiveReservation(newRes);
  };

  const markNotificationAsRead = (notifId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, leido: true } : n))
    );
  };

  const clearAllNotifications = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, leido: true })));
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
        login,
        logout,
        register,
        completeEnrolment,
        currentUser,
        setCurrentUser,
        syncProfile,
        cars,
        setCars,
        addCar,
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
