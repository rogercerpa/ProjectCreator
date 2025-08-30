const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { app } = require('electron');

class ProjectCreationService {
  constructor() {
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

      // Validate required fields
      if (!this.validateProjectData(projectData)) {
        throw new Error('Invalid project data');
      }

      // Sanitize project name
      const sanitizedProjectName = this.sanitizeProjectName(projectData.projectName);
      const firstLetter = this.getFirstLetter(sanitizedProjectName);
      
      // Determine save location and paths
      const paths = this.determineProjectPaths(projectData, sanitizedProjectName, firstLetter);
      
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
   * Validate project data before creation
   */
  validateProjectData(projectData) {
    const required = ['projectName', 'projectContainer', 'rfaNumber', 'rfaType', 'agentNumber'];
    return required.every(field => projectData[field] && projectData[field].trim() !== '');
  }

  /**
   * Sanitize project name (remove invalid characters, convert to uppercase)
   */
  sanitizeProjectName(projectName) {
    return projectName
      .replace(/[\\\/:]/g, ' ')
      .replace(/_/g, ' ')
      .toUpperCase()
      .trim();
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
    const projectFolder = path.join(paths.baseSave, `${projectName}_${projectData.projectContainer}`);
    
    // Create main project folder
    await fs.ensureDir(projectFolder);
    
    // Create RFA subfolder with date
    const currentDate = new Date();
    const dateString = `${String(currentDate.getMonth() + 1).padStart(2, '0')}${String(currentDate.getDate()).padStart(2, '0')}${currentDate.getFullYear()}`;
    const rfaFolder = path.join(projectFolder, `RFA#${projectData.rfaNumber}_${projectData.rfaType}_${dateString}`);
    
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
    
    try {
      // Handle different RFA types
      if (projectData.rfaType.includes('Reloc')) {
        // Relocation projects
        const relocTemplate = this.templatePaths.reloc;
        if (await fs.pathExists(relocTemplate)) {
          await fs.copy(relocTemplate, rfaFolder);
          // Rename the template folder
          const templateFolderName = path.basename(relocTemplate);
          const newFolderName = `RFA#${projectData.rfaNumber}_${projectData.rfaType.includes('Controls') ? '(Reloc Portion) ' : ''}${projectData.rfaType}_${projectStructure.dateString}`;
          await fs.move(path.join(rfaFolder, templateFolderName), path.join(rfaFolder, newFolderName));
        }
      } else if (projectData.rfaType === 'PHOTOMETRICS') {
        // Photometrics projects
        const photoTemplate = this.templatePaths.photometrics;
        if (await fs.pathExists(photoTemplate)) {
          await fs.copy(photoTemplate, rfaFolder);
          const templateFolderName = path.basename(photoTemplate);
          const newFolderName = `RFA#${projectData.rfaNumber}_${projectData.rfaType}_${projectStructure.dateString}`;
          await fs.move(path.join(rfaFolder, templateFolderName), path.join(rfaFolder, newFolderName));
        }
      } else {
        // Standard control projects
        const controlsTemplate = this.templatePaths.controls;
        if (await fs.pathExists(controlsTemplate)) {
          await fs.copy(controlsTemplate, rfaFolder);
          const templateFolderName = path.basename(controlsTemplate);
          const newFolderName = `RFA#${projectData.rfaNumber}_${projectData.rfaType}_${projectStructure.dateString}`;
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
   * Copy agent-specific files
   */
  async copyAgentSpecificFiles(projectData, rfaFolder, dateString) {
    try {
      const agentNumber = projectData.agentNumber;
      
      // Copy metric template for specific agents
      const metricAgents = ['563', '584', '903', '904', '905', '906', '909', '912', '915', '926', '968'];
      if (metricAgents.includes(agentNumber)) {
        const metricTemplate = path.join(this.templatePaths.master, '(Metric).vsp');
        if (await fs.pathExists(metricTemplate)) {
          const destPath = path.join(rfaFolder, `ABC_${projectData.projectName}_${projectData.rfaType} ORIG_${dateString} (Metric).vsp`);
          await fs.copy(metricTemplate, destPath);
        }
      }

      // Copy Holophane template for 4-digit agents
      if (agentNumber.length === 4) {
        const holophaneTemplate = path.join(this.templatePaths.agentRequirements, 'Holophane.vsp');
        if (await fs.pathExists(holophaneTemplate)) {
          const destPath = path.join(rfaFolder, `ABC_${projectData.projectName}_${projectData.rfaType} ORIG_${dateString}.vsp`);
          await fs.copy(holophaneTemplate, destPath);
        }
      }

      // Copy agent-specific template
      const agentTemplate = path.join(this.templatePaths.agentRequirements, `${agentNumber}.vsp`);
      if (await fs.pathExists(agentTemplate)) {
        const destPath = path.join(rfaFolder, `ABC_${projectData.projectName}_${projectData.rfaType} ORIG_${dateString}.vsp`);
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
}

module.exports = ProjectCreationService;
