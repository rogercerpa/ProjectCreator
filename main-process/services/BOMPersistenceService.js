/**
 * BOMPersistenceService
 * Handles storage and retrieval of BOM (Bill of Materials) data
 * 
 * - Saves BOM data to individual projects
 * - Maintains aggregated catalog for cross-project analytics
 * - Supports bulk import operations
 * - Tracks product co-occurrence for cross-sell analysis
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class BOMPersistenceService {
  constructor(projectPersistenceService) {
    this.projectPersistenceService = projectPersistenceService;
    
    this.config = {
      dataDirectory: path.join(os.homedir(), '.project-creator'),
      catalogFile: 'bom-catalog.json',
      startupStatsFile: 'bom-startup-stats.json'
    };
    
    this.initializeDataFiles();
  }

  /**
   * Initialize data files if they don't exist
   */
  async initializeDataFiles() {
    try {
      await fs.ensureDir(this.config.dataDirectory);
      
      // Initialize catalog file
      const catalogPath = this.getCatalogPath();
      if (!await fs.pathExists(catalogPath)) {
        await fs.writeJson(catalogPath, {}, { spaces: 2 });
      }
      
      // Initialize startup stats file
      const statsPath = this.getStartupStatsPath();
      if (!await fs.pathExists(statsPath)) {
        await fs.writeJson(statsPath, this.getEmptyStartupStats(), { spaces: 2 });
      }
    } catch (error) {
      console.error('Error initializing BOM data files:', error);
    }
  }

  /**
   * Get path to catalog file
   */
  getCatalogPath() {
    return path.join(this.config.dataDirectory, this.config.catalogFile);
  }

  /**
   * Get path to startup stats file
   */
  getStartupStatsPath() {
    return path.join(this.config.dataDirectory, this.config.startupStatsFile);
  }

  /**
   * Get empty startup stats template
   */
  getEmptyStartupStats() {
    return {
      totalProjectsWithStartupData: 0,
      totalStartupCost: 0,
      averageStartupCost: 0,
      startupCostByMonth: {},
      serviceBreakdown: {
        systemStartup: { totalCost: 0, count: 0 },
        onsiteTraining: { totalCost: 0, count: 0 },
        preconstructionMeeting: { totalCost: 0, count: 0 },
        other: { totalCost: 0, count: 0 }
      }
    };
  }

  /**
   * Save BOM data to a project
   * @param {string} projectId - Project ID
   * @param {object} bomData - Parsed BOM data from BOMParserService
   * @returns {object} Result with success status
   */
  async saveBOMToProject(projectId, bomData) {
    try {
      // Load the project
      const result = await this.projectPersistenceService.loadProjectById(projectId);
      if (!result.success) {
        return { success: false, error: `Project not found: ${projectId}` };
      }

      const project = result.project;

      // Add BOM data to project
      project.bomData = {
        ...bomData,
        importedAt: new Date().toISOString()
      };

      // Save the updated project
      const saveResult = await this.projectPersistenceService.saveProject(project);
      if (!saveResult.success) {
        return { success: false, error: 'Failed to save project with BOM data' };
      }

      // Update aggregated catalog
      await this.updateCatalog(bomData.devices, projectId);

      // Update startup cost statistics if available
      if (bomData.startupCosts && bomData.startupCosts.total > 0) {
        await this.updateStartupStats(bomData.startupCosts, project);
      }

      console.log(`✅ BOM data saved for project: ${projectId}`);
      return {
        success: true,
        project: saveResult.project,
        message: 'BOM data saved successfully',
        stats: {
          totalDevices: bomData.totalDevices,
          totalLineItems: bomData.totalLineItems,
          startupCost: bomData.startupCosts?.total || 0
        }
      };
    } catch (error) {
      console.error('Error saving BOM to project:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update aggregated catalog with devices from a project
   * @param {object[]} devices - Array of device objects
   * @param {string} projectId - Project ID for tracking
   */
  async updateCatalog(devices, projectId) {
    try {
      const catalogPath = this.getCatalogPath();
      const catalog = await fs.readJson(catalogPath);
      const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Track all catalog numbers in this project for co-occurrence
      const projectCatalogNumbers = devices.map(d => d.catalogNumber);

      for (const device of devices) {
        const { catalogNumber, quantity, description, type, manufacturer, productFamily } = device;

        if (!catalog[catalogNumber]) {
          // New catalog entry
          catalog[catalogNumber] = {
            description: description || '',
            type: type || '',
            manufacturer: manufacturer || '',
            productFamily: productFamily || 'Other',
            totalQuantity: 0,
            projectCount: 0,
            projects: [],
            firstSeen: now,
            lastSeen: now,
            coOccurrence: {}
          };
        }

        const entry = catalog[catalogNumber];

        // Update if this project hasn't been counted yet
        if (!entry.projects.includes(projectId)) {
          entry.totalQuantity += quantity;
          entry.projectCount += 1;
          entry.projects.push(projectId);
          entry.lastSeen = now;

          // Update co-occurrence (other products in same project)
          for (const otherCatalog of projectCatalogNumbers) {
            if (otherCatalog !== catalogNumber) {
              entry.coOccurrence[otherCatalog] = (entry.coOccurrence[otherCatalog] || 0) + 1;
            }
          }
        }

        // Update description if we have a better one
        if (description && (!entry.description || entry.description.length < description.length)) {
          entry.description = description;
        }
      }

      await fs.writeJson(catalogPath, catalog, { spaces: 2 });
      console.log(`📦 Catalog updated with ${devices.length} device types`);
    } catch (error) {
      console.error('Error updating catalog:', error);
    }
  }

  /**
   * Update startup cost statistics
   * @param {object} startupCosts - Startup costs from BOM
   * @param {object} project - Project object for date tracking
   */
  async updateStartupStats(startupCosts, project) {
    try {
      const statsPath = this.getStartupStatsPath();
      const stats = await fs.readJson(statsPath);

      // Get month key from project date
      const projectDate = project.createdAt || project.submittedDate || new Date().toISOString();
      const monthKey = projectDate.substring(0, 7); // YYYY-MM

      // Update totals
      stats.totalProjectsWithStartupData += 1;
      stats.totalStartupCost += startupCosts.total;
      stats.averageStartupCost = stats.totalStartupCost / stats.totalProjectsWithStartupData;

      // Update monthly breakdown
      if (!stats.startupCostByMonth[monthKey]) {
        stats.startupCostByMonth[monthKey] = {
          count: 0,
          totalCost: 0,
          avgCost: 0
        };
      }
      stats.startupCostByMonth[monthKey].count += 1;
      stats.startupCostByMonth[monthKey].totalCost += startupCosts.total;
      stats.startupCostByMonth[monthKey].avgCost = 
        stats.startupCostByMonth[monthKey].totalCost / stats.startupCostByMonth[monthKey].count;

      // Update service breakdown
      if (startupCosts.systemStartup > 0) {
        stats.serviceBreakdown.systemStartup.totalCost += startupCosts.systemStartup;
        stats.serviceBreakdown.systemStartup.count += 1;
      }
      if (startupCosts.onsiteTraining > 0) {
        stats.serviceBreakdown.onsiteTraining.totalCost += startupCosts.onsiteTraining;
        stats.serviceBreakdown.onsiteTraining.count += 1;
      }
      if (startupCosts.preconstructionMeeting > 0) {
        stats.serviceBreakdown.preconstructionMeeting.totalCost += startupCosts.preconstructionMeeting;
        stats.serviceBreakdown.preconstructionMeeting.count += 1;
      }
      if (startupCosts.other > 0) {
        stats.serviceBreakdown.other.totalCost += startupCosts.other;
        stats.serviceBreakdown.other.count += 1;
      }

      await fs.writeJson(statsPath, stats, { spaces: 2 });
    } catch (error) {
      console.error('Error updating startup stats:', error);
    }
  }

  /**
   * Load the aggregated catalog
   * @returns {object} Catalog data
   */
  async loadCatalog() {
    try {
      const catalogPath = this.getCatalogPath();
      if (await fs.pathExists(catalogPath)) {
        return await fs.readJson(catalogPath);
      }
      return {};
    } catch (error) {
      console.error('Error loading catalog:', error);
      return {};
    }
  }

  /**
   * Load startup statistics
   * @returns {object} Startup stats
   */
  async loadStartupStats() {
    try {
      const statsPath = this.getStartupStatsPath();
      if (await fs.pathExists(statsPath)) {
        return await fs.readJson(statsPath);
      }
      return this.getEmptyStartupStats();
    } catch (error) {
      console.error('Error loading startup stats:', error);
      return this.getEmptyStartupStats();
    }
  }

  /**
   * Get top catalog numbers by quantity
   * @param {number} limit - Number of results
   * @returns {object[]} Array of top catalog entries
   */
  async getTopCatalogNumbers(limit = 20) {
    try {
      const catalog = await this.loadCatalog();
      
      return Object.entries(catalog)
        .map(([catalogNumber, data]) => ({
          catalogNumber,
          ...data,
          avgQuantityPerProject: data.projectCount > 0 ? 
            Math.round(data.totalQuantity / data.projectCount * 10) / 10 : 0
        }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting top catalog numbers:', error);
      return [];
    }
  }

  /**
   * Get product co-occurrence data for a catalog number
   * @param {string} catalogNumber - Catalog number to lookup
   * @param {number} limit - Number of results
   * @returns {object[]} Array of frequently paired products
   */
  async getProductCoOccurrence(catalogNumber, limit = 10) {
    try {
      const catalog = await this.loadCatalog();
      const entry = catalog[catalogNumber];
      
      if (!entry || !entry.coOccurrence) {
        return [];
      }

      return Object.entries(entry.coOccurrence)
        .map(([pairedCatalog, count]) => ({
          catalogNumber: pairedCatalog,
          description: catalog[pairedCatalog]?.description || '',
          productFamily: catalog[pairedCatalog]?.productFamily || 'Other',
          coOccurrenceCount: count
        }))
        .sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting product co-occurrence:', error);
      return [];
    }
  }

  /**
   * Find projects by catalog number (for recalls/issues)
   * @param {string} catalogNumber - Catalog number to search
   * @returns {string[]} Array of project IDs
   */
  async findProjectsByCatalogNumber(catalogNumber) {
    try {
      const catalog = await this.loadCatalog();
      const entry = catalog[catalogNumber];
      
      return entry?.projects || [];
    } catch (error) {
      console.error('Error finding projects by catalog number:', error);
      return [];
    }
  }

  /**
   * Get catalog statistics summary
   * @returns {object} Summary statistics
   */
  async getCatalogStats() {
    try {
      const catalog = await this.loadCatalog();
      const entries = Object.entries(catalog);

      if (entries.length === 0) {
        return {
          uniqueSKUs: 0,
          totalQuantity: 0,
          projectsCovered: 0,
          productFamilyBreakdown: {}
        };
      }

      const productFamilyBreakdown = {};
      let totalQuantity = 0;
      const allProjects = new Set();

      for (const [, data] of entries) {
        totalQuantity += data.totalQuantity;
        data.projects?.forEach(p => allProjects.add(p));

        const family = data.productFamily || 'Other';
        if (!productFamilyBreakdown[family]) {
          productFamilyBreakdown[family] = { quantity: 0, skuCount: 0 };
        }
        productFamilyBreakdown[family].quantity += data.totalQuantity;
        productFamilyBreakdown[family].skuCount += 1;
      }

      return {
        uniqueSKUs: entries.length,
        totalQuantity,
        projectsCovered: allProjects.size,
        productFamilyBreakdown
      };
    } catch (error) {
      console.error('Error getting catalog stats:', error);
      return { uniqueSKUs: 0, totalQuantity: 0, projectsCovered: 0, productFamilyBreakdown: {} };
    }
  }

  /**
   * Get products not seen recently (potentially deprecated)
   * @param {number} monthsThreshold - Months since last seen
   * @returns {object[]} Array of deprecated product candidates
   */
  async getDeprecatedProducts(monthsThreshold = 6) {
    try {
      const catalog = await this.loadCatalog();
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsThreshold);
      const cutoffString = cutoffDate.toISOString().split('T')[0];

      return Object.entries(catalog)
        .filter(([, data]) => data.lastSeen < cutoffString)
        .map(([catalogNumber, data]) => ({
          catalogNumber,
          description: data.description,
          productFamily: data.productFamily,
          lastSeen: data.lastSeen,
          totalQuantity: data.totalQuantity,
          projectCount: data.projectCount
        }))
        .sort((a, b) => a.lastSeen.localeCompare(b.lastSeen));
    } catch (error) {
      console.error('Error getting deprecated products:', error);
      return [];
    }
  }

  /**
   * Get BOM data for a specific project
   * @param {string} projectId - Project ID
   * @returns {object|null} BOM data or null
   */
  async getProjectBOMData(projectId) {
    try {
      const result = await this.projectPersistenceService.loadProjectById(projectId);
      if (!result.success) {
        return null;
      }
      return result.project.bomData || null;
    } catch (error) {
      console.error('Error getting project BOM data:', error);
      return null;
    }
  }

  /**
   * Check if a project has BOM data
   * @param {string} projectId - Project ID
   * @returns {boolean} True if project has BOM data
   */
  async projectHasBOMData(projectId) {
    const bomData = await this.getProjectBOMData(projectId);
    return bomData !== null && bomData.totalDevices > 0;
  }

  /**
   * Get all projects with BOM data
   * @returns {object[]} Array of projects with BOM data
   */
  async getProjectsWithBOMData() {
    try {
      const projects = await this.projectPersistenceService.loadProjects();
      return projects.filter(p => p.bomData && p.bomData.totalDevices > 0);
    } catch (error) {
      console.error('Error getting projects with BOM data:', error);
      return [];
    }
  }

  /**
   * Get BOM coverage statistics
   * @returns {object} Coverage stats
   */
  async getBOMCoverage() {
    try {
      const projects = await this.projectPersistenceService.loadProjects();
      const projectsWithBOM = projects.filter(p => p.bomData && p.bomData.totalDevices > 0);

      return {
        totalProjects: projects.length,
        projectsWithBOM: projectsWithBOM.length,
        coveragePercent: projects.length > 0 ? 
          Math.round(projectsWithBOM.length / projects.length * 100 * 10) / 10 : 0,
        projectsWithoutBOM: projects.length - projectsWithBOM.length
      };
    } catch (error) {
      console.error('Error getting BOM coverage:', error);
      return { totalProjects: 0, projectsWithBOM: 0, coveragePercent: 0, projectsWithoutBOM: 0 };
    }
  }

  /**
   * Remove BOM data from a project
   * @param {string} projectId - Project ID
   * @returns {object} Result
   */
  async removeBOMFromProject(projectId) {
    try {
      const result = await this.projectPersistenceService.loadProjectById(projectId);
      if (!result.success) {
        return { success: false, error: 'Project not found' };
      }

      const project = result.project;
      delete project.bomData;

      const saveResult = await this.projectPersistenceService.saveProject(project);
      return {
        success: saveResult.success,
        message: saveResult.success ? 'BOM data removed' : 'Failed to remove BOM data'
      };
    } catch (error) {
      console.error('Error removing BOM from project:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Rebuild catalog from all projects (for maintenance/repair)
   * @returns {object} Result with stats
   */
  async rebuildCatalog() {
    try {
      console.log('🔄 Rebuilding BOM catalog from all projects...');
      
      // Reset catalog
      const catalogPath = this.getCatalogPath();
      await fs.writeJson(catalogPath, {}, { spaces: 2 });

      // Reset startup stats
      const statsPath = this.getStartupStatsPath();
      await fs.writeJson(statsPath, this.getEmptyStartupStats(), { spaces: 2 });

      // Process all projects with BOM data
      const projects = await this.getProjectsWithBOMData();
      let processedCount = 0;

      for (const project of projects) {
        if (project.bomData?.devices) {
          await this.updateCatalog(project.bomData.devices, project.id);
          
          if (project.bomData.startupCosts?.total > 0) {
            await this.updateStartupStats(project.bomData.startupCosts, project);
          }
          
          processedCount++;
        }
      }

      console.log(`✅ Catalog rebuilt from ${processedCount} projects`);
      return {
        success: true,
        processedProjects: processedCount,
        message: `Catalog rebuilt from ${processedCount} projects`
      };
    } catch (error) {
      console.error('Error rebuilding catalog:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = BOMPersistenceService;
