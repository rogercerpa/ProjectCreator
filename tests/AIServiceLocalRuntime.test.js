jest.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => true),
    encryptString: jest.fn((value) => Buffer.from(value, 'utf8')),
    decryptString: jest.fn((buffer) => Buffer.from(buffer).toString('utf8'))
  }
}));

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const axios = require('axios');
const AIService = require('../main-process/services/AIService');

describe('AIService local runtime support', () => {
  let service;
  let tempConfigPath;

  beforeEach(() => {
    jest.clearAllMocks();
    tempConfigPath = path.join(os.tmpdir(), `ai-config-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    service = new AIService({ loadSettings: jest.fn() });
    service.configPath = tempConfigPath;
  });

  afterEach(async () => {
    await fs.remove(tempConfigPath);
  });

  test('saves and returns local runtime configuration', async () => {
    const saveResult = await service.saveConfig({
      provider: 'local',
      model: 'llama3.1:8b',
      localRuntime: {
        endpoint: 'http://127.0.0.1:11434/v1',
        healthEndpoint: 'http://127.0.0.1:11434/api/tags',
        runtimeType: 'openai-compatible'
      }
    });

    expect(saveResult.success).toBe(true);

    const configResult = await service.getConfig();
    expect(configResult.success).toBe(true);
    expect(configResult.provider).toBe('local');
    expect(configResult.localRuntime.endpoint).toBe('http://127.0.0.1:11434/v1');
  });

  test('reports local runtime ready when models are reachable', async () => {
    await service.saveConfig({
      provider: 'local',
      model: 'llama3.1:8b',
      localRuntime: {
        endpoint: 'http://127.0.0.1:11434/v1',
        healthEndpoint: 'http://127.0.0.1:11434/api/tags'
      }
    });

    axios.get.mockResolvedValueOnce({
      data: {
        data: [{ id: 'llama3.1:8b' }]
      }
    });

    const runtimeStatus = await service.getRuntimeStatus();
    expect(runtimeStatus.ready).toBe(true);
    expect(runtimeStatus.model).toBe('llama3.1:8b');
  });

  test('routes chat completion through local runtime endpoint', async () => {
    await service.saveConfig({
      provider: 'local',
      model: 'llama3.1:8b',
      localRuntime: {
        endpoint: 'http://127.0.0.1:11434/v1',
        healthEndpoint: 'http://127.0.0.1:11434/api/tags'
      }
    });

    axios.get.mockResolvedValueOnce({
      data: {
        data: [{ id: 'llama3.1:8b' }]
      }
    });

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: '{"status":"ok"}'
            }
          }
        ]
      }
    });

    const result = await service.chatCompletion(
      'You are a helpful assistant.',
      'Respond with exactly: {"status":"ok"}',
      { jsonMode: true, timeout: 5000 }
    );

    expect(result.status).toBe('ok');
    expect(axios.post).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/v1/chat/completions',
      expect.objectContaining({
        model: 'llama3.1:8b'
      }),
      expect.any(Object)
    );
  });
});
