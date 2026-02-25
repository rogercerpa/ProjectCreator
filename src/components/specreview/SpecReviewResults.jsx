import React, { useState, useEffect, useCallback, useMemo } from 'react';

const { electronAPI } = window;

const STATUS_CONFIG = {
  met: { label: 'Met', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: '✅' },
  alternative: { label: 'Alternative', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: '🔄' },
  gap: { label: 'Gap', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: '❌' }
};

const STATUS_OPTIONS = ['met', 'alternative', 'gap'];

const CONFIDENCE_CONFIG = {
  high: { label: 'High', color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400', icon: '●' },
  medium: { label: 'Med', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400', icon: '◐' },
  low: { label: 'Low', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400', icon: '○' }
};

const SpecReviewResults = ({ result, onNewAnalysis, onSaved }) => {
  const [activeSection, setActiveSection] = useState('requirements');
  const [expandedReqs, setExpandedReqs] = useState(new Set());
  const [projects, setProjects] = useState([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSettings, setExportSettings] = useState({
    preparedBy: '',
    agencyName: '',
    customNote: '',
    includeDisclaimer: true
  });

  const [editedRequirements, setEditedRequirements] = useState([]);
  const [editingReqId, setEditingReqId] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (result?.requirements) {
      setEditedRequirements(result.requirements.map(r => ({ ...r })));
      setHasUnsavedChanges(false);
    }
  }, [result]);

  const loadProjects = async () => {
    try {
      const allProjects = await electronAPI.projectsLoadAll();
      if (Array.isArray(allProjects)) {
        setProjects(allProjects);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const requirements = editedRequirements;
  const { preliminaryBOM = [], projectSummary = '' } = result || {};

  const complianceScore = useMemo(() => {
    if (requirements.length === 0) return { score: 0, met: 0, alternative: 0, gap: 0, total: 0 };
    const met = requirements.filter(r => r.status === 'met').length;
    const alternative = requirements.filter(r => r.status === 'alternative').length;
    const gap = requirements.filter(r => r.status === 'gap').length;
    const total = requirements.length;
    const score = Math.round(((met * 1.0 + alternative * 0.5) / total) * 100);
    return { score, met, alternative, gap, total };
  }, [requirements]);

  const gapAnalysis = useMemo(() =>
    requirements.filter(r => r.status === 'gap' || r.status === 'alternative'),
    [requirements]
  );

  const sections = [
    { id: 'requirements', label: 'Requirements', count: requirements.length },
    { id: 'bom', label: 'Preliminary BOM', count: preliminaryBOM.length },
    { id: 'gaps', label: 'Gap Analysis', count: gapAnalysis.length }
  ];

  const toggleReq = (id) => {
    setExpandedReqs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateRequirement = useCallback((reqId, updates) => {
    setEditedRequirements(prev => prev.map(req => {
      if (req.id !== reqId) return req;

      const updated = { ...req, ...updates };

      if (updates.status && updates.status !== req.status && !req.isOverridden) {
        updated.isOverridden = true;
        updated.originalStatus = req.originalStatus || req.status;
        updated.originalDevices = req.originalDevices || req.recommendedDevices;
        updated.overriddenAt = new Date().toISOString();
      }

      if (updates.recommendedDevices && !req.isOverridden) {
        updated.isOverridden = true;
        updated.originalStatus = req.originalStatus || req.status;
        updated.originalDevices = req.originalDevices || req.recommendedDevices;
        updated.overriddenAt = new Date().toISOString();
      }

      if (updates.userNote !== undefined && updates.userNote !== '' && !req.isOverridden) {
        updated.isOverridden = true;
        updated.originalStatus = req.originalStatus || req.status;
        updated.originalDevices = req.originalDevices || req.recommendedDevices;
        updated.overriddenAt = new Date().toISOString();
      }

      return updated;
    }));
    setHasUnsavedChanges(true);
  }, []);

  const addDevice = useCallback((reqId) => {
    setEditedRequirements(prev => prev.map(req => {
      if (req.id !== reqId) return req;
      const devices = [...(req.recommendedDevices || []), {
        catalogNumber: '',
        productFamily: '',
        description: '',
        role: 'primary',
        quantity: '',
        notes: ''
      }];
      return {
        ...req,
        recommendedDevices: devices,
        isOverridden: true,
        originalStatus: req.originalStatus || req.status,
        originalDevices: req.originalDevices || req.recommendedDevices,
        overriddenAt: new Date().toISOString()
      };
    }));
    setHasUnsavedChanges(true);
  }, []);

  const updateDevice = useCallback((reqId, deviceIndex, field, value) => {
    setEditedRequirements(prev => prev.map(req => {
      if (req.id !== reqId) return req;
      const devices = [...(req.recommendedDevices || [])];
      devices[deviceIndex] = { ...devices[deviceIndex], [field]: value };
      return {
        ...req,
        recommendedDevices: devices,
        isOverridden: true,
        originalStatus: req.originalStatus || req.status,
        originalDevices: req.originalDevices || req.recommendedDevices,
        overriddenAt: new Date().toISOString()
      };
    }));
    setHasUnsavedChanges(true);
  }, []);

  const removeDevice = useCallback((reqId, deviceIndex) => {
    setEditedRequirements(prev => prev.map(req => {
      if (req.id !== reqId) return req;
      const devices = (req.recommendedDevices || []).filter((_, i) => i !== deviceIndex);
      return {
        ...req,
        recommendedDevices: devices,
        isOverridden: true,
        originalStatus: req.originalStatus || req.status,
        originalDevices: req.originalDevices || req.recommendedDevices,
        overriddenAt: new Date().toISOString()
      };
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleSaveChanges = async () => {
    if (!result?.reviewId) return;
    setSaveStatus('saving');
    try {
      const res = await electronAPI.specReviewUpdateReview(result.reviewId, {
        requirements: editedRequirements,
        complianceScore
      });
      if (res.success) {
        setSaveStatus('saved');
        setHasUnsavedChanges(false);
        setTimeout(() => setSaveStatus(null), 2000);
        onSaved?.();
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleLinkProject = async (project) => {
    try {
      const res = await electronAPI.specReviewLinkProject(result.reviewId, project.id, project.projectName);
      if (res.success) {
        setShowLinkModal(false);
        onSaved?.();
      }
    } catch (err) {
      console.error('Link failed:', err);
    }
  };

  const handleExportPDF = async () => {
    setShowExportModal(true);
  };

  const generatePDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      const reportEl = document.getElementById('spec-review-report-content');
      if (!reportEl) return;

      reportEl.style.display = 'block';

      const canvas = await html2canvas(reportEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      reportEl.style.display = 'none';

      const pageWidthIn = 8.5;
      const pageHeightIn = 11;
      const marginIn = 0.4;
      const footerHeightIn = 0.45;
      const usableHeightIn = pageHeightIn - footerHeightIn;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });

      const contentWidthIn = pageWidthIn;
      const pixelsPerInch = canvas.width / contentWidthIn;
      const targetSliceHeightPx = Math.floor(usableHeightIn * pixelsPerInch);
      const scanTolerance = Math.floor(pixelsPerInch * 4);
      const minConsecutiveWhite = 6;

      const ctx = canvas.getContext('2d');

      const isRowWhite = (y) => {
        const rowData = ctx.getImageData(0, y, canvas.width, 1).data;
        const sampleStep = 4;
        for (let x = 0; x < canvas.width * 4; x += 4 * sampleStep) {
          const r = rowData[x], g = rowData[x + 1], b = rowData[x + 2];
          if (r < 248 || g < 248 || b < 248) return false;
        }
        return true;
      };

      const findSafeCutRow = (targetY) => {
        const maxY = Math.min(targetY, canvas.height);
        const minY = Math.max(maxY - scanTolerance, 0);
        let consecutive = 0;

        for (let y = maxY; y >= minY; y--) {
          if (isRowWhite(y)) {
            consecutive++;
            if (consecutive >= minConsecutiveWhite) {
              return y + Math.floor(consecutive / 2);
            }
          } else {
            consecutive = 0;
          }
        }

        return maxY;
      };

      const sliceBreaks = [0];
      let currentY = 0;
      while (currentY < canvas.height) {
        const nextTarget = currentY + targetSliceHeightPx;
        if (nextTarget >= canvas.height) {
          sliceBreaks.push(canvas.height);
          break;
        }
        const safeCut = findSafeCutRow(nextTarget);
        sliceBreaks.push(safeCut);
        currentY = safeCut;
      }

      const totalPages = sliceBreaks.length - 1;

      const footerText = 'Acuity Brands | Specification Compliance Review';
      const disclaimerText = 'This analysis is AI-assisted. Final design should be verified by a Design Application Analyst.';

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        const srcY = sliceBreaks[page];
        const srcH = sliceBreaks[page + 1] - srcY;

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = srcH;
        const sliceCtx = sliceCanvas.getContext('2d');
        sliceCtx.fillStyle = '#ffffff';
        sliceCtx.fillRect(0, 0, canvas.width, srcH);
        sliceCtx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        const sliceImgData = sliceCanvas.toDataURL('image/png');
        const sliceHeightIn = (srcH * contentWidthIn) / canvas.width;

        pdf.addImage(sliceImgData, 'PNG', 0, 0, contentWidthIn, sliceHeightIn);

        pdf.setDrawColor(200, 200, 200);
        pdf.line(marginIn, pageHeightIn - footerHeightIn, pageWidthIn - marginIn, pageHeightIn - footerHeightIn);

        pdf.setFontSize(7);
        pdf.setTextColor(150, 150, 150);
        pdf.text(footerText, marginIn, pageHeightIn - 0.22);
        if (exportSettings.includeDisclaimer) {
          pdf.text(disclaimerText, marginIn, pageHeightIn - 0.12);
        }

        const pageLabel = `Page ${page + 1} of ${totalPages}`;
        pdf.text(pageLabel, pageWidthIn - marginIn - pdf.getTextWidth(pageLabel), pageHeightIn - 0.17);

        if (requirements.some(r => r.isOverridden) && page === totalPages - 1) {
          pdf.setFontSize(7);
          pdf.setTextColor(100, 100, 180);
          const editNote = 'Note: Some requirements have been manually edited by the reviewer.';
          pdf.text(editNote, marginIn, pageHeightIn - 0.02);
        }
      }

      const fileName = `Spec_Review_Report_${(result.sourceFile || 'Unknown').replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      setShowExportModal(false);
    } catch (err) {
      console.error('PDF export failed:', err);
    }
  };

  const copyBOMToClipboard = () => {
    const bomText = preliminaryBOM.map(item =>
      `${item.catalogNumber}\t${item.productFamily}\t${item.description}\t${item.suggestedQuantity}\t${item.sourceRequirements.join(', ')}`
    ).join('\n');
    const header = 'Catalog Number\tProduct Family\tDescription\tQuantity\tSource Requirements\n';
    navigator.clipboard.writeText(header + bomText);
  };

  const filteredProjects = projects.filter(p =>
    (p.projectName || '').toLowerCase().includes(linkSearch.toLowerCase()) ||
    (p.rfaNumber || '').toLowerCase().includes(linkSearch.toLowerCase())
  );

  return (
    <div>
      {/* Summary Header */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Analysis Results: {result.sourceFile}
            </h2>
            {projectSummary && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{projectSummary}</p>
            )}

            {/* Score */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className={`text-3xl font-bold ${
                  complianceScore.score >= 80 ? 'text-green-600' :
                  complianceScore.score >= 60 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {complianceScore.score ?? 0}%
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">compliance</span>
              </div>

              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                  {complianceScore.met || 0} met
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                  {complianceScore.alternative || 0} alternatives
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                  {complianceScore.gap || 0} gaps
                </span>
              </div>

              {(() => {
                const highConf = requirements.filter(r => r.confidence === 'high').length;
                const medConf = requirements.filter(r => r.confidence === 'medium').length;
                const lowConf = requirements.filter(r => r.confidence === 'low').length;
                return (lowConf > 0 || medConf > 0) ? (
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">AI Confidence:</span>
                    {highConf > 0 && <span className="flex items-center gap-1"><span className="text-green-600">●</span> {highConf} high</span>}
                    {medConf > 0 && <span className="flex items-center gap-1"><span className="text-amber-500">◐</span> {medConf} medium</span>}
                    {lowConf > 0 && <span className="flex items-center gap-1 text-red-600 font-medium"><span>○</span> {lowConf} low — review recommended</span>}
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 ml-4">
            {hasUnsavedChanges && (
              <button
                onClick={handleSaveChanges}
                disabled={saveStatus === 'saving'}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
              </button>
            )}
            {saveStatus === 'saved' && (
              <span className="text-xs text-green-600 dark:text-green-400 text-center">Changes saved</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs text-red-600 dark:text-red-400 text-center">Save failed</span>
            )}
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              Export PDF
            </button>
            <button
              onClick={() => setShowLinkModal(true)}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Link to Project
            </button>
            <button
              onClick={onNewAnalysis}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              New Analysis
            </button>
          </div>
        </div>

        {hasUnsavedChanges && (
          <div className="mt-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-300">
            You have unsaved changes. Click "Save Changes" to persist your edits.
          </div>
        )}
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 mb-4">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              activeSection === s.id
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 font-medium'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {s.label} ({s.count})
          </button>
        ))}
      </div>

      {/* Requirements Section */}
      {activeSection === 'requirements' && (
        <div className="space-y-2">
          {requirements.map(req => {
            const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.gap;
            const isExpanded = expandedReqs.has(req.id);
            const isEditing = editingReqId === req.id;

            return (
              <div key={req.id} className={`border rounded-lg overflow-hidden ${
                req.isOverridden
                  ? 'border-blue-300 dark:border-blue-700'
                  : 'border-gray-200 dark:border-gray-700'
              }`}>
                <button
                  onClick={() => toggleReq(req.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <span className="text-lg">{config.icon}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                    {config.label}
                  </span>
                  {req.confidence && CONFIDENCE_CONFIG[req.confidence] && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CONFIDENCE_CONFIG[req.confidence].color}`} title={`AI Confidence: ${req.confidence}`}>
                      {CONFIDENCE_CONFIG[req.confidence].icon} {CONFIDENCE_CONFIG[req.confidence].label}
                    </span>
                  )}
                  {req.isOverridden && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      Edited
                    </span>
                  )}
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{req.name}</span>
                  <span className="text-xs text-gray-400">{req.category}</span>
                  <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-800">
                    {/* Spec Excerpt Blockquote */}
                    {req.specExcerpt && (
                      <div className="mb-3 pl-3 border-l-4 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/10 rounded-r-lg py-2 pr-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-400">Spec Reference</span>
                          {req.sourceSection && (
                            <span className="text-xs text-blue-500 dark:text-blue-400">— {req.sourceSection}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">
                          "{req.specExcerpt}"
                        </p>
                      </div>
                    )}

                    {!req.specExcerpt && req.sourceSection && (
                      <p className="text-xs text-gray-400 mb-3">Source: {req.sourceSection}</p>
                    )}

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{req.description}</p>

                    {req.confidence === 'low' && !req.isOverridden && (
                      <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">
                        Low confidence — The spec language for this requirement is ambiguous. Please verify this classification manually.
                      </div>
                    )}

                    {/* Override info */}
                    {req.isOverridden && req.originalStatus && (
                      <div className="mb-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/10 rounded text-xs text-blue-700 dark:text-blue-300">
                        Originally classified as <strong>{STATUS_CONFIG[req.originalStatus]?.label || req.originalStatus}</strong> by AI analysis
                      </div>
                    )}

                    {/* Recommended Devices (read mode) */}
                    {!isEditing && req.recommendedDevices && req.recommendedDevices.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Recommended Devices</h4>
                        <div className="space-y-1">
                          {req.recommendedDevices.map((dev, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                dev.role === 'primary'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                              }`}>
                                {dev.role}
                              </span>
                              <span className="font-mono font-medium text-gray-800 dark:text-gray-200">{dev.catalogNumber}</span>
                              <span className="text-gray-500 dark:text-gray-400 flex-1">{dev.description}</span>
                              {dev.quantity && (
                                <span className="text-xs text-gray-400">{dev.quantity}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* User Note (read mode) */}
                    {!isEditing && req.userNote && (
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded text-sm text-blue-800 dark:text-blue-300">
                        <span className="font-semibold text-xs uppercase text-blue-600 dark:text-blue-400 block mb-1">User Note</span>
                        {req.userNote}
                      </div>
                    )}

                    {req.gapNote && !isEditing && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded text-sm text-amber-800 dark:text-amber-300 mb-3">
                        {req.gapNote}
                      </div>
                    )}

                    {/* Edit Panel */}
                    {isEditing && (
                      <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
                        {/* Status Override */}
                        <div>
                          <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Status</label>
                          <div className="flex gap-2">
                            {STATUS_OPTIONS.map(s => {
                              const sc = STATUS_CONFIG[s];
                              return (
                                <button
                                  key={s}
                                  onClick={() => updateRequirement(req.id, { status: s })}
                                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                    req.status === s
                                      ? sc.color + ' ring-2 ring-offset-1 ring-gray-400'
                                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  }`}
                                >
                                  {sc.icon} {sc.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Device Editing */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold uppercase text-gray-500">Recommended Devices</label>
                            <button
                              onClick={() => addDevice(req.id)}
                              className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                            >
                              + Add Device
                            </button>
                          </div>
                          <div className="space-y-2">
                            {(req.recommendedDevices || []).map((dev, i) => (
                              <div key={i} className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700">
                                <select
                                  value={dev.role}
                                  onChange={e => updateDevice(req.id, i, 'role', e.target.value)}
                                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                                >
                                  <option value="primary">Primary</option>
                                  <option value="alternative">Alternative</option>
                                </select>
                                <input
                                  type="text"
                                  value={dev.catalogNumber}
                                  onChange={e => updateDevice(req.id, i, 'catalogNumber', e.target.value)}
                                  placeholder="Catalog #"
                                  className="flex-1 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                                />
                                <input
                                  type="text"
                                  value={dev.description}
                                  onChange={e => updateDevice(req.id, i, 'description', e.target.value)}
                                  placeholder="Description"
                                  className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                                />
                                <button
                                  onClick={() => removeDevice(req.id, i)}
                                  className="text-red-500 hover:text-red-700 text-xs px-1"
                                  title="Remove device"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* User Note */}
                        <div>
                          <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Your Note</label>
                          <textarea
                            value={req.userNote || ''}
                            onChange={e => updateRequirement(req.id, { userNote: e.target.value })}
                            rows={2}
                            placeholder="Add a note explaining why you changed this, or what Acuity product/service actually meets this requirement..."
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-white resize-none"
                          />
                        </div>

                        {/* Gap Note */}
                        <div>
                          <label className="block text-xs font-semibold uppercase text-gray-500 mb-2">Gap / Alternative Note</label>
                          <textarea
                            value={req.gapNote || ''}
                            onChange={e => updateRequirement(req.id, { gapNote: e.target.value })}
                            rows={2}
                            placeholder="Explanation for gap or alternative status..."
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-white resize-none"
                          />
                        </div>

                        <div className="flex justify-end">
                          <button
                            onClick={() => setEditingReqId(null)}
                            className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                          >
                            Done Editing
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Edit toggle button */}
                    {!isEditing && (
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingReqId(req.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
                        >
                          <span>✏️</span> Edit
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Preliminary BOM Section */}
      {activeSection === 'bom' && (
        <div>
          <div className="flex justify-end mb-3">
            <button
              onClick={copyBOMToClipboard}
              className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            >
              Copy to Clipboard
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Catalog Number</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Product Family</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Qty Guidance</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Source Requirements</th>
                </tr>
              </thead>
              <tbody>
                {preliminaryBOM.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono font-medium text-gray-800 dark:text-gray-200">{item.catalogNumber}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.productFamily}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.description}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{item.suggestedQuantity}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.sourceRequirements.map((sr, j) => (
                          <span key={j} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs">
                            {sr}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gap Analysis Section */}
      {activeSection === 'gaps' && (
        <div className="space-y-3">
          {gapAnalysis.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-3">🎉</div>
              <p>No gaps found — Acuity products meet all identified requirements!</p>
            </div>
          ) : (
            gapAnalysis.map(req => {
              const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.gap;
              return (
                <div key={req.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg">{config.icon}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>{config.label}</span>
                    {req.confidence && CONFIDENCE_CONFIG[req.confidence] && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CONFIDENCE_CONFIG[req.confidence].color}`} title={`AI Confidence: ${req.confidence}`}>
                        {CONFIDENCE_CONFIG[req.confidence].icon} {CONFIDENCE_CONFIG[req.confidence].label}
                      </span>
                    )}
                    {req.isOverridden && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Edited</span>
                    )}
                    <span className="font-medium text-gray-800 dark:text-gray-200">{req.name}</span>
                  </div>

                  {req.specExcerpt && (
                    <div className="mb-2 pl-3 border-l-4 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/10 rounded-r py-2 pr-3">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {req.sourceSection ? `Spec: ${req.sourceSection}` : 'Spec Reference'}
                      </span>
                      <p className="text-xs text-gray-600 dark:text-gray-400 italic mt-1">"{req.specExcerpt}"</p>
                    </div>
                  )}

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{req.description}</p>
                  {req.gapNote && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded text-sm text-amber-800 dark:text-amber-300">
                      {req.gapNote}
                    </div>
                  )}
                  {req.userNote && (
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded text-sm text-blue-800 dark:text-blue-300">
                      <span className="font-semibold text-xs uppercase text-blue-600 dark:text-blue-400 block mb-1">User Note</span>
                      {req.userNote}
                    </div>
                  )}
                  {req.recommendedDevices && req.recommendedDevices.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-semibold text-gray-500">Suggested alternatives: </span>
                      {req.recommendedDevices.map((d, i) => (
                        <span key={i} className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded mr-1">
                          {d.catalogNumber}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Link to Project Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowLinkModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Link to Project</h3>
              <input
                type="text"
                placeholder="Search projects..."
                value={linkSearch}
                onChange={e => setLinkSearch(e.target.value)}
                className="mt-3 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredProjects.slice(0, 20).map(p => (
                <button
                  key={p.id}
                  onClick={() => handleLinkProject(p)}
                  className="w-full px-4 py-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.projectName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{p.rfaNumber} — {p.agencyName || 'No agency'}</div>
                </button>
              ))}
            </div>
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowLinkModal(false)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Export PDF Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowExportModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Export PDF Report</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prepared By</label>
                <input
                  type="text"
                  value={exportSettings.preparedBy}
                  onChange={e => setExportSettings(prev => ({ ...prev, preparedBy: e.target.value }))}
                  placeholder="Your name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agency Name</label>
                <input
                  type="text"
                  value={exportSettings.agencyName}
                  onChange={e => setExportSettings(prev => ({ ...prev, agencyName: e.target.value }))}
                  placeholder="Agency name (optional)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Custom Note (optional)</label>
                <textarea
                  value={exportSettings.customNote}
                  onChange={e => setExportSettings(prev => ({ ...prev, customNote: e.target.value }))}
                  rows={3}
                  placeholder="Add a note for this report..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportSettings.includeDisclaimer}
                  onChange={e => setExportSettings(prev => ({ ...prev, includeDisclaimer: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Include AI Disclaimer</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">Cancel</button>
              <button onClick={generatePDF} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg">Generate PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden PDF Report Template */}
      <div id="spec-review-report-content" style={{ display: 'none', width: '816px', padding: '40px 48px', fontFamily: 'Arial, Helvetica, sans-serif', backgroundColor: '#ffffff', color: '#1a1a1a', lineHeight: '1.4' }}>

        {/* Cover Header */}
        <div style={{ borderBottom: '3px solid #1e40af', paddingBottom: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e40af', margin: '0 0 6px 0' }}>Specification Compliance Review</h1>
              <p style={{ fontSize: '13px', color: '#555', margin: '0 0 3px 0' }}>
                {result.sourceFile}{exportSettings.agencyName ? ` | ${exportSettings.agencyName}` : ''}
              </p>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
                {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                {exportSettings.preparedBy ? ` | Prepared by: ${exportSettings.preparedBy}` : ''}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#888' }}>Acuity Brands</div>
              <div style={{ fontSize: '11px', color: '#888' }}>Design & Application Services</div>
            </div>
          </div>
          {exportSettings.customNote && (
            <p style={{ fontSize: '12px', color: '#555', marginTop: '10px', fontStyle: 'italic', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>{exportSettings.customNote}</p>
          )}
        </div>

        {/* Project Summary */}
        {projectSummary && (
          <div style={{ marginBottom: '18px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: '#374151' }}>Project Summary</h2>
            <p style={{ fontSize: '12px', color: '#444', margin: 0 }}>{projectSummary}</p>
          </div>
        )}

        {/* Important Disclaimer */}
        {exportSettings.includeDisclaimer && (
          <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', breakInside: 'avoid' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Important Disclaimer</div>
            <div style={{ fontSize: '10px', color: '#78350f', lineHeight: '1.6' }}>
              This report is generated using AI-assisted analysis and is <strong>not guaranteed to be 100% accurate</strong>.
              Some specification sections may contain ambiguous language that the AI could misinterpret.
              All results — particularly items marked as "Gap" or with low confidence — should be validated by a Design Application Analyst before use in client-facing materials.
              The compliance score is an estimate based on AI interpretation and should not be treated as a definitive assessment.
            </div>
          </div>
        )}

        {/* Compliance Score */}
        <div style={{ marginBottom: '14px', padding: '14px 18px', backgroundColor: '#f3f4f6', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: complianceScore.score >= 80 ? '#16a34a' : complianceScore.score >= 60 ? '#d97706' : '#dc2626', lineHeight: 1 }}>
            {complianceScore.score}%
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '2px' }}>Overall Compliance</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              <span style={{ color: '#16a34a', fontWeight: '600' }}>{complianceScore.met}</span> met
              <span style={{ margin: '0 6px', color: '#ccc' }}>|</span>
              <span style={{ color: '#d97706', fontWeight: '600' }}>{complianceScore.alternative}</span> alternatives
              <span style={{ margin: '0 6px', color: '#ccc' }}>|</span>
              <span style={{ color: '#dc2626', fontWeight: '600' }}>{complianceScore.gap}</span> gaps
              <span style={{ margin: '0 6px', color: '#ccc' }}>|</span>
              <span style={{ fontWeight: '600' }}>{editedRequirements.length}</span> total
            </div>
          </div>
        </div>

        {/* AI Confidence Summary */}
        {(() => {
          const highConf = editedRequirements.filter(r => r.confidence === 'high').length;
          const medConf = editedRequirements.filter(r => r.confidence === 'medium').length;
          const lowConf = editedRequirements.filter(r => r.confidence === 'low').length;
          return (
            <div style={{ marginBottom: '18px', padding: '10px 14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', breakInside: 'avoid' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>AI Confidence Summary</div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#4b5563' }}>
                <span><span style={{ color: '#16a34a', fontWeight: 'bold' }}>{highConf}</span> High confidence — explicit, clear spec language</span>
                <span><span style={{ color: '#d97706', fontWeight: 'bold' }}>{medConf}</span> Medium — implied or inferred from context</span>
                <span><span style={{ color: '#dc2626', fontWeight: 'bold' }}>{lowConf}</span> Low — ambiguous, manual review recommended</span>
              </div>
            </div>
          );
        })()}

        {/* Requirements Analysis */}
        <h2 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '10px', color: '#1e40af', borderBottom: '1px solid #dbeafe', paddingBottom: '6px' }}>Requirements Analysis</h2>
        {editedRequirements.map((req, i) => (
          <div key={i} style={{ marginBottom: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', backgroundColor: req.status === 'met' ? '#f0fdf4' : req.status === 'alternative' ? '#fffbeb' : '#fef2f2' }}>
              <span style={{
                fontSize: '9px', fontWeight: 'bold', padding: '2px 7px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.5px',
                color: req.status === 'met' ? '#15803d' : req.status === 'alternative' ? '#b45309' : '#b91c1c',
                backgroundColor: req.status === 'met' ? '#bbf7d0' : req.status === 'alternative' ? '#fde68a' : '#fecaca'
              }}>
                {req.status === 'met' ? 'MET' : req.status === 'alternative' ? 'ALT' : 'GAP'}
              </span>
              {req.confidence && (
                <span style={{
                  fontSize: '8px', fontWeight: 'bold', padding: '2px 5px', borderRadius: '3px',
                  color: req.confidence === 'high' ? '#15803d' : req.confidence === 'medium' ? '#b45309' : '#b91c1c',
                  backgroundColor: req.confidence === 'high' ? '#dcfce7' : req.confidence === 'medium' ? '#fef3c7' : '#fee2e2'
                }}>
                  {req.confidence === 'high' ? 'HIGH' : req.confidence === 'medium' ? 'MED' : 'LOW'}
                </span>
              )}
              {req.isOverridden && (
                <span style={{ fontSize: '8px', fontWeight: 'bold', padding: '2px 5px', borderRadius: '3px', color: '#1d4ed8', backgroundColor: '#dbeafe' }}>EDITED</span>
              )}
              <span style={{ fontSize: '11px', fontWeight: 'bold', flex: 1, color: '#1f2937' }}>{req.name}</span>
              {req.category && <span style={{ fontSize: '9px', color: '#9ca3af', fontWeight: '500' }}>{req.category}</span>}
            </div>

            <div style={{ padding: '8px 10px' }}>
              {req.specExcerpt && (
                <div style={{ marginBottom: '6px', paddingLeft: '8px', borderLeft: '3px solid #93c5fd', backgroundColor: '#eff6ff', padding: '6px 10px', borderRadius: '0 4px 4px 0' }}>
                  <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#2563eb', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Spec Reference{req.sourceSection ? `: ${req.sourceSection}` : ''}
                  </div>
                  <div style={{ fontSize: '10px', color: '#374151', fontStyle: 'italic', lineHeight: '1.5' }}>
                    &ldquo;{req.specExcerpt}&rdquo;
                  </div>
                </div>
              )}

              <p style={{ fontSize: '10px', color: '#555', margin: '0 0 4px 0' }}>{req.description}</p>

              {req.recommendedDevices && req.recommendedDevices.length > 0 && (
                <div style={{ marginBottom: '4px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase', lineHeight: '20px' }}>Devices: </span>
                  {req.recommendedDevices.filter(d => d.catalogNumber).map((d, j) => (
                    <span key={j} style={{ display: 'inline-block', fontSize: '9px', fontFamily: 'Consolas, monospace', backgroundColor: '#e5e7eb', color: '#1f2937', padding: '2px 6px', borderRadius: '3px', lineHeight: '16px', verticalAlign: 'middle' }}>
                      {d.catalogNumber}{d.role === 'alternative' ? ' (alt)' : ''}
                    </span>
                  ))}
                </div>
              )}

              {req.gapNote && (
                <div style={{ fontSize: '10px', color: '#92400e', backgroundColor: '#fef3c7', padding: '5px 8px', borderRadius: '3px', marginBottom: '4px', borderLeft: '3px solid #f59e0b' }}>
                  {req.gapNote}
                </div>
              )}

              {req.userNote && (
                <div style={{ fontSize: '10px', color: '#1e40af', backgroundColor: '#dbeafe', padding: '5px 8px', borderRadius: '3px', marginBottom: '4px', borderLeft: '3px solid #3b82f6' }}>
                  <strong style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>User Note:</strong> {req.userNote}
                </div>
              )}

              {req.isOverridden && req.originalStatus && (
                <div style={{ fontSize: '9px', color: '#6b7280', fontStyle: 'italic' }}>
                  AI originally classified as &ldquo;{req.originalStatus}&rdquo;
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Preliminary BOM */}
        {preliminaryBOM.length > 0 && (
          <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginTop: '20px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '8px', color: '#1e40af', borderBottom: '1px solid #dbeafe', paddingBottom: '6px' }}>Preliminary BOM</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '18px' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e40af' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#ffffff', fontWeight: '600', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Catalog Number</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#ffffff', fontWeight: '600', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Product Family</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#ffffff', fontWeight: '600', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#ffffff', fontWeight: '600', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Qty Guidance</th>
                </tr>
              </thead>
              <tbody>
                {preliminaryBOM.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '5px 8px', fontFamily: 'Consolas, monospace', fontWeight: 'bold', color: '#1f2937' }}>{item.catalogNumber}</td>
                    <td style={{ padding: '5px 8px', color: '#6b7280' }}>{item.productFamily}</td>
                    <td style={{ padding: '5px 8px', color: '#374151' }}>{item.description}</td>
                    <td style={{ padding: '5px 8px', color: '#6b7280', fontSize: '9px' }}>{item.suggestedQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Gap Analysis Summary */}
        {gapAnalysis.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '8px', color: '#dc2626', borderBottom: '1px solid #fecaca', paddingBottom: '6px' }}>Gap Analysis Summary</h2>
            {gapAnalysis.map((req, i) => (
              <div key={i} style={{ padding: '8px 10px', marginBottom: '6px', backgroundColor: req.status === 'gap' ? '#fef2f2' : '#fffbeb', borderRadius: '4px', borderLeft: `3px solid ${req.status === 'gap' ? '#dc2626' : '#d97706'}`, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '11px', color: '#1f2937' }}>{req.name}</span>
                  {req.isOverridden && (
                    <span style={{ fontSize: '8px', fontWeight: 'bold', padding: '1px 5px', borderRadius: '2px', color: '#1d4ed8', backgroundColor: '#dbeafe' }}>EDITED</span>
                  )}
                </div>
                {req.specExcerpt && (
                  <div style={{ fontSize: '10px', color: '#374151', fontStyle: 'italic', marginBottom: '3px' }}>
                    Spec: &ldquo;{req.specExcerpt.length > 200 ? req.specExcerpt.substring(0, 200) + '...' : req.specExcerpt}&rdquo;
                  </div>
                )}
                <div style={{ fontSize: '10px', color: '#555' }}>{req.gapNote}</div>
                {req.userNote && (
                  <div style={{ fontSize: '10px', color: '#1e40af', marginTop: '3px' }}><strong style={{ fontSize: '8px', textTransform: 'uppercase' }}>User Note:</strong> {req.userNote}</div>
                )}
                {req.recommendedDevices && req.recommendedDevices.length > 0 && (
                  <div style={{ marginTop: '3px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#4b5563', lineHeight: '20px' }}>Suggested: </span>
                    {req.recommendedDevices.filter(d => d.catalogNumber).map((d, j) => (
                      <span key={j} style={{ display: 'inline-block', fontSize: '9px', fontFamily: 'Consolas, monospace', backgroundColor: '#e5e7eb', color: '#1f2937', padding: '2px 6px', borderRadius: '3px', lineHeight: '16px', verticalAlign: 'middle' }}>
                        {d.catalogNumber}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* End spacer — actual footer is rendered programmatically per page */}
        <div style={{ height: '20px' }} />
      </div>
    </div>
  );
};

export default SpecReviewResults;
