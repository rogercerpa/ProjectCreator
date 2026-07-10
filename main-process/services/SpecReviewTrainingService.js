/**
 * SpecReviewTrainingService
 *
 * Loads encoded AE best-practice "spec training" knowledge and exposes it to
 * the Spec Review pipeline. The knowledge captures how Application Engineers
 * review lighting controls specs (Division 26 focus, NEED vs SHOULD, Self-QC
 * keyword scanning, secondary-section checks).
 *
 * Storage: Z:\DAS References\ProjectCreatorV5\SpecReviewTrainingKnowledge.json
 * Fallback / seed source: main-process/data/SpecReviewTrainingKnowledge.json
 */

const fs = require('fs-extra');
const path = require('path');

const SHARED_TRAINING_PATH = path.join('Z:', 'DAS References', 'ProjectCreatorV5', 'SpecReviewTrainingKnowledge.json');
const LOCAL_TRAINING_PATH = path.join(__dirname, '..', 'data', 'SpecReviewTrainingKnowledge.json');

class SpecReviewTrainingService {
  constructor() {
    this._cache = null;
  }

  /**
   * Load the training knowledge, preferring the shared Z: copy.
   * If the shared copy is missing but the drive is reachable, seed it from
   * the bundled local copy. Falls back to the local copy if Z: is unavailable.
   */
  async getTrainingKnowledge() {
    if (this._cache) return this._cache;

    // Try the shared Z: copy first
    try {
      if (await fs.pathExists(SHARED_TRAINING_PATH)) {
        this._cache = await fs.readJson(SHARED_TRAINING_PATH);
        return this._cache;
      }
    } catch (error) {
      console.warn('Could not read shared training knowledge (Z: may be unavailable):', error.message);
    }

    // Load the bundled local copy
    let local = null;
    try {
      local = await fs.readJson(LOCAL_TRAINING_PATH);
    } catch (error) {
      console.warn('Could not read local training knowledge:', error.message);
      this._cache = this._emptyKnowledge();
      return this._cache;
    }

    // Attempt to seed the shared copy from the local one (best-effort)
    try {
      await fs.ensureDir(path.dirname(SHARED_TRAINING_PATH));
      if (!(await fs.pathExists(SHARED_TRAINING_PATH))) {
        await fs.writeJson(SHARED_TRAINING_PATH, local, { spaces: 2 });
        console.log('Seeded shared SpecReviewTrainingKnowledge.json on Z: drive');
      }
    } catch (error) {
      console.warn('Could not seed shared training knowledge (Z: may be unavailable):', error.message);
    }

    this._cache = local;
    return this._cache;
  }

  _emptyKnowledge() {
    return {
      version: 0,
      sizeStrategy: [],
      divisionFocus: {},
      obligationRules: {},
      selfQcKeywords: [],
      secondarySections: { markers: [], tableHints: [] },
      markupPatterns: {}
    };
  }

  /**
   * Determine which reading strategy applies for a given page count.
   */
  async getSizeStrategy(pageCount) {
    const k = await this.getTrainingKnowledge();
    const rules = k.sizeStrategy || [];
    for (const rule of rules) {
      if (rule.maxPages == null) return rule;
      if (pageCount <= rule.maxPages) return rule;
    }
    return rules[rules.length - 1] || null;
  }

  async getSelfQcKeywords() {
    const k = await this.getTrainingKnowledge();
    return k.selfQcKeywords || [];
  }

  async getSecondarySections() {
    const k = await this.getTrainingKnowledge();
    return k.secondarySections || { markers: [], tableHints: [] };
  }

  /**
   * Build a prompt-injectable text block summarizing the training knowledge.
   * Appended to AI extraction prompts to align output with AE best practices.
   */
  async buildPromptContext() {
    try {
      const k = await this.getTrainingKnowledge();
      if (!k || !k.version) return '';

      let ctx = '\n\nAE SPEC-REVIEW BEST PRACTICES (apply these when analyzing this specification):\n';

      if (k.divisionFocus && k.divisionFocus.guidance) {
        ctx += `\nDIVISION FOCUS: ${k.divisionFocus.guidance}`;
        if (k.divisionFocus.typicalSectionPattern) {
          ctx += ` ${k.divisionFocus.typicalSectionPattern}`;
        }
        ctx += '\n';
      }

      if (k.obligationRules && k.obligationRules.definitions) {
        ctx += '\nOBLIGATION LEVEL — classify each requirement as one of "need", "should", or "conditional":\n';
        for (const [level, def] of Object.entries(k.obligationRules.definitions)) {
          ctx += `- ${level}: ${def}\n`;
        }
        if (Array.isArray(k.obligationRules.examples)) {
          for (const ex of k.obligationRules.examples) {
            ctx += `  Example: ${ex}\n`;
          }
        }
        if (k.obligationRules.note) {
          ctx += `  Note: ${k.obligationRules.note}\n`;
        }
      }

      if (Array.isArray(k.selfQcKeywords) && k.selfQcKeywords.length > 0) {
        ctx += `\nKEY TERMS TO WATCH FOR (ensure any of these present in the spec are captured as requirements): ${k.selfQcKeywords.join(', ')}.\n`;
      }

      if (k.secondarySections && Array.isArray(k.secondarySections.markers) && k.secondarySections.markers.length > 0) {
        ctx += `\nSECONDARY SECTIONS — also capture requirements found in: ${k.secondarySections.markers.join(', ')}. These (schedules, sequences of operation, panel schedules, appendix tables) are easy to miss but often contain lighting controls requirements.\n`;
      }

      return ctx;
    } catch (error) {
      console.warn('Could not build training prompt context:', error.message);
      return '';
    }
  }
}

module.exports = SpecReviewTrainingService;
