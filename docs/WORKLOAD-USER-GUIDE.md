# Workload Dashboard - User Guide

## Quick Start Guide

### First-Time Setup

1. **Configure Your Profile**
   - Open the app
   - Click **Settings** in the sidebar
   - Click **Workload** tab
   - Enter:
     - Your Name (e.g., "John Doe")
     - Your Email (e.g., "john.doe@acuity.com")
     - Weekly Capacity (default: 40 hours)
   - Click **Save Changes**

2. **Configure Shared Directory** (One-time, per team)
   - In Settings → Workload
   - Click **Browse** next to "Shared Data Directory"
   - Select your OneDrive shared folder:
     - Example: `C:\Users\YourName\OneDrive\SharedWorkload`
   - All team members must use the SAME folder
   - Click **Save Changes**

3. **Start Using the Dashboard**
   - Click **Workload Dashboard** in sidebar
   - You're ready to go! 🎉

---

## How to Assign a Project to Someone

1. Click **"➕ Assign Project"** button (top-right)
2. **Select Project**: Choose from your existing projects
3. **Assign To**: Select the user (team member)
4. **Start Date**: When should they start?
5. **Due Date**: When is it due?
6. **Hours Allocated**: How many hours will it take? (e.g., 8)
7. **Priority**: Choose Low, Medium, High, or Urgent
8. **Notes** (Optional): Add any instructions
9. Click **"Create Assignment"**

✅ **Result**: The project immediately appears on that user's workload!

---

## How to View Workloads

### View Everyone's Workload (Default)
- Open Workload Dashboard
- You'll see a grid with:
  - **Each row** = One team member
  - **Columns** = Dates (Day/Week/Month)
  - **Cards** = Project assignments
  - **Capacity bar** = How busy they are

### View One Person's Workload
1. Look at top-right filters
2. Click **User Filter** dropdown
3. Select person's name (e.g., "Jane Smith")
4. Grid now shows only Jane's workload

### Change Time View
- Click **Day** / **Week** / **Month** buttons
  - **Day**: See assignments by each day
  - **Week**: See assignments across the week
  - **Month**: See assignments across the month

---

## Understanding the Workload Grid

### Project Assignment Cards

Each card shows:
- 📋 **Project Name** (e.g., "ABC Corp RFA-001")
- ⏰ **Hours**: How many hours allocated
- 📅 **Due Date**: When it's due
- 🎨 **Color**: Priority level
  - 🟢 Green = Low priority
  - 🟡 Yellow = Medium priority
  - 🟠 Orange = High priority
  - 🔴 Red = Urgent

### Capacity Bar

Shows how busy each person is:
- **Green** (< 80%): Available capacity
- **Yellow** (80-100%): At capacity
- **Red** (> 100%): Overloaded!

---

## Real-Time Features

### Live Updates
- 🟢 **Green dot** = Connected to live server
- When someone assigns a project, you see it instantly
- When someone updates an assignment, it syncs automatically

### Notifications
- Get toast notifications when:
  - ✅ You're assigned a new project
  - 📝 An assignment is updated
  - 👥 Another user comes online

---

## Common Use Cases

### 1. "I need to see if John is available this week"
1. Select **Week** view
2. Filter by **John** in user dropdown
3. Look at his capacity bar
4. Check assignment cards

### 2. "I want to assign 3 projects to Sarah"
1. Click **"➕ Assign Project"**
2. Select first project → Assign to Sarah → Submit
3. Click **"➕ Assign Project"** again
4. Select second project → Assign to Sarah → Submit
5. Repeat for third project

### 3. "Show me everyone's workload for next month"
1. Click **Month** view
2. Click **▶** (next arrow) to go to next month
3. Keep **User Filter** on "All Users"
4. Review the grid

### 4. "I need to see all overdue projects"
1. Look at the stats bar at top
2. See **"Overdue"** number
3. Overdue projects show in **red** on the grid

---

## Tips & Best Practices

### ✅ DO:
- Set up your profile before using the dashboard
- Use realistic hour estimates
- Update project status as you work
- Check workload before assigning new projects
- Use priorities to highlight urgent work

### ❌ DON'T:
- Assign projects without checking user's capacity
- Forget to set due dates
- Ignore overdue assignments
- Change shared directory path once set up

---

## Troubleshooting

### "I can't see my assignments"
- **Check**: Did you configure your profile in Settings → Workload?
- **Check**: Is your email correct?
- **Check**: Are you looking at the right date range?

### "Dashboard shows 'Offline'"
- **Fix**: Check WebSocket server URL in Settings → Workload
- **Fix**: Click Test Connection
- Note: You can still use the dashboard offline, just no real-time updates

### "Other users can't see my assignments"
- **Check**: Are you using the same shared directory?
- **Check**: Is OneDrive syncing? (Look for cloud icon)
- **Wait**: OneDrive might take a few seconds to sync

### "Someone's workload looks wrong"
- Click **🔄 Refresh** button
- This reloads all data from shared folder

---

## Keyboard Shortcuts

Currently none, but coming soon!

---

## Need Help?

1. Check Settings → Workload for configuration
2. Click **Test Connection** to verify setup
3. Try **Refresh** button to reload data
4. Check OneDrive sync status

---

## What's Next?

Future features coming:
- Drag & drop assignments
- Bulk assignment
- Export to Excel
- Email notifications
- Mobile view
- Assignment templates

---

**Last Updated**: October 13, 2025
**Version**: 1.0.0

Enjoy your new Workload Dashboard! 📊✨

