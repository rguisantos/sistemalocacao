// Metro para monorepo (padrão oficial Expo).
// - watchFolders: resolve @locacoes/shared a partir da raiz.
// - nodeModulesPaths: procura no app primeiro, depois na raiz.
// O dedupe de React é feito via "overrides" no package.json da raiz
// (react@18.3.1 dentro de react-native e libs nativas), NÃO aqui —
// mexer no resolveRequest é frágil e foi a fonte de um erro de build.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
