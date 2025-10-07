/**
 * WebSocket Server Configuration
 */

require('dotenv').config();

module.exports = {
  // Server configuration
  server: {
    port: process.env.WS_PORT || 8080,
    host: process.env.WS_HOST || '0.0.0.0',
    pingInterval: 30000, // 30 seconds
    maxClients: 100
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
    heartbeatInterval: 30000, // 30 seconds
    connectionTimeout: 60000 // 60 seconds
  }
};

