// Metro para monorepo (padrão oficial Expo + dedupe de React).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Observa a raiz (resolve @locacoes/shared) e prioriza o node_modules do app.
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Garante UMA cópia de react/react-native — a do app (18.3.1). A raiz tem
// react@19 (do Next/web) içado; sem isto o Metro empacota o 19 e o app
// crasha com "ReactCurrentDispatcher of undefined".
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
};

module.exports = config;
