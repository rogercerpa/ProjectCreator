// TriageCalculationService - Replicates the exact triage calculation logic from the HTA file
class TriageCalculationService {
  constructor() {
    // Default constants from HTA file (can be overridden by settings)
    this.defaultSettings = {
      lmpMultipliers: {
        small: 15,    // 15 minutes per small LMP
        medium: 30,   // 30 minutes per medium LMP
        large: 45     // 45 minutes per large LMP
      },
      arpMultipliers: {
        arp8: 5,      // 5 minutes per ARP8
        arp16: 10,    // 10 minutes per ARP16
        arp32: 20,    // 20 minutes per ARP32
        arp48: 25     // 25 minutes per ARP48
      },
      roomMultiplier: 2,      // 2 minutes per room for layout
      riserMultiplier: 1,     // 1 minute per room for submittal
      esheetsMultiplier: 2,   // Default e-sheets multiplier
      defaultReviewSetup: 0.5, // Default review setup time
      defaultSOO: 0.5,        // Default SOO time
      defaultNumOfPages: 1,   // Default number of pages
      pageBonusThreshold: 3,  // Pages threshold for bonus
      pageBonusMultiplier: 3, // Minutes per page over threshold
      selfQCHigh: 12,         // High threshold for self-QC
      selfQCLow: 4,           // Low threshold for self-QC
      selfQCDefault: 0.5,     // Default self-QC time
      fluffPercentage: 10     // Fluff percentage (10%)
    };
    
    // Current settings (will be updated from Settings page)
    this.currentSettings = { ...this.defaultSettings };
  }

  // Update settings from the Settings page
  updateSettings(newSettings) {
    if (newSettings && newSettings.calculationSettings) {
      this.currentSettings = { ...this.defaultSettings, ...newSettings.calculationSettings };
    }
  }

  // Get current settings
  getSettings() {
    return { ...this.currentSettings };
  }

  // Main triage calculation function - replicates TriageCalc() from HTA with unified logic
  calculateTriage(formData) {
    // Initialize default values if empty (matching HTA logic)
    const data = this.initializeDefaults(formData);
    
    // Determine which sections should be included based on the unified logic
    const showPanelFields = data.hasPanelSchedules;
    const showLayoutFields = !data.hasSubmittals || (data.hasSubmittals && data.needsLayoutBOM);
    const showSubmittalFields = data.hasSubmittals;
    
    // Calculate layout triage time (only if layout fields should be shown)
    const layoutTime = showLayoutFields ? this.calculateLayoutTime(data) : 0;
    
    // Calculate submittal triage time (only if submittal fields should be shown)
    const submittalTime = showSubmittalFields ? this.calculateSubmittalTime(data) : 0;
    
    // Calculate panel time (only if panel fields should be shown)
    const panelTime = showPanelFields ? this.calculatePanelTime(data) : 0;
    
    // Calculate page bonus (always calculated if layout fields are shown)
    const pageBonus = showLayoutFields ? this.calculatePageBonus(data.numOfPages) : 0;
    
    // Calculate base total
    const baseTotal = layoutTime + submittalTime + panelTime + pageBonus;
    
    // Calculate self-QC based on total time (matching HTA logic)
    const selfQC = this.calculateSelfQC(baseTotal);
    
    // Calculate fluff based on settings percentage
    const fluff = baseTotal * (this.currentSettings.fluffPercentage / 100);
    
    // Final triage time
    const finalTriageTime = baseTotal + selfQC + fluff;
    
    // Round to nearest 0.25 hours (matching HTA RoundMe function)
    const roundedTriageTime = this.roundToQuarterHours(finalTriageTime);
    
    return {
      layoutTime: this.roundToQuarterHours(layoutTime),
      submittalTime: this.roundToQuarterHours(submittalTime),
      panelTime: this.roundToQuarterHours(panelTime),
      pageBonus: this.roundToQuarterHours(pageBonus),
      baseTotal: this.roundToQuarterHours(baseTotal),
      selfQC: this.roundToQuarterHours(selfQC),
      fluff: this.roundToQuarterHours(fluff),
      totalTriage: roundedTriageTime,
      // Include visibility flags for UI
      showPanelFields: showPanelFields,
      showLayoutFields: showLayoutFields,
      showSubmittalFields: showSubmittalFields,
      breakdown: {
        layout: {
          rooms: data.numOfRooms,
          roomMultiplier: data.roomMultiplier,
          reviewSetup: data.reviewSetup,
          specReview: data.specReview,
          overrideRooms: data.overrideRooms,
          visible: showLayoutFields
        },
        submittal: {
          rooms: data.numOfSubRooms,
          riserMultiplier: data.riserMultiplier,
          soo: data.soo,
          overrideSubRooms: data.overrideSubRooms,
          visible: showSubmittalFields
        },
        panel: {
          largeLMPs: data.largeLMPs,
          mediumLMPs: data.mediumLMPs,
          smallLMPs: data.smallLMPs,
          arp8: data.arp8,
          arp16: data.arp16,
          arp32: data.arp32,
          arp48: data.arp48,
          esheetsSchedules: data.esheetsSchedules,
          showPanelSchedules: data.showPanelSchedules,
          visible: showPanelFields
        },
        pages: data.numOfPages
      }
    };
  }

  // Initialize default values (matching HTA logic)
  initializeDefaults(formData) {
    return {
      // Unified Triage Control Fields
      hasPanelSchedules: formData.hasPanelSchedules || false,
      hasSubmittals: formData.hasSubmittals || false,
      needsLayoutBOM: formData.needsLayoutBOM || false,
      // Layout Fields
      specReview: formData.specReview || 0,
      reviewSetup: formData.reviewSetup || this.currentSettings.defaultReviewSetup,
      numOfPages: formData.numOfPages || this.currentSettings.defaultNumOfPages,
      roomMultiplier: formData.roomMultiplier || this.currentSettings.roomMultiplier,
      numOfRooms: formData.numOfRooms || 0,
      overrideRooms: formData.overrideRooms || 0,
      // Submittal Fields
      soo: formData.soo || this.currentSettings.defaultSOO,
      riserMultiplier: formData.riserMultiplier || this.currentSettings.riserMultiplier,
      numOfSubRooms: formData.numOfSubRooms || 0,
      overrideSubRooms: formData.overrideSubRooms || 0,
      // Panel Fields
      largeLMPs: formData.largeLMPs || 0,
      mediumLMPs: formData.mediumLMPs || 0,
      smallLMPs: formData.smallLMPs || 0,
      arp8: formData.arp8 || 0,
      arp16: formData.arp16 || 0,
      arp32: formData.arp32 || 0,
      arp48: formData.arp48 || 0,
      esheetsSchedules: formData.esheetsSchedules || 2,
      showPanelSchedules: formData.showPanelSchedules || false // Keep for backward compatibility
    };
  }

  // Calculate layout triage time (matching HTA logic)
  calculateLayoutTime(data) {
    if (data.numOfRooms === 0 && data.overrideRooms === 0) {
      return data.specReview + data.reviewSetup;
    }
    
    let layoutTriageTime;
    if (data.overrideRooms === 0) {
      // Use room calculation: rooms * multiplier / 60 + specReview + reviewSetup
      layoutTriageTime = (data.numOfRooms * data.roomMultiplier) / 60;
      layoutTriageTime = layoutTriageTime + data.specReview + data.reviewSetup;
    } else {
      // Use override: overrideRooms * 1 + specReview + reviewSetup
      layoutTriageTime = data.overrideRooms * 1;
      layoutTriageTime = layoutTriageTime + data.specReview + data.reviewSetup;
    }
    
    return layoutTriageTime;
  }

  // Calculate submittal triage time (matching HTA logic)
  calculateSubmittalTime(data) {
    if (data.numOfSubRooms === 0 && data.overrideSubRooms === 0) {
      return 0;
    }
    
    let submittalTriageTime;
    if (data.overrideSubRooms === 0) {
      // Use room calculation: rooms * riserMultiplier / 60 + SOO
      submittalTriageTime = (data.numOfSubRooms * data.riserMultiplier) / 60;
      submittalTriageTime = submittalTriageTime + data.soo;
    } else {
      // Use override: overrideSubRooms * 1 + SOO
      submittalTriageTime = data.overrideSubRooms * 1;
      submittalTriageTime = submittalTriageTime + data.soo;
    }
    
    return submittalTriageTime;
  }

  // Calculate panel time (matching HTA logic)
  calculatePanelTime(data) {
    if (!data.hasPanelSchedules && !data.showPanelSchedules) {
      return 0;
    }
    
    // Calculate ARP time using current settings
    const arp8Time = (data.arp8 * this.currentSettings.arpMultipliers.arp8) / 60;
    const arp16Time = (data.arp16 * this.currentSettings.arpMultipliers.arp16) / 60;
    const arp32Time = (data.arp32 * this.currentSettings.arpMultipliers.arp32) / 60;
    const arp48Time = (data.arp48 * this.currentSettings.arpMultipliers.arp48) / 60;
    const arpTime = arp8Time + arp16Time + arp32Time + arp48Time;
    
    // Calculate LMP time using current settings
    const lmpSmallTime = (data.smallLMPs * this.currentSettings.lmpMultipliers.small) / 60;
    const lmpMediumTime = (data.mediumLMPs * this.currentSettings.lmpMultipliers.medium) / 60;
    const lmpLargeTime = (data.largeLMPs * this.currentSettings.lmpMultipliers.large) / 60;
    const lmpTime = lmpSmallTime + lmpMediumTime + lmpLargeTime;
    
    // Calculate total panel time
    const panelTime = arpTime + lmpTime;
    
    // Apply e-sheets multiplier from settings
    const panelMultiplier = data.esheetsSchedules === 1 ? 1 : this.currentSettings.esheetsMultiplier;
    return panelTime * panelMultiplier;
  }

  // Calculate page bonus (matching HTA logic)
  calculatePageBonus(numOfPages) {
    if (numOfPages > this.currentSettings.pageBonusThreshold) {
      return (numOfPages * this.currentSettings.pageBonusMultiplier) / 60;
    }
    return 0;
  }

  // Calculate self-QC based on total time (matching HTA logic)
  calculateSelfQC(baseTotal) {
    if (baseTotal >= this.currentSettings.selfQCHigh) {
      return 1; // 1 hour for complex projects
    } else if (baseTotal < this.currentSettings.selfQCLow) {
      return 0.25; // 15 minutes for simple projects
    } else {
      return this.currentSettings.selfQCDefault; // Default time for medium projects
    }
  }

  // Round to nearest 0.25 hours (matching HTA RoundMe function)
  roundToQuarterHours(num) {
    // Subtract 0.1 to handle rounding edge cases
    const adjustedNum = num - 0.1;
    const roundTo = 1 / 0.25; // 4
    const rounded = Math.round(adjustedNum * roundTo) / roundTo;
    return rounded + 0.25; // Add 0.25 to match HTA behavior
  }

  // Calculate panel triage separately (matching HTA PanelTriage function)
  calculatePanelTriage(formData) {
    const data = this.initializeDefaults(formData);
    return this.calculatePanelTime(data);
  }

  // Determine if project should be marked as "first available"
  shouldMarkAsFirstAvailable(totalTriage, submittalTime) {
    // Based on HTA logic (currently commented out but preserved)
    // if (totalTriage < 4 && submittalTime === 0) {
    //   return true;
    // }
    // return false;
    
    // For now, return false to match current HTA behavior
    return false;
  }

  // Get complexity level based on triage time (matching HTA DASBoardExport logic)
  getComplexityLevel(totalTriage) {
    if (totalTriage < 4) {
      return 'E'; // Easy
    } else if (totalTriage < 8) {
      return 'M'; // Medium
    } else {
      return 'C'; // Complex
    }
  }
}

// Create singleton instance
const triageCalculationService = new TriageCalculationService();

export default triageCalculationService;
