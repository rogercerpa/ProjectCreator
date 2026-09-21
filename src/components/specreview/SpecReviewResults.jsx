import React, { useEffect, useMemo, useState } from 'react';

const { electronAPI } = window;

const STATUS_META = {
  met: { label: 'Met', className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  alternative: { label: 'Partial', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  gap: { label: 'Gap', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' }
};

const SpecReviewResults = ({ result, onNewAnalysis }) => {
  const [filter, setFilter] = useState('all');
  const [showPossible, setShowPossible] = useState(true);
  const [showMissing, setShowMissing] = useState(false);
  const [showBom, setShowBom] = useState(true);
  const [projects, setProjects] = useState([]);
  const [linkedProjectId, setLinkedProjectId] = useState(result.linkedProjectId || '');
  const [linkMessage, setLinkMessage] = useState('');

  useEffect(() => {
    let active = true;
    electronAPI.projectsLoadAll?.().then(response => {
      if (active && response?.success) setProjects(response.projects || []);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const score = result.complianceScore || {};
  const requirements = result.requirements || [];
  const visible = useMemo(() => (
    filter === 'all' ? requirements : requirements.filter(item => item.status === filter)
  ), [filter, requirements]);

  const linkProject = async (projectId) => {
    setLinkedProjectId(projectId);
    if (!result.reviewId) return;
    if (!projectId) {
      const response = await electronAPI.specReviewUnlinkProject(result.reviewId);
      setLinkMessage(response?.success ? 'Unlinked from project.' : (response?.error || 'Could not unlink.'));
      return;
    }
    const project = projects.find(item => item.id === projectId);
    const response = await electronAPI.specReviewLinkProject(result.reviewId, projectId, project?.projectName || '');
    setLinkMessage(response?.success ? `Linked to ${project?.projectName || 'project'}.` : (response?.error || 'Could not link.'));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{result.sourceFile}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-3xl">{result.projectSummary}</p>
          {result.scanScope?.note && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{result.scanScope.note}</p>
          )}
        </div>
        <button
          onClick={onNewAnalysis}
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Scan another spec
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <ScoreTile label="Can meet" value={score.score == null ? '—' : `${score.score}%`} />
        <ScoreTile label="Met" value={score.met || 0} />
        <ScoreTile label="Partial" value={score.alternative || 0} />
        <ScoreTile label="Gaps" value={score.gap || 0} />
        <ScoreTile label="Not in spec" value={score.notMentioned || 0} />
      </div>
      {score.summary && <p className="text-sm text-gray-600 dark:text-gray-300">{score.summary}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600 dark:text-gray-300" htmlFor="spec-review-project">Link to project</label>
        <select
          id="spec-review-project"
          value={linkedProjectId}
          onChange={(event) => linkProject(event.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
        >
          <option value="">Not linked</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>{project.projectName || project.rfaNumber || project.id}</option>
          ))}
        </select>
        {linkMessage && <span className="text-xs text-gray-500 dark:text-gray-400">{linkMessage}</span>}
      </div>

      <div className="flex gap-2">
        {['all', 'met', 'alternative', 'gap'].map(key => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-xs rounded-full border ${
              filter === key
                ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
            }`}
          >
            {key === 'all' ? 'All confirmed' : STATUS_META[key].label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No confirmed rules in this filter.</p>
        )}
        {visible.map(item => (
          <RequirementCard key={item.id} item={item} />
        ))}
      </div>

      <section className="border border-gray-200 dark:border-gray-700 rounded-xl">
        <button onClick={() => setShowPossible(value => !value)} className="w-full px-4 py-3 text-left text-sm font-medium text-gray-800 dark:text-gray-100">
          {showPossible ? '▼' : '▶'} Possible mentions to confirm ({(result.possibleMentions || []).length})
        </button>
        {showPossible && (
          <div className="px-4 pb-4 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">These matched only one keyword. Check the excerpt before treating them as a real requirement. They are not included in the score.</p>
            {(result.possibleMentions || []).map(item => (
              <RequirementCard key={item.id} item={item} />
            ))}
            {(result.possibleMentions || []).length === 0 && (
              <p className="text-sm text-gray-500">None.</p>
            )}
          </div>
        )}
      </section>

      <section className="border border-gray-200 dark:border-gray-700 rounded-xl">
        <button onClick={() => setShowBom(value => !value)} className="w-full px-4 py-3 text-left text-sm font-medium text-gray-800 dark:text-gray-100">
          {showBom ? '▼' : '▶'} Suggested devices ({(result.preliminaryBOM || []).length})
        </button>
        {showBom && (
          <div className="px-4 pb-4 space-y-2">
            {(result.preliminaryBOM || []).map(device => (
              <div key={device.catalogNumber} className="text-sm flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{device.catalogNumber}</span>
                <span className="text-gray-600 dark:text-gray-300">{device.description}</span>
                {device.quantityGuidance && <span className="text-gray-500">{device.quantityGuidance}</span>}
              </div>
            ))}
            {(result.preliminaryBOM || []).length === 0 && <p className="text-sm text-gray-500">No devices to suggest from the confirmed matches.</p>}
          </div>
        )}
      </section>

      <section className="border border-gray-200 dark:border-gray-700 rounded-xl">
        <button onClick={() => setShowMissing(value => !value)} className="w-full px-4 py-3 text-left text-sm font-medium text-gray-800 dark:text-gray-100">
          {showMissing ? '▼' : '▶'} Rules not found in this spec ({(result.notMentioned || []).length})
        </button>
        {showMissing && (
          <div className="px-4 pb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">These knowledge-base rules did not appear. That is not a gap. The spec simply did not ask for them.</p>
            <div className="flex flex-wrap gap-2">
              {(result.notMentioned || []).map(rule => (
                <span key={rule.ruleId || rule.name} className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                  {rule.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

const ScoreTile = ({ label, value }) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-3">
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    <div className="text-lg font-semibold text-gray-900 dark:text-white">{value}</div>
  </div>
);

const RequirementCard = ({ item }) => {
  const meta = STATUS_META[item.status] || STATUS_META.met;
  return (
    <article className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="font-medium text-gray-900 dark:text-white">{item.name}</h3>
        <span className={`px-2 py-0.5 text-xs rounded-full ${meta.className}`}>{meta.label}</span>
        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{item.matchStrength}</span>
        {item.page && <span className="text-xs text-gray-500">Page {item.page}</span>}
        {item.category && <span className="text-xs text-gray-500">{item.category}</span>}
      </div>
      {item.matchedKeywords?.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Keywords: {item.matchedKeywords.join(', ')}</p>
      )}
      {item.excerpt && (
        <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">{item.excerpt}</p>
      )}
      {item.gapNote && <p className="text-sm text-amber-800 dark:text-amber-300 mb-2">{item.gapNote}</p>}
      {(item.recommendedDevices || []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.recommendedDevices.map(device => (
            <span key={device.catalogNumber} className="px-2 py-1 text-xs font-mono rounded bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-200">
              {device.catalogNumber}
            </span>
          ))}
        </div>
      )}
    </article>
  );
};

export default SpecReviewResults;
