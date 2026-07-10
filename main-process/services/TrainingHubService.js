/**
 * TrainingHubService
 *
 * Backs the Training Hub feature: a catalog of short interactive courses with
 * end-of-course quizzes. Course content is curated JSON, preferring a shared
 * editable copy on the Z: drive and falling back to the bundled seed content.
 * Per-user progress (attempts, scores, topic proficiency) is stored locally.
 *
 * Content (read):
 *   Shared:   Z:\DAS References\ProjectCreatorV5\TrainingHub\index.json
 *             Z:\DAS References\ProjectCreatorV5\TrainingHub\courses\{id}.json
 *   Fallback: main-process/data/traininghub/index.json
 *             main-process/data/traininghub/courses/{id}.json
 *
 * Progress (read/write, local per machine):
 *   ~/.project-creator/training/progress.json
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const SHARED_DIR = path.join('Z:', 'DAS References', 'ProjectCreatorV5', 'TrainingHub');
const SHARED_INDEX = path.join(SHARED_DIR, 'index.json');
const SHARED_COURSES_DIR = path.join(SHARED_DIR, 'courses');

const LOCAL_DIR = path.join(__dirname, '..', 'data', 'traininghub');
const LOCAL_INDEX = path.join(LOCAL_DIR, 'index.json');
const LOCAL_COURSES_DIR = path.join(LOCAL_DIR, 'courses');

const PROGRESS_DIR = path.join(os.homedir(), '.project-creator', 'training');
const PROGRESS_PATH = path.join(PROGRESS_DIR, 'progress.json');

const DEFAULT_PASS_SCORE = 80;

class TrainingHubService {
  /**
   * @param {object} settingsService - used to resolve the current user profile
   *   for keying progress. Optional; falls back to a shared 'default' key.
   */
  constructor(settingsService = null) {
    this.settingsService = settingsService;
    this._catalogCache = null;
  }

  // ===== Catalog / Content =====

  /**
   * Load the course catalog (categories + course summaries).
   * Prefers the shared Z: index, falls back to the bundled copy.
   */
  async getCatalog(forceRefresh = false) {
    if (this._catalogCache && !forceRefresh) {
      return { success: true, catalog: this._catalogCache, source: this._catalogCache._source };
    }

    let catalog = null;
    let source = 'local';

    try {
      if (await fs.pathExists(SHARED_INDEX)) {
        catalog = await fs.readJson(SHARED_INDEX);
        source = 'shared';
      }
    } catch (error) {
      console.warn('Training Hub: could not read shared index (Z: may be unavailable):', error.message);
    }

    if (!catalog) {
      try {
        catalog = await fs.readJson(LOCAL_INDEX);
        source = 'local';
      } catch (error) {
        console.warn('Training Hub: could not read local index:', error.message);
        return { success: true, catalog: this._emptyCatalog(), source: 'empty' };
      }
    }

    catalog = this._normalizeCatalog(catalog);
    catalog._source = source;
    this._catalogCache = catalog;
    return { success: true, catalog, source };
  }

  /**
   * Load a full course (lessons + quiz) by id.
   * Prefers the shared Z: copy, falls back to the bundled copy.
   */
  async getCourse(courseId) {
    if (!courseId) return { success: false, error: 'Missing courseId' };

    const safeId = this._safeId(courseId);
    const sharedPath = path.join(SHARED_COURSES_DIR, `${safeId}.json`);
    const localPath = path.join(LOCAL_COURSES_DIR, `${safeId}.json`);

    try {
      if (await fs.pathExists(sharedPath)) {
        const course = await fs.readJson(sharedPath);
        return { success: true, course: this._normalizeCourse(course), source: 'shared' };
      }
    } catch (error) {
      console.warn(`Training Hub: could not read shared course ${safeId} (Z: may be unavailable):`, error.message);
    }

    try {
      if (await fs.pathExists(localPath)) {
        const course = await fs.readJson(localPath);
        return { success: true, course: this._normalizeCourse(course), source: 'local' };
      }
    } catch (error) {
      console.warn(`Training Hub: could not read local course ${safeId}:`, error.message);
    }

    return { success: false, error: `Course not found: ${courseId}` };
  }

  // ===== Progress =====

  /**
   * Get the full progress record for the current user profile.
   */
  async getProgress() {
    try {
      const userKey = await this._resolveUserKey();
      const store = await this._readProgressStore();
      const record = store.users[userKey] || this._emptyUserProgress();
      return { success: true, userKey, progress: record };
    } catch (error) {
      console.error('Training Hub: error reading progress:', error);
      return { success: true, userKey: 'default', progress: this._emptyUserProgress() };
    }
  }

  /**
   * Record a quiz attempt for a course and update derived progress.
   *
   * @param {string} courseId
   * @param {object} attempt - { score, passScore, courseVersion, category, total, correct }
   */
  async submitAttempt(courseId, attempt = {}) {
    try {
      if (!courseId) return { success: false, error: 'Missing courseId' };

      const userKey = await this._resolveUserKey();
      const store = await this._readProgressStore();
      if (!store.users[userKey]) store.users[userKey] = this._emptyUserProgress();
      const userRecord = store.users[userKey];

      const score = this._clampScore(attempt.score);
      const passScore = Number.isFinite(attempt.passScore) ? attempt.passScore : DEFAULT_PASS_SCORE;
      const passed = score >= passScore;
      const now = new Date().toISOString();

      const existing = userRecord.courses[courseId] || {
        status: 'not-started',
        bestScore: 0,
        attempts: [],
        lastPassedAt: null,
        courseVersion: attempt.courseVersion || 1
      };

      existing.attempts.push({
        at: now,
        score,
        passed,
        correct: attempt.correct ?? null,
        total: attempt.total ?? null
      });
      // Keep only the most recent 25 attempts per course.
      if (existing.attempts.length > 25) {
        existing.attempts = existing.attempts.slice(-25);
      }

      existing.bestScore = Math.max(existing.bestScore || 0, score);
      existing.courseVersion = attempt.courseVersion || existing.courseVersion || 1;
      if (passed) {
        existing.status = 'passed';
        existing.lastPassedAt = now;
        existing.passedVersion = existing.courseVersion;
      } else if (existing.status !== 'passed') {
        existing.status = 'in-progress';
      }

      userRecord.courses[courseId] = existing;

      // Update topic (category) proficiency from best score.
      if (attempt.category) {
        const level = this._scoreToLevel(existing.bestScore);
        const topic = userRecord.topicScores[attempt.category] || { level: 0, lastAssessedAt: null };
        if (level >= topic.level) {
          topic.level = level;
        }
        topic.lastAssessedAt = now;
        userRecord.topicScores[attempt.category] = topic;
      }

      userRecord.updatedAt = now;
      await this._writeProgressStore(store);

      return {
        success: true,
        userKey,
        passed,
        score,
        passScore,
        courseProgress: existing,
        topicScores: userRecord.topicScores
      };
    } catch (error) {
      console.error('Training Hub: error submitting attempt:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reset progress for a single course (current user).
   */
  async resetCourseProgress(courseId) {
    try {
      const userKey = await this._resolveUserKey();
      const store = await this._readProgressStore();
      if (store.users[userKey]?.courses?.[courseId]) {
        delete store.users[userKey].courses[courseId];
        await this._writeProgressStore(store);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ===== Internals =====

  async _resolveUserKey() {
    try {
      if (this.settingsService?.getSettings) {
        const settings = await this.settingsService.getSettings();
        const ws = settings?.workloadSettings || {};
        const raw = ws.userEmail || ws.userName || '';
        if (raw && raw.trim()) {
          return raw.trim().toLowerCase();
        }
      }
    } catch (error) {
      console.warn('Training Hub: could not resolve user key from settings:', error.message);
    }
    return 'default';
  }

  async _readProgressStore() {
    try {
      if (await fs.pathExists(PROGRESS_PATH)) {
        const store = await fs.readJson(PROGRESS_PATH);
        if (!store.users) store.users = {};
        return store;
      }
    } catch (error) {
      console.warn('Training Hub: could not read progress store, starting fresh:', error.message);
    }
    return { version: 1, users: {} };
  }

  async _writeProgressStore(store) {
    await fs.ensureDir(PROGRESS_DIR);
    store.version = store.version || 1;
    store.updatedAt = new Date().toISOString();
    await fs.writeJson(PROGRESS_PATH, store, { spaces: 2 });
  }

  _emptyUserProgress() {
    return { courses: {}, topicScores: {}, updatedAt: null };
  }

  _emptyCatalog() {
    return { version: 0, categories: [], courses: [], _source: 'empty' };
  }

  _normalizeCatalog(catalog) {
    return {
      version: catalog.version || 1,
      updatedAt: catalog.updatedAt || null,
      categories: Array.isArray(catalog.categories) ? catalog.categories : [],
      courses: Array.isArray(catalog.courses) ? catalog.courses : []
    };
  }

  _normalizeCourse(course) {
    const c = { ...course };
    c.passScore = Number.isFinite(c.passScore) ? c.passScore : DEFAULT_PASS_SCORE;
    c.lessons = Array.isArray(c.lessons) ? c.lessons : [];
    c.quiz = c.quiz && Array.isArray(c.quiz.questions) ? c.quiz : { questions: [] };
    c.version = c.version || 1;
    return c;
  }

  _clampScore(score) {
    const n = Number(score);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  /**
   * Map a 0-100 best score to a 0-5 proficiency level, aligned with the
   * workload productKnowledge skill scale used elsewhere in the app.
   */
  _scoreToLevel(score) {
    const s = this._clampScore(score);
    if (s >= 95) return 5;
    if (s >= 85) return 4;
    if (s >= 75) return 3;
    if (s >= 60) return 2;
    if (s > 0) return 1;
    return 0;
  }

  _safeId(id) {
    return String(id).replace(/[^a-z0-9._-]/gi, '');
  }
}

module.exports = TrainingHubService;
