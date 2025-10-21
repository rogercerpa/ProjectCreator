# 🚀 Refactoring Quick Start Guide

**Updated for v5.0.97** - All instructions tested and ready to use!

This guide will get you started with safe refactoring in **under 30 minutes**.

---

## ⚡ Quick Setup (15 minutes)

### Step 1: Create Safety Backup (2 minutes)

```bash
# Create backup branch
git checkout -b backup/pre-refactor-v5.0.97
git push origin backup/pre-refactor-v5.0.97

# Tag current version
git tag v5.0.97-stable
git push origin v5.0.97-stable

# Create develop branch
git checkout main
git checkout -b develop
git push -u origin develop
```

### Step 2: Document Baseline (5 minutes)

```bash
# Record current metrics
echo "=== BASELINE METRICS ===" > BASELINE.txt
echo "Date: $(date)" >> BASELINE.txt
echo "Version: 5.0.97" >> BASELINE.txt
echo "" >> BASELINE.txt

# Test results
echo "=== Test Results ===" >> BASELINE.txt
npm test 2>&1 | tee -a BASELINE.txt

# Build size
echo "" >> BASELINE.txt
echo "=== Build Size ===" >> BASELINE.txt
npm run build
# On Windows PowerShell:
# (Get-ChildItem dist -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB

# App startup test
echo "" >> BASELINE.txt
echo "=== App Starts Successfully ===" >> BASELINE.txt
echo "✓ Manual verification required" >> BASELINE.txt

cat BASELINE.txt
```

### Step 3: Install Development Tools (8 minutes)

```bash
# Install tools
npm install --save-dev husky lint-staged prettier eslint

# Setup git hooks (if on Linux/Mac)
npx husky install
npx husky add .husky/pre-commit "node scripts/safety-check.js"

# On Windows, you'll add hooks manually or use:
# npm pkg set scripts.prepare="husky install"

# Configure package.json scripts (already done!)
# npm pkg set scripts.lint="eslint src --ext .js,.jsx"
# npm pkg set scripts.format="prettier --write \"src/**/*.{js,jsx,css}\""
# npm pkg set scripts.safety-check="node scripts/safety-check.js"

# Test the setup
npm run safety-check
```

✅ **Setup Complete!** You now have safety nets in place.

---

## 🎯 Your First Refactor (15 minutes)

Let's do a simple, safe refactor to get comfortable with the process.

### Mini-Project: Extract One IPC Handler

We'll extract just ONE IPC handler as a test run.

#### Step 1: Create Feature Branch (1 min)

```bash
git checkout develop
git checkout -b refactor/extract-first-ipc-handler
```

#### Step 2: Create Handler Directory (1 min)

```bash
mkdir -p handlers
```

#### Step 3: Extract ONE Handler (5 min)

**Create**: `handlers/project.js`

```javascript
/**
 * Project IPC Handlers
 * Extracted from main.js during refactoring
 * Version: 5.0.97+
 */

function registerProjectHandlers(ipcMain, services) {
  const { projectPersistenceService } = services;

  // Extract just this one handler as a test
  ipcMain.handle('projects-load-all', async () => {
    try {
      const projects = await projectPersistenceService.loadProjects();
      return {
        success: true,
        projects: projects,
        count: projects.length,
        message: `${projects.length} projects loaded successfully`
      };
    } catch (error) {
      console.error('Error loading all projects:', error);
      return { 
        success: false, 
        error: error.message,
        projects: []
      };
    }
  });
}

module.exports = { registerProjectHandlers };
```

#### Step 4: Update main.js (3 min)

At the top of `main.js`, add:

```javascript
// Import handlers
const { registerProjectHandlers } = require('./handlers/project');
```

In the `app.whenReady()` section, find where handlers are registered and add:

```javascript
app.whenReady().then(async () => {
  // ... existing initialization code ...
  
  // Register project handlers
  registerProjectHandlers(ipcMain, {
    projectPersistenceService
  });
  
  // ... rest of the code ...
  
  createWindow();
});
```

Then, **comment out** (don't delete yet) the original handler in main.js:

Find this block around line 379-396 and comment it out:

```javascript
// MOVED TO handlers/project.js
// ipcMain.handle('projects-load-all', async () => {
//   try {
//     const projects = await projectPersistenceService.loadProjects();
//     return {
//       success: true,
//       projects: projects,
//       count: projects.length,
//       message: `${projects.length} projects loaded successfully`
//     };
//   } catch (error) {
//     console.error('Error loading all projects:', error);
//     return { 
//       success: false, 
//       error: error.message,
//       projects: []
//     };
//   }
// });
```

#### Step 5: Test (5 min)

```bash
# Run safety check
npm run safety-check

# If passed, test manually
npm start

# Test the specific feature:
# 1. Click "View Projects" in sidebar (or "📋 View Projects" on welcome screen)
# 2. Projects should load normally
# 3. No console errors
# 4. Test creating a new project
# 5. Verify it appears in the list
```

#### Step 6: Commit (2 min)

```bash
# If everything works
git add handlers/project.js main.js
git commit -m "refactor(ipc): Extract projects-load-all handler

- Moved projects-load-all IPC handler to handlers/project.js
- No behavior changes, only code organization
- Tested: Projects list loads correctly
- All tests pass
- Version: 5.0.97

This is the first step in extracting all IPC handlers from main.js.
Future commits will extract remaining handlers.

Relates-to: REFACTOR-PHASE1-IPC"
```

#### Step 7: Verify & Merge (2 min)

```bash
# Push to remote
git push -u origin refactor/extract-first-ipc-handler

# If all good, merge to develop
git checkout develop
git merge refactor/extract-first-ipc-handler

# Delete feature branch
git branch -d refactor/extract-first-ipc-handler
git push origin --delete refactor/extract-first-ipc-handler
```

🎉 **Congratulations!** You've completed your first safe refactor!

---

## 📅 Next Steps

Now that you've proven the process works, you can continue:

### Option 1: Continue with IPC Handlers (Recommended)

Extract more handlers following the same pattern. **Your new WebSocket handlers are great candidates!**

```bash
# Day 1: Remaining project handlers (5-10 handlers)
# Day 2: Workload handlers (15-20 handlers)
# Day 3: WebSocket handlers (NEW! 8-10 handlers) ⭐
# Day 4: Agency handlers (10-15 handlers)
# Day 5: Email handlers (10-15 handlers)
# Day 6: Settings handlers (5-10 handlers)
```

**Suggested next extraction - WebSocket handlers** (since they're new):

**Create**: `handlers/websocket.js`

```javascript
/**
 * WebSocket IPC Handlers
 * Manages real-time communication for workload dashboard
 * Version: 5.0.97+
 */

function registerWebSocketHandlers(ipcMain, services) {
  const { webSocketService } = services;

  // Connection management
  ipcMain.handle('websocket:connect', async (event, serverUrl, userId, userName) => {
    try {
      const result = webSocketService.connect(serverUrl, userId, userName);
      // ... setup event handlers ...
      return result;
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      return { success: false, error: error.message };
    }
  });

  // ... more websocket handlers ...
}

module.exports = { registerWebSocketHandlers };
```

**Estimated time**: 1 week to extract all handlers

### Option 2: Jump to Service Consolidation

If you're comfortable, tackle the monitoring services:

```bash
git checkout -b refactor/consolidate-monitoring-services
# Follow Phase 1, Week 2, Day 1-2 in REFACTORING-PLAN.md
```

**Estimated time**: 2-3 days

### Option 3: Start Performance Optimizations

If you want quick wins:

```bash
git checkout -b refactor/optimize-project-list
# Follow Phase 2, Week 1, Day 2-3 in REFACTORING-PLAN.md
```

**Estimated time**: 1-2 days

---

## 🛡️ Safety Reminders

### Before Every Commit

```bash
# Run safety check
npm run safety-check

# Manual smoke test (2 minutes)
npm start
# 1. App opens
# 2. Create a test project
# 3. View projects list
# 4. Open settings
# 5. Test WebSocket features (workload dashboard) ⭐ NEW
# 6. No console errors
```

### If Something Breaks

```bash
# Quick rollback
git reset --hard HEAD~1

# Or reset to known good state
git reset --hard v5.0.97-stable

# Rebuild and restart
npm install
npm run build
npm start
```

### Daily Checklist

- [ ] Start day: `git pull origin develop`
- [ ] Create feature branch for day's work
- [ ] Make small commits (1-2 hour chunks)
- [ ] Run `npm run safety-check` before each commit
- [ ] Manual test after each commit (especially WebSocket features)
- [ ] End day: Push branch, create PR if ready
- [ ] Weekly: Merge to develop, test thoroughly

---

## 📊 Tracking Progress

### Keep a Log

Create a `REFACTORING-LOG.md` file:

```markdown
# Refactoring Log

## Starting Point
- Version: 5.0.97
- Date: [Today's Date]
- Main.js: 2,037 lines
- Services: 41
- Recent additions: WebSocket integration, Smart assignments

## Week 1: IPC Handler Extraction

### Day 1 - [Date]
- ✅ Extracted projects-load-all handler
- ✅ Tested successfully
- ✅ Merged to develop
- 🔄 Next: Extract remaining project handlers

### Day 2 - [Date]
- ✅ Extracted 10 more project handlers
- ⚠️ Found issue with revision handlers (fixed)
- ✅ All tests passing
- 🔄 Next: Start WebSocket handlers

... continue logging ...
```

### Metrics to Track

Update these weekly:

```markdown
## Week 1 Metrics (v5.0.97 baseline)
- Lines of code in main.js: 2,037 → 1,850 (-187)
- Number of services: 41 → 41 (no change yet)
- Test coverage: 70% → 71% (+1%)
- Build size: [measure] → [measure]
- App startup time: ~2.5s → ~2.5s (no change)
- WebSocket connection time: [measure] ⭐ NEW
```

---

## ⚙️ Useful Commands

```bash
# Safety check before commit
npm run safety-check

# Run tests
npm test

# Build and check for errors
npm run build

# Format code (after installing prettier)
npm run format

# Check code style (after installing eslint)
npm run lint

# Clean rebuild
rm -rf node_modules dist .webpack_cache
npm install
npm run build

# Windows: Check file sizes
powershell -Command "(Get-ChildItem dist -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB"

# Windows: Find large files
powershell -Command "Get-ChildItem src -Recurse | Where-Object {$_.Length -gt 100KB} | Select-Object FullName, @{Name='Size(KB)';Expression={[math]::Round($_.Length/1KB,2)}}"

# Check git status
git status

# View recent commits
git log --oneline -10

# See what changed
git diff

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1
```

---

## 🎯 Success Criteria

You'll know you're succeeding when:

- ✅ Commits are small and frequent
- ✅ Tests pass consistently
- ✅ App runs after every change
- ✅ Code is more organized
- ✅ You feel confident in your changes
- ✅ Rollbacks are rare
- ✅ The team understands your changes
- ✅ **WebSocket features still work perfectly** ⭐

---

## 🏁 Ready to Start?

Run these commands to begin:

```bash
# 1. Setup safety infrastructure (if not done)
# On Windows, git hooks need manual setup
npm install --save-dev husky lint-staged prettier eslint

# 2. Create your first feature branch
git checkout develop
git checkout -b refactor/my-first-extraction

# 3. Make your first small change
# (Follow "Your First Refactor" section above)

# 4. Test it
npm run safety-check
npm start

# 5. Commit it
git add .
git commit -m "refactor: my first safe refactor"

# 6. Celebrate! 🎉
echo "I did it!"
```

---

**Remember**: Slow and steady wins the race. It's better to make small, safe progress than to break things trying to go fast.

**Special note**: Your new WebSocket features are valuable - the safety framework ensures you won't break them during refactoring!

Good luck! You've got this! 💪


