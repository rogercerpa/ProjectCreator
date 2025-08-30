const { ipcRenderer } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const officegen = require('officegen');
const docx = require('docx');
const mammoth = require('mammoth');

class WordService {
  constructor() {
    this.config = {
      templates: {
        designNotes: 'Design Notes and Assumptions.docx',
        projectNotes: 'PROJECT NOTES (TEMPLATE).docx',
        agentRequirements: 'Agent Requirements.docx'
      }
    };
  }

  // Create a new Word document
  async createDocument() {
    try {
      const doc = officegen('docx');
      
      return {
        success: true,
        document: doc,
        message: 'Word document created successfully'
      };
    } catch (error) {
      console.error('Error creating Word document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Open an existing Word document
  async openDocument(filePath) {
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new Error(`Document not found: ${filePath}`);
      }

      // Read the document content
      const buffer = await fs.readFile(filePath);
      
      // Parse the document content
      const result = await mammoth.extractRawText({ buffer });
      
      return {
        success: true,
        content: result.value,
        message: 'Document opened successfully',
        filePath
      };
    } catch (error) {
      console.error('Error opening Word document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Search and replace text in document
  async searchAndReplace(document, searchTerm, replaceTerm, options = {}) {
    try {
      const {
        matchWholeWord = true,
        matchCase = false,
        searchInHeaders = false
      } = options;

      let content = document.content || document;
      let replacementCount = 0;

      // Simple text replacement (in a real implementation, you'd use a proper Word library)
      const searchRegex = matchWholeWord 
        ? new RegExp(`\\b${searchTerm}\\b`, matchCase ? 'g' : 'gi')
        : new RegExp(searchTerm, matchCase ? 'g' : 'gi');

      if (searchRegex.test(content)) {
        content = content.replace(searchRegex, replaceTerm);
        replacementCount = (content.match(new RegExp(replaceTerm, 'g')) || []).length;
      }

      return {
        success: true,
        content,
        replacementCount,
        message: `Replaced ${replacementCount} occurrence(s) of "${searchTerm}" with "${replaceTerm}"`
      };
    } catch (error) {
      console.error('Error in search and replace:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Search and replace in headers
  async searchAndReplaceHeader(document, searchTerm, replaceTerm) {
    try {
      // In a real implementation, this would specifically target headers
      // For now, we'll do a general search and replace
      return await this.searchAndReplace(document, searchTerm, replaceTerm, {
        searchInHeaders: true
      });
    } catch (error) {
      console.error('Error in header search and replace:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Insert file content into document
  async insertFile(document, filePath, insertPosition = 'end') {
    try {
      if (!(await fs.pathExists(filePath))) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Read the file to insert
      const fileContent = await fs.readFile(filePath, 'utf8');
      
      let newContent = document.content || document;
      
      if (insertPosition === 'end') {
        newContent += '\n' + fileContent;
      } else if (insertPosition === 'start') {
        newContent = fileContent + '\n' + newContent;
      } else {
        // Insert at specific position
        const lines = newContent.split('\n');
        lines.splice(insertPosition, 0, fileContent);
        newContent = lines.join('\n');
      }

      return {
        success: true,
        content: newContent,
        message: 'File content inserted successfully'
      };
    } catch (error) {
      console.error('Error inserting file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Save document
  async saveDocument(document, filePath, options = {}) {
    try {
      const {
        format = 'docx',
        overwrite = false
      } = options;

      if (await fs.pathExists(filePath) && !overwrite) {
        throw new Error(`File already exists: ${filePath}`);
      }

      // Ensure directory exists
      await fs.ensureDir(path.dirname(filePath));

      if (format === 'docx') {
        // Save as DOCX using officegen
        return new Promise((resolve, reject) => {
          const out = fs.createWriteStream(filePath);
          
          out.on('error', (err) => {
            reject({
              success: false,
              error: err.message
            });
          });

          out.on('close', () => {
            resolve({
              success: true,
              filePath,
              message: 'Document saved successfully'
            });
          });

          document.generate(out);
        });
      } else {
        // For other formats, save as text for now
        await fs.writeFile(filePath, document.content || document, 'utf8');
        
        return {
          success: true,
          filePath,
          message: 'Document saved successfully'
        };
      }
    } catch (error) {
      console.error('Error saving document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process Design Notes and Assumptions document
  async processDesignNotes(projectData, documentPath) {
    try {
      // Open the document
      const openResult = await this.openDocument(documentPath);
      if (!openResult.success) {
        throw new Error(openResult.error);
      }

      let document = openResult;

      // Insert agent requirements if available
      const agentRequirementsPath = path.join(
        '\\\\10.3.10.30\\DAS\\Agent Requirements',
        `${projectData.agentNumber}.docx`
      );

      if (await fs.pathExists(agentRequirementsPath)) {
        const insertResult = await this.insertFile(document, agentRequirementsPath);
        if (insertResult.success) {
          document = insertResult;
        }
      } else {
        // Use general requirements if specific agent file not found
        const generalRequirementsPath = path.join(
          '\\\\10.3.10.30\\DAS\\Agent Requirements',
          'General.docx'
        );
        
        if (await fs.pathExists(generalRequirementsPath)) {
          const insertResult = await this.insertFile(document, generalRequirementsPath);
          if (insertResult.success) {
            document = insertResult;
          }
        }
      }

      // Search and replace project information
      const replacements = [
        { search: 'PROJECT NAME:', replace: `PROJECT NAME: ${projectData.projectName}` },
        { search: 'PROJECT CONTAINER:', replace: `PROJECT CONTAINER: ${projectData.projectContainer}` },
        { search: 'RFA #:', replace: `RFA #: ${projectData.rfaNumber}` }
      ];

      for (const replacement of replacements) {
        // Replace in headers
        const headerResult = await this.searchAndReplaceHeader(
          document, 
          replacement.search, 
          replacement.replace
        );
        
        if (headerResult.success) {
          document = headerResult;
        }

        // Replace in body
        const bodyResult = await this.searchAndReplace(
          document, 
          replacement.search, 
          replacement.replace
        );
        
        if (bodyResult.success) {
          document = bodyResult;
        }
      }

      return {
        success: true,
        document,
        message: 'Design Notes document processed successfully'
      };
    } catch (error) {
      console.error('Error processing Design Notes:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process Agent Requirements document
  async processAgentRequirements(projectData, documentPath) {
    try {
      // Open the document
      const openResult = await this.openDocument(documentPath);
      if (!openResult.success) {
        throw new Error(openResult.error);
      }

      let document = openResult;

      // Search and replace project information in headers
      const headerReplacements = [
        { search: 'PROJECT NAME:', replace: `PROJECT NAME: ${projectData.projectName}` },
        { search: 'PROJECT CONTAINER:', replace: `PROJECT CONTAINER: ${projectData.projectContainer}` },
        { search: 'RFA #:', replace: `RFA #: ${projectData.rfaNumber}` }
      ];

      for (const replacement of headerReplacements) {
        const result = await this.searchAndReplaceHeader(
          document, 
          replacement.search, 
          replacement.replace
        );
        
        if (result.success) {
          document = result;
        }
      }

      // Search and replace project information in body
      const bodyReplacements = [
        { search: 'PROJECT NAME:', replace: `PROJECT NAME: ${projectData.projectName}` },
        { search: 'PROJECT CONTAINER:', replace: `PROJECT CONTAINER: ${projectData.projectContainer}` },
        { search: 'RFA #:', replace: `RFA #: ${projectData.rfaNumber}` }
      ];

      for (const replacement of bodyReplacements) {
        const result = await this.searchAndReplace(
          document, 
          replacement.search, 
          replacement.replace
        );
        
        if (result.success) {
          document = result;
        }
      }

      return {
        success: true,
        document,
        message: 'Agent Requirements document processed successfully'
      };
    } catch (error) {
      console.error('Error processing Agent Requirements:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create a new document with project information
  async createProjectDocument(projectData, templateType = 'designNotes') {
    try {
      // Create new document
      const createResult = await this.createDocument();
      if (!createResult.success) {
        throw new Error(createResult.error);
      }

      let document = createResult.document;

      // Add project information
      const projectInfo = [
        `PROJECT NAME: ${projectData.projectName}`,
        `PROJECT CONTAINER: ${projectData.projectContainer}`,
        `RFA #: ${projectData.rfaNumber}`,
        `RFA TYPE: ${projectData.rfaType}`,
        `AGENT #: ${projectData.agentNumber}`,
        `REGIONAL TEAM: ${projectData.regionalTeam}`,
        `CREATED DATE: ${new Date().toLocaleDateString()}`,
        '',
        'PROJECT DESCRIPTION:',
        projectData.description || 'No description provided',
        '',
        'NOTES:',
        projectData.notes || 'No notes provided'
      ];

      // Add content to document
      document.content = projectInfo.join('\n');

      return {
        success: true,
        document,
        message: 'Project document created successfully'
      };
    } catch (error) {
      console.error('Error creating project document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Convert document to different format
  async convertDocument(document, targetFormat) {
    try {
      switch (targetFormat.toLowerCase()) {
        case 'pdf':
          // Note: PDF conversion would require additional libraries
          return {
            success: false,
            error: 'PDF conversion not yet implemented'
          };
          
        case 'txt':
          const textContent = document.content || document;
          return {
            success: true,
            content: textContent,
            format: 'txt',
            message: 'Document converted to text successfully'
          };
          
        case 'html':
          // Convert to HTML (basic conversion)
          const htmlContent = this.convertToHTML(document.content || document);
          return {
            success: true,
            content: htmlContent,
            format: 'html',
            message: 'Document converted to HTML successfully'
          };
          
        default:
          return {
            success: false,
            error: `Unsupported format: ${targetFormat}`
          };
      }
    } catch (error) {
      console.error('Error converting document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Convert text to HTML
  convertToHTML(text) {
    const lines = text.split('\n');
    let html = '<html><body>';
    
    for (const line of lines) {
      if (line.trim() === '') {
        html += '<br>';
      } else if (line.startsWith('PROJECT NAME:') || 
                 line.startsWith('PROJECT CONTAINER:') || 
                 line.startsWith('RFA #:')) {
        html += `<h3>${line}</h3>`;
      } else if (line.startsWith('PROJECT DESCRIPTION:') || 
                 line.startsWith('NOTES:')) {
        html += `<h4>${line}</h4>`;
      } else {
        html += `<p>${line}</p>`;
      }
    }
    
    html += '</body></html>';
    return html;
  }

  // Get document statistics
  async getDocumentStats(document) {
    try {
      const content = document.content || document;
      const lines = content.split('\n');
      const words = content.split(/\s+/).filter(word => word.length > 0);
      const characters = content.length;
      const charactersNoSpaces = content.replace(/\s/g, '').length;

      return {
        success: true,
        stats: {
          lines: lines.length,
          words: words.length,
          characters,
          charactersNoSpaces,
          paragraphs: lines.filter(line => line.trim() === '').length + 1
        },
        message: 'Document statistics calculated successfully'
      };
    } catch (error) {
      console.error('Error calculating document statistics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Find and replace multiple terms
  async batchReplace(document, replacements) {
    try {
      let currentDocument = document;
      let totalReplacements = 0;

      for (const replacement of replacements) {
        const result = await this.searchAndReplace(
          currentDocument,
          replacement.search,
          replacement.replace,
          replacement.options || {}
        );

        if (result.success) {
          currentDocument = result;
          totalReplacements += result.replacementCount || 0;
        }
      }

      return {
        success: true,
        document: currentDocument,
        totalReplacements,
        message: `Batch replacement completed: ${totalReplacements} total replacements`
      };
    } catch (error) {
      console.error('Error in batch replacement:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Extract text from document
  async extractText(document, options = {}) {
    try {
      const {
        includeHeaders = true,
        includeFooters = true,
        includeComments = false
      } = options;

      let content = document.content || document;

      // In a real implementation, you'd parse the document structure
      // For now, we'll return the content as-is
      return {
        success: true,
        text: content,
        options: {
          includeHeaders,
          includeFooters,
          includeComments
        },
        message: 'Text extracted successfully'
      };
    } catch (error) {
      console.error('Error extracting text:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Close document (cleanup)
  async closeDocument(document) {
    try {
      // Clean up any resources
      if (document && typeof document.destroy === 'function') {
        document.destroy();
      }

      return {
        success: true,
        message: 'Document closed successfully'
      };
    } catch (error) {
      console.error('Error closing document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = WordService;
