const mockOpenAIChatCreate = jest.fn();

jest.mock('fs-extra');
jest.mock('axios');
jest.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => true),
    encryptString: jest.fn((value) => Buffer.from(`enc:${value}`)),
    decryptString: jest.fn((buffer) => {
      const value = buffer.toString();
      return value.startsWith('enc:') ? value.slice(4) : value;
    })
  }
}));
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockOpenAIChatCreate
      }
    }
  }));
});

const fs = require('fs-extra');
const axios = require('axios');

const toEncrypted = (plainValue) => Buffer.from(`enc:${plainValue}`).toString('base64');

describe('AIService dynamic catalog behavior', () => {
  let aiService;
  let AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    AIService = require('../../main-process/services/AIService');
    aiService = new AIService({});
    aiService.configPath = '/tmp/ai-config.json';

    fs.ensureDir.mockResolvedValue(undefined);
    fs.writeJson.mockResolvedValue(undefined);
    fs.pathExists.mockResolvedValue(true);
  });

  test('getConfig falls back to provider default when saved model is obsolete', async () => {
    fs.readJson.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-deprecated',
      apiKeyEncrypted: toEncrypted('key-1')
    });
    axios.get.mockRejectedValue(new Error('Network down'));

    const result = await aiService.getConfig();

    expect(result.success).toBe(true);
    expect(result.model).toBe('gpt-4.1');
  });

  test('getProviders returns cached persisted catalog when live refresh fails', async () => {
    const now = new Date().toISOString();
    fs.readJson.mockResolvedValue({
      provider: 'openai',
      apiKeyEncrypted: toEncrypted('key-2'),
      modelCatalog: {
        version: 1,
        fetchedAt: now,
        providers: {
          openai: {
            models: [{ id: 'gpt-live-cache', label: 'GPT Live Cache', description: 'cached' }],
            defaultModel: 'gpt-live-cache'
          }
        }
      }
    });
    aiService._decryptKey = jest.fn(() => 'key-2');
    axios.get.mockRejectedValue(new Error('API unavailable'));

    const result = await aiService.getProviders({ forceRefresh: true });

    expect(result.source).toBe('cached');
    expect(result.providers.openai.models[0].id).toBe('gpt-live-cache');
  });

  test('getProviders refreshes live catalog and persists it', async () => {
    fs.readJson.mockResolvedValue({
      provider: 'openai',
      apiKeyEncrypted: toEncrypted('key-3')
    });
    aiService._decryptKey = jest.fn(() => 'key-3');
    axios.get.mockResolvedValue({
      data: {
        data: [
          { id: 'gpt-5' },
          { id: 'text-embedding-3-small' }
        ]
      }
    });

    const result = await aiService.getProviders({ forceRefresh: true });

    expect(result.source).toBe('live');
    expect(result.providers.openai.models.map((item) => item.id)).toEqual(['gpt-5']);
    expect(fs.writeJson).toHaveBeenCalled();
  });

  test('chatCompletion uses fallback model when configured model is invalid', async () => {
    fs.readJson.mockResolvedValue({
      provider: 'openai',
      model: 'retired-model',
      apiKeyEncrypted: toEncrypted('key-4')
    });
    aiService._decryptKey = jest.fn(() => 'key-4');
    aiService._setCatalogCache(
      {
        openai: {
          models: [{ id: 'gpt-4.1', label: 'GPT-4.1', description: 'default' }],
          defaultModel: 'gpt-4.1'
        }
      },
      new Date().toISOString()
    );
    mockOpenAIChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'hello' } }]
    });

    const response = await aiService.chatCompletion('system', 'user');

    expect(response).toBe('hello');
    expect(mockOpenAIChatCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-4.1'
    }));
  });
});
