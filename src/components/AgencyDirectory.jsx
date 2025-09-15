import React, { useState, useEffect, useCallback } from 'react';
import './AgencyDirectory.css';

function AgencyDirectory() {
  const [agencies, setAgencies] = useState([]);
  const [filteredAgencies, setFilteredAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    region: 'all',
    role: 'all',
    fastService: 'all',
    sae: 'all'
  });
  const [filterOptions, setFilterOptions] = useState({
    regions: [],
    roles: [],
    fastServiceOptions: [],
    saeOptions: []
  });
  const [statistics, setStatistics] = useState(null);
  const [selectedAgency, setSelectedAgency] = useState(null);

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
          roles: [],
          fastServiceOptions: [],
          saeOptions: []
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

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      region: 'all',
      role: 'all',
      fastService: 'all',
      sae: 'all'
    });
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

  // Render agency details modal
  const renderAgencyModal = () => {
    if (!selectedAgency) return null;

    return (
      <div className="modal-overlay" onClick={() => setSelectedAgency(null)}>
        <div className="agency-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{selectedAgency.agencyName}</h2>
            <button 
              className="close-btn"
              onClick={() => setSelectedAgency(null)}
            >
              ✕
            </button>
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

          <select
            value={filters.fastService}
            onChange={e => handleFilterChange('fastService', e.target.value)}
            className="filter-select"
          >
            <option value="all">Fast Service</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>

          <select
            value={filters.sae}
            onChange={e => handleFilterChange('sae', e.target.value)}
            className="filter-select"
          >
            <option value="all">SAE</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
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
          <span className="results-count">
            {filteredAgencies.length} {filteredAgencies.length === 1 ? 'agency' : 'agencies'} found
          </span>
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
          <div className="agencies-grid">
            {filteredAgencies.map(renderAgencyCard)}
          </div>
        )}
      </div>

      {/* Modals */}
      {renderAgencyModal()}
    </div>
  );
}

export default AgencyDirectory;
