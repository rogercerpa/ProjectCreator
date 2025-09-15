// AgencyService - Handles agency data import, storage, and search functionality
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const XLSX = require('xlsx');

class AgencyService {
  constructor() {
    this.config = {
      dataDirectory: path.join(os.homedir(), '.project-creator'),
      agenciesFile: 'agencies.json',
      backupFile: 'agencies-backup.json'
    };
    
    this.initializeAgencySystem();
  }

  // Initialize agency data directory
  async initializeAgencySystem() {
    try {
      await fs.ensureDir(this.config.dataDirectory);
      
      // Initialize empty agencies file if it doesn't exist
      const agenciesPath = this.getDataFilePath(this.config.agenciesFile);
      if (!await fs.pathExists(agenciesPath)) {
        await this.saveAgencies([]);
      }
    } catch (error) {
      console.error('Error initializing agency system:', error);
    }
  }

  // Get full path for data file
  getDataFilePath(filename) {
    return path.join(this.config.dataDirectory, filename);
  }

  // Import agencies from Excel file
  async importFromExcel(filePath) {
    try {
      console.log('📁 Reading Excel file:', filePath);
      
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0]; // Use first sheet
      const worksheet = workbook.Sheets[sheetName];
      
      // Get the raw range to understand the sheet structure
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      console.log('📊 Sheet range:', range, 'Total rows:', range.e.r + 1, 'Total cols:', range.e.c + 1);
      
      // Try different approaches to read the Excel data
      let rawData = [];
      let headerRowIndex = -1;
      let actualHeaders = [];
      
      // Method 1: Try to find headers by examining cell values directly
      console.log('🔍 Searching for header row...');
      for (let row = range.s.r; row <= Math.min(range.s.r + 10, range.e.r); row++) {
        const rowHeaders = [];
        let hasValidHeaders = false;
        
        // Read each cell in this row
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          const cellValue = cell ? (cell.v || cell.w || '') : '';
          rowHeaders.push(cellValue);
          
          // Check if this looks like a header
          if (cellValue && typeof cellValue === 'string') {
            const headerLower = cellValue.toLowerCase();
            if (headerLower.includes('agency') || headerLower.includes('contact') || 
                headerLower.includes('name') || headerLower.includes('role') || 
                headerLower.includes('region') || headerLower.includes('email')) {
              hasValidHeaders = true;
            }
          }
        }
        
        console.log(`Row ${row + 1}:`, rowHeaders);
        
        if (hasValidHeaders && rowHeaders.filter(h => h && h.toString().trim()).length >= 3) {
          console.log(`✅ Found header row at row ${row + 1}`);
          headerRowIndex = row;
          actualHeaders = rowHeaders.filter(h => h && h.toString().trim());
          break;
        }
      }
      
      // If we found headers, read data starting from the next row
      if (headerRowIndex >= 0) {
        try {
          console.log(`📊 Reading data starting from row ${headerRowIndex + 2}`);
          
          // Create custom column headers from the header row
          const headerMapping = {};
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: col });
            const cell = worksheet[cellAddress];
            const cellValue = cell ? (cell.v || cell.w || '') : '';
            if (cellValue && cellValue.toString().trim()) {
              headerMapping[XLSX.utils.encode_col(col)] = cellValue.toString().trim();
            }
          }
          
          console.log('🗺️ Header mapping:', headerMapping);
          
          // Read data rows manually
          rawData = [];
          for (let row = headerRowIndex + 1; row <= range.e.r; row++) {
            const rowData = {};
            let hasData = false;
            
            for (let col = range.s.c; col <= range.e.c; col++) {
              const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
              const cell = worksheet[cellAddress];
              const cellValue = cell ? (cell.v || cell.w || '') : '';
              
              const columnLetter = XLSX.utils.encode_col(col);
              const headerName = headerMapping[columnLetter];
              
              if (headerName) {
                rowData[headerName] = cellValue;
                if (cellValue && cellValue.toString().trim()) {
                  hasData = true;
                }
              }
            }
            
            if (hasData) {
              rawData.push(rowData);
            }
          }
          
          console.log(`✅ Manually extracted ${rawData.length} rows with custom headers`);
          
        } catch (error) {
          console.error('Error in manual extraction:', error);
        }
      }
      
      // Fallback: Try standard XLSX reading methods
      if (rawData.length === 0) {
        console.log('🔍 Trying standard XLSX methods...');
        
        // Try different starting rows with standard method
        for (let startRow = 0; startRow <= 5; startRow++) {
          try {
            const testData = XLSX.utils.sheet_to_json(worksheet, { range: startRow });
            console.log(`Trying row ${startRow}:`, testData.length, 'rows found');
            if (testData.length > 0) {
              console.log('Sample data:', testData[0]);
              const headers = Object.keys(testData[0]);
              console.log('Headers:', headers);
              
              // Check if this looks like valid data
              if (headers.length > 2 && !headers.every(h => h.startsWith('__EMPTY'))) {
                rawData = testData;
                console.log(`✅ Using data from row ${startRow}, ${rawData.length} rows`);
                break;
              }
            }
          } catch (e) {
            console.log(`Failed to read from row ${startRow}:`, e.message);
          }
        }
      }
      
      console.log(`📊 Final data count: ${rawData.length} rows`);
      
      // Debug: Log the first few rows to see actual column names and data
      if (rawData.length > 0) {
        console.log('📋 Column headers found:', Object.keys(rawData[0]));
        console.log('📋 First row data:', rawData[0]);
        
        if (rawData.length > 1) {
          console.log('📋 Second row data:', rawData[1]);
        }
      }
      
      // Create a flexible column mapper
      const columnMapper = this.createColumnMapper(rawData.length > 0 ? Object.keys(rawData[0]) : []);
      console.log('🗺️ Column mapping:', columnMapper);
      
      // Transform the data to our format
      const agencies = rawData.map((row, index) => {
        const agency = {
          id: `agency-${Date.now()}-${index}`,
          agencyNumber: this.cleanValue(this.getColumnValue(row, columnMapper.agencyNumber)),
          agencyName: this.cleanValue(this.getColumnValue(row, columnMapper.agencyName)),
          contactName: this.cleanValue(this.getColumnValue(row, columnMapper.contactName)),
          contactEmail: this.cleanValue(this.getColumnValue(row, columnMapper.contactEmail)),
          phoneNumber: this.cleanValue(this.getColumnValue(row, columnMapper.phoneNumber)),
          role: this.cleanValue(this.getColumnValue(row, columnMapper.role)),
          region: this.cleanValue(this.getColumnValue(row, columnMapper.region)),
          mainContact: this.cleanValue(this.getColumnValue(row, columnMapper.mainContact)),
          sae: this.cleanValue(this.getColumnValue(row, columnMapper.sae)),
          // Optional fields that may not exist in your Excel
          rgpId: this.cleanValue(this.getColumnValue(row, columnMapper.rgpId)),
          fastService: this.cleanValue(this.getColumnValue(row, columnMapper.fastService)),
          textServiceStartDate: this.cleanValue(this.getColumnValue(row, columnMapper.textServiceStartDate)),
          importedAt: new Date().toISOString(),
          lastModified: new Date().toISOString()
        };
        
        // Debug log for first few agencies
        if (index < 3) {
          console.log(`📋 Agency ${index + 1}:`, agency);
        }
        
        return agency;
      }).filter(agency => agency.agencyName && agency.agencyName.trim()); // Filter out empty rows

      console.log(`✅ Processed ${agencies.length} valid agencies from ${rawData.length} total rows`);
      
      // If no agencies were processed, return detailed error with full diagnostic
      if (agencies.length === 0) {
        // Create detailed diagnostic information
        const diagnosticInfo = await this.createExcelDiagnostic(worksheet, rawData);
        
        return {
          success: false,
          error: 'No valid agencies found in Excel file',
          message: 'The Excel file was read but no agencies with valid names were found. Please check the column headers and data format.',
          debugInfo: {
            totalRows: rawData.length,
            columnHeaders: rawData.length > 0 ? Object.keys(rawData[0]) : [],
            columnMapping: columnMapper,
            sampleRow: rawData.length > 0 ? rawData[0] : null,
            diagnostic: diagnosticInfo
          }
        };
      }

      // Create backup of existing data
      await this.createBackup();

      // Save the imported agencies
      await this.saveAgencies(agencies);

      return {
        success: true,
        imported: agencies.length,
        agencies: agencies,
        message: `Successfully imported ${agencies.length} agencies`,
        debugInfo: {
          totalRows: rawData.length,
          validAgencies: agencies.length,
          columnMapping: columnMapper
        }
      };

    } catch (error) {
      console.error('Error importing Excel file:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to import Excel file: ' + error.message,
        stack: error.stack
      };
    }
  }

  // Create flexible column mapper based on actual Excel headers
  createColumnMapper(headers) {
    const mapper = {};
    
    // Helper function to find column by multiple possible names
    const findColumn = (possibleNames) => {
      for (const name of possibleNames) {
        const found = headers.find(header => 
          header.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(header.toLowerCase())
        );
        if (found) return found;
      }
      return null;
    };
    
    // Map each field to its possible column names - Updated for your exact Excel structure
    mapper.agencyNumber = findColumn(['Agency Number', 'Agency_Number', 'AgencyNumber', 'Number']);
    mapper.agencyName = findColumn(['Agency Name', 'Agency_Name', 'AgencyName', 'Name']);
    mapper.contactName = findColumn(['Contact Name', 'Contact_Name', 'ContactName', 'Contact']);
    mapper.contactEmail = findColumn(['Contact email', 'Contact_email', 'ContactEmail', 'Email']);
    mapper.phoneNumber = findColumn(['Contact Number', 'Phone Number', 'Phone_Number', 'PhoneNumber', 'Phone']);
    mapper.role = findColumn(['Role']);
    mapper.region = findColumn(['Region']);
    mapper.mainContact = findColumn(['Main Contact', 'Main_Contact', 'MainContact']);
    mapper.sae = findColumn(['SAE']);
    // These fields don't exist in your Excel but we'll keep them for compatibility
    mapper.rgpId = findColumn(['#RGP', 'RGP', 'RGP_ID', 'RGPID']);
    mapper.fastService = findColumn(['Fast Service', 'Fast_Service', 'FastService']);
    mapper.textServiceStartDate = findColumn(['Text Service Starting Date', 'Text_Service_Starting_Date', 'TextServiceStartDate']);
    
    return mapper;
  }

  // Get column value using the mapped column name
  getColumnValue(row, columnName) {
    if (!columnName) return '';
    return row[columnName];
  }

  // Check if a row looks like a header/metadata row rather than data
  isLikelyHeaderRow(row) {
    if (!row || typeof row !== 'object') return true;
    
    const values = Object.values(row);
    const keys = Object.keys(row);
    
    // Check for common header patterns
    const headerPatterns = [
      'Agency Information',
      'for all DAS',
      'Header',
      'Title',
      'Report',
      'Generated',
      'Date:'
    ];
    
    // If most values contain header-like text
    const headerLikeCount = values.filter(value => {
      if (!value) return false;
      const str = String(value).toLowerCase();
      return headerPatterns.some(pattern => str.includes(pattern.toLowerCase()));
    }).length;
    
    // If more than half the values look like headers, treat as header row
    if (headerLikeCount > values.length / 2) return true;
    
    // Check if all values are empty or very short (likely spacer row)
    const emptyOrShort = values.filter(value => !value || String(value).trim().length < 2).length;
    if (emptyOrShort === values.length) return true;
    
    // Check if we have suspiciously few columns (less than 3)
    if (keys.length < 3) return true;
    
    return false;
  }

  // Check if a row has valid agency data
  hasValidAgencyData(row) {
    if (!row || typeof row !== 'object') return false;
    
    const values = Object.values(row);
    const keys = Object.keys(row);
    
    // Must have reasonable number of columns
    if (keys.length < 3) return false;
    
    // Check for agency-like data patterns
    const hasAgencyName = values.some(value => {
      if (!value) return false;
      const str = String(value);
      // Look for company-like names (contains letters and reasonable length)
      return str.length > 5 && /[a-zA-Z]/.test(str) && !str.toLowerCase().includes('agency information');
    });
    
    const hasContactInfo = values.some(value => {
      if (!value) return false;
      const str = String(value);
      // Look for email or phone patterns
      return str.includes('@') || /\d{3}[\-\.\s]?\d{3}[\-\.\s]?\d{4}/.test(str);
    });
    
    // Must have either agency name or contact info to be considered valid
    return hasAgencyName || hasContactInfo;
  }

  // Clean and normalize data values
  cleanValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  // Create backup of current agencies
  async createBackup() {
    try {
      const agencies = await this.loadAgencies();
      const backupPath = this.getDataFilePath(this.config.backupFile);
      await fs.writeJson(backupPath, {
        agencies,
        backupDate: new Date().toISOString(),
        version: '1.0'
      }, { spaces: 2 });
      console.log('✅ Backup created successfully');
    } catch (error) {
      console.warn('Warning: Could not create backup:', error);
    }
  }

  // Save agencies to file
  async saveAgencies(agencies) {
    try {
      const agenciesPath = this.getDataFilePath(this.config.agenciesFile);
      const dataToSave = {
        agencies,
        lastUpdated: new Date().toISOString(),
        version: '1.0',
        totalCount: agencies.length
      };
      
      await fs.writeJson(agenciesPath, dataToSave, { spaces: 2 });
      console.log(`✅ Saved ${agencies.length} agencies to storage`);
      return { success: true };
    } catch (error) {
      console.error('Error saving agencies:', error);
      return { success: false, error: error.message };
    }
  }

  // Load all agencies
  async loadAgencies() {
    try {
      const agenciesPath = this.getDataFilePath(this.config.agenciesFile);
      
      if (!await fs.pathExists(agenciesPath)) {
        return [];
      }
      
      const data = await fs.readJson(agenciesPath);
      return Array.isArray(data.agencies) ? data.agencies : [];
    } catch (error) {
      console.error('Error loading agencies:', error);
      return [];
    }
  }

  // Search agencies with multiple criteria
  async searchAgencies(searchTerm = '', filters = {}) {
    try {
      const agencies = await this.loadAgencies();
      
      if (!searchTerm && !Object.keys(filters).length) {
        return agencies;
      }

      let results = agencies;

      // Apply text search across multiple fields
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        results = results.filter(agency => 
          (agency.agencyName && agency.agencyName.toLowerCase().includes(term)) ||
          (agency.contactName && agency.contactName.toLowerCase().includes(term)) ||
          (agency.contactEmail && agency.contactEmail.toLowerCase().includes(term)) ||
          (agency.phoneNumber && agency.phoneNumber.toLowerCase().includes(term)) ||
          (agency.role && agency.role.toLowerCase().includes(term)) ||
          (agency.region && agency.region.toLowerCase().includes(term)) ||
          (agency.mainContact && agency.mainContact.toLowerCase().includes(term)) ||
          (agency.agencyNumber && agency.agencyNumber.toLowerCase().includes(term))
        );
      }

      // Apply filters
      if (filters.region && filters.region !== 'all') {
        results = results.filter(agency => agency.region === filters.region);
      }

      if (filters.role && filters.role !== 'all') {
        results = results.filter(agency => agency.role === filters.role);
      }

      if (filters.fastService && filters.fastService !== 'all') {
        results = results.filter(agency => agency.fastService === filters.fastService);
      }

      if (filters.sae && filters.sae !== 'all') {
        results = results.filter(agency => agency.sae === filters.sae);
      }

      return results;
    } catch (error) {
      console.error('Error searching agencies:', error);
      return [];
    }
  }

  // Get unique values for filter dropdowns
  async getFilterOptions() {
    try {
      const agencies = await this.loadAgencies();
      
      const regions = [...new Set(agencies.map(a => a.region).filter(Boolean))].sort();
      const roles = [...new Set(agencies.map(a => a.role).filter(Boolean))].sort();
      const fastServiceOptions = [...new Set(agencies.map(a => a.fastService).filter(Boolean))].sort();
      const saeOptions = [...new Set(agencies.map(a => a.sae).filter(Boolean))].sort();

      return {
        regions,
        roles,
        fastServiceOptions,
        saeOptions
      };
    } catch (error) {
      console.error('Error getting filter options:', error);
      return {
        regions: [],
        roles: [],
        fastServiceOptions: [],
        saeOptions: []
      };
    }
  }

  // Add new agency
  async addAgency(agencyData) {
    try {
      const agencies = await this.loadAgencies();
      
      const newAgency = {
        id: `agency-${Date.now()}`,
        ...agencyData,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };

      agencies.push(newAgency);
      await this.saveAgencies(agencies);

      return {
        success: true,
        agency: newAgency,
        message: 'Agency added successfully'
      };
    } catch (error) {
      console.error('Error adding agency:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Update existing agency
  async updateAgency(agencyId, updates) {
    try {
      const agencies = await this.loadAgencies();
      const index = agencies.findIndex(a => a.id === agencyId);

      if (index === -1) {
        return {
          success: false,
          error: 'Agency not found'
        };
      }

      agencies[index] = {
        ...agencies[index],
        ...updates,
        lastModified: new Date().toISOString()
      };

      await this.saveAgencies(agencies);

      return {
        success: true,
        agency: agencies[index],
        message: 'Agency updated successfully'
      };
    } catch (error) {
      console.error('Error updating agency:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Delete agency
  async deleteAgency(agencyId) {
    try {
      const agencies = await this.loadAgencies();
      const filteredAgencies = agencies.filter(a => a.id !== agencyId);

      if (filteredAgencies.length === agencies.length) {
        return {
          success: false,
          error: 'Agency not found'
        };
      }

      await this.saveAgencies(filteredAgencies);

      return {
        success: true,
        message: 'Agency deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting agency:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Export agencies to Excel
  async exportToExcel(outputPath) {
    try {
      const agencies = await this.loadAgencies();

      // Create workbook
      const workbook = XLSX.utils.book_new();
      
      // Prepare data for export
      const exportData = agencies.map(agency => ({
        'Agency Number': agency.agencyNumber,
        'Agency Name': agency.agencyName,
        'Contact Name': agency.contactName,
        'Contact Email': agency.contactEmail,
        'Phone Number': agency.phoneNumber,
        'Role': agency.role,
        'Region': agency.region,
        '#RGP': agency.rgpId,
        'SAE': agency.sae,
        'Fast Service': agency.fastService,
        'Text Service Starting Date': agency.textServiceStartDate,
        'Last Modified': agency.lastModified
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Agencies');

      // Write file
      XLSX.writeFile(workbook, outputPath);

      return {
        success: true,
        message: `Exported ${agencies.length} agencies to ${outputPath}`
      };
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get agency statistics
  async getStatistics() {
    try {
      const agencies = await this.loadAgencies();
      const filterOptions = await this.getFilterOptions();

      return {
        totalAgencies: agencies.length,
        byRegion: this.countByField(agencies, 'region'),
        byRole: this.countByField(agencies, 'role'),
        byFastService: this.countByField(agencies, 'fastService'),
        bySAE: this.countByField(agencies, 'sae'),
        lastUpdated: agencies.length > 0 ? Math.max(...agencies.map(a => new Date(a.lastModified || a.importedAt))) : null
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      return {
        totalAgencies: 0,
        byRegion: {},
        byRole: {},
        byFastService: {},
        bySAE: {},
        lastUpdated: null
      };
    }
  }

  // Helper function to count by field
  countByField(agencies, field) {
    return agencies.reduce((counts, agency) => {
      const value = agency[field] || 'Unknown';
      counts[value] = (counts[value] || 0) + 1;
      return counts;
    }, {});
  }

  // Create detailed Excel diagnostic information
  async createExcelDiagnostic(worksheet, rawData) {
    try {
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      const diagnostic = {
        sheetInfo: {
          totalRows: range.e.r + 1,
          totalCols: range.e.c + 1,
          range: range
        },
        rowAnalysis: []
      };

      // Analyze first 10 rows
      for (let row = range.s.r; row <= Math.min(range.s.r + 9, range.e.r); row++) {
        const rowData = [];
        let hasContent = false;

        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          const cellValue = cell ? (cell.v || cell.w || '') : '';
          rowData.push(cellValue);
          if (cellValue && cellValue.toString().trim()) {
            hasContent = true;
          }
        }

        diagnostic.rowAnalysis.push({
          rowNumber: row + 1,
          hasContent,
          data: rowData,
          nonEmptyCount: rowData.filter(v => v && v.toString().trim()).length
        });
      }

      return diagnostic;
    } catch (error) {
      return { error: error.message };
    }
  }
}

module.exports = AgencyService;
