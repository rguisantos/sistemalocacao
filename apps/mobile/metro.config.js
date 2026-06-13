// Metro para monorepo — solução completa e determinística.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1) Mantém os watchFolders do Expo (já incluem todos os workspaces)
//    e garante que a raiz do monorepo esteja observada para resolver
//    @locacoes/shared e os node_modules compartilhados.
if (!config.watchFolders.includes(monorepoRoot)) {
  config.watchFolders.push(monorepoRoot);
}

// 2) Resolve módulos no app primeiro, depois na raiz.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3) React/react-native SEMPRE da cópia correta (18.3.1). Como a raiz
//    não declara mais React, o npm içou o 18.3.1 (que o mobile precisa)
//    e aninhou o 19 no web. O extraNodeModules garante que o Metro
//    resolva para a cópia certa — procurando primeiro no app, depois na
//    raiz. API estável (sem resolveRequest custom).
const reactDir = fs.existsSync(path.resolve(projectRoot, 'node_modules/react'))
  ? path.resolve(projectRoot, 'node_modules/react')
  : path.resolve(monorepoRoot, 'node_modules/react');

const rnDir = fs.existsSync(path.resolve(projectRoot, 'node_modules/react-native'))
  ? path.resolve(projectRoot, 'node_modules/react-native')
  : path.resolve(monorepoRoot, 'node_modules/react-native');

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: reactDir,
  'react-native': rnDir,
};

module.exports = config;
