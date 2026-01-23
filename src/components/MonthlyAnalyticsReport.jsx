import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area, LabelList
} from 'recharts';
import reportDataService from '../services/ReportDataService';
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatDurationDays,
  getMonthOptions,
  formatMonthYear,
  CHART_COLORS,
  getChartColor,
  truncateText,
} from '../utils/reportHelpers';

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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex flex-col min-w-0">
      <div className="flex items-center justify-between mb-1 sm:mb-2 gap-1">
        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</span>
        {icon && <span className="text-base sm:text-xl flex-shrink-0">{icon}</span>}
      </div>
      <div className={`font-bold text-gray-900 dark:text-white mb-1 truncate ${isPrintMode ? 'text-lg' : 'text-base sm:text-lg md:text-xl lg:text-2xl'}`}>
        {formattedValue}
      </div>
      {subtitle && (
        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{subtitle}</div>
      )}
      {change && (
        <div className={`text-[10px] sm:text-xs md:text-sm font-medium ${changeColor} truncate`}>
          {change.formatted} vs last month
        </div>
      )}
    </div>
  );
};

// Collapsible Section Component - with forceOpen for print mode
const CollapsibleSection = ({ title, icon, defaultOpen = true, forceOpen = false, children, isPrintMode }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Force open when in print mode
  const actuallyOpen = forceOpen || isOpen;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
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

// Main Component
function MonthlyAnalyticsReport({ projects = [] }) {
  const reportRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth()}`;
  });
  const [viewMode, setViewMode] = useState('created');
  const [isExporting, setIsExporting] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);

  const monthOptions = getMonthOptions();

  // Parse selected month
  const [year, month] = selectedMonth.split('-').map(Number);

  // Generate report when month or view mode changes
  const generateReport = useCallback(() => {
    setIsLoading(true);
    try {
      reportDataService.setProjects(projects);
      const data = reportDataService.generateReport(year, month, viewMode);
      setReportData(data);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projects, year, month, viewMode]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // PDF Export handler - now with print mode
  const handleExportPDF = async () => {
    setIsExporting(true);
    setIsPrintMode(true);
    
    // Wait for React to re-render with print mode
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      const element = reportRef.current;
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200, // Force wider render for better layout
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter',
      });

      const pageWidth = 8.5;
      const pageHeight = 11;
      const margin = 0.4;
      const contentWidth = pageWidth - margin * 2;
      const imgAspectRatio = canvas.height / canvas.width;
      const imgHeight = contentWidth * imgAspectRatio;

      let remainingHeight = imgHeight;
      let sourceY = 0;

      while (remainingHeight > 0) {
        const availableHeight = pageHeight - margin * 2;
        const heightToDraw = Math.min(remainingHeight, availableHeight);
        const sourceHeight = (heightToDraw / imgHeight) * canvas.height;

        // Create a temporary canvas for this page section
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = sourceHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);

        const pageImgData = tempCanvas.toDataURL('image/png');
        
        if (sourceY > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, heightToDraw);

        sourceY += sourceHeight;
        remainingHeight -= heightToDraw;
      }

      const fileName = `Project_Analytics_Report_${formatMonthYear(year, month).replace(' ', '_')}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsPrintMode(false);
      setIsExporting(false);
    }
  };

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
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">Month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2 sm:px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
            >
              {monthOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('created')}
              className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                viewMode === 'created'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Created
            </button>
            <button
              onClick={() => setViewMode('completed')}
              className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                viewMode === 'completed'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Completed
            </button>
          </div>
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
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span className="hidden sm:inline">Exporting...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Export PDF</span>
                <span className="sm:hidden">PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div ref={reportRef} className={`space-y-4 sm:space-y-6 p-4 sm:p-6 rounded-xl print:bg-white print:p-0 ${isPrintMode ? 'bg-white' : 'bg-gray-50 dark:bg-gray-900'}`}>
        {/* Report Title */}
        <div className="text-center mb-4 sm:mb-6">
          <h2 className={`font-bold text-gray-900 ${isPrintMode ? 'text-xl' : 'text-lg sm:text-xl md:text-2xl'} dark:text-white`}>
            Project Analytics Report
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {formatMonthYear(year, month)} • {viewMode === 'created' ? 'By Created Date' : 'By Completed Date'}
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500 mt-1">
            {reportData.projectCount} projects analyzed
          </p>
        </div>

        {/* KPI Cards - Responsive grid */}
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

        {/* Charts Row 1 - Always visible */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* RFA Type Distribution */}
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

          {/* Regional Team Volume */}
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
        </div>

        {/* Charts Row 2 - Always visible */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Top 10 Agencies */}
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

          {/* Weekly Project Intake */}
          <div className={`rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 ${isPrintMode ? 'bg-white' : 'bg-white dark:bg-gray-800'}`}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">Weekly Project Intake</h3>
            {charts.weeklyIntake.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={isPrintMode ? 200 : 220}>
                  <AreaChart data={charts.weeklyIntake}>
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
                    data={charts.weeklyIntake}
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
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate max-w-[120px] sm:max-w-[150px]">
                          {item.name}
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
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
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate max-w-[120px] sm:max-w-[150px]">
                          {item.name}
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
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
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate max-w-[120px] sm:max-w-[150px]">
                          {item.name}
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
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
