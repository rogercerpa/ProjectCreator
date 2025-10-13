/**
 * CurrentUserService
 * Manages the current logged-in user for the workload system
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class CurrentUserService {
  constructor(workloadPersistenceService) {
    this.workloadPersistence = workloadPersistenceService;
    this.currentUser = null;
  }

  /**
   * Initialize current user from settings or create new profile
   */
  async initializeUser(settings) {
    try {
      // Check if user profile exists in settings
      if (settings && settings.workloadSettings) {
        const { userName, userEmail, weeklyCapacity } = settings.workloadSettings;
        
        if (userName && userEmail) {
          // Try to find existing user or create new one
          const usersResult = await this.workloadPersistence.loadUsers();
          
          if (usersResult.success) {
            // Find user by email (unique identifier)
            let user = usersResult.users.find(u => u.email === userEmail);
            
            if (user) {
              // Update existing user info if changed
              user.name = userName;
              user.weeklyCapacity = weeklyCapacity || 40;
              user.metadata.lastSeen = new Date().toISOString();
              user.metadata.status = 'online';
              
              await this.workloadPersistence.saveUser(user);
              this.currentUser = user;
            } else {
              // Create new user
              const newUser = {
                id: this.generateUserId(),
                name: userName,
                email: userEmail,
                role: 'Designer',
                weeklyCapacity: weeklyCapacity || 40,
                isActive: true,
                availability: {},
                preferences: {
                  notifications: settings.workloadSettings.showNotifications !== false,
                  onlyMyAssignments: settings.workloadSettings.onlyMyAssignments === true,
                  emailNotifications: false
                },
                metadata: {
                  createdAt: new Date().toISOString(),
                  lastModified: new Date().toISOString(),
                  lastSeen: new Date().toISOString(),
                  status: 'online'
                }
              };
              
              await this.workloadPersistence.saveUser(newUser);
              this.currentUser = newUser;
            }
            
            return { success: true, user: this.currentUser };
          }
        }
      }
      
      // No user profile configured
      return { success: false, error: 'User profile not configured. Please set up your profile in Settings > Workload.' };
    } catch (error) {
      console.error('Error initializing user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate unique user ID
   */
  generateUserId() {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Update current user's status
   */
  async updateStatus(status) {
    if (this.currentUser && ['online', 'offline', 'away'].includes(status)) {
      this.currentUser.metadata.status = status;
      this.currentUser.metadata.lastSeen = new Date().toISOString();
      await this.workloadPersistence.saveUser(this.currentUser);
      return { success: true };
    }
    return { success: false, error: 'No current user or invalid status' };
  }

  /**
   * Set user offline on app close
   */
  async setOffline() {
    return await this.updateStatus('offline');
  }
}

module.exports = CurrentUserService;

