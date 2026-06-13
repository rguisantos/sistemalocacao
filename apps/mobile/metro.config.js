// Metro para monorepo (padrão oficial Expo).
// O getDefaultConfig já detecta os workspaces automaticamente e configura
// watchFolders e nodeModulesPaths corretamente. Não precisamos sobrescrever
// nada — o dedupe de React é feito via "overrides" no package.json da raiz.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
