/**
 * "Detalle de la reserva": la patente del auto se mostraba siempre, incluso
 * antes de que el arrendatario lo hubiera retirado (no hay nada que hacer
 * con ese dato hasta ese momento); y el mapa del punto de encuentro
 * (pantalla "Reserva confirmada") usaba StyleSheet.absoluteFillObject, que
 * en Android con New Architecture puede medir 0 y dejar el mapa en blanco.
 */
import React from "react";
import { act } from "react-test-renderer";
import { ActiveRentalScreen } from "../src/renter/screens/ActiveRentalScreen";
import { renderTree, textOf, pressText } from "../test-utils";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@rentacar/mobile-shared/api/client", () => {
  const real = jest.requireActual("@rentacar/mobile-shared/api/client");
  return {
    ApiClient: {
      ...real.ApiClient,
      actualizarTelemetria: jest.fn(() => Promise.resolve({})),
      reportarUbicacion: jest.fn(() => Promise.resolve({})),
    },
  };
});

const auto = { marca: "Kia", modelo: "Rio", anio: 2022, patente: "ABCD12", fotos: [] };

let arbolActual = null;
afterEach(() => {
  if (arbolActual) arbolActual.unmount();
  arbolActual = null;
});

describe("ActiveRentalScreen · mapa del punto de encuentro", () => {
  it("el MapView usa width/height 100% explícitos, no StyleSheet.absoluteFillObject", async () => {
    const reservation = {
      id: "res-1",
      estado: "confirmada",
      auto,
      fecha_inicio: new Date(Date.now() + 86400000).toISOString(),
      fecha_fin: new Date(Date.now() + 4 * 86400000).toISOString(),
    };
    const tr = renderTree(<ActiveRentalScreen reservation={reservation} onBack={() => {}} />);
    arbolActual = tr;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const MapView = require("react-native-maps").default;
    const mapa = tr.root.findByType(MapView);
    const estilo = Array.isArray(mapa.props.style) ? Object.assign({}, ...mapa.props.style) : mapa.props.style;
    expect(estilo).toMatchObject({ width: "100%", height: "100%" });
    expect(estilo.position).not.toBe("absolute");
  });
});

describe("ActiveRentalScreen · Detalle de la reserva", () => {
  const irADetalle = async (estado) => {
    const reservation = {
      id: "res-1",
      estado,
      auto,
      fecha_inicio: new Date(Date.now() - 3600000).toISOString(),
      fecha_fin: new Date(Date.now() + 3 * 86400000).toISOString(),
    };
    const tr = renderTree(
      <ActiveRentalScreen reservation={reservation} onBack={() => {}} onStartDelivery={() => {}} />
    );
    arbolActual = tr;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    if (estado === "confirmada") {
      await act(async () => {
        pressText(tr, "Ver el detalle de la reserva");
      });
    }
    return tr;
  };

  it("no muestra la patente mientras la reserva sigue 'confirmada' (auto sin retirar)", async () => {
    const tr = await irADetalle("confirmada");
    expect(textOf(tr)).not.toContain("ABCD12");
    // El código de entrega sigue teniendo sentido: el auto no se ha retirado.
    expect(textOf(tr)).toContain("Mi código de entrega");
  });

  it("muestra la patente una vez que el auto está 'en_curso' (ya retirado)", async () => {
    const tr = await irADetalle("en_curso");
    expect(textOf(tr)).toContain("ABCD12");
    // El código de entrega ya no sirve de nada: el auto ya se retiró.
    expect(textOf(tr)).not.toContain("Mi código de entrega");
  });
});
