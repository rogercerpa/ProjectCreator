import React, { useState, useEffect } from 'react';
import AgencyEditModal from './AgencyEditModal';
import './Settings.css';
import dropdownOptionsService from '../services/DropdownOptionsService';
import triageCalculationService from '../services/TriageCalculationService';
import { getFullVersionInfo, getVersionDisplay, BUILD_INFO } from '../utils/version';

// Access secure electron API through contextBridge
const { electronAPI } = window;

function Settings({ initialTab = 'app-info', onLaunchOnboarding }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [settings, setSettings] = useState({
    rfaTypes: ['BOM (No Layout)', 'BOM with Layout', 'Controls BOM - Budget', 'Controls BOM - Layout', 'BUDGET', 'LAYOUT', 'SUBMITTAL', 'RELEASE', 'GRAPHICS', 'PHOTOMETRICS', 'Consultation'],
    regionalTeams: ['Region 1', 'Region 2', 'Region 3', 'Region 4', 'Region 5', 'NAVS'],
    nationalAccounts: ['Default', 'ARBYS', 'MCDONALDS', 'WALMART', 'TARGET', 'HOMEDEPOT', 'LOWES', 'KROGER', 'CVS', 'WALGREENS'],
    saveLocations: ['Triage', 'Desktop', 'Server'],
    complexityLevels: ['Level 1', 'Level 2', 'Level 3', 'Level 4'],
    statusOptions: ['In Progress', 'Completed', 'Inactive', 'Not Started'],
    productOptions: ['nLight Wired', 'nLight Air', 'SensorSwitch', 'Pathway', 'Fresco', 'Controls - nLight'],
    assignedToOptions: ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown', 'Cerpa, Roger'],
    projectTypes: ['Middle School', 'High School', 'University', 'Hospital', 'Office Building', 'Restaurant', 'Government Building', 'Public Building', 'Stadium', 'Park', 'Hotel', 'Other'],
    calculationSettings: {
      lmpMultipliers: { small: 15, medium: 30, large: 45 },
      arpMultipliers: { arp8: 5, arp16: 10, arp32: 20, arp48: 25 },
      roomMultiplier: 2,
      riserMultiplier: 1,
      esheetsMultiplier: 2,
      defaultReviewSetup: 0.5,
      defaultSOO: 0.5,
      defaultNumOfPages: 1,
      pageBonusThreshold: 3,
      pageBonusMultiplier: 3,
      selfQCHigh: 12,
      selfQCLow: 4,
      selfQCDefault: 0.5,
      fluffPercentage: 10
    },
    pathSettings: {
      templates: {
        primaryPath: '\\\\10.3.10.30\\DAS\\DAS References\\!!!Templates For Project Creator',
        fallbackPath: '{userHome}\\Desktop\\1) Triage\\!!!Templates For Project Creator',
        agentRequirementsPath: '\\\\10.3.10.30\\DAS\\Agent Requirements'
      },
      projectOutput: {
        defaultLocation: 'desktop', // 'desktop', 'triage', 'custom'
        customPath: '{userHome}\\Desktop',
        triagePath: '{userHome}\\Desktop\\1) Triage'
      }
    },
    sharePointSettings: {
      enabled: false,
      sharePointUrl: 'https://acuitybrandsinc.sharepoint.com/sites/CIDesignSolutions/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FCIDesignSolutions%2FShared%20Documents%2FLnT&viewid=63bcad0e%2D9263%2D49b7%2Dac03%2D91437bdc82ef',
      uploadOptions: {
        overwriteExisting: true,
        zipNaming: '{projectName}_{rfaNumber}_{date}.zip'
      }
    },
    oneDriveSyncSettings: {
      enabled: false,
      syncFolderPath: '', // Auto-detected or manual path
      cleanupStrategy: 'manual', // 'auto-delete', 'keep-recent', 'manual' - DEFAULT TO MANUAL FOR SAFETY
      keepRecentCount: 10
    },
    workloadSettings: {
      enableRealTimeSync: true,
      dataDirectory: '',
      websocketServer: 'ws://localhost:8080',
      userName: '',
      userEmail: '',
      weeklyCapacity: 40,
      showNotifications: true,
      onlyMyAssignments: false
    }
  });

  const [editingField, setEditingField] = useState(null);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [newValue, setNewValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // New state for improved Form Settings UX
  const [selectedCategory, setSelectedCategory] = useState('rfaTypes');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('compact'); // 'compact' or 'detailed'
  
  // Category configuration for improved Form Settings
  const formCategories = [
    { key: 'rfaTypes', label: 'RFA Types', icon: '📝', description: 'Request for Assistance types' },
    { key: 'regionalTeams', label: 'Regional Teams', icon: '🌎', description: 'Available regional team options' },
    { key: 'nationalAccounts', label: 'National Accounts', icon: '🏢', description: 'National account customer options' },
    { key: 'saveLocations', label: 'Save Locations', icon: '💾', description: 'Available save location options' },
    { key: 'complexityLevels', label: 'Complexity Levels', icon: '⚡', description: 'Project complexity classifications' },
    { key: 'statusOptions', label: 'Status Options', icon: '📊', description: 'Project status options' },
    { key: 'productOptions', label: 'Product Options', icon: '💡', description: 'Available product categories' },
    { key: 'assignedToOptions', label: 'Assigned To', icon: '👥', description: 'Team member assignment options' },
    { key: 'projectTypes', label: 'Project Types', icon: '🏗️', description: 'Building and project type categories' }
  ];

  // Agency management state
  const [agencies, setAgencies] = useState([]);
  const [filteredAgencies, setFilteredAgencies] = useState([]);
  const [agencyStats, setAgencyStats] = useState(null);
  const [showAgencyForm, setShowAgencyForm] = useState(false);
  const [editingAgency, setEditingAgency] = useState(null);
  const [agencyFormData, setAgencyFormData] = useState({
    agencyNumber: '',
    agencyName: '',
    contactName: '',
    contactEmail: '',
    phoneNumber: '',
    role: '',
    region: '',
    mainContact: '',
    sae: 'No'
  });
  const [importStatus, setImportStatus] = useState(null);
  
  // Pagination and search state for agencies
  const [agencySearchTerm, setAgencySearchTerm] = useState('');
  const [agencyFilters, setAgencyFilters] = useState({
    region: 'all',
    role: 'all'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [agencyFilterOptions, setAgencyFilterOptions] = useState({
    regions: [],
    roles: []
  });

  // Agency sync state
  const [syncSettings, setSyncSettings] = useState({
    enabled: false,
    mode: 'manual',
    filePath: '',
    lastSync: null,
    autoSyncInterval: 30
  });
  const [syncStatus, setSyncStatus] = useState(null);
  const [filePathValid, setFilePathValid] = useState(null);
  const [showSyncStatus, setShowSyncStatus] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);

  // Modal state for editing agencies
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAgencyModal, setEditingAgencyModal] = useState(null);

  useEffect(() => {
    loadSettings();
    loadAgencies();
    loadAgencyStats();
    loadAgencyFilterOptions();
    loadSyncSettings();
    // Scroll to top when settings page loads - ensure DOM is ready
    const scrollToTop = () => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        console.log('Scrolling main-content to top, current scroll:', mainContent.scrollTop);
        mainContent.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        console.log('Main content not found, using window scroll');
        // Fallback to window scroll
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    };
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      scrollToTop();
      // Try again after CSS animation completes (300ms + buffer)
      setTimeout(scrollToTop, 400);
      // Final attempt after component is fully rendered
      setTimeout(scrollToTop, 600);
    });
  }, []);

  // Reset editing state when tab changes and scroll to top
  useEffect(() => {
    setEditingField(null);
    setEditingIndex(-1);
    setNewValue('');
    // Scroll to top when tab changes - ensure DOM is ready
    const scrollToTop = () => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        // Fallback to window scroll
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    };
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      scrollToTop();
      // Try again after CSS animation completes (300ms + buffer)
      setTimeout(scrollToTop, 400);
      // Final attempt after component is fully rendered
      setTimeout(scrollToTop, 600);
    });
  }, [activeTab]);



  // Effect to handle component focus and reset state when returning to page
  useEffect(() => {
    const handleFocus = () => {
      // Reset any stale editing state when returning to the page
      // Only reset if we're editing an existing item (index >= 0), not when adding new (index = -1)
      if (editingField && editingIndex >= 0) {
        setEditingField(null);
        setEditingIndex(-1);
        setNewValue('');
      }
      
      // Only scroll to top on window focus events, not on internal state changes
      // This prevents scrolling when user is actively adding/editing items
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reset state when tab becomes visible again
        handleFocus();
        // Scroll to top only when returning to the page from outside
        const scrollToTop = () => {
          const mainContent = document.querySelector('.main-content');
          if (mainContent) {
            mainContent.scrollTo({ top: 0, behavior: 'auto' });
          } else {
            window.scrollTo({ top: 0, behavior: 'auto' });
          }
        };
        requestAnimationFrame(scrollToTop);
      }
    };

    const handleWindowFocus = () => {
      handleFocus();
      // Scroll to top only when window gains focus from outside
      const scrollToTop = () => {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
          mainContent.scrollTo({ top: 0, behavior: 'auto' });
        } else {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      };
      requestAnimationFrame(scrollToTop);
    };

    const handleWindowBlur = () => {
      // Reset editing state when window loses focus
      setEditingField(null);
      setEditingIndex(-1);
      setNewValue('');
    };

    // Listen for various focus and visibility events
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Remove editingField, editingIndex from dependencies to prevent unwanted scrolling

  // Fix input field interactivity issue - ensure fields are properly initialized and interactive
  useEffect(() => {
    // Force input fields to be interactive after component mounts
    const timer = setTimeout(() => {
      // Find any input fields and ensure they're interactive
      const inputs = document.querySelectorAll('input[type="text"], input[type="number"]');
      inputs.forEach(input => {
        // Force the input to be interactive by triggering focus/blur
        input.focus();
        input.blur();
      });
    }, 100);

    return () => clearTimeout(timer);
  }, []); // Empty dependency array - only run once on mount

  // Apply filters whenever search term or filters change
  useEffect(() => {
    filterAgencies();
  }, [agencySearchTerm, agencyFilters, agencies]); // Re-filter when search/filters/agencies change

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      if (electronAPI && electronAPI.settingsLoad) {
        const savedSettings = await electronAPI.settingsLoad();
        if (savedSettings && savedSettings.success) {
          // Ensure workloadSettings exists in saved data
          const mergedData = {
            ...savedSettings.data,
            workloadSettings: {
              enableRealTimeSync: true,
              dataDirectory: '',
              websocketServer: 'ws://localhost:8080',
              userName: '',
              userEmail: '',
              position: '',
              yearsExperience: 0,
              weeklyCapacity: 40,
              showNotifications: true,
              onlyMyAssignments: false,
              productKnowledge: {},
              ...savedSettings.data?.workloadSettings
            }
          };
          setSettings(prev => ({ ...prev, ...mergedData }));
        }
      } else {
        console.log('electronAPI not available, using default settings');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Agency management functions
  const loadAgencies = async () => {
    try {
      const result = await window.electronAPI.agenciesLoadAll();
      if (result && result.success) {
        setAgencies(result.agencies || []);
        setFilteredAgencies(result.agencies || []); // Initialize filtered agencies
      }
    } catch (error) {
      console.error('Error loading agencies:', error);
      setAgencies([]);
      setFilteredAgencies([]);
    }
  };

  // Load filter options for agencies
  const loadAgencyFilterOptions = async () => {
    try {
      const result = await window.electronAPI.agenciesGetFilterOptions();
      if (result && result.success) {
        setAgencyFilterOptions(result.options || {
          regions: [],
          roles: []
        });
      }
    } catch (error) {
      console.error('Error loading agency filter options:', error);
    }
  };

  // Filter and search agencies
  const filterAgencies = () => {
    let filtered = [...agencies];

    // Apply search term
    if (agencySearchTerm.trim()) {
      const searchLower = agencySearchTerm.toLowerCase();
      filtered = filtered.filter(agency => 
        agency.agencyName?.toLowerCase().includes(searchLower) ||
        agency.contactName?.toLowerCase().includes(searchLower) ||
        agency.contactEmail?.toLowerCase().includes(searchLower) ||
        agency.region?.toLowerCase().includes(searchLower) ||
        agency.role?.toLowerCase().includes(searchLower)
      );
    }

    // Apply region filter
    if (agencyFilters.region && agencyFilters.region !== 'all') {
      filtered = filtered.filter(agency => agency.region === agencyFilters.region);
    }

    // Apply role filter
    if (agencyFilters.role && agencyFilters.role !== 'all') {
      filtered = filtered.filter(agency => agency.role === agencyFilters.role);
    }

    setFilteredAgencies(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Get paginated agencies for current page
  const getPaginatedAgencies = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAgencies.slice(startIndex, endIndex);
  };

  // Get pagination info
  const getPaginationInfo = () => {
    const totalItems = filteredAgencies.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);
    
    return {
      totalItems,
      totalPages,
      startItem,
      endItem,
      currentPage,
      pageSize
    };
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    const paginationInfo = getPaginationInfo();
    if (newPage >= 1 && newPage <= paginationInfo.totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page
  };

  // Handle filter change
  const handleAgencyFilterChange = (filterType, value) => {
    setAgencyFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const loadAgencyStats = async () => {
    try {
      const result = await window.electronAPI.agenciesGetStatistics();
      if (result && result.success) {
        setAgencyStats(result.statistics);
      }
    } catch (error) {
      console.error('Error loading agency statistics:', error);
    }
  };

  const handleAgencyFormSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let result;
      if (editingAgency) {
        // Update existing agency
        result = await window.electronAPI.agenciesUpdate(editingAgency.id, agencyFormData);
      } else {
        // Add new agency
        result = await window.electronAPI.agenciesAdd(agencyFormData);
      }

      if (result && result.success) {
        // Reload agencies and stats
        await loadAgencies();
        await loadAgencyStats();
        
        // Reset form
        setAgencyFormData({
          agencyNumber: '',
          agencyName: '',
          contactName: '',
          contactEmail: '',
          phoneNumber: '',
          role: '',
          region: '',
          mainContact: '',
          sae: 'No'
        });
        setShowAgencyForm(false);
        setEditingAgency(null);
        
        alert(editingAgency ? 'Agency updated successfully!' : 'Agency added successfully!');
      } else {
        alert('Failed to save agency: ' + (result?.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving agency:', error);
      alert('Error saving agency: ' + error.message);
    }
  };

  const handleEditAgency = (agency) => {
    setEditingAgencyModal(agency);
    setIsEditModalOpen(true);
  };

  const handleModalSave = async (updatedAgency) => {
    try {
      const result = await window.electronAPI.agenciesUpdate(updatedAgency);
      if (result.success) {
        await loadAgencies();
        await loadAgencyStats();
        setIsEditModalOpen(false);
        setEditingAgencyModal(null);
      } else {
        throw new Error(result.error || 'Failed to update agency');
      }
    } catch (error) {
      console.error('Error updating agency:', error);
      throw error; // Re-throw to let modal handle the error display
    }
  };

  const handleModalClose = () => {
    setIsEditModalOpen(false);
    setEditingAgencyModal(null);
  };

  const handleDeleteAgency = async (agency) => {
    if (window.confirm(`Are you sure you want to delete "${agency.agencyName}"? This action cannot be undone.`)) {
      try {
        const result = await window.electronAPI.agenciesDelete(agency.id);
        if (result && result.success) {
          await loadAgencies();
          await loadAgencyStats();
          alert('Agency deleted successfully!');
        } else {
          alert('Failed to delete agency: ' + (result?.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error deleting agency:', error);
        alert('Error deleting agency: ' + error.message);
      }
    }
  };

  const handleExcelImport = async () => {
    try {
      const result = await window.electronAPI.selectExcelFile();
      if (result && result.success && result.filePath) {
        setImportStatus({ type: 'loading', message: 'Importing Excel file...' });
        
        const importResult = await window.electronAPI.agenciesImportExcel(result.filePath);
        
        if (importResult && importResult.success) {
          setImportStatus({ 
            type: 'success', 
            message: `Successfully imported ${importResult.imported} agencies` 
          });
          
          // Reload data
          await loadAgencies();
          await loadAgencyStats();
          
          // Clear status after delay
          setTimeout(() => {
            setImportStatus(null);
          }, 3000);
        } else {
          console.error('Import failed:', importResult);
          
          let errorMessage = importResult?.error || 'Failed to import Excel file';
          
          // Show debug info if available
          if (importResult?.debugInfo) {
            console.log('Debug info:', importResult.debugInfo);
            
            if (importResult.debugInfo.columnHeaders) {
              errorMessage += `\n\nFound columns: ${importResult.debugInfo.columnHeaders.join(', ')}`;
            }
            
            if (importResult.debugInfo.totalRows !== undefined) {
              errorMessage += `\nTotal rows: ${importResult.debugInfo.totalRows}`;
            }
          }
          
          setImportStatus({ 
            type: 'error', 
            message: errorMessage
          });
        }
      }
    } catch (error) {
      console.error('Error importing Excel:', error);
      setImportStatus({ 
        type: 'error', 
        message: 'Error importing Excel file: ' + error.message 
      });
    }
  };

  // Agency sync functions
  const loadSyncSettings = async () => {
    try {
      const result = await window.electronAPI.syncGetSettings();
      if (result && result.success) {
        setSyncSettings(result.settings);
      }
    } catch (error) {
      console.error('Error loading sync settings:', error);
    }
  };

  const handleSyncSettingsUpdate = async (newSettings) => {
    try {
      const result = await window.electronAPI.syncUpdateSettings(newSettings);
      if (result && result.success) {
        setSyncSettings(result.settings);
        setSyncStatus({ type: 'success', message: 'Sync settings updated successfully!' });
        
        // Clear status after delay
        setTimeout(() => setSyncStatus(null), 3000);
      } else {
        setSyncStatus({ type: 'error', message: 'Failed to update sync settings: ' + (result?.error || 'Unknown error') });
      }
    } catch (error) {
      console.error('Error updating sync settings:', error);
      setSyncStatus({ type: 'error', message: 'Error updating sync settings: ' + error.message });
    }
  };

  const handleFilePathTest = async (filePath) => {
    try {
      const result = await window.electronAPI.syncTestFilePath(filePath);
      setFilePathValid(result.success);
      
      if (result.success) {
        setSyncStatus({ 
          type: 'success', 
          message: `File path is valid! Size: ${(result.fileInfo.size / 1024).toFixed(1)}KB, Last modified: ${new Date(result.fileInfo.lastModified).toLocaleString()}` 
        });
      } else {
        setSyncStatus({ type: 'error', message: 'File path error: ' + result.error });
      }
    } catch (error) {
      console.error('Error testing file path:', error);
      setFilePathValid(false);
      setSyncStatus({ type: 'error', message: 'Error testing file path: ' + error.message });
    }
  };

  const handleManualSync = async () => {
    try {
      setSyncStatus({ type: 'loading', message: 'Starting manual sync...' });
      
      const result = await window.electronAPI.syncManual(syncSettings.filePath);
      
      if (result && result.success) {
        setSyncStatus({ 
          type: 'success', 
          message: `Manual sync completed! Imported ${result.totalImported} agencies.` 
        });
        
        // Reload data
        await loadAgencies();
        await loadAgencyStats();
        await loadSyncSettings();
      } else {
        setSyncStatus({ type: 'error', message: 'Manual sync failed: ' + (result?.error || 'Unknown error') });
      }
    } catch (error) {
      console.error('Error in manual sync:', error);
      setSyncStatus({ type: 'error', message: 'Error in manual sync: ' + error.message });
    }
  };

  const handleBrowseFilePath = async () => {
    try {
      const result = await window.electronAPI.selectExcelFile();
      if (result && result.success && result.filePath) {
        const updatedSettings = { ...syncSettings, filePath: result.filePath };
        setSyncSettings(updatedSettings);
        await handleFilePathTest(result.filePath);
      }
    } catch (error) {
      console.error('Error selecting file:', error);
      setSyncStatus({ type: 'error', message: 'Error selecting file: ' + error.message });
    }
  };

  const handleExportToExcel = async () => {
    try {
      setExportStatus({ type: 'loading', message: 'Exporting agencies to Excel file...' });
      
      const result = await window.electronAPI.syncExportToExcel(syncSettings.filePath);
      
      if (result && result.success) {
        let message = `Successfully exported ${result.exportedCount} agencies to Excel file!`;
        if (result.backupCreated && result.backupPath) {
          message += ` (Latest backup: ${result.backupPath})`;
        }
        
        setExportStatus({ 
          type: 'success', 
          message: message
        });
        
        // Reload sync settings to get updated lastExport time
        await loadSyncSettings();
        
        // Clear status after delay
        setTimeout(() => setExportStatus(null), 5000);
      } else {
        setExportStatus({ type: 'error', message: 'Export failed: ' + (result?.error || 'Unknown error') });
      }
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setExportStatus({ type: 'error', message: 'Error exporting to Excel: ' + error.message });
    }
  };

  const handleExcelDiagnose = async () => {
    try {
      const result = await window.electronAPI.selectExcelFile();
      if (result && result.success && result.filePath) {
        setImportStatus({ type: 'loading', message: 'Analyzing Excel file structure...' });
        
        const diagnosisResult = await window.electronAPI.excelDiagnose(result.filePath);
        
        if (diagnosisResult && diagnosisResult.success) {
          const diag = diagnosisResult.diagnosis;
          const recs = diagnosisResult.recommendations;
          
          let message = `📊 EXCEL FILE ANALYSIS\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          message += `📁 File: ${diag.fileName}\n`;
          message += `📚 Total Sheets: ${diag.totalSheets}\n`;
          message += `📋 All Sheets: ${diag.allSheets.join(', ')}\n\n`;
          
          // Show sheet analysis
          message += `🔍 SHEET ANALYSIS:\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          diag.sheetAnalysis.forEach(sheet => {
            const scoreIcon = sheet.agencyScore > 50 ? '🎯' : sheet.agencyScore > 0 ? '📋' : '❌';
            message += `${scoreIcon} ${sheet.sheetName}: ${sheet.totalRows}x${sheet.totalCols} (Score: ${sheet.agencyScore})\n`;
            if (sheet.hasAgencyLikeData) {
              message += `   ✅ Contains agency-like data\n`;
            }
            if (sheet.possibleHeaderRow > 0) {
              message += `   📍 Possible headers at row ${sheet.possibleHeaderRow}\n`;
            }
          });
          
          if (diag.recommendedSheet) {
            message += `\n🎯 RECOMMENDED SHEET: ${diag.recommendedSheet}\n`;
            if (diag.recommendedHeaderRow > 0) {
              message += `📍 Recommended header row: ${diag.recommendedHeaderRow}\n`;
            }
          } else {
            message += `\n⚠️ NO SUITABLE SHEET FOUND FOR AGENCY DATA\n`;
          }
          
          // Show detailed analysis if we have a recommended sheet
          if (diag.detailedAnalysis) {
            message += `\n🔍 DETAILED ANALYSIS (${diag.detailedAnalysis.sheetName}):\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            
            diag.detailedAnalysis.rowAnalysis.slice(0, 10).forEach(row => {
              const preview = row.values.join(' | ');
              const indicator = row.possibleHeader ? ' ⭐ HEADER?' : '';
              message += `Row ${row.rowNumber}: [${row.contentCount} cells] ${preview}${indicator}\n`;
            });
            
            if (diag.detailedAnalysis.parsingAttempts) {
              message += `\n🧩 PARSING ATTEMPTS:\n`;
              message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
              diag.detailedAnalysis.parsingAttempts.forEach(attempt => {
                if (attempt.success) {
                  message += `✅ ${attempt.method}: ${attempt.rowCount} rows, ${attempt.columns.length} cols\n`;
                  if (attempt.columns.length > 0) {
                    message += `   Headers: ${attempt.columns.slice(0, 5).join(', ')}${attempt.columns.length > 5 ? '...' : ''}\n`;
                  }
                } else {
                  message += `❌ ${attempt.method}: ${attempt.error}\n`;
                }
              });
            }
          }
          
          message += `\n💡 RECOMMENDATIONS:\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          recs.forEach(rec => {
            const icon = rec.type === 'warning' ? '⚠️' : rec.type === 'header' ? '🎯' : '📋';
            message += `${icon} ${rec.message}\n`;
          });
          
          // Check for potential data in the detailed analysis
          if (diag.detailedAnalysis && diag.detailedAnalysis.rowAnalysis) {
            const dataRows = diag.detailedAnalysis.rowAnalysis.filter(row => 
              row.contentCount >= 3 && !row.possibleHeader
            );
            
            if (dataRows.length > 0) {
              message += `\n📊 POTENTIAL DATA ROWS FOUND: ${dataRows.length}\n`;
              message += `Sample data from row ${dataRows[0].rowNumber}:\n`;
              dataRows[0].values.slice(0, 5).forEach((value, index) => {
                message += `  Column ${index + 1}: ${value}\n`;
              });
            }
          }
          
          setImportStatus({ 
            type: 'success', 
            message: message
          });
        } else {
          setImportStatus({ 
            type: 'error', 
            message: 'Failed to analyze Excel file: ' + (diagnosisResult?.error || 'Unknown error')
          });
        }
      }
    } catch (error) {
      console.error('Error diagnosing Excel:', error);
      setImportStatus({ 
        type: 'error', 
        message: 'Error analyzing Excel file: ' + error.message 
      });
    }
  };

  const saveSettings = async () => {
    try {
      setIsLoading(true);
      if (electronAPI && electronAPI.settingsSave) {
        const result = await electronAPI.settingsSave(settings);
        if (result && result.success) {
          // Update the dropdown options service with new settings
          dropdownOptionsService.updateOptions(settings);
          // Update the triage calculation service with new settings
          triageCalculationService.updateSettings(settings);
          alert('Settings saved successfully!');
        } else {
          alert('Failed to save settings. Please try again.');
        }
      } else {
        // In development mode, just update the services
        dropdownOptionsService.updateOptions(settings);
        triageCalculationService.updateSettings(settings);
        alert('Settings updated (development mode - not persisted)');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (field, index = -1) => {
    // Set the editing state immediately
    setEditingField(field);
    setEditingIndex(index);
    setNewValue(index >= 0 ? settings[field][index] : '');
    
    // Focus on the input field after DOM update
    setTimeout(() => {
      const selector = `input[data-key="${index >= 0 ? `edit-${field}-${index}` : `add-new-${field}`}"]`;
      const inputElement = document.querySelector(selector);
      
      if (inputElement) {
        inputElement.focus();
        inputElement.select();
      }
    }, 100);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditingIndex(-1);
    setNewValue('');
  };

  const forceRefreshInput = () => {
    // Force a complete re-render by temporarily setting state to null
    setEditingField(null);
    setEditingIndex(-1);
    setNewValue('');
  };

  const saveEdit = () => {
    if (!newValue.trim()) {
      alert('Value cannot be empty');
      return;
    }

    setSettings(prev => {
      const newSettings = { ...prev };
      if (editingIndex >= 0) {
        // Editing existing value
        newSettings[editingField] = [...prev[editingField]];
        newSettings[editingField][editingIndex] = newValue.trim();
      } else {
        // Adding new value
        newSettings[editingField] = [...prev[editingField], newValue.trim()];
      }
      
      // Update the dropdown options service immediately
      dropdownOptionsService.updateOptions(newSettings);
      
      return newSettings;
    });

    cancelEditing();
  };

  const deleteItem = (field, index) => {
    if (confirm('Are you sure you want to delete this item?')) {
      setSettings(prev => {
        const newSettings = {
          ...prev,
          [field]: prev[field].filter((_, i) => i !== index)
        };
        
        // Update the dropdown options service immediately
        dropdownOptionsService.updateOptions(newSettings);
        
        return newSettings;
      });
    }
  };

  const moveItem = (field, fromIndex, direction) => {
    const newIndex = fromIndex + direction;
    if (newIndex < 0 || newIndex >= settings[field].length) return;

    setSettings(prev => {
      const newArray = [...prev[field]];
      const temp = newArray[fromIndex];
      newArray[fromIndex] = newArray[newIndex];
      newArray[newIndex] = temp;
      const newSettings = { ...prev, [field]: newArray };
      
      // Update the dropdown options service immediately
      dropdownOptionsService.updateOptions(newSettings);
      
      return newSettings;
    });
  };

  // Helper function to filter items based on search
  const getFilteredItems = (items) => {
    if (!searchTerm.trim()) return items;
    return items.filter(item => 
      item.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Get current category data
  const getCurrentCategory = () => {
    return formCategories.find(cat => cat.key === selectedCategory);
  };

  // Compact grid-based field editor for improved UX
  const renderCompactFieldEditor = (field, items) => {
    const filteredItems = getFilteredItems(items);
    
    return (
      <div className="compact-field-editor">
        <div className="field-items-grid">
          {/* Add new item card */}
          <div className="field-item-card add-new-card">
            {editingField === field && editingIndex === -1 ? (
              <div className="add-new-input">
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                  onBlur={() => {}}
                  placeholder="Enter new value..."
                  autoFocus
                  className="compact-input"
                />
                <div className="inline-actions">
                  <button className="btn-icon success" onClick={saveEdit} title="Save">✓</button>
                  <button className="btn-icon cancel" onClick={cancelEditing} title="Cancel">✗</button>
                </div>
              </div>
            ) : (
              <button 
                className="add-new-button"
                onClick={() => startEditing(field)}
                title="Add new item"
              >
                <span className="add-icon">+</span>
                <span className="add-text">Add New</span>
              </button>
            )}
          </div>

          {/* Existing items */}
          {filteredItems.map((item, index) => {
            const originalIndex = items.indexOf(item);
            return (
              <div key={originalIndex} className="field-item-card">
                {editingField === field && editingIndex === originalIndex ? (
                  <div className="edit-input">
                    <input
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                      onBlur={() => {}}
                      autoFocus
                      className="compact-input"
                    />
                    <div className="inline-actions">
                      <button className="btn-icon success" onClick={saveEdit} title="Save">✓</button>
                      <button className="btn-icon cancel" onClick={cancelEditing} title="Cancel">✗</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="item-text" title={item}>{item}</div>
                    <div className="item-actions">
                      <button 
                        className="btn-icon edit" 
                        onClick={() => startEditing(field, originalIndex)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button 
                        className="btn-icon delete" 
                        onClick={() => deleteItem(field, originalIndex)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                      <div className="move-actions">
                        <button 
                          className="btn-icon move" 
                          onClick={() => moveItem(field, originalIndex, -1)}
                          disabled={originalIndex === 0}
                          title="Move Up"
                        >
                          ↑
                        </button>
                        <button 
                          className="btn-icon move" 
                          onClick={() => moveItem(field, originalIndex, 1)}
                          disabled={originalIndex === items.length - 1}
                          title="Move Down"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        
        {filteredItems.length === 0 && searchTerm && (
          <div className="no-results">
            <p>No items found matching "{searchTerm}"</p>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setSearchTerm('')}
            >
              Clear Search
            </button>
          </div>
        )}
      </div>
    );
  };

  // Pagination component for agencies
  const renderPagination = (paginationInfo) => {
    const { totalItems, totalPages, startItem, endItem, currentPage } = paginationInfo;
    
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
      const pages = [];
      const maxVisible = 5;
      
      let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
      let endPage = Math.min(totalPages, startPage + maxVisible - 1);
      
      if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      return pages;
    };

    return (
      <div className="pagination-container">
        <div className="pagination-info">
          <span>Showing {startItem}-{endItem} of {totalItems} agencies</span>
          <select 
            value={pageSize} 
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="page-size-select"
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>
        
        <div className="pagination-controls">
          <button 
            className="pagination-btn"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            title="First page"
          >
            ⟪
          </button>
          <button 
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            title="Previous page"
          >
            ‹
          </button>
          
          {getPageNumbers().map(pageNum => (
            <button
              key={pageNum}
              className={`pagination-btn ${pageNum === currentPage ? 'active' : ''}`}
              onClick={() => handlePageChange(pageNum)}
            >
              {pageNum}
            </button>
          ))}
          
          <button 
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="Next page"
          >
            ›
          </button>
          <button 
            className="pagination-btn"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            title="Last page"
          >
            ⟫
          </button>
        </div>
      </div>
    );
  };

  // Original detailed field editor (kept for comparison/fallback)
  const renderFieldEditor = (field, label, items) => (
    <div className="settings-field">
      <div className="field-header">
        <h3>{label}</h3>
                 <button
           type="button"
           className="btn btn-primary btn-sm"
           onClick={() => startEditing(field)}
         >
           + Add New
         </button>
      </div>
      
      <div className="field-items">
        {/* Show add new item input when editing this field with index -1 */}
        {editingField === field && editingIndex === -1 && (
          <div className="field-item new-item">
            <div className="item-content">
              <div className="edit-mode">
                                 <input
                   key={`add-new-${field}`}
                   data-key={`add-new-${field}`}
                   type="text"
                   value={newValue}
                                       onChange={(e) => setNewValue(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                       onFocus={(e) => e.target.select()}
                    onBlur={() => {}}
                   placeholder="Enter new value..."
                   autoFocus
                   style={{ minWidth: '200px' }}
                   data-testid="add-new-input"
                   tabIndex={0}
                 />
                <div className="edit-actions">
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={saveEdit}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={cancelEditing}
                  >
                    ✗
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {items.map((item, index) => (
          <div key={index} className="field-item">
            <div className="item-controls">
              <button
                type="button"
                className="btn btn-icon btn-sm"
                onClick={() => moveItem(field, index, -1)}
                disabled={index === 0}
                title="Move Up"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-icon btn-sm"
                onClick={() => moveItem(field, index, 1)}
                disabled={index === items.length - 1}
                title="Move Down"
              >
                ↓
              </button>
            </div>
            
            <div className="item-content">
              {editingField === field && editingIndex === index ? (
                <div className="edit-mode">
                                     <input
                     key={`edit-${field}-${index}`}
                     data-key={`edit-${field}-${index}`}
                     type="text"
                     value={newValue}
                     onChange={(e) => setNewValue(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                           onFocus={(e) => e.target.select()}
                      onBlur={() => {}}
                     autoFocus
                     style={{ minWidth: '200px' }}
                     tabIndex={0}
                   />
                  <div className="edit-actions">
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={saveEdit}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={cancelEditing}
                    >
                      ✗
                    </button>
                  </div>
                </div>
              ) : (
                <span className="item-text">{item}</span>
              )}
            </div>
            
            <div className="item-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => startEditing(field, index)}
                title="Edit"
              >
                ✏️
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => deleteItem(field, index)}
                title="Delete"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="settings-loading">
        <div className="spinner"></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  const tabs = [
    {
      id: 'app-info',
      label: 'App Info',
      icon: 'ℹ️',
      fullLabel: 'Application Information'
    },
    {
      id: 'advanced-settings',
      label: 'Advanced Settings',
      icon: '⚙️',
      fullLabel: 'System Configuration'
    },
    {
      id: 'project-form',
      label: 'Form Settings',
      icon: '📝',
      fullLabel: 'Project Form Settings'
    },
    {
      id: 'agencies',
      label: 'Agencies',
      icon: '🏢',
      fullLabel: 'Agency Management'
    },
    {
      id: 'workload',
      label: 'Workload',
      icon: '📊',
      fullLabel: 'Workload Dashboard Settings'
    },
    {
      id: 'triage-calc',
      label: 'Triage Calc',
      icon: '🧮',
      fullLabel: 'Triage Calculation Settings'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'app-info':
        return (
          <div className="tab-content">
            <div className="app-info-section">
              <h2>Application Information</h2>
              <div className="app-info-grid">
                <div className="app-info-item">
                  <span className="app-info-label">Version:</span>
                  <span className="app-info-value">{getVersionDisplay()}</span>
                </div>
                <div className="app-info-item">
                  <span className="app-info-label">Full Version:</span>
                  <span className="app-info-value">{getFullVersionInfo()}</span>
                </div>
                <div className="app-info-item">
                  <span className="app-info-label">Build Date:</span>
                  <span className="app-info-value">{new Date(BUILD_INFO.buildDate).toLocaleDateString()}</span>
                </div>
                <div className="app-info-item">
                  <span className="app-info-label">Environment:</span>
                  <span className="app-info-value">{BUILD_INFO.environment}</span>
                </div>
              </div>
            </div>

            {/* Onboarding Tutorial Section */}
            <div className="onboarding-section">
              <h2>🎓 Onboarding Tutorial</h2>
              <p className="section-description">
                Learn how to use Project Creator with our interactive tutorial. Perfect for new users or as a refresher.
              </p>
              
              <div className="onboarding-content">
                <div className="onboarding-info">
                  <div className="info-item">
                    <span className="info-icon">📚</span>
                    <div className="info-text">
                      <strong>6 Quick Steps</strong>
                      <p>Learn the main features in just a few minutes</p>
                    </div>
                  </div>
                  <div className="info-item">
                    <span className="info-icon">🚀</span>
                    <div className="info-text">
                      <strong>Interactive Walkthroughs</strong>
                      <p>See how to use the wizard, projects, agencies, and more</p>
                    </div>
                  </div>
                  <div className="info-item">
                    <span className="info-icon">💡</span>
                    <div className="info-text">
                      <strong>Practical Tips</strong>
                      <p>Get actionable advice for each feature</p>
                    </div>
                  </div>
                </div>

                <button 
                  className="btn btn-primary btn-large"
                  onClick={() => {
                    if (onLaunchOnboarding) {
                      onLaunchOnboarding();
                    }
                  }}
                  style={{ marginTop: '20px' }}
                >
                  🎉 Launch Tutorial
                </button>

                <p className="help-text" style={{ marginTop: '15px' }}>
                  💡 You can exit the tutorial at any time by clicking the X button or "Skip Tutorial"
                </p>
              </div>
            </div>
          </div>
        );

      case 'advanced-settings':
        return (
          <div className="tab-content">
            {/* File Paths Configuration Section */}
            <div className="file-paths-section">
              <h2>File Path Configuration</h2>
              <p className="section-description">Configure where the application looks for template files and saves created projects.</p>
              
              <div className="path-settings">
                {/* Template Paths */}
                <div className="setting-group">
                  <h3>📁 Template Source Locations</h3>
                  <p className="group-description">Where the application finds template files for project creation</p>
                  
                  <div className="setting-row">
                    <label>Primary Template Path:</label>
                    <div className="path-input-group">
                      <input
                        type="text"
                        value={settings.pathSettings.templates.primaryPath}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          pathSettings: {
                            ...prev.pathSettings,
                            templates: {
                              ...prev.pathSettings.templates,
                              primaryPath: e.target.value
                            }
                          }
                        }))}
                        placeholder="Network path to templates"
                        className="path-input"
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          if (electronAPI && electronAPI.selectFolder) {
                            const result = await electronAPI.selectFolder();
                            if (result && !result.canceled && result.filePaths[0]) {
                              setSettings(prev => ({
                                ...prev,
                                pathSettings: {
                                  ...prev.pathSettings,
                                  templates: {
                                    ...prev.pathSettings.templates,
                                    primaryPath: result.filePaths[0]
                                  }
                                }
                              }));
                            }
                          }
                        }}
                        title="Browse for folder"
                      >
                        📂
                      </button>
                    </div>
                  </div>
                  
                  <div className="setting-row">
                    <label>Fallback Template Path:</label>
                    <div className="path-input-group">
                      <input
                        type="text"
                        value={settings.pathSettings.templates.fallbackPath}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          pathSettings: {
                            ...prev.pathSettings,
                            templates: {
                              ...prev.pathSettings.templates,
                              fallbackPath: e.target.value
                            }
                          }
                        }))}
                        placeholder="Local fallback path (use {userHome} for user directory)"
                        className="path-input"
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          if (electronAPI && electronAPI.selectFolder) {
                            const result = await electronAPI.selectFolder();
                            if (result && !result.canceled && result.filePaths[0]) {
                              setSettings(prev => ({
                                ...prev,
                                pathSettings: {
                                  ...prev.pathSettings,
                                  templates: {
                                    ...prev.pathSettings.templates,
                                    fallbackPath: result.filePaths[0]
                                  }
                                }
                              }));
                            }
                          }
                        }}
                        title="Browse for folder"
                      >
                        📂
                      </button>
                    </div>
                  </div>
                  
                  <div className="setting-row">
                    <label>Agent Requirements Path:</label>
                    <div className="path-input-group">
                      <input
                        type="text"
                        value={settings.pathSettings.templates.agentRequirementsPath}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          pathSettings: {
                            ...prev.pathSettings,
                            templates: {
                              ...prev.pathSettings.templates,
                              agentRequirementsPath: e.target.value
                            }
                          }
                        }))}
                        placeholder="Path to agent requirements files"
                        className="path-input"
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          if (electronAPI && electronAPI.selectFolder) {
                            const result = await electronAPI.selectFolder();
                            if (result && !result.canceled && result.filePaths[0]) {
                              setSettings(prev => ({
                                ...prev,
                                pathSettings: {
                                  ...prev.pathSettings,
                                  templates: {
                                    ...prev.pathSettings.templates,
                                    agentRequirementsPath: result.filePaths[0]
                                  }
                                }
                              }));
                            }
                          }
                        }}
                        title="Browse for folder"
                      >
                        📂
                      </button>
                    </div>
                  </div>
                </div>

                {/* Project Output Paths */}
                <div className="setting-group">
                  <h3>💾 Project Output Locations</h3>
                  <p className="group-description">Where created project folders are saved</p>
                  
                  <div className="setting-row">
                    <label>Default Output Location:</label>
                    <select
                      value={settings.pathSettings.projectOutput.defaultLocation}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        pathSettings: {
                          ...prev.pathSettings,
                          projectOutput: {
                            ...prev.pathSettings.projectOutput,
                            defaultLocation: e.target.value
                          }
                        }
                      }))}
                      className="path-select"
                    >
                      <option value="desktop">Desktop</option>
                      <option value="triage">Triage Folder</option>
                      <option value="custom">Custom Path</option>
                    </select>
                  </div>
                  
                  <div className="setting-row">
                    <label>Custom Output Path:</label>
                    <div className="path-input-group">
                      <input
                        type="text"
                        value={settings.pathSettings.projectOutput.customPath}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          pathSettings: {
                            ...prev.pathSettings,
                            projectOutput: {
                              ...prev.pathSettings.projectOutput,
                              customPath: e.target.value
                            }
                          }
                        }))}
                        placeholder="Custom project output path (use {userHome} for user directory)"
                        className="path-input"
                        disabled={settings.pathSettings.projectOutput.defaultLocation !== 'custom'}
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          if (electronAPI && electronAPI.selectFolder) {
                            const result = await electronAPI.selectFolder();
                            if (result && !result.canceled && result.filePaths[0]) {
                              setSettings(prev => ({
                                ...prev,
                                pathSettings: {
                                  ...prev.pathSettings,
                                  projectOutput: {
                                    ...prev.pathSettings.projectOutput,
                                    customPath: result.filePaths[0]
                                  }
                                }
                              }));
                            }
                          }
                        }}
                        title="Browse for folder"
                        disabled={settings.pathSettings.projectOutput.defaultLocation !== 'custom'}
                      >
                        📂
                      </button>
                    </div>
                  </div>
                  
                  <div className="setting-row">
                    <label>Triage Folder Path:</label>
                    <div className="path-input-group">
                      <input
                        type="text"
                        value={settings.pathSettings.projectOutput.triagePath}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          pathSettings: {
                            ...prev.pathSettings,
                            projectOutput: {
                              ...prev.pathSettings.projectOutput,
                              triagePath: e.target.value
                            }
                          }
                        }))}
                        placeholder="Path to triage folder (use {userHome} for user directory)"
                        className="path-input"
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          if (electronAPI && electronAPI.selectFolder) {
                            const result = await electronAPI.selectFolder();
                            if (result && !result.canceled && result.filePaths[0]) {
                              setSettings(prev => ({
                                ...prev,
                                pathSettings: {
                                  ...prev.pathSettings,
                                  projectOutput: {
                                    ...prev.pathSettings.projectOutput,
                                    triagePath: result.filePaths[0]
                                  }
                                }
                              }));
                            }
                          }
                        }}
                        title="Browse for folder"
                      >
                        📂
                      </button>
                    </div>
                  </div>
                </div>

                {/* Path Variables Info */}
                <div className="setting-group">
                  <h3>ℹ️ Path Variables</h3>
                  <div className="path-variables-info">
                    <p><strong>{'{userHome}'}</strong> - Automatically replaced with the current user's home directory</p>
                    <p><strong>Example:</strong> {'{userHome}\\Desktop'} becomes 'C:\\Users\\YourName\\Desktop'</p>
                  </div>
                </div>
              </div>
            </div>

            {/* SharePoint Integration Section - TEMPORARILY HIDDEN */}
            {/* TODO: Re-enable after fixing navigation and verification issues */}
            {false && <div className="sharepoint-section">
              <h2>SharePoint Integration</h2>
              <p className="section-description">Configure SharePoint upload settings for automated project deployment.</p>
              
              <div className="sharepoint-settings">
                {/* Enable SharePoint */}
                <div className="setting-group">
                  <h3>🔗 SharePoint Upload</h3>
                  <p className="group-description">Enable automatic project upload to SharePoint</p>
                  
                  <div className="setting-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.sharePointSettings.enabled}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          sharePointSettings: {
                            ...prev.sharePointSettings,
                            enabled: e.target.checked
                          }
                        }))}
                      />
                      Enable SharePoint Integration
                    </label>
                  </div>
                </div>

                {/* SharePoint URL Configuration */}
                <div className="setting-group">
                  <h3>📁 SharePoint Location</h3>
                  <p className="group-description">Configure where project files will be uploaded</p>
                  
                  <div className="setting-row">
                    <label>SharePoint Folder URL:</label>
                    <div className="path-input-group">
                      <input
                        type="text"
                        value={settings.sharePointSettings.sharePointUrl}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          sharePointSettings: {
                            ...prev.sharePointSettings,
                            sharePointUrl: e.target.value
                          }
                        }))}
                        placeholder="https://acuitybrandsinc.sharepoint.com/:f:/r/sites/..."
                        className="path-input"
                        disabled={!settings.sharePointSettings.enabled}
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          if (electronAPI && electronAPI.testSharePointAccess) {
                            const result = await electronAPI.testSharePointAccess(settings.sharePointSettings.sharePointUrl);
                            if (result.success) {
                              alert(`✅ Access Test Successful!\n\nMethod: ${result.method}\nPath: ${result.path || 'Web API'}\n\n${result.message}`);
                            } else {
                              alert(`❌ Access Test Failed!\n\n${result.error}\n\nPlease check if OneDrive is syncing your SharePoint library.`);
                            }
                          } else {
                            alert('✅ Connection test will be available in production.\n\nThe app will automatically detect:\n- OneDrive sync folders\n- Web API access');
                          }
                        }}
                        title="Test SharePoint access"
                        disabled={!settings.sharePointSettings.enabled}
                      >
                        🔍
                      </button>
                    </div>
                  </div>

                </div>

                {/* Upload Options */}
                <div className="setting-group">
                  <h3>⚙️ Upload Options</h3>
                  <p className="group-description">Configure how projects are uploaded</p>
                  
                  <div className="setting-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.sharePointSettings.uploadOptions.overwriteExisting}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          sharePointSettings: {
                            ...prev.sharePointSettings,
                            uploadOptions: {
                              ...prev.sharePointSettings.uploadOptions,
                              overwriteExisting: e.target.checked
                            }
                          }
                        }))}
                        disabled={!settings.sharePointSettings.enabled}
                      />
                      Automatically overwrite existing files
                    </label>
                  </div>

                  <div className="setting-row">
                    <label>Zip File Naming:</label>
                    <input
                      type="text"
                      value={settings.sharePointSettings.uploadOptions.zipNaming}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        sharePointSettings: {
                          ...prev.sharePointSettings,
                          uploadOptions: {
                            ...prev.sharePointSettings.uploadOptions,
                            zipNaming: e.target.value
                          }
                        }
                      }))}
                      placeholder="{projectName}_{rfaNumber}_{date}.zip"
                      className="path-input"
                      disabled={!settings.sharePointSettings.enabled}
                    />
                    <small className="setting-hint">
                      Available variables: {'{projectName}'}, {'{rfaNumber}'}, {'{date}'}, {'{time}'}
                    </small>
                  </div>
                </div>

                {/* Access Methods Info */}
                <div className="setting-group">
                  <h3>🔒 Upload Methods</h3>
                  <p className="group-description">The app automatically detects the best upload method available</p>
                  
                  <div className="access-info">
                    <div className="info-item">
                      <span className="info-icon">⭐</span>
                      <div className="info-content">
                        <strong>Method 1: OneDrive Sync (Recommended)</strong>
                        <p>If you have OneDrive syncing the SharePoint library to your computer, files will be copied to the local sync folder and automatically uploaded to SharePoint.</p>
                        <small>Setup: Go to SharePoint → Sync to sync the library to your computer</small>
                      </div>
                    </div>
                    
                    <div className="info-item">
                      <span className="info-icon">🌐</span>
                      <div className="info-content">
                        <strong>Method 2: Web Upload (Fallback)</strong>
                        <p>If OneDrive sync is not available, the app can upload directly to SharePoint using web APIs.</p>
                        <small>Setup: Requires Microsoft 365 authentication (IT assistance may be needed)</small>
                      </div>
                    </div>
                    
                    <div className="info-item">
                      <span className="info-icon">🔍</span>
                      <div className="info-content">
                        <strong>Automatic Detection</strong>
                        <p>Use the test button above to check which upload method is available on your computer.</p>
                        <small>The app will use the most reliable method automatically</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>}

            {/* OneDrive Sync Integration Section */}
            <div className="onedrive-sync-section">
              <div className="onedrive-section-header">
                <div className="header-content">
                  <div className="header-icon">📂</div>
                  <div className="header-text">
                    <h2>OneDrive Sync Integration</h2>
                    <p className="header-description">Upload projects to SharePoint via OneDrive sync folder. No authentication required!</p>
                  </div>
                </div>
              </div>
              
              <div className="onedrive-sync-settings">
                {/* Enable OneDrive Sync */}
                <div className="setting-card">
                  <div className="setting-header">
                    <div className="setting-icon">🔗</div>
                    <div className="setting-title">
                      <h3>Enable OneDrive Sync Upload</h3>
                      <p className="setting-description">Use your local OneDrive sync folder to upload projects to SharePoint</p>
                    </div>
                  </div>
                  
                  <div className="setting-control">
                    <label className="modern-checkbox">
                      <input
                        type="checkbox"
                        checked={settings.oneDriveSyncSettings.enabled}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          oneDriveSyncSettings: {
                            ...prev.oneDriveSyncSettings,
                            enabled: e.target.checked
                          }
                        }))}
                      />
                      <span className="checkmark"></span>
                      <span className="label-text">Enable OneDrive Sync Integration</span>
                    </label>
                  </div>
                </div>

                {/* OneDrive Sync Folder Configuration */}
                <div className="setting-card">
                  <div className="setting-header">
                    <div className="setting-icon">📁</div>
                    <div className="setting-title">
                      <h3>Sync Folder Configuration</h3>
                      <p className="setting-description">Select the local OneDrive folder that syncs to your SharePoint library</p>
                    </div>
                  </div>
                  
                  <div className="setting-control">
                    <label className="control-label">OneDrive Sync Folder Path</label>
                    <div className="path-input-group">
                      <input
                        type="text"
                        value={settings.oneDriveSyncSettings.syncFolderPath}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          oneDriveSyncSettings: {
                            ...prev.oneDriveSyncSettings,
                            syncFolderPath: e.target.value
                          }
                        }))}
                        placeholder="C:\\Users\\...\\OneDrive - Acuity Brands, Inc\\CIDesignSolutions - Shared Documents\\LnT"
                        className="path-input"
                        disabled={!settings.oneDriveSyncSettings.enabled}
                      />
                      <div className="path-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={async () => {
                            if (electronAPI && electronAPI.detectOneDriveSync) {
                              const result = await electronAPI.detectOneDriveSync();
                              if (result.success && result.folders && result.folders.length > 0) {
                                const selectedFolder = result.folders[0].path;
                                if (selectedFolder) {
                                  setSettings(prev => ({
                                    ...prev,
                                    oneDriveSyncSettings: {
                                      ...prev.oneDriveSyncSettings,
                                      syncFolderPath: selectedFolder
                                    }
                                  }));
                                }
                              } else {
                                alert('No OneDrive sync folders detected. Please manually enter the path or sync your SharePoint library.');
                              }
                            }
                          }}
                          disabled={!settings.oneDriveSyncSettings.enabled}
                        >
                          🔍 Detect
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={async () => {
                            if (electronAPI && electronAPI.browseForSyncFolder) {
                              const result = await electronAPI.browseForSyncFolder();
                              if (result.success && result.folderPath) {
                                setSettings(prev => ({
                                  ...prev,
                                  oneDriveSyncSettings: {
                                    ...prev.oneDriveSyncSettings,
                                    syncFolderPath: result.folderPath
                                  }
                                }));

                                if (result.verification && result.verification.valid) {
                                  alert(`✅ Folder selected successfully!\n\n${result.folderPath}`);
                                }
                              }
                            }
                          }}
                          disabled={!settings.oneDriveSyncSettings.enabled}
                        >
                          📂 Browse
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={async () => {
                            if (electronAPI && electronAPI.testSyncFolder) {
                              const result = await electronAPI.testSyncFolder(settings.oneDriveSyncSettings.syncFolderPath);
                              if (result.success) {
                                alert(`✅ Sync folder test successful!\n\n${result.message}`);
                              } else {
                                alert(`❌ Sync folder test failed!\n\n${result.error}\n\nPlease check the folder path and OneDrive sync status.`);
                              }
                            }
                          }}
                          disabled={!settings.oneDriveSyncSettings.enabled || !settings.oneDriveSyncSettings.syncFolderPath}
                        >
                          ✓ Test
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* File Cleanup Strategy */}
                <div className="file-cleanup-section">
                  <div className="section-header">
                    <h2>File Cleanup</h2>
                    <p className="section-description">Choose how to handle uploaded files in your local OneDrive folder</p>
                  </div>

                  <div className="cleanup-options">
                    {/* Auto-delete Option */}
                    <div className="cleanup-card">
                      <label className="cleanup-radio">
                        <input
                          type="radio"
                          name="cleanup"
                          value="auto-delete"
                          checked={settings.oneDriveSyncSettings.cleanupStrategy === 'auto-delete'}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            oneDriveSyncSettings: {
                              ...prev.oneDriveSyncSettings,
                              cleanupStrategy: e.target.value
                            }
                          }))}
                          disabled={!settings.oneDriveSyncSettings.enabled}
                        />
                        <span className="radio-mark"></span>
                        <div className="radio-content">
                          <span className="radio-title">Auto-delete after sync verification</span>
                          <span className="radio-description">⚠️ Files are removed from OneDrive ONLY after confirmed SharePoint sync (uses PowerShell verification)</span>
                        </div>
                      </label>
                    </div>

                    {/* Keep Recent Option */}
                    <div className="cleanup-card">
                      <label className="cleanup-radio">
                        <input
                          type="radio"
                          name="cleanup"
                          value="keep-recent"
                          checked={settings.oneDriveSyncSettings.cleanupStrategy === 'keep-recent'}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            oneDriveSyncSettings: {
                              ...prev.oneDriveSyncSettings,
                              cleanupStrategy: e.target.value
                            }
                          }))}
                          disabled={!settings.oneDriveSyncSettings.enabled}
                        />
                        <span className="radio-mark"></span>
                        <div className="radio-content">
                          <span className="radio-title">Keep recent files</span>
                        </div>
                      </label>
                      <div className="keep-count-controls">
                        <label className="count-label">Keep last</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={settings.oneDriveSyncSettings.keepRecentCount}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            oneDriveSyncSettings: {
                              ...prev.oneDriveSyncSettings,
                              keepRecentCount: parseInt(e.target.value) || 10
                            }
                          }))}
                          className="count-input"
                          disabled={!settings.oneDriveSyncSettings.enabled || settings.oneDriveSyncSettings.cleanupStrategy !== 'keep-recent'}
                        />
                        <label className="count-label">files</label>
                      </div>
                    </div>

                    {/* Manual Cleanup Option */}
                    <div className="cleanup-card">
                      <label className="cleanup-radio">
                        <input
                          type="radio"
                          name="cleanup"
                          value="manual"
                          checked={settings.oneDriveSyncSettings.cleanupStrategy === 'manual'}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            oneDriveSyncSettings: {
                              ...prev.oneDriveSyncSettings,
                              cleanupStrategy: e.target.value
                            }
                          }))}
                          disabled={!settings.oneDriveSyncSettings.enabled}
                        />
                        <span className="radio-mark"></span>
                        <div className="radio-content">
                          <span className="radio-title">Manual cleanup only (recommended for safety)</span>
                          <span className="radio-description">✅ Files stay in OneDrive - you manage cleanup manually. Safest option.</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Setup Instructions */}
                <div className="setup-instructions-section">
                  <div className="section-header">
                    <h2>Setup Instructions</h2>
                    <p className="section-description">Follow these steps to configure OneDrive sync for SharePoint integration</p>
                  </div>
                  
                  <div className="instructions-container">
                    {/* Step 1 */}
                    <div className="instruction-card">
                      <div className="step-number">1</div>
                      <div className="step-content">
                        <h3>Sync SharePoint Library to OneDrive</h3>
                        <ul className="step-list">
                          <li>Open your SharePoint site in a browser</li>
                          <li>Navigate to the document library (e.g., "Shared Documents")</li>
                          <li>Click the "Sync" button in the toolbar</li>
                          <li>OneDrive will create a local folder that automatically syncs to SharePoint</li>
                        </ul>
                      </div>
                    </div>
                    
                    {/* Step 2 */}
                    <div className="instruction-card">
                      <div className="step-number">2</div>
                      <div className="step-content">
                        <h3>Configure App to Use Sync Folder</h3>
                        <ul className="step-list">
                          <li>Click "Detect" to automatically find your OneDrive sync folder</li>
                          <li>Or use "Browse" to manually select the folder</li>
                          <li>Click "Test" to verify the folder is syncing properly</li>
                          <li>The folder path will look like: <code>C:\Users\YourName\OneDrive - Acuity Brands, Inc\...</code></li>
                        </ul>
                      </div>
                    </div>
                    
                    {/* Step 3 */}
                    <div className="instruction-card">
                      <div className="step-number">3</div>
                      <div className="step-content">
                        <h3>Upload Projects</h3>
                        <ul className="step-list">
                          <li>Create a project in the app</li>
                          <li>Go to Project Management page</li>
                          <li>Click "Upload to SharePoint" button</li>
                          <li>App will zip the project and copy it to OneDrive</li>
                          <li>OneDrive automatically syncs the file to SharePoint</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'project-form':
        const currentCategory = getCurrentCategory();
        const currentItems = settings[selectedCategory] || [];
        
        return (
          <div className="tab-content">
            <div className="form-settings-layout">
              {/* Sidebar with categories */}
              <div className="form-categories-sidebar">
                <div className="sidebar-header">
                  <h3>Categories</h3>
                  <div className="view-mode-toggle">
                    <button 
                      className={`view-btn ${viewMode === 'compact' ? 'active' : ''}`}
                      onClick={() => setViewMode('compact')}
                      title="Compact View"
                    >
                      ⊞
                    </button>
                    <button 
                      className={`view-btn ${viewMode === 'detailed' ? 'active' : ''}`}
                      onClick={() => setViewMode('detailed')}
                      title="Detailed View"
                    >
                      ☰
                    </button>
                  </div>
                </div>
                
                <div className="categories-list">
                  {formCategories.map(category => (
                    <button
                      key={category.key}
                      className={`category-item ${selectedCategory === category.key ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedCategory(category.key);
                        setSearchTerm(''); // Clear search when switching categories
                        cancelEditing(); // Cancel any active editing
                      }}
                    >
                      <span className="category-icon">{category.icon}</span>
                      <div className="category-info">
                        <span className="category-label">{category.label}</span>
                        <span className="category-count">({settings[category.key]?.length || 0})</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main content area */}
              <div className="form-settings-main">
                {/* Header with search and actions */}
                <div className="main-header">
                  <div className="header-info">
                    <h2>
                      <span className="header-icon">{currentCategory?.icon}</span>
                      {currentCategory?.label}
                    </h2>
                    <p className="header-description">{currentCategory?.description}</p>
                  </div>
                  
                  <div className="header-actions">
                    <div className="search-box">
                      <input
                        type="text"
                        placeholder="Search items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                      />
                      {searchTerm && (
                        <button 
                          className="clear-search"
                          onClick={() => setSearchTerm('')}
                          title="Clear search"
                        >
                          ✗
                        </button>
                      )}
                    </div>
                    
                    <div className="item-count">
                      {getFilteredItems(currentItems).length} of {currentItems.length} items
                    </div>
                  </div>
                </div>

                {/* Items display */}
                <div className="items-container">
                  {viewMode === 'compact' ? 
                    renderCompactFieldEditor(selectedCategory, currentItems) :
                    renderFieldEditor(selectedCategory, currentCategory?.label, currentItems)
                  }
                </div>
              </div>
            </div>
          </div>
        );

      case 'agencies':
        return (
          <div className="tab-content">
            <div className="agencies-management">
              {/* Auto-Sync Configuration Section */}
              <div className="sync-configuration-section">
                <div className="section-header">
                  <h2>Auto-Sync Configuration</h2>
                  <p className="section-description">Configure automatic sync with your Excel file</p>
                </div>
                
                <div className="sync-cards-grid">
                  {/* Excel Sync Feature Card */}
                  <div className="sync-card">
                    <div className="card-header">
                      <div className="card-icon">⚙️</div>
                      <div className="card-content">
                        <h3>Excel Sync Feature</h3>
                        <p>Enable or disable Excel synchronization for agency data</p>
                      </div>
                    </div>
                    <div className="card-control">
                      <label className="sync-checkbox">
                        <input
                          type="checkbox"
                          checked={syncSettings.enabled}
                          onChange={(e) => {
                            const newSettings = { ...syncSettings, enabled: e.target.checked };
                            setSyncSettings(newSettings);
                            handleSyncSettingsUpdate(newSettings);
                          }}
                        />
                        <span className="checkmark"></span>
                        <span className="label-text">Enable Excel Sync</span>
                      </label>
                      <div className="info-text">
                        {syncSettings.enabled 
                          ? '✅ Sync feature is active - Configure sync mode below'
                          : '❌ Sync feature is disabled - Manual import available'
                        }
                      </div>
                    </div>
                  </div>

                  {/* Manual Import Card */}
                  <div className={`sync-card ${syncSettings.enabled ? 'disabled' : ''}`}>
                    <div className="card-header">
                      <div className="card-icon">📥</div>
                      <div className="card-content">
                        <h3>Manual Import</h3>
                        <p>
                          {syncSettings.enabled 
                            ? 'Disabled when Excel Sync is enabled - Use sync mode instead'
                            : 'One-time import of agency data from Excel file'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="card-control">
                      <div className="import-buttons">
                        <button 
                          className="btn btn-secondary"
                          onClick={handleExcelImport}
                          disabled={syncSettings.enabled}
                        >
                          📂 Import Excel
                        </button>
                        <button 
                          className="btn btn-secondary"
                          onClick={handleExcelDiagnose}
                          disabled={syncSettings.enabled}
                        >
                          🔍 Diagnose Excel
                        </button>
                      </div>
                      
                      {/* Import Status */}
                      {importStatus && (
                        <div className={`status-message ${importStatus.type}`}>
                          {importStatus.type === 'loading' && <span className="spinner">⏳</span>}
                          {importStatus.message}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sync Mode Card - Only visible when sync is enabled */}
                {syncSettings.enabled && (
                  <div className="sync-card sync-mode-card">
                    <div className="card-header">
                      <div className="card-icon">🔄</div>
                      <div className="card-content">
                        <h3>Sync Trigger Mode</h3>
                        <p>Choose when to sync data from Excel file</p>
                      </div>
                    </div>
                    <div className="card-control">
                      <div className="sync-mode-options">
                        <label className="sync-radio">
                          <input
                            type="radio"
                            name="syncMode"
                            value="manual"
                            checked={syncSettings.mode === 'manual'}
                            onChange={(e) => {
                              const newSettings = { ...syncSettings, mode: e.target.value };
                              setSyncSettings(newSettings);
                              handleSyncSettingsUpdate(newSettings);
                            }}
                          />
                          <span className="radio-mark"></span>
                          <div className="radio-content">
                            <span className="radio-title">Manual Trigger</span>
                            <span className="radio-description">Click "Sync Now" button to import when you're ready</span>
                          </div>
                        </label>
                        <label className="sync-radio">
                          <input
                            type="radio"
                            name="syncMode"
                            value="auto"
                            checked={syncSettings.mode === 'auto'}
                            onChange={(e) => {
                              const newSettings = { ...syncSettings, mode: e.target.value };
                              setSyncSettings(newSettings);
                              handleSyncSettingsUpdate(newSettings);
                            }}
                          />
                          <span className="radio-mark"></span>
                          <div className="radio-content">
                            <span className="radio-title">Automatic Monitoring</span>
                            <span className="radio-description">Automatically detect and sync when Excel file changes</span>
                          </div>
                        </label>
                      </div>
                      <div className="mode-explanation">
                        {syncSettings.mode === 'manual' 
                          ? '💡 With manual trigger, the Excel file path is configured, but syncing only happens when you click the "Sync Now" button below.'
                          : '💡 With automatic monitoring, the app watches your Excel file and syncs data automatically whenever changes are detected.'
                        }
                      </div>
                    </div>
                  </div>
                )}

                {/* Excel File Path Card */}
                <div className="sync-card">
                  <div className="card-header">
                    <div className="card-icon">📁</div>
                    <div className="card-content">
                      <h3>Excel File Path</h3>
                      <p>Select the Excel file to sync with</p>
                    </div>
                  </div>
                  <div className="card-control">
                    <div className="file-path-section">
                      <label className="file-path-label">File Path</label>
                      <div className={`file-path-input ${filePathValid === false ? 'error' : filePathValid === true ? 'success' : ''}`}>
                        <input
                          type="text"
                          value={syncSettings.filePath}
                          onChange={(e) => {
                            const newSettings = { ...syncSettings, filePath: e.target.value };
                            setSyncSettings(newSettings);
                            setFilePathValid(null);
                          }}
                          placeholder="Enter or browse to select Excel file path..."
                        />
                        <button 
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleBrowseFilePath}
                        >
                          📁 Browse
                        </button>
                      </div>
                      {syncSettings.filePath && (
                        <div className="file-path-actions">
                          <button 
                            type="button"
                            className="btn btn-small"
                            onClick={() => handleFilePathTest(syncSettings.filePath)}
                          >
                            🔍 Test Path
                          </button>
                          <button 
                            type="button"
                            className="btn btn-small"
                            onClick={() => {
                              const newSettings = { ...syncSettings, filePath: syncSettings.filePath };
                              handleSyncSettingsUpdate(newSettings);
                            }}
                          >
                            💾 Save Path
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sync Now Button */}
                {syncSettings.filePath && (
                  <div className="sync-now-section">
                    <button 
                      type="button"
                      className="btn btn-primary btn-large sync-now-btn"
                      onClick={handleManualSync}
                      disabled={!syncSettings.filePath || filePathValid === false}
                    >
                      🔄 Sync Now
                    </button>
                    {syncSettings.lastSync && (
                      <p className="last-sync-time">
                        Last sync: {new Date(syncSettings.lastSync).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Sync Status */}
                {syncStatus && (
                  <div className={`status-message ${syncStatus.type}`}>
                    {syncStatus.type === 'loading' && <span className="spinner">⏳</span>}
                    {syncStatus.message}
                  </div>
                )}
              </div>

              {/* Agency Management Section */}
              <div className="agency-management-section">
                <div className="agency-section-header">
                  <div className="header-content">
                    <div className="header-icon">🏢</div>
                    <div className="header-text">
                      <h2>Agency Management</h2>
                      <p className="header-description">Export agency data to Excel or manually add new agencies to the system</p>
                    </div>
                  </div>
                </div>
                
                <div className="agency-actions-grid">
                  {/* Export to Excel Card */}
                  <div className="action-card">
                    <div className="action-card-header">
                      <div className="action-icon">📊</div>
                      <div className="action-content">
                        <h3>Export to Excel</h3>
                        <p>Export all agency data to the configured Excel file</p>
                      </div>
                    </div>
                    <div className="action-card-body">
                      {syncSettings.filePath ? (
                        <>
                          <button 
                            type="button"
                            className="btn btn-primary btn-block"
                            onClick={handleExportToExcel}
                            disabled={!syncSettings.filePath || filePathValid === false}
                          >
                            📊 Export to Excel
                          </button>
                          {syncSettings.lastExport && (
                            <p className="action-timestamp">
                              Last export: {new Date(syncSettings.lastExport).toLocaleString()}
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="action-disabled-message">
                          <span className="disabled-icon">⚠️</span>
                          <p>Configure Excel file path above to enable export</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add New Agency Card */}
                  <div className="action-card">
                    <div className="action-card-header">
                      <div className="action-icon">➕</div>
                      <div className="action-content">
                        <h3>Add New Agency</h3>
                        <p>Manually add a new agency to the system database</p>
                      </div>
                    </div>
                    <div className="action-card-body">
                      <button 
                        className="btn btn-secondary btn-block"
                        onClick={() => {
                          setShowAgencyForm(true);
                          setEditingAgency(null);
                          setAgencyFormData({
                            agencyNumber: '',
                            agencyName: '',
                            contactName: '',
                            contactEmail: '',
                            phoneNumber: '',
                            role: '',
                            region: '',
                            mainContact: '',
                            sae: 'No'
                          });
                        }}
                      >
                        ➕ Add New Agency
                      </button>
                      <p className="action-info">
                        💡 Add agencies manually when not syncing from Excel
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Export Status */}
              {exportStatus && (
                <div className={`status-message compact ${exportStatus.type}`}>
                  {exportStatus.type === 'loading' && <span className="spinner">⏳</span>}
                  {exportStatus.message}
                </div>
              )}

              {/* Agency Form */}
              {showAgencyForm && (
                  <div className="agency-form-container">
                    <div className="agency-form-header">
                      <h4>{editingAgency ? 'Edit Agency' : 'Add New Agency'}</h4>
                      <button 
                        className="close-btn"
                        onClick={() => {
                          setShowAgencyForm(false);
                          setEditingAgency(null);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    
                    <form onSubmit={handleAgencyFormSubmit} className="agency-form">
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Agency Number</label>
                          <input
                            type="text"
                            value={agencyFormData.agencyNumber}
                            onChange={(e) => setAgencyFormData({...agencyFormData, agencyNumber: e.target.value})}
                            placeholder="Enter agency number"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Agency Name *</label>
                          <input
                            type="text"
                            value={agencyFormData.agencyName}
                            onChange={(e) => setAgencyFormData({...agencyFormData, agencyName: e.target.value})}
                            placeholder="Enter agency name"
                            required
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Contact Name</label>
                          <input
                            type="text"
                            value={agencyFormData.contactName}
                            onChange={(e) => setAgencyFormData({...agencyFormData, contactName: e.target.value})}
                            placeholder="Enter contact name"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Contact Email</label>
                          <input
                            type="email"
                            value={agencyFormData.contactEmail}
                            onChange={(e) => setAgencyFormData({...agencyFormData, contactEmail: e.target.value})}
                            placeholder="Enter contact email"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Contact Number</label>
                          <input
                            type="tel"
                            value={agencyFormData.phoneNumber}
                            onChange={(e) => setAgencyFormData({...agencyFormData, phoneNumber: e.target.value})}
                            placeholder="Enter contact number"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Role</label>
                          <input
                            type="text"
                            value={agencyFormData.role}
                            onChange={(e) => setAgencyFormData({...agencyFormData, role: e.target.value})}
                            placeholder="Enter role"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Region</label>
                          <select
                            value={agencyFormData.region}
                            onChange={(e) => setAgencyFormData({...agencyFormData, region: e.target.value})}
                          >
                            <option value="">Select region</option>
                            <option value="Region 1">Region 1</option>
                            <option value="Region 2">Region 2</option>
                            <option value="Region 3">Region 3</option>
                            <option value="Region 4">Region 4</option>
                            <option value="Region 5">Region 5</option>
                            <option value="International">International</option>
                            <option value="Unknown">Unknown</option>
                          </select>
                        </div>
                        
                        <div className="form-group">
                          <label>Main Contact</label>
                          <input
                            type="text"
                            value={agencyFormData.mainContact}
                            onChange={(e) => setAgencyFormData({...agencyFormData, mainContact: e.target.value})}
                            placeholder="Enter main contact"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>SAE</label>
                          <select
                            value={agencyFormData.sae}
                            onChange={(e) => setAgencyFormData({...agencyFormData, sae: e.target.value})}
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => {
                          setShowAgencyForm(false);
                          setEditingAgency(null);
                        }}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                          {editingAgency ? 'Update Agency' : 'Add Agency'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* Existing Agencies List */}
              <div className="settings-section">
                <h3>Existing Agencies ({agencies.length})</h3>
                
                {agencies.length === 0 ? (
                  <div className="no-agencies">
                    <p>No agencies found. Import from Excel or add manually.</p>
                  </div>
                ) : (
                  <div className="agencies-list">
                    {/* Search and Filter Controls */}
                    <div className="agencies-controls">
                      <div className="search-and-filters">
                        <div className="search-box">
                          <input
                            type="text"
                            placeholder="Search agencies, contacts, regions..."
                            value={agencySearchTerm}
                            onChange={(e) => setAgencySearchTerm(e.target.value)}
                            className="search-input"
                          />
                          {agencySearchTerm && (
                            <button 
                              className="clear-search"
                              onClick={() => setAgencySearchTerm('')}
                              title="Clear search"
                            >
                              ✗
                            </button>
                          )}
                        </div>
                        
                        <div className="filter-controls">
                          <select
                            value={agencyFilters.region}
                            onChange={(e) => handleAgencyFilterChange('region', e.target.value)}
                            className="filter-select"
                          >
                            <option value="all">All Regions</option>
                            {agencyFilterOptions.regions.map(region => (
                              <option key={region} value={region}>{region}</option>
                            ))}
                          </select>
                          
                          <select
                            value={agencyFilters.role}
                            onChange={(e) => handleAgencyFilterChange('role', e.target.value)}
                            className="filter-select"
                          >
                            <option value="all">All Roles</option>
                            {agencyFilterOptions.roles.map(role => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      {/* Results Summary */}
                      <div className="results-summary">
                        {filteredAgencies.length !== agencies.length && (
                          <span className="filter-info">
                            {filteredAgencies.length} of {agencies.length} agencies
                          </span>
                        )}
                        {filteredAgencies.length === agencies.length && (
                          <span className="total-info">
                            {agencies.length} total agencies
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Agencies Table */}
                    <div className="agencies-table">
                      <div className="table-header">
                        <span>Agency Name</span>
                        <span>Contact</span>
                        <span>Region</span>
                        <span>Role</span>
                        <span>Actions</span>
                      </div>
                      
                      {filteredAgencies.length === 0 ? (
                        <div className="no-results">
                          <p>No agencies found matching your search criteria.</p>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setAgencySearchTerm('');
                              setAgencyFilters({ region: 'all', role: 'all' });
                            }}
                          >
                            Clear Filters
                          </button>
                        </div>
                      ) : (
                        <>
                          {getPaginatedAgencies().map(agency => (
                            <div key={agency.id} className="table-row">
                              <span className="agency-name" title={agency.agencyName}>
                                {agency.agencyName}
                              </span>
                              <span className="contact-info">
                                <div>{agency.contactName}</div>
                                <div className="contact-email">{agency.contactEmail}</div>
                              </span>
                              <span className="region">{agency.region}</span>
                              <span className="role">{agency.role}</span>
                              <span className="actions">
                                <button 
                                  className="btn-icon edit-btn"
                                  onClick={() => handleEditAgency(agency)}
                                  title="Edit agency"
                                >
                                  ✏️
                                </button>
                                <button 
                                  className="btn-icon delete-btn"
                                  onClick={() => handleDeleteAgency(agency)}
                                  title="Delete agency"
                                >
                                  🗑️
                                </button>
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Pagination */}
                    {filteredAgencies.length > 0 && renderPagination(getPaginationInfo())}
                  </div>
                )}

              {/* Agency Edit Modal */}
              <AgencyEditModal
                isOpen={isEditModalOpen}
                onClose={handleModalClose}
                agency={editingAgencyModal}
                onSave={handleModalSave}
              />
            </div>
          </div>
        );

      case 'workload':
        return (
          <div className="tab-content">
            <div className="settings-field">
              <h3>📊 Workload Dashboard Settings</h3>
              <p className="field-description">Configure settings for the real-time workload dashboard</p>
              
              <div className="setting-group" style={{marginTop: '20px'}}>
                <h4>🟢 Real-Time Sync</h4>
                <div className="setting-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.workloadSettings?.enableRealTimeSync !== false}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        workloadSettings: {
                          ...prev.workloadSettings,
                          enableRealTimeSync: e.target.checked
                        }
                      }))}
                    />
                    Enable Real-Time Sync
                  </label>
                  <span className="setting-hint">
                    Enables WebSocket connections for instant updates
                  </span>
                </div>
              </div>

              <div className="setting-group" style={{marginTop: '20px'}}>
                <h4>📁 Shared Folder Path</h4>
                <div className="setting-row">
                  <label>Data Directory:</label>
                  <div style={{display: 'flex', gap: '10px', flex: 1}}>
                    <input
                      type="text"
                      value={settings.workloadSettings?.dataDirectory || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        workloadSettings: {
                          ...prev.workloadSettings,
                          dataDirectory: e.target.value
                        }
                      }))}
                      placeholder="C:\Users\...\OneDrive\ProjectCreator\Shared"
                      style={{flex: 1}}
                    />
                    <button
                      onClick={async () => {
                        try {
                          if (window.electronAPI && window.electronAPI.selectDirectory) {
                            const result = await window.electronAPI.selectDirectory();
                            if (result) {
                              setSettings(prev => ({
                                ...prev,
                                workloadSettings: {
                                  ...prev.workloadSettings,
                                  dataDirectory: result
                                }
                              }));
                            }
                          }
                        } catch (error) {
                          console.error('Error selecting directory:', error);
                        }
                      }}
                      className="btn-secondary"
                    >
                      Browse
                    </button>
                  </div>
                  <span className="setting-hint">
                    Path to shared OneDrive folder for multi-user collaboration
                  </span>
                </div>
              </div>

              <div className="setting-group" style={{marginTop: '20px'}}>
                <h4>🔌 WebSocket Server</h4>
                <div className="setting-row">
                  <label>Server URL:</label>
                  <input
                    type="text"
                    value={settings.workloadSettings?.websocketServer || 'ws://localhost:8080'}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      workloadSettings: {
                        ...prev.workloadSettings,
                        websocketServer: e.target.value
                      }
                    }))}
                    placeholder="ws://localhost:8080"
                  />
                  <span className="setting-hint">
                    WebSocket server URL for real-time notifications
                  </span>
                </div>
                <div className="setting-row">
                  <button
                    onClick={async () => {
                      try {
                        if (window.electronAPI && window.electronAPI.websocketConnect) {
                          const serverUrl = settings.workloadSettings?.websocketServer || 'ws://localhost:8080';
                          const currentUser = JSON.parse(localStorage.getItem('workload-current-user') || '{}');
                          const result = await window.electronAPI.websocketConnect(
                            serverUrl,
                            currentUser.id || 'test-user',
                            currentUser.name || 'Test User'
                          );
                          alert(result.success ? '✅ Connected successfully!' : '❌ Connection failed');
                        } else {
                          alert('⚠️ WebSocket API not available. Make sure the app is fully loaded.');
                        }
                      } catch (error) {
                        alert('❌ Connection failed: ' + error.message);
                      }
                    }}
                    className="btn-primary"
                  >
                    Test Connection
                  </button>
                </div>
              </div>

              <div className="setting-group" style={{marginTop: '20px'}}>
                <h4>👤 User Profile</h4>
                <div className="setting-row">
                  <label>Your Name:</label>
                  <input
                    type="text"
                    value={settings.workloadSettings?.userName || ''}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      workloadSettings: {
                        ...prev.workloadSettings,
                        userName: e.target.value
                      }
                    }))}
                    placeholder="John Smith"
                  />
                </div>
                <div className="setting-row">
                  <label>Your Email:</label>
                  <input
                    type="email"
                    value={settings.workloadSettings?.userEmail || ''}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      workloadSettings: {
                        ...prev.workloadSettings,
                        userEmail: e.target.value
                      }
                    }))}
                    placeholder="john.smith@acuity.com"
                  />
                </div>
                <div className="setting-row">
                  <label>Position / Seniority:</label>
                  <select
                    value={settings.workloadSettings?.position || ''}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      workloadSettings: {
                        ...prev.workloadSettings,
                        position: e.target.value
                      }
                    }))}
                  >
                    <option value="">Select your position...</option>
                    <option value="L&T Junior Design Application Analyst">L&T Junior Design Application Analyst</option>
                    <option value="L&T Senior Design Application Analyst">L&T Senior Design Application Analyst</option>
                    <option value="Junior Design Application Analyst">Junior Design Application Analyst</option>
                    <option value="Senior Design Application Analyst">Senior Design Application Analyst</option>
                    <option value="Lead Design Application Analyst">Lead Design Application Analyst</option>
                    <option value="Manager Design Application Analyst">Manager Design Application Analyst</option>
                  </select>
                  <span className="setting-hint">
                    Your position level (used for smart project assignment)
                  </span>
                </div>
                <div className="setting-row">
                  <label>Years of Experience:</label>
                  <input
                    type="number"
                    value={settings.workloadSettings?.yearsExperience || 0}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      workloadSettings: {
                        ...prev.workloadSettings,
                        yearsExperience: parseInt(e.target.value) || 0
                      }
                    }))}
                    min="0"
                    max="50"
                  />
                  <span className="setting-hint">
                    Years of professional experience
                  </span>
                </div>
                <div className="setting-row">
                  <label>Weekly Capacity (hours):</label>
                  <input
                    type="number"
                    value={settings.workloadSettings?.weeklyCapacity || 40}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      workloadSettings: {
                        ...prev.workloadSettings,
                        weeklyCapacity: parseInt(e.target.value) || 40
                      }
                    }))}
                    min="0"
                    max="168"
                  />
                  <span className="setting-hint">
                    Your working hours per week (default: 40)
                  </span>
                </div>
              </div>

              <div className="setting-group" style={{marginTop: '20px'}}>
                <h4>🔔 Notifications</h4>
                <div className="setting-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.workloadSettings?.showNotifications !== false}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        workloadSettings: {
                          ...prev.workloadSettings,
                          showNotifications: e.target.checked
                        }
                      }))}
                    />
                    Show Notifications
                  </label>
                </div>
                <div className="setting-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.workloadSettings?.onlyMyAssignments === true}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        workloadSettings: {
                          ...prev.workloadSettings,
                          onlyMyAssignments: e.target.checked
                        }
                      }))}
                    />
                    Only Notify for My Assignments
                  </label>
                </div>
              </div>

              <div className="setting-group" style={{marginTop: '30px'}}>
                <h4>🎯 Product Knowledge</h4>
                <p className="field-description" style={{marginBottom: '15px'}}>
                  Rate your knowledge level for each product (0 = No Knowledge, 5 = Master). 
                  This helps with smart project assignment recommendations.
                </p>
                
                {(() => {
                  const PRODUCTS = [
                    'nLight Wired', 'nLight Air', 'SensorSwitch', 'SensorSwitch Air',
                    'Visual Installer', 'Visual Controls', 'Fresco', 'Pathway',
                    'Animate', 'Pharos', 'DALI', 'Atrius',
                    'Modulus', 'DC2DC', 'Envysion Graphics', 'nFloorplan Graphics',
                    'SensorView', 'BACnet'
                  ];
                  
                  const SKILL_LABELS = ['No Knowledge', 'Basic', 'Intermediate', 'Advanced', 'Expert', 'Master'];
                  const SKILL_COLORS = ['#95a5a6', '#e74c3c', '#f39c12', '#f1c40f', '#3498db', '#27ae60'];
                  
                  const getSkillColor = (level) => SKILL_COLORS[level] || SKILL_COLORS[0];
                  const getSkillLabel = (level) => SKILL_LABELS[level] || SKILL_LABELS[0];
                  
                  const handleProductKnowledgeChange = (product, value) => {
                    const level = parseInt(value);
                    setSettings(prev => ({
                      ...prev,
                      workloadSettings: {
                        ...prev.workloadSettings,
                        productKnowledge: {
                          ...(prev.workloadSettings?.productKnowledge || {}),
                          [product]: level
                        }
                      }
                    }));
                  };
                  
                  const getProductKnowledge = (product) => {
                    return settings.workloadSettings?.productKnowledge?.[product] || 0;
                  };
                  
                  return (
                    <div className="product-knowledge-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                      gap: '15px',
                      marginTop: '15px'
                    }}>
                      {PRODUCTS.map(product => {
                        const level = getProductKnowledge(product);
                        return (
                          <div key={product} className="product-skill-item" style={{
                            padding: '12px',
                            background: '#f8f9fa',
                            borderRadius: '8px',
                            border: '1px solid #dee2e6'
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '8px'
                            }}>
                              <label style={{
                                fontWeight: 500,
                                fontSize: '13px',
                                color: '#495057'
                              }}>
                                {product}
                              </label>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: getSkillColor(level),
                                color: 'white'
                              }}>
                                {level}/5
                              </span>
                            </div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px'
                            }}>
                              <input
                                type="range"
                                min="0"
                                max="5"
                                value={level}
                                onChange={(e) => handleProductKnowledgeChange(product, e.target.value)}
                                style={{
                                  flex: 1,
                                  height: '6px',
                                  borderRadius: '3px',
                                  outline: 'none',
                                  background: `linear-gradient(to right, ${getSkillColor(level)} 0%, ${getSkillColor(level)} ${(level / 5) * 100}%, #e0e0e0 ${(level / 5) * 100}%, #e0e0e0 100%)`
                                }}
                              />
                              <span style={{
                                fontSize: '11px',
                                color: '#6c757d',
                                minWidth: '80px',
                                textAlign: 'right'
                              }}>
                                {getSkillLabel(level)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="setting-group" style={{marginTop: '30px'}}>
                <h4>🔄 Data Management</h4>
                <div className="setting-row">
                  <button 
                    onClick={async () => {
                      try {
                        if (window.electronAPI && window.electronAPI.workloadBackupCreate) {
                          const result = await window.electronAPI.workloadBackupCreate();
                          if (result.success) {
                            alert('✅ Backup created successfully!\n\nPath: ' + result.backupPath);
                          } else {
                            alert('❌ Backup failed: ' + result.error);
                          }
                        } else {
                          alert('⚠️ Backup API not available. Make sure the app is fully loaded.');
                        }
                      } catch (error) {
                        alert('❌ Backup failed: ' + error.message);
                      }
                    }}
                    className="btn-secondary"
                  >
                    Create Backup
                  </button>
                  <span className="setting-hint">
                    Create a backup of all workload data
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'triage-calc':
        return (
          <div className="tab-content">
            <div className="settings-field">
              <h3>Calculation Settings</h3>
              <p className="field-description">Configure multipliers and thresholds for triage calculations</p>
              
              <div className="calculation-settings">
                <div className="setting-group">
                  <h4>LMP Multipliers (minutes)</h4>
                  <div className="setting-row">
                    <label>Small:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.lmpMultipliers.small}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          lmpMultipliers: {
                            ...prev.calculationSettings.lmpMultipliers,
                            small: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="setting-row">
                    <label>Medium:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.lmpMultipliers.medium}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          lmpMultipliers: {
                            ...prev.calculationSettings.lmpMultipliers,
                            medium: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="setting-row">
                    <label>Large:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.lmpMultipliers.large}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          lmpMultipliers: {
                            ...prev.calculationSettings.lmpMultipliers,
                            large: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                </div>
                
                <div className="setting-group">
                  <h4>ARP Multipliers (minutes)</h4>
                  <div className="setting-row">
                    <label>ARP 8:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.arpMultipliers.arp8}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          arpMultipliers: {
                            ...prev.calculationSettings.arpMultipliers,
                            arp8: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="setting-row">
                    <label>ARP 16:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.arpMultipliers.arp16}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          arpMultipliers: {
                            ...prev.calculationSettings.arpMultipliers,
                            arp16: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="setting-row">
                    <label>ARP 32:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.arpMultipliers.arp32}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          arpMultipliers: {
                            ...prev.calculationSettings.arpMultipliers,
                            arp32: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="setting-row">
                    <label>ARP 48:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.arpMultipliers.arp48}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          arpMultipliers: {
                            ...prev.calculationSettings.arpMultipliers,
                            arp48: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                </div>
                
                <div className="setting-group">
                  <h4>Room Multipliers</h4>
                  <div className="setting-row">
                    <label>Room Multiplier (min/room):</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.roomMultiplier}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          roomMultiplier: parseInt(e.target.value) || 0
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="setting-row">
                    <label>Riser Multiplier (min/room):</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.riserMultiplier}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          riserMultiplier: parseInt(e.target.value) || 0
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="setting-row">
                    <label>E-Sheets Multiplier:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.esheetsMultiplier}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          esheetsMultiplier: parseFloat(e.target.value) || 0
                        }
                      }))}
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Application Settings</h1>
        <p>Manage application configuration and form options</p>
      </div>

      {/* Tab Navigation */}
      <div className="settings-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.fullLabel}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Settings Actions */}
      <div className="settings-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            const defaultSettings = {
              rfaTypes: ['BOM (No Layout)', 'BOM with Layout', 'Controls BOM - Budget', 'Controls BOM - Layout', 'BUDGET', 'LAYOUT', 'SUBMITTAL', 'RELEASE', 'GRAPHICS', 'PHOTOMETRICS', 'Consultation'],
              regionalTeams: ['Region 1', 'Region 2', 'Region 3', 'Region 4', 'Region 5', 'NAVS'],
              nationalAccounts: ['Default', 'ARBYS', 'MCDONALDS', 'WALMART', 'TARGET', 'HOMEDEPOT', 'LOWES', 'KROGER', 'CVS', 'WALGREENS'],
              saveLocations: ['Triage', 'Desktop', 'Server'],
              complexityLevels: ['Level 1', 'Level 2', 'Level 3', 'Level 4'],
              statusOptions: ['In Progress', 'Completed', 'Inactive', 'Not Started'],
              productOptions: ['nLight Wired', 'nLight Air', 'SensorSwitch', 'Pathway', 'Fresco', 'Controls - nLight'],
              assignedToOptions: ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown', 'Cerpa, Roger'],
              calculationSettings: {
                lmpMultipliers: { small: 15, medium: 30, large: 45 },
                arpMultipliers: { arp8: 5, arp16: 10, arp32: 20, arp48: 25 },
                roomMultiplier: 2,
                riserMultiplier: 1,
                esheetsMultiplier: 2,
                defaultReviewSetup: 0.5,
                defaultSOO: 0.5,
                defaultNumOfPages: 1,
                pageBonusThreshold: 3,
                pageBonusMultiplier: 3,
                selfQCHigh: 12,
                selfQCLow: 4,
                selfQCDefault: 0.5,
                fluffPercentage: 10
              },
              pathSettings: {
                templates: {
                  primaryPath: '\\\\10.3.10.30\\DAS\\DAS References\\!!!Templates For Project Creator',
                  fallbackPath: '{userHome}\\Desktop\\1) Triage\\!!!Templates For Project Creator',
                  agentRequirementsPath: '\\\\10.3.10.30\\DAS\\Agent Requirements'
                },
                projectOutput: {
                  defaultLocation: 'desktop',
                  customPath: '{userHome}\\Desktop',
                  triagePath: '{userHome}\\Desktop\\1) Triage'
                }
              },
              sharePointSettings: {
                enabled: false,
                sharePointUrl: 'https://acuitybrandsinc.sharepoint.com/sites/CIDesignSolutions/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FCIDesignSolutions%2FShared%20Documents%2FLnT&viewid=63bcad0e%2D9263%2D49b7%2Dac03%2D91437bdc82ef',
                uploadOptions: {
                  overwriteExisting: true,
                  zipNaming: '{projectName}_{rfaNumber}_{date}.zip'
                }
              },
              oneDriveSyncSettings: {
                enabled: false,
                syncFolderPath: '',
                cleanupStrategy: 'manual', // Default to manual for safety
                keepRecentCount: 10
              }
            };
            setSettings(defaultSettings);
            // Update both services
            dropdownOptionsService.updateOptions(defaultSettings);
            triageCalculationService.updateSettings(defaultSettings);
          }}
        >
          Reset to Defaults
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={saveSettings}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

export default Settings;
