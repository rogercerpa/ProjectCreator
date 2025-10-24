import React, { useState, useEffect } from 'react';
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
        className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
          isSelected 
            ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500 shadow' 
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
        }`}
        onClick={() => handleAgencyToggle(agency.id)}
      >
        <div className="flex items-center pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => handleAgencyToggle(agency.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="font-semibold text-gray-900 dark:text-white">{agency.agencyName}</h4>
            <span className="text-sm text-gray-700 dark:text-gray-300 flex-shrink-0">{agency.contactName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-1 text-xs">
            <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
              {agency.region}
            </span>
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              {agency.role}
            </span>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {agency.contactEmail}
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
      <div key={agencyGroup.agencyName} className="mb-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Group Header */}
        <div 
          className={`p-4 cursor-pointer transition-all flex items-center gap-3 ${
            allSelected 
              ? 'bg-primary-100 dark:bg-primary-900/30 border-b-2 border-primary-500' 
              : partialSelected 
                ? 'bg-primary-50 dark:bg-primary-900/20 border-b-2 border-primary-300' 
                : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700'
          }`}
          onClick={() => handleGroupToggle(agencyGroup)}
        >
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={allSelected}
              ref={input => {
                if (input) input.indeterminate = partialSelected;
              }}
              onChange={() => handleGroupToggle(agencyGroup)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{agencyGroup.agencyName}</h3>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full font-medium">
                {agencyGroup.totalAgents} agents
              </span>
              {agencyGroup.regions.length > 0 && (
                <span className="text-gray-600 dark:text-gray-400">
                  📍 {agencyGroup.regions.join(', ')}
                </span>
              )}
              {selectedInGroup > 0 && (
                <span className="text-success-600 dark:text-success-400 font-semibold">
                  ({selectedInGroup} selected)
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Group Agents */}
        <div className="p-3 space-y-2 bg-gray-50 dark:bg-gray-900/50">
          {agencyGroup.agents.map(agent => renderAgencyListItem(agent))}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1001] p-5">
        {/* Modal Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[95%] max-w-[1600px] max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Select Agencies for Email Template</h2>
            <button 
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-all text-xl"
              onClick={onClose}
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Toolbar */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-4">
            {/* Search & Filters Row */}
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search agencies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              
              <select
                value={filters.region}
                onChange={(e) => setFilters(prev => ({...prev, region: e.target.value}))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              >
                <option value="all">All Regions</option>
                {filterOptions.regions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
              
              <select
                value={filters.role}
                onChange={(e) => setFilters(prev => ({...prev, role: e.target.value}))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              >
                <option value="all">All Roles</option>
                {filterOptions.roles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            {/* Actions Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Email Mode Selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Mode:</label>
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      emailMode === 'individual'
                        ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                    onClick={() => setEmailMode('individual')}
                    title="Send individual emails to each agent"
                  >
                    Individual
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      emailMode === 'group'
                        ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                    onClick={() => setEmailMode('group')}
                    title="Send group emails (one per agency with all agents as recipients)"
                  >
                    Group
                  </button>
                </div>
              </div>
              
              {/* Select All Button */}
              <button
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-all text-sm"
                onClick={handleSelectAll}
              >
                {selectedAgencies.size === filteredAgencies.length ? 'Deselect All' : 'Select All'}
              </button>
              
              {/* View Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 ml-auto">
                <button
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'grouped'
                      ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                  onClick={() => setViewMode('grouped')}
                >
                  Grouped
                </button>
                <button
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                  onClick={() => setViewMode('list')}
                >
                  List
                </button>
              </div>
            </div>
          </div>

          {/* Selection Summary */}
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-3">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              <span className="text-primary-600 dark:text-primary-400 font-bold">{selectedAgencies.size}</span> of {filteredAgencies.length} agencies selected
              {selectedAgencies.size > 0 && (
                <span className="text-gray-600 dark:text-gray-400 ml-2">
                  {emailMode === 'individual' 
                    ? `→ ${selectedAgencies.size} individual emails`
                    : `→ ${Object.keys(groupAgenciesByName(filteredAgencies.filter(agency => selectedAgencies.has(agency.id)))).length} group emails`
                  }
                </span>
              )}
            </span>
            {selectedTemplate && (
              <span className="text-sm text-success-600 dark:text-success-400">
                Template: <strong>{selectedTemplate.name}</strong>
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex">
            {/* Agency Selection List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {filteredAgencies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="text-6xl mb-4 opacity-50">🔍</div>
                  <p className="text-gray-600 dark:text-gray-400">No agencies found with the current filters.</p>
                </div>
              ) : viewMode === 'grouped' ? (
                <div className="space-y-4">
                  {Object.values(groupedAgencies).map(renderAgencyGroup)}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAgencies.map(renderAgencyListItem)}
                </div>
              )}
            </div>

            {/* Email Preview Panel */}
            {emailPreview.length > 0 && (
              <div className="w-96 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 overflow-y-auto custom-scrollbar">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Email Preview ({emailPreview.length} {emailMode} emails)
                </h3>
                <div className="space-y-3">
                  {emailPreview.slice(0, 3).map((preview, index) => (
                    <div key={index} className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <strong className="text-sm text-gray-900 dark:text-white">{preview.agency.agencyName}</strong>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {preview.mode === 'individual' 
                            ? preview.agency.contactEmail 
                            : `${preview.recipients?.length || 0} recipients`
                          }
                        </span>
                      </div>
                      {preview.mode === 'group' && preview.recipients && (
                        <div className="mb-2 text-xs text-gray-700 dark:text-gray-300">
                          <strong>To:</strong> {preview.recipients.slice(0, 2).join(', ')}
                          {preview.recipients.length > 2 && ` +${preview.recipients.length - 2} more`}
                        </div>
                      )}
                      <div className="mb-2 text-xs text-gray-700 dark:text-gray-300">
                        <strong>Subject:</strong> {preview.email.subject}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        {preview.email.content.substring(0, 150)}...
                      </div>
                    </div>
                  ))}
                  {emailPreview.length > 3 && (
                    <div className="text-center py-2 text-sm text-gray-600 dark:text-gray-400 font-medium">
                      +{emailPreview.length - 3} more emails...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <button 
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onClose}
              disabled={processing}
            >
              Cancel
            </button>
            
            <button 
              className="px-4 py-2 bg-info-600 hover:bg-info-700 text-white font-semibold rounded-lg shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setShowTemplateLibrary(true)}
              disabled={processing || selectedAgencies.size === 0}
            >
              {selectedTemplate ? 'Change Template' : 'Select Template'}
            </button>
            
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                ({selectedAgencies.size} {selectedAgencies.size === 1 ? 'agency' : 'agencies'} selected)
              </span>
              <button 
                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={handleSendEmails}
                disabled={processing || selectedAgencies.size === 0 || !selectedTemplate}
              >
                {processing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Opening Emails...</span>
                  </>
                ) : (
                  <>
                    <span>📧</span>
                    <span>Open in Outlook</span>
                  </>
                )}
              </button>
            </div>
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
