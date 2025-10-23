const TemplateValidationService = require('./TemplateValidationService');
const ProjectExistenceService = require('./ProjectExistenceService');
const RevisionDetectionService = require('./RevisionDetectionService');
const RFATypeMappingService = require('./RFATypeMappingService');

/**
 * ValidationOrchestrator - Central service to coordinate all validation services
 * 
 * This service handles:
 * - Orchestrating all Phase 1 validation services
 * - Managing validation pipeline execution order
 * - Providing unified validation results
 * - Error handling and rollback for validation failures
 * - Performance monitoring and logging
 */
class ValidationOrchestrator {
  constructor() {
    // Initialize validation services
    this.templateValidation = new TemplateValidationService();
    this.projectExistence = new ProjectExistenceService();
    this.revisionDetection = new RevisionDetectionService();
    this.rfaMapping = new RFATypeMappingService();
    
    // Validation pipeline configuration
    this.validationPipeline = [
      {
        name: 'template_validation',
        service: 'templateValidation',
        method: 'validateAllTemplatesForProject',
        required: true,
        parallel: false
      },
      {
        name: 'project_existence',
        service: 'projectExistence',
        method: 'checkProjectExistence',
        required: true,
        parallel: false
      },
      {
        name: 'revision_detection',
        service: 'revisionDetection',
        method: 'detectRevision',
        required: true,
        parallel: false
      }
    ];

    // Performance monitoring
    this.performanceMetrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0,
      validationTimes: []
    };

    // Error handling configuration
    this.errorHandling = {
      maxRetries: 2,
      retryDelay: 1000, // 1 second
      failFast: false, // Continue validation even if some steps fail
      rollbackOnFailure: true
    };
  }

  /**
   * Execute complete validation pipeline for project creation
   * @param {Object} projectData - Project data to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Comprehensive validation result
   */
  async validateProjectCreation(projectData, options = {}) {
    const startTime = Date.now();
    const validationId = this.generateValidationId();
    
    // Convert form data to internal format for validation
    const internalProjectData = this.rfaMapping.convertFormDataToInternal(projectData);
    
    console.log(`ValidationOrchestrator: Starting validation pipeline ${validationId} for project: ${internalProjectData.projectName}`);

    const result = {
      validationId: validationId,
      success: false,
      projectData: internalProjectData,
      originalProjectData: projectData, // Keep original for display
      pipelineResults: {},
      overallResult: null,
      recommendations: [],
      errors: [],
      warnings: [],
      performance: {
        startTime: startTime,
        endTime: null,
        totalTime: 0,
        stepTimes: {}
      },
      rollbackRequired: false
    };

    try {
      // Execute validation pipeline with internal data
      const pipelineResults = await this.executeValidationPipeline(internalProjectData, options);
      result.pipelineResults = pipelineResults;

      // Analyze overall results
      const analysis = this.analyzeValidationResults(pipelineResults);
      result.overallResult = analysis;
      result.success = analysis.overallSuccess;
      result.recommendations = analysis.recommendations;
      result.errors = analysis.errors;
      result.warnings = analysis.warnings;

      // Update performance metrics
      const endTime = Date.now();
      result.performance.endTime = endTime;
      result.performance.totalTime = endTime - startTime;
      
      this.updatePerformanceMetrics(result.performance.totalTime, result.success);

      console.log(`ValidationOrchestrator: Validation pipeline ${validationId} completed in ${result.performance.totalTime}ms`);

      return result;

    } catch (error) {
      console.error(`ValidationOrchestrator: Validation pipeline ${validationId} failed:`, error);
      
      result.success = false;
      result.errors.push(`Validation pipeline failed: ${error.message}`);
      result.performance.endTime = Date.now();
      result.performance.totalTime = result.performance.endTime - startTime;
      
      this.updatePerformanceMetrics(result.performance.totalTime, false);

      // Attempt rollback if configured
      if (this.errorHandling.rollbackOnFailure) {
        await this.performRollback(projectData, result);
        result.rollbackRequired = true;
      }

      return result;
    }
  }

  /**
   * Execute validation pipeline steps
   */
  async executeValidationPipeline(projectData, options) {
    const results = {};
    const stepTimes = {};

    for (const step of this.validationPipeline) {
      const stepStartTime = Date.now();
      
      try {
        console.log(`ValidationOrchestrator: Executing step: ${step.name}`);
        
        const service = this[step.service];
        const method = service[step.method];
        
        if (!method) {
          throw new Error(`Method ${step.method} not found on service ${step.service}`);
        }

        // Execute validation step
        const stepResult = await method.call(service, projectData, options.useCache !== false);
        results[step.name] = stepResult;
        
        const stepEndTime = Date.now();
        stepTimes[step.name] = stepEndTime - stepStartTime;
        
        console.log(`ValidationOrchestrator: Step ${step.name} completed in ${stepTimes[step.name]}ms`);

        // Check if step failed and we should fail fast
        if (!stepResult.success && this.errorHandling.failFast) {
          throw new Error(`Validation step ${step.name} failed: ${stepResult.errors?.join(', ') || 'Unknown error'}`);
        }

      } catch (error) {
        console.error(`ValidationOrchestrator: Step ${step.name} failed:`, error);
        
        const stepEndTime = Date.now();
        stepTimes[step.name] = stepEndTime - stepStartTime;
        
        results[step.name] = {
          success: false,
          error: error.message,
          errors: [error.message],
          warnings: []
        };

        // If step is required and failed, throw error
        if (step.required) {
          throw error;
        }
      }
    }

    return {
      steps: results,
      stepTimes: stepTimes,
      pipelineSuccess: Object.values(results).every(step => step.success)
    };
  }

  /**
   * Analyze validation results and generate overall assessment
   */
  analyzeValidationResults(pipelineResults) {
    const analysis = {
      overallSuccess: true,
      criticalIssues: [],
      warnings: [],
      recommendations: [],
      errors: [],
      summary: {}
    };

    // Analyze each pipeline step
    for (const [stepName, stepResult] of Object.entries(pipelineResults.steps)) {
      if (!stepResult.success) {
        analysis.overallSuccess = false;
        analysis.criticalIssues.push(`${stepName}: ${stepResult.errors?.join(', ') || 'Unknown error'}`);
      }

      // Collect errors and warnings
      if (stepResult.errors) {
        analysis.errors.push(...stepResult.errors.map(error => `${stepName}: ${error}`));
      }
      if (stepResult.warnings) {
        analysis.warnings.push(...stepResult.warnings.map(warning => `${stepName}: ${warning}`));
      }
      if (stepResult.recommendations) {
        analysis.recommendations.push(...stepResult.recommendations.map(rec => ({
          ...rec,
          source: stepName
        })));
      }

      // Generate step summary
      analysis.summary[stepName] = {
        success: stepResult.success,
        hasErrors: stepResult.errors && stepResult.errors.length > 0,
        hasWarnings: stepResult.warnings && stepResult.warnings.length > 0,
        hasRecommendations: stepResult.recommendations && stepResult.recommendations.length > 0
      };
    }

    // Generate overall recommendations based on analysis
    analysis.recommendations.push(...this.generateOverallRecommendations(analysis));

    return analysis;
  }

  /**
   * Generate overall recommendations based on validation analysis
   */
  generateOverallRecommendations(analysis) {
    const recommendations = [];

    // Template validation recommendations
    if (analysis.summary.template_validation && !analysis.summary.template_validation.success) {
      recommendations.push({
        type: 'error',
        message: 'Template validation failed. Please check template availability and paths.',
        action: 'fix_template_issues',
        priority: 'critical'
      });
    }

    // Project existence recommendations
    if (analysis.summary.project_existence && analysis.summary.project_existence.hasWarnings) {
      recommendations.push({
        type: 'warning',
        message: 'Project existence check found potential issues. Review server connectivity.',
        action: 'check_server_connectivity',
        priority: 'medium'
      });
    }

    // Revision detection recommendations
    if (analysis.summary.revision_detection && analysis.summary.revision_detection.hasRecommendations) {
      recommendations.push({
        type: 'info',
        message: 'Revision detection found existing projects. Consider revision workflow.',
        action: 'consider_revision_workflow',
        priority: 'low'
      });
    }

    return recommendations;
  }

  /**
   * Perform rollback operations if validation fails
   */
  async performRollback(projectData, validationResult) {
    console.log('ValidationOrchestrator: Performing rollback operations');
    
    const rollbackResults = {
      success: true,
      operations: [],
      errors: []
    };

    try {
      // Clear any caches that might have been populated
      this.templateValidation.clearCache();
      this.projectExistence.clearCache();
      this.revisionDetection.clearCache();
      
      rollbackResults.operations.push('Cleared validation caches');

      // Additional rollback operations can be added here
      // For example, cleaning up any temporary files or folders created during validation

      console.log('ValidationOrchestrator: Rollback completed successfully');

    } catch (error) {
      console.error('ValidationOrchestrator: Rollback failed:', error);
      rollbackResults.success = false;
      rollbackResults.errors.push(error.message);
    }

    return rollbackResults;
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(validationTime, success) {
    this.performanceMetrics.totalValidations++;
    
    if (success) {
      this.performanceMetrics.successfulValidations++;
    } else {
      this.performanceMetrics.failedValidations++;
    }

    this.performanceMetrics.validationTimes.push(validationTime);
    
    // Keep only last 100 validation times for rolling average
    if (this.performanceMetrics.validationTimes.length > 100) {
      this.performanceMetrics.validationTimes = this.performanceMetrics.validationTimes.slice(-100);
    }

    // Calculate rolling average
    const totalTime = this.performanceMetrics.validationTimes.reduce((sum, time) => sum + time, 0);
    this.performanceMetrics.averageValidationTime = totalTime / this.performanceMetrics.validationTimes.length;
  }

  /**
   * Generate unique validation ID
   */
  generateValidationId() {
    return `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      successRate: this.performanceMetrics.totalValidations > 0 
        ? (this.performanceMetrics.successfulValidations / this.performanceMetrics.totalValidations) * 100 
        : 0
    };
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics() {
    this.performanceMetrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0,
      validationTimes: []
    };
  }

  /**
   * Validate specific project data field
   */
  async validateField(fieldName, value, projectData = {}) {
    const fieldValidation = {
      fieldName: fieldName,
      value: value,
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    try {
      switch (fieldName) {
        case 'rfaNumber':
          const rfaValidation = this.revisionDetection.validateRFAFormat(value);
          fieldValidation.isValid = rfaValidation.isValid;
          fieldValidation.errors = rfaValidation.rfaInfo.parseError ? [rfaValidation.rfaInfo.parseError] : [];
          fieldValidation.suggestions = rfaValidation.suggestions;
          break;

        case 'projectName':
          if (!value || value.trim().length < 3) {
            fieldValidation.isValid = false;
            fieldValidation.errors.push('Project name must be at least 3 characters long');
          }
          break;

        case 'projectContainer':
          if (!value || !/^\d{2}-\d{5}$/.test(value)) {
            fieldValidation.isValid = false;
            fieldValidation.errors.push('Project container must be in format YY-XXXXX');
          }
          break;

        case 'agentNumber':
          if (!value || !/^\d+$/.test(value)) {
            fieldValidation.isValid = false;
            fieldValidation.errors.push('Agent number must be numeric');
          }
          break;

        default:
          fieldValidation.warnings.push(`No specific validation for field: ${fieldName}`);
      }

    } catch (error) {
      fieldValidation.isValid = false;
      fieldValidation.errors.push(`Field validation error: ${error.message}`);
    }

    return fieldValidation;
  }

  /**
   * Get validation service status
   */
  getServiceStatus() {
    return {
      templateValidation: {
        cacheStats: this.templateValidation.getCacheStats(),
        available: true
      },
      projectExistence: {
        cacheStats: this.projectExistence.getCacheStats(),
        available: true
      },
      revisionDetection: {
        cacheStats: this.revisionDetection.getCacheStats(),
        available: true
      }
    };
  }

  /**
   * Clear all validation caches
   */
  clearAllCaches() {
    this.templateValidation.clearCache();
    this.projectExistence.clearCache();
    this.revisionDetection.clearCache();
    console.log('ValidationOrchestrator: All caches cleared');
  }
}

module.exports = ValidationOrchestrator;
