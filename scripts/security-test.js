#!/usr/bin/env node

/**
 * Project Creator - Security Testing Script
 * This script performs comprehensive security tests on the application
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Test results tracking
const testResults = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
};

// Utility functions
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, status, message = '') {
    const statusColor = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
    const statusSymbol = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
    
    log(`${statusSymbol} ${name}: ${status}`, statusColor);
    if (message) {
        log(`  ${message}`, 'blue');
    }
    
    testResults.tests.push({ name, status, message });
    if (status === 'PASS') testResults.passed++;
    else if (status === 'FAIL') testResults.failed++;
    else testResults.warnings++;
}

// Security tests
function testDependencyVulnerabilities() {
    log('\n🔍 Testing dependency vulnerabilities...', 'cyan');
    
    try {
        const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
        const audit = JSON.parse(auditResult);
        
        if (audit.vulnerabilities) {
            const vulnerabilities = Object.keys(audit.vulnerabilities);
            if (vulnerabilities.length === 0) {
                logTest('Dependency Vulnerabilities', 'PASS', 'No vulnerabilities found');
            } else {
                logTest('Dependency Vulnerabilities', 'FAIL', 
                    `Found ${vulnerabilities.length} vulnerabilities`);
                vulnerabilities.forEach(vuln => {
                    const details = audit.vulnerabilities[vuln];
                    log(`  - ${vuln}: ${details.severity}`, 'red');
                });
            }
        } else {
            logTest('Dependency Vulnerabilities', 'PASS', 'No vulnerabilities found');
        }
    } catch (error) {
        logTest('Dependency Vulnerabilities', 'FAIL', 'Failed to run npm audit');
    }
}

function testSecurityHeaders() {
    log('\n🔍 Testing security headers...', 'cyan');
    
    const webpackConfigPath = 'webpack.config.js';
    if (fs.existsSync(webpackConfigPath)) {
        const webpackConfig = fs.readFileSync(webpackConfigPath, 'utf8');
        
        // Check for CSP headers
        if (webpackConfig.includes('Content-Security-Policy')) {
            logTest('Content Security Policy', 'PASS', 'CSP headers configured');
        } else {
            logTest('Content Security Policy', 'FAIL', 'CSP headers not found');
        }
        
        // Check for security meta tags
        if (webpackConfig.includes('meta:')) {
            logTest('Security Meta Tags', 'PASS', 'Security meta tags configured');
        } else {
            logTest('Security Meta Tags', 'WARN', 'Security meta tags not found');
        }
    } else {
        logTest('Webpack Config', 'FAIL', 'Webpack configuration not found');
    }
}

function testElectronSecurity() {
    log('\n🔍 Testing Electron security configuration...', 'cyan');
    
    const mainJsPath = 'main.js';
    if (fs.existsSync(mainJsPath)) {
        const mainJs = fs.readFileSync(mainJsPath, 'utf8');
        
        // Check for context isolation
        if (mainJs.includes('contextIsolation: true')) {
            logTest('Context Isolation', 'PASS', 'Context isolation enabled');
        } else {
            logTest('Context Isolation', 'FAIL', 'Context isolation not enabled');
        }
        
        // Check for node integration disabled
        if (mainJs.includes('nodeIntegration: false')) {
            logTest('Node Integration', 'PASS', 'Node integration disabled');
        } else {
            logTest('Node Integration', 'FAIL', 'Node integration not disabled');
        }
        
        // Check for web security enabled
        if (mainJs.includes('webSecurity: true')) {
            logTest('Web Security', 'PASS', 'Web security enabled');
        } else {
            logTest('Web Security', 'FAIL', 'Web security not enabled');
        }
        
        // Check for preload script
        if (mainJs.includes('preload:')) {
            logTest('Preload Script', 'PASS', 'Preload script configured');
        } else {
            logTest('Preload Script', 'FAIL', 'Preload script not configured');
        }
    } else {
        logTest('Main Process', 'FAIL', 'Main process file not found');
    }
}

function testPreloadSecurity() {
    log('\n🔍 Testing preload script security...', 'cyan');
    
    const preloadPath = 'preload.js';
    if (fs.existsSync(preloadPath)) {
        const preload = fs.readFileSync(preloadPath, 'utf8');
        
        // Check for contextBridge usage
        if (preload.includes('contextBridge')) {
            logTest('Context Bridge', 'PASS', 'Using contextBridge for secure IPC');
        } else {
            logTest('Context Bridge', 'FAIL', 'Not using contextBridge');
        }
        
        // Check for Node.js API blocking
        if (preload.includes('window.process = undefined')) {
            logTest('Node.js API Blocking', 'PASS', 'Node.js APIs blocked in renderer');
        } else {
            logTest('Node.js API Blocking', 'WARN', 'Node.js APIs not explicitly blocked');
        }
        
        // Check for secure API exposure
        if (preload.includes('exposeInMainWorld')) {
            logTest('Secure API Exposure', 'PASS', 'APIs exposed through contextBridge');
        } else {
            logTest('Secure API Exposure', 'FAIL', 'APIs not properly exposed');
        }
    } else {
        logTest('Preload Script', 'FAIL', 'Preload script not found');
    }
}

function testInputValidation() {
    log('\n🔍 Testing input validation...', 'cyan');
    
    const securityUtilsPath = 'src/utils/security.js';
    if (fs.existsSync(securityUtilsPath)) {
        const securityUtils = fs.readFileSync(securityUtilsPath, 'utf8');
        
        // Check for path validation
        if (securityUtils.includes('validatePath')) {
            logTest('Path Validation', 'PASS', 'Path validation implemented');
        } else {
            logTest('Path Validation', 'FAIL', 'Path validation not implemented');
        }
        
        // Check for XSS prevention
        if (securityUtils.includes('sanitizeHTML')) {
            logTest('XSS Prevention', 'PASS', 'HTML sanitization implemented');
        } else {
            logTest('XSS Prevention', 'FAIL', 'HTML sanitization not implemented');
        }
        
        // Check for SQL injection prevention
        if (securityUtils.includes('sanitizeSearchQuery')) {
            logTest('SQL Injection Prevention', 'PASS', 'SQL injection prevention implemented');
        } else {
            logTest('SQL Injection Prevention', 'FAIL', 'SQL injection prevention not implemented');
        }
    } else {
        logTest('Security Utils', 'FAIL', 'Security utilities not found');
    }
}

function testFileUploadSecurity() {
    log('\n🔍 Testing file upload security...', 'cyan');
    
    const securityConfigPath = 'src/config/security.js';
    if (fs.existsSync(securityConfigPath)) {
        const securityConfig = fs.readFileSync(securityConfigPath, 'utf8');
        
        // Check for file type restrictions
        if (securityConfig.includes('allowedExtensions')) {
            logTest('File Type Restrictions', 'PASS', 'File type restrictions configured');
        } else {
            logTest('File Type Restrictions', 'FAIL', 'File type restrictions not configured');
        }
        
        // Check for file size limits
        if (securityConfig.includes('maxSize')) {
            logTest('File Size Limits', 'PASS', 'File size limits configured');
        } else {
            logTest('File Size Limits', 'FAIL', 'File size limits not configured');
        }
        
        // Check for blocked file types
        if (securityConfig.includes('blockedExtensions')) {
            logTest('Blocked File Types', 'PASS', 'Dangerous file types blocked');
        } else {
            logTest('Blocked File Types', 'FAIL', 'Dangerous file types not blocked');
        }
    } else {
        logTest('Security Config', 'FAIL', 'Security configuration not found');
    }
}

function testBuildSecurity() {
    log('\n🔍 Testing build security...', 'cyan');
    
    // Check if build directory exists
    if (fs.existsSync('dist')) {
        logTest('Build Output', 'PASS', 'Build directory exists');
        
        // Check for source maps in production
        const distFiles = fs.readdirSync('dist');
        const hasSourceMaps = distFiles.some(file => file.endsWith('.map'));
        
        if (hasSourceMaps) {
            logTest('Source Maps', 'WARN', 'Source maps found in production build');
        } else {
            logTest('Source Maps', 'PASS', 'No source maps in production build');
        }
    } else {
        logTest('Build Output', 'FAIL', 'Build directory not found');
    }
}

function testCodeSigningConfig() {
    log('\n🔍 Testing code signing configuration...', 'cyan');
    
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    if (packageJson.build) {
        logTest('Build Configuration', 'PASS', 'Build configuration found');
        
        // Check for Windows code signing
        if (packageJson.build.win && packageJson.build.win.publisherName) {
            logTest('Windows Code Signing', 'PASS', 'Windows code signing configured');
        } else {
            logTest('Windows Code Signing', 'WARN', 'Windows code signing not configured');
        }
        
        // Check for macOS code signing
        if (packageJson.build.mac && packageJson.build.mac.hardenedRuntime) {
            logTest('macOS Code Signing', 'PASS', 'macOS code signing configured');
        } else {
            logTest('macOS Code Signing', 'WARN', 'macOS code signing not configured');
        }
    } else {
        logTest('Build Configuration', 'FAIL', 'Build configuration not found');
    }
}

function generateReport() {
    log('\n📊 Security Test Report', 'magenta');
    log('='.repeat(50), 'magenta');
    
    log(`\nTotal Tests: ${testResults.passed + testResults.failed + testResults.warnings}`, 'blue');
    log(`Passed: ${testResults.passed}`, 'green');
    log(`Failed: ${testResults.failed}`, 'red');
    log(`Warnings: ${testResults.warnings}`, 'yellow');
    
    const securityScore = Math.round((testResults.passed / (testResults.passed + testResults.failed + testResults.warnings)) * 100);
    log(`\nSecurity Score: ${securityScore}%`, securityScore >= 80 ? 'green' : securityScore >= 60 ? 'yellow' : 'red');
    
    if (testResults.failed > 0) {
        log('\n❌ Critical Issues Found:', 'red');
        testResults.tests
            .filter(test => test.status === 'FAIL')
            .forEach(test => log(`  - ${test.name}: ${test.message}`, 'red'));
    }
    
    if (testResults.warnings > 0) {
        log('\n⚠️  Warnings:', 'yellow');
        testResults.tests
            .filter(test => test.status === 'WARN')
            .forEach(test => log(`  - ${test.name}: ${test.message}`, 'yellow'));
    }
    
    if (testResults.failed === 0 && testResults.warnings === 0) {
        log('\n🎉 All security tests passed!', 'green');
    }
}

// Main execution
function main() {
    log('🔒 Project Creator Security Testing', 'cyan');
    log('='.repeat(40), 'cyan');
    
    testDependencyVulnerabilities();
    testSecurityHeaders();
    testElectronSecurity();
    testPreloadSecurity();
    testInputValidation();
    testFileUploadSecurity();
    testBuildSecurity();
    testCodeSigningConfig();
    
    generateReport();
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run the tests
main();


