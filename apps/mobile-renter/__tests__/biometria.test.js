/**
 * Confirmación biométrica puntual (firma exclusiva de contratos). Ya NO existe
 * el candado general de la app: `confirmarBiometria` solo se usa para autorizar
 * el arriendo de un vehículo y nunca debe dejar a un usuario sin Face ID/huella
 * fuera del flujo.
 */
const mockHasHardware = jest.fn();
const mockIsEnrolled = jest.fn();
const mockAuthenticate = jest.fn();
jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: (...a) => mockHasHardware(...a),
  isEnrolledAsync: (...a) => mockIsEnrolled(...a),
  authenticateAsync: (...a) => mockAuthenticate(...a),
}));

const { confirmarBiometria, hayHardwareBiometrico } = require("@rentacar/mobile-shared/hooks/biometria");

beforeEach(() => {
  mockHasHardware.mockReset().mockResolvedValue(true);
  mockIsEnrolled.mockReset().mockResolvedValue(true);
  mockAuthenticate.mockReset().mockResolvedValue({ success: true });
});

describe("hayHardwareBiometrico", () => {
  it("true solo si hay hardware Y algo enrolado", async () => {
    await expect(hayHardwareBiometrico()).resolves.toBe(true);

    mockIsEnrolled.mockResolvedValue(false);
    await expect(hayHardwareBiometrico()).resolves.toBe(false);

    mockIsEnrolled.mockResolvedValue(true);
    mockHasHardware.mockResolvedValue(false);
    await expect(hayHardwareBiometrico()).resolves.toBe(false);
  });

  it("false si el módulo nativo tira error", async () => {
    mockHasHardware.mockRejectedValue(new Error("sin módulo"));
    await expect(hayHardwareBiometrico()).resolves.toBe(false);
  });
});

describe("confirmarBiometria", () => {
  it("deja pasar (true) cuando el teléfono no tiene biometría enrolada — no bloquea el arriendo", async () => {
    mockIsEnrolled.mockResolvedValue(false);
    await expect(confirmarBiometria()).resolves.toBe(true);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it("true si el usuario autentica y pasa el mensaje del prompt", async () => {
    mockAuthenticate.mockResolvedValue({ success: true });
    await expect(confirmarBiometria("Firma para reservar")).resolves.toBe(true);
    expect(mockAuthenticate).toHaveBeenCalledWith(
      expect.objectContaining({ promptMessage: "Firma para reservar" })
    );
  });

  it("false si el usuario cancela o falla", async () => {
    mockAuthenticate.mockResolvedValue({ success: false });
    await expect(confirmarBiometria()).resolves.toBe(false);
  });

  it("false si authenticateAsync tira error", async () => {
    mockAuthenticate.mockRejectedValue(new Error("interrumpido"));
    await expect(confirmarBiometria()).resolves.toBe(false);
  });
});
