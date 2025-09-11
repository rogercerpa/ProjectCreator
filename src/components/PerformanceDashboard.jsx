import React, { useState, useEffect } from 'react';
import performanceMonitoringService from '../services/PerformanceMonitoringService';
import analyticsService from '../services/AnalyticsService';
import './PerformanceDashboard.css';

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
        className="performance-toggle"
        onClick={() => setIsVisible(true)}
        title="Open Performance Dashboard"
      >
        📊
      </button>
    );
  }

  return (
    <div className="performance-dashboard">
      <div className="performance-dashboard-header">
        <h3>Performance Dashboard</h3>
        <div className="performance-controls">
          <button 
            className={`monitoring-toggle ${isMonitoring ? 'active' : ''}`}
            onClick={toggleMonitoring}
          >
            {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
          </button>
          <button 
            className="clear-metrics"
            onClick={clearMetrics}
            disabled={!isMonitoring}
          >
            Clear Metrics
          </button>
          <button 
            className="close-dashboard"
            onClick={() => setIsVisible(false)}
          >
            ×
          </button>
        </div>
      </div>

      {isMonitoring && performanceData && (
        <div className="performance-dashboard-content">
          {/* Summary Cards */}
          <div className="performance-summary">
            <div className="summary-card">
              <h4>Total Metrics</h4>
              <div className="summary-value">
                {Object.keys(performanceData.stats).length}
              </div>
            </div>
            <div className="summary-card">
              <h4>Total Measurements</h4>
              <div className="summary-value">
                {Object.values(performanceData.stats).reduce((sum, stat) => sum + stat.count, 0)}
              </div>
            </div>
            <div className="summary-card">
              <h4>Threshold Exceeded</h4>
              <div className="summary-value">
                {Object.values(performanceData.stats).reduce((sum, stat) => sum + stat.thresholdExceeded, 0)}
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="performance-metrics">
            <h4>Performance Metrics</h4>
            {Object.entries(performanceData.stats).map(([metricName, stat]) => (
              <div key={metricName} className="metric-card">
                <div className="metric-header">
                  <h5>{metricName}</h5>
                  <div 
                    className="metric-status"
                    style={{ color: getSeverityColor(stat.thresholdExceededRate) }}
                  >
                    {stat.thresholdExceededRate > 0.1 ? '⚠️' : '✅'}
                  </div>
                </div>
                <div className="metric-stats">
                  <div className="stat-item">
                    <span className="stat-label">Count:</span>
                    <span className="stat-value">{stat.count}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Avg:</span>
                    <span className="stat-value">
                      {metricName.includes('memory') ? formatBytes(stat.avg) : formatTime(stat.avg)}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Min:</span>
                    <span className="stat-value">
                      {metricName.includes('memory') ? formatBytes(stat.min) : formatTime(stat.min)}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Max:</span>
                    <span className="stat-value">
                      {metricName.includes('memory') ? formatBytes(stat.max) : formatTime(stat.max)}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">P95:</span>
                    <span className="stat-value">
                      {metricName.includes('memory') ? formatBytes(stat.p95) : formatTime(stat.p95)}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Exceeded:</span>
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
            <div className="performance-recommendations">
              <h4>Performance Recommendations</h4>
              {performanceData.report.recommendations.map((rec, index) => (
                <div key={index} className={`recommendation ${rec.severity}`}>
                  <div className="recommendation-header">
                    <span className="recommendation-type">{rec.type}</span>
                    <span className="recommendation-severity">{rec.severity}</span>
                  </div>
                  <p className="recommendation-message">{rec.message}</p>
                  <p className="recommendation-suggestion">{rec.suggestion}</p>
                </div>
              ))}
            </div>
          )}

          {/* System Info */}
          <div className="system-info">
            <h4>System Information</h4>
            <div className="system-details">
              <div className="system-item">
                <span className="system-label">Platform:</span>
                <span className="system-value">{process.platform}</span>
              </div>
              <div className="system-item">
                <span className="system-label">Architecture:</span>
                <span className="system-value">{process.arch}</span>
              </div>
              <div className="system-item">
                <span className="system-label">Node Version:</span>
                <span className="system-value">{process.version}</span>
              </div>
              <div className="system-item">
                <span className="system-label">Memory Usage:</span>
                <span className="system-value">
                  {process.memoryUsage ? formatBytes(process.memoryUsage.heapUsed) : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isMonitoring && (
        <div className="performance-dashboard-placeholder">
          <p>Click "Start Monitoring" to begin tracking performance metrics</p>
        </div>
      )}
    </div>
  );
};

export default PerformanceDashboard;


