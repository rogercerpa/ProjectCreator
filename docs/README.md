# Project Creator

A modern Electron-based desktop application for creating and managing projects, developed for Roger Cerpa.

## Features

- **Project Management**: Create, edit, and organize projects with ease
- **MS 365 Integration**: Seamless integration with Microsoft Excel and MS Lists for workload management
  - Export projects and assignments to Excel
  - Sync with MS Lists via Power Automate
  - Bidirectional data synchronization
- **Workload Dashboard**: Summary dashboard with MS Lists integration for team collaboration
- **Document Generation**: Generate Word documents and other file formats
- **Modern UI**: Built with React and modern CSS for a professional look
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **File Operations**: Comprehensive file handling and management capabilities

## Screenshots

![Project Creator](logo.png)

## Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- Git

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-github-repo-url>
   cd ProjectCreator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

## Available Scripts

- `npm start` - Start the Electron application
- `npm run dev` - Start development mode with hot reloading
- `npm run build` - Build for production
- `npm run dist` - Build and package the application
- `npm run dist:win` - Build for Windows
- `npm run dist:mac` - Build for macOS
- `npm run dist:linux` - Build for Linux

## Project Structure

```
ProjectCreator/
├── src/                           # Source code
│   ├── components/               # React components
│   │   ├── WorkloadDashboard.jsx # MS Lists integration dashboard
│   │   └── settings/             # Settings components
│   ├── services/                 # Business logic services
│   ├── hooks/                    # Custom React hooks
│   └── utils/                    # Utility functions
├── main-process/                 # Electron main process code
│   ├── services/                 # Backend services
│   │   ├── WorkloadExcelService.js      # Excel operations
│   │   ├── WorkloadExcelSyncService.js  # Excel sync
│   │   └── FieldMappingService.js       # Field mapping
│   └── config/                   # Configuration files
│       └── defaultFieldMapping.json     # Excel field mappings
├── docs/                         # Documentation
│   ├── MS365-WORKLOAD-SETUP.md   # MS 365 setup guide
│   └── MS365-POWER-AUTOMATE-FLOWS.md # Power Automate guide
├── main.js                       # Electron main process
├── preload.js                    # Secure IPC preload script
├── index.html                    # Main HTML file
└── package.json                  # Project dependencies and scripts
```

## Development

This application is built with:
- **Electron** - Desktop application framework
- **React 19** - User interface library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **XLSX (SheetJS)** - Excel file operations for MS 365 integration

## Building for Distribution

To create distributable packages:

```bash
# For Windows
npm run dist:win

# For macOS
npm run dist:mac

# For Linux
npm run dist:linux
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.



## Version History

- **v5.0.163** - Current version with MS 365 Excel/MS Lists integration
- **v5.0.130+** - MS 365 Workload Integration implementation
- **v5.0.0** - Modern Electron and React version
- **v4.2.3** - Previous HTA version

## MS 365 Integration

The application integrates with Microsoft 365 for workload management:

- **Excel Integration**: Export/import projects and assignments to Excel files
- **MS Lists Integration**: Sync with Microsoft Lists via Power Automate flows
- **Bidirectional Sync**: Changes in MS Lists sync back to Excel and the app

For setup instructions, see:
- [MS 365 Workload Setup Guide](./docs/MS365-WORKLOAD-SETUP.md)
- [Power Automate Flows Guide](./docs/MS365-POWER-AUTOMATE-FLOWS.md)

## Support

For support and questions, please contact the development team at Acuity Brands, Inc.
