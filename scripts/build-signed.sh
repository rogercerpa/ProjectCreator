#!/bin/bash

# Project Creator - Signed Build Script
# This script builds the application with code signing for different platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="Project Creator"
VERSION=$(node -p "require('./package.json').version")
BUILD_DIR="dist"
CERT_DIR="certificates"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running in correct directory
if [ ! -f "package.json" ]; then
    log_error "Please run this script from the project root directory"
    exit 1
fi

# Parse command line arguments
PLATFORM=""
ENVIRONMENT="development"
SKIP_SIGNING=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-signing)
            SKIP_SIGNING=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --platform PLATFORM    Target platform (win, mac, linux, all)"
            echo "  --env ENVIRONMENT      Build environment (development, staging, production)"
            echo "  --skip-signing         Skip code signing"
            echo "  --help                 Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Set default platform if not specified
if [ -z "$PLATFORM" ]; then
    case "$(uname -s)" in
        Linux*)     PLATFORM="linux";;
        Darwin*)    PLATFORM="mac";;
        CYGWIN*|MINGW*|MSYS*) PLATFORM="win";;
        *)          PLATFORM="all";;
    esac
fi

log_info "Building $APP_NAME v$VERSION for $PLATFORM ($ENVIRONMENT environment)"

# Clean previous builds
log_info "Cleaning previous builds..."
rm -rf $BUILD_DIR
mkdir -p $BUILD_DIR

# Install dependencies
log_info "Installing dependencies..."
npm ci

# Run security audit
log_info "Running security audit..."
if ! npm audit --audit-level=moderate; then
    log_warning "Security vulnerabilities found. Consider running 'npm audit fix'"
fi

# Build the application
log_info "Building application..."
npm run build

# Check if code signing should be skipped
if [ "$SKIP_SIGNING" = true ] || [ "$ENVIRONMENT" = "development" ]; then
    log_warning "Skipping code signing for $ENVIRONMENT environment"
    SKIP_SIGNING=true
fi

# Build for specific platform
case $PLATFORM in
    "win")
        log_info "Building for Windows..."
        if [ "$SKIP_SIGNING" = false ]; then
            # Check for Windows code signing certificate
            if [ ! -f "$CERT_DIR/acuity-brands.p12" ]; then
                log_warning "Code signing certificate not found. Building without signing."
                SKIP_SIGNING=true
            fi
        fi
        
        if [ "$SKIP_SIGNING" = true ]; then
            npm run dist:win
        else
            CSC_LINK="$CERT_DIR/acuity-brands.p12" npm run dist:win
        fi
        ;;
    "mac")
        log_info "Building for macOS..."
        if [ "$SKIP_SIGNING" = false ]; then
            # Check for macOS code signing identity
            if [ -z "$CSC_IDENTITY" ]; then
                log_warning "Code signing identity not set. Building without signing."
                SKIP_SIGNING=true
            fi
        fi
        
        if [ "$SKIP_SIGNING" = true ]; then
            npm run dist:mac
        else
            CSC_IDENTITY="$CSC_IDENTITY" npm run dist:mac
        fi
        ;;
    "linux")
        log_info "Building for Linux..."
        npm run dist:linux
        ;;
    "all")
        log_info "Building for all platforms..."
        if [ "$SKIP_SIGNING" = false ]; then
            log_warning "Building for all platforms with code signing may require multiple certificates"
        fi
        npm run dist
        ;;
    *)
        log_error "Unknown platform: $PLATFORM"
        exit 1
        ;;
esac

# Verify build output
log_info "Verifying build output..."
if [ -d "$BUILD_DIR" ]; then
    log_success "Build completed successfully!"
    log_info "Build artifacts:"
    ls -la $BUILD_DIR/
else
    log_error "Build failed - no output directory found"
    exit 1
fi

# Security check
log_info "Running security checks..."
if command -v "codesign" &> /dev/null && [ "$PLATFORM" = "mac" ]; then
    log_info "Verifying macOS code signature..."
    find $BUILD_DIR -name "*.app" -exec codesign -v {} \;
fi

log_success "Build process completed!"
log_info "Next steps:"
log_info "1. Test the built application"
log_info "2. Distribute to users"
log_info "3. Monitor for any issues"


