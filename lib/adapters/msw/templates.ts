import { toCamelCase, replacePathParamsWithBy, getExpressLikePath, getExtension } from '@/lib/shared/utils';
import { Language, Manifest } from '@/lib/shared/types';
import {
  MODULE_IMPORT_TEMPLATE,
  MODULE_EXPORT_TEMPLATE,
  createTemplate,
  TemplateContext,
} from '@/lib/shared/templates';
import {
  DEFAULT_API_DIR_NAME,
  DEFAULT_TYPES_FILE_NAME,
  EXPORT_LANGUAGE,
  TS_EXTENSION,
  DISABLE_LINTING,
  DISABLE_ALL_CHECK,
} from '@/lib/shared/constants';

import {
  SINGLE_HANDLER_CONTENT,
  MSW_TYPES_CONTENT,
  SERVER_CONTENT,
  BROWSER_CONTENT,
  UTILS_CONTENT,
  UTILS_TS_CONTENT,
  INDEX_CONTENT,
  HANDLERS_CONTENT,
  DEFAULT_SERVER_FILE_NAME,
  DEFAULT_BROWSER_FILE_NAME,
  DEFAULT_INDEX_FILE_NAME,
  DEFAULT_HANDLERS_FILE_NAME,
  DEFAULT_UTILS_FILE_NAME,
} from './constants';

type HandlerObject = {
  method: string;
  url: string;
  response: string;
  nullablePaths: string;
};

type ModuleInfo = {
  module: string;
  modulePath: string;
};

const getHandlersBody = (
  manifest: Manifest['manifest'],
  isTS: boolean,
  generateHandler: (data: HandlerObject) => string
) => {
  const handlersWording = isTS ? 'handlers: MockHttpHandler[]' : 'handlers';

  manifest.sort((a, b) => {
    const isADynamic = a.path.includes('{');
    const isBDynamic = b.path.includes('{');

    if (isADynamic !== isBDynamic) {
      return isADynamic ? 1 : -1;
    }

    return a.path.localeCompare(b.path) || a.method.localeCompare(b.method);
  });

  const handlersArray = manifest
    .map(({ path: apiPath, method, nullablePaths }) => {
      const key = toCamelCase(method + replacePathParamsWithBy(apiPath));
      return generateHandler({
        method: method.toLowerCase(),
        url: getExpressLikePath(apiPath),
        response: key,
        nullablePaths: JSON.stringify(nullablePaths),
      });
    })
    .join(',\n  ');

  return `const ${handlersWording} = [${handlersArray}];`;
};

export const mswFileNames = (language: Language) => ({
  getHandlersFileName: () => DEFAULT_HANDLERS_FILE_NAME + getExtension(language),
  getUtilsFileName: () => DEFAULT_UTILS_FILE_NAME + getExtension(language),
  getServerFileName: () => DEFAULT_SERVER_FILE_NAME + getExtension(language),
  getBrowserFileName: () => DEFAULT_BROWSER_FILE_NAME + getExtension(language),
  getIndexFileName: () => DEFAULT_INDEX_FILE_NAME + getExtension(language),
  getTypesFileName: () => DEFAULT_TYPES_FILE_NAME + getExtension(language),
});

export class MswTemplateGenerator {
  private readonly context: TemplateContext;
  private readonly fileNameGenerator: ReturnType<typeof mswFileNames>;
  private readonly disableComment: string;

  constructor(language: Language, isESM: boolean) {
    this.fileNameGenerator = mswFileNames(language);
    this.disableComment = language === EXPORT_LANGUAGE.TS ? DISABLE_LINTING : DISABLE_ALL_CHECK;
    this.context = { language, moduleSystem: isESM ? 'esm' : 'cjs' };
  }

  private generateImports(modules: ModuleInfo[]): string {
    const template = this.context.moduleSystem === 'esm' ? MODULE_IMPORT_TEMPLATE.esm : MODULE_IMPORT_TEMPLATE.cjs;
    return modules.map((data) => template.render(data)).join('\n');
  }

  private generateNamedExports(exportName: string): string {
    const template =
      this.context.moduleSystem === 'esm' ? MODULE_EXPORT_TEMPLATE.esmNamed : MODULE_EXPORT_TEMPLATE.cjsNamed;
    return template.render({ exportName });
  }

  private generateHandler(data: HandlerObject): string {
    return createTemplate(SINGLE_HANDLER_CONTENT).render(data);
  }

  generateServer(): string {
    const exports = this.generateNamedExports('initializeServer');
    const imports = this.generateImports([
      { module: '{ setupServer }', modulePath: 'msw/node' },
      {
        module: '{ handlers }',
        modulePath: `./${this.fileNameGenerator.getHandlersFileName().replace(TS_EXTENSION, '')}`,
      },
      {
        module: '{ createMSWHandler }',
        modulePath: `./${this.fileNameGenerator.getUtilsFileName().replace(TS_EXTENSION, '')}`,
      },
    ]);

    return createTemplate(SERVER_CONTENT).render({ imports, exports, disableComment: this.disableComment });
  }

  generateBrowser(): string {
    const exports = this.generateNamedExports('initializeWorker');
    const imports = this.generateImports([
      { module: '{ setupWorker }', modulePath: 'msw/browser' },
      {
        module: '{ handlers }',
        modulePath: `./${this.fileNameGenerator.getHandlersFileName().replace(TS_EXTENSION, '')}`,
      },
      {
        module: '{ createMSWHandler }',
        modulePath: `./${this.fileNameGenerator.getUtilsFileName().replace(TS_EXTENSION, '')}`,
      },
    ]);

    return createTemplate(BROWSER_CONTENT).render({ imports, exports, disableComment: this.disableComment });
  }

  generateUtils(baseUrl: string): string {
    const isTS = this.context.language === EXPORT_LANGUAGE.TS;

    const exports = this.generateNamedExports('createMSWHandler');
    const template = isTS ? createTemplate(UTILS_TS_CONTENT) : createTemplate(UTILS_CONTENT);
    const imports = isTS
      ? this.generateImports([
          { module: '{ http, HttpResponse, JsonBodyType }', modulePath: 'msw' },
          {
            module: '{ MockHttpHandler }',
            modulePath: `./${this.fileNameGenerator.getTypesFileName().replace(TS_EXTENSION, '')}`,
          },
        ])
      : this.generateImports([{ module: '{ http, HttpResponse }', modulePath: 'msw' }]);

    return template.render({ imports, exports, baseUrl, disableComment: this.disableComment });
  }

  generateIndex(): string {
    const imports = this.generateImports([
      {
        module: '{ initializeServer }',
        modulePath: `./${this.fileNameGenerator.getServerFileName().replace(TS_EXTENSION, '')}`,
      },
      {
        module: '{ initializeWorker }',
        modulePath: `./${this.fileNameGenerator.getBrowserFileName().replace(TS_EXTENSION, '')}`,
      },
    ]);
    const exports =
      this.context.moduleSystem === 'esm'
        ? MODULE_EXPORT_TEMPLATE.esmNamed.render({ exportName: '' })
        : 'module.exports = {};';
    return createTemplate(INDEX_CONTENT).render({ imports, exports, disableComment: this.disableComment });
  }

  generateHandlers(manifest: Manifest['manifest']): string {
    const isTS = this.context.language === EXPORT_LANGUAGE.TS;
    const isESM = this.context.moduleSystem === 'esm';

    const importModuleTemplate = isESM ? MODULE_IMPORT_TEMPLATE.esm : MODULE_IMPORT_TEMPLATE.cjs;

    const getModulePath = isTS
      ? (mockFile: string) => `../${DEFAULT_API_DIR_NAME}/${mockFile.replace(TS_EXTENSION, '')}`
      : (mockFile: string) => `../${DEFAULT_API_DIR_NAME}/${mockFile}`;

    const manifestFiles = manifest.map(({ path: apiPath, method, mockFile }) => {
      const key = toCamelCase(method + replacePathParamsWithBy(apiPath));
      return importModuleTemplate.render({
        module: key,
        modulePath: getModulePath(mockFile),
      });
    });

    if (isTS) {
      manifestFiles.push(
        importModuleTemplate.render({
          module: '{ MockHttpHandler }',
          modulePath: `./${this.fileNameGenerator.getTypesFileName().replace(TS_EXTENSION, '')}`,
        })
      );
    }

    const exports = isESM
      ? MODULE_EXPORT_TEMPLATE.esmNamed.render({ exportName: 'handlers' })
      : MODULE_EXPORT_TEMPLATE.cjsNamed.render({ exportName: 'handlers' });

    return createTemplate(HANDLERS_CONTENT).render({
      imports: manifestFiles.join('\n'),
      handlers: getHandlersBody(manifest, isTS, this.generateHandler),
      exports,
      disableComment: this.disableComment,
    });
  }

  generateTypes(): string {
    const imports = this.generateImports([{ module: '{ HttpMethods, JsonBodyType }', modulePath: 'msw' }]);
    return createTemplate(MSW_TYPES_CONTENT).render({ imports, disableComment: this.disableComment });
  }
}
