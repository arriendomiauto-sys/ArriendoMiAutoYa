import React from "react";
import { TextInput } from "react-native";
import { act } from "react-test-renderer";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiClient, CodigoVerificacion } from "@rentacar/mobile-shared";
import { RegisterScreen } from "@rentacar/mobile-shared/auth/screens/RegisterScreen";
import {
  errorCelular,
  errorCorreo,
  errorNombre,
  contrasenaValida,
  formatearCelular,
  reglasContrasena,
} from "@rentacar/mobile-shared/auth/register/validaciones";
import { renderTree as renderizar, textOf, pressText } from "../test-utils";

const mockRegister = jest.fn();
const mockVerifyOtp = jest.fn();
const mockResend = jest.fn();

jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => ({ register: (...a) => mockRegister(...a), loginConProveedor: jest.fn() }),
}));
jest.mock("@rentacar/mobile-shared/api/supabase", () => ({
  supabase: {
    auth: {
      verifyOtp: (...a) => mockVerifyOtp(...a),
      resend: (...a) => mockResend(...a),
    },
  },
  getAccessToken: jest.fn(async () => null),
}));

// El paso del código deja un temporizador de reenvío corriendo: se desmonta al terminar cada test.
const montados = [];
const montar = (elemento) => {
  const tr = renderizar(elemento);
  montados.push(tr);
  return tr;
};
afterEach(() => {
  act(() => montados.splice(0).forEach((tr) => tr.unmount()));
});

// Primer nodo compuesto con ese testID (el Field, el Button…).
const porTestId = (tr, id) => tr.root.findAll((n) => n.props?.testID === id && typeof n.type !== "string")[0];
const escribir = (tr, id, texto) => act(() => porTestId(tr, id).props.onChangeText(texto));
const tocar = async (tr, id) => act(async () => porTestId(tr, id).props.onPress());

const CUENTA = {
  nombre: "Camila",
  apellido: "Rojas",
  email: " camila.rojas@correo.cl ",
  password: "camila2026",
  telefono: "9 1234 5678",
};

function llenarCuenta(tr) {
  escribir(tr, "input-nombre", CUENTA.nombre);
  escribir(tr, "input-apellido", CUENTA.apellido);
  escribir(tr, "input-email", CUENTA.email);
  escribir(tr, "input-password", CUENTA.password);
  escribir(tr, "input-telefono", CUENTA.telefono);
}

async function irALosTerminos(tr) {
  llenarCuenta(tr);
  await tocar(tr, "btn-continuar");
}

async function crearCuenta(tr) {
  await irALosTerminos(tr);
  await tocar(tr, "btn-aceptar-terminos");
}

describe("validaciones del registro", () => {
  it("el nombre lleva letras y no números", () => {
    expect(errorNombre("Camila")).toBeNull();
    expect(errorNombre("María José")).toBeNull();
    expect(errorNombre("")).toMatch(/cédula/);
    expect(errorNombre("  ")).toMatch(/cédula/);
    expect(errorNombre("Camila2")).toMatch(/cédula/);
  });

  it("el correo necesita arroba y dominio", () => {
    expect(errorCorreo("camila@correo.cl")).toBeNull();
    expect(errorCorreo(" camila@correo.cl ")).toBeNull();
    expect(errorCorreo("camila@correo")).toMatch(/nombre@correo\.cl/);
    expect(errorCorreo("camila")).toMatch(/nombre@correo\.cl/);
  });

  it("la contraseña pide 8 caracteres, una letra y un número", () => {
    expect(reglasContrasena("abc1")).toEqual({ largo: false, letra: true, numero: true });
    expect(contrasenaValida("camila2026")).toBe(true);
    expect(contrasenaValida("camilarojas")).toBe(false);
    expect(contrasenaValida("12345678")).toBe(false);
  });

  it("el celular son 9 dígitos y empieza con 9", () => {
    expect(errorCelular("9 1234 5678")).toBeNull();
    expect(errorCelular("9 1234")).toMatch(/9 dígitos/);
    expect(errorCelular("8 1234 5678")).toMatch(/empieza con 9/);
  });

  it("el celular se agrupa como 9 1234 5678 y recorta el +56 pegado", () => {
    expect(formatearCelular("912345678")).toBe("9 1234 5678");
    expect(formatearCelular("9123")).toBe("9 123");
    expect(formatearCelular("+56 9 1234 5678")).toBe("9 1234 5678");
    expect(formatearCelular("91234567899999")).toBe("9 1234 5678");
    expect(formatearCelular("")).toBe("");
  });
});

describe("RegisterScreen (arrendatario)", () => {
  beforeEach(() => {
    mockRegister.mockReset().mockResolvedValue({});
    mockVerifyOtp.mockReset().mockResolvedValue({ error: null });
    mockResend.mockReset().mockResolvedValue({});
    jest.spyOn(ApiClient, "actualizarPerfilBasico").mockResolvedValue({});
  });
  afterEach(() => jest.restoreAllMocks());

  describe("paso 1 · tu cuenta", () => {
    it("pide lo mínimo para tener cuenta, con rótulos, sin RUT ni fecha de nacimiento", () => {
      const t = textOf(montar(<RegisterScreen onNavigate={() => {}} role="renter" />));
      expect(t).toContain("Paso 1 de 3");
      expect(t).toContain("Crea tu cuenta");
      for (const rotulo of ["Nombre", "Apellido", "Correo", "Contraseña", "Celular"]) expect(t).toContain(rotulo);
      expect(t).toContain("+56");
      expect(t).not.toMatch(/RUT|nacimiento/i);
    });

    it("muestra las tres reglas de la contraseña", () => {
      const t = textOf(montar(<RegisterScreen onNavigate={() => {}} role="renter" />));
      expect(t).toContain("8 o más caracteres");
      expect(t).toContain("Una letra");
      expect(t).toContain("Un número");
    });

    it("ofrece registrarse con Google y volver al login", () => {
      const t = textOf(montar(<RegisterScreen onNavigate={() => {}} role="renter" />));
      expect(t).toContain("o regístrate con");
      expect(t).not.toContain("o continúa con");
      expect(t).toContain("¿Ya tienes cuenta? Entrar");
    });

    it("con campos vacíos no avanza y dice qué corregir bajo cada campo", async () => {
      const tr = montar(<RegisterScreen onNavigate={() => {}} role="renter" />);
      await tocar(tr, "btn-continuar");
      const t = textOf(tr);
      expect(t).toContain("Paso 1 de 3");
      expect(t).toContain("Escribe tu nombre como aparece en tu cédula.");
      expect(t).toContain("Escribe tu apellido como aparece en tu cédula.");
      expect(t).toContain("Escribe un correo válido, como nombre@correo.cl.");
      expect(t).toContain("El celular tiene 9 dígitos y empieza con 9.");
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it("una contraseña incompleta marca el campo sin agregar un mensaje aparte", async () => {
      const tr = montar(<RegisterScreen onNavigate={() => {}} role="renter" />);
      llenarCuenta(tr);
      escribir(tr, "input-password", "corta");
      await tocar(tr, "btn-continuar");
      expect(textOf(tr)).toContain("Paso 1 de 3");
      expect(porTestId(tr, "input-password").props.invalid).toBe(true);
    });

    it("un celular incompleto no deja avanzar y lo explica", async () => {
      const tr = montar(<RegisterScreen onNavigate={() => {}} role="renter" />);
      llenarCuenta(tr);
      escribir(tr, "input-telefono", "9 1234");
      await tocar(tr, "btn-continuar");
      expect(textOf(tr)).toContain("El celular tiene 9 dígitos y empieza con 9.");
      expect(porTestId(tr, "input-telefono").props.invalid).toBe(true);
      expect(textOf(tr)).toContain("Paso 1 de 3");
    });

    it("no crea la cuenta todavía: solo pasa a los términos", async () => {
      const tr = montar(<RegisterScreen onNavigate={() => {}} role="renter" />);
      await irALosTerminos(tr);
      expect(textOf(tr)).toContain("Paso 2 de 3");
      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  describe("código de colaborador", () => {
    const asentar = () => act(async () => {
      await new Promise((r) => setImmediate(r));
    });

    beforeEach(async () => {
      await AsyncStorage.clear();
      await Clipboard.setStringAsync("");
    });

    it("un código copiado NO se pone solo: se sugiere y se usa al tocar 'Usar'", async () => {
      await Clipboard.setStringAsync("abc123");
      jest.spyOn(ApiClient, "validarCodigoReferido").mockResolvedValue({ valido: true, codigo: "ABC123", nombre_referente: "Pedro" });
      const tr = montar(<RegisterScreen onNavigate={() => {}} role="renter" />);
      await asentar();

      expect(porTestId(tr, "input-codigo-colaborador").props.value).toBe("");
      expect(textOf(tr)).toContain("¿Te invitó Pedro?");
      expect(textOf(tr)).toContain("ABC123");

      await tocar(tr, "btn-usar-sugerencia");
      expect(porTestId(tr, "input-codigo-colaborador").props.value).toBe("ABC123");
      expect(tr.root.findAll((n) => n.props?.testID === "sugerencia-codigo")).toHaveLength(0);
    });

    it("lo copiado que no es un código válido (p. ej. el código del correo) no aparece en ningún lado", async () => {
      await Clipboard.setStringAsync("482915");
      jest.spyOn(ApiClient, "validarCodigoReferido").mockResolvedValue({ valido: false, codigo: "482915" });
      const tr = montar(<RegisterScreen onNavigate={() => {}} role="renter" />);
      await asentar();

      expect(porTestId(tr, "input-codigo-colaborador").props.value).toBe("");
      expect(tr.root.findAll((n) => n.props?.testID === "sugerencia-codigo")).toHaveLength(0);
    });

    it("un código guardado por el sistema anterior (que mezclaba el portapapeles) se descarta", async () => {
      await AsyncStorage.setItem("@rentacar/pending_referral_code", "ZZZ999");
      const tr = montar(<RegisterScreen onNavigate={() => {}} role="renter" />);
      await asentar();

      expect(porTestId(tr, "input-codigo-colaborador").props.value).toBe("");
      expect(await AsyncStorage.getItem("@rentacar/pending_referral_code")).toBeNull();
    });

    it("un código que vino de un enlace de invitación sí se pone solo", async () => {
      await AsyncStorage.setItem("@rentacar/pending_referral_code_enlace", "LNK123");
      const tr = montar(<RegisterScreen onNavigate={() => {}} role="renter" />);
      await asentar();

      expect(porTestId(tr, "input-codigo-colaborador").props.value).toBe("LNK123");
      expect(textOf(tr)).toContain("Código de colaborador detectado del enlace");
    });
  });

  describe("paso 2 · términos y condiciones", () => {
    it("es una pantalla para leer: el documento completo y nada más que pedir", async () => {
      const tr = montar(<RegisterScreen onNavigate={() => {}} role="renter" />);
      await irALosTerminos(tr);
      const t = textOf(tr);
      expect(t).toContain("Términos y condiciones");
      expect(t).toContain("Hold de garantía");
      expect(t).toContain("Acepto y crear cuenta");
      expect(tr.root.findAllByType(TextInput)).toHaveLength(0);
      // (el RUT de la empresa aparece dentro del texto legal; lo que no debe haber es un campo)
      expect(t).not.toContain("Celular");
    });

    it("permite cambiar a la política de privacidad", async () => {
      const tr = montar(<RegisterScreen onNavigate={() => {}} role="renter" />);
      await irALosTerminos(tr);
      pressText(tr, "Privacidad");
      const t = textOf(tr);
      expect(t).toContain("Política de Privacidad");
      expect(t).toContain("Ley N° 19.628");
    });

    it("aceptar crea la cuenta con el correo sin espacios y el rol de arrendatario, y pasa al código", async () => {
      const tr = montar(<RegisterScreen onNavigate={() => {}} role="renter" />);
      await crearCuenta(tr);
      expect(mockRegister).toHaveBeenCalledWith("camila.rojas@correo.cl", "camila2026", "renter", {
        nombre: "Camila Rojas",
        telefono: "+56 9 1234 5678",
      });
      const t = textOf(tr);
      expect(t).toContain("Paso 3 de 3");
      expect(t).toContain("Revisa tu correo");
      expect(t).toContain("camila.rojas@correo.cl");
    });

    it("un correo ya registrado devuelve al paso 1 con el aviso y el camino al login", async () => {
      const error = Object.assign(new Error("User already registered"), { code: "already_registered" });
      mockRegister.mockRejectedValue(error);
      const onNavigate = jest.fn();
      const tr = montar(<RegisterScreen onNavigate={onNavigate} role="renter" />);
      await crearCuenta(tr);

      const t = textOf(tr);
      expect(t).toContain("Paso 1 de 3");
      expect(t).toContain("Ese correo ya tiene una cuenta");
      // Lo escrito se conserva
      expect(porTestId(tr, "input-nombre").props.value).toBe("Camila");

      await tocar(tr, "btn-ir-login");
      expect(onNavigate).toHaveBeenCalledWith("login");
    });

    it("otro error al crear la cuenta se muestra en la pantalla, traducido", async () => {
      mockRegister.mockRejectedValue(new Error("Network request failed"));
      const tr = montar(<RegisterScreen onNavigate={() => {}} role="renter" />);
      await crearCuenta(tr);
      const t = textOf(tr);
      expect(t).toContain("Paso 2 de 3");
      expect(t).toContain("No se pudo crear la cuenta");
      expect(t).toContain("No se pudo conectar");
    });

    it("la flecha de volver regresa al paso 1 sin perder lo escrito", async () => {
      const tr = montar(<RegisterScreen onNavigate={() => {}} role="renter" />);
      await irALosTerminos(tr);
      const volver = tr.root.find((n) => n.props?.accessibilityLabel === "Volver" && n.props.onPress);
      act(() => volver.props.onPress());
      expect(textOf(tr)).toContain("Paso 1 de 3");
      expect(porTestId(tr, "input-email").props.value).toBe(CUENTA.email);
      expect(porTestId(tr, "input-telefono").props.value).toBe(CUENTA.telefono);
    });
  });

  describe("paso 3 · código", () => {
    async function irAlCodigo(onNavigate = () => {}) {
      const tr = montar(<RegisterScreen onNavigate={onNavigate} role="renter" />);
      await crearCuenta(tr);
      return tr;
    }
    const pegarCodigo = (tr, codigo) =>
      act(() => tr.root.findByType(CodigoVerificacion).props.onCambiar(0, codigo));

    it("sin los seis dígitos no verifica", async () => {
      const tr = await irAlCodigo();
      await tocar(tr, "btn-verificar");
      expect(textOf(tr)).toContain("Escribe los 6 dígitos que enviamos a tu correo.");
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });

    it("acepta pegar el código completo y verifica con el correo sin espacios", async () => {
      const tr = await irAlCodigo();
      pegarCodigo(tr, "482915");
      expect(tr.root.findByType(CodigoVerificacion).props.digitos).toEqual(["4", "8", "2", "9", "1", "5"]);
      await tocar(tr, "btn-verificar");
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        email: "camila.rojas@correo.cl",
        token: "482915",
        type: "signup",
      });
    });

    it("con el código correcto guarda nombre y celular y muestra la cuenta creada", async () => {
      const onNavigate = jest.fn();
      const tr = await irAlCodigo(onNavigate);
      pegarCodigo(tr, "482915");
      await tocar(tr, "btn-verificar");

      expect(ApiClient.actualizarPerfilBasico).toHaveBeenCalledWith({
        nombre: "Camila Rojas",
        telefono: "+56 9 1234 5678",
      });
      const t = textOf(tr);
      expect(t).toContain("Cuenta creada");
      expect(t).toContain("Hola, Camila");
      expect(t).toContain("camila.rojas@correo.cl");
      expect(t).toContain("+56 9 1234 5678");
      expect(t).not.toMatch(/RUT/);

      await tocar(tr, "btn-empezar");
      expect(onNavigate).toHaveBeenCalledWith("login");
    });

    it("un código que no coincide o venció se explica bajo las casillas", async () => {
      mockVerifyOtp.mockResolvedValue({ error: new Error("Token has expired or is invalid") });
      const tr = await irAlCodigo();
      pegarCodigo(tr, "000000");
      await tocar(tr, "btn-verificar");
      expect(textOf(tr)).toContain("El código no coincide o venció. Pide uno nuevo.");
      expect(textOf(tr)).toContain("Paso 3 de 3");
    });

    it("mientras corre la espera muestra la cuenta regresiva del reenvío", async () => {
      const tr = await irAlCodigo();
      expect(textOf(tr)).toContain("Reenviar código en 0:45");
    });

    it("'Cambiarlo' vuelve al paso 1 para corregir el correo", async () => {
      const tr = await irAlCodigo();
      pressText(tr, "Cambiarlo");
      expect(textOf(tr)).toContain("Paso 1 de 3");
    });
  });
});
