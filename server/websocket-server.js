/**
 * WebSocket Notification Server
 * Lightweight server for broadcasting real-time notifications
 * between Project Creator clients
 * 
 * Purpose: Message relay only - NO data storage
 */

const WebSocket = require('ws');
const config = require('./config');

class WebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map of userId -> WebSocket connection
    this.stats = {
      totalConnections: 0,
      currentConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      startTime: new Date()
    };
    this.heartbeatInterval = null;
  }

  /**
   * Start the WebSocket server
   */
  start() {
    try {
      this.wss = new WebSocket.Server({
        port: config.server.port,
        host: config.server.host,
        maxPayload: config.messages.maxMessageSize,
        perMessageDeflate: true
      });

      this.setupEventHandlers();
      this.startHeartbeat();

      this.log('info', `✅ WebSocket server started on ${config.server.host}:${config.server.port}`);
      this.log('info', `📊 Max clients: ${config.server.maxClients}`);
      this.log('info', `🔒 Auth required: ${config.security.requireAuth}`);

      return true;
    } catch (error) {
      this.log('error', `❌ Failed to start WebSocket server: ${error.message}`);
      return false;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      this.log('error', `❌ WebSocket server error: ${error.message}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Handle new client connection
   */
  handleConnection(ws, request) {
    const clientIp = request.socket.remoteAddress;

    // Check max clients
    if (this.clients.size >= config.server.maxClients) {
      this.log('warn', `⚠️ Max clients reached, rejecting connection from ${clientIp}`);
      ws.close(1008, 'Server at capacity');
      return;
    }

    // Initialize client state
    const clientId = this.generateClientId();
    const client = {
      id: clientId,
      ws,
      userId: null,
      userName: 'Unknown',
      connectedAt: new Date(),
      lastHeartbeat: Date.now(),
      messageCount: 0
    };

    this.clients.set(clientId, client);
    this.stats.totalConnections++;
    this.stats.currentConnections++;

    this.log('info', `🔌 Client connected: ${clientId} from ${clientIp} (${this.stats.currentConnections} active)`);

    // Setup client event handlers
    ws.on('message', (data) => this.handleMessage(client, data));
    ws.on('close', (code, reason) => this.handleDisconnect(client, code, reason));
    ws.on('error', (error) => this.handleError(client, error));
    ws.on('pong', () => {
      client.lastHeartbeat = Date.now();
    });

    // Send connection acknowledgment
    this.sendToClient(ws, {
      type: 'CONNECTION_ACK',
      data: {
        clientId,
        serverTime: new Date().toISOString(),
        message: 'Connected to Project Creator WebSocket Server'
      }
    });
  }

  /**
   * Handle incoming message from client
   */
  handleMessage(client, data) {
    try {
      const message = JSON.parse(data.toString());
      
      this.stats.messagesReceived++;
      client.messageCount++;

      this.log('debug', `📨 Message from ${client.userId || client.id}: ${message.type}`);

      // Handle different message types
      switch (message.type) {
        case 'USER_CONNECTED':
          this.handleUserConnected(client, message.data);
          break;

        case 'USER_DISCONNECTED':
          this.handleUserDisconnected(client, message.data);
          break;

        case 'PING':
          this.sendToClient(client.ws, { type: 'PONG', timestamp: new Date().toISOString() });
          break;

        case 'PROJECT_ASSIGNED':
        case 'PROJECT_STATUS_CHANGED':
        case 'WORKLOAD_UPDATED':
        case 'CONFLICT_DETECTED':
        case 'ASSIGNMENT_CREATED':
        case 'ASSIGNMENT_UPDATED':
        case 'ASSIGNMENT_DELETED':
        case 'USER_PRESENCE':
          // Broadcast to all other clients
          this.broadcast(message, client.id);
          break;

        default:
          this.log('warn', `⚠️ Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.log('error', `❌ Error handling message: ${error.message}`);
      this.sendToClient(client.ws, {
        type: 'ERROR',
        data: { message: 'Invalid message format' }
      });
    }
  }

  /**
   * Handle user connected message
   */
  handleUserConnected(client, data) {
    client.userId = data.userId;
    client.userName = data.userName || 'Unknown';

    this.log('info', `👤 User connected: ${client.userName} (${client.userId})`);

    // Broadcast user connection to all other clients
    this.broadcast({
      type: 'USER_CONNECTED',
      data: {
        userId: client.userId,
        userName: client.userName,
        timestamp: new Date().toISOString()
      }
    }, client.id);

    // Send list of currently connected users to new client
    this.sendConnectedUsersList(client);
  }

  /**
   * Handle user disconnected message
   */
  handleUserDisconnected(client, data) {
    this.log('info', `👤 User disconnecting: ${client.userName} (${client.userId})`);

    // Broadcast disconnection
    this.broadcast({
      type: 'USER_DISCONNECTED',
      data: {
        userId: client.userId,
        userName: client.userName,
        timestamp: new Date().toISOString()
      }
    }, client.id);
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(client, code, reason) {
    this.log('info', `🔌 Client disconnected: ${client.userId || client.id} (Code: ${code})`);

    // Notify others if this was a registered user
    if (client.userId) {
      this.broadcast({
        type: 'USER_DISCONNECTED',
        data: {
          userId: client.userId,
          userName: client.userName,
          timestamp: new Date().toISOString()
        }
      }, client.id);
    }

    this.clients.delete(client.id);
    this.stats.currentConnections--;

    this.log('info', `📊 Active connections: ${this.stats.currentConnections}`);
  }

  /**
   * Handle client error
   */
  handleError(client, error) {
    this.log('error', `❌ Client error (${client.userId || client.id}): ${error.message}`);
  }

  /**
   * Broadcast message to all clients except sender
   */
  broadcast(message, excludeClientId = null) {
    let sentCount = 0;

    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(client.ws, message);
        sentCount++;
      }
    });

    this.log('debug', `📡 Broadcast ${message.type} to ${sentCount} clients`);
    
    return sentCount;
  }

  /**
   * Send message to specific client
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        this.stats.messagesSent++;
        return true;
      } catch (error) {
        this.log('error', `❌ Error sending to client: ${error.message}`);
        return false;
      }
    }
    return false;
  }

  /**
   * Send list of connected users to client
   */
  sendConnectedUsersList(client) {
    const connectedUsers = [];

    this.clients.forEach((c) => {
      if (c.userId && c.id !== client.id) {
        connectedUsers.push({
          userId: c.userId,
          userName: c.userName,
          connectedAt: c.connectedAt
        });
      }
    });

    this.sendToClient(client.ws, {
      type: 'CONNECTED_USERS',
      data: {
        users: connectedUsers,
        count: connectedUsers.length
      }
    });
  }

  /**
   * Start heartbeat to detect dead connections
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      this.clients.forEach((client, clientId) => {
        // Check if client responded to last ping
        if (now - client.lastHeartbeat > config.connection.connectionTimeout) {
          this.log('warn', `⚠️ Client ${client.userId || clientId} timeout, terminating`);
          client.ws.terminate();
          return;
        }

        // Send ping
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, config.connection.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get server statistics
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime.getTime();
    
    return {
      ...this.stats,
      uptime: Math.floor(uptime / 1000), // seconds
      uptimeFormatted: this.formatUptime(uptime)
    };
  }

  /**
   * Format uptime
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Logging helper
   */
  log(level, message) {
    if (!config.logging.enabled) return;

    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[config.logging.level] || 1;
    const messageLevel = levels[level] || 1;

    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      
      console.log(logMessage);

      // TODO: Add file logging if configured
      if (config.logging.logFile) {
        // Implement file logging
      }
    }
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    this.log('info', '🛑 Shutting down WebSocket server...');

    this.stopHeartbeat();

    // Close all client connections
    this.clients.forEach((client) => {
      this.sendToClient(client.ws, {
        type: 'SERVER_SHUTDOWN',
        data: { message: 'Server is shutting down' }
      });
      client.ws.close(1001, 'Server shutting down');
    });

    // Close server
    if (this.wss) {
      this.wss.close(() => {
        this.log('info', '✅ WebSocket server shut down successfully');
        process.exit(0);
      });
    }

    // Force exit after 5 seconds
    setTimeout(() => {
      this.log('warn', '⚠️ Forced shutdown after timeout');
      process.exit(1);
    }, 5000);
  }
}

// Start server
const server = new WebSocketServer();
const started = server.start();

if (!started) {
  process.exit(1);
}

// Log stats periodically
setInterval(() => {
  const stats = server.getStats();
  server.log('info', `📊 Stats: ${stats.currentConnections} connected | ${stats.messagesReceived} received | ${stats.messagesSent} sent | Uptime: ${stats.uptimeFormatted}`);
}, 60000); // Every minute

