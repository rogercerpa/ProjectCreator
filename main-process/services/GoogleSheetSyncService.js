const { EventEmitter } = require('events');
const crypto = require('crypto');

class GoogleSheetSyncService extends EventEmitter {
  constructor(workloadPersistenceService, projectPersistenceService) {
    super();
    this.workloadPersistenceService = workloadPersistenceService;
    this.projectPersistenceService = projectPersistenceService;
    this.maxRetryAttempts = 3;
  }

  getDefaultSettings() {
    return {
      enabled: false,
      provider: 'apps-script',
      endpointUrl: '',
      apiKey: '',
      sharedSecret: '',
      syncMode: 'manual',
      autoSyncIntervalMinutes: 10,
      autoSyncOnAssignmentChanges: false,
      conflictResolution: 'ownership-with-latest',
      timeoutMs: 20000,
      dryRunDefault: true,
      lastPushAt: null,
      lastPullAt: null,
      lastBidirectionalAt: null,
      lastError: null,
      lastSyncToken: null
    };
  }

  getSyncContract() {
    return {
      version: '1.0.0',
      primaryKey: 'assignmentId',
      fields: [
        'assignmentId',
        'projectId',
        'rfaNumber',
        'projectName',
        'taskType',
        'engineerId',
        'engineerName',
        'startDate',
        'dueDate',
        'hoursAllocated',
        'hoursSpent',
        'status',
        'priority',
        'notes',
        'lastModifiedUtc',
        'syncVersion',
        'sourceSystem'
      ],
      ownership: {
        appOwned: [
          'assignmentId',
          'projectId',
          'rfaNumber',
          'projectName',
          'taskType',
          'engineerId',
          'engineerName',
          'startDate',
          'dueDate',
          'hoursAllocated',
          'priority',
          'sourceSystem'
        ],
        sheetOwned: [
          'status',
          'hoursSpent',
          'notes'
        ],
        neutral: [
          'lastModifiedUtc',
          'syncVersion'
        ]
      },
      allowedStatuses: ['ASSIGNED', 'IN PROGRESS', 'IN QC', 'COMPLETE', 'PAUSE']
    };
  }

  async getSyncSettings() {
    try {
      const loaded = await this.workloadPersistenceService.loadGoogleSyncConfig();
      const settings = { ...this.getDefaultSettings(), ...(loaded.config || {}) };
      return { success: true, settings };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateSyncSettings(newSettings = {}) {
    try {
      const currentResult = await this.getSyncSettings();
      if (!currentResult.success) {
        return currentResult;
      }

      const merged = {
        ...currentResult.settings,
        ...newSettings,
        lastUpdated: new Date().toISOString()
      };

      const saveResult = await this.workloadPersistenceService.saveGoogleSyncConfig(merged);
      if (!saveResult.success) {
        return saveResult;
      }

      return { success: true, settings: merged };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getSyncStatus() {
    try {
      const settingsResult = await this.getSyncSettings();
      const stateResult = await this.workloadPersistenceService.loadGoogleSyncState();
      const auditResult = await this.workloadPersistenceService.loadGoogleSyncAudit(20);

      return {
        success: true,
        status: {
          settings: settingsResult.success ? settingsResult.settings : this.getDefaultSettings(),
          state: stateResult.success ? stateResult.state : {},
          recentAudit: auditResult.success ? auditResult.entries : []
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async pushAssignments(options = {}) {
    const startedAt = new Date().toISOString();
    const { dryRun = false, assignmentIds = null } = options;

    try {
      const settingsResult = await this.getSyncSettings();
      if (!settingsResult.success) return settingsResult;
      const settings = settingsResult.settings;

      if (!settings.enabled) {
        return { success: false, error: 'Google sync is disabled in settings' };
      }

      if (!settings.endpointUrl) {
        return { success: false, error: 'Missing Apps Script endpoint URL' };
      }

      const dataSnapshot = await this.getDataSnapshot();
      let assignments = dataSnapshot.assignments;
      if (Array.isArray(assignmentIds) && assignmentIds.length > 0) {
        const idSet = new Set(assignmentIds);
        assignments = assignments.filter(a => idSet.has(a.id));
      }

      const rows = assignments.map(assignment => this.mapAssignmentToRow(
        assignment,
        dataSnapshot.projectsById.get(assignment.projectId),
        dataSnapshot.usersById.get(assignment.userId)
      ));

      if (dryRun) {
        return {
          success: true,
          dryRun: true,
          message: 'Dry run completed. No data sent to Apps Script.',
          counts: { rows: rows.length },
          preview: rows.slice(0, 20)
        };
      }

      const requestBody = {
        operation: 'pushAssignments',
        payload: {
          rows,
          sourceSystem: 'ProjectCreator',
          sentAtUtc: new Date().toISOString()
        }
      };

      const response = await this.requestWithRetry(`${this.normalizeEndpoint(settings.endpointUrl)}/pushAssignments`, {
        method: 'POST',
        settings,
        body: requestBody
      });

      if (!response.success) {
        await this.recordAudit({
          direction: 'push',
          success: false,
          startedAt,
          completedAt: new Date().toISOString(),
          error: response.error,
          counts: { attemptedRows: rows.length }
        });
        return response;
      }

      const nextSyncToken = response.data?.nextSyncToken || null;
      await this.updateSyncSettings({
        lastPushAt: new Date().toISOString(),
        lastSyncToken: nextSyncToken || settings.lastSyncToken,
        lastError: null
      });

      await this.workloadPersistenceService.saveGoogleSyncState({
        lastPushAt: new Date().toISOString(),
        lastPushCount: rows.length,
        lastPushResponse: response.data || null,
        lastError: null
      });

      await this.recordAudit({
        direction: 'push',
        success: true,
        startedAt,
        completedAt: new Date().toISOString(),
        counts: { pushedRows: rows.length },
        details: { nextSyncToken }
      });

      return {
        success: true,
        direction: 'push',
        counts: { pushedRows: rows.length },
        nextSyncToken,
        response: response.data || {}
      };
    } catch (error) {
      await this.recordAudit({
        direction: 'push',
        success: false,
        startedAt,
        completedAt: new Date().toISOString(),
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async pullAssignmentUpdates(options = {}) {
    const startedAt = new Date().toISOString();
    const { dryRun = false, sinceToken = null } = options;

    try {
      const settingsResult = await this.getSyncSettings();
      if (!settingsResult.success) return settingsResult;
      const settings = settingsResult.settings;

      if (!settings.enabled) {
        return { success: false, error: 'Google sync is disabled in settings' };
      }

      if (!settings.endpointUrl) {
        return { success: false, error: 'Missing Apps Script endpoint URL' };
      }

      const since = sinceToken || settings.lastSyncToken || '';
      const url = new URL(`${this.normalizeEndpoint(settings.endpointUrl)}/pullUpdates`);
      if (since) {
        url.searchParams.set('since', since);
      }

      const response = await this.requestWithRetry(url.toString(), {
        method: 'GET',
        settings
      });

      if (!response.success) {
        await this.recordAudit({
          direction: 'pull',
          success: false,
          startedAt,
          completedAt: new Date().toISOString(),
          error: response.error
        });
        return response;
      }

      const rows = this.extractRows(response.data);
      const nextSyncToken = response.data?.nextSyncToken || settings.lastSyncToken || null;

      if (dryRun) {
        return {
          success: true,
          dryRun: true,
          direction: 'pull',
          counts: { pulledRows: rows.length },
          nextSyncToken,
          preview: rows.slice(0, 20)
        };
      }

      const reconcileResult = await this.reconcileUpdates(rows, {
        strategy: settings.conflictResolution
      });

      await this.updateSyncSettings({
        lastPullAt: new Date().toISOString(),
        lastSyncToken: nextSyncToken,
        lastError: null
      });

      await this.workloadPersistenceService.saveGoogleSyncState({
        lastPullAt: new Date().toISOString(),
        lastPullCount: rows.length,
        lastReconcileSummary: reconcileResult.summary,
        lastError: null
      });

      await this.recordAudit({
        direction: 'pull',
        success: true,
        startedAt,
        completedAt: new Date().toISOString(),
        counts: {
          pulledRows: rows.length,
          updatedAssignments: reconcileResult.summary.updatedAssignments,
          conflicts: reconcileResult.summary.conflicts
        },
        details: { nextSyncToken }
      });

      return {
        success: true,
        direction: 'pull',
        counts: { pulledRows: rows.length },
        nextSyncToken,
        reconcile: reconcileResult
      };
    } catch (error) {
      await this.recordAudit({
        direction: 'pull',
        success: false,
        startedAt,
        completedAt: new Date().toISOString(),
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async performBidirectionalSync(options = {}) {
    try {
      const pushResult = await this.pushAssignments(options);
      if (!pushResult.success) {
        return {
          success: false,
          error: `Push failed: ${pushResult.error}`,
          pushResult
        };
      }

      const pullResult = await this.pullAssignmentUpdates({
        ...options,
        sinceToken: pushResult.nextSyncToken || options.sinceToken || null
      });

      if (!pullResult.success) {
        return {
          success: false,
          error: `Pull failed: ${pullResult.error}`,
          pushResult,
          pullResult
        };
      }

      await this.updateSyncSettings({
        lastBidirectionalAt: new Date().toISOString(),
        lastError: null
      });

      return {
        success: true,
        direction: 'bidirectional',
        pushResult,
        pullResult
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async reconcileUpdates(remoteRows, options = {}) {
    const contract = this.getSyncContract();
    const strategy = options.strategy || 'ownership-with-latest';

    const assignmentsResult = await this.workloadPersistenceService.loadAssignments();
    const assignments = assignmentsResult.success ? assignmentsResult.assignments : [];
    const assignmentMap = new Map(assignments.map(assignment => [assignment.id, assignment]));

    const conflicts = [];
    let updatedAssignments = 0;

    for (const row of remoteRows) {
      const assignmentId = row.assignmentId || row.id;
      if (!assignmentId) {
        continue;
      }

      const localAssignment = assignmentMap.get(assignmentId);
      if (!localAssignment) {
        continue;
      }

      const localModified = new Date(localAssignment?.metadata?.lastModified || 0).getTime();
      const remoteModified = new Date(row.lastModifiedUtc || 0).getTime();
      const didUpdate = this.applyRemoteRowToAssignment(localAssignment, row, {
        strategy,
        localModified,
        remoteModified,
        conflicts
      }, contract);

      if (didUpdate) {
        localAssignment.metadata = {
          ...(localAssignment.metadata || {}),
          lastModified: new Date().toISOString()
        };
        updatedAssignments += 1;
      }
    }

    const saveResult = await this.workloadPersistenceService.saveAssignments(assignments);
    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }

    return {
      success: true,
      summary: {
        updatedAssignments,
        conflicts: conflicts.length
      },
      conflicts
    };
  }

  applyRemoteRowToAssignment(localAssignment, row, context, contract) {
    let changed = false;
    const sheetOwned = new Set(contract.ownership.sheetOwned);
    const allowedStatuses = new Set(contract.allowedStatuses);

    const fieldMap = [
      { remote: 'status', local: 'status' },
      { remote: 'hoursSpent', local: 'hoursSpent' },
      { remote: 'notes', local: 'notes' }
    ];

    for (const mapping of fieldMap) {
      const remoteValue = row[mapping.remote];
      if (remoteValue === undefined || remoteValue === null) {
        continue;
      }

      if (!sheetOwned.has(mapping.remote)) {
        continue;
      }

      if (mapping.remote === 'status' && !allowedStatuses.has(String(remoteValue))) {
        continue;
      }

      const localValue = localAssignment[mapping.local];
      if (localValue === remoteValue) {
        continue;
      }

      const remoteIsNewer = context.remoteModified >= context.localModified;
      if (!remoteIsNewer && context.strategy === 'ownership-with-latest') {
        context.conflicts.push({
          assignmentId: localAssignment.id,
          field: mapping.local,
          localValue,
          remoteValue,
          resolution: 'kept-local-remote-older'
        });
        continue;
      }

      localAssignment[mapping.local] = mapping.remote === 'hoursSpent'
        ? Number(remoteValue) || 0
        : remoteValue;
      changed = true;
    }

    return changed;
  }

  extractRows(responseData) {
    if (!responseData) return [];
    if (Array.isArray(responseData.rows)) return responseData.rows;
    if (Array.isArray(responseData.updates)) return responseData.updates;
    if (Array.isArray(responseData.data)) return responseData.data;
    return [];
  }

  mapAssignmentToRow(assignment, project, user) {
    return {
      assignmentId: assignment.id,
      projectId: assignment.projectId || project?.id || '',
      rfaNumber: assignment.rfaNumber || project?.rfaNumber || '',
      projectName: assignment.projectName || project?.projectName || '',
      taskType: assignment.taskType || '',
      engineerId: assignment.userId || '',
      engineerName: user?.name || '',
      startDate: assignment.startDate || '',
      dueDate: assignment.dueDate || '',
      hoursAllocated: Number(assignment.hoursAllocated || 0),
      hoursSpent: Number(assignment.hoursSpent || 0),
      status: assignment.status || 'ASSIGNED',
      priority: assignment.priority || 'medium',
      notes: assignment.notes || '',
      lastModifiedUtc: assignment?.metadata?.lastModified || new Date().toISOString(),
      syncVersion: assignment?.metadata?.version || 1,
      sourceSystem: 'ProjectCreator'
    };
  }

  normalizeEndpoint(endpointUrl) {
    return String(endpointUrl || '').replace(/\/+$/, '');
  }

  buildAuthHeaders(settings, bodyText) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (settings.apiKey) {
      headers['x-api-key'] = settings.apiKey;
    }

    if (settings.sharedSecret) {
      headers['x-signature'] = crypto
        .createHmac('sha256', settings.sharedSecret)
        .update(bodyText || '')
        .digest('hex');
    }

    return headers;
  }

  async requestWithRetry(url, options) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetryAttempts; attempt += 1) {
      try {
        const result = await this.makeRequest(url, options);
        if (result.success) return result;
        lastError = result.error || 'Request failed';
      } catch (error) {
        lastError = error.message;
      }

      if (attempt < this.maxRetryAttempts) {
        const backoffMs = attempt * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    return { success: false, error: lastError || 'Unknown request error' };
  }

  async makeRequest(url, options) {
    const method = options.method || 'GET';
    const bodyText = options.body ? JSON.stringify(options.body) : '';
    const headers = this.buildAuthHeaders(options.settings || {}, bodyText);

    const controller = new AbortController();
    const timeoutMs = Number(options.settings?.timeoutMs || 20000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method === 'GET' ? undefined : bodyText,
        signal: controller.signal
      });

      const responseText = await response.text();
      let parsed = null;
      try {
        parsed = responseText ? JSON.parse(responseText) : {};
      } catch (error) {
        parsed = { raw: responseText };
      }

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          error: parsed?.error || `HTTP ${response.status}`
        };
      }

      return { success: true, status: response.status, data: parsed };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      clearTimeout(timeout);
    }
  }

  async getDataSnapshot() {
    const assignmentsResult = await this.workloadPersistenceService.loadAssignments();
    const usersResult = await this.workloadPersistenceService.loadUsers();
    const projects = await this.projectPersistenceService.loadProjects();

    const assignments = assignmentsResult.success ? assignmentsResult.assignments : [];
    const users = usersResult.success ? usersResult.users : [];

    return {
      assignments,
      users,
      projects,
      usersById: new Map(users.map(u => [u.id, u])),
      projectsById: new Map(projects.map(p => [p.id, p]))
    };
  }

  async recordAudit(entry) {
    await this.workloadPersistenceService.appendGoogleSyncAuditLog({
      id: `google-sync-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...entry
    });
  }
}

module.exports = GoogleSheetSyncService;
