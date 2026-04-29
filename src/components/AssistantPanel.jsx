import React from 'react';

const STARTERS_BY_CONTEXT = {
  project: [
    'What is the current status of this project?',
    'Summarize this project and highlight any risks.',
    'What schedule dates should I pay attention to for this project?'
  ],
  agency: [
    'Show active projects for this agency.',
    'Summarize this agency and recent activity.',
    'What should I know before following up with this agency?'
  ],
  workload: [
    'What projects look at risk this week?',
    'Summarize current workload priorities.',
    'What scheduling issues should I review first?'
  ],
  'spec-review': [
    'Summarize the main findings from this spec review.',
    'What are the biggest spec risks right now?',
    'What follow-up questions should I ask based on this review?'
  ],
  default: [
    'What projects are overdue this week?',
    'Show me recent agency activity.',
    'Summarize project status across the app.'
  ]
};

function getStarters(contextType) {
  return STARTERS_BY_CONTEXT[contextType] || STARTERS_BY_CONTEXT.default;
}

function formatSourceLabel(source) {
  const type = source?.type || 'record';
  return type
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getSourceActionLabel(source) {
  const type = source?.action?.type;
  if (type === 'open-project') return 'Open project';
  if (type === 'open-agency') return 'Open agency';
  if (type === 'open-view') return 'Open view';
  return null;
}

function formatGenerationModeLabel(meta) {
  const mode = meta?.generationMode;
  if (mode === 'grounded-ai-polished') return 'AI rewrite';
  if (mode === 'grounded-fallback') return 'Fallback';
  if (mode === 'fallback-no-grounded-match') return 'No grounded match';
  if (mode === 'fallback-error') return 'Error fallback';
  return null;
}

function AssistantPanel({
  isWelcomeView = false,
  isLoading = false,
  status = 'ready',
  runtimeLabel = 'Local mode',
  runtimeReady = true,
  runtimeMessage = '',
  context,
  scopeMode = 'page',
  draftMessage = '',
  messages = [],
  onDraftChange,
  onSubmit,
  onNewChat,
  onScopeChange,
  onPromptSelect,
  onSourceSelect
}) {
  const starters = getStarters(context?.type);
  const showEmptyState = messages.length === 0;

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit?.();
  };

  return (
    <aside className="w-[380px] shrink-0 border-l border-gray-200 bg-white shadow-xl transition-all duration-300 dark:border-gray-700 dark:bg-gray-800 xl:w-[420px]">
      <div className="flex h-full flex-col">
        <div className="border-b border-gray-200 px-4 py-4 dark:border-gray-700">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Project Creator AI
              </h2>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                status === 'ready'
                  ? (runtimeReady
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300')
                  : status === 'loading'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
              }`}>
                {status === 'ready' ? runtimeLabel : status}
              </span>
            </div>
            <p className="text-sm leading-5 text-gray-500 dark:text-gray-400">
              Answers from app data and approved knowledge only.
            </p>
            {runtimeMessage ? (
              <p className="text-xs leading-5 text-gray-400 dark:text-gray-500">
                Runtime status: {runtimeMessage}
              </p>
            ) : null}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onNewChat}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                New chat
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
              {context?.label || 'All App Data'}
            </span>
            {context?.detail && (
              <span className="truncate rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {context.detail}
              </span>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onScopeChange?.('page')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                scopeMode === 'page'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Current page
            </button>
            <button
              type="button"
              onClick={() => onScopeChange?.('app-wide')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                scopeMode === 'app-wide'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All app data
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
          {showEmptyState ? (
            <div className="space-y-6">
              <section className={`rounded-2xl border border-dashed border-primary-200 bg-primary-50/80 p-5 dark:border-primary-800 dark:bg-primary-900/10 ${isWelcomeView ? '' : ''}`}>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Ask about projects, agencies, schedules, BOMs, or spec reviews
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Use the assistant to answer grounded questions, summarize records, and get next-step guidance based on app data.
                </p>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Suggested prompts
                  </h3>
                  <span className="text-xs text-gray-400">
                    {scopeMode === 'page' ? 'Context aware' : 'App-wide'}
                  </span>
                </div>
                <div className="space-y-2">
                  {starters.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => onPromptSelect?.(prompt)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-primary-700 dark:hover:bg-primary-900/20"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'ml-8 bg-primary-600 text-white'
                      : 'mr-2 border border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-100'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${
                        message.role === 'user' ? 'text-primary-100' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {message.role === 'user' ? 'You' : 'Project Creator AI'}
                      </span>
                      {message.role !== 'user' && formatGenerationModeLabel(message.meta) && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            message.meta?.generationMode === 'grounded-ai-polished'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}
                          title={message.meta?.reason || 'Assistant response mode'}
                        >
                          {formatGenerationModeLabel(message.meta)}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      {message.timestamp && (
                        <span className={`text-[11px] ${
                          message.role === 'user' ? 'text-primary-100' : 'text-gray-400'
                        }`}>
                          {message.timestamp}
                        </span>
                      )}
                      {message.role !== 'user' && message.meta?.runtimeReason && (
                        <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                          {message.meta.runtimeReason}
                        </p>
                      )}
                    </div>
                  </div>

                  {Array.isArray(message.sections) && message.sections.length > 0 ? (
                    <div className="space-y-3">
                      {message.sections.map((section, sectionIndex) => (
                        <section key={section.title || sectionIndex}>
                          {section.title ? (
                            <h4 className={`text-xs font-semibold uppercase tracking-wide ${
                              message.role === 'user' ? 'text-primary-100' : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {section.title}
                            </h4>
                          ) : null}
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                            {section.content}
                          </p>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  )}

                  {message.role !== 'user' && (
                    (Array.isArray(message.referencedProjects) && message.referencedProjects.length > 0) ||
                    (Array.isArray(message.referencedAgencies) && message.referencedAgencies.length > 0)
                  ) && (
                    <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50/60 p-3 dark:border-primary-800/60 dark:bg-primary-900/10">
                      {Array.isArray(message.referencedProjects) && message.referencedProjects.length > 0 && (
                        <>
                          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                            Open referenced projects
                          </h4>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {message.referencedProjects.map((project) => (
                              <button
                                key={project.id}
                                type="button"
                                onClick={() => onSourceSelect?.({
                                  type: 'project',
                                  title: project.projectName,
                                  action: { type: 'open-project', entityId: project.id, view: 'project-management' }
                                })}
                                title={project.rfaNumber ? `RFA ${project.rfaNumber}` : project.projectName}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-primary-200 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-primary-700 transition-colors hover:border-primary-400 hover:bg-primary-100 dark:border-primary-800 dark:bg-gray-800 dark:text-primary-300 dark:hover:bg-primary-900/40"
                              >
                                <svg className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                </svg>
                                <span className="truncate">{project.projectName}</span>
                                {project.rfaNumber && (
                                  <span className="shrink-0 text-[10px] font-normal text-primary-500 dark:text-primary-400">
                                    · {project.rfaNumber}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {Array.isArray(message.referencedAgencies) && message.referencedAgencies.length > 0 && (
                        <div className={Array.isArray(message.referencedProjects) && message.referencedProjects.length > 0 ? 'mt-3' : ''}>
                          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                            Open referenced agencies
                          </h4>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {message.referencedAgencies.map((agency) => (
                              <button
                                key={agency.id}
                                type="button"
                                onClick={() => onSourceSelect?.({
                                  type: 'agency',
                                  title: agency.agencyName,
                                  action: { type: 'open-agency', entityId: agency.id, view: 'agency-dashboard' }
                                })}
                                title={agency.agencyNumber ? `Agency ${agency.agencyNumber}` : agency.agencyName}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-primary-200 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-primary-700 transition-colors hover:border-primary-400 hover:bg-primary-100 dark:border-primary-800 dark:bg-gray-800 dark:text-primary-300 dark:hover:bg-primary-900/40"
                              >
                                <svg className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                </svg>
                                <span className="truncate">{agency.agencyName}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {message.role !== 'user' && Array.isArray(message.sources) && message.sources.length > 0 && (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-800/80">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Sources
                      </h4>
                      <div className="mt-2 space-y-2">
                        {message.sources.map((source, index) => (
                          <div key={`${source.title}-${index}`} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/60">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                {source.title}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] uppercase tracking-wide text-gray-400">
                                  {formatSourceLabel(source)}
                                </span>
                                {getSourceActionLabel(source) && (
                                  <button
                                    type="button"
                                    onClick={() => onSourceSelect?.(source)}
                                    className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-700 transition-colors hover:bg-primary-50 dark:border-gray-700 dark:bg-gray-800 dark:text-primary-300 dark:hover:bg-primary-900/30"
                                  >
                                    {getSourceActionLabel(source)}
                                  </button>
                                )}
                              </div>
                            </div>
                            {source.snippet && (
                              <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                {source.snippet}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-gray-200 px-4 py-4 dark:border-gray-700">
          <label className="sr-only" htmlFor="assistant-message">
            Ask Project Creator AI
          </label>
          <textarea
            id="assistant-message"
            value={draftMessage}
            onChange={(event) => onDraftChange?.(event.target.value)}
            rows={4}
            placeholder="Ask about projects, agencies, schedules, BOMs, or specs..."
            className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-primary-500 dark:focus:ring-primary-900"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              App-scoped assistant. It will say when grounded data is missing.
            </p>
            <button
              type="submit"
              disabled={!draftMessage.trim() || isLoading}
              className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Thinking...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}

export default AssistantPanel;
