/**
 * Personal productivity and schedule math.
 * Productive hours are actual triage, design, and QC only.
 * Available hours are weekday capacity minus PTO.
 */

export const TIME_CATEGORIES = [
  { id: 'meeting', label: 'Work meeting' },
  { id: 'initiative', label: 'Initiative' },
  { id: 'agency', label: 'Agency call/meeting' },
  { id: 'pto', label: 'PTO/vacation' },
  { id: 'training', label: 'Training' }
];

export const BAND_LABELS = {
  'needs-validation': 'Needs validation',
  meets: 'Meets expectations',
  exceeds: 'Exceeds expectations',
  unavailable: 'Not enough data'
};

const PHASES = [
  { id: 'triage', roleField: 'triagedBy', hoursField: 'actualTriageHours', label: 'Triage' },
  { id: 'design', roleField: 'designBy', hoursField: 'actualDesignHours', label: 'Design' },
  { id: 'qc', roleField: 'qcBy', hoursField: 'actualQcHours', label: 'QC' }
];

export function namesMatch(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

export function startOfDay(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dateInRange(value, startDate, endDate) {
  const day = startOfDay(value);
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (!day || !start || !end) return false;
  return day >= start && day <= end;
}

export function weekdayCount(startDate, endDate) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (!start || !end || end < start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function isHoursRecorded(value) {
  if (value === '' || value === null || value === undefined) return false;
  const hours = Number(value);
  return Number.isFinite(hours) && hours >= 0;
}

export function compareSchedule(completedAt, targetDate) {
  const completed = startOfDay(completedAt);
  const target = startOfDay(targetDate);
  if (!completed || !target) {
    return { status: 'not-recorded', daysDelta: null, met: null };
  }
  const daysDelta = Math.round((completed.getTime() - target.getTime()) / 86400000);
  const met = daysDelta <= 0;
  return { status: met ? 'met' : 'not-met', daysDelta, met };
}

export function formatScheduleResult(result) {
  if (!result || result.status === 'not-recorded') return 'Not recorded';
  if (result.daysDelta === 0) return 'Met (on time)';
  const days = Math.abs(result.daysDelta);
  const unit = days === 1 ? 'day' : 'days';
  if (result.met) return `Met (${days} ${unit} early)`;
  return `Not met (${days} ${unit} late)`;
}

export function readyForQcTimestamp(project) {
  const history = Array.isArray(project?.statusHistory) ? project.statusHistory : [];
  const entry = [...history].reverse().find((item) => item?.status === 'Ready for QC' && item.timestamp);
  return entry?.timestamp || null;
}

export function resolvePhaseCreditDate(project, phase) {
  if (!project) return null;
  if (phase === 'triage') {
    return project.triageHoursDate || project.submittedDate || project.createdAt || null;
  }
  if (phase === 'design') {
    return project.designHoursDate || project.completedAt || project.engineerExpectedCompleteDate || null;
  }
  if (phase === 'qc') {
    return project.qcHoursDate || project.completedAt || readyForQcTimestamp(project) || null;
  }
  return null;
}

export function productivityBand(scorePercent) {
  if (scorePercent == null || Number.isNaN(scorePercent)) return 'unavailable';
  if (scorePercent < 80) return 'needs-validation';
  if (scorePercent <= 95) return 'meets';
  return 'exceeds';
}

function projectLabel(project) {
  return project?.projectName || project?.rfaNumber || 'Project';
}

export function collectPhaseChips(projects, userName) {
  const chips = [];
  (projects || []).forEach((project) => {
    PHASES.forEach((phase) => {
      if (!namesMatch(project?.[phase.roleField], userName)) return;
      if (!isHoursRecorded(project?.[phase.hoursField])) return;
      const date = resolvePhaseCreditDate(project, phase.id);
      if (!date) return;
      chips.push({
        projectId: project.id,
        projectName: projectLabel(project),
        rfaNumber: project.rfaNumber || '',
        phase: phase.id,
        phaseLabel: phase.label,
        hours: Number(project[phase.hoursField]),
        date
      });
    });
  });
  return chips;
}

export function buildProductivityReport({
  projects = [],
  entries = [],
  userName = '',
  startDate,
  endDate,
  weeklyCapacity = 40
}) {
  const capacity = Number(weeklyCapacity) > 0 ? Number(weeklyCapacity) : 40;
  const weekdays = weekdayCount(startDate, endDate);
  const dailyCapacity = capacity / 5;
  const grossHours = weekdays * dailyCapacity;

  const categoryHours = { meeting: 0, initiative: 0, agency: 0, pto: 0, training: 0 };
  (entries || []).forEach((entry) => {
    if (!dateInRange(entry?.date, startDate, endDate)) return;
    const hours = Number(entry?.hours);
    if (!Number.isFinite(hours) || hours <= 0) return;
    if (Object.prototype.hasOwnProperty.call(categoryHours, entry.category)) {
      categoryHours[entry.category] += hours;
    }
  });

  const available = Math.max(0, grossHours - categoryHours.pto);
  let triage = 0;
  let design = 0;
  let qc = 0;
  const missing = [];
  const schedule = [];

  (projects || []).forEach((project) => {
    PHASES.forEach((phase) => {
      if (!userName || !namesMatch(project?.[phase.roleField], userName)) return;
      const creditDate = resolvePhaseCreditDate(project, phase.id);
      const recorded = isHoursRecorded(project?.[phase.hoursField]);
      const creditInRange = dateInRange(creditDate, startDate, endDate);
      const completedInRange = dateInRange(project?.completedAt, startDate, endDate);

      if (recorded && creditInRange) {
        const hours = Number(project[phase.hoursField]);
        if (phase.id === 'triage') triage += hours;
        if (phase.id === 'design') design += hours;
        if (phase.id === 'qc') qc += hours;
      } else if (!recorded && (creditInRange || completedInRange)) {
        missing.push({
          projectId: project.id,
          projectName: projectLabel(project),
          rfaNumber: project.rfaNumber || '',
          phase: phase.id,
          phaseLabel: phase.label
        });
      }
    });

    if (userName && namesMatch(project?.designBy, userName) && dateInRange(project?.completedAt, startDate, endDate)) {
      const rd = compareSchedule(project.completedAt, project.requestedDate);
      const ecd = compareSchedule(project.completedAt, project.ecd);
      schedule.push({
        projectId: project.id,
        projectName: projectLabel(project),
        rfaNumber: project.rfaNumber || '',
        rd,
        ecd,
        rdMissReason: project.rdMissReason || '',
        ecdMissReason: project.ecdMissReason || '',
        rdReasonMissing: rd.status === 'not-met' && !String(project.rdMissReason || '').trim(),
        ecdReasonMissing: ecd.status === 'not-met' && !String(project.ecdMissReason || '').trim()
      });
    }
  });

  const productive = triage + design + qc;
  const explanatory = categoryHours.meeting + categoryHours.initiative + categoryHours.agency + categoryHours.training;
  const unaccounted = Math.max(0, available - productive - explanatory);
  const score = available > 0 ? (productive / available) * 100 : null;
  const band = available > 0 ? productivityBand(score) : 'unavailable';

  const rdScored = schedule.filter((item) => item.rd.status !== 'not-recorded');
  const ecdScored = schedule.filter((item) => item.ecd.status !== 'not-recorded');
  const rdHitRate = rdScored.length ? (rdScored.filter((item) => item.rd.met).length / rdScored.length) * 100 : null;
  const ecdHitRate = ecdScored.length ? (ecdScored.filter((item) => item.ecd.met).length / ecdScored.length) * 100 : null;

  return {
    userName,
    weekdays,
    dailyCapacity,
    grossHours,
    pto: categoryHours.pto,
    available,
    triage,
    design,
    qc,
    productive,
    meetings: categoryHours.meeting,
    initiative: categoryHours.initiative,
    agency: categoryHours.agency,
    training: categoryHours.training,
    explanatory,
    unaccounted,
    score,
    band,
    bandLabel: BAND_LABELS[band],
    missing,
    schedule,
    rdHitRate,
    ecdHitRate
  };
}
