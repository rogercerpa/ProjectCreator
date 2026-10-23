const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const ProjectPersistenceService = require('../../main-process/services/ProjectPersistenceService');

const makeProject = (n) => ({
  projectName: `Project ${n}`,
  rfaNumber: `RFA-${n}`,
  projectContainer: `C-${n}`,
  agentNumber: 'A1',
  rfaStatus: 'In Progress'
});

describe('ProjectPersistenceService storage safety', () => {
  let dataDir;
  let service;

  const projectsPath = () => path.join(dataDir, 'projects.json');
  const createService = () => {
    const instance = new ProjectPersistenceService();
    instance.config.dataDirectory = dataDir;
    return instance;
  };

  beforeEach(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-persist-'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    service = createService();
  });

  afterEach(async () => {
    await fs.remove(dataDir);
  });

  test('concurrent saves do not overwrite each other', async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) => service.saveProject(makeProject(i)))
    );

    expect(results.every((r) => r.success)).toBe(true);
    const onDisk = await fs.readJson(projectsPath());
    expect(onDisk).toHaveLength(25);
  });

  test('separate instances share the same cache and lock', async () => {
    const other = createService();
    await Promise.all([service.saveProject(makeProject(1)), other.saveProject(makeProject(2))]);

    expect(await other.loadProjects()).toHaveLength(2);
    expect(await fs.readJson(projectsPath())).toHaveLength(2);
  });

  test('loaded projects are copies, so caller mutations do not leak into the cache', async () => {
    await service.saveProject(makeProject(1));
    const loaded = await service.loadProjects();
    loaded[0].rfaStatus = 'Mutated';
    loaded.push({ id: 'stray' });

    const reloaded = await service.loadProjects();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].rfaStatus).toBe('In Progress');
  });

  test('a corrupt projects file is recovered from backup instead of being treated as empty', async () => {
    await service.saveProject(makeProject(1));
    await service.saveProject(makeProject(2));
    await fs.writeFile(projectsPath(), '[{"projectName": "trunc', 'utf8');

    // Drop the shared cache so the next read hits the corrupt file on disk.
    service.projectStore.projects = null;
    const projects = await service.loadProjects();
    expect(projects.map((p) => p.rfaNumber)).toEqual(['RFA-1']);

    const leftovers = await fs.readdir(dataDir);
    expect(leftovers.some((name) => name.startsWith('projects.json.corrupt-'))).toBe(true);
  });

  test('a corrupt file with no backup fails loudly and the next save does not wipe it', async () => {
    await fs.writeFile(projectsPath(), '{not json', 'utf8');
    service.projectStore.projects = null;

    await expect(service.loadProjects()).rejects.toThrow(/corrupt/);
    const saveResult = await service.saveProject(makeProject(9));
    expect(saveResult.success).toBe(false);
    expect(await fs.readFile(projectsPath(), 'utf8')).toBe('{not json');
  });

  test('history is appended as one line per save', async () => {
    await service.saveProject(makeProject(1));
    await service.saveProject(makeProject(1));

    const history = await service.loadHistory();
    expect(history).toHaveLength(2);
    const raw = await fs.readFile(path.join(dataDir, 'history.jsonl'), 'utf8');
    expect(raw.trim().split('\n')).toHaveLength(2);
  });

  test('legacy history.json is migrated once, keeping order and newer entries', async () => {
    const legacy = [
      { id: 'h2', timestamp: '2026-02-02T00:00:00.000Z' },
      { id: 'h1', timestamp: '2026-01-01T00:00:00.000Z' }
    ];
    await fs.writeJson(path.join(dataDir, 'history.json'), legacy);

    await service.saveProject(makeProject(1));

    const history = await service.loadHistory();
    expect(history.map((entry) => entry.id).slice(1)).toEqual(['h2', 'h1']);
    expect(history[0].projectName).toBe('Project 1');
    expect(await fs.pathExists(path.join(dataDir, 'history.json'))).toBe(false);
    expect(await fs.pathExists(path.join(dataDir, 'history.json.migrated'))).toBe(true);
  });
});
