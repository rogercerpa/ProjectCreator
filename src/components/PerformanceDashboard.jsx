import React, { useState, useEffect } from 'react';
import performanceMonitoringService from '../services/PerformanceMonitoringService';
import analyticsService from '../services/AnalyticsService';

const PerformanceDashboard = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds

  useEffect(() => {
    if (isVisible && isMonitoring) {
      const interval = setInterval(() => {
        updatePerformanceData();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [isVisible, isMonitoring, refreshInterval]);

  const updatePerformanceData = () => {
    const stats = performanceMonitoringService.getStats();
    const report = performanceMonitoringService.getReport();
    
    setPerformanceData({
      stats,
      report,
      timestamp: new Date().toISOString()
    });
  };

  const toggleMonitoring = () => {
    if (isMonitoring) {
      performanceMonitoringService.disable();
      setIsMonitoring(false);
      analyticsService.trackEvent('performance_monitoring_disabled');
    } else {
      performanceMonitoringService.enable();
      setIsMonitoring(true);
      updatePerformanceData();
      analyticsService.trackEvent('performance_monitoring_enabled');
    }
  };

  const clearMetrics = () => {
    performanceMonitoringService.clearMetrics();
    updatePerformanceData();
    analyticsService.trackEvent('performance_metrics_cleared');
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms) => {
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getSeverityColor = (exceededRate) => {
    if (exceededRate > 0.2) return '#dc3545'; // Red
    if (exceededRate > 0.1) return '#ffc107'; // Yellow
    return '#28a745'; // Green
  };

  if (!isVisible) {
    return (
      <button 
        className="fixed bottom-5 right-5 w-[50px] h-[50px] border-none rounded-full bg-info-600 dark:bg-info-700
                   text-white text-xl cursor-pointer shadow-lg shadow-info-600/30 transition-all z-[1000]
                   hover:bg-info-700 dark:hover:bg-info-600 hover:scale-110"
        onClick={() => setIsVisible(true)}
        title="Open Performance Dashboard"
      >
        📊
      </button>
    );
  }

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[1200px] max-h-[80vh]
                    bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl
                    shadow-2xl z-[10000] overflow-hidden
                    md:w-[95%] md:max-h-[90vh]">
      <div className="flex justify-between items-center px-5 py-5 border-b border-gray-200 dark:border-gray-700
                      bg-gray-50 dark:bg-gray-900
                      md:flex-col md:gap-4 md:items-stretch">
        <h3 className="m-0 text-xl font-semibold text-gray-900 dark:text-gray-100">Performance Dashboard</h3>
        <div className="flex gap-2.5 items-center md:justify-center">
          <button 
            className={`px-4 py-2 border-none rounded-md text-sm font-medium cursor-pointer transition-all
                       ${isMonitoring 
                         ? 'bg-error-600 dark:bg-error-700 hover:bg-error-700 dark:hover:bg-error-600' 
                         : 'bg-success-600 dark:bg-success-700 hover:bg-success-700 dark:hover:bg-success-600'
                       } text-white`}
            onClick={toggleMonitoring}
          >
            {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
          </button>
          <button 
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800
                       text-gray-600 dark:text-gray-400 text-sm cursor-pointer transition-all
                       hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={clearMetrics}
            disabled={!isMonitoring}
          >
            Clear Metrics
          </button>
          <button 
            className="w-8 h-8 border-none rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400
                       text-lg cursor-pointer transition-all hover:bg-gray-200 dark:hover:bg-gray-600
                       hover:text-gray-900 dark:hover:text-gray-100"
            onClick={() => setIsVisible(false)}
          >
            ×
          </button>
        </div>
      </div>

      {isMonitoring && performanceData && (
        <div className="px-5 py-5 max-h-[calc(80vh-80px)] overflow-y-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6 md:grid-cols-1">
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
              <h4 className="m-0 mb-2 text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total Metrics</h4>
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {Object.keys(performanceData.stats).length}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
              <h4 className="m-0 mb-2 text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total Measurements</h4>
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {Object.values(performanceData.stats).reduce((sum, stat) => sum + stat.count, 0)}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
              <h4 className="m-0 mb-2 text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Threshold Exceeded</h4>
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {Object.values(performanceData.stats).reduce((sum, stat) => sum + stat.thresholdExceeded, 0)}
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="mb-6">
            <h4 className="m-0 mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Performance Metrics</h4>
            {Object.entries(performanceData.stats).map(([metricName, stat]) => (
              <div key={metricName} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3 transition-all hover:border-info-600 hover:shadow-md">
                <div className="flex justify-between items-center mb-3">
                  <h5 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100 capitalize">{metricName}</h5>
                  <div 
                    className="text-lg"
                    style={{ color: getSeverityColor(stat.thresholdExceededRate) }}
                  >
                    {stat.thresholdExceededRate > 0.1 ? '⚠️' : '✅'}
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3 md:grid-cols-1">
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Count:</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{stat.count}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Avg:</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {metricName.includes('memory') ? formatBytes(stat.avg) : formatTime(stat.avg)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Min:</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {metricName.includes('memory') ? formatBytes(stat.min) : formatTime(stat.min)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Max:</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {metricName.includes('memory') ? formatBytes(stat.max) : formatTime(stat.max)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">P95:</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {metricName.includes('memory') ? formatBytes(stat.p95) : formatTime(stat.p95)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Exceeded:</span>
                    <span className="stat-value" style={{ color: getSeverityColor(stat.thresholdExceededRate) }}>
                      {Math.round(stat.thresholdExceededRate * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {performanceData.report.recommendations.length > 0 && (
            <div className="mb-6">
              <h4 className="m-0 mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Performance Recommendations</h4>
              {performanceData.report.recommendations.map((rec, index) => (
                <div key={index} className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3 ${rec.severity === 'warning' ? 'border-l-4 border-l-warning-600 bg-warning-50 dark:bg-warning-900/10' : rec.severity === 'error' ? 'border-l-4 border-l-error-600 bg-error-50 dark:bg-error-900/10' : 'border-l-4 border-l-success-600'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{rec.type}</span>
                    <span className="text-xs font-semibold px-2 py-1 rounded uppercase tracking-wide bg-warning-100 dark:bg-warning-900/30 text-warning-800 dark:text-warning-200">{rec.severity}</span>
                  </div>
                  <p className="m-0 mb-2 text-sm text-gray-900 dark:text-gray-100 font-medium">{rec.message}</p>
                  <p className="m-0 text-xs text-gray-600 dark:text-gray-400 italic">{rec.suggestion}</p>
                </div>
              ))}
            </div>
          )}

          {/* System Info */}
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h4 className="m-0 mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">System Information</h4>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 md:grid-cols-1">
              <div className="flex justify-between items-center px-3 py-2 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Platform:</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{process.platform}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Architecture:</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{process.arch}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Node Version:</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{process.version}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Memory Usage:</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {process.memoryUsage ? formatBytes(process.memoryUsage.heapUsed) : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isMonitoring && (
        <div className="px-10 py-10 text-center text-gray-600 dark:text-gray-400">
          <p>Click "Start Monitoring" to begin tracking performance metrics</p>
        </div>
      )}
    </div>
  );
};

export default PerformanceDashboard;


