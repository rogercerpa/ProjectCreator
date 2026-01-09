// DASGeneralService - Handles DAS General data Excel read/write operations
const fs = require('fs-extra');
const path = require('path');
const XLSX = require('xlsx');

class DASGeneralService {
  constructor(settingsService) {
    this.settingsService = settingsService;
    this.defaultFilePath = 'Z:\\DAS References\\ProjectCreatorV5\\DASGeneral.xlsx';
    
    // Default products list
    this.defaultProducts = [
      'nLight Wired',
      'nLight Air',
      'SensorSwitch',
      'Pathway',
      'Fresco',
      'IOTA'
    ];
  }

  /**
   * Get the configured file path from settings or use default
   */
  async getFilePath() {
    try {
      if (this.settingsService) {
        const settings = await this.settingsService.getSettings();
        if (settings?.dasGeneralSettings?.filePath) {
          return settings.dasGeneralSettings.filePath;
        }
      }
      return this.defaultFilePath;
    } catch (error) {
      console.warn('Error getting DAS General file path from settings:', error);
      return this.defaultFilePath;
    }
  }

  /**
   * Validate and normalize file path
   */
  async validateFilePath(filePath) {
    try {
      if (!filePath || !filePath.trim()) {
        return { isValid: false, error: 'File path is required' };
      }

      // Remove any surrounding quotes
      let normalizedPath = filePath.trim().replace(/^["']|["']$/g, '');

      // Check if path ends with .xlsx or .xls
      const ext = path.extname(normalizedPath).toLowerCase();
      if (!['.xlsx', '.xls'].includes(ext)) {
        return { 
          isValid: false, 
          error: 'File path must end with .xlsx or .xls extension' 
        };
      }

      return { isValid: true, path: normalizedPath };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Check if file exists and is accessible
   */
  async checkFileAccess(filePath) {
    try {
      const normalizedPath = filePath || await this.getFilePath();
      
      // Check if file exists
      const exists = await fs.pathExists(normalizedPath);
      if (!exists) {
        return { 
          success: false, 
          error: 'FILE_NOT_FOUND',
          message: `File not found at: ${normalizedPath}. Would you like to create a new file?`
        };
      }

      // Check if we can read the file
      try {
        await fs.access(normalizedPath, fs.constants.R_OK | fs.constants.W_OK);
      } catch (accessError) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'Permission denied. Please check that you have read/write access to this file.'
        };
      }

      // Try to read the file to check if it's locked
      try {
        const workbook = XLSX.readFile(normalizedPath);
        return { success: true, message: 'File is accessible', sheetNames: workbook.SheetNames };
      } catch (readError) {
        if (readError.code === 'EBUSY' || readError.message.includes('EBUSY')) {
          return {
            success: false,
            error: 'FILE_LOCKED',
            message: 'File is currently open in another application. Please close it and try again.'
          };
        }
        throw readError;
      }
    } catch (error) {
      // Check for network errors
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        return {
          success: false,
          error: 'PATH_NOT_FOUND',
          message: `The path does not exist. Please check if the network drive is connected.`
        };
      }
      if (error.code === 'ENETUNREACH' || error.code === 'ETIMEDOUT') {
        return {
          success: false,
          error: 'NETWORK_ERROR',
          message: 'Cannot reach the network drive. Please check your network connection.'
        };
      }
      return {
        success: false,
        error: 'UNKNOWN_ERROR',
        message: `Error accessing file: ${error.message}`
      };
    }
  }

  /**
   * Create a new Excel file with default structure
   */
  async createNewFile(filePath) {
    try {
      const normalizedPath = filePath || await this.getFilePath();
      
      // Ensure directory exists
      const dir = path.dirname(normalizedPath);
      await fs.ensureDir(dir);

      // Create workbook with sheets
      const workbook = XLSX.utils.book_new();

      // Sheet 1: TeamMembers
      const teamMembersData = [
        ['Name', 'Email', 'Role', 'PhoneNumber'],
        // Default empty row as placeholder
      ];
      const teamMembersSheet = XLSX.utils.aoa_to_sheet(teamMembersData);
      XLSX.utils.book_append_sheet(workbook, teamMembersSheet, 'TeamMembers');

      // Sheet 2: TrainingMaterial
      const trainingMaterialData = [
        ['Product', 'LinkType', 'Link', 'Description'],
        // Add default entries for each product
        ...this.defaultProducts.map(product => [product, 'URL', '', ''])
      ];
      const trainingMaterialSheet = XLSX.utils.aoa_to_sheet(trainingMaterialData);
      XLSX.utils.book_append_sheet(workbook, trainingMaterialSheet, 'TrainingMaterial');

      // Sheet 3: ProductsInfo
      const productsInfoData = [
        ['Product', 'MainPOC', 'POCEmail', 'ProductStrategy', 'DesignPracticeType', 'DesignPracticeContent'],
        // Add default entries for each product
        ...this.defaultProducts.map(product => [product, '', '', '', 'Text', ''])
      ];
      const productsInfoSheet = XLSX.utils.aoa_to_sheet(productsInfoData);
      XLSX.utils.book_append_sheet(workbook, productsInfoSheet, 'ProductsInfo');

      // Sheet 4: Products (dynamic product list)
      const productsData = [
        ['ProductName'],
        ...this.defaultProducts.map(product => [product])
      ];
      const productsSheet = XLSX.utils.aoa_to_sheet(productsData);
      XLSX.utils.book_append_sheet(workbook, productsSheet, 'Products');

      // Write the file
      XLSX.writeFile(workbook, normalizedPath);

      console.log(`✅ Created new DAS General file at: ${normalizedPath}`);
      return { success: true, filePath: normalizedPath };
    } catch (error) {
      console.error('Error creating DAS General file:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load all data from the Excel file
   */
  async loadAllData(filePath) {
    try {
      const normalizedPath = filePath || await this.getFilePath();
      
      // Check file access first
      const accessCheck = await this.checkFileAccess(normalizedPath);
      if (!accessCheck.success) {
        return accessCheck;
      }

      const workbook = XLSX.readFile(normalizedPath);
      
      // Load Team Members
      const teamMembers = this.loadSheetData(workbook, 'TeamMembers', ['name', 'email', 'role', 'phoneNumber']);
      
      // Load Training Material
      const trainingMaterial = this.loadSheetData(workbook, 'TrainingMaterial', ['product', 'linkType', 'link', 'description']);
      
      // Load Products Info
      const productsInfo = this.loadSheetData(workbook, 'ProductsInfo', ['product', 'mainPOC', 'pocEmail', 'productStrategy', 'designPracticeType', 'designPracticeContent']);
      
      // Load Products list
      const products = this.loadSheetData(workbook, 'Products', ['productName']);
      const productsList = products.map(p => p.productName).filter(Boolean);

      return {
        success: true,
        data: {
          teamMembers,
          trainingMaterial,
          productsInfo,
          products: productsList.length > 0 ? productsList : this.defaultProducts
        },
        lastLoaded: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error loading DAS General data:', error);
      
      // Provide specific error messages
      if (error.code === 'EBUSY') {
        return {
          success: false,
          error: 'FILE_LOCKED',
          message: 'The Excel file is currently open in another application. Please close it and try again.'
        };
      }
      
      return {
        success: false,
        error: 'LOAD_ERROR',
        message: `Failed to load data: ${error.message}`
      };
    }
  }

  /**
   * Helper function to load data from a specific sheet
   */
  loadSheetData(workbook, sheetName, fieldNames) {
    try {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        console.warn(`Sheet "${sheetName}" not found in workbook`);
        return [];
      }

      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      // Skip header row and map to field names
      const data = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.every(cell => cell === undefined || cell === null || cell === '')) {
          continue; // Skip empty rows
        }
        
        const item = { id: `${sheetName.toLowerCase()}-${i}` };
        fieldNames.forEach((field, index) => {
          item[field] = row[index] !== undefined ? String(row[index]).trim() : '';
        });
        data.push(item);
      }
      
      return data;
    } catch (error) {
      console.error(`Error loading sheet "${sheetName}":`, error);
      return [];
    }
  }

  /**
   * Save all data to the Excel file
   * This is mandatory - changes are only persisted if export succeeds
   */
  async saveAllData(data, filePath) {
    try {
      const normalizedPath = filePath || await this.getFilePath();
      
      // Validate file path
      const validation = await this.validateFilePath(normalizedPath);
      if (!validation.isValid) {
        return { success: false, error: 'INVALID_PATH', message: validation.error };
      }

      // Validate that data object exists and has required properties
      if (!data || typeof data !== 'object') {
        return { success: false, error: 'INVALID_DATA', message: 'No data provided to save.' };
      }

      // Log what we're saving for debugging
      console.log('📝 Saving DAS General data:');
      console.log(`   - Team Members: ${(data.teamMembers || []).length} records`);
      console.log(`   - Training Material: ${(data.trainingMaterial || []).length} records`);
      console.log(`   - Products Info: ${(data.productsInfo || []).length} records`);
      console.log(`   - Products: ${(data.products || []).length} items`);

      // Ensure directory exists
      const dir = path.dirname(normalizedPath);
      await fs.ensureDir(dir);

      // Create workbook with all sheets
      const workbook = XLSX.utils.book_new();

      // Ensure all data arrays are valid
      const safeTeamMembers = Array.isArray(data.teamMembers) ? data.teamMembers : [];
      const safeTrainingMaterial = Array.isArray(data.trainingMaterial) ? data.trainingMaterial : [];
      const safeProductsInfo = Array.isArray(data.productsInfo) ? data.productsInfo : [];
      const safeProducts = Array.isArray(data.products) && data.products.length > 0 
        ? data.products 
        : this.defaultProducts;

      // Sheet 1: TeamMembers
      const teamMembersData = [
        ['Name', 'Email', 'Role', 'PhoneNumber'],
        ...safeTeamMembers.map(m => [
          m?.name || '', 
          m?.email || '', 
          m?.role || '', 
          m?.phoneNumber || ''
        ])
      ];
      const teamMembersSheet = XLSX.utils.aoa_to_sheet(teamMembersData);
      XLSX.utils.book_append_sheet(workbook, teamMembersSheet, 'TeamMembers');

      // Sheet 2: TrainingMaterial
      const trainingMaterialData = [
        ['Product', 'LinkType', 'Link', 'Description'],
        ...safeTrainingMaterial.map(t => [
          t?.product || '', 
          t?.linkType || 'URL', 
          t?.link || '', 
          t?.description || ''
        ])
      ];
      const trainingMaterialSheet = XLSX.utils.aoa_to_sheet(trainingMaterialData);
      XLSX.utils.book_append_sheet(workbook, trainingMaterialSheet, 'TrainingMaterial');

      // Sheet 3: ProductsInfo
      const productsInfoData = [
        ['Product', 'MainPOC', 'POCEmail', 'ProductStrategy', 'DesignPracticeType', 'DesignPracticeContent'],
        ...safeProductsInfo.map(p => [
          p?.product || '', 
          p?.mainPOC || '', 
          p?.pocEmail || '', 
          p?.productStrategy || '', 
          p?.designPracticeType || 'Text', 
          p?.designPracticeContent || ''
        ])
      ];
      const productsInfoSheet = XLSX.utils.aoa_to_sheet(productsInfoData);
      XLSX.utils.book_append_sheet(workbook, productsInfoSheet, 'ProductsInfo');

      // Sheet 4: Products (dynamic product list)
      const productsData = [
        ['ProductName'],
        ...safeProducts.map(p => [p || ''])
      ];
      const productsSheet = XLSX.utils.aoa_to_sheet(productsData);
      XLSX.utils.book_append_sheet(workbook, productsSheet, 'Products');

      // Write the file
      XLSX.writeFile(workbook, normalizedPath);

      console.log(`✅ Saved DAS General data to: ${normalizedPath}`);
      return { 
        success: true, 
        filePath: normalizedPath,
        savedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error saving DAS General data:', error);
      
      // Provide specific error messages
      if (error.code === 'EBUSY') {
        return {
          success: false,
          error: 'FILE_LOCKED',
          message: 'The Excel file is currently open in another application. Please close it and try again.'
        };
      }
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'Permission denied. Please check that you have write access to this location.'
        };
      }
      if (error.code === 'ENETUNREACH' || error.code === 'ETIMEDOUT') {
        return {
          success: false,
          error: 'NETWORK_ERROR',
          message: 'Cannot reach the network drive. Please check your network connection and try again.'
        };
      }
      
      return {
        success: false,
        error: 'SAVE_ERROR',
        message: `Failed to save data: ${error.message}`
      };
    }
  }

  /**
   * Save team members data
   */
  async saveTeamMembers(teamMembers, filePath) {
    try {
      // Load existing data first
      const existingData = await this.loadAllData(filePath);
      if (!existingData.success) {
        return existingData;
      }

      // Update team members and save
      const updatedData = {
        ...existingData.data,
        teamMembers
      };

      return await this.saveAllData(updatedData, filePath);
    } catch (error) {
      return { success: false, error: 'SAVE_ERROR', message: error.message };
    }
  }

  /**
   * Save training material data
   */
  async saveTrainingMaterial(trainingMaterial, filePath) {
    try {
      const existingData = await this.loadAllData(filePath);
      if (!existingData.success) {
        return existingData;
      }

      const updatedData = {
        ...existingData.data,
        trainingMaterial
      };

      return await this.saveAllData(updatedData, filePath);
    } catch (error) {
      return { success: false, error: 'SAVE_ERROR', message: error.message };
    }
  }

  /**
   * Save products info data
   */
  async saveProductsInfo(productsInfo, filePath) {
    try {
      const existingData = await this.loadAllData(filePath);
      if (!existingData.success) {
        return existingData;
      }

      const updatedData = {
        ...existingData.data,
        productsInfo
      };

      return await this.saveAllData(updatedData, filePath);
    } catch (error) {
      return { success: false, error: 'SAVE_ERROR', message: error.message };
    }
  }

  /**
   * Add a new product to the products list
   */
  async addProduct(productName, filePath) {
    try {
      const existingData = await this.loadAllData(filePath);
      if (!existingData.success) {
        return existingData;
      }

      // Check if product already exists
      if (existingData.data.products.includes(productName)) {
        return {
          success: false,
          error: 'DUPLICATE_PRODUCT',
          message: `Product "${productName}" already exists.`
        };
      }

      // Add to products list
      const updatedProducts = [...existingData.data.products, productName];

      // Add default entries for the new product in other sheets
      const updatedTrainingMaterial = [
        ...existingData.data.trainingMaterial,
        {
          id: `trainingmaterial-new-${Date.now()}`,
          product: productName,
          linkType: 'URL',
          link: '',
          description: ''
        }
      ];

      const updatedProductsInfo = [
        ...existingData.data.productsInfo,
        {
          id: `productsinfo-new-${Date.now()}`,
          product: productName,
          mainPOC: '',
          pocEmail: '',
          productStrategy: '',
          designPracticeType: 'Text',
          designPracticeContent: ''
        }
      ];

      const updatedData = {
        ...existingData.data,
        products: updatedProducts,
        trainingMaterial: updatedTrainingMaterial,
        productsInfo: updatedProductsInfo
      };

      return await this.saveAllData(updatedData, filePath);
    } catch (error) {
      return { success: false, error: 'ADD_PRODUCT_ERROR', message: error.message };
    }
  }

  /**
   * Remove a product from the products list
   */
  async removeProduct(productName, filePath) {
    try {
      const existingData = await this.loadAllData(filePath);
      if (!existingData.success) {
        return existingData;
      }

      // Remove from products list
      const updatedProducts = existingData.data.products.filter(p => p !== productName);

      // Remove entries for this product from other sheets
      const updatedTrainingMaterial = existingData.data.trainingMaterial.filter(t => t.product !== productName);
      const updatedProductsInfo = existingData.data.productsInfo.filter(p => p.product !== productName);

      const updatedData = {
        ...existingData.data,
        products: updatedProducts,
        trainingMaterial: updatedTrainingMaterial,
        productsInfo: updatedProductsInfo
      };

      return await this.saveAllData(updatedData, filePath);
    } catch (error) {
      return { success: false, error: 'REMOVE_PRODUCT_ERROR', message: error.message };
    }
  }

  /**
   * Get settings for DAS General
   */
  async getSettings() {
    try {
      if (this.settingsService) {
        const settings = await this.settingsService.getSettings();
        return {
          success: true,
          settings: settings?.dasGeneralSettings || {
            filePath: this.defaultFilePath,
            autoRefresh: false,
            refreshInterval: 30000
          }
        };
      }
      return {
        success: true,
        settings: {
          filePath: this.defaultFilePath,
          autoRefresh: false,
          refreshInterval: 30000
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update settings for DAS General
   */
  async updateSettings(newSettings) {
    try {
      if (!this.settingsService) {
        return { success: false, error: 'Settings service not available' };
      }

      const currentSettings = await this.settingsService.getSettings();
      const updatedSettings = {
        ...currentSettings,
        dasGeneralSettings: {
          ...currentSettings.dasGeneralSettings,
          ...newSettings,
          lastUpdated: new Date().toISOString()
        }
      };

      await this.settingsService.saveSettings(updatedSettings);

      return { success: true, settings: updatedSettings.dasGeneralSettings };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = DASGeneralService;
