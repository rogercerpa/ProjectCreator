import React, { useState, useEffect } from 'react';
import agencyProjectService from '../../services/AgencyProjectService';

function AgencyProjectsTab({ agency, onProjectSelect }) {
  const [activeProjects, setActiveProjects] = useState([]);
  const [recentlyCompleted, setRecentlyCompleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('active'); // 'active' or 'completed'

  useEffect(() => {
    if (agency) {
      loadProjects();
    }
  }, [agency]);

  const loadProjects = async () => {
    if (!agency?.agencyName) return;

    try {
      setLoading(true);

      // Load active projects
      const activeResult = await agencyProjectService.getActiveProjectsByAgency(
        agency.agencyName,
        agency.agencyNumber
      );
      
      if (activeResult.success) {
        setActiveProjects(activeResult.projects || []);
      }

      // Load recently completed projects
      const completedResult = await agencyProjectService.getRecentlyCompletedProjects(
        agency.agencyName,
        agency.agencyNumber,
        30
      );
      
      if (completedResult.success) {
        setRecentlyCompleted(completedResult.projects || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const renderProjectCard = (project) => (
    <div
      key={project.id || project.rfaNumber}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onProjectSelect && onProjectSelect(project)}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {project.projectName || project.rfaNumber || 'Unnamed Project'}
        </h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          project.status === 'active' 
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
        }`}>
          {project.status || 'Unknown'}
        </span>
      </div>
      
      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
        {project.rfaNumber && (
          <div className="flex items-center gap-2">
            <span className="font-medium">RFA:</span>
            <span>{project.rfaNumber}</span>
          </div>
        )}
        {project.submittedDate && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Submitted:</span>
            <span>{formatDate(project.submittedDate)}</span>
          </div>
        )}
        {project.dueDate && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Due:</span>
            <span>{formatDate(project.dueDate)}</span>
          </div>
        )}
        {project.completedDate && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Completed:</span>
            <span>{formatDate(project.completedDate)}</span>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode('active')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            viewMode === 'active'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Active ({activeProjects.length})
        </button>
        <button
          onClick={() => setViewMode('completed')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            viewMode === 'completed'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Recently Completed ({recentlyCompleted.length})
        </button>
      </div>

      {/* Projects List */}
      {viewMode === 'active' ? (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Active Projects</h2>
          {activeProjects.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">No active projects found for this agency.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeProjects.map(renderProjectCard)}
            </div>
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recently Completed Projects</h2>
          {recentlyCompleted.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">No recently completed projects found for this agency.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentlyCompleted.map(renderProjectCard)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AgencyProjectsTab;

