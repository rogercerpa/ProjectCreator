# 🚀 Project Creator 2024 - Electron Edition

## Overview

This is the **Phase 2** migration of your HTA application to a modern **Electron + React** desktop application. The application provides a professional, responsive interface for creating and managing projects with enhanced functionality and better user experience.

## ✨ What's New in Version 5.0.0

### 🎨 Modern UI/UX
- **Responsive Design**: Works on all screen sizes
- **Professional Appearance**: Modern Material Design-inspired interface
- **Real-time Validation**: Instant feedback on form inputs
- **Interactive Elements**: Hover effects, animations, and smooth transitions

### 🚀 Enhanced Functionality
- **Project Management**: Create, edit, and view projects
- **Advanced Search**: Find projects quickly with search and filtering
- **Sorting Options**: Sort projects by various criteria
- **Triage Calculations**: Real-time calculation updates
- **Error Handling**: Comprehensive error management and user feedback

### 🔧 Technical Improvements
- **Electron Backend**: Native desktop application performance
- **React Frontend**: Modern component-based architecture
- **File System Integration**: Direct access to local files and folders
- **Cross-platform**: Windows, Mac, and Linux support
- **Auto-updates**: Built-in update mechanism

## 🏗️ Architecture

```
Project Creator 2024/
├── main.js                 # Electron main process
├── index.html              # Main HTML template
├── src/                    # React source code
│   ├── App.jsx            # Main application component
│   ├── App.css            # Main application styles
│   └── components/        # React components
│       ├── Header.jsx     # Application header
│       ├── Sidebar.jsx    # Navigation sidebar
│       ├── ProjectForm.jsx # Project creation/editing form
│       └── ProjectList.jsx # Project list and management
├── webpack.config.js       # Build configuration
├── package.json            # Dependencies and scripts
└── assets/                 # Images and icons
    ├── acuity_brands.ico  # Application icon
    └── acuity.jpg         # Company logo
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)

### Installation

1. **Clone or download** the project files
2. **Open terminal/command prompt** in the project directory
3. **Install dependencies**:
   ```bash
   npm install
   ```

### Development Mode

1. **Start the application**:
   ```bash
   npm run dev
   ```
   This will:
   - Start Electron in development mode
   - Watch for file changes
   - Auto-reload the application

2. **Build for production**:
   ```bash
   npm run build
   ```

### Production Build

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Create distributable**:
   ```bash
   # Windows
   npm run dist:win
   
   # macOS
   npm run dist:mac
   
   # Linux
   npm run dist:linux
   
   # All platforms
   npm run dist
   ```

## 📱 Application Features

### 🏠 Welcome Screen
- **Quick Start**: Create new projects or open existing ones
- **Recent Projects**: Access recently worked on projects
- **Navigation**: Easy access to all application features

### 📝 Project Form
- **Basic Information**: Project name, RFA number, agent details
- **LMPs and ARPs**: Configure lighting and automation parameters
- **Additional Calculations**: Room multipliers, review settings, etc.
- **Real-time Triage**: Automatic calculation updates
- **Validation**: Form validation with error messages

### 📁 Project Management
- **Project List**: View all projects in a card-based layout
- **Search & Filter**: Find projects quickly
- **Sorting**: Sort by creation date, name, or other criteria
- **Status Indicators**: Visual triage level indicators
- **Quick Actions**: Click to edit any project

### 🎯 Triage Calculations
- **Automatic Updates**: Real-time calculation as you type
- **Visual Results**: Clear display of all calculation components
- **Status Indicators**: Color-coded triage levels
- **Breakdown View**: Detailed component breakdown

## 🎨 User Interface

### Design Principles
- **Clean & Modern**: Professional appearance suitable for business use
- **Responsive**: Adapts to different screen sizes
- **Accessible**: Proper focus states and keyboard navigation
- **Consistent**: Unified design language throughout

### Color Scheme
- **Primary**: Blue gradient (#667eea to #764ba2)
- **Success**: Green (#48bb78)
- **Warning**: Orange (#ed8936)
- **Error**: Red (#f56565)
- **Neutral**: Grays (#2d3748, #718096, #e2e8f0)

### Typography
- **Font Family**: Segoe UI (Windows), system fonts (Mac/Linux)
- **Hierarchy**: Clear heading levels and text sizing
- **Readability**: Optimized line heights and spacing

## 🔧 Technical Details

### Electron Configuration
- **Main Process**: Handles file system operations and application lifecycle
- **Renderer Process**: React application with modern web technologies
- **IPC Communication**: Secure communication between processes
- **File Dialogs**: Native file and folder selection

### React Components
- **Functional Components**: Modern React with hooks
- **State Management**: Local state with React useState
- **Event Handling**: Form inputs, navigation, and user interactions
- **Styling**: CSS modules with responsive design

### Build System
- **Webpack**: Modern bundling with hot reload
- **Babel**: ES6+ and JSX compilation
- **CSS Processing**: Style loading and optimization
- **Asset Management**: Image and icon handling

## 📁 File Structure

### Source Files
```
src/
├── App.jsx              # Main application component
├── App.css              # Main application styles
├── components/          # React components
│   ├── Header.jsx      # Application header
│   ├── Header.css      # Header styles
│   ├── Sidebar.jsx     # Navigation sidebar
│   ├── Sidebar.css     # Sidebar styles
│   ├── ProjectForm.jsx # Project form component
│   ├── ProjectForm.css # Form styles
│   ├── ProjectList.jsx # Project list component
│   └── ProjectList.css # List styles
├── services/            # Business logic services
├── utils/               # Utility functions
└── hooks/               # Custom React hooks
```

### Configuration Files
```
├── main.js              # Electron main process
├── index.html           # HTML template
├── webpack.config.js    # Build configuration
├── package.json         # Dependencies and scripts
└── .gitignore           # Git ignore rules
```

## 🚀 Development Workflow

### 1. Development Mode
```bash
npm run dev
```
- Starts Electron with hot reload
- Watches for file changes
- Opens DevTools automatically

### 2. Building
```bash
npm run build
```
- Compiles React components
- Bundles CSS and JavaScript
- Creates production-ready files

### 3. Testing
```bash
npm start
```
- Runs the built application
- Tests production build
- Verifies functionality

### 4. Distribution
```bash
npm run dist:win
```
- Creates Windows installer
- Packages all dependencies
- Generates distributable files

## 🔍 Troubleshooting

### Common Issues

1. **Application won't start**
   - Check Node.js version (v16+ required)
   - Run `npm install` to ensure dependencies
   - Check console for error messages

2. **Build failures**
   - Clear `node_modules` and reinstall
   - Check webpack configuration
   - Verify all dependencies are installed

3. **Performance issues**
   - Close other applications
   - Check available memory
   - Monitor CPU usage

### Debug Mode
- **Development**: DevTools open automatically
- **Production**: Use `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
- **Logs**: Check console for error messages

## 📚 API Reference

### Main Process (Electron)
- **File Operations**: `ipcMain.handle('fs-*')`
- **Dialog Operations**: `ipcMain.handle('select-*')`
- **Error Handling**: Global error handlers

### Renderer Process (React)
- **State Management**: React hooks and state
- **Event Handling**: Form inputs and user interactions
- **IPC Communication**: `ipcRenderer.invoke()`

## 🔮 Future Enhancements

### Planned Features
- **Project Templates**: Pre-configured project types
- **Export Options**: PDF, Excel, and Word document generation
- **Cloud Sync**: Project backup and sharing
- **Advanced Analytics**: Project performance metrics
- **User Management**: Multi-user support and permissions

### Technical Improvements
- **TypeScript**: Type safety and better development experience
- **State Management**: Redux or Zustand for complex state
- **Testing**: Unit and integration tests
- **CI/CD**: Automated build and deployment
- **Performance**: Lazy loading and optimization

## 📞 Support

### Getting Help
- **Documentation**: Check this README and code comments
- **Issues**: Report bugs and feature requests
- **Development**: Contact the development team

### Contributing
- **Code Style**: Follow existing patterns
- **Testing**: Test changes thoroughly
- **Documentation**: Update docs for new features

## 📄 License

This project is proprietary software owned by Acuity Brands, Inc.

---

**Version**: 5.0.0  
**Last Updated**: December 2024  
**Platform**: Electron + React  
**Architecture**: Modern Desktop Application
