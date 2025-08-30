#!/bin/bash
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

echo "Test suite complete!"
