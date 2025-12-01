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
- **Pur



