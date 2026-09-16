import React from "react";
import { act } from "react-test-renderer";
import { AppProvider, useApp } from "@rentacar/mobile-shared";
import { renderTree } from "../test-utils";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

function Sonda({ onListo }) {
  const { mode } = useApp();
  onListo(mode);
  return null;
}

const asentar = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("AppProvider · modo inicial fijo", () => {
  it("con initialMode='owner' el contexto arranca y se queda en modo owner", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem("@rentacar/mode", "renter");

    let modoVisto = null;
    renderTree(
      <AppProvider initialMode="owner">
        <Sonda onListo={(m) => { modoVisto = m; }} />
      </AppProvider>
    );
    await asentar();

    // Aunque el storage diga "renter" de una sesión vieja, initialMode manda.
    expect(modoVisto).toBe("owner");
  });

  it("sin initialMode, se comporta como siempre: lee el modo guardado", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem("@rentacar/mode", "owner");

    let modoVisto = null;
    renderTree(
      <AppProvider>
        <Sonda onListo={(m) => { modoVisto = m; }} />
      </AppProvider>
    );
    await asentar();

    expect(modoVisto).toBe("owner");
  });
});
