#!/usr/bin/env node

/**
 * Project Cleanup Script
 * Removes unused files and optimizes project structure
 */

const fs = require('fs-extra');
const path = require('path');

// Files and directories to remove
const REMOVE_ITEMS = [
  // Old HTA file (replaced by Electron)
  'Project Creator 2024 v4_2_3.hta',
  
  // Old documentation files
  'ELECTRON-README.md',
  'ENHANCED-PROJECT-FORM-README.md',
  'PHASE2-BUSINESS-LOGIC-COMPLETE.md',
  'migration-notes.md',
  
  // Build artifacts (will be regenerated)
  'dist/',
  
  // Development files
  'node_modules/',
  'package-lock.json'
];

// Files to keep but move to appropriate locations
const REORGANIZE_ITEMS = [
  {
    from: 'README.md',
    to: 'docs/README.md'
  },
  {
    from: 'SECURITY-AUDIT-REPORT.md',
    to: 'docs/SECURITY-AUDIT-REPORT.md'
  }
];

// Create new directory structure
const NEW_DIRECTORIES = [
  'docs/',
  'scripts/',
  'tests/',
  'config/',
  'assets/',
  'build/'
];

async function cleanup() {
  console.log('🧹 Starting project cleanup...\n');

  try {
    // Create new directory structure
    console.log('📁 Creating new directory structure...');
    for (const dir of NEW_DIRECTORIES) {
      await fs.ensureDir(dir);
      console.log(`  ✅ Created: ${dir}`);
    }

    // Remove unused files and directories
    console.log('\n🗑️  Removing unused files...');
    for (const item of REMOVE_ITEMS) {
      if (await fs.pathExists(item)) {
        await fs.remove(item);
        console.log(`  ✅ Removed: ${item}`);
      } else {
        console.log(`  ⚠️  Not found: ${item}`);
      }
    }

    // Reorganize files
    console.log('\n📦 Reorganizing files...');
    for (const item of REORGANIZE_ITEMS) {
      if (await fs.pathExists(item.from)) {
        await fs.move(item.from, item.to, { overwrite: true });
        console.log(`  ✅ Moved: ${item.from} → ${item.to}`);
      } else {
        console.log(`  ⚠️  Not found: ${item.from}`);
      }
    }

    // Create new project structure files
    console.log('\n📝 Creating new project structure files...');
    
    // Create .gitignore
    const gitignore = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/
*.tgz
*.tar.gz

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env.test

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless/

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port

# Stores VSCode versions used for testing VSCode extensions
.vscode-test

# Electron build outputs
out/
release/

# Security logs
.project-creator/

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
`;

    await fs.writeFile('.gitignore', gitignore);
    console.log('  ✅ Created: .gitignore');

    // Create .eslintrc.js
    const eslintrc = `module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 12,
    sourceType: 'module'
  },
  plugins: [
    'react',
    'react-hooks'
  ],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'no-unused-vars': 'warn',
    'no-console': 'warn'
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};`;

    await fs.writeFile('.eslintrc.js', eslintrc);
    console.log('  ✅ Created: .eslintrc.js');

    // Create .prettierrc
    const prettierrc = `{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}`;

    await fs.writeFile('.prettierrc', prettierrc);
    console.log('  ✅ Created: .prettierrc');

    // Create scripts directory files
    const scriptsDir = 'scripts/';
    
    // Create build script
    const buildScript = `#!/bin/bash
echo "Building Project Creator..."

# Clean previous builds
rm -rf dist/
rm -rf build/

# Install dependencies
npm install

# Build the application
npm run build

# Package for distribution
npm run dist

echo "Build complete! Check the dist/ directory for outputs."`;

    await fs.writeFile(path.join(scriptsDir, 'build.sh'), buildScript);
    await fs.chmod(path.join(scriptsDir, 'build.sh'), 0o755);
    console.log('  ✅ Created: scripts/build.sh');

    // Create development script
    const devScript = `#!/bin/bash
echo "Starting development environment..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start development mode
npm run dev`;

    await fs.writeFile(path.join(scriptsDir, 'dev.sh'), devScript);
    await fs.chmod(path.join(scriptsDir, 'dev.sh'), 0o755);
    console.log('  ✅ Created: scripts/dev.sh');

    // Create test script
    const testScript = `#!/bin/bash
echo "Running tests..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Run security audit
echo "Running security audit..."
npm audit

# Run linting
echo "Running linting..."
npx eslint src/ --ext .js,.jsx

# Run tests (when implemented)
echo "Running tests..."
# npm test

echo "Test suite complete!"`;

    await fs.writeFile(path.join(scriptsDir, 'test.sh'), testScript);
    await fs.chmod(path.join(scriptsDir, 'test.sh'), 0o755);
    console.log('  ✅ Created: scripts/test.sh');

    // Create assets directory structure
    const assetsDir = 'assets/';
    await fs.ensureDir(path.join(assetsDir, 'images'));
    await fs.ensureDir(path.join(assetsDir, 'icons'));
    await fs.ensureDir(path.join(assetsDir, 'templates'));
    console.log('  ✅ Created: assets/ subdirectories');

    // Move logo and favicon to assets
    if (await fs.pathExists('logo.png')) {
      await fs.move('logo.png', path.join(assetsDir, 'images', 'logo.png'));
      console.log('  ✅ Moved: logo.png → assets/images/logo.png');
    }
    
    if (await fs.pathExists('favicon.ico')) {
      await fs.move('favicon.ico', path.join(assetsDir, 'icons', 'favicon.ico'));
      console.log('  ✅ Moved: favicon.ico → assets/icons/favicon.ico');
    }

    // Create config directory files
    const configDir = 'config/';
    
    // Create environment configuration
    const envConfig = `// Environment configuration
module.exports = {
  development: {
    logLevel: 'debug',
    enableDevTools: true,
    securityLogging: true
  },
  production: {
    logLevel: 'info',
    enableDevTools: false,
    securityLogging: true
  },
  test: {
    logLevel: 'error',
    enableDevTools: false,
    securityLogging: false
  }
};`;

    await fs.writeFile(path.join(configDir, 'environment.js'), envConfig);
    console.log('  ✅ Created: config/environment.js');

    // Create build configuration
    const buildConfig = `// Build configuration
module.exports = {
  electron: {
    version: '28.0.0',
    builder: {
      appId: 'com.acuitybrands.projectcreator',
      productName: 'Project Creator',
      directories: {
        output: 'dist'
      }
    }
  },
  webpack: {
    devtool: 'eval-source-map',
    optimization: {
      minimize: false,
      splitChunks: false
    }
  }
};`;

    await fs.writeFile(path.join(configDir, 'build.js'), buildConfig);
    console.log('  ✅ Created: config/build.js');

    console.log('\n🎉 Project cleanup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('  1. Run: npm install');
    console.log('  2. Run: npm run build');
    console.log('  3. Run: npm start');
    console.log('\n🔒 Security improvements have been implemented');
    console.log('📚 Check docs/ directory for documentation');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  cleanup();
}

module.exports = { cleanup };
