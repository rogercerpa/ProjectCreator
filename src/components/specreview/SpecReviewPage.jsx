import React, { useState, useEffect, useCallback } from 'react';
import SpecReviewResults from './SpecReviewResults';
import SpecReviewHistory from './SpecReviewHistory';
import KnowledgeBaseManager from './KnowledgeBaseManager';

const { electronAPI } = window;

const TABS = [
  { id: 'analyze', label: 'Scan Spec', icon: '🔍' },
  { id: 'history', label: 'Review History', icon: '📋' },
  { id: 'knowledge-base', label: 'Knowledge Base', icon: '📚' }
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt'];

const SpecReviewPage = () => {
  const [activeTab, setActiveTab] = useState('analyze');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [notification, setNotification] = useState(null);
  const [kbSummary, setKbSummary] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadKBSummary();
    const cleanup = electronAPI.onSpecReviewProgress?.((progress) => {
      setAnalysisProgress(progress);
    });
    return () => { if (cleanup) cleanup(); };
  }, []);

  const loadKBSummary = async () => {
    try {
      const result = await electronAPI.kbGetSummary();
      if (result.success) setKbSummary(result.summary);
    } catch (err) {
      console.error('Failed to load KB summary:', err);
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSelectFile = async () => {
    try {
      const result = await electronAPI.specReviewSelectFile();
      if (result.success) {
        setSelectedFile(result.filePath);
        setAnalysisResult(null);
      }
    } catch (error) {
      showNotification(`Error selecting file: ${error.message}`, 'error');
    }
  };

  const acceptFilePath = (filePath) => {
    const ext = '.' + filePath.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      showNotification(`Unsupported file type: ${ext}. Use PDF, DOCX, or TXT files.`, 'error');
      return;
    }
    setSelectedFile(filePath);
    setAnalysisResult(null);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const filePath = window.electronAPI.getPathForFile
      ? window.electronAPI.getPathForFile(file)
      : file.path;
    if (!filePath) {
      showNotification('Could not read file path', 'error');
      return;
    }
    acceptFilePath(filePath);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setAnalysisProgress('Starting scan...');
    setAnalysisResult(null);

    try {
      const result = await electronAPI.specReviewAnalyze(selectedFile);
      if (result.success) {
        setAnalysisResult(result);
        const saveResult = await electronAPI.specReviewSave(result);
        showNotification(saveResult.success ? 'Scan saved.' : 'Scan finished, but it could not be saved.', saveResult.success ? 'success' : 'error');
      } else {
        showNotification(result.error || 'Scan failed.', 'error');
      }
    } catch (error) {
      showNotification(error.message || 'Scan failed.', 'error');
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  const handleLoadReview = useCallback(async (reviewId) => {
    try {
      const result = await electronAPI.specReviewGet(reviewId);
      if (result.success) {
        setAnalysisResult(result.review);
        setActiveTab('analyze');
        setSelectedFile(result.review.sourceFile || null);
      } else {
        showNotification('Failed to load review', 'error');
      }
    } catch (error) {
      showNotification(error.message, 'error');
    }
  }, []);

  const handleDeleteReview = useCallback(async (reviewId) => {
    try {
      const result = await electronAPI.specReviewDelete(reviewId);
      if (result.success) {
        showNotification('Review deleted', 'success');
        if (analysisResult?.reviewId === reviewId) setAnalysisResult(null);
      }
    } catch (error) {
      showNotification(error.message, 'error');
    }
  }, [analysisResult]);

  const fileName = selectedFile ? selectedFile.split(/[/\\]/).pop() : null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Spec Review</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Scan a specification against the product knowledge base. Matches stay inside the lighting-controls section and ignore generic words.
          </p>
        </div>
        {kbSummary && (
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{kbSummary.activeProducts} products</span>
            <span>{kbSummary.totalSpecRules} spec rules</span>
          </div>
        )}
      </div>

      {notification && (
        <div className={`mx-6 mt-3 px-4 py-3 rounded-lg text-sm ${
          notification.type === 'error' ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
          notification.type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
          'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'analyze' && (
          <div className="p-6">
            {!analysisResult && (
              <div className="max-w-2xl mx-auto">
                <div
                  onClick={handleSelectFile}
                  onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }}
                  onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    if (event.currentTarget.contains(event.relatedTarget)) return;
                    setIsDragging(false);
                  }}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                  }`}
                >
                  <div className="text-5xl mb-4">{isDragging ? '📥' : '📄'}</div>
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {fileName || 'Select specification document'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Drag and drop or click to browse. PDF, DOCX, or TXT.
                  </p>
                </div>

                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  Rules match when their keywords appear together, not just somewhere in the book. Prefix a keyword with a minus sign in the knowledge base, such as <span className="font-mono">-emergency</span>, to ignore a nearby false hit.
                </p>

                {selectedFile && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="px-8 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-medium rounded-lg text-sm"
                    >
                      {isAnalyzing ? 'Scanning...' : 'Scan specification'}
                    </button>
                  </div>
                )}

                {isAnalyzing && (
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center gap-3">
                    <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full" />
                    <span className="text-sm text-blue-800 dark:text-blue-300">{analysisProgress || 'Processing...'}</span>
                  </div>
                )}
              </div>
            )}

            {analysisResult && (
              <SpecReviewResults
                result={analysisResult}
                onNewAnalysis={() => {
                  setAnalysisResult(null);
                  setSelectedFile(null);
                }}
              />
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <SpecReviewHistory
            onLoadReview={handleLoadReview}
            onDeleteReview={handleDeleteReview}
            currentReviewId={analysisResult?.reviewId}
          />
        )}

        {activeTab === 'knowledge-base' && (
          <KnowledgeBaseManager onRefresh={loadKBSummary} />
        )}
      </div>
    </div>
  );
};

export default SpecReviewPage;
