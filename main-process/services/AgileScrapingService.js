/**
 * AgileScrapingService
 * Polls the Agile workqueue page via Edge CDP, parses DOM into structured RFA entries,
 * caches results, diffs for changes, and invokes callbacks for updates and new RFAs.
 */

const fs = require('fs');
const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Diagnostic script: runs in page context and returns DOM structure info
 * (tag counts, header-like texts, ARIA roles, grid-like class names, shadow root count).
 * Used to tune selectors when the Agile page structure is unknown.
 * @returns {() => Object}
 */
function getDiagnosticScript() {
  return function diagnosePageInFrame() {
    const normalize = (s) => (s && typeof s === 'string' ? s.trim() : '') || '';
    const tagCounts = {};
    document.querySelectorAll('*').forEach((el) => {
      const tag = el.tagName.toLowerCase();
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    const headerLike = [];
    const headerKeywords = ['wq', 'task type', 'doc', 'rep', 'status', 'assigned', 'due', 'requested', 'job', 'sub name', 'comment', 'complexity', 'rfa', 'type', 'number'];
    document.querySelectorAll('th, td, [role="columnheader"], [role="gridcell"], .header, .grid-header, [class*="header"], [class*="column"]').forEach((el) => {
      const text = normalize(el.textContent);
      if (text.length > 0 && text.length < 80) {
        const lower = text.toLowerCase();
        if (headerKeywords.some((k) => lower.includes(k)) || /^[a-z\s#]+$/i.test(text)) {
          headerLike.push({ text: text.slice(0, 60), tag: el.tagName, className: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 100) });
        }
      }
    });
    const ariaRoles = new Set();
    document.querySelectorAll('[role]').forEach((el) => ariaRoles.add(el.getAttribute('role')));
    const gridLikeClasses = new Set();
    document.querySelectorAll('[class*="grid"], [class*="row"], [class*="table"], [class*="data"]').forEach((el) => {
      if (el.className && typeof el.className === 'string') {
        el.className.split(/\s+/).filter(Boolean).forEach((c) => gridLikeClasses.add(c));
      }
    });
    const sampleRow = document.querySelector('tr, [role="row"]');
    let sampleRowInfo = null;
    if (sampleRow) {
      const cells = sampleRow.querySelectorAll('td, th, [role="gridcell"], [role="columnheader"]');
      sampleRowInfo = { tag: sampleRow.tagName, class: (sampleRow.className || '').slice(0, 80), cellCount: cells.length };
    }
    let shadowRootCount = 0;
    const shadowHostTags = new Set();
    document.querySelectorAll('*').forEach((el) => {
      if (el.shadowRoot) {
        shadowRootCount++;
        shadowHostTags.add(el.tagName.toLowerCase());
      }
    });
    return {
      url: typeof window !== 'undefined' ? window.location.href : '',
      tagCounts,
      headerLike: headerLike.slice(0, 50),
      ariaRoles: Array.from(ariaRoles),
      gridLikeClasses: Array.from(gridLikeClasses).slice(0, 40),
      sampleRowInfo,
      tableCount: document.querySelectorAll('table').length,
      rowCount: document.querySelectorAll('tr, [role="row"]').length,
      shadowRootCount,
      shadowHostTags: Array.from(shadowHostTags).slice(0, 20)
    };
  };
}

/**
 * Script injected into the Agile workqueue page to extract table data.
 * Runs in browser context.
 * Selectors are generic fallbacks; for the live workqueue page, inspect the DOM (VPN required)
 * and update these selectors. See docs/agile-workqueue-dom-selectors.md.
 * Returns { entries: Array<WorkqueueEntry>, scrapedAt: string, error?: string }.
 */
/** Map Agile page column header text to our workqueue entry model.
 * The grid has 3 leading empty cells (checkbox/selection), then: WQ #, Task Type, Doc #, Rep, Status, Assigned To, Due Date, Requested Date, Job Name, Est. Hours, User Comment, Complexity.
 * obj-based lookup is primary (header text → value); values[] fallback uses offset +3 for the leading empties. */
function mapRowToEntry(obj, values, headers) {
  const n = (s) => (s && typeof s === 'string' ? s.trim() : '') || '';
  // Detect offset: skip leading empty cells
  let off = 0;
  for (let i = 0; i < values.length; i++) { if (n(values[i])) { off = i; break; } }
  return {
    wqNumber: n(obj['WQ #'] || obj['WQ'] || values[off] || ''),
    rfaNumber: n(obj['Doc #'] || obj['Doc Number'] || obj['RFA Number'] || obj['RFA #'] || values[off + 2] || ''),
    rfaType: n(obj['Task Type'] || obj['Type'] || obj['RFA Type'] || values[off + 1] || ''),
    projectName: n(obj['Sub Name'] || obj['Submitter Name'] || obj['Job Name'] || obj['Project Name'] || obj['Project'] || values[off + 8] || ''),
    projectContainer: n(obj['Container'] || obj['Project Container'] || ''),
    status: n(obj['Status'] || obj['State'] || values[off + 4] || ''),
    agentNumber: n(obj['Rep'] || obj['Agent'] || obj['Agent Number'] || values[off + 3] || ''),
    ecd: n(obj['Due Date'] || obj['ECD'] || obj['Estimated Completion'] || values[off + 6] || ''),
    assignedTo: n(obj['Assigned To'] || obj['Assignee'] || values[off + 5] || ''),
    priority: n(obj['Complexity'] || obj['Priority'] || values[off + 11] || ''),
    lastUpdated: n(obj['Requested Date'] || obj['Last Updated'] || obj['Updated'] || values[off + 7] || ''),
    estHours: n(obj['Est. Hours'] || obj['Est Hours'] || values[off + 9] || ''),
    userComment: n(obj['User Comment'] || obj['UserComment'] || values[off + 10] || '')
  };
}

function getWorkqueueExtractionScript() {
  return function extractWorkqueue() {
    const scrapedAt = new Date().toISOString();
    const entries = [];
    const normalize = (s) => (s && typeof s === 'string' ? s.trim() : '') || '';

    // Must be defined inside so it is serialized into the page context (frame.evaluate only sends this function)
    // The grid has 3 leading empty cells, then: WQ #, Task Type, Doc #, Rep, Status, Assigned To, Due Date, Requested Date, Job Name, Est. Hours, User Comment, Complexity.
    // obj-based lookup is primary; values[] fallback detects offset from leading empties.
    function mapRowToEntry(obj, values, headers) {
      const n = (s) => (s && typeof s === 'string' ? s.trim() : '') || '';
      let off = 0;
      for (let i = 0; i < values.length; i++) { if (n(values[i])) { off = i; break; } }
      return {
        wqNumber: n(obj['WQ #'] || obj['WQ'] || values[off] || ''),
        rfaNumber: n(obj['Doc #'] || obj['Doc Number'] || obj['RFA Number'] || obj['RFA #'] || values[off + 2] || ''),
        rfaType: n(obj['Task Type'] || obj['Type'] || obj['RFA Type'] || values[off + 1] || ''),
        projectName: n(obj['Sub Name'] || obj['Submitter Name'] || obj['Job Name'] || obj['Project Name'] || obj['Project'] || values[off + 8] || ''),
        projectContainer: n(obj['Container'] || obj['Project Container'] || ''),
        status: n(obj['Status'] || obj['State'] || values[off + 4] || ''),
        agentNumber: n(obj['Rep'] || obj['Agent'] || obj['Agent Number'] || values[off + 3] || ''),
        ecd: n(obj['Due Date'] || obj['ECD'] || obj['Estimated Completion'] || values[off + 6] || ''),
        assignedTo: n(obj['Assigned To'] || obj['Assignee'] || values[off + 5] || ''),
        priority: n(obj['Complexity'] || obj['Priority'] || values[off + 11] || ''),
        lastUpdated: n(obj['Requested Date'] || obj['Last Updated'] || obj['Updated'] || values[off + 7] || ''),
        estHours: n(obj['Est. Hours'] || obj['Est Hours'] || values[off + 9] || ''),
        userComment: n(obj['User Comment'] || obj['UserComment'] || values[off + 10] || '')
      };
    }

    // Pierce shadow DOM: query selector from root and all shadow roots
    function querySelectorAllDeep(root, selector) {
      if (!root) return [];
      const list = Array.from(root.querySelectorAll(selector));
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) list.push(...querySelectorAllDeep(el.shadowRoot, selector));
      });
      return list;
    }
    function querySelectorDeep(root, selector) {
      if (!root) return null;
      const el = root.querySelector(selector);
      if (el) return el;
      for (const child of root.querySelectorAll('*')) {
        if (child.shadowRoot) {
          const found = querySelectorDeep(child.shadowRoot, selector);
          if (found) return found;
        }
      }
      return null;
    }

    // Strategy 0: Any element that looks like a grid with header-like text
    const headerKeywords = ['WQ', 'Task Type', 'Doc', 'Rep', 'Status', 'Assigned', 'Due', 'Requested', 'Job', 'Sub Name', 'Comment', 'Complexity'];
    const findGridContainer = (el) => {
      let p = el;
      for (let i = 0; i < 15 && p; i++) {
        const text = (p.textContent || '').toLowerCase();
        if (text.includes('task type') && text.includes('doc') && (text.includes('status') || text.includes('assigned'))) return p;
        p = p.parentElement;
      }
      return null;
    };
    for (const tag of ['th', 'td', '[role="columnheader"]', '[role="gridcell"]']) {
      querySelectorAllDeep(document, tag).forEach((cell) => {
        const t = normalize(cell.textContent);
        if (headerKeywords.some((k) => t.includes(k))) {
          const grid = findGridContainer(cell);
          if (grid && entries.length === 0) {
            const rows = querySelectorAllDeep(grid, 'tr, [role="row"], .ag-row, .dx-data-row, .k-grid-content tr, .ui-grid-row');
            let headerTexts = [];
            rows.forEach((row, ri) => {
              const cells = row.querySelectorAll(':scope > td, :scope > th, :scope > [role="gridcell"], :scope > [role="columnheader"]');
              const texts = Array.from(cells).map((c) => normalize(c.textContent));
              if (texts.length < 3) return;
              if (ri === 0 || headerTexts.length === 0) headerTexts = texts;
              else {
                const obj = {};
                headerTexts.forEach((h, i) => { if (h) obj[h] = texts[i]; });
                const e = mapRowToEntry(obj, texts, headerTexts);
                if (e.rfaNumber || e.wqNumber || e.projectName || e.status) entries.push(e);
              }
            });
          }
        }
      });
      if (entries.length > 0) break;
    }

    // Strategy 1: Standard HTML table with Agile column names
    if (entries.length === 0) {
      const tables = querySelectorAllDeep(document, 'table');
      for (const table of tables) {
        const headers = [];
        querySelectorAllDeep(table, 'thead th, thead td, tr:first-child th, tr:first-child td').forEach((c) => headers.push(normalize(c.textContent)));
        const rows = querySelectorAllDeep(table, 'tbody tr, tr:not(:first-child)');
        for (const row of rows) {
          const cells = querySelectorAllDeep(row, 'td, th');
          if (cells.length === 0) continue;
          const values = Array.from(cells).map((c) => normalize(c.textContent));
          const obj = {};
          headers.forEach((h, i) => { if (h) obj[h] = values[i]; });
          const e = mapRowToEntry(obj, values, headers);
          if (e.rfaNumber || e.wqNumber || e.projectName || e.status) entries.push(e);
        }
        if (entries.length > 0) break;
      }
    }

    // Strategy 2: ARIA grid with Agile column names
    if (entries.length === 0) {
      const grid = querySelectorDeep(document, '[role="grid"]');
      if (grid) {
        const rowEls = querySelectorAllDeep(grid, '[role="row"]');
        let headerCells = [];
        rowEls.forEach((row, ri) => {
          const cells = querySelectorAllDeep(row, '[role="gridcell"], [role="columnheader"], td, th');
          const texts = Array.from(cells).map((c) => normalize(c.textContent));
          if (ri === 0) headerCells = texts;
          else if (texts.length > 0) {
            const obj = {};
            headerCells.forEach((h, i) => { if (h) obj[h] = texts[i]; });
            const e = mapRowToEntry(obj, texts, headerCells);
            if (e.rfaNumber || e.wqNumber || e.projectName || e.status) entries.push(e);
          }
        });
      }
    }

    // Strategy 3: Links that look like RFA (Doc #) and closest row
    if (entries.length === 0) {
      const rfaPattern = /(\d{4,}-\d+)/;
      querySelectorAllDeep(document, 'a[href*="requestnav"], a[href*="rfa"], a[href*="doc"], [data-rfa], [data-doc]').forEach((a) => {
        const href = (a.getAttribute('href') || '').trim();
        const match = href.match(rfaPattern) || normalize(a.textContent).match(rfaPattern);
        if (match) {
          const rfaNumber = match[1];
          const row = a.closest('tr, [role="row"], .row, .ag-row, .dx-data-row, [class*="row"]');
          const cells = row ? row.querySelectorAll(':scope > td, :scope > th, :scope > [role="gridcell"]') : [];
          const cellTexts = Array.from(cells).map((c) => normalize(c.textContent));
          let _off = 0;
          for (let _i = 0; _i < cellTexts.length; _i++) { if (cellTexts[_i]) { _off = _i; break; } }
          entries.push({
            wqNumber: cellTexts[_off] || '',
            rfaNumber,
            rfaType: cellTexts[_off + 1] || '',
            projectName: cellTexts[_off + 8] || '',
            projectContainer: '',
            status: cellTexts[_off + 4] || '',
            agentNumber: cellTexts[_off + 3] || '',
            ecd: cellTexts[_off + 6] || '',
            assignedTo: cellTexts[_off + 5] || '',
            priority: cellTexts[_off + 11] || '',
            lastUpdated: cellTexts[_off + 7] || '',
            estHours: cellTexts[_off + 9] || '',
            userComment: cellTexts[_off + 10] || ''
          });
        }
      });
    }

    // Strategy 4: Div-class grid patterns
    if (entries.length === 0) {
      const rowSelectors = '.ag-row, .dx-data-row, .k-grid-content tbody tr, .ui-grid-row, [class*="data-row"], [class*="grid-row"]';
      const cellSelectors = 'td, th, [role="gridcell"], .ag-cell, .dx-command-select, [class*="cell"]';
      const container = querySelectorDeep(document, '[class*="grid"], [class*="table"], [class*="workqueue"]');
      if (container) {
        const rows = querySelectorAllDeep(container, rowSelectors);
        const firstRow = querySelectorDeep(container, 'thead tr, [role="row"]');
        let headerTexts = [];
        if (firstRow) {
          headerTexts = Array.from(querySelectorAllDeep(firstRow, cellSelectors)).map((c) => normalize(c.textContent));
        }
        rows.forEach((row) => {
          if (row.closest('thead')) return;
          const cells = querySelectorAllDeep(row, cellSelectors);
          const texts = Array.from(cells).map((c) => normalize(c.textContent));
          if (texts.length < 2) return;
          const obj = {};
          (headerTexts.length ? headerTexts : texts).forEach((h, i) => { if (h) obj[h] = texts[i]; });
          const e = mapRowToEntry(obj, texts, headerTexts);
          if (e.rfaNumber || e.wqNumber || e.projectName || e.status) entries.push(e);
        });
      }
    }

    // Strategy 5: Brute force - find RFA-like numbers and grab surrounding text
    if (entries.length === 0) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      const rfaPattern = /\b(\d{5,}-\d+)\b/g;
      const seen = new Set();
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent || '';
        let m;
        rfaPattern.lastIndex = 0;
        while ((m = rfaPattern.exec(text))) {
          const rfaNumber = m[1];
          if (seen.has(rfaNumber)) continue;
          seen.add(rfaNumber);
          const parent = node.parentElement;
          const row = parent && parent.closest('tr, [role="row"], [class*="row"]');
          const cells = row ? row.querySelectorAll(':scope > td, :scope > th, :scope > [role="gridcell"]') : [];
          const cellTexts = Array.from(cells).map((c) => normalize(c.textContent));
          if (cellTexts.length >= 4) {
            let _off2 = 0;
            for (let _j = 0; _j < cellTexts.length; _j++) { if (cellTexts[_j]) { _off2 = _j; break; } }
            entries.push({
              wqNumber: cellTexts[_off2] || '',
              rfaNumber,
              rfaType: cellTexts[_off2 + 1] || '',
              projectName: cellTexts[_off2 + 8] || '',
              projectContainer: '',
              status: cellTexts[_off2 + 4] || '',
              agentNumber: cellTexts[_off2 + 3] || '',
              ecd: cellTexts[_off2 + 6] || '',
              assignedTo: cellTexts[_off2 + 5] || '',
              priority: cellTexts[_off2 + 11] || '',
              lastUpdated: cellTexts[_off2 + 7] || '',
              estHours: cellTexts[_off2 + 9] || '',
              userComment: cellTexts[_off2 + 10] || ''
            });
          }
        }
      }
    }

    return { entries, scrapedAt };
  };
}

/**
 * Return true only if the value looks like an RFA/doc number (digits, optional hyphen and digits).
 * Rejects relative dates or labels that were wrongly mapped into rfaNumber by the workqueue scrape.
 * @param {string} rfaNumber
 */
function isValidRfaForUrl(rfaNumber) {
  const s = (rfaNumber || '').trim();
  if (!s) return false;
  if (/days?\s+ago|today|yesterday|not\s+started|^\s*$/i.test(s)) return false;
  return /\d{4,}/.test(s);
}

/**
 * Build project detail URL from RFA number and pattern.
 * @param {string} rfaNumber - e.g. "314165-0" or "24-64950"
 * @param {string} pattern - e.g. "http://rfa.acuitybrandslighting.net/#/requestnav/{rfaNumber}"
 */
function buildProjectDetailUrl(rfaNumber, pattern) {
  const base = (rfaNumber || '').trim().split('-')[0] || '';
  const url = (pattern || '').replace(/\{rfaNumber\}/gi, base);
  return url;
}

/**
 * Script injected into the RFA project details page to extract Header tab fields.
 * Targets: title bar (RFA number, job name, REP, ECD) and form labels (Status, ECD, Assigned To, etc.).
 * Returns { header: Object, isLoginPage?: boolean }.
 */
function getProjectHeaderExtractionScript() {
  return function extractProjectHeader() {
    const trim = (s) => (s && typeof s === 'string' ? s.trim() : '') || '';
    const bodyText = (document.body && document.body.innerText) ? document.body.innerText : '';
    if (/sign\s*in|log\s*in/i.test(bodyText) && !/Request for Assistance/i.test(bodyText)) {
      return { header: {}, isLoginPage: true };
    }
    const header = {};

    function querySelectorAllDeep(root, selector) {
      if (!root) return [];
      const list = Array.from(root.querySelectorAll(selector));
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) list.push(...querySelectorAllDeep(el.shadowRoot, selector));
      });
      return list;
    }

    // Title bar: find element containing "Request for Assistance" and parse REP, ECD, job name
    const banner = querySelectorAllDeep(document, '[class*="header"], [class*="banner"], [class*="title"], h1, header').find((el) => {
      const t = (el.textContent || '').trim();
      return t.includes('Request for Assistance') && (t.includes('REP:') || t.includes('ECD:'));
    }) || document.body;
    const bannerText = (banner.textContent || '').trim();
    const repMatch = bannerText.match(/REP:\s*(\d+)/i);
    const ecdMatch = bannerText.match(/ECD:\s*([\d/]+\s+\d+:\d+\s*[AP]M|\d{1,2}\/\d{1,2}\/\d{4}[^\\s]*)/i);
    if (repMatch) header.rep = trim(repMatch[1]);
    if (ecdMatch) header.ecdBanner = trim(ecdMatch[1]);
    const rfaMatch = bannerText.match(/Request for Assistance\s+([\d-]+)/i);
    if (rfaMatch) header.rfaNumber = trim(rfaMatch[1]);
    const jobMatch = bannerText.match(/([A-Z0-9][A-Za-z0-9\s]+)\s+\d{2}-\d{5}/);
    if (jobMatch) header.jobNameBanner = trim(jobMatch[1]);

    // Form fields: labels that start with or equal these strings
    const labelPatterns = [
      'Status', 'ECD', 'Requested Date', 'Submitted Date', 'Assigned To', 'Rep Contacts',
      'Complexity', 'RFA Value', 'Products on This Request', 'Root Cause', 'National Account',
      'Last Updated', 'Created By', 'Number of Lighting pages'
    ];
    const keyFromLabel = (label) => {
      const k = label.replace(/\s*[-–]\s*Revision\s*$/i, '').replace(/\s+/g, '');
      return k === 'NumberofLightingpages' ? 'LightingPagesWithControls' : k;
    };
    const allElements = querySelectorAllDeep(document, 'label, [class*="label"], th, [role="columnheader"], span, div, dt');
    for (const labelPattern of labelPatterns) {
      const key = keyFromLabel(labelPattern);
      if (header[key]) continue;
      for (const el of allElements) {
        const text = trim(el.textContent);
        if (!text || text.length > 100) continue;
        const isMatch = text === labelPattern || text.startsWith(labelPattern + ':') || text.startsWith(labelPattern + ' ');
        if (!isMatch) continue;
        let value = '';
        const container = el.closest('tr, [class*="row"], [class*="field"], div, section') || el.parentElement;
        const next = el.nextElementSibling;
        if (next) {
          const inp = next.querySelector && next.querySelector('input, select, textarea, [role="combobox"]');
          if (inp) value = trim((inp.value != null ? inp.value : inp.textContent) || '');
          else value = trim(next.textContent || '');
        }
        if (!value && container) {
          const inp = container.querySelector('input, select, textarea, [role="combobox"], [contenteditable="true"]');
          if (inp) value = trim((inp.value != null ? inp.value : inp.textContent) || '');
        }
        if (!value && container) {
          const chip = container.querySelector('[class*="chip"], [class*="tag"], [class*="badge"]');
          if (chip) value = trim(chip.textContent || '');
        }
        if (!value && el.parentElement && el.parentElement.nextElementSibling) value = trim(el.parentElement.nextElementSibling.textContent || '');
        if (value) {
          header[key] = value;
          break;
        }
      }
    }
    return { header, isLoginPage: false };
  };
}

/**
 * Script to extract key/value pairs from the current visible section (Details tab).
 * Same generic approach as Header: find labels and adjacent values.
 */
function getProjectDetailsExtractionScript() {
  return function extractProjectDetails() {
    const trim = (s) => (s && typeof s === 'string' ? s.trim() : '') || '';
    const details = {};
    function querySelectorAllDeep(root, selector) {
      if (!root) return [];
      const list = Array.from(root.querySelectorAll(selector));
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) list.push(...querySelectorAllDeep(el.shadowRoot, selector));
      });
      return list;
    }
    const all = querySelectorAllDeep(document, 'label, [class*="label"], th, dt, span, div');
    for (const el of all) {
      const text = trim(el.textContent);
      if (text.length < 2 || text.length > 80) continue;
      let value = '';
      const next = el.nextElementSibling;
      if (next) value = trim(next.textContent || '');
      if (!value && el.parentElement) value = trim(el.parentElement.nextElementSibling?.textContent || '');
      if (value) details[text.replace(/\s+/g, ' ').trim()] = value;
    }
    return details;
  };
}

/**
 * Script to extract notes from the Notes tab table.
 * Columns: Critical, Category, Source #, Shared, Description, Last Update (author), Last Update (date).
 * Returns array of { category, description, author, date } for the current page only.
 */
function getProjectNotesExtractionScript() {
  return function extractProjectNotes() {
    const trim = (s) => (s && typeof s === 'string' ? s.trim() : '') || '';
    const notes = [];
    function querySelectorAllDeep(root, selector) {
      if (!root) return [];
      const list = Array.from(root.querySelectorAll(selector));
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) list.push(...querySelectorAllDeep(el.shadowRoot, selector));
      });
      return list;
    }
    const table = querySelectorAllDeep(document, 'table').find((t) => {
      const text = (t.textContent || '').toLowerCase();
      return (text.includes('request note') || text.includes('category') || text.includes('description')) && text.includes('last update');
    }) || querySelectorAllDeep(document, '[role="grid"]').find((g) => (g.textContent || '').toLowerCase().includes('request note'));
    const container = table || document.body;
    const rows = container.querySelectorAll ? container.querySelectorAll('tr, [role="row"]') : [];
    const headerRow = rows[0];
    const headerTexts = headerRow ? Array.from(headerRow.querySelectorAll('th, td, [role="columnheader"], [role="gridcell"]')).map((c) => trim(c.textContent).toLowerCase()) : [];
    const col = (name) => {
      const i = headerTexts.findIndex((h) => h.includes(name));
      return i >= 0 ? i : (name === 'category' ? 1 : name === 'description' ? 4 : name === 'author' ? 5 : name === 'date' ? 6 : -1);
    };
    const categoryIdx = headerTexts.some((h) => h.includes('category')) ? col('category') : 1;
    const descIdx = headerTexts.some((h) => h.includes('description')) ? col('description') : 4;
    const authorIdx = headerTexts.some((h) => h.includes('author') || h.includes('last update')) ? (headerTexts.findIndex((h) => h.includes('author')) >= 0 ? col('author') : 5) : 5;
    const dateIdx = headerTexts.some((h) => h.includes('date') || h.includes('update')) ? (headerTexts.findIndex((h) => h.includes('date') || h.includes('update')) >= 0 ? headerTexts.findIndex((h) => h.includes('date') || h.includes('update')) : 6) : 6;
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r].querySelectorAll('td, [role="gridcell"]');
      const values = Array.from(cells).map((c) => trim(c.textContent));
      const category = values[categoryIdx] || '';
      const description = values[descIdx] || '';
      const author = values[authorIdx] || '';
      const date = values[dateIdx] || '';
      if (description || category) notes.push({ category, description, author, date });
    }
    return notes;
  };
}

/**
 * Script run in page to click the Notes table "next page" button (e.g. > arrow).
 * @returns {boolean} true if a next button was found and clicked, false otherwise.
 */
function clickNotesNextPageScript() {
  return function clickNotesNextPage() {
    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], [class*="pager"], [class*="pagination"] *'));
    const nextBtn = candidates.find((el) => {
      const text = (el.textContent || '').trim();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      return text === '>' || text === 'Next' || text === '»' || aria.includes('next') || (el.classList && (el.classList.contains('next') || el.classList.contains('pagination-next')));
    });
    if (nextBtn && !nextBtn.disabled) {
      nextBtn.click();
      return true;
    }
    return false;
  };
}

/**
 * Script to extract documents from the Documents tab table.
 * Columns: Category, Tags, Description, File Link, File Date, Upload Date, Share w/Rep, File Size, Created By, Last Update.
 * Returns array of { category, description, fileLink, fileDate, uploadDate, fileSize, createdBy }.
 */
function getProjectDocumentsExtractionScript() {
  return function extractProjectDocuments() {
    const trim = (s) => (s && typeof s === 'string' ? s.trim() : '') || '';
    const documents = [];
    function querySelectorAllDeep(root, selector) {
      if (!root) return [];
      const list = Array.from(root.querySelectorAll(selector));
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) list.push(...querySelectorAllDeep(el.shadowRoot, selector));
      });
      return list;
    }
    const table = querySelectorAllDeep(document, 'table').find((t) => {
      const text = (t.textContent || '').toLowerCase();
      return (text.includes('file link') || text.includes('file date')) && (text.includes('category') || text.includes('description'));
    }) || querySelectorAllDeep(document, '[role="grid"]').find((g) => (g.textContent || '').toLowerCase().includes('file link'));
    const container = table || document.body;
    const rows = container.querySelectorAll ? container.querySelectorAll('tr, [role="row"]') : [];
    const headerRow = rows[0];
    const headerTexts = headerRow ? Array.from(headerRow.querySelectorAll('th, td, [role="columnheader"], [role="gridcell"]')).map((c) => trim(c.textContent).toLowerCase()) : [];
    const col = (name) => headerTexts.findIndex((h) => h.includes(name));
    const categoryIdx = col('category') >= 0 ? col('category') : 0;
    const descIdx = col('description') >= 0 ? col('description') : 2;
    const fileLinkIdx = col('file link') >= 0 ? col('file link') : 3;
    const fileDateIdx = col('file date') >= 0 ? col('file date') : 4;
    const uploadDateIdx = col('upload date') >= 0 ? col('upload date') : 5;
    const fileSizeIdx = col('file size') >= 0 ? col('file size') : 7;
    const createdByIdx = col('created by') >= 0 ? col('created by') : 8;
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r].querySelectorAll('td, [role="gridcell"]');
      const cellEls = Array.from(cells);
      const values = cellEls.map((c) => trim(c.textContent));
      const linkEl = cellEls[fileLinkIdx] ? cellEls[fileLinkIdx].querySelector('a[href]') : null;
      const fileLink = linkEl ? (linkEl.getAttribute('href') || '').trim() : '';
      const description = values[descIdx] || (linkEl ? trim(linkEl.textContent) : '') || '';
      const category = values[categoryIdx] || '';
      const fileDate = values[fileDateIdx] || '';
      const uploadDate = values[uploadDateIdx] || '';
      const fileSize = values[fileSizeIdx] || '';
      const createdBy = values[createdByIdx] || '';
      if (fileLink || description || category) documents.push({ category, description, fileLink, fileDate, uploadDate, fileSize, createdBy });
    }
    return documents;
  };
}

class AgileScrapingService {
  constructor(edgeConnectionManager, options = {}) {
    this.edgeManager = edgeConnectionManager;
    this.workqueueUrl = options.workqueueUrl || edgeConnectionManager.workqueueUrl;
    this.onWorkqueueUpdate = options.onWorkqueueUpdate || (() => {});
    this.onNewRFA = options.onNewRFA || (() => {});
    this.onRFAChanged = options.onRFAChanged || (() => {});
    this.onECDAAlert = options.onECDAAlert || (() => {});

    this.pollIntervalId = null;
    this.lastWorkqueue = [];
    this.lastScrapedAt = null;
    this.lastError = null;
    this.isMonitoring = false;
  }

  /**
   * Find entries with ECD in the past or within the next 24 hours.
   * @param {Array} entries
   * @returns {Array}
   */
  checkECDAlerts(entries) {
    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;
    const alerted = [];
    for (const e of entries) {
      const ecdStr = (e.ecd || '').trim();
      if (!ecdStr) continue;
      let date;
      if (/^\d{4}-\d{2}-\d{2}/.test(ecdStr)) {
        date = new Date(ecdStr);
      } else if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(ecdStr)) {
        date = new Date(ecdStr);
      } else continue;
      if (isNaN(date.getTime())) continue;
      const ts = date.getTime();
      if (ts <= in24h) alerted.push(e);
    }
    return alerted;
  }

  /**
   * Compare previous and current workqueue arrays (keyed by rfaNumber).
   * @returns {{ added: Array, removed: Array, changed: Array }}
   */
  getWorkqueueDiff(previous, current) {
    const prevMap = new Map(previous.map((e) => [e.rfaNumber, e]));
    const currMap = new Map(current.map((e) => [e.rfaNumber, e]));
    const added = [];
    const removed = [];
    const changed = [];

    for (const [id, curr] of currMap) {
      if (!prevMap.has(id)) added.push(curr);
      else {
        const prev = prevMap.get(id);
        if (JSON.stringify(prev) !== JSON.stringify(curr)) changed.push({ previous: prev, current: curr });
      }
    }
    for (const id of prevMap.keys()) {
      if (!currMap.has(id)) removed.push(prevMap.get(id));
    }

    return { added, removed, changed };
  }

  /**
   * One-shot scrape of the workqueue page. Uses Edge CDP and parses DOM.
   * Waits for grid to be present, then runs extraction in each frame (iframe support).
   * @returns {Promise<{ entries: Array, scrapedAt: string, error?: string }>}
   */
  async scrapeWorkqueue() {
    this.lastError = null;
    let browser;
    let page;

    try {
      browser = this.edgeManager.getBrowser();
      if (!browser) {
        await this.edgeManager.connect();
        browser = this.edgeManager.getBrowser();
      }
      if (!browser) {
        throw new Error('Could not connect to Edge');
      }

      page = await this.edgeManager.getOrCreateWorkqueueTab(browser);

      // A. Wait for grid before extracting (SPA may render after load)
      const waitTimeoutMs = 15000;
      try {
        await page.waitForFunction(
          () => {
            const body = document.body && document.body.innerText ? document.body.innerText : '';
            if (body.includes('WQ #') || body.includes('WQs Returned') || body.includes('WQs returned')) return true;
            const sel = document.querySelector('[role="grid"], table, [class*="grid"], [class*="workqueue"]');
            return !!sel;
          },
          { timeout: waitTimeoutMs }
        );
      } catch (_) {
        // Timeout or error: still run extraction (grid might be there under different structure)
      }

      // B. Run extraction in each frame; use first result with entries
      const extract = getWorkqueueExtractionScript();
      const frames = page.frames();
      let result = { entries: [], scrapedAt: new Date().toISOString() };
      for (const frame of frames) {
        try {
          const frameResult = await frame.evaluate(extract);
          if (frameResult && Array.isArray(frameResult.entries) && frameResult.entries.length > 0) {
            result = frameResult;
            break;
          }
          if (frame === frames[0] && frameResult) result = frameResult;
        } catch (_) {
          // Frame may be inaccessible; keep trying others
        }
      }

      if (result.error) {
        this.lastError = result.error;
        return { entries: [], scrapedAt: result.scrapedAt || new Date().toISOString(), error: result.error };
      }

      const entries = (result.entries || []).map((e) => ({
        wqNumber: e.wqNumber || '',
        rfaNumber: e.rfaNumber || '',
        rfaType: e.rfaType || '',
        projectName: e.projectName || '',
        projectContainer: e.projectContainer || '',
        status: e.status || '',
        agentNumber: e.agentNumber || '',
        ecd: e.ecd || '',
        assignedTo: e.assignedTo || '',
        priority: e.priority || '',
        lastUpdated: e.lastUpdated || '',
        estHours: e.estHours || '',
        userComment: e.userComment || ''
      }));

      this.lastScrapedAt = result.scrapedAt;
      this.lastWorkqueue = entries;
      return { entries, scrapedAt: result.scrapedAt };
    } catch (err) {
      this.lastError = err.message;
      console.error('AgileScrapingService scrapeWorkqueue error:', err);
      return {
        entries: [],
        scrapedAt: new Date().toISOString(),
        error: err.message
      };
    }
  }

  /**
   * Scrape RFA project details page (Header tab). Opens a new tab, navigates to project URL,
   * extracts header fields, closes tab. Does not touch the workqueue tab.
   * @param {string} rfaNumber - e.g. "314165-0"
   * @param {{ rfaDetailUrlPattern: string }} options - URL pattern with {rfaNumber} placeholder
   * @returns {Promise<{ header?: Object, details?: Object, notes?: Array, documents?: Array, error?: string }>}
   */
  async scrapeRfaProjectPage(rfaNumber, options = {}) {
    if (!isValidRfaForUrl(rfaNumber)) {
      return { error: 'This row does not have a valid RFA number. The workqueue may have loaded with a different column layout—use a row whose RFA # (Doc) column shows a number like 314165 or 24-64950.' };
    }
    const pattern = options.rfaDetailUrlPattern || 'http://rfa.acuitybrandslighting.net/#/requestnav/{rfaNumber}';
    const url = buildProjectDetailUrl(rfaNumber, pattern);
    let browser;
    let page;

    try {
      browser = this.edgeManager.getBrowser();
      if (!browser) {
        await this.edgeManager.connect();
        browser = this.edgeManager.getBrowser();
      }
      if (!browser) throw new Error('Could not connect to Edge');

      page = await this.edgeManager.openProjectPage(browser, url);

      const waitTimeoutMs = 15000;
      try {
        await page.waitForFunction(
          () => {
            const body = document.body && document.body.innerText ? document.body.innerText : '';
            if (body.includes('Request for Assistance') || body.includes('Request for assistance')) return true;
            if (/sign\s*in|log\s*in/i.test(body)) return true;
            return false;
          },
          { timeout: waitTimeoutMs }
        );
      } catch (_) {
        await page.close().catch(() => {});
        return { error: 'Project page did not load in time. Check VPN and try again.' };
      }

      const extractHeader = getProjectHeaderExtractionScript();
      const result = await page.evaluate(extractHeader);
      if (result && result.isLoginPage) {
        await page.close().catch(() => {});
        return { error: 'Login required for RFA site. Open the RFA site in Edge first to sign in.' };
      }

      const header = (result && result.header) ? result.header : {};
      let details = {};
      let notes = [];
      let documents = [];

      const clickTab = async (tabLabel) => {
        await page.evaluate((label) => {
          const candidates = Array.from(document.querySelectorAll('[role="tab"], button, a, [class*="tab"]'));
          const tab = candidates.find((el) => el.textContent && el.textContent.trim().toLowerCase().includes(label.toLowerCase()));
          if (tab) tab.click();
        }, tabLabel);
        await new Promise((r) => setTimeout(r, 1500));
      };

      try {
        await clickTab('Details');
        details = await page.evaluate(getProjectDetailsExtractionScript()) || {};
      } catch (_) {}
      try {
        await clickTab('Notes');
        const notesExtract = getProjectNotesExtractionScript();
        const clickNext = clickNotesNextPageScript();
        const maxNotePages = 20;
        for (let p = 0; p < maxNotePages; p++) {
          const pageNotes = await page.evaluate(notesExtract) || [];
          notes.push(...pageNotes);
          const hasNext = await page.evaluate(clickNext);
          if (!hasNext) break;
          await new Promise((r) => setTimeout(r, 800));
        }
      } catch (_) {}
      try {
        await clickTab('Documents');
        documents = await page.evaluate(getProjectDocumentsExtractionScript()) || [];
      } catch (_) {}

      await page.close().catch(() => {});
      return { header, details, notes, documents };
    } catch (err) {
      if (page) page.close().catch(() => {});
      console.error('AgileScrapingService scrapeRfaProjectPage error:', err);
      return { error: err.message || 'Failed to fetch project details' };
    }
  }

  /**
   * Download a document file from the RFA site using the CDP session (SSO cookies).
   * Fetches the file as a blob in page context, returns base64, writes to savePath.
   * @param {string} docUrl - Full URL of the document (same origin as RFA site)
   * @param {string} savePath - Full filesystem path to save the file
   * @returns {Promise<{ path?: string, error?: string }>}
   */
  async downloadProjectDocument(docUrl, savePath) {
    if (!docUrl || !savePath) return { error: 'Missing url or save path' };
    let browser;
    let page;
    try {
      browser = this.edgeManager.getBrowser();
      if (!browser) {
        await this.edgeManager.connect();
        browser = this.edgeManager.getBrowser();
      }
      if (!browser) return { error: 'Could not connect to Edge' };
      const originUrl = this.workqueueUrl || 'http://rfa.acuitybrandslighting.net';
      page = await this.edgeManager.openProjectPage(browser, originUrl);
      const dataUrl = await page.evaluate(async (url) => {
        try {
          const r = await fetch(url, { credentials: 'include' });
          if (!r.ok) return null;
          const blob = await r.blob();
          return await new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result);
            fr.onerror = rej;
            fr.readAsDataURL(blob);
          });
        } catch (e) {
          return null;
        }
      }, docUrl);
      await page.close().catch(() => {});
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
        return { error: 'Failed to fetch document; check VPN and permissions.' };
      }
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
      fs.writeFileSync(savePath, Buffer.from(base64, 'base64'));
      return { path: savePath };
    } catch (err) {
      if (page) page.close().catch(() => {});
      console.error('AgileScrapingService downloadProjectDocument error:', err);
      return { error: err.message || 'Download failed' };
    }
  }

  /**
   * Run diagnostic script on an RFA project details page (new tab, navigate, dump DOM, close).
   * @param {string} rfaNumber
   * @param {{ rfaDetailUrlPattern?: string }} options
   * @returns {Promise<Object>} Same shape as diagnosePage() for the project page.
   */
  async diagnoseProjectPage(rfaNumber, options = {}) {
    if (!isValidRfaForUrl(rfaNumber)) {
      return { error: 'Enter a valid RFA number (e.g. 314165 or 24-64950).' };
    }
    const pattern = options.rfaDetailUrlPattern || 'http://rfa.acuitybrandslighting.net/#/requestnav/{rfaNumber}';
    const url = buildProjectDetailUrl(rfaNumber, pattern);
    let browser;
    let page;

    try {
      browser = this.edgeManager.getBrowser();
      if (!browser) {
        await this.edgeManager.connect();
        browser = this.edgeManager.getBrowser();
      }
      if (!browser) throw new Error('Could not connect to Edge');

      page = await this.edgeManager.openProjectPage(browser, url);
      await new Promise((r) => setTimeout(r, 3000));
      const script = getDiagnosticScript();
      const data = await page.evaluate(script);
      await page.close().catch(() => {});

      return {
        url: data?.url || url,
        tagCounts: data?.tagCounts,
        headerLike: data?.headerLike,
        ariaRoles: data?.ariaRoles,
        gridLikeClasses: data?.gridLikeClasses,
        sampleRowInfo: data?.sampleRowInfo,
        tableCount: data?.tableCount,
        rowCount: data?.rowCount,
        shadowRootCount: data?.shadowRootCount,
        shadowHostTags: data?.shadowHostTags
      };
    } catch (err) {
      if (page) page.close().catch(() => {});
      console.error('AgileScrapingService diagnoseProjectPage error:', err);
      return { error: err.message };
    }
  }

  /**
   * Run diagnostic script on the workqueue page and return DOM structure info.
   * Runs in each frame and reports iframes + shadow roots.
   * @returns {Promise<Object>} Diagnostic data (frames, tagCounts, headerLike, shadowRootCount, etc.)
   */
  async diagnosePage() {
    let browser;
    try {
      browser = this.edgeManager.getBrowser();
      if (!browser) {
        await this.edgeManager.connect();
        browser = this.edgeManager.getBrowser();
      }
      if (!browser) throw new Error('Could not connect to Edge');
      const page = await this.edgeManager.getOrCreateWorkqueueTab(browser);
      const script = getDiagnosticScript();
      const frames = page.frames();
      const frameResults = [];
      for (let i = 0; i < frames.length; i++) {
        try {
          const data = await frames[i].evaluate(script);
          frameResults.push({
            frameIndex: i,
            frameUrl: (data && data.url) || frames[i].url() || '',
            hasTable: (data && data.tableCount) > 0,
            rowCount: (data && data.rowCount) || 0,
            sampleHeaderText: (data && data.headerLike && data.headerLike[0] && data.headerLike[0].text) || null,
            shadowRootCount: (data && data.shadowRootCount) || 0,
            shadowHostTags: (data && data.shadowHostTags) || [],
            ...data
          });
        } catch (err) {
          frameResults.push({
            frameIndex: i,
            frameUrl: frames[i].url() || '',
            error: err.message
          });
        }
      }
      const main = frameResults[0] || {};
      return {
        frames: frameResults,
        frameCount: frameResults.length,
        url: main.url || main.frameUrl,
        tagCounts: main.tagCounts,
        headerLike: main.headerLike,
        ariaRoles: main.ariaRoles,
        gridLikeClasses: main.gridLikeClasses,
        sampleRowInfo: main.sampleRowInfo,
        tableCount: main.tableCount,
        rowCount: main.rowCount,
        shadowRootCount: main.shadowRootCount,
        shadowHostTags: main.shadowHostTags
      };
    } catch (err) {
      console.error('AgileScrapingService diagnosePage error:', err);
      return { error: err.message };
    }
  }

  /**
   * Start periodic workqueue polling. Calls onWorkqueueUpdate with new list and onNewRFA for each new RFA.
   * @param {number} [intervalMs]
   */
  startMonitoring(intervalMs = DEFAULT_POLL_INTERVAL_MS) {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    const tick = async () => {
      const previous = this.lastWorkqueue;
      const result = await this.scrapeWorkqueue();
      if (result.error) {
        this.onWorkqueueUpdate({ entries: this.lastWorkqueue, scrapedAt: result.scrapedAt, error: result.error });
        return;
      }
      const current = result.entries;
      const diff = this.getWorkqueueDiff(previous, current);
      this.onWorkqueueUpdate({ entries: current, scrapedAt: result.scrapedAt });
      diff.added.forEach((rfa) => this.onNewRFA(rfa));
      diff.changed.forEach(({ current: rfa }) => this.onRFAChanged(rfa));
      this.checkECDAlerts(current).forEach((rfa) => this.onECDAAlert(rfa));
    };

    this.isMonitoring = true;
    this.pollIntervalId = setInterval(tick, intervalMs);
    tick();
  }

  /**
   * Stop monitoring.
   */
  stopMonitoring() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Get cached workqueue and status.
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      lastScrapedAt: this.lastScrapedAt,
      lastError: this.lastError,
      entryCount: this.lastWorkqueue.length
    };
  }

  /**
   * Get cached workqueue entries.
   */
  getWorkqueue() {
    return this.lastWorkqueue;
  }
}

module.exports = AgileScrapingService;
