# WebSocket Server Configuration Guide

This guide explains how to configure the Project Creator app to connect to the cloud-hosted WebSocket server for real-time notifications.

> **⚠️ Important Note:** The WebSocket server is **supplementary** and provides real-time notifications only. The primary workload management system uses **Microsoft 365 Excel and MS Lists** integration. For workload management setup, see [MS365-WORKLOAD-SETUP.md](./MS365-WORKLOAD-SETUP.md).

---

## 🔌 What is the WebSocket Server?

The WebSocket server provides **real-time notifications** and supplementary features:
- **Instant notifications** when projects are assigned or updated
- **User presence** - see who's online
- **Real-time alerts** for workload changes
- **Conflict detection** when multiple users work on same project

**Note:** Workload data management (assignments, hours, status) is handled through the MS 365 Excel/MS Lists integration, not through WebSocket. WebSocket only provides notifications about changes.

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

1. Open the **Workload Dashboard** (or any view in the app)
2. Look for connection indicator in the app (if available)
3. **Green dot (🟢)** = Connected ✅
4. **Red dot (🔴)** = Not connected ❌

**Note:** The Workload Dashboard now primarily shows a summary view and redirects to MS Lists for detailed workload management. WebSocket notifications will appear as toast notifications in the app.

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

The WebSocket server only transmits **notifications and presence information**:
- User presence (who's online)
- Project assignment notifications
- Workload update alerts
- Status change notifications

**The server does NOT store:**
- ❌ Project details
- ❌ Confidential information
- ❌ Your personal data
- ❌ Any sensitive information
- ❌ Workload data (this is managed via Excel/MS Lists)

The server is just a **message relay** - it passes notification messages between team members in real-time. All actual workload data is managed through the MS 365 Excel/MS Lists integration.

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

To enable real-time notifications in Project Creator:

1. Open Project Creator app
2. Go to Settings → Workload Settings
3. Update "WebSocket Server URL" to:
   wss://your-app-name.fly.dev
4. Click "Test Connection"
5. Save settings and restart app

This enables:
- Live project assignment notifications
- Real-time change alerts
- User presence indicators
- Conflict detection notifications

**Note:** For actual workload management (creating assignments, updating hours, etc.), use the MS 365 Excel/MS Lists integration. WebSocket only provides notifications about these changes.

Questions? Contact IT support.

Thanks!
```

---

## 💡 Benefits of Cloud WebSocket

After connecting to the cloud server, you get:

✅ **Real-time Notifications**
- Get instant alerts when projects are assigned or updated
- No need to manually check for changes

✅ **Team Collaboration**
- See who's online and working
- Get notified when teammates make changes in MS Lists

✅ **Conflict Prevention**
- Get alerts if multiple people work on same project
- Avoid duplicate work

✅ **Always Available**
- Server runs 24/7
- Connect from office, home, or anywhere

**Important:** These are **notifications only**. To actually manage workload (assign projects, update hours, change status), use the MS 365 Excel/MS Lists integration. See [MS365-WORKLOAD-SETUP.md](./MS365-WORKLOAD-SETUP.md) for setup instructions.

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
- Real-time notifications about project changes
- Team collaboration features (presence, alerts)
- Instant alerts when assignments are created or updated

**What you don't get:**
- Workload data management (use MS Lists for this)
- Assignment creation/editing (use MS Lists for this)
- Hours tracking (use MS Lists for this)

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
- [ ] Verified connection status (if indicator available)

---

**All set?** You're now connected to real-time notifications! 🎉

**Note:** For workload management, make sure you've also set up the MS 365 Excel/MS Lists integration. See [MS365-WORKLOAD-SETUP.md](./MS365-WORKLOAD-SETUP.md) for details.

**Need help?** Contact your IT administrator with this guide.

