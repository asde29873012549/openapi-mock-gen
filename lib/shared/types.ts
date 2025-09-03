import { OpenAPIV3 } from 'openapi-types';

export type Language = 'typescript' | 'javascript';
export type ModuleSystem = 'esm' | 'cjs';
export type PrettifyParser = 'typescript' | 'babel' | 'json';
export type Adapter = 'msw' | undefined;

export interface GenerateCLIOptions {
  clean?: boolean;
}

export interface InitCLIOptions {
  specPath?: string;
  outputDir?: string;
  baseUrl?: string;
  typescript?: boolean;
}

export type HttpMethods = `${OpenAPIV3.HttpMethods}`;

export type FakerMap = Record<string, string | (() => unknown)>;

export interface PromptConfig {
  arrayLength: number;
  useExample: boolean;
  dynamic: boolean;
  language: Language;
}

export interface EndpointConfig extends PromptConfig {
  fakerMap?: FakerMap;
}

export interface Config extends PromptConfig {
  specPath: string;
  outputDir: string;
  baseUrl: string;

  fakerMap: FakerMap;
  endpoints: Record<string, Record<HttpMethods, EndpointConfig>>;
}

export interface ApiInfoByEndpoints {
  path: string;
  method: HttpMethods;
  tags: string[];
  operationId: string;
  summary: string;
  description?: string;
  parameters?: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[];
  responses?: OpenAPIV3.ResponsesObject;
}

export type GroupedEndpoints = Record<string, ApiInfoByEndpoints[]>;

export type GeneratedMocks = string[][] | object[][];

export type SchemaWithNullablePaths = OpenAPIV3.SchemaObject & {
  'x-nullable-paths': string[];
  exampleObject?: Record<string, unknown>;
};

export interface MockGeneratorInfo {
  schema: SchemaWithNullablePaths | OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
  config: Config;
  path: string;
  method: HttpMethods;
}

export interface OrganizedApiData {
  method: HttpMethods;
  path: string;
  operationId: string;
  summary: string;
  description?: string;
  responses: {
    code: string;
    response: Record<string, SchemaWithNullablePaths>;
  }[];
}

export type Manifest = {
  manifest: {
    path: string;
    method: HttpMethods;
    mockFile: string;
    nullablePaths: string[];
  }[];
};

export type CollectedErrorObject = {
  method: string;
  path: string;
  key: string;
  schemaType: string;
  exampleType: string;
};
