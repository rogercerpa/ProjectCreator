# Project Creator

A modern Electron-based desktop application for creating and managing projects, developed for Acuity Brands, Inc.

## Features

- **Project Management**: Create, edit, and organize projects with ease
- **Document Generation**: Generate Word documents and other file formats
- **Modern UI**: Built with React and modern CSS for a professional look
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **File Operations**: Comprehensive file handling and management capabilities

## Screenshots

![Project Creator](acuity.jpg)

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
├── src/                    # Source code
│   ├── components/        # React components
│   ├── services/          # Business logic services
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Utility functions
├── main.js                # Electron main process
├── index.html             # Main HTML file
├── webpack.config.js      # Webpack configuration
└── package.json           # Project dependencies and scripts
```

## Development

This application is built with:
- **Electron** - Desktop application framework
- **React** - User interface library
- **Webpack** - Module bundler
- **Babel** - JavaScript compiler

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

## Company

**Acuity Brands, Inc.** - Lighting and building management solutions

## Version History

- **v5.0.0** - Current version with modern Electron and React
- **v4.2.3** - Previous HTA version

## Support

For support and questions, please contact the development team at Acuity Brands, Inc.
