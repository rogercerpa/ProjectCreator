// Renderer-side proxy for main-process/services/ProjectDraftService. Drafts are
// stored on disk, so the real service runs in the main process behind IPC.
const call = (method, ...args) => window.electronAPI.draftsCall(method, ...args);

class ProjectDraftClient {
  static isAvailable() {
    return typeof window !== 'undefined' && typeof window.electronAPI?.draftsCall === 'function';
  }

  savePartialProject(formData, currentStep, metadata) {
    return call('savePartialProject', formData, currentStep, metadata);
  }

  loadDraft(draftId) {
    return call('loadDraft', draftId);
  }

  getAllDrafts() {
    return call('getAllDrafts');
  }

  deleteDraft(draftId) {
    return call('deleteDraft', draftId);
  }

  getDraftStatistics() {
    return call('getDraftStatistics');
  }
}

export const createDraftClient = () => (ProjectDraftClient.isAvailable() ? new ProjectDraftClient() : null);

export default ProjectDraftClient;
