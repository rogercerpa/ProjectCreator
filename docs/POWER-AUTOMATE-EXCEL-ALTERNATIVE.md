# Power Automate - Excel Alternative Approach

## Problem
The "Excel Online (Business)" connector with "When a row is added, modified or deleted" trigger is not available in all Power Automate environments.

## Solution: Use Scheduled Flow with Change Detection

Since the Excel trigger isn't available, we'll use a **scheduled flow** that periodically checks for changes in your Excel file.

---

## Flow 1: Excel → MS Lists (Projects Sync) - Scheduled Approach

### Step 1: Create Scheduled Flow

1. Go to [Power Automate](https://make.powerautomate.com)
2. Click **Create → Automated cloud flow**
3. Name: `Excel to Lists - Projects Sync (Scheduled)`
4. Search for trigger: **"Recurrence"** (Schedule)
5. Click **Create**

### Step 2: Configure Recurrence Trigger

1. **Frequency:** Recurrence
2. **Interval:** `5` (or your preferred number)
3. **Unit:** `Minutes`
4. Click **Save**

**Note:** You can adjust the interval based on how often you need sync (5 minutes, 15 minutes, 1 hour, etc.)

### Step 3: Get All Excel Rows

1. Click **+ New step**
2. Search for **"List rows present in a table"** (Excel Online (Business))
   - If you don't see this, try **"Get table"** or **"List rows"**
3. **Location:** Select your OneDrive for Business or SharePoint site
4. **Document Library:** Select where your Excel file is stored
5. **File:** Click the folder icon and select your workload Excel file
6. **Table:** Select "Projects" from the dropdown

### Step 4: Get All MS Lists Items

1. Click **+ New step**
2. Search for **"Get items"** (SharePoint)
3. **Site Address:** Select your SharePoint site
4. **List Name:** Select "Project Workload - Projects"
5. **Top Count:** `5000` (or a large number to get all items)

### Step 5: Process Each Excel Row

1. Click **+ New step**
2. Search for **"Apply to each"** (Control)
3. **Select an output from previous steps:** 
   - Click in the field
   - Select **"value"** from the "List rows present in a table" action

### Step 6: Check if Item Exists in MS Lists

Inside the "Apply to each" loop:

1. Click **Add an action**
2. Search for **"Filter array"** (Data operation)
3. **From:** 
   ```
   body('Get_items')?['value']
   ```
4. **Filter query:**
   ```
   @equals(item()?['ProjectID'], items('Apply_to_each')?['ProjectID'])
   ```

### Step 7: Add Condition

1. Click **Add an action**
2. Search for **"Condition"** (Control)
3. **Choose a value:**
   ```
   length(body('Filter_array'))
   ```
4. **Condition:** `is greater than`
5. **Value:** `0`

### Step 8: Configure "If Yes" Branch (Update Existing)

1. In the **If yes** branch, click **Add an action**
2. Search for **"Update item"** (SharePoint)
3. **Site Address:** Your SharePoint site
4. **List Name:** "Project Workload - Projects"
5. **Id:** 
   ```
   first(body('Filter_array'))?['Id']
   ```
6. **Title:** 
   ```
   items('Apply_to_each')?['ProjectName']
   ```
7. Map all fields from Excel row to MS Lists:
   - **ProjectID:** `items('Apply_to_each')?['ProjectID']`
   - **RFAType:** `items('Apply_to_each')?['RFAType']`
   - **ProjectName:** `items('Apply_to_each')?['ProjectName']`
   - **RFANumber:** `items('Apply_to_each')?['RFANumber']`
   - **ProjectContainer:** `items('Apply_to_each')?['ProjectContainer']`
   - **ClientName:** `items('Apply_to_each')?['ClientName']`
   - **ProjectType:** `items('Apply_to_each')?['ProjectType']`
   - **Status:** `items('Apply_to_each')?['Status']`
   - **CreatedDate:** `items('Apply_to_each')?['CreatedDate']`
   - **DueDate:** `items('Apply_to_each')?['DueDate']`
   - **Priority:** `items('Apply_to_each')?['Priority']`
   - **FolderPath:** `items('Apply_to_each')?['FolderPath']`

### Step 9: Configure "If No" Branch (Create New)

1. In the **If no** branch, click **Add an action**
2. Search for **"Create item"** (SharePoint)
3. **Site Address:** Your SharePoint site
4. **List Name:** "Project Workload - Projects"
5. **Title:** 
   ```
   items('Apply_to_each')?['ProjectName']
   ```
6. Map all fields exactly as in Step 8

### Step 10: Save and Test

1. Click **Save** in the top right
2. Click **Test → Manually → Run flow**
3. Check the flow run history
4. Verify items are created/updated in MS Lists

---

## Important Notes

### Performance Considerations

- **Interval:** Start with 15-30 minutes to avoid hitting API limits
- **Batch Processing:** This processes all rows each time - consider adding logic to only process changed rows
- **Error Handling:** Add error handling for failed updates

### Optimization: Track Last Sync Time

To avoid processing all rows every time, you can:

1. Store last sync timestamp in a variable or separate list
2. Compare Excel row's `LastUpdated` field with stored timestamp
3. Only process rows modified after the last sync

### Alternative: Use SharePoint File Modified Trigger

If your Excel file is in SharePoint, you can use:

1. **Trigger:** "When a file is modified" (SharePoint)
2. **Site Address:** Your SharePoint site
3. **Library Name:** Where your Excel file is stored
4. **File:** Your workload Excel file

This triggers when the file is saved, but you'll still need to process all rows to find what changed.

---

## Flow 2: Excel → MS Lists (Assignments Sync)

Follow the same pattern as Flow 1, but:
- **Table:** "Assignments"
- **List Name:** "Project Workload - Assignments"
- **Filter by:** `AssignmentID` instead of `ProjectID`

---

## Troubleshooting

**Issue: "List rows present in a table" not available**
- Try: **"Get table"** or **"List rows"** actions
- Or use: **"Get a row"** in a loop (less efficient)

**Issue: Flow runs too slowly**
- Increase the recurrence interval
- Add filtering to only process changed rows
- Consider using Power Automate Premium for better performance

**Issue: Too many API calls**
- Increase recurrence interval
- Add error handling and retry logic
- Consider batching operations

---

## Next Steps

Once you have the scheduled flow working:
1. Test with a few rows first
2. Monitor the flow runs for errors
3. Adjust the recurrence interval based on your needs
4. Set up similar flows for Assignments, Users, and TimeTracking


