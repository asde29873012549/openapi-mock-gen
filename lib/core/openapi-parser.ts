import { OpenAPIV3 } from 'openapi-types';

import { ApiInfoByEndpoints, OrganizedApiData, SchemaWithNullablePaths } from '@/lib/shared/types';

export const extractRelevantFields = (paths: OpenAPIV3.PathsObject): ApiInfoByEndpoints[] =>
  Object.entries(paths).flatMap(([pathName, pathItem]) => {
    if (!pathItem) return [];

    return Object.values(OpenAPIV3.HttpMethods).reduce((acc: ApiInfoByEndpoints[], method) => {
      const operation = pathItem[method];

      if (operation) {
        acc.push({
          path: pathName,
          method,
          tags: operation.tags ?? [],
          operationId: operation.operationId ?? '',
          summary: operation.summary ?? '',
          description: operation.description,
          parameters: operation.parameters,
          responses: operation.responses,
        });
      }

      return acc;
    }, []);
  });

const getNullablePaths = (schema: OpenAPIV3.SchemaObject): string[] => {
  const paths: string[] = [];

  const traverse = (subSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject, path: string) => {
    if (!subSchema || '$ref' in subSchema || 'x-circular-ref' in subSchema) {
      return;
    }

    if (subSchema.nullable && path) {
      paths.push(path);
    }

    if (subSchema.allOf) subSchema.allOf.forEach((s) => traverse(s, path));
    if (subSchema.oneOf) subSchema.oneOf.forEach((s) => traverse(s, path));
    if (subSchema.anyOf) subSchema.anyOf.forEach((s) => traverse(s, path));

    if (subSchema.type === 'object' && subSchema.properties) {
      for (const [key, propSchema] of Object.entries(subSchema.properties)) {
        const newPath = path ? `${path}.${key}` : key;
        traverse(propSchema, newPath);
      }
    }

    if (subSchema.type === 'array' && subSchema.items) {
      traverse(subSchema.items, path);
    }
  };

  traverse(schema, '');
  return [...new Set(paths)];
};

const transformExample = (
  example: OpenAPIV3.ExampleObject | OpenAPIV3.ReferenceObject | undefined,
  doc: OpenAPIV3.Document,
  resolvedRefs?: Set<string>
) => {
  if (!example) return {};

  // resolve reference object first if encountered
  if ('$ref' in example) {
    if (resolvedRefs?.has(example.$ref)) {
      console.error('Circular reference detected:', example.$ref);
      return { 'x-circular-ref': true };
    }

    const scopedResolvedRefs = new Set(resolvedRefs);
    scopedResolvedRefs.add(example.$ref);
    const name = example.$ref.split('/').pop() ?? '';
    return transformExample(doc.components?.examples?.[name], doc, scopedResolvedRefs);
  }

  // For now, we do not resolve externalValue, we just provide it as is
  return example.value ?? example.externalValue;
};

const transformSchema = (
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined,
  doc: OpenAPIV3.Document,
  resolvedRefs?: Set<string>
): OpenAPIV3.SchemaObject | Record<string, unknown> => {
  if (!schema) return {};

  // resolve reference object first if encountered
  if ('$ref' in schema) {
    if (resolvedRefs?.has(schema.$ref)) {
      console.error('Circular reference detected:', schema.$ref);
      return { 'x-circular-ref': true };
    }

    const scopedResolvedRefs = new Set(resolvedRefs);
    scopedResolvedRefs.add(schema.$ref);
    const name = schema.$ref.split('/').pop() ?? '';
    return transformSchema(doc.components?.schemas?.[name], doc, scopedResolvedRefs);
  }

  if (schema.type === 'array') {
    return { ...schema, items: schema.items ? transformSchema(schema.items, doc, resolvedRefs) : undefined };
  }

  if (schema.type === 'object') {
    return {
      ...schema,
      properties: schema.properties
        ? Object.fromEntries(
            Object.entries(schema.properties).map(([k, v]) => [k, transformSchema(v, doc, resolvedRefs)])
          )
        : undefined,
    };
  }

  if (schema.allOf) return { ...schema, allOf: schema.allOf.map((s) => transformSchema(s, doc, resolvedRefs)) };
  if (schema.oneOf) return { ...schema, oneOf: schema.oneOf.map((s) => transformSchema(s, doc, resolvedRefs)) };
  if (schema.anyOf) return { ...schema, anyOf: schema.anyOf.map((s) => transformSchema(s, doc, resolvedRefs)) };

  return schema;
};

const resolveResponse = (
  response: OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject,
  doc: OpenAPIV3.Document
): Record<string, SchemaWithNullablePaths> => {
  // resolve reference object first if encountered
  if ('$ref' in response) {
    const name = response.$ref.split('/').pop() ?? '';
    const realResponse = doc.components?.responses?.[name];
    return realResponse ? resolveResponse(realResponse, doc) : {};
  }

  const { content } = response;
  if (!content) return {};

  return Object.fromEntries(
    Object.entries(content).map(([mediaType, mediaObj]) => {
      const { schema, examples, example } = mediaObj;

      const exampleToUse: { [media: string]: OpenAPIV3.ExampleObject | OpenAPIV3.ReferenceObject } | undefined =
        examples || example;

      const exampleObject = exampleToUse
        ? Object.fromEntries(
            Object.entries(exampleToUse).map(([media, example]) => [media, transformExample(example, doc)])
          )
        : undefined;

      const schemaObject = transformSchema(schema, doc);
      const nullablePaths = getNullablePaths(schemaObject);

      return [mediaType, { ...schemaObject, exampleObject, 'x-nullable-paths': nullablePaths }];
    })
  );
};

const recursiveTransform = (responses: OpenAPIV3.ResponsesObject | undefined, doc: OpenAPIV3.Document) => {
  if (!responses) return [];

  return Object.entries(responses).map(([status, response]) => ({
    code: status,
    response: resolveResponse(response, doc),
  }));
};

export const processApiSpec = (apiEndpoints: ApiInfoByEndpoints[], doc: OpenAPIV3.Document): OrganizedApiData[] =>
  apiEndpoints.map((apiEndpoint) => ({
    method: apiEndpoint.method,
    path: apiEndpoint.path,
    operationId: apiEndpoint.operationId,
    description: apiEndpoint.description,
    summary: apiEndpoint.summary,
    responses: recursiveTransform(apiEndpoint.responses, doc),
  }));
