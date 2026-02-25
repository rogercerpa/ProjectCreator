/**
 * SpecReviewLearningService
 *
 * Maintains a persistent learning log on the shared Z: drive that accumulates
 * corrections and spec-language patterns from every spec review. The learnings
 * are injected into AI prompts to improve accuracy over time.
 *
 * Storage: Z:\DAS References\ProjectCreatorV5\SpecReviewLearnings.json
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_LEARNINGS_PATH = path.join('Z:', 'DAS References', 'ProjectCreatorV5', 'SpecReviewLearnings.json');
const MAX_LEARNINGS = 200;
const MAX_PROMPT_ENTRIES = 50;

class SpecReviewLearningService {
  constructor(settingsService) {
    this.settingsService = settingsService;
  }

  _getFilePath() {
    return DEFAULT_LEARNINGS_PATH;
  }

  async _load() {
    const filePath = this._getFilePath();
    try {
      if (await fs.pathExists(filePath)) {
        return await fs.readJson(filePath);
      }
    } catch (error) {
      console.warn('Could not load learnings file:', error.message);
    }
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      totalAnalyses: 0,
      learnings: []
    };
  }

  async _save(data) {
    const filePath = this._getFilePath();
    try {
      await fs.ensureDir(path.dirname(filePath));
      data.lastUpdated = new Date().toISOString();
      await fs.writeJson(filePath, data, { spaces: 2 });
    } catch (error) {
      console.warn('Could not save learnings file (Z: drive may be unavailable):', error.message);
    }
  }

  /**
   * Record learnings from user overrides on a saved review.
   * Called when the user edits requirements and saves.
   */
  async captureFromOverrides(requirements, sourceFile) {
    const overridden = requirements.filter(r => r.isOverridden);
    if (overridden.length === 0) return;

    const data = await this._load();

    for (const req of overridden) {
      if (req.originalStatus && req.status !== req.originalStatus) {
        const learning = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          type: 'correction',
          category: req.category || '',
          requirementName: req.name || '',
          specLanguage: req.specExcerpt || req.description || '',
          originalClassification: req.originalStatus,
          correctedClassification: req.status,
          correctProduct: req.recommendedDevices?.filter(d => d.catalogNumber).map(d => d.catalogNumber).join(', ') || '',
          explanation: req.userNote || req.gapNote || '',
          sourceFile: sourceFile || ''
        };

        const isDuplicate = data.learnings.some(l =>
          l.type === 'correction' &&
          l.category === learning.category &&
          l.correctedClassification === learning.correctedClassification &&
          l.correctProduct === learning.correctProduct &&
          l.requirementName === learning.requirementName
        );

        if (!isDuplicate) {
          data.learnings.push(learning);
        }
      }

      if (req.specExcerpt && req.status === 'met' && req.recommendedDevices?.length > 0) {
        const primaryDevices = req.recommendedDevices.filter(d => d.catalogNumber && d.role === 'primary');
        if (primaryDevices.length > 0) {
          const patternExists = data.learnings.some(l =>
            l.type === 'pattern' &&
            l.category === req.category &&
            l.mapsTo === primaryDevices.map(d => d.catalogNumber).join(', ')
          );

          if (!patternExists) {
            data.learnings.push({
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              type: 'pattern',
              category: req.category || '',
              specPattern: req.specExcerpt.substring(0, 300),
              mapsTo: primaryDevices.map(d => d.catalogNumber).join(', '),
              mapsToDescription: primaryDevices.map(d => `${d.catalogNumber}: ${d.description || ''}`).join('; '),
              sourceFile: sourceFile || ''
            });
          }
        }
      }
    }

    if (data.learnings.length > MAX_LEARNINGS) {
      data.learnings = data.learnings.slice(-MAX_LEARNINGS);
    }

    await this._save(data);
    console.log(`📚 Captured ${overridden.length} learning(s) from overrides`);
  }

  /**
   * Increment analysis counter.
   */
  async recordAnalysis() {
    try {
      const data = await this._load();
      data.totalAnalyses = (data.totalAnalyses || 0) + 1;
      await this._save(data);
    } catch (error) {
      console.warn('Could not record analysis count:', error.message);
    }
  }

  /**
   * Build a prompt-injectable text block from accumulated learnings.
   * Returns a string to be appended to the AI system prompt, or empty string if no learnings.
   */
  async buildPromptContext() {
    try {
      const data = await this._load();
      if (!data.learnings || data.learnings.length === 0) return '';

      const corrections = data.learnings
        .filter(l => l.type === 'correction')
        .slice(-MAX_PROMPT_ENTRIES);

      const patterns = data.learnings
        .filter(l => l.type === 'pattern')
        .slice(-Math.floor(MAX_PROMPT_ENTRIES / 2));

      if (corrections.length === 0 && patterns.length === 0) return '';

      let context = '\n\nPAST CORRECTIONS AND LEARNED PATTERNS (use these to improve accuracy):\n';

      if (corrections.length > 0) {
        context += '\nCORRECTIONS — Previous analyses were corrected by the DAS team. Do NOT repeat these mistakes:\n';
        for (const c of corrections) {
          context += `- "${c.requirementName}" (${c.category}): Was classified as "${c.originalClassification}" but should be "${c.correctedClassification}".`;
          if (c.correctProduct) context += ` Correct product: ${c.correctProduct}.`;
          if (c.explanation) context += ` Reason: ${c.explanation}`;
          context += '\n';
        }
      }

      if (patterns.length > 0) {
        context += '\nKNOWN SPEC PATTERNS — These spec phrases have been confirmed to map to specific Acuity products:\n';
        for (const p of patterns) {
          context += `- Spec language like "${p.specPattern.substring(0, 150)}" maps to: ${p.mapsTo}`;
          if (p.mapsToDescription) context += ` (${p.mapsToDescription})`;
          context += '\n';
        }
      }

      return context;
    } catch (error) {
      console.warn('Could not build learning context:', error.message);
      return '';
    }
  }

  /**
   * Get learning statistics for display.
   */
  async getStats() {
    try {
      const data = await this._load();
      const corrections = data.learnings.filter(l => l.type === 'correction').length;
      const patterns = data.learnings.filter(l => l.type === 'pattern').length;
      return {
        totalAnalyses: data.totalAnalyses || 0,
        totalLearnings: data.learnings.length,
        corrections,
        patterns,
        lastUpdated: data.lastUpdated
      };
    } catch (error) {
      return { totalAnalyses: 0, totalLearnings: 0, corrections: 0, patterns: 0, lastUpdated: null };
    }
  }
}

module.exports = SpecReviewLearningService;
