import { vol } from 'memfs';

import { DEFAULT_CONFIG as baseConfig } from '../shared/constants';
import { InitCLIOptions } from '../shared/types';
import { inputSpecPath, promptForBaseUrl, promptForGlobalConfig } from '../shared/prompts';
import { writeFileWithPrettify } from '../shared/writer';

import { initializeConfig } from './config';

jest.mock('fs');

jest.mock('../shared/prompts', () => ({
  inputSpecPath: jest.fn(),
  promptForGlobalConfig: jest.fn(),
  promptForBaseUrl: jest.fn(),
  getSpinner: jest.fn(() => ({
    info: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  })),
}));

jest.mock('../shared/writer', () => ({
  writeFileWithPrettify: jest.fn(),
}));

jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('initializeConfig', () => {
  const DEFAULT_CONFIG = {
    ...baseConfig,
    fakerMap: {},
    endpoints: {},
  };

  const MOCK_SPEC_PATH = 'https://petstore3.swagger.io/api/v3/openapi.json';

  beforeEach(() => {
    vol.reset();
    jest.resetModules();

    (inputSpecPath as jest.Mock).mockResolvedValueOnce(MOCK_SPEC_PATH);
    (promptForBaseUrl as jest.Mock).mockResolvedValueOnce(DEFAULT_CONFIG.baseUrl);
    (promptForGlobalConfig as jest.Mock).mockResolvedValueOnce({
      arrayLength: DEFAULT_CONFIG.arrayLength,
      useExample: DEFAULT_CONFIG.useExample,
      language: DEFAULT_CONFIG.language,
      dynamic: DEFAULT_CONFIG.dynamic,
    });
  });

  it('should prompt for config and create a new config file', async () => {
    const cliOptions: InitCLIOptions = {};
    const config = await initializeConfig(cliOptions);

    expect(inputSpecPath).toHaveBeenCalled();
    expect(promptForBaseUrl).toHaveBeenCalled();
    expect(promptForGlobalConfig).toHaveBeenCalled();
    expect(writeFileWithPrettify).toHaveBeenCalled();

    expect(config).toEqual({
      ...DEFAULT_CONFIG,
      specPath: MOCK_SPEC_PATH,
    });
  });

  it('should use CLI options and create a config file', async () => {
    const cliOptions: InitCLIOptions = {
      specPath: 'cli-spec.json',
      outputDir: 'cli-output',
      baseUrl: 'http://cli.example.com',
    };
    const config = await initializeConfig(cliOptions);

    expect(inputSpecPath).toHaveBeenCalledTimes(1);
    expect(promptForGlobalConfig).toHaveBeenCalled();
    expect(writeFileWithPrettify).toHaveBeenCalled();

    expect(config).toEqual({
      ...DEFAULT_CONFIG,
      specPath: 'cli-spec.json',
      outputDir: 'cli-output',
      baseUrl: 'http://cli.example.com',
    });
  });
});
