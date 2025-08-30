import React, { useState } from 'react';
import './ProjectList.css';

function ProjectList({ projects, onProjectSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const filteredProjects = projects.filter(project =>
    project.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.rfaNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.agentNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];

    // Handle date sorting
    if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }

    // Handle numeric sorting
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // Handle string sorting
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    // Handle date sorting
    if (aValue instanceof Date && bValue instanceof Date) {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (project) => {
    if (project.triageResults?.totalTriage > 100) return 'high';
    if (project.triageResults?.totalTriage > 50) return 'medium';
    return 'low';
  };

  if (projects.length === 0) {
    return (
      <div className="project-list-empty">
        <div className="empty-icon">📁</div>
        <h3>No Projects Yet</h3>
        <p>Create your first project to get started</p>
      </div>
    );
  }

  return (
    <div className="project-list">
      <div className="list-header">
        <h2>Project List</h2>
        <p>{filteredProjects.length} of {projects.length} projects</p>
      </div>

      <div className="list-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="sort-controls">
          <label htmlFor="sortBy">Sort by:</label>
          <select
            id="sortBy"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="createdAt">Created Date</option>
            <option value="updatedAt">Updated Date</option>
            <option value="projectName">Project Name</option>
            <option value="rfaNumber">RFA Number</option>
            <option value="agentNumber">Agent Number</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="sort-order-btn"
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div className="projects-grid">
        {sortedProjects.map((project) => (
          <div
            key={project.id}
            className={`project-card ${getStatusColor(project)}`}
            onClick={() => onProjectSelect(project)}
          >
            <div className="project-header">
              <h3 className="project-name">{project.projectName}</h3>
              <span className={`status-badge ${getStatusColor(project)}`}>
                {getStatusColor(project).toUpperCase()}
              </span>
            </div>

            <div className="project-details">
              <div className="detail-item">
                <span className="detail-label">RFA:</span>
                <span className="detail-value">{project.rfaNumber}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Agent:</span>
                <span className="detail-value">{project.agentNumber}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Container:</span>
                <span className="detail-value">{project.projectContainer}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Type:</span>
                <span className="detail-value">{project.rfaType}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Team:</span>
                <span className="detail-value">{project.regionalTeam}</span>
              </div>
            </div>

            {project.triageResults && (
              <div className="triage-summary">
                <div className="triage-item">
                  <span className="triage-label">Total Triage:</span>
                  <span className="triage-value">{project.triageResults.totalTriage}</span>
                </div>
                <div className="triage-breakdown">
                  <span>LMPs: {project.triageResults.totalLMPs}</span>
                  <span>ARPs: {project.triageResults.totalARPs}</span>
                </div>
              </div>
            )}

            <div className="project-footer">
              <div className="project-dates">
                <span className="date-label">Created:</span>
                <span className="date-value">{formatDate(project.createdAt)}</span>
              </div>
              {project.updatedAt !== project.createdAt && (
                <div className="project-dates">
                  <span className="date-label">Updated:</span>
                  <span className="date-value">{formatDate(project.updatedAt)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredProjects.length === 0 && searchTerm && (
        <div className="no-results">
          <p>No projects found matching "{searchTerm}"</p>
          <button
            onClick={() => setSearchTerm('')}
            className="btn btn-secondary"
          >
            Clear Search
          </button>
        </div>
      )}
    </div>
  );
}

export default ProjectList;
