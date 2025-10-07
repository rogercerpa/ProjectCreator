/**
 * WebSocketService
 * Handles WebSocket client connection for real-time notifications
 * Runs in main process, communicates with standalone WebSocket server
 */

const WebSocket = require('ws');
const { EventEmitter } = require('events');

class WebSocketService extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 3000; // 3 seconds
    this.reconnectTimer = null;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.messageQueue = [];
    this.config = {
      serverUrl: null,
      userId: null,
      userName: null,
      heartbeatInterval: 30000, // 30 seconds
      heartbeatTimeout: 5000 // 5 seconds
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(serverUrl, userId, userName) {
    if (this.isConnected) {
      console.log('⚠️ Already connected to WebSocket server');
      return { success: false, message: 'Already connected' };
    }

    this.config.serverUrl = serverUrl;
    this.config.userId = userId;
    this.config.userName = userName;

    try {
      console.log(`🔌 Connecting to WebSocket server: ${serverUrl}`);
      
      this.ws = new WebSocket(serverUrl);

      this.ws.on('open', () => this.handleOpen());
      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('close', (code, reason) => this.handleClose(code, reason));
      this.ws.on('error', (error) => this.handleError(error));
      this.ws.on('ping', () => this.handlePing());
      this.ws.on('pong', () => this.handlePong());

      return { success: true, message: 'Connecting...' };
    } catch (error) {
      console.error('❌ Error connecting to WebSocket:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle WebSocket connection opened
   */
  handleOpen() {
    console.log('✅ WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;

    // Send initial connection message with user info
    this.sendConnectionMessage();

    // Start heartbeat
    this.startHeartbeat();

    // Process queued messages
    this.processMessageQueue();

    // Emit connected event
    this.emit('connected', {
      serverUrl: this.config.serverUrl,
      userId: this.config.userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      console.log('📨 WebSocket message received:', message.type);

      // Handle different message types
      switch (message.type) {
        case 'PING':
          this.send({ type: 'PONG', timestamp: new Date().toISOString() });
          break;
          
        case 'PONG':
          this.handlePong();
          break;
          
        case 'CONNECTION_ACK':
          console.log('✅ Connection acknowledged by server');
          break;
          
        case 'USER_CONNECTED':
        case 'USER_DISCONNECTED':
        case 'USER_PRESENCE':
          this.emit('user:presence', message.data);
          break;
          
        case 'PROJECT_ASSIGNED':
          this.emit('project:assigned', message.data);
          break;
          
        case 'PROJECT_STATUS_CHANGED':
          this.emit('project:status', message.data);
          break;
          
        case 'WORKLOAD_UPDATED':
          this.emit('workload:updated', message.data);
          break;
          
        case 'CONFLICT_DETECTED':
          this.emit('conflict:detected', message.data);
          break;
          
        case 'ASSIGNMENT_CREATED':
        case 'ASSIGNMENT_UPDATED':
        case 'ASSIGNMENT_DELETED':
          this.emit('assignment:changed', message.data);
          break;
          
        default:
          // Emit generic notification event
          this.emit('notification', message);
      }

      // Emit all messages event for logging/debugging
      this.emit('message', message);
      
    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
    }
  }

  /**
   * Handle WebSocket connection closed
   */
  handleClose(code, reason) {
    console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
    this.isConnected = false;

    // Stop heartbeat
    this.stopHeartbeat();

    // Emit disconnected event
    this.emit('disconnected', {
      code,
      reason: reason.toString(),
      timestamp: new Date().toISOString()
    });

    // Attempt reconnection if not intentionally closed
    if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error
   */
  handleError(error) {
    console.error('❌ WebSocket error:', error.message);
    
    this.emit('error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle ping
   */
  handlePing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.pong();
    }
  }

  /**
   * Handle pong
   */
  handlePong() {
    // Clear heartbeat timeout
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing heartbeat

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send ping
        this.ws.ping();

        // Set timeout for pong response
        this.heartbeatTimeout = setTimeout(() => {
          console.log('⚠️ Heartbeat timeout - connection may be lost');
          this.ws.terminate();
        }, this.config.heartbeatTimeout);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      if (!this.isConnected && this.config.serverUrl) {
        this.connect(this.config.serverUrl, this.config.userId, this.config.userName);
      }
    }, delay);
  }

  /**
   * Send connection message with user info
   */
  sendConnectionMessage() {
    this.send({
      type: 'USER_CONNECTED',
      data: {
        userId: this.config.userId,
        userName: this.config.userName,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Send message to server
   */
  send(message) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('⚠️ WebSocket not connected, queuing message');
      this.messageQueue.push(message);
      return { success: false, message: 'Not connected, message queued' };
    }

    try {
      this.ws.send(JSON.stringify(message));
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending WebSocket message:', error);
      this.messageQueue.push(message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process queued messages
   */
  processMessageQueue() {
    if (this.messageQueue.length === 0) return;

    console.log(`📤 Processing ${this.messageQueue.length} queued messages`);

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  /**
   * Send notification
   */
  sendNotification(type, data) {
    return this.send({
      type,
      data: {
        ...data,
        fromUserId: this.config.userId,
        fromUserName: this.config.userName,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Broadcast project assignment
   */
  broadcastProjectAssignment(assignment) {
    return this.sendNotification('PROJECT_ASSIGNED', assignment);
  }

  /**
   * Broadcast project status change
   */
  broadcastProjectStatus(projectId, oldStatus, newStatus) {
    return this.sendNotification('PROJECT_STATUS_CHANGED', {
      projectId,
      oldStatus,
      newStatus
    });
  }

  /**
   * Broadcast workload update
   */
  broadcastWorkloadUpdate(userId, workloadData) {
    return this.sendNotification('WORKLOAD_UPDATED', {
      userId,
      ...workloadData
    });
  }

  /**
   * Send user presence update
   */
  updatePresence(status) {
    return this.sendNotification('USER_PRESENCE', {
      status, // online, offline, away
      lastActivity: new Date().toISOString()
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (!this.isConnected && !this.ws) {
      return { success: true, message: 'Already disconnected' };
    }

    try {
      // Stop reconnection attempts
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect

      // Stop heartbeat
      this.stopHeartbeat();

      // Send disconnect message
      if (this.isConnected) {
        this.send({
          type: 'USER_DISCONNECTED',
          data: {
            userId: this.config.userId,
            userName: this.config.userName,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Close connection
      if (this.ws) {
        this.ws.close(1000, 'Client disconnecting');
        this.ws = null;
      }

      this.isConnected = false;

      console.log('✅ WebSocket disconnected');
      return { success: true, message: 'Disconnected' };
    } catch (error) {
      console.error('❌ Error disconnecting WebSocket:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      serverUrl: this.config.serverUrl,
      userId: this.config.userId,
      userName: this.config.userName,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      readyState: this.ws ? this.ws.readyState : null
    };
  }

  /**
   * Clear message queue
   */
  clearMessageQueue() {
    this.messageQueue = [];
    return { success: true, message: 'Message queue cleared' };
  }

  /**
   * Reset reconnection attempts
   */
  resetReconnectAttempts() {
    this.reconnectAttempts = 0;
  }
}

module.exports = WebSocketService;

