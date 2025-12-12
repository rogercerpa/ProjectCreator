import React, { useState, useEffect } from 'react';

function AgencyMarketStrategyTab({ agency }) {
  const [marketStrategy, setMarketStrategy] = useState({
    regionalStrategies: '',
    competitivePositioning: '',
    growthOpportunities: '',
    marketAnalysis: '',
    targets: '',
    insights: ''
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (agency) {
      loadMarketStrategy();
    }
  }, [agency]);

  const loadMarketStrategy = async () => {
    setLoading(true);
    try {
      // TODO: Load from extended agency data
      const strategy = agency?.marketStrategy || {};
      setMarketStrategy({
        regionalStrategies: strategy.regionalStrategies || '',
        competitivePositioning: strategy.competitivePositioning || '',
        growthOpportunities: strategy.growthOpportunities || '',
        marketAnalysis: strategy.marketAnalysis || '',
        targets: strategy.targets || '',
        insights: strategy.insights || ''
      });
    } catch (error) {
      console.error('Error loading market strategy:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    setSaving(true);
    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, {
        marketStrategy
      });

      if (result.success) {
        alert('Market strategy saved successfully!');
      } else {
        throw new Error(result.error || 'Failed to save market strategy');
      }
    } catch (error) {
      console.error('Error saving market strategy:', error);
      alert('Failed to save market strategy: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setMarketStrategy(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading market strategy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Market Strategy</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span>💾</span>
              <span>Save</span>
            </>
          )}
        </button>
      </div>

      <div className="space-y-6">
        {/* Regional Market Strategies */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Regional Market Strategies</h3>
          <textarea
            value={marketStrategy.regionalStrategies}
            onChange={(e) => handleChange('regionalStrategies', e.target.value)}
            placeholder="Document regional market strategies, approaches, and considerations for this agency..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows="6"
          />
        </div>

        {/* Competitive Positioning */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Competitive Positioning</h3>
          <textarea
            value={marketStrategy.competitivePositioning}
            onChange={(e) => handleChange('competitivePositioning', e.target.value)}
            placeholder="Describe competitive positioning, market share, and competitive advantages..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows="5"
          />
        </div>

        {/* Growth Opportunities */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Growth Opportunities & Targets</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Growth Opportunities
              </label>
              <textarea
                value={marketStrategy.growthOpportunities}
                onChange={(e) => handleChange('growthOpportunities', e.target.value)}
                placeholder="Identify growth opportunities, expansion plans, and potential areas for development..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows="4"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Targets & Goals
              </label>
              <textarea
                value={marketStrategy.targets}
                onChange={(e) => handleChange('targets', e.target.value)}
                placeholder="Set specific targets, goals, and metrics for this agency..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows="3"
              />
            </div>
          </div>
        </div>

        {/* Market Analysis */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Market Analysis & Insights</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Market Analysis
              </label>
              <textarea
                value={marketStrategy.marketAnalysis}
                onChange={(e) => handleChange('marketAnalysis', e.target.value)}
                placeholder="Provide market analysis, trends, and market conditions relevant to this agency..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows="5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Key Insights
              </label>
              <textarea
                value={marketStrategy.insights}
                onChange={(e) => handleChange('insights', e.target.value)}
                placeholder="Document key insights, observations, and strategic recommendations..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows="4"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgencyMarketStrategyTab;

