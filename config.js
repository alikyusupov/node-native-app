const environments = {
  staging: {
    httpPort: 3000,
    httpsPort: 3001,
    envName: "staging",
    secret: "somesecret",
    maxChecks: 5,
  },
  production: {
    httpPort: 5000,
    httpsPort: 5001,
    envName: "production",
    secret: "somesecret",
    maxChecks: 10,
  },
};

const currentEnv =
  typeof process.env.NODE_ENV == "string"
    ? process.env.NODE_ENV.toLowerCase()
    : "";

const exportEnv =
  typeof environments[currentEnv] == "object"
    ? environments[currentEnv]
    : environments.staging;

module.exports = exportEnv;
