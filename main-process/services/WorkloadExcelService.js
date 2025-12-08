// WorkloadExcelService - Handles workload data Excel read/write operations with field mapping
const fs = require('fs-extra');
const path = require('path');
const XLSX = require('xlsx');

class WorkloadExcelService {
  constructor(fieldMappingService) {
    this.fieldMappingService = fieldMappingService;
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
        // If it's a directory, suggest adding filename
        try {
          const stats = await fs.stat(normalizedPath);
          if (stats.isDirectory()) {
            return { 
              isValid: false, 
              error: `Path is a directory. Please select a file (e.g., ${path.join(normalizedPath, 'ProjectWorkload.xlsx')})` 
            };
          }
        } catch (e) {
          // Path doesn't exist, might be new file - that's okay if it has .xlsx extension
          if (!normalizedPath.toLowerCase().endsWith('.xlsx') && !normalizedPath.toLowerCase().endsWith('.xls')) {
            return { 
              isValid: false, 
              error: 'File path must end with .xlsx or .xls extension' 
            };
          }
        }
      }

      // If file exists, check it's actually a file
      if (await fs.pathExists(normalizedPath)) {
        const stats = await fs.stat(normalizedPath);
        if (!stats.isFile()) {
          return { 
            isValid: false, 
            error: 'Path exists but is not a file. Please select an Excel file.' 
          };
        }
      }

      // Check if directory is writable (for new files)
      const dir = path.dirname(normalizedPath);
      try {
        await fs.ensureDir(dir);
        await fs.access(dir, fs.constants.W_OK);
      } catch (error) {
        return { 
          isValid: false, 
          error: `Cannot write to directory: ${error.message}` 
        };
      }

      return { isValid: true, path: normalizedPath };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Helper function to update cell value (without preserving styles to prevent file bloat)
   */
  updateCellValue(worksheet, row, col, value) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
    
    // Create simple cell without styles to prevent file bloat
    worksheet[cellAddress] = {
      v: value,
      t: typeof value === 'number' ? 'n' : (value === null || value === undefined ? 'z' : 's')
    };
  }

  /**
   * Trim worksheet range to only include rows and columns with actual data
   */
  trimWorksheetRange(worksheet) {
    if (!worksheet || !worksheet['!ref']) return;
    
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    let minRow = range.s.r;
    let maxRow = range.s.r;
    let minCol = range.s.c;
    let maxCol = range.s.c;
    
    // Find actual data bounds
    Object.keys(worksheet).forEach(key => {
      if (key.startsWith('!')) return; // Skip metadata
      
      const cell = XLSX.utils.decode_cell(key);
      if (cell.r < minRow) minRow = cell.r;
      if (cell.r > maxRow) maxRow = cell.r;
      if (cell.c < minCol) minCol = cell.c;
      if (cell.c > maxCol) maxCol = cell.c;
    });
    
    // Update range to only include actual data
    if (maxRow >= minRow && maxCol >= minCol) {
      worksheet['!ref'] = XLSX.utils.encode_range({
        s: { r: minRow, c: minCol },
        e: { r: maxRow, c: maxCol }
      });
    }
  }

  /**
   * Clean up workbook to remove unused styles and optimize file size
   */
  cleanupWorkbook(workbook) {
    // Remove styles object to prevent bloat
    if (workbook.Styles) {
      delete workbook.Styles;
    }
    
    // Clean up each worksheet
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) return;
      
      // Trim range to only include actual data
      this.trimWorksheetRange(worksheet);
      
      // Remove style references from all cells
      const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
      if (range) {
        for (let row = range.s.r; row <= range.e.r; row++) {
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];
            if (cell) {
              // Remove style reference to prevent bloat
              if (cell.s) delete cell.s;
              // Remove formatted text cache
              if (cell.w && cell.v) delete cell.w;
            }
          }
        }
      }
    });
  }

  /**
   * Initialize Excel workbook with template structure
   */
  async initializeWorkbook(filePath, fieldMapping) {
    try {
      // Create new workbook
      const workbook = XLSX.utils.book_new();

      // Create sheets with headers based on field mapping
      const sheets = ['projects', 'assignments', 'users', 'timeTracking'];
      const sheetNames = {
        projects: 'Projects',
        assignments: 'Assignments',
        users: 'Users',
        timeTracking: 'TimeTracking'
      };

      for (const sheet of sheets) {
        const headers = this.fieldMappingService.getExcelHeaders(fieldMapping[sheet]);
        const worksheet = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetNames[sheet]);
      }

      // Ensure directory exists
      await fs.ensureDir(path.dirname(filePath));

      // Clean up workbook to remove unused styles
      this.cleanupWorkbook(workbook);
      
      // Write workbook (styles already removed by cleanupWorkbook)
      XLSX.writeFile(workbook, filePath, { bookType: 'xlsx' });

      return {
        success: true,
        message: 'Workbook initialized successfully',
        filePath
      };
    } catch (error) {
      console.error('Error initializing workbook:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Export projects to Excel (incremental update - preserves tables and formatting)
   */
  async exportProjectsToExcel(projects, filePath, fieldMapping) {
    try {
      // Validate file path
      const pathInfo = await this.validateFilePath(filePath);
      if (!pathInfo.isValid) {
        return { success: false, error: pathInfo.error };
      }
      
      // Use the normalized path
      const normalizedPath = pathInfo.path;

      // Check if file exists, if not initialize it
      if (!await fs.pathExists(normalizedPath)) {
        const initResult = await this.initializeWorkbook(normalizedPath, fieldMapping);
        if (!initResult.success) {
          return initResult;
        }
      }

      // Read workbook (without cellStyles to prevent file bloat)
      const workbook = XLSX.readFile(normalizedPath);
      const sheetName = 'Projects';
      const projectMapping = fieldMapping.projects;
      const headers = this.fieldMappingService.getExcelHeaders(projectMapping);
      const idColumn = 'ProjectID'; // Excel column name for ID

      // Get or create worksheet
      let worksheet = workbook.Sheets[sheetName];
      const isNewSheet = !worksheet;
      
      if (isNewSheet) {
        // Create new sheet with headers
        worksheet = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }

      // Read existing Excel data and create map by ID
      let existingRowsMap = new Map();
      let headerRowIndex = 0;
      let dataStartRow = 1;
      
      // Find header row and existing data
      const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } };
      
      // Try to find header row
      for (let row = 0; row <= Math.min(10, range.e.r); row++) {
        const rowHeaders = [];
        for (let col = 0; col < headers.length; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          const cellValue = cell ? (cell.v || cell.w || '').toString().trim() : '';
          if (cellValue) rowHeaders.push(cellValue);
        }
        
        // Check if this row matches our headers
        const matches = headers.filter((h, i) => rowHeaders[i] === h).length;
        if (matches >= headers.length * 0.8) { // 80% match threshold
          headerRowIndex = row;
          dataStartRow = row + 1;
          break;
        }
      }

      // If no header row found, assume first row is headers
      if (headerRowIndex === 0 && range.e.r > 0) {
        dataStartRow = 1;
      }

      // Read existing data rows
      if (range.e.r >= dataStartRow) {
        const existingData = XLSX.utils.sheet_to_json(worksheet, { range: dataStartRow, defval: '' });
        existingData.forEach((row, index) => {
          const id = row[idColumn];
          if (id) {
            const rowIndex = dataStartRow + index;
            const rowArray = headers.map(header => row[header] || '');
            existingRowsMap.set(String(id), { rowArray, rowIndex });
          }
        });
      }

      // Build map of projects to export
      const projectsToExport = new Map();
      let updatedCount = 0;
      let addedCount = 0;

      // Process each project from app
      for (const project of projects) {
        const row = this.fieldMappingService.mapObjectToExcelRow(project, projectMapping);
        const rowArray = headers.map(header => row[header] || '');
        const projectId = String(row[idColumn] || '');

        if (existingRowsMap.has(projectId)) {
          // Update existing row
          const existing = existingRowsMap.get(projectId);
          projectsToExport.set(projectId, { rowArray, rowIndex: existing.rowIndex, isUpdate: true });
          existingRowsMap.delete(projectId); // Mark as processed
          updatedCount++;
        } else {
          // New row - will be added
          projectsToExport.set(projectId, { rowArray, rowIndex: -1, isUpdate: false });
          addedCount++;
        }
      }

      // Preserve rows from Excel that don't exist in app (these will be kept at the end)
      const preservedCount = existingRowsMap.size;
      const preservedRows = Array.from(existingRowsMap.values());

      // Clear all existing data rows (but keep headers) to prevent duplicates
      const currentRange = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : range;
      if (currentRange.e.r >= dataStartRow) {
        for (let row = dataStartRow; row <= currentRange.e.r; row++) {
          for (let col = 0; col < headers.length; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            if (worksheet[cellAddress]) {
              delete worksheet[cellAddress];
            }
          }
        }
      }

      // Start writing data rows right after header
      let currentDataRow = dataStartRow;

      // 1. Write NEW rows at the top (IDs that don't exist in Excel)
      const newRows = Array.from(projectsToExport.values()).filter(r => !r.isUpdate);
      newRows.forEach(({ rowArray }) => {
        rowArray.forEach((value, colIndex) => {
          this.updateCellValue(worksheet, currentDataRow, colIndex, value);
        });
        currentDataRow++;
      });

      // 2. Write UPDATED rows (IDs that exist in both app and Excel)
      const updatedRows = Array.from(projectsToExport.values()).filter(r => r.isUpdate);
      updatedRows.forEach(({ rowArray }) => {
        rowArray.forEach((value, colIndex) => {
          this.updateCellValue(worksheet, currentDataRow, colIndex, value);
        });
        currentDataRow++;
      });

      // 3. Write PRESERVED rows at the end (IDs that exist in Excel but not in app)
      preservedRows.forEach(({ rowArray }) => {
        rowArray.forEach((value, colIndex) => {
          this.updateCellValue(worksheet, currentDataRow, colIndex, value);
        });
        currentDataRow++;
      });

      // Calculate last data row (currentDataRow - 1 because we increment after writing)
      const lastDataRow = currentDataRow - 1;

      // Update worksheet range to include all data
      const newRange = {
        s: { r: 0, c: 0 },
        e: { r: lastDataRow, c: headers.length - 1 }
      };
      worksheet['!ref'] = XLSX.utils.encode_range(newRange);

      // Clean up workbook to remove unused styles and optimize file size
      this.cleanupWorkbook(workbook);
      
      // Write workbook (styles already removed by cleanupWorkbook)
      XLSX.writeFile(workbook, normalizedPath, { bookType: 'xlsx' });

      return {
        success: true,
        exported: projects.length,
        added: addedCount,
        updated: updatedCount,
        preserved: preservedCount,
        message: `Exported ${projects.length} projects: ${addedCount} added, ${updatedCount} updated, ${preservedCount} preserved from Excel`
      };
    } catch (error) {
      console.error('Error exporting projects to Excel:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Export assignments to Excel (incremental update - preserves tables and formatting)
   * Enriches assignments with rfaType from projects and userName/userEmail from users
   */
  async exportAssignmentsToExcel(assignments, filePath, fieldMapping, projects = [], users = []) {
    try {
      // Validate file path
      const pathInfo = await this.validateFilePath(filePath);
      if (!pathInfo.isValid) {
        return { success: false, error: pathInfo.error };
      }
      
      // Use the normalized path
      const normalizedPath = pathInfo.path;

      // Enrich assignments with missing data
      const enrichedAssignments = assignments.map(assignment => {
        const enriched = { ...assignment };
        
        // Look up project to get rfaType
        if (assignment.projectId && projects.length > 0) {
          const project = projects.find(p => p.id === assignment.projectId);
          if (project) {
            enriched.rfaType = project.rfaType || '';
          }
        }
        
        // Look up user to get userName and userEmail
        if (assignment.userId && users.length > 0) {
          const user = users.find(u => u.id === assignment.userId);
          if (user) {
            enriched.userName = user.name || '';
            enriched.userEmail = user.email || '';
          }
        }
        
        return enriched;
      });
      // Check if file exists, if not initialize it
      if (!await fs.pathExists(normalizedPath)) {
        const initResult = await this.initializeWorkbook(normalizedPath, fieldMapping);
        if (!initResult.success) {
          return initResult;
        }
      }

      // Read workbook (without cellStyles to prevent file bloat)
      const workbook = XLSX.readFile(normalizedPath);
      const sheetName = 'Assignments';
      const assignmentMapping = fieldMapping.assignments;
      const headers = this.fieldMappingService.getExcelHeaders(assignmentMapping);
      const idColumn = 'AssignmentID'; // Excel column name for ID

      // Get or create worksheet
      let worksheet = workbook.Sheets[sheetName];
      const isNewSheet = !worksheet;
      
      if (isNewSheet) {
        worksheet = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }

      // Read existing Excel data and create map by ID
      let existingRowsMap = new Map();
      let headerRowIndex = 0;
      let dataStartRow = 1;
      
      const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } };
      
      // Find header row
      for (let row = 0; row <= Math.min(10, range.e.r); row++) {
        const rowHeaders = [];
        for (let col = 0; col < headers.length; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          const cellValue = cell ? (cell.v || cell.w || '').toString().trim() : '';
          if (cellValue) rowHeaders.push(cellValue);
        }
        
        const matches = headers.filter((h, i) => rowHeaders[i] === h).length;
        if (matches >= headers.length * 0.8) {
          headerRowIndex = row;
          dataStartRow = row + 1;
          break;
        }
      }

      if (headerRowIndex === 0 && range.e.r > 0) {
        dataStartRow = 1;
      }

      // Read existing data rows
      if (range.e.r >= dataStartRow) {
        const existingData = XLSX.utils.sheet_to_json(worksheet, { range: dataStartRow, defval: '' });
        existingData.forEach((row, index) => {
          const id = row[idColumn];
          if (id) {
            const rowIndex = dataStartRow + index;
            const rowArray = headers.map(header => row[header] || '');
            existingRowsMap.set(String(id), { rowArray, rowIndex });
          }
        });
      }

      // Build map of assignments to export
      const assignmentsToExport = new Map();
      let updatedCount = 0;
      let addedCount = 0;

      // Process each assignment from app (use enriched assignments)
      for (const assignment of enrichedAssignments) {
        const row = this.fieldMappingService.mapObjectToExcelRow(assignment, assignmentMapping);
        const rowArray = headers.map(header => row[header] || '');
        const assignmentId = String(row[idColumn] || '');

        if (existingRowsMap.has(assignmentId)) {
          const existing = existingRowsMap.get(assignmentId);
          assignmentsToExport.set(assignmentId, { rowArray, rowIndex: existing.rowIndex, isUpdate: true });
          existingRowsMap.delete(assignmentId);
          updatedCount++;
        } else {
          assignmentsToExport.set(assignmentId, { rowArray, rowIndex: -1, isUpdate: false });
          addedCount++;
        }
      }

      const preservedCount = existingRowsMap.size;
      const preservedRows = Array.from(existingRowsMap.values());

      // Clear all existing data rows (but keep headers) to prevent duplicates
      const currentRange = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : range;
      if (currentRange.e.r >= dataStartRow) {
        for (let row = dataStartRow; row <= currentRange.e.r; row++) {
          for (let col = 0; col < headers.length; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            if (worksheet[cellAddress]) {
              delete worksheet[cellAddress];
            }
          }
        }
      }

      // Start writing data rows right after header
      let currentDataRow = dataStartRow;

      // 1. Write NEW rows at the top (IDs that don't exist in Excel)
      const newRows = Array.from(assignmentsToExport.values()).filter(r => !r.isUpdate);
      newRows.forEach(({ rowArray }) => {
        rowArray.forEach((value, colIndex) => {
          this.updateCellValue(worksheet, currentDataRow, colIndex, value);
        });
        currentDataRow++;
      });

      // 2. Write UPDATED rows (IDs that exist in both app and Excel)
      const updatedRows = Array.from(assignmentsToExport.values()).filter(r => r.isUpdate);
      updatedRows.forEach(({ rowArray }) => {
        rowArray.forEach((value, colIndex) => {
          this.updateCellValue(worksheet, currentDataRow, colIndex, value);
        });
        currentDataRow++;
      });

      // 3. Write PRESERVED rows at the end (IDs that exist in Excel but not in app)
      preservedRows.forEach(({ rowArray }) => {
        rowArray.forEach((value, colIndex) => {
          this.updateCellValue(worksheet, currentDataRow, colIndex, value);
        });
        currentDataRow++;
      });

      // Calculate last data row
      const lastDataRow = currentDataRow - 1;

      // Update worksheet range to include all data
      const newRange = {
        s: { r: 0, c: 0 },
        e: { r: lastDataRow, c: headers.length - 1 }
      };
      worksheet['!ref'] = XLSX.utils.encode_range(newRange);

      // Clean up workbook to remove unused styles and optimize file size
      this.cleanupWorkbook(workbook);
      
      // Write workbook (styles already removed by cleanupWorkbook)
      XLSX.writeFile(workbook, normalizedPath, { bookType: 'xlsx' });

      return {
        success: true,
        exported: enrichedAssignments.length,
        added: addedCount,
        updated: updatedCount,
        preserved: preservedCount,
        message: `Exported ${assignments.length} assignments: ${addedCount} added, ${updatedCount} updated, ${preservedCount} preserved from Excel`
      };
    } catch (error) {
      console.error('Error exporting assignments to Excel:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Export users to Excel (incremental update - preserves tables and formatting)
   */
  async exportUsersToExcel(users, filePath, fieldMapping) {
    try {
      // Validate file path
      const pathInfo = await this.validateFilePath(filePath);
      if (!pathInfo.isValid) {
        return { success: false, error: pathInfo.error };
      }
      
      // Use the normalized path
      const normalizedPath = pathInfo.path;

      // Check if file exists, if not initialize it
      if (!await fs.pathExists(normalizedPath)) {
        const initResult = await this.initializeWorkbook(normalizedPath, fieldMapping);
        if (!initResult.success) {
          return initResult;
        }
      }

      // Read workbook (without cellStyles to prevent file bloat)
      const workbook = XLSX.readFile(normalizedPath);
      const sheetName = 'Users';
      const userMapping = fieldMapping.users;
      const headers = this.fieldMappingService.getExcelHeaders(userMapping);
      const idColumn = 'UserID'; // Excel column name for ID

      // Get or create worksheet
      let worksheet = workbook.Sheets[sheetName];
      const isNewSheet = !worksheet;
      
      if (isNewSheet) {
        worksheet = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }

      // Read existing Excel data and create map by ID
      let existingRowsMap = new Map();
      let headerRowIndex = 0;
      let dataStartRow = 1;
      
      const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } };
      
      // Find header row
      for (let row = 0; row <= Math.min(10, range.e.r); row++) {
        const rowHeaders = [];
        for (let col = 0; col < headers.length; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          const cellValue = cell ? (cell.v || cell.w || '').toString().trim() : '';
          if (cellValue) rowHeaders.push(cellValue);
        }
        
        const matches = headers.filter((h, i) => rowHeaders[i] === h).length;
        if (matches >= headers.length * 0.8) {
          headerRowIndex = row;
          dataStartRow = row + 1;
          break;
        }
      }

      if (headerRowIndex === 0 && range.e.r > 0) {
        dataStartRow = 1;
      }

      // Read existing data rows
      if (range.e.r >= dataStartRow) {
        const existingData = XLSX.utils.sheet_to_json(worksheet, { range: dataStartRow, defval: '' });
        existingData.forEach((row, index) => {
          const id = row[idColumn];
          if (id) {
            const rowIndex = dataStartRow + index;
            const rowArray = headers.map(header => row[header] || '');
            existingRowsMap.set(String(id), { rowArray, rowIndex });
          }
        });
      }

      // Build map of users to export
      const usersToExport = new Map();
      let updatedCount = 0;
      let addedCount = 0;

      // Process each user from app
      for (const user of users) {
        const row = this.fieldMappingService.mapObjectToExcelRow(user, userMapping);
        const rowArray = headers.map(header => row[header] || '');
        const userId = String(row[idColumn] || '');

        if (existingRowsMap.has(userId)) {
          const existing = existingRowsMap.get(userId);
          usersToExport.set(userId, { rowArray, rowIndex: existing.rowIndex, isUpdate: true });
          existingRowsMap.delete(userId);
          updatedCount++;
        } else {
          usersToExport.set(userId, { rowArray, rowIndex: -1, isUpdate: false });
          addedCount++;
        }
      }

      const preservedCount = existingRowsMap.size;
      const preservedRows = Array.from(existingRowsMap.values());

      // Clear all existing data rows (but keep headers) to prevent duplicates
      const currentRange = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : range;
      if (currentRange.e.r >= dataStartRow) {
        for (let row = dataStartRow; row <= currentRange.e.r; row++) {
          for (let col = 0; col < headers.length; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            if (worksheet[cellAddress]) {
              delete worksheet[cellAddress];
            }
          }
        }
      }

      // Start writing data rows right after header
      let currentDataRow = dataStartRow;

      // 1. Write NEW rows at the top (IDs that don't exist in Excel)
      const newRows = Array.from(usersToExport.values()).filter(r => !r.isUpdate);
      newRows.forEach(({ rowArray }) => {
        rowArray.forEach((value, colIndex) => {
          this.updateCellValue(worksheet, currentDataRow, colIndex, value);
        });
        currentDataRow++;
      });

      // 2. Write UPDATED rows (IDs that exist in both app and Excel)
      const updatedRows = Array.from(usersToExport.values()).filter(r => r.isUpdate);
      updatedRows.forEach(({ rowArray }) => {
        rowArray.forEach((value, colIndex) => {
          this.updateCellValue(worksheet, currentDataRow, colIndex, value);
        });
        currentDataRow++;
      });

      // 3. Write PRESERVED rows at the end (IDs that exist in Excel but not in app)
      preservedRows.forEach(({ rowArray }) => {
        rowArray.forEach((value, colIndex) => {
          this.updateCellValue(worksheet, currentDataRow, colIndex, value);
        });
        currentDataRow++;
      });

      // Calculate last data row
      const lastDataRow = currentDataRow - 1;

      // Update worksheet range to include all data
      const newRange = {
        s: { r: 0, c: 0 },
        e: { r: lastDataRow, c: headers.length - 1 }
      };
      worksheet['!ref'] = XLSX.utils.encode_range(newRange);

      // Clean up workbook to remove unused styles and optimize file size
      this.cleanupWorkbook(workbook);
      
      // Write workbook (styles already removed by cleanupWorkbook)
      XLSX.writeFile(workbook, normalizedPath, { bookType: 'xlsx' });

      return {
        success: true,
        exported: users.length,
        added: addedCount,
        updated: updatedCount,
        preserved: preservedCount,
        message: `Exported ${users.length} users: ${addedCount} added, ${updatedCount} updated, ${preservedCount} preserved from Excel`
      };
    } catch (error) {
      console.error('Error exporting users to Excel:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Export all workload data to Excel
   */
  async exportAllToExcel(data, filePath, fieldMapping) {
    try {
      const results = {
        projects: 0,
        assignments: 0,
        users: 0,
        errors: []
      };

      // Export projects
      if (data.projects && data.projects.length > 0) {
        const projectResult = await this.exportProjectsToExcel(data.projects, filePath, fieldMapping);
        if (projectResult.success) {
          results.projects = projectResult.exported;
        } else {
          results.errors.push(`Projects: ${projectResult.error}`);
        }
      }

      // Export assignments (pass projects and users for enrichment)
      if (data.assignments && data.assignments.length > 0) {
        const assignmentResult = await this.exportAssignmentsToExcel(
          data.assignments, 
          filePath, 
          fieldMapping,
          data.projects || [],
          data.users || []
        );
        if (assignmentResult.success) {
          results.assignments = assignmentResult.exported;
        } else {
          results.errors.push(`Assignments: ${assignmentResult.error}`);
        }
      }

      // Export users
      if (data.users && data.users.length > 0) {
        const userResult = await this.exportUsersToExcel(data.users, filePath, fieldMapping);
        if (userResult.success) {
          results.users = userResult.exported;
        } else {
          results.errors.push(`Users: ${userResult.error}`);
        }
      }

      return {
        success: results.errors.length === 0,
        results,
        message: `Exported ${results.projects} projects, ${results.assignments} assignments, ${results.users} users`,
        errors: results.errors.length > 0 ? results.errors : undefined
      };
    } catch (error) {
      console.error('Error exporting all data to Excel:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Import projects from Excel
   */
  async importProjectsFromExcel(filePath, fieldMapping) {
    try {
      if (!await fs.pathExists(filePath)) {
        return {
          success: false,
          error: 'Excel file does not exist'
        };
      }

      // Read workbook
      const workbook = XLSX.readFile(filePath);
      const sheetName = 'Projects';

      if (!workbook.Sheets[sheetName]) {
        return {
          success: false,
          error: 'Projects sheet not found in workbook'
        };
      }

      // Convert sheet to JSON
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      // Map Excel rows to project objects
      const projectMapping = fieldMapping.projects;
      const projects = data.map(row => 
        this.fieldMappingService.mapExcelRowToObject(row, projectMapping)
      ).filter(project => project.id); // Filter out rows without ID

      return {
        success: true,
        projects,
        imported: projects.length,
        message: `Imported ${projects.length} projects from Excel`
      };
    } catch (error) {
      console.error('Error importing projects from Excel:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Import assignments from Excel
   */
  async importAssignmentsFromExcel(filePath, fieldMapping) {
    try {
      if (!await fs.pathExists(filePath)) {
        return {
          success: false,
          error: 'Excel file does not exist'
        };
      }

      // Read workbook
      const workbook = XLSX.readFile(filePath);
      const sheetName = 'Assignments';

      if (!workbook.Sheets[sheetName]) {
        return {
          success: false,
          error: 'Assignments sheet not found in workbook'
        };
      }

      // Convert sheet to JSON
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      // Map Excel rows to assignment objects
      const assignmentMapping = fieldMapping.assignments;
      const assignments = data.map(row => 
        this.fieldMappingService.mapExcelRowToObject(row, assignmentMapping)
      ).filter(assignment => assignment.id); // Filter out rows without ID

      return {
        success: true,
        assignments,
        imported: assignments.length,
        message: `Imported ${assignments.length} assignments from Excel`
      };
    } catch (error) {
      console.error('Error importing assignments from Excel:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Import users from Excel
   */
  async importUsersFromExcel(filePath, fieldMapping) {
    try {
      if (!await fs.pathExists(filePath)) {
        return {
          success: false,
          error: 'Excel file does not exist'
        };
      }

      // Read workbook
      const workbook = XLSX.readFile(filePath);
      const sheetName = 'Users';

      if (!workbook.Sheets[sheetName]) {
        return {
          success: false,
          error: 'Users sheet not found in workbook'
        };
      }

      // Convert sheet to JSON
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      // Map Excel rows to user objects
      const userMapping = fieldMapping.users;
      const users = data.map(row => 
        this.fieldMappingService.mapExcelRowToObject(row, userMapping)
      ).filter(user => user.id); // Filter out rows without ID

      return {
        success: true,
        users,
        imported: users.length,
        message: `Imported ${users.length} users from Excel`
      };
    } catch (error) {
      console.error('Error importing users from Excel:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Import all workload data from Excel
   */
  async importAllFromExcel(filePath, fieldMapping) {
    try {
      const results = {
        projects: [],
        assignments: [],
        users: [],
        errors: []
      };

      // Import projects
      const projectResult = await this.importProjectsFromExcel(filePath, fieldMapping);
      if (projectResult.success) {
        results.projects = projectResult.projects;
      } else {
        results.errors.push(`Projects: ${projectResult.error}`);
      }

      // Import assignments
      const assignmentResult = await this.importAssignmentsFromExcel(filePath, fieldMapping);
      if (assignmentResult.success) {
        results.assignments = assignmentResult.assignments;
      } else {
        results.errors.push(`Assignments: ${assignmentResult.error}`);
      }

      // Import users
      const userResult = await this.importUsersFromExcel(filePath, fieldMapping);
      if (userResult.success) {
        results.users = userResult.users;
      } else {
        results.errors.push(`Users: ${userResult.error}`);
      }

      return {
        success: true,
        data: results,
        message: `Imported ${results.projects.length} projects, ${results.assignments.length} assignments, ${results.users.length} users`,
        errors: results.errors.length > 0 ? results.errors : undefined
      };
    } catch (error) {
      console.error('Error importing all data from Excel:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test Excel file path
   */
  async testFilePath(filePath) {
    try {
      // Use the same validation as export functions
      const pathInfo = await this.validateFilePath(filePath);
      if (!pathInfo.isValid) {
        return {
          success: false,
          error: pathInfo.error
        };
      }

      const normalizedPath = pathInfo.path;

      // If file exists, get file info
      if (await fs.pathExists(normalizedPath)) {
        const stats = await fs.stat(normalizedPath);
        
        // Try to read file
        await fs.access(normalizedPath, fs.constants.R_OK | fs.constants.W_OK);

        return {
          success: true,
          fileInfo: {
            path: normalizedPath,
            size: stats.size,
            lastModified: stats.mtime.toISOString()
          },
          message: 'File path is valid and accessible'
        };
      } else {
        // File doesn't exist yet, but path is valid
        return {
          success: true,
          fileInfo: {
            path: normalizedPath,
            isNew: true
          },
          message: 'File path is valid. File will be created on first export.'
        };
      }
    } catch (error) {
      console.error('Error testing file path:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get Excel file headers
   */
  async getExcelHeaders(filePath, sheetName) {
    try {
      if (!await fs.pathExists(filePath)) {
        return {
          success: false,
          error: 'Excel file does not exist'
        };
      }

      const workbook = XLSX.readFile(filePath);

      if (!workbook.Sheets[sheetName]) {
        return {
          success: false,
          error: `Sheet "${sheetName}" not found in workbook`,
          availableSheets: workbook.SheetNames
        };
      }

      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (data.length === 0) {
        return {
          success: false,
          error: 'Sheet is empty'
        };
      }

      const headers = data[0].filter(h => h && h.trim());

      return {
        success: true,
        headers,
        sheetName,
        availableSheets: workbook.SheetNames
      };
    } catch (error) {
      console.error('Error getting Excel headers:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Optimize/repair an existing Excel file by removing styles and trimming ranges
   * This fixes file bloat issues caused by accumulated styles
   */
  async optimizeExcelFile(filePath) {
    try {
      if (!await fs.pathExists(filePath)) {
        return {
          success: false,
          error: 'Excel file does not exist'
        };
      }

      // Get original file size
      const originalStats = await fs.stat(filePath);
      const originalSize = originalStats.size;

      // Read workbook without styles to avoid loading bloat
      const workbook = XLSX.readFile(filePath);

      // Clean up the workbook (removes styles, trims ranges)
      this.cleanupWorkbook(workbook);

      // Create backup before overwriting
      const backupPath = filePath + '.backup.' + Date.now();
      await fs.copy(filePath, backupPath);

      // Write optimized workbook (styles already removed by cleanupWorkbook)
      XLSX.writeFile(workbook, filePath, { bookType: 'xlsx' });

      // Get new file size
      const newStats = await fs.stat(filePath);
      const newSize = newStats.size;
      const reduction = originalSize - newSize;
      const reductionPercent = ((reduction / originalSize) * 100).toFixed(2);

      return {
        success: true,
        originalSize,
        newSize,
        reduction,
        reductionPercent,
        backupPath,
        message: `File optimized: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(newSize / 1024 / 1024).toFixed(2)} MB (${reductionPercent}% reduction)`
      };
    } catch (error) {
      console.error('Error optimizing Excel file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = WorkloadExcelService;





