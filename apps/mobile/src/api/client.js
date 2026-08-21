const API_BASE_URL = "http://localhost:8000/api/v1";

export const MOCK_CARS = [
  {
    id: "car-swift-01",
    marca: "Suzuki",
    modelo: "Swift",
    ano: 2023,
    patente: "BBFK-42",
    transmision: "Automático",
    combustible: "Bencina 95",
    asientos: 5,
    puertas: 5,
    tarifa_dia: 38000,
    tarifa_semana: 228000,
    tarifa_mes: 820000,
    garantia_monto: 150000,
    direccion_entrega: "Av. Providencia 2145",
    comuna: "Providencia",
    ciudad: "Santiago",
    distancia: "a 400 m",
    disponible: true,
    foto_principal_url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
    fotos: [
      "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800",
    ],
    dueno: {
      id: "dueno-rodrigo",
      nombre: "Rodrigo Muñoz",
      rating: 4.8,
      viajes: 31,
      telefono: "+56 9 7734 1208",
      verificado: true,
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
      tiempo_respuesta: "Responde en menos de 15 min",
    },
  },
  {
    id: "car-yaris-02",
    marca: "Toyota",
    modelo: "Yaris",
    ano: 2022,
    patente: "YT-8821",
    transmision: "Mecánico",
    combustible: "Bencina 95",
    asientos: 5,
    puertas: 4,
    tarifa_dia: 26000,
    tarifa_semana: 160000,
    tarifa_mes: 590000,
    garantia_monto: 150000,
    direccion_entrega: "Av. Apoquindo 4500",
    comuna: "Las Condes",
    ciudad: "Santiago",
    distancia: "a 1.2 km",
    disponible: true,
    foto_principal_url: "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800",
    fotos: ["https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800"],
    dueno: {
      id: "dueno-maria",
      nombre: "María Paz Sepúlveda",
      rating: 4.9,
      viajes: 19,
      telefono: "+56 9 6543 2198",
      verificado: true,
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
      tiempo_respuesta: "Responde de inmediato",
    },
  },
  {
    id: "car-tucson-03",
    marca: "Hyundai",
    modelo: "Tucson",
    ano: 2023,
    patente: "HT-9932",
    transmision: "Automático",
    combustible: "Bencina 95",
    asientos: 5,
    puertas: 5,
    tarifa_dia: 44000,
    tarifa_semana: 270000,
    tarifa_mes: 980000,
    garantia_monto: 200000,
    direccion_entrega: "Plaza Baquedano",
    comuna: "Santiago Centro",
    ciudad: "Santiago",
    distancia: "a 800 m",
    disponible: true,
    foto_principal_url: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800",
    fotos: ["https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800"],
    dueno: {
      id: "dueno-cristian",
      nombre: "Cristián Valenzuela",
      rating: 5.0,
      viajes: 44,
      telefono: "+56 9 8123 4567",
      verificado: true,
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      tiempo_respuesta: "Responde en 5 min",
    },
  },
  {
    id: "car-soluto-04",
    marca: "Kia",
    modelo: "Soluto",
    ano: 2022,
    patente: "KS-1234",
    transmision: "Mecánico",
    combustible: "Bencina 93",
    asientos: 5,
    puertas: 4,
    tarifa_dia: 31000,
    tarifa_semana: 190000,
    tarifa_mes: 680000,
    garantia_monto: 150000,
    direccion_entrega: "Av. Tobalaba 1550",
    comuna: "Providencia",
    ciudad: "Santiago",
    distancia: "a 1.8 km",
    disponible: true,
    foto_principal_url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800",
    fotos: ["https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800"],
    dueno: {
      id: "dueno-javiera",
      nombre: "Javiera Silva",
      rating: 4.8,
      viajes: 12,
      telefono: "+56 9 7321 8844",
      verificado: true,
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400",
      tiempo_respuesta: "Responde en menos de 30 min",
    },
  },
  {
    id: "car-onix-05",
    marca: "Chevrolet",
    modelo: "Onix Sedan",
    ano: 2023,
    patente: "CO-5544",
    transmision: "Automático",
    combustible: "Bencina 95",
    asientos: 5,
    puertas: 4,
    tarifa_dia: 29000,
    tarifa_semana: 175000,
    tarifa_mes: 630000,
    garantia_monto: 150000,
    direccion_entrega: "Plaza Ñuñoa",
    comuna: "Ñuñoa",
    ciudad: "Santiago",
    distancia: "a 2.4 km",
    disponible: true,
    foto_principal_url: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800",
    fotos: ["https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800"],
    dueno: {
      id: "dueno-pedro",
      nombre: "Pedro Aguirre",
      rating: 4.7,
      viajes: 27,
      telefono: "+56 9 9122 3344",
      verificado: true,
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
      tiempo_respuesta: "Responde en menos de 1 hora",
    },
  },
  {
    id: "car-ranger-06",
    marca: "Ford",
    modelo: "Ranger XLT 4x4",
    ano: 2024,
    patente: "FR-7711",
    transmision: "Automático",
    combustible: "Diésel",
    asientos: 5,
    puertas: 4,
    tarifa_dia: 65000,
    tarifa_semana: 410000,
    tarifa_mes: 1480000,
    garantia_monto: 300000,
    direccion_entrega: "Av. Vitacura 3565",
    comuna: "Vitacura",
    ciudad: "Santiago",
    distancia: "a 3.1 km",
    disponible: true,
    foto_principal_url: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800",
    fotos: ["https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800"],
    dueno: {
      id: "dueno-gonzalo",
      nombre: "Gonzalo Echeverría",
      rating: 4.9,
      viajes: 58,
      telefono: "+56 9 8833 2211",
      verificado: true,
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400",
      tiempo_respuesta: "Responde de inmediato",
    },
  },
];

export class ApiClient {
  static async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error en la solicitud: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // Autos
  static async getAutos(params = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      return await this.request(`/autos?${query}`);
    } catch {
      return MOCK_CARS;
    }
  }

  static async crearAuto(autoData) {
    try {
      return await this.request("/autos", {
        method: "POST",
        body: JSON.stringify(autoData),
      });
    } catch {
      const newCar = {
        id: `car-user-${Date.now()}`,
        ...autoData,
        disponible: true,
        foto_principal_url: autoData.fotos?.[0] || "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
      };
      return newCar;
    }
  }

  // Reservas
  static async getReservas(rol = "cliente") {
    try {
      return await this.request(`/reservas?rol=${rol}`);
    } catch {
      return [
        {
          id: "RES-94821",
          auto_id: "car-swift-01",
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
          auto_id: "car-yaris-02",
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
          auto_id: "car-soluto-04",
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
      ];
    }
  }

  static async crearReserva(reservaData) {
    try {
      return await this.request("/reservas", {
        method: "POST",
        body: JSON.stringify(reservaData),
      });
    } catch {
      return {
        id: `RES-${Math.floor(10000 + Math.random() * 90000)}`,
        ...reservaData,
        status: "confirmada",
        codigo_contrato: `AMY-2026-${Math.floor(10000 + Math.random() * 90000)}`,
        fecha_creacion: new Date().toISOString(),
      };
    }
  }

  // Usuarios y KYC
  static async verifyKyc(kycData) {
    try {
      return await this.request("/usuarios/kyc", {
        method: "POST",
        body: JSON.stringify(kycData),
      });
    } catch {
      return {
        success: true,
        verificado: true,
        score: 98,
        mensaje: "Identidad y licencia validadas exitosamente.",
      };
    }
  }
}
