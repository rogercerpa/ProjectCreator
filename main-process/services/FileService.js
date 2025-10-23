// FileService runs in main process - no need for ipcRenderer
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class FileService {
  constructor() {
    this.config = {
      serverPaths: {
        masterTemplate: '\\\\10.3.10.30\\DAS\\DAS References\\!!!Templates For Project Creator',
        currentYear: '\\\\10.3.10.30\\DAS',
        agentRequirements: '\\\\10.3.10.30\\DAS\\Agent Requirements',
        corporateAccounts: '\\\\10.3.10.30\\DAS\\Corporate Accounts',
        images: '\\\\10.3.10.30\\DAS\\DAS References\\Images'
      },
      desktopPaths: {
        triage: 'C:\\Users\\%USERNAME%\\Desktop\\1) Triage',
        templates: 'C:\\Users\\%USERNAME%\\Desktop\\1) Triage\\!!!Templates For Project Creator',
        uploadedProjects: 'C:\\Users\\%USERNAME%\\Desktop\\1) Triage\\Uploaded Projects'
      }
    };
  }

  // Get current user information
  async getCurrentUser() {
    try {
      const username = process.env.USERNAME || process.env.USER || os.userInfo().username;
      const homeDir = os.homedir();
      
      return {
        username,
        homeDir,
        desktop: path.join(homeDir, 'Desktop'),
        documents: path.join(homeDir, 'Documents')
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  }

  // Get system information
  async getSystemInfo() {
    try {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      
      return {
        currentDate: `${month}${day}${year}`,
        year,
        month,
        day,
        fullDate: currentDate.toISOString(),
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname()
      };
    } catch (error) {
      console.error('Error getting system info:', error);
      throw error;
    }
  }

  // Check if path exists
  async pathExists(filePath) {
    try {
      return await fs.pathExists(filePath);
    } catch (error) {
      console.error('Error checking path existence:', error);
      return false;
    }
  }

  // Create directory
  async createDirectory(dirPath, options = {}) {
    try {
      const {
        recursive = true,
        mode = 0o755
      } = options;

      await fs.ensureDir(dirPath, mode);
      
      return {
        success: true,
        path: dirPath,
        message: 'Directory created successfully'
      };
    } catch (error) {
      console.error('Error creating directory:', error);
      return {
        success: false,
        error: error.message,
        path: dirPath
      };
    }
  }

  // Copy file or directory
  async copyItem(source, destination, options = {}) {
    try {
      const {
        overwrite = false,
        preserveTimestamps = true
      } = options;

      // Check if destination exists and overwrite is not allowed
      if (await this.pathExists(destination) && !overwrite) {
        throw new Error(`Destination already exists: ${destination}`);
      }

      // Ensure destination directory exists
      await fs.ensureDir(path.dirname(destination));

      // Copy the item
      await fs.copy(source, destination, {
        overwrite,
        preserveTimestamps
      });

      return {
        success: true,
        source,
        destination,
        message: 'Item copied successfully'
      };
    } catch (error) {
      console.error('Error copying item:', error);
      return {
        success: false,
        error: error.message,
        source,
        destination
      };
    }
  }

  // Move file or directory
  async moveItem(source, destination, options = {}) {
    try {
      const {
        overwrite = false
      } = options;

      // Check if destination exists and overwrite is not allowed
      if (await this.pathExists(destination) && !overwrite) {
        throw new Error(`Destination already exists: ${destination}`);
      }

      // Ensure destination directory exists
      await fs.ensureDir(path.dirname(destination));

      // Move the item
      await fs.move(source, destination, {
        overwrite
      });

      return {
        success: true,
        source,
        destination,
        message: 'Item moved successfully'
      };
    } catch (error) {
      console.error('Error moving item:', error);
      return {
        success: false,
        error: error.message,
        source,
        destination
      };
    }
  }

  // Delete file or directory
  async deleteItem(itemPath, options = {}) {
    try {
      const {
        recursive = true,
        force = false
      } = options;

      if (!(await this.pathExists(itemPath))) {
        if (force) {
          return {
            success: true,
            path: itemPath,
            message: 'Item does not exist (force mode)'
          };
        } else {
          throw new Error(`Item does not exist: ${itemPath}`);
        }
      }

      await fs.remove(itemPath);

      return {
        success: true,
        path: itemPath,
        message: 'Item deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting item:', error);
      return {
        success: false,
        error: error.message,
        path: itemPath
      };
    }
  }

  // List directory contents
  async listDirectory(dirPath, options = {}) {
    try {
      const {
        includeHidden = false,
        recursive = false,
        filter = null
      } = options;

      if (!(await this.pathExists(dirPath))) {
        throw new Error(`Directory does not exist: ${dirPath}`);
      }

      const items = await fs.readdir(dirPath);
      const result = [];

      for (const item of items) {
        // Skip hidden files if not requested
        if (!includeHidden && item.startsWith('.')) {
          continue;
        }

        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);

        const itemInfo = {
          name: item,
          path: itemPath,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          accessed: stats.atime
        };

        // Apply filter if provided
        if (filter && !filter(itemInfo)) {
          continue;
        }

        result.push(itemInfo);

        // Recursively list subdirectories if requested
        if (recursive && stats.isDirectory()) {
          const subItems = await this.listDirectory(itemPath, options);
          result.push(...subItems);
        }
      }

      return {
        success: true,
        path: dirPath,
        items: result,
        count: result.length,
        message: `Directory listed successfully: ${result.length} items`
      };
    } catch (error) {
      console.error('Error listing directory:', error);
      return {
        success: false,
        error: error.message,
        path: dirPath
      };
    }
  }

  // Get file information
  async getFileInfo(filePath) {
    try {
      if (!(await this.pathExists(filePath))) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();

      return {
        success: true,
        path: filePath,
        name: path.basename(filePath),
        extension: ext,
        size: stats.size,
        sizeFormatted: this.formatFileSize(stats.size),
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        permissions: {
          read: (stats.mode & fs.constants.R_OK) !== 0,
          write: (stats.mode & fs.constants.W_OK) !== 0,
          execute: (stats.mode & fs.constants.X_OK) !== 0
        }
      };
    } catch (error) {
      console.error('Error getting file info:', error);
      return {
        success: false,
        error: error.message,
        path: filePath
      };
    }
  }

  // Format file size
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Search for files
  async searchFiles(searchPath, searchOptions = {}) {
    try {
      const {
        pattern = '*',
        recursive = true,
        includeHidden = false,
        maxResults = 1000
      } = searchOptions;

      if (!(await this.pathExists(searchPath))) {
        throw new Error(`Search path does not exist: ${searchPath}`);
      }

      const results = [];
      const searchRegex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');

      const searchDirectory = async (dirPath) => {
        try {
          const items = await fs.readdir(dirPath);
          
          for (const item of items) {
            if (results.length >= maxResults) break;

            // Skip hidden files if not requested
            if (!includeHidden && item.startsWith('.')) {
              continue;
            }

            const itemPath = path.join(dirPath, item);
            
            try {
              const stats = await fs.stat(itemPath);
              
              // Check if item matches pattern
              if (searchRegex.test(item)) {
                results.push({
                  name: item,
                  path: itemPath,
                  isDirectory: stats.isDirectory(),
                  size: stats.size,
                  modified: stats.mtime
                });
              }

              // Recursively search subdirectories
              if (recursive && stats.isDirectory()) {
                await searchDirectory(itemPath);
              }
            } catch (statError) {
              // Skip items we can't access
              console.warn(`Cannot access: ${itemPath}`, statError.message);
            }
          }
        } catch (readError) {
          console.warn(`Cannot read directory: ${dirPath}`, readError.message);
        }
      };

      await searchDirectory(searchPath);

      return {
        success: true,
        searchPath,
        pattern,
        results,
        count: results.length,
        message: `Search completed: ${results.length} results found`
      };
    } catch (error) {
      console.error('Error searching files:', error);
      return {
        success: false,
        error: error.message,
        searchPath
      };
    }
  }

  // Create symbolic link
  async createSymbolicLink(target, linkPath, options = {}) {
    try {
      const {
        type = 'file' // 'file' or 'dir'
      } = options;

      if (!(await this.pathExists(target))) {
        throw new Error(`Target does not exist: ${target}`);
      }

      if (await this.pathExists(linkPath)) {
        throw new Error(`Link already exists: ${linkPath}`);
      }

      // Ensure link directory exists
      await fs.ensureDir(path.dirname(linkPath));

      // Create symbolic link
      await fs.symlink(target, linkPath, type);

      return {
        success: true,
        target,
        linkPath,
        type,
        message: 'Symbolic link created successfully'
      };
    } catch (error) {
      console.error('Error creating symbolic link:', error);
      return {
        success: false,
        error: error.message,
        target,
        linkPath
      };
    }
  }

  // Watch directory for changes
  async watchDirectory(dirPath, options = {}) {
    try {
      const {
        recursive = true,
        persistent = true
      } = options;

      if (!(await this.pathExists(dirPath))) {
        throw new Error(`Directory does not exist: ${dirPath}`);
      }

      // Note: In a real implementation, you'd use fs.watch or a similar mechanism
      // For now, we'll return a mock watcher
      const watcher = {
        path: dirPath,
        options,
        stop: () => {
          console.log(`Stopped watching: ${dirPath}`);
        }
      };

      return {
        success: true,
        watcher,
        message: 'Directory watch started successfully'
      };
    } catch (error) {
      console.error('Error watching directory:', error);
      return {
        success: false,
        error: error.message,
        path: dirPath
      };
    }
  }

  // Get disk usage information
  async getDiskUsage(path) {
    try {
      // Note: This is a simplified implementation
      // In a real application, you'd use a library like diskusage
      const stats = await fs.stat(path);
      
      return {
        success: true,
        path,
        available: 'Unknown', // Would need diskusage library
        total: 'Unknown',
        used: 'Unknown',
        free: 'Unknown',
        usagePercent: 'Unknown'
      };
    } catch (error) {
      console.error('Error getting disk usage:', error);
      return {
        success: false,
        error: error.message,
        path
      };
    }
  }

  // Validate file path
  validateFilePath(filePath) {
    try {
      // Check for invalid characters
      const invalidChars = /[<>:"|?*]/;
      if (invalidChars.test(filePath)) {
        return {
          isValid: false,
          error: 'Path contains invalid characters'
        };
      }

      // Check path length
      if (filePath.length > 260) {
        return {
          isValid: false,
          error: 'Path is too long (max 260 characters)'
        };
      }

      // Check for reserved names
      const reservedNames = [
        'CON', 'PRN', 'AUX', 'NUL',
        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
      ];
      
      const fileName = path.basename(filePath, path.extname(filePath)).toUpperCase();
      if (reservedNames.includes(fileName)) {
        return {
          isValid: false,
          error: 'Path contains reserved name'
        };
      }

      return {
        isValid: true,
        message: 'Path is valid'
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  // Sanitize file name
  sanitizeFileName(fileName) {
    return fileName
      .replace(/[<>:"|?*]/g, '_') // Replace invalid characters with underscore
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim(); // Remove leading/trailing whitespace
  }

  // Get relative path
  getRelativePath(fromPath, toPath) {
    try {
      return path.relative(fromPath, toPath);
    } catch (error) {
      console.error('Error getting relative path:', error);
      return toPath;
    }
  }

  // Resolve path
  resolvePath(...paths) {
    try {
      return path.resolve(...paths);
    } catch (error) {
      console.error('Error resolving path:', error);
      return path.join(...paths);
    }
  }

  // Normalize path
  normalizePath(filePath) {
    try {
      return path.normalize(filePath);
    } catch (error) {
      console.error('Error normalizing path:', error);
      return filePath;
    }
  }

  // Join paths
  joinPaths(...paths) {
    try {
      return path.join(...paths);
    } catch (error) {
      console.error('Error joining paths:', error);
      return paths.join(path.sep);
    }
  }

  // Get file extension
  getFileExtension(filePath) {
    try {
      return path.extname(filePath).toLowerCase();
    } catch (error) {
      console.error('Error getting file extension:', error);
      return '';
    }
  }

  // Get file name without extension
  getFileNameWithoutExtension(filePath) {
    try {
      return path.basename(filePath, path.extname(filePath));
    } catch (error) {
      console.error('Error getting file name without extension:', error);
      return path.basename(filePath);
    }
  }

  // Get directory name
  getDirectoryName(filePath) {
    try {
      return path.dirname(filePath);
    } catch (error) {
      console.error('Error getting directory name:', error);
      return '';
    }
  }

  // Check if path is absolute
  isAbsolutePath(filePath) {
    try {
      return path.isAbsolute(filePath);
    } catch (error) {
      console.error('Error checking if path is absolute:', error);
      return false;
    }
  }

  // Get current working directory
  getCurrentWorkingDirectory() {
    try {
      return process.cwd();
    } catch (error) {
      console.error('Error getting current working directory:', error);
      return '';
    }
  }

  // Change working directory
  async changeWorkingDirectory(newPath) {
    try {
      if (!(await this.pathExists(newPath))) {
        throw new Error(`Directory does not exist: ${newPath}`);
      }

      process.chdir(newPath);
      
      return {
        success: true,
        newPath,
        message: 'Working directory changed successfully'
      };
    } catch (error) {
      console.error('Error changing working directory:', error);
      return {
        success: false,
        error: error.message,
        newPath
      };
    }
  }
}

module.exports = FileService;
