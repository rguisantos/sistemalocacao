module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // O plugin do Reanimated DEVE ser o último da lista.
    plugins: ['react-native-reanimated/plugin'],
  };
};
