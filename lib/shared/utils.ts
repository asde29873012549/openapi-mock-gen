import fs from 'fs';
import path from 'path';
import vm from 'vm';

import pc from 'picocolors';
import { faker } from '@faker-js/faker';
import { OpenAPIV3 } from 'openapi-types';

import { JS_EXTENSION, TS_EXTENSION, CONFIG_FILE_NAME, OPENAPI_TYPES_FILE_NAME, EXPORT_LANGUAGE } from './constants';
import { getSpinner } from './prompts';
import {
  Config,
  Language,
  MockGeneratorInfo,
  SchemaWithNullablePaths,
  CollectedErrorObject,
  HttpMethods,
} from './types';

export const slashToKebabCase = (str: string) => str.split('/').filter(Boolean).join('-');

export const toCamelCase = (str: string) =>
  str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ''));

export const replacePathParamsWithBy = (path: string) => path.replace(/{(\w+)}/g, 'By-$1');

export const getExpressLikePath = (path: string) => path.replace(/{(\w+)}/g, ':$1');

export const interpolateString = (str: string, data: Record<string, string | number | boolean>) =>
  str.replace(/{(\w+)}/g, (_, key) => String(data[key] ?? ''));

export const executeCode = (code: string, sandbox: Record<string, unknown> = { faker }) => {
  try {
    const script = new vm.Script(`(${code})`);
    return script.runInNewContext(sandbox);
  } catch (error) {
    console.error(error);
    console.error(
      'An error occurred while generating the static mock data, please note that external dependencies are not supported except for faker.'
    );
    console.error('Falling back to the dynamic mock data generation instead.');

    return code;
  }
};

export async function getIsESM() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const isTsConfig = fs.existsSync(path.join(process.cwd(), 'tsconfig.json'));
    return packageJson.type === 'module' || isTsConfig;
  } catch {
    // If package.json doesn't exist or is invalid, default to CommonJS
    return false;
  }
}

export const handleCleanGeneration = async (outputDir: string) => {
  const spinner = getSpinner();

  const mockDir = path.join(process.cwd(), outputDir);
  if (!fs.existsSync(mockDir)) {
    spinner.fail(`${mockDir} not found`);
    return;
  }

  fs.rmSync(mockDir, { recursive: true });
};

export const handleGenerateOpenApiTypes = async (config: Config): Promise<void> => {
  const { specPath, outputDir } = config;
  const spinner = getSpinner('Generating OpenAPI types with openapi-typescript...', 'yellow').start();

  try {
    const { default: openapiTS, astToString } = await import('openapi-typescript');
    const ast = await openapiTS(specPath);
    const code = astToString(ast);
    const outPutPath = path.join(process.cwd(), outputDir);
    if (!fs.existsSync(outPutPath)) {
      fs.mkdirSync(outPutPath, { recursive: true });
    }

    fs.writeFileSync(path.join(outPutPath, OPENAPI_TYPES_FILE_NAME), code);

    spinner.succeed(pc.bold('OpenAPI types generated successfully'));
  } catch (error) {
    console.error(error);
    spinner.fail('Something went wrong while generating OpenAPI types using openapi-typescript.');
    throw error;
  }
};

export const getExtension = (language: Language) => (language === EXPORT_LANGUAGE.TS ? TS_EXTENSION : JS_EXTENSION);

export const fileNames = (language: Language) => ({
  getConfigFileName: (configFileName: string | undefined = CONFIG_FILE_NAME) =>
    `${configFileName}${getExtension(language)}`,
  getMockFileName: (path: string) => `${slashToKebabCase(path)}${getExtension(language)}`,
});

export const collectedErrors = new Map<`${HttpMethods}-${string}`, CollectedErrorObject[]>();

export const validateExampleAgainstSchema = (
  info: Omit<MockGeneratorInfo, 'schema'> & { schema: SchemaWithNullablePaths | OpenAPIV3.SchemaObject },
  key?: string
) => {
  const { schema, path: endpointPath, method: endpointMethod } = info;

  const { type: schemaType } = schema;

  const getExampleType = (value: unknown) => {
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  if (!schemaType) {
    return;
  }

  const checkExampleType = (example: unknown) => {
    let typeMismatch = false;
    const exampleType = getExampleType(example);

    switch (schemaType) {
      case 'string':
        if (exampleType !== 'string') typeMismatch = true;
        break;
      case 'number':
      case 'integer':
        if (exampleType !== 'number') typeMismatch = true;
        break;
      case 'boolean':
        if (exampleType !== 'boolean') typeMismatch = true;
        break;
      case 'array':
        if (exampleType !== 'array') typeMismatch = true;
        break;
      case 'object':
        if (exampleType !== 'object') typeMismatch = true;
        break;
      default:
        typeMismatch = true;
        break;
    }

    return { typeMismatch, exampleType };
  };

  const example = 'exampleObject' in schema ? schema.exampleObject : schema.example;
  if (example === undefined) return;

  const { typeMismatch, exampleType } = checkExampleType(example);
  if (!typeMismatch) return;

  const collectedErrorsArray = collectedErrors.get(`${endpointMethod}-${endpointPath}`);

  if (!collectedErrorsArray) {
    collectedErrors.set(`${endpointMethod}-${endpointPath}`, [
      {
        method: endpointMethod,
        path: endpointPath,
        key: key ?? 'root',
        schemaType,
        exampleType,
      },
    ]);
  } else {
    collectedErrorsArray.push({
      method: endpointMethod,
      path: endpointPath,
      key: key ?? 'root',
      schemaType,
      exampleType,
    });
  }
};

export const handlePrintMismatchedErrors = async () => {
  const spinner = getSpinner();

  const errors = Object.fromEntries(collectedErrors.entries());

  const pathKeys = Object.keys(errors).sort();
  if (pathKeys.length === 0) {
    return;
  }

  spinner.fail(pc.redBright(pc.bold(`We've found the following mismatched exmaples in the schema: `)));
  pathKeys.forEach((pathKey) => {
    const errorInfo = errors[pathKey];
    const { method, path } = errorInfo[0];

    errorInfo.forEach((error) => {
      const { key, schemaType, exampleType } = error;

      console.error(
        `Found ${pc.cyan(pc.bold(key))} in (${method.toUpperCase()}) - ${pc.cyan(pc.bold(path))} with schema type ${pc.bold(pc.redBright(schemaType))} but received example in type: ${pc.bold(pc.redBright(exampleType))}`
      );
    });
  });
};
