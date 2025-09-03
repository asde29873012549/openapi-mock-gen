import { interpolateString } from '@/lib/shared/utils';

import { Language, ModuleSystem, Config } from './types';
import {
  DEFAULT_SEED,
  EXPORT_LANGUAGE,
  OPENAPI_TYPES_FILE_NAME,
  FAKER_SEED,
  ESM_IMPORT,
  CJS_IMPORT,
  ESM_EXPORT,
  CJS_EXPORT,
  ESM_EXPORT_NAMED,
  CJS_EXPORT_NAMED,
  GENERATED_COMMENT,
  DISABLE_LINTING,
  DISABLE_ALL_CHECK,
  HTTP_METHODS_TYPE,
  FAKER_MAP_TYPE,
  ENDPOINT_CONFIG_TYPE,
  CONFIG_TYPE,
  MOCK_DATA_BODY,
  MANIFEST_BODY,
  CONFIG_BODY,
} from './constants';

export interface TemplateContext {
  language: Language;
  moduleSystem: ModuleSystem;
}

export const createTemplate = (template: string) => ({
  render: (data: Record<string, string | number | boolean>): string => {
    try {
      return interpolateString(template, data);
    } catch (error) {
      throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

export const MODULE_IMPORT_TEMPLATE = {
  cjs: createTemplate(CJS_IMPORT),
  esm: createTemplate(ESM_IMPORT),
};

export const MODULE_EXPORT_TEMPLATE = {
  cjs: createTemplate(CJS_EXPORT),
  cjsNamed: createTemplate(CJS_EXPORT_NAMED),
  esm: createTemplate(ESM_EXPORT),
  esmNamed: createTemplate(ESM_EXPORT_NAMED),
};

const fakerImport = (context: TemplateContext): string => {
  const { moduleSystem } = context;
  const template = moduleSystem === 'esm' ? MODULE_IMPORT_TEMPLATE.esm : MODULE_IMPORT_TEMPLATE.cjs;

  return template.render({
    module: '{ faker }',
    modulePath: '@faker-js/faker',
  });
};

const openapiTypesImport = (context: TemplateContext): string => {
  const { moduleSystem } = context;
  const template = moduleSystem === 'esm' ? MODULE_IMPORT_TEMPLATE.esm : MODULE_IMPORT_TEMPLATE.cjs;

  return template.render({
    module: 'type { paths }',
    modulePath: `../${OPENAPI_TYPES_FILE_NAME}`,
  });
};

// Config file
const configHeader = (context: TemplateContext): string => {
  const parts = [GENERATED_COMMENT];

  if (context.language === EXPORT_LANGUAGE.TS) {
    parts.push(DISABLE_LINTING);
    parts.push(HTTP_METHODS_TYPE, FAKER_MAP_TYPE, ENDPOINT_CONFIG_TYPE, CONFIG_TYPE);
  } else {
    parts.push(DISABLE_ALL_CHECK);
  }

  return parts.join('\n\n');
};

const configFooter = (context: TemplateContext): string =>
  MODULE_EXPORT_TEMPLATE[context.moduleSystem].render({ exportName: 'config' });

// Mock data file
const mockDataHeader = (usesFaker: boolean, shouldImportPaths: boolean, context: TemplateContext): string => `
${GENERATED_COMMENT}

${context.language === EXPORT_LANGUAGE.TS ? DISABLE_LINTING : DISABLE_ALL_CHECK}

${usesFaker ? fakerImport(context) : ''}

${context.language === EXPORT_LANGUAGE.TS && shouldImportPaths ? openapiTypesImport(context) : ''}

${usesFaker ? createTemplate(FAKER_SEED).render({ seed: DEFAULT_SEED }) : ''}
`;

const mockDataFooter = (context: TemplateContext): string =>
  MODULE_EXPORT_TEMPLATE[context.moduleSystem].render({ exportName: 'mockData' });

export class TemplateGenerator {
  private readonly context: TemplateContext;

  constructor(language: Language, isESM: boolean) {
    this.context = {
      language,
      moduleSystem: isESM ? 'esm' : 'cjs',
    };
  }

  generateConfig(data: Omit<Config, 'fakerMap' | 'endpoints'>): string {
    const header = configHeader(this.context);
    const configType = this.context.language === EXPORT_LANGUAGE.TS ? ': Config' : '';
    const body = createTemplate(CONFIG_BODY).render({ ...data, configType });
    const footer = configFooter(this.context);

    return [header, body, footer].join('\n\n');
  }

  generateMockData(usesFaker: boolean, mockData: string, mockDataType?: string): string {
    const shouldImportPaths = mockDataType?.includes('paths') || false;

    const header = mockDataHeader(usesFaker, shouldImportPaths, this.context);
    const body = createTemplate(MOCK_DATA_BODY).render({
      mockData: mockData,
      mockDataType: this.context.language === EXPORT_LANGUAGE.TS && mockDataType ? `: ${mockDataType}` : '',
    });
    const footer = mockDataFooter(this.context);

    return [header, body, footer].join('\n\n');
  }

  generateManifest(manifestData: string): string {
    return createTemplate(MANIFEST_BODY).render({ manifestData });
  }

  getContext(): Readonly<TemplateContext> {
    return { ...this.context };
  }
}
