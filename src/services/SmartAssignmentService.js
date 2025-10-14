/**
 * SmartAssignmentService
 * Intelligent project assignment recommendations based on:
 * - User availability and capacity
 * - Position/seniority match to project complexity
 * - Product knowledge alignment
 * - Current workload balance
 */

const {
  PRODUCTS,
  POSITIONS,
  getPositionSeniority,
  canPositionHandleComplexity,
  calculateSeniorityGap,
  getComplexityValue
} = require('../constants/Products');

class SmartAssignmentService {
  constructor(workloadPersistenceService) {
    this.workloadPersistence = workloadPersistenceService;
    
    // Scoring weights (must sum to 1.0)
    this.weights = {
      availability: 0.40,  // 40% - Most important
      seniority: 0.30,     // 30% - Match position to complexity
      productKnowledge: 0.30 // 30% - Product expertise
    };
    
    // Minimum acceptable scores
    this.thresholds = {
      minScore: 50,          // Don't recommend if score < 50%
      minAvailability: 2,    // At least 2 hours available
      minProductKnowledge: 1 // At least basic knowledge (level 1)
    };
  }

  /**
   * Get smart assignment recommendations for a project
   * @param {Object} projectInfo - Project details
   * @param {number} topN - Number of recommendations to return
   * @returns {Array} Sorted array of user recommendations
   */
  async getRecommendations(projectInfo, topN = 3) {
    try {
      // Load all users and their current workloads
      const usersResult = await this.workloadPersistence.loadUsers();
      const assignmentsResult = await this.workloadPersistence.loadAssignments();
      
      if (!usersResult.success || !assignmentsResult.success) {
        throw new Error('Failed to load user or assignment data');
      }

      const users = usersResult.users || [];
      const assignments = assignmentsResult.assignments || [];
      
      // Filter to active users only
      const activeUsers = users.filter(u => u.isActive);
      
      // Score each user
      const scoredUsers = activeUsers.map(user => {
        const score = this.calculateUserScore(user, projectInfo, assignments);
        return {
          user,
          ...score
        };
      });
      
      // Filter out users below minimum threshold
      const qualified = scoredUsers.filter(s => s.totalScore >= this.thresholds.minScore);
      
      // Sort by total score (descending)
      qualified.sort((a, b) => b.totalScore - a.totalScore);
      
      // Return top N
      return qualified.slice(0, topN);
      
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [];
    }
  }

  /**
   * Calculate comprehensive score for a user
   * @param {Object} user - User object
   * @param {Object} projectInfo - Project details
   * @param {Array} assignments - All current assignments
   * @returns {Object} Score breakdown and total
   */
  calculateUserScore(user, projectInfo, assignments) {
    // Calculate individual scores
    const availabilityScore = this.calculateAvailabilityScore(user, projectInfo, assignments);
    const seniorityScore = this.calculateSeniorityScore(user, projectInfo);
    const productKnowledgeScore = this.calculateProductKnowledgeScore(user, projectInfo);
    
    // Calculate weighted total
    const totalScore = (
      (availabilityScore * this.weights.availability) +
      (seniorityScore * this.weights.seniority) +
      (productKnowledgeScore * this.weights.productKnowledge)
    );
    
    // Generate reasoning
    const reasoning = this.generateReasoning(user, projectInfo, {
      availabilityScore,
      seniorityScore,
      productKnowledgeScore,
      totalScore
    });
    
    // Calculate available hours
    const availableHours = this.calculateAvailableHours(user, projectInfo, assignments);
    
    // Get current workload
    const currentWorkload = this.calculateCurrentWorkload(user, assignments);
    
    // Check for conflicts
    const conflicts = this.detectConflicts(user, projectInfo, assignments);
    
    return {
      totalScore: Math.round(totalScore),
      breakdown: {
        availability: Math.round(availabilityScore),
        seniority: Math.round(seniorityScore),
        productKnowledge: Math.round(productKnowledgeScore)
      },
      reasoning,
      availableHours,
      currentWorkload,
      conflicts,
      matchLevel: this.getMatchLevel(totalScore)
    };
  }

  /**
   * Calculate availability score (0-100)
   */
  calculateAvailabilityScore(user, projectInfo, assignments) {
    const availableHours = this.calculateAvailableHours(user, projectInfo, assignments);
    const requiredHours = projectInfo.totalHours || 0;
    
    // No hours available = 0 score
    if (availableHours <= 0) return 0;
    
    // If user doesn't have enough capacity, penalize
    if (availableHours < requiredHours) {
      // Partial score based on what they can provide
      return (availableHours / requiredHours) * 70; // Max 70% if under capacity
    }
    
    // If user has exactly what's needed or slightly more, perfect score
    if (availableHours >= requiredHours && availableHours <= requiredHours * 1.5) {
      return 100;
    }
    
    // If user has way more capacity than needed, slightly lower score
    // (prefer to keep them available for larger projects)
    const excessRatio = availableHours / requiredHours;
    if (excessRatio > 3) {
      return 85; // Good but not perfect
    }
    
    return 95; // Good capacity match
  }

  /**
   * Calculate seniority match score (0-100)
   */
  calculateSeniorityScore(user, projectInfo) {
    // If no position set, return neutral score
    if (!user.position) return 50;
    
    const complexity = projectInfo.complexity || 'Level 1';
    
    // Check if position can handle this complexity
    if (!canPositionHandleComplexity(user.position, complexity)) {
      return 0; // Disqualified - can't handle this complexity
    }
    
    // Calculate gap between position level and complexity
    const gap = calculateSeniorityGap(user.position, complexity);
    
    // Perfect match (gap = 0 or 1)
    if (Math.abs(gap) <= 1) {
      return 100;
    }
    
    // Slightly over-qualified (gap = 2)
    if (gap === 2) {
      return 90;
    }
    
    // Significantly over-qualified (gap > 2)
    if (gap > 2) {
      return 75; // Can do it, but might be overkill
    }
    
    // Under-qualified but still allowed
    return 60;
  }

  /**
   * Calculate product knowledge score (0-100)
   */
  calculateProductKnowledgeScore(user, projectInfo) {
    // Parse products from project info
    const projectProducts = this.parseProjectProducts(projectInfo);
    
    // If no products specified, return neutral score
    if (projectProducts.length === 0) return 70;
    
    // Calculate average knowledge level for required products
    let totalKnowledge = 0;
    let productCount = 0;
    
    projectProducts.forEach(product => {
      const knowledgeLevel = user.productKnowledge?.[product] || 0;
      totalKnowledge += knowledgeLevel;
      productCount++;
    });
    
    if (productCount === 0) return 70;
    
    const averageKnowledge = totalKnowledge / productCount;
    
    // Convert to 0-100 scale (0-5 scale → 0-100)
    // 0 = 0%, 1 = 20%, 2 = 40%, 3 = 60%, 4 = 80%, 5 = 100%
    return (averageKnowledge / 5) * 100;
  }

  /**
   * Calculate available hours for user
   */
  calculateAvailableHours(user, projectInfo, assignments) {
    const weeklyCapacity = user.weeklyCapacity || 40;
    
    // Calculate currently allocated hours for overlapping period
    const allocatedHours = this.calculateAllocatedHours(user, projectInfo, assignments);
    
    // Available = Capacity - Allocated
    return Math.max(0, weeklyCapacity - allocatedHours);
  }

  /**
   * Calculate hours already allocated to user
   */
  calculateAllocatedHours(user, projectInfo, assignments) {
    // Get user's assignments that overlap with project dates
    const userAssignments = assignments.filter(a => 
      a.userId === user.id && 
      a.status !== 'COMPLETE' &&
      this.datesOverlap(a, projectInfo)
    );
    
    // Sum allocated hours (simplified - could be more sophisticated)
    return userAssignments.reduce((sum, a) => sum + (a.hoursAllocated || 0), 0);
  }

  /**
   * Calculate current total workload
   */
  calculateCurrentWorkload(user, assignments) {
    const userAssignments = assignments.filter(a => 
      a.userId === user.id && 
      a.status !== 'COMPLETE'
    );
    
    return userAssignments.reduce((sum, a) => sum + (a.hoursAllocated || 0), 0);
  }

  /**
   * Check for scheduling conflicts
   */
  detectConflicts(user, projectInfo, assignments) {
    const conflicts = [];
    
    // Check for over-capacity
    const availableHours = this.calculateAvailableHours(user, projectInfo, assignments);
    const requiredHours = projectInfo.totalHours || 0;
    
    if (availableHours < requiredHours) {
      conflicts.push({
        type: 'capacity',
        severity: 'high',
        message: `Insufficient capacity: needs ${requiredHours}h, has ${availableHours}h available`
      });
    }
    
    // Check for unavailability dates
    const projectStart = projectInfo.startDate ? new Date(projectInfo.startDate) : new Date();
    const projectEnd = projectInfo.dueDate ? new Date(projectInfo.dueDate) : new Date(projectStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // Check each day in project range
    const unavailableDays = [];
    for (let d = new Date(projectStart); d <= projectEnd; d.setDate(d.getDate() + 1)) {
      if (!user.isAvailableOn || !user.isAvailableOn(d)) {
        unavailableDays.push(new Date(d).toISOString().split('T')[0]);
      }
    }
    
    if (unavailableDays.length > 0) {
      conflicts.push({
        type: 'availability',
        severity: 'medium',
        message: `Unavailable on ${unavailableDays.length} day(s) during project`
      });
    }
    
    return conflicts;
  }

  /**
   * Check if assignment dates overlap with project dates
   */
  datesOverlap(assignment, projectInfo) {
    const assignStart = assignment.startDate ? new Date(assignment.startDate) : new Date();
    const assignEnd = assignment.dueDate ? new Date(assignment.dueDate) : new Date();
    
    const projectStart = projectInfo.startDate ? new Date(projectInfo.startDate) : new Date();
    const projectEnd = projectInfo.dueDate ? new Date(projectInfo.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    return assignStart <= projectEnd && assignEnd >= projectStart;
  }

  /**
   * Parse products from project info
   */
  parseProjectProducts(projectInfo) {
    const products = [];
    
    // Project might have products as string or array
    if (typeof projectInfo.products === 'string') {
      // Parse comma-separated or newline-separated list
      const parsed = projectInfo.products.split(/[,\n]+/).map(p => p.trim()).filter(p => p);
      products.push(...parsed);
    } else if (Array.isArray(projectInfo.products)) {
      products.push(...projectInfo.products);
    }
    
    // Filter to only known products
    return products.filter(p => PRODUCTS.includes(p));
  }

  /**
   * Generate human-readable reasoning
   */
  generateReasoning(user, projectInfo, scores) {
    const reasons = [];
    
    // Availability reasoning
    if (scores.availabilityScore >= 90) {
      reasons.push('✅ Excellent availability');
    } else if (scores.availabilityScore >= 70) {
      reasons.push('✔️ Good availability');
    } else if (scores.availabilityScore >= 50) {
      reasons.push('⚠️ Limited availability');
    } else {
      reasons.push('❌ Low availability');
    }
    
    // Seniority reasoning
    if (scores.seniorityScore >= 90) {
      reasons.push(`✅ ${user.position || 'Position'} matches project complexity`);
    } else if (scores.seniorityScore >= 70) {
      reasons.push(`✔️ Can handle this complexity`);
    } else if (scores.seniorityScore > 0) {
      reasons.push(`⚠️ May be challenging for current level`);
    }
    
    // Product knowledge reasoning
    const projectProducts = this.parseProjectProducts(projectInfo);
    if (projectProducts.length > 0 && scores.productKnowledgeScore >= 80) {
      const expertProducts = projectProducts.filter(p => 
        (user.productKnowledge?.[p] || 0) >= 4
      );
      if (expertProducts.length > 0) {
        reasons.push(`✅ Expert in ${expertProducts.join(', ')}`);
      } else {
        reasons.push(`✔️ Good product knowledge`);
      }
    } else if (projectProducts.length > 0 && scores.productKnowledgeScore < 40) {
      reasons.push(`⚠️ Limited knowledge of required products`);
    }
    
    // Overall assessment
    if (scores.totalScore >= 85) {
      return `🌟 Excellent match! ${reasons.join(' • ')}`;
    } else if (scores.totalScore >= 70) {
      return `👍 Good match. ${reasons.join(' • ')}`;
    } else if (scores.totalScore >= 50) {
      return `⚡ Possible match. ${reasons.join(' • ')}`;
    } else {
      return `⚠️ Not recommended. ${reasons.join(' • ')}`;
    }
  }

  /**
   * Get match level category
   */
  getMatchLevel(score) {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  }

  /**
   * Update scoring weights (for fine-tuning)
   */
  updateWeights(newWeights) {
    // Ensure weights sum to 1.0
    const total = newWeights.availability + newWeights.seniority + newWeights.productKnowledge;
    
    if (Math.abs(total - 1.0) < 0.01) {
      this.weights = { ...newWeights };
      return true;
    }
    
    return false;
  }
}

module.exports = SmartAssignmentService;

