/**
 * Generate WorkloadTemplate.xlsx
 * This script creates the Excel template with all required sheets and columns
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs-extra');

console.log('Starting Excel template generation...');

// Create a new workbook
const workbook = XLSX.utils.book_new();

// ===== PROJECTS SHEET =====
const projectsData = [
  [
    'ProjectID',
    'ProjectNumber',
    'ProjectName',
    'RFANumber',
    'ProjectContainer',
    'ClientName',
    'ProjectType',
    'Status',
    'CreatedDate',
    'DueDate',
    'AssignedTo',
    'Priority',
    'FolderPath',
    'LastUpdated',
    'Notes',
    'Budget',
    'EstimatedHours',
    'ActualHours',
    'CompletionPercentage'
  ]
];

const projectsWorksheet = XLSX.utils.aoa_to_sheet(projectsData);
XLSX.utils.book_append_sheet(workbook, projectsWorksheet, 'Projects');

// ===== ASSIGNMENTS SHEET =====
const assignmentsData = [
  [
    'AssignmentID',
    'ProjectID',
    'ProjectNumber',
    'ProjectName',
    'RFANumber',
    'UserID',
    'UserName',
    'UserEmail',
    'StartDate',
    'DueDate',
    'HoursAllocated',
    'HoursWorked',
    'HoursRemaining',
    'Status',
    'Priority',
    'Notes',
    'LastUpdated',
    'CompletedDate'
  ]
];

const assignmentsWorksheet = XLSX.utils.aoa_to_sheet(assignmentsData);
XLSX.utils.book_append_sheet(workbook, assignmentsWorksheet, 'Assignments');

// ===== USERS SHEET =====
const usersData = [
  [
    'UserID',
    'UserName',
    'Email',
    'Role',
    'WeeklyCapacity',
    'Region',
    'Team',
    'IsActive',
    'LastSeen',
    'CurrentWorkload',
    'AvailableHours'
  ]
];

const usersWorksheet = XLSX.utils.aoa_to_sheet(usersData);
XLSX.utils.book_append_sheet(workbook, usersWorksheet, 'Users');

// ===== TIME TRACKING SHEET =====
const timeTrackingData = [
  [
    'EntryID',
    'AssignmentID',
    'ProjectID',
    'ProjectNumber',
    'ProjectName',
    'UserID',
    'UserName',
    'Date',
    'HoursWorked',
    'TaskDescription',
    'Notes',
    'EntryDate',
    'Category'
  ]
];

const timeTrackingWorksheet = XLSX.utils.aoa_to_sheet(timeTrackingData);
XLSX.utils.book_append_sheet(workbook, timeTrackingWorksheet, 'TimeTracking');

// Ensure the assets/templates directory exists
const outputDir = path.join(__dirname, '..', 'assets', 'templates');
fs.ensureDirSync(outputDir);

// Write the workbook to file
const outputPath = path.join(outputDir, 'WorkloadTemplate.xlsx');

try {
  console.log('Writing workbook to:', outputPath);
  XLSX.writeFile(workbook, outputPath);
  console.log('✅ WorkloadTemplate.xlsx created successfully at:', outputPath);
  console.log('');
  console.log('📋 Sheets created:');
  console.log('  - Projects (19 columns)');
  console.log('  - Assignments (18 columns)');
  console.log('  - Users (11 columns)');
  console.log('  - TimeTracking (13 columns)');
} catch (error) {
  console.error('❌ Error creating Excel file:', error);
  process.exit(1);
}

