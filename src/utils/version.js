// Version utility for Project Creator
// This file reads the version from package.json and provides it to components

// Import package.json version
const packageJson = require('../../package.json');

// Export version information
export const APP_VERSION = packageJson.version;
export const APP_NAME = packageJson.name;
export const APP_DESCRIPTION = packageJson.description;

// Version display helpers
export const getVersionDisplay = () => `v${APP_VERSION}`;
export const getFullVersionInfo = () => `Version ${APP_VERSION} - Built with Electron & React`;

// Build information
export const BUILD_INFO = {
  version: APP_VERSION,
  name: APP_NAME,
  description: APP_DESCRIPTION,
  buildDate: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development'
};

export default {
  APP_VERSION,
  APP_NAME,
  APP_DESCRIPTION,
  getVersionDisplay,
  getFullVersionInfo,
  BUILD_INFO
};
