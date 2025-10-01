# Project Creator

[![Version](https://img.shields.io/badge/version-5.0.84-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-38.0.0-47848F.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.1.1-61DAFB.svg)](https://reactjs.org/)

A modern Electron-based desktop application for creating and managing projects, developed for Acuity Brands, Inc. This application provides a streamlined workflow for project creation, document generation, and agency management.

![Project Creator](assets/images/logo.png)

## ✨ Features

- **📋 Project Wizard**: Step-by-step guided project creation with validation
- **📂 Project Management**: Create, edit, archive, and organize projects with ease
- **📄 Document Generation**: Automated Word document generation from templates
- **🏢 Agency Directory**: Built-in directory for managing agency information
- **💾 Draft Recovery**: Automatic saving and recovery of draft projects
- **🔄 Migration Assistant**: Seamless migration from legacy HTA version (v4.2.5)
- **⚙️ Settings Management**: Comprehensive settings for templates, paths, and preferences
- **🔒 Security**: Enterprise-grade security with context isolation and input validation
- **🎨 Modern UI**: Professional interface built with React and modern CSS
- **🖥️ Cross-Platform**: Works on Windows, macOS, and Linux

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (v8 or higher) - Comes with Node.js
- **Git** - [Download here](https://git-scm.com/)

## 🚀 Quick Start

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd ProjectCreator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development mode**
   ```bash
   npm run dev
   ```

The application will launch automatically in development mode with hot reloading enabled.

## 📦 Available Scripts

### Development

- `npm start` - Start the Electron application
- `npm run dev` - Start development mode with hot reloading and watch mode
- `npm run watch` - Run webpack in watch mode for development

### Building

- `npm run build` - Build the application for production
- `npm run build:dev` - Build for development with source maps
- `npm run pack` - Package the application without creating installers

### Distribution

Create distributable packages for different platforms:

```bash
# Windows (NSIS installer and portable)
npm run dist:win

# macOS (DMG and ZIP)
npm run dist:mac

# Linux (AppImage and DEB)
npm run dist:linux

# All platforms
npm run dist
```

### Testing

- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run test:ci` - Run tests in CI mode
- `npm run test:integration` - Run integration tests only
- `npm run test:unit` - Run unit tests only

### Security

- `npm run security:audit` - Run npm security audit
- `npm run security:fix` - Automatically fix security vulnerabilities
- `npm run security:test` - Run security tests
- `npm run security:full` - Run full security check (audit + tests)

### Version Management

- `npm run version:patch` - Increment patch version (5.0.84 → 5.0.85)
- `npm run version:minor` - Increment minor version (5.0.84 → 5.1.0)
- `npm run version:major` - Increment major version (5.0.84 → 6.0.0)
- `npm run version:show` - Display current version

## 📁 Project Structure

```
ProjectCreator/
├── src/                          # Source code
│   ├── components/               # React components
│   │   ├── wizard/              # Project creation wizard
│   │   ├── Header.jsx           # Application header
│   │   ├── Sidebar.jsx          # Navigation sidebar
│   │   ├── ProjectForm.jsx      # Project form component
│   │   ├── ProjectList.jsx      # Project listing
│   │   ├── Settings.jsx         # Settings interface
│   │   └── AgencyDirectory.jsx  # Agency management
│   ├── services/                # Business logic services
│   │   ├── FileService.js       # File system operations
│   │   ├── ProjectService.js    # Project management logic
│   │   ├── WordService.js       # Word document generation
│   │   ├── ProjectDraftService.js        # Draft persistence
│   │   ├── ProjectCreationService.js     # Project creation
│   │   ├── TemplateValidationService.js  # Template validation
│   │   └── SecurityLoggingService.js     # Security audit logging
│   ├── utils/                   # Utility functions
│   │   ├── security.js          # Security utilities
│   │   └── version.js           # Version information
│   ├── config/                  # Configuration files
│   │   └── security.js          # Security configuration
│   ├── hooks/                   # Custom React hooks
│   ├── App.jsx                  # Main application component
│   └── index.js                 # Application entry point
├── assets/                      # Static assets
│   ├── images/                  # Images and logos
│   ├── icons/                   # Application icons
│   └── templates/               # Document templates
├── build/                       # Build configuration
├── config/                      # Additional configuration
├── docs/                        # Documentation
├── scripts/                     # Build and utility scripts
├── tests/                       # Test files
├── main.js                      # Electron main process
├── preload.js                   # Secure IPC preload script
├── webpack.config.js            # Webpack configuration
└── package.json                 # Project dependencies
```

For a detailed breakdown, see [PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md).

## 🛠️ Technology Stack

### Core Technologies
- **[Electron](https://www.electronjs.org/)** (v38.0.0) - Desktop application framework
- **[React](https://reactjs.org/)** (v19.1.1) - User interface library
- **[Webpack](https://webpack.js.org/)** (v5.101.3) - Module bundler
- **[Babel](https://babeljs.io/)** - JavaScript compiler

### Key Dependencies
- **[docx](https://www.npmjs.com/package/docx)** - Word document generation
- **[xlsx](https://www.npmjs.com/package/xlsx)** - Excel file handling
- **[archiver](https://www.npmjs.com/package/archiver)** - Archive creation
- **[fs-extra](https://www.npmjs.com/package/fs-extra)** - Enhanced file system operations
- **[axios](https://axios-http.com/)** - HTTP client

### Development Tools
- **[Jest](https://jestjs.io/)** - Testing framework
- **[Testing Library](https://testing-library.com/)** - React component testing
- **[Electron Builder](https://www.electron.build/)** - Application packaging

## 🔒 Security Features

This application implements enterprise-grade security practices:

- ✅ **Context Isolation** - Prevents renderer process from accessing Node.js APIs
- ✅ **Secure IPC** - Uses contextBridge for safe communication
- ✅ **Input Validation** - Comprehensive validation and sanitization
- ✅ **Path Traversal Protection** - Blocks attempts to access parent directories
- ✅ **File Type Restrictions** - Prevents execution of dangerous file types
- ✅ **Security Logging** - Comprehensive audit trail for all operations
- ✅ **Content Security Policy** - Strict CSP headers
- ✅ **Regular Security Audits** - Automated vulnerability scanning

For more details, see [SECURITY-AUDIT-REPORT.md](docs/SECURITY-AUDIT-REPORT.md).

## 🖥️ Platform Support

### Windows
- **Installer**: NSIS installer (.exe)
- **Portable**: Standalone executable
- **Architectures**: x64, ia32

### macOS
- **Installer**: DMG package
- **Archive**: ZIP file
- **Architectures**: x64 (Intel), arm64 (Apple Silicon)

### Linux
- **Packages**: AppImage, DEB
- **Architecture**: x64

## 🎯 Usage

### Creating a New Project

1. Launch the application
2. Click **"Create New Project"** or use the wizard
3. Fill in the required project information:
   - Project Name
   - RFA Number
   - Agent Number
   - RFA Type
4. Select or create a project container directory
5. Choose a template (if applicable)
6. Click **"Create Project"** to generate the project structure

### Managing Projects

- **View Projects**: Navigate to the Projects tab to see all your projects
- **Edit Project**: Click on a project to edit its details
- **Archive Project**: Remove projects from active view without deleting
- **Search**: Use the search functionality to quickly find projects

### Settings Configuration

Access settings via the gear icon to configure:
- **Template Paths**: Set paths to Word templates
- **Default Directories**: Configure default project locations
- **Agency Information**: Manage agency directory entries
- **Application Preferences**: Customize UI and behavior

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

Test coverage reports are generated in the `coverage/` directory.

## 📝 Development Workflow

1. **Start development mode**
   ```bash
   npm run dev
   ```

2. **Make your changes** in the `src/` directory

3. **Test your changes**
   ```bash
   npm test
   ```

4. **Run security audit**
   ```bash
   npm run security:audit
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

6. **Create distribution package**
   ```bash
   npm run dist:win  # or dist:mac, dist:linux
   ```

## 🐛 Troubleshooting

### Common Issues

**Issue: Application won't start**
- Ensure all dependencies are installed: `npm install`
- Clear the build cache: `rm -rf dist/` and rebuild

**Issue: Build fails**
- Check Node.js version: `node --version` (should be v16+)
- Update dependencies: `npm update`

**Issue: Templates not loading**
- Verify template paths in Settings
- Ensure template files are valid .docx format

## 📚 Documentation

Additional documentation is available in the `docs/` directory:

- [Project Structure](docs/PROJECT-STRUCTURE.md) - Detailed project organization
- [Security Audit Report](docs/SECURITY-AUDIT-REPORT.md) - Security analysis
- [Cleanup Summary](docs/CLEANUP-SUMMARY.md) - Migration and cleanup information

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run tests and security audit: `npm test && npm run security:audit`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.

## 🏢 Company

**Acuity Brands, Inc.**  
Lighting and building management solutions  
[www.acuitybrands.com](https://www.acuitybrands.com)

## 📞 Support

For support and questions:

- **General Support**: Contact the development team at Acuity Brands
- **Security Issues**: security@acuitybrands.com
- **Bug Reports**: Use the project issue tracker
- **Documentation**: Check the `docs/` directory

## 📊 Version History

- **v5.0.84** (Current) - Modern Electron and React implementation
  - Enhanced security features
  - Project wizard with guided workflow
  - Draft recovery system
  - Migration assistant
  - Comprehensive settings management

- **v4.2.5** (Legacy) - Previous HTA version
  - Original implementation
  - Basic project creation

## 🙏 Acknowledgments

Developed with ❤️ for Acuity Brands, Inc.

Built with amazing open-source technologies:
- [Electron](https://www.electronjs.org/)
- [React](https://reactjs.org/)
- [Webpack](https://webpack.js.org/)
- And many other great libraries

---

**Last Updated**: October 1, 2025  
**Current Version**: 5.0.84  
**Maintained by**: Acuity Brands Development Team

