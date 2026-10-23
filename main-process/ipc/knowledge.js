// IPC handlers — Training Hub, Spec Review, and the product knowledge base.
// Registered from main.js; shared services arrive through the context object.
const { ipcMain } = require('electron');
const path = require('path');
const os = require('os');

module.exports = function registerKnowledgeIpc(context) {
  const { trainingHubService, getMainWindow, specReviewService, specReviewPersistenceService, productKBService } =
    context;
  ipcMain.handle('training-hub:get-catalog', async (event, forceRefresh) => {
    try {
      return await trainingHubService.getCatalog(forceRefresh);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('training-hub:get-course', async (event, courseId) => {
    try {
      return await trainingHubService.getCourse(courseId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('training-hub:get-progress', async () => {
    try {
      return await trainingHubService.getProgress();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('training-hub:submit-attempt', async (event, courseId, attempt) => {
    try {
      return await trainingHubService.submitAttempt(courseId, attempt);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('training-hub:reset-course', async (event, courseId) => {
    try {
      return await trainingHubService.resetCourseProgress(courseId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // --- Authoring ---

  ipcMain.handle('training-hub:select-media-file', async (event, kind) => {
    try {
      const { dialog } = require('electron');
      const filters =
        kind === 'video'
          ? [{ name: 'Video', extensions: ['mp4', 'webm', 'ogg', 'mov', 'm4v'] }]
          : [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] }];
      const result = await dialog.showOpenDialog(getMainWindow(), {
        properties: ['openFile'],
        filters
      });
      if (result.canceled || !result.filePaths.length) {
        return { success: false, canceled: true };
      }
      return { success: true, filePath: result.filePaths[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('training-hub:save-course', async (event, course) => {
    try {
      return await trainingHubService.saveCourse(course);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('training-hub:delete-course', async (event, courseId) => {
    try {
      return await trainingHubService.deleteCourse(courseId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('training-hub:upload-media', async (event, courseId, filePath) => {
    try {
      return await trainingHubService.uploadMedia(courseId, filePath);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('training-hub:media-data-url', async (event, courseId, assetId) => {
    try {
      return await trainingHubService.getMediaDataUrl(courseId, assetId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('training-hub:media-buffer', async (event, courseId, assetId) => {
    try {
      return await trainingHubService.getMediaBuffer(courseId, assetId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ===== SPEC REVIEW IPC HANDLERS =====

  ipcMain.handle('spec-review:analyze', async (event, filePath) => {
    try {
      return await specReviewService.analyzeSpec(filePath, (progress) => {
        if (getMainWindow() && !getMainWindow().isDestroyed()) {
          getMainWindow().webContents.send('spec-review:progress', progress);
        }
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('spec-review:select-spec-file', async () => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog(getMainWindow(), {
        properties: ['openFile'],
        filters: [{ name: 'Specification Documents', extensions: ['pdf', 'docx', 'doc', 'txt'] }]
      });
      if (result.canceled || !result.filePaths.length) {
        return { success: false, canceled: true };
      }
      return { success: true, filePath: result.filePaths[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('spec-review:save', async (event, reviewData) => {
    try {
      return await specReviewPersistenceService.saveReview(reviewData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('spec-review:get', async (event, reviewId) => {
    try {
      return await specReviewPersistenceService.getReview(reviewId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('spec-review:list', async () => {
    try {
      return await specReviewPersistenceService.listReviews();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('spec-review:link-project', async (event, reviewId, projectId, projectName) => {
    try {
      return await specReviewPersistenceService.linkToProject(reviewId, projectId, projectName);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('spec-review:unlink-project', async (event, reviewId) => {
    try {
      return await specReviewPersistenceService.unlinkFromProject(reviewId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('spec-review:get-for-project', async (event, projectId) => {
    try {
      return await specReviewPersistenceService.getReviewsForProject(projectId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('spec-review:delete', async (event, reviewId) => {
    try {
      return await specReviewPersistenceService.deleteReview(reviewId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('spec-review:update-review', async (event, reviewId, updates) => {
    try {
      return await specReviewPersistenceService.updateReview(reviewId, updates);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ===== PRODUCT KNOWLEDGE BASE IPC HANDLERS =====

  ipcMain.handle('kb:load', async (event, forceRefresh) => {
    try {
      return await productKBService.load(forceRefresh);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:get-products', async () => {
    try {
      return await productKBService.getProducts();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:get-spec-rules', async () => {
    try {
      return await productKBService.getSpecRules();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:get-alternatives', async () => {
    try {
      return await productKBService.getAlternatives();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:get-summary', async () => {
    try {
      return await productKBService.getSummary();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:add-product', async (event, product) => {
    try {
      return await productKBService.addProduct(product);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:update-product', async (event, catalogNumber, updates) => {
    try {
      return await productKBService.updateProduct(catalogNumber, updates);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:delete-product', async (event, catalogNumber) => {
    try {
      return await productKBService.deleteProduct(catalogNumber);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:add-spec-rule', async (event, rule) => {
    try {
      return await productKBService.addSpecRule(rule);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:update-spec-rule', async (event, ruleId, updates) => {
    try {
      return await productKBService.updateSpecRule(ruleId, updates);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:delete-spec-rule', async (event, ruleId) => {
    try {
      return await productKBService.deleteSpecRule(ruleId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:add-alternative', async (event, alt) => {
    try {
      return await productKBService.addAlternative(alt);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:update-alternative', async (event, index, updates) => {
    try {
      return await productKBService.updateAlternative(index, updates);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:delete-alternative', async (event, index) => {
    try {
      return await productKBService.deleteAlternative(index);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:get-file-path', async () => {
    try {
      const filePath = await productKBService.getFilePath();
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:enrich-from-boms', async (event, options = {}) => {
    try {
      const catalogPath = path.join(os.homedir(), '.project-creator', 'bom-catalog.json');
      const onProgress = (data) => {
        try {
          event.sender.send('kb:enrichment-progress', data);
        } catch {
          /* window may be closed */
        }
      };
      return await productKBService.enrichFromBOMCatalog(catalogPath, { ...options, onProgress });
    } catch (error) {
      return { success: false, error: error.message, added: [], skipped: [], alreadyReviewed: 0, totalScanned: 0 };
    }
  });
};
