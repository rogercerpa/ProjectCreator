// WorkloadExcelService - Handles workload data Excel read/write operations with field mapping
const fs = require('fs-extra');
const path = require('path');
const XLSX = require('xlsx');

class WorkloadExcelService {
  constructor(fieldMappingService) {
    this.fieldMappingService = fieldMappingService;
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

      // Write workbook
      XLSX.writeFile(workbook, filePath);

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
   * Export projects to Excel (incremental update)
   */
  async exportProjectsToExcel(projects, filePath, fieldMapping) {
    try {
      // Check if file exists, if not initialize it
      if (!await fs.pathExists(filePath)) {
        const initResult = await this.initializeWorkbook(filePath, fieldMapping);
        if (!initResult.success) {
          return initResult;
        }
      }

      // Read workbook
      const workbook = XLSX.readFile(filePath);
      const sheetName = 'Projects';
      const projectMapping = fieldMapping.projects;
      const headers = this.fieldMappingService.getExcelHeaders(projectMapping);
      const idColumn = 'ProjectID'; // Excel column name for ID

      // Read existing Excel data and create map by ID
      let existingRowsMap = new Map();
      let preservedRows = [];
      
      if (workbook.Sheets[sheetName]) {
        const existingData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        existingData.forEach((row) => {
          const id = row[idColumn];
          if (id) {
            // Convert Excel row object to array format
            const rowArray = headers.map(header => row[header] || '');
            existingRowsMap.set(String(id), rowArray);
          }
        });
      }

      // Build rows array starting with headers
      const rows = [headers];
      let updatedCount = 0;
      let addedCount = 0;

      // Process each project from app
      for (const project of projects) {
        const row = this.fieldMappingService.mapObjectToExcelRow(project, projectMapping);
        const rowArray = headers.map(header => row[header] || '');
        const projectId = String(row[idColumn] || '');

        if (existingRowsMap.has(projectId)) {
          // Update existing row - replace in map
          existingRowsMap.set(projectId, rowArray);
          updatedCount++;
        } else {
          // Add new row
          rows.push(rowArray);
          addedCount++;
        }
      }

      // Add all rows from map (both updated and preserved)
      const allRows = Array.from(existingRowsMap.values());
      rows.push(...allRows);
      
      const preservedCount = allRows.length - updatedCount;

      // Create worksheet with merged data
      const worksheet = XLSX.utils.aoa_to_sheet(rows);

      // Replace existing sheet
      const sheetIndex = workbook.SheetNames.indexOf(sheetName);
      if (sheetIndex !== -1) {
        workbook.SheetNames.splice(sheetIndex, 1);
        delete workbook.Sheets[sheetName];
      }
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Write workbook
      XLSX.writeFile(workbook, filePath);

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
   * Export assignments to Excel (incremental update)
   */
  async exportAssignmentsToExcel(assignments, filePath, fieldMapping) {
    try {
      // Check if file exists, if not initialize it
      if (!await fs.pathExists(filePath)) {
        const initResult = await this.initializeWorkbook(filePath, fieldMapping);
        if (!initResult.success) {
          return initResult;
        }
      }

      // Read workbook
      const workbook = XLSX.readFile(filePath);
      const sheetName = 'Assignments';
      const assignmentMapping = fieldMapping.assignments;
      const headers = this.fieldMappingService.getExcelHeaders(assignmentMapping);
      const idColumn = 'AssignmentID'; // Excel column name for ID

      // Read existing Excel data and create map by ID
      let existingRowsMap = new Map();
      
      if (workbook.Sheets[sheetName]) {
        const existingData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        existingData.forEach((row) => {
          const id = row[idColumn];
          if (id) {
            // Convert Excel row object to array format
            const rowArray = headers.map(header => row[header] || '');
            existingRowsMap.set(String(id), rowArray);
          }
        });
      }

      // Build rows array starting with headers
      const rows = [headers];
      let updatedCount = 0;
      let addedCount = 0;

      // Process each assignment from app
      for (const assignment of assignments) {
        const row = this.fieldMappingService.mapObjectToExcelRow(assignment, assignmentMapping);
        const rowArray = headers.map(header => row[header] || '');
        const assignmentId = String(row[idColumn] || '');

        if (existingRowsMap.has(assignmentId)) {
          // Update existing row - replace in map
          existingRowsMap.set(assignmentId, rowArray);
          updatedCount++;
        } else {
          // Add new row
          rows.push(rowArray);
          addedCount++;
        }
      }

      // Add all rows from map (both updated and preserved)
      const allRows = Array.from(existingRowsMap.values());
      rows.push(...allRows);
      
      const preservedCount = allRows.length - updatedCount;

      // Create worksheet with merged data
      const worksheet = XLSX.utils.aoa_to_sheet(rows);

      // Replace existing sheet
      const sheetIndex = workbook.SheetNames.indexOf(sheetName);
      if (sheetIndex !== -1) {
        workbook.SheetNames.splice(sheetIndex, 1);
        delete workbook.Sheets[sheetName];
      }
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Write workbook
      XLSX.writeFile(workbook, filePath);

      return {
        success: true,
        exported: assignments.length,
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
   * Export users to Excel (incremental update)
   */
  async exportUsersToExcel(users, filePath, fieldMapping) {
    try {
      // Check if file exists, if not initialize it
      if (!await fs.pathExists(filePath)) {
        const initResult = await this.initializeWorkbook(filePath, fieldMapping);
        if (!initResult.success) {
          return initResult;
        }
      }

      // Read workbook
      const workbook = XLSX.readFile(filePath);
      const sheetName = 'Users';
      const userMapping = fieldMapping.users;
      const headers = this.fieldMappingService.getExcelHeaders(userMapping);
      const idColumn = 'UserID'; // Excel column name for ID

      // Read existing Excel data and create map by ID
      let existingRowsMap = new Map();
      
      if (workbook.Sheets[sheetName]) {
        const existingData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        existingData.forEach((row) => {
          const id = row[idColumn];
          if (id) {
            // Convert Excel row object to array format
            const rowArray = headers.map(header => row[header] || '');
            existingRowsMap.set(String(id), rowArray);
          }
        });
      }

      // Build rows array starting with headers
      const rows = [headers];
      let updatedCount = 0;
      let addedCount = 0;

      // Process each user from app
      for (const user of users) {
        const row = this.fieldMappingService.mapObjectToExcelRow(user, userMapping);
        const rowArray = headers.map(header => row[header] || '');
        const userId = String(row[idColumn] || '');

        if (existingRowsMap.has(userId)) {
          // Update existing row - replace in map
          existingRowsMap.set(userId, rowArray);
          updatedCount++;
        } else {
          // Add new row
          rows.push(rowArray);
          addedCount++;
        }
      }

      // Add all rows from map (both updated and preserved)
      const allRows = Array.from(existingRowsMap.values());
      rows.push(...allRows);
      
      const preservedCount = allRows.length - updatedCount;

      // Create worksheet with merged data
      const worksheet = XLSX.utils.aoa_to_sheet(rows);

      // Replace existing sheet
      const sheetIndex = workbook.SheetNames.indexOf(sheetName);
      if (sheetIndex !== -1) {
        workbook.SheetNames.splice(sheetIndex, 1);
        delete workbook.Sheets[sheetName];
      }
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Write workbook
      XLSX.writeFile(workbook, filePath);

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

      // Export assignments
      if (data.assignments && data.assignments.length > 0) {
        const assignmentResult = await this.exportAssignmentsToExcel(data.assignments, filePath, fieldMapping);
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
      if (!filePath || !filePath.trim()) {
        return {
          success: false,
          error: 'File path is required'
        };
      }

      // Check if file exists
      if (!await fs.pathExists(filePath)) {
        return {
          success: false,
          error: 'File does not exist'
        };
      }

      // Check if it's a file (not directory)
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return {
          success: false,
          error: 'Path is not a file'
        };
      }

      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      if (!['.xlsx', '.xls'].includes(ext)) {
        return {
          success: false,
          error: 'File must be an Excel file (.xlsx or .xls)'
        };
      }

      // Try to read file
      await fs.access(filePath, fs.constants.R_OK | fs.constants.W_OK);

      return {
        success: true,
        fileInfo: {
          path: filePath,
          size: stats.size,
          lastModified: stats.mtime.toISOString()
        },
        message: 'File path is valid and accessible'
      };
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
}

module.exports = WorkloadExcelService;





