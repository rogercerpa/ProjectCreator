const fs = require('fs-extra');
const path = require('path');

/**
 * RevisionFileCopyService
 * Handles copying files and folders from previous revisions
 * Implements the HTA logic for revision file operations
 */
class RevisionFileCopyService {
  constructor() {
    this.supportedFolders = ['AE Markups', 'XREF', 'LCD', 'BOM CHECK'];
    this.supportedExtensions = ['.vsp', '.dwg'];
  }

  /**
   * Copy all revision assets from previous revision to new revision
   * @param {string} previousRevisionPath - Path to previous RFA folder
   * @param {string} newRevisionPath - Path to new RFA folder
   * @param {Object} options - Copy options and progress callback
   * @returns {Promise<Object>} Copy operation result
   */
  async copyRevisionAssets(previousRevisionPath, newRevisionPath, options = {}) {
    try {
      console.log('RevisionFileCopyService: Starting revision asset copy');
      console.log('From:', previousRevisionPath);
      console.log('To:', newRevisionPath);

      const copyOptions = {
        copyAEMarkups: true,
        copyXREF: true,
        copyLCD: true,
        copyBOMCheck: true,
        copyVSP: true,
        copyDWG: true,
        ...options.copyOptions
      };

      const operations = [];
      const results = [];

      // Define copy operations based on options
      if (copyOptions.copyAEMarkups) {
        operations.push({ type: 'folder', name: 'AE Markups', weight: 20 });
      }
      if (copyOptions.copyXREF) {
        operations.push({ type: 'folder', name: 'XREF', weight: 20 });
      }
      if (copyOptions.copyLCD) {
        operations.push({ type: 'folder', name: 'LCD', weight: 15 });
      }
      if (copyOptions.copyBOMCheck) {
        operations.push({ type: 'folder', name: 'BOM CHECK', weight: 20 });
      }
      if (copyOptions.copyVSP || copyOptions.copyDWG) {
        const extensions = [];
        if (copyOptions.copyVSP) extensions.push('.vsp');
        if (copyOptions.copyDWG) extensions.push('.dwg');
        operations.push({ type: 'files', extensions: extensions, weight: 30 });
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
   * Copy files by extension (implements HTA file copy logic)
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

      // OPTIMIZATION: Get files with their stats in one pass
      const files = await fs.readdir(sourcePath, { withFileTypes: true });
      const copiedFiles = [];
      const errors = [];

      // OPTIMIZATION: Filter and process files in parallel
      const targetExtensions = extensions.map(ext => ext.toLowerCase());
      const filePromises = files
        .filter(dirent => dirent.isFile() && targetExtensions.includes(path.extname(dirent.name).toLowerCase()))
        .map(async (dirent) => {
          try {
            const sourceFile = path.join(sourcePath, dirent.name);
            const targetFile = path.join(targetPath, dirent.name);
            
            await fs.copy(sourceFile, targetFile, { 
              overwrite: true, 
              preserveTimestamps: false 
            });
            
            return { success: true, file: dirent.name };
          } catch (fileError) {
            console.error(`RevisionFileCopyService: Error copying file ${dirent.name}:`, fileError);
            return { success: false, file: dirent.name, error: fileError.message };
          }
        });

      // Wait for all file operations to complete
      const fileResults = await Promise.all(filePromises);
      
      // Process results
      fileResults.forEach(result => {
        if (result.success) {
          copiedFiles.push(result.file);
          console.log(`RevisionFileCopyService: Copied file ${result.file}`);
        } else {
          errors.push({ file: result.file, error: result.error });
        }
      });

      const hasErrors = errors.length > 0;
      const operationDetails = {
        extensions: extensions,
        totalFiles: copiedFiles.length,
        copiedFiles: copiedFiles,
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
        copyXREF: false,
        copyLCD: false,
        copyVSP: false,
        copyDWG: false
      };
    }

    const available = analysisResult.available;
    
    return {
      copyAEMarkups: available.folders['AE Markups']?.exists || false,
      copyXREF: available.folders['XREF']?.exists || false,
      copyLCD: available.folders['LCD']?.exists || false,
      copyVSP: (available.files['.vsp']?.count || 0) > 0,
      copyDWG: (available.files['.dwg']?.count || 0) > 0
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
