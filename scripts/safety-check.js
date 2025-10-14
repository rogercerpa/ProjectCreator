#!/usr/bin/env node

/**
 * Safety Check Script
 * 
 * Runs a comprehensive safety check before committing refactored code
 * This helps catch issues before they reach production
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
  } catch (error) {
    if (options.silent) {
      return null;
    }
    throw error;
  }
}

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0,
  results: []
};

function addResult(name, passed, message, level = 'error') {
  checks.results.push({ name, passed, message, level });
  if (passed) {
    checks.passed++;
  } else {
    if (level === 'warning') {
      checks.warnings++;
    } else {
      checks.failed++;
    }
  }
}

async function runChecks() {
  log('\n🛡️  Running Safety Checks...\n', 'cyan');

  // Check 1: Git Status
  log('1️⃣  Checking git status...', 'blue');
  const gitStatus = exec('git status --porcelain', { silent: true });
  if (gitStatus && gitStatus.trim()) {
    log('   ✓ Uncommitted changes detected', 'green');
    addResult('Git Status', true, 'Ready to test changes');
  } else {
    log('   ⚠ No uncommitted changes', 'yellow');
    addResult('Git Status', false, 'No changes to test', 'warning');
  }

  // Check 2: Package.json validity
  log('\n2️⃣  Checking package.json...', 'blue');
  try {
    const pkg = require('../package.json');
    log('   ✓ package.json is valid', 'green');
    addResult('package.json', true, 'Valid JSON structure');
  } catch (error) {
    log('   ✗ package.json is invalid!', 'red');
    addResult('package.json', false, error.message);
  }

  // Check 3: Dependencies installed
  log('\n3️⃣  Checking dependencies...', 'blue');
  const nodeModulesExists = fs.existsSync(path.join(__dirname, '../node_modules'));
  if (nodeModulesExists) {
    log('   ✓ Dependencies installed', 'green');
    addResult('Dependencies', true, 'node_modules exists');
  } else {
    log('   ✗ Dependencies not installed!', 'red');
    addResult('Dependencies', false, 'Run npm install');
  }

  // Check 4: Syntax check (build)
  log('\n4️⃣  Checking syntax (webpack build)...', 'blue');
  const buildResult = exec('npm run build:dev', { silent: true });
  if (buildResult !== null) {
    log('   ✓ Build successful', 'green');
    addResult('Build', true, 'No syntax errors');
  } else {
    log('   ✗ Build failed!', 'red');
    addResult('Build', false, 'Syntax errors detected');
  }

  // Check 5: Tests
  log('\n5️⃣  Running tests...', 'blue');
  const testResult = exec('npm test -- --passWithNoTests', { silent: true });
  if (testResult !== null) {
    log('   ✓ Tests passed', 'green');
    addResult('Tests', true, 'All tests passing');
  } else {
    log('   ✗ Tests failed!', 'red');
    addResult('Tests', false, 'Some tests failing');
  }

  // Check 6: Linting
  log('\n6️⃣  Running linter...', 'blue');
  const lintResult = exec('npm run lint --if-present', { silent: true });
  if (lintResult !== null) {
    log('   ✓ No lint errors', 'green');
    addResult('Linting', true, 'Code style looks good');
  } else {
    log('   ⚠ Lint warnings/errors', 'yellow');
    addResult('Linting', false, 'Some style issues', 'warning');
  }

  // Check 7: Large file check
  log('\n7️⃣  Checking for large files...', 'blue');
  const largeFiles = exec('find src -type f -size +100k', { silent: true });
  if (largeFiles && largeFiles.trim()) {
    log('   ⚠ Large files detected:', 'yellow');
    log(`   ${largeFiles}`, 'yellow');
    addResult('File Size', false, 'Large files found', 'warning');
  } else {
    log('   ✓ No large files', 'green');
    addResult('File Size', true, 'All files reasonable size');
  }

  // Check 8: Check for console.logs in new code
  log('\n8️⃣  Checking for debug statements...', 'blue');
  const consoleLogsInSrc = exec(
    'git diff --cached --name-only | grep "\\.jsx\\?$" | xargs grep -n "console.log" || true',
    { silent: true }
  );
  if (consoleLogsInSrc && consoleLogsInSrc.trim()) {
    log('   ⚠ console.log statements found', 'yellow');
    addResult('Debug Statements', false, 'Remove console.log', 'warning');
  } else {
    log('   ✓ No debug statements', 'green');
    addResult('Debug Statements', true, 'Clean code');
  }

  // Check 9: Check for TODO/FIXME comments
  log('\n9️⃣  Checking for TODO/FIXME...', 'blue');
  const todos = exec(
    'git diff --cached | grep -i "TODO\\|FIXME" || true',
    { silent: true }
  );
  if (todos && todos.trim()) {
    log('   ⚠ TODO/FIXME comments in changes', 'yellow');
    addResult('TODOs', false, 'Address TODOs before merging', 'warning');
  } else {
    log('   ✓ No pending TODOs', 'green');
    addResult('TODOs', true, 'No pending work');
  }

  // Check 10: Coverage comparison
  log('\n🔟  Checking test coverage...', 'blue');
  try {
    const coverageReport = fs.readFileSync(
      path.join(__dirname, '../coverage/coverage-summary.json'),
      'utf8'
    );
    const coverage = JSON.parse(coverageReport);
    const totalCoverage = coverage.total.lines.pct;
    
    if (totalCoverage >= 70) {
      log(`   ✓ Coverage: ${totalCoverage.toFixed(1)}%`, 'green');
      addResult('Coverage', true, `${totalCoverage.toFixed(1)}% coverage`);
    } else {
      log(`   ⚠ Coverage: ${totalCoverage.toFixed(1)}% (below 70%)`, 'yellow');
      addResult('Coverage', false, 'Coverage below threshold', 'warning');
    }
  } catch (error) {
    log('   ⚠ Could not read coverage report', 'yellow');
    addResult('Coverage', false, 'Run npm run test:coverage', 'warning');
  }

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 Safety Check Summary', 'cyan');
  log('='.repeat(60), 'cyan');
  
  checks.results.forEach(result => {
    const icon = result.passed ? '✓' : (result.level === 'warning' ? '⚠' : '✗');
    const color = result.passed ? 'green' : (result.level === 'warning' ? 'yellow' : 'red');
    log(`${icon} ${result.name}: ${result.message}`, color);
  });
  
  log('\n' + '='.repeat(60), 'cyan');
  log(`✓ Passed: ${checks.passed}`, 'green');
  log(`⚠ Warnings: ${checks.warnings}`, 'yellow');
  log(`✗ Failed: ${checks.failed}`, 'red');
  log('='.repeat(60) + '\n', 'cyan');

  // Decision
  if (checks.failed > 0) {
    log('❌ SAFETY CHECK FAILED', 'red');
    log('   Fix the errors above before committing.\n', 'red');
    process.exit(1);
  } else if (checks.warnings > 0) {
    log('⚠️  SAFETY CHECK PASSED WITH WARNINGS', 'yellow');
    log('   Review warnings before committing.\n', 'yellow');
    process.exit(0);
  } else {
    log('✅ SAFETY CHECK PASSED', 'green');
    log('   Safe to commit!\n', 'green');
    process.exit(0);
  }
}

// Run checks
runChecks().catch(error => {
  log(`\n❌ Safety check crashed: ${error.message}`, 'red');
  process.exit(1);
});



