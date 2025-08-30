// Version utility for Project Creator
// This file provides version information to components

// Version information - hardcoded for reliability
export const APP_VERSION = '5.0.8';
export const APP_NAME = 'project-creator';
export const APP_DESCRIPTION = 'Professional Project Management & Document Automation Tool';

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
