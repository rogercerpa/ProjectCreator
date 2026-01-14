const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { app } = require('electron');
const PathResolutionService = require('./PathResolutionService');
const ValidationOrchestrator = require('./ValidationOrchestrator');
const RFATypeMappingService = require('./RFATypeMappingService');
const RevisionDetectionService = require('./RevisionDetectionService');
const RevisionFileCopyService = require('./RevisionFileCopyService');
const { 
  sanitizeForFilename, 
  sanitizeProjectName: sanitizeProjectNameUtil, 
  sanitizeRfaType,
  buildRfaFolderName,
  buildVspFilename 
} = require('../utils/fileUtils');

class ProjectCreationService {
  constructor() {
    // Initialize the path resolution service for centralized path management
    this.pathResolver = new PathResolutionService();
    
    // Initialize validation orchestrator for comprehensive validation
    this.validationOrchestrator = new ValidationOrchestrator();
    
    // Initialize mapping service for label/value conversion
    this.rfaMapping = new RFATypeMappingService();
    
    // Initialize revision services
    this.revisionDetectionService = new RevisionDetectionService();
    this.revisionFileCopyService = new RevisionFileCopyService();
    
    // Keep legacy template paths for backward compatibility
    this.templatePaths = {
      master: '\\\\10.3.10.30\\DAS\\DAS References\\!!!Templates For Project Creator',
      desktop: path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop', '1) Triage', '!!!Templates For Project Creator'),
      controls: '\\\\10.3.10.30\\DAS\\DAS References\\!!!Templates For Project Creator\\RFA#_TYPE_MMDDYYYY',
      reloc: '\\\\10.3.10.30\\DAS\\DAS References\\!!!Templates For Project Creator\\RELOC-RFA#_TYPE_MMDDYYYY',
      photometrics: '\\\\10.3.10.30\\DAS\\DAS References\\!!!Templates For Project Creator\\PHOTOMETRICS-RFA#_TYPE_MMDDYYYY',
      lcd: '\\\\10.3.10.30\\DAS\\DAS References\\!!!Templates For Project Creator\\LCD',
      agentRequirements: '\\\\10.3.10.30\\DAS\\Agent Requirements'
    };
  }

  /**
   * Create a new project with all necessary folders and files
   */
  async createProject(projectData) {
    try {
      console.log('Starting project creation:', projectData);

      // Convert form data to internal format
      const internalProjectData = this.rfaMapping.convertFormDataToInternal(projectData);

      // Validate required fields using internal data
      if (!this.validateProjectData(internalProjectData)) {
        throw new Error('Invalid project data');
      }

      // Sanitize project name
      const sanitizedProjectName = this.sanitizeProjectName(internalProjectData.projectName);
      const firstLetter = this.getFirstLetter(sanitizedProjectName);
      
      // Determine save location and paths
      const paths = this.determineProjectPaths(internalProjectData, sanitizedProjectName, firstLetter);
      
      // Create project structure
      const projectFolder = await this.createProjectStructure(projectData, paths, sanitizedProjectName, firstLetter);
      
      // Copy templates based on RFA type
      await this.copyProjectTemplates(projectData, projectFolder, paths);
      
      // Create shortcuts if needed
      await this.createProjectShortcuts(projectData, paths, projectFolder, firstLetter);
      
      // Open project folder
      await this.openProjectFolder(projectFolder, projectData);
      
      console.log('Project created successfully:', projectFolder);
      return { success: true, projectFolder };
      
    } catch (error) {
      console.error('Project creation failed:', error);
      throw error;
    }
  }

  /**
   * Create project with folders - Enhanced method for wizard integration
   * This method creates physical folder structure like the HTA tool
   * NOW USES PathResolutionService for configurable paths
   */
  async createProjectWithFolders(projectData) {
    try {
      console.log('Starting project creation with folders (using PathResolutionService):', projectData);

      // Convert form data to internal format for validation and processing
      const internalProjectData = this.rfaMapping.convertFormDataToInternal(projectData);
      console.log('Converted to internal format:', internalProjectData);

      // ENHANCED: Run comprehensive validation using ValidationOrchestrator
      console.log('Running comprehensive validation...');
      const validationResult = await this.validationOrchestrator.validateProjectCreation(projectData);
      
      if (!validationResult.success) {
        console.error('Validation failed:', validationResult.errors);
        return {
          success: false,
          error: `Validation failed: ${validationResult.errors.join(', ')}`,
          validationResult: validationResult
        };
      }

      // Log validation warnings if any
      if (validationResult.warnings && validationResult.warnings.length > 0) {
        console.warn('Validation warnings:', validationResult.warnings);
      }

      // Log validation recommendations
      if (validationResult.recommendations && validationResult.recommendations.length > 0) {
        console.log('Validation recommendations:', validationResult.recommendations);
      }

      // Validate required fields using internal data
      if (!this.validateProjectData(internalProjectData)) {
        throw new Error('Invalid project data');
      }

      // Sanitize project name (like HTA: remove \, /, :, _ and convert to uppercase)
      const sanitizedProjectName = this.sanitizeProjectName(internalProjectData.projectName);
      const firstLetter = this.getFirstLetter(sanitizedProjectName);
      
      // Create date string in MMDDYYYY format (like HTA)
      const currentDate = new Date();
      const dateString = `${String(currentDate.getMonth() + 1).padStart(2, '0')}${String(currentDate.getDate()).padStart(2, '0')}${currentDate.getFullYear()}`;
      
      // ENHANCED: Use PathResolutionService to resolve all paths from settings
      const resolvedPaths = await this.pathResolver.resolveAllProjectPaths(internalProjectData);
      console.log('PathResolutionService resolved paths:', resolvedPaths);
      
      // Use the resolved output path instead of hardcoded desktop
      const outputBasePath = resolvedPaths.output.finalPath;
      await this.pathResolver.ensureDirectoryExists(outputBasePath);
      
      // Create main project folder: {ProjectName}_{ProjectContainer}
      const projectFolderName = `${sanitizedProjectName}_${sanitizeForFilename(projectData.projectContainer)}`;
      const projectFolderPath = path.join(outputBasePath, projectFolderName);
      
      // Create RFA subfolder: RFA#{RFANumber}_{RFAType}_{MMDDYYYY}
      // Sanitize rfaType to remove parentheses and other invalid characters
      const sanitizedRfaTypeForFolder = sanitizeRfaType(projectData.rfaType);
      const rfaFolderName = `RFA#${sanitizeForFilename(projectData.rfaNumber)}_${sanitizedRfaTypeForFolder}_${dateString}`;
      const rfaFolderPath = path.join(projectFolderPath, rfaFolderName);
      
      // Agent Files path for opening
      const agentFilesPath = path.join(rfaFolderPath, '!Agent Files');
      
      // Create folder structure
      await fs.ensureDir(projectFolderPath);
      await fs.ensureDir(rfaFolderPath);
      await fs.ensureDir(agentFilesPath);
      await fs.ensureDir(path.join(rfaFolderPath, '!!Request Output'));
      
      // Copy and process templates based on RFA type (using resolved paths)
      await this.copyAndProcessTemplatesWithResolver(projectData, rfaFolderPath, dateString, sanitizedProjectName, resolvedPaths);
      
      // Copy BOM CHECK folder from master template (using resolved paths)
      await this.copyBOMCheckFolderWithResolver(rfaFolderPath, resolvedPaths);
      
      // Copy agent-specific files (using resolved paths)
      await this.copyAgentSpecificFilesWithResolver(projectData, rfaFolderPath, dateString, sanitizedProjectName, resolvedPaths);
      
      // Process documents (Design Notes and Assumptions)
      await this.processProjectDocuments(projectData, rfaFolderPath);
      
      // Open the !Agent Files folder (like HTA)
      await this.openAgentFilesFolder(agentFilesPath);
      
      console.log('Project with folders created successfully:', {
        projectPath: projectFolderPath,
        rfaPath: rfaFolderPath,
        agentFilesPath,
        usedTemplatePath: resolvedPaths.templates.bestTemplatePath,
        usedOutputPath: outputBasePath
      });
      
      return { 
        success: true, 
        projectPath: projectFolderPath,
        rfaPath: rfaFolderPath,
        agentFilesPath: agentFilesPath,
        resolvedPaths: resolvedPaths, // Include resolved path info for debugging
        validationResult: validationResult, // Include validation results
        message: 'Project folder created successfully using configurable paths and comprehensive validation'
      };
      
    } catch (error) {
      console.error('Project creation with folders failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate project data before creation
   */
  validateProjectData(projectData) {
    const required = ['projectName', 'projectContainer', 'rfaNumber', 'rfaType', 'agentNumber'];
    return required.every(field => projectData[field] && projectData[field].trim() !== '');
  }

  /**
   * Sanitize project name (remove invalid characters, convert to uppercase)
   * Uses centralized utility for consistent sanitization across the app
   */
  sanitizeProjectName(projectName) {
    return sanitizeProjectNameUtil(projectName);
  }

  /**
   * Get first letter for folder organization
   */
  getFirstLetter(projectName) {
    const first = projectName.charAt(0);
    return /[A-Z]/.test(first) ? first : '#';
  }

  /**
   * Determine project paths based on regional team and save location
   */
  determineProjectPaths(projectData, projectName, firstLetter) {
    const currentYear = new Date().getFullYear();
    const projectYear = parseInt('20' + projectData.projectContainer.substring(0, 2));
    const yearDiff = projectYear - currentYear;
    
    let baseSave, masterTemplate, currentYearFolder, prevYearFolder, secYearFolder;
    
    if (projectData.regionalTeam === 'Desktop Emergency Use only') {
      // Desktop emergency use
      baseSave = path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop');
      masterTemplate = this.templatePaths.desktop;
      currentYearFolder = path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop');
      prevYearFolder = path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop');
      secYearFolder = path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop');
    } else {
      // Server-based
      masterTemplate = this.templatePaths.master;
      currentYearFolder = `\\\\10.3.10.30\\DAS\\${currentYear} Projects`;
      prevYearFolder = `\\\\10.3.10.30\\DAS\\${currentYear - 1} Projects`;
      secYearFolder = `\\\\10.3.10.30\\DAS\\${currentYear - 2} Projects`;
      
      // Determine base save location
      if (projectData.saveLocation === 'Server') {
        if (yearDiff === -1) {
          baseSave = path.join(prevYearFolder, firstLetter);
        } else if (yearDiff === -2) {
          baseSave = path.join(secYearFolder, firstLetter);
        } else {
          baseSave = path.join(currentYearFolder, firstLetter);
        }
        
        // Add national account subfolder if specified
        if (projectData.nationalAccount && projectData.nationalAccount !== 'N/A') {
          baseSave = path.join(baseSave, projectData.nationalAccount);
        }
      } else if (projectData.saveLocation === 'Triage') {
        baseSave = path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop', '1) Triage');
      } else {
        baseSave = path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop');
      }
    }

    return {
      baseSave,
      masterTemplate,
      currentYearFolder,
      prevYearFolder,
      secYearFolder,
      projectYear,
      yearDiff
    };
  }

  /**
   * Create the main project folder structure
   */
  async createProjectStructure(projectData, paths, projectName, firstLetter) {
    const projectFolder = path.join(paths.baseSave, `${projectName}_${sanitizeForFilename(projectData.projectContainer)}`);
    
    // Create main project folder
    await fs.ensureDir(projectFolder);
    
    // Create RFA subfolder with date
    const currentDate = new Date();
    const dateString = `${String(currentDate.getMonth() + 1).padStart(2, '0')}${String(currentDate.getDate()).padStart(2, '0')}${currentDate.getFullYear()}`;
    // Sanitize rfaType to remove parentheses and other invalid characters
    const sanitizedRfaTypeForFolder = sanitizeRfaType(projectData.rfaType);
    const rfaFolder = path.join(projectFolder, `RFA#${sanitizeForFilename(projectData.rfaNumber)}_${sanitizedRfaTypeForFolder}_${dateString}`);
    
    await fs.ensureDir(rfaFolder);
    await fs.ensureDir(path.join(rfaFolder, '!Agent Files'));
    await fs.ensureDir(path.join(rfaFolder, '!!Request Output'));
    
    return { projectFolder, rfaFolder, dateString };
  }

  /**
   * Copy project templates based on RFA type
   */
  async copyProjectTemplates(projectData, projectStructure, paths) {
    const { rfaFolder } = projectStructure;
    // Sanitize rfaType to remove parentheses and other invalid characters
    const sanitizedRfaTypeValue = sanitizeRfaType(projectData.rfaType);
    
    try {
      // Handle different RFA types
      if (projectData.rfaType.includes('Reloc')) {
        // Relocation projects
        const relocTemplate = this.templatePaths.reloc;
        if (await fs.pathExists(relocTemplate)) {
          await fs.copy(relocTemplate, rfaFolder);
          // Rename the template folder
          const templateFolderName = path.basename(relocTemplate);
          // Use "Reloc Portion" without parentheses for Controls projects
          const newFolderName = `RFA#${sanitizeForFilename(projectData.rfaNumber)}_${projectData.rfaType.includes('Controls') ? 'Reloc Portion ' : ''}${sanitizedRfaTypeValue}_${projectStructure.dateString}`;
          await fs.move(path.join(rfaFolder, templateFolderName), path.join(rfaFolder, newFolderName));
        }
      } else if (projectData.rfaType === 'PHOTOMETRICS') {
        // Photometrics projects
        const photoTemplate = this.templatePaths.photometrics;
        if (await fs.pathExists(photoTemplate)) {
          await fs.copy(photoTemplate, rfaFolder);
          const templateFolderName = path.basename(photoTemplate);
          const newFolderName = `RFA#${sanitizeForFilename(projectData.rfaNumber)}_${sanitizedRfaTypeValue}_${projectStructure.dateString}`;
          await fs.move(path.join(rfaFolder, templateFolderName), path.join(rfaFolder, newFolderName));
        }
      } else {
        // Standard control projects
        const controlsTemplate = this.templatePaths.controls;
        if (await fs.pathExists(controlsTemplate)) {
          await fs.copy(controlsTemplate, rfaFolder);
          const templateFolderName = path.basename(controlsTemplate);
          const newFolderName = `RFA#${sanitizeForFilename(projectData.rfaNumber)}_${sanitizedRfaTypeValue}_${projectStructure.dateString}`;
          await fs.move(path.join(rfaFolder, templateFolderName), path.join(rfaFolder, newFolderName));
        }
      }

      // Copy BOM CHECK folder
      const bomCheckPath = path.join(paths.masterTemplate, 'BOM CHECK');
      if (await fs.pathExists(bomCheckPath)) {
        await fs.copy(bomCheckPath, rfaFolder);
      }

      // Copy agent-specific files
      await this.copyAgentSpecificFiles(projectData, rfaFolder, projectStructure.dateString);
      
      // Copy LCD preprogramming files if needed
      if (projectData.rfaType === 'RELEASE') {
        await this.copyLCDFiles(rfaFolder);
      }

    } catch (error) {
      console.error('Error copying templates:', error);
      throw new Error(`Failed to copy project templates: ${error.message}`);
    }
  }

  /**
   * Copy and process templates based on RFA type (like HTA)
   */
  async copyAndProcessTemplates(projectData, rfaFolderPath, dateString, sanitizedProjectName) {
    try {
      const rfaType = projectData.rfaType;
      // Sanitize rfaType to remove parentheses and other invalid characters
      const sanitizedRfaTypeValue = sanitizeRfaType(rfaType);
      let templatePath, templateFolderName, newFolderName;

      // Determine template based on RFA type (exactly like HTA)
      if (rfaType.includes('Reloc')) {
        // Relocation projects
        templatePath = this.templatePaths.reloc;
        templateFolderName = 'RELOC-RFA#_TYPE_MMDDYYYY';
        if (rfaType.includes('Controls')) {
          // Use "Reloc Portion" without parentheses
          newFolderName = `RFA#${sanitizeForFilename(projectData.rfaNumber)}_Reloc Portion ${sanitizedRfaTypeValue}_${dateString}`;
        } else {
          newFolderName = `RFA#${sanitizeForFilename(projectData.rfaNumber)}_${sanitizedRfaTypeValue}_${dateString}`;
        }
      } else if (rfaType === 'PHOTOMETRICS') {
        // Photometrics projects
        templatePath = this.templatePaths.photometrics;
        templateFolderName = 'PHOTOMETRICS-RFA#_TYPE_MMDDYYYY';
        newFolderName = `RFA#${sanitizeForFilename(projectData.rfaNumber)}_${sanitizedRfaTypeValue}_${dateString}`;
      } else {
        // Standard controls projects
        templatePath = this.templatePaths.controls;
        templateFolderName = 'RFA#_TYPE_MMDDYYYY';
        newFolderName = `RFA#${sanitizeForFilename(projectData.rfaNumber)}_${sanitizedRfaTypeValue}_${dateString}`;
      }

      // Check if template exists
      if (await fs.pathExists(templatePath)) {
        // Copy the contents of the template folder directly into rfaFolderPath
        // This prevents creating nested folder structure
        await fs.copy(templatePath, rfaFolderPath);
        console.log(`Template contents copied from ${templatePath} to ${rfaFolderPath}`);
        
        // Process files inside the RFA folder (no need to rename folders since we copied contents directly)
        await this.processTemplateFiles(rfaFolderPath, projectData, dateString, sanitizedProjectName);
      } else {
        console.warn(`Template not found: ${templatePath}`);
      }
    } catch (error) {
      console.error('Error copying and processing templates:', error);
      throw error;
    }
  }

  /**
   * Process template files (rename .vsp and .vsl files like HTA)
   */
  async processTemplateFiles(templateFolder, projectData, dateString, sanitizedProjectName) {
    try {
      const files = await fs.readdir(templateFolder);
      // Sanitize rfaType to remove parentheses and other invalid characters
      const sanitizedRfaTypeValue = sanitizeRfaType(projectData.rfaType);
      
      for (const file of files) {
        const filePath = path.join(templateFolder, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          const ext = path.extname(file).toLowerCase();
          
          if (ext === '.vsp') {
            // Rename .vsp files like HTA: ABC_{ProjectName}_{RFAType} ORIG_{DateString}.vsp
            // Use sanitized rfaType to avoid parentheses in filename
            const newFileName = `ABC_${sanitizedProjectName}_${sanitizedRfaTypeValue} ORIG_${dateString}.vsp`;
            const newFilePath = path.join(templateFolder, newFileName);
            await fs.move(filePath, newFilePath);
            break; // Only rename the first .vsp file found
          } else if (ext === '.vsl') {
            // Rename .vsl files like HTA: {RFANumber} A1.vsl
            const newFileName = `${sanitizeForFilename(projectData.rfaNumber)} A1.vsl`;
            const newFilePath = path.join(templateFolder, newFileName);
            await fs.move(filePath, newFilePath);
            break; // Only rename the first .vsl file found
          }
        }
      }
    } catch (error) {
      console.error('Error processing template files:', error);
      // Don't fail the entire process for file renaming issues
    }
  }

  /**
   * Copy BOM CHECK folder from master template
   */
  async copyBOMCheckFolder(rfaFolderPath) {
    try {
      const bomCheckPath = path.join(this.templatePaths.master, 'BOM CHECK');
      if (await fs.pathExists(bomCheckPath)) {
        const destPath = path.join(rfaFolderPath, 'BOM CHECK');
        await fs.copy(bomCheckPath, destPath);
      }
    } catch (error) {
      console.error('Error copying BOM CHECK folder:', error);
      // Don't fail the entire process for BOM CHECK issues
    }
  }

  /**
   * Process project documents (Design Notes and Assumptions like HTA)
   */
  async processProjectDocuments(projectData, rfaFolderPath) {
    try {
      // This would integrate with WordService to process documents
      // For now, we'll just log that this step would happen
      console.log('Document processing would happen here for:', rfaFolderPath);
      
      // TODO: Integrate with WordService to:
      // 1. Find Design Notes and Assumptions.docx
      // 2. Insert agent requirements
      // 3. Replace project placeholders
    } catch (error) {
      console.error('Error processing documents:', error);
      // Don't fail the entire process for document issues
    }
  }

  /**
   * Open the !Agent Files folder (like HTA)
   */
  async openAgentFilesFolder(agentFilesPath) {
    try {
      // Open folder using system command
      const command = process.platform === 'win32' ? `explorer "${agentFilesPath}"` : `open "${agentFilesPath}"`;
      exec(command, (error) => {
        if (error) {
          console.error('Error opening Agent Files folder:', error);
        }
      });
    } catch (error) {
      console.error('Error opening Agent Files folder:', error);
    }
  }

  /**
   * Copy agent-specific files
   */
  async copyAgentSpecificFiles(projectData, rfaFolder, dateString, sanitizedProjectName) {
    try {
      const agentNumber = projectData.agentNumber;
      // Sanitize rfaType to remove parentheses and other invalid characters
      const sanitizedRfaTypeValue = sanitizeRfaType(projectData.rfaType);
      
      // Copy metric template for specific agents
      const metricAgents = ['563', '584', '903', '904', '905', '906', '909', '912', '915', '926', '968'];
      if (metricAgents.includes(agentNumber)) {
        const metricTemplate = path.join(this.templatePaths.master, '(Metric).vsp');
        if (await fs.pathExists(metricTemplate)) {
          // Use "Metric" without parentheses in the destination filename
          const destPath = path.join(rfaFolder, `ABC_${sanitizedProjectName}_${sanitizedRfaTypeValue} ORIG_${dateString} Metric.vsp`);
          await fs.copy(metricTemplate, destPath);
        }
      }

      // Copy Holophane template for 4-digit agents
      if (agentNumber.length === 4) {
        const holophaneTemplate = path.join(this.templatePaths.agentRequirements, 'Holophane.vsp');
        if (await fs.pathExists(holophaneTemplate)) {
          const destPath = path.join(rfaFolder, `ABC_${sanitizedProjectName}_${sanitizedRfaTypeValue} ORIG_${dateString}.vsp`);
          await fs.copy(holophaneTemplate, destPath);
        }
      }

      // Copy agent-specific template
      const agentTemplate = path.join(this.templatePaths.agentRequirements, `${sanitizeForFilename(agentNumber)}.vsp`);
      if (await fs.pathExists(agentTemplate)) {
        const destPath = path.join(rfaFolder, `ABC_${sanitizedProjectName}_${sanitizedRfaTypeValue} ORIG_${dateString}.vsp`);
        await fs.copy(agentTemplate, destPath);
      }

    } catch (error) {
      console.error('Error copying agent files:', error);
      // Don't fail the entire project creation for agent file issues
    }
  }

  /**
   * Copy LCD preprogramming files
   */
  async copyLCDFiles(rfaFolder) {
    try {
      if (await fs.pathExists(this.templatePaths.lcd)) {
        await fs.copy(this.templatePaths.lcd, rfaFolder);
      }
    } catch (error) {
      console.error('Error copying LCD files:', error);
      // Don't fail the entire project creation for LCD file issues
    }
  }

  /**
   * Create project shortcuts
   */
  async createProjectShortcuts(projectData, paths, projectStructure, firstLetter) {
    try {
      if (projectData.saveLocation === 'Server' && paths.yearDiff !== 0) {
        const shortcutPath = path.join(paths.currentYearFolder, firstLetter, `${projectData.projectName}_${projectData.projectContainer}.lnk`);
        
        // Create shortcut using Windows command
        const targetPath = projectStructure.projectFolder;
        const command = `powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('${shortcutPath}'); $Shortcut.TargetPath = '${targetPath}'; $Shortcut.Description = 'Shortcut to project'; $Shortcut.Save()"`;
        
        exec(command, (error) => {
          if (error) {
            console.error('Error creating shortcut:', error);
          }
        });
      }
    } catch (error) {
      console.error('Error creating shortcuts:', error);
      // Don't fail the entire project creation for shortcut issues
    }
  }

  /**
   * Open the project folder
   */
  async openProjectFolder(projectStructure, projectData) {
    try {
      let folderToOpen = projectStructure.rfaFolder;
      
      if (projectData.rfaType === 'PHOTOMETRICS') {
        folderToOpen = projectStructure.rfaFolder;
      } else {
        folderToOpen = path.join(projectStructure.rfaFolder, '!Agent Files');
      }
      
      // Open folder using system command
      const command = process.platform === 'win32' ? `explorer "${folderToOpen}"` : `open "${folderToOpen}"`;
      exec(command, (error) => {
        if (error) {
          console.error('Error opening project folder:', error);
        }
      });
    } catch (error) {
      console.error('Error opening project folder:', error);
    }
  }

  /**
   * Export project data to DAS Board format
   */
  async exportToDASBoard(projectData) {
    try {
      // Determine RFA type tag
      let rfaTypeTag = 'S'; // Default to Submittal
      if (['BOM', 'LAYOUT'].includes(projectData.rfaType)) {
        rfaTypeTag = 'Q';
      } else if (projectData.rfaType === 'BUDGET') {
        rfaTypeTag = 'B';
      } else if (projectData.rfaType === 'GRAPHICS') {
        rfaTypeTag = 'G';
      } else if (projectData.rfaType.includes('Reloc')) {
        rfaTypeTag = 'R';
      } else if (projectData.numOfRooms || projectData.overrideRooms) {
        rfaTypeTag = 'Q+S';
      }

      // Determine complexity level
      let projectComplexity = 'E'; // Easy
      if (projectData.totalTriage >= 8) {
        projectComplexity = 'C'; // Complex
      } else if (projectData.totalTriage >= 4) {
        projectComplexity = 'M'; // Medium
      }

      // Create DAS Board project name
      const projectName = projectData.projectName.substring(0, 19);
      const revisionTag = projectData.isRevision ? 'R' : '';
      const dasProjectName = `${projectComplexity} - ${revisionTag}${rfaTypeTag} ${projectName}`;

      // Prepare data for clipboard
      const exportData = {
        rfaNumber: projectData.rfaNumber,
        agentNumber: projectData.agentNumber,
        projectName: dasProjectName,
        dueDate: projectData.dueDate || '',
        triageTime: projectData.totalTriage
      };

      return { success: true, data: exportData };
    } catch (error) {
      console.error('DAS Board export failed:', error);
      throw error;
    }
  }

  /**
   * Export project data to Agile format
   */
  async exportToAgile(projectData) {
    try {
      const exportData = [];
      
      // Add RFA type
      if (projectData.isRevision) {
        exportData.push({ type: 'Revision', value: projectData.rfaType });
      } else {
        exportData.push({ type: 'RFA Type', value: projectData.rfaType });
      }

      // Add layout information
      if (projectData.numOfRooms || projectData.overrideRooms) {
        if (projectData.overrideRooms) {
          exportData.push({ type: 'Layout', value: projectData.overrideRooms });
        } else {
          const layoutTime = (projectData.numOfRooms * projectData.roomMultiplier) / 60;
          exportData.push({ type: 'Number of Rooms', value: projectData.numOfRooms });
          exportData.push({ type: 'Layout', value: layoutTime });
        }
        exportData.push({ type: 'Review/Setup', value: projectData.reviewSetup });
        exportData.push({ type: 'Spec Review', value: projectData.specReview });
      }

      // Add submittal information
      if (projectData.numOfSubRooms || projectData.overrideSubRooms) {
        if (projectData.overrideSubRooms) {
          exportData.push({ type: 'Risers', value: projectData.overrideSubRooms });
        } else {
          const submittalTime = (projectData.numOfSubRooms * projectData.riserMultiplier) / 60;
          exportData.push({ type: 'Number of Rooms', value: projectData.numOfSubRooms });
          exportData.push({ type: 'Risers', value: submittalTime });
        }
        exportData.push({ type: 'SOO', value: projectData.soo });
      }

      // Add panel schedules if enabled
      if (projectData.showPanelSchedules) {
        exportData.push({ type: 'Panels', value: projectData.panelTime });
      }

      // Add final calculations
      exportData.push({ type: 'Self-QC', value: projectData.selfQC });
      exportData.push({ type: 'Fluff', value: projectData.fluff });
      exportData.push({ type: 'Separator', value: '--------' });
      exportData.push({ type: 'TOTAL', value: projectData.totalTriage });

      return { success: true, data: exportData };
    } catch (error) {
      console.error('Agile export failed:', error);
      throw error;
    }
  }

  // ===== NEW METHODS USING PathResolutionService =====

  /**
   * Copy and process templates using PathResolutionService (enhanced version)
   */
  async copyAndProcessTemplatesWithResolver(projectData, rfaFolderPath, dateString, sanitizedProjectName, resolvedPaths) {
    try {
      console.log('copyAndProcessTemplatesWithResolver: Using resolved template path:', resolvedPaths.rfaTemplate.path);
      
      if (!resolvedPaths.rfaTemplate.valid) {
        console.warn('Template path not valid, trying fallback:', resolvedPaths.rfaTemplate.reason);
        // Fall back to legacy method if resolved paths fail
        return await this.copyAndProcessTemplates(projectData, rfaFolderPath, dateString, sanitizedProjectName);
      }

      const templatePath = resolvedPaths.rfaTemplate.path;
      
      if (await fs.pathExists(templatePath)) {
        // Copy the contents of the template folder directly into rfaFolderPath
        // This prevents creating nested folder structure
        await fs.copy(templatePath, rfaFolderPath);
        console.log(`Template contents copied from ${templatePath} to ${rfaFolderPath}`);
        
        // Process files inside the RFA folder (no need to rename folders since we copied contents directly)
        await this.processTemplateFiles(rfaFolderPath, projectData, dateString, sanitizedProjectName);
        
      } else {
        console.warn(`Template not found at resolved path: ${templatePath}, falling back to legacy method`);
        return await this.copyAndProcessTemplates(projectData, rfaFolderPath, dateString, sanitizedProjectName);
      }
    } catch (error) {
      console.error('Error in copyAndProcessTemplatesWithResolver:', error);
      // Fall back to legacy method on error
      return await this.copyAndProcessTemplates(projectData, rfaFolderPath, dateString, sanitizedProjectName);
    }
  }

  /**
   * Copy BOM CHECK folder using PathResolutionService (enhanced version)
   */
  async copyBOMCheckFolderWithResolver(rfaFolderPath, resolvedPaths) {
    try {
      console.log('copyBOMCheckFolderWithResolver: Using template path:', resolvedPaths.templates.bestTemplatePath);
      
      const bomCheckPath = path.join(resolvedPaths.templates.bestTemplatePath, 'BOM CHECK');
      
      if (await fs.pathExists(bomCheckPath)) {
        const destPath = path.join(rfaFolderPath, 'BOM CHECK');
        await fs.copy(bomCheckPath, destPath);
        console.log(`BOM CHECK folder copied from ${bomCheckPath} to ${destPath}`);
      } else {
        console.warn(`BOM CHECK not found at ${bomCheckPath}, trying fallback...`);
        // Try fallback template path
        if (resolvedPaths.templates.fallback.valid) {
          const fallbackBomPath = path.join(resolvedPaths.templates.fallback.path, 'BOM CHECK');
          if (await fs.pathExists(fallbackBomPath)) {
            const destPath = path.join(rfaFolderPath, 'BOM CHECK');
            await fs.copy(fallbackBomPath, destPath);
            console.log(`BOM CHECK folder copied from fallback: ${fallbackBomPath}`);
          } else {
            console.warn('BOM CHECK not found in fallback path either');
          }
        }
      }
    } catch (error) {
      console.error('Error in copyBOMCheckFolderWithResolver:', error);
      // Fall back to legacy method
      return await this.copyBOMCheckFolder(rfaFolderPath);
    }
  }

  /**
   * Copy agent-specific files using PathResolutionService (enhanced version)
   */
  async copyAgentSpecificFilesWithResolver(projectData, agentFilesPath, dateString, sanitizedProjectName, resolvedPaths) {
    try {
      console.log('copyAgentSpecificFilesWithResolver: Using agent requirements path:', resolvedPaths.templates.agentRequirements.path);
      
      if (!resolvedPaths.templates.agentRequirements.valid) {
        console.warn('Agent requirements path not valid:', resolvedPaths.templates.agentRequirements.reason);
        // Fall back to legacy method
        return await this.copyAgentSpecificFiles(projectData, agentFilesPath, dateString, sanitizedProjectName);
      }

      const agentNumber = projectData.agentNumber;
      const agentRequirementsPath = resolvedPaths.templates.agentRequirements.path;
      // Sanitize rfaType to remove parentheses and other invalid characters
      const sanitizedRfaTypeValue = sanitizeRfaType(projectData.rfaType);
      
      // Copy metric template for specific agents
      const metricAgents = ['563', '584', '903', '904', '905', '906', '909', '912', '915', '926', '968'];
      if (metricAgents.includes(agentNumber)) {
        const metricTemplate = path.join(resolvedPaths.templates.bestTemplatePath, '(Metric).vsp');
        if (await fs.pathExists(metricTemplate)) {
          // Use "Metric" without parentheses in the destination filename
          const destPath = path.join(agentFilesPath, `ABC_${sanitizedProjectName}_${sanitizedRfaTypeValue} ORIG_${dateString} Metric.vsp`);
          await fs.copy(metricTemplate, destPath);
          console.log(`Metric template copied for agent ${agentNumber}`);
        }
      }

      // Copy Holophane template for 4-digit agents
      if (agentNumber.length === 4) {
        const holophaneTemplate = path.join(agentRequirementsPath, 'Holophane.vsp');
        if (await fs.pathExists(holophaneTemplate)) {
          const destPath = path.join(agentFilesPath, `ABC_${sanitizedProjectName}_${sanitizedRfaTypeValue} ORIG_${dateString}.vsp`);
          await fs.copy(holophaneTemplate, destPath);
          console.log(`Holophane template copied for 4-digit agent ${agentNumber}`);
        }
      }

      // Copy agent-specific template
      const agentTemplate = path.join(agentRequirementsPath, `${sanitizeForFilename(agentNumber)}.vsp`);
      if (await fs.pathExists(agentTemplate)) {
        const destPath = path.join(agentFilesPath, `ABC_${sanitizedProjectName}_${sanitizedRfaTypeValue} ORIG_${dateString}.vsp`);
        await fs.copy(agentTemplate, destPath);
        console.log(`Agent-specific template copied: ${agentNumber}.vsp`);
      } else {
        console.warn(`Agent template not found: ${agentTemplate}`);
      }

    } catch (error) {
      console.error('Error in copyAgentSpecificFilesWithResolver:', error);
      // Fall back to legacy method
      return await this.copyAgentSpecificFiles(projectData, agentFilesPath, dateString, sanitizedProjectName);
    }
  }

  /**
   * Validate project data using comprehensive validation pipeline
   * @param {Object} projectData - Project data to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateProject(projectData) {
    try {
      console.log('Running comprehensive project validation...');
      return await this.validationOrchestrator.validateProjectCreation(projectData);
    } catch (error) {
      console.error('Project validation failed:', error);
      return {
        success: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
        recommendations: []
      };
    }
  }

  /**
   * Validate specific field
   * @param {string} fieldName - Name of field to validate
   * @param {any} value - Value to validate
   * @param {Object} projectData - Full project data context
   * @returns {Promise<Object>} Field validation result
   */
  async validateField(fieldName, value, projectData = {}) {
    try {
      return await this.validationOrchestrator.validateField(fieldName, value, projectData);
    } catch (error) {
      console.error('Field validation failed:', error);
      return {
        fieldName: fieldName,
        value: value,
        isValid: false,
        errors: [`Field validation failed: ${error.message}`],
        warnings: [],
        suggestions: []
      };
    }
  }

  /**
   * Get validation service status
   * @returns {Object} Service status information
   */
  getValidationStatus() {
    try {
      return this.validationOrchestrator.getServiceStatus();
    } catch (error) {
      console.error('Failed to get validation status:', error);
      return {
        error: error.message,
        available: false
      };
    }
  }

  /**
   * Clear all validation caches
   */
  clearValidationCaches() {
    try {
      this.validationOrchestrator.clearAllCaches();
      console.log('All validation caches cleared');
    } catch (error) {
      console.error('Failed to clear validation caches:', error);
    }
  }

  // ===== REVISION WORKFLOW METHODS =====

  /**
   * Detect existing project and suggest revision mode
   * @param {Object} projectData - Project information
   * @returns {Promise<Object>} Detection result
   */
  async detectExistingProject(projectData) {
    try {
      return await this.revisionDetectionService.detectExistingProject(projectData);
    } catch (error) {
      console.error('ProjectCreationService: Error detecting existing project:', error);
      return {
        exists: false,
        error: error.message,
        shouldPromptRevision: false
      };
    }
  }

  /**
   * Find previous revision for a project
   * @param {Object} projectData - Project information
   * @returns {Promise<Object>} Previous revision search result
   */
  async findPreviousRevision(projectData) {
    try {
      return await this.revisionDetectionService.findPreviousRevision(projectData);
    } catch (error) {
      console.error('ProjectCreationService: Error finding previous revision:', error);
      return {
        success: false,
        error: error.message,
        requiresManualSelection: true
      };
    }
  }

  /**
   * Validate manually selected RFA folder
   * @param {string} folderPath - Path to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateRFAFolder(folderPath) {
    try {
      return await this.revisionDetectionService.validateRFAFolder(folderPath);
    } catch (error) {
      console.error('ProjectCreationService: Error validating RFA folder:', error);
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Create a revision project with folder structure and file copying
   * @param {Object} projectData - Project information including revision settings
   * @param {Object} revisionOptions - Revision-specific options
   * @returns {Promise<Object>} Revision creation result
   */
  async createRevisionProject(projectData, revisionOptions = {}) {
    try {
      console.log('ProjectCreationService: Starting revision creation');
      console.log('Project data:', projectData);
      console.log('Revision options:', revisionOptions);

      // Convert form data to internal format
      const internalProjectData = this.rfaMapping.convertFormDataToInternal(projectData);

      // OPTIMIZATION: Lightweight validation for revisions (skip heavy orchestrator)
      console.log('ProjectCreationService: Using fast validation for revision');
      
      // Basic validation only - skip heavy validation pipeline for speed
      if (!projectData.projectName || !projectData.rfaType) {
        return {
          success: false,
          error: 'Validation failed: Project name and RFA type are required'
        };
      }
      
      console.log('ProjectCreationService: Fast validation passed for revision');

      // Report initial progress
      if (revisionOptions.onProgress) {
        revisionOptions.onProgress('Starting revision creation...', 5, { step: 'validation' });
      }

      // Validate required fields
      if (!this.validateProjectData(internalProjectData)) {
        throw new Error('Invalid project data for revision');
      }

      // Sanitize project name and determine paths
      const sanitizedProjectName = this.sanitizeProjectName(internalProjectData.projectName);
      const firstLetter = this.getFirstLetter(sanitizedProjectName);
      const currentDate = new Date();
      const dateString = `${String(currentDate.getMonth() + 1).padStart(2, '0')}${String(currentDate.getDate()).padStart(2, '0')}${currentDate.getFullYear()}`;

      // Step 1: Find previous revision
      if (revisionOptions.onProgress) {
        revisionOptions.onProgress('Finding previous revision...', 10, { step: 'detection' });
      }
      
      let previousRevisionPath = revisionOptions.previousRevisionPath;
      if (!previousRevisionPath) {
        console.log('ProjectCreationService: Searching for previous revision automatically');
        const findResult = await this.findPreviousRevision(projectData);
        
        if (findResult.success) {
          previousRevisionPath = findResult.revisionPath;
          console.log('ProjectCreationService: Found previous revision at:', previousRevisionPath);
          
          // Show RFA selection notification if we have smart selection details
          if (findResult.selectionReasoning && findResult.selectionStrategy) {
            if (findResult.selectionStrategy === 'auto_medium_confidence' || 
                findResult.selectionStrategy === 'fallback_latest') {
              
              const notificationMessage = `🔍 Multiple RFA types found. ${findResult.selectionReasoning}`;
              if (revisionOptions.onProgress) {
                revisionOptions.onProgress(notificationMessage, 15, { 
                  step: 'rfa_selection',
                  details: 'Smart RFA folder selection completed'
                });
              }
              console.log('📋 RFA Selection Notification:', notificationMessage);
            }
          }
        } else {
          console.log('ProjectCreationService: No previous revision found automatically');
          return {
            success: false,
            requiresManualSelection: true,
            error: 'Previous revision not found automatically. Manual selection required.',
            searchResult: findResult
          };
        }
      }

      // Step 1.5: Ensure we have a valid previous revision path
      if (!previousRevisionPath) {
        return {
          success: false,
          error: 'Previous revision path is required but not found or provided'
        };
      }

      // Step 2: Validate previous revision path
      if (revisionOptions.onProgress) {
        revisionOptions.onProgress('Validating revision folder...', 15, { step: 'validation', path: previousRevisionPath });
      }
      
      if (previousRevisionPath) {
        const validationResult = await this.validateRFAFolder(previousRevisionPath);
        if (!validationResult.isValid) {
          return {
            success: false,
            error: `Invalid previous revision folder: ${validationResult.error}`,
            validationResult: validationResult
          };
        }
      }

      // Step 3: Resolve project paths using PathResolutionService
      const resolvedPaths = await this.pathResolver.resolveAllProjectPaths(internalProjectData);
      console.log('ProjectCreationService: Resolved paths for revision:', resolvedPaths);

      // Step 4: Create new revision folder structure
      const outputBasePath = resolvedPaths.output.finalPath;
      await this.pathResolver.ensureDirectoryExists(outputBasePath);

      // Sanitize folder name components
      const projectFolderName = `${sanitizedProjectName}_${sanitizeForFilename(projectData.projectContainer)}`;
      const projectFolderPath = path.join(outputBasePath, projectFolderName);
      // Sanitize rfaType to remove parentheses and other invalid characters
      const sanitizedRfaTypeValue = sanitizeRfaType(projectData.rfaType);
      const rfaFolderName = `RFA#${sanitizeForFilename(projectData.rfaNumber)}_${sanitizedRfaTypeValue}_${dateString}`;
      const rfaFolderPath = path.join(projectFolderPath, rfaFolderName);
      const agentFilesPath = path.join(rfaFolderPath, '!Agent Files');

      // Create folder structure
      if (revisionOptions.onProgress) {
        revisionOptions.onProgress('Creating folder structure...', 25, { step: 'folder_creation' });
      }
      
      await fs.ensureDir(projectFolderPath);
      await fs.ensureDir(rfaFolderPath);
      await fs.ensureDir(agentFilesPath);
      await fs.ensureDir(path.join(rfaFolderPath, '!!Request Output'));

      console.log('ProjectCreationService: Created basic revision folder structure');

      // Step 5: Copy BOM CHECK from template (only if no previous revision or copy disabled)
      if (!previousRevisionPath || revisionOptions.copyBOMCheck === false) {
        if (revisionOptions.onProgress) {
          revisionOptions.onProgress('Copying template files...', 30, { step: 'template_copy' });
        }
        console.log('ProjectCreationService: Copying fresh BOM CHECK from template (no previous revision or copy disabled)');
        await this.copyBOMCheckFolderWithResolver(rfaFolderPath, resolvedPaths);
      } else {
        console.log('ProjectCreationService: Skipping template BOM CHECK - will use previous revision BOM CHECK');
      }

      // Step 6: Copy files from previous revision
      if (previousRevisionPath) {
        if (revisionOptions.onProgress) {
          revisionOptions.onProgress('Copying files from previous revision...', 35, { step: 'revision_copy', path: previousRevisionPath });
        }
        console.log('ProjectCreationService: Starting file copy from previous revision');
        
        const copyOptions = {
          copyAEMarkups: revisionOptions.copyAEMarkups !== false,
          copyBOMCheck: revisionOptions.copyBOMCheck !== false,
          copyVSP: revisionOptions.copyVSP !== false,
          ...revisionOptions.copyOptions
        };

        const copyResult = await this.revisionFileCopyService.copyRevisionAssets(
          previousRevisionPath,
          rfaFolderPath,
          {
            copyOptions: copyOptions,
            aeMarkupsSelectedFiles: revisionOptions.aeMarkupsSelectedFiles, // Pass AE Markups file selection
            onProgress: revisionOptions.onProgress // Now we can pass the progress callback
          }
        );

        if (!copyResult.success) {
          console.warn('ProjectCreationService: Some file copy operations failed:', copyResult);
          // Don't fail the entire revision creation for copy issues
        }

        console.log('ProjectCreationService: File copy operations completed');
        console.log('Copy result:', copyResult.summary);
      }

      // Step 7: Copy agent-specific files (using resolver)
      if (revisionOptions.onProgress) {
        revisionOptions.onProgress('Copying agent-specific files...', 90, { step: 'agent_files' });
      }
      await this.copyAgentSpecificFilesWithResolver(projectData, rfaFolderPath, dateString, sanitizedProjectName, resolvedPaths);

      // Step 8: Process project documents (if needed)
      if (revisionOptions.onProgress) {
        revisionOptions.onProgress('Processing project documents...', 95, { step: 'documents' });
      }
      await this.processProjectDocuments(projectData, rfaFolderPath);

      // Step 9: Create shortcuts if needed (cross-year references)
      if (revisionOptions.onProgress) {
        revisionOptions.onProgress('Creating shortcuts...', 98, { step: 'shortcuts' });
      }
      await this.createRevisionShortcuts(projectData, projectFolderPath, rfaFolderPath);

      // Step 10: Open Agent Files folder
      await this.openAgentFilesFolder(agentFilesPath);

      console.log('ProjectCreationService: Revision creation completed successfully');

      return {
        success: true,
        projectPath: projectFolderPath,
        rfaPath: rfaFolderPath,
        agentFilesPath: agentFilesPath,
        previousRevisionPath: previousRevisionPath,
        resolvedPaths: resolvedPaths,
        message: 'Revision created successfully with files copied from previous revision'
      };

    } catch (error) {
      console.error('ProjectCreationService: Revision creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze what can be copied from a previous revision
   * @param {string} revisionPath - Path to previous revision
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeRevisionContents(revisionPath) {
    try {
      return await this.revisionFileCopyService.analyzeRevisionContents(revisionPath);
    } catch (error) {
      console.error('ProjectCreationService: Error analyzing revision contents:', error);
      return {
        success: false,
        error: error.message,
        available: {}
      };
    }
  }

  /**
   * Get recommended copy options based on revision content
   * @param {string} revisionPath - Path to previous revision
   * @returns {Promise<Object>} Recommended options
   */
  async getRecommendedCopyOptions(revisionPath) {
    try {
      const analysis = await this.analyzeRevisionContents(revisionPath);
      return this.revisionFileCopyService.getRecommendedCopyOptions(analysis);
    } catch (error) {
      console.error('ProjectCreationService: Error getting recommended copy options:', error);
      return {
        copyAEMarkups: false,
        copyXREF: false,
        copyLCD: false,
        copyVSP: false,
        copyDWG: false
      };
    }
  }

  /**
   * Create shortcuts for revision projects (implements HTA shortcut logic)
   * @param {Object} projectData - Project information
   * @param {string} projectFolderPath - Path to project folder
   * @param {string} rfaFolderPath - Path to RFA folder
   */
  async createRevisionShortcuts(projectData, projectFolderPath, rfaFolderPath) {
    try {
      // Only create shortcuts for server-based projects
      if (projectData.saveLocation !== 'Server') {
        console.log('ProjectCreationService: Shortcuts not needed for non-server projects');
        return;
      }

      const currentYear = new Date().getFullYear();
      const sanitizedProjectName = this.sanitizeProjectName(projectData.projectName);
      const firstLetter = this.getFirstLetter(sanitizedProjectName);
      const currentYearPath = `\\\\10.3.10.30\\DAS\\${currentYear} Projects\\${firstLetter}\\${sanitizedProjectName}_${projectData.projectContainer}`;

      // Check if project is in non-current year folder
      if (projectFolderPath !== currentYearPath) {
        console.log('ProjectCreationService: Creating shortcut for cross-year reference');
        
        const shortcutPath = `${currentYearPath}.lnk`;
        const command = `powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('${shortcutPath}'); $Shortcut.TargetPath = '${projectFolderPath}'; $Shortcut.Description = 'Shortcut to initial revision'; $Shortcut.Save()"`;
        
        exec(command, (error) => {
          if (error) {
            console.error('ProjectCreationService: Error creating revision shortcut:', error);
          } else {
            console.log('ProjectCreationService: Revision shortcut created successfully');
          }
        });
      }

    } catch (error) {
      console.error('ProjectCreationService: Error creating revision shortcuts:', error);
      // Don't fail the entire revision creation for shortcut issues
    }
  }

  /**
   * Handle folder name mismatch scenarios
   * @param {string} selectedPath - User selected path
   * @param {string} expectedPath - Expected path based on project data
   * @returns {Promise<Object>} Mismatch handling result
   */
  async handleFolderNameMismatch(selectedPath, expectedPath) {
    try {
      const analysis = this.revisionDetectionService.analyzeFolderNameMismatch(selectedPath, expectedPath);
      
      if (analysis.hasMismatch && analysis.shouldRename) {
        // Return mismatch info for UI to handle user confirmation
        return {
          hasMismatch: true,
          selectedFolder: analysis.selectedFolder,
          expectedFolder: analysis.expectedFolder,
          message: analysis.message,
          requiresUserConfirmation: true
        };
      }

      return {
        hasMismatch: false,
        message: 'Folder name matches expected naming convention'
      };

    } catch (error) {
      console.error('ProjectCreationService: Error handling folder name mismatch:', error);
      return {
        hasMismatch: false,
        error: error.message
      };
    }
  }

  /**
   * Rename project folder to match current naming convention
   * @param {string} oldPath - Current folder path
   * @param {string} newPath - New folder path
   * @returns {Promise<Object>} Rename result
   */
  async renameProjectFolder(oldPath, newPath) {
    try {
      console.log('ProjectCreationService: Renaming project folder');
      console.log('From:', oldPath);
      console.log('To:', newPath);

      if (await fs.pathExists(newPath)) {
        return {
          success: false,
          error: 'Target folder already exists'
        };
      }

      await fs.move(oldPath, newPath);
      
      console.log('ProjectCreationService: Project folder renamed successfully');
      return {
        success: true,
        oldPath: oldPath,
        newPath: newPath,
        message: 'Project folder renamed successfully'
      };

    } catch (error) {
      console.error('ProjectCreationService: Error renaming project folder:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ProjectCreationService;
