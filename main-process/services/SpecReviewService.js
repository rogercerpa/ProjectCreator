/**
 * SpecReviewService
 *
 * Rule-based spec scan. Reads a specification and checks it against the
 * Product Knowledge Base. No language model is involved.
 *
 * A rule counts as mentioned only when its keywords occur together inside a
 * short window, preferably on pages that look like a lighting-controls section.
 * A single generic word such as "system" or "lighting" is not enough.
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const WINDOW_CHARS = 1600;
const EXCERPT_CHARS = 280;

const TOO_GENERIC = new Set([
  'control', 'controls', 'system', 'systems', 'lighting', 'device', 'devices',
  'shall', 'provide', 'power', 'panel', 'requirement', 'requirements', 'section'
]);

const LIGHTING_TERMS = [
  'lighting control', 'automatic lighting', 'occupancy', 'vacancy', 'daylight',
  'photosensor', 'photo sensor', 'dimming', 'relay panel', 'time clock',
  'nlight', 'luminaire', '0-10v', '0-10 v', 'bacnet'
];

const CSI_LIGHTING = /\b(?:section\s+)?(?:26[\s.\-]*09[\s.\-]*\d{2}|25[\s.\-]*10[\s.\-]*\d{2})\b/i;

class SpecReviewService {
  constructor(productKBService) {
    this.productKBService = productKBService;
  }

  async analyzeSpec(filePath, progressCallback) {
    const reviewId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      this._progress(progressCallback, 'Reading specification...');
      const doc = await this._parseDocument(filePath);
      const pages = doc.pages.map(page => ({
        num: page.num,
        text: this._normalizeText(page.text)
      }));

      this._progress(progressCallback, 'Finding the lighting controls section...');
      const scope = this._selectScanScope(pages);

      this._progress(progressCallback, 'Loading product knowledge base...');
      const kb = await this.productKBService.load();
      if (!kb.success) {
        return { success: false, error: kb.error || 'Could not load the product knowledge base.' };
      }

      const { specRules = [], products = [], alternatives = [] } = kb.data;
      if (specRules.length === 0) {
        return { success: false, error: 'The product knowledge base has no spec rules to scan against.' };
      }

      this._progress(progressCallback, `Scanning ${specRules.length} spec rules...`);
      const scanned = this._scanRules(scope.text, scope.ranges, specRules, products, alternatives);

      const confirmed = scanned.matches.filter(match => !match.needsReview);
      const possibleMentions = scanned.matches.filter(match => match.needsReview);
      const complianceScore = this._score(confirmed, possibleMentions.length, scanned.notMentioned.length);
      const preliminaryBOM = this._buildPreliminaryBOM(confirmed);

      this._progress(progressCallback, 'Scan complete.');

      const fileName = path.basename(filePath);
      return {
        success: true,
        reviewId,
        mode: 'rule-scan',
        projectSummary: this._summaryText(fileName, scope, confirmed.length, possibleMentions.length, scanned.notMentioned.length),
        sectionInfo: {
          sectionNumber: scope.sectionNumber || '',
          sectionTitle: scope.sectionTitle
        },
        scanScope: {
          type: scope.type,
          pages: scope.pageNumbers,
          note: scope.note,
          skippedGenericRules: scanned.skippedGeneric
        },
        requirements: confirmed,
        possibleMentions,
        notMentioned: scanned.notMentioned,
        preliminaryBOM,
        gapAnalysis: confirmed.filter(item => item.status === 'gap' || item.status === 'alternative'),
        complianceScore,
        sourceFile: fileName,
        sourcePath: filePath,
        analyzedAt: new Date().toISOString(),
        analysisTimeMs: Date.now() - startTime
      };
    } catch (error) {
      console.error('Spec rule scan failed:', error);
      return { success: false, error: error.message };
    }
  }

  _progress(progressCallback, message) {
    if (typeof progressCallback === 'function') progressCallback(message);
  }

  _summaryText(fileName, scope, confirmed, possible, notMentioned) {
    const where = scope.type === 'lighting-pages'
      ? `lighting-controls pages (${scope.pageNumbers.join(', ')})`
      : 'the full document';
    return `Rule scan of ${fileName} against ${where}. ${confirmed} confirmed mentions, ${possible} to confirm, ${notMentioned} rules not found.`;
  }

  _selectScanScope(pages) {
    const scored = pages.map(page => ({
      ...page,
      score: this._lightingScore(page.text),
      hasCsi: CSI_LIGHTING.test(page.text)
    }));

    const relevant = scored.filter(page => page.hasCsi || page.score >= 2);
    const useScoped = relevant.length > 0 && relevant.length < pages.length;

    const chosen = useScoped ? this._withNeighbors(scored, relevant) : scored;
    const { text, ranges } = this._joinPages(chosen);
    const sectionHit = chosen.map(page => page.text.match(CSI_LIGHTING)).find(Boolean);

    return {
      type: useScoped ? 'lighting-pages' : 'full-document',
      text,
      ranges,
      pageNumbers: chosen.map(page => page.num),
      sectionNumber: sectionHit ? sectionHit[0].replace(/\s+/g, ' ').trim() : '',
      sectionTitle: useScoped ? 'Lighting controls section' : 'Full specification',
      note: useScoped
        ? 'Scan limited to pages that mention lighting controls. Other divisions were left out so general words do not count as a match.'
        : 'No separate lighting-controls section was detected, so the whole document was scanned. Confirm weak matches before treating them as requirements.'
    };
  }

  _lightingScore(text) {
    const lower = text.toLowerCase();
    return LIGHTING_TERMS.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
  }

  _withNeighbors(allPages, relevant) {
    const wanted = new Set();
    const byNum = new Map(allPages.map(page => [page.num, page]));
    for (const page of relevant) {
      wanted.add(page.num);
      if (byNum.has(page.num - 1)) wanted.add(page.num - 1);
      if (byNum.has(page.num + 1)) wanted.add(page.num + 1);
    }
    return allPages.filter(page => wanted.has(page.num));
  }

  _joinPages(pages) {
    let cursor = 0;
    const ranges = [];
    const chunks = [];
    for (const page of pages) {
      ranges.push({ start: cursor, end: cursor + page.text.length, num: page.num });
      chunks.push(page.text);
      cursor += page.text.length + 1;
    }
    return { text: chunks.join('\n'), ranges };
  }

  _scanRules(text, ranges, specRules, products, alternatives) {
    const matches = [];
    const notMentioned = [];
    let skippedGeneric = 0;
    const lowerText = text.toLowerCase();

    for (const rule of specRules) {
      const parsed = this._parseKeywords(rule.keywords);
      const specific = parsed.include.filter(keyword => !this._isGeneric(keyword));
      if (specific.length === 0) {
        skippedGeneric += 1;
        continue;
      }

      const best = this._bestWindow(lowerText, specific, parsed.exclude);
      if (!best) {
        notMentioned.push({
          ruleId: rule.ruleId || '',
          name: rule.requirementName || 'Untitled rule',
          category: rule.category || ''
        });
        continue;
      }

      const status = this._statusFor(rule.acuityCanMeet);
      const primaryDevices = this.productKBService._resolveDevices(rule.primaryDevices, products);
      const alternativeDevices = this.productKBService._resolveDevices(rule.alternativeDevices, products);
      const relatedAlts = this.productKBService._findAlternatives(rule.requirementName, alternatives);
      const needsReview = best.strength === 'weak';

      matches.push({
        id: rule.ruleId || `rule-${matches.length + 1}`,
        name: rule.requirementName || 'Untitled rule',
        description: rule.whenToUse || rule.notes || '',
        category: rule.category || '',
        status,
        matchStrength: best.strength,
        needsReview,
        matchedKeywords: best.keywords,
        excerpt: this._excerpt(text, best.start, best.end),
        page: this._pageFor(ranges, best.start),
        recommendedDevices: status === 'gap' ? alternativeDevices : primaryDevices,
        alternativeDevices,
        quantityGuidance: rule.quantityGuidance || '',
        whenToUse: rule.whenToUse || '',
        gapNote: status === 'met' ? null : (rule.gapNotes || rule.alternativeNotes || ''),
        kbRuleId: rule.ruleId || null,
        alternatives: relatedAlts
      });
    }

    matches.sort((a, b) => (a.page || 0) - (b.page || 0) || a.name.localeCompare(b.name));
    notMentioned.sort((a, b) => a.name.localeCompare(b.name));
    return { matches, notMentioned, skippedGeneric };
  }

  _parseKeywords(raw) {
    const include = [];
    const exclude = [];
    for (const part of String(raw || '').split(',')) {
      const keyword = part.trim().toLowerCase();
      if (!keyword) continue;
      if (keyword.startsWith('-') && keyword.length > 2) exclude.push(keyword.slice(1).trim());
      else include.push(keyword);
    }
    return { include, exclude };
  }

  _isGeneric(keyword) {
    return !keyword.includes(' ') && TOO_GENERIC.has(keyword);
  }

  _bestWindow(text, keywords, exclude) {
    const hitLists = keywords.map(keyword => ({
      keyword,
      phrase: keyword.includes(' '),
      indexes: this._findHits(text, keyword)
    })).filter(entry => entry.indexes.length > 0);

    if (hitLists.length === 0) return null;

    const minDistinct = keywords.length === 1 ? 1 : Math.max(2, Math.ceil(keywords.length * 0.5));
    let best = null;

    for (const entry of hitLists) {
      for (const index of entry.indexes) {
        const start = index;
        const end = index + WINDOW_CHARS;
        const present = hitLists.filter(candidate =>
          candidate.indexes.some(hit => hit >= start && hit < end)
        );
        if (present.length < minDistinct) continue;
        if (exclude.some(keyword => this._findHits(text.slice(start, end), keyword).length > 0)) continue;

        const phraseHit = present.some(item => item.phrase);
        const strength = phraseHit || present.length >= 3
          ? 'strong'
          : present.length >= 2
            ? 'moderate'
            : 'weak';
        const candidate = {
          start,
          end,
          keywords: present.map(item => item.keyword),
          strength,
          rank: (strength === 'strong' ? 3 : strength === 'moderate' ? 2 : 1) * 10 + present.length
        };
        if (!best || candidate.rank > best.rank) best = candidate;
      }
    }

    return best;
  }

  _findHits(text, keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = escaped.replace(/(\w+)$/, '$1s?');
    const expression = new RegExp(`\\b${pattern}\\b`, 'gi');
    const hits = [];
    let match = expression.exec(text);
    while (match) {
      hits.push(match.index);
      if (match.index === expression.lastIndex) expression.lastIndex += 1;
      match = expression.exec(text);
    }
    return hits;
  }

  _excerpt(text, start, end) {
    const sliceStart = Math.max(0, start - 80);
    const sliceEnd = Math.min(text.length, Math.max(end, start + EXCERPT_CHARS));
    const raw = text.slice(sliceStart, sliceEnd).replace(/\s+/g, ' ').trim();
    return `${sliceStart > 0 ? '…' : ''}${raw}${sliceEnd < text.length ? '…' : ''}`;
  }

  _pageFor(ranges, index) {
    const range = ranges.find(item => index >= item.start && index < item.end);
    return range ? range.num : null;
  }

  _statusFor(acuityCanMeet) {
    const value = String(acuityCanMeet || 'Yes').trim().toLowerCase();
    if (value === 'no' || value === 'n') return 'gap';
    if (value.startsWith('partial') || value === 'alternative') return 'alternative';
    return 'met';
  }

  _score(confirmed, possibleCount, notMentionedCount) {
    const met = confirmed.filter(item => item.status === 'met').length;
    const alternative = confirmed.filter(item => item.status === 'alternative').length;
    const gap = confirmed.filter(item => item.status === 'gap').length;
    const actionableTotal = met + alternative + gap;
    const score = actionableTotal === 0 ? null : Math.round((met / actionableTotal) * 100);
    return {
      score,
      met,
      alternative,
      gap,
      possible: possibleCount,
      notMentioned: notMentionedCount,
      actionableTotal,
      summary: actionableTotal === 0
        ? 'No confirmed spec rules were found in the document.'
        : `${score}% of confirmed mentions can be met — ${met} met, ${alternative} partial, ${gap} gaps. ${possibleCount} possible mentions need a look. ${notMentionedCount} rules were not in the spec.`
    };
  }

  _buildPreliminaryBOM(confirmed) {
    const rows = new Map();
    for (const requirement of confirmed) {
      if (requirement.status === 'gap') continue;
      for (const device of requirement.recommendedDevices || []) {
        const key = (device.catalogNumber || '').toUpperCase();
        if (!key) continue;
        const existing = rows.get(key) || {
          catalogNumber: device.catalogNumber,
          productFamily: device.productFamily || '',
          description: device.description || '',
          quantityGuidance: requirement.quantityGuidance || '',
          sourceRules: []
        };
        if (requirement.name && !existing.sourceRules.includes(requirement.name)) {
          existing.sourceRules.push(requirement.name);
        }
        if (!existing.quantityGuidance && requirement.quantityGuidance) {
          existing.quantityGuidance = requirement.quantityGuidance;
        }
        rows.set(key, existing);
      }
    }
    return Array.from(rows.values());
  }

  async _parseDocument(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf') {
      const { PDFParse } = require('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: dataBuffer });
      const pdfResult = await parser.getText();
      const pages = (pdfResult.pages || []).map(page => ({ num: page.num, text: page.text || '' }));
      const text = pdfResult.text || pages.map(page => page.text).join('\n');
      if (!text || text.trim().length < 50) {
        throw new Error('Spec file appears empty or too short to scan.');
      }
      return { text, pages: pages.length > 0 ? pages : [{ num: 1, text }], pageCount: pdfResult.total || pages.length || 1 };
    }

    if (ext === '.docx' || ext === '.doc') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value || '';
      if (text.trim().length < 50) throw new Error('Spec file appears empty or too short to scan.');
      return { text, pages: [{ num: 1, text }], pageCount: 1 };
    }

    if (ext === '.txt') {
      const text = await fs.readFile(filePath, 'utf-8');
      if (!text || text.trim().length < 50) throw new Error('Spec file appears empty or too short to scan.');
      return { text, pages: [{ num: 1, text }], pageCount: 1 };
    }

    throw new Error(`Unsupported file format: ${ext}. Supported: PDF, DOCX, TXT`);
  }

  _normalizeText(rawText) {
    return String(rawText || '')
      // Strips control characters that PDF/Word extraction leaves behind.
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/ {3,}/g, ' ')
      .replace(/^\s*(?:Page\s+)?\d{1,3}(?:\s+of\s+\d{1,3})?\s*$/gm, '')
      .replace(/\n{4,}/g, '\n\n\n');
  }
}

module.exports = SpecReviewService;
