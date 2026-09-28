const { nextSampleIdentity } = require('../../src/services/SampleProjectService');

describe('sample project identity', () => {
  const today = new Date(2026, 8, 28);

  test('starts at sample 1 with a real RFA and container format', () => {
    const identity = nextSampleIdentity([], today);
    expect(identity.projectName).toBe('Sample Project 1');
    expect(identity.rfaNumber).toBe('900001-0');
    expect(identity.projectContainer).toBe('26-00001');
    expect(identity.rfaNumber).toMatch(/^\d+-\d+$/);
    expect(identity.projectContainer).toMatch(/^\d{2}-\d{5}$/);
    expect(identity.requestedDate).toBe('2026-09-30');
    expect(identity.ecd >= identity.requestedDate).toBe(true);
    expect(identity.ecd).toBe('2026-09-30');
  });

  test('numbers the next sample from ones already in the app', () => {
    const identity = nextSampleIdentity([
      { sampleProject: true, projectName: 'Sample Project 1', rfaNumber: '900001-0', projectContainer: '26-00001' },
      { sampleProject: true, projectName: 'Sample Project 4', rfaNumber: '900004-0', projectContainer: '26-00004' },
      { projectName: 'Real job', rfaNumber: '284443-0', projectContainer: '26-16071' }
    ], today);
    expect(identity.projectName).toBe('Sample Project 5');
    expect(identity.rfaNumber).toBe('900005-0');
    expect(identity.projectContainer).toBe('26-00005');
  });

  test('steps past an RFA and container pair that is already used', () => {
    const identity = nextSampleIdentity([
      { rfaNumber: '900001-0', projectContainer: '26-00001', projectName: 'Taken' }
    ], today);
    expect(identity.projectName).toBe('Sample Project 2');
    expect(identity.rfaNumber).toBe('900002-0');
    expect(identity.projectContainer).toBe('26-00002');
  });
});
