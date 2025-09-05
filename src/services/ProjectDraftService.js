// ProjectDraftService - Handles partial project saves and draft management
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ProjectDraftService {
  constructor() {
    this.config = {
      dataDirectory: path.join(os.homedir(), '.project-creator'),
      draftsFile: 'project-drafts.json',
      draftsDirectory: path.join(os.homedir(), '.project-creator', 'drafts'),
      maxDraftsPerProject: 5,
      draftRetentionDays: 30,
      autoCleanupInterval: 24 * 60 * 60 * 1000 // 24 hours
    };
    
    this.initializeDraftSystem();
    this.setupAutoCleanup();
  }

  // Initialize draft system
  async initializeDraftSystem() {
    try {
      await fs.ensureDir(this.config.dataDirectory);
      await fs.ensureDir(this.config.draftsDirectory);
      
      // Initialize drafts file if it doesn't exist
      const draftsFilePath = this.getDraftsFilePath();
      if (!await fs.pathExists(draftsFilePath)) {
        await this.saveDraftsIndex({});
      }
      
      console.log('Draft system initialized:', this.config.draftsDirectory);
    } catch (error) {
      console.error('Error initializing draft system:', error);
    }
  }

  // Setup automatic cleanup
  setupAutoCleanup() {
    setInterval(() => {
      this.cleanupOldDrafts().catch(error => {
        console.error('Error during automatic draft cleanup:', error);
      });
    }, this.config.autoCleanupInterval);
  }

  // Get drafts file path
  getDraftsFilePath() {
    return path.join(this.config.dataDirectory, this.config.draftsFile);
  }

  // Get individual draft file path
  getDraftFilePath(draftId) {
    return path.join(this.config.draftsDirectory, `${draftId}.json`);
  }

  // Generate unique draft ID
  generateDraftId() {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create project key for grouping drafts
  createProjectKey(formData) {
    // Use RFA number and container if available, otherwise use project name
    if (formData.rfaNumber && formData.projectContainer) {
      return `${formData.rfaNumber}_${formData.projectContainer}`;
    } else if (formData.projectName) {
      // Sanitize project name for use as key
      return formData.projectName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    } else {
      return 'untitled_project';
    }
  }

  // Save partial project as draft
  async savePartialProject(formData, currentStep, metadata = {}) {
    try {
      const draftId = this.generateDraftId();
      const timestamp = new Date().toISOString();
      const projectKey = this.createProjectKey(formData);

      // Create draft object
      const draft = {
        id: draftId,
        projectKey,
        formData,
        currentStep,
        metadata: {
          ...metadata,
          savedAt: timestamp,
          userAgent: process.env.USER || 'unknown',
          appVersion: process.env.npm_package_version || '1.0.0'
        },
        status: 'draft',
        completionPercentage: this.calculateCompletionPercentage(formData, currentStep)
      };

      // Save individual draft file
      await fs.writeJSON(this.getDraftFilePath(draftId), draft, { spaces: 2 });

      // Update drafts index
      await this.updateDraftsIndex(projectKey, draft);

      // Cleanup old drafts for this project
      await this.cleanupProjectDrafts(projectKey);

      console.log(`Draft saved: ${draftId} for project: ${projectKey}`);
      
      return {
        success: true,
        draftId,
        projectKey,
        message: 'Draft saved successfully'
      };

    } catch (error) {
      console.error('Error saving partial project:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create actual project from completed draft
  async createProjectFromDraft(draftId, finalFormData) {
    try {
      const draft = await this.loadDraft(draftId);
      if (!draft) {
        throw new Error('Draft not found');
      }

      // Import ProjectPersistenceService to save the final project
      const ProjectPersistenceService = require('./ProjectPersistenceService');
      const persistenceService = new ProjectPersistenceService();

      // Merge draft data with any final updates
      const projectData = {
        ...draft.formData,
        ...finalFormData,
        // Add draft metadata
        sourceType: 'wizard',
        originalDraftId: draftId,
        wizardCompletedAt: new Date().toISOString()
      };

      // Save as actual project
      const result = await persistenceService.saveProject(projectData);

      if (result.success) {
        // Mark draft as completed
        await this.markDraftAsCompleted(draftId, result.project.id);
        
        console.log(`Project created from draft: ${draftId} -> ${result.project.id}`);
      }

      return result;

    } catch (error) {
      console.error('Error creating project from draft:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Load draft by ID
  async loadDraft(draftId) {
    try {
      const draftPath = this.getDraftFilePath(draftId);
      if (!await fs.pathExists(draftPath)) {
        return null;
      }

      const draft = await fs.readJSON(draftPath);
      return draft;

    } catch (error) {
      console.error('Error loading draft:', error);
      return null;
    }
  }

  // Get all drafts for a project
  async getProjectDrafts(projectKey) {
    try {
      const index = await this.loadDraftsIndex();
      const projectDrafts = index[projectKey] || [];
      
      // Load full draft data
      const drafts = [];
      for (const draftRef of projectDrafts) {
        const draft = await this.loadDraft(draftRef.id);
        if (draft) {
          drafts.push(draft);
        }
      }

      // Sort by most recent first
      drafts.sort((a, b) => new Date(b.metadata.savedAt) - new Date(a.metadata.savedAt));
      
      return drafts;

    } catch (error) {
      console.error('Error getting project drafts:', error);
      return [];
    }
  }

  // Get all drafts (for recovery UI)
  async getAllDrafts() {
    try {
      const index = await this.loadDraftsIndex();
      const allDrafts = [];

      for (const projectKey in index) {
        const projectDrafts = await this.getProjectDrafts(projectKey);
        allDrafts.push(...projectDrafts);
      }

      // Sort by most recent first
      allDrafts.sort((a, b) => new Date(b.metadata.savedAt) - new Date(a.metadata.savedAt));
      
      return allDrafts;

    } catch (error) {
      console.error('Error getting all drafts:', error);
      return [];
    }
  }

  // Delete draft
  async deleteDraft(draftId) {
    try {
      const draft = await this.loadDraft(draftId);
      if (!draft) {
        return { success: true, message: 'Draft not found' };
      }

      // Remove from filesystem
      const draftPath = this.getDraftFilePath(draftId);
      await fs.remove(draftPath);

      // Remove from index
      await this.removeDraftFromIndex(draft.projectKey, draftId);

      console.log(`Draft deleted: ${draftId}`);
      
      return {
        success: true,
        message: 'Draft deleted successfully'
      };

    } catch (error) {
      console.error('Error deleting draft:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Mark draft as completed
  async markDraftAsCompleted(draftId, projectId) {
    try {
      const draft = await this.loadDraft(draftId);
      if (draft) {
        draft.status = 'completed';
        draft.projectId = projectId;
        draft.completedAt = new Date().toISOString();
        
        await fs.writeJSON(this.getDraftFilePath(draftId), draft, { spaces: 2 });
      }

    } catch (error) {
      console.error('Error marking draft as completed:', error);
    }
  }

  // Calculate completion percentage
  calculateCompletionPercentage(formData, currentStep) {
    const totalSteps = 3;
    const stepPercentage = ((currentStep - 1) / totalSteps) * 100;

    // Add bonus for filled fields in current step
    let fieldBonus = 0;
    if (currentStep === 1) {
      const requiredFields = ['projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 'rfaType', 'regionalTeam'];
      const filledRequired = requiredFields.filter(field => formData[field] && formData[field].trim() !== '').length;
      fieldBonus = (filledRequired / requiredFields.length) * (100 / totalSteps);
    } else if (currentStep === 2) {
      fieldBonus = formData.totalTriage ? (100 / totalSteps) : 0;
    }

    return Math.min(100, Math.round(stepPercentage + fieldBonus));
  }

  // Load drafts index
  async loadDraftsIndex() {
    try {
      const indexPath = this.getDraftsFilePath();
      if (!await fs.pathExists(indexPath)) {
        return {};
      }
      return await fs.readJSON(indexPath);
    } catch (error) {
      console.error('Error loading drafts index:', error);
      return {};
    }
  }

  // Save drafts index
  async saveDraftsIndex(index) {
    try {
      const indexPath = this.getDraftsFilePath();
      await fs.writeJSON(indexPath, index, { spaces: 2 });
    } catch (error) {
      console.error('Error saving drafts index:', error);
    }
  }

  // Update drafts index with new draft
  async updateDraftsIndex(projectKey, draft) {
    const index = await this.loadDraftsIndex();
    
    if (!index[projectKey]) {
      index[projectKey] = [];
    }

    // Add new draft reference
    index[projectKey].push({
      id: draft.id,
      savedAt: draft.metadata.savedAt,
      currentStep: draft.currentStep,
      completionPercentage: draft.completionPercentage
    });

    // Sort by most recent first
    index[projectKey].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    await this.saveDraftsIndex(index);
  }

  // Remove draft from index
  async removeDraftFromIndex(projectKey, draftId) {
    const index = await this.loadDraftsIndex();
    
    if (index[projectKey]) {
      index[projectKey] = index[projectKey].filter(draft => draft.id !== draftId);
      
      // Remove empty project keys
      if (index[projectKey].length === 0) {
        delete index[projectKey];
      }
      
      await this.saveDraftsIndex(index);
    }
  }

  // Cleanup old drafts for a specific project
  async cleanupProjectDrafts(projectKey) {
    try {
      const drafts = await this.getProjectDrafts(projectKey);
      
      // Keep only the most recent drafts
      if (drafts.length > this.config.maxDraftsPerProject) {
        const draftsToDelete = drafts.slice(this.config.maxDraftsPerProject);
        
        for (const draft of draftsToDelete) {
          if (draft.status !== 'completed') { // Don't auto-delete completed drafts
            await this.deleteDraft(draft.id);
          }
        }
      }

    } catch (error) {
      console.error('Error cleaning up project drafts:', error);
    }
  }

  // Cleanup old drafts system-wide
  async cleanupOldDrafts() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.draftRetentionDays);

      const allDrafts = await this.getAllDrafts();
      let deletedCount = 0;

      for (const draft of allDrafts) {
        const draftDate = new Date(draft.metadata.savedAt);
        
        // Delete old drafts that are not completed
        if (draftDate < cutoffDate && draft.status !== 'completed') {
          const result = await this.deleteDraft(draft.id);
          if (result.success) {
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        console.log(`Cleanup: Deleted ${deletedCount} old drafts`);
      }

      return { deletedCount };

    } catch (error) {
      console.error('Error during draft cleanup:', error);
      return { deletedCount: 0 };
    }
  }

  // Get draft statistics
  async getDraftStatistics() {
    try {
      const allDrafts = await this.getAllDrafts();
      const index = await this.loadDraftsIndex();

      const stats = {
        totalDrafts: allDrafts.length,
        totalProjects: Object.keys(index).length,
        draftsByStatus: {
          draft: allDrafts.filter(d => d.status === 'draft').length,
          completed: allDrafts.filter(d => d.status === 'completed').length
        },
        draftsByStep: {
          step1: allDrafts.filter(d => d.currentStep === 1).length,
          step2: allDrafts.filter(d => d.currentStep === 2).length,
          step3: allDrafts.filter(d => d.currentStep === 3).length
        },
        averageCompletion: allDrafts.length > 0 ? 
          Math.round(allDrafts.reduce((sum, d) => sum + d.completionPercentage, 0) / allDrafts.length) : 0,
        oldestDraft: allDrafts.length > 0 ? 
          Math.min(...allDrafts.map(d => new Date(d.metadata.savedAt))) : null,
        newestDraft: allDrafts.length > 0 ? 
          Math.max(...allDrafts.map(d => new Date(d.metadata.savedAt))) : null
      };

      return stats;

    } catch (error) {
      console.error('Error getting draft statistics:', error);
      return {
        totalDrafts: 0,
        totalProjects: 0,
        draftsByStatus: { draft: 0, completed: 0 },
        draftsByStep: { step1: 0, step2: 0, step3: 0 },
        averageCompletion: 0,
        oldestDraft: null,
        newestDraft: null
      };
    }
  }

  // Export drafts for backup
  async exportDrafts() {
    try {
      const allDrafts = await this.getAllDrafts();
      const index = await this.loadDraftsIndex();
      
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        drafts: allDrafts,
        index
      };

      return {
        success: true,
        data: exportData,
        fileName: `project-drafts-backup-${new Date().toISOString().split('T')[0]}.json`
      };

    } catch (error) {
      console.error('Error exporting drafts:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Import drafts from backup
  async importDrafts(importData) {
    try {
      if (!importData.drafts || !Array.isArray(importData.drafts)) {
        throw new Error('Invalid import data format');
      }

      let importedCount = 0;
      let skippedCount = 0;

      for (const draft of importData.drafts) {
        // Check if draft already exists
        const existing = await this.loadDraft(draft.id);
        if (existing) {
          skippedCount++;
          continue;
        }

        // Save imported draft
        await fs.writeJSON(this.getDraftFilePath(draft.id), draft, { spaces: 2 });
        await this.updateDraftsIndex(draft.projectKey, draft);
        importedCount++;
      }

      return {
        success: true,
        importedCount,
        skippedCount,
        message: `Imported ${importedCount} drafts, skipped ${skippedCount} existing drafts`
      };

    } catch (error) {
      console.error('Error importing drafts:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ProjectDraftService;


