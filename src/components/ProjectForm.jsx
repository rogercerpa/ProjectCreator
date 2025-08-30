import React, { useState, useEffect } from 'react';
import './ProjectForm.css';

function ProjectForm({ project, formData, onFormDataChange, onFormReset, onProjectCreated, onProjectUpdated }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [triageResults, setTriageResults] = useState(null);
  const [isPasting, setIsPasting] = useState(false);
  const [showPanelSchedules, setShowPanelSchedules] = useState(false);
  const [showSubmittalSection, setShowSubmittalSection] = useState(false);
  
  const [dropdownOptions, setDropdownOptions] = useState({
    rfaTypes: [
      'BOM',
      'LAYOUT', 
      'BUDGET',
      'SUBMITTAL',
      'RELEASE',
      'RelocBOM',
      'RelocSUB',
      'RelocControlsBOM',
      'RelocControlsSUB',
      'GRAPHICS',
      'AtriusBOM',
      'AtriusLayout',
      'AtriusSub',
      'ControlsAtriusSub',
      'ControlsAtriusLayout',
      'CONTROLSDCLAYOUT',
      'PHOTOMETRICS',
      'Consultation'
    ],
    regionalTeams: [
      'All',
      'Ontario',
      'IA',
      'Conyers', 
      'Chicago',
      'Desktop Emergency Use only'
    ],
    nationalAccounts: [
      'Default',
      'ARBYS',
      'BEALLS',
      'CHICK FIL A',
      'CHIPOTLE',
      'CRUMBL',
      'DAVE AND BUSTERS',
      'DAVITA',
      'DRIVE SHACK',
      'DRYBAR',
      'FLOOR AND DECOR',
      'FMC',
      'HOME DEPOT',
      'INPLANT OFFICE',
      'JD SPORTS',
      'LEVIS',
      'LUCKY BRANDS',
      'NORDSTROM RACK',
      'OFFICE DEPOT',
      'POTTERY BARN',
      'Raising Cane\'s',
      'REGUS',
      'TARGET',
      'TD AMERITRADE',
      'US BANK',
      'WEST ELM',
      'Sikorsky'
    ],
    saveLocations: [
      'Triage',
      'Desktop', 
      'Server'
    ]
  });

  // Load project data if editing
  useEffect(() => {
    if (project) {
      onFormDataChange({ ...formData, ...project });
    }
  }, [project]);

  // Show/hide submittal section based on RFA type
  useEffect(() => {
    const submittalTypes = ['SUBMITTAL', 'ControlsAtriusSub', 'AtriusSub'];
    setShowSubmittalSection(submittalTypes.includes(formData.rfaType));
  }, [formData.rfaType]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let processedValue = value;
    
    if (type === 'number') {
      processedValue = value === '' ? 0 : parseFloat(value) || 0;
    } else if (type === 'radio') {
      processedValue = value;
    } else if (type === 'checkbox') {
      processedValue = checked;
    }
    
    const newFormData = { ...formData, [name]: processedValue };
    onFormDataChange(newFormData);
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }

    // Auto-calculate triage when relevant fields change
    if (['largeLMPs', 'mediumLMPs', 'smallLMPs', 'arp8', 'arp16', 'arp32', 'arp48', 
         'esheetsSchedules', 'numOfRooms', 'overrideRooms', 'roomMultiplier', 
         'reviewSetup', 'numOfPages', 'specReview', 'numOfSubRooms', 'overrideSubRooms', 
         'riserMultiplier', 'soo'].includes(name)) {
      setTimeout(() => calculateTriage(), 100);
    }
  };

  // Enhanced RFA Info Pasting Functionality
  const handlePasteRFAInfo = async () => {
    setIsPasting(true);
    try {
      const clipboardText = await navigator.clipboard.readText();
      const parsedData = parseRFAInfo(clipboardText);
      
      if (parsedData) {
        onFormDataChange({ ...formData, ...parsedData });
        alert('RFA information pasted successfully!');
      } else {
        alert('Could not parse RFA information from clipboard. Please check the format.');
      }
    } catch (error) {
      console.error('Error pasting RFA info:', error);
      alert('Failed to read from clipboard. Please try copying the RFA information again.');
    } finally {
      setIsPasting(false);
    }
  };

  const parseRFAInfo = (clipboardText) => {
    // Enhanced parsing based on HTA logic
    let shortenedRFAInfo = clipboardText;
    
    // Replace RFA types from Agile with tool types
    const rfaTypeReplacements = {
      '- Controls Submittal - Submittal': 'SUBMITTAL',
      '- Lithonia Commercial Indoor / Controls Submittal - Submittal': 'SUBMITTAL',
      '- Controls / Lithonia Commercial Indoor / Mark Architectural Lighting Submittal - Submittal': 'SUBMITTAL',
      '- Controls Submittal - One-Line Diagram': 'SUBMITTAL',
      '- Controls Submittal - Record Submittal': 'SUBMITTAL',
      '- Controls Submittal - Preprogramming': 'RELEASE',
      '- DC2DC / Controls BOM - BOM (With Layout)': 'CONTROLSDCLAYOUT',
      '- Controls BOM - BOM (No Layout)': 'BOM',
      '- Controls BOM - Budget': 'BUDGET',
      '- Controls BOM - BOM (With Layout)': 'LAYOUT',
      '- Controls / Peerless BOM - BOM (With Layout)': 'LAYOUT',
      '- Controls Design - Layout': 'LAYOUT',
      '- Controls Design - Controls Layout': 'LAYOUT',
      '- Lithonia Reloc BOM - Budget': 'RelocBOM',
      '- Lithonia Reloc / Controls BOM - Budget': 'RelocControlsBOM',
      '- Lithonia Reloc BOM - BOM (With Layout)': 'RelocBOM',
      '- Lithonia Reloc Submittal - Submittal': 'RelocSUB',
      '- Lithonia Reloc / Controls Submittal - Submittal': 'RelocControlsSUB',
      '- Controls / Lithonia Reloc Submittal - Submittal': 'RelocControlsSUB',
      '- Controls Post-Installation - Graphical Interface': 'GRAPHICS',
      '- Atrius BOM - BOM (No Layout)': 'AtriusBOM',
      '- Atrius BOM - BOM (With Layout)': 'AtriusLayout',
      '- Atrius Submittal - Submittal': 'AtriusSub',
      '- Controls / Atrius Submittal - Submittal': 'ControlsAtriusSub',
      '- Atrius Locator / Atrius Wayfinder BOM - BOM (With Layout)': 'ControlsAtriusLayout',
      '- Atrius / Controls BOM - BOM (With Layout)': 'ControlsAtriusLayout',
      '- Controls / Atrius BOM - BOM (No Layout)': 'ControlsAtriusLayout',
      '- Controls / Mark Architectural Lighting Submittal - Submittal': 'SUBMITTAL',
      '- Design - Photometric Lighting Layout': 'PHOTOMETRICS',
      '- Controls Design - Design Consultation': 'Consultation'
    };

    Object.entries(rfaTypeReplacements).forEach(([old, newType]) => {
      shortenedRFAInfo = shortenedRFAInfo.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `,,${newType},,`);
    });

    // Remove common prefixes
    shortenedRFAInfo = shortenedRFAInfo
      .replace(/Request for Assistance /g, ',,')
      .replace(/ECD: /g, ',,')
      .replace(/Requested Date:/g, ',,')
      .replace(/Version:/g, ',,')
      .replace(/Submitted Date:/g, ',,')
      .replace(/Rep:  /g, ',,');

    const rfaInfo = shortenedRFAInfo.split(',,').filter(item => item.trim());
    
    if (rfaInfo.length < 9) return null;

    const parsedData = {
      rfaNumber: rfaInfo[1]?.replace(/\s/g, '') || '',
      rfaType: rfaInfo[2] || '',
      agentNumber: rfaInfo[4]?.replace(/\s/g, '') || '',
      projectContainer: rfaInfo[3]?.split(' ').slice(-2, -1)[0] || '',
      projectName: rfaInfo[3]?.split(' ').slice(0, -2).join(' ') || '',
      isRevision: rfaInfo[1]?.endsWith('0 ') ? false : true,
      requestedDate: rfaInfo[8]?.substring(1) || '',
      ecd: rfaInfo[5]?.substring(1) || ''
    };

    // Set room multiplier for budget projects
    if (parsedData.rfaType === 'BUDGET') {
      parsedData.roomMultiplier = 1;
    }

    // Auto-detect national account
    parsedData.nationalAccount = checkNationalAccount(parsedData.projectName);

    return parsedData;
  };

  const checkNationalAccount = (projectName) => {
    const name = projectName.toUpperCase();
    
    if (name.includes('ARBY\'S') || name.includes('ARBYS')) return 'ARBYS';
    if (name.includes('BEALLS')) return 'BEALLS';
    if (name.includes('CHICK-') || name.includes('CHICK ')) return 'CHICK FIL A';
    if (name.includes('CHIPOTLE')) return 'CHIPOTLE';
    if (name.includes('CRUMBL')) return 'CRUMBL';
    if (name.includes('DAVE & BUSTER')) return 'DAVE AND BUSTERS';
    if (name.includes('DAVITA')) return 'DAVITA';
    if (name.includes('DRIVE SHACK')) return 'DRIVE SHACK';
    if (name.includes('DRYBAR')) return 'DRYBAR';
    if (name.includes('FLOOR & DEC')) return 'FLOOR AND DECOR';
    if (name.includes('FMC ')) return 'FMC';
    if (name.includes('HOME DEPOT') || name.includes('THD CANADA')) return 'HOME DEPOT';
    if (name.includes('INPLANT OFFICE')) return 'INPLANT OFFICE';
    if (name.includes('JD SPORTS')) return 'JD SPORTS';
    if (name.includes('LEVI\'S') || name.includes('LEVIS')) return 'LEVIS';
    if (name.includes('NORDSTROM RACK')) return 'NORDSTROM RACK';
    if (name.includes('OFFICE DEPOT')) return 'OFFICE DEPOT';
    if (name.includes('POTTERY BARN')) return 'POTTERY BARN';
    if (name.includes('RAISING CANE\'S')) return 'Raising Cane\'s';
    if (name.includes('REGUS')) return 'REGUS';
    if (name.includes('TARGET')) return 'TARGET';
    if (name.includes('TD AMERITRADE')) return 'TD AMERITRADE';
    if (name.includes('US BANK')) return 'US BANK';
    if (name.includes('WEST ELM')) return 'WEST ELM';
    if (name.includes('SIKORSKY')) return 'Sikorsky';
    
    return 'Default';
  };

  const calculateTriage = () => {
    // Enhanced triage calculation based on HTA logic
    let specReview = formData.specReview || 0;
    let reviewSetup = formData.reviewSetup || 0;
    let numOfPages = formData.numOfPages || 1;
    let soo = formData.soo || 0;
    let roomMultiplier = formData.roomMultiplier || 2;
    let riserMultiplier = formData.riserMultiplier || 1;
    let numOfRooms = formData.numOfRooms || 0;
    let overrideRooms = formData.overrideRooms || 0;
    let numOfSubRooms = formData.numOfSubRooms || 0;
    let overrideSubRooms = formData.overrideSubRooms || 0;
    let esheetsSchedules = formData.esheetsSchedules || 2;

    // Layout triage calculation
    let layoutTriageTime = 0;
    if (numOfRooms > 0 || overrideRooms > 0) {
      if (overrideRooms > 0) {
        layoutTriageTime = overrideRooms + specReview + reviewSetup;
      } else {
        layoutTriageTime = (numOfRooms * roomMultiplier) / 60 + specReview + reviewSetup;
      }
    }

    // Submittal triage calculation
    let submittalTriageTime = 0;
    if (numOfSubRooms > 0 || overrideSubRooms > 0) {
      if (overrideSubRooms > 0) {
        submittalTriageTime = overrideSubRooms + soo;
      } else {
        submittalTriageTime = (numOfSubRooms * riserMultiplier) / 60 + soo;
      }
    }

    // Panel schedules calculation
    let panelTime = 0;
    if (showPanelSchedules) {
      let arpTime = 0;
      if (formData.arp8) arpTime += formData.arp8 * 5;
      if (formData.arp16) arpTime += formData.arp16 * 10;
      if (formData.arp32) arpTime += formData.arp32 * 20;
      if (formData.arp48) arpTime += formData.arp48 * 25;
      arpTime = arpTime / 60;

      let lmpsTime = 0;
      if (formData.largeLMPs) lmpsTime += formData.largeLMPs * 45;
      if (formData.mediumLMPs) lmpsTime += formData.mediumLMPs * 30;
      if (formData.smallLMPs) lmpsTime += formData.smallLMPs * 15;
      lmpsTime = lmpsTime / 60;

      panelTime = (arpTime + lmpsTime) * esheetsSchedules;
    }

    // Page bonus calculation
    let pageBonus = 0;
    if (numOfPages > 3) {
      pageBonus = (numOfPages * 3) / 60;
    }

    // Calculate base total
    const baseTotal = submittalTriageTime + layoutTriageTime + panelTime + pageBonus;

    // Auto-calculate Self-QC and Fluff
    let selfQC = 0;
    if (baseTotal >= 12) {
      selfQC = 1;
    } else if (baseTotal < 4) {
      selfQC = 0.25;
    } else {
      selfQC = 0.5;
    }

    const fluff = baseTotal / 10;
    const totalTriage = baseTotal + selfQC + fluff;

    // Round to nearest 0.25
    const roundedTriage = Math.round(totalTriage * 4) / 4;

    const newFormData = {
      ...formData,
      totalTriage: roundedTriage,
      panelTime,
      layoutTime: layoutTriageTime,
      submittalTime: submittalTriageTime,
      pageBonus,
      baseTotal,
      selfQC,
      fluff
    };

    onFormDataChange(newFormData);
    setTriageResults({
      totalTriage: roundedTriage,
      breakdown: {
        layout: layoutTriageTime,
        submittal: submittalTriageTime,
        panels: panelTime,
        pages: pageBonus,
        selfQC,
        fluff,
        baseTotal
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
      const requiredFields = ['projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 'rfaType', 'regionalTeam'];
      const newErrors = {};

      requiredFields.forEach(field => {
        if (!formData[field]) {
          newErrors[field] = `${field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} is required`;
        }
      });

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsSubmitting(false);
        return;
      }

      const projectData = {
        id: project?.id || Date.now().toString(),
        ...formData,
        createdAt: project?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('Saving project data:', projectData);

      if (project) {
        onProjectUpdated(projectData);
      } else {
        onProjectCreated(projectData);
      }

      // Reset form after successful submission
      onFormReset();
      setTriageResults(null);
      setErrors({});

    } catch (error) {
      console.error('Error saving project:', error);
      alert('Failed to save project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportDASBoard = async () => {
    try {
      // Determine RFA type tag
      let rfaTypeTag = 'S'; // Default to Submittal
      if (['BOM', 'LAYOUT'].includes(formData.rfaType)) {
        rfaTypeTag = 'Q';
      } else if (formData.rfaType === 'BUDGET') {
        rfaTypeTag = 'B';
      } else if (formData.rfaType === 'GRAPHICS') {
        rfaTypeTag = 'G';
      } else if (formData.rfaType.includes('Reloc')) {
        rfaTypeTag = 'R';
      } else if (formData.numOfRooms || formData.overrideRooms) {
        rfaTypeTag = 'Q+S';
      }

      // Determine complexity level
      let projectComplexity = 'E'; // Easy
      if (formData.totalTriage >= 8) {
        projectComplexity = 'C'; // Complex
      } else if (formData.totalTriage >= 4) {
        projectComplexity = 'M'; // Medium
      }

      // Create DAS Board project name
      const projectName = formData.projectName.substring(0, 19);
      const revisionTag = formData.isRevision ? 'R' : '';
      const dasProjectName = `${projectComplexity} - ${revisionTag}${rfaTypeTag} ${projectName}`;

      // Prepare data for clipboard
      const exportData = `${formData.rfaNumber} (${formData.agentNumber})\t${dasProjectName}\t${formData.dueDate || ''}\t${formData.totalTriage}`;
      
      await navigator.clipboard.writeText(exportData);
      alert('Project data copied to clipboard for DAS Board!');
    } catch (error) {
      console.error('Error exporting to DAS Board:', error);
      alert('Failed to export to DAS Board.');
    }
  };

  const handleExportAgile = async () => {
    try {
      const exportData = [];
      
      // Add RFA type
      if (formData.isRevision) {
        exportData.push(`Revision ${formData.rfaType}`);
      } else {
        exportData.push(formData.rfaType);
      }

      // Add layout information
      if (formData.numOfRooms || formData.overrideRooms) {
        if (formData.overrideRooms) {
          exportData.push(`-# of Rooms:\t${formData.numOfRooms || 0}`);
          exportData.push(`-Layout:\t${formData.overrideRooms}`);
        } else {
          const layoutTime = (formData.numOfRooms * formData.roomMultiplier) / 60;
          exportData.push(`-# of Rooms:\t${formData.numOfRooms}`);
          exportData.push(`-Layout:\t${layoutTime}`);
        }
        exportData.push(`-Review/Setup:\t${formData.reviewSetup}`);
        exportData.push(`-SpecReview:\t${formData.specReview}`);
      }

      // Add submittal information
      if (formData.numOfSubRooms || formData.overrideSubRooms) {
        if (formData.overrideSubRooms) {
          exportData.push(`-# of Rooms:\t${formData.numOfSubRooms || 0}`);
          exportData.push(`-Risers:\t${formData.overrideSubRooms}`);
        } else {
          const submittalTime = (formData.numOfSubRooms * formData.riserMultiplier) / 60;
          exportData.push(`-# of Rooms:\t${formData.numOfSubRooms}`);
          exportData.push(`-Risers:\t${submittalTime}`);
        }
        exportData.push(`-SOO:\t${formData.soo}`);
      }

      // Add panel schedules if enabled
      if (showPanelSchedules) {
        exportData.push(`-Panels:\t${formData.panelTime}`);
      }

      // Add final calculations
      exportData.push(`-Self-Qc:\t${formData.selfQC}`);
      exportData.push(`-Fluff:\t${formData.fluff}`);
      exportData.push(`--------`);
      exportData.push(`-TOTAL:\t${formData.totalTriage}`);

      const exportText = exportData.join('\n');
      await navigator.clipboard.writeText(exportText);
      alert('Triage data copied to clipboard for Agile!');
    } catch (error) {
      console.error('Error exporting to Agile:', error);
      alert('Failed to export to Agile.');
    }
  };

  const handleOpenDASBoard = () => {
    const regionalTeam = formData.regionalTeam;
    let urls = [];
    
    if (regionalTeam === 'All') {
      urls = [
        'https://docs.google.com/spreadsheets/d/1CH6K1F9x0DaykRw8iqXIxgno6AyuUiamsP6jfDajr-I/edit#gid=623352875',
        'https://docs.google.com/spreadsheets/d/1jN9flngikc2l5ElKuSDP00vDkMlgUELWaDw4Z1cVdls/edit#gid=623352875',
        'https://docs.google.com/spreadsheets/d/1J1kTrRkM9PCq--kGqidi4uTVyoXjR7hZLzyAsOkYEJY/edit#gid=623352875',
        'https://docs.google.com/spreadsheets/d/18TZqMxdecK1VlKkOpmZMErypDBlipT6VoKma4dSqyGQ/edit#gid=623352875'
      ];
    } else {
      const teamUrls = {
        'Ontario': 'https://docs.google.com/spreadsheets/d/1CH6K1F9x0DaykRw8iqXIxgno6AyuUiamsP6jfDajr-I/edit#gid=623352875',
        'Conyers': 'https://docs.google.com/spreadsheets/d/1J1kTrRkM9PCq--kGqidi4uTVyoXjR7hZLzyAsOkYEJY/edit#gid=623352875',
        'Chicago': 'https://docs.google.com/spreadsheets/d/1jN9flngikc2l5ElKuSDP00vDkMlgUELWaDw4Z1cVdls/edit#gid=623352875',
        'IA': 'https://docs.google.com/spreadsheets/d/18TZqMxdecK1VlKkOpmZMErypDBlipT6VoKma4dSqyGQ/edit#gid=623352875'
      };
      if (teamUrls[regionalTeam]) {
        urls = [teamUrls[regionalTeam]];
      }
    }

    urls.forEach(url => {
      window.open(url, '_blank');
    });
  };

  return (
    <div className="project-form-container">
      <div className="form-header">
        <h2>{project ? 'Edit Project' : 'Create New Project'}</h2>
        <div className="form-actions">
          <button
            type="button"
            onClick={handlePasteRFAInfo}
            disabled={isPasting}
            className="btn btn-secondary"
          >
            {isPasting ? 'Pasting...' : 'Import From Agile'}
          </button>
          <button
            type="button"
            onClick={onFormReset}
            className="btn btn-secondary"
          >
            Reset Form
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="project-form">
        {/* Basic Project Information */}
        <div className="form-section">
          <h3>Basic Project Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="projectName">Project Name *</label>
              <input
                type="text"
                id="projectName"
                name="projectName"
                value={formData.projectName}
                onChange={handleInputChange}
                className={errors.projectName ? 'error' : ''}
                placeholder="Enter project name"
              />
              {errors.projectName && <span className="error-message">{errors.projectName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="projectContainer">Project Container *</label>
              <input
                type="text"
                id="projectContainer"
                name="projectContainer"
                value={formData.projectContainer}
                onChange={handleInputChange}
                className={errors.projectContainer ? 'error' : ''}
                placeholder="e.g., 24-001"
              />
              {errors.projectContainer && <span className="error-message">{errors.projectContainer}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="rfaNumber">RFA Number *</label>
              <input
                type="text"
                id="rfaNumber"
                name="rfaNumber"
                value={formData.rfaNumber}
                onChange={handleInputChange}
                className={errors.rfaNumber ? 'error' : ''}
                placeholder="Enter RFA number"
              />
              {errors.rfaNumber && <span className="error-message">{errors.rfaNumber}</span>}
            </div>

            <div className="form-group">
              <label>Revision Type *</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name="isRevision"
                    value={false}
                    checked={!formData.isRevision}
                    onChange={handleInputChange}
                  />
                  New Project
                </label>
                <label>
                  <input
                    type="radio"
                    name="isRevision"
                    value={true}
                    checked={formData.isRevision}
                    onChange={handleInputChange}
                  />
                  Revision
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="rfaType">RFA Type *</label>
              <select
                id="rfaType"
                name="rfaType"
                value={formData.rfaType}
                onChange={handleInputChange}
                className={errors.rfaType ? 'error' : ''}
              >
                <option value="">Select RFA Type</option>
                {dropdownOptions.rfaTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.rfaType && <span className="error-message">{errors.rfaType}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="agentNumber">Agent Number *</label>
              <input
                type="text"
                id="agentNumber"
                name="agentNumber"
                value={formData.agentNumber}
                onChange={handleInputChange}
                className={errors.agentNumber ? 'error' : ''}
                placeholder="Enter agent number"
              />
              {errors.agentNumber && <span className="error-message">{errors.agentNumber}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="regionalTeam">Regional Team *</label>
              <select
                id="regionalTeam"
                name="regionalTeam"
                value={formData.regionalTeam}
                onChange={handleInputChange}
                className={errors.regionalTeam ? 'error' : ''}
              >
                <option value="">Select Regional Team</option>
                {dropdownOptions.regionalTeams.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
              {errors.regionalTeam && <span className="error-message">{errors.regionalTeam}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="nationalAccount">National Account</label>
              <select
                id="nationalAccount"
                name="nationalAccount"
                value={formData.nationalAccount}
                onChange={handleInputChange}
              >
                {dropdownOptions.nationalAccounts.map(account => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="saveLocation">Save Location</label>
              <select
                id="saveLocation"
                name="saveLocation"
                value={formData.saveLocation}
                onChange={handleInputChange}
              >
                {dropdownOptions.saveLocations.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="requestedDate">Requested Date</label>
              <input
                type="datetime-local"
                id="requestedDate"
                name="requestedDate"
                value={formData.requestedDate}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="ecd">ECD</label>
              <input
                type="datetime-local"
                id="ecd"
                name="ecd"
                value={formData.ecd}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Panel Schedules Section */}
        <div className="form-section">
          <h3>Panel Schedules</h3>
          <div className="form-group">
            <label>Include Panel Schedules:</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="showPanelSchedules"
                  value={false}
                  checked={!showPanelSchedules}
                  onChange={(e) => setShowPanelSchedules(e.target.value === 'true')}
                />
                No
              </label>
              <label>
                <input
                  type="radio"
                  name="showPanelSchedules"
                  value={true}
                  checked={showPanelSchedules}
                  onChange={(e) => setShowPanelSchedules(e.target.value === 'true')}
                />
                Yes
              </label>
            </div>
          </div>

          {showPanelSchedules && (
            <div className="panel-schedules-grid">
              <div className="form-group">
                <label htmlFor="largeLMPs">Large LMPs</label>
                <input
                  type="number"
                  id="largeLMPs"
                  name="largeLMPs"
                  value={formData.largeLMPs}
                  onChange={handleInputChange}
                  min="0"
                  step="1"
                />
              </div>

              <div className="form-group">
                <label htmlFor="mediumLMPs">Medium LMPs</label>
                <input
                  type="number"
                  id="mediumLMPs"
                  name="mediumLMPs"
                  value={formData.mediumLMPs}
                  onChange={handleInputChange}
                  min="0"
                  step="1"
                />
              </div>

              <div className="form-group">
                <label htmlFor="smallLMPs">Small LMPs</label>
                <input
                  type="number"
                  id="smallLMPs"
                  name="smallLMPs"
                  value={formData.smallLMPs}
                  onChange={handleInputChange}
                  min="0"
                  step="1"
                />
              </div>

              <div className="form-group">
                <label htmlFor="arp8">ARP 8</label>
                <input
                  type="number"
                  id="arp8"
                  name="arp8"
                  value={formData.arp8}
                  onChange={handleInputChange}
                  min="0"
                  step="1"
                />
              </div>

              <div className="form-group">
                <label htmlFor="arp16">ARP 16</label>
                <input
                  type="number"
                  id="arp16"
                  name="arp16"
                  value={formData.arp16}
                  onChange={handleInputChange}
                  min="0"
                  step="1"
                />
              </div>

              <div className="form-group">
                <label htmlFor="arp32">ARP 32</label>
                <input
                  type="number"
                  id="arp32"
                  name="arp32"
                  value={formData.arp32}
                  onChange={handleInputChange}
                  min="0"
                  step="1"
                />
              </div>

              <div className="form-group">
                <label htmlFor="arp48">ARP 48</label>
                <input
                  type="number"
                  id="arp48"
                  name="arp48"
                  value={formData.arp48}
                  onChange={handleInputChange}
                  min="0"
                  step="1"
                />
              </div>

              <div className="form-group">
                <label htmlFor="esheetsSchedules">E-Sheets Schedules</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="esheetsSchedules"
                      value={2}
                      checked={formData.esheetsSchedules === 2}
                      onChange={handleInputChange}
                    />
                    No
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="esheetsSchedules"
                      value={1}
                      checked={formData.esheetsSchedules === 1}
                      onChange={handleInputChange}
                    />
                    Yes
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Layout Section */}
        <div className="form-section">
          <h3>Layouts</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="numOfRooms"># of Rooms</label>
              <input
                type="number"
                id="numOfRooms"
                name="numOfRooms"
                value={formData.numOfRooms}
                onChange={handleInputChange}
                min="0"
                step="1"
                placeholder="Quantity of rooms"
              />
            </div>

            <div className="form-group">
              <label htmlFor="overrideRooms">Override (hr)</label>
              <input
                type="number"
                id="overrideRooms"
                name="overrideRooms"
                value={formData.overrideRooms}
                onChange={handleInputChange}
                min="0"
                step="0.25"
                placeholder="Override hours"
              />
            </div>

            <div className="form-group">
              <label htmlFor="roomMultiplier">Room Multiplier (min/room)</label>
              <input
                type="number"
                id="roomMultiplier"
                name="roomMultiplier"
                value={formData.roomMultiplier}
                onChange={handleInputChange}
                min="0"
                step="0.5"
              />
            </div>

            <div className="form-group">
              <label htmlFor="reviewSetup">Review/Setup Time (hr)</label>
              <input
                type="number"
                id="reviewSetup"
                name="reviewSetup"
                value={formData.reviewSetup}
                onChange={handleInputChange}
                min="0"
                step="0.25"
              />
            </div>

            <div className="form-group">
              <label htmlFor="numOfPages"># of Lighting Pages</label>
              <input
                type="number"
                id="numOfPages"
                name="numOfPages"
                value={formData.numOfPages}
                onChange={handleInputChange}
                min="1"
                step="1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="specReview">Spec Review (hr)</label>
              <input
                type="number"
                id="specReview"
                name="specReview"
                value={formData.specReview}
                onChange={handleInputChange}
                min="0"
                step="0.25"
              />
            </div>
          </div>
        </div>

        {/* Submittal Section */}
        {showSubmittalSection && (
          <div className="form-section">
            <h3>Submittals</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="numOfSubRooms"># of Rooms</label>
                <input
                  type="number"
                  id="numOfSubRooms"
                  name="numOfSubRooms"
                  value={formData.numOfSubRooms}
                  onChange={handleInputChange}
                  min="0"
                  step="1"
                  placeholder="Quantity of rooms"
                />
              </div>

              <div className="form-group">
                <label htmlFor="overrideSubRooms">Override (hr)</label>
                <input
                  type="number"
                  id="overrideSubRooms"
                  name="overrideSubRooms"
                  value={formData.overrideSubRooms}
                  onChange={handleInputChange}
                  min="0"
                  step="0.25"
                  placeholder="Override hours"
                />
              </div>

              <div className="form-group">
                <label htmlFor="riserMultiplier">Riser Multiplier (min/room)</label>
                <input
                  type="number"
                  id="riserMultiplier"
                  name="riserMultiplier"
                  value={formData.riserMultiplier}
                  onChange={handleInputChange}
                  min="0"
                  step="0.5"
                />
              </div>

              <div className="form-group">
                <label htmlFor="soo">SOO (hr)</label>
                <input
                  type="number"
                  id="soo"
                  name="soo"
                  value={formData.soo}
                  onChange={handleInputChange}
                  min="0"
                  step="0.25"
                />
              </div>
            </div>
          </div>
        )}

        {/* Triage Results */}
        {triageResults && (
          <div className="form-section triage-results">
            <h3>Triage Results</h3>
            <div className="triage-grid">
              <div className="triage-item">
                <label>Layout Time:</label>
                <span>{triageResults.breakdown.layout.toFixed(2)} hr</span>
              </div>
              <div className="triage-item">
                <label>Submittal Time:</label>
                <span>{triageResults.breakdown.submittal.toFixed(2)} hr</span>
              </div>
              <div className="triage-item">
                <label>Panel Time:</label>
                <span>{triageResults.breakdown.panels.toFixed(2)} hr</span>
              </div>
              <div className="triage-item">
                <label>Page Bonus:</label>
                <span>{triageResults.breakdown.pages.toFixed(2)} hr</span>
              </div>
              <div className="triage-item">
                <label>Base Total:</label>
                <span>{triageResults.breakdown.baseTotal.toFixed(2)} hr</span>
              </div>
              <div className="triage-item">
                <label>Self-QC:</label>
                <span>{triageResults.breakdown.selfQC.toFixed(2)} hr</span>
              </div>
              <div className="triage-item">
                <label>Fluff:</label>
                <span>{triageResults.breakdown.fluff.toFixed(2)} hr</span>
              </div>
              <div className="triage-item total">
                <label>Total Triage Time:</label>
                <span>{triageResults.totalTriage} hr</span>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
          >
            {isSubmitting ? 'Saving...' : (project ? 'Update Project' : 'Create Project')}
          </button>
          
          <button
            type="button"
            onClick={handleExportDASBoard}
            className="btn btn-secondary"
          >
            Copy to DAS Board
          </button>
          
          <button
            type="button"
            onClick={handleExportAgile}
            className="btn btn-secondary"
          >
            Copy to Agile
          </button>

          <button
            type="button"
            onClick={handleOpenDASBoard}
            className="btn btn-secondary"
          >
            Open DAS Board
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProjectForm;
