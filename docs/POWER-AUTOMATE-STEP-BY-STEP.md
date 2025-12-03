# Power Automate Setup - Step-by-Step Guide

## Overview

This guide will walk you through creating Power Automate flows to enable automatic bidirectional sync between your Excel workload file and Microsoft Lists.

## Prerequisites Checklist

- [ ] Excel workload file created and stored in OneDrive for Business or SharePoint
- [ ] MS Lists created (Projects, Assignments, Users, TimeTracking)
- [ ] Power Automate access (usually included with Microsoft 365)
- [ ] Excel file has been converted to a table (Format as Table in Excel)

## Important: Convert Excel Sheets to Tables

**Before creating flows, you MUST convert your Excel sheets to tables:**

1. Open your Excel file
2. For each sheet (Projects, Assignments, Users, TimeTracking):
   - Select all data including headers
   - Go to **Insert → Table** (or press `Ctrl+T`)
   - Check "My table has headers"
   - Click **OK**
3. Name each table (right-click table → Table → Rename):
   - Projects table → "Projects"
   - Assignments table → "Assignments"
   - Users table → "Users"
   - TimeTracking table → "TimeTracking"
4. Save the file

---

## Flow 1: Excel → MS Lists (Projects Sync)

**Purpose:** When a project is added/updated in Excel, sync it to the Projects MS List.

### Step 1: Create the Flow

1. Go to [Power Automate](https://make.powerautomate.com)
2. Click **Create → Automated cloud flow**
3. Name: `Excel to Lists - Projects Sync`

### Step 2: Choose Your Trigger

**Option A: Excel Online (Business) - If Available**
- Search for trigger: **"When a row is added, modified or deleted"** (Excel Online (Business))
- If you see this option, use it and proceed to Step 3A

**Option B: Scheduled Flow (Recommended if Excel Online not available)**
- Search for trigger: **"Recurrence"** (Schedule)
- Set frequency: **Every 5 minutes** (or your preferred interval)
- This will check for changes periodically

**Option C: SharePoint File Modified (If file is in SharePoint)**
- Search for trigger: **"When a file is modified"** (SharePoint)
- Configure the SharePoint site and file path

### Step 3A: Configure Excel Online Trigger (If using Option A)

1. **Location:** Select your OneDrive for Business or SharePoint site
2. **Document Library:** Select where your Excel file is stored
3. **File:** Click the folder icon and select your workload Excel file
4. **Table:** Select "Projects" from the dropdown
5. Click **Save**

### Step 3B: Configure Scheduled Flow (If using Option B - Recommended)

1. **Frequency:** Recurrence
2. **Interval:** 5 (or your preferred number)
3. **Unit:** Minutes
4. Click **Save**

Then add action: **"List rows present in a table"** (Excel Online (Business))
- **Location:** Your OneDrive/SharePoint site
- **Document Library:** Where your Excel file is stored
- **File:** Your workload Excel file
- **Table:** "Projects"
- This gets all current rows to compare

**Note:** With scheduled flows, you'll need to track which rows have been processed. See "Advanced: Tracking Processed Rows" section below.

### Step 4: Add "Get Items" Action (SharePoint)

**IMPORTANT:** This step uses SharePoint Lists, NOT the Excel file. Excel files and SharePoint Lists are different things:
- **Excel files** are accessed using "Excel Online (Business)" actions
- **SharePoint Lists** are accessed using "SharePoint" actions

1. Click **+ New step**
2. Search for **"Get items"** (SharePoint)
3. **Site Address:** Select your SharePoint site (where your MS Lists are located)
4. **List Name:** Select your SharePoint List name (e.g., "Project Workload - Projects")
   - **This is NOT your Excel file** - it's the SharePoint List you created earlier
   - If you don't see your list, make sure:
     - The list exists in the SharePoint site you selected
     - You have permissions to access the list
     - The list name matches exactly (case-sensitive)
5. **Filter Query:** 
   ```
   ProjectID eq '@{triggerBody()?['ProjectID']}'
   ```
   (This finds if the project already exists in the SharePoint List)

**Troubleshooting: List not showing up?**
- Verify the SharePoint List exists: Go to your SharePoint site → Lists → Check if "Project Workload - Projects" exists
- Check site address: Make sure you selected the correct SharePoint site where your lists are located
- Refresh the list: Click the refresh icon next to "List Name" field
- Check permissions: Ensure you have at least "Read" access to the list

### Step 4: Add Condition

1. Click **+ New step**
2. Search for **"Condition"**
3. **Choose a value:** 
   ```
   length(body('Get_items')?['value'])
   ```
4. **Condition:** `is greater than`
5. **Value:** `0`

This checks if the project exists in MS Lists.

### Step 6: Configure "If Yes" Branch (Update Existing)

1. In the **If yes** branch, click **Add an action**
2. Search for **"Update item"** (SharePoint)
3. **Site Address:** Same as Step 3
4. **List Name:** Same as Step 3
5. **Id:** 
   ```
   first(body('Get_items')?['value'])?['Id']
   ```
6. **Title:** 
   ```
   @{triggerBody()?['ProjectName']}
   ```
7. Map all other fields:
   - **ProjectID:** `@{triggerBody()?['ProjectID']}`
   - **RFAType:** `@{triggerBody()?['RFAType']}`
   - **ProjectName:** `@{triggerBody()?['ProjectName']}`
   - **RFANumber:** `@{triggerBody()?['RFANumber']}`
   - **ProjectContainer:** `@{triggerBody()?['ProjectContainer']}`
   - **ClientName:** `@{triggerBody()?['ClientName']}`
   - **ProjectType:** `@{triggerBody()?['ProjectType']}`
   - **Status:** `@{triggerBody()?['Status']}`
   - **CreatedDate:** `@{triggerBody()?['CreatedDate']}`
   - **DueDate:** `@{triggerBody()?['DueDate']}`
   - **Priority:** `@{triggerBody()?['Priority']}`
   - **FolderPath:** `@{triggerBody()?['FolderPath']}`

### Step 7: Configure "If No" Branch (Create New)

1. In the **If no** branch, click **Add an action**
2. Search for **"Create item"** (SharePoint)
3. **Site Address:** Same as Step 3
4. **List Name:** Same as Step 3
5. **Title:** 
   ```
   @{triggerBody()?['ProjectName']}
   ```
6. Map all fields exactly as in Step 5

### Step 7: Save and Test

1. Click **Save** in the top right
2. Click **Test → Manually → Run flow**
3. Make a small change to a project row in Excel
4. Check the flow run history to verify it worked
5. Verify the item appears/updates in your MS Lists

---

## Flow 2: Excel → MS Lists (Assignments Sync)

**Purpose:** When an assignment is added/updated in Excel, sync it to the Assignments MS List.

### Steps (Similar to Flow 1)

Follow the same pattern as Flow 1, but with these changes:

1. **Flow Name:** `Excel to Lists - Assignments Sync`
2. **Trigger Table:** "Assignments"
3. **List Name:** "Project Workload - Assignments"
4. **Filter Query:** 
   ```
   AssignmentID eq '@{triggerBody()?['AssignmentID']}'
   ```
5. **Title Field:** 
   ```
   @{concat(triggerBody()?['ProjectName'], ' - ', triggerBody()?['UserName'])}
   ```
6. **Fields to Map:**
   - AssignmentID
   - ProjectID
   - ProjectName
   - RFANumber
   - UserID
   - UserName (use People Picker if your list has Person field)
   - UserEmail
   - StartDate
   - DueDate
   - HoursAllocated
   - HoursWorked
   - HoursRemaining
   - Status
   - Priority
   - Notes
   - LastUpdated
   - CompletedDate

**Note for UserName (Person field):**
If your MS List has UserName as a "Person or Group" field, use:
```
@{triggerBody()?['UserEmail']}
```
And select "Email" as the identifier type.

---

## Flow 3: MS Lists → Excel (Assignments Update)

**Purpose:** When an engineer updates an assignment in MS Lists, sync changes back to Excel.

### Step 1: Create the Flow

1. Create **Automated cloud flow**
2. Name: `Lists to Excel - Assignments Update`
3. Trigger: **"When an item is created or modified"** (SharePoint)
4. Click **Create**

### Step 2: Configure Trigger

1. **Site Address:** Your SharePoint site
2. **List Name:** "Project Workload - Assignments"
3. Click **Save**

### Step 3: Add "Get a row" Action

1. Click **+ New step**
2. Search for **"Get a row"** (Excel Online (Business))
3. **Location:** Your OneDrive/SharePoint site
4. **Document Library:** Where your Excel file is stored
5. **File:** Select your workload Excel file
6. **Table:** "Assignments"
7. **Key Column:** "AssignmentID"
8. **Key Value:** 
   ```
   @{triggerBody()?['AssignmentID']}
   ```

### Step 4: Add Condition

1. Click **+ New step**
2. Add **"Condition"**
3. **Choose a value:** 
   ```
   body('Get_a_row')?['AssignmentID']
   ```
4. **Condition:** `is not equal to`
5. **Value:** Leave empty (checks if row exists)

### Step 5: Configure "If Yes" Branch (Update Excel)

1. In **If yes**, click **Add an action**
2. Search for **"Update a row"** (Excel Online (Business))
3. **Location:** Same as Step 3
4. **Document Library:** Same as Step 3
5. **File:** Same as Step 3
6. **Table:** "Assignments"
7. **Key Column:** "AssignmentID"
8. **Key Value:** 
   ```
   @{triggerBody()?['AssignmentID']}
   ```
9. **Row updates:** Click "Show advanced options" and add:
   - **HoursWorked:** `@{triggerBody()?['HoursWorked']}`
   - **HoursRemaining:** 
     ```
     @{sub(triggerBody()?['HoursAllocated'], triggerBody()?['HoursWorked'])}
     ```
   - **Status:** `@{triggerBody()?['Status']}`
   - **Priority:** `@{triggerBody()?['Priority']}`
   - **Notes:** `@{triggerBody()?['Notes']}`
   - **LastUpdated:** 
     ```
     @{utcNow()}
     ```
   - **CompletedDate:** 
     ```
     @{if(equals(triggerBody()?['Status'], 'Completed'), utcNow(), '')}
     ```

### Step 6: Configure "If No" Branch (Create New Row)

1. In **If no**, click **Add an action**
2. Search for **"Add a row into a table"** (Excel Online (Business))
3. Configure same location/file/table as above
4. Add all assignment fields from MS Lists to Excel columns

### Step 7: Save and Test

1. Save the flow
2. Test by updating an assignment in MS Lists
3. Verify the Excel row updates

---

## Flow 4: MS Lists → Excel (TimeTracking)

**Purpose:** When time is logged in MS Lists, add it to Excel TimeTracking sheet.

### Steps

1. **Flow Name:** `Lists to Excel - TimeTracking`
2. **Trigger:** "When an item is created or modified" (SharePoint)
   - **List:** "Project Workload - TimeTracking"
3. **Action:** "Add a row into a table" (Excel)
   - **Table:** "TimeTracking"
   - **Row data:**
     - EntryID: `@{triggerBody()?['EntryID']}`
     - AssignmentID: `@{triggerBody()?['AssignmentID']}`
     - ProjectID: `@{triggerBody()?['ProjectID']}`
     - ProjectName: `@{triggerBody()?['ProjectName']}`
     - UserID: `@{triggerBody()?['UserID']}`
     - UserName: `@{triggerBody()?['UserName']}`
     - Date: `@{triggerBody()?['Date']}`
     - HoursWorked: `@{triggerBody()?['HoursWorked']}`
     - TaskDescription: `@{triggerBody()?['TaskDescription']}`
     - Notes: `@{triggerBody()?['Notes']}`
     - EntryDate: `@{utcNow()}`
     - Category: `@{triggerBody()?['Category']}`

---

## Optional: Flow 5 - Update Assignment Hours from TimeTracking

**Purpose:** When time is logged, automatically update the assignment's HoursWorked.

### Steps

1. **Flow Name:** `TimeTracking to Assignment Hours`
2. **Trigger:** "When an item is created" (SharePoint)
   - **List:** "Project Workload - TimeTracking"
3. **Action 1:** "Get items" (SharePoint)
   - **List:** "Project Workload - Assignments"
   - **Filter Query:** 
     ```
     AssignmentID eq '@{triggerBody()?['AssignmentID']}'
     ```
4. **Action 2:** "Update item" (SharePoint)
   - **List:** "Project Workload - Assignments"
   - **Id:** 
     ```
     first(body('Get_items')?['value'])?['Id']
     ```
   - **HoursWorked:** 
     ```
     @{add(first(body('Get_items')?['value'])?['HoursWorked'], triggerBody()?['HoursWorked'])}
     ```
   - **HoursRemaining:** 
     ```
     @{sub(first(body('Get_items')?['value'])?['HoursAllocated'], add(first(body('Get_items')?['value'])?['HoursWorked'], triggerBody()?['HoursWorked']))}
     ```

---

## Testing Your Flows

### Test Checklist

1. **Excel → Lists (Projects)**
   - [ ] Add a new project row in Excel
   - [ ] Verify it appears in MS Lists Projects
   - [ ] Update a project row in Excel
   - [ ] Verify the update appears in MS Lists

2. **Excel → Lists (Assignments)**
   - [ ] Add a new assignment row in Excel
   - [ ] Verify it appears in MS Lists Assignments
   - [ ] Update an assignment row in Excel
   - [ ] Verify the update appears in MS Lists

3. **Lists → Excel (Assignments)**
   - [ ] Update Status in MS Lists
   - [ ] Verify Excel row updates
   - [ ] Update HoursWorked in MS Lists
   - [ ] Verify Excel row updates

4. **Lists → Excel (TimeTracking)**
   - [ ] Add a time entry in MS Lists
   - [ ] Verify it appears in Excel TimeTracking sheet

### Troubleshooting

**Flow not triggering:**
- Ensure Excel sheets are converted to tables
- Check that the file is in OneDrive/SharePoint (not local)
- Verify table names match exactly

**Data not syncing:**
- Check flow run history for errors
- Verify field names match between Excel and MS Lists
- Check data types match (text, number, date)

**Excel file not showing in "List Name" dropdown:**
- **This is expected!** Excel files are NOT SharePoint Lists
- Use "Excel Online (Business)" actions to work with Excel files
- Use "SharePoint" actions to work with SharePoint Lists
- Make sure you've created the SharePoint Lists first (Projects, Assignments, Users, TimeTracking)
- The "List Name" field should show your SharePoint Lists, not Excel files

**Circular updates:**
- Add a condition to prevent updates if LastUpdated is very recent
- Use a flag field to indicate source of update

---

## Advanced: Prevent Circular Updates

To prevent infinite loops, add this condition at the start of Flow 3:

1. Add **"Get a row"** to read current Excel row
2. Add **"Condition"** to check:
   - **If:** Excel LastUpdated is older than MS Lists LastUpdated
   - **Then:** Proceed with update
   - **Else:** Skip update

---

## Flow Status and Monitoring

1. Go to **Power Automate → My flows**
2. Check flow status (should be "On")
3. Click on a flow to see run history
4. Check for failed runs and errors
5. Set up alerts for flow failures (optional)

---

## Next Steps

Once flows are set up and tested:

1. Enable all flows (toggle to "On")
2. Test with real data
3. Monitor for the first few days
4. Adjust field mappings if needed
5. Train engineers on using MS Lists

---

## Support

If you encounter issues:
1. Check Power Automate flow run history
2. Review error messages
3. Verify Excel table structure
4. Verify MS Lists column names match
5. Check field data types match

