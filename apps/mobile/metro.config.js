// Metro para monorepo (padrão oficial Expo + dedupe de React).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Observa a raiz (resolve @locacoes/shared) e prioriza o node_modules do app.
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// ── Dedupe de React ──────────────────────────────────────────────
// O monorepo tem react@19 içado na raiz (do Next/web). O mobile
// precisa de react@18.3.1 (exigido pelo react-native 0.76.5).
// O react-native também está içado na raiz e sem config ele resolve
// o react@19 como irmão → duas cópias de React no bundle → crash
// "ReactCurrentDispatcher of undefined".
//
// Estratégia em duas camadas:
// 1. extraNodeModules: redireciona require('react') para a cópia local
// 2. resolveRequest: intercepta TODAS as resoluções (incluindo de
//    dentro do react-native) e força a cópia local do app

const localReactDir = path.resolve(projectRoot, 'node_modules/react');
const localRnDir = path.resolve(projectRoot, 'node_modules/react-native');

// Caminhos para react-dom@18 (nested sob expo-router na raiz)
const localReactDOMDir = path.resolve(
  monorepoRoot,
  'node_modules/expo-router/node_modules/react-dom'
);

const extraNodeModules = {};
if (fs.existsSync(localReactDir)) {
  extraNodeModules.react = localReactDir;
}
if (fs.existsSync(localRnDir)) {
  extraNodeModules['react-native'] = localRnDir;
}
if (fs.existsSync(localReactDOMDir)) {
  extraNodeModules['react-dom'] = localReactDOMDir;
}
config.resolver.extraNodeModules = extraNodeModules;

// resolveRequest: garante que TODAS as resoluções de react/react-dom
// usem a cópia local (18.3.1), mesmo quando o require vem de dentro
// do react-native ou de outras libs içadas na raiz.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercepta react e react-dom (e subpaths como react/jsx-runtime)
  const redirectable = ['react', 'react-dom'];
  const shouldRedirect = redirectable.some(
    (pkg) => moduleName === pkg || moduleName.startsWith(pkg + '/')
  );

  if (shouldRedirect) {
    // Resolve a partir do diretório do app, onde react@18.3.1 é local
    const newContext = {
      ...context,
      originModulePath: path.resolve(projectRoot, 'App.js'),
    };
    return originalResolveRequest(newContext, moduleName, platform);
  }

  return originalResolveRequest(context, moduleName, platform);
};

module.exports = config;
