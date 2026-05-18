module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // The worklets plugin is required by react-native-reanimated v4+ and must
    // be the LAST plugin in the array.
    plugins: ['react-native-worklets/plugin'],
  };
};
