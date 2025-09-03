import pc from 'picocolors';
import { OpenAPIV3 } from 'openapi-types';
import SwaggerParser from '@apidevtools/swagger-parser';

import { Config } from '@/lib/shared/types';
import { getSpinner } from '@/lib/shared/prompts';

async function bundleSpec(specPathOrUrl: string): Promise<OpenAPIV3.Document> {
  const doc = await SwaggerParser.bundle(specPathOrUrl);

  if (!('openapi' in doc) || !doc.openapi.startsWith('3')) {
    throw new Error('Invalid OpenAPI version. Only OpenAPI v3 is supported.');
  }

  return doc as OpenAPIV3.Document;
}

export async function loadSpec(config: Config): Promise<OpenAPIV3.Document> {
  const { specPath } = config;
  const spinner = getSpinner(`Loading spec from: ${specPath}`, 'yellow').start();
  const document = await bundleSpec(specPath);

  spinner.succeed(pc.bold('Spec loaded successfully.'));

  return document;
}
