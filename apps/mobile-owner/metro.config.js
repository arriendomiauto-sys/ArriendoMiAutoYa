const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo: Metro vigila la raíz del workspace y resuelve módulos tanto
// desde la app como desde la raíz. Las versiones de react / react-native /
// expo / async-storage están unificadas por el campo "overrides" del
// package.json raíz, así que existe una sola copia hoisteada de cada una y
// no hay que forzar resoluciones a mano (eso rompía cuando npm hoisteaba
// react fuera de apps/*/node_modules).
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.extraNodeModules = {
  "@rentacar/shared-schemas": path.resolve(workspaceRoot, "packages/shared-schemas"),
  "@rentacar/mobile-shared": path.resolve(workspaceRoot, "packages/mobile-shared"),
};

module.exports = config;
