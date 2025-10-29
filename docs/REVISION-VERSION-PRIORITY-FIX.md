# Revision Version Priority Fix

## Date
October 28, 2025

## Critical Bug Fix: Wrong Revision Folder Selected

### Problem Description

The revision creation process was copying files from **incorrect revision folders**. Specifically, when creating a new revision, the application would select an **older revision** (e.g., revision 4) instead of the **latest revision** (e.g., revision 5).

#### Real-World Example

**Project:** JIA TERMINAL EXPANSION - CONCOURSE B_22-49977  
**Location:** `Z:\2022 Projects\J\JIA TERMINAL EXPANSION - CONCOURSE B_22-49977`

**Available Revision Folders:**
- `RFA#246631-0_LAYOUT_09222023` (version 0)
- `RFA#246631-2_LAYOUT_11042024` (version 2)
- `RFA#246631-3_LAYOUT_07112025` (version 3)
- `RFA#246631-4_LAYOUT_08012025` (version 4)
- `RFA#246631-5_BOM (with Layout)_09162025` (version 5, **LATEST**)

**User Action:** Created a new LAYOUT revision

**Expected Behavior:** Copy from `RFA#246631-5_BOM (with Layout)_09162025` (latest revision)

**Actual Behavior (BEFORE FIX):** Copied from `RFA#246631-4_LAYOUT_08012025` (older revision)

**Result:** ❌ Missing files from the latest revision, causing data loss and rework

---

## Root Cause Analysis

### The Flawed Selection Logic

The `RFATypeMatchingService` was using the following sorting priority:

1. **PRIMARY:** RFA Type Match Score (80-100 for exact matches, 60-80 for partial)
2. **SECONDARY:** Date from folder name

**The Problem:**
- Revision 4: `RFA#246631-4_LAYOUT_08012025` → Match Score: **100** (exact LAYOUT match)
- Revision 5: `RFA#246631-5_BOM (with Layout)_09162025` → Match Score: **60** (partial match)

Because revision 4 had a **higher match score**, it was selected even though revision 5 was the **latest version**.

### Why Version Number Was Ignored

The code **extracted** version numbers but **never used them for sorting**. The sorting logic in `findBestRFATypeMatches()` was:

```javascript
// OLD (BUGGY) LOGIC
const sortedFolders = scoredFolders.sort((a, b) => {
  if (a.matchScore !== b.matchScore) {
    return b.matchScore - a.matchScore; // Higher score first ❌
  }
  
  // If scores are equal, sort by date
  const dateA = this.extractDateFromRFAName(a.name);
  const dateB = this.extractDateFromRFAName(b.name);
  
  if (dateA && dateB) {
    return dateB.getTime() - dateA.getTime();
  }
  
  return 0;
});
```

**Version numbers were completely missing from the sort criteria!**

---

## The Solution

### New Sorting Priority (Version-First)

The fix implements a **version-first** sorting strategy:

1. **PRIMARY:** Version Number (highest first) ✅ **NEW**
2. **SECONDARY:** RFA Type Match Score
3. **TERTIARY:** Date from folder name

### Code Changes

#### 1. Extract Version Number During Scoring

**File:** `main-process/services/RFATypeMatchingService.js` and `src/services/RFATypeMatchingService.js`

```javascript
// NEW: Extract version number and include it in scored folders
const scoredFolders = rfaFolders.map(folder => {
  const folderRFAType = this.extractRFATypeFromFolder(folder.name);
  const scoreResult = this.calculateRFATypeScore(formRFAType, folderRFAType);
  const version = this.extractRFAVersionFromFolder(folder.name); // ✅ NEW

  return {
    ...folder,
    rfaType: folderRFAType,
    matchScore: scoreResult.score,
    matchType: scoreResult.type,
    matchReasoning: scoreResult.reasoning,
    version: version // ✅ NEW
  };
});
```

#### 2. Version-First Sorting Logic

```javascript
// CRITICAL FIX: Sort by VERSION NUMBER FIRST
const sortedFolders = scoredFolders.sort((a, b) => {
  // 1. Primary sort: Version number (highest first) ✅ NEW
  const versionA = a.version !== null ? a.version : -1;
  const versionB = b.version !== null ? b.version : -1;
  
  if (versionA !== versionB) {
    return versionB - versionA; // Higher version first
  }
  
  // 2. Secondary sort: RFA type match score (if versions are equal)
  if (a.matchScore !== b.matchScore) {
    return b.matchScore - a.matchScore;
  }
  
  // 3. Tertiary sort: Date (if both version and score are equal)
  const dateA = this.extractDateFromRFAName(a.name);
  const dateB = this.extractDateFromRFAName(b.name);
  
  if (dateA && dateB) {
    return dateB.getTime() - dateA.getTime();
  }
  
  return 0;
});
```

#### 3. Add Version Extraction Method

```javascript
/**
 * Extract RFA version number from folder name
 * @param {string} folderName - RFA folder name (e.g., "RFA#246631-5_BOM_02012025")
 * @returns {number|null} Version number or null if not found
 */
extractRFAVersionFromFolder(folderName) {
  try {
    // Pattern: RFA#[number]-[version]_[TYPE]_[DATE]
    const match = folderName.match(/RFA#\d+-(\d+)/i);
    
    if (match) {
      const version = parseInt(match[1], 10);
      console.log(`🔢 Extracted RFA version ${version} from folder: ${folderName}`);
      return version;
    }
    
    console.warn(`⚠️ Could not extract RFA version from folder: ${folderName}`);
    return null;
  } catch (error) {
    console.error(`❌ Error extracting RFA version from ${folderName}:`, error);
    return null;
  }
}
```

#### 4. Updated Selection Strategy

The `selectBestRFAFolder()` method now prioritizes version numbers:

```javascript
selectBestRFAFolder(formRFAType, rfaFolders) {
  // ... validation code ...

  const scoredFolders = this.findBestRFATypeMatches(formRFAType, rfaFolders);
  const bestFolder = scoredFolders[0];

  // With version-first sorting, the first folder is ALWAYS the latest revision
  
  // Scenario 1: Latest revision with high RFA type match (best case)
  if (bestFolder.matchScore >= 80) {
    return {
      selectedFolder: bestFolder,
      strategy: 'auto_version_and_type_match',
      confidence: 'high',
      reasoning: `Latest revision (v${bestFolder.version}) with matching RFA type: ${bestFolder.matchReasoning}`,
      requiresManualSelection: false,
      allFolders: scoredFolders
    };
  }

  // Scenario 2: Latest revision with medium RFA type match
  if (bestFolder.matchScore >= 60) {
    return {
      selectedFolder: bestFolder,
      strategy: 'auto_version_priority',
      confidence: 'high',
      reasoning: `Latest revision (v${bestFolder.version}) selected. ${bestFolder.matchReasoning}`,
      requiresManualSelection: false,
      allFolders: scoredFolders
    };
  }

  // Scenario 3: Latest revision but weak RFA type match (still auto-select)
  return {
    selectedFolder: bestFolder,
    strategy: 'auto_version_priority',
    confidence: 'medium',
    reasoning: `Latest revision (v${bestFolder.version}) selected. Note: RFA type differs from form (${formRFAType} vs ${bestFolder.rfaType})`,
    requiresManualSelection: false,
    allFolders: scoredFolders
  };
}
```

#### 5. Enhanced RFA Type Extraction

Fixed the regex to support RFA types with spaces and parentheses:

```javascript
extractRFATypeFromFolder(folderName) {
  try {
    // Pattern: RFA#[number]-[version]_[TYPE]_[DATE]
    // Note: TYPE can contain spaces and parentheses (e.g., "BOM (with Layout)")
    const match = folderName.match(/RFA#\d+-\d+_([^_]+)_\d{8}/i);
    
    if (match) {
      const rfaType = match[1].trim().toUpperCase();
      console.log(`📋 Extracted RFA type "${rfaType}" from folder: ${folderName}`);
      return rfaType;
    }
    // ... error handling ...
  }
}
```

---

## Verification Test Results

### Test Scenario (User's Exact Case)

```
Available folders:
  - RFA#246631-0_LAYOUT_09222023
  - RFA#246631-2_LAYOUT_11042024
  - RFA#246631-3_LAYOUT_07112025
  - RFA#246631-4_LAYOUT_08012025
  - RFA#246631-5_BOM (with Layout)_09162025

Form RFA Type: LAYOUT
```

### Test Results

**Sorting Output (Version → Match Score → Date):**
```
1. RFA#246631-5_BOM (with Layout)_09162025
   Version: 5, Match Score: 60, RFA Type: BOM (WITH LAYOUT)
2. RFA#246631-4_LAYOUT_08012025
   Version: 4, Match Score: 100, RFA Type: LAYOUT
3. RFA#246631-3_LAYOUT_07112025
   Version: 3, Match Score: 100, RFA Type: LAYOUT
4. RFA#246631-2_LAYOUT_11042024
   Version: 2, Match Score: 100, RFA Type: LAYOUT
5. RFA#246631-0_LAYOUT_09222023
   Version: 0, Match Score: 100, RFA Type: LAYOUT
```

**Selection Result:**
- **Selected Folder:** `RFA#246631-5_BOM (with Layout)_09162025` ✅
- **Strategy:** `auto_version_priority`
- **Confidence:** `high`
- **Reasoning:** `Latest revision (v5) selected. partial match: "LAYOUT" → "BOM (WITH LAYOUT)"`

**Verification:** ✅ **SUCCESS** - Correctly selected revision 5 (latest version)

---

## Impact Assessment

### What This Fixes

1. ✅ **Always copies from the latest revision** regardless of RFA type differences
2. ✅ **Prevents data loss** from missing files in older revisions
3. ✅ **Maintains continuity** in project evolution
4. ✅ **Supports mixed RFA types** (e.g., LAYOUT → BOM with Layout)
5. ✅ **Provides clear reasoning** in console logs for debugging

### Behavioral Changes

#### Before Fix
- **Primary criterion:** RFA type matching
- **Result:** Could select older revisions with exact RFA type match over newer revisions with different types

#### After Fix
- **Primary criterion:** Version number (highest first)
- **Result:** Always selects the latest revision, regardless of RFA type matching

### Edge Cases Handled

1. **Missing version numbers:** Treated as version -1, sorted last
2. **Equal versions:** Falls back to RFA type match score
3. **Equal versions and scores:** Falls back to date sorting
4. **RFA types with spaces/parentheses:** Correctly extracted (e.g., "BOM (with Layout)")

---

## Files Modified

1. `main-process/services/RFATypeMatchingService.js` - Main process version
2. `src/services/RFATypeMatchingService.js` - Renderer process version

### Methods Changed

- `findBestRFATypeMatches()` - Updated sorting logic
- `selectBestRFAFolder()` - Updated selection strategy
- `extractRFATypeFromFolder()` - Enhanced regex pattern
- `extractRFAVersionFromFolder()` - **NEW METHOD** added

---

## Testing Recommendations

### Manual Testing Checklist

- [x] Test with exact RFA type match (LAYOUT → LAYOUT)
- [x] Test with different RFA type (LAYOUT → BOM with Layout)
- [x] Test with multiple revisions (0, 2, 3, 4, 5)
- [x] Test with RFA types containing spaces and parentheses
- [x] Verify console logs show correct version extraction
- [x] Verify latest revision is always selected

### Automated Testing

Consider adding unit tests for:
1. Version extraction from various folder name formats
2. Sorting behavior with different version/score combinations
3. Selection strategy for edge cases

---

## Recommendations for Users

### Best Practices

1. **Always review the selected folder** in the console logs before proceeding
2. **Check the version number** in the reasoning message
3. **Verify file completeness** after revision creation
4. **Report any mismatches** between expected and actual source folders

### What to Watch For

The application will now log detailed information:
```
🔢 Extracted RFA version 5 from folder: RFA#246631-5_BOM (with Layout)_09162025
✅ RFA matching results (sorted by version → match score → date):
   1. RFA#246631-5_BOM (with Layout)_09162025 (version: 5, ...)
```

Look for:
- ✅ Correct version extraction
- ✅ Latest version listed first
- ✅ Selection reasoning mentions correct version number

---

## Related Documentation

- `docs/REVISION-FOLDER-NAMING-FIX.md` - Project folder naming pattern fixes
- `docs/REVISION-MANUAL-SELECTION-FIX.md` - Manual revision selection improvements
- `docs/SMART-ASSIGNMENT-COMPLETE.md` - Smart RFA type matching feature

---

## Summary

**Status:** ✅ **FIXED AND VERIFIED**

**Impact:** Critical bug fix that ensures revision creation always copies from the latest revision, preventing data loss and ensuring project continuity.

**Testing:** Verified with user's exact scenario - now correctly selects revision 5 instead of revision 4.

**Deployment:** Changes applied to both main-process and renderer-process versions of RFATypeMatchingService.


