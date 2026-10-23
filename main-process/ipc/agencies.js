// IPC handlers — Agencies, agency sync, and email templates.
// Registered from main.js; shared services arrive through the context object.
const { ipcMain, dialog, shell } = require('electron');
const fs = require('fs-extra');
const path = require('path');

module.exports = function registerAgenciesIpc(context) {
  const {
    agencyService,
    agencyProjectService,
    getMainWindow,
    excelDiagnosticService,
    agencySyncService,
    emailTemplateService
  } = context;
  // Agency operations
  ipcMain.handle('agencies-import-excel', async (event, filePath) => {
    try {
      return await agencyService.importFromExcel(filePath);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agencies-load-all', async () => {
    try {
      const agencies = await agencyService.loadAgencies();
      return {
        success: true,
        agencies: agencies,
        count: agencies.length,
        message: `${agencies.length} agencies loaded successfully`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agencies-search', async (event, searchTerm, filters) => {
    try {
      const agencies = await agencyService.searchAgencies(searchTerm, filters);
      return {
        success: true,
        agencies: agencies,
        count: agencies.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agencies-get-filter-options', async () => {
    try {
      const options = await agencyService.getFilterOptions();
      return {
        success: true,
        options: options
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agencies-add', async (event, agencyData) => {
    try {
      return await agencyService.addAgency(agencyData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agencies-update', async (event, agencyId, updates) => {
    try {
      return await agencyService.updateAgency(agencyId, updates);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agencies-delete', async (event, agencyId) => {
    try {
      return await agencyService.deleteAgency(agencyId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agencies-get-statistics', async () => {
    try {
      const statistics = await agencyService.getStatistics();
      return {
        success: true,
        statistics: statistics
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agencies-export-excel', async (event, outputPath) => {
    try {
      return await agencyService.exportToExcel(outputPath);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Agency Project operations
  ipcMain.handle('agency-projects-get-all', async (event, agencyName, agentNumber) => {
    try {
      return await agencyProjectService.getProjectsByAgency(agencyName, agentNumber);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agency-projects-get-active', async (event, agencyName, agentNumber) => {
    try {
      return await agencyProjectService.getActiveProjectsByAgency(agencyName, agentNumber);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agency-projects-get-recently-completed', async (event, agencyName, agentNumber, days) => {
    try {
      return await agencyProjectService.getRecentlyCompletedProjects(agencyName, agentNumber, days);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agency-projects-get-statistics', async (event, agencyName, agentNumber) => {
    try {
      return await agencyProjectService.getAgencyProjectStatistics(agencyName, agentNumber);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agency-projects-get-performance-metrics', async (event, agencyName, agentNumber) => {
    try {
      return await agencyProjectService.getAgencyPerformanceMetrics(agencyName, agentNumber);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Excel file selection for agency import
  ipcMain.handle('select-excel-file', async () => {
    try {
      const result = await dialog.showOpenDialog(getMainWindow(), {
        properties: ['openFile'],
        title: 'Select Excel File',
        filters: [
          { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled) {
        return { success: false, message: 'File selection cancelled' };
      }

      return {
        success: true,
        filePath: result.filePaths[0],
        message: 'File selected successfully'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Excel diagnostic endpoint
  ipcMain.handle('excel-diagnose', async (event, filePath) => {
    try {
      return await excelDiagnosticService.diagnoseExcelFile(filePath);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Sync operations
  ipcMain.handle('sync-get-settings', async () => {
    try {
      return await agencySyncService.getSyncSettings();
    } catch (error) {
      console.error('Error in sync-get-settings handler:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sync-update-settings', async (event, newSettings) => {
    try {
      return await agencySyncService.updateSyncSettings(newSettings);
    } catch (error) {
      console.error('Error in sync-update-settings handler:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sync-test-file-path', async (event, filePath) => {
    try {
      return await agencySyncService.testFilePath(filePath);
    } catch (error) {
      console.error('Error in sync-test-file-path handler:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sync-start-auto', async (event, filePath) => {
    try {
      return await agencySyncService.startAutoSync(filePath);
    } catch (error) {
      console.error('Error in sync-start-auto handler:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sync-stop-auto', async () => {
    try {
      return await agencySyncService.stopAutoSync();
    } catch (error) {
      console.error('Error in sync-stop-auto handler:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sync-manual', async (event, filePath) => {
    try {
      return await agencySyncService.manualSync(filePath);
    } catch (error) {
      console.error('Error in sync-manual handler:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sync-get-status', async () => {
    try {
      const status = agencySyncService.getSyncStatus();
      return { success: true, status };
    } catch (error) {
      console.error('Error in sync-get-status handler:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sync-export-to-excel', async (event, filePath, options = {}) => {
    try {
      return await agencySyncService.exportToExcel(filePath, options);
    } catch (error) {
      console.error('Error in sync-export-to-excel handler:', error);
      return { success: false, error: error.message };
    }
  });

  // Email template operations
  ipcMain.handle('email-templates-load-all', async () => {
    try {
      const templates = await emailTemplateService.loadTemplates();
      return {
        success: true,
        templates: templates,
        count: templates.length,
        message: `${templates.length} email templates loaded successfully`
      };
    } catch (error) {
      console.error('Error loading email templates:', error);
      return { success: false, error: error.message, templates: [] };
    }
  });

  ipcMain.handle('email-templates-create', async (event, templateData) => {
    try {
      return await emailTemplateService.createTemplate(templateData);
    } catch (error) {
      console.error('Error creating email template:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email-templates-update', async (event, templateId, updates) => {
    try {
      return await emailTemplateService.updateTemplate(templateId, updates);
    } catch (error) {
      console.error('Error updating email template:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email-templates-delete', async (event, templateId) => {
    try {
      return await emailTemplateService.deleteTemplate(templateId);
    } catch (error) {
      console.error('Error deleting email template:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email-templates-get', async (event, templateId) => {
    try {
      return await emailTemplateService.getTemplate(templateId);
    } catch (error) {
      console.error('Error getting email template:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email-templates-get-by-category', async (event, category) => {
    try {
      return await emailTemplateService.getTemplatesByCategory(category);
    } catch (error) {
      console.error('Error getting templates by category:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email-templates-get-categories', async () => {
    try {
      return await emailTemplateService.getTemplateCategories();
    } catch (error) {
      console.error('Error getting template categories:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email-templates-get-variables', async () => {
    try {
      const variables = emailTemplateService.getAvailableVariables();
      return { success: true, variables };
    } catch (error) {
      console.error('Error getting template variables:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email-templates-generate-personalized', async (event, templateId, agencyData) => {
    try {
      const templateResult = await emailTemplateService.getTemplate(templateId);
      if (!templateResult.success) {
        return templateResult;
      }

      return emailTemplateService.generatePersonalizedEmail(templateResult.template, agencyData);
    } catch (error) {
      console.error('Error generating personalized email:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email-templates-increment-usage', async (event, templateId) => {
    try {
      return await emailTemplateService.incrementUsageCount(templateId);
    } catch (error) {
      console.error('Error incrementing template usage:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email-templates-get-statistics', async () => {
    try {
      return await emailTemplateService.getTemplateStatistics();
    } catch (error) {
      console.error('Error getting template statistics:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email-templates-export', async (event, filePath) => {
    try {
      return await emailTemplateService.exportTemplates(filePath);
    } catch (error) {
      console.error('Error exporting email templates:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email-templates-import', async (event, filePath, options = {}) => {
    try {
      return await emailTemplateService.importTemplates(filePath, options);
    } catch (error) {
      console.error('Error importing email templates:', error);
      return { success: false, error: error.message };
    }
  });

  // Image processing for email templates
  ipcMain.handle('email-convert-image-to-base64', async (event, filePath) => {
    try {
      console.log('Converting image to base64:', filePath);

      // Read the image file as binary
      const imageBuffer = await fs.readFile(filePath);

      // Get file extension to determine MIME type
      const fileExtension = path.extname(filePath).toLowerCase().substring(1);
      const mimeType = getMimeTypeFromExtension(fileExtension);

      if (!mimeType) {
        throw new Error(`Unsupported image format: ${fileExtension}`);
      }

      // Convert to base64
      const base64Data = imageBuffer.toString('base64');

      // Create data URL
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      console.log(
        `Image converted successfully: ${filePath} (${fileExtension}, ${Math.round(base64Data.length / 1024)}KB)`
      );

      return {
        success: true,
        dataUrl: dataUrl,
        mimeType: mimeType,
        size: imageBuffer.length,
        fileName: path.basename(filePath)
      };
    } catch (error) {
      console.error('Error converting image to base64:', error);
      return { success: false, error: error.message };
    }
  });

  // Helper function to get MIME type from file extension
  function getMimeTypeFromExtension(extension) {
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      bmp: 'image/bmp',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      ico: 'image/x-icon'
    };

    return mimeTypes[extension.toLowerCase()] || null;
  }

  // Enhanced Outlook integration for template emails
  ipcMain.handle('email-open-outlook-with-template', async (event, emailData) => {
    try {
      const { subject, content, recipients } = emailData;

      // Create HTML formatted email content
      const htmlContent = content.replace(/\n/g, '<br>');

      // For template emails, we'll create a more sophisticated mailto URL
      // that includes HTML content if supported by the email client
      const recipientList = Array.isArray(recipients) ? recipients.join(';') : recipients;
      const encodedSubject = encodeURIComponent(subject);
      const encodedContent = encodeURIComponent(content); // Keep as plain text for mailto compatibility

      const mailtoUrl = `mailto:${recipientList}?subject=${encodedSubject}&body=${encodedContent}`;

      // Open in default email client
      await shell.openExternal(mailtoUrl);

      return {
        success: true,
        message: 'Email opened in Outlook',
        recipients: Array.isArray(recipients) ? recipients : [recipients]
      };
    } catch (error) {
      console.error('Error opening Outlook with template:', error);
      return { success: false, error: error.message };
    }
  });

  // Batch email opening for multiple agencies
  ipcMain.handle('email-open-outlook-batch', async (event, emailsData) => {
    try {
      console.log('=== DEBUG: Batch email handler called ===');
      console.log('Emails data received:', emailsData);
      console.log('Number of emails to process:', emailsData.length);

      const results = [];

      // Open each email individually to allow for personalization
      for (const emailData of emailsData) {
        try {
          console.log('Processing email data:', emailData);
          const { subject, content, recipient, agencyName } = emailData;

          if (!recipient) {
            console.error('No recipient found for email:', emailData);
            results.push({
              success: false,
              agencyName: agencyName || 'Unknown',
              recipient: 'None',
              error: 'No recipient email address'
            });
            continue;
          }

          // Handle images in email content for mailto URLs
          let processedContent = content || '';
          const hasImages = processedContent.includes('<img');

          if (hasImages) {
            // Remove img tags and replace with image placeholders for mailto compatibility
            processedContent = processedContent.replace(
              /<img[^>]*src="data:image\/[^"]*"[^>]*>/gi,
              '[IMAGE ATTACHMENT - Please attach images manually to this email]'
            );

            // Convert HTML to plain text for mailto
            processedContent = processedContent
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>/gi, '\n')
              .replace(/<p>/gi, '')
              .replace(/<[^>]*>/g, ''); // Remove any remaining HTML tags

            // Add note about images
            processedContent +=
              '\n\n--- Note: This email template contained images that need to be attached manually ---';
          } else {
            // Convert HTML to plain text for mailto
            processedContent = processedContent
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>/gi, '\n')
              .replace(/<p>/gi, '')
              .replace(/<[^>]*>/g, ''); // Remove any remaining HTML tags
          }

          const encodedSubject = encodeURIComponent(subject || '');
          const encodedContent = encodeURIComponent(processedContent);
          const mailtoUrl = `mailto:${recipient}?subject=${encodedSubject}&body=${encodedContent}`;

          console.log('Generated mailto URL length:', mailtoUrl.length);
          console.log('Has images:', hasImages);
          if (mailtoUrl.length > 2000) {
            console.warn('WARNING: mailto URL is very long (' + mailtoUrl.length + ' chars), may cause issues');
          }
          // Only log full URL if it's not too long to avoid console spam
          if (mailtoUrl.length < 500) {
            console.log('Generated mailto URL:', mailtoUrl);
          } else {
            console.log('Generated mailto URL (truncated):', mailtoUrl.substring(0, 200) + '...');
          }

          // Small delay between emails to avoid overwhelming the system
          await new Promise((resolve) => setTimeout(resolve, 500));

          await shell.openExternal(mailtoUrl);

          results.push({
            success: true,
            agencyName,
            recipient,
            message: `Email opened for ${agencyName}`
          });

          console.log('Email opened successfully for:', agencyName);
        } catch (emailError) {
          console.error('Error processing individual email:', emailError);
          results.push({
            success: false,
            agencyName: emailData.agencyName || 'Unknown',
            recipient: emailData.recipient || 'None',
            error: emailError.message
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      console.log('Batch email results:', {
        total: results.length,
        successful: successCount,
        failed: failCount,
        results: results
      });

      return {
        success: true,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failCount
        },
        message: `Opened ${successCount} emails successfully${failCount > 0 ? `, ${failCount} failed` : ''}`
      };
    } catch (error) {
      console.error('Error opening batch emails:', error);
      return { success: false, error: error.message };
    }
  });
};
