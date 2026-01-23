import React, { useState, useEffect } from 'react';
import MonthlyAnalyticsReport from '../MonthlyAnalyticsReport';

const { electronAPI } = window;

/**
 * Monthly Analytics Report Tab
 * Wrapper component that loads projects and renders the analytics report
 */
function MonthlyAnalyticsReportTab() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load all projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await electronAPI.projectsLoadAll();
        
        if (result && result.success && Array.isArray(result.projects)) {
          setProjects(result.projects);
          console.log(`Loaded ${result.projects.length} projects for analytics`);
        } else {
          throw new Error(result?.error || 'Failed to load projects');
        }
      } catch (err) {
        console.error('Error loading projects for analytics:', err);
        setError(err.message || 'Failed to load project data');
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading project data...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-5xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Error Loading Data
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // No projects state
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-5xl mb-4">📊</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Projects Yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Create some projects to see analytics data.
        </p>
      </div>
    );
  }

  return <MonthlyAnalyticsReport projects={projects} />;
}

export default MonthlyAnalyticsReportTab;
