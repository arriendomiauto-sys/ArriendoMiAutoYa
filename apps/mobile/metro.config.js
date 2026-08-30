const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
// En la rama `mobile` esto es la raíz del monorepo mobile; en `main` es
// RentACar-web/ (donde viven packages/ pero cada app instala aparte).
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Metro observa la raíz para recoger cambios en packages/*.
config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

// Resolución de módulos: primero el node_modules de la app; el de la raíz
// solo si existe (en `main` puede no haberlo — no hay workspace).
const workspaceModules = path.resolve(workspaceRoot, "node_modules");
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  ...(fs.existsSync(workspaceModules) ? [workspaceModules] : []),
];

// Las libs compartidas se resuelven por ruta directa (mismo efecto que el
// symlink de `file:` o el workspace).
config.resolver.extraNodeModules = {
  "@rentacar/shared-schemas": path.resolve(workspaceRoot, "packages/shared-schemas"),
  "@rentacar/mobile-shared": path.resolve(workspaceRoot, "packages/mobile-shared"),
};

module.exports = config;
