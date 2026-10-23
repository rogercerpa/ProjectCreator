// ProjectPersistenceService runs in main process - no need for ipcRenderer
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const StatusTrackingService = require('./StatusTrackingService');
const { writeFileAtomic, writeJsonAtomic, readJsonWithRecovery, createSerialQueue } = require('./AtomicJsonFile');

const HISTORY_MAX_BYTES = 20 * 1024 * 1024;

// Shared by every ProjectPersistenceService instance (several services construct
// their own), so they all see one cache and one write queue per data file.
const projectStores = new Map();

function getProjectStore(projectsPath) {
  if (!projectStores.has(projectsPath)) {
    projectStores.set(projectsPath, {
      projects: null,
      loading: null,
      historyMigration: null,
      runExclusive: createSerialQueue()
    });
  }
  return projectStores.get(projectsPath);
}

// Callers mutate the arrays/objects they load, so never hand out the cached copy.
// The cache only ever holds JSON-parsed data, so a JSON round-trip is an exact copy.
const cloneProjects = typeof structuredClone === 'function'
  ? (projects) => structuredClone(projects)
  : (projects) => JSON.parse(JSON.stringify(projects));

class ProjectPersistenceService {
  constructor() {
    this.config = {
      dataDirectory: path.join(os.homedir(), '.project-creator'),
      projectsFile: 'projects.json',
      settingsFile: 'settings.json',
      historyFile: 'history.jsonl',
      templatesFile: 'templates.json'
    };
    
    // Initialize status tracking service
    this.statusTrackingService = new StatusTrackingService();
    
    this.initializeDataDirectory();
  }

  get projectStore() {
    return getProjectStore(this.getDataFilePath(this.config.projectsFile));
  }

  async readProjectsFromCache() {
    const store = this.projectStore;
    if (store.projects) return store.projects;

    if (!store.loading) {
      const projectsPath = this.getDataFilePath(this.config.projectsFile);
      store.loading = readJsonWithRecovery(projectsPath, [])
        .then((projects) => {
          if (!Array.isArray(projects)) {
            throw new Error('projects.json does not contain a project list');
          }
          store.projects = projects;
          return projects;
        })
        .finally(() => {
          store.loading = null;
        });
    }
    return store.loading;
  }

  async writeProjects(projects) {
    const projectsPath = this.getDataFilePath(this.config.projectsFile);
    const serialized = JSON.stringify(projects);
    await writeJsonAtomic(projectsPath, projects, { backup: true });
    this.projectStore.projects = JSON.parse(serialized);
  }

  /**
   * Run a read-modify-write of the project list without racing other writers.
   * `mutate` receives a private copy and returns { projects, result }; when
   * `projects` is omitted nothing is written.
   */
  async mutateProjects(mutate) {
    return this.projectStore.runExclusive(async () => {
      const projects = cloneProjects(await this.readProjectsFromCache());
      const outcome = await mutate(projects);
      if (outcome?.projects) {
        await this.writeProjects(outcome.projects);
      }
      return outcome?.result;
    });
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

  // Save project data - FIXED VERSION with status tracking
  async saveProject(projectData) {
    try {
      const isCompleted = String(projectData?.rfaStatus || '').trim().toLowerCase() === 'completed';
      const hasDesignOwner = Boolean(projectData?.designBy && String(projectData.designBy).trim());
      if (isCompleted && !hasDesignOwner) {
        return {
          success: false,
          error: 'Design By is required before setting RFA Status to Completed.'
        };
      }

      const result = await this.mutateProjects((projects) => {
        // Check if project already exists
        const existingIndex = projects.findIndex(p => 
          p.rfaNumber === projectData.rfaNumber && 
          p.projectContainer === projectData.projectContainer
        );

        if (existingIndex !== -1) {
          const existingProject = projects[existingIndex];
        
          // Detect status change and record it
          const statusChange = this.statusTrackingService.detectStatusChange(existingProject, projectData);
          if (statusChange) {
            // Get the source from the project data or default to 'manual'
            const source = projectData._statusChangeSource || 'manual';
          
            // Preserve existing status history
            projectData.statusHistory = existingProject.statusHistory || [];
            projectData.completedAt = existingProject.completedAt;
          
            // Record the status change
            this.statusTrackingService.recordStatusChange(projectData, statusChange.newStatus, source);
          
            console.log(`[ProjectPersistence] Status changed from "${statusChange.oldStatus}" to "${statusChange.newStatus}" (source: ${source})`);
          } else {
            // Preserve existing status tracking data if no change
            projectData.statusHistory = projectData.statusHistory || existingProject.statusHistory;
            projectData.statusDurations = projectData.statusDurations || existingProject.statusDurations;
            projectData.totalProjectDuration = projectData.totalProjectDuration || existingProject.totalProjectDuration;
            projectData.completedAt = projectData.completedAt || existingProject.completedAt;
          }
        
          // Remove the internal source marker before saving
          delete projectData._statusChangeSource;
        
          // Update existing project
          projects[existingIndex] = {
            ...projects[existingIndex],
            ...projectData,
            lastModified: new Date().toISOString(),
            version: (projects[existingIndex].version || 0) + 1
          };

          return {
            projects,
            result: {
              success: true,
              project: projects[existingIndex],
              message: 'Project updated successfully'
            }
          };
        } else {
          // Add new project
          const now = new Date().toISOString();
          const newProject = {
            ...projectData,
            id: this.generateProjectId(),
            createdAt: now,
            lastModified: now,
            version: 1
          };
        
          // Initialize status history for new projects
          const initialStatus = projectData.rfaStatus || 'In Progress';
          this.statusTrackingService.initializeStatusHistory(newProject, initialStatus);
        
          // Remove the internal source marker before saving
          delete newProject._statusChangeSource;
        
          projects.push(newProject);

          return {
            projects,
            result: {
              success: true,
              project: newProject,
              message: 'Project created successfully'
            }
          };
        }
      });

      await this.addToHistory(projectData);
      return result;
    } catch (error) {
      console.error('Error saving project:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load all projects. Throws if projects.json is corrupt and cannot be
   * recovered from its backup, so a bad file is never treated as "no projects".
   */
  async loadProjects() {
    return cloneProjects(await this.readProjectsFromCache());
  }

  // Save all projects
  async saveProjects(projects) {
    try {
      await this.projectStore.runExclusive(() => this.writeProjects(projects));
      
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
      return await this.mutateProjects((projects) => {
        const projectIndex = projects.findIndex(p => p.id === projectId);

        if (projectIndex === -1) {
          return { result: { success: false, error: 'Project not found' } };
        }

        const [deletedProject] = projects.splice(projectIndex, 1);
        return {
          projects,
          result: {
            success: true,
            project: deletedProject,
            message: 'Project deleted successfully'
          }
        };
      });
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
        const productsText = Array.isArray(project.products) ? project.products.join(' ') : (project.products || '');
        const sharedFileTypesText = Array.isArray(project.sharedFileTypes) ? project.sharedFileTypes.join(' ') : '';
        return (
          project.projectName?.toLowerCase().includes(searchTerm) ||
          project.rfaNumber?.toLowerCase().includes(searchTerm) ||
          project.agentNumber?.toLowerCase().includes(searchTerm) ||
          project.rfaType?.toLowerCase().includes(searchTerm) ||
          project.projectType?.toLowerCase().includes(searchTerm) ||
          productsText.toLowerCase().includes(searchTerm) ||
          project.projectContainer?.toLowerCase().includes(searchTerm) ||
          project.regionalTeam?.toLowerCase().includes(searchTerm) ||
          sharedFileTypesText.toLowerCase().includes(searchTerm) ||
          project.sharedFileTypesOther?.toLowerCase().includes(searchTerm)
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
      
      // Define default settings structure
      const defaultSettings = {
        rfaTypes: ['BOM (No Layout)', 'BOM with Layout', 'Controls BOM - Budget', 'Controls BOM - Layout'],
        regionalTeams: ['Region 1', 'Region 2', 'Region 3', 'Region 4', 'Region 5', 'NAVS'],
        defaultRegionalTeam: null, // Default regional team selection
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
        },
        pathSettings: {
          templates: {
            primaryPath: 'Z:\\DAS References\\!!!Templates For Project Creator',
            fallbackPath: '{userHome}\\Desktop\\1) Triage\\!!!Templates For Project Creator',
            agentRequirementsPath: 'Z:\\Agent Requirements'
          },
          projectOutput: {
            defaultLocation: 'desktop',
            customPath: '{userHome}\\Desktop',
            triagePath: '{userHome}\\Desktop\\1) Triage'
          },
          readyForQC: {
            folderPath: '{userHome}\\OneDrive - Acuity Brands, Inc\\C&I Design Solutions - LnT\\Ready for QC'
          }
        },
        dasGeneralSettings: {
          filePath: 'Z:\\DAS References\\ProjectCreatorV5\\DASGeneral.xlsx',
          autoRefresh: false,
          refreshInterval: 30000
        },
        workloadSettings: {
          enableRealTimeSync: true,
          dataDirectory: '',
          userName: '',
          userEmail: '',
          weeklyCapacity: 40,
          showNotifications: true,
          onlyMyAssignments: false
        }
      };
      
      if (await fs.pathExists(settingsPath)) {
        const data = await fs.readFile(settingsPath, 'utf8');
        const savedSettings = JSON.parse(data);
        
        // Merge saved settings with defaults to ensure all fields exist
        // This handles cases where new settings are added in updates
        const mergedSettings = {
          ...defaultSettings,
          ...savedSettings,
          calculationSettings: {
            ...defaultSettings.calculationSettings,
            ...(savedSettings.calculationSettings || {})
          },
          pathSettings: {
            ...defaultSettings.pathSettings,
            ...(savedSettings.pathSettings || {}),
            templates: {
              ...defaultSettings.pathSettings.templates,
              ...(savedSettings.pathSettings?.templates || {})
            },
            projectOutput: {
              ...defaultSettings.pathSettings.projectOutput,
              ...(savedSettings.pathSettings?.projectOutput || {})
            },
            readyForQC: {
              ...defaultSettings.pathSettings.readyForQC,
              ...(savedSettings.pathSettings?.readyForQC || {})
            }
          },
          dasGeneralSettings: {
            ...defaultSettings.dasGeneralSettings,
            ...(savedSettings.dasGeneralSettings || {})
          },
          workloadSettings: {
            ...defaultSettings.workloadSettings,
            ...(savedSettings.workloadSettings || {})
          }
        };
        
        return {
          success: true,
          data: mergedSettings,
          message: 'Settings loaded successfully'
        };
      }
      
      // Return default settings if file doesn't exist
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
      await writeJsonAtomic(settingsPath, settings, { space: 2, backup: true });
      
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
      await writeJsonAtomic(templatesPath, templates, { space: 2, backup: true });
      
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

  // Older versions kept history in history.json as a newest-first array. Fold it into
  // history.jsonl once, then rename it to history.json.migrated so it isn't read again.
  ensureHistoryMigrated() {
    const store = this.projectStore;
    if (!store.historyMigration) {
      store.historyMigration = store
        .runExclusive(async () => {
          const legacyPath = this.getDataFilePath('history.json');
          if (!(await fs.pathExists(legacyPath))) return;

          const legacy = await fs.readJson(legacyPath);
          const historyPath = this.getDataFilePath(this.config.historyFile);
          const existing = (await fs.pathExists(historyPath)) ? await fs.readFile(historyPath, 'utf8') : '';
          const lines = Array.isArray(legacy) ? [...legacy].reverse().map((entry) => JSON.stringify(entry)) : [];
          const migrated = lines.length ? `${lines.join('\n')}\n` : '';

          await writeFileAtomic(historyPath, migrated + existing);
          await fs.move(legacyPath, `${legacyPath}.migrated`, { overwrite: true });
          console.log(`Migrated ${lines.length} history entries to ${this.config.historyFile}`);
        })
        .catch((error) => {
          console.error('History migration failed; legacy history.json left in place:', error);
        });
    }
    return store.historyMigration;
  }

  // Load history (newest first). history.jsonl holds one JSON entry per line, oldest first.
  async loadHistory() {
    try {
      await this.ensureHistoryMigrated();
      const historyPath = this.getDataFilePath(this.config.historyFile);
      
      if (await fs.pathExists(historyPath)) {
        const data = await fs.readFile(historyPath, 'utf8');
        const entries = [];
        for (const line of data.split('\n')) {
          if (!line.trim()) continue;
          try {
            entries.push(JSON.parse(line));
          } catch {
            // A torn final line from a crash mid-append; skip it.
          }
        }
        return entries.reverse();
      }
      
      return [];
    } catch (error) {
      console.error('Error loading history:', error);
      return [];
    }
  }

  // Save history (expects newest first, matching loadHistory)
  async saveHistory(history) {
    try {
      await this.ensureHistoryMigrated();
      const historyPath = this.getDataFilePath(this.config.historyFile);
      const lines = [...history].reverse().map((entry) => JSON.stringify(entry));
      await writeFileAtomic(historyPath, lines.length ? `${lines.join('\n')}\n` : '');
      
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
      const historyPath = this.getDataFilePath(this.config.historyFile);
      const historyEntry = {
        id: this.generateHistoryId(),
        timestamp: new Date().toISOString(),
        action: 'save',
        projectId: projectData.id,
        projectName: projectData.projectName,
        rfaNumber: projectData.rfaNumber,
        data: projectData
      };

      await this.ensureHistoryMigrated();
      await this.projectStore.runExclusive(async () => {
        const stats = await fs.stat(historyPath).catch(() => null);
        if (stats && stats.size > HISTORY_MAX_BYTES) {
          await fs.move(historyPath, `${historyPath}.1`, { overwrite: true });
        }
        await fs.appendFile(historyPath, `${JSON.stringify(historyEntry)}\n`, 'utf8');
      });
      
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
      const mergedProjects = await this.mutateProjects((mergedProjects) => {
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
        return { projects: mergedProjects, result: mergedProjects };
      });
      
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

  // Backfill status history for an existing project
  async backfillProjectStatusHistory(projectId, statusDates) {
    try {
      return await this.mutateProjects((projects) => {
        const project = projects.find(p => p.id === projectId);

        if (!project) {
          return { result: { success: false, error: 'Project not found' } };
        }

        this.statusTrackingService.backfillStatusHistory(project, statusDates);
        project.lastModified = new Date().toISOString();
        project.version = (project.version || 0) + 1;

        return {
          projects,
          result: {
            success: true,
            project,
            message: 'Status history backfilled successfully'
          }
        };
      });
    } catch (error) {
      console.error('Error backfilling status history:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get analytics summary for a project
  getProjectAnalytics(project) {
    return this.statusTrackingService.getAnalyticsSummary(project);
  }

  // Check if project needs status history backfill
  needsStatusHistoryBackfill(project) {
    return !this.statusTrackingService.hasStatusHistory(project);
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
