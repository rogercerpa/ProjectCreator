/**
 * AIService - Multi-provider AI abstraction layer
 * Supports OpenAI, Google Gemini, and Anthropic Claude
 * API keys encrypted via Electron safeStorage (OS-level encryption)
 */

const { safeStorage } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const axios = require('axios');

const MODEL_CATALOG_VERSION = 1;
const DEFAULT_MODEL_CATALOG_TTL_MS = 24 * 60 * 60 * 1000;

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4.1', label: 'GPT-4.1', description: 'Best for structured output and instruction following' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', description: 'Fast and cost-effective' },
      { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', description: 'Fastest, lowest cost' }
    ],
    defaultModel: 'gpt-4.1'
  },
  gemini: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Best reasoning and accuracy' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast and cost-effective' }
    ],
    defaultModel: 'gemini-2.5-pro'
  },
  anthropic: {
    name: 'Anthropic Claude',
    models: [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: 'Best balance of speed and quality' },
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', description: 'Most capable, best for complex analysis' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', description: 'Fastest and cheapest' }
    ],
    defaultModel: 'claude-sonnet-4-6'
  }
};

class AIService {
  constructor(settingsService) {
    this.settingsService = settingsService;
    this.configPath = path.join(os.homedir(), '.project-creator', 'ai-config.json');
    this._providerInstance = null;
    this._cachedProvider = null;
    this._cachedModel = null;
    this.modelCatalogTtlMs = DEFAULT_MODEL_CATALOG_TTL_MS;
    this._catalogCache = null;
    this._catalogFetchedAt = null;
    this._catalogRefreshPromise = null;
  }

  /**
   * Get available providers and their models
   */
  async getProviders(options = {}) {
    const { forceRefresh = false } = options;
    const staticProviders = this._cloneProviders(PROVIDERS);
    const config = await this._loadConfigFile();
    const selectedProvider = config.provider || null;

    let source = 'static';
    let fetchedAt = null;
    let dynamicCatalog = null;

    if (selectedProvider && config.apiKeyEncrypted) {
      const memoryCatalog = this._readCachedCatalog();
      if (!forceRefresh && memoryCatalog) {
        dynamicCatalog = memoryCatalog.providers;
        fetchedAt = memoryCatalog.fetchedAt;
        source = 'cached';
      } else {
        const persistedCatalog = this._getPersistedCatalog(config);
        if (!forceRefresh && this._isCatalogFresh(persistedCatalog?.fetchedAt)) {
          this._setCatalogCache(persistedCatalog.providers, persistedCatalog.fetchedAt);
          dynamicCatalog = persistedCatalog.providers;
          fetchedAt = persistedCatalog.fetchedAt;
          source = 'cached';
        } else {
          const refreshed = await this._refreshCatalogFromProviders(config);
          if (refreshed?.providers) {
            dynamicCatalog = refreshed.providers;
            fetchedAt = refreshed.fetchedAt;
            source = 'live';
          } else if (persistedCatalog?.providers) {
            this._setCatalogCache(persistedCatalog.providers, persistedCatalog.fetchedAt);
            dynamicCatalog = persistedCatalog.providers;
            fetchedAt = persistedCatalog.fetchedAt;
            source = 'cached';
          }
        }
      }
    }

    const mergedProviders = this._mergeProviders(staticProviders, dynamicCatalog);

    return {
      providers: mergedProviders,
      source,
      fetchedAt
    };
  }

  /**
   * Force refresh model catalog from provider API
   */
  async refreshModelCatalog() {
    const config = await this._loadConfigFile();
    if (!config.provider || !config.apiKeyEncrypted) {
      return {
        success: true,
        refreshed: false,
        reason: 'missing-config',
        source: 'static'
      };
    }

    const refreshed = await this._refreshCatalogFromProviders(config);
    if (!refreshed) {
      return { success: false, refreshed: false, error: 'Failed to refresh model catalog.' };
    }

    return { success: true, refreshed: true, fetchedAt: refreshed.fetchedAt, source: 'live' };
  }

  /**
   * Trigger a background refresh without blocking startup
   */
  refreshModelCatalogInBackground() {
    this.refreshModelCatalog().catch((error) => {
      console.warn('AI model catalog background refresh failed:', error.message);
    });
  }

  /**
   * Save AI configuration (provider, model, encrypted API key)
   */
  async saveConfig({ provider, model, apiKey }) {
    try {
      const config = await this._loadConfigFile();
      const hasIncomingModel = typeof model === 'string' && model.trim().length > 0;

      if (provider) config.provider = provider;
      if (model) config.model = model;
      if (config.provider && !PROVIDERS[config.provider]) {
        throw new Error(`Unsupported AI provider: ${config.provider}`);
      }
      if (config.provider && !hasIncomingModel) {
        config.model = this._resolveModel(config.provider, config.model, PROVIDERS);
      }

      if (apiKey) {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new Error('OS encryption is not available. Cannot securely store API key.');
        }
        const encrypted = safeStorage.encryptString(apiKey);
        config.apiKeyEncrypted = encrypted.toString('base64');
      }

      config.updatedAt = new Date().toISOString();
      await fs.ensureDir(path.dirname(this.configPath));
      await fs.writeJson(this.configPath, config, { spaces: 2 });

      this._providerInstance = null;
      this._cachedProvider = null;
      this._cachedModel = null;
      if (provider || apiKey) {
        this._catalogCache = null;
        this._catalogFetchedAt = null;
        this.refreshModelCatalogInBackground();
      }

      return { success: true };
    } catch (error) {
      console.error('Error saving AI config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current AI configuration (never returns raw key)
   */
  async getConfig() {
    try {
      const config = await this._loadConfigFile();
      const provider = config.provider || null;
      const providersResult = await this.getProviders();
      const resolvedModel = this._resolveModel(provider, config.model, providersResult.providers);

      return {
        success: true,
        provider,
        model: resolvedModel,
        hasApiKey: !!config.apiKeyEncrypted,
        updatedAt: config.updatedAt || null,
        modelCatalogSource: providersResult.source || 'static',
        modelCatalogFetchedAt: providersResult.fetchedAt || null
      };
    } catch (error) {
      return { success: true, provider: null, model: null, hasApiKey: false, updatedAt: null };
    }
  }

  /**
   * Check if an API key is configured
   */
  async hasApiKey() {
    const config = await this._loadConfigFile();
    return !!config.apiKeyEncrypted;
  }

  /**
   * Remove stored API key
   */
  async clearKey() {
    try {
      const config = await this._loadConfigFile();
      delete config.apiKeyEncrypted;
      config.updatedAt = new Date().toISOString();
      await fs.writeJson(this.configPath, config, { spaces: 2 });

      this._providerInstance = null;
      this._cachedProvider = null;

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Test connection by sending a minimal prompt
   */
  async testConnection() {
    try {
      const result = await this.chatCompletion(
        'You are a helpful assistant.',
        'Respond with exactly: {"status":"ok"}',
        { jsonMode: true, timeout: 15000 }
      );

      if (result && result.status === 'ok') {
        return { success: true, message: 'Connection successful' };
      }
      return { success: true, message: 'Connection successful (response received)' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Core chat completion - routes to the configured provider
   * @param {string} systemPrompt - System message
   * @param {string} userPrompt - User message
   * @param {object} options - { jsonMode, timeout, maxTokens }
   * @returns {object|string} Parsed JSON if jsonMode, otherwise string
   */
  async chatCompletion(systemPrompt, userPrompt, options = {}) {
    const { jsonMode = false, timeout = 60000, maxTokens = 4096 } = options;

    const config = await this._loadConfigFile();
    const provider = config.provider;
    const providersResult = await this.getProviders();
    const model = this._resolveModel(provider, config.model, providersResult.providers);

    if (!provider || !config.apiKeyEncrypted) {
      throw new Error('AI not configured. Please set up your AI provider in Settings.');
    }

    const apiKey = this._decryptKey(config.apiKeyEncrypted);

    let responseText;

    switch (provider) {
      case 'openai':
        responseText = await this._callOpenAI(apiKey, model, systemPrompt, userPrompt, { jsonMode, timeout, maxTokens });
        break;
      case 'gemini':
        responseText = await this._callGemini(apiKey, model, systemPrompt, userPrompt, { jsonMode, timeout, maxTokens });
        break;
      case 'anthropic':
        responseText = await this._callAnthropic(apiKey, model, systemPrompt, userPrompt, { jsonMode, timeout, maxTokens });
        break;
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }

    if (jsonMode) {
      try {
        return JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (innerErr) {
            const err = new Error(`AI response was not valid JSON: ${innerErr.message}`);
            err.rawResponse = responseText;
            throw err;
          }
        }
        const err = new Error('AI response was not valid JSON');
        err.rawResponse = responseText;
        throw err;
      }
    }

    return responseText;
  }

  // ===== Provider Implementations =====

  async _callOpenAI(apiKey, model, systemPrompt, userPrompt, options) {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey, timeout: options.timeout });

    const requestParams = {
      model,
      temperature: 0,
      seed: 42,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      // Newer OpenAI models reject max_tokens and require max_completion_tokens.
      max_completion_tokens: options.maxTokens
    };

    if (options.jsonMode) {
      requestParams.response_format = { type: 'json_object' };
    }

    try {
      const response = await client.chat.completions.create(requestParams);
      return response.choices[0].message.content;
    } catch (error) {
      const errorMessage = error?.message || '';
      const usesUnsupportedMaxCompletionTokens = errorMessage.includes('max_completion_tokens');
      if (!usesUnsupportedMaxCompletionTokens) {
        throw error;
      }

      // Compatibility fallback for older models/endpoints.
      const fallbackParams = {
        ...requestParams,
        max_tokens: options.maxTokens
      };
      delete fallbackParams.max_completion_tokens;

      const fallbackResponse = await client.chat.completions.create(fallbackParams);
      return fallbackResponse.choices[0].message.content;
    }
  }

  async _callGemini(apiKey, model, systemPrompt, userPrompt, options) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    const generationConfig = {
      maxOutputTokens: options.maxTokens,
      temperature: 0
    };

    if (options.jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const genModel = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
      generationConfig
    });

    const result = await genModel.generateContent(userPrompt);
    return result.response.text();
  }

  async _callAnthropic(apiKey, model, systemPrompt, userPrompt, options) {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey, timeout: options.timeout });

    const requestParams = {
      model,
      temperature: 0,
      max_tokens: options.maxTokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    };

    const response = await client.messages.create(requestParams);

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock ? textBlock.text : '';
  }

  async _refreshCatalogFromProviders(config) {
    if (this._catalogRefreshPromise) {
      return this._catalogRefreshPromise;
    }

    this._catalogRefreshPromise = (async () => {
      try {
        const providerId = config.provider;
        const apiKey = this._decryptKey(config.apiKeyEncrypted);
        let discoveredModels = [];

        switch (providerId) {
          case 'openai':
            discoveredModels = await this._fetchOpenAIModels(apiKey);
            break;
          case 'gemini':
            discoveredModels = await this._fetchGeminiModels(apiKey);
            break;
          case 'anthropic':
            discoveredModels = await this._fetchAnthropicModels(apiKey);
            break;
          default:
            return null;
        }

        if (!Array.isArray(discoveredModels) || discoveredModels.length === 0) {
          return null;
        }

        const providersCatalog = {
          [providerId]: {
            models: discoveredModels,
            defaultModel: this._pickDefaultModel(providerId, discoveredModels)
          }
        };

        const fetchedAt = new Date().toISOString();
        this._setCatalogCache(providersCatalog, fetchedAt);
        await this._persistCatalog(providersCatalog, fetchedAt);

        return { providers: providersCatalog, fetchedAt };
      } catch (error) {
        console.warn('Failed to refresh AI model catalog:', error.message);
        return null;
      } finally {
        this._catalogRefreshPromise = null;
      }
    })();

    return this._catalogRefreshPromise;
  }

  async _fetchOpenAIModels(apiKey) {
    const response = await this._requestWithRetry(() => axios.get('https://api.openai.com/v1/models', {
      timeout: 12000,
      headers: { Authorization: `Bearer ${apiKey}` }
    }));

    const models = response?.data?.data || [];
    const candidateIds = models
      .map((m) => m.id)
      .filter((id) => /^(gpt-|o[1-9]|chatgpt-)/i.test(id))
      .sort((a, b) => a.localeCompare(b));

    const prioritizedIds = this._prioritizeOpenAIModels(candidateIds);
    return prioritizedIds.map((id) => ({
        id,
        label: this._prettifyModelLabel(id),
        description: 'Discovered from OpenAI API'
      }));
  }

  async _fetchGeminiModels(apiKey) {
    const response = await this._requestWithRetry(() => axios.get('https://generativelanguage.googleapis.com/v1beta/models', {
      timeout: 12000,
      params: { key: apiKey, pageSize: 1000 }
    }));

    const models = response?.data?.models || [];
    const candidateIds = models
      .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => m.name?.replace(/^models\//, ''))
      .filter((id) => id && /^gemini/i.test(id))
      .sort((a, b) => a.localeCompare(b));

    const prioritizedIds = this._prioritizeGeminiModels(candidateIds);
    return prioritizedIds.map((id) => ({
        id,
        label: this._prettifyModelLabel(id),
        description: 'Discovered from Gemini API'
      }));
  }

  async _fetchAnthropicModels(apiKey) {
    const response = await this._requestWithRetry(() => axios.get('https://api.anthropic.com/v1/models', {
      timeout: 12000,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    }));

    const models = response?.data?.data || [];
    const candidateIds = models
      .map((m) => m.id)
      .filter((id) => id && /^claude/i.test(id))
      .sort((a, b) => a.localeCompare(b));

    const prioritizedIds = this._prioritizeAnthropicModels(candidateIds);
    return prioritizedIds.map((id) => ({
        id,
        label: this._prettifyModelLabel(id),
        description: 'Discovered from Anthropic API'
      }));
  }

  async _requestWithRetry(requestFn, maxAttempts = 2) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await this._delay(600 * attempt);
        }
      }
    }
    throw lastError;
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _mergeProviders(staticProviders, dynamicCatalog) {
    const merged = this._cloneProviders(staticProviders);
    if (!dynamicCatalog || typeof dynamicCatalog !== 'object') {
      return merged;
    }

    for (const [providerId, providerData] of Object.entries(dynamicCatalog)) {
      if (!providerData?.models?.length || !merged[providerId]) continue;
      merged[providerId].models = providerData.models;
      merged[providerId].defaultModel = providerData.defaultModel || providerData.models[0].id;
    }

    return merged;
  }

  _resolveModel(provider, model, providers) {
    if (!provider || !providers || !providers[provider]) return model || null;

    const providerModels = providers[provider].models || [];
    const defaultModel = providers[provider].defaultModel || providerModels[0]?.id || null;
    if (!providerModels.length) return defaultModel;

    const isConfiguredModelValid = model && providerModels.some((entry) => entry.id === model);
    return isConfiguredModelValid ? model : defaultModel;
  }

  _readCachedCatalog() {
    if (!this._catalogCache || !this._catalogFetchedAt) return null;
    if (!this._isCatalogFresh(this._catalogFetchedAt)) return null;
    return { providers: this._cloneProviders(this._catalogCache), fetchedAt: this._catalogFetchedAt };
  }

  _setCatalogCache(providers, fetchedAt) {
    this._catalogCache = this._cloneProviders(providers);
    this._catalogFetchedAt = fetchedAt;
  }

  _isCatalogFresh(fetchedAt) {
    if (!fetchedAt) return false;
    const fetchedMs = Date.parse(fetchedAt);
    if (Number.isNaN(fetchedMs)) return false;
    return (Date.now() - fetchedMs) < this.modelCatalogTtlMs;
  }

  _getPersistedCatalog(config) {
    const catalog = config?.modelCatalog;
    if (!catalog || catalog.version !== MODEL_CATALOG_VERSION) return null;
    if (!catalog.providers || typeof catalog.providers !== 'object') return null;
    return { providers: catalog.providers, fetchedAt: catalog.fetchedAt || null };
  }

  async _persistCatalog(providers, fetchedAt) {
    const config = await this._loadConfigFile();
    config.modelCatalog = {
      version: MODEL_CATALOG_VERSION,
      fetchedAt,
      providers
    };
    config.updatedAt = config.updatedAt || new Date().toISOString();
    await fs.ensureDir(path.dirname(this.configPath));
    await fs.writeJson(this.configPath, config, { spaces: 2 });
  }

  _cloneProviders(providers) {
    return JSON.parse(JSON.stringify(providers || {}));
  }

  _prettifyModelLabel(modelId) {
    return modelId
      .split('-')
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join(' ');
  }

  _pickDefaultModel(providerId, models) {
    const fallbackDefault = PROVIDERS[providerId]?.defaultModel;
    return models[0]?.id || fallbackDefault || null;
  }

  _prioritizeOpenAIModels(modelIds) {
    const preferredPatterns = [
      /^gpt-5$/i,
      /^gpt-5-mini$/i,
      /^gpt-5-nano$/i,
      /^o3$/i,
      /^o4-mini$/i,
      /^gpt-4\.1$/i,
      /^gpt-4\.1-mini$/i,
      /^gpt-4\.1-nano$/i,
      /^gpt-4o$/i,
      /^gpt-4o-mini$/i
    ];

    return this._selectPreferredModels(modelIds, preferredPatterns, 6);
  }

  _prioritizeGeminiModels(modelIds) {
    const preferredPatterns = [
      /^gemini-2\.5-pro$/i,
      /^gemini-2\.5-flash$/i,
      /^gemini-2\.5-flash-lite$/i,
      /^gemini-2\.0-flash$/i
    ];

    return this._selectPreferredModels(modelIds, preferredPatterns, 5);
  }

  _prioritizeAnthropicModels(modelIds) {
    const latestByFamily = ['opus', 'sonnet', 'haiku']
      .map((family) => this._pickLatestModelByFamily(modelIds, `claude-${family}`))
      .filter(Boolean);

    if (latestByFamily.length > 0) {
      return latestByFamily;
    }

    return modelIds.slice(-5).reverse();
  }

  _pickLatestModelByFamily(modelIds, familyPrefix) {
    const familyMatches = modelIds
      .filter((id) => id.toLowerCase().startsWith(familyPrefix.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
    return familyMatches[familyMatches.length - 1] || null;
  }

  _selectPreferredModels(modelIds, preferredPatterns, fallbackLimit = 5) {
    const selected = [];
    const seen = new Set();

    preferredPatterns.forEach((pattern) => {
      const match = modelIds.find((id) => pattern.test(id));
      if (match && !seen.has(match)) {
        selected.push(match);
        seen.add(match);
      }
    });

    if (selected.length > 0) {
      return selected;
    }

    return modelIds.slice(-fallbackLimit).reverse();
  }

  // ===== Internal Helpers =====

  _decryptKey(encryptedBase64) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS encryption is not available');
    }
    const buffer = Buffer.from(encryptedBase64, 'base64');
    return safeStorage.decryptString(buffer);
  }

  async _loadConfigFile() {
    try {
      if (await fs.pathExists(this.configPath)) {
        return await fs.readJson(this.configPath);
      }
    } catch (error) {
      console.error('Error loading AI config:', error);
    }
    return {};
  }
}

module.exports = AIService;
module.exports.PROVIDERS = PROVIDERS;
