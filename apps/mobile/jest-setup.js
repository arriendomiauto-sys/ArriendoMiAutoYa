/* eslint-env jest */

// react-native-maps es un módulo nativo: en jest se mockea a componentes vacíos.
jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Mock = (props) => React.createElement(View, props, props.children);
  return { __esModule: true, default: Mock, Marker: Mock, PROVIDER_DEFAULT: "default" };
});

jest.mock("react-native-qrcode-svg", () => "QRCode");

// expo-location es nativo. Sin mock, cada pantalla que fija un punto quedaba a
// merced de si el require fallaba o no, y el reverse geocoding resolvía fuera
// de act() dejando la suite intermitente.
jest.mock("expo-location", () => ({
  Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: -37.4697, longitude: -72.3536 },
  })),
  reverseGeocodeAsync: jest.fn(async () => [
    { street: "Av. Alemania", name: "1250", city: "Los Ángeles" },
  ]),
}));

// expo-camera es un módulo nativo. Además, useCameraPermissions() consulta el
// permiso de forma asíncrona al montar y hace setState fuera de act(): eso
// dejaba la suite intermitente — las pantallas que abren la cámara pasaban o
// fallaban según el orden en que corrieran. Acá el permiso ya viene resuelto.
jest.mock("expo-camera", () => {
  const React = require("react");
  const { View } = require("react-native");
  const CameraView = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref }, props.children)
  );
  return {
    CameraView,
    useCameraPermissions: () => [
      { granted: true, canAskAgain: true, status: "granted" },
      jest.fn(async () => ({ granted: true, status: "granted" })),
    ],
  };
});

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

// react-native-document-scanner-plugin es un módulo nativo TurboModule: se mockea para Jest.
jest.mock("react-native-document-scanner-plugin", () => ({
  __esModule: true,
  default: {
    scanDocument: jest.fn(async () => ({ status: "cancel" })),
  },
  ResponseType: { Base64: "base64", ImageFilePath: "imageFilePath" },
  ScanDocumentResponseStatus: { Success: "success", Cancel: "cancel" },
}));

// Silencia el warning de act() de las animaciones de RN y logs tardíos en tests.
jest.spyOn(console, "warn").mockImplementation((msg) => {
  if (typeof msg === "string" && /useNativeDriver|act\(\)|ExpoModulesCoreJSLogger/.test(msg)) return;
});
