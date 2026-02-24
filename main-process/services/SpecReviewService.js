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
  constructor(aiService, productKBService) {
    this.aiService = aiService;
    this.productKBService = productKBService;
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

      // Step 4: AI gap analysis — refine matches and identify gaps
      this._progress(progressCallback, 'Running gap analysis...');
      const analysis = await this._runGapAnalysis(extraction.requirements, kbResult.matches || []);

      // Step 5: Build preliminary BOM
      this._progress(progressCallback, 'Generating preliminary BOM...');
      const preliminaryBOM = this._buildPreliminaryBOM(analysis.requirements);

      // Step 6: Calculate compliance score
      const complianceScore = this._calculateComplianceScore(analysis.requirements);

      this._progress(progressCallback, 'Analysis complete.');

      const elapsed = Date.now() - startTime;
      console.log(`✅ Spec review completed in ${(elapsed / 1000).toFixed(1)}s — ${analysis.requirements.length} requirements found`);

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
      "sourceSection": "Section reference or paragraph from the spec"
    }
  ]
}

Valid device categories: ${DEVICE_CATEGORIES.join(', ')}

IMPORTANT GUIDANCE:
- Extract EVERY lighting controls requirement, not just the obvious ones
- Include integration requirements (BMS, HVAC, fire alarm, AV, DMX)
- Include energy code requirements (occupancy sensing, daylight harvesting, scheduling)
- Include life safety requirements (emergency lighting, exit signs)
- Include commissioning and testing requirements
- Include any specific product or manufacturer requirements (especially "or equal" clauses)
- If the spec mentions a competitor product (Lutron, Crestron, etc.), still extract the requirement
- Set confidence to "high" for explicit requirements, "medium" for implied, "low" for ambiguous`;

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
        integrationType: req.integrationType || 'none'
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
   * Refines the requirement status and adds device recommendations.
   */
  async _runGapAnalysis(requirements, kbMatches) {
    const enrichedRequirements = requirements.map(req => {
      const kbMatch = kbMatches.find(m => m.requirementId === req.id);

      if (kbMatch && kbMatch.hasMatch) {
        const bestMatch = kbMatch.bestMatch;
        const allDevices = [];

        for (const rule of kbMatch.matchedRules) {
          for (const dev of rule.primaryDevices) {
            if (!allDevices.find(d => d.catalogNumber === dev.catalogNumber)) {
              allDevices.push({
                catalogNumber: dev.catalogNumber,
                productFamily: dev.productFamily,
                description: dev.description,
                role: 'primary',
                quantity: rule.quantityGuidance || '',
                notes: rule.whenToUse || ''
              });
            }
          }
          for (const dev of rule.alternativeDevices) {
            if (!allDevices.find(d => d.catalogNumber === dev.catalogNumber)) {
              allDevices.push({
                catalogNumber: dev.catalogNumber,
                productFamily: dev.productFamily,
                description: dev.description,
                role: 'alternative',
                quantity: rule.quantityGuidance || '',
                notes: rule.alternativeNotes || ''
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
          recommendedDevices: allDevices,
          gapNote,
          kbRuleId: bestMatch.ruleId,
          matchStrength: bestMatch.matchStrength,
          alternatives: bestMatch.alternatives || []
        };
      }

      // No KB match — try AI-only analysis
      return {
        ...req,
        status: 'gap',
        recommendedDevices: [],
        gapNote: 'No matching rule found in the Product Knowledge Base. A DAS team member should review this requirement and add a rule if applicable.',
        kbRuleId: null,
        matchStrength: 'none',
        alternatives: []
      };
    });

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
   * AI attempts to suggest devices for requirements that had no KB match.
   */
  async _aiRefineUnmatched(unmatchedReqs) {
    const reqSummaries = unmatchedReqs.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category
    }));

    const systemPrompt = `You are an expert on Acuity Brands / nLight / SensorSwitch lighting controls products.

Given lighting controls requirements that could not be automatically matched to products, suggest the best Acuity device(s) for each requirement.

IMPORTANT ACUITY PRODUCTS:
- NCM PDT 9: nLight ceiling occupancy sensor
- NCM ADCX: nLight daylight harvesting sensor
- NWSXA PDT: nLight wall switch sensor
- NPODM DX: nLight dimming wallpod
- NPODM 4S DX: nLight 4-scene wallpod
- NTS 7IN: nLight 7" touchscreen
- NPP16 D: nLight dimming power pack
- NPP16 D ER: nLight dimming power pack with emergency relay
- NPS 80/150: nLight power supply
- NBRG 8: nLight bridge gateway
- NECY MVOLT BAC: nLight Eclypse with BACnet
- ARP 8/16/24/32/48 INTENC: Acuity relay panels
- NIO 1S: Contact closure input (fire alarm, dry contact)
- NIO X: Third-party AV panel interface
- NAR40: Auxiliary relay output (HVAC dry contact)
- NPWDMX SNAPSHOT: DMX interface
- ETS20 DR: Exterior photocell
- rPOD MICRO: Wireless battery-powered switch
- rSI: Wireless system input device
- NCOMKIT: Commissioning kit
- WSX PDT: SensorSwitch wall sensor (standalone)
- CM PDT 9: SensorSwitch ceiling sensor (standalone)

Return JSON:
{
  "refinements": [
    {
      "id": "requirement_id",
      "status": "met|alternative|gap",
      "recommendedDevices": [
        {
          "catalogNumber": "exact catalog number",
          "productFamily": "product family",
          "description": "device description",
          "role": "primary|alternative",
          "quantity": "quantity guidance",
          "notes": "why this device"
        }
      ],
      "gapNote": "explanation if gap or alternative"
    }
  ]
}

If you truly cannot find an Acuity product for a requirement, set status to "gap" with an honest explanation.`;

    const userPrompt = `Suggest Acuity devices for these unmatched requirements:\n${JSON.stringify(reqSummaries, null, 2)}`;

    const result = await this.aiService.chatCompletion(systemPrompt, userPrompt, {
      jsonMode: true,
      maxTokens: 4096,
      timeout: 60000
    });

    return result.refinements || [];
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
