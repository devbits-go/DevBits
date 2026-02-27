const appJson = require('./app.json');

module.exports = () => {
  const base = appJson.expo || {};
  const extras = {
    ...(base.extra || {}),
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || process.env.API_URL || null,
    EXPO_PUBLIC_USE_LOCAL_API:
      typeof process.env.EXPO_PUBLIC_USE_LOCAL_API !== 'undefined'
        ? process.env.EXPO_PUBLIC_USE_LOCAL_API
        : undefined,
    EXPO_PUBLIC_LOCAL_API_URL: process.env.EXPO_PUBLIC_LOCAL_API_URL || undefined,
  };

  return {
    expo: {
      ...base,
      extra: extras,
    },
  };
};
