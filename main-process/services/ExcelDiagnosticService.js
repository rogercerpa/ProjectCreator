// ExcelDiagnosticService - Debug Excel file structure
const XLSX = require('xlsx');

class ExcelDiagnosticService {
  
  // Create detailed diagnostic of Excel file
  async diagnoseExcelFile(filePath) {
    try {
      console.log('🔍 Starting Excel file diagnosis:', filePath);
      
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      console.log('📊 Workbook sheets:', workbook.SheetNames);
      
      const diagnosis = {
        fileName: filePath.split(/[\\/]/).pop(),
        allSheets: workbook.SheetNames,
        totalSheets: workbook.SheetNames.length,
        sheetAnalysis: []
      };

      // Analyze all sheets to find the one with agency data
      for (const sheetName of workbook.SheetNames) {
        console.log(`\n🔍 Analyzing sheet: ${sheetName}`);
        
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet['!ref']) {
          diagnosis.sheetAnalysis.push({
            sheetName,
            isEmpty: true,
            reason: 'No data range found'
          });
          continue;
        }
        
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        const totalRows = range.e.r + 1;
        const totalCols = range.e.c + 1;
        
        // Quick analysis of first few rows
        const rowAnalysis = [];
        let hasAgencyLikeData = false;
        let possibleHeaderRow = -1;
        
        for (let row = range.s.r; row <= Math.min(range.s.r + 9, range.e.r); row++) {
          const rowData = [];
          let contentCount = 0;
          
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];
            const cellValue = cell ? (cell.v || cell.w || '') : '';
            
            if (cellValue) {
              contentCount++;
              rowData.push(cellValue);
            }
          }
          
          const isPossibleHeader = this.isPossibleHeaderRow(rowData);
          const hasAgencyData = this.hasAgencyLikeData(rowData);
          
          if (isPossibleHeader && possibleHeaderRow === -1) {
            possibleHeaderRow = row;
          }
          
          if (hasAgencyData) {
            hasAgencyLikeData = true;
          }
          
          rowAnalysis.push({
            rowNumber: row + 1,
            contentCount,
            values: rowData.slice(0, 5),
            isPossibleHeader,
            hasAgencyData
          });
        }
        
        // Score this sheet for agency data likelihood
        let agencyScore = 0;
        if (hasAgencyLikeData) agencyScore += 50;
        if (possibleHeaderRow >= 0) agencyScore += 30;
        if (totalCols >= 5) agencyScore += 10; // Agency data should have multiple columns
        if (totalRows >= 10) agencyScore += 10; // Should have reasonable amount of data
        
        // Penalize obvious non-data sheets
        const lowerSheetName = sheetName.toLowerCase();
        if (lowerSheetName.includes('readme') || lowerSheetName.includes('instructions') || 
            lowerSheetName.includes('notes') || lowerSheetName.includes('info')) {
          agencyScore -= 100;
        }
        
        diagnosis.sheetAnalysis.push({
          sheetName,
          totalRows,
          totalCols,
          range,
          rowAnalysis,
          hasAgencyLikeData,
          possibleHeaderRow: possibleHeaderRow >= 0 ? possibleHeaderRow + 1 : -1,
          agencyScore,
          isEmpty: false
        });
        
        console.log(`Sheet ${sheetName}: ${totalRows}x${totalCols}, score: ${agencyScore}, header: row ${possibleHeaderRow + 1}`);
      }
      
      // Find the best sheet for agency data
      const bestSheet = diagnosis.sheetAnalysis
        .filter(sheet => !sheet.isEmpty)
        .sort((a, b) => b.agencyScore - a.agencyScore)[0];
      
      if (bestSheet) {
        diagnosis.recommendedSheet = bestSheet.sheetName;
        diagnosis.recommendedHeaderRow = bestSheet.possibleHeaderRow;
        
        // Do detailed analysis of the best sheet
        const worksheet = workbook.Sheets[bestSheet.sheetName];
        const range = bestSheet.range;
        
        // Do detailed analysis of the best sheet
        console.log(`\n📋 Detailed analysis of best sheet: ${bestSheet.sheetName}`);
        
        for (let row = range.s.r; row <= Math.min(range.s.r + 14, range.e.r); row++) {
          const rowData = [];
          let contentCount = 0;
          
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];
            const cellValue = cell ? (cell.v || cell.w || '') : '';
            
            if (cellValue) {
              contentCount++;
              rowData.push(cellValue);
            }
          }
          
          diagnosis.detailedAnalysis.rowAnalysis.push({
            rowNumber: row + 1,
            contentCount,
            values: rowData.slice(0, 5),
            nonEmptyValues: rowData,
            possibleHeader: this.isPossibleHeaderRow(rowData)
          });
        }
        
        // Try different parsing methods on the best sheet
        diagnosis.detailedAnalysis.parsingAttempts = await this.tryDifferentParsingMethods(worksheet, range);
      }

      return {
        success: true,
        diagnosis: diagnosis,
        recommendations: this.generateRecommendations(diagnosis)
      };

    } catch (error) {
      console.error('Error diagnosing Excel file:', error);
      return {
        success: false,
        error: error.message,
        diagnosis: null
      };
    }
  }

  // Check if a row looks like headers
  isPossibleHeaderRow(values) {
    const nonEmpty = values.filter(v => v && v.toString().trim());
    if (nonEmpty.length < 3) return false;

    const headerKeywords = [
      'agency', 'name', 'contact', 'email', 'phone', 'number', 
      'role', 'region', 'main', 'sae', 'address', 'company'
    ];

    const matchCount = nonEmpty.filter(value => {
      const str = value.toString().toLowerCase();
      return headerKeywords.some(keyword => str.includes(keyword));
    }).length;

    return matchCount >= 2; // At least 2 header-like fields
  }

  // Check if a value looks like a column header
  isLikelyColumnHeader(value) {
    if (!value) return false;
    const str = value.toString().toLowerCase().trim();
    
    const headerPatterns = [
      'agency number', 'agency name', 'contact name', 'contact email',
      'contact number', 'phone number', 'role', 'region', 'main contact', 'sae'
    ];

    return headerPatterns.some(pattern => 
      str.includes(pattern) || pattern.includes(str)
    );
  }

  // Check if row data looks like agency information
  hasAgencyLikeData(values) {
    if (!values || values.length < 3) return false;
    
    // Look for patterns that suggest agency data
    const hasEmail = values.some(v => v && v.toString().includes('@'));
    const hasPhone = values.some(v => v && /\d{3}[\-\.\s]?\d{3}[\-\.\s]?\d{4}/.test(v.toString()));
    const hasCompanyName = values.some(v => {
      if (!v) return false;
      const str = v.toString();
      return str.length > 10 && /[a-zA-Z]/.test(str) && 
             (str.includes('Inc') || str.includes('LLC') || str.includes('Corp') || 
              str.includes('Company') || str.includes('Agency') || str.includes('Electric') ||
              str.includes('Lighting') || str.includes('Sales') || str.includes('&'));
    });
    
    return hasEmail || hasPhone || hasCompanyName;
  }

  // Try different parsing methods
  async tryDifferentParsingMethods(worksheet, range) {
    const attempts = [];

    // Method 1: Default XLSX parsing
    try {
      const data1 = XLSX.utils.sheet_to_json(worksheet);
      attempts.push({
        method: 'Default XLSX.utils.sheet_to_json',
        success: true,
        rowCount: data1.length,
        columns: data1.length > 0 ? Object.keys(data1[0]) : [],
        sampleData: data1.slice(0, 2)
      });
    } catch (error) {
      attempts.push({
        method: 'Default XLSX.utils.sheet_to_json',
        success: false,
        error: error.message
      });
    }

    // Method 2: Starting from different rows
    for (let startRow = 0; startRow <= 5; startRow++) {
      try {
        const data = XLSX.utils.sheet_to_json(worksheet, { range: startRow });
        attempts.push({
          method: `sheet_to_json starting from row ${startRow + 1}`,
          success: true,
          rowCount: data.length,
          columns: data.length > 0 ? Object.keys(data[0]) : [],
          sampleData: data.slice(0, 1)
        });
      } catch (error) {
        attempts.push({
          method: `sheet_to_json starting from row ${startRow + 1}`,
          success: false,
          error: error.message
        });
      }
    }

    // Method 3: Raw cell reading
    try {
      const rawData = [];
      for (let row = range.s.r; row <= Math.min(range.s.r + 5, range.e.r); row++) {
        const rowData = {};
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          const cellValue = cell ? (cell.v || cell.w || '') : '';
          rowData[`Col_${col}`] = cellValue;
        }
        rawData.push(rowData);
      }
      
      attempts.push({
        method: 'Raw cell-by-cell reading',
        success: true,
        rowCount: rawData.length,
        columns: Object.keys(rawData[0] || {}),
        sampleData: rawData.slice(0, 2)
      });
    } catch (error) {
      attempts.push({
        method: 'Raw cell-by-cell reading',
        success: false,
        error: error.message
      });
    }

    return attempts;
  }

  // Generate recommendations
  generateRecommendations(diagnosis) {
    const recommendations = [];

    if (diagnosis.recommendedHeaderRow >= 0) {
      recommendations.push({
        type: 'header',
        message: `Use row ${diagnosis.recommendedHeaderRow + 1} as headers, start data from row ${diagnosis.recommendedDataStart + 1}`
      });
    } else {
      recommendations.push({
        type: 'warning',
        message: 'No clear header row detected. Data might be in an unexpected format.'
      });
    }

    const successfulMethods = diagnosis.parsingAttempts.filter(a => a.success && a.rowCount > 0);
    if (successfulMethods.length > 0) {
      const best = successfulMethods.reduce((prev, current) => 
        current.rowCount > prev.rowCount ? current : prev
      );
      recommendations.push({
        type: 'parsing',
        message: `Best parsing method: ${best.method} (${best.rowCount} rows, ${best.columns.length} columns)`
      });
    }

    if (diagnosis.totalRows < 5) {
      recommendations.push({
        type: 'warning',
        message: 'File has very few rows. Check if this is the correct sheet or file.'
      });
    }

    return recommendations;
  }
}

module.exports = ExcelDiagnosticService;
