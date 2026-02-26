/**
 * SpecReviewService - Core analysis engine for Spec Review feature
 *
 * Pipeline:
 *  1. Parse spec document (PDF/DOCX/TXT)
 *  2. Pre-parse CSI structure (Section/Part/sub-section boundaries)
 *  3. AI extracts requirements Part by Part (structure-aware)
 *  4. Verify completeness against pre-parsed outline
 *  5. Match actionable requirements against Product Knowledge Base
 *  6. AI validates matches and performs gap analysis
 *  7. Generate preliminary BOM and compliance score
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { DEVICE_CATEGORIES } = require('../constants/BuildingCodes');

class SpecReviewService {
  constructor(aiService, productKBService, learningService) {
    this.aiService = aiService;
    this.productKBService = productKBService;
    this.learningService = learningService;
  }

  /**
   * Run a full spec review analysis on a specification document.
   */
  async analyzeSpec(filePath, progressCallback) {
    const reviewId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      // Step 1: Parse document with page-level extraction
      this._progress(progressCallback, 'Parsing specification document...');
      const docResult = await this._parseDocument(filePath);

      const normalizedText = this._normalizeText(docResult.text);
      const normalizedPages = docResult.pages.map(p => ({
        num: p.num,
        text: this._normalizeText(p.text)
      }));

      this._logPageDiagnostics(docResult.pageCount, normalizedPages);

      // Step 2: Detect document structure (three-tier fallback)
      this._progress(progressCallback, 'Analyzing document structure...');

      // Tier 1: Extended regex detection
      let structure = this._preParseStructure(normalizedText, normalizedPages);
      console.log(`Tier 1 (regex): Detected ${structure.parts.length} Part(s), structureType=${structure.structureType}`);

      // Tier 2: AI-assisted detection if Tier 1 found no structure
      if (structure.structureType === 'none' && normalizedText.length > 2000) {
        this._progress(progressCallback, 'AI is analyzing document structure...');
        console.log('Tier 1 found no structure, attempting Tier 2 AI detection...');
        const aiStructure = await this._aiDetectStructure(normalizedText, normalizedPages);
        if (aiStructure && aiStructure.parts.length > 0) {
          structure = aiStructure;
          console.log(`Tier 2 (AI): Detected ${structure.parts.length} section(s): ${structure.parts.map(p => p.partTitle).join(', ')}`);
        } else {
          console.log('Tier 2 found no sections, falling through to Tier 3');
        }
      }

      // Tier 3: Smart page-based chunking as last resort
      if (structure.structureType === 'none' && normalizedText.length > 8000) {
        console.log('Falling back to Tier 3 smart page chunking...');
        structure = this._chunkBySize(normalizedText, normalizedPages);
      }

      console.log(`Final structure: ${structure.parts.length} part(s) in Section ${structure.sectionNumber} [${structure.structureType}]`);

      // Step 3: Extract requirements Part by Part
      let allRequirements = [];
      let projectSummary = '';

      for (const part of structure.parts) {
        const progressLabel = structure.structureType === 'unstructured'
          ? `AI is extracting requirements from ${part.context.partTitle}...`
          : `AI is extracting requirements from Part ${part.context.partNumber} - ${part.context.partTitle}...`;
        this._progress(progressCallback, progressLabel);
        const extraction = await this._extractPartRequirements(part.text, part.context);

        if (!extraction.success) {
          console.warn(`Extraction failed for Part ${part.context.partNumber}: ${extraction.error}`);
          continue;
        }

        if (extraction.projectSummary && !projectSummary) {
          projectSummary = extraction.projectSummary;
        }
        allRequirements.push(...extraction.requirements);
      }

      if (allRequirements.length === 0) {
        return { success: false, error: 'No requirements could be extracted from any Part of the specification.' };
      }

      // Step 4: Verify completeness
      const coverage = this._verifyCompleteness(structure.outline, allRequirements);
      console.log(`Coverage: ${coverage.totalExtractedItems} extracted vs ${coverage.totalExpectedItems} expected (${coverage.coveragePercent}%)`);

      // Step 5: Match actionable requirements against Product Knowledge Base
      this._progress(progressCallback, 'Matching requirements to Acuity products...');
      const actionableReqs = allRequirements.filter(r => r.requirementType === 'actionable');
      const informationalReqs = allRequirements.filter(r => r.requirementType === 'informational');

      const kbResult = await this.productKBService.matchRequirements(actionableReqs);

      // Step 6: AI validates device matches and performs gap analysis (actionable only)
      this._progress(progressCallback, 'AI is validating device recommendations...');
      const analysis = await this._runGapAnalysis(actionableReqs, kbResult.matches || []);

      // Mark informational items as acknowledged
      const acknowledgedReqs = informationalReqs.map(req => ({
        ...req,
        status: 'acknowledged',
        recommendedDevices: [],
        gapNote: null,
        kbRuleId: null,
        matchStrength: 'none',
        alternatives: []
      }));

      // Merge all requirements back, sorted by Part -> sub-section -> itemRef
      const finalRequirements = [...analysis.requirements, ...acknowledgedReqs].sort((a, b) => {
        if (a.partNumber !== b.partNumber) return a.partNumber - b.partNumber;
        if (a.subSection !== b.subSection) return (a.subSection || '').localeCompare(b.subSection || '', undefined, { numeric: true });
        return (a.itemRef || '').localeCompare(b.itemRef || '', undefined, { numeric: true });
      });

      // Step 7: Build preliminary BOM
      this._progress(progressCallback, 'Generating preliminary BOM...');
      const preliminaryBOM = this._buildPreliminaryBOM(finalRequirements);

      // Step 8: Calculate compliance score
      const complianceScore = this._calculateComplianceScore(finalRequirements);

      this._progress(progressCallback, 'Analysis complete.');

      const elapsed = Date.now() - startTime;
      console.log(`Spec review completed in ${(elapsed / 1000).toFixed(1)}s — ${finalRequirements.length} requirements found`);

      if (this.learningService) {
        this.learningService.recordAnalysis().catch(e =>
          console.warn('Could not record analysis count:', e.message)
        );
      }

      return {
        success: true,
        reviewId,
        projectSummary,
        sectionInfo: {
          sectionNumber: structure.sectionNumber,
          sectionTitle: structure.sectionTitle
        },
        requirements: finalRequirements,
        preliminaryBOM,
        gapAnalysis: finalRequirements.filter(r => r.status === 'gap' || r.status === 'alternative'),
        complianceScore,
        coverage,
        sourceFile: path.basename(filePath),
        analyzedAt: new Date().toISOString(),
        analysisTimeMs: elapsed
      };
    } catch (error) {
      console.error('Spec review analysis failed:', error);
      return { success: false, error: error.message };
    }
  }

  // ===== Internal Methods =====

  /**
   * Convert a Roman numeral string (I-X) to its integer equivalent.
   */
  _romanToInt(roman) {
    const map = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
    return map[roman.toUpperCase()] || 0;
  }

  /**
   * Try to match a line as a top-level section/part header.
   * Returns { partNumber, partTitle } or null.
   * Handles: PART X, PART I/II/III, CHAPTER X, DIVISION X, ARTICLE X,
   * decimal top-level (1.0 GENERAL), bare numbered (1 - GENERAL).
   */
  _matchPartHeader(trimmedLine) {
    const PART_ARABIC = /^PART\s+(\d+)\s*(?:[-:]\s*)?(.+)$/i;
    const PART_ROMAN = /^PART\s+(I{1,3}|IV|V|VI{0,3}|IX|X)\s*(?:[-:]\s*)?(.+)$/i;
    const CHAPTER_REGEX = /^(?:CHAPTER|DIVISION|ARTICLE)\s+(\d+)\s*(?:[-:]\s*)?(.+)$/i;
    const DECIMAL_TOP = /^(\d+)\.0\s+([A-Z][A-Z\s]+.*)$/;
    const BARE_NUMBERED = /^(\d+)\s*[-:]\s+([A-Z][A-Z\s]{2,}.*)$/;

    let m;

    m = trimmedLine.match(PART_ARABIC);
    if (m) return { partNumber: parseInt(m[1], 10), partTitle: m[2].trim().toUpperCase() };

    m = trimmedLine.match(PART_ROMAN);
    if (m) return { partNumber: this._romanToInt(m[1]), partTitle: m[2].trim().toUpperCase() };

    m = trimmedLine.match(CHAPTER_REGEX);
    if (m) return { partNumber: parseInt(m[1], 10), partTitle: m[2].trim().toUpperCase() };

    m = trimmedLine.match(DECIMAL_TOP);
    if (m) return { partNumber: parseInt(m[1], 10), partTitle: m[2].trim().toUpperCase() };

    m = trimmedLine.match(BARE_NUMBERED);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num >= 1 && num <= 10) return { partNumber: num, partTitle: m[2].trim().toUpperCase() };
    }

    return null;
  }

  /**
   * Pre-parse the spec document to identify hierarchical structure
   * and split text by major sections/parts.
   * Supports CSI MasterFormat, Roman numerals, Chapter/Division/Article
   * headings, decimal top-level sections, and bare numbered sections.
   * Accepts optional pages array for page-aware fallback detection.
   * Returns a structureType field: 'csi', 'alternative', or 'none'.
   */
  _preParseStructure(text, pages = []) {
    const lines = text.split(/\r?\n/);

    let sectionNumber = '';
    let sectionTitle = '';
    const parts = [];
    const outline = [];
    let currentPart = null;
    let structureType = 'none';

    const SECTION_REGEX = /^SECTION\s+([\d\s]+)\s*(?:[-:]\s*)(.+)?$/i;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      const sectionMatch = trimmed.match(SECTION_REGEX);
      if (sectionMatch) {
        sectionNumber = sectionMatch[1].replace(/\s+/g, ' ').trim();
        sectionTitle = (sectionMatch[2] || '').trim();
        continue;
      }

      const titleOnlyMatch = !sectionTitle && sectionNumber && trimmed.length > 3
        && !trimmed.match(/^PART\s+/i) && !trimmed.match(/^\d+\.\d+/)
        && trimmed === trimmed.toUpperCase() && trimmed.match(/[A-Z]/);
      if (titleOnlyMatch && !currentPart) {
        sectionTitle = trimmed;
        continue;
      }

      const headerMatch = this._matchPartHeader(trimmed);
      if (headerMatch) {
        if (currentPart) {
          currentPart.endLine = i - 1;
          parts.push(currentPart);
        }
        currentPart = {
          partNumber: headerMatch.partNumber,
          partTitle: headerMatch.partTitle,
          startLine: i,
          endLine: null,
          subSections: []
        };

        if (/^PART\s+/i.test(trimmed)) {
          structureType = 'csi';
        } else if (structureType !== 'csi') {
          structureType = 'alternative';
        }
        continue;
      }

      if (!currentPart) continue;

      const subMatch = trimmed.match(/^(\d+\.\d+)\s+(.+)$/);
      if (subMatch) {
        currentPart.subSections.push({
          ref: subMatch[1],
          title: subMatch[2].trim(),
          lineIndex: i,
          items: []
        });
        continue;
      }

      const currentSub = currentPart.subSections[currentPart.subSections.length - 1];
      if (!currentSub) continue;

      const letterMatch = trimmed.match(/^([A-Z])\.\s+(.+)$/);
      if (letterMatch) {
        currentSub.items.push({
          ref: letterMatch[1],
          text: letterMatch[2].trim(),
          lineIndex: i,
          subItems: []
        });
        continue;
      }

      const lastItem = currentSub.items[currentSub.items.length - 1];
      if (lastItem) {
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch) {
          lastItem.subItems.push({
            ref: numMatch[1],
            text: numMatch[2].trim(),
            lineIndex: i
          });
        }
      }
    }

    if (currentPart) {
      currentPart.endLine = lines.length - 1;
      parts.push(currentPart);
    }

    // Page-aware fallback: if regex found too few Parts for a multi-page document
    if (parts.length < 2 && pages.length > 3) {
      console.warn(`Only ${parts.length} Part(s) found by line-level regex in ${pages.length}-page document. Running page-aware fallback...`);
      const fallback = this._fallbackPartDetection(pages);
      if (fallback.parts.length > parts.length) {
        console.log(`Page-level fallback detected ${fallback.parts.length} Part(s) — adopting fallback results`);
        parts.length = 0;
        parts.push(...fallback.parts);
        if (fallback.sectionNumber && !sectionNumber) sectionNumber = fallback.sectionNumber;
        if (fallback.sectionTitle && !sectionTitle) sectionTitle = fallback.sectionTitle;
        structureType = 'csi';
      }
    }

    if (!sectionNumber) {
      const fallbackMatch = text.match(/(?:SECTION|Section)\s+([\d][\d\s]*)/i);
      if (fallbackMatch) sectionNumber = fallbackMatch[1].replace(/\s+/g, ' ').trim();
    }

    for (const part of parts) {
      if (!part.text) {
        const partLines = lines.slice(part.startLine, part.endLine + 1);
        part.text = partLines.join('\n');
      }

      outline.push({
        partNumber: part.partNumber,
        partTitle: part.partTitle,
        subSections: (part.subSections || []).map(sub => ({
          ref: sub.ref,
          title: sub.title,
          expectedItems: sub.items.length,
          items: sub.items.map(item => ({
            ref: item.ref,
            subItemCount: item.subItems.length
          }))
        }))
      });

      part.context = {
        sectionNumber: sectionNumber || 'Unknown',
        sectionTitle: sectionTitle || 'Lighting Controls',
        partNumber: part.partNumber,
        partTitle: part.partTitle,
        structureType
      };
    }

    if (parts.length === 0) {
      parts.push({
        partNumber: 0,
        partTitle: 'FULL DOCUMENT',
        text: text,
        context: {
          sectionNumber: sectionNumber || 'Unknown',
          sectionTitle: sectionTitle || 'Lighting Controls',
          partNumber: 0,
          partTitle: 'FULL DOCUMENT',
          structureType: 'none'
        },
        subSections: []
      });
      outline.push({ partNumber: 0, partTitle: 'FULL DOCUMENT', subSections: [] });
    }

    return {
      sectionNumber: sectionNumber || 'Unknown',
      sectionTitle: sectionTitle || 'Lighting Controls',
      parts,
      outline,
      structureType
    };
  }

  /**
   * Page-level fallback for Part detection. Scans each page's text using
   * _matchPartHeader (all supported formats) plus CSI title proximity matching.
   * Splits the document into Parts based on which pages contain Part headers.
   */
  _fallbackPartDetection(pages) {
    const CSI_TITLES = { 'GENERAL': 1, 'PRODUCTS': 2, 'EXECUTION': 3 };

    const partStarts = [];
    let sectionNumber = '';
    let sectionTitle = '';

    for (const page of pages) {
      const pageLines = page.text.split(/\r?\n/);

      for (const line of pageLines) {
        const trimmed = line.trim();

        if (!sectionNumber) {
          const secMatch = trimmed.match(/^SECTION\s+([\d\s]+)\s*(?:[-:]?\s*)(.+)?$/i);
          if (secMatch) {
            sectionNumber = secMatch[1].replace(/\s+/g, ' ').trim();
            sectionTitle = (secMatch[2] || '').trim();
          }
        }

        const headerMatch = this._matchPartHeader(trimmed);
        if (headerMatch && headerMatch.partNumber >= 1 && headerMatch.partNumber <= 10) {
          if (!partStarts.find(p => p.partNumber === headerMatch.partNumber)) {
            partStarts.push({ partNumber: headerMatch.partNumber, partTitle: headerMatch.partTitle, pageNum: page.num });
          }
        }
      }

      for (const [title, expectedNum] of Object.entries(CSI_TITLES)) {
        if (!partStarts.find(p => p.partNumber === expectedNum)) {
          const titleRegex = new RegExp(`\\bPART\\s+${expectedNum}\\b[\\s\\S]{0,30}\\b${title}\\b`, 'i');
          if (titleRegex.test(page.text)) {
            partStarts.push({ partNumber: expectedNum, partTitle: title, pageNum: page.num });
          }
        }
      }
    }

    if (partStarts.length === 0) {
      return { parts: [], sectionNumber, sectionTitle };
    }

    partStarts.sort((a, b) => a.partNumber - b.partNumber);

    console.log('Fallback Part detection results:');
    for (const ps of partStarts) {
      console.log(`  Part ${ps.partNumber} (${ps.partTitle}) found on page ${ps.pageNum}`);
    }

    // Build Part text by concatenating page texts between Part boundaries
    const result = [];
    for (let i = 0; i < partStarts.length; i++) {
      const startPage = partStarts[i].pageNum;
      const endPage = i + 1 < partStarts.length
        ? partStarts[i + 1].pageNum
        : pages[pages.length - 1].num + 1;

      let partText = '';
      for (const page of pages) {
        if (page.num >= startPage && page.num < endPage) {
          partText += page.text + '\n';
        }
      }

      result.push({
        partNumber: partStarts[i].partNumber,
        partTitle: partStarts[i].partTitle,
        startLine: 0,
        endLine: 0,
        subSections: [],
        text: partText.trim()
      });
    }

    // Prepend any pages before the first detected Part into Part 1's text
    if (result.length > 0 && partStarts[0].pageNum > 1) {
      let prefixText = '';
      for (const page of pages) {
        if (page.num < partStarts[0].pageNum) {
          prefixText += page.text + '\n';
        }
      }
      if (prefixText) {
        result[0].text = prefixText + result[0].text;
      }
    }

    return { parts: result, sectionNumber, sectionTitle };
  }

  /**
   * Tier 2: AI-assisted structure detection.
   * Sends the beginning of the document to the AI to identify major section
   * boundaries, then splits the full text at those markers.
   * Returns the same shape as _preParseStructure or null on failure.
   */
  async _aiDetectStructure(text, pages) {
    const preview = text.substring(0, 4000);

    const systemPrompt = `You are a document structure analyzer. Examine the opening of this specification document and identify its major top-level sections or divisions.

Return a JSON object with this exact structure:
{
  "documentType": "csi_spec|narrative_spec|outline|other",
  "sectionNumber": "The specification section number if found (e.g., '26 05 15'), or empty string",
  "sectionTitle": "The specification section title if found, or empty string",
  "sections": [
    {
      "number": 1,
      "title": "SECTION TITLE IN CAPS",
      "markerText": "The exact line of text that starts this section, copied verbatim"
    }
  ]
}

RULES:
- Only identify TOP-LEVEL sections (the biggest structural divisions), not sub-sections
- The markerText must be an exact copy of the heading line so it can be found via string search
- Number sections sequentially starting from 1
- Include ALL top-level sections you can identify from the document preview
- If you cannot identify clear section boundaries, return an empty sections array`;

    const userPrompt = `Identify the top-level sections in this specification document:\n\n${preview}`;

    try {
      const result = await this.aiService.chatCompletion(systemPrompt, userPrompt, {
        jsonMode: true,
        maxTokens: 2048,
        timeout: 30000
      });

      if (!result.sections || result.sections.length === 0) {
        console.log('AI structure detection found no sections');
        return null;
      }

      console.log(`AI structure detection found ${result.sections.length} section(s): ${result.sections.map(s => s.title).join(', ')}`);

      const lines = text.split(/\r?\n/);
      const parts = [];
      const sectionNumber = result.sectionNumber || '';
      const sectionTitle = result.sectionTitle || '';

      for (const section of result.sections) {
        const marker = section.markerText || '';
        let startLine = -1;

        if (marker) {
          const markerNorm = marker.trim().toLowerCase();
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().toLowerCase() === markerNorm) {
              startLine = i;
              break;
            }
          }
          if (startLine === -1) {
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].trim().toLowerCase().includes(markerNorm)) {
                startLine = i;
                break;
              }
            }
          }
        }

        if (startLine === -1 && section.title) {
          const titleNorm = section.title.trim().toLowerCase();
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().toLowerCase().includes(titleNorm)) {
              startLine = i;
              break;
            }
          }
        }

        if (startLine !== -1) {
          parts.push({
            partNumber: section.number,
            partTitle: (section.title || '').toUpperCase(),
            startLine,
            endLine: null,
            subSections: []
          });
        }
      }

      if (parts.length === 0) {
        console.warn('AI detected sections but markers could not be located in the text');
        return null;
      }

      parts.sort((a, b) => a.startLine - b.startLine);
      for (let i = 0; i < parts.length; i++) {
        parts[i].endLine = i + 1 < parts.length
          ? parts[i + 1].startLine - 1
          : lines.length - 1;
      }

      if (parts[0].startLine > 0) {
        const prefixLines = lines.slice(0, parts[0].startLine);
        const prefixText = prefixLines.join('\n');
        parts[0].startLine = 0;
        parts[0].text = prefixText + '\n' + lines.slice(parts[0].startLine, parts[0].endLine + 1).join('\n');
      }

      const outline = [];
      for (const part of parts) {
        if (!part.text) {
          part.text = lines.slice(part.startLine, part.endLine + 1).join('\n');
        }

        part.context = {
          sectionNumber: sectionNumber || 'Unknown',
          sectionTitle: sectionTitle || 'Lighting Controls',
          partNumber: part.partNumber,
          partTitle: part.partTitle,
          structureType: 'alternative'
        };

        outline.push({
          partNumber: part.partNumber,
          partTitle: part.partTitle,
          subSections: []
        });
      }

      return {
        sectionNumber: sectionNumber || 'Unknown',
        sectionTitle: sectionTitle || 'Lighting Controls',
        parts,
        outline,
        structureType: 'alternative'
      };
    } catch (error) {
      console.warn('AI structure detection failed:', error.message);
      return null;
    }
  }

  /**
   * Tier 3: Split pages into size-constrained chunks for documents
   * where no structural sections could be detected.
   * Each chunk targets ~targetChars characters, split on page boundaries.
   * Returns a structure compatible with _preParseStructure output.
   */
  _chunkBySize(text, pages, targetChars = 8000) {
    if (!pages || pages.length === 0) {
      return {
        sectionNumber: 'Unknown',
        sectionTitle: 'Lighting Controls',
        parts: [{
          partNumber: 1,
          partTitle: 'FULL DOCUMENT',
          text,
          context: {
            sectionNumber: 'Unknown',
            sectionTitle: 'Lighting Controls',
            partNumber: 1,
            partTitle: 'FULL DOCUMENT',
            structureType: 'unstructured'
          },
          subSections: []
        }],
        outline: [{ partNumber: 1, partTitle: 'FULL DOCUMENT', subSections: [] }],
        structureType: 'unstructured'
      };
    }

    const chunks = [];
    let currentChunk = { pages: [], chars: 0 };
    const OVERLAP_CHARS = 500;

    for (const page of pages) {
      currentChunk.pages.push(page);
      currentChunk.chars += page.text.length;

      if (currentChunk.chars >= targetChars) {
        chunks.push(currentChunk);
        const lastPageText = page.text;
        const overlapText = lastPageText.substring(Math.max(0, lastPageText.length - OVERLAP_CHARS));
        currentChunk = { pages: [], chars: 0, overlapPrefix: overlapText };
      }
    }

    if (currentChunk.pages.length > 0) {
      chunks.push(currentChunk);
    }

    let sectionNumber = 'Unknown';
    const secMatch = text.match(/(?:SECTION|Section)\s+([\d][\d\s]*)/i);
    if (secMatch) sectionNumber = secMatch[1].replace(/\s+/g, ' ').trim();

    const parts = chunks.map((chunk, idx) => {
      const firstPage = chunk.pages[0].num;
      const lastPage = chunk.pages[chunk.pages.length - 1].num;
      let chunkText = (chunk.overlapPrefix || '') + chunk.pages.map(p => p.text).join('\n');

      return {
        partNumber: idx + 1,
        partTitle: `PAGES ${firstPage}-${lastPage}`,
        text: chunkText,
        startLine: 0,
        endLine: 0,
        subSections: [],
        context: {
          sectionNumber,
          sectionTitle: 'Lighting Controls',
          partNumber: idx + 1,
          partTitle: `PAGES ${firstPage}-${lastPage}`,
          structureType: 'unstructured',
          pageRange: { first: firstPage, last: lastPage },
          totalPages: pages.length
        }
      };
    });

    const outline = parts.map(p => ({
      partNumber: p.partNumber,
      partTitle: p.partTitle,
      subSections: []
    }));

    console.log(`Smart chunking: split ${pages.length} pages into ${chunks.length} chunk(s)`);
    for (const p of parts) {
      console.log(`  Chunk ${p.partNumber}: ${p.partTitle} (${p.text.length} chars)`);
    }

    return {
      sectionNumber,
      sectionTitle: 'Lighting Controls',
      parts,
      outline,
      structureType: 'unstructured'
    };
  }

  /**
   * Parse a spec document into plain text with page-level extraction.
   * Returns { text, pages: [{ num, text }], pageCount }.
   */
  async _parseDocument(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf') {
      const { PDFParse } = require('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: dataBuffer });
      const pdfResult = await parser.getText();

      const pageCount = pdfResult.total || 0;
      const pages = (pdfResult.pages || []).map(p => ({ num: p.num, text: p.text || '' }));
      const text = pdfResult.text || '';

      console.log(`PDF extraction: ${pageCount} pages, ${text.length} characters total`);
      for (const page of pages) {
        console.log(`  Page ${page.num}: ${page.text.length} chars`);
      }

      if (!text || text.trim().length < 50) {
        throw new Error('Spec file appears empty or too short to extract requirements');
      }

      return { text, pages, pageCount };
    } else if (ext === '.docx' || ext === '.doc') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;

      if (!text || text.trim().length < 50) {
        throw new Error('Spec file appears empty or too short to extract requirements');
      }

      return { text, pages: [{ num: 1, text }], pageCount: 1 };
    } else if (ext === '.txt') {
      const text = await fs.readFile(filePath, 'utf-8');

      if (!text || text.trim().length < 50) {
        throw new Error('Spec file appears empty or too short to extract requirements');
      }

      return { text, pages: [{ num: 1, text }], pageCount: 1 };
    } else {
      throw new Error(`Unsupported file format: ${ext}. Supported: PDF, DOCX, TXT`);
    }
  }

  /**
   * Clean up PDF extraction artifacts to produce consistent text for parsing.
   */
  _normalizeText(rawText) {
    let text = rawText;
    // Strip null bytes and control characters (keep newline, carriage return, tab)
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    // Normalize unicode dash variants to standard hyphen
    text = text.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-');
    // Normalize unicode quotation marks to ASCII equivalents
    text = text.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
    text = text.replace(/[\u201C\u201D\u201E\u201F]/g, '"');
    // Collapse runs of 3+ spaces into a single space
    text = text.replace(/ {3,}/g, ' ');
    // Remove standalone page number lines (e.g., "12", "Page 12", "12 of 18")
    text = text.replace(/^\s*(?:Page\s+)?\d{1,3}(?:\s+of\s+\d{1,3})?\s*$/gm, '');
    // Normalize 4+ consecutive blank lines into 2
    text = text.replace(/\n{4,}/g, '\n\n\n');
    return text;
  }

  /**
   * Log page-level extraction diagnostics for debugging.
   */
  _logPageDiagnostics(pageCount, pages) {
    const partMarkerRegex = /\bPART\s+\d+\b/i;
    const pagesWithParts = pages.filter(p => partMarkerRegex.test(p.text));
    const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);

    console.log(`Document diagnostics: ${pageCount} pages, ${totalChars} chars total`);
    if (pagesWithParts.length > 0) {
      console.log(`  PART markers found on pages: ${pagesWithParts.map(p => p.num).join(', ')}`);
    } else {
      console.log(`  No PART markers detected on any page`);
    }
    for (const page of pages) {
      const snippet = page.text.substring(0, 80).replace(/\n/g, ' ').trim();
      console.log(`  Page ${page.num} (${page.text.length} chars): "${snippet}..."`);
    }
  }

  /**
   * Build structure-aware prompt blocks based on how the document was parsed.
   * Returns partRef, description, extractionRules, and example fields.
   */
  _buildStructurePromptBlock(partContext) {
    const { sectionNumber, partNumber, partTitle, structureType, pageRange, totalPages } = partContext;
    const pn = partNumber > 0 ? partNumber : 1;

    if (structureType === 'unstructured') {
      const rangeDesc = pageRange
        ? `pages ${pageRange.first}-${pageRange.last} of ${totalPages}`
        : 'a portion of the document';
      return {
        partRef: `${partTitle} (${rangeDesc})`,
        description: `This is ${rangeDesc} of a specification document. The document may not follow a standard format. Analyze all content in this section and identify every individual requirement, regardless of how the document is organized.`,
        extractionRules: `- Create one requirement entry for EVERY distinct requirement, bullet point, or specification item you find
- Do NOT consolidate multiple items into one requirement
- Identify whatever structure exists (numbered items, lettered items, paragraphs with distinct requirements)
- If no clear sub-section numbering exists, use sequential numbering for subSection (e.g., "1.1", "1.2")`,
        subSectionExample: 'e.g., 1.1 (use whatever numbering the document provides, or sequential)',
        itemRefExample: 'e.g., A or 1 (use the document\'s own referencing, or sequential)',
        sourceSectionExample: `'${partTitle}, item ref'`
      };
    }

    if (structureType === 'alternative') {
      return {
        partRef: `Section ${partNumber} - ${partTitle}`,
        description: `This document uses a sectioned format. Each section may contain numbered sub-sections, lettered items, or other hierarchical elements. Preserve the document's own numbering and organization.`,
        extractionRules: `- Create one requirement entry for EVERY individual item (lettered, numbered, or bulleted)
- Do NOT consolidate multiple items into one requirement
- Preserve the exact hierarchical position using the document's own numbering scheme
- Adapt to the document's structure — it may use different numbering than standard CSI format`,
        subSectionExample: `e.g., ${pn}.1 (match the document's numbering)`,
        itemRefExample: 'e.g., A or B.1 (letter, and sub-item number if applicable)',
        sourceSectionExample: `'Section ${sectionNumber}, ${pn}.1.A'`
      };
    }

    return {
      partRef: partNumber > 0 ? `PART ${partNumber} - ${partTitle}` : 'the specification',
      description: `This document follows CSI MasterFormat structure. Each PART contains numbered sub-sections (e.g., ${pn}.1, ${pn}.2), and each sub-section has lettered items (A, B, C...) which may have numbered sub-items (1, 2, 3...).`,
      extractionRules: `- You MUST create one requirement entry for EVERY individual lettered item (A, B, C...) and every numbered sub-item (1, 2, 3...)
- Do NOT consolidate multiple items into one requirement — each bullet point in the spec is its own requirement
- Preserve the exact hierarchical position of each item (sub-section number, letter, sub-item number)`,
      subSectionExample: `e.g., ${pn}.1`,
      itemRefExample: 'e.g., A or B.1 (letter, and sub-item number if applicable)',
      sourceSectionExample: `'Section ${sectionNumber}, ${pn}.1.A'`
    };
  }

  /**
   * AI pass 1: Extract structured requirements from a single Part/section/chunk.
   * Adapts the prompt based on structureType in the context.
   */
  async _extractPartRequirements(partText, partContext) {
    let learningContext = '';
    if (this.learningService) {
      try {
        learningContext = await this.learningService.buildPromptContext();
      } catch (e) {
        console.warn('Could not load learning context:', e.message);
      }
    }

    const { sectionNumber, sectionTitle, partNumber, partTitle, structureType } = partContext;
    const sectionRef = sectionNumber !== 'Unknown' ? `Section ${sectionNumber}` : 'this specification';

    const structureBlock = this._buildStructurePromptBlock(partContext);
    const partRef = structureBlock.partRef;

    const systemPrompt = `You are an expert lighting controls engineer specializing in Acuity Brands products (nLight, SensorSwitch, Fresco, Pathway, DALI, BACnet systems).

You are analyzing ${partRef} of ${sectionRef} (${sectionTitle}).

${structureBlock.description}

CRITICAL EXTRACTION RULES:
${structureBlock.extractionRules}
- If an item is purely procedural and does not require a device or product, set requirementType to "informational"
- If an item describes a product need, integration, or device capability, set requirementType to "actionable"

Return a JSON object with this exact structure:
{
  "projectSummary": "Brief 2-3 sentence description of the project scope (only include for the first section, otherwise set to empty string)",
  "requirements": [
    {
      "id": "${sectionNumber.replace(/\s+/g, '_')}_P${partNumber}_subsection_itemRef",
      "sectionNumber": "${sectionNumber}",
      "sectionTitle": "${sectionTitle}",
      "partNumber": ${partNumber},
      "partTitle": "${partTitle}",
      "subSection": "${structureBlock.subSectionExample}",
      "subSectionTitle": "e.g., SCOPE OF WORK",
      "itemRef": "${structureBlock.itemRefExample}",
      "name": "Short descriptive name for this specific item",
      "requirementType": "actionable|informational",
      "category": "Energy|Life Safety|Integration|Controls|Power|Commissioning|Products|General",
      "description": "Detailed description of what this specific item requires",
      "specKeywords": ["specific terms from the spec that indicate this requirement"],
      "deviceCategories": ["relevant device categories, or empty array if informational"],
      "integrationType": "bacnet|hvac|fire_alarm|av|dmx|dali|scheduling|demand_response|none",
      "confidence": "high|medium|low",
      "sourceSection": "${structureBlock.sourceSectionExample}",
      "specExcerpt": "Verbatim quoted text from the spec for this item. Copy the actual spec language."
    }
  ]
}

Valid device categories: ${DEVICE_CATEGORIES.join(', ')}

IMPORTANT GUIDANCE:
- For specExcerpt, quote the actual spec text for each individual item — this is critical for agent review
- Extract EVERY item in this section, not just the obvious ones
- Include integration requirements (BMS, HVAC, fire alarm, AV, DMX)
- Include energy code requirements (occupancy sensing, daylight harvesting, scheduling)
- Include life safety requirements (emergency lighting, exit signs)
- Include commissioning and testing requirements
- Include any specific product or manufacturer requirements (especially "or equal" clauses)
- If the spec mentions a competitor product (Lutron, Crestron, etc.), still extract the requirement
- Items like "follow published standards" or "assist system commissioning" are informational — still extract them

CONFIDENCE CLASSIFICATION RULES:
- "high": The spec explicitly and unambiguously states this requirement
- "medium": The requirement is implied or can be reasonably inferred from the spec context
- "low": The spec language is vague, ambiguous, or could be interpreted multiple ways
- Be consistent: the same spec language should always produce the same extraction
- Do NOT over-extract: only include items that are clearly present in the text${learningContext}`;

    const userPrompt = `Extract ALL individual requirements from ${partRef} of this specification. Create one entry per distinct requirement or bullet point:\n\n${partText}`;

    try {
      const result = await this.aiService.chatCompletion(systemPrompt, userPrompt, {
        jsonMode: true,
        maxTokens: 32768,
        timeout: 240000
      });

      const requirements = (result.requirements || []).map((req, index) => ({
        ...req,
        id: req.id || `${sectionNumber.replace(/\s+/g, '_')}_P${partNumber}_req_${index + 1}`,
        sectionNumber: req.sectionNumber || sectionNumber,
        sectionTitle: req.sectionTitle || sectionTitle,
        partNumber: req.partNumber ?? partNumber,
        partTitle: req.partTitle || partTitle,
        subSection: req.subSection || '',
        subSectionTitle: req.subSectionTitle || '',
        itemRef: req.itemRef || '',
        requirementType: req.requirementType || 'actionable',
        specKeywords: req.specKeywords || [],
        integrationType: req.integrationType || 'none',
        specExcerpt: req.specExcerpt || '',
        confidence: req.confidence || 'medium'
      }));

      return {
        success: true,
        projectSummary: result.projectSummary || '',
        requirements
      };
    } catch (error) {
      console.error(`AI extraction failed for Part ${partNumber}:`, error);

      if (error.message && error.message.includes('JSON') && error.rawResponse) {
        try {
          const repaired = this._repairTruncatedJSON(error.rawResponse);
          if (repaired && repaired.requirements && repaired.requirements.length > 0) {
            console.warn(`Recovered ${repaired.requirements.length} requirements from truncated JSON for Part ${partNumber}`);
            const requirements = repaired.requirements.map((req, index) => ({
              ...req,
              id: req.id || `${sectionNumber.replace(/\s+/g, '_')}_P${partNumber}_req_${index + 1}`,
              sectionNumber: req.sectionNumber || sectionNumber,
              sectionTitle: req.sectionTitle || sectionTitle,
              partNumber: req.partNumber ?? partNumber,
              partTitle: req.partTitle || partTitle,
              subSection: req.subSection || '',
              subSectionTitle: req.subSectionTitle || '',
              itemRef: req.itemRef || '',
              requirementType: req.requirementType || 'actionable',
              specKeywords: req.specKeywords || [],
              integrationType: req.integrationType || 'none',
              specExcerpt: req.specExcerpt || '',
              confidence: req.confidence || 'medium'
            }));
            return { success: true, projectSummary: repaired.projectSummary || '', requirements };
          }
        } catch (repairError) {
          console.warn(`JSON repair also failed for Part ${partNumber}:`, repairError.message);
        }
      }

      return { success: false, error: `AI extraction failed for Part ${partNumber}: ${error.message}`, requirements: [] };
    }
  }

  /**
   * Attempt to repair truncated JSON from AI output by closing open arrays/objects.
   * Returns parsed object or null if repair fails.
   */
  _repairTruncatedJSON(rawText) {
    let text = rawText.trim();

    const jsonStart = text.indexOf('{');
    if (jsonStart === -1) return null;
    text = text.substring(jsonStart);

    const lastCompleteObj = text.lastIndexOf('}');
    if (lastCompleteObj === -1) return null;

    let candidate = text.substring(0, lastCompleteObj + 1);

    const openBraces = (candidate.match(/\{/g) || []).length;
    const closeBraces = (candidate.match(/\}/g) || []).length;
    const openBrackets = (candidate.match(/\[/g) || []).length;
    const closeBrackets = (candidate.match(/\]/g) || []).length;

    let suffix = '';
    for (let i = 0; i < openBrackets - closeBrackets; i++) suffix += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) suffix += '}';

    candidate = candidate + suffix;

    candidate = candidate.replace(/,\s*([}\]])/g, '$1');

    try {
      return JSON.parse(candidate);
    } catch {
      const reqArrayMatch = text.match(/"requirements"\s*:\s*\[/);
      if (!reqArrayMatch) return null;

      const arrayStart = reqArrayMatch.index + reqArrayMatch[0].length;
      let depth = 1;
      let lastObjEnd = -1;

      for (let i = arrayStart; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
          depth--;
          if (depth === 1) lastObjEnd = i;
        } else if (text[i] === '[') depth++;
        else if (text[i] === ']') depth--;
      }

      if (lastObjEnd > 0) {
        const repairedArray = text.substring(arrayStart, lastObjEnd + 1);
        const fullJson = `{"requirements":[${repairedArray}]}`;
        try {
          return JSON.parse(fullJson.replace(/,\s*([}\]])/g, '$1'));
        } catch {
          return null;
        }
      }

      return null;
    }
  }

  /**
   * Compare pre-parsed outline against extracted requirements to identify
   * any sub-sections or items that the AI may have missed.
   */
  _verifyCompleteness(outline, extractedRequirements) {
    let totalExpected = 0;
    let totalExtracted = extractedRequirements.length;
    const missedSections = [];
    const partCoverage = [];

    for (const part of outline) {
      let partExpected = 0;
      let partExtracted = 0;
      const partReqs = extractedRequirements.filter(r => r.partNumber === part.partNumber);

      for (const sub of part.subSections) {
        const expectedCount = sub.expectedItems + sub.items.reduce((sum, it) => sum + it.subItemCount, 0);
        partExpected += expectedCount;
        totalExpected += expectedCount;

        const subReqs = partReqs.filter(r => r.subSection === sub.ref);
        partExtracted += subReqs.length;

        if (expectedCount > 0 && subReqs.length === 0) {
          missedSections.push({
            partNumber: part.partNumber,
            partTitle: part.partTitle,
            subSection: sub.ref,
            subSectionTitle: sub.title,
            expectedItems: expectedCount
          });
        }
      }

      partCoverage.push({
        partNumber: part.partNumber,
        partTitle: part.partTitle,
        expectedItems: partExpected,
        extractedItems: partExtracted
      });
    }

    if (missedSections.length > 0) {
      console.warn(`Coverage gaps detected — ${missedSections.length} sub-section(s) with zero extracted requirements:`,
        missedSections.map(m => `${m.subSection} ${m.subSectionTitle}`).join(', '));
    }

    return {
      totalExpectedItems: totalExpected,
      totalExtractedItems: totalExtracted,
      missedSections,
      partCoverage,
      coveragePercent: totalExpected > 0 ? Math.round((totalExtracted / totalExpected) * 100) : 100
    };
  }

  /**
   * AI pass 2: Validate KB matches and perform gap analysis.
   * Collects candidate devices from KB, then asks AI to validate each pairing.
   */
  async _runGapAnalysis(requirements, kbMatches) {
    const enrichedRequirements = requirements.map(req => {
      const kbMatch = kbMatches.find(m => m.requirementId === req.id);

      if (kbMatch && kbMatch.hasMatch) {
        const bestMatch = kbMatch.bestMatch;
        const candidateDevices = [];

        for (const rule of kbMatch.matchedRules) {
          for (const dev of rule.primaryDevices) {
            if (!candidateDevices.find(d => d.catalogNumber === dev.catalogNumber)) {
              candidateDevices.push({
                catalogNumber: dev.catalogNumber,
                productFamily: dev.productFamily,
                description: dev.description,
                role: 'primary',
                quantity: rule.quantityGuidance || '',
                notes: rule.whenToUse || '',
                sourceRule: rule.ruleName
              });
            }
          }
          for (const dev of rule.alternativeDevices) {
            if (!candidateDevices.find(d => d.catalogNumber === dev.catalogNumber)) {
              candidateDevices.push({
                catalogNumber: dev.catalogNumber,
                productFamily: dev.productFamily,
                description: dev.description,
                role: 'alternative',
                quantity: rule.quantityGuidance || '',
                notes: rule.alternativeNotes || '',
                sourceRule: rule.ruleName
              });
            }
          }
        }

        const canMeet = bestMatch.acuityCanMeet || 'Yes';
        let status = 'met';
        let gapNote = null;

        if (canMeet === 'No') {
          status = 'gap';
          gapNote = bestMatch.gapNotes || 'Acuity does not have a direct solution for this requirement.';
        } else if (canMeet === 'Partial') {
          status = 'alternative';
          gapNote = bestMatch.gapNotes || 'Acuity offers a partial or alternative solution.';
        }

        return {
          ...req,
          status,
          candidateDevices,
          recommendedDevices: candidateDevices,
          gapNote,
          kbRuleId: bestMatch.ruleId,
          matchStrength: bestMatch.matchStrength,
          alternatives: bestMatch.alternatives || []
        };
      }

      return {
        ...req,
        status: 'gap',
        candidateDevices: [],
        recommendedDevices: [],
        gapNote: 'No matching rule found in the Product Knowledge Base. A DAS team member should review this requirement and add a rule if applicable.',
        kbRuleId: null,
        matchStrength: 'none',
        alternatives: []
      };
    });

    // AI validation: filter candidate devices for relevance
    const reqsWithCandidates = enrichedRequirements.filter(r => r.candidateDevices && r.candidateDevices.length > 0);
    if (reqsWithCandidates.length > 0) {
      try {
        const validated = await this._aiValidateDevices(reqsWithCandidates);
        for (const v of validated) {
          const idx = enrichedRequirements.findIndex(r => r.id === v.id);
          if (idx !== -1) {
            enrichedRequirements[idx].recommendedDevices = v.recommendedDevices;
            if (v.status) enrichedRequirements[idx].status = v.status;
            if (v.status === 'met') {
              enrichedRequirements[idx].gapNote = null;
            } else if (v.gapNote) {
              enrichedRequirements[idx].gapNote = v.gapNote;
            }
          }
        }
      } catch (error) {
        console.warn('AI device validation failed, using unfiltered candidates:', error.message);
      }
    }

    // Clean up temporary candidateDevices field
    for (const req of enrichedRequirements) {
      delete req.candidateDevices;
    }

    // AI pass to refine unmatched requirements
    const unmatchedReqs = enrichedRequirements.filter(r => r.status === 'gap' && r.kbRuleId === null);
    if (unmatchedReqs.length > 0) {
      try {
        const refinedUnmatched = await this._aiRefineUnmatched(unmatchedReqs);
        for (const refined of refinedUnmatched) {
          const idx = enrichedRequirements.findIndex(r => r.id === refined.id);
          if (idx !== -1) {
            enrichedRequirements[idx] = { ...enrichedRequirements[idx], ...refined };
          }
        }
      } catch (error) {
        console.warn('AI refinement of unmatched requirements failed:', error.message);
      }
    }

    return { requirements: enrichedRequirements };
  }

  /**
   * AI validates candidate devices against each requirement, filtering out
   * devices that don't actually match the requirement's intent.
   */
  async _aiValidateDevices(requirementsWithCandidates) {
    const payload = requirementsWithCandidates.map(req => ({
      id: req.id,
      name: req.name,
      description: req.description,
      category: req.category,
      specExcerpt: req.specExcerpt || '',
      candidateDevices: req.candidateDevices.map(d => ({
        catalogNumber: d.catalogNumber,
        description: d.description,
        productFamily: d.productFamily,
        role: d.role,
        quantity: d.quantity,
        notes: d.notes
      }))
    }));

    let learningContext = '';
    if (this.learningService) {
      try {
        learningContext = await this.learningService.buildPromptContext();
      } catch (e) {
        console.warn('Could not load learning context for validation:', e.message);
      }
    }

    const productCatalog = await this._buildProductCatalogPrompt();

    let systemPrompt = `You are an expert Acuity Brands lighting controls engineer. Your task is to VALIDATE device recommendations against spec requirements.

For each requirement below, you are given a list of CANDIDATE devices that were suggested by keyword matching. Some of these devices may NOT actually be relevant to the requirement. Your job is to:

1. READ the requirement description and spec excerpt carefully
2. CONSULT the FULL PRODUCT CATALOG below to understand what each device actually does — its capabilities, category, and family
3. REMOVE any device that does NOT genuinely address the requirement. A device must functionally match what the spec is asking for — not just share a keyword.
4. KEEP only devices whose described function directly serves the requirement
5. If a better device exists in the full catalog that was NOT in the candidate list, you may ADD it as an alternative
6. Adjust the status if needed after filtering

CRITICAL RULES:
- If a device's description says it does X, but the requirement asks for Y, REMOVE it — even if X and Y share a keyword
- Example: An "Exterior Twilight Sensor" (photocell for dusk-to-dawn exterior lighting) should NOT be recommended for a "Daylight Harvesting" (interior photosensor for dimming based on daylight) requirement, even though both involve light sensing
- Example: A "Contact Closure Input" for fire alarm integration should NOT be recommended for occupancy sensing, even though both are inputs
- Only recommend devices that can ACTUALLY perform the function the spec requires
- If after filtering no devices remain, set status to "gap"
- Always cross-reference devices against the FULL PRODUCT CATALOG to verify their actual capabilities before including them

## FULL PRODUCT CATALOG (Use this as your source of truth for device capabilities):
${productCatalog}`;

    if (learningContext) {
      systemPrompt += `\n\n## LEARNINGS FROM PAST ANALYSES (Apply these corrections and patterns):\n${learningContext}`;
    }

    systemPrompt += `\n\nIMPORTANT OUTPUT RULES:
- Do NOT mention removed or filtered-out devices in any field. The user should never see why a device was excluded.
- The "notes" field on each device should ONLY explain why THAT device meets the requirement.
- The "gapNote" field should ONLY appear when status is "gap" or "alternative" and should explain what capability is missing or partially covered — NOT which devices were removed.
- For "met" status, set gapNote to null or omit it entirely.

Return JSON:
{
  "validated": [
    {
      "id": "requirement_id",
      "status": "met|alternative|gap",
      "recommendedDevices": [
        {
          "catalogNumber": "exact catalog number from candidate list or full catalog",
          "productFamily": "product family",
          "description": "device description",
          "role": "primary|alternative",
          "quantity": "quantity guidance",
          "notes": "brief explanation of how this device fulfills the requirement"
        }
      ],
      "gapNote": "only if status is gap or alternative — describe what capability is missing or partially met"
    }
  ]
}`;

    const userPrompt = `Validate these device-requirement pairings. Return ONLY the devices that genuinely match each requirement. Do NOT mention or explain any devices you chose to exclude:\n${JSON.stringify(payload, null, 2)}`;

    const result = await this.aiService.chatCompletion(systemPrompt, userPrompt, {
      jsonMode: true,
      maxTokens: 8192,
      timeout: 90000
    });

    return result.validated || [];
  }

  /**
   * AI attempts to suggest devices for requirements that had no KB match.
   * Loads the full product catalog from the Knowledge Base so the AI has
   * up-to-date product data instead of a hardcoded list.
   */
  async _aiRefineUnmatched(unmatchedReqs) {
    const reqSummaries = unmatchedReqs.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      specExcerpt: r.specExcerpt || ''
    }));

    let learningContext = '';
    if (this.learningService) {
      try {
        learningContext = await this.learningService.buildPromptContext();
      } catch (e) {
        console.warn('Could not load learning context:', e.message);
      }
    }

    const productCatalog = await this._buildProductCatalogPrompt();

    const systemPrompt = `You are an expert on Acuity Brands / nLight / SensorSwitch lighting controls products.

Given lighting controls requirements that could not be automatically matched to products, suggest the best Acuity device(s) for each requirement.

AVAILABLE ACUITY PRODUCTS (from the Product Knowledge Base):
${productCatalog}

Return JSON:
{
  "refinements": [
    {
      "id": "requirement_id",
      "status": "met|alternative|gap",
      "recommendedDevices": [
        {
          "catalogNumber": "exact catalog number from the product list above",
          "productFamily": "product family",
          "description": "device description",
          "role": "primary|alternative",
          "quantity": "quantity guidance",
          "notes": "brief explanation of how this device fulfills the requirement"
        }
      ],
      "gapNote": "only if status is gap or alternative — describe what capability is missing or partially met"
    }
  ]
}

CRITICAL RULES:
- ONLY recommend devices from the product list above — do not invent catalog numbers
- A device must functionally match what the requirement asks for based on its description and capabilities
- If an Acuity product can directly meet the requirement, set status to "met"
- If Acuity has a product that partially meets or offers a comparable alternative, set status to "alternative" — NOT "gap"
- Only set status to "gap" if you are CERTAIN that no Acuity product can address this requirement at all
- When in doubt between "met" and "alternative", choose "alternative" and explain in gapNote
- When in doubt between "alternative" and "gap", choose "alternative" and explain in gapNote
- NEVER classify something as "gap" just because you are unsure — uncertainty should result in "alternative" with a note${learningContext}`;

    const userPrompt = `Suggest Acuity devices for these unmatched requirements:\n${JSON.stringify(reqSummaries, null, 2)}`;

    const result = await this.aiService.chatCompletion(systemPrompt, userPrompt, {
      jsonMode: true,
      maxTokens: 4096,
      timeout: 60000
    });

    return result.refinements || [];
  }

  /**
   * Build a formatted product catalog string from the live Knowledge Base
   * for injection into AI prompts.
   */
  async _buildProductCatalogPrompt() {
    try {
      const prodResult = await this.productKBService.getProducts();
      if (!prodResult.success || !prodResult.products) return '(Product catalog unavailable)';

      const activeProducts = prodResult.products.filter(p => p.active !== 'No' && p.active !== false);

      const lines = activeProducts.map(p => {
        const parts = [`- ${p.catalogNumber}: ${p.description || 'No description'}`];
        if (p.capabilities) parts.push(`  Capabilities: ${p.capabilities}`);
        if (p.category) parts.push(`  Category: ${p.category}`);
        if (p.productFamily) parts.push(`  Family: ${p.productFamily}`);
        return parts.join('\n');
      });

      return lines.join('\n');
    } catch (error) {
      console.warn('Could not load product catalog for prompt:', error.message);
      return '(Product catalog unavailable)';
    }
  }

  /**
   * Aggregate recommended devices into a preliminary BOM.
   */
  _buildPreliminaryBOM(requirements) {
    const bomMap = new Map();

    for (const req of requirements) {
      if (!req.recommendedDevices) continue;

      for (const device of req.recommendedDevices) {
        if (device.role !== 'primary') continue;
        if (!device.catalogNumber) continue;

        const key = device.catalogNumber;
        if (bomMap.has(key)) {
          const existing = bomMap.get(key);
          if (!existing.sourceRequirements.includes(req.name)) {
            existing.sourceRequirements.push(req.name);
          }
        } else {
          bomMap.set(key, {
            catalogNumber: device.catalogNumber,
            productFamily: device.productFamily || '',
            description: device.description || '',
            suggestedQuantity: device.quantity || 'TBD based on floor plan',
            sourceRequirements: [req.name]
          });
        }
      }
    }

    return Array.from(bomMap.values()).sort((a, b) => {
      const familyOrder = ['nLight Wired', 'nLight Air', 'SensorSwitch', 'SensorSwitch Air', 'Fresco', 'Pathway', 'Wiring'];
      const aIdx = familyOrder.indexOf(a.productFamily);
      const bIdx = familyOrder.indexOf(b.productFamily);
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });
  }

  /**
   * Calculate overall compliance score.
   * Informational/acknowledged items are tracked separately and don't affect the score.
   */
  _calculateComplianceScore(requirements) {
    if (requirements.length === 0) return { score: 0, met: 0, alternative: 0, gap: 0, acknowledged: 0, total: 0, actionableTotal: 0, summary: 'No requirements found' };

    const met = requirements.filter(r => r.status === 'met').length;
    const alternative = requirements.filter(r => r.status === 'alternative').length;
    const gap = requirements.filter(r => r.status === 'gap').length;
    const acknowledged = requirements.filter(r => r.status === 'acknowledged').length;
    const total = requirements.length;
    const actionableTotal = met + alternative + gap;

    const score = actionableTotal > 0
      ? Math.round(((met * 1.0 + alternative * 0.5) / actionableTotal) * 100)
      : 100;

    return {
      score,
      met,
      alternative,
      gap,
      acknowledged,
      total,
      actionableTotal,
      summary: `${score}% compliance — ${met} met, ${alternative} alternatives, ${gap} gaps out of ${actionableTotal} actionable requirements (${acknowledged} informational)`
    };
  }

  _progress(callback, message) {
    if (callback) callback(message);
    console.log(`📋 Spec Review: ${message}`);
  }
}

module.exports = SpecReviewService;
