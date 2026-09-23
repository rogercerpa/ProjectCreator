/**
 * DAS General team members are the source of truth for Assigned To.
 * Role is stored in the existing Team Members Role column.
 */

export const ROLE_CATEGORIES = ['AE', 'SAE', 'Lead', 'Manager', 'L&T AE'];

export function canonicalRole(role) {
  const value = String(role || '').trim();
  return ROLE_CATEGORIES.find((category) => category.toLowerCase() === value.toLowerCase()) || '';
}

export function roleLabel(role) {
  const category = canonicalRole(role);
  if (category) return category;
  const original = String(role || '').trim();
  return original ? `Uncategorized (${original})` : 'Uncategorized';
}

export function orderedTeamMembers(teamMembers = []) {
  const order = Object.fromEntries(ROLE_CATEGORIES.map((category, index) => [category, index]));
  return [...teamMembers]
    .filter((member) => String(member?.name || '').trim())
    .sort((left, right) => {
      const leftOrder = order[canonicalRole(left.role)] ?? 99;
      const rightOrder = order[canonicalRole(right.role)] ?? 99;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return String(left.name).localeCompare(String(right.name));
    });
}

export function orderedAssigneeNames(teamMembers = []) {
  return orderedTeamMembers(teamMembers).map((member) => String(member.name).trim());
}

export function namesMissingFromDirectory(assignedNames = [], teamMembers = []) {
  const directory = new Set(
    teamMembers
      .map((member) => String(member?.name || '').trim().toLowerCase())
      .filter(Boolean)
  );
  return assignedNames.filter((name) => {
    const trimmed = String(name || '').trim();
    return trimmed && !directory.has(trimmed.toLowerCase());
  });
}

export async function syncAssignedToFromTeam(teamMembers = []) {
  const names = orderedAssigneeNames(teamMembers);
  if (!names.length || !window.electronAPI?.settingsLoad || !window.electronAPI?.settingsSave) {
    return { success: false, skipped: true };
  }

  const saved = await window.electronAPI.settingsLoad();
  if (!saved?.success || !saved.data) {
    return { success: false, error: 'Settings could not be loaded' };
  }

  const nextSettings = { ...saved.data, assignedToOptions: names };
  const result = await window.electronAPI.settingsSave(nextSettings);
  if (result?.success !== false) {
    window.dispatchEvent(new CustomEvent('assigned-to-options-updated', { detail: { names } }));
    const dropdownModule = await import('./DropdownOptionsService');
    const dropdownOptionsService = dropdownModule.default;
    if (dropdownOptionsService?.loadFromSettings) {
      await dropdownOptionsService.loadFromSettings();
    }
  }
  return { success: result?.success !== false, names };
}
