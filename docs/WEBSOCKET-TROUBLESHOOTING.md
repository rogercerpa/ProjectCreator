# WebSocket Connection Troubleshooting

## Common Issues and Solutions

### ❌ Issue: "Connection fails with error code 1006"

**Symptoms:**
```
🔌 Connecting to WebSocket server: https://projectcreatorv5.fly.dev
❌ WebSocket error
🔌 WebSocket closed: 1006
```

**Problem:**
You're using `https://` instead of `wss://` protocol.

**Solution:**
Change your WebSocket URL from:
```
https://projectcreatorv5.fly.dev  ❌ Wrong
```

To:
```
wss://projectcreatorv5.fly.dev  ✅ Correct
```

---

### Protocol Guide

| Protocol | Used For | Example |
|----------|----------|---------|
| `http://` | Regular web pages | `http://example.com` |
| `https://` | Secure web pages | `https://example.com` |
| `ws://` | WebSocket (insecure) | `ws://localhost:8080` |
| `wss://` | WebSocket Secure | `wss://your-app.fly.dev` |

**For Fly.io:** Always use `wss://` (secure WebSocket)
**For localhost:** Use `ws://` 

---

### 🔧 Quick Fix Steps

1. **Open Settings** in Project Creator app
2. **Go to Workload Settings** section
3. **Find WebSocket Server URL** field
4. **Update the URL:**
   - If you see `https://your-app.fly.dev`
   - Change it to `wss://your-app.fly.dev`
5. **Click "Test Connection"**
   - The app will now auto-correct `https://` to `wss://`
   - You should see: ✅ Connection successful!
6. **Click "Save Settings"**
7. **Restart the app**

---

### Auto-Correction Feature

The app now automatically corrects common URL mistakes:

| You Enter | Auto-Corrected To | Status |
|-----------|-------------------|--------|
| `https://your-app.fly.dev` | `wss://your-app.fly.dev` | ✅ Fixed |
| `http://your-app.fly.dev` | `wss://your-app.fly.dev` | ✅ Fixed |
| `your-app.fly.dev` | `wss://your-app.fly.dev` | ✅ Fixed |
| `wss://your-app.fly.dev` | No change | ✅ Correct |
| `ws://localhost:8080` | No change | ✅ Correct |

The **Test Connection** button will show what was corrected before testing.

---

### Other Common Issues

#### ❌ "Cannot connect to server"

**Symptoms:**
- Connection keeps failing
- Reconnecting repeatedly

**Possible Causes:**
1. Wrong URL
2. Server is down
3. Internet connection issues
4. Firewall blocking WebSocket

**Solutions:**
1. ✅ Verify URL starts with `wss://` for cloud or `ws://` for localhost
2. ✅ Check server is running:
   ```bash
   flyctl status
   ```
3. ✅ Test your internet connection
4. ✅ Try disabling VPN/firewall temporarily
5. ✅ Check Fly.io status: https://status.flyio.net/

---

#### ❌ "Test shows success but app won't connect"

**Problem:**
Test Connection button shows success, but real-time features don't work.

**Cause:**
The test might be checking HTTPS endpoint, not WebSocket endpoint.

**Solution:**
1. Make sure URL uses `wss://` (not `https://`)
2. Save settings after testing
3. Restart the application
4. Check Workload Dashboard for green connection indicator

---

#### ❌ Connection keeps dropping

**Symptoms:**
- Connects then disconnects
- "Reconnecting..." message repeatedly

**Possible Causes:**
1. Unstable internet connection
2. Server restarting
3. Firewall interference

**Solutions:**
1. ✅ Check your internet stability
2. ✅ Check server logs:
   ```bash
   flyctl logs
   ```
3. ✅ Try from different network
4. ✅ Contact administrator

---

### Verification Checklist

After fixing URL:

- [ ] URL starts with `wss://` (for Fly.io) or `ws://` (for localhost)
- [ ] No trailing slash at end of URL
- [ ] Test Connection shows ✅ success
- [ ] Settings saved
- [ ] Application restarted
- [ ] Workload Dashboard shows green connection indicator 🟢
- [ ] Can see other users online
- [ ] Real-time updates working

---

### Example Correct URLs

#### Fly.io (Cloud)
```
wss://projectcreatorv5.fly.dev
wss://your-app-name.fly.dev
wss://my-websocket-server.fly.dev
```

#### Localhost (Local Testing)
```
ws://localhost:8080
ws://127.0.0.1:8080
```

#### Custom Domain
```
wss://ws.yourdomain.com
wss://websocket.yourcompany.com
```

---

### Testing from Command Line

To verify your WebSocket server is running:

```bash
# Check Fly.io deployment status
flyctl status

# View server logs
flyctl logs

# Test with websocat (if installed)
websocat wss://your-app.fly.dev
```

---

### Getting Help

1. **Check this troubleshooting guide first**
2. **Verify URL format** (most common issue)
3. **Test internet connection**
4. **Check server logs** (if you're the administrator)
5. **Contact IT support** with:
   - The exact URL you're using
   - Error messages from console
   - Screenshot of settings (optional)

---

### Quick Reference

**Correct URL Format for Fly.io:**
```
wss://your-app-name.fly.dev
```

**Test Connection:**
```
Settings → Workload Settings → Test Connection
```

**View Connection Status:**
```
Workload Dashboard → Top right indicator
🟢 = Connected
🔴 = Disconnected
```

---

### Summary

**Most Common Issue:** Using `https://` instead of `wss://`

**Quick Fix:** Change protocol from `https://` to `wss://` in Settings

**Auto-Fix:** Test Connection button now auto-corrects common mistakes

**Verify:** Green indicator in Workload Dashboard means you're connected! 🟢

---

**Still having issues?** Check server logs or contact your administrator.

