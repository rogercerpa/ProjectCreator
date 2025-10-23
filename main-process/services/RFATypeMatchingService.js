/**
 * RFATypeMatchingService - Smart RFA Type Matching
 * 
 * Handles intelligent matching between form RFA types and actual folder RFA types
 * Accounts for variations like "BOM (No Layout)" vs "BOM", "BOM (with Layout)" vs "LAYOUT"
 */

class RFATypeMatchingService {
  constructor() {
    this.matchingRules = this.initializeMatchingRules();
  }

  /**
   * Initialize smart matching rules for common RFA type variations
   * @returns {Array} Array of matching rule objects
   */
  initializeMatchingRules() {
    return [
      // Exact matches (highest priority)
      { formPattern: /^BOM$/i, folderPattern: /^BOM$/i, score: 100, type: 'exact' },
      { formPattern: /^LAYOUT$/i, folderPattern: /^LAYOUT$/i, score: 100, type: 'exact' },
      { formPattern: /^SUBMITTAL$/i, folderPattern: /^SUBMITTAL$/i, score: 100, type: 'exact' },
      { formPattern: /^BUDGET$/i, folderPattern: /^BUDGET$/i, score: 100, type: 'exact' },
      
      // Semantic matches (high priority)
      { formPattern: /BOM.*NO.*LAYOUT/i, folderPattern: /^BOM$/i, score: 90, type: 'semantic' },
      { formPattern: /BOM.*WITH.*LAYOUT/i, folderPattern: /^LAYOUT$/i, score: 90, type: 'semantic' },
      { formPattern: /DESIGN.*LAYOUT/i, folderPattern: /^LAYOUT$/i, score: 85, type: 'semantic' },
      { formPattern: /BUDGET.*ANALYSIS/i, folderPattern: /^BUDGET$/i, score: 85, type: 'semantic' },
      
      // Keyword matches (medium priority)
      { formPattern: /BOM/i, folderPattern: /^BOM$/i, score: 80, type: 'keyword' },
      { formPattern: /LAYOUT/i, folderPattern: /^LAYOUT$/i, score: 80, type: 'keyword' },
      { formPattern: /SUBMITTAL/i, folderPattern: /^SUBMITTAL$/i, score: 80, type: 'keyword' },
      { formPattern: /BUDGET/i, folderPattern: /^BUDGET$/i, score: 80, type: 'keyword' },
      
      // Partial matches (lower priority)
      { formPattern: /BOM/i, folderPattern: /LAYOUT/i, score: 60, type: 'partial' },
      { formPattern: /LAYOUT/i, folderPattern: /BOM/i, score: 60, type: 'partial' }
    ];
  }

  /**
   * Extract RFA type from folder name
   * @param {string} folderName - RFA folder name (e.g., "RFA#61726-1_BOM_02012025")
   * @returns {string|null} Extracted RFA type or null
   */
  extractRFATypeFromFolder(folderName) {
    try {
      // Pattern: RFA#[number]-[version]_[TYPE]_[DATE]
      const match = folderName.match(/RFA#\d+-\d+_([A-Z]+)_\d{8}/i);
      
      if (match) {
        const rfaType = match[1].toUpperCase();
        console.log(`📋 Extracted RFA type "${rfaType}" from folder: ${folderName}`);
        return rfaType;
      }
      
      console.warn(`⚠️ Could not extract RFA type from folder: ${folderName}`);
      return null;
    } catch (error) {
      console.error(`❌ Error extracting RFA type from ${folderName}:`, error);
      return null;
    }
  }

  /**
   * Calculate similarity score between form RFA type and folder RFA type
   * @param {string} formRFAType - RFA type from project form
   * @param {string} folderRFAType - RFA type from folder name
   * @returns {Object} Score object with value, type, and reasoning
   */
  calculateRFATypeScore(formRFAType, folderRFAType) {
    if (!formRFAType || !folderRFAType) {
      return { score: 0, type: 'invalid', reasoning: 'Missing RFA type data' };
    }

    // Find the best matching rule
    let bestMatch = { score: 0, type: 'none', reasoning: 'No matching rule found' };

    for (const rule of this.matchingRules) {
      const formMatches = rule.formPattern.test(formRFAType);
      const folderMatches = rule.folderPattern.test(folderRFAType);

      if (formMatches && folderMatches) {
        if (rule.score > bestMatch.score) {
          bestMatch = {
            score: rule.score,
            type: rule.type,
            reasoning: `${rule.type} match: "${formRFAType}" → "${folderRFAType}"`
          };
        }
      }
    }

    console.log(`🎯 RFA Type Score: ${formRFAType} vs ${folderRFAType} = ${bestMatch.score} (${bestMatch.type})`);
    return bestMatch;
  }

  /**
   * Find best RFA type matches from available folders
   * @param {string} formRFAType - RFA type from project form
   * @param {Array} rfaFolders - Array of RFA folder objects with name and stats
   * @returns {Array} Sorted array of folders with scores
   */
  findBestRFATypeMatches(formRFAType, rfaFolders) {
    console.log(`🔍 Smart RFA matching: Form type "${formRFAType}" against ${rfaFolders.length} folders`);

    const scoredFolders = rfaFolders.map(folder => {
      const folderRFAType = this.extractRFATypeFromFolder(folder.name);
      const scoreResult = this.calculateRFATypeScore(formRFAType, folderRFAType);

      return {
        ...folder,
        rfaType: folderRFAType,
        matchScore: scoreResult.score,
        matchType: scoreResult.type,
        matchReasoning: scoreResult.reasoning
      };
    });

    // Sort by score (highest first), then by date (newest first)
    const sortedFolders = scoredFolders.sort((a, b) => {
      if (a.matchScore !== b.matchScore) {
        return b.matchScore - a.matchScore; // Higher score first
      }
      
      // If scores are equal, sort by date in folder name
      const dateA = this.extractDateFromRFAName(a.name);
      const dateB = this.extractDateFromRFAName(b.name);
      
      if (dateA && dateB) {
        return dateB.getTime() - dateA.getTime(); // Newer date first
      }
      
      return 0;
    });

    console.log(`✅ RFA matching results:`, sortedFolders.map(f => 
      `${f.name} (score: ${f.matchScore}, type: ${f.matchType})`
    ));

    return sortedFolders;
  }

  /**
   * Extract date from RFA folder name
   * @param {string} rfaName - RFA folder name
   * @returns {Date|null} Parsed date or null if invalid
   */
  extractDateFromRFAName(rfaName) {
    try {
      // Look for date pattern MMDDYYYY at the end
      const dateMatch = rfaName.match(/_(\d{2})(\d{2})(\d{4})$/);
      
      if (dateMatch) {
        const [, month, day, year] = dateMatch;
        const date = new Date(year, month - 1, day); // month is 0-indexed
        
        // Validate the date is reasonable
        if (date.getFullYear() >= 2020 && date.getFullYear() <= 2030) {
          return date;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Determine the best RFA folder selection strategy
   * @param {string} formRFAType - RFA type from project form
   * @param {Array} rfaFolders - Array of RFA folder objects
   * @returns {Object} Selection result with folder, reasoning, and confidence
   */
  selectBestRFAFolder(formRFAType, rfaFolders) {
    if (!rfaFolders || rfaFolders.length === 0) {
      return {
        selectedFolder: null,
        strategy: 'none',
        confidence: 'none',
        reasoning: 'No RFA folders available',
        requiresManualSelection: true
      };
    }

    const scoredFolders = this.findBestRFATypeMatches(formRFAType, rfaFolders);
    const bestFolder = scoredFolders[0];
    const secondBestFolder = scoredFolders[1];

    // Scenario 1: Clear winner (high score, significant gap)
    if (bestFolder.matchScore >= 80 && 
        (!secondBestFolder || bestFolder.matchScore - secondBestFolder.matchScore >= 20)) {
      
      return {
        selectedFolder: bestFolder,
        strategy: 'auto_high_confidence',
        confidence: 'high',
        reasoning: `Auto-selected: ${bestFolder.matchReasoning}`,
        requiresManualSelection: false,
        allFolders: scoredFolders
      };
    }

    // Scenario 2: Multiple good matches (let user decide)
    if (bestFolder.matchScore >= 60 && secondBestFolder && 
        Math.abs(bestFolder.matchScore - secondBestFolder.matchScore) < 20) {
      
      return {
        selectedFolder: bestFolder,
        strategy: 'manual_required',
        confidence: 'low',
        reasoning: `Multiple good matches found. Please manually select.`,
        requiresManualSelection: true,
        allFolders: scoredFolders
      };
    }

    // Scenario 3: Weak matches only (use latest by date)
    if (bestFolder.matchScore < 60) {
      return {
        selectedFolder: bestFolder,
        strategy: 'fallback_latest',
        confidence: 'low',
        reasoning: `No strong RFA type match. Selected latest available folder.`,
        requiresManualSelection: false,
        allFolders: scoredFolders
      };
    }

    // Default: Auto-select best match
    return {
      selectedFolder: bestFolder,
      strategy: 'auto_medium_confidence',
      confidence: 'medium',
      reasoning: `Auto-selected: ${bestFolder.matchReasoning}`,
      requiresManualSelection: false,
      allFolders: scoredFolders
    };
  }

  /**
   * Format date for user display
   * @param {Date} date - Date object
   * @returns {string} Formatted date string (MM/DD/YYYY)
   */
  formatDate(date) {
    if (!date || !(date instanceof Date)) {
      return 'Unknown Date';
    }
    
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${month}/${day}/${year}`;
  }

  /**
   * Generate user-friendly explanation for folder selection
   * @param {Object} selectionResult - Result from selectBestRFAFolder
   * @returns {string} User-friendly explanation
   */
  generateSelectionExplanation(selectionResult) {
    const { selectedFolder, strategy, confidence, reasoning } = selectionResult;
    
    if (!selectedFolder) {
      return 'No RFA folders found to copy from.';
    }

    const folderDate = this.extractDateFromRFAName(selectedFolder.name);
    const formattedDate = this.formatDate(folderDate);
    
    switch (strategy) {
      case 'auto_high_confidence':
        return `Selected ${selectedFolder.name} (${formattedDate}). ${reasoning}`;
      
      case 'manual_required':
        return `Multiple RFA folders with similar relevance found. Please select manually.`;
      
      case 'fallback_latest':
        return `Selected ${selectedFolder.name} (${formattedDate}). ${reasoning}`;
      
      default:
        return `Selected ${selectedFolder.name} (${formattedDate}). ${reasoning}`;
    }
  }
}

module.exports = RFATypeMatchingService;
