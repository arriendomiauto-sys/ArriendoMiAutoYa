module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated worklets: siempre al final de la lista de plugins.
    plugins: ["react-native-reanimated/plugin"],
  };
};
