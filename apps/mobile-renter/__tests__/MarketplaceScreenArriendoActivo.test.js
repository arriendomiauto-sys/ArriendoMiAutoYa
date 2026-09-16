/**
 * Banner de "tienes un arriendo en curso" en Explorar — antes, al reabrir la
 * app, no había ninguna señal de que existiera un arriendo activo hasta
 * entrar a mano a "Mis reservas".
 */
import React from "react";
import { act } from "react-test-renderer";
import { MarketplaceScreen } from "../src/renter/screens/MarketplaceScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const AUTOS = [
  {
    id: "auto-1",
    marca: "Suzuki",
    modelo: "Swift",
    anio: 2023,
    tarifa_dia: 40000,
    ubicacion_base: "Los Ángeles",
    fotos: [],
    fecha_publicacion: "2026-01-01T00:00:00Z",
  },
];

let mockContexto = {
  cars: AUTOS,
  carsError: null,
  currentUser: { estado_documentos: "verificado" },
  loadData: jest.fn(),
  loading: false,
  activeReservation: null,
};
jest.mock("@rentacar/mobile-shared/context/AppContext", () => ({
  useApp: () => mockContexto,
}));

const montar = (onOpenActiveRental = () => {}) =>
  renderTree(
    <MarketplaceScreen
      onSelectCar={() => {}}
      onOpenMap={() => {}}
      onVerifyIdentity={() => {}}
      onOpenActiveRental={onOpenActiveRental}
    />
  );

describe("Marketplace · banner de arriendo activo", () => {
  it("sin arriendo activo, no muestra el banner", () => {
    mockContexto = { ...mockContexto, activeReservation: null };
    expect(textOf(montar())).not.toContain("Tienes un arriendo en curso");
  });

  it("con un arriendo en_curso, muestra el banner y navega al tocarlo", () => {
    mockContexto = { ...mockContexto, activeReservation: { id: "r1", estado: "en_curso" } };
    const onOpenActiveRental = jest.fn();
    const tr = montar(onOpenActiveRental);

    expect(textOf(tr)).toContain("Tienes un arriendo en curso");
    act(() => pressText(tr, "Tienes un arriendo en curso"));
    expect(onOpenActiveRental).toHaveBeenCalledTimes(1);
  });

  it("con una reserva confirmada (aún no retirada), muestra el copy correspondiente", () => {
    mockContexto = { ...mockContexto, activeReservation: { id: "r2", estado: "confirmada" } };
    expect(textOf(montar())).toContain("Tienes una reserva confirmada");
  });

  it("una reserva pendiente_pago no cuenta como arriendo activo para este banner", () => {
    mockContexto = { ...mockContexto, activeReservation: { id: "r3", estado: "pendiente_pago" } };
    expect(textOf(montar())).not.toContain("Tienes un arriendo en curso");
    expect(textOf(montar())).not.toContain("Tienes una reserva confirmada");
  });
});
