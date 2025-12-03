# Power Automate Quick Reference

## Common Expressions and Formulas

### Getting Trigger Data

```
@{triggerBody()?['FieldName']}
```
Example: `@{triggerBody()?['ProjectID']}`

### Getting Action Output

```
@{body('ActionName')?['FieldName']}
```
Example: `@{body('Get_items')?['value']}`

### First Item from Array

```
first(body('Get_items')?['value'])?['Id']
```

### Check if Array Has Items

```
length(body('Get_items')?['value'])
```
Returns number of items (0 if empty)

### Current Date/Time

```
@{utcNow()}
```

### Date Formatting

```
@{formatDateTime(utcNow(), 'yyyy-MM-ddTHH:mm:ssZ')}
```

### Concatenate Strings

```
@{concat(triggerBody()?['ProjectName'], ' - ', triggerBody()?['UserName'])}
```

### Math Operations

**Add:**
```
@{add(field1, field2)}
```

**Subtract:**
```
@{sub(field1, field2)}
```

**Multiply:**
```
@{mul(field1, field2)}
```

**Divide:**
```
@{div(field1, field2)}
```

### Conditional (If-Then-Else)

```
@{if(equals(triggerBody()?['Status'], 'Completed'), utcNow(), '')}
```

### Comparison Functions

**Equals:**
```
equals(field1, field2)
```

**Greater than:**
```
greater(field1, field2)
```

**Less than:**
```
less(field1, field2)
```

---

## Filter Query Examples

### SharePoint Filter Query

**Single condition:**
```
ProjectID eq '@{triggerBody()?['ProjectID']}'
```

**Multiple conditions (AND):**
```
ProjectID eq '@{triggerBody()?['ProjectID']}' and Status eq 'Active'
```

**Multiple conditions (OR):**
```
(Status eq 'Active' or Status eq 'In Progress')
```

---

## Excel Table Operations

### Get a Row

- **Key Column:** The unique identifier column (e.g., "ProjectID")
- **Key Value:** The value to search for

### Update a Row

- **Key Column:** Same as Get a row
- **Key Value:** Same as Get a row
- **Row updates:** Map fields to update

### Add a Row

- **Table:** Select table name
- **Row data:** Map all required fields

---

## Common Field Mappings

### Projects Sheet → MS Lists

| Excel Column | MS Lists Field | Expression |
|-------------|----------------|------------|
| ProjectID | ProjectID | `@{triggerBody()?['ProjectID']}` |
| RFAType | RFAType | `@{triggerBody()?['RFAType']}` |
| ProjectName | ProjectName | `@{triggerBody()?['ProjectName']}` |
| RFANumber | RFANumber | `@{triggerBody()?['RFANumber']}` |
| ProjectContainer | ProjectContainer | `@{triggerBody()?['ProjectContainer']}` |
| ClientName | ClientName | `@{triggerBody()?['ClientName']}` |
| Status | Status | `@{triggerBody()?['Status']}` |
| CreatedDate | CreatedDate | `@{triggerBody()?['CreatedDate']}` |
| DueDate | DueDate | `@{triggerBody()?['DueDate']}` |

### Assignments Sheet → MS Lists

| Excel Column | MS Lists Field | Expression |
|-------------|----------------|------------|
| AssignmentID | AssignmentID | `@{triggerBody()?['AssignmentID']}` |
| ProjectID | ProjectID | `@{triggerBody()?['ProjectID']}` |
| ProjectName | ProjectName | `@{triggerBody()?['ProjectName']}` |
| UserID | UserID | `@{triggerBody()?['UserID']}` |
| UserName | UserName | `@{triggerBody()?['UserEmail']}` (if Person field) |
| HoursAllocated | HoursAllocated | `@{triggerBody()?['HoursAllocated']}` |
| HoursWorked | HoursWorked | `@{triggerBody()?['HoursWorked']}` |
| Status | Status | `@{triggerBody()?['Status']}` |

---

## Person/Group Field Handling

When MS Lists has a "Person or Group" field:

1. Use the **email address** as the value
2. In the field mapping, select **"Email"** as the identifier type
3. Expression: `@{triggerBody()?['UserEmail']}`

---

## Date Field Handling

### Excel Date → MS Lists Date

If Excel stores dates as text:
```
@{triggerBody()?['CreatedDate']}
```

If Excel stores dates as numbers:
```
@{formatDateTime(triggerBody()?['CreatedDate'], 'yyyy-MM-ddTHH:mm:ssZ')}
```

### MS Lists Date → Excel Date

```
@{formatDateTime(triggerBody()?['CreatedDate'], 'yyyy-MM-dd')}
```

---

## Error Handling

### Add Scope for Error Handling

1. Wrap actions in a **Scope** control
2. Add **Configure run after** for failed actions
3. Add **Send an email** or **Post a message** action for notifications

### Check for Null/Empty

```
@{if(empty(triggerBody()?['FieldName']), 'DefaultValue', triggerBody()?['FieldName'])}
```

---

## Testing Expressions

Use the **"Compose"** action to test expressions:

1. Add **Compose** action
2. Enter your expression
3. Run the flow
4. Check the output

Example:
```
Inputs: @{triggerBody()?['ProjectID']}
```

---

## Flow Naming Convention

Recommended naming:
- `Excel to Lists - [SheetName] Sync`
- `Lists to Excel - [ListName] Update`
- `[Purpose] - [Source] to [Destination]`

Examples:
- `Excel to Lists - Projects Sync`
- `Lists to Excel - Assignments Update`
- `TimeTracking to Assignment Hours`

---

## Common Issues and Solutions

### Issue: Flow not triggering

**Solution:**
- Verify Excel sheets are formatted as tables
- Check file is in OneDrive/SharePoint (not local)
- Verify table names match exactly
- Check flow is enabled (toggle ON)

### Issue: "Field not found"

**Solution:**
- Verify field names match exactly (case-sensitive)
- Check field exists in both Excel and MS Lists
- Use "Compose" to inspect triggerBody() output

### Issue: Circular updates

**Solution:**
- Add condition to check LastUpdated timestamp
- Use a flag field to indicate update source
- Add delay between updates

### Issue: Date format errors

**Solution:**
- Use formatDateTime() function
- Check timezone settings
- Verify date field types match

### Issue: Person field not working

**Solution:**
- Use email address, not display name
- Select "Email" as identifier type
- Verify user exists in Azure AD

---

## Performance Tips

1. **Use filters** in "Get items" to reduce data
2. **Limit batch sizes** for large datasets
3. **Add delays** if needed to prevent throttling
4. **Use parallel branches** for independent actions
5. **Monitor flow run history** for slow operations

---

## Flow Status Icons

- ✅ **Green check:** Flow ran successfully
- ⚠️ **Yellow warning:** Flow ran with warnings
- ❌ **Red X:** Flow failed
- ⏸️ **Paused:** Flow is disabled
- 🔄 **Running:** Flow is currently executing

---

## Quick Copy-Paste Expressions

### Get ProjectID from Trigger
```
@{triggerBody()?['ProjectID']}
```

### Get First Item ID from Get Items
```
first(body('Get_items')?['value'])?['Id']
```

### Calculate Hours Remaining
```
@{sub(triggerBody()?['HoursAllocated'], triggerBody()?['HoursWorked'])}
```

### Check if Status is Completed
```
@{if(equals(triggerBody()?['Status'], 'Completed'), utcNow(), '')}
```

### Current Timestamp
```
@{utcNow()}
```

### Concatenate Project and User
```
@{concat(triggerBody()?['ProjectName'], ' - ', triggerBody()?['UserName'])}
```

---

## Next Steps After Setup

1. ✅ Test all flows with sample data
2. ✅ Monitor flow runs for 24-48 hours
3. ✅ Set up alerts for flow failures
4. ✅ Document any customizations
5. ✅ Train team on MS Lists usage


