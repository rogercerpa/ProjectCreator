# WebSocket Server Configuration Guide

This guide explains how to configure the Project Creator app to connect to the cloud-hosted WebSocket server for real-time workload updates.

---

## 🔌 What is the WebSocket Server?

The WebSocket server enables real-time features in the Workload Dashboard:
- **Live updates** when projects are assigned
- **User presence** - see who's online
- **Instant notifications** for workload changes
- **Conflict detection** when multiple users work on same project

---

## 🌐 Server: Cloud-Hosted on Fly.io

The WebSocket server runs on Fly.io cloud:
- **Always available** - 24/7 uptime
- **Works from anywhere** - Any computer, any network
- **Secure connections** - Automatic SSL/TLS encryption
- **Real-time updates** - All team members connected

---

## ⚙️ How to Connect Your App

### Step 1: Get WebSocket URL from Administrator

Ask your IT administrator or project manager for the WebSocket server URL.

It will look like:
```
wss://your-app-name.fly.dev
```

> ⚠️ **Important:** Use `wss://` (secure WebSocket), not `ws://`

---

### Step 2: Open Project Creator Settings

1. **Open the Project Creator Application**
2. Click the **"Settings"** button (gear icon)
3. Or use menu: **File** → **Settings**

---

### Step 3: Update WebSocket Server URL

1. Scroll down to **"Workload Dashboard Settings"** section
2. Find the field labeled **"WebSocket Server URL"**
3. Enter the URL provided by your administrator:
   ```
   wss://your-app-name.fly.dev
   ```
4. Make sure it starts with `wss://`

---

### Step 4: Test Connection

1. Click the **"Test Connection"** button
2. Wait a few seconds
3. You should see: ✅ **"Connection successful"**

If you see an error, double-check the URL and try again.

---

### Step 5: Save Settings

1. Click **"Save Settings"** button
2. Restart the application (recommended)

---

## ✅ Verify It's Working

After configuring:

1. Open the **Workload Dashboard**
2. Look for connection indicator (usually top-right)
3. **Green dot (🟢)** = Connected ✅
4. **Red dot (🔴)** = Not connected ❌

---

## 🔍 Connection Status Indicators

| Status | Meaning | What to Do |
|--------|---------|------------|
| 🟢 **Connected** | Successfully connected to server | Nothing - all good! |
| 🔴 **Disconnected** | Not connected to server | Check URL and internet |
| 🟡 **Connecting...** | Attempting to connect | Wait a moment |
| 🟠 **Reconnecting...** | Lost connection, retrying | Check internet connection |

---

## 🐛 Troubleshooting

### "Cannot connect to server"

**Problem:** App can't reach the WebSocket server

**Solutions:**
1. ✅ Verify URL starts with `wss://` (not `ws://`)
2. ✅ Check for typos in the URL
3. ✅ Test your internet connection
4. ✅ Try disabling VPN temporarily
5. ✅ Ask administrator to verify server is running
6. ✅ Restart the application

---

### "Connection keeps dropping"

**Problem:** Connection is unstable

**Solutions:**
1. ✅ Check your internet connection stability
2. ✅ Try connecting from different network
3. ✅ Contact your administrator
4. ✅ Restart your router/network

---

### "Invalid URL" error

**Problem:** URL format is incorrect

**Solution:** Ensure URL follows this exact format:
```
wss://your-app-name.fly.dev
```

**Common mistakes to avoid:**
- ❌ `http://...` - Wrong protocol
- ❌ `https://...` - Wrong protocol (not WebSocket)
- ❌ `ws://...` - Not secure (use `wss://`)
- ❌ `wss://your-app.fly.dev/` - Remove trailing slash
- ❌ Missing `wss://` prefix

---

### Still Can't Connect?

Contact your IT administrator with:
- The exact URL you're trying to use
- The error message you're seeing
- Screenshot of the Settings page (optional)

---

## 🔒 Security & Privacy

### Is My Data Safe?

✅ **Yes!** All connections use WSS (WebSocket Secure):
- All data is encrypted in transit
- Same security as HTTPS websites
- No one can intercept your messages

### What Data is Shared?

The WebSocket server only transmits:
- User presence (who's online)
- Project assignment notifications
- Workload update alerts
- Status changes

**The server does NOT store:**
- ❌ Project details
- ❌ Confidential information
- ❌ Your personal data
- ❌ Any sensitive information

The server is just a **message relay** - it passes messages between team members in real-time.

---

## 📋 Quick Reference

### Configuration Steps

```
1. Get URL from administrator
2. Open Settings → Workload Settings
3. Enter WebSocket Server URL
4. Test connection
5. Save settings
6. Restart app
```

### URL Format

```
wss://your-app-name.fly.dev
```

### Where to Configure

```
Settings → Workload Dashboard Settings → WebSocket Server URL
```

---

## 👥 For IT Administrators

If you're deploying the server, see:
- **`server/QUICK-START-FLY.IO.md`** - Deployment guide
- **`server/README.md`** - Server documentation

### Sharing URL with Team

**Template message:**

```
Subject: WebSocket Server Configuration - Project Creator

Hello team,

To enable real-time workload updates in Project Creator:

1. Open Project Creator app
2. Go to Settings → Workload Settings
3. Update "WebSocket Server URL" to:
   wss://your-app-name.fly.dev
4. Click "Test Connection"
5. Save settings and restart app

This enables:
- Live project assignment notifications
- Real-time workload updates
- User presence indicators
- Conflict detection

Questions? Contact IT support.

Thanks!
```

---

## 💡 Benefits of Cloud WebSocket

After connecting to the cloud server, you get:

✅ **Real-time Updates**
- See changes instantly when projects are assigned
- No need to refresh manually

✅ **Team Collaboration**
- See who's online and working
- Get notified when teammates make changes

✅ **Conflict Prevention**
- Get alerts if multiple people work on same project
- Avoid duplicate work

✅ **Always Available**
- Server runs 24/7
- Connect from office, home, or anywhere

---

## 🆘 Need Help?

### Connection Issues
1. Check this guide's troubleshooting section
2. Verify URL with administrator
3. Test internet connection
4. Contact IT support

### Getting WebSocket URL
Ask your:
- IT administrator
- Project manager
- Team lead

### Server Issues
Contact your IT department - they can:
- Verify server is running
- Check server logs
- Restart if needed

---

## ✨ Summary

**What you need:**
- WebSocket URL from administrator (format: `wss://your-app.fly.dev`)

**Where to configure:**
- Settings → Workload Settings → WebSocket Server URL

**How to verify:**
- Test Connection button shows success ✅
- Green indicator in Workload Dashboard 🟢

**What you get:**
- Real-time project updates
- Team collaboration features
- Instant notifications

---

## 📞 Support

**For setup help:**
- Check troubleshooting section above
- Contact your IT administrator

**For server deployment:**
- See `server/QUICK-START-FLY.IO.md`

---

## Setup Checklist

- [ ] Received WebSocket URL from administrator
- [ ] URL format is `wss://your-app.fly.dev`
- [ ] Opened Project Creator Settings
- [ ] Found Workload Settings section
- [ ] Entered WebSocket Server URL
- [ ] URL starts with `wss://` (not `ws://`)
- [ ] Clicked "Test Connection"
- [ ] Saw success message ✅
- [ ] Clicked "Save Settings"
- [ ] Restarted application
- [ ] Verified green connection indicator in Workload Dashboard

---

**All set?** You're now connected to real-time workload updates! 🎉

**Need help?** Contact your IT administrator with this guide.

