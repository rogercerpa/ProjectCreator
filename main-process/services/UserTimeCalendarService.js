const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const CATEGORIES = new Set(['meeting', 'initiative', 'agency', 'pto', 'training']);

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
      return { success: true, entries };
    } catch (error) {
      return { success: false, error: error.message, entries: [] };
    }
  }

  async saveAll(entries) {
    await fs.ensureDir(path.dirname(this.filePath));
    await fs.writeJson(this.filePath, { entries }, { spaces: 2 });
  }

  async upsert(entry) {
    if (!entry?.date || !CATEGORIES.has(entry.category)) {
      return { success: false, error: 'A date and category are required.' };
    }
    const hours = Number(entry.hours);
    if (!Number.isFinite(hours) || hours <= 0) {
      return { success: false, error: 'Hours must be greater than 0.' };
    }

    const loaded = await this.load();
    const entries = loaded.entries || [];
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
    await this.saveAll(entries);
    return { success: true, entry: next, entries };
  }

  async remove(entryId) {
    const loaded = await this.load();
    const entries = (loaded.entries || []).filter((item) => item.id !== entryId);
    await this.saveAll(entries);
    return { success: true, entries };
  }
}

module.exports = UserTimeCalendarService;
