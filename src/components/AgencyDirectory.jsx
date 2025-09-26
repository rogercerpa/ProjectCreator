import React, { useState, useEffect, useCallback } from 'react';
import './AgencyDirectory.css';
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
    <div key={agency.id} className="agency-card" onClick={() => setSelectedAgency(agency)}>
      <div className="agency-card-header">
        <h3 className="agency-name">{agency.agencyName}</h3>
        <div className="agency-badges">
          {agency.region && (
            <span className={`badge region-badge region-${agency.region?.toLowerCase().replace(/\s+/g, '-')}`}>
              {agency.region}
            </span>
          )}
          {agency.fastService === 'Yes' && (
            <span className="badge fast-service-badge">⚡ Fast Service</span>
          )}
          {agency.sae === 'Yes' && (
            <span className="badge sae-badge">SAE</span>
          )}
        </div>
      </div>
      
      <div className="agency-details">
        <div className="detail-row">
          <span className="detail-label">Contact:</span>
          <span className="detail-value">{agency.contactName}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Role:</span>
          <span className="detail-value">{agency.role}</span>
        </div>
        {agency.mainContact && (
          <div className="detail-row">
            <span className="detail-label">Main Contact:</span>
            <span className="detail-value">{agency.mainContact}</span>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-label">Phone:</span>
          <span className="detail-value">{formatPhoneNumber(agency.phoneNumber)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Email:</span>
          <span className="detail-value agency-email">{agency.contactEmail}</span>
        </div>
      </div>
    </div>
  );

  // Render individual agent within a group
  const renderAgentCard = (agent) => (
    <div key={agent.id} className="agent-card" onClick={() => setSelectedAgency(agent)}>
      <div className="agent-info">
        <div className="agent-name">{agent.contactName}</div>
        <div className="agent-role">{agent.role}</div>
        {agent.mainContact && (
          <div className="agent-main-contact">Main: {agent.mainContact}</div>
        )}
      </div>
      
      <div className="agent-contact">
        <div className="agent-phone">
          {agent.phoneNumber && (
            <a href={`tel:${agent.phoneNumber}`} onClick={(e) => e.stopPropagation()}>
              {formatPhoneNumber(agent.phoneNumber)}
            </a>
          )}
        </div>
        <div className="agent-email">
          {agent.contactEmail && (
            <div className="agent-email-container">
              <span className="email-text">{agent.contactEmail}</span>
              <button
                className="btn btn-sm email-agent-btn"
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
  );

  // Render agency group with expandable agents
  const renderAgencyGroup = (agencyGroup) => {
    if (!agencyGroup || !agencyGroup.agencyName) {
      return null;
    }
    
    const isExpanded = expandedAgencies.has(agencyGroup.agencyName);
    
    return (
      <div key={agencyGroup.agencyName} className="agency-group">
        <div className="agency-group-header">
          <div className="agency-group-info">
            <button
              className="expand-toggle"
              onClick={() => toggleAgencyExpansion(agencyGroup.agencyName)}
              title={isExpanded ? 'Collapse agency' : 'Expand agency'}
            >
              {isExpanded ? '📂' : '📁'}
            </button>
            
            <div className="agency-group-details">
              <h3 className="agency-group-name">{agencyGroup.agencyName}</h3>
              <div className="agency-group-meta">
                <span className="agent-count">
                  {agencyGroup.totalAgents} {agencyGroup.totalAgents === 1 ? 'Agent' : 'Agents'}
                </span>
                {agencyGroup.regions.length > 0 && (
                  <span className="agency-regions">
                    {agencyGroup.regions.join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="agency-group-actions">
            {agencyGroup.hasEmailContacts && (
              <button
                className="btn btn-sm email-agency-group-btn"
                onClick={() => handleAgencyGroupEmail(agencyGroup)}
                title={`Email all ${agencyGroup.totalAgents} contacts in ${agencyGroup.agencyName}`}
              >
                <span className="btn-icon">✉️</span>
                <span className="btn-text">Email All ({agencyGroup.totalAgents})</span>
              </button>
            )}
          </div>
        </div>
        
        {isExpanded && (
          <div className="agency-agents">
            {(agencyGroup.agents || []).map(renderAgentCard)}
          </div>
        )}
      </div>
    );
  };

  // Render agency details modal
  const renderAgencyModal = () => {
    if (!selectedAgency) return null;

    return (
      <div className="modal-overlay" onClick={() => setSelectedAgency(null)}>
        <div className="agency-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{selectedAgency.agencyName}</h2>
            <div className="modal-header-actions">
              {selectedAgency.contactEmail && (
                <button
                  onClick={() => handleIndividualEmail(selectedAgency)}
                  className="btn btn-primary email-contact-btn"
                  title={`Email ${selectedAgency.contactName}`}
                >
                  <span className="btn-icon">✉️</span>
                  <span className="btn-text">Email Contact</span>
                </button>
              )}
              <button 
                className="close-btn"
                onClick={() => setSelectedAgency(null)}
              >
                ✕
              </button>
            </div>
          </div>
          
          <div className="modal-content">
            <div className="agency-info-grid">
              <div className="info-section">
                <h3>Contact Information</h3>
                <div className="info-item">
                  <label>Contact Name:</label>
                  <span>{selectedAgency.contactName}</span>
                </div>
                <div className="info-item">
                  <label>Email:</label>
                  <span>
                    <a href={`mailto:${selectedAgency.contactEmail}`}>
                      {selectedAgency.contactEmail}
                    </a>
                  </span>
                </div>
                <div className="info-item">
                  <label>Phone:</label>
                  <span>
                    <a href={`tel:${selectedAgency.phoneNumber}`}>
                      {formatPhoneNumber(selectedAgency.phoneNumber)}
                    </a>
                  </span>
                </div>
                <div className="info-item">
                  <label>Role:</label>
                  <span>{selectedAgency.role}</span>
                </div>
                {selectedAgency.mainContact && (
                  <div className="info-item">
                    <label>Main Contact:</label>
                    <span>{selectedAgency.mainContact}</span>
                  </div>
                )}
              </div>
              
              <div className="info-section">
                <h3>Agency Details</h3>
                <div className="info-item">
                  <label>Agency Number:</label>
                  <span>{selectedAgency.agencyNumber}</span>
                </div>
                <div className="info-item">
                  <label>Region:</label>
                  <span>{selectedAgency.region}</span>
                </div>
                <div className="info-item">
                  <label>RGP ID:</label>
                  <span>{selectedAgency.rgpId}</span>
                </div>
                <div className="info-item">
                  <label>Fast Service:</label>
                  <span className={selectedAgency.fastService === 'Yes' ? 'service-yes' : 'service-no'}>
                    {selectedAgency.fastService}
                  </span>
                </div>
                <div className="info-item">
                  <label>SAE:</label>
                  <span className={selectedAgency.sae === 'Yes' ? 'service-yes' : 'service-no'}>
                    {selectedAgency.sae}
                  </span>
                </div>
                {selectedAgency.textServiceStartDate && (
                  <div className="info-item">
                    <label>Text Service Start:</label>
                    <span>{selectedAgency.textServiceStartDate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  if (loading) {
    return (
      <div className="agency-directory-loading">
        <div className="spinner"></div>
        <p>Loading agency directory...</p>
      </div>
    );
  }

  return (
    <div className="agency-directory">
      <div className="agency-directory-header">
        <div className="header-title">
          <h1>Agency Directory</h1>
          <p>Search and find agency contact information</p>
        </div>
        
        <div className="header-actions">
          <p className="import-note">
            💡 To add agencies, go to <strong>Settings → Agencies</strong>
          </p>
        </div>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="agency-stats">
          <div className="stat-card">
            <span className="stat-number">{statistics.totalAgencies}</span>
            <span className="stat-label">Total Agencies</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{Object.keys(statistics.byRegion).length}</span>
            <span className="stat-label">Regions</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{Object.keys(statistics.byRole).length}</span>
            <span className="stat-label">Roles</span>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="search-filters-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search agencies, contacts, emails, phone numbers..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button 
            className="clear-search-btn"
            onClick={() => setSearchTerm('')}
            title="Clear search"
          >
            ✕
          </button>
        </div>

        <div className="filters-row">
          <select
            value={filters.region}
            onChange={e => handleFilterChange('region', e.target.value)}
            className="filter-select"
          >
            <option value="all">All Regions</option>
            {filterOptions.regions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>

          <select
            value={filters.role}
            onChange={e => handleFilterChange('role', e.target.value)}
            className="filter-select"
          >
            <option value="all">All Roles</option>
            {filterOptions.roles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>

          <button 
            className="btn btn-secondary clear-filters-btn"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="results-section">
        <div className="results-header">
          <div className="results-actions">
            {/* Email Template Button */}
            <button
              onClick={handleEmailTemplate}
              className="btn btn-primary email-template-btn"
              title="Create personalized emails using templates"
            >
              <span className="btn-icon">📧</span>
              <span className="btn-text">Email Template</span>
            </button>
            
            {/* Manage Templates Button */}
            <button
              onClick={handleManageTemplates}
              className="btn btn-primary manage-templates-btn"
              title="Manage email templates"
            >
              <span className="btn-icon">📋</span>
              <span className="btn-text">Manage Template</span>
            </button>
            
            {/* View Mode Toggle */}
            <div className="view-mode-toggle">
              <span className="control-label">View:</span>
              <div className="toggle-group">
                <button
                  onClick={() => handleViewModeChange('card')}
                  className={`toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
                  title="Card View"
                >
                  <span className="toggle-icon">🎴</span>
                  <span className="toggle-text">Card</span>
                </button>
                <button
                  onClick={() => handleViewModeChange('table')}
                  className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                  title="Table View"
                >
                  <span className="toggle-icon">📋</span>
                  <span className="toggle-text">Table</span>
                </button>
                <button
                  onClick={() => handleViewModeChange('grouped')}
                  className={`toggle-btn ${viewMode === 'grouped' ? 'active' : ''}`}
                  title="Grouped by Agency"
                >
                  <span className="toggle-icon">🏢</span>
                  <span className="toggle-text">Grouped</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {filteredAgencies.length === 0 ? (
          <div className="no-results">
            <div className="no-results-icon">🔍</div>
            <h3>No agencies found</h3>
            <p>Try adjusting your search criteria or import agency data.</p>
            {agencies.length === 0 && (
              <p>Go to <strong>Settings → Agencies</strong> to import or add agency data.</p>
            )}
          </div>
        ) : (
          <div className={`agency-content ${viewMode}-view`}>
            {viewMode === 'table' ? (
              <AgencyTableView
                agencies={filteredAgencies}
                onAgencySelect={setSelectedAgency}
              />
            ) : viewMode === 'grouped' ? (
              <div className="agencies-grouped">
                {Object.values(groupedAgencies || {})
                  .filter(group => group && group.agencyName)
                  .sort((a, b) => a.agencyName.localeCompare(b.agencyName))
                  .map(renderAgencyGroup)}
              </div>
            ) : (
              <div className="agencies-grid">
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
