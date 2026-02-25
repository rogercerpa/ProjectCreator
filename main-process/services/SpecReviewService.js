/**
 * SpecReviewService - Core analysis engine for Spec Review feature
 *
 * Pipeline:
 *  1. Parse spec document (PDF/DOCX/TXT)
 *  2. AI extracts structured lighting controls requirements
 *  3. Match requirements against Product Knowledge Base
 *  4. AI validates matches and performs gap analysis
 *  5. Generate preliminary BOM and compliance score
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
      // Step 1: Parse the document
      this._progress(progressCallback, 'Parsing specification document...');
      const docText = await this._parseDocument(filePath);

      // Step 2: AI extracts requirements
      this._progress(progressCallback, 'AI is extracting lighting controls requirements...');
      const extraction = await this._extractRequirements(docText);
      if (!extraction.success) {
        return { success: false, error: extraction.error };
      }

      // Step 3: Match against Product Knowledge Base
      this._progress(progressCallback, 'Matching requirements to Acuity products...');
      const kbResult = await this.productKBService.matchRequirements(extraction.requirements);

      // Step 4: AI validates device matches and performs gap analysis
      this._progress(progressCallback, 'AI is validating device recommendations...');
      const analysis = await this._runGapAnalysis(extraction.requirements, kbResult.matches || []);

      // Step 5: Build preliminary BOM
      this._progress(progressCallback, 'Generating preliminary BOM...');
      const preliminaryBOM = this._buildPreliminaryBOM(analysis.requirements);

      // Step 6: Calculate compliance score
      const complianceScore = this._calculateComplianceScore(analysis.requirements);

      this._progress(progressCallback, 'Analysis complete.');

      const elapsed = Date.now() - startTime;
      console.log(`✅ Spec review completed in ${(elapsed / 1000).toFixed(1)}s — ${analysis.requirements.length} requirements found`);

      if (this.learningService) {
        this.learningService.recordAnalysis().catch(e =>
          console.warn('Could not record analysis count:', e.message)
        );
      }

      return {
        success: true,
        reviewId,
        projectSummary: extraction.projectSummary || '',
        requirements: analysis.requirements,
        preliminaryBOM,
        gapAnalysis: analysis.requirements.filter(r => r.status === 'gap' || r.status === 'alternative'),
        complianceScore,
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
   * Parse a spec document into plain text.
   */
  async _parseDocument(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    let text;

    if (ext === '.pdf') {
      const { PDFParse } = require('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: dataBuffer });
      await parser.load();
      const pdfResult = await parser.getText();
      text = pdfResult.text;
    } else if (ext === '.docx' || ext === '.doc') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value;
    } else if (ext === '.txt') {
      text = await fs.readFile(filePath, 'utf-8');
    } else {
      throw new Error(`Unsupported file format: ${ext}. Supported: PDF, DOCX, TXT`);
    }

    if (!text || text.trim().length < 50) {
      throw new Error('Spec file appears empty or too short to extract requirements');
    }

    return text;
  }

  /**
   * AI pass 1: Extract structured requirements from spec text.
   */
  async _extractRequirements(text) {
    const maxChars = 50000;
    const truncatedText = text.length > maxChars
      ? text.substring(0, maxChars) + '\n[... document truncated for analysis ...]'
      : text;

    let learningContext = '';
    if (this.learningService) {
      try {
        learningContext = await this.learningService.buildPromptContext();
      } catch (e) {
        console.warn('Could not load learning context:', e.message);
      }
    }

    const systemPrompt = `You are an expert lighting controls engineer specializing in Acuity Brands products (nLight, SensorSwitch, Fresco, Pathway, DALI, BACnet systems).

Analyze the provided project specification document and extract ALL lighting controls requirements.

For each requirement, identify:
1. What specific control capability is being asked for
2. What type of integration or device category it maps to
3. The confidence level based on how explicit the requirement is

Return a JSON object with this exact structure:
{
  "projectSummary": "Brief 2-3 sentence description of the project (building type, size, scope)",
  "requirements": [
    {
      "id": "spec_req_1",
      "name": "Short requirement name (e.g., 'BACnet Integration', 'Occupancy Sensing')",
      "category": "Energy|Life Safety|Integration|Controls|Power|Commissioning",
      "description": "Detailed description of what the spec requires",
      "specKeywords": ["specific terms from the spec that indicate this requirement"],
      "deviceCategories": ["relevant_device_categories"],
      "integrationType": "bacnet|hvac|fire_alarm|av|dmx|dali|scheduling|demand_response|none",
      "confidence": "high|medium|low",
      "sourceSection": "Section reference or paragraph from the spec (e.g., 'Section 26 09 43, Paragraph 2.3.B')",
      "specExcerpt": "Verbatim or near-verbatim quoted text from the spec (50-200 words) that defines this requirement. Copy the actual spec language."
    }
  ]
}

Valid device categories: ${DEVICE_CATEGORIES.join(', ')}

IMPORTANT GUIDANCE:
- For specExcerpt, quote the actual spec text that establishes each requirement — this is critical for agent review
- Extract EVERY lighting controls requirement, not just the obvious ones
- Include integration requirements (BMS, HVAC, fire alarm, AV, DMX)
- Include energy code requirements (occupancy sensing, daylight harvesting, scheduling)
- Include life safety requirements (emergency lighting, exit signs)
- Include commissioning and testing requirements
- Include any specific product or manufacturer requirements (especially "or equal" clauses)
- If the spec mentions a competitor product (Lutron, Crestron, etc.), still extract the requirement

CONFIDENCE CLASSIFICATION RULES:
- "high": The spec explicitly and unambiguously states this requirement with clear technical language
- "medium": The requirement is implied or can be reasonably inferred from the spec context
- "low": The spec language is vague, ambiguous, or could be interpreted multiple ways — flag these so a human reviewer can verify
- Be consistent: the same spec language should always produce the same extraction. Do not invent requirements that are not supported by the text.
- Do NOT over-extract: only include requirements that are clearly or reasonably present in the spec text${learningContext}`;

    const userPrompt = `Extract lighting controls requirements from this specification:\n\n${truncatedText}`;

    try {
      const result = await this.aiService.chatCompletion(systemPrompt, userPrompt, {
        jsonMode: true,
        maxTokens: 8192,
        timeout: 120000
      });

      const requirements = (result.requirements || []).map((req, index) => ({
        ...req,
        id: req.id || `spec_req_${index + 1}`,
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
      console.error('AI requirement extraction failed:', error);
      return { success: false, error: `AI extraction failed: ${error.message}`, requirements: [] };
    }
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
   */
  _calculateComplianceScore(requirements) {
    if (requirements.length === 0) return 0;

    const met = requirements.filter(r => r.status === 'met').length;
    const alternative = requirements.filter(r => r.status === 'alternative').length;
    const gap = requirements.filter(r => r.status === 'gap').length;
    const total = requirements.length;

    // Met = 100%, Alternative = 50%, Gap = 0%
    const score = Math.round(((met * 1.0 + alternative * 0.5) / total) * 100);

    return {
      score,
      met,
      alternative,
      gap,
      total,
      summary: `${score}% compliance — ${met} met, ${alternative} alternatives, ${gap} gaps out of ${total} requirements`
    };
  }

  _progress(callback, message) {
    if (callback) callback(message);
    console.log(`📋 Spec Review: ${message}`);
  }
}

module.exports = SpecReviewService;
