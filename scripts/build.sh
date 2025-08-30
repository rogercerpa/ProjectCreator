#!/bin/bash
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

echo "Build complete! Check the dist/ directory for outputs."
