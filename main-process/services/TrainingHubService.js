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
const SHARED_MEDIA_DIR = path.join(SHARED_DIR, 'media');

const LOCAL_DIR = path.join(__dirname, '..', 'data', 'traininghub');
const LOCAL_INDEX = path.join(LOCAL_DIR, 'index.json');
const LOCAL_COURSES_DIR = path.join(LOCAL_DIR, 'courses');

const PROGRESS_DIR = path.join(os.homedir(), '.project-creator', 'training');
const PROGRESS_PATH = path.join(PROGRESS_DIR, 'progress.json');

const DEFAULT_PASS_SCORE = 80;
const MAX_SOURCE_CHARS = 24000;
const IMAGE_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml'
};
const VIDEO_MIME = {
  mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', mov: 'video/quicktime', m4v: 'video/x-m4v'
};

class TrainingHubService {
  /**
   * @param {object} settingsService - used to resolve the current user profile
   *   for keying progress and stamping authorship. Optional.
   * @param {object} aiService - used to generate course drafts. Optional.
   */
  constructor(settingsService = null, aiService = null) {
    this.settingsService = settingsService;
    this.aiService = aiService;
    this._docTextService = null;
    this._catalogCache = null;
  }

  _docParser() {
    if (!this._docTextService) {
      const DocumentTextService = require('./DocumentTextService');
      this._docTextService = new DocumentTextService();
    }
    return this._docTextService;
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

  // ===== Authoring =====

  /**
   * Ensure the shared Z: catalog exists by seeding it from the bundled copy on
   * first write. Lets seed courses be edited and keeps them available to all.
   */
  async _ensureSharedSeeded() {
    if (await fs.pathExists(SHARED_INDEX)) return;
    await fs.ensureDir(SHARED_COURSES_DIR);

    let localIndex = null;
    try {
      localIndex = await fs.readJson(LOCAL_INDEX);
    } catch (error) {
      localIndex = { version: 1, updatedAt: new Date().toISOString(), categories: [], courses: [] };
    }

    // Copy each bundled course file that exists, stamping it as a seed.
    for (const entry of localIndex.courses || []) {
      const src = path.join(LOCAL_COURSES_DIR, `${this._safeId(entry.id)}.json`);
      const dest = path.join(SHARED_COURSES_DIR, `${this._safeId(entry.id)}.json`);
      try {
        if (await fs.pathExists(src)) {
          const course = await fs.readJson(src);
          if (!course.source) course.source = 'seed';
          await fs.writeJson(dest, course, { spaces: 2 });
        }
      } catch (error) {
        console.warn(`Training Hub: could not seed course ${entry.id}:`, error.message);
      }
    }

    await fs.writeJson(SHARED_INDEX, localIndex, { spaces: 2 });
    console.log('Seeded shared Training Hub catalog on Z: drive');
  }

  /**
   * Generate a draft course (lessons + quiz) using the AI service from uploaded
   * source documents and/or pasted notes. Does NOT save the course.
   */
  async generateCourseDraft(params = {}) {
    const { filePaths = [], notes = '', links = [], category = null, difficulty = 1 } = params;

    if (!this.aiService) {
      return { success: false, error: 'AI service is not available' };
    }
    try {
      const ready = this.aiService.isAssistantReady
        ? this.aiService.isAssistantReady()
        : await this.aiService.hasApiKey();
      if (!ready) {
        return { success: false, error: 'AI is not configured. Set it up in Settings > AI Configuration.' };
      }
    } catch (error) {
      return { success: false, error: 'AI is not configured. Set it up in Settings > AI Configuration.' };
    }

    // Gather source text.
    let sourceText = '';
    let sources = [];
    try {
      const extracted = await this._docParser().extractCombined(filePaths, MAX_SOURCE_CHARS);
      sourceText = extracted.combined;
      sources = extracted.sources;
    } catch (error) {
      console.warn('Training Hub: document extraction failed:', error.message);
    }

    const notesText = (notes || '').trim();
    const linkText = (links || []).filter(Boolean).join('\n');
    if (!sourceText && !notesText) {
      return { success: false, error: 'Provide at least one source document or some notes to generate from.' };
    }

    const { system, user } = this._buildCoursePrompt({ sourceText, notesText, linkText, category, difficulty });

    try {
      const result = await this.aiService.chatCompletion(system, user, {
        jsonMode: true,
        maxTokens: 8192,
        timeout: 120000
      });
      const course = this._normalizeGeneratedCourse(result, { category, difficulty });
      return { success: true, course, sources };
    } catch (error) {
      console.error('Training Hub: course generation failed:', error);
      return { success: false, error: error.message || 'Course generation failed' };
    }
  }

  /**
   * Create or update a course in the shared catalog (open/wiki-style).
   */
  async saveCourse(course) {
    try {
      if (!course || !course.title || !course.title.trim()) {
        return { success: false, error: 'Course title is required' };
      }

      await this._ensureSharedSeeded();
      await fs.ensureDir(SHARED_COURSES_DIR);

      const author = await this._resolveAuthor();
      const now = new Date().toISOString();

      const isNew = !course.id;
      const id = this._safeId(course.id || this._slugify(course.title));
      if (!id) return { success: false, error: 'Could not derive a valid course id' };

      const coursePath = path.join(SHARED_COURSES_DIR, `${id}.json`);

      // Load existing (if any) to preserve createdBy and bump version.
      let existing = null;
      if (await fs.pathExists(coursePath)) {
        try { existing = await fs.readJson(coursePath); } catch { existing = null; }
      }

      const record = this._normalizeCourse({
        ...course,
        id,
        category: course.category || existing?.category || (this._catalogCache?.categories?.[0]?.id) || 'process-qc',
        difficulty: course.difficulty ?? existing?.difficulty ?? 1,
        estimatedMinutes: course.estimatedMinutes ?? existing?.estimatedMinutes ?? 8,
        passScore: course.passScore ?? existing?.passScore ?? DEFAULT_PASS_SCORE,
        tags: Array.isArray(course.tags) ? course.tags : (existing?.tags || []),
        source: existing?.source || course.source || 'user',
        createdBy: existing?.createdBy || author.key,
        createdByName: existing?.createdByName || author.name,
        createdAt: existing?.createdAt || now,
        lastEditedBy: author.key,
        lastEditedByName: author.name,
        lastEditedAt: now,
        version: (existing?.version || course.version || 0) + 1,
        updatedAt: now
      });

      await fs.writeJson(coursePath, record, { spaces: 2 });
      await this._upsertIndexEntry(record);
      this._catalogCache = null;

      console.log(`Training Hub: course ${isNew ? 'created' : 'updated'}: ${id} (v${record.version})`);
      return { success: true, courseId: id, course: record };
    } catch (error) {
      console.error('Training Hub: error saving course:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a course and its media from the shared catalog.
   */
  async deleteCourse(courseId) {
    try {
      if (!courseId) return { success: false, error: 'Missing courseId' };
      await this._ensureSharedSeeded();

      const id = this._safeId(courseId);
      const coursePath = path.join(SHARED_COURSES_DIR, `${id}.json`);
      if (await fs.pathExists(coursePath)) await fs.remove(coursePath);

      const mediaDir = path.join(SHARED_MEDIA_DIR, id);
      if (await fs.pathExists(mediaDir)) await fs.remove(mediaDir);

      await this._removeIndexEntry(id);
      this._catalogCache = null;

      console.log(`Training Hub: course deleted: ${id}`);
      return { success: true };
    } catch (error) {
      console.error('Training Hub: error deleting course:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Copy an uploaded media file into the shared course media folder.
   * @returns {Promise<{ success, assetId, mediaType }>}
   */
  async uploadMedia(courseId, filePath) {
    try {
      if (!courseId) return { success: false, error: 'Missing courseId' };
      if (!filePath) return { success: false, error: 'Missing file' };
      await this._ensureSharedSeeded();

      const id = this._safeId(courseId);
      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      const mediaType = IMAGE_MIME[ext] ? 'image' : (VIDEO_MIME[ext] ? 'video' : null);
      if (!mediaType) {
        return { success: false, error: `Unsupported media type: .${ext}` };
      }

      const mediaDir = path.join(SHARED_MEDIA_DIR, id);
      await fs.ensureDir(mediaDir);

      const assetId = `${this._genId()}.${ext}`;
      await fs.copy(filePath, path.join(mediaDir, assetId));

      return { success: true, assetId, mediaType, fileName: path.basename(filePath) };
    } catch (error) {
      console.error('Training Hub: error uploading media:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Read a media asset as a data URL (used for images).
   */
  async getMediaDataUrl(courseId, assetId) {
    try {
      const filePath = this._mediaPath(courseId, assetId);
      if (!filePath || !(await fs.pathExists(filePath))) {
        return { success: false, error: 'Media not found' };
      }
      const ext = path.extname(assetId).toLowerCase().replace('.', '');
      const mimeType = IMAGE_MIME[ext] || VIDEO_MIME[ext] || 'application/octet-stream';
      const buffer = await fs.readFile(filePath);
      return { success: true, dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`, mimeType };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Read a media asset as raw bytes (used for uploaded video via Blob URL).
   */
  async getMediaBuffer(courseId, assetId) {
    try {
      const filePath = this._mediaPath(courseId, assetId);
      if (!filePath || !(await fs.pathExists(filePath))) {
        return { success: false, error: 'Media not found' };
      }
      const ext = path.extname(assetId).toLowerCase().replace('.', '');
      const mimeType = VIDEO_MIME[ext] || IMAGE_MIME[ext] || 'application/octet-stream';
      const buffer = await fs.readFile(filePath);
      return { success: true, data: buffer, mimeType };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ===== Internals =====

  _mediaPath(courseId, assetId) {
    const id = this._safeId(courseId);
    const asset = this._safeId(assetId);
    if (!id || !asset) return null;
    return path.join(SHARED_MEDIA_DIR, id, asset);
  }

  _genId() {
    try {
      return require('crypto').randomUUID().split('-')[0];
    } catch {
      return Math.random().toString(36).slice(2, 10);
    }
  }

  _slugify(title) {
    const base = String(title).toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'course';
    return `${base}-${this._genId()}`;
  }

  async _resolveAuthor() {
    try {
      if (this.settingsService?.getSettings) {
        const settings = await this.settingsService.getSettings();
        const ws = settings?.workloadSettings || {};
        const name = (ws.userName || '').trim();
        const email = (ws.userEmail || '').trim();
        return { key: (email || name || 'unknown').toLowerCase(), name: name || email || 'Unknown' };
      }
    } catch (error) {
      console.warn('Training Hub: could not resolve author:', error.message);
    }
    return { key: 'unknown', name: 'Unknown' };
  }

  _catalogEntryFromCourse(course) {
    return {
      id: course.id,
      title: course.title,
      category: course.category,
      products: Array.isArray(course.products) ? course.products : [],
      difficulty: course.difficulty ?? 1,
      estimatedMinutes: course.estimatedMinutes ?? 8,
      version: course.version || 1,
      tags: Array.isArray(course.tags) ? course.tags : [],
      source: course.source || 'user'
    };
  }

  async _readSharedIndex() {
    try {
      if (await fs.pathExists(SHARED_INDEX)) {
        return await fs.readJson(SHARED_INDEX);
      }
    } catch (error) {
      console.warn('Training Hub: could not read shared index:', error.message);
    }
    // Fall back to bundled shape so category list survives.
    try {
      return await fs.readJson(LOCAL_INDEX);
    } catch {
      return { version: 1, categories: [], courses: [] };
    }
  }

  async _upsertIndexEntry(course) {
    const index = await this._readSharedIndex();
    if (!Array.isArray(index.courses)) index.courses = [];
    const entry = this._catalogEntryFromCourse(course);
    const idx = index.courses.findIndex(c => c.id === course.id);
    if (idx >= 0) index.courses[idx] = entry;
    else index.courses.push(entry);
    index.updatedAt = new Date().toISOString();
    await fs.ensureDir(SHARED_DIR);
    await fs.writeJson(SHARED_INDEX, index, { spaces: 2 });
  }

  async _removeIndexEntry(courseId) {
    const index = await this._readSharedIndex();
    index.courses = (index.courses || []).filter(c => c.id !== courseId);
    index.updatedAt = new Date().toISOString();
    await fs.ensureDir(SHARED_DIR);
    await fs.writeJson(SHARED_INDEX, index, { spaces: 2 });
  }

  _buildCoursePrompt({ sourceText, notesText, linkText, category, difficulty }) {
    const system = [
      'You are an instructional designer for Acuity Brands lighting controls Design & Application engineers.',
      'Create a SHORT, interactive micro-course from the provided source material.',
      'Return ONLY valid JSON matching EXACTLY this schema (no markdown, no commentary):',
      '{',
      '  "title": string,',
      '  "summary": string,',
      '  "estimatedMinutes": number,',
      '  "tags": string[],',
      '  "lessons": [ { "title": string, "blocks": [ { "type": "text", "content": string } | { "type": "callout", "variant": "tip"|"warning"|"info", "content": string } ] } ],',
      '  "quiz": { "questions": [ { "type": "single"|"multi"|"boolean", "prompt": string, "choices": [ { "text": string, "correct": boolean } ], "explanation": string } ] }',
      '}',
      'Rules: 3 to 5 lessons, each with 2-4 blocks. 4 to 6 quiz questions. Every question must have at least one correct choice.',
      'For "boolean" questions provide exactly two choices: "True" and "False". Keep language concise and practical. Base content strictly on the source material.'
    ].join('\n');

    let user = '';
    if (category) user += `Target topic/category: ${category}.\n`;
    user += `Target difficulty (1=intro, 3=advanced): ${difficulty}.\n\n`;
    if (notesText) user += `AUTHOR NOTES:\n${notesText}\n\n`;
    if (linkText) user += `REFERENCE LINKS (context only, do not fabricate content):\n${linkText}\n\n`;
    if (sourceText) user += `SOURCE MATERIAL:\n${sourceText}`;
    if (!sourceText) user += 'Generate the course primarily from the author notes above.';

    return { system, user };
  }

  _normalizeGeneratedCourse(raw, meta = {}) {
    const obj = raw && typeof raw === 'object' ? raw : {};
    const lessons = (Array.isArray(obj.lessons) ? obj.lessons : []).map((lesson, li) => ({
      id: `l${li + 1}`,
      title: lesson.title || `Lesson ${li + 1}`,
      blocks: (Array.isArray(lesson.blocks) ? lesson.blocks : []).map(block => {
        if (block && block.type === 'callout') {
          const variant = ['tip', 'warning', 'info'].includes(block.variant) ? block.variant : 'info';
          return { type: 'callout', variant, content: String(block.content || '') };
        }
        return { type: 'text', content: String(block?.content || '') };
      }).filter(b => b.content)
    })).filter(l => l.blocks.length > 0);

    const questions = (Array.isArray(obj.quiz?.questions) ? obj.quiz.questions : []).map((q, qi) => {
      const type = ['single', 'multi', 'boolean'].includes(q.type) ? q.type : 'single';
      let choices = (Array.isArray(q.choices) ? q.choices : []).map((c, ci) => ({
        id: type === 'boolean' ? (String(c.text).toLowerCase().startsWith('t') ? 'true' : 'false') : String.fromCharCode(97 + ci),
        text: String(c.text || ''),
        correct: !!c.correct
      })).filter(c => c.text);
      if (!choices.some(c => c.correct) && choices.length > 0) choices[0].correct = true;
      return {
        id: `q${qi + 1}`,
        type,
        prompt: String(q.prompt || ''),
        choices,
        explanation: String(q.explanation || '')
      };
    }).filter(q => q.prompt && q.choices.length >= 2);

    return {
      title: String(obj.title || 'Untitled Course'),
      summary: String(obj.summary || ''),
      category: meta.category || null,
      difficulty: meta.difficulty ?? 1,
      estimatedMinutes: Number.isFinite(obj.estimatedMinutes) ? obj.estimatedMinutes : 8,
      passScore: DEFAULT_PASS_SCORE,
      tags: Array.isArray(obj.tags) ? obj.tags.map(String) : [],
      lessons,
      quiz: { questions }
    };
  }

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
