import pc from 'picocolors';

import type { Adapter, GenerateCLIOptions } from './shared/types';
import { loadConfigFromFile } from './core/config';
import { loadSpec } from './core/specs';
import { generateMocks } from './core/mock-generator';
import {
  handleCleanGeneration,
  handleGenerateOpenApiTypes,
  getIsESM,
  handlePrintMismatchedErrors,
} from './shared/utils';
import { extractRelevantFields, processApiSpec } from './core/openapi-parser';
import { selectEndpointsForMocking } from './core/endpoint-organizor';
import { writeMockDataFiles, writeManifestFile } from './shared/writer';
import { EXPORT_LANGUAGE } from './shared/constants';
import { TemplateGenerator } from './shared/templates';
import getAdapter from './adapters';

export async function main(adapterName: Adapter, options: GenerateCLIOptions) {
  const config = await loadConfigFromFile();

  const { outputDir, language } = config;

  const document = await loadSpec(config);

  if (!document.paths) {
    throw new Error('No paths found in the loaded OpenAPI spec.');
  }

  const apiInfoByEndpoints = extractRelevantFields(document.paths);
  const mockableEndpoints = await selectEndpointsForMocking(apiInfoByEndpoints);

  if (mockableEndpoints.length === 0) {
    return;
  }

  const organizedApiData = processApiSpec(mockableEndpoints, document);
  const generatedMocks = generateMocks(organizedApiData, config);

  if (options.clean) {
    handleCleanGeneration(outputDir);
  }

  const isESM = await getIsESM();
  const templateGenerator = new TemplateGenerator(language, isESM);
  if (language === EXPORT_LANGUAGE.TS) {
    await handleGenerateOpenApiTypes(config);
  }

  await writeMockDataFiles({
    config,
    endpoints: organizedApiData,
    generatedMocks,
    templateGenerator,
  });
  await writeManifestFile({
    config,
    organizedApiData,
    templateGenerator,
  });

  const adapter = await getAdapter(adapterName);
  await adapter(config, isESM);

  await handlePrintMismatchedErrors();

  console.log(pc.cyan(`\n🎉 Mock data files generated successfully in ${pc.bold(outputDir)}`));
}
