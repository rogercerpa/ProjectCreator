import React, { useState, useEffect, useCallback } from 'react';

const { electronAPI } = window;

const BOMQCReviewPanel = ({ project, bomData, onProjectUpdate }) => {
  const [activeView, setActiveView] = useState('setup'); // 'setup' | 'results'
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [hasAIKey, setHasAIKey] = useState(false);
  const [notification, setNotification] = useState(null);

  // Requirements state
  const [buildingCodes, setBuildingCodes] = useState([]);
  const [manualRequirementOptions, setManualRequirementOptions] = useState([]);
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [selectedManualReqs, setSelectedManualReqs] = useState([]);
  const [specRequirements, setSpecRequirements] = useState([]);
  const [specFileName, setSpecFileName] = useState('');
  const [isParsingSpec, setIsParsingSpec] = useState(false);

  // Results state
  const [qcResult, setQcResult] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, [project?.id]);

  const loadInitialData = async () => {
    try {
      const [codesResult, aiKeyResult, reqResult] = await Promise.all([
        electronAPI.bomQcGetBuildingCodes(),
        electronAPI.aiHasKey(),
        project?.id ? electronAPI.bomQcGetRequirements(project.id) : null
      ]);

      if (codesResult.success) {
        setBuildingCodes(codesResult.buildingCodes);
        setManualRequirementOptions(codesResult.manualRequirements);
      }

      setHasAIKey(aiKeyResult?.hasKey || false);

      if (reqResult?.success && reqResult.requirements) {
        const saved = reqResult.requirements;
        setSelectedCodes(saved.buildingCodes || []);
        setSelectedManualReqs(saved.manualRequirements || []);
        setSpecRequirements(saved.specRequirements || []);
        setSpecFileName(saved.specFileName || '');
      }

      if (reqResult?.qcAnalysis) {
        setQcResult(reqResult.qcAnalysis);
        if (reqResult.qcAnalysis.summary) {
          setActiveView('results');
        }
      }
    } catch (error) {
      console.error('Error loading QC data:', error);
    }
  };

  const handleCodeToggle = (codeId) => {
    setSelectedCodes(prev =>
      prev.includes(codeId)
        ? prev.filter(c => c !== codeId)
        : [...prev, codeId]
    );
  };

  const handleManualReqToggle = (reqId) => {
    setSelectedManualReqs(prev =>
      prev.includes(reqId)
        ? prev.filter(r => r !== reqId)
        : [...prev, reqId]
    );
  };

  const [specParsingStage, setSpecParsingStage] = useState('');

  const handleUploadSpec = async () => {
    try {
      setIsParsingSpec(true);
      setSpecParsingStage('Selecting file...');
      setNotification(null);

      const fileResult = await electronAPI.bomQcSelectSpecFile(project);
      if (!fileResult.success || fileResult.canceled) {
        setIsParsingSpec(false);
        setSpecParsingStage('');
        return;
      }

      const fileName = fileResult.filePath.split(/[\\/]/).pop();
      setSpecParsingStage(`Reading ${fileName}...`);
      setNotification({ type: 'info', message: `Reading ${fileName}...` });

      // Small delay so the user sees the "reading" stage before AI kicks in
      await new Promise(r => setTimeout(r, 300));
      setSpecParsingStage(`AI analyzing ${fileName} — this may take up to a minute...`);
      setNotification({ type: 'info', message: `AI is analyzing ${fileName} — this may take up to a minute for large documents...` });

      const parseResult = await electronAPI.bomQcParseSpec(fileResult.filePath);
      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Failed to parse specification');
      }

      setSpecRequirements(parseResult.requirements);
      setSpecFileName(parseResult.sourceFile);
      setNotification({
        type: 'success',
        message: `Extracted ${parseResult.requirements.length} requirements from ${parseResult.sourceFile}`
      });
    } catch (error) {
      setNotification({ type: 'error', message: error.message });
    } finally {
      setIsParsingSpec(false);
      setSpecParsingStage('');
    }
  };

  const handleRunAnalysis = async () => {
    if (!hasAIKey) {
      setNotification({ type: 'error', message: 'Please configure your AI provider in Settings first.' });
      return;
    }

    const totalReqs = selectedCodes.length + selectedManualReqs.length + specRequirements.length;
    if (totalReqs === 0) {
      setNotification({ type: 'error', message: 'Select at least one building code, upload a spec, or add manual requirements.' });
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisProgress('Saving requirements...');

      const requirementsConfig = {
        buildingCodes: selectedCodes,
        manualRequirements: selectedManualReqs,
        specRequirements,
        specFileName
      };

      await electronAPI.bomQcSaveRequirements(project.id, requirementsConfig);

      setAnalysisProgress('Analyzing BOM devices with AI...');

      const result = await electronAPI.bomQcRunAnalysis(project.id, requirementsConfig);

      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      setQcResult(result.qcResult);
      setActiveView('results');
      setNotification({
        type: 'success',
        message: `Analysis complete: ${result.qcResult.summary.score}% compliance`
      });

      if (onProjectUpdate) {
        const refreshed = await electronAPI.projectLoad(project.id);
        if (refreshed.success) onProjectUpdate(refreshed.project);
      }
    } catch (error) {
      setNotification({ type: 'error', message: error.message });
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (score >= 50) return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
    return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  };

  // ===== RENDER =====

  if (!hasAIKey) {
    return (
      <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h4 className="font-semibold text-amber-800 dark:text-amber-300">AI Configuration Required</h4>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              BOM QC Review uses AI to analyze devices and check compliance. Configure your AI provider (OpenAI, Gemini, or Claude) in Settings to get started.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-gray-200 dark:border-gray-600 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔍</span>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">QC Review</h3>
          {qcResult?.summary && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getScoreBg(qcResult.summary.score)}`}>
              <span className={getScoreColor(qcResult.summary.score)}>{qcResult.summary.score}%</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {qcResult && (
            <button
              onClick={() => setActiveView(activeView === 'setup' ? 'results' : 'setup')}
              className="px-3 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
            >
              {activeView === 'setup' ? 'View Results' : 'Edit Requirements'}
            </button>
          )}
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mb-4 p-3 rounded-md text-sm ${
          notification.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
          : notification.type === 'error' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
        }`}>
          {notification.message}
        </div>
      )}

      {activeView === 'setup' ? (
        <div className="space-y-4">
          {/* Building Codes */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span>📜</span> Building Codes
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Select applicable building codes for this project</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {buildingCodes.map(code => (
                <label
                  key={code.id}
                  className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-all ${
                    selectedCodes.includes(code.id)
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCodes.includes(code.id)}
                    onChange={() => handleCodeToggle(code.id)}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{code.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{code.requirementCount} requirements</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Project Spec Upload */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span>📄</span> Project Specifications
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Upload project specs (PDF/DOCX) for AI-powered requirement extraction</p>

            <div className="flex items-center gap-3">
              <button
                onClick={handleUploadSpec}
                disabled={isParsingSpec || isAnalyzing}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {isParsingSpec ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    <span className="max-w-[200px] truncate">{specParsingStage || 'Analyzing...'}</span>
                  </>
                ) : (
                  <>
                    <span>📤</span>
                    <span>{specFileName ? 'Replace Spec' : 'Upload Spec'}</span>
                  </>
                )}
              </button>
              {specFileName && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <span>📎</span>
                  <span>{specFileName}</span>
                  <span className="text-xs text-gray-400">({specRequirements.length} requirements)</span>
                  <button
                    onClick={() => { setSpecRequirements([]); setSpecFileName(''); }}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {specRequirements.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
                {specRequirements.map((req, i) => (
                  <div key={req.id || i} className="flex items-start gap-2 text-xs p-1.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                    <span className={`mt-0.5 px-1 rounded ${
                      req.confidence === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : req.confidence === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>{req.confidence || 'med'}</span>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{req.name}</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-1">- {req.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual Requirements */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span>⚡</span> Additional Requirements
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Toggle project-specific integration and power requirements</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {manualRequirementOptions.map(req => (
                <label
                  key={req.id}
                  className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-all ${
                    selectedManualReqs.includes(req.id)
                      ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-600'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedManualReqs.includes(req.id)}
                    onChange={() => handleManualReqToggle(req.id)}
                    className="mt-0.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{req.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{req.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Run Analysis Button */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedCodes.length + selectedManualReqs.length + specRequirements.length} requirements selected
            </div>
            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || isParsingSpec || (selectedCodes.length + selectedManualReqs.length + specRequirements.length === 0)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  <span>{analysisProgress || 'Analyzing...'}</span>
                </>
              ) : (
                <>
                  <span>🔍</span>
                  <span>{qcResult ? 'Re-run Analysis' : 'Run QC Analysis'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* ===== RESULTS VIEW ===== */
        <ResultsView
          qcResult={qcResult}
          onRerun={() => setActiveView('setup')}
        />
      )}
    </div>
  );
};

// ===== Results View Sub-Component =====

const CollapsibleSection = ({ title, count, countColor, defaultOpen = true, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h4 className="font-medium text-gray-900 dark:text-white">{title}</h4>
        </div>
        {count !== undefined && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${countColor || 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
            {count}
          </span>
        )}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

const ResultsView = ({ qcResult, onRerun }) => {
  if (!qcResult?.summary) {
    return (
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        <p>No analysis results yet. Run a QC analysis to see results.</p>
      </div>
    );
  }

  const { summary, compliance, anomalies, deviceAnalysis } = qcResult;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'met': return '✅';
      case 'partial': return '⚠️';
      case 'unmet': return '❌';
      default: return '❓';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-4">
      {/* Score Card */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className={`rounded-lg p-3 border ${
          summary.score >= 80 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : summary.score >= 50 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className={`text-3xl font-bold ${getScoreColor(summary.score)}`}>{summary.score}%</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Compliance Score</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.met}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Met</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.partial}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Partial</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.unmet}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Unmet</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{summary.anomalyCount}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Anomalies</div>
        </div>
      </div>

      {/* Compliance Breakdown */}
      <CollapsibleSection
        title="Requirements Compliance"
        count={summary.totalRequirements}
        countColor={summary.score >= 80
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : summary.score >= 50
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}
      >
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {compliance.met.map((item) => (
            <div key={item.requirementId} className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/10 rounded border border-green-100 dark:border-green-900/30">
              <span className="mt-0.5">{getStatusIcon('met')}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{item.requirementName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {item.matchedDevices?.map(d => d.catalogNumber).join(', ')}
                </div>
              </div>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{item.source}</span>
            </div>
          ))}

          {compliance.partial.map((item) => (
            <div key={item.requirementId} className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/10 rounded border border-amber-100 dark:border-amber-900/30">
              <span className="mt-0.5">{getStatusIcon('partial')}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{item.requirementName}</div>
                <div className="text-xs text-amber-700 dark:text-amber-400">{item.gap}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {item.matchedDevices?.map(d => d.catalogNumber).join(', ')}
                </div>
              </div>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{item.source}</span>
            </div>
          ))}

          {compliance.unmet.map((item) => (
            <div key={item.requirementId} className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/10 rounded border border-red-100 dark:border-red-900/30">
              <span className="mt-0.5">{getStatusIcon('unmet')}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{item.requirementName}</div>
                <div className="text-xs text-red-700 dark:text-red-400">{item.recommendation}</div>
              </div>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{item.source}</span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Anomalies */}
      {anomalies && anomalies.length > 0 && (
        <CollapsibleSection
          title="Anomalies & Warnings"
          count={anomalies.length}
          countColor={summary.criticalAnomalies > 0
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}
          defaultOpen={summary.criticalAnomalies > 0}
        >
          <div className="space-y-2">
            {anomalies.map((anomaly, i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded border ${
                anomaly.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                : anomaly.severity === 'warning' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
              }`}>
                <span className="mt-0.5">{anomaly.severity === 'critical' ? '🚨' : anomaly.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
                <div>
                  <div className="text-sm text-gray-900 dark:text-white">{anomaly.message}</div>
                  {anomaly.affectedDevices?.length > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Devices: {anomaly.affectedDevices.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Device Capabilities */}
      {deviceAnalysis && deviceAnalysis.length > 0 && (
        <CollapsibleSection
          title="Device Capabilities"
          count={deviceAnalysis.length}
          countColor="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
          defaultOpen={false}
        >
          <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Catalog #</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Device</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qty</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Function</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Categories</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {deviceAnalysis.map((device, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-3 py-2 text-sm font-mono text-gray-900 dark:text-white whitespace-nowrap">
                      {device.catalogNumber}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 max-w-[200px] truncate" title={device.deviceName}>
                      {device.deviceName || device.description}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white text-right font-medium">
                      {device.quantity?.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 max-w-[250px]" title={device.deviceFunction}>
                      {device.deviceFunction}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(device.deviceCategories || []).slice(0, 3).map((cat, ci) => (
                          <span key={ci} className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                            {cat.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {/* Analysis metadata */}
      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-600">
        <span>Analyzed: {new Date(qcResult.analyzedAt).toLocaleString()}</span>
        <div className="flex items-center gap-3">
          <span>{qcResult.analysisTimeMs ? `${(qcResult.analysisTimeMs / 1000).toFixed(1)}s` : ''}</span>
          <button
            onClick={onRerun}
            className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Edit Requirements & Re-run
          </button>
        </div>
      </div>
    </div>
  );
};

export default BOMQCReviewPanel;
