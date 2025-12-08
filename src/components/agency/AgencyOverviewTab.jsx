import React, { useState, useEffect } from 'react';
import agencyProjectService from '../../services/AgencyProjectService';

function AgencyOverviewTab({ agency, allAgents = [] }) {
  const [statistics, setStatistics] = useState(null);
  const [performanceMetrics, setPerformanceMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (agency) {
      loadData();
    }
  }, [agency]);

  const loadData = async () => {
    if (!agency?.agencyName) return;

    try {
      setLoading(true);
      
      // Load project statistics
      const statsResult = await agencyProjectService.getAgencyProjectStatistics(
        agency.agencyName,
        agency.agencyNumber
      );
      
      if (statsResult.success) {
        setStatistics(statsResult.statistics);
      }

      // Load performance metrics
      const metricsResult = await agencyProjectService.getAgencyPerformanceMetrics(
        agency.agencyName,
        agency.agencyNumber
      );
      
      if (metricsResult.success) {
        setPerformanceMetrics(metricsResult.metrics);
      }
    } catch (error) {
      console.error('Error loading overview data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Projects</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {statistics?.totalProjects || 0}
              </p>
            </div>
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <span className="text-2xl">📁</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Active Projects</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {statistics?.activeProjects || 0}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <span className="text-2xl">⚡</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Completion Rate</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {statistics?.completionRate?.toFixed(1) || 0}%
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <span className="text-2xl">✓</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Agents</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {allAgents.length}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      {performanceMetrics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">On-Time Rate</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {performanceMetrics.onTimeRate?.toFixed(1) || 0}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {performanceMetrics.onTimeCount || 0} of {performanceMetrics.totalProjects || 0} projects
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">On-Time Projects</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {performanceMetrics.onTimeCount || 0}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Late Projects</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {performanceMetrics.lateCount || 0}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Project Statistics */}
      {statistics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Project Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Completed Projects</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {statistics.completedProjects || 0}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Draft Projects</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {statistics.draftProjects || 0}
              </p>
            </div>
            {statistics.averageDuration > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Average Duration</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {statistics.averageDuration.toFixed(1)} days
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Agency Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agency Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agency.region && (
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Region</p>
              <p className="text-base text-gray-900 dark:text-white">{agency.region}</p>
            </div>
          )}
          {agency.fastService && (
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Fast Service</p>
              <p className="text-base text-gray-900 dark:text-white">{agency.fastService}</p>
            </div>
          )}
          {agency.sae && (
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">SAE</p>
              <p className="text-base text-gray-900 dark:text-white">{agency.sae}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgencyOverviewTab;

