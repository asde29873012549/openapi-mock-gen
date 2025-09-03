import path from 'path';

import { format } from 'prettier';
import { vol } from 'memfs';

import { OrganizedApiData, Config, GeneratedMocks } from './types';
import { generateMockDataFileContent, writeMockDataFiles } from './writer';
import { TemplateGenerator } from './templates';
import {
  DEFAULT_CONFIG,
  DEFAULT_SEED,
  DEFAULT_API_DIR_NAME,
  EXPORT_LANGUAGE,
  GENERATED_COMMENT_FLAG,
} from './constants';

jest.mock('fs');
jest.mock('prettier');

const MOCK_OUTPUT_DIR = 'mocks';
const isESM = true;

const MOCK_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  language: EXPORT_LANGUAGE.JS,
  specPath: 'mock-spec.json',
  outputDir: MOCK_OUTPUT_DIR,
  fakerMap: {},
  endpoints: {},
};

jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});

jest.mock('./prompts', () => ({
  getSpinner: jest.fn(() => ({
    succeed: jest.fn(),
  })),
}));

describe('writer', () => {
  beforeEach(() => {
    vol.reset();
    (format as jest.Mock).mockImplementation((content) => Promise.resolve(content));
  });

  describe('generateMockDataFileContent', () => {
    const endpoint: OrganizedApiData = {
      method: 'get',
      path: '/users',
      operationId: 'getUsers',
      summary: 'getUsers',
      responses: [
        { code: '200', response: {} },
        { code: '404', response: {} },
      ],
    };

    it('should handle dynamic mocks with faker', () => {
      const codeA = `
        {
          id: faker.string.uuid(),
          name: () => Math.random() * 100,
        }
        `;
      const codeB = "{ message: 'Not Found' }";
      const mockCodeArray = [codeA, codeB];

      const content = generateMockDataFileContent(
        mockCodeArray,
        new TemplateGenerator(MOCK_CONFIG.language, isESM),
        endpoint,
        EXPORT_LANGUAGE.JS
      );

      expect(content).toContain('import { faker }');
      expect(content).toContain(`faker.seed(${DEFAULT_SEED})`);
      expect(content).toContain(`'200': ${codeA}`);
      expect(content).toContain(`'404': ${codeB}`);
    });

    it('should handle static mocks', () => {
      const codeA = { id: 1 };
      const codeB = { message: 'Not Found' };

      const mockCodeArray = [codeA, codeB];
      const content = generateMockDataFileContent(
        mockCodeArray,
        new TemplateGenerator(MOCK_CONFIG.language, isESM),
        endpoint,
        EXPORT_LANGUAGE.JS
      );

      expect(content).not.toContain('import { faker }');
      expect(content).toContain(`'200': ${JSON.stringify(codeA, null, 2)}`);
      expect(content).toContain(`'404': ${JSON.stringify(codeB, null, 2)}`);
    });
  });

  describe('writeMockDataFiles', () => {
    const endpoints: OrganizedApiData[] = [
      {
        path: '/users',
        method: 'get',
        operationId: 'getUsers',
        summary: 'getUsers',
        responses: [{ code: '200', response: {} }],
      },
    ];
    const generatedMocks: GeneratedMocks = [[{ id: 1 }]];

    it('should write a new mock file', async () => {
      vol.fromJSON({});
      await writeMockDataFiles({
        config: MOCK_CONFIG,
        endpoints,
        generatedMocks,
        templateGenerator: new TemplateGenerator(MOCK_CONFIG.language, isESM),
      });
      const filePath = path.join(MOCK_OUTPUT_DIR, DEFAULT_API_DIR_NAME, 'users.js');
      expect(vol.existsSync(filePath)).toBe(true);
    });

    it('should overwrite an existing mock file with generated flag', async () => {
      const filePath = path.join(MOCK_OUTPUT_DIR, DEFAULT_API_DIR_NAME, 'users.js');
      const existingContent = `${GENERATED_COMMENT_FLAG}\n// old content`;
      vol.fromJSON({ [filePath]: existingContent });

      await writeMockDataFiles({
        config: MOCK_CONFIG,
        endpoints,
        generatedMocks,
        templateGenerator: new TemplateGenerator(MOCK_CONFIG.language, isESM),
      });
      const newContent = vol.readFileSync(filePath, 'utf-8');
      expect(newContent).not.toContain('// old content');
    });

    it('should not overwrite an existing file without the flag', async () => {
      const filePath = path.join(MOCK_OUTPUT_DIR, DEFAULT_API_DIR_NAME, 'users.js');
      const existingContent = '// user-modified content';
      vol.fromJSON({ [filePath]: existingContent });

      await writeMockDataFiles({
        config: MOCK_CONFIG,
        endpoints,
        generatedMocks,
        templateGenerator: new TemplateGenerator(MOCK_CONFIG.language, isESM),
      });
      const newContent = vol.readFileSync(filePath, 'utf-8');
      expect(newContent).toBe(existingContent);
    });
  });
});
