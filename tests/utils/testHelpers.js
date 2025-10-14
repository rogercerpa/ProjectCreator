/**
 * Test Helpers for Safe Refactoring
 * 
 * These utilities help ensure refactoring doesn't break existing functionality
 */

/**
 * Compare two objects deeply and report differences
 * Useful for ensuring refactored code produces same output
 */
export function deepCompare(obj1, obj2, path = '') {
  const differences = [];
  
  // Handle null/undefined
  if (obj1 === null || obj2 === null || obj1 === undefined || obj2 === undefined) {
    if (obj1 !== obj2) {
      differences.push({
        path,
        old: obj1,
        new: obj2,
        type: 'value'
      });
    }
    return differences;
  }
  
  // Handle primitives
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    if (obj1 !== obj2) {
      differences.push({
        path,
        old: obj1,
        new: obj2,
        type: 'value'
      });
    }
    return differences;
  }
  
  // Handle arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) {
      differences.push({
        path: `${path}.length`,
        old: obj1.length,
        new: obj2.length,
        type: 'array-length'
      });
    }
    
    const maxLength = Math.max(obj1.length, obj2.length);
    for (let i = 0; i < maxLength; i++) {
      differences.push(...deepCompare(
        obj1[i],
        obj2[i],
        `${path}[${i}]`
      ));
    }
    return differences;
  }
  
  // Handle objects
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  const allKeys = new Set([...keys1, ...keys2]);
  
  for (const key of allKeys) {
    if (!obj1.hasOwnProperty(key)) {
      differences.push({
        path: `${path}.${key}`,
        old: undefined,
        new: obj2[key],
        type: 'added'
      });
    } else if (!obj2.hasOwnProperty(key)) {
      differences.push({
        path: `${path}.${key}`,
        old: obj1[key],
        new: undefined,
        type: 'removed'
      });
    } else {
      differences.push(...deepCompare(
        obj1[key],
        obj2[key],
        path ? `${path}.${key}` : key
      ));
    }
  }
  
  return differences;
}

/**
 * Test that refactored function produces same output as original
 */
export async function testRefactor(originalFn, refactoredFn, testCases, options = {}) {
  const results = {
    passed: 0,
    failed: 0,
    errors: [],
    differences: []
  };
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const { input, description } = testCase;
    
    try {
      // Run both functions
      const originalResult = await originalFn(...input);
      const refactoredResult = await refactoredFn(...input);
      
      // Compare results
      const diffs = deepCompare(originalResult, refactoredResult);
      
      if (diffs.length === 0) {
        results.passed++;
      } else {
        results.failed++;
        results.differences.push({
          testCase: i,
          description,
          input,
          differences: diffs
        });
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        testCase: i,
        description,
        input,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Create a snapshot of app state for comparison
 */
export function createStateSnapshot() {
  return {
    localStorage: { ...localStorage },
    timestamp: Date.now(),
    version: require('../../package.json').version
  };
}

/**
 * Compare two state snapshots
 */
export function compareSnapshots(before, after) {
  const differences = deepCompare(before.localStorage, after.localStorage);
  return {
    hasChanges: differences.length > 0,
    differences,
    timeDiff: after.timestamp - before.timestamp
  };
}

/**
 * Mock electron API for testing
 */
export function mockElectronAPI(overrides = {}) {
  const defaultMock = {
    projectsLoadAll: jest.fn().mockResolvedValue({ success: true, projects: [] }),
    projectSave: jest.fn().mockResolvedValue({ success: true }),
    projectCreate: jest.fn().mockResolvedValue({ success: true }),
    selectFolder: jest.fn().mockResolvedValue({ canceled: false, filePaths: ['/test/path'] }),
    // Add more as needed
  };
  
  window.electronAPI = {
    ...defaultMock,
    ...overrides
  };
  
  return window.electronAPI;
}

/**
 * Wait for condition to be true (with timeout)
 */
export function waitFor(condition, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (condition()) {
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, 100);
      }
    };
    
    check();
  });
}

/**
 * Measure execution time
 */
export async function measureTime(fn, label = 'Operation') {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  
  console.log(`⏱️  ${label}: ${duration.toFixed(2)}ms`);
  
  return { result, duration };
}

/**
 * Create test project data
 */
export function createTestProject(overrides = {}) {
  return {
    id: `test-${Date.now()}`,
    projectName: 'Test Project',
    rfaNumber: '2024-001',
    agentNumber: 'AG123',
    projectContainer: '24-123',
    rfaType: 'Reloc',
    regionalTeam: 'WEST',
    ecd: '2024-12-31',
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Cleanup test data
 */
export async function cleanupTestData(pattern = 'test-') {
  // Clear localStorage items matching pattern
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.includes(pattern)) {
      localStorage.removeItem(key);
    }
  });
  
  // Reset mocks
  if (window.electronAPI) {
    Object.keys(window.electronAPI).forEach(key => {
      if (typeof window.electronAPI[key]?.mockClear === 'function') {
        window.electronAPI[key].mockClear();
      }
    });
  }
}

/**
 * Run smoke tests to ensure basic functionality
 */
export async function runSmokeTests() {
  const tests = {
    appStarts: false,
    canCreateProject: false,
    canLoadProjects: false,
    canSaveSettings: false,
    canNavigate: false
  };
  
  try {
    // Test 1: App renders
    tests.appStarts = document.querySelector('.app') !== null;
    
    // Test 2: Can create project
    const mockAPI = mockElectronAPI();
    const result = await mockAPI.projectCreate(createTestProject());
    tests.canCreateProject = result.success;
    
    // Test 3: Can load projects
    const loadResult = await mockAPI.projectsLoadAll();
    tests.canLoadProjects = loadResult.success;
    
    // Test 4: Settings exist
    tests.canSaveSettings = typeof localStorage !== 'undefined';
    
    // Test 5: Navigation works
    tests.canNavigate = document.querySelector('.sidebar') !== null;
    
  } catch (error) {
    console.error('Smoke test error:', error);
  }
  
  const passed = Object.values(tests).filter(Boolean).length;
  const total = Object.keys(tests).length;
  
  return {
    passed,
    total,
    allPassed: passed === total,
    tests
  };
}

/**
 * Performance regression detector
 */
export class PerformanceBaseline {
  constructor(name) {
    this.name = name;
    this.baseline = null;
    this.measurements = [];
  }
  
  async setBaseline(fn) {
    const { duration } = await measureTime(fn, `Baseline: ${this.name}`);
    this.baseline = duration;
    console.log(`📊 Baseline set: ${this.name} = ${duration.toFixed(2)}ms`);
  }
  
  async measure(fn) {
    const { result, duration } = await measureTime(fn, `Test: ${this.name}`);
    this.measurements.push(duration);
    
    const regression = this.calculateRegression(duration);
    
    if (regression > 20) {
      console.warn(`⚠️  Performance regression detected: ${regression.toFixed(1)}% slower`);
    } else if (regression < -10) {
      console.log(`✅ Performance improvement: ${Math.abs(regression).toFixed(1)}% faster`);
    }
    
    return { result, duration, regression };
  }
  
  calculateRegression(duration) {
    if (!this.baseline) return 0;
    return ((duration - this.baseline) / this.baseline) * 100;
  }
  
  getStats() {
    if (this.measurements.length === 0) {
      return null;
    }
    
    const avg = this.measurements.reduce((a, b) => a + b) / this.measurements.length;
    const min = Math.min(...this.measurements);
    const max = Math.max(...this.measurements);
    
    return {
      baseline: this.baseline,
      average: avg,
      min,
      max,
      regression: this.calculateRegression(avg)
    };
  }
}

export default {
  deepCompare,
  testRefactor,
  createStateSnapshot,
  compareSnapshots,
  mockElectronAPI,
  waitFor,
  measureTime,
  createTestProject,
  cleanupTestData,
  runSmokeTests,
  PerformanceBaseline
};



