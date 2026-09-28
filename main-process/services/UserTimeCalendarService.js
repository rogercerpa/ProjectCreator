const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const BUILTIN = new Set(['meeting', 'initiative', 'agency', 'pto', 'training', 'email']);

class UserTimeCalendarService {
  constructor() {
    this.filePath = path.join(os.homedir(), '.project-creator', 'time-calendar.json');
  }

  async load() {
    try {
      if (!(await fs.pathExists(this.filePath))) {
        return { success: true, entries: [] };
      }
      const data = await fs.readJson(this.filePath);
      const entries = Array.isArray(data?.entries) ? data.entries : [];
      const customCategories = Array.isArray(data?.customCategories) ? data.customCategories : [];
      return { success: true, entries, customCategories };
    } catch (error) {
      return { success: false, error: error.message, entries: [], customCategories: [] };
    }
  }

  async saveAll(entries, customCategories) {
    await fs.ensureDir(path.dirname(this.filePath));
    const current = await this.load();
    await fs.writeJson(this.filePath, {
      entries,
      customCategories: customCategories || current.customCategories || []
    }, { spaces: 2 });
  }

  categoryAllowed(category, customCategories, existing) {
    if (BUILTIN.has(category)) return true;
    if ((customCategories || []).some((item) => item.id === category)) return true;
    return Boolean(existing && existing.category === category);
  }

  async saveCategories(customCategories = []) {
    const cleaned = [];
    const seen = new Set();
    customCategories.forEach((item) => {
      const label = String(item?.label || '').trim();
      if (!label) return;
      const id = String(item?.id || '').trim() || `custom-${Date.now()}-${cleaned.length}`;
      if (BUILTIN.has(id) || seen.has(id)) return;
      seen.add(id);
      cleaned.push({ id, label });
    });
    const current = await this.load();
    await this.saveAll(current.entries || [], cleaned);
    return { success: true, customCategories: cleaned, entries: current.entries || [] };
  }

  async upsert(entry) {
    const loaded = await this.load();
    const entries = loaded.entries || [];
    const existing = entries.find((item) => item.id === entry?.id);
    if (!entry?.date || !this.categoryAllowed(entry.category, loaded.customCategories, existing)) {
      return { success: false, error: 'A date and category are required.' };
    }
    const hours = Number(entry.hours);
    if (!Number.isFinite(hours) || hours <= 0) {
      return { success: false, error: 'Hours must be greater than 0.' };
    }

    const now = new Date().toISOString();
    const id = entry.id || `time-${Date.now()}`;
    const next = {
      id,
      date: entry.date,
      category: entry.category,
      hours,
      title: String(entry.title || '').trim(),
      notes: String(entry.notes || '').trim(),
      createdAt: entry.createdAt || now,
      updatedAt: now
    };
    const index = entries.findIndex((item) => item.id === id);
    if (index >= 0) {
      next.createdAt = entries[index].createdAt || next.createdAt;
      entries[index] = next;
    } else {
      entries.push(next);
    }
    await this.saveAll(entries, loaded.customCategories);
    return { success: true, entry: next, entries, customCategories: loaded.customCategories || [] };
  }

  async remove(entryId) {
    const loaded = await this.load();
    const entries = (loaded.entries || []).filter((item) => item.id !== entryId);
    await this.saveAll(entries, loaded.customCategories);
    return { success: true, entries, customCategories: loaded.customCategories || [] };
  }
}

module.exports = UserTimeCalendarService;
