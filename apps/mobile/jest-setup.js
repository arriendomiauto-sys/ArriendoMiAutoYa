/* eslint-env jest */

// react-native-maps es un módulo nativo: en jest se mockea a componentes vacíos.
jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Mock = (props) => React.createElement(View, props, props.children);
  return { __esModule: true, default: Mock, Marker: Mock, PROVIDER_DEFAULT: "default" };
});

jest.mock("react-native-qrcode-svg", () => "QRCode");

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(async () => ({ type: "cancel" })),
  openBrowserAsync: jest.fn(async () => ({ type: "opened" })),
}));

jest.mock("expo-linking", () => ({
  createURL: (path) => `arriendatuauto://${path}`,
  parse: (url) => ({ queryParams: Object.fromEntries(new URLSearchParams((url.split("?")[1] || ""))) }),
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
}));

// AsyncStorage: implementación en memoria para los tests.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Silencia el warning de act() de las animaciones de RN en tests.
jest.spyOn(console, "warn").mockImplementation((msg) => {
  if (typeof msg === "string" && /useNativeDriver|act\(\)/.test(msg)) return;
});
