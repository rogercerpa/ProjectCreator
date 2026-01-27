/**
 * ReportExportService - Handles exporting analytics reports to various formats
 * Supports: Excel (.xlsx), CSV
 */

import { formatCurrency, formatPercentage, formatDurationDays } from '../utils/reportHelpers';

class ReportExportService {
  /**
   * Dynamically load xlsx library
   * @returns {Promise<Object>} The xlsx library
   */
  async _loadXLSX() {
    // Use xlsx.mjs ES module entry point for better bundler compatibility
    const xlsxModule = await import('xlsx/xlsx.mjs');
    // Handle different module formats - CommonJS wrapped by bundler vs ES module
    const xlsx = xlsxModule.default || xlsxModule;
    
    // Verify the library loaded correctly
    if (!xlsx.utils || !xlsx.write) {
      console.error('XLSX module structure:', Object.keys(xlsxModule));
      throw new Error('XLSX library structure is invalid');
    }
    
    return xlsx;
  }

  /**
   * Dynamically load file-saver library
   * @returns {Promise<Function>} The saveAs function
   */
  async _loadSaveAs() {
    const fileSaverModule = await import('file-saver');
    // Handle different module formats
    const saveAs = fileSaverModule.saveAs || fileSaverModule.default?.saveAs || fileSaverModule.default;
    
    if (typeof saveAs !== 'function') {
      console.error('FileSaver module structure:', Object.keys(fileSaverModule));
      throw new Error('file-saver saveAs function not found');
    }
    
    return saveAs;
  }

  /**
   * Export report data to Excel with multiple sheets
   * @param {Object} reportData - The report data from ReportDataService
   * @param {Object} reportSettings - The current report settings (date range, filters)
   * @param {Array} projects - Raw project data for detailed export
   * @returns {Promise<void>}
   */
  async exportToExcel(reportData, reportSettings, projects = []) {
    try {
      // Load dependencies dynamically
      const XLSX = await this._loadXLSX();
      const saveAs = await this._loadSaveAs();
      
      const workbook = XLSX.utils.book_new();
      
      // Sheet 1: Summary
      const summaryData = this.createSummarySheet(reportData, reportSettings);
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      this.setColumnWidths(summarySheet, [30, 20, 20]);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Sheet 2: RFA Type Distribution
      if (reportData.charts?.rfaTypeDistribution?.length > 0) {
        const rfaTypeData = this.createChartDataSheet(
          reportData.charts.rfaTypeDistribution,
          ['RFA Type', 'Count'],
          'RFA Type Distribution'
        );
        const rfaTypeSheet = XLSX.utils.aoa_to_sheet(rfaTypeData);
        this.setColumnWidths(rfaTypeSheet, [30, 15]);
        XLSX.utils.book_append_sheet(workbook, rfaTypeSheet, 'By RFA Type');
      }

      // Sheet 3: Regional Distribution
      if (reportData.charts?.regionalDistribution?.length > 0) {
        const regionalData = this.createChartDataSheet(
          reportData.charts.regionalDistribution,
          ['Region', 'Projects'],
          'Regional Distribution'
        );
        const regionalSheet = XLSX.utils.aoa_to_sheet(regionalData);
        this.setColumnWidths(regionalSheet, [20, 15]);
        XLSX.utils.book_append_sheet(workbook, regionalSheet, 'By Region');
      }

      // Sheet 4: Top Agencies
      if (reportData.charts?.topAgencies?.length > 0) {
        const agencyData = this.createChartDataSheet(
          reportData.charts.topAgencies,
          ['Agency', 'Projects'],
          'Top Agencies'
        );
        const agencySheet = XLSX.utils.aoa_to_sheet(agencyData);
        this.setColumnWidths(agencySheet, [40, 15]);
        XLSX.utils.book_append_sheet(workbook, agencySheet, 'Top Agencies');
      }

      // Sheet 5: Team Performance
      if (reportData.teamPerformance) {
        const teamData = this.createTeamPerformanceSheet(reportData.teamPerformance);
        const teamSheet = XLSX.utils.aoa_to_sheet(teamData);
        this.setColumnWidths(teamSheet, [25, 10, 5, 25, 10, 5, 25, 10]);
        XLSX.utils.book_append_sheet(workbook, teamSheet, 'Team Performance');
      }

      // Sheet 6: DAS Revenue
      if (reportData.dasRevenue) {
        const revenueData = this.createDASRevenueSheet(reportData.dasRevenue);
        const revenueSheet = XLSX.utils.aoa_to_sheet(revenueData);
        this.setColumnWidths(revenueSheet, [25, 20, 15]);
        XLSX.utils.book_append_sheet(workbook, revenueSheet, 'DAS Revenue');
      }

      // Sheet 7: RFA Value Distribution
      if (reportData.rfaValue) {
        const rfaValueData = this.createRFAValueSheet(reportData.rfaValue);
        const rfaValueSheet = XLSX.utils.aoa_to_sheet(rfaValueData);
        this.setColumnWidths(rfaValueSheet, [25, 20]);
        XLSX.utils.book_append_sheet(workbook, rfaValueSheet, 'RFA Value');
      }

      // Sheet 8: All Projects (if projects data provided)
      if (projects.length > 0) {
        const projectsData = this.createProjectsSheet(projects);
        const projectsSheet = XLSX.utils.aoa_to_sheet(projectsData);
        this.setColumnWidths(projectsSheet, [15, 30, 20, 15, 15, 15, 15, 15, 20, 20, 20]);
        XLSX.utils.book_append_sheet(workbook, projectsSheet, 'All Projects');
      }

      // Generate filename
      const fileName = this.generateFileName(reportSettings, 'xlsx');

      // Write and save
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, fileName);

      return { success: true, fileName };
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw new Error('Failed to export to Excel. Please try again.');
    }
  }

  /**
   * Export report data to CSV
   * @param {Object} reportData - The report data from ReportDataService
   * @param {Object} reportSettings - The current report settings
   * @param {Array} projects - Raw project data
   * @returns {Promise<void>}
   */
  async exportToCSV(reportData, reportSettings, projects = []) {
    try {
      // Load file-saver dynamically
      const saveAs = await this._loadSaveAs();
      
      // CSV will contain summary + all projects data
      const csvData = [];
      
      // Add header with report info
      csvData.push(['Project Analytics Report']);
      csvData.push([`Date Range: ${this.formatDateRange(reportSettings.startDate, reportSettings.endDate)}`]);
      csvData.push([`View Mode: ${reportSettings.viewMode === 'created' ? 'By Created Date' : 'By Completed Date'}`]);
      csvData.push([`Total Projects: ${reportData.projectCount}`]);
      csvData.push([`Generated: ${new Date().toLocaleString()}`]);
      csvData.push([]);

      // Add KPIs section
      csvData.push(['=== KEY PERFORMANCE INDICATORS ===']);
      csvData.push(['Metric', 'Value', 'Change vs Prior']);
      csvData.push(['Total Projects', reportData.kpis?.totalProjects?.value || 0, reportData.kpis?.totalProjects?.change?.formatted || 'N/A']);
      csvData.push(['Completed Projects', reportData.kpis?.completedProjects?.value || 0, reportData.kpis?.completedProjects?.change?.formatted || 'N/A']);
      csvData.push(['RFA Value', formatCurrency(reportData.kpis?.totalRfaValue?.value || 0), reportData.kpis?.totalRfaValue?.change?.formatted || 'N/A']);
      csvData.push(['DAS Revenue', formatCurrency(reportData.kpis?.totalDasRevenue?.value || 0), reportData.kpis?.totalDasRevenue?.change?.formatted || 'N/A']);
      csvData.push(['Avg Turnaround', formatDurationDays(reportData.kpis?.avgTurnaroundTime?.value || 0), reportData.kpis?.avgTurnaroundTime?.change?.formatted || 'N/A']);
      csvData.push(['On-Time Rate', formatPercentage(reportData.kpis?.onTimeRate?.value || 0), reportData.kpis?.onTimeRate?.change?.formatted || 'N/A']);
      csvData.push([]);

      // Add projects data if available
      if (projects.length > 0) {
        csvData.push(['=== PROJECT DETAILS ===']);
        csvData.push([
          'Project ID',
          'Agency',
          'RFA Type',
          'Region',
          'Status',
          'RFA Value',
          'DAS Fee',
          'Designer',
          'QC',
          'Triage',
          'Created Date',
          'Completed Date'
        ]);

        projects.forEach(project => {
          csvData.push([
            project.projectNumber || project.projectId || '',
            project.agencyName || project.agency || '',
            project.rfaType || '',
            project.region || '',
            project.status || '',
            project.rfaValue || 0,
            project.dasFee || project.dasRevenue || 0,
            project.designer || '',
            project.qc || '',
            project.triage || '',
            project.createdDate ? new Date(project.createdDate).toLocaleDateString() : '',
            project.completedDate ? new Date(project.completedDate).toLocaleDateString() : ''
          ]);
        });
      }

      // Generate filename
      const fileName = this.generateFileName(reportSettings, 'csv');

      // Convert to CSV string
      const csvContent = csvData.map(row => 
        row.map(cell => {
          // Escape cells that contain commas or quotes
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      ).join('\n');

      // Save file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      saveAs(blob, fileName);

      return { success: true, fileName };
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw new Error('Failed to export to CSV. Please try again.');
    }
  }

  // Helper methods

  createSummarySheet(reportData, reportSettings) {
    const data = [
      ['Project Analytics Report Summary'],
      [],
      ['Report Information'],
      ['Date Range', this.formatDateRange(reportSettings.startDate, reportSettings.endDate)],
      ['View Mode', reportSettings.viewMode === 'created' ? 'By Created Date' : 'By Completed Date'],
      ['Total Projects Analyzed', reportData.projectCount || 0],
      ['Generated On', new Date().toLocaleString()],
      [],
      ['Key Performance Indicators', 'Value', 'Change vs Prior'],
      ['Total Projects', reportData.kpis?.totalProjects?.value || 0, reportData.kpis?.totalProjects?.change?.formatted || 'N/A'],
      ['Completed Projects', reportData.kpis?.completedProjects?.value || 0, reportData.kpis?.completedProjects?.change?.formatted || 'N/A'],
      ['Completion Rate', formatPercentage(reportData.kpis?.completedProjects?.rate || 0), ''],
      ['Total RFA Value', formatCurrency(reportData.kpis?.totalRfaValue?.value || 0), reportData.kpis?.totalRfaValue?.change?.formatted || 'N/A'],
      ['Total DAS Revenue', formatCurrency(reportData.kpis?.totalDasRevenue?.value || 0), reportData.kpis?.totalDasRevenue?.change?.formatted || 'N/A'],
      ['DAS Services Count', reportData.kpis?.totalDasRevenue?.count || 0, ''],
      ['Avg Turnaround Time', formatDurationDays(reportData.kpis?.avgTurnaroundTime?.value || 0), reportData.kpis?.avgTurnaroundTime?.change?.formatted || 'N/A'],
      ['On-Time Rate', formatPercentage(reportData.kpis?.onTimeRate?.value || 0), reportData.kpis?.onTimeRate?.change?.formatted || 'N/A'],
    ];

    // Add active filters if any
    const filters = reportSettings.filters;
    const activeFilters = [];
    if (filters?.rfaTypes?.length) activeFilters.push(`RFA Types: ${filters.rfaTypes.join(', ')}`);
    if (filters?.regions?.length) activeFilters.push(`Regions: ${filters.regions.join(', ')}`);
    if (filters?.statuses?.length) activeFilters.push(`Statuses: ${filters.statuses.join(', ')}`);
    if (filters?.agencies?.length) activeFilters.push(`Agencies: ${filters.agencies.join(', ')}`);
    if (filters?.designer) activeFilters.push(`Designer: ${filters.designer}`);
    if (filters?.qc) activeFilters.push(`QC: ${filters.qc}`);
    if (filters?.triage) activeFilters.push(`Triage: ${filters.triage}`);

    if (activeFilters.length > 0) {
      data.push([]);
      data.push(['Active Filters']);
      activeFilters.forEach(filter => data.push([filter]));
    }

    return data;
  }

  createChartDataSheet(chartData, headers, title) {
    const data = [
      [title],
      [],
      headers,
      ...chartData.map(item => [item.name, item.value])
    ];
    return data;
  }

  createTeamPerformanceSheet(teamPerformance) {
    const maxRows = Math.max(
      teamPerformance.byDesigner?.length || 0,
      teamPerformance.byQC?.length || 0,
      teamPerformance.byTriage?.length || 0
    );

    const data = [
      ['Team Performance'],
      [],
      ['Designer', 'Count', '', 'QC', 'Count', '', 'Triage', 'Count']
    ];

    for (let i = 0; i < maxRows; i++) {
      const designer = teamPerformance.byDesigner?.[i];
      const qc = teamPerformance.byQC?.[i];
      const triage = teamPerformance.byTriage?.[i];
      
      data.push([
        designer?.name || '',
        designer?.value || '',
        '',
        qc?.name || '',
        qc?.value || '',
        '',
        triage?.name || '',
        triage?.value || ''
      ]);
    }

    return data;
  }

  createDASRevenueSheet(dasRevenue) {
    const data = [
      ['DAS Revenue Breakdown'],
      [],
      ['Summary'],
      ['Total Revenue', formatCurrency(dasRevenue.totalRevenue || 0)],
      ['Paid Services Count', dasRevenue.totalCount || 0],
      ['Average Fee', formatCurrency(dasRevenue.avgFee || 0)],
      [],
      ['By Status', 'Revenue', 'Count']
    ];

    if (dasRevenue.byStatus?.length > 0) {
      dasRevenue.byStatus.forEach(item => {
        data.push([item.name, formatCurrency(item.revenue || 0), item.count || 0]);
      });
    }

    return data;
  }

  createRFAValueSheet(rfaValue) {
    const data = [
      ['RFA Value Distribution'],
      [],
      ['Summary'],
      ['Total Value', formatCurrency(rfaValue.total || 0)],
      ['Average per Project', formatCurrency(rfaValue.average || 0)],
      [],
      ['By Region', 'Value']
    ];

    if (rfaValue.byRegion?.length > 0) {
      rfaValue.byRegion.forEach(item => {
        data.push([item.name, formatCurrency(item.value || 0)]);
      });
    }

    data.push([]);
    data.push(['By RFA Type', 'Value']);

    if (rfaValue.byType?.length > 0) {
      rfaValue.byType.forEach(item => {
        data.push([item.name, formatCurrency(item.value || 0)]);
      });
    }

    return data;
  }

  createProjectsSheet(projects) {
    const data = [
      ['All Projects'],
      [],
      [
        'Project ID',
        'Agency',
        'RFA Type',
        'Region',
        'Status',
        'RFA Value',
        'DAS Fee',
        'Designer',
        'QC',
        'Triage',
        'Created Date',
        'Completed Date'
      ]
    ];

    projects.forEach(project => {
      data.push([
        project.projectNumber || project.projectId || '',
        project.agencyName || project.agency || '',
        project.rfaType || '',
        project.region || '',
        project.status || '',
        project.rfaValue || 0,
        project.dasFee || project.dasRevenue || 0,
        project.designer || '',
        project.qc || '',
        project.triage || '',
        project.createdDate ? new Date(project.createdDate).toLocaleDateString() : '',
        project.completedDate ? new Date(project.completedDate).toLocaleDateString() : ''
      ]);
    });

    return data;
  }

  setColumnWidths(sheet, widths) {
    sheet['!cols'] = widths.map(w => ({ wch: w }));
  }

  formatDateRange(startDate, endDate) {
    if (!startDate || !endDate) return 'All Time';
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  }

  generateFileName(reportSettings, extension) {
    const startStr = reportSettings.startDate 
      ? reportSettings.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(' ', '')
      : 'All';
    const endStr = reportSettings.endDate 
      ? reportSettings.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/[\s,]/g, '')
      : 'Time';
    return `Project_Analytics_Report_${startStr}-${endStr}.${extension}`;
  }
}

// Export singleton instance
const reportExportService = new ReportExportService();
export default reportExportService;
