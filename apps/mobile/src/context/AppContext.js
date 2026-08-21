import React, { createContext, useState, useContext, useEffect } from "react";
import { ApiClient, MOCK_CARS } from "../api/client";

const AppContext = createContext();

export function AppProvider({ children }) {
  // Navigation & Mode
  const [mode, setMode] = useState("pasajero"); // 'pasajero' (arrendatario) | 'conductor' (dueño)
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  // Current User
  const [currentUser, setCurrentUser] = useState({
    id: "user-demo-01",
    nombre: "Rodrigo Muñoz",
    email: "rodrigo.munoz@gmail.com",
    telefono: "+56 9 7734 1208",
    rating: 4.8,
    viajes_completados: 31,
    verificado: true,
    foto_perfil_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
  });

  // Cars Catalog
  const [cars, setCars] = useState(MOCK_CARS);

  // Active / History Reservations
  const [reservations, setReservations] = useState([
    {
      id: "RES-94821",
      car: MOCK_CARS[0],
      auto: MOCK_CARS[0],
      cliente_nombre: "Camila Aravena",
      fecha_inicio: "12 ago · 10:00",
      fecha_fin: "16 ago · 21:30",
      dias: 4,
      totalAmount: 188020,
      guaranteeAmount: 150000,
      status: "en_curso",
      codigo_contrato: "AMY-2026-04871",
    },
    {
      id: "RES-88120",
      car: MOCK_CARS[1],
      auto: MOCK_CARS[1],
      cliente_nombre: "Camila Aravena",
      fecha_inicio: "2 sep · 10:00",
      fecha_fin: "5 sep · 18:00",
      dias: 3,
      totalAmount: 92820,
      guaranteeAmount: 150000,
      status: "por_aprobar",
      codigo_contrato: "AMY-2026-04992",
    },
    {
      id: "RES-71044",
      car: MOCK_CARS[3],
      auto: MOCK_CARS[3],
      cliente_nombre: "Camila Aravena",
      fecha_inicio: "14 jul · 10:00",
      fecha_fin: "17 jul · 19:00",
      dias: 3,
      totalAmount: 110670,
      guaranteeAmount: 150000,
      status: "finalizada",
      codigo_contrato: "AMY-2026-03810",
    },
  ]);

  const [activeReservation, setActiveReservation] = useState(null);

  // Driver Bookings (Solicitudes entrantes)
  const [driverBookings, setDriverBookings] = useState([
    {
      id: "REQ-01",
      auto: MOCK_CARS[0],
      cliente_nombre: "Camila Aravena",
      cliente_avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
      cliente_rating: 4.9,
      cliente_viajes: 12,
      fecha_inicio: "12 ago · 10:00",
      fecha_fin: "16 ago · 21:30",
      dias: 4,
      total: 188020,
      ganancia_dueno: 150416,
      estado: "pendiente",
    },
    {
      id: "REQ-02",
      auto: MOCK_CARS[1],
      cliente_nombre: "Martín Contreras",
      cliente_avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      cliente_rating: 5.0,
      cliente_viajes: 7,
      fecha_inicio: "22 ago · 09:00",
      fecha_fin: "25 ago · 19:00",
      dias: 3,
      total: 92820,
      ganancia_dueno: 74256,
      estado: "pendiente",
    },
  ]);

  // Notifications
  const [notifications, setNotifications] = useState([
    {
      id: "notif-1",
      titulo: "Solicitud de Arriendo",
      mensaje: "Camila Aravena solicitó tu Suzuki Swift para el 12–16 ago.",
      fecha: "Hace 5 min",
      tipo: "reserva",
      leido: false,
      icono: "car",
    },
    {
      id: "notif-2",
      titulo: "Garantía Pre-autorizada",
      mensaje: "Se autorizó el hold de $150.000 CLP de garantía.",
      fecha: "Hace 15 min",
      tipo: "pago",
      leido: false,
      icono: "card",
    },
  ]);

  // Payment Methods
  const [paymentMethods, setPaymentMethods] = useState([
    {
      id: "pm-1",
      tipo: "Crédito",
      marca: "Visa",
      ultimos_4: "8842",
      titular: "RODRIGO MUÑOZ",
      vencimiento: "08/28",
      es_principal: true,
    },
    {
      id: "pm-2",
      tipo: "Débito",
      marca: "Mastercard",
      ultimos_4: "1932",
      titular: "RODRIGO MUÑOZ",
      vencimiento: "11/27",
      es_principal: false,
    },
  ]);

  // Bank Account for Owner
  const [bankAccount, setBankAccount] = useState({
    banco: "Banco Estado",
    tipo_cuenta: "CuentaRUT",
    numero: "14234567",
    titular: "Rodrigo Muñoz",
    rut: "14.234.567-8",
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [mode]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetchedCars = await ApiClient.getAutos();
      setCars(fetchedCars);
    } catch {
      setCars(MOCK_CARS);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "pasajero" ? "conductor" : "pasajero"));
  };

  const addReservation = (newRes) => {
    const created = {
      id: `RES-${Math.floor(10000 + Math.random() * 90000)}`,
      ...newRes,
      status: "en_curso",
      codigo_contrato: `AMY-2026-0${Math.floor(1000 + Math.random() * 9000)}`,
    };
    setReservations((prev) => [created, ...prev]);
    setActiveReservation(created);
  };

  const cancelReservation = (resId, refundAmount) => {
    setReservations((prev) =>
      prev.map((r) =>
        r.id === resId ? { ...r, status: "cancelada", refundAmount } : r
      )
    );
    if (activeReservation?.id === resId) {
      setActiveReservation(null);
    }
  };

  const addCar = (carData) => {
    const newCar = {
      id: `car-user-${Date.now()}`,
      ...carData,
      disponible: true,
      foto_principal_url: carData.fotos?.[0] || "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
      dueno: currentUser,
    };
    setCars((prev) => [newCar, ...prev]);
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

  const respondBookingRequest = (bookingId, action) => {
    setDriverBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, estado: action } : b))
    );
  };

  const login = (email, password, preferredMode = "pasajero") => {
    setIsLoggedIn(true);
    setMode(preferredMode);
  };

  const logout = () => {
    setIsLoggedIn(false);
  };

  const register = (userData) => {
    setCurrentUser((prev) => ({
      ...prev,
      ...userData,
    }));
    setIsLoggedIn(true);
    setMode(userData.roles?.includes("dueno") ? "conductor" : "pasajero");
  };

  return (
    <AppContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        isLoggedIn,
        login,
        logout,
        register,
        currentUser,
        setCurrentUser,
        cars,
        setCars,
        addCar,
        reservations,
        setReservations,
        activeReservation,
        setActiveReservation,
        addReservation,
        cancelReservation,
        driverBookings,
        setDriverBookings,
        respondBookingRequest,
        bankAccount,
        setBankAccount,
        paymentMethods,
        addPaymentMethod,
        removePaymentMethod,
        notifications,
        setNotifications,
        loading,
        loadData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
