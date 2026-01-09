/**
 * Script to generate the initial DASGeneral.xlsx template file
 * Run this script to create the Excel file at the default location
 * 
 * Usage: node scripts/generateDASGeneralTemplate.js [optional-output-path]
 */

const XLSX = require('xlsx');
const fs = require('fs-extra');
const path = require('path');

// Default products list
const DEFAULT_PRODUCTS = [
  'nLight Wired',
  'nLight Air',
  'SensorSwitch',
  'Pathway',
  'Fresco',
  'IOTA'
];

// Default output path
const DEFAULT_PATH = 'Z:\\DAS References\\ProjectCreatorV5\\DASGeneral.xlsx';

async function generateTemplate(outputPath) {
  try {
    const targetPath = outputPath || DEFAULT_PATH;
    
    console.log('📊 Generating DAS General Excel template...');
    console.log(`   Target: ${targetPath}`);

    // Ensure directory exists
    const dir = path.dirname(targetPath);
    await fs.ensureDir(dir);

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: TeamMembers
    console.log('   Creating TeamMembers sheet...');
    const teamMembersData = [
      ['Name', 'Email', 'Role', 'PhoneNumber'],
      // Sample data
      ['John Doe', 'john.doe@acuitybrands.com', 'Design Application Analyst', '555-0100'],
      ['Jane Smith', 'jane.smith@acuitybrands.com', 'Senior Design Application Analyst', '555-0101'],
    ];
    const teamMembersSheet = XLSX.utils.aoa_to_sheet(teamMembersData);
    // Set column widths
    teamMembersSheet['!cols'] = [
      { wch: 25 }, // Name
      { wch: 35 }, // Email
      { wch: 35 }, // Role
      { wch: 15 }, // PhoneNumber
    ];
    XLSX.utils.book_append_sheet(workbook, teamMembersSheet, 'TeamMembers');

    // Sheet 2: TrainingMaterial
    console.log('   Creating TrainingMaterial sheet...');
    const trainingMaterialData = [
      ['Product', 'LinkType', 'Link', 'Description'],
      ...DEFAULT_PRODUCTS.map(product => [
        product, 
        'URL', 
        '', 
        `Training materials for ${product}`
      ])
    ];
    const trainingMaterialSheet = XLSX.utils.aoa_to_sheet(trainingMaterialData);
    trainingMaterialSheet['!cols'] = [
      { wch: 20 }, // Product
      { wch: 12 }, // LinkType
      { wch: 60 }, // Link
      { wch: 40 }, // Description
    ];
    XLSX.utils.book_append_sheet(workbook, trainingMaterialSheet, 'TrainingMaterial');

    // Sheet 3: ProductsInfo
    console.log('   Creating ProductsInfo sheet...');
    const productsInfoData = [
      ['Product', 'MainPOC', 'POCEmail', 'ProductStrategy', 'DesignPracticeType', 'DesignPracticeContent'],
      ...DEFAULT_PRODUCTS.map(product => [
        product,
        '',
        '',
        `Strategy information for ${product}`,
        'Text',
        `Design best practices for ${product} will be documented here.`
      ])
    ];
    const productsInfoSheet = XLSX.utils.aoa_to_sheet(productsInfoData);
    productsInfoSheet['!cols'] = [
      { wch: 20 }, // Product
      { wch: 25 }, // MainPOC
      { wch: 35 }, // POCEmail
      { wch: 50 }, // ProductStrategy
      { wch: 18 }, // DesignPracticeType
      { wch: 60 }, // DesignPracticeContent
    ];
    XLSX.utils.book_append_sheet(workbook, productsInfoSheet, 'ProductsInfo');

    // Sheet 4: Products (dynamic product list)
    console.log('   Creating Products sheet...');
    const productsData = [
      ['ProductName'],
      ...DEFAULT_PRODUCTS.map(product => [product])
    ];
    const productsSheet = XLSX.utils.aoa_to_sheet(productsData);
    productsSheet['!cols'] = [
      { wch: 25 }, // ProductName
    ];
    XLSX.utils.book_append_sheet(workbook, productsSheet, 'Products');

    // Write the file
    XLSX.writeFile(workbook, targetPath);

    console.log('✅ DAS General Excel template created successfully!');
    console.log(`   Location: ${targetPath}`);
    console.log('');
    console.log('   Sheets created:');
    console.log('   - TeamMembers: Team member directory');
    console.log('   - TrainingMaterial: Training links per product');
    console.log('   - ProductsInfo: Product POC and design practices');
    console.log('   - Products: Dynamic product list');
    
    return { success: true, path: targetPath };
  } catch (error) {
    console.error('❌ Error generating template:', error.message);
    
    if (error.code === 'ENOENT') {
      console.error('   The target directory does not exist or is not accessible.');
      console.error('   Please ensure the Z: drive is connected.');
    } else if (error.code === 'EACCES' || error.code === 'EPERM') {
      console.error('   Permission denied. Please check your access rights.');
    }
    
    return { success: false, error: error.message };
  }
}

// Run if called directly
if (require.main === module) {
  const customPath = process.argv[2];
  generateTemplate(customPath).then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { generateTemplate, DEFAULT_PRODUCTS, DEFAULT_PATH };
