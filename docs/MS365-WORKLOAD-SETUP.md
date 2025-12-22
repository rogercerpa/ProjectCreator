# MS 365 Workload Integration Setup Guide

## Overview

This guide will help you configure the MS 365 workload integration for the Project Creator application. This integration enables seamless collaboration between project managers using the app and engineers using Microsoft Lists.

## Architecture

```
Project Creator App → Excel Workload File ↔ MS Lists
         ↑                                      ↓
         └──────── Power Automate Flows ←──────┘
```

**Data Flow:**
1. Project managers create projects in the app
2. App pushes data to an Excel workload file
3. Excel syncs with MS Lists (via Power Automate or manual refresh)
4. Engineers view and update workload in MS Lists
5. Changes sync back to Excel
6. App imports updates from Excel

## Prerequisites

- **Microsoft 365 subscription** with access to:
  - Excel Online or Excel Desktop
  - Microsoft Lists
  - Power Automate (for automatic sync)
- **OneDrive for Business** or **SharePoint** to host the Excel file
- **Project Creator application** version 2.0 or later

## Step-by-Step Setup

### Step 1: Configure Field Mapping

Before setting up the Excel file, configure which data fields should be included:

1. Open the **Project Creator application**
2. Navigate to **Settings → Workload**
3. Locate the **Field Mapping Configuration** section
4. For each sheet (Projects, Assignments, Users, TimeTracking):
   - Review the default field mappings
   - Enable/disable specific fields as needed
   - Customize the Excel column names if desired
5. Click **Save Mapping** to persist your configuration
6. Optionally, click **Export Template** to generate an Excel template with your custom mapping

**Recommended Fields:**

**Projects Sheet:**
- ProjectID (Required)
- ProjectNumber (Required)
- ProjectName (Required)
- RFANumber
- ProjectContainer
- ClientName
- Status (Required)
- DueDate
- AssignedTo
- Priority

**Assignments Sheet:**
- AssignmentID (Required)
- ProjectID (Required)
- ProjectName
- UserID (Required)
- UserName
- Status (Required)
- HoursAllocated
- HoursWorked
- DueDate

### Step 2: Create the Excel Workload File

#### Option A: Generate from App (Recommended)

1. In **Settings → Workload → Excel Configuration**
2. Click **Browse** to select a location (OneDrive/SharePoint recommended)
3. Enter a filename (e.g., `ProjectWorkload.xlsx`)
4. Click **Export Template** to create the file with proper structure

#### Option B: Manual Creation

If you prefer to create the file manually:

1. Create a new Excel workbook
2. Create the following sheets: **Projects**, **Assignments**, **Users**, **TimeTracking**
3. Add column headers matching your field mapping configuration
4. Save the file to **OneDrive for Business** or **SharePoint**

**Important:** The file must be stored in OneDrive or SharePoint for Power Automate integration.

### Step 3: Configure App Excel Settings

1. In **Settings → Workload → Excel Configuration**
2. **File Path:** Enter the full path to your Excel file
   - For local files: `C:\Users\YourName\OneDrive\ProjectWorkload.xlsx`
   - For SharePoint: Use the local sync path if available
3. Click **Test Connection** to verify the file is accessible
4. Click **Save Settings**

### Step 4: Enable Sync

1. In **Settings → Workload → Sync Settings**
2. Toggle **Enable Excel Sync** to ON
3. Choose sync mode:
   - **Manual:** Sync only when you click "Sync Now"
   - **Automatic:** App monitors the file and syncs automatically
4. If using automatic mode, set **Sync Interval** (recommended: 30 seconds)
5. Click **Save Settings**

### Step 5: Initial Data Export

Export existing workload data to the Excel file:

1. Navigate to **Workload Dashboard**
2. Click **Export to Excel** in the Quick Actions panel
3. Verify data appears correctly in the Excel file
4. Check that all configured fields are populated

### Step 6: Create MS Lists

Now create the Microsoft Lists that engineers will use:

#### Projects List

1. Go to **Microsoft Lists** (lists.microsoft.com)
2. Click **New List** → **Blank list**
3. Name it: **Project Workload - Projects**
4. Add columns matching your Excel Projects sheet:
   - **ProjectID** (Single line of text) - Set as Title or add separately
   - **ProjectNumber** (Single line of text)
   - **ProjectName** (Single line of text)
   - **RFANumber** (Single line of text)
   - **ProjectContainer** (Single line of text)
   - **ClientName** (Single line of text)
   - **Status** (Choice: Not Started, In Progress, On Hold, Completed)
   - **CreatedDate** (Date and time)
   - **DueDate** (Date and time)
   - **AssignedTo** (Person or Group - allow multiple)
   - **Priority** (Choice: Low, Medium, High, Critical)
   - **FolderPath** (Single line of text)

#### Assignments List

1. Create another list: **Project Workload - Assignments**
2. Add columns matching your Excel Assignments sheet:
   - **AssignmentID** (Single line of text)
   - **ProjectID** (Single line of text)
   - **ProjectNumber** (Single line of text)
   - **ProjectName** (Single line of text)
   - **RFANumber** (Single line of text)
   - **UserID** (Single line of text)
   - **UserName** (Person or Group)
   - **UserEmail** (Single line of text)
   - **StartDate** (Date and time)
   - **DueDate** (Date and time)
   - **HoursAllocated** (Number)
   - **HoursWorked** (Number)
   - **HoursRemaining** (Number with formula: `=HoursAllocated-HoursWorked`)
   - **Status** (Choice: Not Started, In Progress, On Hold, Completed, Blocked)
   - **Priority** (Choice: Low, Medium, High, Critical)
   - **Notes** (Multiple lines of text)
   - **LastUpdated** (Date and time)
   - **CompletedDate** (Date and time)

#### Users List (Optional)

Create **Project Workload - Users** if you want to manage team capacity:

- **UserID** (Single line of text)
- **UserName** (Person or Group)
- **Email** (Single line of text)
- **Role** (Choice: Engineer, PM, Admin, etc.)
- **WeeklyCapacity** (Number - hours per week)
- **Region** (Single line of text)
- **Team** (Single line of text)
- **IsActive** (Yes/No)

#### TimeTracking List (Optional)

Create **Project Workload - TimeTracking** for detailed time tracking:

- **EntryID** (Single line of text)
- **AssignmentID** (Single line of text)
- **ProjectID** (Single line of text)
- **ProjectNumber** (Single line of text)
- **ProjectName** (Single line of text)
- **UserID** (Single line of text)
- **UserName** (Person or Group)
- **Date** (Date and time)
- **HoursWorked** (Number)
- **TaskDescription** (Multiple lines of text)
- **Notes** (Multiple lines of text)
- **Category** (Choice: Design, Development, Testing, Review, etc.)

### Step 7: Set Up Power Automate Flows

See the companion guide: **[MS365-POWER-AUTOMATE-FLOWS.md](./MS365-POWER-AUTOMATE-FLOWS.md)** for detailed flow templates.

**Summary of required flows:**

1. **Excel → MS Lists (Projects)**: When a row is added/updated in Excel Projects sheet, create/update item in Projects list
2. **Excel → MS Lists (Assignments)**: When a row is added/updated in Excel Assignments sheet, create/update item in Assignments list
3. **MS Lists → Excel (Assignments)**: When an assignment item is updated in MS Lists, update the corresponding row in Excel
4. **MS Lists → Excel (TimeTracking)**: When a time entry is added in MS Lists, add a row to Excel TimeTracking sheet

### Step 8: Configure MS Lists URL in App

1. Copy the URL of your MS Lists (e.g., `https://yourtenant.sharepoint.com/sites/YourSite/Lists/ProjectWorkloadAssignments`)
2. In **Project Creator → Settings → Workload → MS Lists Integration**
3. Paste the URL in the **MS Lists URL** field
4. Click **Save Settings**
5. Test by clicking **Open in MS Lists** from the Workload Dashboard

### Step 9: Test the Integration

#### Test 1: App → Excel → MS Lists

1. In Project Creator, create a new test project
2. Assign it to a user
3. Check the Excel file - verify the project and assignment appear
4. Check MS Lists - verify the items appear (may take a few minutes for Power Automate)

#### Test 2: MS Lists → Excel → App

1. In MS Lists, find an assignment
2. Update the **Status** and **HoursWorked** fields
3. Wait a few minutes for Power Automate to sync (or trigger manually if using scheduled flow)
4. Check the Excel file - verify the changes appear in the Assignments sheet
5. In Project Creator, click **Sync Now** in the Workload Dashboard
6. Verify the changes appear in the app

#### Test 3: Bidirectional Sync

1. Make a change in the app (e.g., update project status)
2. Click **Export to Excel**
3. Verify change appears in Excel
4. Verify change syncs to MS Lists (via Power Automate)
5. Make a change in MS Lists
6. Verify change syncs to Excel (via Power Automate)
7. Click **Sync Now** in the app
8. Verify change appears in the app

---

## Troubleshooting

### Excel File Not Found

**Problem:** App can't find or access the Excel file

**Solutions:**
1. ✅ Verify the file path is correct
2. ✅ Check file permissions (read/write access)
3. ✅ Ensure file is not open in Excel
4. ✅ For OneDrive files, ensure OneDrive is synced
5. ✅ Try using the full absolute path

### Data Not Syncing to MS Lists

**Problem:** Changes in Excel don't appear in MS Lists

**Solutions:**
1. ✅ Verify Power Automate flows are enabled
2. ✅ Check flow run history for errors
3. ✅ Ensure Excel file is in OneDrive/SharePoint (not local)
4. ✅ Verify Excel sheets are formatted as tables
5. ✅ Check table names match exactly
6. ✅ Verify field names match between Excel and MS Lists

### Data Not Syncing from MS Lists

**Problem:** Changes in MS Lists don't appear in Excel or app

**Solutions:**
1. ✅ Verify Power Automate flows are enabled
2. ✅ Check flow run history for errors
3. ✅ Ensure Excel file is accessible to Power Automate
4. ✅ Verify field names match between MS Lists and Excel
5. ✅ Check data types match (text, number, date)
6. ✅ Try manual sync: Click "Sync Now" in the app

### Circular Updates

**Problem:** Changes trigger infinite update loops

**Solutions:**
1. ✅ Add LastUpdated timestamp comparison in flows
2. ✅ Use a flag field to indicate update source
3. ✅ Add delay between updates in Power Automate
4. ✅ Implement conflict resolution logic

### Field Mapping Issues

**Problem:** Data appears in wrong columns or is missing

**Solutions:**
1. ✅ Verify field mapping configuration matches Excel columns
2. ✅ Check Excel column headers match exactly (case-sensitive)
3. ✅ Ensure required fields are mapped
4. ✅ Verify data types match (string, number, date)
5. ✅ Check for special characters in field names

---

## Best Practices

### Excel File Management

1. **Single Source of Truth**: Use one Excel file per team/project
2. **Regular Backups**: Keep backups of Excel file before major changes
3. **Table Format**: Always format sheets as Excel tables
4. **Column Headers**: Use consistent, clear column names
5. **Data Validation**: Add data validation rules in Excel where possible

### Power Automate Flows

1. **Error Handling**: Always include error handling in flows
2. **Monitoring**: Regularly check flow run history
3. **Alerts**: Set up alerts for flow failures
4. **Testing**: Test flows with sample data before production use
5. **Documentation**: Document any customizations to flows

### MS Lists Configuration

1. **Permissions**: Set appropriate permissions for team members
2. **Views**: Create custom views for different user roles
3. **Validation**: Use column validation rules where possible
4. **Formulas**: Use calculated columns for derived values (e.g., HoursRemaining)
5. **Notifications**: Configure notifications for important changes

### Sync Strategy

1. **Manual Sync**: Use manual sync for critical updates
2. **Automatic Sync**: Enable automatic sync for convenience
3. **Sync Frequency**: Balance sync frequency with performance
4. **Conflict Resolution**: Establish process for handling conflicts
5. **Data Integrity**: Regularly verify data consistency

---

## Workflow Examples

### Project Manager Workflow

1. Create new project in Project Creator app
2. Assign project to team members
3. Click **Export to Excel** to push to Excel/MS Lists
4. Engineers see assignments in MS Lists
5. Periodically click **Sync Now** to pull updates from engineers

### Engineer Workflow

1. Open MS Lists to view assigned work
2. Update assignment status and hours worked
3. Add notes and comments
4. Changes automatically sync to Excel (via Power Automate)
5. Project manager syncs app to see updates

### Team Lead Workflow

1. Monitor workload in MS Lists
2. Reassign work as needed
3. Track progress and capacity
4. Use Excel for reporting and analysis
5. Coordinate with project managers via app

---

## Maintenance

### Regular Tasks

- **Weekly**: Review flow run history for errors
- **Monthly**: Verify data consistency between app, Excel, and MS Lists
- **Quarterly**: Review and update field mappings if needed
- **As Needed**: Update Power Automate flows for new requirements

### Monitoring

- **Flow Runs**: Check Power Automate flow run history regularly
- **Data Sync**: Verify sync is working by checking timestamps
- **Error Logs**: Review error logs in app and Power Automate
- **User Feedback**: Collect feedback from team members

---

## Support and Resources

### Documentation

- [MS365-POWER-AUTOMATE-FLOWS.md](./MS365-POWER-AUTOMATE-FLOWS.md) - Detailed flow templates
- [MS365-WORKLOAD-IMPLEMENTATION-SUMMARY.md](./MS365-WORKLOAD-IMPLEMENTATION-SUMMARY.md) - Implementation details
- [POWER-AUTOMATE-QUICK-REFERENCE.md](./POWER-AUTOMATE-QUICK-REFERENCE.md) - Expression reference
- [POWER-AUTOMATE-STEP-BY-STEP.md](./POWER-AUTOMATE-STEP-BY-STEP.md) - Step-by-step flow creation

### External Resources

- [Microsoft Power Automate Docs](https://docs.microsoft.com/power-automate/)
- [MS Lists Documentation](https://support.microsoft.com/en-us/office/get-started-with-microsoft-lists-10b12560-fb20-471e-9258-773aec6a4a2)
- [Excel Online API](https://docs.microsoft.com/connectors/excelonlinebusiness/)

### Getting Help

1. Check troubleshooting section above
2. Review Power Automate flow run history
3. Test Excel file path and permissions
4. Verify MS Lists configuration
5. Check application logs for errors
6. Contact IT support if issues persist

---

## Next Steps

After completing setup:

1. ✅ Test all workflows with sample data
2. ✅ Train team members on MS Lists usage
3. ✅ Set up monitoring and alerts
4. ✅ Document any customizations
5. ✅ Establish maintenance schedule

---

**Last Updated**: December 2024  
**Version**: 1.0.0



