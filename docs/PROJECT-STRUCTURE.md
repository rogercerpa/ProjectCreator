# 📁 Project Creator - Project Structure

## Overview

This document outlines the new, organized project structure for the Project Creator application. The structure has been optimized for security, maintainability, and industry best practices.

## 🏗️ Directory Structure

```
ProjectCreator/
├── 📁 src/                          # Source code
│   ├── 📁 components/               # React components
│   │   ├── Header.jsx              # Application header
│   │   ├── ProjectForm.jsx         # Project creation form
│   │   ├── ProjectList.jsx         # Project listing component
│   │   ├── Settings.jsx            # Settings component
│   │   ├── WorkloadDashboard.jsx   # MS Lists integration dashboard
│   │   ├── Sidebar.jsx             # Navigation sidebar
│   │   └── 📁 settings/           # Settings components
│   │       └── WorkloadTab.jsx     # MS 365 workload settings
│   ├── 📁 services/                # Business logic services (renderer)
│   │   ├── FileService.js          # File system operations
│   │   ├── ProjectService.js       # Project management
│   │   ├── WordService.js          # Word document operations
│   │   └── ProjectPersistenceService.js  # Data persistence
│   ├── 📁 utils/                   # Utility functions
│   │   ├── security.js             # Security utilities
│   │   └── version.js              # Version information
│   ├── 📁 hooks/                   # React custom hooks
│   ├── App.jsx                     # Main application component
│   ├── App.css                     # Application styles
│   └── index.js                    # Application entry point
├── 📁 main-process/                 # Electron main process code
│   ├── 📁 services/                # Backend services
│   │   ├── WorkloadExcelService.js      # Excel read/write operations
│   │   ├── WorkloadExcelSyncService.js  # Excel file sync and monitoring
│   │   └── FieldMappingService.js       # Field mapping between app and Excel
│   └── 📁 config/                  # Configuration files
│       └── defaultFieldMapping.json     # Default Excel field mappings
├── 📁 assets/                      # Static assets
│   ├── 📁 images/                  # Image files
│   │   └── logo.png                # Application logo
│   ├── 📁 icons/                   # Icon files
│   │   └── favicon.ico             # Browser favicon
│   └── 📁 templates/               # Template files
├── 📁 docs/                        # Documentation
│   ├── README.md                   # Project overview
│   ├── PROJECT-STRUCTURE.md        # This file
│   ├── SECURITY-AUDIT-REPORT.md    # Security documentation
│   ├── MS365-WORKLOAD-SETUP.md     # MS 365 setup guide
│   ├── MS365-POWER-AUTOMATE-FLOWS.md # Power Automate guide
│   ├── MS365-WORKLOAD-IMPLEMENTATION-SUMMARY.md # Implementation details
│   ├── POWER-AUTOMATE-QUICK-REFERENCE.md # Power Automate reference
│   ├── POWER-AUTOMATE-STEP-BY-STEP.md # Power Automate setup
│   └── POWER-AUTOMATE-EXCEL-ALTERNATIVE.md # Alternative approach
├── 📁 scripts/                     # Build and utility scripts
│   ├── build.sh                    # Build script
│   ├── dev.sh                      # Development script
│   └── test.sh                     # Testing script
├── 📁 tests/                       # Test files
├── 📁 dist/                        # Build outputs (Vite)
├── 📄 main.js                      # Electron main process
├── 📄 preload.js                   # Secure IPC preload script
├── 📄 vite.config.js               # Vite configuration
├── 📄 package.json                 # Project dependencies
├── 📄 .gitignore                   # Git ignore rules
├── 📄 .eslintrc.js                 # ESLint configuration
├── 📄 .prettierrc                  # Prettier configuration
└── 📄 cleanup.js                   # Project cleanup script
```

## 🔒 Security Architecture

### Secure IPC Communication
- **Preload Script**: `preload.js` uses `contextBridge` to securely expose APIs
- **Context Isolation**: Enabled to prevent renderer process from accessing Node.js APIs
- **Input Validation**: Comprehensive validation in `src/utils/security.js`
- **Security Logging**: All security events logged via `SecurityLoggingService`

### Security Features
- ✅ Context isolation enabled
- ✅ Node.js integration disabled
- ✅ Web security enabled
- ✅ Secure IPC communication
- ✅ Input validation and sanitization
- ✅ Security event logging
- ✅ Audit trail for file operations

## 🚀 Development Workflow

### Prerequisites
```bash
# Install Node.js (v16 or higher)
# Install npm or yarn
```

### Setup
```bash
# Clone repository
git clone <repository-url>
cd ProjectCreator

# Install dependencies
npm install

# Run cleanup script (first time only)
node cleanup.js
```

### Development
```bash
# Start development mode
npm run dev

# Or use the script
./scripts/dev.sh
```

### Building
```bash
# Build for development
npm run build:dev

# Build for production
npm run build

# Package for distribution
npm run dist

# Or use the script
./scripts/build.sh
```

### Testing
```bash
# Run security audit
npm audit

# Run linting
npx eslint src/ --ext .js,.jsx

# Run tests (when implemented)
npm test

# Or use the script
./scripts/test.sh
```

## 📦 Package Scripts

### Available Scripts
- `npm start` - Start Electron application
- `npm run dev` - Development mode with hot reload
- `npm run watch` - Watch mode for development
- `npm run build` - Production build
- `npm run build:dev` - Development build
- `npm run pack` - Package application
- `npm run dist` - Build and package for distribution
- `npm run dist:win` - Windows distribution
- `npm run dist:mac` - macOS distribution
- `npm run dist:linux` - Linux distribution

### Version Management
- `npm run version:patch` - Increment patch version
- `npm run version:minor` - Increment minor version
- `npm run version:major` - Increment major version
- `npm run version:show` - Display current version

## 🔧 Configuration Files

### Vite Configuration
- **Entry**: `src/index.js`
- **Output**: `dist/`
- **Target**: `electron-renderer`
- **Security**: CSP headers, asset optimization
- **Build Tool**: Vite (replaced Webpack)

### ESLint Configuration
- **Environment**: Browser, ES2021, Node.js
- **Rules**: React recommended, security-focused
- **Plugins**: React, React Hooks

### Prettier Configuration
- **Semicolons**: Enabled
- **Quotes**: Single quotes
- **Tab Width**: 2 spaces
- **Print Width**: 80 characters

## 🛡️ Security Configuration

### Content Security Policy
```javascript
'default-src': ["'self'"],
'script-src': ["'self'", "'unsafe-inline'"],
'style-src': ["'self'", "'unsafe-inline'"],
'img-src': ["'self'", "data:", "https:"],
'frame-src': ["'none'"],
'object-src': ["'none'"]
```

### File Upload Restrictions
- **Max Size**: 50MB
- **Allowed Types**: .docx, .doc, .pdf, .xlsx, .xls, .txt, .csv
- **Blocked Types**: .exe, .bat, .cmd, .com, .pif, .scr, .vbs, .js, .jar

### Rate Limiting
- **Max Requests**: 100 per minute
- **Login Attempts**: 5 before lockout
- **Lockout Duration**: 5 minutes

## 📊 Build Outputs

### Development Build
- **Location**: `dist/`
- **Files**: `bundle.js`, `index.html`, assets
- **Source Maps**: Enabled for debugging

### Production Build
- **Location**: `dist/`
- **Files**: Minified bundle, optimized assets
- **Source Maps**: Disabled for security

### Distribution Packages
- **Windows**: NSIS installer (.exe)
- **macOS**: DMG package
- **Linux**: AppImage package

## 🔍 Monitoring & Logging

### Security Logs
- **Location**: `~/.project-creator/logs/`
- **Files**: `security.log`, `audit.log`
- **Events**: Login attempts, file access, suspicious activity

### Application Logs
- **Console**: Development mode
- **File**: Production mode
- **Levels**: Debug, Info, Warning, Error

## 🚨 Security Considerations

### Critical Security Features
1. **Context Isolation**: Prevents renderer process from accessing Node.js APIs
2. **Input Validation**: All user inputs validated and sanitized
3. **Path Traversal Protection**: Blocks attempts to access parent directories
4. **File Type Restrictions**: Prevents execution of dangerous file types
5. **Security Logging**: Comprehensive audit trail for all operations

### Security Best Practices
- ✅ Principle of least privilege
- ✅ Defense in depth
- ✅ Secure by default
- ✅ Input validation
- ✅ Output encoding
- ✅ Error handling
- ✅ Logging and monitoring

## 📈 Performance Optimization

### Vite Optimizations
- **Code Splitting**: Automatic chunk splitting
- **Tree Shaking**: Unused code elimination
- **Minification**: Production builds
- **Asset Optimization**: Image and font optimization
- **Fast HMR**: Hot module replacement for development

### Electron Optimizations
- **Process Management**: Efficient main/renderer communication
- **Memory Management**: Proper cleanup and garbage collection
- **Resource Loading**: Optimized asset loading

## 🔄 Maintenance

### Regular Tasks
- **Monthly**: Dependency updates and security audits
- **Quarterly**: Security penetration testing
- **Annually**: Comprehensive security review

### Monitoring
- **Security Events**: Real-time monitoring
- **Performance Metrics**: Regular performance reviews
- **Error Tracking**: Automated error reporting

## 📞 Support

### Development Team
- **Email**: dev@acuitybrands.com
- **Documentation**: Check `docs/` directory
- **Issues**: Use project issue tracker

### Security Team
- **Email**: security@acuitybrands.com
- **Emergency**: security-emergency@acuitybrands.com
- **Reports**: security@acuitybrands.com

---

## 🔄 MS 365 Integration Architecture

### Excel/MS Lists Integration
- **WorkloadExcelService**: Handles Excel file operations (read/write)
- **WorkloadExcelSyncService**: Monitors Excel file changes and syncs bidirectionally
- **FieldMappingService**: Manages field mappings between app data and Excel columns
- **Default Field Mapping**: Configured in `main-process/config/defaultFieldMapping.json`

### Data Flow
```
App → Excel File ↔ Power Automate ↔ MS Lists
  ↑                                    ↓
  └─────────── Sync Now ─────────────┘
```

---

*Last Updated: December 2024*
*Project Creator v5.0.163*
*Security Level: Industry Standard*
