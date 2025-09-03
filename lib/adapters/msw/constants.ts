import { GENERATED_COMMENT } from '@/lib/shared/constants';

export const DEFAULT_SERVER_FILE_NAME = 'server';
export const DEFAULT_BROWSER_FILE_NAME = 'browser';
export const DEFAULT_INDEX_FILE_NAME = 'index';
export const DEFAULT_HANDLERS_FILE_NAME = 'handlers';
export const DEFAULT_UTILS_FILE_NAME = 'utils';

// Raw template strings
export const SINGLE_HANDLER_CONTENT = `{ method: '{method}', url: '{url}', response: {response}, nullablePaths: {nullablePaths} }`;

export const HANDLERS_CONTENT = `
${GENERATED_COMMENT}

{disableComment}

{imports}

{handlers}

{exports}
`;

export const MSW_TYPES_CONTENT = `
${GENERATED_COMMENT}

{disableComment}

{imports}

export interface MockHttpHandler {
  method: Lowercase<HttpMethods>
  url: string
  response: () => Record<string, JsonBodyType>
  nullablePaths: string[]
}
`;

export const SERVER_CONTENT = `
${GENERATED_COMMENT}

{disableComment}

{imports}

async function initializeServer() {
  console.log('🚀 [MSW] Initializing server...');
  const mswHandlers = handlers.map(createMSWHandler())
  // Appending mswServer to globalThis to prevent new server instance re-creation on HMR that cause the changes made to mock api cannot be applied
  // @ts-ignore - For simplicity, mswServer is not typed
  const server = globalThis.mswServer

  if (server) {
    console.log('🔄 [MSW] Resetting server handlers...')
    server.resetHandlers(...mswHandlers)
  } else {
    console.log('🚀 [MSW] Initializing server...')
    const newServer = setupServer(...mswHandlers)
    await newServer.listen({ onUnhandledRequest: 'bypass' })
    // @ts-ignore - For simplicity, mswServer is not typed
    globalThis.mswServer = newServer
  }
};

{exports}
`;

export const BROWSER_CONTENT = `
${GENERATED_COMMENT}

{disableComment}

{imports}

async function initializeWorker() {
  console.log('🚀 [MSW] Initializing worker...');
  const worker = setupWorker(...handlers.map(createMSWHandler()));
  await worker.start({ onUnhandledRequest: 'bypass' });
};

{exports}
`;

export const UTILS_CONTENT = `
${GENERATED_COMMENT}

{disableComment}

{imports}

const baseUrl = '{baseUrl}';

const nullifyValue = (obj, paths) => {
  paths.forEach(path => {
    const keys = path.split('.');
    const lastKey = keys.pop();

    const target = keys.reduce((acc, key) => {
      if (acc === null) return {};

      const isArrayIndex = !Number.isNaN(Number(key));
      return isArrayIndex ? acc[Number(key)] : acc[key];
    }, obj);

    if (target && lastKey in target) {
      target[lastKey] = null;
    }
  });

  return obj;
};

const createMSWHandler = () => (target) => {
  const { method, url, response, nullablePaths } = target;
  return http[method](baseUrl + url, ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get('_status');
    const nullify = url.searchParams.get('_nullify');
    const res = response();

    if (code && res[code]) {
      const result = res[code];
      if (nullify === 'true') {
        return HttpResponse.json(nullifyValue(result, nullablePaths), { status: Number(code) });
      }

      return HttpResponse.json(result, { status: Number(code) });
    }

    const statusCodes = Object.keys(res);
    const codeToUse = statusCodes.find((code) => code.startsWith('2')) || statusCodes[0];
    const resultToUse = res[codeToUse];
    if (nullify === 'true') {
      return HttpResponse.json(nullifyValue(resultToUse, nullablePaths), { status: Number(codeToUse) });
    }

    return HttpResponse.json(resultToUse, { status: Number(codeToUse) });
  });
};

{exports}
`;

export const UTILS_TS_CONTENT = `
${GENERATED_COMMENT}

{disableComment}

{imports}

const baseUrl = '{baseUrl}';

const nullifyValue = (obj: JsonBodyType, paths: string[]): JsonBodyType => {
  if (typeof obj === 'number' || typeof obj === 'string' || typeof obj === 'boolean' || !obj) {
    return null;
  }

  paths.forEach((path: string) => {
    const keys = path.split('.');
    const lastKey = keys.pop();

    const target = keys.reduce((acc, key: string) => {
      if (acc === null) return {};

      const isArrayIndex = !Number.isNaN(Number(key));
      return isArrayIndex ? acc[Number(key)] : acc[key];
    }, obj);

    if (target && lastKey && lastKey in target) {
      target[lastKey] = null;
    }
  });

  return obj;
};

const createMSWHandler = () => (target: MockHttpHandler) => {
  const { method, url, response, nullablePaths } = target;
  return http[method](baseUrl + url, ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get('_status');
    const nullify = url.searchParams.get('_nullify');
    const res = response();

    if (code && res[code]) {
      const result = res[code];
      if (nullify === 'true') {
        return HttpResponse.json(nullifyValue(result, nullablePaths), {
          status: Number(code),
        });
      }

      return HttpResponse.json(result, { status: Number(code) });
    }

    const statusCodes = Object.keys(res);
    const codeToUse = statusCodes.find((code) => code.startsWith('2')) || statusCodes[0];
    const resultToUse = res[codeToUse];
    if (nullify === 'true' && resultToUse) {
      return HttpResponse.json(nullifyValue(resultToUse, nullablePaths), {
        status: Number(codeToUse),
      });
    }

    return HttpResponse.json(resultToUse, { status: Number(codeToUse) });
  });
};

{exports}
`;

export const INDEX_CONTENT = `
${GENERATED_COMMENT}

{disableComment}

{imports}

if (typeof window === 'undefined') {
  initializeServer();
} else {
  initializeWorker();
}

{exports}
`;
