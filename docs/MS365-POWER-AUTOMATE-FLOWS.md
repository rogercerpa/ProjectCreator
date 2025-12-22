# MS 365 Power Automate Flow Templates

## Overview

This document provides templates and instructions for creating Power Automate flows to enable bidirectional synchronization between your Excel workload file and Microsoft Lists.

## Prerequisites

- Power Automate license (included with most Microsoft 365 subscriptions)
- Excel workload file stored in OneDrive for Business or SharePoint
- Microsoft Lists created (see [MS365-WORKLOAD-SETUP.md](./MS365-WORKLOAD-SETUP.md))
- Basic understanding of Power Automate

## Flow Architecture

```
┌─────────────────────┐
│   Excel Workbook    │
│   (OneDrive/SP)     │
└──────────┬──────────┘
           │
           ├─────► Flow 1: Excel→Lists (Projects)
           ├─────► Flow 2: Excel→Lists (Assignments)
           │
           ├─────◄ Flow 3: Lists→Excel (Assignments)
           └─────◄ Flow 4: Lists→Excel (TimeTracking)
```

## Flow 1: Sync Projects from Excel to MS Lists

### Purpose
When a project is added or updated in the Excel Projects sheet, create or update the corresponding item in the Projects MS List.

### Trigger
- **When a row is added, modified or deleted** (Excel Online (Business))
  - Location: Your OneDrive/SharePoint site
  - Document Library: Select where your Excel file is stored
  - File: Select your workload Excel file
  - Table: Projects

### Actions

#### 1. List rows present in a table (Excel)
- **Purpose:** Get all existing rows to find matching project
- Location: Same as trigger
- Document Library: Same as trigger
- File: Same as trigger
- Table: Projects

#### 2. Filter array
- **Purpose:** Find if project already exists in MS Lists
- From: Use output from previous List rows
- Condition: `ProjectID` equals `triggerBody()?['ProjectID']`

#### 3. Condition: Check if project exists in MS Lists

**If Yes (Update):**
- Action: **Update item** (SharePoint)
  - Site Address: Your SharePoint site
  - List Name: Project Workload - Projects
  - Id: Use item ID from filter array
  - Title: `triggerBody()?['ProjectName']`
  - ProjectID: `triggerBody()?['ProjectID']`
  - ProjectNumber: `triggerBody()?['ProjectNumber']`
  - ProjectName: `triggerBody()?['ProjectName']`
  - RFANumber: `triggerBody()?['RFANumber']`
  - ProjectContainer: `triggerBody()?['ProjectContainer']`
  - ClientName: `triggerBody()?['ClientName']`
  - Status: `triggerBody()?['Status']`
  - CreatedDate: `triggerBody()?['CreatedDate']`
  - DueDate: `triggerBody()?['DueDate']`
  - Priority: `triggerBody()?['Priority']`
  - FolderPath: `triggerBody()?['FolderPath']`

**If No (Create):**
- Action: **Create item** (SharePoint)
  - Site Address: Your SharePoint site
  - List Name: Project Workload - Projects
  - Title: `triggerBody()?['ProjectName']`
  - (Map all other fields same as Update above)

### Error Handling
- Add **Scope** around all actions
- Add **Configure run after** for error cases
- Send notification or log to a separate error list

---

## Flow 2: Sync Assignments from Excel to MS Lists

### Purpose
When an assignment is added or updated in the Excel Assignments sheet, create or update the corresponding item in the Assignments MS List.

### Trigger
- **When a row is added, modified or deleted** (Excel Online (Business))
  - Location: Your OneDrive/SharePoint site
  - Document Library: Select where your Excel file is stored
  - File: Select your workload Excel file
  - Table: Assignments

### Actions

#### 1. Get items (SharePoint)
- **Purpose:** Get all assignments from MS Lists
- Site Address: Your SharePoint site
- List Name: Project Workload - Assignments
- Filter Query: `AssignmentID eq '` + `triggerBody()?['AssignmentID']` + `'`

#### 2. Condition: Check if assignment exists

**If Yes (Update):**
- Action: **Update item** (SharePoint)
  - Site Address: Your SharePoint site
  - List Name: Project Workload - Assignments
  - Id: Use item ID from Get items
  - Title: `triggerBody()?['ProjectName']` + ` - ` + `triggerBody()?['UserName']`
  - AssignmentID: `triggerBody()?['AssignmentID']`
  - ProjectID: `triggerBody()?['ProjectID']`
  - ProjectNumber: `triggerBody()?['ProjectNumber']`
  - ProjectName: `triggerBody()?['ProjectName']`
  - RFANumber: `triggerBody()?['RFANumber']`
  - UserID: `triggerBody()?['UserID']`
  - UserName: `triggerBody()?['UserName']` (use People Picker if email provided)
  - StartDate: `triggerBody()?['StartDate']`
  - DueDate: `triggerBody()?['DueDate']`
  - HoursAllocated: `triggerBody()?['HoursAllocated']`
  - HoursWorked: `triggerBody()?['HoursWorked']`
  - HoursRemaining: `sub(triggerBody()?['HoursAllocated'], triggerBody()?['HoursWorked'])`
  - Status: `triggerBody()?['Status']`
  - Priority: `triggerBody()?['Priority']`
  - Notes: `triggerBody()?['Notes']`
  - LastUpdated: `utcNow()`

**If No (Create):**
- Action: **Create item** (SharePoint)
  - (Map all fields same as Update above)

---

## Flow 3: Sync Assignment Updates from MS Lists to Excel

### Purpose
When an engineer updates an assignment in MS Lists (status, hours worked, notes), sync those changes back to the Excel file.

### Trigger
- **When an item is created or modified** (SharePoint)
  - Site Address: Your SharePoint site
  - List Name: Project Workload - Assignments

### Actions

#### 1. Get a row (Excel)
- **Purpose:** Find the matching row in Excel
- Location: Your OneDrive/SharePoint site
- Document Library: Select where your Excel file is stored
- File: Select your workload Excel file
- Table: Assignments
- Key Column: AssignmentID
- Key Value: `triggerBody()?['AssignmentID']`

#### 2. Condition: Check if row found

**If Yes:**
- Action: **Update a row** (Excel Online (Business))
  - Location: Same as Get a row
  - Document Library: Same as Get a row
  - File: Same as Get a row
  - Table: Assignments
  - Key Column: AssignmentID
  - Key Value: `triggerBody()?['AssignmentID']`
  - Row updates:
    - HoursWorked: `triggerBody()?['HoursWorked']`
    - HoursRemaining: `triggerBody()?['HoursRemaining']`
    - Status: `triggerBody()?['Status']`
    - Priority: `triggerBody()?['Priority']`
    - Notes: `triggerBody()?['Notes']`
    - LastUpdated: `utcNow()`
    - CompletedDate: `if(equals(triggerBody()?['Status'], 'Completed'), utcNow(), '')`

**If No:**
- Action: **Add a row into a table** (Excel)
  - Location: Same as above
  - (Create new row with all assignment data from MS Lists)

#### 3. Send notification (Optional)
- Action: **Send an email** (Office 365 Outlook)
  - To: Project Manager email
  - Subject: `Assignment Updated: ` + `triggerBody()?['ProjectName']`
  - Body: Include assignment details and changes

---

## Flow 4: Sync Time Entries from MS Lists to Excel

### Purpose
When an engineer logs time in the TimeTracking MS List, add the entry to the Excel TimeTracking sheet.

### Trigger
- **When an item is created or modified** (SharePoint)
  - Site Address: Your SharePoint site
  - List Name: Project Workload - TimeTracking

### Actions

#### 1. Get assignment details (Optional)
- **Purpose:** Get additional context about the assignment
- Action: **Get item** (SharePoint)
  - Site Address: Your SharePoint site
  - List Name: Project Workload - Assignments
  - Filter: `AssignmentID eq '` + `triggerBody()?['AssignmentID']` + `'`

#### 2. Add a row into a table (Excel)
- Location: Your OneDrive/SharePoint site
- Document Library: Select where your Excel file is stored
- File: Select your workload Excel file
- Table: TimeTracking
- Row data:
  - EntryID: `triggerBody()?['EntryID']` (or generate unique ID)
  - AssignmentID: `triggerBody()?['AssignmentID']`
  - ProjectID: `body('Get_assignment_details')?['ProjectID']` (from step 1)
  - ProjectNumber: `body('Get_assignment_details')?['ProjectNumber']`
  - ProjectName: `body('Get_assignment_details')?['ProjectName']`
  - UserID: `triggerBody()?['UserID']`
  - UserName: `triggerBody()?['UserName']`
  - Date: `triggerBody()?['Date']`
  - HoursWorked: `triggerBody()?['HoursWorked']`
  - TaskDescription: `triggerBody()?['TaskDescription']`
  - Notes: `triggerBody()?['Notes']`
  - EntryDate: `utcNow()`
  - Category: `triggerBody()?['Category']`

#### 3. Update Assignment HoursWorked (Optional)
- **Purpose:** Automatically update the assignment's HoursWorked when time is logged
- Action: **Get items** (SharePoint)
  - Site Address: Your SharePoint site
  - List Name: Project Workload - Assignments
  - Filter Query: `AssignmentID eq '` + `triggerBody()?['AssignmentID']` + `'`
- Action: **Update item** (SharePoint)
  - Site Address: Your SharePoint site
  - List Name: Project Workload - Assignments
  - Id: `first(body('Get_items')?['value'])?['Id']`
  - HoursWorked: `add(first(body('Get_items')?['value'])?['HoursWorked'], triggerBody()?['HoursWorked'])`
  - HoursRemaining: `sub(first(body('Get_items')?['value'])?['HoursAllocated'], add(first(body('Get_items')?['value'])?['HoursWorked'], triggerBody()?['HoursWorked']))`

### Error Handling
- Add **Scope** around all actions
- Add **Configure run after** for error cases
- Log errors to a separate error list or send email notification

---

## Flow 5: Update Assignment Hours from TimeTracking (Alternative)

### Purpose
When time is logged in TimeTracking, automatically aggregate and update the assignment's total HoursWorked.

### Trigger
- **When an item is created** (SharePoint)
  - Site Address: Your SharePoint site
  - List Name: Project Workload - TimeTracking

### Actions

#### 1. Get items (SharePoint) - Get all time entries for this assignment
- Site Address: Your SharePoint site
- List Name: Project Workload - TimeTracking
- Filter Query: `AssignmentID eq '` + `triggerBody()?['AssignmentID']` + `'`

#### 2. Calculate total hours
- Action: **Compose** (Data operation)
  - Inputs: Use **Apply to each** to sum all HoursWorked values
  - Expression: `sum(body('Get_items')?['value'], item()?['HoursWorked'])`

#### 3. Get assignment details
- Action: **Get items** (SharePoint)
  - Site Address: Your SharePoint site
  - List Name: Project Workload - Assignments
  - Filter Query: `AssignmentID eq '` + `triggerBody()?['AssignmentID']` + `'`

#### 4. Update assignment
- Action: **Update item** (SharePoint)
  - Site Address: Your SharePoint site
  - List Name: Project Workload - Assignments
  - Id: `first(body('Get_assignment_details')?['value'])?['Id']`
  - HoursWorked: Use the calculated total from step 2
  - HoursRemaining: `sub(first(body('Get_assignment_details')?['value'])?['HoursAllocated'], <calculated_total>)`
  - LastUpdated: `utcNow()`

---

## Common Expressions and Formulas

### Getting Trigger Data
```
@{triggerBody()?['FieldName']}
```

### Getting Action Output
```
@{body('ActionName')?['FieldName']}
```

### First Item from Array
```
first(body('Get_items')?['value'])?['Id']
```

### Check if Array Has Items
```
length(body('Get_items')?['value'])
```

### Date Formatting
```
@{formatDateTime(utcNow(), 'yyyy-MM-ddTHH:mm:ssZ')}
```

### Math Operations
- Add: `@{add(field1, field2)}`
- Subtract: `@{sub(field1, field2)}`
- Multiply: `@{mul(field1, field2)}`
- Divide: `@{div(field1, field2)}`

### Conditional Logic
```
@{if(equals(triggerBody()?['Status'], 'Completed'), utcNow(), '')}
```

For more expressions, see [POWER-AUTOMATE-QUICK-REFERENCE.md](./POWER-AUTOMATE-QUICK-REFERENCE.md).

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

5. **TimeTracking → Assignment Hours (if Flow 5 implemented)**
   - [ ] Add multiple time entries for same assignment
   - [ ] Verify assignment HoursWorked is updated correctly

---

## Troubleshooting

### Flow Not Triggering
- Ensure Excel sheets are formatted as tables
- Check file is in OneDrive/SharePoint (not local)
- Verify table names match exactly
- Check flow is enabled (toggle ON)

### Data Not Syncing
- Check flow run history for errors
- Verify field names match between Excel and MS Lists
- Check data types match (text, number, date)
- Verify filter queries are correct

### Circular Updates
- Add condition to check LastUpdated timestamp
- Use a flag field to indicate update source
- Add delay between updates if needed

### Date Format Errors
- Use `formatDateTime()` function
- Check timezone settings
- Verify date field types match

---

## Performance Tips

1. **Use filters** in "Get items" to reduce data
2. **Limit batch sizes** for large datasets
3. **Add delays** if needed to prevent throttling
4. **Use parallel branches** for independent actions
5. **Monitor flow run history** for slow operations

---

## Security Best Practices

1. **Use secure connections** - Ensure SharePoint site uses HTTPS
2. **Limit permissions** - Flows should have minimum required permissions
3. **Validate data** - Add validation steps before updating
4. **Error handling** - Always include error handling and logging
5. **Audit logs** - Monitor flow runs for suspicious activity

---

## Next Steps

After setting up flows:

1. ✅ Test all flows with sample data
2. ✅ Monitor flow runs for 24-48 hours
3. ✅ Set up alerts for flow failures
4. ✅ Document any customizations
5. ✅ Train team on MS Lists usage

---

## Additional Resources

- [Power Automate Documentation](https://docs.microsoft.com/power-automate/)
- [MS Lists Documentation](https://support.microsoft.com/en-us/office/get-started-with-microsoft-lists-10b12560-fb20-471e-9258-773aec6a4a2)
- [Excel Online API](https://docs.microsoft.com/connectors/excelonlinebusiness/)
- [POWER-AUTOMATE-QUICK-REFERENCE.md](./POWER-AUTOMATE-QUICK-REFERENCE.md) - Quick reference for expressions
- [POWER-AUTOMATE-STEP-BY-STEP.md](./POWER-AUTOMATE-STEP-BY-STEP.md) - Detailed step-by-step guide
- [POWER-AUTOMATE-EXCEL-ALTERNATIVE.md](./POWER-AUTOMATE-EXCEL-ALTERNATIVE.md) - Alternative approach if Excel trigger unavailable

---

**Last Updated**: December 2024  
**Version**: 1.0.0



