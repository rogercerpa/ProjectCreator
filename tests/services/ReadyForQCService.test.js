const ReadyForQCService = require('../../main-process/services/ReadyForQCService');

describe('ReadyForQCService zip matching', () => {
  let service;
  const project = {
    id: 'proj_nh_tower',
    projectName: 'NH Tower 5 11th FL Elevator Lobby & Corridor',
    projectContainer: '26-71167',
    rfaNumber: '329711-0',
    rfaStatus: 'In Progress'
  };

  beforeEach(() => {
    service = new ReadyForQCService();
  });

  test('treats underscores and & as equivalent in zip names', () => {
    expect(service.normalizeMatchText('NH_Tower_5_11th_FL_Elevator_Lobby_&_Corridor'))
      .toBe(service.normalizeMatchText('NH TOWER 5 11TH FL ELEVATOR LOBBY & CORRIDOR'));
  });

  test('accepts the canonical app zip filename', () => {
    const zipFile = {
      name: 'NH TOWER 5 11TH FL ELEVATOR LOBBY & CORRIDOR_26-71167.zip',
      nameWithoutExtension: 'NH TOWER 5 11TH FL ELEVATOR LOBBY & CORRIDOR_26-71167'
    };

    expect(service.zipFilenameLooksLikeProject(zipFile, project)).toBe(true);
  });

  test('accepts engineer-renamed zip that uses underscores, RFA number, and a date', () => {
    const zipFile = {
      name: 'NH_Tower_5_11th_FL_Elevator_Lobby_&_Corridor_329711-0_2026-09-03.zip',
      nameWithoutExtension: 'NH_Tower_5_11th_FL_Elevator_Lobby_&_Corridor_329711-0_2026-09-03'
    };

    expect(service.zipFilenameLooksLikeProject(zipFile, project)).toBe(true);
  });

  test('accepts Windows duplicate suffix on the canonical zip name', () => {
    const zipFile = {
      name: 'NH TOWER 5 11TH FL ELEVATOR LOBBY & CORRIDOR_26-71167 (1).zip',
      nameWithoutExtension: 'NH TOWER 5 11TH FL ELEVATOR LOBBY & CORRIDOR_26-71167 (1)'
    };

    expect(service.zipFilenameLooksLikeProject(zipFile, project)).toBe(true);
  });

  test('rejects an unrelated zip filename', () => {
    const zipFile = {
      name: 'AMAZON OGS9-VISALIA, CA_26-32292.zip',
      nameWithoutExtension: 'AMAZON OGS9-VISALIA, CA_26-32292'
    };

    expect(service.zipFilenameLooksLikeProject(zipFile, project)).toBe(false);
  });

  test('confirms identity when name and container are inside the zip and RFA revision matches', () => {
    const searchText = [
      'NH_Tower_5_11th_FL_Elevator_Lobby_&_Corridor_329711-0_2026-09-03',
      'NH TOWER 5 11TH FL ELEVATOR LOBBY & CORRIDOR_26-71167/RFA#329711-0_Budget BOM_09032026/'
    ].join(' ');

    expect(service.zipIdentityMatchesProject(searchText, new Set(['329711-0']), project)).toBe(true);
  });

  test('rejects identity when RFA revision does not match', () => {
    const searchText = 'NH TOWER 5 11TH FL ELEVATOR LOBBY & CORRIDOR_26-71167/RFA#329711-1_Budget BOM_09032026/';

    expect(service.zipIdentityMatchesProject(searchText, new Set(['329711-1']), project)).toBe(false);
  });

  test('rejects identity when container is missing', () => {
    const searchText = 'NH_Tower_5_11th_FL_Elevator_Lobby_&_Corridor_329711-0_2026-09-03/RFA#329711-0_Budget BOM/';

    expect(service.zipIdentityMatchesProject(searchText, new Set(['329711-0']), project)).toBe(false);
  });
});
