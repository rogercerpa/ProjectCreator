const {
  compareSchedule,
  formatScheduleResult,
  buildProductivityReport,
  productivityBand,
  isHoursRecorded,
  resolvePhaseCreditDate,
  weekdayCount
} = require('../../src/services/ProductivityMetricsService');

const {
  orderedAssigneeNames,
  namesMissingFromDirectory,
  canonicalRole,
  roleLabel
} = require('../../src/services/TeamRosterService');

describe('schedule comparison', () => {
  test('marks on-time, early, and late in calendar days', () => {
    expect(compareSchedule('2026-09-10T18:00:00', '2026-09-10T08:00:00')).toMatchObject({ status: 'met', daysDelta: 0 });
    expect(compareSchedule('2026-09-08', '2026-09-10')).toMatchObject({ status: 'met', daysDelta: -2 });
    expect(compareSchedule('2026-09-12', '2026-09-10')).toMatchObject({ status: 'not-met', daysDelta: 2 });
    expect(formatScheduleResult(compareSchedule('2026-09-08', '2026-09-10'))).toBe('Met (2 days early)');
    expect(formatScheduleResult(compareSchedule('2026-09-12', '2026-09-10'))).toBe('Not met (2 days late)');
  });

  test('leaves a missing date as not recorded', () => {
    expect(compareSchedule('', '2026-09-10').status).toBe('not-recorded');
    expect(compareSchedule('2026-09-10', '').status).toBe('not-recorded');
    expect(formatScheduleResult(compareSchedule('', '2026-09-10'))).toBe('Not recorded');
  });
});

describe('productivity score', () => {
  const startDate = new Date(2026, 8, 7);
  const endDate = new Date(2026, 8, 11);

  test('counts weekdays in the range', () => {
    expect(weekdayCount(startDate, endDate)).toBe(5);
  });

  test('treats blank hours as missing and zero as recorded', () => {
    expect(isHoursRecorded('')).toBe(false);
    expect(isHoursRecorded(null)).toBe(false);
    expect(isHoursRecorded(0)).toBe(true);
  });

  test('uses fallback credit dates', () => {
    expect(resolvePhaseCreditDate({ submittedDate: '2026-09-07' }, 'triage')).toBe('2026-09-07');
    expect(resolvePhaseCreditDate({ triageHoursDate: '2026-09-08', submittedDate: '2026-09-07' }, 'triage')).toBe('2026-09-08');
    expect(resolvePhaseCreditDate({
      statusHistory: [{ status: 'Ready for QC', timestamp: '2026-09-09' }]
    }, 'qc')).toBe('2026-09-09');
  });

  function reportFor(productiveHours, extra = {}) {
    return buildProductivityReport({
      userName: 'Cerpa, Roger',
      startDate,
      endDate,
      weeklyCapacity: 40,
      projects: [{
        id: 'p1',
        projectName: 'Lobby',
        designBy: 'cerpa, roger',
        actualDesignHours: productiveHours,
        designHoursDate: '2026-09-08',
        completedAt: '2026-09-10',
        requestedDate: '2026-09-12',
        ecd: '2026-09-09',
        ...extra.project
      }],
      entries: extra.entries || []
    });
  }

  test('scores productive hours against capacity minus PTO', () => {
    const meets = reportFor(28, { entries: [{ date: '2026-09-07', category: 'pto', hours: 8 }] });
    expect(meets.grossHours).toBe(40);
    expect(meets.available).toBe(32);
    expect(meets.productive).toBe(28);
    expect(meets.score).toBeCloseTo(87.5);
    expect(meets.band).toBe('meets');
    expect(productivityBand(79.9)).toBe('needs-validation');
    expect(productivityBand(80)).toBe('meets');
    expect(productivityBand(95)).toBe('meets');
    expect(productivityBand(95.1)).toBe('exceeds');
  });

  test('does not count blank historical hours or another person\'s hours', () => {
    const report = buildProductivityReport({
      userName: 'Cerpa, Roger',
      startDate,
      endDate,
      weeklyCapacity: 40,
      projects: [
        {
          id: 'blank',
          projectName: 'Old job',
          designBy: 'Cerpa, Roger',
          actualDesignHours: '',
          completedAt: '2026-09-10'
        },
        {
          id: 'other',
          projectName: 'Someone else',
          designBy: 'Jane Smith',
          actualDesignHours: 20,
          designHoursDate: '2026-09-08',
          completedAt: '2026-09-10'
        }
      ],
      entries: []
    });
    expect(report.productive).toBe(0);
    expect(report.missing).toEqual([
      expect.objectContaining({ projectName: 'Old job', phase: 'design' })
    ]);
    expect(report.score).toBe(0);
    expect(report.band).toBe('needs-validation');
  });

  test('explains the gap with meetings and leaves PTO out of the score denominator', () => {
    const report = reportFor(16, {
      entries: [
        { date: '2026-09-07', category: 'pto', hours: 8 },
        { date: '2026-09-08', category: 'meeting', hours: 8 }
      ]
    });
    expect(report.available).toBe(32);
    expect(report.meetingsWorked).toBe(8);
    expect(report.score).toBeCloseTo(75);
    expect(report.unaccounted).toBe(8);
    expect(report.rdHitRate).toBe(100);
    expect(report.ecdHitRate).toBe(0);
    expect(report.schedule[0].ecdReasonMissing).toBe(true);
  });

  test('counts agency calls with meetings and adds every logged slice toward 100%', () => {
    const report = reportFor(16, {
      entries: [
        { date: '2026-09-08', category: 'meeting', hours: 4 },
        { date: '2026-09-08', category: 'agency', hours: 4 },
        { date: '2026-09-09', category: 'initiative', hours: 4 },
        { date: '2026-09-10', category: 'training', hours: 4 }
      ]
    });
    expect(report.meetingsWorked).toBe(8);
    expect(report.accounted).toBe(32);
    expect(report.projectShare).toBeCloseTo(40);
    expect(report.meetingsShare).toBeCloseTo(20);
    expect(report.score).toBeCloseTo(80);
    expect(report.unaccounted).toBe(8);
    expect(report.band).toBe('meets');
  });

  test('counts email responses and extra categories as logged work', () => {
    const report = reportFor(8, {
      entries: [
        { date: '2026-09-08', category: 'email', hours: 4 },
        { date: '2026-09-09', category: 'custom-site-visits', hours: 4 }
      ]
    });
    expect(report.email).toBe(4);
    expect(report.other).toBe(4);
    expect(report.accounted).toBe(16);
    expect(report.detail.email).toEqual([
      expect.objectContaining({ label: 'Email responses', hours: 4, date: '2026-09-08' })
    ]);
    expect(report.detail.other).toEqual([
      expect.objectContaining({ category: 'custom-site-visits', hours: 4 })
    ]);
  });

  test('lists the project hours and meeting tasks behind the totals', () => {
    const report = buildProductivityReport({
      userName: 'Cerpa, Roger',
      startDate,
      endDate,
      weeklyCapacity: 40,
      projects: [{
        id: 'p1',
        projectName: 'Lobby',
        rfaNumber: '284443-0',
        triagedBy: 'Cerpa, Roger',
        designBy: 'Cerpa, Roger',
        actualTriageHours: 2,
        triageHoursDate: '2026-09-08',
        actualDesignHours: 6,
        designHoursDate: '2026-09-09'
      }],
      entries: [
        { id: 'm1', date: '2026-09-08', category: 'meeting', hours: 1, notes: 'Standup' },
        { id: 'a1', date: '2026-09-09', category: 'agency', hours: 2, notes: 'Rep call' },
        { date: '2026-09-01', category: 'meeting', hours: 5 }
      ]
    });
    expect(report.productive).toBe(8);
    expect(report.detail.projectHours).toEqual([
      expect.objectContaining({
        projectId: 'p1',
        rfaNumber: '284443-0',
        triage: 2,
        design: 6,
        qc: null,
        total: 8
      })
    ]);
    expect(report.meetingsWorked).toBe(3);
    expect(report.detail.meetings.map((item) => item.id)).toEqual(['m1', 'a1']);
  });

  test('leaves sample projects out of hours, missing work, and the schedule', () => {
    const report = buildProductivityReport({
      userName: 'Cerpa, Roger',
      startDate,
      endDate,
      weeklyCapacity: 40,
      projects: [{
        id: 'sample',
        projectName: 'Test layout',
        sampleProject: true,
        designBy: 'Cerpa, Roger',
        actualDesignHours: 20,
        designHoursDate: '2026-09-08',
        completedAt: '2026-09-10'
      }],
      entries: []
    });
    expect(report.productive).toBe(0);
    expect(report.missing).toEqual([]);
    expect(report.schedule).toEqual([]);
    expect(report.samples).toEqual([
      expect.objectContaining({ projectName: 'Test layout' })
    ]);
  });
});

describe('team roster', () => {
  test('orders names by category and flags people missing from the directory', () => {
    const members = [
      { name: 'Pat Lead', role: 'Lead' },
      { name: 'Ann AE', role: 'ae' },
      { name: 'Sam SAE', role: 'SAE' }
    ];
    expect(orderedAssigneeNames(members)).toEqual(['Ann AE', 'Sam SAE', 'Pat Lead']);
    expect(canonicalRole('l&t ae')).toBe('L&T AE');
    expect(roleLabel('Application Engineer')).toBe('Uncategorized (Application Engineer)');
    expect(namesMissingFromDirectory(['Ann AE', 'Old Name'], members)).toEqual(['Old Name']);
    const { expertiseFromKnowledge, parseExpertise } = require('../../src/services/TeamRosterService');
    expect(expertiseFromKnowledge({ Fresco: 5, nLight: 3, 'nLight Air': 4 })).toBe('Fresco:5; nLight Air:4');
    expect(parseExpertise('Fresco:5; nLight:3')).toEqual([{ product: 'Fresco', level: 5 }]);
  });
});
