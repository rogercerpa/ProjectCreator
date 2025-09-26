import React, { useState, useEffect } from 'react';
import './AgencySelectionModal.css';
import EmailTemplateLibrary from './EmailTemplateLibrary';

function AgencySelectionModal({ isOpen, onClose, allAgencies = [] }) {
  const [selectedAgencies, setSelectedAgencies] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    region: 'all',
    role: 'all'
  });
  const [filteredAgencies, setFilteredAgencies] = useState([]);
  const [groupedAgencies, setGroupedAgencies] = useState({});
  const [filterOptions, setFilterOptions] = useState({
    regions: [],
    roles: []
  });
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'list'
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [emailPreview, setEmailPreview] = useState([]);
  const [emailMode, setEmailMode] = useState('individual'); // 'individual' or 'group'

  // Load filter options when component opens
  useEffect(() => {
    if (isOpen && allAgencies.length > 0) {
      loadFilterOptions();
      filterAgencies();
    }
  }, [isOpen, allAgencies, searchTerm, filters]);

  // Update grouped agencies when filtered agencies change
  useEffect(() => {
    if (viewMode === 'grouped') {
      const grouped = groupAgenciesByName(filteredAgencies);
      setGroupedAgencies(grouped);
    }
  }, [filteredAgencies, viewMode]);

  // Regenerate previews when email mode changes
  useEffect(() => {
    if (selectedTemplate && selectedAgencies.size > 0) {
      generateEmailPreviews(selectedTemplate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailMode, selectedTemplate, selectedAgencies.size]);

  const loadFilterOptions = () => {
    const regions = [...new Set(allAgencies.map(a => a.region).filter(Boolean))];
    const roles = [...new Set(allAgencies.map(a => a.role).filter(Boolean))];
    
    setFilterOptions({
      regions: regions.sort(),
      roles: roles.sort()
    });
  };

  const filterAgencies = () => {
    let filtered = allAgencies;

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(agency =>
        agency.agencyName?.toLowerCase().includes(search) ||
        agency.contactName?.toLowerCase().includes(search) ||
        agency.contactEmail?.toLowerCase().includes(search) ||
        agency.region?.toLowerCase().includes(search)
      );
    }

    // Filter by region
    if (filters.region !== 'all') {
      filtered = filtered.filter(agency => agency.region === filters.region);
    }

    // Filter by role
    if (filters.role !== 'all') {
      filtered = filtered.filter(agency => agency.role === filters.role);
    }

    // Only include agencies with valid email addresses
    filtered = filtered.filter(agency => 
      agency.contactEmail && agency.contactEmail.trim() !== ''
    );

    setFilteredAgencies(filtered);
  };

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
          hasEmailContacts: false,
          regions: new Set()
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
    });

    // Convert regions Set to Array for each group
    Object.values(grouped).forEach(group => {
      group.regions = Array.from(group.regions);
    });

    return grouped;
  };

  const handleAgencyToggle = (agencyId) => {
    const newSelected = new Set(selectedAgencies);
    if (newSelected.has(agencyId)) {
      newSelected.delete(agencyId);
    } else {
      newSelected.add(agencyId);
    }
    setSelectedAgencies(newSelected);
  };

  const handleGroupToggle = (agencyGroup) => {
    const groupAgencyIds = agencyGroup.agents.map(a => a.id);
    const newSelected = new Set(selectedAgencies);
    
    const allSelected = groupAgencyIds.every(id => newSelected.has(id));
    
    if (allSelected) {
      // Deselect all in group
      groupAgencyIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all in group
      groupAgencyIds.forEach(id => newSelected.add(id));
    }
    
    setSelectedAgencies(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedAgencies.size === filteredAgencies.length) {
      setSelectedAgencies(new Set());
    } else {
      setSelectedAgencies(new Set(filteredAgencies.map(a => a.id)));
    }
  };

  const handleTemplateSelect = async (template) => {
    setSelectedTemplate(template);
    setShowTemplateLibrary(false);
    
    // Generate email previews for selected agencies
    await generateEmailPreviews(template);
  };

  const generateEmailPreviews = async (template) => {
    console.log('=== DEBUG: generateEmailPreviews called ===');
    console.log('Template:', template);
    console.log('Email mode:', emailMode);
    console.log('Selected agencies:', selectedAgencies);
    console.log('Filtered agencies:', filteredAgencies);
    
    const selectedAgencyData = filteredAgencies.filter(agency => 
      selectedAgencies.has(agency.id)
    );

    console.log('Selected agency data:', selectedAgencyData);

    const previews = [];
    
    if (emailMode === 'individual') {
      console.log('Generating individual emails...');
      // Generate individual email for each agent
      for (const agency of selectedAgencyData) {
        try {
          console.log('Processing individual agency:', agency);
          const result = await window.electronAPI.emailTemplatesGeneratePersonalized(
            template.id, 
            agency
          );
          
          console.log('Individual email result:', result);
          
          if (result.success) {
            previews.push({
              agency: agency,
              email: result.email,
              mode: 'individual'
            });
          }
        } catch (error) {
          console.error('Error generating preview for agency:', agency.agencyName, error);
        }
      }
    } else {
      console.log('Generating group emails...');
      // Generate group emails by agency name
      const groupedByAgency = groupAgenciesByName(selectedAgencyData);
      console.log('Grouped by agency:', groupedByAgency);
      
      for (const agencyGroup of Object.values(groupedByAgency)) {
        try {
          console.log('Processing agency group:', agencyGroup);
          // Use the first agent as the template data but represent the whole group
          const primaryAgent = agencyGroup.agents[0];
          const result = await window.electronAPI.emailTemplatesGeneratePersonalized(
            template.id, 
            {
              ...primaryAgent,
              totalAgents: agencyGroup.totalAgents,
              agentList: agencyGroup.agents.map(a => a.contactName).join(', ')
            }
          );
          
          console.log('Group email result:', result);
          
          if (result.success) {
            const groupPreview = {
              agency: agencyGroup,
              email: result.email,
              mode: 'group',
              recipients: agencyGroup.agents.map(a => a.contactEmail).filter(Boolean)
            };
            console.log('Adding group preview:', groupPreview);
            previews.push(groupPreview);
          }
        } catch (error) {
          console.error('Error generating preview for agency group:', agencyGroup.agencyName, error);
        }
      }
    }
    
    console.log('Final previews:', previews);
    setEmailPreview(previews);
  };

  const handleSendEmails = async () => {
    console.log('=== DEBUG: handleSendEmails called ===');
    console.log('Selected template:', selectedTemplate);
    console.log('Email previews:', emailPreview);
    console.log('Selected agencies size:', selectedAgencies.size);
    console.log('Email mode:', emailMode);

    if (!selectedTemplate || emailPreview.length === 0) {
      console.log('ERROR: No template or no email previews');
      alert('Please select a template first.');
      return;
    }

    if (selectedAgencies.size === 0) {
      console.log('ERROR: No agencies selected');
      alert('Please select at least one agency.');
      return;
    }

    setProcessing(true);
    
    try {
      // Increment template usage count
      await window.electronAPI.emailTemplatesIncrementUsage(selectedTemplate.id);
      
      // Prepare email data based on mode
      const emailsData = emailPreview.map(preview => {
        console.log('Processing preview:', preview);
        if (preview.mode === 'individual') {
          return {
            subject: preview.email.subject,
            content: preview.email.content,
            recipient: preview.agency.contactEmail,
            agencyName: preview.agency.agencyName
          };
        } else {
          // Group mode - send to multiple recipients in one email
          return {
            subject: preview.email.subject,
            content: preview.email.content,
            recipient: preview.recipients.join(';'), // Multiple recipients separated by semicolon
            agencyName: preview.agency.agencyName
          };
        }
      });

      console.log('Prepared emails data:', emailsData);

      // Send emails using batch handler
      const result = await window.electronAPI.emailOpenOutlookBatch(emailsData);
      
      console.log('Batch email result:', result);
      
      if (result.success) {
        const modeText = emailMode === 'individual' ? 'individual' : 'group';
        alert(`${result.summary.successful} ${modeText} email windows opened successfully!`);
        onClose();
      } else {
        alert('Failed to open email windows: ' + result.error);
      }
    } catch (error) {
      console.error('Error sending emails:', error);
      alert('Error opening email windows. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const getSelectedAgencyData = () => {
    return filteredAgencies.filter(agency => selectedAgencies.has(agency.id));
  };

  const renderAgencyListItem = (agency) => {
    const isSelected = selectedAgencies.has(agency.id);
    
    return (
      <div 
        key={agency.id} 
        className={`agency-selection-item ${isSelected ? 'selected' : ''}`}
        onClick={() => handleAgencyToggle(agency.id)}
      >
        <div className="agency-checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => handleAgencyToggle(agency.id)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        
        <div className="agency-info">
          <div className="agency-main-info">
            <h4 className="agency-name">{agency.agencyName}</h4>
            <span className="contact-name">{agency.contactName}</span>
          </div>
          <div className="agency-meta">
            <span className="agency-region">{agency.region}</span>
            <span className="agency-role">{agency.role}</span>
          </div>
          <div className="agency-contact">
            <span className="contact-email">{agency.contactEmail}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderAgencyGroup = (agencyGroup) => {
    const groupAgencyIds = agencyGroup.agents.map(a => a.id);
    const selectedInGroup = groupAgencyIds.filter(id => selectedAgencies.has(id)).length;
    const allSelected = selectedInGroup === groupAgencyIds.length;
    const partialSelected = selectedInGroup > 0 && selectedInGroup < groupAgencyIds.length;
    
    return (
      <div key={agencyGroup.agencyName} className="agency-group-selection">
        <div 
          className={`agency-group-header ${allSelected ? 'selected' : ''} ${partialSelected ? 'partial' : ''}`}
          onClick={() => handleGroupToggle(agencyGroup)}
        >
          <div className="group-checkbox">
            <input
              type="checkbox"
              checked={allSelected}
              ref={input => {
                if (input) input.indeterminate = partialSelected;
              }}
              onChange={() => handleGroupToggle(agencyGroup)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="group-info">
            <h3 className="group-name">{agencyGroup.agencyName}</h3>
            <div className="group-meta">
              <span className="agent-count">{agencyGroup.totalAgents} agents</span>
              {agencyGroup.regions.length > 0 && (
                <span className="group-regions">{agencyGroup.regions.join(', ')}</span>
              )}
              {selectedInGroup > 0 && (
                <span className="selection-count">({selectedInGroup} selected)</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="agency-group-agents">
          {agencyGroup.agents.map(agent => renderAgencyListItem(agent))}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="agency-selection-modal-overlay">
        <div className="agency-selection-modal">
          <div className="modal-header">
            <h2>Select Agencies for Email Template</h2>
            <button 
              className="close-btn" 
              onClick={onClose}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="modal-toolbar">
            <div className="search-filters">
              <input
                type="text"
                placeholder="Search agencies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              
              <select
                value={filters.region}
                onChange={(e) => setFilters(prev => ({...prev, region: e.target.value}))}
                className="filter-select"
              >
                <option value="all">All Regions</option>
                {filterOptions.regions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
              
              <select
                value={filters.role}
                onChange={(e) => setFilters(prev => ({...prev, role: e.target.value}))}
                className="filter-select"
              >
                <option value="all">All Roles</option>
                {filterOptions.roles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div className="toolbar-actions">
              <div className="email-mode-selector">
                <label className="email-mode-label">Email Mode:</label>
                <div className="email-mode-toggle">
                  <button
                    className={`mode-btn ${emailMode === 'individual' ? 'active' : ''}`}
                    onClick={() => setEmailMode('individual')}
                    title="Send individual emails to each agent"
                  >
                    Individual
                  </button>
                  <button
                    className={`mode-btn ${emailMode === 'group' ? 'active' : ''}`}
                    onClick={() => setEmailMode('group')}
                    title="Send group emails (one per agency with all agents as recipients)"
                  >
                    Group
                  </button>
                </div>
              </div>
              
              <button
                className="btn btn-outline"
                onClick={handleSelectAll}
              >
                {selectedAgencies.size === filteredAgencies.length ? 'Deselect All' : 'Select All'}
              </button>
              
              <div className="view-toggle">
                <button
                  className={`view-btn ${viewMode === 'grouped' ? 'active' : ''}`}
                  onClick={() => setViewMode('grouped')}
                >
                  Grouped
                </button>
                <button
                  className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  List
                </button>
              </div>
            </div>
          </div>

          <div className="selection-summary">
            <span className="selection-count">
              {selectedAgencies.size} of {filteredAgencies.length} agencies selected
              {selectedAgencies.size > 0 && (
                <span className="email-mode-info">
                  {emailMode === 'individual' 
                    ? ` → ${selectedAgencies.size} individual emails`
                    : ` → ${Object.keys(groupAgenciesByName(filteredAgencies.filter(agency => selectedAgencies.has(agency.id)))).length} group emails`
                  }
                </span>
              )}
            </span>
            {selectedTemplate && (
              <span className="selected-template">
                Template: <strong>{selectedTemplate.name}</strong>
              </span>
            )}
          </div>

          <div className="modal-content">
            <div className="agency-selection-list">
              {filteredAgencies.length === 0 ? (
                <div className="empty-state">
                  <p>No agencies found with the current filters.</p>
                </div>
              ) : viewMode === 'grouped' ? (
                Object.values(groupedAgencies).map(renderAgencyGroup)
              ) : (
                filteredAgencies.map(renderAgencyListItem)
              )}
            </div>

            {emailPreview.length > 0 && (
              <div className="email-preview-panel">
                <h3>Email Preview ({emailPreview.length} {emailMode} emails)</h3>
                <div className="preview-list">
                  {emailPreview.slice(0, 3).map((preview, index) => (
                    <div key={index} className="preview-item">
                      <div className="preview-header">
                        <strong>{preview.agency.agencyName}</strong>
                        <span className="preview-email">
                          {preview.mode === 'individual' 
                            ? preview.agency.contactEmail 
                            : `${preview.recipients?.length || 0} recipients`
                          }
                        </span>
                      </div>
                      {preview.mode === 'group' && preview.recipients && (
                        <div className="preview-recipients">
                          <strong>To:</strong> {preview.recipients.slice(0, 2).join(', ')}
                          {preview.recipients.length > 2 && ` +${preview.recipients.length - 2} more`}
                        </div>
                      )}
                      <div className="preview-subject">
                        <strong>Subject:</strong> {preview.email.subject}
                      </div>
                      <div className="preview-content">
                        {preview.email.content.substring(0, 150)}...
                      </div>
                    </div>
                  ))}
                  {emailPreview.length > 3 && (
                    <div className="preview-more">
                      +{emailPreview.length - 3} more emails...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={processing}
            >
              Cancel
            </button>
            
            <button 
              className="btn btn-outline" 
              onClick={() => setShowTemplateLibrary(true)}
              disabled={processing || selectedAgencies.size === 0}
            >
              {selectedTemplate ? 'Change Template' : 'Select Template'}
            </button>
            
            <button 
              className="btn btn-primary" 
              onClick={handleSendEmails}
              disabled={processing || selectedAgencies.size === 0 || !selectedTemplate}
            >
              {processing ? 'Opening Emails...' : `Send to ${selectedAgencies.size} Agencies`}
            </button>
          </div>
        </div>
      </div>

      {showTemplateLibrary && (
        <EmailTemplateLibrary
          isOpen={showTemplateLibrary}
          onClose={() => setShowTemplateLibrary(false)}
          onSelectTemplate={handleTemplateSelect}
        />
      )}
    </>
  );
}

export default AgencySelectionModal;
