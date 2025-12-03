/**
 * Workload Model
 * Represents workload assignments and capacity tracking
 */

class Assignment {
  constructor(data = {}) {
    this.id = data.id || this.generateAssignmentId();
    this.projectId = data.projectId || '';
    this.projectName = data.projectName || '';
    this.rfaNumber = data.rfaNumber || '';
    this.userId = data.userId || '';
    this.hoursAllocated = data.hoursAllocated || 0;
    this.hoursSpent = data.hoursSpent || 0;
    this.startDate = data.startDate || new Date().toISOString().split('T')[0];
    this.dueDate = data.dueDate || '';
    this.status = data.status || 'ASSIGNED'; // ASSIGNED, IN PROGRESS, IN QC, COMPLETE, PAUSE
    this.priority = data.priority || 'medium'; // low, medium, high, urgent
    this.assignedBy = data.assignedBy || '';
    this.notes = data.notes || '';
    this.taskType = data.taskType || null; // TRIAGE, DESIGN, QC, or null (for backward compatibility)
    this.metadata = {
      createdAt: data.metadata?.createdAt || new Date().toISOString(),
      lastModified: data.metadata?.lastModified || new Date().toISOString(),
      assignedAt: data.metadata?.assignedAt || new Date().toISOString()
    };
  }

  generateAssignmentId() {
    return `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate remaining hours
   */
  getRemainingHours() {
    return Math.max(0, this.hoursAllocated - this.hoursSpent);
  }

  /**
   * Calculate progress percentage
   */
  getProgress() {
    if (this.hoursAllocated === 0) return 0;
    return Math.min(100, (this.hoursSpent / this.hoursAllocated) * 100);
  }

  /**
   * Check if assignment is overdue
   */
  isOverdue() {
    if (!this.dueDate) return false;
    const dueDate = new Date(this.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today && this.status !== 'COMPLETE';
  }

  /**
   * Get days until due
   */
  getDaysUntilDue() {
    if (!this.dueDate) return null;
    const dueDate = new Date(this.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = dueDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Update status
   */
  updateStatus(newStatus) {
    const validStatuses = ['ASSIGNED', 'IN PROGRESS', 'IN QC', 'COMPLETE', 'PAUSE'];
    if (validStatuses.includes(newStatus)) {
      this.status = newStatus;
      this.metadata.lastModified = new Date().toISOString();
      
      // Auto-complete when hours spent matches allocated
      if (this.hoursSpent >= this.hoursAllocated && newStatus === 'IN PROGRESS') {
        this.status = 'COMPLETE';
      }
    }
  }

  /**
   * Add hours spent
   */
  addHoursSpent(hours) {
    if (hours > 0) {
      this.hoursSpent += hours;
      this.metadata.lastModified = new Date().toISOString();
    }
  }

  /**
   * Validate assignment
   */
  validate() {
    const errors = [];

    if (!this.projectId) {
      errors.push('Project ID is required');
    }

    if (!this.userId) {
      errors.push('User ID is required');
    }

    if (this.hoursAllocated < 0) {
      errors.push('Hours allocated cannot be negative');
    }

    if (this.hoursSpent < 0) {
      errors.push('Hours spent cannot be negative');
    }

    if (this.dueDate && new Date(this.dueDate) < new Date(this.startDate)) {
      errors.push('Due date cannot be before start date');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      projectId: this.projectId,
      projectName: this.projectName,
      rfaNumber: this.rfaNumber,
      userId: this.userId,
      hoursAllocated: this.hoursAllocated,
      hoursSpent: this.hoursSpent,
      startDate: this.startDate,
      dueDate: this.dueDate,
      status: this.status,
      priority: this.priority,
      assignedBy: this.assignedBy,
      notes: this.notes,
      taskType: this.taskType,
      metadata: this.metadata
    };
  }

  static fromJSON(data) {
    return new Assignment(data);
  }
}

class Workload {
  constructor(data = {}) {
    this.userId = data.userId || '';
    this.assignments = (data.assignments || []).map(a => 
      a instanceof Assignment ? a : new Assignment(a)
    );
    this.metadata = {
      lastModified: data.metadata?.lastModified || new Date().toISOString(),
      version: data.metadata?.version || 1
    };
  }

  /**
   * Add assignment
   */
  addAssignment(assignment) {
    if (!(assignment instanceof Assignment)) {
      assignment = new Assignment(assignment);
    }
    
    const validation = assignment.validate();
    if (!validation.isValid) {
      throw new Error(`Invalid assignment: ${validation.errors.join(', ')}`);
    }

    this.assignments.push(assignment);
    this.metadata.lastModified = new Date().toISOString();
    this.metadata.version++;
    
    return assignment;
  }

  /**
   * Remove assignment
   */
  removeAssignment(assignmentId) {
    const index = this.assignments.findIndex(a => a.id === assignmentId);
    if (index !== -1) {
      this.assignments.splice(index, 1);
      this.metadata.lastModified = new Date().toISOString();
      this.metadata.version++;
      return true;
    }
    return false;
  }

  /**
   * Get assignment by ID
   */
  getAssignment(assignmentId) {
    return this.assignments.find(a => a.id === assignmentId);
  }

  /**
   * Get assignments by status
   */
  getAssignmentsByStatus(status) {
    return this.assignments.filter(a => a.status === status);
  }

  /**
   * Get assignments by date range
   */
  getAssignmentsByDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return this.assignments.filter(a => {
      const assignmentStart = new Date(a.startDate);
      const assignmentEnd = a.dueDate ? new Date(a.dueDate) : new Date(a.startDate);
      
      return (assignmentStart <= end && assignmentEnd >= start);
    });
  }

  /**
   * Calculate total allocated hours
   */
  getTotalAllocatedHours(startDate = null, endDate = null) {
    let assignments = this.assignments;
    
    if (startDate && endDate) {
      assignments = this.getAssignmentsByDateRange(startDate, endDate);
    }
    
    return assignments.reduce((total, a) => total + a.hoursAllocated, 0);
  }

  /**
   * Calculate total spent hours
   */
  getTotalSpentHours(startDate = null, endDate = null) {
    let assignments = this.assignments;
    
    if (startDate && endDate) {
      assignments = this.getAssignmentsByDateRange(startDate, endDate);
    }
    
    return assignments.reduce((total, a) => total + a.hoursSpent, 0);
  }

  /**
   * Calculate remaining hours
   */
  getTotalRemainingHours(startDate = null, endDate = null) {
    let assignments = this.assignments;
    
    if (startDate && endDate) {
      assignments = this.getAssignmentsByDateRange(startDate, endDate);
    }
    
    return assignments.reduce((total, a) => total + a.getRemainingHours(), 0);
  }

  /**
   * Get capacity utilization percentage
   */
  getCapacityUtilization(weeklyCapacity, startDate = null, endDate = null) {
    const allocatedHours = this.getTotalAllocatedHours(startDate, endDate);
    
    // Calculate number of weeks in range
    let weeks = 1;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      weeks = Math.max(1, days / 7);
    }
    
    const totalCapacity = weeklyCapacity * weeks;
    return totalCapacity > 0 ? (allocatedHours / totalCapacity) * 100 : 0;
  }

  /**
   * Get overdue assignments
   */
  getOverdueAssignments() {
    return this.assignments.filter(a => a.isOverdue());
  }

  /**
   * Get assignments by priority
   */
  getAssignmentsByPriority(priority) {
    return this.assignments.filter(a => a.priority === priority);
  }

  /**
   * Sort assignments by due date
   */
  sortByDueDate(ascending = true) {
    this.assignments.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      
      const dateA = new Date(a.dueDate);
      const dateB = new Date(b.dueDate);
      
      return ascending ? dateA - dateB : dateB - dateA;
    });
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      userId: this.userId,
      assignments: this.assignments.map(a => a.toJSON()),
      metadata: this.metadata
    };
  }

  static fromJSON(data) {
    return new Workload(data);
  }
}

module.exports = {
  Workload,
  Assignment
};

