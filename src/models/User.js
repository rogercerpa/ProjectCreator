/**
 * User Model
 * Represents a user in the workload system
 */

class User {
  constructor(data = {}) {
    this.id = data.id || this.generateUserId();
    this.name = data.name || '';
    this.email = data.email || '';
    this.role = data.role || 'Designer'; // Designer, Manager, QC, etc.
    this.weeklyCapacity = data.weeklyCapacity || 40; // Hours per week
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.availability = data.availability || {}; // Day-specific availability
    this.preferences = data.preferences || {
      notifications: true,
      onlyMyAssignments: false,
      emailNotifications: false
    };
    this.metadata = {
      createdAt: data.metadata?.createdAt || new Date().toISOString(),
      lastModified: data.metadata?.lastModified || new Date().toISOString(),
      lastSeen: data.metadata?.lastSeen || new Date().toISOString(),
      status: data.metadata?.status || 'offline' // online, offline, away
    };
  }

  /**
   * Generate a unique user ID
   */
  generateUserId() {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update user's last seen timestamp
   */
  updateLastSeen() {
    this.metadata.lastSeen = new Date().toISOString();
    this.metadata.lastModified = new Date().toISOString();
  }

  /**
   * Update user's online status
   */
  updateStatus(status) {
    if (['online', 'offline', 'away'].includes(status)) {
      this.metadata.status = status;
      this.updateLastSeen();
    }
  }

  /**
   * Check if user is available on a specific date
   */
  isAvailableOn(date) {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return this.availability[dateStr] !== false;
  }

  /**
   * Set availability for a specific date
   */
  setAvailability(date, isAvailable) {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    this.availability[dateStr] = isAvailable;
    this.metadata.lastModified = new Date().toISOString();
  }

  /**
   * Get daily capacity (accounting for availability)
   */
  getDailyCapacity(date = null) {
    if (date && !this.isAvailableOn(date)) {
      return 0;
    }
    return this.weeklyCapacity / 5; // Assuming 5-day work week
  }

  /**
   * Validate user data
   */
  validate() {
    const errors = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (!this.email || !this.isValidEmail(this.email)) {
      errors.push('Valid email is required');
    }

    if (this.weeklyCapacity < 0 || this.weeklyCapacity > 168) {
      errors.push('Weekly capacity must be between 0 and 168 hours');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Simple email validation
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      weeklyCapacity: this.weeklyCapacity,
      isActive: this.isActive,
      availability: this.availability,
      preferences: this.preferences,
      metadata: this.metadata
    };
  }

  /**
   * Create User instance from plain object
   */
  static fromJSON(data) {
    return new User(data);
  }

  /**
   * Clone user instance
   */
  clone() {
    return new User(this.toJSON());
  }
}

module.exports = User;

