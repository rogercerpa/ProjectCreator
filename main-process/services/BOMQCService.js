/**
 * BOMQCService - Core QC analysis engine for BOM compliance review
 * 
 * Orchestrates AI-powered analysis of BOM data against project requirements:
 *  - Device capability identification via AI
 *  - Compliance checking against building codes and spec requirements
 *  - Anomaly detection (quantities, missing pairings)
 *  - PDF spec parsing
 *  - Results caching in bom-catalog.json (only successful analyses)
 */

const fs = require('fs-extra');
const path = require('path');
const { DEVICE_CATEGORIES, aggregateRequirements } = require('../constants/BuildingCodes');

const DEVICE_CATEGORIES_SET = new Set(DEVICE_CATEGORIES);

class BOMQCService {
  constructor(aiService, bomPersistenceService, projectPersistenceService) {
    this.aiService = aiService;
    this.bomPersistenceService = bomPersistenceService;
    this.projectPersistenceService = projectPersistenceService;
  }

  /**
   * Run a full QC analysis on a project's BOM
   */
  async runFullAnalysis(projectId, requirementsConfig) {
    const startTime = Date.now();
    console.log(`🔍 Starting BOM QC analysis for project: ${projectId}`);

    try {
      const projectResult = await this.projectPersistenceService.loadProjectById(projectId);
      if (!projectResult.success || !projectResult.project) {
        return { success: false, error: 'Project not found' };
      }

      const project = projectResult.project;
      const bomData = project.bomData;

      if (!bomData || !bomData.devices || bomData.devices.length === 0) {
        return { success: false, error: 'No BOM data available for this project' };
      }

      const { buildingCodes = [], manualRequirements = [], specRequirements = [] } = requirementsConfig;

      const codeRequirements = aggregateRequirements(buildingCodes, manualRequirements);
      const allRequirements = [
        ...codeRequirements,
        ...specRequirements.map(r => ({ ...r, source: 'spec' }))
      ];

      if (allRequirements.length === 0) {
        return { success: false, error: 'No requirements specified. Select building codes, upload specs, or add manual requirements.' };
      }

      console.log(`📋 Analyzing ${bomData.devices.length} devices against ${allRequirements.length} requirements`);

      const deviceAnalysis = await this.analyzeDeviceCapabilities(bomData.devices);

      console.log(`🔗 Running compliance check...`);
      const compliance = this._checkCompliance(deviceAnalysis, allRequirements);

      const anomalies = await this._detectAnomalies(bomData, deviceAnalysis, project);

      const qcResult = {
        analyzedAt: new Date().toISOString(),
        analysisTimeMs: Date.now() - startTime,
        requirements: allRequirements,
        buildingCodes,
        manualRequirements,
        specRequirements,
        deviceAnalysis,
        compliance,
        anomalies,
        summary: {
          totalRequirements: allRequirements.length,
          met: compliance.met.length,
          partial: compliance.partial.length,
          unmet: compliance.unmet.length,
          score: allRequirements.length > 0
            ? Math.round(((compliance.met.length + compliance.partial.length * 0.5) / allRequirements.length) * 100)
            : 0,
          anomalyCount: anomalies.length,
          criticalAnomalies: anomalies.filter(a => a.severity === 'critical').length
        }
      };

      project.qcAnalysis = qcResult;
      await this.projectPersistenceService.saveProject(project);

      console.log(`✅ BOM QC analysis complete: ${qcResult.summary.score}% compliance (${Date.now() - startTime}ms)`);
      return { success: true, qcResult };

    } catch (error) {
      console.error('Error running BOM QC analysis:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze device capabilities using AI with caching.
   * Only valid (non-error) results are cached.
   */
  async analyzeDeviceCapabilities(devices) {
    const catalog = await this.bomPersistenceService.loadCatalog();

    const uncached = [];
    const results = [];

    for (const device of devices) {
      const catalogEntry = catalog[device.catalogNumber];
      const cached = catalogEntry?.aiCapabilities;

      // Only use cache if it was a successful analysis (not an error fallback)
      if (cached && !cached.error && cached.deviceCategories?.length > 0 &&
          !(cached.deviceCategories.length === 1 && cached.deviceCategories[0] === 'other' && !cached.capabilities?.length)) {
        results.push({ ...device, ...cached });
      } else {
        uncached.push(device);
      }
    }

    console.log(`🤖 Device analysis: ${results.length} cached, ${uncached.length} need AI analysis`);

    if (uncached.length > 0) {
      const batchSize = 15; // Smaller batches for reliability
      let catalogDirty = false;

      for (let i = 0; i < uncached.length; i += batchSize) {
        const batch = uncached.slice(i, i + batchSize);
        console.log(`  Analyzing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uncached.length / batchSize)} (${batch.length} devices)...`);

        const aiResults = await this._analyzeDeviceBatch(batch);

        for (const result of aiResults) {
          const originalDevice = batch.find(d => d.catalogNumber === result.catalogNumber);
          const merged = { ...originalDevice, ...result };
          results.push(merged);

          // Only cache successful analyses
          if (!result.error) {
            this._cacheDeviceCapabilities(result.catalogNumber, result, catalog);
            catalogDirty = true;
          }
        }
      }

      if (catalogDirty) {
        const catalogPath = this.bomPersistenceService.getCatalogPath();
        await fs.writeJson(catalogPath, catalog, { spaces: 2 });
        console.log(`💾 Device capabilities cached to catalog`);
      }
    }

    return results;
  }

  /**
   * Clear cached AI capabilities (for re-analysis after fixing issues)
   */
  async clearDeviceCache() {
    try {
      const catalog = await this.bomPersistenceService.loadCatalog();
      let cleared = 0;
      for (const key of Object.keys(catalog)) {
        if (catalog[key].aiCapabilities) {
          delete catalog[key].aiCapabilities;
          cleared++;
        }
      }
      const catalogPath = this.bomPersistenceService.getCatalogPath();
      await fs.writeJson(catalogPath, catalog, { spaces: 2 });
      console.log(`🗑️ Cleared ${cleared} cached AI analyses`);
      return { success: true, cleared };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse a PDF spec file and extract lighting controls requirements
   */
  async parseProjectSpec(filePath) {
    try {
      console.log(`📄 Parsing spec file: ${filePath}`);

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

      const maxChars = 30000;
      const truncatedText = text.length > maxChars
        ? text.substring(0, maxChars) + '\n[... document truncated for analysis ...]'
        : text;

      const systemPrompt = `You are an expert lighting controls engineer specializing in Acuity Brands products (nLight, SensorSwitch, Fresco, Pathway, DALI, BACnet systems).

Analyze the provided project specification document and extract ALL lighting controls requirements.

Return a JSON object with this exact structure:
{
  "projectSummary": "Brief description of the project",
  "requirements": [
    {
      "id": "spec_req_1",
      "name": "Short requirement name",
      "category": "Energy|Life Safety|Integration|Controls|Power|Commissioning",
      "description": "Detailed description of what is required",
      "deviceCategories": ["relevant_device_categories"],
      "confidence": "high|medium|low",
      "sourceSection": "Section/paragraph reference from the spec"
    }
  ]
}

Valid device categories: ${DEVICE_CATEGORIES.join(', ')}

Focus on:
- Control system requirements (occupancy sensing, daylight harvesting, scheduling)
- Integration requirements (BMS/HVAC, fire alarm, AV, DMX)
- Emergency/life safety lighting requirements
- Dimming and scene control requirements
- Network and communication protocol requirements
- Commissioning and testing requirements
- Any specific product or manufacturer requirements`;

      const userPrompt = `Extract lighting controls requirements from this specification:\n\n${truncatedText}`;

      const result = await this.aiService.chatCompletion(systemPrompt, userPrompt, {
        jsonMode: true,
        maxTokens: 4096,
        timeout: 90000
      });

      const requirements = (result.requirements || []).map((req, index) => ({
        ...req,
        id: req.id || `spec_req_${index + 1}`,
        source: 'spec'
      }));

      console.log(`✅ Extracted ${requirements.length} requirements from spec`);
      return {
        success: true,
        projectSummary: result.projectSummary || '',
        requirements,
        sourceFile: path.basename(filePath)
      };

    } catch (error) {
      console.error('Error parsing spec:', error);
      return { success: false, error: error.message, requirements: [] };
    }
  }

  // ===== Internal Methods =====

  /**
   * Send a batch of devices to AI for capability analysis.
   * Includes retry logic and robust error handling.
   */
  async _analyzeDeviceBatch(devices) {
    const deviceList = devices.map(d => ({
      catalogNumber: d.catalogNumber,
      description: d.description || '',
      type: d.type || '',
      productFamily: d.productFamily || '',
      quantity: d.quantity
    }));

    const systemPrompt = `You are an expert on Acuity Brands / nLight / SensorSwitch lighting controls products.

TASK: Given BOM catalog numbers, classify each device and identify its capabilities.

IMPORTANT: For "deviceCategories", you MUST use ONLY values from this exact list (use the underscore format exactly as shown):

SENSOR TYPES:
- occupancy_sensor (ceiling-mount occupancy/vacancy sensor like NCM series)
- ceiling_sensor (any ceiling-mount sensor)
- wall_sensor (wall-mount occupancy sensor like WSX, NWSXA series)
- vacancy_sensor (manual-on vacancy sensor)
- photosensor (light level sensor for daylight harvesting like NCM ADCX)
- daylight_sensor (dedicated daylight sensor)

CONTROL DEVICES:
- wall_switch (basic wall switch)
- wallpod (nLight wallpod like NPODMA, NPOD series - provides manual control)
- keypad (multi-button scene controller like NTS touchscreen)
- multi_level_switch (multi-level switching device)
- dimming_controller (dimming control module)
- dimming_driver (LED dimming driver)

INFRASTRUCTURE:
- relay_panel (ARP relay panel for circuit switching)
- power_pack (nLight power pack like NPP series)
- power_supply (nPS power supply)
- bridge (nLight bridge gateway like NBRG, NECY for network management)
- network_controller (network controller or gateway)
- time_clock (scheduling/time clock device)
- scheduler (scheduling system)
- photocell (exterior photocell like ETS, ARPA PC)

EMERGENCY/SAFETY:
- emergency_relay (emergency circuit relay)
- emergency_controller (emergency lighting controller)
- transfer_switch (automatic transfer switch)
- battery_backup (battery backup unit)
- fire_alarm_relay (fire alarm interface relay)

INTEGRATION:
- bms_integration (BACnet or BMS integration device)
- bacnet_controller (BACnet controller like NECY BAC)
- dmx_controller (DMX lighting controller)
- dmx_interface (DMX interface/gateway like NPWDMX)
- contact_closure (contact closure input device like NIO)
- demand_response (demand response capable device)

OTHER:
- wiring (cables, CAT5/CAT6)
- other (only if truly unclassifiable)

COMMON ACUITY PRODUCT EXAMPLES:
- NCM PDT = nLight Ceiling Mount, Passive Dual Technology sensor → [occupancy_sensor, ceiling_sensor]
- NCM ADCX = nLight Ceiling Mount, Auto Dimming Photosensor → [photosensor, daylight_sensor, ceiling_sensor]
- NWSXA PDT = nLight Air Wall Switch sensor → [wall_sensor, occupancy_sensor]
- WSXA PDT = SensorSwitch Air Wall sensor → [wall_sensor, occupancy_sensor]
- NPODMA = nLight wallpod, manual control → [wallpod]
- NPOD TOUCH = nLight touchscreen wallpod → [wallpod, keypad]
- NTS 7IN = nLight 7" touchscreen → [keypad]
- NPP16 D = nLight Power Pack 16-relay dimming → [power_pack, dimming_controller]
- NPP16 D ER = nLight Power Pack 16-relay dimming with Emergency Relay → [power_pack, dimming_controller, emergency_relay]
- NPS 80 = nLight 80W Power Supply → [power_supply]
- NBRG 8 = nLight Bridge Gateway 8-port → [bridge, network_controller]
- NECY MVOLT BAC = nLight Eclipse controller with BACnet → [bridge, network_controller, bacnet_controller, bms_integration]
- ARP INTENC = Acuity Relay Panel → [relay_panel]
- ARPA PC = ARP Photocell accessory → [photocell]
- ETS20 DR = Exterior photocell sensor → [photocell]
- NIO 1S = nLight Input/Output, 1 Switch → [contact_closure]
- NPWDMX SNAPSHOT = nLight DMX interface → [dmx_interface, dmx_controller]
- FCS 7TSN = Fresco 7" touchscreen → [keypad, dimming_controller]
- NCOMKIT = nLight commissioning kit → [other]
- NPARTITION KIT = nLight partition sensor kit → [occupancy_sensor]

Return JSON:
{
  "devices": [
    {
      "catalogNumber": "exact catalog number from input",
      "deviceName": "Human-readable name",
      "deviceFunction": "What this device does (1-2 sentences)",
      "deviceCategories": ["category_1", "category_2"],
      "capabilities": ["specific capability list"],
      "requirementsSatisfied": ["occupancy_sensing", "daylight_harvesting", "auto_shutoff", "manual_control", "dimming", "scheduling", "emergency_lighting", "fire_alarm_integration", "hvac_integration", "dmx_control"]
    }
  ]
}

RULES:
- Each device MUST have at least one deviceCategory from the list above
- Do NOT use "other" unless the device truly cannot be classified
- A sensor that detects occupancy MUST include "occupancy_sensor"
- A wallpod MUST include "wallpod"
- A relay panel MUST include "relay_panel"
- A bridge/gateway MUST include "bridge"
- For requirementsSatisfied, list which building code requirements this device helps meet`;

    const userPrompt = `Classify these BOM devices:\n${JSON.stringify(deviceList, null, 2)}`;

    // Try up to 2 times
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await this.aiService.chatCompletion(systemPrompt, userPrompt, {
          jsonMode: true,
          maxTokens: 4096,
          timeout: 90000
        });

        const aiDevices = result.devices || [];

        if (aiDevices.length === 0) {
          console.warn(`⚠️ AI returned empty devices array (attempt ${attempt})`);
          if (attempt < 2) continue;
        }

        // Normalize categories to ensure they match our constants
        for (const device of aiDevices) {
          device.deviceCategories = (device.deviceCategories || [])
            .map(c => this._normalizeCategory(c))
            .filter(c => c !== null);

          if (device.deviceCategories.length === 0) {
            device.deviceCategories = ['other'];
          }
        }

        console.log(`  ✅ AI analyzed ${aiDevices.length} devices successfully`);
        return aiDevices;

      } catch (error) {
        console.error(`  ❌ AI analysis attempt ${attempt} failed:`, error.message);
        if (attempt < 2) {
          console.log(`  🔄 Retrying...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    // All attempts failed - return error results (NOT cached)
    console.error(`  ❌ All AI analysis attempts failed for batch of ${devices.length} devices`);
    return devices.map(d => ({
      catalogNumber: d.catalogNumber,
      deviceName: d.description || d.catalogNumber,
      deviceFunction: 'AI analysis failed - try again or check AI configuration',
      deviceCategories: ['other'],
      capabilities: [],
      requirementsSatisfied: [],
      error: 'AI analysis failed after retries'
    }));
  }

  /**
   * Normalize a category string to match our DEVICE_CATEGORIES constants
   */
  _normalizeCategory(raw) {
    if (!raw) return null;
    // Normalize: lowercase, replace spaces/hyphens with underscores
    const normalized = raw.toLowerCase().trim().replace(/[\s-]+/g, '_');

    if (DEVICE_CATEGORIES_SET.has(normalized)) return normalized;

    // Common AI variations → our constants
    const aliases = {
      'occupancy': 'occupancy_sensor',
      'occ_sensor': 'occupancy_sensor',
      'motion_sensor': 'occupancy_sensor',
      'pir_sensor': 'occupancy_sensor',
      'ceiling_mount_sensor': 'ceiling_sensor',
      'ceiling_occupancy_sensor': 'ceiling_sensor',
      'wall_switch_sensor': 'wall_sensor',
      'wall_mount_sensor': 'wall_sensor',
      'photo_sensor': 'photosensor',
      'light_sensor': 'photosensor',
      'daylight': 'daylight_sensor',
      'daylight_harvesting_sensor': 'daylight_sensor',
      'switch': 'wall_switch',
      'wallswitch': 'wall_switch',
      'wall_pod': 'wallpod',
      'touchscreen': 'keypad',
      'scene_controller': 'keypad',
      'dimmer': 'dimming_controller',
      'dimming': 'dimming_controller',
      'relay': 'relay_panel',
      'power_relay': 'relay_panel',
      'power_pack_relay': 'power_pack',
      'power': 'power_supply',
      'gateway': 'bridge',
      'bridge_gateway': 'bridge',
      'network': 'network_controller',
      'scheduler_controller': 'scheduler',
      'time_switch': 'time_clock',
      'astronomical_time_clock': 'time_clock',
      'photo_cell': 'photocell',
      'exterior_photocell': 'photocell',
      'emergency': 'emergency_relay',
      'emergency_circuit': 'emergency_relay',
      'battery': 'battery_backup',
      'fire_alarm': 'fire_alarm_relay',
      'bacnet': 'bacnet_controller',
      'bms': 'bms_integration',
      'building_management': 'bms_integration',
      'dmx': 'dmx_controller',
      'dmx_gateway': 'dmx_interface',
      'contact_closure_input': 'contact_closure',
      'input_output': 'contact_closure',
      'cable': 'wiring',
      'cat5': 'wiring',
      'cat6': 'wiring'
    };

    if (aliases[normalized]) return aliases[normalized];

    // Partial match: check if any valid category is contained in the string
    for (const validCat of DEVICE_CATEGORIES) {
      if (normalized.includes(validCat) || validCat.includes(normalized)) {
        return validCat;
      }
    }

    return null; // Will be filtered out; device keeps its other categories
  }

  /**
   * Cache device capabilities in the aggregated catalog.
   * Synchronous write to in-memory catalog object; caller saves to disk.
   */
  _cacheDeviceCapabilities(catalogNumber, capabilities, catalog) {
    if (!catalog[catalogNumber]) {
      catalog[catalogNumber] = {
        description: capabilities.deviceName || '',
        type: '',
        manufacturer: '',
        productFamily: '',
        totalQuantity: 0,
        projectCount: 0,
        projects: [],
        firstSeen: new Date().toISOString().split('T')[0],
        lastSeen: new Date().toISOString().split('T')[0],
        coOccurrence: {}
      };
    }

    catalog[catalogNumber].aiCapabilities = {
      deviceName: capabilities.deviceName,
      deviceFunction: capabilities.deviceFunction,
      deviceCategories: capabilities.deviceCategories || [],
      capabilities: capabilities.capabilities || [],
      requirementsSatisfied: capabilities.requirementsSatisfied || [],
      analyzedAt: new Date().toISOString()
    };
  }

  /**
   * Check BOM compliance against aggregated requirements.
   * Uses category matching, keyword matching, and AI requirementsSatisfied field.
   */
  _checkCompliance(deviceAnalysis, requirements) {
    const met = [];
    const partial = [];
    const unmet = [];

    for (const req of requirements) {
      const matchedDevices = this._findDevicesForRequirement(deviceAnalysis, req);

      if (matchedDevices.length > 0) {
        const hasStrongMatch = matchedDevices.some(m => m.matchStrength === 'strong');
        const hasDirectMatch = matchedDevices.some(m => m.matchStrength === 'direct');

        if (hasStrongMatch || hasDirectMatch) {
          met.push({
            requirementId: req.id,
            requirementName: req.name,
            category: req.category,
            source: req.source,
            matchedDevices: matchedDevices.map(m => ({
              catalogNumber: m.catalogNumber,
              deviceName: m.deviceName,
              matchStrength: m.matchStrength,
              matchReason: m.matchReason
            })),
            notes: `Satisfied by ${matchedDevices.length} device(s)`
          });
        } else {
          partial.push({
            requirementId: req.id,
            requirementName: req.name,
            category: req.category,
            source: req.source,
            matchedDevices: matchedDevices.map(m => ({
              catalogNumber: m.catalogNumber,
              deviceName: m.deviceName,
              matchStrength: m.matchStrength,
              matchReason: m.matchReason
            })),
            gap: 'Devices found with indirect match - verify capability',
            notes: `Partial match from ${matchedDevices.length} device(s)`
          });
        }
      } else {
        unmet.push({
          requirementId: req.id,
          requirementName: req.name,
          category: req.category,
          source: req.source,
          recommendation: `No devices found in BOM to satisfy: ${req.name}`,
          suggestedAction: req.description
        });
      }
    }

    return { met, partial, unmet };
  }

  /**
   * Multi-layer matching: category overlap → requirementsSatisfied → keyword matching
   */
  _findDevicesForRequirement(deviceAnalysis, requirement) {
    const matches = [];
    const reqCategories = new Set((requirement.deviceCategories || []).map(c => c.toLowerCase()));

    for (const device of deviceAnalysis) {
      // Skip error/unanalyzed devices
      if (device.error) continue;

      let matched = false;

      // Layer 1: Category overlap (strongest match)
      const deviceCats = new Set((device.deviceCategories || []).map(c => c.toLowerCase()));
      const categoryOverlap = [...reqCategories].filter(c => deviceCats.has(c));

      if (categoryOverlap.length > 0) {
        matches.push({
          catalogNumber: device.catalogNumber,
          deviceName: device.deviceName || device.description,
          matchStrength: 'strong',
          matchReason: `Category match: ${categoryOverlap.join(', ')}`,
          matchedCategories: categoryOverlap
        });
        matched = true;
        continue;
      }

      // Layer 2: AI requirementsSatisfied field
      const reqSatisfied = (device.requirementsSatisfied || []).map(r => r.toLowerCase().replace(/[\s-]+/g, '_'));
      const reqNameNorm = requirement.name.toLowerCase().replace(/[\s-]+/g, '_');
      const reqIdNorm = requirement.id.toLowerCase().replace(/[\s-]+/g, '_');

      for (const rs of reqSatisfied) {
        if (reqNameNorm.includes(rs) || rs.includes(reqNameNorm) ||
            reqIdNorm.includes(rs) || rs.includes(reqIdNorm)) {
          matches.push({
            catalogNumber: device.catalogNumber,
            deviceName: device.deviceName || device.description,
            matchStrength: 'direct',
            matchReason: `AI classified as satisfying: ${rs}`,
            matchedCategories: []
          });
          matched = true;
          break;
        }
      }
      if (matched) continue;

      // Layer 3: Keyword matching on device function/capabilities vs requirement
      const keywordMatch = this._keywordMatch(device, requirement);
      if (keywordMatch) {
        matches.push({
          catalogNumber: device.catalogNumber,
          deviceName: device.deviceName || device.description,
          matchStrength: 'indirect',
          matchReason: keywordMatch,
          matchedCategories: []
        });
      }
    }

    return matches;
  }

  /**
   * Keyword-based matching as final fallback
   */
  _keywordMatch(device, requirement) {
    const deviceText = [
      device.deviceName || '',
      device.deviceFunction || '',
      ...(device.capabilities || [])
    ].join(' ').toLowerCase();

    const reqKeywords = this._getRequirementKeywords(requirement);

    const matched = reqKeywords.filter(kw => deviceText.includes(kw));
    if (matched.length >= 2) {
      return `Keyword match: ${matched.join(', ')}`;
    }
    return null;
  }

  _getRequirementKeywords(requirement) {
    const keywordMap = {
      'occupancy': ['occupancy', 'motion', 'pir', 'vacancy', 'presence'],
      'daylight': ['daylight', 'photosensor', 'photo sensor', 'light level', 'dimming', 'adcx', 'auto dimming'],
      'shut-off': ['shut-off', 'shutoff', 'auto off', 'automatic off', 'time clock', 'scheduling'],
      'manual': ['manual', 'wallpod', 'wall switch', 'keypad', 'override', 'touchscreen'],
      'exterior': ['exterior', 'outdoor', 'photocell', 'photo cell', 'astronomical'],
      'emergency': ['emergency', 'egress', 'life safety', 'ul924', 'battery backup'],
      'fire alarm': ['fire alarm', 'fire', 'alarm relay'],
      'hvac': ['hvac', 'bms', 'bacnet', 'building management', 'bac'],
      'dmx': ['dmx', 'dmx512', 'rdm'],
      'av': ['av ', 'audio', 'video', 'conference', 'presentation'],
      'dimming': ['dimming', 'dim', '0-10v', 'dali', 'phase'],
      'demand': ['demand response', 'demand', 'dr signal'],
      'scheduling': ['schedule', 'scheduling', 'time clock', 'astronomical'],
      'functional': ['commission', 'testing', 'functional test'],
      'tuning': ['tuning', 'high-end trim', 'institutional']
    };

    const reqName = requirement.name.toLowerCase();
    const reqDesc = (requirement.description || '').toLowerCase();
    const text = reqName + ' ' + reqDesc;

    const keywords = new Set();
    for (const [topic, words] of Object.entries(keywordMap)) {
      if (text.includes(topic) || words.some(w => text.includes(w))) {
        words.forEach(w => keywords.add(w));
      }
    }
    return [...keywords];
  }

  // ===== Anomaly Detection =====

  async _detectAnomalies(bomData, deviceAnalysis, project) {
    const anomalies = [];
    this._checkQuantityAnomalies(bomData, anomalies);
    this._checkDuplicates(bomData, anomalies);
    await this._checkMissingPairings(bomData, anomalies);
    this._checkSystemCompleteness(deviceAnalysis, anomalies);
    return anomalies;
  }

  _isNonDeviceRow(device) {
    const cat = (device.catalogNumber || '').trim().toUpperCase();
    const nonDevicePatterns = [
      'SPARE', 'SPARES', 'NOT PHASED', 'SERVICES', 'SERVICE',
      'NOTES', 'NOTE', 'TOTAL', 'SUBTOTAL', 'HEADER', 'SUMMARY'
    ];
    return nonDevicePatterns.some(p => cat === p || cat.startsWith(p + ' '));
  }

  _checkQuantityAnomalies(bomData, anomalies) {
    const isMultiPhase = bomData.isMultiPhase || (bomData.phases && bomData.phases.length > 1);

    // Aggregate quantities per catalog number across all phases
    const aggregated = {};
    for (const device of (bomData.devices || [])) {
      if (this._isNonDeviceRow(device)) continue;
      const key = device.catalogNumber?.trim().toUpperCase();
      if (!key) continue;
      if (!aggregated[key]) {
        aggregated[key] = { catalogNumber: device.catalogNumber, totalQty: 0, lineCount: 0, phases: new Set() };
      }
      aggregated[key].totalQty += device.quantity;
      aggregated[key].lineCount++;
      if (device.phase) aggregated[key].phases.add(device.phase);
    }

    for (const [key, info] of Object.entries(aggregated)) {
      const threshold = isMultiPhase ? 1000 : 500;
      if (info.totalQty > threshold) {
        const phaseNote = info.phases.size > 1 ? ` (across ${info.phases.size} phases)` : '';
        anomalies.push({
          type: 'high_quantity',
          severity: 'warning',
          message: `Unusually high quantity: ${info.catalogNumber} has ${info.totalQty} total units${phaseNote}`,
          affectedDevices: [info.catalogNumber]
        });
      }
    }

    // Only flag zero-quantity for actual device rows (not section labels)
    for (const device of (bomData.devices || [])) {
      if (this._isNonDeviceRow(device)) continue;
      if (device.quantity === 0 && device.productFamily && device.productFamily !== 'Unknown') {
        anomalies.push({
          type: 'zero_quantity',
          severity: 'info',
          message: `Zero quantity line item: ${device.catalogNumber}`,
          affectedDevices: [device.catalogNumber]
        });
      }
    }

    const totalDevices = bomData.totalDevices || 0;
    if (totalDevices > 0 && totalDevices < 3) {
      anomalies.push({
        type: 'low_device_count',
        severity: 'warning',
        message: `Very low total device count (${totalDevices}). Verify BOM is complete.`,
        affectedDevices: []
      });
    }
  }

  _checkDuplicates(bomData, anomalies) {
    const isMultiPhase = bomData.isMultiPhase || (bomData.phases && bomData.phases.length > 1);

    // Group occurrences by catalog number
    const occurrences = {};
    for (const device of (bomData.devices || [])) {
      if (this._isNonDeviceRow(device)) continue;
      const key = device.catalogNumber?.trim().toUpperCase();
      if (!key) continue;
      if (!occurrences[key]) {
        occurrences[key] = { catalogNumber: device.catalogNumber, count: 0, phases: new Set(), samePhaseCount: {} };
      }
      occurrences[key].count++;
      const phase = device.phase || '__none__';
      occurrences[key].phases.add(phase);
      occurrences[key].samePhaseCount[phase] = (occurrences[key].samePhaseCount[phase] || 0) + 1;
    }

    for (const [key, info] of Object.entries(occurrences)) {
      if (info.count <= 1) continue;

      if (isMultiPhase && info.phases.size > 1) {
        // Device appears across multiple phases -- this is expected
        // Only flag if it also appears more than once within the SAME phase
        const withinPhaseDupes = Object.entries(info.samePhaseCount)
          .filter(([, count]) => count > 1)
          .map(([phase]) => phase === '__none__' ? 'unphased' : phase);

        if (withinPhaseDupes.length > 0) {
          anomalies.push({
            type: 'duplicate_catalog',
            severity: 'info',
            message: `${info.catalogNumber} is duplicated within phase${withinPhaseDupes.length > 1 ? 's' : ''}: ${withinPhaseDupes.join(', ')}. Appears in ${info.phases.size} phases total.`,
            affectedDevices: [info.catalogNumber]
          });
        }
        // Otherwise: cross-phase duplicates are normal, no anomaly reported
      } else {
        // Single-phase BOM or all occurrences are in the same phase
        anomalies.push({
          type: 'duplicate_catalog',
          severity: 'warning',
          message: `Duplicate catalog number: ${info.catalogNumber} appears ${info.count} times`,
          affectedDevices: [info.catalogNumber]
        });
      }
    }
  }

  async _checkMissingPairings(bomData, anomalies) {
    const catalogNumbers = new Set((bomData.devices || []).map(d => d.catalogNumber));
    const families = new Set((bomData.devices || []).map(d => d.productFamily));

    if (families.has('nLight Wired') && !this._hasDevicePattern(catalogNumbers, ['nBG', 'nECY', 'NBRG', 'NECY'])) {
      anomalies.push({
        type: 'missing_pairing',
        severity: 'warning',
        message: 'nLight Wired devices found but no nLight Bridge Gateway (nBG/NBRG) detected. A bridge is typically required for system commissioning and management.',
        affectedDevices: []
      });
    }

    if (families.has('nLight Wired') && !this._hasDevicePattern(catalogNumbers, ['nPS80', 'nPS150', 'NPS'])) {
      const hasPowerPacks = this._hasDevicePattern(catalogNumbers, ['nPP', 'NPP', 'nPD', 'nPA', 'nPE']);
      if (!hasPowerPacks) {
        anomalies.push({
          type: 'missing_pairing',
          severity: 'info',
          message: 'nLight Wired devices found but no power supplies (nPS) or power packs detected. Verify power sourcing.',
          affectedDevices: []
        });
      }
    }

    if (this._hasDevicePattern(catalogNumbers, ['ARP'])) {
      const hasEmergencyRelay = (bomData.devices || []).some(d => {
        const cat = (d.catalogNumber || '').toUpperCase();
        return cat.includes('ARP') && (cat.includes('ER') || cat.includes('EM'));
      });
      if (!hasEmergencyRelay) {
        anomalies.push({
          type: 'missing_pairing',
          severity: 'info',
          message: 'Relay panels (ARP) found but no emergency relay modules detected. Verify if emergency circuits are needed.',
          affectedDevices: []
        });
      }
    }
  }

  _checkSystemCompleteness(deviceAnalysis, anomalies) {
    const allCategories = new Set();
    for (const device of deviceAnalysis) {
      for (const cat of (device.deviceCategories || [])) {
        allCategories.add(cat.toLowerCase());
      }
    }

    const hasSensors = allCategories.has('occupancy_sensor') || allCategories.has('ceiling_sensor') ||
                       allCategories.has('wall_sensor') || allCategories.has('vacancy_sensor');
    const hasControl = allCategories.has('wall_switch') || allCategories.has('wallpod') || allCategories.has('keypad');
    const hasRelay = allCategories.has('relay_panel');

    if (hasSensors && !hasControl) {
      anomalies.push({
        type: 'system_completeness',
        severity: 'info',
        message: 'Occupancy sensors found but no manual control devices (wallpods/keypads). Most codes require manual override capability.',
        affectedDevices: []
      });
    }

    if (hasRelay && !hasSensors && !hasControl) {
      anomalies.push({
        type: 'system_completeness',
        severity: 'info',
        message: 'Relay panels found but no sensors or control devices. The system may be incomplete.',
        affectedDevices: []
      });
    }
  }

  _hasDevicePattern(catalogNumbers, patterns) {
    for (const cat of catalogNumbers) {
      const upper = (cat || '').toUpperCase();
      if (patterns.some(p => upper.includes(p.toUpperCase()))) {
        return true;
      }
    }
    return false;
  }

  // ===== Project Requirements Persistence =====

  async getProjectRequirements(projectId) {
    try {
      const result = await this.projectPersistenceService.loadProjectById(projectId);
      if (!result.success) return { success: false, error: 'Project not found' };
      return {
        success: true,
        requirements: result.project.qcRequirements || null,
        qcAnalysis: result.project.qcAnalysis || null
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveProjectRequirements(projectId, requirementsConfig) {
    try {
      const result = await this.projectPersistenceService.loadProjectById(projectId);
      if (!result.success) return { success: false, error: 'Project not found' };

      result.project.qcRequirements = {
        ...requirementsConfig,
        savedAt: new Date().toISOString()
      };

      const saveResult = await this.projectPersistenceService.saveProject(result.project);
      return { success: saveResult.success, project: saveResult.project };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = BOMQCService;
