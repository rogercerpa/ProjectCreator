import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area, LabelList
} from 'recharts';
import reportDataService from '../services/ReportDataService';
import reportExportService from '../services/ReportExportService';
import ReportSettingsModal from './ReportSettingsModal';
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatDurationDays,
  getMonthDateRange,
  CHART_COLORS,
  getChartColor,
  truncateText,
} from '../utils/reportHelpers';

// Format date range for display
const formatDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return 'Select date range';
  const start = new Date(startDate);
  const end = new Date(endDate);
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
};

// Print Section Component - prevents page breaks within sections for PDF export
// Adds a visible gap before each section in print mode for better page break detection
const PrintSection = ({ children, isPrintMode }) => (
  <div style={isPrintMode ? { pageBreakInside: 'avoid', breakInside: 'avoid' } : {}}>
    {/* Page break marker - a white band that the PDF algorithm can detect */}
    {isPrintMode && (
      <div 
        data-page-break-marker="true" 
        style={{ 
          height: '20px', 
          backgroundColor: '#ffffff', 
          marginBottom: '8px'
        }} 
      />
    )}
    {children}
  </div>
);

// Active Filter Badge Component
const FilterBadge = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-full">
    {label}
    <button
      onClick={onRemove}
      className="hover:text-primary-900 dark:hover:text-primary-100"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </span>
);

// Compact Data Table Component for PDF export
const DataTable = ({ data, columns, title }) => {
  if (!data || data.length === 0) return null;
  
  return (
    <div className="mt-3 overflow-hidden rounded border border-gray-200 dark:border-gray-600">
      {title && (
        <div className="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
          {title}
        </div>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700">
            {columns.map((col, i) => (
              <th key={i} className={`px-2 py-1.5 text-left font-medium text-gray-600 dark:text-gray-400 ${col.align === 'right' ? 'text-right' : ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((row, i) => (
            <tr key={i} className="border-t border-gray-100 dark:border-gray-600">
              {columns.map((col, j) => (
                <td key={j} className={`px-2 py-1 text-gray-700 dark:text-gray-300 ${col.align === 'right' ? 'text-right font-medium' : ''}`}>
                  {col.format ? col.format(row[col.key]) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// KPI Card Component - Now responsive
const KPICard = ({ title, value, subtitle, change, formatType = 'number', icon, isPrintMode }) => {
  const formattedValue = formatType === 'currency' 
    ? formatCurrency(value)
    : formatType === 'percentage'
    ? formatPercentage(value)
    : formatType === 'duration'
    ? formatDurationDays(value)
    : formatNumber(value);

  const changeColor = change?.direction === 'up' 
    ? 'text-green-600 dark:text-green-400' 
    : change?.direction === 'down' 
    ? 'text-red-600 dark:text-red-400' 
    : 'text-gray-500 dark:text-gray-400';

  // In print mode, don't truncate text so full content appears in PDF
  const truncateClass = isPrintMode ? '' : 'truncate';

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex flex-col min-w-0 ${isPrintMode ? 'min-h-[100px]' : ''}`}>
      <div className="flex items-center justify-between mb-1 sm:mb-2 gap-1">
        <span className={`text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 ${truncateClass}`}>{title}</span>
        {icon && <span className="text-base sm:text-xl flex-shrink-0">{icon}</span>}
      </div>
      <div className={`font-bold text-gray-900 dark:text-white mb-1 ${truncateClass} ${isPrintMode ? 'text-lg' : 'text-base sm:text-lg md:text-xl lg:text-2xl'}`}>
        {formattedValue}
      </div>
      {subtitle && (
        <div className={`text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1 ${truncateClass}`}>{subtitle}</div>
      )}
      {change && (
        <div className={`text-[10px] sm:text-xs md:text-sm font-medium ${changeColor} ${truncateClass}`}>
          {change.formatted} vs prior period
        </div>
      )}
    </div>
  );
};

// Collapsible Section Component - with forceOpen for print mode and page-break control
const CollapsibleSection = ({ title, icon, defaultOpen = true, forceOpen = false, children, isPrintMode }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Force open when in print mode
  const actuallyOpen = forceOpen || isOpen;

  // Page break styles for print mode - avoid breaking inside sections
  const printStyles = isPrintMode ? { pageBreakInside: 'avoid', breakInside: 'avoid' } : {};

  return (
    <>
      {/* White band marker for PDF page break detection */}
      {isPrintMode && (
        <div 
          data-page-break-marker="true"
          style={{ 
            height: '24px', 
            backgroundColor: '#ffffff',
            marginTop: '8px'
          }} 
        />
      )}
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        style={printStyles}
      >
        <button
          onClick={() => !isPrintMode && setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between p-4 transition-colors ${isPrintMode ? 'cursor-default' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
        >
          <div className="flex items-center gap-2">
            {icon && <span className="text-xl">{icon}</span>}
            <span className="font-semibold text-gray-900 dark:text-white">{title}</span>
          </div>
          {!isPrintMode && (
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${actuallyOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
        {actuallyOpen && (
          <div className="p-4 pt-0 border-t border-gray-100 dark:border-gray-700">
            {children}
          </div>
        )}
      </div>
    </>
  );
};

// Custom Tooltip for charts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-2 rounded shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatNumber(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Render custom label for bar charts
const renderBarLabel = (props) => {
  const { x, y, width, value } = props;
  return (
    <text x={x + width + 5} y={y + 12} fill="#6B7280" fontSize={10}>
      {value}
    </text>
  );
};

// Get default date range (this month)
const getDefaultDateRange = () => {
  const today = new Date();
  const { startDate, endDate } = getMonthDateRange(today.getFullYear(), today.getMonth());
  return { startDate, endDate };
};

// Main Component
function MonthlyAnalyticsReport({ projects = [] }) {
  const reportRef = useRef(null);
  const exportDropdownRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState(null); // 'pdf', 'excel', 'csv'
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Report settings state
  const [reportSettings, setReportSettings] = useState(() => {
    const { startDate, endDate } = getDefaultDateRange();
    return {
      startDate,
      endDate,
      activePreset: 'This Month',
      viewMode: 'created',
      filters: {
        rfaTypes: [],
        regions: [],
        statuses: [],
        agencies: [],
        products: [],
        designer: null,
        qc: null,
        triage: null,
      },
    };
  });

  // Get filter options from data
  const filterOptions = useMemo(() => {
    reportDataService.setProjects(projects);
    return reportDataService.getFilterOptions();
  }, [projects]);

  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    const { filters } = reportSettings;
    let count = 0;
    if (filters.rfaTypes?.length) count += filters.rfaTypes.length;
    if (filters.regions?.length) count += filters.regions.length;
    if (filters.statuses?.length) count += filters.statuses.length;
    if (filters.agencies?.length) count += filters.agencies.length;
    if (filters.products?.length) count += filters.products.length;
    if (filters.designer) count++;
    if (filters.qc) count++;
    if (filters.triage) count++;
    return count;
  }, [reportSettings.filters]);

  // Get active filter labels for display
  const activeFilterLabels = useMemo(() => {
    const labels = [];
    const { filters } = reportSettings;
    filters.rfaTypes?.forEach(v => labels.push({ type: 'rfaTypes', value: v, label: v }));
    filters.regions?.forEach(v => labels.push({ type: 'regions', value: v, label: v }));
    filters.statuses?.forEach(v => labels.push({ type: 'statuses', value: v, label: v }));
    filters.agencies?.forEach(v => labels.push({ type: 'agencies', value: v, label: truncateText(v, 15) }));
    filters.products?.forEach(v => labels.push({ type: 'products', value: v, label: v }));
    if (filters.designer) labels.push({ type: 'designer', value: filters.designer, label: `Designer: ${filters.designer}` });
    if (filters.qc) labels.push({ type: 'qc', value: filters.qc, label: `QC: ${filters.qc}` });
    if (filters.triage) labels.push({ type: 'triage', value: filters.triage, label: `Triage: ${filters.triage}` });
    return labels;
  }, [reportSettings.filters]);

  // Remove a single filter
  const removeFilter = (type, value) => {
    setReportSettings(prev => {
      const newFilters = { ...prev.filters };
      if (type === 'designer' || type === 'qc' || type === 'triage') {
        newFilters[type] = null;
      } else {
        newFilters[type] = newFilters[type].filter(v => v !== value);
      }
      return { ...prev, filters: newFilters };
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setReportSettings(prev => ({
      ...prev,
      filters: {
        rfaTypes: [],
        regions: [],
        statuses: [],
        agencies: [],
        products: [],
        designer: null,
        qc: null,
        triage: null,
      },
    }));
  };

  // Generate report when settings change
  const generateReport = useCallback(() => {
    setIsLoading(true);
    try {
      reportDataService.setProjects(projects);
      const data = reportDataService.generateReportWithFilters(
        reportSettings.startDate,
        reportSettings.endDate,
        reportSettings.viewMode,
        reportSettings.filters
      );
      setReportData(data);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projects, reportSettings]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  // Handle settings apply
  const handleApplySettings = (newSettings) => {
    setReportSettings(newSettings);
  };

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // PDF Export handler - with improved pagination and section awareness
  const handleExportPDF = async () => {
    setIsExporting(true);
    setExportType('pdf');
    setShowExportDropdown(false);
    setIsPrintMode(true);
    
    // Wait for React to re-render with print mode
    await new Promise(resolve => setTimeout(resolve, 600));
    
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      const element = reportRef.current;
      if (!element) return;

      // Capture the element with improved settings
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1400, // Wider render for better layout and less truncation
        onclone: (clonedDoc) => {
          // Ensure all text is visible in the cloned document
          const clonedElement = clonedDoc.body.querySelector('[data-report-content]') || clonedDoc.body;
          const allElements = clonedElement.querySelectorAll('*');
          allElements.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.overflow === 'hidden' || style.textOverflow === 'ellipsis') {
              el.style.overflow = 'visible';
              el.style.textOverflow = 'clip';
              el.style.whiteSpace = 'normal';
            }
          });
        }
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter',
      });

      const pageWidth = 8.5;
      const pageHeight = 11;
      const margin = 0.4;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      
      // Calculate scaling
      const imgAspectRatio = canvas.height / canvas.width;
      const scaledImgHeight = contentWidth * imgAspectRatio;
      
      // Find white bands in the canvas that indicate good break points
      // A "white band" is multiple consecutive rows that are mostly white
      const findWhiteBands = (canvasElement) => {
        const ctx = canvasElement.getContext('2d');
        const whiteBands = [];
        const minBandHeight = 10; // Minimum height of white band to consider
        
        let bandStart = -1;
        
        for (let y = 0; y < canvasElement.height; y += 2) {
          // Sample pixels across this row
          const imageData = ctx.getImageData(0, y, canvasElement.width, 1);
          let whitePixels = 0;
          const samples = Math.floor(canvasElement.width / 5);
          
          for (let x = 0; x < canvasElement.width; x += 5) {
            const idx = x * 4;
            const r = imageData.data[idx];
            const g = imageData.data[idx + 1];
            const b = imageData.data[idx + 2];
            // Check if pixel is white/very light
            if (r > 245 && g > 245 && b > 245) {
              whitePixels++;
            }
          }
          
          const whiteRatio = whitePixels / samples;
          const isWhiteRow = whiteRatio > 0.9; // 90% of row is white
          
          if (isWhiteRow && bandStart === -1) {
            bandStart = y;
          } else if (!isWhiteRow && bandStart !== -1) {
            const bandHeight = y - bandStart;
            if (bandHeight >= minBandHeight) {
              // Store the middle of the white band as a potential break point
              whiteBands.push({
                y: bandStart + Math.floor(bandHeight / 2),
                height: bandHeight
              });
            }
            bandStart = -1;
          }
        }
        
        return whiteBands;
      };
      
      // Find optimal page breaks using white bands
      const findPageBreaks = (canvasElement, maxPageHeight) => {
        const whiteBands = findWhiteBands(canvasElement);
        const breaks = [0];
        let currentY = 0;
        
        // Convert max page height from inches to canvas pixels
        const scale = canvasElement.height / scaledImgHeight;
        const maxHeightPx = maxPageHeight * scale;
        
        while (currentY < canvasElement.height - 50) {
          const targetY = currentY + maxHeightPx;
          
          if (targetY >= canvasElement.height) {
            breaks.push(canvasElement.height);
            break;
          }
          
          // Find the best white band near the target position
          // Search range: from 70% to 100% of page height from current position
          const searchStart = currentY + maxHeightPx * 0.7;
          const searchEnd = Math.min(currentY + maxHeightPx * 1.05, canvasElement.height);
          
          // Find white bands in the search range, prefer those closer to target
          const candidateBands = whiteBands.filter(band => 
            band.y > searchStart && band.y < searchEnd
          );
          
          if (candidateBands.length > 0) {
            // Prefer bands with larger height (more obvious breaks)
            // and closer to target position
            let bestBand = candidateBands[0];
            let bestScore = 0;
            
            for (const band of candidateBands) {
              // Score based on band height and proximity to ideal position
              const proximityScore = 1 - Math.abs(band.y - targetY) / maxHeightPx;
              const heightScore = Math.min(band.height / 40, 1); // Max score at 40px height
              const score = proximityScore * 0.4 + heightScore * 0.6;
              
              if (score > bestScore) {
                bestScore = score;
                bestBand = band;
              }
            }
            
            breaks.push(bestBand.y);
            currentY = bestBand.y;
          } else {
            // No good white band found, break at target (fallback)
            breaks.push(Math.floor(targetY));
            currentY = Math.floor(targetY);
          }
        }
        
        // Ensure the last segment is added
        if (breaks[breaks.length - 1] < canvasElement.height - 50) {
          breaks.push(canvasElement.height);
        }
        
        return breaks;
      };
      
      // Find optimal break points
      const pageBreaks = findPageBreaks(canvas, contentHeight);
      
      // Generate pages
      for (let i = 0; i < pageBreaks.length - 1; i++) {
        const startY = pageBreaks[i];
        const endY = pageBreaks[i + 1];
        const sectionHeight = endY - startY;
        
        if (sectionHeight <= 10) continue;
        
        // Create a temporary canvas for this page section
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = sectionHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, startY, canvas.width, sectionHeight, 0, 0, canvas.width, sectionHeight);

        const pageImgData = tempCanvas.toDataURL('image/png');
        
        if (i > 0) {
          pdf.addPage();
        }
        
        // Calculate the height this section should be on the PDF page
        const pdfSectionHeight = (sectionHeight / canvas.height) * scaledImgHeight;
        
        pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, pdfSectionHeight);
      }

      const startStr = reportSettings.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(' ', '');
      const endStr = reportSettings.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/[\s,]/g, '');
      const fileName = `Project_Analytics_Report_${startStr}-${endStr}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsPrintMode(false);
      setIsExporting(false);
      setExportType(null);
    }
  };

  // Excel Export handler
  const handleExportExcel = async () => {
    setIsExporting(true);
    setExportType('excel');
    setShowExportDropdown(false);
    
    try {
      await reportExportService.exportToExcel(reportData, reportSettings, projects);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export to Excel. Please try again.');
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  // CSV Export handler
  const handleExportCSV = async () => {
    setIsExporting(true);
    setExportType('csv');
    setShowExportDropdown(false);
    
    try {
      await reportExportService.exportToCSV(reportData, reportSettings, projects);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      alert('Failed to export to CSV. Please try again.');
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading || !reportData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const { kpis, charts, teamPerformance, dasRevenue, rfaValue } = reportData;

  return (
    <div className="space-y-6">
      {/* Settings Modal */}
      <ReportSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onApply={handleApplySettings}
        currentSettings={reportSettings}
        filterOptions={filterOptions}
      />

      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Date Range Display */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">📅</span>
            <span className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
              {formatDateRange(reportSettings.startDate, reportSettings.endDate)}
            </span>
          </div>

          {/* Configure Report Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden sm:inline">Configure</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-bold bg-primary-600 text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* View Mode Indicator */}
          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            By {reportSettings.viewMode === 'created' ? 'Created' : 'Completed'} Date
          </span>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span className="hidden sm:inline">Print</span>
          </button>
          
          {/* Export Dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              disabled={isExporting}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span className="hidden sm:inline">
                    {exportType === 'pdf' ? 'Exporting PDF...' : 
                     exportType === 'excel' ? 'Exporting Excel...' : 
                     exportType === 'csv' ? 'Exporting CSV...' : 'Exporting...'}
                  </span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden sm:inline">Export</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
            
            {/* Dropdown Menu */}
            {showExportDropdown && !isExporting && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                <button
                  onClick={handleExportPDF}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13h1v4h-1v-4zm2 0h1v1h-1v-1zm0 2h1v2h-1v-2zm2-2h1v4h-1v-4zm2 0h1.5v1h-1v3h-.5v-4z"/>
                  </svg>
                  <div className="text-left">
                    <div className="font-medium">PDF</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Print-ready document</div>
                  </div>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 17l2-4-2-4h1.5l1.25 2.5L12 9h1.5l-2 4 2 4H12l-1.25-2.5L9.5 17H8z"/>
                  </svg>
                  <div className="text-left">
                    <div className="font-medium">Excel</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Multi-sheet workbook</div>
                  </div>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM7 12h2v2H7v-2zm0 4h2v2H7v-2zm4-4h2v2h-2v-2zm0 4h2v2h-2v-2zm4-4h2v2h-2v-2zm0 4h2v2h-2v-2z"/>
                  </svg>
                  <div className="text-left">
                    <div className="font-medium">CSV</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Simple data export</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Filter Badges */}
      {activeFilterLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <span className="text-xs text-gray-500 dark:text-gray-400">Filters:</span>
          {activeFilterLabels.slice(0, 8).map((filter, index) => (
            <FilterBadge
              key={`${filter.type}-${filter.value}-${index}`}
              label={filter.label}
              onRemove={() => removeFilter(filter.type, filter.value)}
            />
          ))}
          {activeFilterLabels.length > 8 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              +{activeFilterLabels.length - 8} more
            </span>
          )}
          <button
            onClick={clearAllFilters}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Report Content */}
      <div ref={reportRef} className={`space-y-4 sm:space-y-6 p-4 sm:p-6 rounded-xl print:bg-white print:p-0 ${isPrintMode ? 'bg-white' : 'bg-gray-50 dark:bg-gray-900'}`}>
        {/* Report Title */}
        <div className="text-center mb-4 sm:mb-6">
          <h2 className={`font-bold text-gray-900 ${isPrintMode ? 'text-xl' : 'text-lg sm:text-xl md:text-2xl'} dark:text-white`}>
            Project Analytics Report
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {formatDateRange(reportSettings.startDate, reportSettings.endDate)} • {reportSettings.viewMode === 'created' ? 'By Created Date' : 'By Completed Date'}
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500 mt-1">
            {reportData.projectCount} projects analyzed
            {activeFilterCount > 0 && ` (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} applied)`}
          </p>
        </div>

        {/* KPI Cards - Responsive grid */}
        <PrintSection isPrintMode={isPrintMode}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
            <KPICard
              title="Total Projects"
              value={kpis.totalProjects.value}
              change={kpis.totalProjects.change}
              icon="📊"
              isPrintMode={isPrintMode}
            />
            <KPICard
              title="Completed"
              value={kpis.completedProjects.value}
              subtitle={`${formatPercentage(kpis.completedProjects.rate)} rate`}
              change={kpis.completedProjects.change}
              icon="✅"
              isPrintMode={isPrintMode}
            />
            <KPICard
              title="RFA Value"
              value={kpis.totalRfaValue.value}
              formatType="currency"
              change={kpis.totalRfaValue.change}
              icon="💰"
              isPrintMode={isPrintMode}
            />
            <KPICard
              title="DAS Revenue"
              value={kpis.totalDasRevenue.value}
              formatType="currency"
              subtitle={`${kpis.totalDasRevenue.count} services`}
              change={kpis.totalDasRevenue.change}
              icon="💵"
              isPrintMode={isPrintMode}
            />
            <KPICard
              title="Turnaround"
              value={kpis.avgTurnaroundTime.value}
              formatType="duration"
              change={kpis.avgTurnaroundTime.change}
              icon="⏱️"
              isPrintMode={isPrintMode}
            />
            <KPICard
              title="On-Time"
              value={kpis.onTimeRate.value}
              formatType="percentage"
              change={kpis.onTimeRate.change}
              icon="🎯"
              isPrintMode={isPrintMode}
            />
          </div>
        </PrintSection>

        {/* White band marker for Charts Row 1 */}
        {isPrintMode && (
          <div data-page-break-marker="true" style={{ height: '24px', backgroundColor: '#ffffff' }} />
        )}

        {/* Charts Row 1 - Always visible */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* RFA Type Distribution */}
          <PrintSection isPrintMode={isPrintMode}>
            <div className={`rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 ${isPrintMode ? 'bg-white' : 'bg-white dark:bg-gray-800'}`}>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">RFA Type Distribution</h3>
              {charts.rfaTypeDistribution.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={isPrintMode ? 200 : 220}>
                    <PieChart>
                      <Pie
                        data={charts.rfaTypeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={isPrintMode ? 40 : 50}
                        outerRadius={isPrintMode ? 70 : 85}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${truncateText(name, 10)} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {charts.rfaTypeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getChartColor(index)} />
                        ))}
                      </Pie>
                      {isPrintMode && <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 10 }} />}
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {isPrintMode && (
                    <DataTable
                      data={charts.rfaTypeDistribution}
                      columns={[
                        { key: 'name', header: 'RFA Type' },
                        { key: 'value', header: 'Count', align: 'right' }
                      ]}
                    />
                  )}
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500 text-sm">No data available</div>
              )}
            </div>
          </PrintSection>

          {/* Regional Team Volume */}
          <PrintSection isPrintMode={isPrintMode}>
            <div className={`rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 ${isPrintMode ? 'bg-white' : 'bg-white dark:bg-gray-800'}`}>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">Regional Team Volume</h3>
              {charts.regionalDistribution.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={isPrintMode ? 200 : 220}>
                    <BarChart data={charts.regionalDistribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis type="number" stroke="#9CA3AF" fontSize={10} />
                      <YAxis dataKey="name" type="category" width={80} stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                        {isPrintMode && <LabelList dataKey="value" position="right" fontSize={10} />}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {isPrintMode && (
                    <DataTable
                      data={charts.regionalDistribution}
                      columns={[
                        { key: 'name', header: 'Region' },
                        { key: 'value', header: 'Projects', align: 'right' }
                      ]}
                    />
                  )}
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500 text-sm">No data available</div>
              )}
            </div>
          </PrintSection>
        </div>

        {/* Charts Row 2 - Always visible */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Top 10 Agencies */}
          <PrintSection isPrintMode={isPrintMode}>
            <div className={`rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 ${isPrintMode ? 'bg-white' : 'bg-white dark:bg-gray-800'}`}>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">Top 10 Agencies</h3>
              {charts.topAgencies.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={isPrintMode ? 200 : 220}>
                    <BarChart data={charts.topAgencies.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis type="number" stroke="#9CA3AF" fontSize={10} />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={100} 
                        stroke="#9CA3AF" 
                        tick={{ fontSize: 9 }}
                        tickFormatter={(value) => truncateText(value, 14)}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]}>
                        {isPrintMode && <LabelList dataKey="value" position="right" fontSize={10} />}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {isPrintMode && (
                    <DataTable
                      data={charts.topAgencies}
                      columns={[
                        { key: 'name', header: 'Agency' },
                        { key: 'value', header: 'Projects', align: 'right' }
                      ]}
                    />
                  )}
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500 text-sm">No data available</div>
              )}
            </div>
          </PrintSection>

          {/* Weekly Project Intake */}
          <PrintSection isPrintMode={isPrintMode}>
            <div className={`rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 ${isPrintMode ? 'bg-white' : 'bg-white dark:bg-gray-800'}`}>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">Weekly Project Intake</h3>
              {charts.projectIntake.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={isPrintMode ? 200 : 220}>
                    <AreaChart data={charts.projectIntake}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} />
                      <YAxis stroke="#9CA3AF" fontSize={10} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="value" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3}>
                        {isPrintMode && <LabelList dataKey="value" position="top" fontSize={10} />}
                      </Area>
                    </AreaChart>
                  </ResponsiveContainer>
                  {isPrintMode && (
                    <DataTable
                      data={charts.projectIntake}
                      columns={[
                        { key: 'name', header: 'Week' },
                        { key: 'value', header: 'Projects', align: 'right' }
                      ]}
                    />
                  )}
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500 text-sm">No data available</div>
              )}
            </div>
          </PrintSection>
        </div>

        {/* Collapsible Sections - Force open in print mode */}
        <div className="space-y-3 sm:space-y-4">
          {/* Status Distribution & Product Mix */}
          <CollapsibleSection 
            title="Status Distribution & Product Mix" 
            icon="📈" 
            defaultOpen={false}
            forceOpen={isPrintMode}
            isPrintMode={isPrintMode}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Status Distribution */}
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 text-sm">Project Status</h4>
                {charts.statusDistribution.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={charts.statusDistribution}
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          dataKey="value"
                          label={({ name, value }) => `${truncateText(name, 8)}: ${value}`}
                          labelLine={false}
                        >
                          {charts.statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getChartColor(index)} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    {isPrintMode && (
                      <DataTable
                        data={charts.statusDistribution}
                        columns={[
                          { key: 'name', header: 'Status' },
                          { key: 'value', header: 'Count', align: 'right' }
                        ]}
                      />
                    )}
                  </>
                ) : (
                  <div className="h-40 flex items-center justify-center text-gray-500 text-sm">No data available</div>
                )}
              </div>

              {/* Product Mix */}
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 text-sm">Product Mix</h4>
                {charts.productMix.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={charts.productMix.slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#9CA3AF" 
                          tick={{ fontSize: 9 }}
                          tickFormatter={(value) => truncateText(value, 6)}
                        />
                        <YAxis stroke="#9CA3AF" fontSize={10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" fill="#F59E0B" radius={[4, 4, 0, 0]}>
                          {isPrintMode && <LabelList dataKey="value" position="top" fontSize={9} />}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    {isPrintMode && (
                      <DataTable
                        data={charts.productMix}
                        columns={[
                          { key: 'name', header: 'Product' },
                          { key: 'value', header: 'Count', align: 'right' }
                        ]}
                      />
                    )}
                  </>
                ) : (
                  <div className="h-40 flex items-center justify-center text-gray-500 text-sm">No data available</div>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* Team Performance */}
          <CollapsibleSection 
            title="Team Performance" 
            icon="👥" 
            defaultOpen={false}
            forceOpen={isPrintMode}
            isPrintMode={isPrintMode}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* By Designer */}
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 text-sm">By Designer</h4>
                {teamPerformance.byDesigner.length > 0 ? (
                  <div className="space-y-2">
                    {teamPerformance.byDesigner.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between gap-2">
                        <span className={`text-xs sm:text-sm text-gray-600 dark:text-gray-400 ${isPrintMode ? '' : 'truncate max-w-[120px] sm:max-w-[150px]'}`}>
                          {item.name}
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white flex-shrink-0">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-xs sm:text-sm">No data available</div>
                )}
              </div>

              {/* By QC */}
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 text-sm">By QC</h4>
                {teamPerformance.byQC.length > 0 ? (
                  <div className="space-y-2">
                    {teamPerformance.byQC.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between gap-2">
                        <span className={`text-xs sm:text-sm text-gray-600 dark:text-gray-400 ${isPrintMode ? '' : 'truncate max-w-[120px] sm:max-w-[150px]'}`}>
                          {item.name}
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white flex-shrink-0">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-xs sm:text-sm">No data available</div>
                )}
              </div>

              {/* By Triage */}
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 text-sm">By Triage</h4>
                {teamPerformance.byTriage.length > 0 ? (
                  <div className="space-y-2">
                    {teamPerformance.byTriage.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between gap-2">
                        <span className={`text-xs sm:text-sm text-gray-600 dark:text-gray-400 ${isPrintMode ? '' : 'truncate max-w-[120px] sm:max-w-[150px]'}`}>
                          {item.name}
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white flex-shrink-0">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-xs sm:text-sm">No data available</div>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* DAS Revenue Breakdown */}
          <CollapsibleSection 
            title="DAS Revenue Breakdown" 
            icon="💵" 
            defaultOpen={false}
            forceOpen={isPrintMode}
            isPrintMode={isPrintMode}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <div className="space-y-3">
                  <div className={`flex justify-between items-center p-3 rounded-lg ${isPrintMode ? 'bg-gray-100' : 'bg-gray-50 dark:bg-gray-700'}`}>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(dasRevenue.totalRevenue)}
                    </span>
                  </div>
                  <div className={`flex justify-between items-center p-3 rounded-lg ${isPrintMode ? 'bg-gray-100' : 'bg-gray-50 dark:bg-gray-700'}`}>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Paid Services Count</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatNumber(dasRevenue.totalCount)}
                    </span>
                  </div>
                  <div className={`flex justify-between items-center p-3 rounded-lg ${isPrintMode ? 'bg-gray-100' : 'bg-gray-50 dark:bg-gray-700'}`}>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Average Fee</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(dasRevenue.avgFee)}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 text-sm">By Status</h4>
                {dasRevenue.byStatus.length > 0 ? (
                  <div className="space-y-2">
                    {dasRevenue.byStatus.map((item, index) => (
                      <div key={index} className={`flex items-center justify-between p-2 rounded ${isPrintMode ? 'bg-gray-100' : 'bg-gray-50 dark:bg-gray-700'}`}>
                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{item.name}</span>
                        <div className="text-right">
                          <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(item.revenue)}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">({item.count})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-xs sm:text-sm">No data available</div>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* RFA Value Distribution */}
          <CollapsibleSection 
            title="RFA Value Distribution" 
            icon="💰" 
            defaultOpen={false}
            forceOpen={isPrintMode}
            isPrintMode={isPrintMode}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* By Region */}
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 text-sm">By Region</h4>
                {rfaValue.byRegion.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={rfaValue.byRegion} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                        <XAxis type="number" stroke="#9CA3AF" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} fontSize={10} />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={80} 
                          stroke="#9CA3AF" 
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    {isPrintMode && (
                      <DataTable
                        data={rfaValue.byRegion}
                        columns={[
                          { key: 'name', header: 'Region' },
                          { key: 'value', header: 'Value', align: 'right', format: (v) => formatCurrency(v) }
                        ]}
                      />
                    )}
                  </>
                ) : (
                  <div className="h-40 flex items-center justify-center text-gray-500 text-sm">No data available</div>
                )}
              </div>

              {/* By RFA Type */}
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 text-sm">By RFA Type</h4>
                {rfaValue.byType.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={rfaValue.byType} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                        <XAxis type="number" stroke="#9CA3AF" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} fontSize={10} />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={80} 
                          stroke="#9CA3AF" 
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => truncateText(value, 10)}
                        />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    {isPrintMode && (
                      <DataTable
                        data={rfaValue.byType}
                        columns={[
                          { key: 'name', header: 'RFA Type' },
                          { key: 'value', header: 'Value', align: 'right', format: (v) => formatCurrency(v) }
                        ]}
                      />
                    )}
                  </>
                ) : (
                  <div className="h-40 flex items-center justify-center text-gray-500 text-sm">No data available</div>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
              <div className={`p-3 rounded-lg text-center ${isPrintMode ? 'bg-gray-100' : 'bg-gray-50 dark:bg-gray-700'}`}>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Value</div>
                <div className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(rfaValue.total)}
                </div>
              </div>
              <div className={`p-3 rounded-lg text-center ${isPrintMode ? 'bg-gray-100' : 'bg-gray-50 dark:bg-gray-700'}`}>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Avg per Project</div>
                <div className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(rfaValue.average)}
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-4 sm:mt-6 print:mt-4">
          Generated on {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
}

export default MonthlyAnalyticsReport;
