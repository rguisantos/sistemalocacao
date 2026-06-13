module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo (SDK 52) já inclui o plugin do react-native-reanimated.
  // NÃO declarar 'react-native-reanimated/plugin' aqui — duplicar quebra o boot.
  return { presets: ['babel-preset-expo'] };
};
