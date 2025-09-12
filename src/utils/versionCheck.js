/**
 * Version Check Utility
 * Handles version comparison and upgrade detection
 */

import { app } from 'electron';
import fs from 'fs-extra';
import path from 'path';

class VersionCheckService {
  constructor() {
    this.currentVersion = app.getVersion();
    this.versionFile = path.join(app.getPath('userData'), 'version.json');
  }

  /**
   * Get current application version
   */
  getCurrentVersion() {
    return this.currentVersion;
  }

  /**
   * Get previous version from stored data
   */
  async getPreviousVersion() {
    try {
      if (await fs.pathExists(this.versionFile)) {
        const versionData = await fs.readJson(this.versionFile);
        return versionData.previousVersion || null;
      }
    } catch (error) {
      console.warn('Could not read previous version:', error);
    }
    return null;
  }

  /**
   * Check if this is a new installation or upgrade
   */
  async isUpgrade() {
    const previousVersion = await this.getPreviousVersion();
    if (!previousVersion) {
      return false; // Fresh installation
    }
    
    return this.compareVersions(this.currentVersion, previousVersion) > 0;
  }

  /**
   * Check if this is a fresh installation
   */
  async isFreshInstall() {
    const previousVersion = await this.getPreviousVersion();
    return !previousVersion;
  }

  /**
   * Save current version for future upgrade detection
   */
  async saveCurrentVersion() {
    try {
      const versionData = {
        currentVersion: this.currentVersion,
        previousVersion: await this.getPreviousVersion(),
        installDate: new Date().toISOString(),
        upgradeDate: new Date().toISOString()
      };

      await fs.ensureDir(path.dirname(this.versionFile));
      await fs.writeJson(this.versionFile, versionData, { spaces: 2 });
      
      console.log('Version information saved:', versionData);
    } catch (error) {
      console.error('Failed to save version information:', error);
    }
  }

  /**
   * Compare two version strings
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  compareVersions(v1, v2) {
    const parseVersion = (version) => {
      return version.split('.').map(num => parseInt(num, 10) || 0);
    };

    const v1Parts = parseVersion(v1);
    const v2Parts = parseVersion(v2);
    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }

  /**
   * Get upgrade information
   */
  async getUpgradeInfo() {
    const previousVersion = await this.getPreviousVersion();
    const isUpgrade = await this.isUpgrade();
    const isFresh = await this.isFreshInstall();

    return {
      currentVersion: this.currentVersion,
      previousVersion,
      isUpgrade,
      isFreshInstall: isFresh,
      upgradeType: isFresh ? 'fresh' : (isUpgrade ? 'upgrade' : 'reinstall')
    };
  }

  /**
   * Handle post-installation tasks
   */
  async handlePostInstall() {
    const upgradeInfo = await this.getUpgradeInfo();
    
    console.log('Post-installation check:', upgradeInfo);

    if (upgradeInfo.isUpgrade) {
      console.log(`Upgraded from version ${upgradeInfo.previousVersion} to ${upgradeInfo.currentVersion}`);
      // Add any upgrade-specific logic here
      await this.handleUpgrade(upgradeInfo.previousVersion, upgradeInfo.currentVersion);
    } else if (upgradeInfo.isFreshInstall) {
      console.log('Fresh installation detected');
      // Add any fresh install logic here
      await this.handleFreshInstall();
    }

    // Save current version
    await this.saveCurrentVersion();
  }

  /**
   * Handle upgrade-specific tasks
   */
  async handleUpgrade(fromVersion, toVersion) {
    console.log(`Handling upgrade from ${fromVersion} to ${toVersion}`);
    
    // Add migration logic here if needed
    // For example, migrate settings, update database schemas, etc.
    
    // Show upgrade notification to user
    // This could trigger a UI notification
  }

  /**
   * Handle fresh installation tasks
   */
  async handleFreshInstall() {
    console.log('Handling fresh installation');
    
    // Add fresh install logic here
    // For example, create default settings, show welcome screen, etc.
  }
}

// Create singleton instance
const versionCheckService = new VersionCheckService();

export default versionCheckService;

