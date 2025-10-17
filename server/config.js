/**
 * WebSocket Server Configuration
 */

require('dotenv').config();

module.exports = {
  // Server configuration
  server: {
    // Railway provides PORT, fallback to WS_PORT or 8080
    port: process.env.PORT || process.env.WS_PORT || 8080,
    host: process.env.WS_HOST || '0.0.0.0',
    pingInterval: 30000, // 30 seconds
    maxClients: parseInt(process.env.MAX_CLIENTS) || 100
  },

  // Logging configuration
  logging: {
    enabled: process.env.LOG_ENABLED !== 'false',
    level: process.env.LOG_LEVEL || 'info', // debug, info, warn, error
    logFile: process.env.LOG_FILE || null
  },

  // Security configuration
  security: {
    // Add authentication if needed in future
    requireAuth: process.env.REQUIRE_AUTH === 'true',
    allowedOrigins: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['*']
  },

  // Message configuration
  messages: {
    maxMessageSize: 1024 * 100, // 100KB
    broadcastDelay: 100 // 100ms delay for message batching
  },

  // Connection configuration
  connection: {
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000, // 30 seconds
    connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT) || 60000 // 60 seconds
  },

  // Environment
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production'
};

