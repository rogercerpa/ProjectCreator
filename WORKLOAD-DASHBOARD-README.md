# 📊 Workload Dashboard - Quick Start Guide

## **What is This?**

A real-time workload management dashboard that replaces your manual Google Sheets workflow. See team capacity, assignments, and workload in one place with automatic updates.

---

## 🚀 **Quick Start (5 Minutes)**

### **1. Install Dependencies**
```bash
npm install
```

### **2. Build the App**
```bash
npm run build
npm start
```

### **3. Open Workload Dashboard**
- Click **📊 Workload Dashboard** in the sidebar
- Dashboard will load (may be empty initially)

### **4. Configure Settings**
- Go to **Settings** → **Workload** tab
- Click **Browse** to select shared folder
- Enter your name and email
- Click **Save Workload Settings**

**That's it! You're ready to use the dashboard.**

---

## 📱 **Main Features**

### ✅ **What It Does**
- View team workload in Day/Week/Month views
- See who's online (green dot) vs offline (red dot)
- Track capacity with color-coded bars (green = available, red = over capacity)
- Get notifications when projects are assigned
- Works offline, syncs automatically via OneDrive
- Optional real-time updates via WebSocket

### 🎯 **Key Views**
- **Day View:** Detailed single-day view
- **Week View:** Monday-Friday grid (default)
- **Month View:** Full month calendar

### 🎨 **Visual Indicators**
- **Status Colors:** Gray (Assigned) → Orange (In Progress) → Blue (In QC) → Green (Complete)
- **Capacity:** Green (available) → Blue (good) → Orange (at capacity) → Red (overloaded)
- **Priority:** 🔥 Urgent, ⬆️ High, ⬇️ Low

---

## ⚙️ **Configuration**

### **Settings → Workload Tab**

1. **Shared Folder Path**
   - Click Browse
   - Select OneDrive folder (create if needed)
   - All team members use same path

2. **User Profile**
   - Enter your name
   - Enter your email
   - Set weekly capacity (default: 40 hours)

3. **WebSocket Server (Optional)**
   - Leave default: `ws://localhost:8080`
   - Or enter your server URL
   - Click Test Connection

4. **Notifications**
   - ☑ Show Notifications
   - ☐ Only Notify for My Assignments

5. **Save Settings**
   - Click **Save Workload Settings**

---

## 🌐 **Optional: WebSocket Server**

For instant real-time updates, run the WebSocket server:

### **Option A: Local (Free)**
```bash
cd server
npm install
npm start
```
Server runs on port 8080

### **Option B: Skip It**
App works perfectly without the server! You'll still get updates via file sync (30-60 second delay).

---

## 👥 **Multi-User Setup**

### **First User (You)**
1. Configure settings (above)
2. Share folder path with team
3. Add team members (see below)

### **Other Team Members**
1. Install app
2. Open Settings → Workload
3. Set shared folder path (same as you)
4. Enter their profile info
5. Save settings
6. Open dashboard

---

## 📝 **Adding Team Members**

Team members are stored in: `{home}\.project-creator\shared\users.json`

**Option 1: Manual (Quick)**
1. Navigate to shared folder
2. Open `users.json`
3. Add user:
```json
{
  "users": [
    {
      "id": "user-001",
      "name": "John Smith",
      "email": "john@acuity.com",
      "role": "Designer",
      "weeklyCapacity": 40,
      "isActive": true
    }
  ]
}
```

**Option 2: Let Users Add Themselves**
- Each user enters their profile in Settings
- Saved automatically to shared folder

---

## 🎯 **Using the Dashboard**

### **View Team Workload**
- Open dashboard
- See all users and their assignments
- Green bars = available capacity
- Orange/Red bars = at/over capacity

### **Filter and Search**
- Select team (All/Designer/Manager/QC)
- Search by name
- Change view (Day/Week/Month)

### **Navigate Dates**
- Click ◀ Previous / Next ▶
- Click **Today** to jump to current date

### **View Details**
- Click any assignment card
- See project details
- Hours allocated vs spent
- Due date and priority

---

## 🔔 **Notifications**

When WebSocket is connected, you'll see notifications for:
- New project assignments
- Status changes
- Workload updates

**Notification appears bottom-right, auto-dismisses after 5 seconds.**

---

## 💾 **Data & Backup**

### **Data Location**
```
C:\Users\{username}\.project-creator\shared\
├── workload.json
├── users.json
├── assignments.json
└── backups\
```

### **Create Backup**
- Settings → Workload → Create Backup button
- Saved to `backups\` subfolder
- Includes all data files

### **Restore from Backup**
1. Navigate to backups folder
2. Copy desired backup files
3. Replace current files in shared folder

---

## 🐛 **Troubleshooting**

### **Dashboard is Empty**
- Normal on first launch
- Add team members (see above)
- Projects with "Assigned To" will appear automatically

### **"Not connected to real-time server"**
- Normal if WebSocket server not running
- App still works via file sync
- Start server if you want instant updates

### **Changes not syncing**
- Check OneDrive sync status (green checkmark)
- Verify all users use same folder path
- Wait 30-60 seconds for OneDrive to sync

### **Can't browse for folder**
- Manually enter path in Settings
- Format: `C:\Users\...\OneDrive\ProjectCreator\Shared`

---

## 📊 **Status Colors Reference**

### **Assignment Status**
- **Gray:** ASSIGNED (not started)
- **Orange:** IN PROGRESS (working on it)
- **Blue:** IN QC (quality check)
- **Green:** COMPLETE (done)
- **Red:** PAUSE (on hold)

### **Capacity Levels**
- **Green (0-59%):** Available
- **Blue (60-79%):** Good utilization
- **Orange (80-99%):** At capacity
- **Red (100%+):** Overloaded

---

## 💡 **Pro Tips**

1. **Start without WebSocket server** - Add it later if needed
2. **Use OneDrive** - Automatic sync, no server setup
3. **Create backups weekly** - One-click in Settings
4. **Check capacity bars** - Redistribute if anyone is red
5. **Filter by team** - Focus on specific roles

---

## 📞 **Need Help?**

1. Check **Troubleshooting** section above
2. Review full docs in `docs/` folder:
   - `WORKLOAD-DASHBOARD-IMPLEMENTATION.md` - Technical details
   - `WORKLOAD-IMPLEMENTATION-COMPLETE.md` - Complete guide
   - `FINAL-IMPLEMENTATION-SUMMARY.md` - Full overview
3. Check console logs (F12 → Console tab)

---

## ✅ **Checklist for Success**

- [ ] Installed dependencies (`npm install`)
- [ ] Built and ran app (`npm run build && npm start`)
- [ ] Opened dashboard from sidebar
- [ ] Configured Settings → Workload tab
- [ ] Set shared folder path
- [ ] Entered user profile
- [ ] Saved settings
- [ ] (Optional) Started WebSocket server
- [ ] Added team members
- [ ] Dashboard showing team workload

---

## 🎉 **You're All Set!**

The Workload Dashboard is now ready to use. Share the folder path with your team and start tracking workload in real-time!

**Questions?** Check the detailed documentation in the `docs/` folder.

**Enjoy your new workload dashboard!** 📊✨

