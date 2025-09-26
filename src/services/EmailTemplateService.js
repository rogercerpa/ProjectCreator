// EmailTemplateService - Handles email template storage, management, and variable substitution
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class EmailTemplateService {
  constructor() {
    this.config = {
      dataDirectory: path.join(os.homedir(), '.project-creator'),
      templatesFile: 'email-templates.json',
      backupFile: 'email-templates-backup.json'
    };
    
    this.initializeTemplateSystem();
  }

  // Initialize email template data directory and files
  async initializeTemplateSystem() {
    try {
      await fs.ensureDir(this.config.dataDirectory);
      
      // Initialize empty templates file if it doesn't exist
      const templatesPath = this.getDataFilePath(this.config.templatesFile);
      if (!await fs.pathExists(templatesPath)) {
        await this.saveTemplates([]);
      }
    } catch (error) {
      console.error('Error initializing email template system:', error);
    }
  }

  // Get full path for data file
  getDataFilePath(filename) {
    return path.join(this.config.dataDirectory, filename);
  }

  // Load all email templates
  async loadTemplates() {
    try {
      const templatesPath = this.getDataFilePath(this.config.templatesFile);
      
      if (!await fs.pathExists(templatesPath)) {
        return [];
      }

      const data = await fs.readFile(templatesPath, 'utf8');
      const templates = JSON.parse(data);
      
      // Ensure templates is an array
      return Array.isArray(templates) ? templates : [];
    } catch (error) {
      console.error('Error loading email templates:', error);
      return [];
    }
  }

  // Save all email templates
  async saveTemplates(templates) {
    try {
      const templatesPath = this.getDataFilePath(this.config.templatesFile);
      const backupPath = this.getDataFilePath(this.config.backupFile);
      
      // Create backup if file exists
      if (await fs.pathExists(templatesPath)) {
        await fs.copy(templatesPath, backupPath);
      }
      
      // Ensure templates is an array
      const templatesToSave = Array.isArray(templates) ? templates : [];
      
      await fs.writeFile(templatesPath, JSON.stringify(templatesToSave, null, 2), 'utf8');
      return { success: true, message: 'Email templates saved successfully' };
    } catch (error) {
      console.error('Error saving email templates:', error);
      return { success: false, error: error.message };
    }
  }

  // Create a new email template
  async createTemplate(templateData) {
    try {
      const templates = await this.loadTemplates();
      
      // Generate unique ID for template
      const templateId = this.generateTemplateId();
      
      const newTemplate = {
        id: templateId,
        name: templateData.name || 'Untitled Template',
        category: templateData.category || 'General',
        subject: templateData.subject || '',
        content: templateData.content || '',
        variables: templateData.variables || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
        ...templateData
      };

      templates.push(newTemplate);
      const result = await this.saveTemplates(templates);
      
      if (result.success) {
        return { 
          success: true, 
          template: newTemplate, 
          message: 'Template created successfully' 
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('Error creating email template:', error);
      return { success: false, error: error.message };
    }
  }

  // Update an existing email template
  async updateTemplate(templateId, updates) {
    try {
      const templates = await this.loadTemplates();
      const templateIndex = templates.findIndex(t => t.id === templateId);
      
      if (templateIndex === -1) {
        return { success: false, error: 'Template not found' };
      }

      // Update template with new data
      templates[templateIndex] = {
        ...templates[templateIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const result = await this.saveTemplates(templates);
      
      if (result.success) {
        return { 
          success: true, 
          template: templates[templateIndex], 
          message: 'Template updated successfully' 
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('Error updating email template:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete an email template
  async deleteTemplate(templateId) {
    try {
      const templates = await this.loadTemplates();
      const templateIndex = templates.findIndex(t => t.id === templateId);
      
      if (templateIndex === -1) {
        return { success: false, error: 'Template not found' };
      }

      const deletedTemplate = templates.splice(templateIndex, 1)[0];
      const result = await this.saveTemplates(templates);
      
      if (result.success) {
        return { 
          success: true, 
          template: deletedTemplate, 
          message: 'Template deleted successfully' 
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('Error deleting email template:', error);
      return { success: false, error: error.message };
    }
  }

  // Get template by ID
  async getTemplate(templateId) {
    try {
      const templates = await this.loadTemplates();
      const template = templates.find(t => t.id === templateId);
      
      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      return { success: true, template };
    } catch (error) {
      console.error('Error getting email template:', error);
      return { success: false, error: error.message };
    }
  }

  // Get templates by category
  async getTemplatesByCategory(category) {
    try {
      const templates = await this.loadTemplates();
      const categoryTemplates = templates.filter(t => 
        t.category?.toLowerCase() === category?.toLowerCase()
      );
      
      return { success: true, templates: categoryTemplates };
    } catch (error) {
      console.error('Error getting templates by category:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all template categories
  async getTemplateCategories() {
    try {
      const templates = await this.loadTemplates();
      const categories = [...new Set(templates.map(t => t.category).filter(Boolean))];
      
      return { success: true, categories };
    } catch (error) {
      console.error('Error getting template categories:', error);
      return { success: false, error: error.message };
    }
  }

  // Increment template usage count
  async incrementUsageCount(templateId) {
    try {
      const templates = await this.loadTemplates();
      const template = templates.find(t => t.id === templateId);
      
      if (template) {
        template.usageCount = (template.usageCount || 0) + 1;
        template.lastUsed = new Date().toISOString();
        await this.saveTemplates(templates);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error incrementing usage count:', error);
      return { success: false, error: error.message };
    }
  }

  // Apply template variables to content
  applyTemplateVariables(content, variables) {
    try {
      let processedContent = content;
      
      // Replace each variable in the content
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{${key}\\}`, 'gi');
        processedContent = processedContent.replace(regex, value || '');
      });
      
      return processedContent;
    } catch (error) {
      console.error('Error applying template variables:', error);
      return content; // Return original content if error
    }
  }

  // Generate personalized email content for an agency
  generatePersonalizedEmail(template, agencyData) {
    try {
      // Define available variables based on agency data
      const variables = {
        AgencyName: agencyData.agencyName || '',
        ContactName: agencyData.contactName || '',
        Region: agencyData.region || '',
        AgentCount: agencyData.totalAgents || agencyData.agents?.length || '1',
        AgencyNumber: agencyData.agencyNumber || '',
        Phone: agencyData.phoneNumber || '',
        Email: agencyData.contactEmail || '',
        MainContact: agencyData.mainContact || '',
        Role: agencyData.role || '',
        CurrentDate: new Date().toLocaleDateString(),
        CurrentTime: new Date().toLocaleTimeString(),
        UserName: process.env.USERNAME || 'Team'
      };

      // Apply variables to subject and content
      const personalizedSubject = this.applyTemplateVariables(template.subject, variables);
      const personalizedContent = this.applyTemplateVariables(template.content, variables);

      return {
        success: true,
        email: {
          subject: personalizedSubject,
          content: personalizedContent,
          variables: variables,
          agencyData: agencyData
        }
      };
    } catch (error) {
      console.error('Error generating personalized email:', error);
      return { success: false, error: error.message };
    }
  }

  // Get available template variables
  getAvailableVariables() {
    return [
      { key: 'AgencyName', description: 'Name of the agency' },
      { key: 'ContactName', description: 'Primary contact name' },
      { key: 'Region', description: 'Agency region' },
      { key: 'AgentCount', description: 'Number of agents in agency' },
      { key: 'AgencyNumber', description: 'Agency identification number' },
      { key: 'Phone', description: 'Agency phone number' },
      { key: 'Email', description: 'Agency email address' },
      { key: 'MainContact', description: 'Main contact person' },
      { key: 'Role', description: 'Contact role/position' },
      { key: 'CurrentDate', description: 'Current date' },
      { key: 'CurrentTime', description: 'Current time' },
      { key: 'UserName', description: 'Your name/username' }
    ];
  }

  // Generate unique template ID
  generateTemplateId() {
    return 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Export templates to file
  async exportTemplates(filePath) {
    try {
      const templates = await this.loadTemplates();
      const exportData = {
        templates: templates,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8');
      return { success: true, message: 'Templates exported successfully', count: templates.length };
    } catch (error) {
      console.error('Error exporting templates:', error);
      return { success: false, error: error.message };
    }
  }

  // Import templates from file
  async importTemplates(filePath, options = {}) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const importData = JSON.parse(data);
      
      let templatesToImport = [];
      
      // Handle different import formats
      if (importData.templates && Array.isArray(importData.templates)) {
        templatesToImport = importData.templates;
      } else if (Array.isArray(importData)) {
        templatesToImport = importData;
      } else {
        return { success: false, error: 'Invalid template file format' };
      }

      const currentTemplates = await this.loadTemplates();
      
      // Handle duplicate templates
      if (options.overwrite) {
        // Replace existing templates
        const result = await this.saveTemplates(templatesToImport);
        return { 
          success: result.success, 
          message: `Imported ${templatesToImport.length} templates (overwrite mode)`,
          count: templatesToImport.length 
        };
      } else {
        // Merge with existing templates
        const mergedTemplates = [...currentTemplates, ...templatesToImport];
        const result = await this.saveTemplates(mergedTemplates);
        return { 
          success: result.success, 
          message: `Imported ${templatesToImport.length} templates`,
          count: templatesToImport.length 
        };
      }
    } catch (error) {
      console.error('Error importing templates:', error);
      return { success: false, error: error.message };
    }
  }

  // Get template statistics
  async getTemplateStatistics() {
    try {
      const templates = await this.loadTemplates();
      
      const stats = {
        totalTemplates: templates.length,
        categoriesCount: new Set(templates.map(t => t.category).filter(Boolean)).size,
        totalUsage: templates.reduce((sum, t) => sum + (t.usageCount || 0), 0),
        mostUsedTemplate: templates.reduce((max, t) => 
          (t.usageCount || 0) > (max.usageCount || 0) ? t : max, {}),
        recentlyCreated: templates.filter(t => {
          const created = new Date(t.createdAt);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return created > weekAgo;
        }).length,
        categories: {}
      };

      // Count templates per category
      templates.forEach(t => {
        const category = t.category || 'Uncategorized';
        stats.categories[category] = (stats.categories[category] || 0) + 1;
      });

      return { success: true, statistics: stats };
    } catch (error) {
      console.error('Error getting template statistics:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = EmailTemplateService;
