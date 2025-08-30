#!/bin/bash
echo "Starting development environment..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start development mode
npm run dev
