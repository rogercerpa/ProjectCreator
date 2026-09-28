import { canonicalRole, expertiseFromKnowledge } from './TeamRosterService';

export function upsertMachineUser(rows = [], next) {
  const machine = String(next?.machineName || '').trim().toLowerCase();
  const kept = rows.filter((row) => String(row?.machineName || '').trim().toLowerCase() !== machine);
  return [...kept, next];
}

export function appendActivity(rows = [], entry, limit = 200) {
  return [...rows, entry].slice(-limit);
}

export function findMemberForClaim(teamMembers = [], claim) {
  if (!claim) return null;
  const email = String(claim.email || '').trim().toLowerCase();
  const name = String(claim.memberName || '').trim().toLowerCase();
  if (email) {
    const byEmail = teamMembers.find((member) => String(member?.email || '').trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  if (!name) return null;
  return teamMembers.find((member) => String(member?.name || '').trim().toLowerCase() === name) || null;
}

export function profileFromMember(member) {
  return {
    userName: member?.name || '',
    userEmail: member?.email || '',
    position: canonicalRole(member?.role) || member?.role || ''
  };
}

export function otherMachinesForMember(machineUsers = [], memberName, hostname) {
  const name = String(memberName || '').trim().toLowerCase();
  const machine = String(hostname || '').trim().toLowerCase();
  return machineUsers.filter((row) => (
    String(row?.memberName || '').trim().toLowerCase() === name
    && String(row?.machineName || '').trim().toLowerCase() !== machine
  ));
}

async function saveLocalProfile(member) {
  const profile = profileFromMember(member);
  const settings = await window.electronAPI.settingsLoad();
  if (!settings?.success || !settings.data) {
    return { success: false, error: 'Settings could not be loaded' };
  }
  const next = {
    ...settings.data,
    workloadSettings: {
      ...(settings.data.workloadSettings || {}),
      ...profile,
      claimedMemberEmail: member.email || '',
      claimedMemberName: member.name || ''
    }
  };
  const saved = await window.electronAPI.settingsSave(next);
  if (saved?.success !== false) {
    window.dispatchEvent(new CustomEvent('machine-claim-updated', { detail: profile }));
  }
  return { success: saved?.success !== false, profile };
}

export async function claimTeamMember(member) {
  const identity = await window.electronAPI.machineGetIdentity();
  const settingsResult = await window.electronAPI.dasGeneralGetSettings();
  const filePath = settingsResult?.settings?.filePath;
  const loaded = await window.electronAPI.dasGeneralLoadAll(filePath);
  if (!loaded?.success) {
    return { success: false, error: loaded?.message || 'The team directory could not be opened.' };
  }

  const machineUsers = upsertMachineUser(loaded.data?.machineUsers || [], {
    memberName: member.name,
    email: member.email || '',
    machineName: identity.hostname,
    windowsUser: identity.windowsUser,
    lastSeen: new Date().toISOString()
  });

  const saved = await window.electronAPI.dasGeneralSaveAll({
    teamMembers: loaded.data.teamMembers || [],
    trainingMaterial: loaded.data.trainingMaterial || [],
    productsInfo: loaded.data.productsInfo || [],
    products: loaded.data.products || [],
    machineUsers,
    activityAction: 'Claimed this PC',
    activityMember: member.name
  }, filePath);

  if (!saved?.success) {
    return { success: false, error: saved?.message || saved?.error || 'Could not save this PC claim.' };
  }

  const local = await saveLocalProfile(member);
  return {
    success: local.success,
    profile: local.profile,
    machineUsers,
    hostname: identity.hostname,
    error: local.error
  };
}

export async function publishClaimedExpertise(settings) {
  const workload = settings?.workloadSettings || {};
  const claim = {
    email: workload.claimedMemberEmail,
    memberName: workload.claimedMemberName || workload.userName
  };
  if (!claim.email && !claim.memberName) return { success: true, skipped: true };

  const settingsResult = await window.electronAPI.dasGeneralGetSettings();
  const filePath = settingsResult?.settings?.filePath;
  const loaded = await window.electronAPI.dasGeneralLoadAll(filePath);
  if (!loaded?.success) {
    return { success: false, error: loaded?.message || 'The team directory could not be opened.' };
  }
  const member = findMemberForClaim(loaded.data?.teamMembers || [], claim);
  if (!member) return { success: false, error: 'The claimed team member was not found.' };

  const expertise = expertiseFromKnowledge(workload.productKnowledge);
  const teamMembers = (loaded.data.teamMembers || []).map((row) => (
    row.id === member.id ? { ...row, expertise } : row
  ));
  const saved = await window.electronAPI.dasGeneralSaveAll({
    teamMembers,
    trainingMaterial: loaded.data.trainingMaterial || [],
    productsInfo: loaded.data.productsInfo || [],
    products: loaded.data.products || [],
    machineUsers: loaded.data.machineUsers || [],
    activityAction: 'Updated product expertise',
    activityMember: member.name
  }, filePath);
  if (!saved?.success) {
    return { success: false, error: saved?.message || saved?.error || 'Could not publish product expertise.' };
  }
  return { success: true, expertise };
}

export async function refreshClaimedProfile(teamMembers = []) {
  const settings = await window.electronAPI.settingsLoad();
  if (!settings?.success || !settings.data) return { updated: false };
  const workload = settings.data.workloadSettings || {};
  const member = findMemberForClaim(teamMembers, {
    email: workload.claimedMemberEmail,
    memberName: workload.claimedMemberName || workload.userName
  });
  if (!member) return { updated: false };
  const profile = profileFromMember(member);
  const unchanged = profile.userName === (workload.userName || '')
    && profile.userEmail === (workload.userEmail || '')
    && profile.position === (workload.position || '');
  if (unchanged) return { updated: false, profile };
  const saved = await saveLocalProfile(member);
  return { updated: saved.success, profile: saved.profile };
}
