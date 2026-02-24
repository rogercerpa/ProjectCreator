/**
 * SpecReviewPersistenceService
 * Saves, loads, lists, links, and deletes spec review results.
 * Storage: ~/.project-creator/spec-reviews/{reviewId}.json
 * Index:   ~/.project-creator/spec-reviews-index.json
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const REVIEWS_DIR = path.join(os.homedir(), '.project-creator', 'spec-reviews');
const INDEX_PATH = path.join(os.homedir(), '.project-creator', 'spec-reviews-index.json');

class SpecReviewPersistenceService {
  constructor() {
    this._ensureDir();
  }

  async _ensureDir() {
    await fs.ensureDir(REVIEWS_DIR);
  }

  /**
   * Save a spec review result.
   */
  async saveReview(reviewData) {
    try {
      await this._ensureDir();
      const reviewId = reviewData.reviewId;
      if (!reviewId) return { success: false, error: 'Missing reviewId' };

      const filePath = path.join(REVIEWS_DIR, `${reviewId}.json`);
      const record = {
        ...reviewData,
        savedAt: new Date().toISOString(),
        linkedProjectId: reviewData.linkedProjectId || null,
        linkedProjectName: reviewData.linkedProjectName || null
      };

      await fs.writeJson(filePath, record, { spaces: 2 });
      await this._updateIndex(record);

      console.log(`💾 Spec review saved: ${reviewId}`);
      return { success: true, reviewId };
    } catch (error) {
      console.error('Error saving spec review:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load a spec review by ID.
   */
  async getReview(reviewId) {
    try {
      const filePath = path.join(REVIEWS_DIR, `${reviewId}.json`);
      if (!(await fs.pathExists(filePath))) {
        return { success: false, error: 'Review not found' };
      }
      const review = await fs.readJson(filePath);
      return { success: true, review };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List all saved spec reviews (from index for speed).
   */
  async listReviews() {
    try {
      if (!(await fs.pathExists(INDEX_PATH))) {
        return { success: true, reviews: [] };
      }
      const index = await fs.readJson(INDEX_PATH);
      const reviews = (index.reviews || []).sort((a, b) =>
        new Date(b.analyzedAt) - new Date(a.analyzedAt)
      );
      return { success: true, reviews };
    } catch (error) {
      return { success: true, reviews: [] };
    }
  }

  /**
   * Link a spec review to a project.
   */
  async linkToProject(reviewId, projectId, projectName) {
    try {
      const filePath = path.join(REVIEWS_DIR, `${reviewId}.json`);
      if (!(await fs.pathExists(filePath))) {
        return { success: false, error: 'Review not found' };
      }

      const review = await fs.readJson(filePath);
      review.linkedProjectId = projectId;
      review.linkedProjectName = projectName || '';
      review.linkedAt = new Date().toISOString();

      await fs.writeJson(filePath, review, { spaces: 2 });
      await this._updateIndex(review);

      console.log(`🔗 Spec review ${reviewId} linked to project ${projectId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Unlink a spec review from its project.
   */
  async unlinkFromProject(reviewId) {
    try {
      const filePath = path.join(REVIEWS_DIR, `${reviewId}.json`);
      if (!(await fs.pathExists(filePath))) {
        return { success: false, error: 'Review not found' };
      }

      const review = await fs.readJson(filePath);
      review.linkedProjectId = null;
      review.linkedProjectName = null;
      review.linkedAt = null;

      await fs.writeJson(filePath, review, { spaces: 2 });
      await this._updateIndex(review);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all spec reviews linked to a specific project.
   */
  async getReviewsForProject(projectId) {
    try {
      const listResult = await this.listReviews();
      if (!listResult.success) return listResult;

      const projectReviews = listResult.reviews.filter(r => r.linkedProjectId === projectId);
      return { success: true, reviews: projectReviews };
    } catch (error) {
      return { success: false, error: error.message, reviews: [] };
    }
  }

  /**
   * Delete a spec review.
   */
  async deleteReview(reviewId) {
    try {
      const filePath = path.join(REVIEWS_DIR, `${reviewId}.json`);
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }

      await this._removeFromIndex(reviewId);

      console.log(`🗑️ Spec review deleted: ${reviewId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ===== Index Management =====

  async _updateIndex(review) {
    try {
      let index = { reviews: [] };
      if (await fs.pathExists(INDEX_PATH)) {
        index = await fs.readJson(INDEX_PATH);
      }

      const entry = {
        reviewId: review.reviewId,
        sourceFile: review.sourceFile || '',
        projectSummary: review.projectSummary || '',
        complianceScore: review.complianceScore?.score ?? null,
        requirementCount: review.requirements?.length || 0,
        metCount: review.complianceScore?.met ?? 0,
        gapCount: review.complianceScore?.gap ?? 0,
        alternativeCount: review.complianceScore?.alternative ?? 0,
        linkedProjectId: review.linkedProjectId || null,
        linkedProjectName: review.linkedProjectName || null,
        analyzedAt: review.analyzedAt || new Date().toISOString(),
        savedAt: review.savedAt || new Date().toISOString()
      };

      const existingIdx = index.reviews.findIndex(r => r.reviewId === review.reviewId);
      if (existingIdx >= 0) {
        index.reviews[existingIdx] = entry;
      } else {
        index.reviews.push(entry);
      }

      await fs.writeJson(INDEX_PATH, index, { spaces: 2 });
    } catch (error) {
      console.error('Error updating spec review index:', error);
    }
  }

  async _removeFromIndex(reviewId) {
    try {
      if (!(await fs.pathExists(INDEX_PATH))) return;
      const index = await fs.readJson(INDEX_PATH);
      index.reviews = (index.reviews || []).filter(r => r.reviewId !== reviewId);
      await fs.writeJson(INDEX_PATH, index, { spaces: 2 });
    } catch (error) {
      console.error('Error removing from spec review index:', error);
    }
  }
}

module.exports = SpecReviewPersistenceService;
