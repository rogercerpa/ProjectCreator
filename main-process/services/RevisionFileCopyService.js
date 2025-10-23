const fs = require('fs-extra');
const path = require('path');

/**
 * RevisionFileCopyService
 * Handles copying files and folders from previous revisions
 * Implements the HTA logic for revision file operations
 */
class RevisionFileCopyService {
  constructor() {
    this.supportedFolders = ['AE Markups', 'BOM CHECK'];
    this.supportedExtensions = ['.vsp'];
  }

  /**
   * Extract RFA version number from RFA folder path
   * @param {string} rfaFolderPath - Path to RFA folder (e.g., "RFA#61726-2_CONTROLS_02152025")
   * @returns {number|null} RFA version number or null if not found
   */
  extractRFAVersionFromPath(rfaFolderPath) {
    try {
      const folderName = path.basename(rfaFolderPath);
      // Pattern: RFA#[number]-[version]_[type]_[date]
      const versionMatch = folderName.match(/RFA#\d+-(\d+)/i);
      
      if (versionMatch) {
        const version = parseInt(versionMatch[1]);
        console.log(`🔢 Extracted RFA version ${version} from: ${folderName}`);
        return version;
      }
      
      console.warn(`⚠️ Could not extract RFA version from: ${folderName}`);
      return null;
    } catch (error) {
      console.error(`❌ Error extracting RFA version from ${rfaFolderPath}:`, error);
      return null;
    }
  }

  /**
   * Generate renamed VSP filename with updated version and current date
   * @param {string} originalFilename - Original VSP filename
   * @param {number} newRFAVersion - New RFA version number
   * @returns {string} New filename with updated version and date
   */
  generateRenamedVSPFilename(originalFilename, newRFAVersion) {
    try {
      console.log(`🏷️ Renaming VSP file: "${originalFilename}" with RFA version ${newRFAVersion}`);
      
      // Current date in MMDDYYYY format
      const currentDate = new Date();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const year = currentDate.getFullYear();
      const dateString = `${month}${day}${year}`;
      
      // Parse original filename pattern: PROJECTNAME_VERSION_MMDDYYYY.vsp
      const nameWithoutExt = originalFilename.replace(/\.vsp$/i, '');
      
      // Split by underscores to get parts
      const parts = nameWithoutExt.split('_');
      
      if (parts.length >= 3) {
        // Standard format: [PROJECTNAME, VERSION, DATE]
        const projectName = parts.slice(0, -2).join('_'); // Everything except last 2 parts
        const oldVersion = parts[parts.length - 2]; // Second to last part
        const oldDate = parts[parts.length - 1]; // Last part
        
        // Generate new version string
        const newVersion = `REV${newRFAVersion}`;
        
        const newFilename = `${projectName}_${newVersion}_${dateString}.vsp`;
        
        console.log(`✅ VSP Rename: "${originalFilename}" → "${newFilename}"`);
        console.log(`   Project: "${projectName}", Old Version: "${oldVersion}", New Version: "${newVersion}"`);
        console.log(`   Old Date: "${oldDate}", New Date: "${dateString}"`);
        
        return newFilename;
      } else {
        // Fallback for non-standard naming - just append version and date
        const baseName = nameWithoutExt.replace(/_?(ORIG|REV\d+)_?\d{8}?$/i, '');
        const newFilename = `${baseName}_REV${newRFAVersion}_${dateString}.vsp`;
        
        console.log(`⚠️ VSP Non-standard rename: "${originalFilename}" → "${newFilename}"`);
        return newFilename;
      }
      
    } catch (error) {
      console.error(`❌ Error renaming VSP file "${originalFilename}":`, error);
      // Fallback: return original filename
      return originalFilename;
    }
  }

  /**
   * Copy all revision assets from previous revision to new revision
   * @param {string} previousRevisionPath - Path to previous RFA folder
   * @param {string} newRevisionPath - Path to new RFA folder
   * @param {Object} options - Copy options, progress callback, and AE Markups selection
   * @returns {Promise<Object>} Copy operation result
   */
  async copyRevisionAssets(previousRevisionPath, newRevisionPath, options = {}) {
    try {
      console.log('RevisionFileCopyService: Starting revision asset copy');
      console.log('From:', previousRevisionPath);
      console.log('To:', newRevisionPath);

      const copyOptions = {
        copyAEMarkups: true,
        copyBOMCheck: true,
        copyVSP: true,
        ...options.copyOptions
      };

      const operations = [];
      const results = [];

      // Define copy operations based on options
      if (copyOptions.copyAEMarkups) {
        // Check if selective AE Markups file copying is specified
        if (options.aeMarkupsSelectedFiles !== undefined) {
          operations.push({ 
            type: 'ae_markups_selective', 
            name: 'AE Markups (Selected Files)', 
            selectedFiles: options.aeMarkupsSelectedFiles,
            weight: 20 
          });
        } else {
          operations.push({ type: 'folder', name: 'AE Markups', weight: 20 });
        }
      }
      if (copyOptions.copyBOMCheck) {
        operations.push({ type: 'folder', name: 'BOM CHECK', weight: 20 });
      }
      if (copyOptions.copyVSP) {
        operations.push({ type: 'files', extensions: ['.vsp'], weight: 30 });
      }

      // OPTIMIZATION: Execute operations with progress tracking
      console.log('RevisionFileCopyService: Executing operations with progress tracking...');
      const startTime = Date.now();
      
      // Calculate base progress (35% to 85% for file copying)
      const baseProgress = 35;
      const maxProgress = 85;
      const progressRange = maxProgress - baseProgress;
      
      let completedOperations = 0;
      const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
      
      const operationPromises = operations.map(async (operation) => {
        const opStartTime = Date.now();
        
        // Report operation start
        if (options.onProgress) {
          const currentProgress = baseProgress + (completedOperations / operations.length) * progressRange;
          options.onProgress(
            `Copying ${operation.name || operation.extensions?.join(', ')}...`,
            Math.round(currentProgress),
            { 
              step: 'file_copy',
              operation: operation.name || operation.extensions?.join(', '),
              completed: completedOperations,
              total: operations.length
            }
          );
        }
        
        let result;
        if (operation.type === 'folder') {
          result = await this.copyFolderIfExists(previousRevisionPath, newRevisionPath, operation.name);
        } else if (operation.type === 'ae_markups_selective') {
          result = await this.copySelectedAEMarkupsFiles(previousRevisionPath, newRevisionPath, operation.selectedFiles);
        } else if (operation.type === 'files') {
          result = await this.copyFilesByExtension(previousRevisionPath, newRevisionPath, operation.extensions);
        }
        
        completedOperations++;
        const opDuration = Date.now() - opStartTime;
        console.log(`RevisionFileCopyService: ${operation.name || operation.extensions?.join(', ')} completed in ${opDuration}ms`);
        
        // Report operation completion
        if (options.onProgress) {
          const currentProgress = baseProgress + (completedOperations / operations.length) * progressRange;
          options.onProgress(
            `Completed ${operation.name || operation.extensions?.join(', ')}`,
            Math.round(currentProgress),
            { 
              step: 'file_copy',
              operation: operation.name || operation.extensions?.join(', '),
              completed: completedOperations,
              total: operations.length,
              success: result.success
            }
          );
        }
        
        return result;
      });

      // Wait for all operations to complete
      const operationResults = await Promise.all(operationPromises);
      results.push(...operationResults);
      
      const totalDuration = Date.now() - startTime;
      console.log(`RevisionFileCopyService: All operations completed in ${totalDuration}ms`);

      // Summary
      const successfulOperations = results.filter(r => r.success);
      const failedOperations = results.filter(r => !r.success);

      console.log('RevisionFileCopyService: Copy operation completed');
      console.log('Successful operations:', successfulOperations.length);
      console.log('Failed operations:', failedOperations.length);

      return {
        success: failedOperations.length === 0,
        results: results,
        summary: {
          totalOperations: operations.length,
          successful: successfulOperations.length,
          failed: failedOperations.length,
          details: results.map(r => r.operation)
        },
        message: failedOperations.length === 0 
          ? 'All revision assets copied successfully'
          : `${successfulOperations.length}/${operations.length} operations completed successfully`
      };

    } catch (error) {
      console.error('RevisionFileCopyService: Error copying revision assets:', error);
      return {
        success: false,
        error: error.message,
        results: [],
        summary: { totalOperations: 0, successful: 0, failed: 1 }
      };
    }
  }

  /**
   * Analyze AE Markups folder contents for file selection
   * @param {string} sourcePath - Source RFA path
   * @returns {Promise<Object>} Analysis result with file list
   */
  async analyzeAEMarkupsFolder(sourcePath) {
    try {
      // Safety check for null/undefined sourcePath
      if (!sourcePath) {
        console.log('⚠️ Cannot analyze AE Markups: source path is null/undefined');
        return {
          success: true,
          exists: false,
          fileCount: 0,
          files: [],
          needsUserSelection: false
        };
      }

      const aeMarkupsPath = path.join(sourcePath, 'AE Markups');
      console.log('🔍 Analyzing AE Markups folder:', aeMarkupsPath);

      if (!await fs.pathExists(aeMarkupsPath)) {
        return {
          success: true,
          exists: false,
          fileCount: 0,
          files: [],
          needsUserSelection: false
        };
      }

      // Get all files in the folder with their details
      const items = await fs.readdir(aeMarkupsPath, { withFileTypes: true });
      const files = [];

      for (const item of items) {
        if (item.isFile()) {
          const filePath = path.join(aeMarkupsPath, item.name);
          const stats = await fs.stat(filePath);
          
          files.push({
            name: item.name,
            size: stats.size,
            modified: stats.mtime,
            path: filePath
          });
        }
      }

      const fileCount = files.length;
      const needsUserSelection = fileCount > 3;

      console.log(`📊 AE Markups analysis: ${fileCount} files found, user selection ${needsUserSelection ? 'needed' : 'not needed'}`);

      return {
        success: true,
        exists: true,
        fileCount: fileCount,
        files: files,
        needsUserSelection: needsUserSelection,
        folderPath: aeMarkupsPath
      };

    } catch (error) {
      console.error('❌ Error analyzing AE Markups folder:', error);
      return {
        success: false,
        error: error.message,
        exists: false,
        fileCount: 0,
        files: [],
        needsUserSelection: false
      };
    }
  }

  /**
   * Copy selected files from AE Markups folder
   * @param {string} sourcePath - Source RFA path
   * @param {string} targetPath - Target RFA path
   * @param {Array} selectedFiles - Array of filenames to copy
   * @returns {Promise<Object>} Copy result
   */
  async copySelectedAEMarkupsFiles(sourcePath, targetPath, selectedFiles = []) {
    try {
      const sourceFolder = path.join(sourcePath, 'AE Markups');
      const targetFolder = path.join(targetPath, 'AE Markups');

      console.log(`📋 Copying selected AE Markups files: ${selectedFiles.length} files`);
      console.log('Selected files:', selectedFiles);

      if (!await fs.pathExists(sourceFolder)) {
        return {
          success: false,
          operation: 'AE Markups folder not found',
          error: 'Source folder does not exist'
        };
      }

      if (selectedFiles.length === 0) {
        console.log('⚠️ No files selected for AE Markups - skipping folder');
        return {
          success: true,
          operation: 'AE Markups folder skipped (no files selected)',
          details: {
            source: sourceFolder,
            target: targetFolder,
            skipped: true,
            selectedFiles: []
          }
        };
      }

      // Ensure target folder exists
      await fs.ensureDir(targetFolder);

      // Copy each selected file
      const copyResults = [];
      const errors = [];

      for (const fileName of selectedFiles) {
        try {
          const sourceFile = path.join(sourceFolder, fileName);
          const targetFile = path.join(targetFolder, fileName);

          // Check if source file exists
          if (await fs.pathExists(sourceFile)) {
            await fs.copy(sourceFile, targetFile, { 
              overwrite: true, 
              preserveTimestamps: false 
            });
            
            copyResults.push(fileName);
            console.log(`✅ Copied AE Markups file: ${fileName}`);
          } else {
            errors.push({ file: fileName, error: 'File not found' });
            console.warn(`⚠️ AE Markups file not found: ${fileName}`);
          }
        } catch (fileError) {
          errors.push({ file: fileName, error: fileError.message });
          console.error(`❌ Error copying AE Markups file ${fileName}:`, fileError);
        }
      }

      const hasErrors = errors.length > 0;
      const successCount = copyResults.length;

      return {
        success: !hasErrors || successCount > 0,
        operation: `Copied ${successCount} AE Markups files`,
        details: {
          source: sourceFolder,
          target: targetFolder,
          selectedFiles: selectedFiles,
          copiedFiles: copyResults,
          errors: errors,
          totalSelected: selectedFiles.length,
          totalCopied: successCount
        },
        warnings: hasErrors ? errors : undefined
      };

    } catch (error) {
      console.error('❌ Error copying selected AE Markups files:', error);
      return {
        success: false,
        operation: 'Failed to copy selected AE Markups files',
        error: error.message,
        details: {
          selectedFiles: selectedFiles,
          error: error.message
        }
      };
    }
  }

  /**
   * Copy a folder if it exists (implements HTA folder copy logic)
   * @param {string} sourcePath - Source RFA path
   * @param {string} targetPath - Target RFA path
   * @param {string} folderName - Name of folder to copy
   * @returns {Promise<Object>} Copy result
   */
  async copyFolderIfExists(sourcePath, targetPath, folderName) {
    try {
      const sourceFolder = path.join(sourcePath, folderName);
      const targetFolder = path.join(targetPath, folderName);

      console.log(`RevisionFileCopyService: Checking folder ${folderName}`);

      // OPTIMIZATION: Use faster existence check
      let sourceExists;
      try {
        await fs.access(sourceFolder);
        sourceExists = true;
      } catch {
        sourceExists = false;
      }

      if (sourceExists) {
        // OPTIMIZATION: Use overwrite option instead of remove/copy
        console.log(`RevisionFileCopyService: Copying ${folderName} folder...`);
        await fs.copy(sourceFolder, targetFolder, { 
          overwrite: true, 
          errorOnExist: false,
          preserveTimestamps: false  // Skip timestamp preservation for speed
        });
        
        console.log(`RevisionFileCopyService: Successfully copied ${folderName} folder`);
        return {
          success: true,
          operation: `Copied ${folderName} folder`,
          details: {
            source: sourceFolder,
            target: targetFolder,
            folderName: folderName
          }
        };
      } else {
        console.log(`RevisionFileCopyService: ${folderName} folder not found (skipped)`);
        return {
          success: true,
          operation: `${folderName} folder not found (skipped)`,
          details: {
            source: sourceFolder,
            target: targetFolder,
            folderName: folderName,
            skipped: true
          }
        };
      }

    } catch (error) {
      console.error(`RevisionFileCopyService: Error copying ${folderName} folder:`, error);
      return {
        success: false,
        operation: `Failed to copy ${folderName} folder`,
        error: error.message,
        details: {
          folderName: folderName,
          error: error.message
        }
      };
    }
  }

  /**
   * Copy files by extension with smart VSP renaming (implements HTA file copy logic)
   * @param {string} sourcePath - Source RFA path
   * @param {string} targetPath - Target RFA path
   * @param {Array} extensions - Array of extensions to copy (e.g., ['.vsp', '.dwg'])
   * @returns {Promise<Object>} Copy result
   */
  async copyFilesByExtension(sourcePath, targetPath, extensions) {
    try {
      console.log(`RevisionFileCopyService: Copying files with extensions:`, extensions);
      console.log('From:', sourcePath);
      console.log('To:', targetPath);

      if (!await fs.pathExists(sourcePath)) {
        return {
          success: false,
          operation: `Source path does not exist: ${sourcePath}`,
          error: 'Source path not found'
        };
      }

      // Extract RFA version for VSP renaming
      const newRFAVersion = this.extractRFAVersionFromPath(targetPath);
      
      // OPTIMIZATION: Get files with their stats in one pass
      const files = await fs.readdir(sourcePath, { withFileTypes: true });
      const copiedFiles = [];
      const errors = [];

      // OPTIMIZATION: Filter and process files in parallel with smart VSP renaming
      const targetExtensions = extensions.map(ext => ext.toLowerCase());
      const filePromises = files
        .filter(dirent => dirent.isFile() && targetExtensions.includes(path.extname(dirent.name).toLowerCase()))
        .map(async (dirent) => {
          try {
            const sourceFile = path.join(sourcePath, dirent.name);
            const originalFilename = dirent.name;
            
            // Check if this is a VSP file that needs renaming
            const isVSPFile = path.extname(originalFilename).toLowerCase() === '.vsp';
            let targetFilename = originalFilename;
            
            if (isVSPFile && newRFAVersion !== null) {
              // Generate new VSP filename with updated version and date
              targetFilename = this.generateRenamedVSPFilename(originalFilename, newRFAVersion);
              console.log(`🎯 VSP Auto-Rename: "${originalFilename}" → "${targetFilename}"`);
            }
            
            const targetFile = path.join(targetPath, targetFilename);
            
            await fs.copy(sourceFile, targetFile, { 
              overwrite: true, 
              preserveTimestamps: false 
            });
            
            return { 
              success: true, 
              file: originalFilename,
              targetFile: targetFilename,
              renamed: isVSPFile && targetFilename !== originalFilename
            };
          } catch (fileError) {
            console.error(`RevisionFileCopyService: Error copying file ${dirent.name}:`, fileError);
            return { success: false, file: dirent.name, error: fileError.message };
          }
        });

      // Wait for all file operations to complete
      const fileResults = await Promise.all(filePromises);
      
      // Process results with renaming information
      const renamedFiles = [];
      fileResults.forEach(result => {
        if (result.success) {
          copiedFiles.push(result.targetFile || result.file);
          
          if (result.renamed) {
            renamedFiles.push({
              original: result.file,
              renamed: result.targetFile
            });
            console.log(`✅ RevisionFileCopyService: Copied and renamed: ${result.file} → ${result.targetFile}`);
          } else {
            console.log(`✅ RevisionFileCopyService: Copied file: ${result.file}`);
          }
        } else {
          errors.push({ file: result.file, error: result.error });
        }
      });

      const hasErrors = errors.length > 0;
      const operationDetails = {
        extensions: extensions,
        totalFiles: copiedFiles.length,
        copiedFiles: copiedFiles,
        renamedFiles: renamedFiles,
        errors: errors
      };

      if (copiedFiles.length > 0) {
        console.log(`RevisionFileCopyService: Successfully copied ${copiedFiles.length} files (${extensions.join(', ')})`);
        return {
          success: !hasErrors,
          operation: `Copied ${copiedFiles.length} files (${extensions.join(', ')})`,
          details: operationDetails,
          warnings: hasErrors ? errors : undefined
        };
      } else {
        console.log(`RevisionFileCopyService: No files found with extensions: ${extensions.join(', ')}`);
        return {
          success: true,
          operation: `No files found with extensions: ${extensions.join(', ')} (skipped)`,
          details: operationDetails
        };
      }

    } catch (error) {
      console.error('RevisionFileCopyService: Error copying files by extension:', error);
      return {
        success: false,
        operation: `Failed to copy files with extensions: ${extensions.join(', ')}`,
        error: error.message,
        details: {
          extensions: extensions,
          error: error.message
        }
      };
    }
  }

  /**
   * Analyze what files and folders are available for copying
   * @param {string} revisionPath - Path to revision folder
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeRevisionContents(revisionPath) {
    try {
      console.log('RevisionFileCopyService: Analyzing revision contents at:', revisionPath);

      // Safety check for null/undefined revisionPath
      if (!revisionPath) {
        console.log('⚠️ Cannot analyze revision contents: path is null/undefined');
        return {
          success: false,
          error: 'Revision path is required',
          available: {}
        };
      }

      if (!await fs.pathExists(revisionPath)) {
        return {
          success: false,
          error: 'Revision path does not exist',
          available: {}
        };
      }

      const contents = await fs.readdir(revisionPath);
      const analysis = {
        folders: {},
        files: {},
        summary: {
          totalFolders: 0,
          totalFiles: 0,
          copyableItems: 0
        }
      };

      // Analyze folders
      for (const folderName of this.supportedFolders) {
        const folderPath = path.join(revisionPath, folderName);
        if (await fs.pathExists(folderPath)) {
          const stats = await fs.stat(folderPath);
          if (stats.isDirectory()) {
            const folderContents = await fs.readdir(folderPath);
            analysis.folders[folderName] = {
              exists: true,
              path: folderPath,
              itemCount: folderContents.length,
              items: folderContents.slice(0, 5) // Show first 5 items
            };
            analysis.summary.totalFolders++;
            analysis.summary.copyableItems++;
          }
        } else {
          analysis.folders[folderName] = {
            exists: false,
            path: folderPath
          };
        }
      }

      // Analyze files by extension
      for (const ext of this.supportedExtensions) {
        const matchingFiles = contents.filter(item => 
          path.extname(item).toLowerCase() === ext
        );

        analysis.files[ext] = {
          count: matchingFiles.length,
          files: matchingFiles
        };

        if (matchingFiles.length > 0) {
          analysis.summary.totalFiles += matchingFiles.length;
          analysis.summary.copyableItems++;
        }
      }

      console.log('RevisionFileCopyService: Analysis complete');
      console.log('Copyable items found:', analysis.summary.copyableItems);

      return {
        success: true,
        available: analysis,
        message: `Found ${analysis.summary.copyableItems} copyable items in revision`
      };

    } catch (error) {
      console.error('RevisionFileCopyService: Error analyzing revision contents:', error);
      return {
        success: false,
        error: error.message,
        available: {}
      };
    }
  }

  /**
   * Get default copy options based on available content
   * @param {Object} analysisResult - Result from analyzeRevisionContents
   * @returns {Object} Recommended copy options
   */
  getRecommendedCopyOptions(analysisResult) {
    if (!analysisResult.success) {
      return {
        copyAEMarkups: false,
        copyBOMCheck: false,
        copyVSP: false
      };
    }

    const available = analysisResult.available;
    
    return {
      copyAEMarkups: available.folders['AE Markups']?.exists || false,
      copyBOMCheck: available.folders['BOM CHECK']?.exists || false,
      copyVSP: (available.files['.vsp']?.count || 0) > 0
    };
  }

  /**
   * Estimate copy operation time based on content analysis
   * @param {Object} analysisResult - Result from analyzeRevisionContents
   * @returns {Object} Time estimation
   */
  estimateCopyTime(analysisResult) {
    if (!analysisResult.success) {
      return { estimatedSeconds: 0, confidence: 'low' };
    }

    const available = analysisResult.available;
    let estimatedSeconds = 0;

    // Estimate based on folder sizes (rough estimates)
    Object.values(available.folders).forEach(folder => {
      if (folder.exists) {
        estimatedSeconds += Math.max(5, folder.itemCount * 0.5); // 0.5 seconds per item, min 5 seconds
      }
    });

    // Estimate based on file counts
    Object.values(available.files).forEach(fileType => {
      estimatedSeconds += fileType.count * 2; // 2 seconds per file
    });

    return {
      estimatedSeconds: Math.max(1, estimatedSeconds),
      confidence: available.summary.copyableItems > 0 ? 'medium' : 'low',
      breakdown: {
        folders: Object.keys(available.folders).filter(k => available.folders[k].exists).length,
        files: available.summary.totalFiles
      }
    };
  }
}

module.exports = RevisionFileCopyService;
