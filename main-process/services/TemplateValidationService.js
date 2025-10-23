const fs = require('fs-extra');
const path = require('path');
const RFATypeMappingService = require('./RFATypeMappingService');

/**
 * TemplateValidationService - Comprehensive template validation and management
 * 
 * This service handles:
 * - Template existence validation for all RFA types
 * - Fallback template selection when primary templates are missing
 * - National Account specific template validation
 * - Agent-specific template requirements
 * - Template dependency management
 * - Error handling with user-friendly messages
 */
class TemplateValidationService {
  constructor() {
    this.pathResolver = null; // Will be initialized lazily to avoid circular dependencies
    this.templateCache = new Map(); // Cache for template validation results
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache timeout
    this.rfaMapping = new RFATypeMappingService();
    
    // RFA type to template mapping (based on HTA logic)
    this.rfaTypeTemplates = {
      // Standard Controls templates
      'BOM': 'RFA#_TYPE_MMDDYYYY',
      'LAYOUT': 'RFA#_TYPE_MMDDYYYY', 
      'BUDGET': 'RFA#_TYPE_MMDDYYYY',
      'SUBMITTAL': 'RFA#_TYPE_MMDDYYYY',
      'RELEASE': 'RFA#_TYPE_MMDDYYYY',
      'GRAPHICS': 'RFA#_TYPE_MMDDYYYY',
      'CONTROLSDCLAYOUT': 'RFA#_TYPE_MMDDYYYY',
      'Consultation': 'RFA#_TYPE_MMDDYYYY',
      
      // Atrius templates
      'AtriusBOM': 'RFA#_TYPE_MMDDYYYY',
      'AtriusLAYOUT': 'RFA#_TYPE_MMDDYYYY',
      'AtriusSub': 'RFA#_TYPE_MMDDYYYY',
      'ControlsAtriusSub': 'RFA#_TYPE_MMDDYYYY',
      'ControlsAtriusLayout': 'RFA#_TYPE_MMDDYYYY',
      
      // Reloc templates
      'RelocBOM': 'RELOC-RFA#_TYPE_MMDDYYYY',
      'RelocSUB': 'RELOC-RFA#_TYPE_MMDDYYYY',
      'RelocControlsBOM': 'RELOC-RFA#_TYPE_MMDDYYYY',
      'RelocControlsSUB': 'RELOC-RFA#_TYPE_MMDDYYYY',
      
      // Photometrics templates
      'PHOTOMETRICS': 'PHOTOMETRICS-RFA#_TYPE_MMDDYYYY'
    };

    // Agent-specific template requirements (based on HTA logic)
    this.agentSpecificTemplates = {
      // Metric template agents
      metric: [563, 584, 903, 904, 905, 906, 909, 912, 915, 926, 968],
      
      // Holophane template agents (4-digit agent numbers)
      holophane: (agentNumber) => {
        return agentNumber && agentNumber.toString().length === 4;
      }
    };

    // National Account template mappings (based on HTA CheckNA function)
    this.nationalAccountTemplates = {
      'ARBYS': 'ARBYS',
      'BEALLS': 'BEALLS', 
      'CHICK FIL A': 'CHICK FIL A',
      'CHIPOTLE': 'CHIPOTLE',
      'CRUMBL': 'CRUMBL',
      'DAVE AND BUSTERS': 'DAVE AND BUSTERS',
      'DAVITA': 'DAVITA',
      'DRIVE SHACK': 'DRIVE SHACK',
      'DRYBAR': 'DRYBAR',
      'FLOOR AND DECOR': 'FLOOR AND DECOR',
      'FMC': 'FMC',
      'HOME DEPOT': 'HOME DEPOT',
      'INPLANT OFFICE': 'INPLANT OFFICE',
      'JD SPORTS': 'JD SPORTS',
      'LEVIS': 'LEVIS',
      'NORDSTROM RACK': 'NORDSTROM RACK',
      'OFFICE DEPOT': 'OFFICE DEPOT',
      'POTTERY BARN': 'POTTERY BARN',
      'Raising Cane\'s': 'Raising Cane\'s',
      'REGUS': 'REGUS',
      'TARGET': 'TARGET',
      'TD AMERITRADE': 'TD AMERITRADE',
      'US BANK': 'US BANK',
      'WEST ELM': 'WEST ELM',
      'Sikorsky': 'Sikorsky'
    };
  }

  /**
   * Initialize path resolver (lazy loading to avoid circular dependencies)
   */
  async getPathResolver() {
    if (!this.pathResolver) {
      const PathResolutionService = require('./PathResolutionService');
      this.pathResolver = new PathResolutionService();
    }
    return this.pathResolver;
  }

  /**
   * Validate template existence for a specific RFA type
   * @param {string} rfaType - The RFA type to validate
   * @param {Object} projectData - Project data including national account and agent info
   * @param {boolean} useCache - Whether to use cached results
   * @returns {Promise<Object>} Validation result with template paths and status
   */
  async validateTemplateForRFAType(rfaType, projectData = {}, useCache = true) {
    try {
      // Convert display label to internal value if needed
      const internalRFAType = this.rfaMapping.getRFAValueFromLabel(rfaType);
      const internalProjectData = this.rfaMapping.convertFormDataToInternal(projectData);
      
      // Check cache first
      const cacheKey = `${internalRFAType}_${internalProjectData.nationalAccount || 'Default'}_${internalProjectData.agentNumber || 'None'}`;
      if (useCache && this.templateCache.has(cacheKey)) {
        const cached = this.templateCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          console.log(`TemplateValidationService: Using cached result for ${cacheKey}`);
          return cached.result;
        }
      }

      console.log(`TemplateValidationService: Validating template for RFA type: ${rfaType} (internal: ${internalRFAType})`);
      
      const pathResolver = await this.getPathResolver();
      const templatePaths = await pathResolver.getTemplatePaths();
      
      // Get base template path for RFA type
      const baseTemplatePath = await this.getBaseTemplatePath(internalRFAType, templatePaths);
      
      // Check National Account specific templates
      const naTemplatePath = await this.getNationalAccountTemplatePath(internalRFAType, internalProjectData, templatePaths);
      
      // Check agent-specific templates
      const agentTemplates = await this.getAgentSpecificTemplates(internalRFAType, internalProjectData, templatePaths);
      
      // Determine the best available template
      const bestTemplate = this.selectBestTemplate({
        base: baseTemplatePath,
        nationalAccount: naTemplatePath,
        agent: agentTemplates
      });

      const result = {
        success: bestTemplate.valid,
        rfaType: rfaType,
        templatePath: bestTemplate.path,
        templateName: bestTemplate.name,
        validationDetails: {
          base: baseTemplatePath,
          nationalAccount: naTemplatePath,
          agent: agentTemplates
        },
        errors: bestTemplate.errors || [],
        warnings: bestTemplate.warnings || []
      };

      // Cache the result
      if (useCache) {
        this.templateCache.set(cacheKey, {
          result: result,
          timestamp: Date.now()
        });
      }

      return result;

    } catch (error) {
      console.error('TemplateValidationService: Error validating template:', error);
      return {
        success: false,
        rfaType: rfaType,
        templatePath: null,
        templateName: null,
        validationDetails: {},
        errors: [`Template validation failed: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Get base template path for RFA type
   */
  async getBaseTemplatePath(rfaType, templatePaths) {
    const templateName = this.rfaTypeTemplates[rfaType];
    if (!templateName) {
      return {
        valid: false,
        path: null,
        name: null,
        errors: [`Unknown RFA type: ${rfaType}`]
      };
    }

    const basePath = templatePaths.bestTemplatePath;
    if (!basePath) {
      return {
        valid: false,
        path: null,
        name: templateName,
        errors: ['No valid template base path available']
      };
    }

    const fullPath = path.join(basePath, templateName);
    const validation = await this.validateTemplatePath(fullPath);

    return {
      valid: validation.valid,
      path: fullPath,
      name: templateName,
      errors: validation.valid ? [] : [validation.reason],
      basePath: basePath
    };
  }

  /**
   * Get National Account specific template path
   */
  async getNationalAccountTemplatePath(rfaType, projectData, templatePaths) {
    const nationalAccount = projectData.nationalAccount;
    
    if (!nationalAccount || nationalAccount === 'Default' || nationalAccount === 'N/A') {
      return {
        valid: false,
        path: null,
        name: null,
        errors: ['No National Account specified']
      };
    }

    const naKey = this.nationalAccountTemplates[nationalAccount];
    if (!naKey) {
      return {
        valid: false,
        path: null,
        name: null,
        errors: [`Unknown National Account: ${nationalAccount}`]
      };
    }

    // Build National Account template path (based on HTA logic)
    const naTemplatesPath = path.join(templatePaths.bestTemplatePath, '..', 'Corporate Accounts', naKey);
    const naTemplateFolder = path.join(naTemplatesPath, `!${naKey} - Template Folder`);
    
    const templateName = this.rfaTypeTemplates[rfaType];
    const fullPath = path.join(naTemplateFolder, templateName);
    
    const validation = await this.validateTemplatePath(fullPath);

    return {
      valid: validation.valid,
      path: fullPath,
      name: templateName,
      errors: validation.valid ? [] : [validation.reason],
      nationalAccount: nationalAccount
    };
  }

  /**
   * Get agent-specific templates
   */
  async getAgentSpecificTemplates(rfaType, projectData, templatePaths) {
    const agentNumber = projectData.agentNumber;
    const templates = [];

    if (!agentNumber) {
      return {
        valid: false,
        templates: [],
        errors: ['No agent number specified']
      };
    }

    // Check for metric template requirement
    if (this.agentSpecificTemplates.metric.includes(parseInt(agentNumber))) {
      const metricPath = path.join(templatePaths.bestTemplatePath, '(Metric).vsp');
      const metricValidation = await this.validateTemplatePath(metricPath);
      
      templates.push({
        type: 'metric',
        path: metricPath,
        valid: metricValidation.valid,
        errors: metricValidation.valid ? [] : [metricValidation.reason]
      });
    }

    // Check for Holophane template requirement
    if (this.agentSpecificTemplates.holophane(agentNumber)) {
      const holophanePath = path.join(templatePaths.agentRequirements.path, 'Holophane.vsp');
      const holophaneValidation = await this.validateTemplatePath(holophanePath);
      
      templates.push({
        type: 'holophane',
        path: holophanePath,
        valid: holophaneValidation.valid,
        errors: holophaneValidation.valid ? [] : [holophaneValidation.reason]
      });
    }

    // Check for agency-specific template
    const agencyPath = path.join(templatePaths.agentRequirements.path, `${agentNumber}.vsp`);
    const agencyValidation = await this.validateTemplatePath(agencyPath);
    
    templates.push({
      type: 'agency',
      path: agencyPath,
      valid: agencyValidation.valid,
      errors: agencyValidation.valid ? [] : [agencyValidation.reason]
    });

    const validTemplates = templates.filter(t => t.valid);
    const allErrors = templates.flatMap(t => t.errors);

    return {
      valid: validTemplates.length > 0,
      templates: templates,
      validTemplates: validTemplates,
      errors: allErrors
    };
  }

  /**
   * Select the best available template from multiple options
   */
  selectBestTemplate(options) {
    // Priority order: National Account > Agent > Base
    if (options.nationalAccount && options.nationalAccount.valid) {
      return {
        valid: true,
        path: options.nationalAccount.path,
        name: options.nationalAccount.name,
        source: 'nationalAccount',
        warnings: []
      };
    }

    if (options.agent && options.agent.valid) {
      return {
        valid: true,
        path: options.agent.validTemplates[0].path,
        name: options.agent.validTemplates[0].type,
        source: 'agent',
        warnings: options.agent.errors
      };
    }

    if (options.base && options.base.valid) {
      return {
        valid: true,
        path: options.base.path,
        name: options.base.name,
        source: 'base',
        warnings: []
      };
    }

    // No valid template found
    const allErrors = [
      ...(options.base?.errors || []),
      ...(options.nationalAccount?.errors || []),
      ...(options.agent?.errors || [])
    ];

    return {
      valid: false,
      path: null,
      name: null,
      source: 'none',
      errors: allErrors
    };
  }

  /**
   * Validate a specific template path
   */
  async validateTemplatePath(templatePath) {
    try {
      if (!templatePath) {
        return { valid: false, reason: 'Template path is empty' };
      }

      const exists = await fs.pathExists(templatePath);
      if (!exists) {
        return { valid: false, reason: 'Template path does not exist' };
      }

      const stats = await fs.stat(templatePath);
      if (stats.isDirectory()) {
        // Check if directory has required files
        const files = await fs.readdir(templatePath);
        if (files.length === 0) {
          return { valid: false, reason: 'Template directory is empty' };
        }
        return { valid: true, reason: 'Template directory exists and contains files' };
      } else {
        // Single file template
        return { valid: true, reason: 'Template file exists' };
      }

    } catch (error) {
      return { valid: false, reason: `Template validation error: ${error.message}` };
    }
  }

  /**
   * Validate all templates for a project (comprehensive validation)
   */
  async validateAllTemplatesForProject(projectData) {
    try {
      console.log('TemplateValidationService: Starting comprehensive template validation');
      
      // Convert form data to internal format for validation
      const internalProjectData = this.rfaMapping.convertFormDataToInternal(projectData);
      const rfaType = internalProjectData.rfaType;
      
      console.log(`TemplateValidationService: Original project data:`, projectData);
      console.log(`TemplateValidationService: Converted project data:`, internalProjectData);
      console.log(`TemplateValidationService: Converted RFA type from "${projectData.rfaType}" to "${rfaType}"`);
      console.log(`TemplateValidationService: Converted National Account from "${projectData.nationalAccount}" to "${internalProjectData.nationalAccount}"`);
      
      const results = {
        success: true,
        rfaType: rfaType,
        originalRfaType: projectData.rfaType, // Keep original for display
        validations: {},
        errors: [],
        warnings: []
      };

      // Validate main template using internal data
      const mainTemplate = await this.validateTemplateForRFAType(rfaType, internalProjectData);
      results.validations.main = mainTemplate;
      
      if (!mainTemplate.success) {
        results.success = false;
        results.errors.push(`Main template validation failed: ${mainTemplate.errors.join(', ')}`);
      }

      // Validate special templates based on RFA type
      if (rfaType === 'RELEASE') {
        const lcdTemplate = await this.validateLCDTemplate(internalProjectData);
        results.validations.lcd = lcdTemplate;
        
        if (!lcdTemplate.success) {
          results.warnings.push(`LCD template not available: ${lcdTemplate.errors.join(', ')}`);
        }
      }

      // Validate agent-specific templates
      if (projectData.agentNumber) {
        const agentTemplates = await this.getAgentSpecificTemplates(rfaType, projectData, await this.getPathResolver().then(p => p.getTemplatePaths()));
        results.validations.agent = agentTemplates;
        
        if (!agentTemplates.valid) {
          results.warnings.push(`Agent-specific templates not available: ${agentTemplates.errors.join(', ')}`);
        }
      }

      return results;

    } catch (error) {
      console.error('TemplateValidationService: Error in comprehensive validation:', error);
      return {
        success: false,
        rfaType: projectData.rfaType,
        validations: {},
        errors: [`Comprehensive validation failed: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Validate LCD template for RELEASE projects
   */
  async validateLCDTemplate(projectData) {
    try {
      const pathResolver = await this.getPathResolver();
      const templatePaths = await pathResolver.getTemplatePaths();
      
      const lcdPath = path.join(templatePaths.bestTemplatePath, 'LCD');
      const validation = await this.validateTemplatePath(lcdPath);

      return {
        success: validation.valid,
        path: lcdPath,
        name: 'LCD',
        errors: validation.valid ? [] : [validation.reason]
      };

    } catch (error) {
      return {
        success: false,
        path: null,
        name: 'LCD',
        errors: [`LCD template validation failed: ${error.message}`]
      };
    }
  }

  /**
   * Clear template cache
   */
  clearCache() {
    this.templateCache.clear();
    console.log('TemplateValidationService: Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    const validEntries = Array.from(this.templateCache.values())
      .filter(entry => now - entry.timestamp < this.cacheTimeout);
    
    return {
      totalEntries: this.templateCache.size,
      validEntries: validEntries.length,
      expiredEntries: this.templateCache.size - validEntries.length
    };
  }
}

module.exports = TemplateValidationService;
