/**
 * DocumentTextService
 *
 * Standalone helper that extracts plain text from a document file path.
 * Supports PDF (pdf-parse), DOCX/DOC (mammoth), and TXT (fs). Mirrors the
 * private parsing logic used by SpecReviewService so features like Training
 * Hub course generation can reuse it without depending on Spec Review.
 */

const fs = require('fs-extra');
const path = require('path');

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt'];

class DocumentTextService {
  /**
   * Extract plain text from a file path.
   * @param {string} filePath
   * @returns {Promise<{ text: string, pageCount: number, fileName: string }>}
   */
  async extractText(filePath) {
    if (!filePath) throw new Error('No file path provided');
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);

    if (ext === '.pdf') {
      const { PDFParse } = require('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: dataBuffer });
      const pdfResult = await parser.getText();
      const text = pdfResult.text || '';
      return { text, pageCount: pdfResult.total || 0, fileName };
    } else if (ext === '.docx' || ext === '.doc') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return { text: result.value || '', pageCount: 1, fileName };
    } else if (ext === '.txt') {
      const text = await fs.readFile(filePath, 'utf-8');
      return { text: text || '', pageCount: 1, fileName };
    }

    throw new Error(`Unsupported file format: ${ext}. Supported: PDF, DOCX, DOC, TXT`);
  }

  /**
   * Extract and combine text from multiple files into a single labeled string.
   * @param {string[]} filePaths
   * @param {number} maxChars - overall cap on combined text length
   * @returns {Promise<{ combined: string, sources: Array<{ fileName, chars }>, truncated: boolean }>}
   */
  async extractCombined(filePaths = [], maxChars = 24000) {
    const sources = [];
    let combined = '';
    let truncated = false;

    for (const filePath of filePaths) {
      try {
        const { text, fileName } = await this.extractText(filePath);
        const clean = (text || '').trim();
        sources.push({ fileName, chars: clean.length });
        if (clean.length === 0) continue;
        combined += `\n\n===== SOURCE: ${fileName} =====\n${clean}`;
      } catch (error) {
        sources.push({ fileName: path.basename(filePath), chars: 0, error: error.message });
      }
    }

    combined = combined.trim();
    if (combined.length > maxChars) {
      combined = combined.slice(0, maxChars);
      truncated = true;
    }

    return { combined, sources, truncated };
  }

  isSupported(filePath) {
    return SUPPORTED_EXTENSIONS.includes(path.extname(filePath || '').toLowerCase());
  }
}

module.exports = DocumentTextService;
module.exports.SUPPORTED_EXTENSIONS = SUPPORTED_EXTENSIONS;
