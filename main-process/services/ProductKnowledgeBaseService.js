/**
 * ProductKnowledgeBaseService
 * Reads/writes the Product Knowledge Base Excel file (Products, Spec Rules, Alternatives)
 * Caches parsed data in memory; refreshes on demand.
 * Default file location: Z:\DAS\ProductKnowledgeBase.xlsx (configurable via Settings)
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const XLSX = require('xlsx');

const DEFAULT_KB_PATH = 'Z:\\DAS References\\ProjectCreatorV5\\ProductKnowledgeBase.xlsx';
const LOCAL_FALLBACK_DIR = path.join(os.homedir(), '.project-creator');
const LOCAL_FALLBACK_PATH = path.join(LOCAL_FALLBACK_DIR, 'ProductKnowledgeBase.xlsx');

class ProductKnowledgeBaseService {
  constructor(settingsService) {
    this.settingsService = settingsService;
    this._cache = null;
    this._lastLoaded = null;
  }

  // ===== Public API =====

  /**
   * Get the configured path to the KB Excel file.
   * Falls back to local copy if Z: drive is unreachable.
   */
  async getFilePath() {
    try {
      const settings = await this.settingsService.loadSettings();
      const configured = settings?.specReview?.knowledgeBasePath || DEFAULT_KB_PATH;

      if (await fs.pathExists(configured)) {
        return configured;
      }

      console.warn(`⚠️ KB file not found at configured path: ${configured}`);
      if (await fs.pathExists(LOCAL_FALLBACK_PATH)) {
        console.log(`📂 Using local fallback: ${LOCAL_FALLBACK_PATH}`);
        return LOCAL_FALLBACK_PATH;
      }

      return configured;
    } catch {
      return DEFAULT_KB_PATH;
    }
  }

  /**
   * Load the full knowledge base from Excel, caching the result.
   */
  async load(forceRefresh = false) {
    if (this._cache && !forceRefresh) {
      return { success: true, data: this._cache };
    }

    try {
      const filePath = await this.getFilePath();

      if (!(await fs.pathExists(filePath))) {
        console.log('📝 KB file not found — generating default...');
        await this._createDefaultFile(filePath);
      }

      const workbook = XLSX.readFile(filePath);
      const products = this._parseSheet(workbook, 'Products', PRODUCT_COLUMNS);
      const specRules = this._parseSheet(workbook, 'Spec Rules', SPEC_RULE_COLUMNS);
      const alternatives = this._parseSheet(workbook, 'Alternatives', ALTERNATIVE_COLUMNS);

      this._cache = { products, specRules, alternatives };
      this._lastLoaded = new Date().toISOString();

      console.log(`✅ KB loaded: ${products.length} products, ${specRules.length} spec rules, ${alternatives.length} alternatives`);
      return { success: true, data: this._cache };
    } catch (error) {
      console.error('Error loading KB:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all products (from cache).
   */
  async getProducts() {
    const result = await this.load();
    if (!result.success) return result;
    return { success: true, products: result.data.products };
  }

  /**
   * Get all spec rules (from cache).
   */
  async getSpecRules() {
    const result = await this.load();
    if (!result.success) return result;
    return { success: true, specRules: result.data.specRules };
  }

  /**
   * Get all alternatives (from cache).
   */
  async getAlternatives() {
    const result = await this.load();
    if (!result.success) return result;
    return { success: true, alternatives: result.data.alternatives };
  }

  /**
   * Get the full knowledge base summary for the frontend.
   */
  async getSummary() {
    const result = await this.load();
    if (!result.success) return result;
    const { products, specRules, alternatives } = result.data;
    return {
      success: true,
      summary: {
        totalProducts: products.length,
        activeProducts: products.filter(p => p.active !== false && p.active !== 'No').length,
        totalSpecRules: specRules.length,
        totalAlternatives: alternatives.length,
        lastLoaded: this._lastLoaded,
        filePath: await this.getFilePath()
      }
    };
  }

  /**
   * Match extracted spec requirements against spec rules.
   * Returns matched rules with recommended devices for each requirement.
   */
  async matchRequirements(requirements) {
    const result = await this.load();
    if (!result.success) return { success: false, error: result.error, matches: [] };

    const { specRules, products, alternatives } = result.data;
    const matches = [];

    for (const req of requirements) {
      const reqText = `${req.name || ''} ${req.description || ''} ${req.category || ''}`.toLowerCase();
      const matchedRules = [];

      for (const rule of specRules) {
        const keywords = (rule.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
        const keywordHits = keywords.filter(kw => reqText.includes(kw));

        if (keywordHits.length > 0) {
          const primaryDevices = this._resolveDevices(rule.primaryDevices, products);
          const alternativeDevices = this._resolveDevices(rule.alternativeDevices, products);
          const relatedAlts = this._findAlternatives(rule.requirementName, alternatives);

          matchedRules.push({
            ruleId: rule.ruleId,
            ruleName: rule.requirementName,
            category: rule.category,
            keywordHits,
            matchStrength: keywordHits.length >= 2 ? 'strong' : 'moderate',
            primaryDevices,
            alternativeDevices,
            quantityGuidance: rule.quantityGuidance || '',
            whenToUse: rule.whenToUse || '',
            alternativeNotes: rule.alternativeNotes || '',
            acuityCanMeet: rule.acuityCanMeet || 'Yes',
            gapNotes: rule.gapNotes || '',
            alternatives: relatedAlts
          });
        }
      }

      matches.push({
        requirementId: req.id,
        requirementName: req.name,
        requirementDescription: req.description,
        category: req.category,
        matchedRules,
        hasMatch: matchedRules.length > 0,
        bestMatch: matchedRules.length > 0
          ? matchedRules.sort((a, b) => b.keywordHits.length - a.keywordHits.length)[0]
          : null
      });
    }

    return { success: true, matches };
  }

  // ===== CRUD Operations =====

  async addProduct(product) {
    return this._addRow('Products', PRODUCT_COLUMNS, {
      ...product,
      active: product.active || 'Yes',
      lastUpdated: new Date().toLocaleDateString(),
      updatedBy: product.updatedBy || ''
    });
  }

  async updateProduct(catalogNumber, updates) {
    return this._updateRow('Products', 'catalogNumber', catalogNumber, {
      ...updates,
      lastUpdated: new Date().toLocaleDateString(),
      updatedBy: updates.updatedBy || ''
    });
  }

  async deleteProduct(catalogNumber) {
    return this._updateRow('Products', 'catalogNumber', catalogNumber, {
      active: 'No',
      lastUpdated: new Date().toLocaleDateString()
    });
  }

  async addSpecRule(rule) {
    return this._addRow('Spec Rules', SPEC_RULE_COLUMNS, {
      ...rule,
      acuityCanMeet: rule.acuityCanMeet || 'Yes',
      lastUpdated: new Date().toLocaleDateString(),
      updatedBy: rule.updatedBy || ''
    });
  }

  async updateSpecRule(ruleId, updates) {
    return this._updateRow('Spec Rules', 'ruleId', ruleId, {
      ...updates,
      lastUpdated: new Date().toLocaleDateString(),
      updatedBy: updates.updatedBy || ''
    });
  }

  async deleteSpecRule(ruleId) {
    return this._deleteRow('Spec Rules', 'ruleId', ruleId);
  }

  async addAlternative(alt) {
    return this._addRow('Alternatives', ALTERNATIVE_COLUMNS, alt);
  }

  async updateAlternative(index, updates) {
    return this._updateRowByIndex('Alternatives', index, updates);
  }

  async deleteAlternative(index) {
    return this._deleteRowByIndex('Alternatives', index);
  }

  // ===== Internal Methods =====

  _parseSheet(workbook, sheetName, columnDefs) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    return rawRows.map(row => {
      const parsed = {};
      for (const col of columnDefs) {
        parsed[col.key] = row[col.header] ?? '';
      }
      return parsed;
    });
  }

  _resolveDevices(catalogNumberStr, products) {
    if (!catalogNumberStr) return [];
    const catalogNumbers = catalogNumberStr.split(',').map(s => s.trim()).filter(Boolean);
    return catalogNumbers.map(cn => {
      const product = products.find(p =>
        p.catalogNumber.toLowerCase() === cn.toLowerCase() &&
        p.active !== 'No' && p.active !== false
      );
      return product
        ? { catalogNumber: cn, productFamily: product.productFamily, description: product.description, found: true }
        : { catalogNumber: cn, productFamily: '', description: '', found: false };
    });
  }

  _findAlternatives(requirementName, alternatives) {
    if (!requirementName) return [];
    const nameLower = requirementName.toLowerCase();
    return alternatives.filter(alt =>
      (alt.specRequirement || '').toLowerCase().includes(nameLower) ||
      nameLower.includes((alt.specRequirement || '').toLowerCase())
    );
  }

  async _addRow(sheetName, columnDefs, data) {
    try {
      const filePath = await this.getFilePath();
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return { success: false, error: `Sheet "${sheetName}" not found` };

      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const newRow = {};
      for (const col of columnDefs) {
        newRow[col.header] = data[col.key] ?? '';
      }
      rows.push(newRow);

      workbook.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
      XLSX.writeFile(workbook, filePath);
      this._cache = null;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async _updateRow(sheetName, keyField, keyValue, updates) {
    try {
      const filePath = await this.getFilePath();
      const workbook = XLSX.readFile(filePath);
      const columnDefs = sheetName === 'Products' ? PRODUCT_COLUMNS
        : sheetName === 'Spec Rules' ? SPEC_RULE_COLUMNS
        : ALTERNATIVE_COLUMNS;

      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
      const headerForKey = columnDefs.find(c => c.key === keyField)?.header;
      if (!headerForKey) return { success: false, error: `Unknown key field: ${keyField}` };

      const idx = rows.findIndex(r => r[headerForKey] === keyValue);
      if (idx === -1) return { success: false, error: `Row not found: ${keyValue}` };

      for (const col of columnDefs) {
        if (updates[col.key] !== undefined) {
          rows[idx][col.header] = updates[col.key];
        }
      }

      workbook.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
      XLSX.writeFile(workbook, filePath);
      this._cache = null;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async _deleteRow(sheetName, keyField, keyValue) {
    try {
      const filePath = await this.getFilePath();
      const workbook = XLSX.readFile(filePath);
      const columnDefs = sheetName === 'Products' ? PRODUCT_COLUMNS
        : sheetName === 'Spec Rules' ? SPEC_RULE_COLUMNS
        : ALTERNATIVE_COLUMNS;

      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
      const headerForKey = columnDefs.find(c => c.key === keyField)?.header;
      const filtered = rows.filter(r => r[headerForKey] !== keyValue);

      if (filtered.length === rows.length) return { success: false, error: `Row not found: ${keyValue}` };

      workbook.Sheets[sheetName] = XLSX.utils.json_to_sheet(filtered);
      XLSX.writeFile(workbook, filePath);
      this._cache = null;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async _updateRowByIndex(sheetName, index, updates) {
    try {
      const filePath = await this.getFilePath();
      const workbook = XLSX.readFile(filePath);
      const columnDefs = ALTERNATIVE_COLUMNS;
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

      if (index < 0 || index >= rows.length) return { success: false, error: 'Index out of range' };

      for (const col of columnDefs) {
        if (updates[col.key] !== undefined) {
          rows[index][col.header] = updates[col.key];
        }
      }

      workbook.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
      XLSX.writeFile(workbook, filePath);
      this._cache = null;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async _deleteRowByIndex(sheetName, index) {
    try {
      const filePath = await this.getFilePath();
      const workbook = XLSX.readFile(filePath);
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

      if (index < 0 || index >= rows.length) return { success: false, error: 'Index out of range' };
      rows.splice(index, 1);

      workbook.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
      XLSX.writeFile(workbook, filePath);
      this._cache = null;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create the default KB Excel file pre-populated with Acuity products and spec rules.
   */
  async _createDefaultFile(filePath) {
    await fs.ensureDir(path.dirname(filePath));

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Products
    const productsData = DEFAULT_PRODUCTS.map(p => {
      const row = {};
      for (const col of PRODUCT_COLUMNS) {
        row[col.header] = p[col.key] ?? '';
      }
      return row;
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(productsData), 'Products');

    // Sheet 2: Spec Rules
    const rulesData = DEFAULT_SPEC_RULES.map(r => {
      const row = {};
      for (const col of SPEC_RULE_COLUMNS) {
        row[col.header] = r[col.key] ?? '';
      }
      return row;
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rulesData), 'Spec Rules');

    // Sheet 3: Alternatives
    const altsData = DEFAULT_ALTERNATIVES.map(a => {
      const row = {};
      for (const col of ALTERNATIVE_COLUMNS) {
        row[col.header] = a[col.key] ?? '';
      }
      return row;
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(altsData), 'Alternatives');

    XLSX.writeFile(workbook, filePath);
    console.log(`📝 Default KB file created at: ${filePath}`);
  }
}

// ===== Column Definitions =====

const PRODUCT_COLUMNS = [
  { key: 'catalogNumber', header: 'Catalog Number' },
  { key: 'productFamily', header: 'Product Family' },
  { key: 'category', header: 'Category' },
  { key: 'description', header: 'Description' },
  { key: 'capabilities', header: 'Capabilities' },
  { key: 'mountingType', header: 'Mounting Type' },
  { key: 'voltage', header: 'Voltage' },
  { key: 'platform', header: 'Platform' },
  { key: 'notes', header: 'Notes' },
  { key: 'active', header: 'Active' },
  { key: 'lastUpdated', header: 'Last Updated' },
  { key: 'updatedBy', header: 'Updated By' }
];

const SPEC_RULE_COLUMNS = [
  { key: 'ruleId', header: 'Rule ID' },
  { key: 'requirementName', header: 'Requirement Name' },
  { key: 'category', header: 'Category' },
  { key: 'keywords', header: 'Keywords' },
  { key: 'primaryDevices', header: 'Primary Device(s)' },
  { key: 'alternativeDevices', header: 'Alternative Device(s)' },
  { key: 'quantityGuidance', header: 'Quantity Guidance' },
  { key: 'whenToUse', header: 'When To Use' },
  { key: 'alternativeNotes', header: 'Alternative Notes' },
  { key: 'acuityCanMeet', header: 'Acuity Can Meet' },
  { key: 'gapNotes', header: 'Gap Notes' },
  { key: 'notes', header: 'Notes' },
  { key: 'lastUpdated', header: 'Last Updated' },
  { key: 'updatedBy', header: 'Updated By' }
];

const ALTERNATIVE_COLUMNS = [
  { key: 'specRequirement', header: 'Spec Requirement' },
  { key: 'acuityAlternative', header: 'Acuity Alternative' },
  { key: 'alternativeCatalogNumber', header: 'Alternative Catalog #' },
  { key: 'whyItsBetter', header: "Why It's Better" },
  { key: 'limitations', header: 'Limitations' },
  { key: 'notes', header: 'Notes' }
];

// ===== Default Product Data (pre-populated) =====

const DEFAULT_PRODUCTS = [
  // --- nLight Wired: Ceiling Mount Sensors ---
  { catalogNumber: 'NCM PDT 9', productFamily: 'nLight Wired', category: 'Sensor', description: 'nLight Ceiling Mount, Passive Dual Technology, 360° coverage, 900 sq ft', capabilities: 'occupancy sensing, vacancy sensing, dual technology', mountingType: 'Ceiling', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'Standard ceiling sensor for offices, classrooms', active: 'Yes' },
  { catalogNumber: 'NCM PDT 10', productFamily: 'nLight Wired', category: 'Sensor', description: 'nLight Ceiling Mount, Passive Dual Technology, 360° coverage, 1000 sq ft', capabilities: 'occupancy sensing, vacancy sensing, dual technology', mountingType: 'Ceiling', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'Larger coverage version', active: 'Yes' },
  { catalogNumber: 'NCM PDT 9 AR', productFamily: 'nLight Wired', category: 'Sensor', description: 'nLight Ceiling Mount, PDT with Auxiliary Relay output', capabilities: 'occupancy sensing, vacancy sensing, aux relay, HVAC integration', mountingType: 'Ceiling', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'Use when sensor needs to directly trigger HVAC or other dry contact device', active: 'Yes' },
  { catalogNumber: 'NCM ADCX', productFamily: 'nLight Wired', category: 'Sensor', description: 'nLight Ceiling Mount, Auto Dimming Photosensor with Occupancy', capabilities: 'daylight harvesting, occupancy sensing, photosensor, dimming', mountingType: 'Ceiling', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'For daylight zones — sidelighted and toplit areas', active: 'Yes' },
  { catalogNumber: 'NCM PDT 9 RJ', productFamily: 'nLight Wired', category: 'Sensor', description: 'nLight Ceiling Mount, PDT with RJ45 connection', capabilities: 'occupancy sensing, vacancy sensing, dual technology', mountingType: 'Ceiling', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'RJ45 connector for easy installation', active: 'Yes' },

  // --- nLight Wired: Wall Sensors ---
  { catalogNumber: 'NWSXA PDT', productFamily: 'nLight Wired', category: 'Sensor', description: 'nLight Wired Wall Switch, Passive Dual Technology', capabilities: 'occupancy sensing, vacancy sensing, wall switch, manual control', mountingType: 'Wall', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'Wall-mount occupancy sensor with manual override', active: 'Yes' },
  { catalogNumber: 'NWSXA PDT WH', productFamily: 'nLight Wired', category: 'Sensor', description: 'nLight Wired Wall Switch, PDT, White', capabilities: 'occupancy sensing, vacancy sensing, wall switch, manual control', mountingType: 'Wall', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'White finish', active: 'Yes' },

  // --- nLight Wired: Wallpods ---
  { catalogNumber: 'NPODM DX', productFamily: 'nLight Wired', category: 'Control Device', description: 'nLight Wallpod, Manual On, Dimming', capabilities: 'manual control, dimming, scene control', mountingType: 'Wall', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'Basic manual-on dimming wallpod', active: 'Yes' },
  { catalogNumber: 'NPODM 4S DX', productFamily: 'nLight Wired', category: 'Control Device', description: 'nLight Wallpod, 4 Scene, Dimming', capabilities: 'manual control, dimming, scene control, 4 scenes', mountingType: 'Wall', voltage: 'Low Voltage', platform: 'nLight Wired', notes: '4-scene wallpod for conference rooms and multi-use spaces', active: 'Yes' },
  { catalogNumber: 'NPODM 2P DX', productFamily: 'nLight Wired', category: 'Control Device', description: 'nLight Wallpod, 2 Pole, Dimming', capabilities: 'manual control, dimming, 2-pole switching', mountingType: 'Wall', voltage: 'Low Voltage', platform: 'nLight Wired', notes: '2-pole for controlling two zones', active: 'Yes' },

  // --- nLight Wired: Touchscreens ---
  { catalogNumber: 'NTS 7IN', productFamily: 'nLight Wired', category: 'Control Device', description: 'nLight 7-inch Touchscreen', capabilities: 'scene control, scheduling, dimming, group control, touchscreen interface', mountingType: 'Wall', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'Full touchscreen control for lobbies, conference rooms, multi-zone areas', active: 'Yes' },

  // --- nLight Wired: Power Packs ---
  { catalogNumber: 'NPP16 D', productFamily: 'nLight Wired', category: 'Power Pack', description: 'nLight Power Pack, 16A, Dimming', capabilities: 'switching, dimming, 0-10V', mountingType: 'Fixture-Embedded', voltage: '120-277V', platform: 'nLight Wired', notes: 'Standard dimming power pack — 1 per fixture or fixture group', active: 'Yes' },
  { catalogNumber: 'NPP16 D ER', productFamily: 'nLight Wired', category: 'Power Pack', description: 'nLight Power Pack, 16A, Dimming, Emergency Relay', capabilities: 'switching, dimming, 0-10V, emergency relay', mountingType: 'Fixture-Embedded', voltage: '120-277V', platform: 'nLight Wired', notes: 'With emergency relay for life safety circuits', active: 'Yes' },
  { catalogNumber: 'NPP16', productFamily: 'nLight Wired', category: 'Power Pack', description: 'nLight Power Pack, 16A, Switching Only', capabilities: 'switching', mountingType: 'Fixture-Embedded', voltage: '120-277V', platform: 'nLight Wired', notes: 'Switching-only power pack, no dimming', active: 'Yes' },
  { catalogNumber: 'NPP16 D PLB', productFamily: 'nLight Wired', category: 'Power Pack', description: 'nLight Power Pack, 16A, Dimming, Plenum Rated', capabilities: 'switching, dimming, 0-10V, plenum rated', mountingType: 'Fixture-Embedded', voltage: '120-277V', platform: 'nLight Wired', notes: 'Plenum-rated for above ceiling installations', active: 'Yes' },

  // --- nLight Wired: Power Supplies ---
  { catalogNumber: 'NPS 80', productFamily: 'nLight Wired', category: 'Power Supply', description: 'nLight Power Supply, 80W', capabilities: 'power supply, 80W', mountingType: 'Panel', voltage: '120-277V', platform: 'nLight Wired', notes: 'Powers nLight network devices — 1 per panel or zone', active: 'Yes' },
  { catalogNumber: 'NPS 150', productFamily: 'nLight Wired', category: 'Power Supply', description: 'nLight Power Supply, 150W', capabilities: 'power supply, 150W', mountingType: 'Panel', voltage: '120-277V', platform: 'nLight Wired', notes: 'Higher capacity power supply for larger zones', active: 'Yes' },

  // --- nLight Wired: Bridges & Controllers ---
  { catalogNumber: 'NBRG 8', productFamily: 'nLight Wired', category: 'Controller', description: 'nLight Bridge Gateway, 8-port', capabilities: 'network gateway, IP connectivity, scheduling, remote management, 8 ports', mountingType: 'DIN Rail', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'Connects nLight network to IP — 1 per building or large zone', active: 'Yes' },
  { catalogNumber: 'NECY MVOLT BAC', productFamily: 'nLight Wired', category: 'Controller', description: 'nLight Eclypse System Controller with BACnet', capabilities: 'BACnet, BMS integration, IP connectivity, scheduling, demand response, remote management', mountingType: 'DIN Rail', voltage: '120-277V', platform: 'nLight Wired', notes: 'Required for BACnet/BMS integration — replaces NBRG when BACnet is needed', active: 'Yes' },
  { catalogNumber: 'NECY MVOLT', productFamily: 'nLight Wired', category: 'Controller', description: 'nLight Eclypse System Controller', capabilities: 'IP connectivity, scheduling, demand response, remote management', mountingType: 'DIN Rail', voltage: '120-277V', platform: 'nLight Wired', notes: 'Eclypse without BACnet — for IP connectivity and scheduling only', active: 'Yes' },

  // --- nLight Wired: Relay Panels ---
  { catalogNumber: 'ARP 8 INTENC', productFamily: 'nLight Wired', category: 'Relay Panel', description: 'Acuity Relay Panel, 8 relays, Integrated Enclosure', capabilities: 'circuit switching, 8 relays, scheduling', mountingType: 'Panel', voltage: '120-277V', platform: 'nLight Wired', notes: 'Small panel — lobbies, small buildings', active: 'Yes' },
  { catalogNumber: 'ARP 16 INTENC', productFamily: 'nLight Wired', category: 'Relay Panel', description: 'Acuity Relay Panel, 16 relays, Integrated Enclosure', capabilities: 'circuit switching, 16 relays, scheduling', mountingType: 'Panel', voltage: '120-277V', platform: 'nLight Wired', notes: 'Mid-size panel — offices, schools', active: 'Yes' },
  { catalogNumber: 'ARP 24 INTENC', productFamily: 'nLight Wired', category: 'Relay Panel', description: 'Acuity Relay Panel, 24 relays, Integrated Enclosure', capabilities: 'circuit switching, 24 relays, scheduling', mountingType: 'Panel', voltage: '120-277V', platform: 'nLight Wired', notes: 'Large panel', active: 'Yes' },
  { catalogNumber: 'ARP 32 INTENC', productFamily: 'nLight Wired', category: 'Relay Panel', description: 'Acuity Relay Panel, 32 relays, Integrated Enclosure', capabilities: 'circuit switching, 32 relays, scheduling', mountingType: 'Panel', voltage: '120-277V', platform: 'nLight Wired', notes: 'Extra-large panel — hospitals, campuses', active: 'Yes' },
  { catalogNumber: 'ARP 48 INTENC', productFamily: 'nLight Wired', category: 'Relay Panel', description: 'Acuity Relay Panel, 48 relays, Integrated Enclosure', capabilities: 'circuit switching, 48 relays, scheduling', mountingType: 'Panel', voltage: '120-277V', platform: 'nLight Wired', notes: 'Largest panel — large commercial, campus', active: 'Yes' },
  { catalogNumber: 'ARPA PC', productFamily: 'nLight Wired', category: 'Accessory', description: 'ARP Photocell Accessory', capabilities: 'photocell, exterior lighting control', mountingType: 'Panel', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'Photocell input for ARP panel — exterior lighting', active: 'Yes' },

  // --- nLight Wired: Interface Devices ---
  { catalogNumber: 'NIO 1S', productFamily: 'nLight Wired', category: 'Interface', description: 'nLight Input/Output, Contact Closure Input (1 Switch)', capabilities: 'contact closure input, dry contact, fire alarm integration, HVAC integration', mountingType: 'Fixture-Embedded', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'For fire alarm, HVAC, or other dry contact signals into nLight', active: 'Yes' },
  { catalogNumber: 'NIO 1S KO', productFamily: 'nLight Wired', category: 'Interface', description: 'nLight Input/Output, Contact Closure Input, Chase Nipple Mount', capabilities: 'contact closure input, dry contact, fire alarm integration', mountingType: 'Fixture-Embedded', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'Chase nipple mounting version', active: 'Yes' },
  { catalogNumber: 'NIO D', productFamily: 'nLight Wired', category: 'Interface', description: 'nLight Input/Output, Dimming', capabilities: '0-10V dimming interface', mountingType: 'Fixture-Embedded', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'For dimming non-nLight fixtures', active: 'Yes' },
  { catalogNumber: 'NIO X', productFamily: 'nLight Wired', category: 'Interface', description: 'nLight External Touch Panel Interface', capabilities: 'AV integration, third-party panel interface', mountingType: 'Wall', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'For Crestron, AMX, or other AV system integration', active: 'Yes' },
  { catalogNumber: 'NIO BT', productFamily: 'nLight Wired', category: 'Interface', description: 'nLight Bluetooth Low Energy Communication Module', capabilities: 'Bluetooth, mobile app control, commissioning', mountingType: 'Fixture-Embedded', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'Enables mobile app commissioning and control via Bluetooth', active: 'Yes' },
  { catalogNumber: 'NAR40', productFamily: 'nLight Wired', category: 'Interface', description: 'nLight Auxiliary Relay, Dry Contact Output', capabilities: 'dry contact output, HVAC integration, relay output', mountingType: 'Fixture-Embedded', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'Dry contact output for HVAC activation based on occupancy', active: 'Yes' },

  // --- nLight Wired: DMX ---
  { catalogNumber: 'NPWDMX SNAPSHOT', productFamily: 'nLight Wired', category: 'Interface', description: 'nLight DMX Interface with Snapshot', capabilities: 'DMX-512, scene snapshot, architectural lighting control', mountingType: 'DIN Rail', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'For DMX-controlled architectural or theatrical lighting', active: 'Yes' },

  // --- nLight Wired: Exterior ---
  { catalogNumber: 'ETS20 DR', productFamily: 'nLight Wired', category: 'Sensor', description: 'Exterior Twilight Sensor, 20ft mounting height', capabilities: 'photocell, exterior lighting, dusk-to-dawn', mountingType: 'Exterior', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'For automatic exterior lighting control', active: 'Yes' },

  // --- nLight Wired: Partition Sensors ---
  { catalogNumber: 'NPARTITION KIT', productFamily: 'nLight Wired', category: 'Sensor', description: 'nLight Partition Sensor Kit', capabilities: 'partition detection, occupancy sensing', mountingType: 'Ceiling', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'For spaces with operable partitions', active: 'Yes' },

  // --- nLight Wired: Commissioning ---
  { catalogNumber: 'NCOMKIT', productFamily: 'nLight Wired', category: 'Accessory', description: 'nLight Commissioning Kit', capabilities: 'commissioning, system setup', mountingType: 'N/A', voltage: 'N/A', platform: 'nLight Wired', notes: 'Required for system commissioning and startup', active: 'Yes' },

  // --- nLight Air (Wireless) ---
  { catalogNumber: 'rSI', productFamily: 'nLight Air', category: 'Interface', description: 'nLight AIR System Input Device', capabilities: 'wireless input, dry contact, fire alarm integration', mountingType: 'Fixture-Embedded', voltage: 'Low Voltage', platform: 'nLight AIR G2', notes: 'Wireless version of NIO for nLight AIR systems', active: 'Yes' },
  { catalogNumber: 'rPOD MICRO', productFamily: 'nLight Air', category: 'Control Device', description: 'nLight AIR Battery-Powered Wireless Wall Switch', capabilities: 'wireless switch, manual control, battery powered', mountingType: 'Wall', voltage: 'Battery', platform: 'nLight AIR G2', notes: 'No wiring needed — battery powered wireless switch', active: 'Yes' },

  // --- SensorSwitch ---
  { catalogNumber: 'WSX PDT WH', productFamily: 'SensorSwitch', category: 'Sensor', description: 'SensorSwitch Wall Switch, Passive Dual Technology, White', capabilities: 'occupancy sensing, vacancy sensing, wall switch, manual control', mountingType: 'Wall', voltage: '120-277V', platform: 'Standalone', notes: 'Standalone wall sensor — no nLight network required', active: 'Yes' },
  { catalogNumber: 'WSX PDT IV', productFamily: 'SensorSwitch', category: 'Sensor', description: 'SensorSwitch Wall Switch, Passive Dual Technology, Ivory', capabilities: 'occupancy sensing, vacancy sensing, wall switch, manual control', mountingType: 'Wall', voltage: '120-277V', platform: 'Standalone', notes: 'Ivory finish standalone wall sensor', active: 'Yes' },
  { catalogNumber: 'CM PDT 9', productFamily: 'SensorSwitch', category: 'Sensor', description: 'SensorSwitch Ceiling Mount, PDT, 900 sq ft', capabilities: 'occupancy sensing, vacancy sensing, dual technology', mountingType: 'Ceiling', voltage: 'Low Voltage', platform: 'Standalone', notes: 'Standalone ceiling sensor — use with power packs', active: 'Yes' },
  { catalogNumber: 'CM PDT 10', productFamily: 'SensorSwitch', category: 'Sensor', description: 'SensorSwitch Ceiling Mount, PDT, 1000 sq ft', capabilities: 'occupancy sensing, vacancy sensing, dual technology', mountingType: 'Ceiling', voltage: 'Low Voltage', platform: 'Standalone', notes: 'Larger coverage standalone ceiling sensor', active: 'Yes' },

  // --- SensorSwitch Air ---
  { catalogNumber: 'WSXA PDT WH', productFamily: 'SensorSwitch Air', category: 'Sensor', description: 'SensorSwitch Air Wall Switch, PDT, White', capabilities: 'wireless, occupancy sensing, vacancy sensing, wall switch', mountingType: 'Wall', voltage: 'Battery', platform: 'SensorSwitch Air', notes: 'Wireless standalone wall sensor', active: 'Yes' },

  // --- Fresco ---
  { catalogNumber: 'FCS 7TSN', productFamily: 'Fresco', category: 'Control Device', description: 'Fresco 7-inch Touchscreen', capabilities: 'scene control, dimming, color tuning, touchscreen, scheduling', mountingType: 'Wall', voltage: 'Low Voltage', platform: 'Fresco', notes: 'Touchscreen for Fresco dimming/color systems', active: 'Yes' },

  // --- Wiring ---
  { catalogNumber: 'CAT5 nLight', productFamily: 'Wiring', category: 'Cable', description: 'CAT5 nLight Network Cable', capabilities: 'network wiring', mountingType: 'N/A', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'Standard CAT5 cable for nLight network', active: 'Yes' },
  { catalogNumber: 'CAT6', productFamily: 'Wiring', category: 'Cable', description: 'CAT6 Network Cable', capabilities: 'network wiring', mountingType: 'N/A', voltage: 'Low Voltage', platform: 'nLight Wired', notes: 'CAT6 cable for IP backbone', active: 'Yes' },
];

// ===== Default Spec Rules Data =====

const DEFAULT_SPEC_RULES = [
  { ruleId: 'bacnet_integration', requirementName: 'BACnet Integration', category: 'Integration', keywords: 'bacnet, bms, building management, building automation, bacnet ip, bacnet mstp', primaryDevices: 'NECY MVOLT BAC', alternativeDevices: 'NBRG 8', quantityGuidance: '1 per building or system', whenToUse: 'When spec requires BACnet communication with BMS or building automation system', alternativeNotes: 'NBRG 8 provides basic IP gateway without BACnet — use only if BACnet is not required', acuityCanMeet: 'Yes', gapNotes: '', notes: 'Verify BACnet IP vs MS/TP requirement. Eclypse supports BACnet IP natively.' },
  { ruleId: 'hvac_dry_contact', requirementName: 'HVAC Integration (Dry Contact)', category: 'Integration', keywords: 'hvac, dry contact, hvac integration, mechanical integration, hvac override', primaryDevices: 'NAR40', alternativeDevices: 'NCM PDT 9 AR', quantityGuidance: '1 per HVAC zone', whenToUse: 'When spec requires occupancy-based HVAC control via dry contact relay', alternativeNotes: 'NCM PDT 9 AR has built-in aux relay — use when ceiling sensor can directly trigger HVAC unit', acuityCanMeet: 'Yes', gapNotes: '', notes: 'NAR40 is dedicated relay; AR sensors provide sensor+relay in one device' },
  { ruleId: 'fire_alarm_integration', requirementName: 'Fire Alarm Integration', category: 'Life Safety', keywords: 'fire alarm, fire alarm relay, facp, fire alarm control panel, fire alarm signal, fire alarm override', primaryDevices: 'NIO 1S', alternativeDevices: 'NIO 1S KO, rSI', quantityGuidance: '1 per fire alarm zone or 1 per building', whenToUse: 'When spec requires fire alarm system to override lighting to full on during alarm', alternativeNotes: 'NIO 1S KO for chase nipple mounting; rSI for nLight AIR wireless systems', acuityCanMeet: 'Yes', gapNotes: '', notes: 'NIO receives dry contact signal from FACP and commands all lights to full on' },
  { ruleId: 'occupancy_sensing', requirementName: 'Occupancy Sensing', category: 'Energy', keywords: 'occupancy sensor, occupancy sensing, motion sensor, vacancy sensor, occupant detection, auto off, auto-off', primaryDevices: 'NCM PDT 9, NWSXA PDT', alternativeDevices: 'CM PDT 9, WSX PDT WH', quantityGuidance: '1 ceiling sensor per room or 1 wall sensor per entry', whenToUse: 'When spec requires automatic lighting shutoff based on room occupancy', alternativeNotes: 'SensorSwitch (CM, WSX) for standalone systems without nLight network', acuityCanMeet: 'Yes', gapNotes: '', notes: 'Code typically requires auto-off within 20-30 minutes of vacancy' },
  { ruleId: 'daylight_harvesting', requirementName: 'Daylight Harvesting', category: 'Energy', keywords: 'daylight harvesting, daylight responsive, photosensor, daylight sensing, sidelighted, toplit, daylit, light level sensor', primaryDevices: 'NCM ADCX', alternativeDevices: '', quantityGuidance: '1 per daylight zone', whenToUse: 'When spec requires automatic dimming based on available daylight in sidelighted or toplit zones', alternativeNotes: '', acuityCanMeet: 'Yes', gapNotes: '', notes: 'NCM ADCX combines occupancy + daylight sensing in one device' },
  { ruleId: 'manual_control', requirementName: 'Manual On Control', category: 'Controls', keywords: 'manual on, manual control, wall switch, wallpod, manual override, light switch', primaryDevices: 'NPODM DX, NWSXA PDT', alternativeDevices: 'WSX PDT WH', quantityGuidance: '1 per room entry point', whenToUse: 'When spec requires manual-on capability at each space entrance', alternativeNotes: 'WSX for standalone systems', acuityCanMeet: 'Yes', gapNotes: '', notes: 'Many energy codes require manual-on rather than full auto-on' },
  { ruleId: 'dimming_control', requirementName: 'Dimming Control', category: 'Controls', keywords: 'dimming, continuous dimming, 0-10v, dim to off, dim, adjustable light level, tunable', primaryDevices: 'NPP16 D, NPODM DX', alternativeDevices: 'NIO D', quantityGuidance: '1 power pack per fixture or group; 1 wallpod per room', whenToUse: 'When spec requires continuous dimming capability for light level adjustment', alternativeNotes: 'NIO D for dimming non-nLight fixtures via 0-10V', acuityCanMeet: 'Yes', gapNotes: '', notes: '0-10V is the most common dimming protocol' },
  { ruleId: 'scene_control', requirementName: 'Scene Control', category: 'Controls', keywords: 'scene control, scene preset, scene, multi-scene, lighting scenes, preset', primaryDevices: 'NPODM 4S DX, NTS 7IN', alternativeDevices: 'FCS 7TSN', quantityGuidance: '1 per room requiring scenes', whenToUse: 'When spec requires multiple preset lighting scenes (presentation, meeting, cleaning, etc.)', alternativeNotes: 'FCS 7TSN for Fresco systems with color tuning', acuityCanMeet: 'Yes', gapNotes: '', notes: '4-scene wallpod for basic needs; touchscreen for complex multi-zone scenes' },
  { ruleId: 'scheduling', requirementName: 'Time-Based Scheduling', category: 'Energy', keywords: 'scheduling, time clock, astronomical time, sweep, after hours, schedule, time-based, time of day', primaryDevices: 'NECY MVOLT, ARP 16 INTENC', alternativeDevices: 'NBRG 8', quantityGuidance: '1 per building', whenToUse: 'When spec requires automatic lighting schedules, sweep off, or astronomical time control', alternativeNotes: 'NBRG 8 provides basic scheduling; Eclypse for advanced scheduling with BACnet', acuityCanMeet: 'Yes', gapNotes: '', notes: 'ARP panels have built-in scheduling capability' },
  { ruleId: 'exterior_lighting', requirementName: 'Exterior Lighting Control', category: 'Energy', keywords: 'exterior lighting, outdoor lighting, photocell, dusk to dawn, site lighting, parking lot', primaryDevices: 'ETS20 DR, ARPA PC', alternativeDevices: 'ARP 8 INTENC', quantityGuidance: '1 photocell per exposure; 1 ARP per exterior zone', whenToUse: 'When spec requires automatic exterior lighting control based on ambient light', alternativeNotes: 'ARP with built-in scheduling can supplement photocell control', acuityCanMeet: 'Yes', gapNotes: '', notes: 'Exterior lighting typically needs photocell + scheduling + relay panel' },
  { ruleId: 'emergency_lighting', requirementName: 'Emergency Lighting', category: 'Life Safety', keywords: 'emergency lighting, emergency circuit, emergency relay, life safety, egress, emergency power', primaryDevices: 'NPP16 D ER', alternativeDevices: 'ARP 16 INTENC', quantityGuidance: '1 per emergency circuit fixture', whenToUse: 'When spec requires emergency relay bypass for life safety lighting', alternativeNotes: 'ARP panel can also handle emergency circuit separation at panel level', acuityCanMeet: 'Yes', gapNotes: '', notes: 'ER power packs bypass dimming during emergency — lights go to full on' },
  { ruleId: 'dmx_control', requirementName: 'DMX Lighting Control', category: 'Integration', keywords: 'dmx, dmx-512, dmx control, architectural lighting, theatrical, color changing, rgb', primaryDevices: 'NPWDMX SNAPSHOT', alternativeDevices: '', quantityGuidance: '1 per DMX universe', whenToUse: 'When spec requires DMX-512 protocol for architectural or theatrical lighting', alternativeNotes: '', acuityCanMeet: 'Yes', gapNotes: '', notes: 'NPWDMX bridges nLight to DMX universe' },
  { ruleId: 'av_integration', requirementName: 'AV System Integration', category: 'Integration', keywords: 'av integration, audio visual, crestron, amx, savant, av system, conference room, presentation', primaryDevices: 'NIO X', alternativeDevices: 'NIO 1S', quantityGuidance: '1 per AV-controlled room', whenToUse: 'When spec requires lighting integration with Crestron, AMX, or other AV control systems', alternativeNotes: 'NIO 1S for simple dry contact triggering from AV system', acuityCanMeet: 'Yes', gapNotes: '', notes: 'NIO X provides full integration with third-party touch panels' },
  { ruleId: 'demand_response', requirementName: 'Demand Response', category: 'Energy', keywords: 'demand response, load shed, demand reduction, utility signal, openadr, demand management', primaryDevices: 'NECY MVOLT BAC', alternativeDevices: 'NECY MVOLT', quantityGuidance: '1 per building', whenToUse: 'When spec requires automatic lighting reduction in response to utility demand response signals', alternativeNotes: 'Eclypse without BACnet can still handle demand response via IP', acuityCanMeet: 'Yes', gapNotes: '', notes: 'Title 24 requires 15% demand response reduction capability' },
  { ruleId: 'network_gateway', requirementName: 'Network/IP Gateway', category: 'Integration', keywords: 'network, ip gateway, ethernet, remote access, remote management, network connection', primaryDevices: 'NBRG 8', alternativeDevices: 'NECY MVOLT', quantityGuidance: '1 per building or zone', whenToUse: 'When spec requires IP connectivity for remote management or monitoring', alternativeNotes: 'Eclypse provides IP gateway plus advanced features (BACnet, scheduling)', acuityCanMeet: 'Yes', gapNotes: '', notes: 'NBRG 8 for basic gateway; Eclypse for full-featured controller' },
  { ruleId: 'relay_panel', requirementName: 'Lighting Control Panel', category: 'Controls', keywords: 'lighting control panel, relay panel, circuit control, panel, breaker control', primaryDevices: 'ARP 16 INTENC', alternativeDevices: 'ARP 8 INTENC, ARP 24 INTENC, ARP 32 INTENC, ARP 48 INTENC', quantityGuidance: '1 per electrical room or zone', whenToUse: 'When spec requires centralized relay-based lighting control panels', alternativeNotes: 'Size based on number of circuits: 8, 16, 24, 32, or 48 relays', acuityCanMeet: 'Yes', gapNotes: '', notes: 'ARP panels include built-in scheduling and can accept photocell input' },
  { ruleId: 'bluetooth_commissioning', requirementName: 'Bluetooth Commissioning', category: 'Commissioning', keywords: 'bluetooth, mobile app, commissioning, wireless commissioning, ble', primaryDevices: 'NIO BT', alternativeDevices: '', quantityGuidance: '1 per zone requiring mobile commissioning', whenToUse: 'When spec requires Bluetooth-based commissioning or mobile app control', alternativeNotes: '', acuityCanMeet: 'Yes', gapNotes: '', notes: 'Enables SensorView mobile app for commissioning and adjustments' },
  { ruleId: 'partition_sensing', requirementName: 'Partition Wall Sensing', category: 'Controls', keywords: 'partition, operable partition, movable wall, partition sensor, dividable room', primaryDevices: 'NPARTITION KIT', alternativeDevices: '', quantityGuidance: '1 per operable partition', whenToUse: 'When spec requires automatic lighting zone changes based on partition position', alternativeNotes: '', acuityCanMeet: 'Yes', gapNotes: '', notes: 'Detects partition open/closed and adjusts lighting zones automatically' },
  { ruleId: 'multi_level_switching', requirementName: 'Multi-Level Switching', category: 'Energy', keywords: 'multi-level, bi-level, multi level, two level, stepped dimming, step dimming', primaryDevices: 'NPP16 D, NPODM DX', alternativeDevices: 'NPP16', quantityGuidance: '1 power pack per fixture; 1 wallpod per room', whenToUse: 'When spec requires at least one intermediate light level between full on and off', alternativeNotes: 'NPP16 switching-only for bi-level (on/off) without dimming', acuityCanMeet: 'Yes', gapNotes: '', notes: 'Title 24 requires multi-level in spaces > 100 sq ft' },
  { ruleId: 'institutional_tuning', requirementName: 'Institutional Tuning', category: 'Energy', keywords: 'institutional tuning, high end trim, maximum light level, tuning, energy savings, light level cap', primaryDevices: 'NECY MVOLT, NBRG 8', alternativeDevices: '', quantityGuidance: '1 per building', whenToUse: 'When spec requires the ability to set maximum light output below 100% for energy savings', alternativeNotes: '', acuityCanMeet: 'Yes', gapNotes: '', notes: 'Tuning is set via SensorView software through bridge/Eclypse' },
  { ruleId: 'wireless_controls', requirementName: 'Wireless Controls', category: 'Controls', keywords: 'wireless, wireless controls, wire-free, battery powered, no new wiring, retrofit', primaryDevices: 'rPOD MICRO, rSI', alternativeDevices: 'WSXA PDT WH', quantityGuidance: '1 per room or zone', whenToUse: 'When spec requires wireless/battery-powered controls for retrofit or renovation', alternativeNotes: 'SensorSwitch Air for standalone wireless sensing', acuityCanMeet: 'Yes', gapNotes: '', notes: 'nLight AIR G2 wireless platform — no new wiring required' },
  { ruleId: 'system_startup', requirementName: 'System Commissioning & Startup', category: 'Commissioning', keywords: 'commissioning, startup, system startup, commissioning agent, functional testing, cx', primaryDevices: 'NCOMKIT', alternativeDevices: '', quantityGuidance: '1 per project', whenToUse: 'When spec requires system commissioning, startup, or functional testing', alternativeNotes: '', acuityCanMeet: 'Yes', gapNotes: '', notes: 'Startup includes sensor aiming, scheduling setup, scene programming, and functional verification' },
  { ruleId: 'power_over_ethernet', requirementName: 'Power over Ethernet (PoE)', category: 'Integration', keywords: 'poe, power over ethernet, low voltage lighting, dc lighting', primaryDevices: '', alternativeDevices: '', quantityGuidance: '', whenToUse: 'When spec requires PoE-powered luminaires or controls', alternativeNotes: '', acuityCanMeet: 'Partial', gapNotes: 'Acuity offers some PoE luminaires but not a full PoE controls platform. nLight is low-voltage but not PoE. Evaluate specific PoE requirements.', notes: 'PoE lighting is an emerging technology — verify specific requirements' },
  { ruleId: 'dali_protocol', requirementName: 'DALI Protocol', category: 'Integration', keywords: 'dali, digital addressable, dali-2, dali protocol, luminaire level control', primaryDevices: '', alternativeDevices: 'NPP16 D', quantityGuidance: '', whenToUse: 'When spec specifically requires DALI protocol for luminaire-level control', alternativeNotes: 'nLight with 0-10V dimming provides similar functionality without DALI protocol', acuityCanMeet: 'Partial', gapNotes: 'Acuity primarily uses 0-10V dimming rather than DALI. nLight provides luminaire-level control via its own protocol. Propose nLight as equivalent alternative.', notes: 'Position nLight as a more integrated alternative to DALI' },
];

// ===== Default Alternatives Data =====

const DEFAULT_ALTERNATIVES = [
  { specRequirement: 'DALI Protocol', acuityAlternative: 'nLight Wired Network with 0-10V Dimming', alternativeCatalogNumber: 'NPP16 D, NBRG 8', whyItsBetter: 'nLight provides luminaire-level control, occupancy sensing, daylight harvesting, and centralized management through a single integrated platform — capabilities that DALI alone does not offer without additional infrastructure.', limitations: 'nLight uses a proprietary protocol rather than DALI standard. If the spec requires DALI for interoperability with third-party luminaires, this should be flagged.', notes: '' },
  { specRequirement: 'KNX Protocol', acuityAlternative: 'nLight with Eclypse BACnet Integration', alternativeCatalogNumber: 'NECY MVOLT BAC', whyItsBetter: 'Eclypse with BACnet provides building-wide integration including lighting, HVAC, and scheduling — similar scope to KNX but optimized for lighting controls with native Acuity hardware.', limitations: 'KNX is a broader building automation protocol. If KNX integration with non-lighting systems is required, a KNX gateway may still be needed.', notes: '' },
  { specRequirement: 'Lutron Controls', acuityAlternative: 'nLight Wired or nLight AIR System', alternativeCatalogNumber: 'NCM PDT 9, NPODM DX, NBRG 8', whyItsBetter: 'nLight is a fully integrated, scalable lighting controls platform from Acuity Brands with equivalent occupancy sensing, dimming, scheduling, and scene control capabilities.', limitations: 'If spec specifically names Lutron as sole source, an approved equal request may be needed.', notes: 'Highlight code compliance, integration capabilities, and Acuity luminaire compatibility' },
  { specRequirement: 'Wireless Mesh Network (Zigbee/Thread)', acuityAlternative: 'nLight AIR G2 Wireless Platform', alternativeCatalogNumber: 'rPOD MICRO, rSI', whyItsBetter: 'nLight AIR G2 is purpose-built for lighting controls with reliable wireless communication, battery-powered switches, and seamless integration with wired nLight infrastructure.', limitations: 'nLight AIR uses its own wireless protocol, not Zigbee or Thread. If interoperability with non-lighting IoT devices is required, this should be noted.', notes: '' },
];

module.exports = ProductKnowledgeBaseService;
