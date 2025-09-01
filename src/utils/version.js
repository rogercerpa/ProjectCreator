// Version utility for Project Creator
// This file provides version information to components

// Import version from package.json
import packageJson from '../../package.json';

// Version information - dynamically loaded from package.json
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
  environment: 'production'
};

export default {
  APP_VERSION,
  APP_NAME,
  APP_DESCRIPTION,
  getVersionDisplay,
  getFullVersionInfo,
  BUILD_INFO
};
