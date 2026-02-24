import React, { useState, useEffect } from 'react';

const { electronAPI } = window;

const STATUS_CONFIG = {
  met: { label: 'Met', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: '✅' },
  alternative: { label: 'Alternative', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: '🔄' },
  gap: { label: 'Gap', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: '❌' }
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
    customNote: ''
  });

  useEffect(() => {
    loadProjects();
  }, []);

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

  const { requirements = [], preliminaryBOM = [], complianceScore = {}, projectSummary = '', gapAnalysis = [] } = result || {};
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

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
      const imgWidth = 8.5;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageHeight = 11;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = -pageHeight + (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, -heightLeft, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `Spec_Review_Report_${(result.sourceFile || 'Unknown').replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      reportEl.style.display = 'none';
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
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 ml-4">
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

            return (
              <div key={req.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleReq(req.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <span className="text-lg">{config.icon}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                    {config.label}
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{req.name}</span>
                  <span className="text-xs text-gray-400">{req.category}</span>
                  <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{req.description}</p>

                    {req.sourceSection && (
                      <p className="text-xs text-gray-400 mb-3">Source: {req.sourceSection}</p>
                    )}

                    {req.recommendedDevices && req.recommendedDevices.length > 0 && (
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

                    {req.gapNote && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded text-sm text-amber-800 dark:text-amber-300">
                        {req.gapNote}
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
                    <span className="font-medium text-gray-800 dark:text-gray-200">{req.name}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{req.description}</p>
                  {req.gapNote && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded text-sm text-amber-800 dark:text-amber-300">
                      {req.gapNote}
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
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">Cancel</button>
              <button onClick={generatePDF} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg">Generate PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden PDF Report Template */}
      <div id="spec-review-report-content" style={{ display: 'none', width: '816px', padding: '48px', fontFamily: 'Arial, sans-serif', backgroundColor: '#ffffff', color: '#1a1a1a' }}>
        <div style={{ borderBottom: '3px solid #1e40af', paddingBottom: '24px', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e40af', margin: 0 }}>Specification Compliance Review</h1>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
            {result.sourceFile} {exportSettings.agencyName ? `| ${exportSettings.agencyName}` : ''}
          </p>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            {new Date().toLocaleDateString()} {exportSettings.preparedBy ? `| Prepared by: ${exportSettings.preparedBy}` : ''}
          </p>
          {exportSettings.customNote && (
            <p style={{ fontSize: '13px', color: '#555', marginTop: '12px', fontStyle: 'italic' }}>{exportSettings.customNote}</p>
          )}
        </div>

        {projectSummary && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>Project Summary</h2>
            <p style={{ fontSize: '13px', color: '#444' }}>{projectSummary}</p>
          </div>
        )}

        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: complianceScore.score >= 80 ? '#16a34a' : complianceScore.score >= 60 ? '#d97706' : '#dc2626' }}>
            {complianceScore.score}%
          </span>
          <span style={{ fontSize: '14px', color: '#666', marginLeft: '12px' }}>
            {complianceScore.met} met | {complianceScore.alternative} alternatives | {complianceScore.gap} gaps
          </span>
        </div>

        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>Requirements Analysis</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '24px' }}>
          <thead>
            <tr style={{ backgroundColor: '#e5e7eb' }}>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>Status</th>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>Requirement</th>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>Category</th>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>Recommended Device(s)</th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((req, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px', color: req.status === 'met' ? '#16a34a' : req.status === 'alternative' ? '#d97706' : '#dc2626', fontWeight: 'bold' }}>
                  {req.status === 'met' ? 'MET' : req.status === 'alternative' ? 'ALT' : 'GAP'}
                </td>
                <td style={{ padding: '8px' }}>{req.name}</td>
                <td style={{ padding: '8px', color: '#666' }}>{req.category}</td>
                <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '10px' }}>
                  {(req.recommendedDevices || []).filter(d => d.role === 'primary').map(d => d.catalogNumber).join(', ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {preliminaryBOM.length > 0 && (
          <>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>Preliminary BOM</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '24px' }}>
              <thead>
                <tr style={{ backgroundColor: '#e5e7eb' }}>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>Catalog Number</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>Product Family</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>Description</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>Qty Guidance</th>
                </tr>
              </thead>
              <tbody>
                {preliminaryBOM.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 'bold' }}>{item.catalogNumber}</td>
                    <td style={{ padding: '8px', color: '#666' }}>{item.productFamily}</td>
                    <td style={{ padding: '8px' }}>{item.description}</td>
                    <td style={{ padding: '8px', color: '#666', fontSize: '10px' }}>{item.suggestedQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {gapAnalysis.length > 0 && (
          <>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>Gap Analysis</h2>
            {gapAnalysis.map((req, i) => (
              <div key={i} style={{ padding: '12px', marginBottom: '8px', backgroundColor: '#fef3c7', borderRadius: '6px', borderLeft: '4px solid #d97706' }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>{req.name}</div>
                <div style={{ fontSize: '12px', color: '#555' }}>{req.gapNote}</div>
              </div>
            ))}
          </>
        )}

        <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #d1d5db', fontSize: '10px', color: '#999' }}>
          This analysis is based on the provided specification document and the current Acuity Brands product portfolio.
          Final design should be verified by a Design Application Analyst.
        </div>
      </div>
    </div>
  );
};

export default SpecReviewResults;
