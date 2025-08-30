// ProjectPersistenceService runs in main process - no need for ipcRenderer
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ProjectPersistenceService {
  constructor() {
    this.config = {
      dataDirectory: path.join(os.homedir(), '.project-creator'),
      projectsFile: 'projects.json',
      settingsFile: 'settings.json',
      historyFile: 'history.json',
      templatesFile: 'templates.json'
    };
    
    this.initializeDataDirectory();
  }

  // Initialize data directory
  async initializeDataDirectory() {
    try {
      await fs.ensureDir(this.config.dataDirectory);
      console.log('Data directory initialized:', this.config.dataDirectory);
    } catch (error) {
      console.error('Error initializing data directory:', error);
    }
  }

  // Get full path for a data file
  getDataFilePath(filename) {
    return path.join(this.config.dataDirectory, filename);
  }

  // Save project data - FIXED VERSION
  async saveProject(projectData) {
    try {
      const projects = await this.loadProjects();
      
      // Check if project already exists
      const existingIndex = projects.findIndex(p => 
        p.rfaNumber === projectData.rfaNumber && 
        p.projectContainer === projectData.projectContainer
      );

      if (existingIndex !== -1) {
        // Update existing project
        projects[existingIndex] = {
          ...projects[existingIndex],
          ...projectData,
          lastModified: new Date().toISOString(),
          version: (projects[existingIndex].version || 0) + 1
        };
        
        // Save to file
        await this.saveProjects(projects);
        
        // Add to history
        await this.addToHistory(projectData);
        
        // Return the updated project with its ID
        return {
          success: true,
          project: projects[existingIndex],
          message: 'Project updated successfully'
        };
      } else {
        // Add new project
        const newProject = {
          ...projectData,
          id: this.generateProjectId(),
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: 1
        };
        projects.push(newProject);
        
        // Save to file
        await this.saveProjects(projects);
        
        // Add to history
        await this.addToHistory(projectData);
        
        // Return the new project with its generated ID
        return {
          success: true,
          project: newProject,
          message: 'Project created successfully'
        };
      }

    } catch (error) {
      console.error('Error saving project:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Load all projects
  async loadProjects() {
    try {
      const projectsPath = this.getDataFilePath(this.config.projectsFile);
      
      if (await fs.pathExists(projectsPath)) {
        const data = await fs.readFile(projectsPath, 'utf8');
        return JSON.parse(data);
      }
      
      return [];
    } catch (error) {
      console.error('Error loading projects:', error);
      return [];
    }
  }

  // Save all projects
  async saveProjects(projects) {
    try {
      const projectsPath = this.getDataFilePath(this.config.projectsFile);
      await fs.writeFile(projectsPath, JSON.stringify(projects, null, 2), 'utf8');
      
      return {
        success: true,
        count: projects.length,
        message: 'Projects saved successfully'
      };
    } catch (error) {
      console.error('Error saving projects:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Load project by ID
  async loadProjectById(projectId) {
    try {
      const projects = await this.loadProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (project) {
        return {
          success: true,
          project,
          message: 'Project loaded successfully'
        };
      } else {
        return {
          success: false,
          error: 'Project not found'
        };
      }
    } catch (error) {
      console.error('Error loading project by ID:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Load project by RFA number and container
  async loadProjectByRFA(rfaNumber, projectContainer) {
    try {
      const projects = await this.loadProjects();
      const project = projects.find(p => 
        p.rfaNumber === rfaNumber && 
        p.projectContainer === projectContainer
      );
      
      if (project) {
        return {
          success: true,
          project,
          message: 'Project loaded successfully'
        };
      } else {
        return {
          success: false,
          error: 'Project not found'
        };
      }
    } catch (error) {
      console.error('Error loading project by RFA:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Delete project
  async deleteProject(projectId) {
    try {
      const projects = await this.loadProjects();
      const projectIndex = projects.findIndex(p => p.id === projectId);
      
      if (projectIndex === -1) {
        return {
          success: false,
          error: 'Project not found'
        };
      }
      
      const deletedProject = projects[projectIndex];
      projects.splice(projectIndex, 1);
      
      await this.saveProjects(projects);
      
      return {
        success: true,
        project: deletedProject,
        message: 'Project deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting project:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Search projects
  async searchProjects(searchCriteria) {
    try {
      const projects = await this.loadProjects();
      const results = projects.filter(project => {
        const searchTerm = searchCriteria.toLowerCase();
        return (
          project.projectName?.toLowerCase().includes(searchTerm) ||
          project.rfaNumber?.toLowerCase().includes(searchTerm) ||
          project.agentNumber?.toLowerCase().includes(searchTerm) ||
          project.rfaType?.toLowerCase().includes(searchTerm) ||
          project.regionalTeam?.toLowerCase().includes(searchTerm)
        );
      });
      
      return {
        success: true,
        projects: results,
        count: results.length,
        message: `${results.length} projects found`
      };
    } catch (error) {
      console.error('Error searching projects:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get project statistics
  async getProjectStats() {
    try {
      const projects = await this.loadProjects();
      
      const stats = {
        total: projects.length,
        byStatus: {},
        byType: {},
        byRegion: {},
        recent: projects
          .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
          .slice(0, 10)
      };
      
      projects.forEach(project => {
        // Count by status
        const status = project.status || 'Unknown';
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
        
        // Count by RFA type
        const type = project.rfaType || 'Unknown';
        stats.byType[type] = (stats.byType[type] || 0) + 1;
        
        // Count by regional team
        const region = project.regionalTeam || 'Unknown';
        stats.byRegion[region] = (stats.byRegion[region] || 0) + 1;
      });
      
      return {
        success: true,
        stats,
        message: 'Project statistics loaded successfully'
      };
    } catch (error) {
      console.error('Error getting project stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Load settings
  async loadSettings() {
    try {
      const settingsPath = this.getDataFilePath(this.config.settingsFile);
      
      if (await fs.pathExists(settingsPath)) {
        const data = await fs.readFile(settingsPath, 'utf8');
        return {
          success: true,
          data: JSON.parse(data),
          message: 'Settings loaded successfully'
        };
      }
      
      // Return default settings if file doesn't exist
      const defaultSettings = {
        rfaTypes: ['BOM (No Layout)', 'BOM with Layout', 'Controls BOM - Budget', 'Controls BOM - Layout'],
        regionalTeams: ['Region 1', 'Region 2', 'Region 3', 'Region 4', 'Region 5', 'NAVS'],
        nationalAccounts: ['N/A', "Arby's"],
        complexityLevels: ['Level 1', 'Level 2', 'Level 3', 'Level 4'],
        statusOptions: ['In Progress', 'Completed', 'Inactive', 'Not Started'],
        productOptions: ['nLight Wired', 'nLight Air', 'SensorSwitch', 'Pathway', 'Fresco', 'Controls - nLight'],
        assignedToOptions: ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown', 'Cerpa, Roger'],
        calculationSettings: {
          lmpMultipliers: { small: 15, medium: 30, large: 45 },
          arpMultipliers: { arp8: 5, arp16: 10, arp32: 20, arp48: 25 },
          roomMultiplier: 2,
          riserMultiplier: 1,
          esheetsMultiplier: 2,
          pageBonusThreshold: 3,
          pageBonusMultiplier: 3,
          selfQCHigh: 12,
          selfQCLow: 4,
          selfQCDefault: 0.5,
          fluffPercentage: 10
        }
      };
      
      return {
        success: true,
        data: defaultSettings,
        message: 'Default settings loaded'
      };
    } catch (error) {
      console.error('Error loading settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Save settings
  async saveSettings(settings) {
    try {
      const settingsPath = this.getDataFilePath(this.config.settingsFile);
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      
      return {
        success: true,
        message: 'Settings saved successfully'
      };
    } catch (error) {
      console.error('Error saving settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Load templates
  async loadTemplates() {
    try {
      const templatesPath = this.getDataFilePath(this.config.templatesFile);
      
      if (await fs.pathExists(templatesPath)) {
        const data = await fs.readFile(templatesPath, 'utf8');
        return {
          success: true,
          data: JSON.parse(data),
          message: 'Templates loaded successfully'
        };
      }
      
      return {
        success: true,
        data: {},
        message: 'No templates found'
      };
    } catch (error) {
      console.error('Error loading templates:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Save templates
  async saveTemplates(templates) {
    try {
      const templatesPath = this.getDataFilePath(this.config.templatesFile);
      await fs.writeFile(templatesPath, JSON.stringify(templates, null, 2), 'utf8');
      
      return {
        success: true,
        message: 'Templates saved successfully'
      };
    } catch (error) {
      console.error('Error saving templates:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Load history
  async loadHistory() {
    try {
      const historyPath = this.getDataFilePath(this.config.historyFile);
      
      if (await fs.pathExists(historyPath)) {
        const data = await fs.readFile(historyPath, 'utf8');
        return JSON.parse(data);
      }
      
      return [];
    } catch (error) {
      console.error('Error loading history:', error);
      return [];
    }
  }

  // Save history
  async saveHistory(history) {
    try {
      const historyPath = this.getDataFilePath(this.config.historyFile);
      await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf8');
      
      return {
        success: true,
        message: 'History saved successfully'
      };
    } catch (error) {
      console.error('Error saving history:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Add to history
  async addToHistory(projectData) {
    try {
      const history = await this.loadHistory();
      
      const historyEntry = {
        id: this.generateHistoryId(),
        timestamp: new Date().toISOString(),
        action: 'save',
        projectId: projectData.id,
        projectName: projectData.projectName,
        rfaNumber: projectData.rfaNumber,
        data: projectData
      };
      
      history.unshift(historyEntry);
      
      // Keep only last 1000 entries
      if (history.length > 1000) {
        history.splice(1000);
      }
      
      await this.saveHistory(history);
      
      return {
        success: true,
        message: 'History entry added successfully'
      };
    } catch (error) {
      console.error('Error adding to history:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Export projects
  async exportProjects(exportPath, format = 'json') {
    try {
      const projects = await this.loadProjects();
      
      if (format === 'json') {
        await fs.writeFile(exportPath, JSON.stringify(projects, null, 2), 'utf8');
      } else if (format === 'csv') {
        // Simple CSV export
        const csvContent = this.convertToCSV(projects);
        await fs.writeFile(exportPath, csvContent, 'utf8');
      }
      
      return {
        success: true,
        path: exportPath,
        count: projects.length,
        message: `Projects exported successfully to ${exportPath}`
      };
    } catch (error) {
      console.error('Error exporting projects:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Import projects
  async importProjects(importPath, format = 'json') {
    try {
      let projects = [];
      
      if (format === 'json') {
        const data = await fs.readFile(importPath, 'utf8');
        projects = JSON.parse(data);
      } else if (format === 'csv') {
        // Simple CSV import
        const csvData = await fs.readFile(importPath, 'utf8');
        projects = this.convertFromCSV(csvData);
      }
      
      // Validate projects
      const validProjects = projects.filter(p => 
        p.projectName && p.rfaNumber && p.agentNumber
      );
      
      if (validProjects.length === 0) {
        throw new Error('No valid projects found in import file');
      }
      
      // Save imported projects
      const existingProjects = await this.loadProjects();
      const mergedProjects = [...existingProjects];
      
      for (const project of validProjects) {
        const existingIndex = mergedProjects.findIndex(p => 
          p.rfaNumber === project.rfaNumber && 
          p.projectContainer === project.projectContainer
        );
        
        if (existingIndex !== -1) {
          // Update existing
          mergedProjects[existingIndex] = {
            ...mergedProjects[existingIndex],
            ...project,
            lastModified: new Date().toISOString()
          };
        } else {
          // Add new
          mergedProjects.push({
            ...project,
            id: this.generateProjectId(),
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            version: 1
          });
        }
      }
      
      await this.saveProjects(mergedProjects);
      
      return {
        success: true,
        imported: validProjects.length,
        total: mergedProjects.length,
        message: `${validProjects.length} projects imported successfully`
      };
    } catch (error) {
      console.error('Error importing projects:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Convert projects to CSV
  convertToCSV(projects) {
    if (projects.length === 0) return '';
    
    const headers = Object.keys(projects[0]);
    const csvRows = [headers.join(',')];
    
    for (const project of projects) {
      const values = headers.map(header => {
        const value = project[header];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value || '';
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  // Convert CSV to projects
  convertFromCSV(csvData) {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const projects = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const project = {};
      
      headers.forEach((header, index) => {
        if (values[index] !== undefined) {
          project[header] = values[index];
        }
      });
      
      if (project.projectName && project.rfaNumber) {
        projects.push(project);
      }
    }
    
    return projects;
  }

  // Generate unique project ID
  generateProjectId() {
    return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate unique history ID
  generateHistoryId() {
    return `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Backup data directory
  async backupDataDirectory(backupPath) {
    try {
      await fs.copy(this.config.dataDirectory, backupPath);
      
      return {
        success: true,
        source: this.config.dataDirectory,
        destination: backupPath,
        message: 'Data directory backed up successfully'
      };
    } catch (error) {
      console.error('Error backing up data directory:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Restore data directory
  async restoreDataDirectory(backupPath) {
    try {
      // Verify backup exists
      if (!(await fs.pathExists(backupPath))) {
        throw new Error('Backup directory does not exist');
      }

      // Create backup of current data
      const currentBackup = `${this.config.dataDirectory}_backup_${Date.now()}`;
      if (await fs.pathExists(this.config.dataDirectory)) {
        await fs.copy(this.config.dataDirectory, backupPath);
      }

      // Restore from backup
      await fs.copy(backupPath, this.config.dataDirectory);
      
      return {
        success: true,
        backupPath,
        restoredPath: this.config.dataDirectory,
        currentBackup,
        message: 'Data directory restored successfully'
      };
    } catch (error) {
      console.error('Error restoring data directory:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Clean up old data
  async cleanupOldData(options = {}) {
    try {
      const {
        maxHistoryEntries = 1000,
        maxProjects = 10000,
        deleteOldBackups = true,
        backupAgeDays = 30
      } = options;

      let cleanupStats = {
        historyEntriesRemoved: 0,
        oldBackupsRemoved: 0,
        totalSpaceFreed: 0
      };

      // Clean up history
      const history = await this.loadHistory();
      if (history.length > maxHistoryEntries) {
        const removed = history.splice(maxHistoryEntries);
        cleanupStats.historyEntriesRemoved = removed.length;
        await this.saveHistory(history);
      }

      // Clean up old backups
      if (deleteOldBackups) {
        const dataDir = path.dirname(this.config.dataDirectory);
        const items = await fs.readdir(dataDir);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - backupAgeDays);

        for (const item of items) {
          if (item.startsWith(path.basename(this.config.dataDirectory) + '_backup_')) {
            const itemPath = path.join(dataDir, item);
            const stats = await fs.stat(itemPath);
            
            if (stats.mtime < cutoffDate) {
              await fs.remove(itemPath);
              cleanupStats.oldBackupsRemoved++;
              cleanupStats.totalSpaceFreed += stats.size;
            }
          }
        }
      }

      return {
        success: true,
        stats: cleanupStats,
        message: 'Data cleanup completed successfully'
      };
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ProjectPersistenceService;
