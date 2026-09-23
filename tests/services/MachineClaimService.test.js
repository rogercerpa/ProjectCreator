const {
  upsertMachineUser,
  appendActivity,
  findMemberForClaim,
  profileFromMember,
  otherMachinesForMember
} = require('../../src/services/MachineClaimService');

describe('machine claim', () => {
  test('replaces the row for this computer and keeps the same person on another computer', () => {
    const rows = upsertMachineUser([
      { memberName: 'Ann AE', machineName: 'PC-1', email: 'ann@example.com' },
      { memberName: 'Sam SAE', machineName: 'PC-2', email: 'sam@example.com' }
    ], { memberName: 'Pat Lead', machineName: 'PC-1', email: 'pat@example.com' });

    expect(rows).toEqual([
      { memberName: 'Sam SAE', machineName: 'PC-2', email: 'sam@example.com' },
      { memberName: 'Pat Lead', machineName: 'PC-1', email: 'pat@example.com' }
    ]);
  });

  test('keeps only the latest activity rows', () => {
    const existing = Array.from({ length: 200 }, (_, index) => ({ action: `row-${index}` }));
    const next = appendActivity(existing, { action: 'Claimed this PC' }, 200);
    expect(next).toHaveLength(200);
    expect(next[0].action).toBe('row-1');
    expect(next[199].action).toBe('Claimed this PC');
  });

  test('matches a claimed member by email after a name change', () => {
    const members = [{ name: 'Ann Updated', email: 'ann@example.com', role: 'AE' }];
    const member = findMemberForClaim(members, { email: 'ann@example.com', memberName: 'Ann AE' });
    expect(profileFromMember(member)).toEqual({
      userName: 'Ann Updated',
      userEmail: 'ann@example.com',
      position: 'AE'
    });
  });

  test('lists other computers for the same person', () => {
    const others = otherMachinesForMember([
      { memberName: 'Ann AE', machineName: 'PC-1' },
      { memberName: 'Ann AE', machineName: 'LAPTOP' }
    ], 'Ann AE', 'PC-1');
    expect(others.map((row) => row.machineName)).toEqual(['LAPTOP']);
  });
});
