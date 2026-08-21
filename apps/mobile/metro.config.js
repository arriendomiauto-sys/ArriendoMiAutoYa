const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Strict single-instance resolution for React 19, ReactDOM 19, React Native
const reactPath = path.resolve(projectRoot, "node_modules/react");
const reactDomPath = path.resolve(projectRoot, "node_modules/react-dom");
const reactNativePath = path.resolve(projectRoot, "node_modules/react-native");
const reactNativeWebPath = path.resolve(projectRoot, "node_modules/react-native-web");

config.resolver.extraNodeModules = {
  react: reactPath,
  "react-dom": reactDomPath,
  "react-native": reactNativePath,
  "react-native-web": reactNativeWebPath,
  "@rentacar/shared-schemas": path.resolve(workspaceRoot, "packages/shared-schemas"),
};

// 4. Force ALL requires of react, react-dom, and react-native to route to projectRoot (React 19)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react") {
    return {
      filePath: path.resolve(reactPath, "index.js"),
      type: "sourceFile",
    };
  }
  if (moduleName === "react-dom") {
    return {
      filePath: path.resolve(reactDomPath, "index.js"),
      type: "sourceFile",
    };
  }
  if (moduleName === "react-dom/client") {
    return {
      filePath: path.resolve(reactDomPath, "client.js"),
      type: "sourceFile",
    };
  }
  if (moduleName === "react/jsx-runtime") {
    return {
      filePath: path.resolve(reactPath, "jsx-runtime.js"),
      type: "sourceFile",
    };
  }
  if (moduleName === "react/jsx-dev-runtime") {
    return {
      filePath: path.resolve(reactPath, "jsx-dev-runtime.js"),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
