/**
 * AIService - Multi-provider AI abstraction layer
 * Supports OpenAI, Google Gemini, and Anthropic Claude
 * API keys encrypted via Electron safeStorage (OS-level encryption)
 */

const { safeStorage } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

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
  }

  /**
   * Get available providers and their models
   */
  getProviders() {
    return PROVIDERS;
  }

  /**
   * Save AI configuration (provider, model, encrypted API key)
   */
  async saveConfig({ provider, model, apiKey }) {
    try {
      const config = await this._loadConfigFile();

      if (provider) config.provider = provider;
      if (model) config.model = model;

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
      return {
        success: true,
        provider: config.provider || null,
        model: config.model || null,
        hasApiKey: !!config.apiKeyEncrypted,
        updatedAt: config.updatedAt || null
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
    const model = config.model || PROVIDERS[provider]?.defaultModel;

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
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('AI response was not valid JSON');
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
      max_tokens: options.maxTokens
    };

    if (options.jsonMode) {
      requestParams.response_format = { type: 'json_object' };
    }

    const response = await client.chat.completions.create(requestParams);
    return response.choices[0].message.content;
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
