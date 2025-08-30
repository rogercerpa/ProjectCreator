// Environment configuration
module.exports = {
  development: {
    logLevel: 'debug',
    enableDevTools: true,
    securityLogging: true
  },
  production: {
    logLevel: 'info',
    enableDevTools: false,
    securityLogging: true
  },
  test: {
    logLevel: 'error',
    enableDevTools: false,
    securityLogging: false
  }
};
