/**
 * BOMParserService
 * Parses BOM (Bill of Materials) files from Visual Controls
 * Supports both CSV (preferred) and XML formats
 * 
 * CSV includes startup costs as service line items
 * XML includes project header info but no pricing
 */

const fs = require('fs-extra');
const path = require('path');
const { PRODUCTS } = require('../constants/Products');

/**
 * Mapping of TYPE codes to product families
 * Based on analysis of Visual Controls export formats
 */
const TYPE_TO_PRODUCT_FAMILY = {
  // nLight Wired - Ceiling Mount Sensors
  'nCP10': 'nLight Wired',
  'nCP9': 'nLight Wired',
  'nCMADC': 'nLight Wired',
  'nCMADZ': 'nLight Wired',
  
  // nLight Wired - Wallpods
  'n$': 'nLight Wired',
  'n$XP': 'nLight Wired',
  '$K': 'nLight Wired',
  'nTCH': 'nLight Wired',
  
  // nLight Wired - Power Packs
  'nP': 'nLight Wired',
  'nPD': 'nLight Wired',
  'nPA': 'nLight Wired',
  'nPE': 'nLight Wired',
  'nPER': 'nLight Wired',
  'nPDER': 'nLight Wired',
  'nPPLB': 'nLight Wired',
  
  // nLight Wired - Power Supplies
  'nPS80': 'nLight Wired',
  'nPS150': 'nLight Wired',
  
  // nLight Wired - Bridges & Network
  'nBG': 'nLight Wired',
  'nECYBAGN': 'nLight Wired',
  
  // nLight Wired - Corner/Wall Mount Sensors
  'nWVP16': 'nLight Wired',
  
  // nLight Wired - DMX
  'nPWDMXSNPSHTENC': 'nLight Wired',
  
  // nLight Wired - Relay Panels (ARP)
  'ARP8': 'nLight Wired',
  'ARP16': 'nLight Wired',
  'ARP24': 'nLight Wired',
  'ARP32': 'nLight Wired',
  'ARP48': 'nLight Wired',
  'ARPPC': 'nLight Wired',
  
  // SensorSwitch - Wall Sensors
  '$XP': 'SensorSwitch',
  'WSX': 'SensorSwitch',
  
  // SensorSwitch - Ceiling Sensors
  'CM': 'SensorSwitch',
  'CMR': 'SensorSwitch',
  
  // nLight Air
  'nAIR': 'nLight Air',
  'NAIR': 'nLight Air',
  
  // SensorSwitch Air
  'SSA': 'SensorSwitch Air',
  
  // Fresco
  'FRS': 'Fresco',
  'FRESCO': 'Fresco',
  
  // Pathway
  'PTH': 'Pathway',
  'PATHWAY': 'Pathway',
  
  // DALI
  'DALI': 'DALI',
  
  // BACnet
  'BAC': 'BACnet',
  'BACNET': 'BACnet',
  
  // Cables (categorized separately)
  'CAT5 nLight': 'Wiring',
  'CAT5': 'Wiring',
  'CAT6': 'Wiring'
};

/**
 * Manufacturer to product family fallback mapping
 */
const MFG_TO_PRODUCT_FAMILY = {
  'nLight': 'nLight Wired',
  'Sensor Switch': 'SensorSwitch',
  'SensorSwitch': 'SensorSwitch',
  'Synergy': 'nLight Wired',
  'Fresco': 'Fresco',
  'Pathway': 'Pathway',
  'Pharos': 'Pharos'
};

class BOMParserService {
  constructor() {
    this.supportedFormats = ['csv', 'xml'];
  }

  /**
   * Select the best BOM file from a BOM CHECK folder
   * Prefers CSV (has startup costs), falls back to XML
   * @param {string} bomCheckFolder - Path to BOM CHECK folder
   * @returns {object|null} { path, type } or null if no BOM files found
   */
  async selectBOMFile(bomCheckFolder) {
    try {
      if (!await fs.pathExists(bomCheckFolder)) {
        console.log(`BOM CHECK folder not found: ${bomCheckFolder}`);
        return null;
      }

      const files = await fs.readdir(bomCheckFolder);
      const csvFiles = files.filter(f => f.toLowerCase().endsWith('.csv'));
      const xmlFiles = files.filter(f => f.toLowerCase().endsWith('.xml'));

      // Prefer CSV as it has startup costs
      if (csvFiles.length > 0) {
        const latestCSV = await this.getMostRecentFile(bomCheckFolder, csvFiles);
        console.log(`Selected CSV file: ${latestCSV}`);
        return { path: latestCSV, type: 'csv' };
      }

      // Fallback to XML
      if (xmlFiles.length > 0) {
        const latestXML = await this.getMostRecentFile(bomCheckFolder, xmlFiles);
        console.log(`Selected XML file (fallback): ${latestXML}`);
        return { path: latestXML, type: 'xml' };
      }

      console.log(`No BOM files found in: ${bomCheckFolder}`);
      return null;
    } catch (error) {
      console.error('Error selecting BOM file:', error);
      return null;
    }
  }

  /**
   * Get the most recently modified file from a list
   * @param {string} folder - Folder path
   * @param {string[]} files - Array of filenames
   * @returns {string} Full path to most recent file
   */
  async getMostRecentFile(folder, files) {
    let mostRecent = null;
    let mostRecentTime = 0;

    for (const file of files) {
      const filePath = path.join(folder, file);
      try {
        const stats = await fs.stat(filePath);
        if (stats.mtimeMs > mostRecentTime) {
          mostRecentTime = stats.mtimeMs;
          mostRecent = filePath;
        }
      } catch (error) {
        console.error(`Error getting stats for ${filePath}:`, error);
      }
    }

    return mostRecent || path.join(folder, files[0]);
  }

  /**
   * Parse a BOM file (auto-detects format)
   * @param {object} fileInfo - { path, type } from selectBOMFile
   * @returns {object} Parsed BOM data
   */
  async parse(fileInfo) {
    if (!fileInfo || !fileInfo.path) {
      throw new Error('Invalid file info provided');
    }

    const content = await fs.readFile(fileInfo.path, 'utf8');
    const fileName = path.basename(fileInfo.path);

    if (fileInfo.type === 'csv') {
      return this.parseCSV(content, fileName);
    } else if (fileInfo.type === 'xml') {
      return this.parseXML(content, fileName);
    } else {
      throw new Error(`Unsupported file type: ${fileInfo.type}`);
    }
  }

  /**
   * Parse CSV BOM file
   * @param {string} content - CSV content
   * @param {string} fileName - Original filename
   * @returns {object} Parsed BOM data
   */
  parseCSV(content, fileName) {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }

    // Parse header row
    const headers = this.parseCSVLine(lines[0]);
    const headerMap = this.mapHeaders(headers);

    const devices = [];
    const wires = [];
    const serviceCosts = {
      systemStartup: 0,
      onsiteTraining: 0,
      preconstructionMeeting: 0,
      other: 0,
      total: 0
    };

    let currentSection = 'devices'; // devices, wires, or services
    let currentPhase = null;
    const phases = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const lineCategory = values[headerMap.lineCategory] || '';
      const qty = parseInt(values[headerMap.qty]) || 0;
      const catalogNumber = values[headerMap.catalogNumber] || '';
      const lineComments = values[headerMap.lineComments] || '';
      const type = values[headerMap.type] || '';
      const pricingValue = parseFloat(values[headerMap.pricing]) || 0;

      // Check for section headers
      if (lineCategory === 'Group Header') {
        const lowerCat = catalogNumber.toLowerCase();
        if (lowerCat === 'wires') {
          currentSection = 'wires';
          continue;
        }
        if (lowerCat === 'services' || lowerCat === 'service') {
          currentSection = 'services';
          continue;
        }
        // Any other Group Header is a phase/section label
        currentPhase = catalogNumber.trim() || null;
        if (currentPhase && !phases.includes(currentPhase)) {
          phases.push(currentPhase);
        }
        continue;
      }

      // Handle service rows (startup costs)
      if (lineCategory === 'Service') {
        this.parseServiceRow(catalogNumber, pricingValue, serviceCosts);
        continue;
      }

      // Skip empty rows or header rows
      if (!catalogNumber || catalogNumber === 'Catalog #') continue;

      // Determine product family
      const productFamily = this.mapTypeToProductFamily(type, null, catalogNumber);

      const item = {
        catalogNumber,
        quantity: qty,
        description: lineComments,
        type,
        productFamily,
        phase: currentPhase
      };

      if (currentSection === 'wires' || type.startsWith('CAT5') || type.startsWith('CAT6')) {
        wires.push(item);
      } else {
        devices.push(item);
      }
    }

    // Calculate totals
    const totalDevices = devices.reduce((sum, d) => sum + d.quantity, 0);
    const totalWireItems = wires.reduce((sum, w) => sum + w.quantity, 0);
    serviceCosts.total = serviceCosts.systemStartup + serviceCosts.onsiteTraining + 
                         serviceCosts.preconstructionMeeting + serviceCosts.other;

    // Build product family summary
    const productFamilySummary = this.buildProductFamilySummary(devices);

    return {
      sourceFile: fileName,
      sourceType: 'csv',
      importedAt: new Date().toISOString(),
      totalDevices,
      totalLineItems: devices.length,
      totalWireItems,
      wireLineItems: wires.length,
      startupCosts: serviceCosts,
      productFamilySummary,
      phases,
      isMultiPhase: phases.length > 1,
      devices,
      wires
    };
  }

  /**
   * Parse a single CSV line handling quoted values
   * @param {string} line - CSV line
   * @returns {string[]} Array of values
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Don't forget the last value
    values.push(current.trim());
    
    return values;
  }

  /**
   * Map CSV headers to expected column indices
   * @param {string[]} headers - Header row values
   * @returns {object} Column index map
   */
  mapHeaders(headers) {
    const map = {
      lineCategory: 0,
      qty: 1,
      catalogNumber: 2,
      lineComments: 3,
      type: 4,
      pricing: 5
    };

    // Try to find headers by name (case-insensitive)
    headers.forEach((header, index) => {
      const h = header.toLowerCase().trim();
      if (h === 'line category') map.lineCategory = index;
      else if (h === 'qty' || h === 'quantity') map.qty = index;
      else if (h === 'catalog #' || h === 'catalog number' || h === 'catalogno') map.catalogNumber = index;
      else if (h === 'line comments' || h === 'description') map.lineComments = index;
      else if (h === 'type') map.type = index;
    });

    return map;
  }

  /**
   * Parse a service row and update costs
   * @param {string} catalogNumber - Service name
   * @param {number} price - Service price
   * @param {object} serviceCosts - Costs object to update
   */
  parseServiceRow(catalogNumber, price, serviceCosts) {
    const serviceName = catalogNumber.toUpperCase();
    
    if (serviceName.includes('STARTUP')) {
      serviceCosts.systemStartup += price;
    } else if (serviceName.includes('TRAINING')) {
      serviceCosts.onsiteTraining += price;
    } else if (serviceName.includes('PRECONSTRUCTION') || serviceName.includes('PRE-CONSTRUCTION')) {
      serviceCosts.preconstructionMeeting += price;
    } else {
      serviceCosts.other += price;
    }
  }

  /**
   * Parse XML BOM file
   * @param {string} content - XML content
   * @param {string} fileName - Original filename
   * @returns {object} Parsed BOM data
   */
  parseXML(content, fileName) {
    // Simple XML parsing without external dependencies
    const devices = [];
    const wires = [];

    // Extract project header info
    const projectId = this.extractXMLValue(content, 'PROJECTID');
    const jobName = this.extractXMLValue(content, 'JOBNAME');
    const importSource = this.extractXMLValue(content, 'IMPORTSOURCE');

    // Extract all QUOTELINE elements
    const quoteLineRegex = /<QUOTELINE>([\s\S]*?)<\/QUOTELINE>/g;
    let match;

    while ((match = quoteLineRegex.exec(content)) !== null) {
      const lineContent = match[1];
      
      const type = this.extractXMLValue(lineContent, 'TYPE');
      const quantity = parseInt(this.extractXMLValue(lineContent, 'QUANTITY')) || 0;
      const catalogNumber = this.extractXMLValue(lineContent, 'DESCRIPTION');
      const description = this.extractXMLValue(lineContent, 'LINECOMMENT');
      const manufacturer = this.extractXMLValue(lineContent, 'MFG');

      if (!catalogNumber) continue;

      const productFamily = this.mapTypeToProductFamily(type, manufacturer, catalogNumber);

      const item = {
        catalogNumber,
        quantity,
        description,
        type,
        manufacturer,
        productFamily
      };

      // Categorize as wire or device
      if (type.startsWith('CAT5') || type.startsWith('CAT6') || catalogNumber.startsWith('CAT5') || catalogNumber.startsWith('CAT6')) {
        wires.push(item);
      } else {
        devices.push(item);
      }
    }

    // Calculate totals
    const totalDevices = devices.reduce((sum, d) => sum + d.quantity, 0);
    const totalWireItems = wires.reduce((sum, w) => sum + w.quantity, 0);

    // Build product family summary
    const productFamilySummary = this.buildProductFamilySummary(devices);

    return {
      sourceFile: fileName,
      sourceType: 'xml',
      importedAt: new Date().toISOString(),
      projectId,
      jobName,
      importSource,
      totalDevices,
      totalLineItems: devices.length,
      totalWireItems,
      wireLineItems: wires.length,
      startupCosts: null, // XML doesn't have pricing
      productFamilySummary,
      devices,
      wires
    };
  }

  /**
   * Extract a value from XML content by tag name
   * @param {string} content - XML content
   * @param {string} tagName - Tag name to extract
   * @returns {string} Extracted value or empty string
   */
  extractXMLValue(content, tagName) {
    const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Map TYPE code to product family
   * @param {string} type - TYPE code from BOM
   * @param {string} manufacturer - Manufacturer name (for fallback)
   * @param {string} catalogNumber - Catalog number (for additional context)
   * @returns {string} Product family name
   */
  mapTypeToProductFamily(type, manufacturer, catalogNumber) {
    // First try exact type match
    if (type && TYPE_TO_PRODUCT_FAMILY[type]) {
      return TYPE_TO_PRODUCT_FAMILY[type];
    }

    // Try partial type match (for types with variations)
    if (type) {
      for (const [prefix, family] of Object.entries(TYPE_TO_PRODUCT_FAMILY)) {
        if (type.startsWith(prefix) || type.includes(prefix)) {
          return family;
        }
      }
    }

    // Fallback to manufacturer
    if (manufacturer && MFG_TO_PRODUCT_FAMILY[manufacturer]) {
      return MFG_TO_PRODUCT_FAMILY[manufacturer];
    }

    // Try to infer from catalog number
    if (catalogNumber) {
      const cn = catalogNumber.toUpperCase();
      if (cn.startsWith('N') || cn.includes('NLIGHT')) return 'nLight Wired';
      if (cn.includes('WSX') || cn.includes('SENSOR')) return 'SensorSwitch';
      if (cn.startsWith('CAT5') || cn.startsWith('CAT6')) return 'Wiring';
      if (cn.includes('ARP')) return 'nLight Wired';
      if (cn.includes('FRESCO')) return 'Fresco';
      if (cn.includes('PATHWAY')) return 'Pathway';
    }

    return 'Other';
  }

  /**
   * Build product family summary from devices
   * @param {object[]} devices - Array of device objects
   * @returns {object} Summary by product family
   */
  buildProductFamilySummary(devices) {
    const summary = {};

    for (const device of devices) {
      const family = device.productFamily || 'Other';
      
      if (!summary[family]) {
        summary[family] = {
          quantity: 0,
          lineItems: 0
        };
      }

      summary[family].quantity += device.quantity;
      summary[family].lineItems += 1;
    }

    return summary;
  }

  /**
   * Validate parsed BOM data
   * @param {object} bomData - Parsed BOM data
   * @returns {object} { valid, errors, warnings }
   */
  validateBOMData(bomData) {
    const errors = [];
    const warnings = [];

    if (!bomData) {
      errors.push('BOM data is null or undefined');
      return { valid: false, errors, warnings };
    }

    if (!bomData.devices || bomData.devices.length === 0) {
      warnings.push('No devices found in BOM');
    }

    if (bomData.totalDevices === 0) {
      warnings.push('Total device count is zero');
    }

    if (bomData.sourceType === 'xml' && !bomData.startupCosts) {
      warnings.push('XML format does not include startup costs - consider using CSV');
    }

    // Check for unmapped product families
    const unmappedDevices = bomData.devices?.filter(d => d.productFamily === 'Other') || [];
    if (unmappedDevices.length > 0) {
      warnings.push(`${unmappedDevices.length} device(s) could not be mapped to a product family`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Extract RFA number from folder path
   * @param {string} folderPath - Path containing RFA number
   * @returns {string|null} Extracted RFA number or null
   */
  extractRFAFromPath(folderPath) {
    // Try various RFA patterns
    const patterns = [
      /RFA#?(\d+-\d+)/i,           // RFA#246631-10 or RFA246631-10
      /RFA[#\-_]?(\d{6}-\d+)/i,    // Various separators
      /(\d{6}-\d+)/                 // Just the number pattern
    ];

    for (const pattern of patterns) {
      const match = folderPath.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Get available product families from PRODUCTS constant
   * @returns {string[]} Array of product family names
   */
  getProductFamilies() {
    return [...PRODUCTS, 'Wiring', 'Other'];
  }

  // =============================================
  // SMART BOM PATH RESOLUTION METHODS
  // =============================================

  /**
   * Resolve the best known path for a project's folder on DAS Drive
   * @param {object} project - Project data
   * @returns {object} { path, source, accessible }
   */
  async resolveProjectDASPath(project) {
    const results = [];

    // Priority 1: Explicit DAS upload path (most reliable for completed projects)
    if (project.dasUploadStatus?.uploadedPath) {
      const pathInfo = await this.checkPathAccessibility(project.dasUploadStatus.uploadedPath);
      results.push({
        path: project.dasUploadStatus.uploadedPath,
        source: 'dasUploadStatus',
        ...pathInfo
      });
      if (pathInfo.accessible) {
        return results[0];
      }
    }

    // Priority 2: QC folder downloaded path
    if (project.qcFolderDownloadedPath) {
      const pathInfo = await this.checkPathAccessibility(project.qcFolderDownloadedPath);
      results.push({
        path: project.qcFolderDownloadedPath,
        source: 'qcFolderDownloadedPath',
        ...pathInfo
      });
      if (pathInfo.accessible) {
        return results[results.length - 1];
      }
    }

    // Priority 3: Construct path from project metadata
    const constructedPath = this.constructDASPathFromProject(project);
    if (constructedPath) {
      const pathInfo = await this.checkPathAccessibility(constructedPath);
      results.push({
        path: constructedPath,
        source: 'constructed',
        ...pathInfo
      });
      if (pathInfo.accessible) {
        return results[results.length - 1];
      }
    }

    // Return best result (first accessible, or first non-accessible with reason)
    return results[0] || { path: null, source: null, accessible: false, reason: 'No path information available' };
  }

  /**
   * Construct DAS Drive path from project metadata
   * @param {object} project - Project data
   * @returns {string|null} Constructed path or null
   */
  constructDASPathFromProject(project) {
    if (!project.projectContainer || !project.projectName) {
      return null;
    }

    try {
      // Get year from container (e.g., "26-12345" -> "2026")
      const yearPrefix = project.projectContainer.substring(0, 2);
      const year = `20${yearPrefix}`;

      // Get first letter (sanitize project name)
      const sanitizedName = project.projectName
        .replace(/[\\/:_<>"|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
      
      const firstLetter = /^[A-Z]/.test(sanitizedName) ? sanitizedName[0] : '#';

      // Build folder name
      const folderName = `${sanitizedName}_${project.projectContainer}`;

      // Construct full path
      return path.join('Z:', `${year} Projects`, firstLetter, folderName);
    } catch (error) {
      console.error('Error constructing DAS path:', error);
      return null;
    }
  }

  /**
   * Check if a path is accessible
   * @param {string} targetPath - Path to check
   * @returns {object} { accessible, reason }
   */
  async checkPathAccessibility(targetPath) {
    try {
      if (!targetPath) {
        return { accessible: false, reason: 'Path is empty' };
      }

      const exists = await fs.pathExists(targetPath);
      if (!exists) {
        return { accessible: false, reason: 'Path does not exist' };
      }

      // Try to read directory to verify access
      await fs.readdir(targetPath);
      return { accessible: true, reason: 'Path is accessible' };
    } catch (error) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        return { accessible: false, reason: 'Access denied' };
      }
      if (error.code === 'ENOENT') {
        return { accessible: false, reason: 'Path does not exist' };
      }
      return { accessible: false, reason: `Error: ${error.message}` };
    }
  }

  /**
   * Recursively search for a BOM CHECK folder starting from the given path.
   * Walks the directory tree up to maxDepth levels deep.
   * @param {string} folderPath - Starting path
   * @param {number} maxDepth - Maximum recursion depth (default 5)
   * @param {number} currentDepth - Current depth (internal)
   * @returns {object|null} { bomCheckPath, bomFile, parentFolder } or null
   */
  async findBOMCheckRecursive(folderPath, maxDepth = 5, currentDepth = 0) {
    if (currentDepth > maxDepth) return null;

    try {
      const items = await fs.readdir(folderPath, { withFileTypes: true });
      const directories = items.filter(item => item.isDirectory());

      // Check if BOM CHECK exists at this level
      const bomCheckDir = directories.find(
        item => item.name.toUpperCase() === 'BOM CHECK'
      );

      if (bomCheckDir) {
        const bomCheckPath = path.join(folderPath, bomCheckDir.name);
        const bomFile = await this.selectBOMFile(bomCheckPath);
        if (bomFile) {
          // Determine the parent RFA folder name if applicable
          const parentName = path.basename(folderPath);
          const isRFAFolder = parentName.toUpperCase().includes('RFA');
          return {
            bomCheckPath,
            bomFile,
            parentFolder: folderPath,
            rfaFolderPath: isRFAFolder ? folderPath : null,
            rfaFolderName: isRFAFolder ? parentName : null
          };
        }
        // BOM CHECK folder exists but no valid files -- keep searching siblings
      }

      // Recurse into subdirectories (skip BOM CHECK itself)
      for (const subDir of directories) {
        if (subDir.name.toUpperCase() === 'BOM CHECK') continue;

        const result = await this.findBOMCheckRecursive(
          path.join(folderPath, subDir.name),
          maxDepth,
          currentDepth + 1
        );
        if (result) return result;
      }

      return null;
    } catch (error) {
      console.error(`Error scanning ${folderPath}:`, error.message);
      return null;
    }
  }

  /**
   * Find BOM CHECK folder within a project folder.
   * Recursively searches through any nesting of subfolders (wrapper folders,
   * RFA folders, etc.) up to 5 levels deep until a BOM CHECK directory with
   * valid CSV/XML files is found.
   * @param {string} projectFolderPath - Path to project folder (or RFA folder, or wrapper)
   * @param {string} rfaNumber - Optional RFA number (unused in recursive mode, kept for API compat)
   * @returns {object} { found, bomCheckPath, rfaFolderPath, bomFile }
   */
  async findBOMCheckInProject(projectFolderPath, rfaNumber = null) {
    try {
      if (!await fs.pathExists(projectFolderPath)) {
        return { found: false, reason: 'Project folder not found' };
      }

      console.log(`🔍 Searching for BOM CHECK recursively from: ${projectFolderPath}`);

      const result = await this.findBOMCheckRecursive(projectFolderPath);

      if (result) {
        console.log(`✓ Found BOM: ${result.bomFile.path}`);
        return {
          found: true,
          bomCheckPath: result.bomCheckPath,
          rfaFolderPath: result.rfaFolderPath || result.parentFolder,
          rfaFolderName: result.rfaFolderName || path.basename(result.parentFolder),
          bomFile: result.bomFile,
          reason: 'BOM file found'
        };
      }

      // Not found -- provide the best suggested path for manual fallback
      console.log(`❌ No BOM CHECK folder found under: ${projectFolderPath}`);
      return {
        found: false,
        rfaFolderPath: projectFolderPath,
        reason: 'No BOM CHECK folder found in project directory tree'
      };
    } catch (error) {
      console.error('Error finding BOM CHECK folder:', error);
      return { found: false, reason: `Error searching: ${error.message}` };
    }
  }

  /**
   * Get the most recently modified RFA folder
   * @param {string} projectFolderPath - Project folder path
   * @param {object[]} rfaFolders - Array of dirent objects for RFA folders
   * @returns {object|null} Most recent folder dirent or null
   */
  async getMostRecentRFAFolder(projectFolderPath, rfaFolders) {
    let mostRecent = null;
    let mostRecentTime = 0;

    for (const folder of rfaFolders) {
      try {
        const folderPath = path.join(projectFolderPath, folder.name);
        const stats = await fs.stat(folderPath);
        if (stats.mtimeMs > mostRecentTime) {
          mostRecentTime = stats.mtimeMs;
          mostRecent = folder;
        }
      } catch (error) {
        // Skip folders we can't stat
      }
    }

    return mostRecent;
  }

  /**
   * Smart BOM upload - attempts auto-detection, provides fallback info
   * @param {object} project - Project data
   * @returns {object} Result with bomData or fallback path info
   */
  async smartBOMUpload(project) {
    console.log(`🔍 Smart BOM Upload for project: ${project.projectName}`);

    // Step 1: Resolve the project's DAS path
    const pathResult = await this.resolveProjectDASPath(project);
    
    if (!pathResult.accessible) {
      console.log(`❌ Project path not accessible: ${pathResult.reason}`);
      return {
        success: false,
        autoImportFailed: true,
        reason: pathResult.reason,
        suggestedPath: pathResult.path,
        pathSource: pathResult.source,
        requiresManualSelection: true
      };
    }

    console.log(`✓ Project path found: ${pathResult.path} (source: ${pathResult.source})`);

    // Step 2: Find BOM CHECK folder
    const bomCheckResult = await this.findBOMCheckInProject(pathResult.path, project.rfaNumber);

    if (!bomCheckResult.found) {
      console.log(`❌ BOM not found: ${bomCheckResult.reason}`);
      return {
        success: false,
        autoImportFailed: true,
        reason: bomCheckResult.reason,
        projectPath: pathResult.path,
        suggestedPath: bomCheckResult.rfaFolderPath || pathResult.path,
        bomCheckPath: bomCheckResult.bomCheckPath,
        searchedFolders: bomCheckResult.searchedFolders,
        requiresManualSelection: true
      };
    }

    console.log(`✓ BOM file found: ${bomCheckResult.bomFile.path}`);

    // Step 3: Parse the BOM file
    try {
      const bomData = await this.parse(bomCheckResult.bomFile);
      const validation = this.validateBOMData(bomData);

      if (!validation.valid) {
        return {
          success: false,
          autoImportFailed: true,
          reason: `BOM parsing failed: ${validation.errors.join(', ')}`,
          bomFile: bomCheckResult.bomFile,
          suggestedPath: bomCheckResult.bomCheckPath,
          requiresManualSelection: true
        };
      }

      console.log(`✓ BOM parsed successfully: ${bomData.totalDevices} devices`);

      return {
        success: true,
        bomData,
        bomFile: bomCheckResult.bomFile,
        bomCheckPath: bomCheckResult.bomCheckPath,
        rfaFolderPath: bomCheckResult.rfaFolderPath,
        projectPath: pathResult.path,
        validation,
        requiresManualSelection: false
      };
    } catch (parseError) {
      console.error('Error parsing BOM file:', parseError);
      return {
        success: false,
        autoImportFailed: true,
        reason: `Failed to parse BOM file: ${parseError.message}`,
        bomFile: bomCheckResult.bomFile,
        suggestedPath: bomCheckResult.bomCheckPath,
        requiresManualSelection: true
      };
    }
  }
}

module.exports = BOMParserService;
