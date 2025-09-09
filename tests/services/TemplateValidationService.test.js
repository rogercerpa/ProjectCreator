const fs = require('fs-extra');
const path = require('path');
const TemplateValidationService = require('../../src/services/TemplateValidationService');

// Mock fs-extra
jest.mock('fs-extra');

// Mock PathResolutionService
jest.mock('../../src/services/PathResolutionService', () => {
  return jest.fn().mockImplementation(() => ({
    getTemplatePaths: jest.fn(),
    getPathResolver: jest.fn()
  }));
});

describe('TemplateValidationService', () => {
  let templateService;
  let mockPathResolver;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create fresh instance
    templateService = new TemplateValidationService();
    
    // Mock path resolver
    mockPathResolver = {
      getTemplatePaths: jest.fn(),
      getPathResolver: jest.fn()
    };
    
    // Mock the path resolver getter
    templateService.getPathResolver = jest.fn().mockResolvedValue(mockPathResolver);
  });

  describe('Constructor', () => {
    test('should initialize with correct default values', () => {
      expect(templateService.templateCache).toBeInstanceOf(Map);
      expect(templateService.cacheTimeout).toBe(5 * 60 * 1000);
      expect(templateService.rfaTypeTemplates).toBeDefined();
      expect(templateService.agentSpecificTemplates).toBeDefined();
      expect(templateService.nationalAccountTemplates).toBeDefined();
    });

    test('should have correct RFA type mappings', () => {
      expect(templateService.rfaTypeTemplates['BOM']).toBe('RFA#_TYPE_MMDDYYYY');
      expect(templateService.rfaTypeTemplates['RelocBOM']).toBe('RELOC-RFA#_TYPE_MMDDYYYY');
      expect(templateService.rfaTypeTemplates['PHOTOMETRICS']).toBe('PHOTOMETRICS-RFA#_TYPE_MMDDYYYY');
    });

    test('should have correct agent-specific template mappings', () => {
      expect(templateService.agentSpecificTemplates.metric).toContain(563);
      expect(templateService.agentSpecificTemplates.metric).toContain(584);
      expect(templateService.agentSpecificTemplates.holophane(1234)).toBe(true);
      expect(templateService.agentSpecificTemplates.holophane(123)).toBe(false);
    });
  });

  describe('validateTemplateForRFAType', () => {
    beforeEach(() => {
      // Mock successful template paths
      mockPathResolver.getTemplatePaths.mockResolvedValue({
        bestTemplatePath: '/mock/templates',
        primary: { path: '/mock/templates', valid: true },
        fallback: { path: '/mock/fallback', valid: true },
        agentRequirements: { path: '/mock/agent', valid: true }
      });
    });

    test('should validate standard RFA type successfully', async () => {
      // Mock file system responses
      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1.vsp', 'file2.docx']);

      const result = await templateService.validateTemplateForRFAType('BOM', {});

      expect(result.success).toBe(true);
      expect(result.rfaType).toBe('BOM');
      expect(result.templatePath).toContain('RFA#_TYPE_MMDDYYYY');
      expect(result.errors).toHaveLength(0);
    });

    test('should handle missing template gracefully', async () => {
      // Mock file system responses for missing template
      fs.pathExists.mockResolvedValue(false);

      const result = await templateService.validateTemplateForRFAType('BOM', {});

      expect(result.success).toBe(false);
      expect(result.templatePath).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate National Account templates', async () => {
      // Mock file system responses
      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1.vsp']);

      const projectData = {
        nationalAccount: 'TARGET',
        agentNumber: '1234'
      };

      const result = await templateService.validateTemplateForRFAType('BOM', projectData);

      expect(result.success).toBe(true);
      expect(result.validationDetails.nationalAccount).toBeDefined();
    });

    test('should validate agent-specific templates', async () => {
      // Mock file system responses
      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1.vsp']);

      const projectData = {
        agentNumber: '563' // Metric template agent
      };

      const result = await templateService.validateTemplateForRFAType('BOM', projectData);

      expect(result.success).toBe(true);
      expect(result.validationDetails.agent).toBeDefined();
    });

    test('should use cache when enabled', async () => {
      // Mock file system responses
      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1.vsp']);

      // First call
      const result1 = await templateService.validateTemplateForRFAType('BOM', {}, true);
      expect(result1.success).toBe(true);

      // Second call should use cache
      const result2 = await templateService.validateTemplateForRFAType('BOM', {}, true);
      expect(result2.success).toBe(true);
      expect(mockPathResolver.getTemplatePaths).toHaveBeenCalledTimes(1);
    });

    test('should handle unknown RFA type', async () => {
      const result = await templateService.validateTemplateForRFAType('UNKNOWN_TYPE', {});

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unknown RFA type: UNKNOWN_TYPE');
    });
  });

  describe('getBaseTemplatePath', () => {
    test('should return correct path for standard RFA type', async () => {
      const templatePaths = {
        bestTemplatePath: '/mock/templates'
      };

      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1.vsp']);

      const result = await templateService.getBaseTemplatePath('BOM', templatePaths);

      expect(result.valid).toBe(true);
      expect(result.path).toContain('RFA#_TYPE_MMDDYYYY');
      expect(result.name).toBe('RFA#_TYPE_MMDDYYYY');
    });

    test('should handle missing base path', async () => {
      const templatePaths = {
        bestTemplatePath: null
      };

      const result = await templateService.getBaseTemplatePath('BOM', templatePaths);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No valid template base path available');
    });
  });

  describe('getNationalAccountTemplatePath', () => {
    test('should return correct path for valid National Account', async () => {
      const templatePaths = {
        bestTemplatePath: '/mock/templates'
      };

      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1.vsp']);

      const projectData = {
        nationalAccount: 'TARGET'
      };

      const result = await templateService.getNationalAccountTemplatePath('BOM', projectData, templatePaths);

      expect(result.valid).toBe(true);
      expect(result.path).toContain('TARGET');
      expect(result.nationalAccount).toBe('TARGET');
    });

    test('should handle missing National Account', async () => {
      const templatePaths = {
        bestTemplatePath: '/mock/templates'
      };

      const projectData = {};

      const result = await templateService.getNationalAccountTemplatePath('BOM', projectData, templatePaths);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No National Account specified');
    });

    test('should handle unknown National Account', async () => {
      const templatePaths = {
        bestTemplatePath: '/mock/templates'
      };

      const projectData = {
        nationalAccount: 'UNKNOWN_ACCOUNT'
      };

      const result = await templateService.getNationalAccountTemplatePath('BOM', projectData, templatePaths);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown National Account: UNKNOWN_ACCOUNT');
    });
  });

  describe('getAgentSpecificTemplates', () => {
    test('should validate metric template for specific agents', async () => {
      const templatePaths = {
        bestTemplatePath: '/mock/templates',
        agentRequirements: { path: '/mock/agent' }
      };

      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => false });

      const projectData = {
        agentNumber: '563' // Metric template agent
      };

      const result = await templateService.getAgentSpecificTemplates('BOM', projectData, templatePaths);

      expect(result.valid).toBe(true);
      expect(result.templates).toHaveLength(2); // metric + agency
      expect(result.templates.some(t => t.type === 'metric')).toBe(true);
    });

    test('should validate Holophane template for 4-digit agents', async () => {
      const templatePaths = {
        bestTemplatePath: '/mock/templates',
        agentRequirements: { path: '/mock/agent' }
      };

      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => false });

      const projectData = {
        agentNumber: '1234' // 4-digit agent
      };

      const result = await templateService.getAgentSpecificTemplates('BOM', projectData, templatePaths);

      expect(result.valid).toBe(true);
      expect(result.templates).toHaveLength(2); // holophane + agency
      expect(result.templates.some(t => t.type === 'holophane')).toBe(true);
    });

    test('should handle missing agent number', async () => {
      const templatePaths = {
        bestTemplatePath: '/mock/templates',
        agentRequirements: { path: '/mock/agent' }
      };

      const projectData = {};

      const result = await templateService.getAgentSpecificTemplates('BOM', projectData, templatePaths);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No agent number specified');
    });
  });

  describe('validateTemplatePath', () => {
    test('should validate existing directory template', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1.vsp', 'file2.docx']);

      const result = await templateService.validateTemplatePath('/mock/template');

      expect(result.valid).toBe(true);
      expect(result.reason).toBe('Template directory exists and contains files');
    });

    test('should validate existing file template', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => false });

      const result = await templateService.validateTemplatePath('/mock/template.vsp');

      expect(result.valid).toBe(true);
      expect(result.reason).toBe('Template file exists');
    });

    test('should handle missing template', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await templateService.validateTemplatePath('/mock/nonexistent');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Template path does not exist');
    });

    test('should handle empty template directory', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue([]);

      const result = await templateService.validateTemplatePath('/mock/empty');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Template directory is empty');
    });

    test('should handle empty path', async () => {
      const result = await templateService.validateTemplatePath('');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Template path is empty');
    });

    test('should handle file system errors', async () => {
      fs.pathExists.mockRejectedValue(new Error('Permission denied'));

      const result = await templateService.validateTemplatePath('/mock/error');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Template validation error: Permission denied');
    });
  });

  describe('validateAllTemplatesForProject', () => {
    beforeEach(() => {
      mockPathResolver.getTemplatePaths.mockResolvedValue({
        bestTemplatePath: '/mock/templates',
        agentRequirements: { path: '/mock/agent' }
      });
    });

    test('should validate all templates for standard project', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1.vsp']);

      const projectData = {
        rfaType: 'BOM',
        agentNumber: '1234'
      };

      const result = await templateService.validateAllTemplatesForProject(projectData);

      expect(result.success).toBe(true);
      expect(result.rfaType).toBe('BOM');
      expect(result.validations.main).toBeDefined();
      expect(result.validations.agent).toBeDefined();
    });

    test('should validate LCD template for RELEASE projects', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1.vsp']);

      const projectData = {
        rfaType: 'RELEASE'
      };

      const result = await templateService.validateAllTemplatesForProject(projectData);

      expect(result.success).toBe(true);
      expect(result.validations.lcd).toBeDefined();
    });

    test('should handle validation errors gracefully', async () => {
      fs.pathExists.mockResolvedValue(false);

      const projectData = {
        rfaType: 'BOM'
      };

      const result = await templateService.validateAllTemplatesForProject(projectData);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateLCDTemplate', () => {
    test('should validate LCD template successfully', async () => {
      mockPathResolver.getTemplatePaths.mockResolvedValue({
        bestTemplatePath: '/mock/templates'
      });

      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => true });
      fs.readdir.mockResolvedValue(['file1.vsp']);

      const projectData = {};

      const result = await templateService.validateLCDTemplate(projectData);

      expect(result.success).toBe(true);
      expect(result.path).toContain('LCD');
      expect(result.name).toBe('LCD');
    });

    test('should handle missing LCD template', async () => {
      mockPathResolver.getTemplatePaths.mockResolvedValue({
        bestTemplatePath: '/mock/templates'
      });

      fs.pathExists.mockResolvedValue(false);

      const projectData = {};

      const result = await templateService.validateLCDTemplate(projectData);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Cache management', () => {
    test('should clear cache', () => {
      templateService.templateCache.set('test', { result: {}, timestamp: Date.now() });
      expect(templateService.templateCache.size).toBe(1);

      templateService.clearCache();
      expect(templateService.templateCache.size).toBe(0);
    });

    test('should provide cache statistics', () => {
      const now = Date.now();
      templateService.templateCache.set('test1', { result: {}, timestamp: now });
      templateService.templateCache.set('test2', { result: {}, timestamp: now - 10 * 60 * 1000 }); // Expired

      const stats = templateService.getCacheStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.validEntries).toBe(1);
      expect(stats.expiredEntries).toBe(1);
    });
  });

  describe('Error handling', () => {
    test('should handle path resolver errors', async () => {
      templateService.getPathResolver.mockRejectedValue(new Error('Path resolver error'));

      const result = await templateService.validateTemplateForRFAType('BOM', {});

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Template validation failed: Path resolver error');
    });

    test('should handle file system errors in comprehensive validation', async () => {
      templateService.getPathResolver.mockRejectedValue(new Error('File system error'));

      const projectData = {
        rfaType: 'BOM'
      };

      const result = await templateService.validateAllTemplatesForProject(projectData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Comprehensive validation failed: File system error');
    });
  });
});
