import React, { useState, useEffect } from 'react';
import agencyProjectService from '../../services/AgencyProjectService';

function AgencyAnalyticsTab({ agency }) {
  const [statistics, setStatistics] = useState(null);
  const [performanceMetrics, setPerformanceMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (agency) {
      loadAnalytics();
    }
  }, [agency]);

  const loadAnalytics = async () => {
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
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async (format) => {
    setExporting(true);
    try {
      // TODO: Implement report export functionality
      console.log(`Exporting ${format} report for agency:`, agency.agencyName);
      
      // Simulate export
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert(`${format.toUpperCase()} report export functionality will be implemented soon!`);
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const calculateTrend = (current, previous) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      direction: change >= 0 ? 'up' : 'down',
      positive: change >= 0
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Export Options */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Analytics & Reporting</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExportReport('pdf')}
            disabled={exporting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span>📄</span>
            <span>Export PDF</span>
          </button>
          <button
            onClick={() => handleExportReport('excel')}
            disabled={exporting}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span>📊</span>
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Performance Overview */}
      {performanceMetrics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">On-Time Rate</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {performanceMetrics.onTimeRate?.toFixed(1) || 0}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {performanceMetrics.onTimeCount || 0} on-time projects
              </p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Projects</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {performanceMetrics.totalProjects || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Projects with due dates
              </p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">On-Time</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {performanceMetrics.onTimeCount || 0}
              </p>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Late</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                {performanceMetrics.lateCount || 0}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Project Statistics */}
      {statistics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Project Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Projects</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {statistics.totalProjects || 0}
              </p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Active Projects</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {statistics.activeProjects || 0}
              </p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Completed Projects</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {statistics.completedProjects || 0}
              </p>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Draft Projects</p>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                {statistics.draftProjects || 0}
              </p>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Completion Rate</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {statistics.completionRate?.toFixed(1) || 0}%
              </p>
            </div>
            {statistics.averageDuration > 0 && (
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Avg. Duration</p>
                <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                  {statistics.averageDuration.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">days</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Response Time Analytics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Response Time Analytics</h3>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            💡 Response time analytics will track average time to respond to agency requests, 
            project initiation time, and communication response rates. This feature will be 
            enhanced with historical data tracking.
          </p>
        </div>
      </div>

      {/* Trend Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Trend Analysis</h3>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Trend analysis will show project volume trends, performance trends over time, 
            and comparative analysis. Historical data tracking will be implemented to provide 
            month-over-month and year-over-year comparisons.
          </p>
        </div>
      </div>

      {/* Project Success Rates */}
      {statistics && statistics.totalProjects > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Project Success Metrics</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Completion Rate</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {statistics.completionRate?.toFixed(1) || 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${statistics.completionRate || 0}%` }}
                ></div>
              </div>
            </div>
            {performanceMetrics && performanceMetrics.totalProjects > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">On-Time Delivery Rate</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {performanceMetrics.onTimeRate?.toFixed(1) || 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${performanceMetrics.onTimeRate || 0}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AgencyAnalyticsTab;

