/**
 * WorkloadPersistenceService
 * Handles saving and loading workload data from shared storage
 * Runs in main process - manages workload.json and users.json in shared folder
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { Workload, Assignment } = require('../models/Workload');
const User = require('../models/User');

class WorkloadPersistenceService {
  constructor() {
    this.config = {
      // Default to local directory, can be configured to shared OneDrive folder
      dataDirectory: path.join(os.homedir(), '.project-creator', 'shared'),
      workloadFile: 'workload.json',
      usersFile: 'users.json',
      assignmentsFile: 'assignments.json',
      configFile: 'workload-config.json'
    };
    
    this.initializeDataDirectory();
  }

  /**
   * Initialize data directory and create default files if needed
   */
  async initializeDataDirectory() {
    try {
      await fs.ensureDir(this.config.dataDirectory);
      
      // Create default files if they don't exist
      const workloadPath = this.getDataFilePath(this.config.workloadFile);
      const usersPath = this.getDataFilePath(this.config.usersFile);
      const assignmentsPath = this.getDataFilePath(this.config.assignmentsFile);
      const configPath = this.getDataFilePath(this.config.configFile);
      
      if (!await fs.pathExists(workloadPath)) {
        await this.saveWorkloads([]);
      }
      
      if (!await fs.pathExists(usersPath)) {
        await this.saveUsers([]);
      }
      
      if (!await fs.pathExists(assignmentsPath)) {
        await this.saveAssignments([]);
      }
      
      if (!await fs.pathExists(configPath)) {
        await this.saveConfig({
          version: '1.0.0',
          lastModified: new Date().toISOString(),
          settings: {
            enableRealTimeSync: true,
            syncInterval: 30000, // 30 seconds
            conflictResolution: 'last-write-wins'
          }
        });
      }
      
      console.log('✅ Workload data directory initialized:', this.config.dataDirectory);
    } catch (error) {
      console.error('❌ Error initializing workload data directory:', error);
    }
  }

  /**
   * Set custom data directory (for shared OneDrive folder)
   */
  setDataDirectory(directoryPath) {
    this.config.dataDirectory = directoryPath;
    return this.initializeDataDirectory();
  }

  /**
   * Get full path to data file
   */
  getDataFilePath(filename) {
    return path.join(this.config.dataDirectory, filename);
  }

  /**
   * Save all workloads to file
   */
  async saveWorkloads(workloads) {
    try {
      const filePath = this.getDataFilePath(this.config.workloadFile);
      const data = {
        workloads: workloads.map(w => w instanceof Workload ? w.toJSON() : w),
        metadata: {
          lastModified: new Date().toISOString(),
          version: 1,
          count: workloads.length
        }
      };
      
      await fs.writeJson(filePath, data, { spaces: 2 });
      return { success: true, count: workloads.length };
    } catch (error) {
      console.error('Error saving workloads:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load all workloads from file
   */
  async loadWorkloads() {
    try {
      const filePath = this.getDataFilePath(this.config.workloadFile);
      
      if (!await fs.pathExists(filePath)) {
        return { success: true, workloads: [] };
      }
      
      const data = await fs.readJson(filePath);
      const workloads = (data.workloads || []).map(w => Workload.fromJSON(w));
      
      return { success: true, workloads };
    } catch (error) {
      console.error('Error loading workloads:', error);
      return { success: false, workloads: [], error: error.message };
    }
  }

  /**
   * Save workload for specific user
   */
  async saveUserWorkload(userId, workload) {
    try {
      const result = await this.loadWorkloads();
      let workloads = result.workloads || [];
      
      // Find existing workload for user
      const existingIndex = workloads.findIndex(w => w.userId === userId);
      
      if (existingIndex !== -1) {
        workloads[existingIndex] = workload instanceof Workload ? workload : Workload.fromJSON(workload);
      } else {
        workloads.push(workload instanceof Workload ? workload : Workload.fromJSON(workload));
      }
      
      return await this.saveWorkloads(workloads);
    } catch (error) {
      console.error('Error saving user workload:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load workload for specific user
   */
  async loadUserWorkload(userId) {
    try {
      const result = await this.loadWorkloads();
      const workloads = result.workloads || [];
      
      const userWorkload = workloads.find(w => w.userId === userId);
      
      if (userWorkload) {
        return { success: true, workload: userWorkload };
      }
      
      // Return empty workload if not found
      return { success: true, workload: new Workload({ userId }) };
    } catch (error) {
      console.error('Error loading user workload:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save all users to file
   */
  async saveUsers(users) {
    try {
      const filePath = this.getDataFilePath(this.config.usersFile);
      const data = {
        users: users.map(u => u instanceof User ? u.toJSON() : u),
        metadata: {
          lastModified: new Date().toISOString(),
          version: 1,
          count: users.length
        }
      };
      
      await fs.writeJson(filePath, data, { spaces: 2 });
      return { success: true, count: users.length };
    } catch (error) {
      console.error('Error saving users:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load all users from file
   */
  async loadUsers() {
    try {
      const filePath = this.getDataFilePath(this.config.usersFile);
      
      if (!await fs.pathExists(filePath)) {
        return { success: true, users: [] };
      }
      
      const data = await fs.readJson(filePath);
      const users = (data.users || []).map(u => User.fromJSON(u));
      
      return { success: true, users };
    } catch (error) {
      console.error('Error loading users:', error);
      return { success: false, users: [], error: error.message };
    }
  }

  /**
   * Save single user
   */
  async saveUser(user) {
    try {
      const result = await this.loadUsers();
      let users = result.users || [];
      
      const existingIndex = users.findIndex(u => u.id === user.id);
      
      if (existingIndex !== -1) {
        users[existingIndex] = user instanceof User ? user : User.fromJSON(user);
      } else {
        users.push(user instanceof User ? user : User.fromJSON(user));
      }
      
      return await this.saveUsers(users);
    } catch (error) {
      console.error('Error saving user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId) {
    try {
      const result = await this.loadUsers();
      const users = result.users || [];
      const user = users.find(u => u.id === userId);
      
      return { success: true, user: user || null };
    } catch (error) {
      console.error('Error getting user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    try {
      const result = await this.loadUsers();
      const users = result.users || [];
      const user = users.find(u => u.email === email);
      
      return { success: true, user: user || null };
    } catch (error) {
      console.error('Error getting user by email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId) {
    try {
      const result = await this.loadUsers();
      let users = result.users || [];
      
      users = users.filter(u => u.id !== userId);
      
      return await this.saveUsers(users);
    } catch (error) {
      console.error('Error deleting user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save all assignments (flattened view of all user assignments)
   */
  async saveAssignments(assignments) {
    try {
      const filePath = this.getDataFilePath(this.config.assignmentsFile);
      const data = {
        assignments: assignments.map(a => a instanceof Assignment ? a.toJSON() : a),
        metadata: {
          lastModified: new Date().toISOString(),
          version: 1,
          count: assignments.length
        }
      };
      
      await fs.writeJson(filePath, data, { spaces: 2 });
      return { success: true, count: assignments.length };
    } catch (error) {
      console.error('Error saving assignments:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load all assignments
   */
  async loadAssignments() {
    try {
      const filePath = this.getDataFilePath(this.config.assignmentsFile);
      
      if (!await fs.pathExists(filePath)) {
        return { success: true, assignments: [] };
      }
      
      const data = await fs.readJson(filePath);
      const assignments = (data.assignments || []).map(a => Assignment.fromJSON(a));
      
      return { success: true, assignments };
    } catch (error) {
      console.error('Error loading assignments:', error);
      return { success: false, assignments: [], error: error.message };
    }
  }

  /**
   * Add or update assignment
   */
  async saveAssignment(assignment) {
    try {
      const result = await this.loadAssignments();
      let assignments = result.assignments || [];
      
      const existingIndex = assignments.findIndex(a => a.id === assignment.id);
      
      if (existingIndex !== -1) {
        assignments[existingIndex] = assignment instanceof Assignment ? assignment : Assignment.fromJSON(assignment);
      } else {
        assignments.push(assignment instanceof Assignment ? assignment : Assignment.fromJSON(assignment));
      }
      
      return await this.saveAssignments(assignments);
    } catch (error) {
      console.error('Error saving assignment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete assignment
   */
  async deleteAssignment(assignmentId) {
    try {
      const result = await this.loadAssignments();
      let assignments = result.assignments || [];
      
      assignments = assignments.filter(a => a.id !== assignmentId);
      
      return await this.saveAssignments(assignments);
    } catch (error) {
      console.error('Error deleting assignment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get assignments for specific user
   */
  async getUserAssignments(userId) {
    try {
      const result = await this.loadAssignments();
      const assignments = result.assignments || [];
      
      const userAssignments = assignments.filter(a => a.userId === userId);
      
      return { success: true, assignments: userAssignments };
    } catch (error) {
      console.error('Error getting user assignments:', error);
      return { success: false, assignments: [], error: error.message };
    }
  }

  /**
   * Get assignments by date range
   */
  async getAssignmentsByDateRange(startDate, endDate) {
    try {
      const result = await this.loadAssignments();
      const assignments = result.assignments || [];
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      const filteredAssignments = assignments.filter(a => {
        const assignmentStart = new Date(a.startDate);
        const assignmentEnd = a.dueDate ? new Date(a.dueDate) : assignmentStart;
        
        return (assignmentStart <= end && assignmentEnd >= start);
      });
      
      return { success: true, assignments: filteredAssignments };
    } catch (error) {
      console.error('Error getting assignments by date range:', error);
      return { success: false, assignments: [], error: error.message };
    }
  }

  /**
   * Save configuration
   */
  async saveConfig(config) {
    try {
      const filePath = this.getDataFilePath(this.config.configFile);
      await fs.writeJson(filePath, config, { spaces: 2 });
      return { success: true };
    } catch (error) {
      console.error('Error saving config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load configuration
   */
  async loadConfig() {
    try {
      const filePath = this.getDataFilePath(this.config.configFile);
      
      if (!await fs.pathExists(filePath)) {
        return { 
          success: true, 
          config: {
            version: '1.0.0',
            settings: {
              enableRealTimeSync: true,
              syncInterval: 30000,
              conflictResolution: 'last-write-wins'
            }
          }
        };
      }
      
      const config = await fs.readJson(filePath);
      return { success: true, config };
    } catch (error) {
      console.error('Error loading config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get statistics
   */
  async getStats() {
    try {
      const usersResult = await this.loadUsers();
      const assignmentsResult = await this.loadAssignments();
      
      const users = usersResult.users || [];
      const assignments = assignmentsResult.assignments || [];
      
      // Calculate statistics
      const activeUsers = users.filter(u => u.isActive).length;
      const activeAssignments = assignments.filter(a => 
        a.status !== 'COMPLETE'
      ).length;
      
      const totalHoursAllocated = assignments.reduce((sum, a) => 
        sum + a.hoursAllocated, 0
      );
      
      const totalHoursSpent = assignments.reduce((sum, a) => 
        sum + a.hoursSpent, 0
      );
      
      const overdueAssignments = assignments.filter(a => {
        if (!a.dueDate || a.status === 'COMPLETE') return false;
        return new Date(a.dueDate) < new Date();
      }).length;
      
      return {
        success: true,
        stats: {
          totalUsers: users.length,
          activeUsers,
          totalAssignments: assignments.length,
          activeAssignments,
          completedAssignments: assignments.filter(a => a.status === 'COMPLETE').length,
          overdueAssignments,
          totalHoursAllocated,
          totalHoursSpent,
          averageHoursPerAssignment: assignments.length > 0 
            ? totalHoursAllocated / assignments.length 
            : 0
        }
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Backup data
   */
  async createBackup() {
    try {
      const backupDir = path.join(this.config.dataDirectory, 'backups');
      await fs.ensureDir(backupDir);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `backup-${timestamp}`);
      await fs.ensureDir(backupPath);
      
      // Copy all data files
      const files = [
        this.config.workloadFile,
        this.config.usersFile,
        this.config.assignmentsFile,
        this.config.configFile
      ];
      
      for (const file of files) {
        const sourcePath = this.getDataFilePath(file);
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, path.join(backupPath, file));
        }
      }
      
      return { success: true, backupPath };
    } catch (error) {
      console.error('Error creating backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all data (use with caution!)
   */
  async clearAllData() {
    try {
      await this.saveWorkloads([]);
      await this.saveUsers([]);
      await this.saveAssignments([]);
      
      return { success: true, message: 'All data cleared' };
    } catch (error) {
      console.error('Error clearing data:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = WorkloadPersistenceService;

