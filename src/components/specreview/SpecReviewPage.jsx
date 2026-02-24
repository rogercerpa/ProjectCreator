import React, { useState, useEffect, useCallback } from 'react';
import SpecReviewResults from './SpecReviewResults';
import SpecReviewHistory from './SpecReviewHistory';
import KnowledgeBaseManager from './KnowledgeBaseManager';

const { electronAPI } = window;

const TABS = [
  { id: 'analyze', label: 'Analyze Spec', icon: '🔍' },
  { id: 'history', label: 'Review History', icon: '📋' },
  { id: 'knowledge-base', label: 'Knowledge Base', icon: '📚' }
];

const SpecReviewPage = () => {
  const [activeTab, setActiveTab] = useState('analyze');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [hasAIKey, setHasAIKey] = useState(false);
  const [notification, setNotification] = useState(null);
  const [kbSummary, setKbSummary] = useState(null);

  useEffect(() => {
    checkAIKey();
    loadKBSummary();

    const cleanup = electronAPI.onSpecReviewProgress?.((progress) => {
      setAnalysisProgress(progress);
    });

    return () => { if (cleanup) cleanup(); };
  }, []);

  const checkAIKey = async () => {
    try {
      const result = await electronAPI.aiHasKey();
      setHasAIKey(result?.hasKey || false);
    } catch { setHasAIKey(false); }
  };

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

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setAnalysisProgress('Starting analysis...');
    setAnalysisResult(null);

    try {
      const result = await electronAPI.specReviewAnalyze(selectedFile);

      if (result.success) {
        setAnalysisResult(result);
        showNotification('Spec analysis complete!', 'success');

        const saveResult = await electronAPI.specReviewSave(result);
        if (saveResult.success) {
          showNotification('Analysis saved successfully', 'success');
        }
      } else {
        showNotification(`Analysis failed: ${result.error}`, 'error');
      }
    } catch (error) {
      showNotification(`Analysis error: ${error.message}`, 'error');
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
      showNotification(`Error loading review: ${error.message}`, 'error');
    }
  }, []);

  const handleDeleteReview = useCallback(async (reviewId) => {
    try {
      const result = await electronAPI.specReviewDelete(reviewId);
      if (result.success) {
        showNotification('Review deleted', 'success');
        if (analysisResult?.reviewId === reviewId) {
          setAnalysisResult(null);
        }
      }
    } catch (error) {
      showNotification(`Error deleting review: ${error.message}`, 'error');
    }
  }, [analysisResult]);

  const fileName = selectedFile ? selectedFile.split(/[/\\]/).pop() : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Spec Review</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Analyze project specifications against Acuity lighting controls products
          </p>
        </div>

        {kbSummary && (
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{kbSummary.activeProducts} products</span>
            <span>{kbSummary.totalSpecRules} spec rules</span>
          </div>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mx-6 mt-3 px-4 py-3 rounded-lg text-sm ${
          notification.type === 'error' ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
          notification.type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
          'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Tabs */}
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

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'analyze' && (
          <div className="p-6">
            {!hasAIKey && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  AI API key required. Go to Settings &gt; AI Configuration to set up your API key.
                </p>
              </div>
            )}

            {/* Upload Section */}
            {!analysisResult && (
              <div className="max-w-2xl mx-auto">
                <div
                  onClick={handleSelectFile}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all"
                >
                  <div className="text-5xl mb-4">📄</div>
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {fileName ? fileName : 'Select Specification Document'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {fileName
                      ? 'Click to change file'
                      : 'Supports PDF, DOCX, and TXT files'
                    }
                  </p>
                </div>

                {selectedFile && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !hasAIKey}
                      className="px-8 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                      {isAnalyzing ? 'Analyzing...' : 'Analyze Specification'}
                    </button>
                  </div>
                )}

                {/* Progress */}
                {isAnalyzing && (
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full" />
                      <span className="text-sm text-blue-800 dark:text-blue-300">
                        {analysisProgress || 'Processing...'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Results */}
            {analysisResult && (
              <SpecReviewResults
                result={analysisResult}
                onNewAnalysis={() => {
                  setAnalysisResult(null);
                  setSelectedFile(null);
                }}
                onSaved={() => showNotification('Review saved', 'success')}
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
