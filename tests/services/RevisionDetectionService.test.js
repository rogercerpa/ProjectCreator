const fs = require('fs-extra');
const path = require('path');
const RevisionDetectionService = require('../../src/services/RevisionDetectionService');

// Mock fs-extra
jest.mock('fs-extra');

// Mock RFATypeMatchingService
jest.mock('../../src/services/RFATypeMatchingService', () => {
  return jest.fn().mockImplementation(() => ({
    selectBestRFAFolder: jest.fn(),
    findBestRFATypeMatches: jest.fn()
  }));
});

describe('RevisionDetectionService', () => {
  let revisionService;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create fresh instance
    revisionService = new RevisionDetectionService();
  });

  describe('findNewestVSPAcrossAllFolders', () => {
    const mockProjectPath = 'C:\\Projects\\TEST PROJECT_25-12345';

    test('should find the newest VSP file across multiple RFA folders', async () => {
      // Mock directory contents with RFA folders
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockImplementation((dirPath, options) => {
        if (dirPath === mockProjectPath) {
          // Project directory - return RFA folders
          return Promise.resolve([
            { name: 'RFA#12345-1_BOM_01152025', isDirectory: () => true, isFile: () => false },
            { name: 'RFA#12345-2_SUBMITTAL_01202025', isDirectory: () => true, isFile: () => false },
            { name: 'RFA#12345-3_BOM WITH LAYOUT_01252025', isDirectory: () => true, isFile: () => false },
            { name: 'Other Folder', isDirectory: () => true, isFile: () => false }
          ]);
        } else if (dirPath.includes('RFA#12345-1_BOM')) {
          // First RFA folder - older VSP
          return Promise.resolve([
            { name: 'PROJECT_REV1_01152025.vsp', isDirectory: () => false, isFile: () => true }
          ]);
        } else if (dirPath.includes('RFA#12345-2_SUBMITTAL')) {
          // Second RFA folder - no VSP
          return Promise.resolve([
            { name: 'schedule.pdf', isDirectory: () => false, isFile: () => true }
          ]);
        } else if (dirPath.includes('RFA#12345-3_BOM WITH LAYOUT')) {
          // Third RFA folder - newest VSP
          return Promise.resolve([
            { name: 'PROJECT_REV3_01252025.vsp', isDirectory: () => false, isFile: () => true }
          ]);
        }
        return Promise.resolve([]);
      });

      // Mock file stats with different modification times
      fs.stat.mockImplementation((filePath) => {
        if (filePath.includes('REV1')) {
          return Promise.resolve({
            mtime: new Date('2025-01-15T10:00:00Z'),
            mtimeMs: new Date('2025-01-15T10:00:00Z').getTime(),
            size: 1000
          });
        } else if (filePath.includes('REV3')) {
          return Promise.resolve({
            mtime: new Date('2025-01-25T14:00:00Z'),
            mtimeMs: new Date('2025-01-25T14:00:00Z').getTime(),
            size: 2000
          });
        }
        return Promise.resolve({
          mtime: new Date('2025-01-01T00:00:00Z'),
          mtimeMs: new Date('2025-01-01T00:00:00Z').getTime(),
          size: 500
        });
      });

      const result = await revisionService.findNewestVSPAcrossAllFolders(mockProjectPath);

      expect(result.success).toBe(true);
      expect(result.newestVsp).toBeDefined();
      expect(result.newestVsp.name).toBe('PROJECT_REV3_01252025.vsp');
      expect(result.newestVsp.folderName).toBe('RFA#12345-3_BOM WITH LAYOUT_01252025');
      expect(result.totalVspFiles).toBe(2);
      expect(result.scannedFolders).toBe(3); // Only RFA folders, not "Other Folder"
    });

    test('should handle project with no RFA folders', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockResolvedValue([
        { name: 'Documents', isDirectory: () => true, isFile: () => false },
        { name: 'readme.txt', isDirectory: () => false, isFile: () => true }
      ]);

      const result = await revisionService.findNewestVSPAcrossAllFolders(mockProjectPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No RFA folders found in project directory');
      expect(result.newestVsp).toBeNull();
    });

    test('should handle RFA folders with no VSP files', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockImplementation((dirPath, options) => {
        if (dirPath === mockProjectPath) {
          return Promise.resolve([
            { name: 'RFA#12345-1_BOM_01152025', isDirectory: () => true, isFile: () => false }
          ]);
        }
        // RFA folder with no VSP files
        return Promise.resolve([
          { name: 'document.pdf', isDirectory: () => false, isFile: () => true },
          { name: 'schedule.xlsx', isDirectory: () => false, isFile: () => true }
        ]);
      });

      const result = await revisionService.findNewestVSPAcrossAllFolders(mockProjectPath);

      expect(result.success).toBe(true);
      expect(result.newestVsp).toBeNull();
      expect(result.message).toBe('No VSP files found in any RFA folder');
      expect(result.scannedFolders).toBe(1);
    });

    test('should handle null project path', async () => {
      const result = await revisionService.findNewestVSPAcrossAllFolders(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project path is required');
      expect(result.newestVsp).toBeNull();
    });

    test('should handle non-existent project path', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await revisionService.findNewestVSPAcrossAllFolders('/nonexistent/path');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project path does not exist');
      expect(result.newestVsp).toBeNull();
    });

    test('should correctly sort VSP files by modification time (newest first)', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockImplementation((dirPath, options) => {
        if (dirPath === mockProjectPath) {
          return Promise.resolve([
            { name: 'RFA#12345-1_BOM_01012025', isDirectory: () => true, isFile: () => false },
            { name: 'RFA#12345-2_SUBMITTAL_01152025', isDirectory: () => true, isFile: () => false }
          ]);
        } else if (dirPath.includes('RFA#12345-1_BOM')) {
          return Promise.resolve([
            { name: 'OLD_PROJECT.vsp', isDirectory: () => false, isFile: () => true }
          ]);
        } else if (dirPath.includes('RFA#12345-2_SUBMITTAL')) {
          return Promise.resolve([
            { name: 'NEW_PROJECT.vsp', isDirectory: () => false, isFile: () => true }
          ]);
        }
        return Promise.resolve([]);
      });

      // Newer file in SUBMITTAL folder (different RFA type)
      fs.stat.mockImplementation((filePath) => {
        if (filePath.includes('OLD_PROJECT')) {
          return Promise.resolve({
            mtime: new Date('2025-01-01T10:00:00Z'),
            mtimeMs: new Date('2025-01-01T10:00:00Z').getTime(),
            size: 1000
          });
        } else if (filePath.includes('NEW_PROJECT')) {
          return Promise.resolve({
            mtime: new Date('2025-01-20T15:30:00Z'),
            mtimeMs: new Date('2025-01-20T15:30:00Z').getTime(),
            size: 1500
          });
        }
        return Promise.reject(new Error('Unknown file'));
      });

      const result = await revisionService.findNewestVSPAcrossAllFolders(mockProjectPath);

      expect(result.success).toBe(true);
      expect(result.newestVsp.name).toBe('NEW_PROJECT.vsp');
      expect(result.newestVsp.folderName).toBe('RFA#12345-2_SUBMITTAL_01152025');
      expect(result.allVspFiles).toHaveLength(2);
      // Verify sorting - newest first
      expect(result.allVspFiles[0].name).toBe('NEW_PROJECT.vsp');
      expect(result.allVspFiles[1].name).toBe('OLD_PROJECT.vsp');
    });

    test('should handle file stat errors gracefully', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockImplementation((dirPath, options) => {
        if (dirPath === mockProjectPath) {
          return Promise.resolve([
            { name: 'RFA#12345-1_BOM_01012025', isDirectory: () => true, isFile: () => false }
          ]);
        }
        return Promise.resolve([
          { name: 'GOOD_FILE.vsp', isDirectory: () => false, isFile: () => true },
          { name: 'BAD_FILE.vsp', isDirectory: () => false, isFile: () => true }
        ]);
      });

      fs.stat.mockImplementation((filePath) => {
        if (filePath.includes('GOOD_FILE')) {
          return Promise.resolve({
            mtime: new Date('2025-01-15T10:00:00Z'),
            mtimeMs: new Date('2025-01-15T10:00:00Z').getTime(),
            size: 1000
          });
        } else if (filePath.includes('BAD_FILE')) {
          return Promise.reject(new Error('Permission denied'));
        }
        return Promise.reject(new Error('Unknown file'));
      });

      const result = await revisionService.findNewestVSPAcrossAllFolders(mockProjectPath);

      // Should still succeed with the good file
      expect(result.success).toBe(true);
      expect(result.newestVsp.name).toBe('GOOD_FILE.vsp');
      expect(result.totalVspFiles).toBe(1); // Only the good file was added
    });

    test('should handle multiple VSP files in same folder', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockImplementation((dirPath, options) => {
        if (dirPath === mockProjectPath) {
          return Promise.resolve([
            { name: 'RFA#12345-1_BOM_01012025', isDirectory: () => true, isFile: () => false }
          ]);
        }
        return Promise.resolve([
          { name: 'PROJECT_V1.vsp', isDirectory: () => false, isFile: () => true },
          { name: 'PROJECT_V2.vsp', isDirectory: () => false, isFile: () => true },
          { name: 'PROJECT_V3.vsp', isDirectory: () => false, isFile: () => true }
        ]);
      });

      fs.stat.mockImplementation((filePath) => {
        if (filePath.includes('V1')) {
          return Promise.resolve({
            mtime: new Date('2025-01-01T10:00:00Z'),
            mtimeMs: new Date('2025-01-01T10:00:00Z').getTime(),
            size: 1000
          });
        } else if (filePath.includes('V2')) {
          return Promise.resolve({
            mtime: new Date('2025-01-10T10:00:00Z'),
            mtimeMs: new Date('2025-01-10T10:00:00Z').getTime(),
            size: 1200
          });
        } else if (filePath.includes('V3')) {
          return Promise.resolve({
            mtime: new Date('2025-01-20T10:00:00Z'),
            mtimeMs: new Date('2025-01-20T10:00:00Z').getTime(),
            size: 1500
          });
        }
        return Promise.reject(new Error('Unknown file'));
      });

      const result = await revisionService.findNewestVSPAcrossAllFolders(mockProjectPath);

      expect(result.success).toBe(true);
      expect(result.newestVsp.name).toBe('PROJECT_V3.vsp');
      expect(result.totalVspFiles).toBe(3);
    });

    test('should handle BOM WITH LAYOUT vs SUBMITTAL scenario (real-world case)', async () => {
      // This tests the specific scenario mentioned in the requirements:
      // Project has multiple revision folders, some for BOM WITH LAYOUT and others for SUBMITTALS
      // We want to copy from the folder with the newest VSP timestamp
      
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockImplementation((dirPath, options) => {
        if (dirPath === mockProjectPath) {
          return Promise.resolve([
            { name: 'RFA#12345-1_BOM WITH LAYOUT_01012025', isDirectory: () => true, isFile: () => false },
            { name: 'RFA#12345-2_SUBMITTALS_01152025', isDirectory: () => true, isFile: () => false },
            { name: 'RFA#12345-3_BOM WITH LAYOUT_01202025', isDirectory: () => true, isFile: () => false }
          ]);
        } else if (dirPath.includes('RFA#12345-1_BOM WITH LAYOUT')) {
          return Promise.resolve([
            { name: 'PROJECT_LAYOUT_V1.vsp', isDirectory: () => false, isFile: () => true }
          ]);
        } else if (dirPath.includes('RFA#12345-2_SUBMITTALS')) {
          return Promise.resolve([
            { name: 'PROJECT_SUBMITTAL_V2.vsp', isDirectory: () => false, isFile: () => true }
          ]);
        } else if (dirPath.includes('RFA#12345-3_BOM WITH LAYOUT')) {
          return Promise.resolve([
            { name: 'PROJECT_LAYOUT_V3.vsp', isDirectory: () => false, isFile: () => true }
          ]);
        }
        return Promise.resolve([]);
      });

      // V3 from latest BOM WITH LAYOUT is newest
      fs.stat.mockImplementation((filePath) => {
        if (filePath.includes('V1')) {
          return Promise.resolve({
            mtime: new Date('2025-01-01T10:00:00Z'),
            mtimeMs: new Date('2025-01-01T10:00:00Z').getTime(),
            size: 1000
          });
        } else if (filePath.includes('V2')) {
          return Promise.resolve({
            mtime: new Date('2025-01-15T10:00:00Z'),
            mtimeMs: new Date('2025-01-15T10:00:00Z').getTime(),
            size: 1200
          });
        } else if (filePath.includes('V3')) {
          return Promise.resolve({
            mtime: new Date('2025-01-20T14:30:00Z'),
            mtimeMs: new Date('2025-01-20T14:30:00Z').getTime(),
            size: 1500
          });
        }
        return Promise.reject(new Error('Unknown file'));
      });

      const result = await revisionService.findNewestVSPAcrossAllFolders(mockProjectPath);

      expect(result.success).toBe(true);
      expect(result.newestVsp.name).toBe('PROJECT_LAYOUT_V3.vsp');
      expect(result.newestVsp.folderName).toBe('RFA#12345-3_BOM WITH LAYOUT_01202025');
      expect(result.totalVspFiles).toBe(3);
      expect(result.message).toContain('PROJECT_LAYOUT_V3.vsp');
    });
  });

  describe('extractRFAVersion', () => {
    test('should extract version number from standard RFA folder name', () => {
      const version = revisionService.extractRFAVersion('RFA#12345-3_BOM_01152025');
      expect(version).toBe(3);
    });

    test('should extract version number from complex RFA folder name', () => {
      const version = revisionService.extractRFAVersion('RFA#246631-12_BOM WITH LAYOUT_01252025');
      expect(version).toBe(12);
    });

    test('should return null for invalid RFA folder name', () => {
      const version = revisionService.extractRFAVersion('Some Other Folder');
      expect(version).toBeNull();
    });
  });

  describe('extractDateFromRFAName', () => {
    test('should extract date from standard RFA folder name', () => {
      const date = revisionService.extractDateFromRFAName('RFA#12345-1_BOM_01152025');
      expect(date).toBeInstanceOf(Date);
      expect(date.getMonth()).toBe(0); // January (0-indexed)
      expect(date.getDate()).toBe(15);
      expect(date.getFullYear()).toBe(2025);
    });

    test('should return null for invalid date format', () => {
      const date = revisionService.extractDateFromRFAName('RFA#12345-1_BOM_invalid');
      expect(date).toBeNull();
    });
  });
});
