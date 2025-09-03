import fs from 'fs';
import path from 'path';

import pc from 'picocolors';
import prettier from 'prettier';

import { fileNames } from './utils';
import { getSpinner } from './prompts';
import { OrganizedApiData, Config, GeneratedMocks, Language, PrettifyParser } from './types';
import { DEFAULT_API_DIR_NAME, EXPORT_LANGUAGE, MANIFEST_FILE_NAME, GENERATED_COMMENT_FLAG } from './constants';
import { TemplateGenerator } from './templates';

export const shouldOverwriteFile = (filePath: string) =>
  !fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf-8').includes(GENERATED_COMMENT_FLAG);

export async function writeFileWithPrettify(filePath: string, content: string, parser: PrettifyParser = 'typescript') {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });

  try {
    const formattedContent = await prettier.format(content, { parser });
    fs.writeFileSync(filePath, formattedContent);
  } catch (error) {
    console.error(error);
    fs.writeFileSync(filePath, content);
  }
}

export function generateMockDataFileContent(
  mockCodeArray: string[] | object[],
  templateGenerator: TemplateGenerator,
  endpoint: OrganizedApiData,
  language: Language
): string {
  const isDynamic = mockCodeArray.every((mockCode) => typeof mockCode === 'string');
  const { path: apiPath, method, responses } = endpoint;

  const mockDataProperties: string[] = [];
  const mockDataTypeProperties: string[] = [];

  mockCodeArray.forEach((_, i) => {
    const { code, response } = responses[i];
    const data = isDynamic ? mockCodeArray[i] : JSON.stringify(mockCodeArray[i], null, 2);
    mockDataProperties.push(`'${code}': ${data}`);

    if (language === EXPORT_LANGUAGE.TS) {
      const hasContent = response?.['application/json'];
      if (hasContent) {
        const typeString = `paths['${apiPath}']['${method.toLowerCase()}']['responses']['${code}']['content']['application/json']`;
        mockDataTypeProperties.push(`'${code}': ${typeString}`);
      } else {
        mockDataTypeProperties.push(`'${code}': null`);
      }
    }
  });

  const mockDataString = mockDataProperties.join(',\n');
  const mockDataTypeString = language === EXPORT_LANGUAGE.TS ? `{${mockDataTypeProperties.join(',')}}` : undefined;
  const usesFaker = mockDataString.includes('faker.');

  return templateGenerator.generateMockData(usesFaker, mockDataString, mockDataTypeString);
}

export async function writeMockDataFiles({
  config,
  endpoints,
  generatedMocks,
  templateGenerator,
}: {
  config: Config;
  endpoints: OrganizedApiData[];
  generatedMocks: GeneratedMocks;
  templateGenerator: TemplateGenerator;
}) {
  const spinner = getSpinner();
  const { outputDir, language } = config;

  const writePromises = endpoints.map((endpoint, i) => {
    const mockContent = generateMockDataFileContent(generatedMocks[i], templateGenerator, endpoint, language);
    const filePath = path.join(outputDir, DEFAULT_API_DIR_NAME, fileNames(language).getMockFileName(endpoint.path));

    if (!shouldOverwriteFile(filePath)) {
      return Promise.resolve();
    }

    return writeFileWithPrettify(filePath, mockContent);
  });

  await Promise.all(writePromises);
  spinner.succeed(pc.bold(`Generated ${endpoints.length} mock data files.`));
}

export async function writeManifestFile({
  config,
  organizedApiData,
  templateGenerator,
}: {
  config: Config;
  organizedApiData: OrganizedApiData[];
  templateGenerator: TemplateGenerator;
}) {
  const spinner = getSpinner();
  const { outputDir, language } = config;
  const { getMockFileName } = fileNames(language);

  const newManifestEntries = organizedApiData.map(
    ({ method, path: apiPath, operationId, summary, description, responses }) => ({
      method: method.toUpperCase(),
      path: apiPath,
      operationId,
      summary,
      description,
      mockFile: getMockFileName(apiPath),
      nullablePaths: responses.flatMap((r) => r.response?.['application/json']?.['x-nullable-paths'] ?? []),
    })
  );

  const manifestPath = path.join(outputDir, MANIFEST_FILE_NAME);

  let finalManifestData = newManifestEntries;

  if (fs.existsSync(manifestPath)) {
    try {
      const existingManifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const existingManifest = JSON.parse(existingManifestContent);
      const existingData = existingManifest.manifest;
      if (!Array.isArray(existingData)) throw new Error();

      const newEntriesMap = new Map(
        newManifestEntries.map(({ method, path }) => [`${method}-${path}`, { method, path }])
      );

      const oldEntriesToKeep = existingData.filter(
        ({ path, method }) => path && method && !newEntriesMap.has(`${method}-${path}`)
      );

      finalManifestData = [...oldEntriesToKeep, ...newManifestEntries];
    } catch {
      spinner.fail(`The existed ${MANIFEST_FILE_NAME} is corrupted, falling back to overwriting the old file content.`);
    }
  }

  const manifestContent = templateGenerator.generateManifest(JSON.stringify(finalManifestData, null, 2));
  await writeFileWithPrettify(manifestPath, manifestContent, 'json');
}
