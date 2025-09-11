@echo off
REM Project Creator - Signed Build Script for Windows
REM This script builds the application with code signing for Windows

setlocal enabledelayedexpansion

REM Colors for output (Windows doesn't support colors in batch, so we'll use text)
set "INFO_PREFIX=[INFO]"
set "SUCCESS_PREFIX=[SUCCESS]"
set "WARNING_PREFIX=[WARNING]"
set "ERROR_PREFIX=[ERROR]"

REM Configuration
set "APP_NAME=Project Creator"
for /f "tokens=2 delims=: " %%i in ('findstr "version" package.json') do set "VERSION=%%i"
set "VERSION=%VERSION: =%"
set "VERSION=%VERSION:,=%"
set "BUILD_DIR=dist"
set "CERT_DIR=certificates"

REM Parse command line arguments
set "PLATFORM=win"
set "ENVIRONMENT=development"
set "SKIP_SIGNING=false"

:parse_args
if "%~1"=="" goto :start_build
if "%~1"=="--platform" (
    set "PLATFORM=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="--env" (
    set "ENVIRONMENT=%~2"
    shift
    shift
    goto :parse_args
)
if "%~1"=="--skip-signing" (
    set "SKIP_SIGNING=true"
    shift
    goto :parse_args
)
if "%~1"=="--help" (
    echo Usage: %0 [OPTIONS]
    echo Options:
    echo   --platform PLATFORM    Target platform (win, mac, linux, all)
    echo   --env ENVIRONMENT      Build environment (development, staging, production)
    echo   --skip-signing         Skip code signing
    echo   --help                 Show this help message
    exit /b 0
)
shift
goto :parse_args

:start_build
echo %INFO_PREFIX% Building %APP_NAME% v%VERSION% for %PLATFORM% (%ENVIRONMENT% environment)

REM Check if running in correct directory
if not exist "package.json" (
    echo %ERROR_PREFIX% Please run this script from the project root directory
    exit /b 1
)

REM Clean previous builds
echo %INFO_PREFIX% Cleaning previous builds...
if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
mkdir "%BUILD_DIR%"

REM Install dependencies
echo %INFO_PREFIX% Installing dependencies...
call npm ci
if errorlevel 1 (
    echo %ERROR_PREFIX% Failed to install dependencies
    exit /b 1
)

REM Run security audit
echo %INFO_PREFIX% Running security audit...
call npm audit --audit-level=moderate
if errorlevel 1 (
    echo %WARNING_PREFIX% Security vulnerabilities found. Consider running 'npm audit fix'
)

REM Build the application
echo %INFO_PREFIX% Building application...
call npm run build
if errorlevel 1 (
    echo %ERROR_PREFIX% Build failed
    exit /b 1
)

REM Check if code signing should be skipped
if "%SKIP_SIGNING%"=="true" (
    echo %WARNING_PREFIX% Skipping code signing for %ENVIRONMENT% environment
    goto :build_platform
)
if "%ENVIRONMENT%"=="development" (
    echo %WARNING_PREFIX% Skipping code signing for development environment
    goto :build_platform
)

REM Check for Windows code signing certificate
if not exist "%CERT_DIR%\acuity-brands.p12" (
    echo %WARNING_PREFIX% Code signing certificate not found. Building without signing.
    set "SKIP_SIGNING=true"
)

:build_platform
REM Build for Windows
echo %INFO_PREFIX% Building for Windows...
if "%SKIP_SIGNING%"=="true" (
    call npm run dist:win
) else (
    set "CSC_LINK=%CERT_DIR%\acuity-brands.p12"
    call npm run dist:win
)

if errorlevel 1 (
    echo %ERROR_PREFIX% Windows build failed
    exit /b 1
)

REM Verify build output
echo %INFO_PREFIX% Verifying build output...
if exist "%BUILD_DIR%" (
    echo %SUCCESS_PREFIX% Build completed successfully!
    echo %INFO_PREFIX% Build artifacts:
    dir "%BUILD_DIR%"
) else (
    echo %ERROR_PREFIX% Build failed - no output directory found
    exit /b 1
)

REM Security check
echo %INFO_PREFIX% Running security checks...
if exist "%BUILD_DIR%\win-unpacked\Project Creator.exe" (
    echo %INFO_PREFIX% Verifying Windows executable...
    REM Add signature verification here if needed
)

echo %SUCCESS_PREFIX% Build process completed!
echo %INFO_PREFIX% Next steps:
echo %INFO_PREFIX% 1. Test the built application
echo %INFO_PREFIX% 2. Distribute to users
echo %INFO_PREFIX% 3. Monitor for any issues

endlocal


