# 🚀 Quick Start: Deploy to Fly.io

**5-minute guide to get your WebSocket server live on Fly.io - FREE TIER**

---

## Why Fly.io?

- ✅ **True free tier** - 3 VMs, 256MB RAM each
- ✅ **Always-on** - No sleeping like Render/Glitch
- ✅ **WebSocket support** - Native and seamless
- ✅ **Auto SSL** - Automatic HTTPS/WSS certificates
- ✅ **Global network** - Fast everywhere

**Perfect for your WebSocket server!**

---

## Prerequisites

- ✅ Fly.io account (free) - [Sign up](https://fly.io/app/sign-up)
- ✅ Code ready in your `server` directory

---

## Deploy in 5 Steps

### 1️⃣ Install Fly CLI

**Windows (PowerShell):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

**Mac/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

**Verify installation:**
```bash
flyctl version
```

### 2️⃣ Login to Fly.io

```bash
flyctl auth login
```

This will open your browser - sign in or create account (free).

### 3️⃣ Navigate to Server Directory

```bash
cd server
```

### 4️⃣ Initialize Fly App

```bash
flyctl launch
```

**Answer the prompts:**
- **App name:** Hit Enter for auto-generated or choose a name
- **Region:** Choose closest to your team (e.g., `iad` for US East)
- **PostgreSQL database:** **No** (we don't need it)
- **Redis:** **No** (we don't need it)
- **Deploy now:** **Yes**

Fly.io will:
- Auto-detect Node.js
- Create `fly.toml` configuration
- Deploy your app
- Give you a URL like: `your-app.fly.dev`

### 5️⃣ Get Your WebSocket URL

After deployment completes:

```bash
flyctl status
```

Your URL will be shown. Your WebSocket URL is:
```
wss://your-app-name.fly.dev
```

---

## ✅ Done!

Your server is now live on Fly.io's free tier!

---

## Configure Your App

1. Open **Project Creator** application
2. Go to **Settings** → **Workload Settings**
3. Update **WebSocket Server URL** to:
   ```
   wss://your-app-name.fly.dev
   ```
4. Click **"Test Connection"** ✅
5. Click **"Save Settings"**

---

## View Logs

To see your server logs:

```bash
cd server
flyctl logs
```

You should see:
```
✅ WebSocket server started on 0.0.0.0:8080
📊 Max clients: 100
```

---

## Useful Commands

```bash
# View app status
flyctl status

# View logs (live)
flyctl logs

# View logs (historical)
flyctl logs --history

# Restart app
flyctl apps restart your-app-name

# Open app in browser
flyctl open

# SSH into app
flyctl ssh console

# View app info
flyctl info

# Scale app (if needed)
flyctl scale count 2

# Update app after code changes
flyctl deploy
```

---

## Environment Variables

To set environment variables:

```bash
flyctl secrets set LOG_LEVEL=info
flyctl secrets set MAX_CLIENTS=100
flyctl secrets set NODE_ENV=production
```

**Note:** `PORT` is automatically set by Fly.io (your code already handles this!)

---

## Free Tier Limits

Fly.io free tier includes:
- ✅ 3 shared-cpu VMs (1x small VM for you)
- ✅ 256MB RAM per VM
- ✅ 3GB persistent storage
- ✅ 160GB outbound bandwidth/month

**Your WebSocket server uses:**
- ~50-100MB RAM
- Minimal storage
- Low bandwidth (text messages only)

**You'll easily stay within free tier!** 🎉

---

## Troubleshooting

### "Connection refused"

**Check if app is running:**
```bash
flyctl status
```

If not running:
```bash
flyctl apps restart your-app-name
```

### "Cannot connect to wss://"

**Verify URL format:**
- ✅ `wss://your-app.fly.dev` (correct)
- ❌ `ws://your-app.fly.dev` (wrong - not secure)
- ❌ `https://your-app.fly.dev` (wrong - not WebSocket)

### "Deployment failed"

**Check logs:**
```bash
flyctl logs
```

**Common issues:**
- Missing `package.json` - Make sure you're in `server` directory
- Port binding - Your code already handles this correctly
- Dependencies - Run `npm install` locally first to verify

### "App keeps crashing"

**View crash logs:**
```bash
flyctl logs --history
```

**Check configuration:**
```bash
flyctl config display
```

---

## Update Your App

When you make code changes:

```bash
cd server
flyctl deploy
```

Fly.io will rebuild and redeploy automatically.

---

## Custom Domain (Optional)

To use your own domain (e.g., `ws.yourdomain.com`):

```bash
flyctl certs add ws.yourdomain.com
```

Then update your DNS with the provided records.

---

## Monitoring

### View Metrics

```bash
flyctl dashboard
```

This opens the web dashboard showing:
- Request count
- Response times
- Memory usage
- CPU usage

### Set Up Alerts (Future)

Fly.io can alert you when:
- App crashes
- Memory usage high
- CPU usage high

Configure in dashboard: https://fly.io/dashboard

---

## Scaling (If Needed)

### Increase Memory (still free within limits)

```bash
flyctl scale memory 512
```

### Add More Instances

```bash
flyctl scale count 2
```

**Note:** Multiple instances use your free tier allowance.

### Deploy to Multiple Regions (Advanced)

```bash
flyctl regions add lax sea
```

Great for teams in different locations!

---

## Costs

**Free Tier (Your Current Usage):**
- ✅ 1 VM running 24/7
- ✅ 256MB RAM
- ✅ All traffic for 10-50 users
- **Cost: $0/month**

**If You Exceed Free Tier:**
- Extra VMs: ~$1.94/month each
- Extra bandwidth: $0.02/GB
- Estimated: $0-5/month even with growth

---

## Comparison: Fly.io vs Railway

| Feature | Fly.io | Railway |
|---------|--------|---------|
| Free Tier | ✅ Yes | ❌ No (databases only) |
| Always On | ✅ Yes | ✅ Yes |
| WebSocket | ✅ Yes | ✅ Yes |
| Auto SSL | ✅ Yes | ✅ Yes |
| Deployment | CLI | GitHub |
| Cost (free) | $0 | N/A |
| Cost (paid) | $2-5 | $5-10 |

**Winner: Fly.io** for free tier! 🏆

---

## Next Steps

1. ✅ Deploy to Fly.io (done!)
2. ✅ Get WebSocket URL
3. ✅ Test connection from your app
4. ✅ Share URL with team
5. ✅ Monitor usage and costs

---

## Support Resources

- **Fly.io Docs:** https://fly.io/docs/
- **Fly.io Community:** https://community.fly.io/
- **Status Page:** https://status.flyio.net/

---

## Quick Reference

### Essential Commands
```bash
flyctl launch          # Initial deployment
flyctl deploy          # Redeploy after changes
flyctl logs            # View logs
flyctl status          # Check status
flyctl dashboard       # Open web dashboard
flyctl ssh console     # SSH into server
```

### Your WebSocket URL
```
wss://your-app-name.fly.dev
```

### Configuration File
After `flyctl launch`, you'll have a `fly.toml` file with your app config.

---

## Success Checklist

- [ ] Fly CLI installed
- [ ] Logged into Fly.io
- [ ] Deployed app (`flyctl launch`)
- [ ] Got WebSocket URL
- [ ] Tested connection from app ✅
- [ ] Shared URL with team
- [ ] Verified real-time features working

---

## 🎉 Congratulations!

Your WebSocket server is now live on Fly.io - **completely free!**

All team members can now connect from anywhere and get real-time updates.

**Questions?** Check Fly.io docs or run `flyctl help`

**Need to update?** Just run `flyctl deploy`

**Happy deploying! 🚀**

