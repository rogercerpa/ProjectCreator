# Smart Assignment System - Phase 1: Data Foundation

## Date: October 14, 2025

## Status: ✅ COMPLETE

---

## Overview

Phase 1 establishes the data foundation for an intelligent project assignment system that recommends optimal users based on availability, seniority, and product knowledge.

---

## What Was Built

### 1. **Product Knowledge Constants**
**File**: `src/constants/Products.js`

#### Products Defined (18 total):
```javascript
const PRODUCTS = [
  'nLight Wired',
  'nLight Air',
  'SensorSwitch',
  'SensorSwitch Air',
  'Visual Installer',
  'Visual Controls',
  'Fresco',
  'Pathway',
  'Animate',
  'Pharos',
  'DALI',
  'Atrius',
  'Modulus',
  'DC2DC',
  'Envysion Graphics',
  'nFloorplan Graphics',
  'SensorView',
  'BACnet'
];
```

#### Position Levels (6 total):
```javascript
const POSITIONS = [
  'L&T Junior Design Application Analyst',
  'L&T Senior Design Application Analyst',
  'Junior Design Application Analyst',
  'Senior Design Application Analyst',
  'Lead Design Application Analyst',
  'Manager Design Application Analyst'
];
```

#### Seniority-Complexity Mapping:
```javascript
const POSITION_COMPLEXITY_MAP = {
  'L&T Junior Design Application Analyst': ['Level 1', 'Level 2'],
  'L&T Senior Design Application Analyst': ['Level 1', 'Level 2', 'Level 3'],
  'Junior Design Application Analyst': ['Level 1', 'Level 2'],
  'Senior Design Application Analyst': ['Level 2', 'Level 3', 'Level 4'],
  'Lead Design Application Analyst': ['Level 3', 'Level 4'],
  'Manager Design Application Analyst': ['Level 3', 'Level 4']
};
```

#### Skill Level Scale (0-5):
- **0**: No Knowledge - No experience with this product
- **1**: Basic - Basic familiarity, requires supervision
- **2**: Intermediate - Can handle simple tasks independently
- **3**: Advanced - Proficient, handles most tasks well
- **4**: Expert - Expert level, can handle complex scenarios
- **5**: Master - Master level, can train others

---

### 2. **Enhanced User Model**
**File**: `src/models/User.js`

#### New Fields Added:

```javascript
class User {
  constructor(data = {}) {
    // NEW FIELDS
    this.position = data.position || '';
    this.yearsExperience = data.yearsExperience || 0;
    this.productKnowledge = data.productKnowledge || {
      'nLight Wired': 0,
      'nLight Air': 0,
      // ... all 18 products
    };
    this.certifications = data.certifications || [];
    this.trainingCompleted = data.trainingCompleted || [];
    
    // EXISTING FIELDS (unchanged)
    this.weeklyCapacity = 40;
    this.isActive = true;
    // ... etc
  }
}
```

#### New Helper Methods:

1. **`getProductKnowledge(productName)`** - Get knowledge level for specific product
2. **`setProductKnowledge(productName, level)`** - Set knowledge level (0-5)
3. **`getAverageProductKnowledge()`** - Calculate average across all products
4. **`getExpertProducts()`** - Get list of products where user is expert (4-5)
5. **`hasProductKnowledge(productName)`** - Check if user has min knowledge (≥2)

---

### 3. **Smart Assignment Service**
**File**: `src/services/SmartAssignmentService.js`

#### Core Algorithm:

**Scoring Formula:**
```
Total Score = (Availability × 40%) + 
              (Seniority × 30%) + 
              (Product Knowledge × 30%)
```

#### Availability Score (40% weight):
- Considers current workload
- Checks capacity vs. project hours needed
- Detects scheduling conflicts
- **Formula**:
  - 100% if perfect capacity match
  - Decreases if over/under capacity
  - 0% if no availability

#### Seniority Score (30% weight):
- Matches position to project complexity
- Uses `POSITION_COMPLEXITY_MAP`
- **Formula**:
  - 100% if position perfectly matches complexity
  - 90% if slightly over-qualified
  - 75% if significantly over-qualified
  - 60% if under-qualified but allowed
  - 0% if position cannot handle complexity

#### Product Knowledge Score (30% weight):
- Averages knowledge levels for required products
- **Formula**:
  - Level 0 = 0%
  - Level 1 = 20%
  - Level 2 = 40%
  - Level 3 = 60%
  - Level 4 = 80%
  - Level 5 = 100%

---

## API Reference

### SmartAssignmentService

#### Constructor
```javascript
const smartAssignment = new SmartAssignmentService(workloadPersistenceService);
```

#### Main Method: `getRecommendations()`
```javascript
const recommendations = await smartAssignment.getRecommendations({
  totalHours: 16,
  complexity: 'Level 3',
  products: ['nLight Wired', 'SensorSwitch'],
  startDate: '2025-10-20',
  dueDate: '2025-10-27',
  priority: 'high'
}, 3); // Return top 3 recommendations
```

**Returns:**
```javascript
[
  {
    user: { /* User object */ },
    totalScore: 87,
    breakdown: {
      availability: 90,
      seniority: 85,
      productKnowledge: 88
    },
    reasoning: "🌟 Excellent match! ✅ Excellent availability • ✅ Senior DAA matches project complexity • ✅ Expert in nLight Wired, SensorSwitch",
    availableHours: 20,
    currentWorkload: 20,
    conflicts: [],
    matchLevel: 'excellent'
  },
  // ... more recommendations
]
```

#### Score Breakdown Fields:

| Field | Type | Description |
|-------|------|-------------|
| `totalScore` | number | Overall score (0-100) |
| `breakdown.availability` | number | Availability component (0-100) |
| `breakdown.seniority` | number | Seniority match (0-100) |
| `breakdown.productKnowledge` | number | Product expertise (0-100) |
| `reasoning` | string | Human-readable explanation |
| `availableHours` | number | Hours user has available |
| `currentWorkload` | number | Hours currently allocated |
| `conflicts` | array | Array of scheduling conflicts |
| `matchLevel` | string | 'excellent', 'good', 'fair', or 'poor' |

---

## Example User Profile

```javascript
{
  id: "user-123",
  name: "John Doe",
  email: "john.doe@acuity.com",
  
  // NEW Smart Assignment Fields
  position: "Senior Design Application Analyst",
  yearsExperience: 5,
  productKnowledge: {
    "nLight Wired": 5,        // Master
    "nLight Air": 4,          // Expert
    "SensorSwitch": 5,        // Master
    "SensorSwitch Air": 3,    // Advanced
    "Visual Installer": 4,    // Expert
    "Visual Controls": 4,     // Expert
    "Fresco": 2,             // Intermediate
    "Pathway": 3,            // Advanced
    "Animate": 1,            // Basic
    "Pharos": 2,             // Intermediate
    "DALI": 4,               // Expert
    "Atrius": 3,             // Advanced
    "Modulus": 2,            // Intermediate
    "DC2DC": 3,              // Advanced
    "Envysion Graphics": 4,  // Expert
    "nFloorplan Graphics": 5,// Master
    "SensorView": 3,         // Advanced
    "BACnet": 2              // Intermediate
  },
  certifications: ["nLight Certified", "SensorSwitch Advanced"],
  trainingCompleted: ["Visual Controls 101", "DALI Fundamentals"],
  
  // Existing Fields
  weeklyCapacity: 40,
  isActive: true,
  role: "Designer"
}
```

---

## Scoring Examples

### Example 1: Perfect Match

**Project**:
- Complexity: Level 3
- Products: nLight Wired, SensorSwitch
- Hours: 16
- Due: 1 week

**User**:
- Position: Senior DAA (matches Level 3)
- nLight Wired: 5/5 (Master)
- SensorSwitch: 5/5 (Master)
- Available: 20 hours

**Score**:
- Availability: 100 (perfect capacity)
- Seniority: 100 (exact match)
- Product Knowledge: 100 (expert in both)
- **Total**: 100% 🌟

---

### Example 2: Good Match

**Project**:
- Complexity: Level 2
- Products: Fresco, Pathway
- Hours: 12
- Due: 1 week

**User**:
- Position: Junior DAA (can handle Level 2)
- Fresco: 3/5 (Advanced)
- Pathway: 3/5 (Advanced)
- Available: 15 hours

**Score**:
- Availability: 95 (good capacity)
- Seniority: 100 (perfect match)
- Product Knowledge: 60 (adequate knowledge)
- **Total**: 85% 👍

---

### Example 3: Poor Match

**Project**:
- Complexity: Level 4
- Products: Pharos, Animate
- Hours: 24
- Due: 1 week

**User**:
- Position: L&T Junior DAA (cannot handle Level 4)
- Pharos: 1/5 (Basic)
- Animate: 0/5 (None)
- Available: 5 hours

**Score**:
- Availability: 20 (low capacity)
- Seniority: 0 (disqualified - can't handle Level 4)
- Product Knowledge: 10 (very low)
- **Total**: 12% ❌

---

## Helper Functions

### From `Products.js`:

```javascript
// Get skill level information
getSkillLevelInfo(3)
// Returns: { label: 'Advanced', color: '#f1c40f', description: '...' }

// Check if position can handle complexity
canPositionHandleComplexity('Senior Design Application Analyst', 'Level 3')
// Returns: true

// Calculate seniority gap
calculateSeniorityGap('Lead Design Application Analyst', 'Level 2')
// Returns: 2 (over-qualified by 2 levels)
```

---

## Data Flow

```
┌─────────────────────────────────────────┐
│ Project Info (complexity, products)     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ SmartAssignmentService                   │
│   .getRecommendations()                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Load all users & assignments            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ For each active user:                    │
│   • Calculate availability score         │
│   • Calculate seniority match score      │
│   • Calculate product knowledge score    │
│   • Apply weights (40%, 30%, 30%)       │
│   • Generate reasoning                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Filter users with score ≥ 50%           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Sort by total score (descending)        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Return top N recommendations             │
└─────────────────────────────────────────┘
```

---

## Thresholds & Configuration

### Current Thresholds:
```javascript
{
  minScore: 50,           // Don't recommend if < 50%
  minAvailability: 2,     // At least 2 hours
  minProductKnowledge: 1  // At least basic knowledge
}
```

### Scoring Weights (configurable):
```javascript
{
  availability: 0.40,     // 40% weight
  seniority: 0.30,        // 30% weight
  productKnowledge: 0.30  // 30% weight
}
```

---

## Files Created/Modified

### Created:
1. **`src/constants/Products.js`** - Product and position constants
2. **`src/services/SmartAssignmentService.js`** - Recommendation algorithm
3. **`docs/SMART-ASSIGNMENT-PHASE1.md`** - This documentation

### Modified:
1. **`src/models/User.js`** - Added position and product knowledge fields

---

## Build Status

```bash
npm run build
✅ webpack 5.101.3 compiled successfully in 1053 ms
✅ No errors or warnings
```

---

## Next Steps - Phase 2

Phase 2 will integrate the smart assignment into the Triage Wizard:
- Add recommendations display in Step 2
- Show top 3 suggested users
- Display reasoning for each
- Allow user to select or override

---

## Testing the Algorithm

### Manual Test:
```javascript
const SmartAssignmentService = require('./src/services/SmartAssignmentService');
const workloadPersistence = /* ... */;
const service = new SmartAssignmentService(workloadPersistence);

const recommendations = await service.getRecommendations({
  totalHours: 16,
  complexity: 'Level 3',
  products: ['nLight Wired', 'SensorSwitch'],
  startDate: '2025-10-20',
  dueDate: '2025-10-27'
}, 3);

console.log('Top 3 Recommendations:');
recommendations.forEach((rec, i) => {
  console.log(`${i + 1}. ${rec.user.name} - ${rec.totalScore}%`);
  console.log(`   ${rec.reasoning}`);
});
```

---

## Status Summary

✅ **Phase 1 COMPLETE**

- ✅ User model expanded with position and product knowledge
- ✅ Product constants and position levels defined
- ✅ Smart assignment algorithm implemented
- ✅ Scoring system with 3 weighted components
- ✅ Conflict detection
- ✅ Human-readable reasoning generation
- ✅ Build successful
- ✅ Ready for Phase 2 integration

**Estimated Time**: ~3 hours  
**Actual Time**: ~3 hours  
**Status**: On schedule ✅

Ready to proceed with Phase 2! 🚀

