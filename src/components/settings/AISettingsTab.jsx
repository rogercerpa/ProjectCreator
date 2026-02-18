import React, { useState, useEffect } from 'react';

const { electronAPI } = window;

const AISettingsTab = () => {
  const [providers, setProviders] = useState({});
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [notification, setNotification] = useState(null);
  const [configUpdatedAt, setConfigUpdatedAt] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const [providersResult, configResult] = await Promise.all([
        electronAPI.aiGetProviders(),
        electronAPI.aiGetConfig()
      ]);

      if (providersResult.success) {
        setProviders(providersResult.providers);
      }

      if (configResult.success) {
        setSelectedProvider(configResult.provider || '');
        setSelectedModel(configResult.model || '');
        setHasExistingKey(configResult.hasApiKey || false);
        setConfigUpdatedAt(configResult.updatedAt);
      }
    } catch (error) {
      console.error('Error loading AI config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderChange = (providerId) => {
    setSelectedProvider(providerId);
    const providerConfig = providers[providerId];
    if (providerConfig) {
      setSelectedModel(providerConfig.defaultModel);
    }
    setTestResult(null);
  };

  const handleSave = async () => {
    if (!selectedProvider) {
      setNotification({ type: 'error', message: 'Please select an AI provider.' });
      return;
    }

    if (!apiKey && !hasExistingKey) {
      setNotification({ type: 'error', message: 'Please enter your API key.' });
      return;
    }

    try {
      setIsSaving(true);
      const config = {
        provider: selectedProvider,
        model: selectedModel
      };

      if (apiKey) {
        config.apiKey = apiKey;
      }

      const result = await electronAPI.aiSaveConfig(config);
      if (result.success) {
        setApiKey('');
        setHasExistingKey(true);
        setNotification({ type: 'success', message: 'AI configuration saved successfully.' });
        loadConfig();
      } else {
        throw new Error(result.error || 'Failed to save configuration');
      }
    } catch (error) {
      setNotification({ type: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);

      if (apiKey && !hasExistingKey) {
        await handleSave();
      }

      const result = await electronAPI.aiTestConnection();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearKey = async () => {
    if (!window.confirm('Remove stored API key? You will need to re-enter it to use AI features.')) return;

    try {
      const result = await electronAPI.aiClearKey();
      if (result.success) {
        setHasExistingKey(false);
        setApiKey('');
        setTestResult(null);
        setNotification({ type: 'success', message: 'API key removed.' });
      }
    } catch (error) {
      setNotification({ type: 'error', message: error.message });
    }
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  const providerEntries = Object.entries(providers);
  const currentProviderModels = providers[selectedProvider]?.models || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <span>🤖</span> AI Configuration
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure your AI provider for BOM QC Review, spec analysis, and smart device identification.
          Your API key is encrypted using your operating system's secure storage (Windows DPAPI / macOS Keychain).
        </p>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-3 rounded-md text-sm ${
          notification.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Provider Selection */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">AI Provider</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {providerEntries.map(([id, config]) => (
            <button
              key={id}
              onClick={() => handleProviderChange(id)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedProvider === id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-500'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div className="font-semibold text-gray-900 dark:text-white">{config.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {config.models.length} models available
              </div>
            </button>
          ))}
        </div>

        {/* Model Selection */}
        {selectedProvider && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {currentProviderModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.label} - {model.description}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* API Key */}
        {selectedProvider && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key
              {hasExistingKey && (
                <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">
                  (key saved securely)
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasExistingKey ? '••••••••••••••••••••' : `Enter your ${providers[selectedProvider]?.name} API key`}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              {hasExistingKey && (
                <button
                  onClick={handleClearKey}
                  className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
                  title="Remove stored API key"
                >
                  Remove Key
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {selectedProvider === 'openai' && 'Get your key at platform.openai.com/api-keys'}
              {selectedProvider === 'gemini' && 'Get your key at aistudio.google.com/apikey'}
              {selectedProvider === 'anthropic' && 'Get your key at console.anthropic.com/settings/keys'}
            </p>
          </div>
        )}

        {/* Actions */}
        {selectedProvider && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving || (!apiKey && !hasExistingKey)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Configuration</span>
              )}
            </button>

            <button
              onClick={handleTestConnection}
              disabled={isTesting || (!hasExistingKey && !apiKey)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
              {isTesting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  <span>Testing...</span>
                </>
              ) : (
                <span>Test Connection</span>
              )}
            </button>

            {/* Test Result */}
            {testResult && (
              <span className={`text-sm ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {testResult.success ? '✅ Connection successful' : `❌ ${testResult.error}`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">About AI Features</h3>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-start gap-2">
            <span className="mt-0.5">🔍</span>
            <div>
              <strong className="text-gray-900 dark:text-white">BOM QC Review</strong> - AI analyzes your BOM catalog numbers to identify device capabilities, then checks compliance against building codes and project specs.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5">📄</span>
            <div>
              <strong className="text-gray-900 dark:text-white">Spec Parsing</strong> - Upload project specification PDFs and AI extracts lighting controls requirements automatically.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5">💰</span>
            <div>
              <strong className="text-gray-900 dark:text-white">Cost Optimization</strong> - Device capabilities are cached after first analysis. Repeated catalog numbers across projects don't trigger additional API calls.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5">🔒</span>
            <div>
              <strong className="text-gray-900 dark:text-white">Security</strong> - Your API key is encrypted with your OS credentials and stored locally. It never leaves your machine except when making API calls to your selected provider.
            </div>
          </div>
        </div>
        {configUpdatedAt && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-400">
            Last configured: {new Date(configUpdatedAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default AISettingsTab;
