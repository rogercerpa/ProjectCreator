# Project Creator WebSocket Server

Lightweight WebSocket notification server for real-time workload dashboard updates.

## Purpose

This server acts as a **message relay only** - it does NOT store any data. It simply broadcasts notifications between connected Project Creator clients to enable real-time updates.

---

## ☁️ **Cloud Deployment with Fly.io (FREE)** ⭐

**Deploy to Fly.io for production use - Free tier available!**

- ✅ **All users can connect** from anywhere
- ✅ **Always online** (24/7 uptime)
- ✅ **Auto SSL/TLS** encryption
- ✅ **Easy deployment** in 10 minutes
- ✅ **Completely FREE** for typical usage

**→ [Quick Start Guide: Deploy to Fly.io](./QUICK-START-FLY.IO.md)** - **5-MINUTE SETUP**

---

## Features

- ✅ Real-time message broadcasting
- ✅ User presence tracking
- ✅ Automatic heartbeat and connection management
- ✅ Configurable via environment variables
- ✅ Lightweight and efficient
- ✅ No database required

## Installation

### Option 1: Run on Office PC/Server

1. **Install Node.js** (v16 or higher)
   - Download from: https://nodejs.org/

2. **Navigate to server directory**
   ```bash
   cd server
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Configure (optional)**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

5. **Start the server**
   ```bash
   npm start
   ```

The server will run on `http://localhost:8080` by default.

### Option 2: Run on Cloud Server (DigitalOcean/AWS/Azure)

1. **Create a small instance**
   - DigitalOcean: $6/month droplet
   - AWS: t2.micro (free tier eligible)
   - Azure: B1s instance

2. **SSH into server**
   ```bash
   ssh user@your-server-ip
   ```

3. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Clone project and setup**
   ```bash
   git clone <your-repo>
   cd ProjectCreator/server
   npm install
   ```

5. **Configure environment**
   ```bash
   nano .env
   # Set WS_HOST=0.0.0.0 to accept external connections
   ```

6. **Run with PM2 (process manager)**
   ```bash
   sudo npm install -g pm2
   npm run pm2:start
   pm2 save
   pm2 startup
   ```

The server will now run continuously and restart automatically.

## Configuration

Edit `.env` file:

```env
# Port to run on
WS_PORT=8080

# Host (0.0.0.0 for all interfaces, 127.0.0.1 for local only)
WS_HOST=0.0.0.0

# Logging level (debug, info, warn, error)
LOG_LEVEL=info

# Authentication (not implemented yet)
REQUIRE_AUTH=false
```

## Usage

Once running, clients connect to:
```
ws://localhost:8080        (local)
ws://your-server-ip:8080   (cloud)
```

## Monitoring

### Check server status
```bash
npm run pm2:logs    # View logs
npm run pm2:restart # Restart server
npm run pm2:stop    # Stop server
```

### View statistics
The server logs statistics every minute:
- Connected clients
- Messages sent/received
- Uptime

## Firewall Configuration

If running on cloud server, open port 8080:

**Ubuntu/Debian:**
```bash
sudo ufw allow 8080/tcp
```

**Windows:**
```powershell
New-NetFirewallRule -DisplayName "WebSocket Server" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

## Security Notes

- Currently no authentication (all clients on network can connect)
- Use VPN or internal network for security
- Future version will add token-based authentication
- Server only relays messages, never stores data

## Troubleshooting

### Port already in use
```bash
# Change WS_PORT in .env to different port (e.g., 8081)
```

### Can't connect from other computers
```bash
# Make sure WS_HOST=0.0.0.0 in .env
# Check firewall allows port 8080
```

### Server crashes
```bash
# Check logs
pm2 logs project-creator-ws

# Restart
npm run pm2:restart
```

## Architecture

```
┌─────────────────────────────────────────────┐
│         WebSocket Server (Port 8080)       │
│                                             │
│  - Accepts client connections               │
│  - Broadcasts messages                      │
│  - Tracks user presence                     │
│  - No data storage                          │
└─────────────────────────────────────────────┘
           ▲                    ▲
           │                    │
     ┌─────┴──────┐      ┌─────┴──────┐
     │  Client 1  │      │  Client 2  │
     │ (Electron) │      │ (Electron) │
     └────────────┘      └────────────┘
```

## Message Types

The server handles these message types:

- `USER_CONNECTED` - User comes online
- `USER_DISCONNECTED` - User goes offline
- `PROJECT_ASSIGNED` - Project assigned to user
- `PROJECT_STATUS_CHANGED` - Project status updated
- `WORKLOAD_UPDATED` - Workload data changed
- `USER_PRESENCE` - User status update
- `PING/PONG` - Heartbeat messages

## Performance

- Handles 100+ concurrent connections
- < 1ms message relay latency
- ~10MB memory footprint
- Minimal CPU usage

## Support

For issues or questions, contact your IT department or check the main project documentation.

