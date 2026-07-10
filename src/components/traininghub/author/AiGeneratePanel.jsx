import React, { useState } from 'react';

const { electronAPI } = window;

const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

/**
 * AI course generation panel. Lets the author upload source documents and/or
 * paste notes, then generates a draft (lessons + quiz) the author can edit.
 */
const AiGeneratePanel = ({ aiReady, category, difficulty, onGenerated }) => {
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [links, setLinks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pickFiles = async () => {
    setError(null);
    try {
      const res = await electronAPI.trainingHubSelectSourceFiles();
      if (res?.success) {
        setFiles(prev => Array.from(new Set([...prev, ...res.filePaths])));
      } else if (!res?.canceled) {
        setError(res?.error || 'Could not select files');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const removeFile = (fp) => setFiles(files.filter(f => f !== fp));

  const generate = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await electronAPI.trainingHubGenerateDraft({
        filePaths: files,
        notes,
        links: links.split('\n').map(s => s.trim()).filter(Boolean),
        category,
        difficulty
      });
      if (res?.success) {
        onGenerated(res.course);
      } else {
        setError(res?.error || 'Generation failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const canGenerate = aiReady && !busy && (files.length > 0 || notes.trim().length > 0);

  return (
    <div className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-primary-50/50 to-secondary-50/30 dark:from-primary-900/10 dark:to-secondary-900/10 p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">✨</span>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Generate with AI</h3>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Upload reference documents or paste notes, and AI will draft lessons and a quiz you can refine.
      </p>

      {!aiReady && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-300">
          AI is not configured. Set up a provider and API key in Settings &gt; AI Configuration to enable generation. You can still build a course manually below.
        </div>
      )}

      <div className="space-y-3">
        <div>
          <button
            type="button"
            onClick={pickFiles}
            disabled={!aiReady}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50"
          >
            + Add source documents (PDF, DOCX, TXT)
          </button>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map(fp => (
                <li key={fp} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-100 dark:border-gray-700">
                  <span className="truncate">{fp.split(/[/\\]/).pop()}</span>
                  <button type="button" onClick={() => removeFile(fp)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          disabled={!aiReady}
          placeholder="Optional notes / outline to guide the course…"
          className={inputClass}
        />

        <textarea
          value={links}
          onChange={(e) => setLinks(e.target.value)}
          rows={2}
          disabled={!aiReady}
          placeholder="Optional reference links (one per line)"
          className={inputClass}
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="button"
          onClick={generate}
          disabled={!canGenerate}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white"
        >
          {busy ? (
            <>
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Generating…
            </>
          ) : 'Generate draft'}
        </button>
        {busy && <p className="text-xs text-gray-500 dark:text-gray-400">This can take up to a minute for larger documents.</p>}
      </div>
    </div>
  );
};

export default AiGeneratePanel;
