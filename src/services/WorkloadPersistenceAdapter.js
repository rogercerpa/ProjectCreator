/**
 * Renderer-side adapter for SmartAssignmentService persistence methods.
 * Uses preload IPC APIs and keeps the same response shape expected by the service.
 */
const workloadPersistenceAdapter = {
  async loadUsers() {
    if (!window?.electronAPI?.workloadUsersLoadAll) {
      return { success: false, users: [], error: 'workloadUsersLoadAll is unavailable' };
    }
    return window.electronAPI.workloadUsersLoadAll();
  },

  async loadAssignments() {
    if (!window?.electronAPI?.workloadAssignmentsLoadAll) {
      return { success: false, assignments: [], error: 'workloadAssignmentsLoadAll is unavailable' };
    }
    return window.electronAPI.workloadAssignmentsLoadAll();
  }
};

export default workloadPersistenceAdapter;
