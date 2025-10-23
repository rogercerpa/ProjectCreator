/**
 * Product Knowledge Constants
 * Defines all products and position levels for smart assignment
 */

/**
 * All available products in the system
 */
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

/**
 * Position levels (ordered by seniority)
 */
const POSITIONS = [
  'L&T Junior Design Application Analyst',
  'L&T Senior Design Application Analyst',
  'Junior Design Application Analyst',
  'Senior Design Application Analyst',
  'Lead Design Application Analyst',
  'Manager Design Application Analyst'
];

/**
 * Position to seniority level mapping (0-5)
 * Used for complexity matching
 */
const POSITION_SENIORITY = {
  'L&T Junior Design Application Analyst': 1,
  'L&T Senior Design Application Analyst': 2,
  'Junior Design Application Analyst': 1,
  'Senior Design Application Analyst': 3,
  'Lead Design Application Analyst': 4,
  'Manager Design Application Analyst': 5
};

/**
 * Position to complexity level mapping
 * Which complexity levels each position can handle
 */
const POSITION_COMPLEXITY_MAP = {
  'L&T Junior Design Application Analyst': ['Level 1', 'Level 2'],
  'L&T Senior Design Application Analyst': ['Level 1', 'Level 2', 'Level 3'],
  'Junior Design Application Analyst': ['Level 1', 'Level 2'],
  'Senior Design Application Analyst': ['Level 2', 'Level 3', 'Level 4'],
  'Lead Design Application Analyst': ['Level 3', 'Level 4'],
  'Manager Design Application Analyst': ['Level 3', 'Level 4'] // Managers typically handle complex
};

/**
 * Skill level descriptors (0-5 scale)
 */
const SKILL_LEVELS = {
  0: { label: 'No Knowledge', color: '#95a5a6', description: 'No experience with this product' },
  1: { label: 'Basic', color: '#e74c3c', description: 'Basic familiarity, requires supervision' },
  2: { label: 'Intermediate', color: '#f39c12', description: 'Can handle simple tasks independently' },
  3: { label: 'Advanced', color: '#f1c40f', description: 'Proficient, handles most tasks well' },
  4: { label: 'Expert', color: '#3498db', description: 'Expert level, can handle complex scenarios' },
  5: { label: 'Master', color: '#27ae60', description: 'Master level, can train others' }
};

/**
 * Default product knowledge template (all products set to 0)
 */
const DEFAULT_PRODUCT_KNOWLEDGE = PRODUCTS.reduce((acc, product) => {
  acc[product] = 0;
  return acc;
}, {});

/**
 * Complexity level to numeric value mapping
 */
const COMPLEXITY_VALUES = {
  'Level 1': 1,
  'Level 2': 2,
  'Level 3': 3,
  'Level 4': 4
};

/**
 * Get skill level info by numeric value
 */
function getSkillLevelInfo(level) {
  return SKILL_LEVELS[level] || SKILL_LEVELS[0];
}

/**
 * Get position seniority level
 */
function getPositionSeniority(position) {
  return POSITION_SENIORITY[position] || 0;
}

/**
 * Check if position can handle complexity level
 */
function canPositionHandleComplexity(position, complexity) {
  const allowedLevels = POSITION_COMPLEXITY_MAP[position] || [];
  return allowedLevels.includes(complexity);
}

/**
 * Get complexity numeric value
 */
function getComplexityValue(complexity) {
  return COMPLEXITY_VALUES[complexity] || 0;
}

/**
 * Calculate seniority gap between position and complexity
 * Returns 0 if perfect match, negative if under-qualified, positive if over-qualified
 */
function calculateSeniorityGap(position, complexity) {
  const positionLevel = getPositionSeniority(position);
  const complexityLevel = getComplexityValue(complexity);
  
  // Check if position can handle this complexity
  if (!canPositionHandleComplexity(position, complexity)) {
    return -999; // Disqualified
  }
  
  return positionLevel - complexityLevel;
}

export {
  PRODUCTS,
  POSITIONS,
  POSITION_SENIORITY,
  POSITION_COMPLEXITY_MAP,
  SKILL_LEVELS,
  DEFAULT_PRODUCT_KNOWLEDGE,
  COMPLEXITY_VALUES,
  getSkillLevelInfo,
  getPositionSeniority,
  canPositionHandleComplexity,
  getComplexityValue,
  calculateSeniorityGap
};

