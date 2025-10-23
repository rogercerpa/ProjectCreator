// ProjectService runs in main process - no need for ipcRenderer
const fs = require('fs-extra');
const path = require('path');
const officegen = require('officegen');
const docx = require('docx');
const mammoth = require('mammoth');

class ProjectService {
  constructor() {
    this.config = {
      serverPaths: {
        masterTemplate: '\\\\10.3.10.30\\DAS\\DAS References\\!!!Templates For Project Creator',
        currentYear: '\\\\10.3.10.30\\DAS',
        agentRequirements: '\\\\10.3.10.30\\DAS\\Agent Requirements',
        corporateAccounts: '\\\\10.3.10.30\\DAS\\Corporate Accounts'
      },
      desktopPaths: {
        triage: 'C:\\Users\\%USERNAME%\\Desktop\\1) Triage',
        templates: 'C:\\Users\\%USERNAME%\\Desktop\\1) Triage\\!!!Templates For Project Creator'
      },
      multipliers: {
        room: 2, // minutes per room
        riser: 1, // minutes per room
        arp: { 8: 5, 16: 10, 32: 20, 48: 25 }, // minutes per ARP
        lmp: { small: 15, medium: 30, large: 45 } // minutes per LMP
      }
    };
  }

  // Get current user and system info
  async getSystemInfo() {
    try {
      const username = process.env.USERNAME || process.env.USER;
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      
      return {
        username,
        currentDate: `${month}${day}${year}`,
        year,
        month,
        day
      };
    } catch (error) {
      console.error('Error getting system info:', error);
      throw error;
    }
  }

  // Validate project data
  validateProjectData(projectData) {
    const errors = [];
    
    if (!projectData.projectName?.trim()) {
      errors.push('Project name is required');
    }
    
    if (!projectData.projectContainer?.trim()) {
      errors.push('Project container is required');
    }
    
    if (!projectData.rfaNumber?.trim()) {
      errors.push('RFA number is required');
    }
    
    if (!projectData.rfaType?.trim()) {
      errors.push('RFA type is required');
    }
    
    if (!projectData.agentNumber?.trim()) {
      errors.push('Agent number is required');
    }
    
    if (!projectData.regionalTeam?.trim()) {
      errors.push('Regional team is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Sanitize project name
  sanitizeProjectName(projectName) {
    return projectName
      .replace(/[\\\/|:]/g, ' ') // Replace backslashes, forward slashes, pipes, colons
      .replace(/_/g, ' ') // Replace underscores
      .toUpperCase(); // Convert to uppercase
  }

  // Get project folder path
  async getProjectFolderPath(projectData, saveLocation) {
    const systemInfo = await this.getSystemInfo();
    const sanitizedName = this.sanitizeProjectName(projectData.projectName);
    const firstLetter = /^[A-Z]/.test(sanitizedName) ? sanitizedName[0] : '#';
    const projectYear = '20' + projectData.projectContainer.substring(0, 2);
    
    let basePath;
    
    switch (saveLocation) {
      case 'Triage':
        basePath = this.config.desktopPaths.triage.replace('%USERNAME%', systemInfo.username);
        break;
      case 'Server':
        const yearDiff = projectYear - systemInfo.year;
        if (yearDiff === -1) {
          basePath = `${this.config.serverPaths.currentYear}\\${systemInfo.year - 1} Projects\\${firstLetter}`;
        } else if (yearDiff === -2) {
          basePath = `${this.config.serverPaths.currentYear}\\${systemInfo.year - 2} Projects\\${firstLetter}`;
        } else {
          basePath = `${this.config.serverPaths.currentYear}\\${projectYear} Projects\\${firstLetter}`;
        }
        
        // Handle national accounts
        if (projectData.nationalAccount && projectData.nationalAccount !== 'Default') {
          basePath = `${basePath}\\${projectData.nationalAccount}`;
        }
        break;
      default: // Desktop
        basePath = `C:\\Users\\${systemInfo.username}\\Desktop`;
    }
    
    return path.join(basePath, `${sanitizedName}_${projectData.projectContainer}`);
  }

  // Create project folder structure
  async createProjectFolder(projectData, saveLocation) {
    try {
      const systemInfo = await this.getSystemInfo();
      const projectPath = await this.getProjectFolderPath(projectData, saveLocation);
      
      // Create main project folder
      await fs.ensureDir(projectPath);
      
      // Create RFA subfolder
      const rfaFolderName = `RFA#${projectData.rfaNumber}_${projectData.rfaType}_${systemInfo.currentDate}`;
      const rfaPath = path.join(projectPath, rfaFolderName);
      await fs.ensureDir(rfaPath);
      
      // Create standard subfolders
      await fs.ensureDir(path.join(rfaPath, '!Agent Files'));
      await fs.ensureDir(path.join(rfaPath, '!!Request Output'));
      
      // Copy template based on RFA type
      await this.copyProjectTemplate(rfaPath, projectData.rfaType, projectData);
      
      // Handle special RFA types
      if (this.isRelocType(projectData.rfaType)) {
        await this.handleRelocProject(rfaPath, projectData, systemInfo);
      } else if (projectData.rfaType === 'PHOTOMETRICS') {
        await this.handlePhotometricsProject(rfaPath, projectData, systemInfo);
      } else {
        await this.handleStandardProject(rfaPath, projectData, systemInfo);
      }
      
      // Create shortcuts if needed
      if (saveLocation === 'Server') {
        await this.createProjectShortcut(projectPath, projectData, systemInfo);
      }
      
      return {
        success: true,
        projectPath,
        rfaPath,
        message: 'Project folder created successfully'
      };
      
    } catch (error) {
      console.error('Error creating project folder:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Copy project template
  async copyProjectTemplate(rfaPath, rfaType, projectData) {
    try {
      let templatePath;
      
      if (this.isRelocType(rfaType)) {
        templatePath = path.join(this.config.serverPaths.masterTemplate, 'RELOC-RFA#_TYPE_MMDDYYYY');
      } else if (rfaType === 'PHOTOMETRICS') {
        templatePath = path.join(this.config.serverPaths.masterTemplate, 'PHOTOMETRICS-RFA#_TYPE_MMDDYYYY');
      } else {
        templatePath = path.join(this.config.serverPaths.masterTemplate, 'RFA#_TYPE_MMDDYYYY');
      }
      
      if (await fs.pathExists(templatePath)) {
        await fs.copy(templatePath, rfaPath);
      } else {
        throw new Error(`Template not found: ${templatePath}`);
      }
    } catch (error) {
      console.error('Error copying template:', error);
      throw error;
    }
  }

  // Handle reloc project types
  async handleRelocProject(rfaPath, projectData, systemInfo) {
    try {
      const relocFolder = path.join(rfaPath, 'RELOC-RFA#_TYPE_MMDDYYYY');
      if (await fs.pathExists(relocFolder)) {
        const newName = `RFA#${projectData.rfaNumber}_${projectData.rfaType === 'RelocControlsSUB' || projectData.rfaType === 'RelocControlsBOM' 
          ? '(Reloc Portion) ' + projectData.rfaType 
          : projectData.rfaType}_${systemInfo.currentDate}`;
        
        await fs.move(relocFolder, path.join(rfaPath, newName));
        
        // Rename VSL files
        const files = await fs.readdir(rfaPath);
        for (const file of files) {
          if (path.extname(file).toLowerCase() === '.vsl') {
            const newFileName = `${projectData.rfaNumber} A1.vsl`;
            await fs.move(path.join(rfaPath, file), path.join(rfaPath, newFileName));
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error handling reloc project:', error);
      throw error;
    }
  }

  // Handle photometrics project
  async handlePhotometricsProject(rfaPath, projectData, systemInfo) {
    try {
      const photometricsFolder = path.join(rfaPath, 'PHOTOMETRICS-RFA#_TYPE_MMDDYYYY');
      if (await fs.pathExists(photometricsFolder)) {
        const newName = `RFA#${projectData.rfaNumber}_${projectData.rfaType}_${systemInfo.currentDate}`;
        await fs.move(photometricsFolder, path.join(rfaPath, newName));
        
        // Rename VSL files
        const files = await fs.readdir(rfaPath);
        for (const file of files) {
          if (path.extname(file).toLowerCase() === '.vsl') {
            const newFileName = `${projectData.rfaNumber} A1.vsl`;
            await fs.move(path.join(rfaPath, file), path.join(rfaPath, newFileName));
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error handling photometrics project:', error);
      throw error;
    }
  }

  // Handle standard project
  async handleStandardProject(rfaPath, projectData, systemInfo) {
    try {
      const standardFolder = path.join(rfaPath, 'RFA#_TYPE_MMDDYYYY');
      if (await fs.pathExists(standardFolder)) {
        const newName = `RFA#${projectData.rfaNumber}_${projectData.rfaType}_${systemInfo.currentDate}`;
        await fs.move(standardFolder, path.join(rfaPath, newName));
        
        // Rename VSP files
        const files = await fs.readdir(rfaPath);
        for (const file of files) {
          if (path.extname(file).toLowerCase() === '.vsp') {
            const newFileName = `ABC_${projectData.projectName}_${projectData.rfaType} ORIG_${systemInfo.currentDate}.vsp`;
            await fs.move(path.join(rfaPath, file), path.join(rfaPath, newFileName));
            break;
          }
        }
      }
      
      // Add metric template if needed
      if (this.shouldAddMetricTemplate(projectData.agentNumber)) {
        await this.addMetricTemplate(rfaPath, projectData, systemInfo);
      }
      
      // Add Holophane template if needed
      if (projectData.agentNumber.length === 4) {
        await this.addHolophaneTemplate(rfaPath, projectData, systemInfo);
      }
      
      // Add agency-specific template
      await this.addAgencyTemplate(rfaPath, projectData, systemInfo);
      
      // Add LCD preprogramming template if needed
      if (projectData.rfaType === 'RELEASE') {
        await this.addLCDTemplate(rfaPath, projectData, systemInfo);
      }
      
    } catch (error) {
      console.error('Error handling standard project:', error);
      throw error;
    }
  }

  // Check if RFA type is reloc
  isRelocType(rfaType) {
    return ['RelocBOM', 'RelocSUB', 'RelocControlsBOM', 'RelocControlsSUB'].includes(rfaType);
  }

  // Check if should add metric template
  shouldAddMetricTemplate(agentNumber) {
    const metricAgents = [563, 584, 903, 904, 905, 906, 909, 912, 915, 926, 968];
    return metricAgents.includes(parseInt(agentNumber));
  }

  // Add metric template
  async addMetricTemplate(rfaPath, projectData, systemInfo) {
    try {
      const metricTemplatePath = path.join(this.config.serverPaths.masterTemplate, '(Metric).vsp');
      if (await fs.pathExists(metricTemplatePath)) {
        const newFileName = `ABC_${projectData.projectName}_${projectData.rfaType} ORIG_${systemInfo.currentDate} (Metric).vsp`;
        await fs.copy(metricTemplatePath, path.join(rfaPath, newFileName));
      }
    } catch (error) {
      console.error('Error adding metric template:', error);
    }
  }

  // Add Holophane template
  async addHolophaneTemplate(rfaPath, projectData, systemInfo) {
    try {
      const holophanePath = path.join(this.config.serverPaths.agentRequirements, 'Holophane.vsp');
      if (await fs.pathExists(holophanePath)) {
        const newFileName = `ABC_${projectData.projectName}_${projectData.rfaType} ORIG_${systemInfo.currentDate}.vsp`;
        await fs.copy(holophanePath, path.join(rfaPath, newFileName));
      }
    } catch (error) {
      console.error('Error adding Holophane template:', error);
    }
  }

  // Add agency template
  async addAgencyTemplate(rfaPath, projectData, systemInfo) {
    try {
      const agencyPath = path.join(this.config.serverPaths.agentRequirements, `${projectData.agentNumber}.vsp`);
      if (await fs.pathExists(agencyPath)) {
        const newFileName = `ABC_${projectData.projectName}_${projectData.rfaType} ORIG_${systemInfo.currentDate}.vsp`;
        await fs.copy(agencyPath, path.join(rfaPath, newFileName));
      }
    } catch (error) {
      console.error('Error adding agency template:', error);
    }
  }

  // Add LCD template
  async addLCDTemplate(rfaPath, projectData, systemInfo) {
    try {
      const lcdPath = path.join(this.config.serverPaths.masterTemplate, 'LCD');
      if (await fs.pathExists(lcdPath)) {
        await fs.copy(lcdPath, rfaPath);
      }
    } catch (error) {
      console.error('Error adding LCD template:', error);
    }
  }

  // Create project shortcut
  async createProjectShortcut(projectPath, projectData, systemInfo) {
    try {
      const shortcutPath = path.join(
        this.config.serverPaths.currentYear,
        `${systemInfo.year} Projects`,
        `${this.getFirstLetter(projectData.projectName)}`,
        `${projectData.projectName}_${projectData.projectContainer}.lnk`
      );
      
      // Note: Creating .lnk files requires additional libraries
      // For now, we'll create a text file with the path
      const shortcutContent = `Shortcut to: ${projectPath}`;
      await fs.writeFile(shortcutPath.replace('.lnk', '.txt'), shortcutContent);
      
    } catch (error) {
      console.error('Error creating shortcut:', error);
    }
  }

  // Get first letter of project name
  getFirstLetter(projectName) {
    const firstChar = projectName.charAt(0).toUpperCase();
    return /[A-Z]/.test(firstChar) ? firstChar : '#';
  }

  // Calculate triage time
  calculateTriageTime(triageData) {
    try {
      let totalTime = 0;
      
      // Layout calculations
      if (triageData.numOfRooms || triageData.overrideRooms) {
        let layoutTime = 0;
        if (triageData.overrideRooms) {
          layoutTime = triageData.overrideRooms;
        } else {
          layoutTime = (triageData.numOfRooms * this.config.multipliers.room) / 60;
        }
        layoutTime += (triageData.specReview || 0) + (triageData.reviewSetup || 0);
        totalTime += layoutTime;
      }
      
      // Submittal calculations
      if (triageData.numOfSubRooms || triageData.overrideSubRooms) {
        let submittalTime = 0;
        if (triageData.overrideSubRooms) {
          submittalTime = triageData.overrideSubRooms;
        } else {
          submittalTime = (triageData.numOfSubRooms * this.config.multipliers.riser) / 60;
        }
        submittalTime += (triageData.soo || 0);
        totalTime += submittalTime;
      }
      
      // Panel calculations
      if (triageData.panelSchedules) {
        let panelTime = 0;
        
        // ARP calculations
        if (triageData.arp8) panelTime += triageData.arp8 * this.config.multipliers.arp[8];
        if (triageData.arp16) panelTime += triageData.arp16 * this.config.multipliers.arp[16];
        if (triageData.arp32) panelTime += triageData.arp32 * this.config.multipliers.arp[32];
        if (triageData.arp48) panelTime += triageData.arp48 * this.config.multipliers.arp[48];
        
        // LMP calculations
        if (triageData.smallLMPs) panelTime += triageData.smallLMPs * this.config.multipliers.lmp.small;
        if (triageData.mediumLMPs) panelTime += triageData.mediumLMPs * this.config.multipliers.lmp.medium;
        if (triageData.largeLMPs) panelTime += triageData.largeLMPs * this.config.multipliers.lmp.large;
        
        panelTime = (panelTime / 60) * (triageData.panelMultiplier || 1);
        totalTime += panelTime;
      }
      
      // Page adder
      if (triageData.numOfPages > 3) {
        totalTime += (triageData.numOfPages * 3) / 60;
      }
      
      // Self QC and Fluff
      let selfQC = 0.5;
      if (totalTime >= 12) selfQC = 1;
      else if (totalTime < 4) selfQC = 0.25;
      
      const fluff = totalTime / 10;
      
      totalTime += selfQC + fluff;
      
      return {
        totalTime: this.roundToQuarter(totalTime),
        breakdown: {
          layout: triageData.numOfRooms || triageData.overrideRooms ? 'calculated' : 'none',
          submittal: triageData.numOfSubRooms || triageData.overrideSubRooms ? 'calculated' : 'none',
          panels: triageData.panelSchedules ? 'calculated' : 'none',
          selfQC,
          fluff
        }
      };
      
    } catch (error) {
      console.error('Error calculating triage time:', error);
      throw error;
    }
  }

  // Round to nearest quarter
  roundToQuarter(num) {
    return Math.round(num * 4) / 4;
  }

  // Export to DAS Board
  async exportToDASBoard(projectData, triageData) {
    try {
      const systemInfo = await this.getSystemInfo();
      
      // Determine RFA type tag
      let rfaTypeTag = 'Q';
      if (['LAYOUT', 'BOM'].includes(projectData.rfaType)) {
        rfaTypeTag = 'Q';
      } else if (projectData.rfaType === 'BUDGET') {
        rfaTypeTag = 'B';
      } else if (projectData.rfaType === 'GRAPHICS') {
        rfaTypeTag = 'G';
      } else if (this.isRelocType(projectData.rfaType)) {
        rfaTypeTag = 'R';
      } else {
        if (!triageData.numOfRooms && !triageData.overrideRooms) {
          rfaTypeTag = 'S';
        } else {
          rfaTypeTag = 'Q+S';
        }
      }
      
      // Determine due date
      const rdDate = new Date(projectData.requestedDate);
      const ecdDate = new Date(projectData.estimatedCompletionDate);
      let dueDate, rdEcdTag;
      
      if (rdDate > ecdDate) {
        dueDate = projectData.estimatedCompletionDate;
        rdEcdTag = ' [ECD] ';
      } else {
        dueDate = projectData.requestedDate;
        rdEcdTag = ' [RD] ';
      }
      
      // Handle first available
      if (triageData.firstAvailable) {
        rdEcdTag += `{${dueDate}}`;
        dueDate = '';
      }
      
      // Determine complexity
      let projectComplexity = 'M';
      if (triageData.totalTime < 4) {
        projectComplexity = 'E';
      } else if (triageData.totalTime >= 8) {
        projectComplexity = 'C';
      }
      
      // Create project name
      const shortName = projectData.projectName.substring(0, 19);
      const revisionTag = projectData.isRevision ? 'R' : '';
      const dasProjectName = `${projectComplexity} - ${revisionTag}${rfaTypeTag} ${shortName}${rdEcdTag}`;
      
      // Create export data
      const exportData = {
        firstColumn: `${projectData.rfaNumber} (${projectData.agentNumber})`,
        projectName: dasProjectName,
        dueDate,
        triageTime: triageData.totalTime
      };
      
      return {
        success: true,
        data: exportData,
        message: 'DAS Board export data prepared successfully'
      };
      
    } catch (error) {
      console.error('Error exporting to DAS Board:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Export to Agile
  async exportToAgile(projectData, triageData) {
    try {
      const exportData = [];
      
      // Add revision info
      if (projectData.isRevision) {
        exportData.push({
          label: `Revision ${projectData.rfaType}`,
          value: ''
        });
      } else {
        exportData.push({
          label: projectData.rfaType,
          value: ''
        });
      }
      
      // Add layout info
      if (triageData.numOfRooms || triageData.overrideRooms) {
        if (triageData.numOfRooms) {
          exportData.push({ label: '-# of Rooms:', value: triageData.numOfRooms });
        }
        
        let layoutTime = triageData.overrideRooms || 
          ((triageData.numOfRooms * this.config.multipliers.room) / 60);
        
        exportData.push({ label: '-Layout:', value: layoutTime });
        exportData.push({ label: '-Review/Setup:', value: triageData.reviewSetup || 0 });
        exportData.push({ label: '-SpecReview:', value: triageData.specReview || 0 });
      }
      
      // Add submittal info
      if (triageData.numOfSubRooms || triageData.overrideSubRooms) {
        if (triageData.numOfSubRooms) {
          exportData.push({ label: '-# of Rooms:', value: triageData.numOfSubRooms });
        }
        
        let submittalTime = triageData.overrideSubRooms || 
          ((triageData.numOfSubRooms * this.config.multipliers.riser) / 60);
        
        exportData.push({ label: '-Risers:', value: submittalTime });
        exportData.push({ label: '-SOO:', value: triageData.soo || 0 });
      }
      
      // Add panel info
      if (triageData.panelSchedules) {
        exportData.push({ label: '-Panels:', value: triageData.panelTime || 0 });
      }
      
      // Add final calculations
      exportData.push({ label: '-Self-Qc:', value: triageData.selfQC || 0 });
      exportData.push({ label: '-Fluff:', value: triageData.fluff || 0 });
      exportData.push({ label: '--------', value: '' });
      exportData.push({ label: '-TOTAL:', value: triageData.totalTime });
      
      return {
        success: true,
        data: exportData,
        message: 'Agile export data prepared successfully'
      };
      
    } catch (error) {
      console.error('Error exporting to Agile:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Import RFA info from clipboard
  async importRFAInfo(clipboardText) {
    try {
      // Parse clipboard text (simplified version of the original logic)
      const lines = clipboardText.split('\n');
      const rfaInfo = {};
      
      for (const line of lines) {
        if (line.includes('RFA #:')) {
          rfaInfo.rfaNumber = line.split('RFA #:')[1]?.trim();
        } else if (line.includes('Project Name:')) {
          rfaInfo.projectName = line.split('Project Name:')[1]?.trim();
        } else if (line.includes('Agent:')) {
          rfaInfo.agentNumber = line.split('Agent:')[1]?.trim();
        }
      }
      
      return {
        success: true,
        data: rfaInfo,
        message: 'RFA info imported successfully'
      };
      
    } catch (error) {
      console.error('Error importing RFA info:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Open project folder
  async openProjectFolder(projectData) {
    try {
      const projectPath = await this.getProjectFolderPath(projectData, 'Server');
      
      if (await fs.pathExists(projectPath)) {
        // Use Electron's shell to open folder
        const { shell } = require('electron');
        await shell.openPath(projectPath);
        
        return {
          success: true,
          message: 'Project folder opened successfully'
        };
      } else {
        return {
          success: false,
          error: 'Project folder not found'
        };
      }
      
    } catch (error) {
      console.error('Error opening project folder:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Download region template
  async downloadRegionTemplate(regionalTeam) {
    try {
      const systemInfo = await this.getSystemInfo();
      
      if (regionalTeam === 'Desktop Emergency Use only') {
        return {
          success: false,
          error: 'No template available for desktop emergency use'
        };
      }
      
      const sourcePath = this.config.serverPaths.masterTemplate;
      const targetPath = this.config.desktopPaths.templates.replace('%USERNAME%', systemInfo.username);
      
      // Ensure target directory exists
      await fs.ensureDir(targetPath);
      
      // Copy template folder
      await fs.copy(sourcePath, targetPath);
      
      // Copy additional folders
      await fs.copy(
        this.config.serverPaths.agentRequirements,
        path.join(targetPath, 'Agent Requirements')
      );
      
      const imagesPath = path.join(this.config.serverPaths.masterTemplate, 'Images');
      if (await fs.pathExists(imagesPath)) {
        await fs.copy(imagesPath, path.join(targetPath, 'Images'));
      }
      
      return {
        success: true,
        message: 'Region template downloaded successfully',
        path: targetPath
      };
      
    } catch (error) {
      console.error('Error downloading region template:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Upload triages
  async uploadTriages(regionalTeam) {
    try {
      const systemInfo = await this.getSystemInfo();
      const triagePath = this.config.desktopPaths.triage.replace('%USERNAME%', systemInfo.username);
      
      if (!(await fs.pathExists(triagePath))) {
        return {
          success: false,
          error: 'Triage folder does not exist'
        };
      }
      
      const uploadedPath = path.join(triagePath, 'Uploaded Projects');
      await fs.ensureDir(uploadedPath);
      
      // Get all project folders in triage
      const projectFolders = await fs.readdir(triagePath);
      let uploadCount = 0;
      
      for (const folder of projectFolders) {
        if (folder === '!!!Templates For Project Creator' || folder === 'Uploaded Projects') {
          continue;
        }
        
        const folderPath = path.join(triagePath, folder);
        const stats = await fs.stat(folderPath);
        
        if (stats.isDirectory()) {
          // Parse project info from folder name
          const parts = folder.split('_');
          if (parts.length >= 2) {
            const projectName = parts[0];
            const projectNumber = parts[1];
            const firstLetter = this.getFirstLetter(projectName);
            const projectYear = '20' + projectNumber.substring(0, 2);
            
            // Determine server location
            const serverPath = path.join(
              this.config.serverPaths.currentYear,
              `${projectYear} Projects`,
              firstLetter,
              projectName,
              projectNumber
            );
            
            // Copy to server
            await fs.copy(folderPath, serverPath);
            
            // Move to uploaded folder
            await fs.move(folderPath, path.join(uploadedPath, folder));
            uploadCount++;
          }
        }
      }
      
      // Clean up old uploads if more than 50
      const uploadedFolders = await fs.readdir(uploadedPath);
      if (uploadedFolders.length > 50) {
        // Note: In a real application, you'd ask user for confirmation
        for (const folder of uploadedFolders) {
          await fs.remove(path.join(uploadedPath, folder));
        }
      }
      
      return {
        success: true,
        message: `Successfully uploaded ${uploadCount} projects`,
        uploadCount
      };
      
    } catch (error) {
      console.error('Error uploading triages:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Open DAS Board
  async openDASBoard(regionalTeam) {
    try {
      const urls = {
        'All': [
          'https://docs.google.com/spreadsheets/d/1CH6K1F9x0DaykRw8iqXIxgno6AyuUiamsP6jfDajr-I/edit#gid=623352875',
          'https://docs.google.com/spreadsheets/d/1jN9flngikc2l5ElKuSDP00vDkMlgUELWaDw4Z1cVdls/edit#gid=623352875',
          'https://docs.google.com/spreadsheets/d/1J1kTrRkM9PCq--kGqidi4uTVyoXjR7hZLzyAsOkYEJY/edit#gid=623352875',
          'https://docs.google.com/spreadsheets/d/18TZqMxdecK1VlKkOpmZMErypDBlipT6VoKma4dSqyGQ/edit#gid=623352875'
        ],
        'Ontario': ['https://docs.google.com/spreadsheets/d/1CH6K1F9x0DaykRw8iqXIxgno6AyuUiamsP6jfDajr-I/edit#gid=623352875'],
        'Conyers': ['https://docs.google.com/spreadsheets/d/1J1kTrRkM9PCq--kGqidi4uTVyoXjR7hZLzyAsOkYEJY/edit#gid=623352875'],
        'Chicago': ['https://docs.google.com/spreadsheets/d/1jN9flngikc2l5ElKuSDP00vDkMlgUELWaDw4Z1cVdls/edit#gid=623352875'],
        'IA': ['https://docs.google.com/spreadsheets/d/18TZqMxdecK1VlKkOpmZMErypDBlipT6VoKma4dSqyGQ/edit#gid=623352875']
      };
      
      const teamUrls = urls[regionalTeam] || urls['All'];
      
      // Open URLs in default browser
      const { shell } = require('electron');
      for (const url of teamUrls) {
        await shell.openExternal(url);
      }
      
      return {
        success: true,
        message: `Opened ${teamUrls.length} DAS Board(s)`,
        urls: teamUrls
      };
      
    } catch (error) {
      console.error('Error opening DAS Board:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ProjectService;
