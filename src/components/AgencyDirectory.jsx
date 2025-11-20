import React, { useState, useEffect, useCallback } from 'react';
import AgencyTableView from './AgencyTableView';
import AgencySelectionModal from './AgencySelectionModal';
import EmailTemplateLibrary from './EmailTemplateLibrary';

function AgencyDirectory() {
  const [agencies, setAgencies] = useState([]);
  const [filteredAgencies, setFilteredAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    region: 'all',
    role: 'all'
  });
  const [filterOptions, setFilterOptions] = useState({
    regions: [],
    roles: []
  });
  const [statistics, setStatistics] = useState(null);
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    // Load saved view mode from localStorage, default to 'table'
    const savedViewMode = localStorage.getItem('agencyDirectoryViewMode');
    return savedViewMode || 'table';
  });
  const [expandedAgencies, setExpandedAgencies] = useState(new Set());
  const [groupedAgencies, setGroupedAgencies] = useState({});
  
  // Email template functionality
  const [showAgencySelection, setShowAgencySelection] = useState(false);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);

  // Load agencies and filter options
  const loadAgencies = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.agenciesLoadAll();
      if (result && result.success) {
        setAgencies(result.agencies || []);
        setFilteredAgencies(result.agencies || []);
      } else {
        console.warn('Failed to load agencies:', result?.error);
        setAgencies([]);
        setFilteredAgencies([]);
      }
    } catch (error) {
      console.error('Error loading agencies:', error);
      setAgencies([]);
      setFilteredAgencies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load filter options
  const loadFilterOptions = useCallback(async () => {
    try {
      const result = await window.electronAPI.agenciesGetFilterOptions();
      if (result && result.success) {
        setFilterOptions(result.options || {
          regions: [],
          roles: []
        });
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  }, []);

  // Load statistics
  const loadStatistics = useCallback(async () => {
    try {
      const result = await window.electronAPI.agenciesGetStatistics();
      if (result && result.success) {
        setStatistics(result.statistics);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadAgencies();
    loadFilterOptions();
    loadStatistics();
  }, [loadAgencies, loadFilterOptions, loadStatistics]);

  // Search and filter agencies
  const searchAgencies = useCallback(async () => {
    try {
      const result = await window.electronAPI.agenciesSearch(searchTerm, filters);
      if (result && result.success) {
        setFilteredAgencies(result.agencies || []);
      }
    } catch (error) {
      console.error('Error searching agencies:', error);
      setFilteredAgencies([]);
    }
  }, [searchTerm, filters]);

  // Apply search when search term or filters change
  useEffect(() => {
    searchAgencies();
  }, [searchAgencies]);

  // Update grouped agencies whenever filtered agencies change
  useEffect(() => {
    try {
      const grouped = groupAgenciesByName(filteredAgencies);
      setGroupedAgencies(grouped);
    } catch (error) {
      console.error('Error grouping agencies:', error);
      setGroupedAgencies({});
    }
  }, [filteredAgencies]);

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Handle view mode changes
  const handleViewModeChange = (newViewMode) => {
    setViewMode(newViewMode);
    localStorage.setItem('agencyDirectoryViewMode', newViewMode);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      region: 'all',
      role: 'all'
    });
  };

  // Group agencies by agency name
  const groupAgenciesByName = (agencies) => {
    const grouped = {};
    
    agencies.forEach(agency => {
      const agencyName = agency.agencyName || 'Unknown Agency';
      
      if (!grouped[agencyName]) {
        grouped[agencyName] = {
          agencyName,
          agencyNumber: agency.agencyNumber,
          region: agency.region,
          totalAgents: 0,
          agents: [],
          // Aggregate info for the group
          hasEmailContacts: false,
          regions: new Set(),
          roles: new Set()
        };
      }
      
      grouped[agencyName].agents.push(agency);
      grouped[agencyName].totalAgents++;
      
      if (agency.contactEmail) {
        grouped[agencyName].hasEmailContacts = true;
      }
      
      if (agency.region) {
        grouped[agencyName].regions.add(agency.region);
      }
      
      if (agency.role) {
        grouped[agencyName].roles.add(agency.role);
      }
    });
    
    // Convert Sets to Arrays for easier use
    Object.values(grouped).forEach(group => {
      group.regions = Array.from(group.regions);
      group.roles = Array.from(group.roles);
    });
    
    return grouped;
  };

  // Toggle agency expansion
  const toggleAgencyExpansion = (agencyName) => {
    setExpandedAgencies(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(agencyName)) {
        newExpanded.delete(agencyName);
      } else {
        newExpanded.add(agencyName);
      }
      return newExpanded;
    });
  };

  // Handle agency group email
  const handleAgencyGroupEmail = async (agencyGroup) => {
    const emails = agencyGroup.agents
      .map(agent => agent.contactEmail)
      .filter(email => email && email.trim() !== '');
    
    const subject = `${agencyGroup.agencyName} - Contact (${emails.length} ${emails.length === 1 ? 'Contact' : 'Contacts'})`;
    await openOutlookWithEmails(emails, subject);
  };

  // Email utility functions
  const openOutlookWithEmails = async (emails, subject = '') => {
    if (!emails || emails.length === 0) {
      alert('No email addresses found to send to.');
      return;
    }

    // Filter out empty/invalid emails
    const validEmails = emails.filter(email => email && email.includes('@'));
    
    if (validEmails.length === 0) {
      alert('No valid email addresses found to send to.');
      return;
    }

    // Create mailto URL
    const emailList = validEmails.join(';'); // Use semicolon for Outlook compatibility
    const encodedSubject = encodeURIComponent(subject);
    const mailtoUrl = `mailto:${emailList}?subject=${encodedSubject}`;
    
    try {
      // Use Electron API to open in default email client (Outlook if configured)
      await window.electronAPI.openExternal(mailtoUrl);
    } catch (error) {
      console.error('Error opening email client:', error);
      alert('Failed to open email client. Please check your default email application.');
    }
  };

  // Handle bulk email for all filtered results
  const handleBulkEmail = async () => {
    const emails = filteredAgencies
      .map(agency => agency.contactEmail)
      .filter(email => email && email.trim() !== '');
    
    const subject = `Agency Contact - ${filteredAgencies.length} ${filteredAgencies.length === 1 ? 'Agency' : 'Agencies'}`;
    await openOutlookWithEmails(emails, subject);
  };

  // Handle individual email
  const handleIndividualEmail = async (agency) => {
    if (!agency.contactEmail) {
      alert('No email address available for this agency.');
      return;
    }
    
    const subject = `Contact: ${agency.agencyName}`;
    await openOutlookWithEmails([agency.contactEmail], subject);
  };

  // Handle email template workflow
  const handleEmailTemplate = () => {
    setShowAgencySelection(true);
  };

  // Handle manage templates
  const handleManageTemplates = () => {
    setShowTemplateLibrary(true);
  };


  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Render agency card
  const renderAgencyCard = (agency) => (
    <div 
      key={agency.id} 
      className="p-5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-md hover:shadow-xl hover:border-primary-400 dark:hover:border-primary-600 transition-all cursor-pointer group"
      onClick={() => setSelectedAgency(agency)}
    >
      {/* Header */}
      <div className="mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {agency.agencyName}
        </h3>
        <div className="flex flex-wrap gap-2">
          {agency.region && (
            <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-medium">
              📍 {agency.region}
            </span>
          )}
          {agency.fastService === 'Yes' && (
            <span className="px-2 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 rounded text-xs font-medium">
              ⚡ Fast Service
            </span>
          )}
          {agency.sae === 'Yes' && (
            <span className="px-2 py-1 bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300 rounded text-xs font-medium">
              ✓ SAE
            </span>
          )}
        </div>
      </div>
      
      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-start">
          <span className="text-gray-600 dark:text-gray-400 font-medium min-w-[100px]">Contact:</span>
          <span className="text-gray-900 dark:text-white font-semibold text-right">{agency.contactName}</span>
        </div>
        <div className="flex justify-between items-start">
          <span className="text-gray-600 dark:text-gray-400 font-medium min-w-[100px]">Role:</span>
          <span className="text-gray-900 dark:text-white text-right">{agency.role}</span>
        </div>
        {agency.mainContact && (
          <div className="flex justify-between items-start">
            <span className="text-gray-600 dark:text-gray-400 font-medium min-w-[100px]">Main Contact:</span>
            <span className="text-gray-900 dark:text-white text-right">{agency.mainContact}</span>
          </div>
        )}
        <div className="flex justify-between items-start">
          <span className="text-gray-600 dark:text-gray-400 font-medium min-w-[100px]">Phone:</span>
          <a href={`tel:${agency.phoneNumber}`} className="text-primary-600 dark:text-primary-400 hover:underline font-medium text-right">
            {formatPhoneNumber(agency.phoneNumber)}
          </a>
        </div>
        <div className="flex justify-between items-start">
          <span className="text-gray-600 dark:text-gray-400 font-medium min-w-[100px]">Email:</span>
          <a href={`mailto:${agency.contactEmail}`} className="text-primary-600 dark:text-primary-400 hover:underline text-xs text-right break-all">
            {agency.contactEmail}
          </a>
        </div>
      </div>
    </div>
  );

  // Render individual agent within a group
  const renderAgentCard = (agent) => (
    <div 
      key={agent.id} 
      className="p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-700 hover:shadow-md transition-all cursor-pointer"
      onClick={() => setSelectedAgency(agent)}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Agent Info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white mb-1">{agent.contactName}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{agent.role}</div>
          {agent.mainContact && (
            <div className="text-xs text-gray-500 dark:text-gray-500 mb-2">Main: {agent.mainContact}</div>
          )}
          
          {/* Contact Info */}
          <div className="space-y-1">
            {agent.phoneNumber && (
              <a 
                href={`tel:${agent.phoneNumber}`} 
                className="block text-xs text-primary-600 dark:text-primary-400 hover:underline" 
                onClick={(e) => e.stopPropagation()}
              >
                📞 {formatPhoneNumber(agent.phoneNumber)}
              </a>
            )}
            {agent.contactEmail && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1" title={agent.contactEmail}>
                  {agent.contactEmail}
                </span>
                <button
                  className="px-2 py-1 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white rounded text-xs transition-all flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleIndividualEmail(agent);
                  }}
                  title={`Email ${agent.contactName}`}
                >
                  ✉️
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render agency group with expandable agents
  const renderAgencyGroup = (agencyGroup) => {
    if (!agencyGroup || !agencyGroup.agencyName) {
      return null;
    }
    
    const isExpanded = expandedAgencies.has(agencyGroup.agencyName);
    
    return (
      <div key={agencyGroup.agencyName} className="mb-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-md overflow-hidden">
        {/* Group Header */}
        <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              {/* Expand/Collapse Button */}
              <button
                className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg text-xl transition-all"
                onClick={() => toggleAgencyExpansion(agencyGroup.agencyName)}
                title={isExpanded ? 'Collapse agency' : 'Expand agency'}
              >
                {isExpanded ? '📂' : '📁'}
              </button>
              
              {/* Agency Info */}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  {agencyGroup.agencyName}
                </h3>
                <div className="flex items-center gap-3 text-sm">
                  <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded font-medium">
                    {agencyGroup.totalAgents} {agencyGroup.totalAgents === 1 ? 'Agent' : 'Agents'}
                  </span>
                  {agencyGroup.regions.length > 0 && (
                    <span className="text-gray-600 dark:text-gray-400">
                      📍 {agencyGroup.regions.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Actions */}
            {agencyGroup.hasEmailContacts && (
              <button
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg shadow transition-all flex items-center gap-2"
                onClick={() => handleAgencyGroupEmail(agencyGroup)}
                title={`Email all ${agencyGroup.totalAgents} contacts in ${agencyGroup.agencyName}`}
              >
                <span>✉️</span>
                <span>Email All ({agencyGroup.totalAgents})</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Agent Cards */}
        {isExpanded && (
          <div className="p-4 space-y-2 bg-gray-50 dark:bg-gray-800/50">
            {(agencyGroup.agents || []).map(renderAgentCard)}
          </div>
        )}
      </div>
    );
  };

  // Render agency details modal
  const renderAgencyModal = () => {
    if (!selectedAgency) return null;

    const infoRow = (label, value, options = {}) => {
      if (!value && value !== 0) return null;

      const { isLink = false, href = '', accent = false } = options;

      return (
        <div className="flex items-start justify-between gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {label}
          </span>
          {isLink ? (
            <a
              href={href}
              className="text-sm font-semibold text-primary-600 dark:text-primary-300 hover:underline break-all text-right"
            >
              {value}
            </a>
          ) : (
            <span
              className={`text-sm font-semibold text-right ${
                accent ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              {value}
            </span>
          )}
        </div>
      );
    };

    const statusPill = (label, isPositive) => (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isPositive
            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
        }`}
      >
        {label}
      </span>
    );

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
        onClick={() => setSelectedAgency(null)}
      >
        <div
          className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-primary-600 via-secondary-600 to-secondary-400 text-white p-6 pb-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-white/70 mb-1">Agency</p>
                <h2 className="text-2xl font-bold">{selectedAgency.agencyName}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/80">
                  {selectedAgency.region && (
                    <span className="inline-flex items-center gap-1">
                      📍 <span>{selectedAgency.region}</span>
                    </span>
                  )}
                  {selectedAgency.agencyNumber && (
                    <span className="inline-flex items-center gap-1">
                      🆔 <span>#{selectedAgency.agencyNumber}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {selectedAgency.contactEmail && (
                  <button
                    onClick={() => handleIndividualEmail(selectedAgency)}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/30"
                    title={`Email ${selectedAgency.contactName || 'contact'}`}
                  >
                    ✉️ Email Contact
                  </button>
                )}
                <button
                  className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                  onClick={() => setSelectedAgency(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {selectedAgency.fastService && statusPill(`Fast Service: ${selectedAgency.fastService}`, selectedAgency.fastService === 'Yes')}
              {selectedAgency.sae && statusPill(`SAE: ${selectedAgency.sae}`, selectedAgency.sae === 'Yes')}
              {selectedAgency.mainContact === 'Yes' && statusPill('Main Contact', true)}
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/60">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
                  Contact Information
                </h3>
                <div className="space-y-4">
                  {infoRow('Contact Name', selectedAgency.contactName, { accent: true })}
                  {infoRow('Role', selectedAgency.role)}
                  {infoRow('Phone', formatPhoneNumber(selectedAgency.phoneNumber), {
                    isLink: Boolean(selectedAgency.phoneNumber),
                    href: `tel:${selectedAgency.phoneNumber}`
                  })}
                  {infoRow('Email', selectedAgency.contactEmail, {
                    isLink: Boolean(selectedAgency.contactEmail),
                    href: `mailto:${selectedAgency.contactEmail}`
                  })}
                  {infoRow('Main Contact', selectedAgency.mainContact)}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/60">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
                  Agency Details
                </h3>
                <div className="space-y-4">
                  {infoRow('Agency Number', selectedAgency.agencyNumber)}
                  {infoRow('Region', selectedAgency.region)}
                  {infoRow('RGP ID', selectedAgency.rgpId)}
                  {infoRow('Fast Service', selectedAgency.fastService)}
                  {infoRow('SAE', selectedAgency.sae)}
                  {infoRow('Text Service Start', selectedAgency.textServiceStartDate)}
                </div>
              </div>
            </div>

            {(selectedAgency.notes || selectedAgency.specialInstructions) && (
              <div className="rounded-2xl border border-primary-100 bg-primary-50/60 p-5 dark:border-primary-900/40 dark:bg-primary-900/10">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300 mb-3">
                  Additional Details
                </h3>
                {selectedAgency.notes && (
                  <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                    {selectedAgency.notes}
                  </p>
                )}
                {selectedAgency.specialInstructions && (
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    <strong>Instructions:</strong> {selectedAgency.specialInstructions}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };


  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading agency directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 p-6 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Agency Directory</h1>
              <p className="text-gray-600 dark:text-gray-400">Search and find agency contact information</p>
            </div>
            
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
              <p className="text-blue-700 dark:text-blue-300">
                💡 To add agencies, go to <strong>Settings → Agencies</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-all">
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{statistics.totalAgencies}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Agencies</div>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-all">
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{Object.keys(statistics.byRegion).length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Regions</div>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-all">
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{Object.keys(statistics.byRole).length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Roles</div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search agencies, contacts, emails, phone numbers..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
            {searchTerm && (
              <button 
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                onClick={() => setSearchTerm('')}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex gap-3">
            <select
              value={filters.region}
              onChange={e => handleFilterChange('region', e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Regions</option>
              {filterOptions.regions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>

            <select
              value={filters.role}
              onChange={e => handleFilterChange('role', e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Roles</option>
              {filterOptions.roles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>

            <button 
              className="px-5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* Email Template Button */}
            <button
              onClick={handleEmailTemplate}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg shadow transition-all flex items-center gap-2"
              title="Create personalized emails using templates"
            >
              <span>📧</span>
              <span>Email Template</span>
            </button>
            
            {/* Manage Templates Button */}
            <button
              onClick={handleManageTemplates}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg shadow transition-all flex items-center gap-2"
              title="Manage email templates"
            >
              <span>📋</span>
              <span>Manage Template</span>
            </button>
          </div>
            
          {/* View Mode Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View:</span>
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1">
              <button
                onClick={() => handleViewModeChange('card')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'card'
                    ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title="Card View"
              >
                <span>🎴</span>
                <span>Card</span>
              </button>
              <button
                onClick={() => handleViewModeChange('table')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title="Table View"
              >
                <span>📋</span>
                <span>Table</span>
              </button>
              <button
                onClick={() => handleViewModeChange('grouped')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'grouped'
                    ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title="Grouped by Agency"
              >
                <span>🏢</span>
                <span>Grouped</span>
              </button>
            </div>
          </div>
        </div>
        </div>

        {filteredAgencies.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No agencies found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-2">Try adjusting your search criteria or import agency data.</p>
            {agencies.length === 0 && (
              <p className="text-gray-600 dark:text-gray-400">Go to <strong>Settings → Agencies</strong> to import or add agency data.</p>
            )}
          </div>
        ) : (
          <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 400px)' }}>
            {viewMode === 'table' ? (
              <AgencyTableView
                agencies={filteredAgencies}
                onAgencySelect={setSelectedAgency}
              />
            ) : viewMode === 'grouped' ? (
              <div className="space-y-4 p-1">
                {Object.values(groupedAgencies || {})
                  .filter(group => group && group.agencyName)
                  .sort((a, b) => a.agencyName.localeCompare(b.agencyName))
                  .map(renderAgencyGroup)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
                {filteredAgencies.map(renderAgencyCard)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {renderAgencyModal()}
      
      {/* Email Template Modals */}
      {showAgencySelection && (
        <AgencySelectionModal
          isOpen={showAgencySelection}
          onClose={() => setShowAgencySelection(false)}
          allAgencies={agencies}
        />
      )}
      
      {showTemplateLibrary && (
        <EmailTemplateLibrary
          isOpen={showTemplateLibrary}
          onClose={() => setShowTemplateLibrary(false)}
        />
      )}
    </div>
  );
}

export default AgencyDirectory;
