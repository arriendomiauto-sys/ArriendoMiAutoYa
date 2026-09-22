module.exports = function (api) {
  api.cache(true);
  const isProd = process.env.NODE_ENV === "production";
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      ...(isProd ? [["transform-remove-console", { exclude: ["error", "warn"] }]] : []),
      // Reanimated worklets: siempre al final de la lista de plugins.
      "react-native-reanimated/plugin",
    ],
  };
};
