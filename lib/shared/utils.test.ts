import { OpenAPIV3 } from 'openapi-types';

import { collectedErrors, validateExampleAgainstSchema } from './utils';
import { MockGeneratorInfo, Config } from './types';

describe('validateExampleAgainstSchema', () => {
  beforeEach(() => {
    collectedErrors.clear();
  });

  const mockInfo: Omit<MockGeneratorInfo, 'schema'> = {
    config: {} as Config,
    path: '/test',
    method: 'get',
  };

  it('should not add an error if schema type matches example type', () => {
    const info = {
      ...mockInfo,
      schema: {
        type: 'string',
        example: 'a string',
      } as OpenAPIV3.SchemaObject,
    };
    validateExampleAgainstSchema(info);
    expect(collectedErrors.size).toBe(0);
  });

  it('should add an error if schema type is string but example is number', () => {
    const info = {
      ...mockInfo,
      schema: {
        type: 'string',
        example: 123,
      } as OpenAPIV3.SchemaObject,
    };
    validateExampleAgainstSchema(info, 'testKey');
    const errors = collectedErrors.get('get-/test');
    expect(errors).toHaveLength(1);
    expect(errors?.[0]).toEqual({
      method: 'get',
      path: '/test',
      key: 'testKey',
      schemaType: 'string',
      exampleType: 'number',
    });
  });

  it('should add an error if schema type is number but example is boolean', () => {
    const info = {
      ...mockInfo,
      schema: {
        type: 'number',
        example: false,
      } as OpenAPIV3.SchemaObject,
    };
    validateExampleAgainstSchema(info, 'testKey');
    const errors = collectedErrors.get('get-/test');
    expect(errors).toHaveLength(1);
    expect(errors?.[0]).toEqual({
      method: 'get',
      path: '/test',
      key: 'testKey',
      schemaType: 'number',
      exampleType: 'boolean',
    });
  });

  it('should add an error if schema type is boolean but example is string', () => {
    const info = {
      ...mockInfo,
      schema: {
        type: 'boolean',
        example: 'true',
      } as OpenAPIV3.SchemaObject,
    };
    validateExampleAgainstSchema(info, 'testKey');
    const errors = collectedErrors.get('get-/test');
    expect(errors).toHaveLength(1);
    expect(errors?.[0]).toEqual({
      method: 'get',
      path: '/test',
      key: 'testKey',
      schemaType: 'boolean',
      exampleType: 'string',
    });
  });

  it('should add an error if schema type is object but example is array', () => {
    const info = {
      ...mockInfo,
      schema: {
        type: 'object',
        example: [],
      } as OpenAPIV3.SchemaObject,
    };
    validateExampleAgainstSchema(info, 'root');
    const errors = collectedErrors.get('get-/test');
    expect(errors).toHaveLength(1);
    expect(errors?.[0]).toEqual({
      method: 'get',
      path: '/test',
      key: 'root',
      schemaType: 'object',
      exampleType: 'array',
    });
  });

  it('should add an error if schema type is array but example is object', () => {
    const info = {
      ...mockInfo,
      schema: {
        type: 'array',
        example: {},
      } as OpenAPIV3.SchemaObject,
    };
    validateExampleAgainstSchema(info, 'root');
    const errors = collectedErrors.get('get-/test');
    expect(errors).toHaveLength(1);
    expect(errors?.[0]).toEqual({
      method: 'get',
      path: '/test',
      key: 'root',
      schemaType: 'array',
      exampleType: 'object',
    });
  });

  it('should handle exampleObject correctly', () => {
    const info = {
      ...mockInfo,
      schema: {
        type: 'string',
        exampleObject: 12345,
      } as OpenAPIV3.SchemaObject,
    };
    validateExampleAgainstSchema(info, 'testKey');
    const errors = collectedErrors.get('get-/test');
    expect(errors).toHaveLength(1);
    expect(errors?.[0]).toEqual({
      method: 'get',
      path: '/test',
      key: 'testKey',
      schemaType: 'string',
      exampleType: 'number',
    });
  });

  it('should not add an error if example is not provided', () => {
    const info = {
      ...mockInfo,
      schema: {
        type: 'string',
      } as OpenAPIV3.SchemaObject,
    };
    validateExampleAgainstSchema(info, 'testKey');
    expect(collectedErrors.size).toBe(0);
  });

  it('should correctly accumulate multiple errors for the same endpoint', () => {
    const info1 = {
      ...mockInfo,
      schema: {
        type: 'string',
        example: 123,
      } as OpenAPIV3.SchemaObject,
    };
    const info2 = {
      ...mockInfo,
      schema: {
        type: 'number',
        example: '123',
      } as OpenAPIV3.SchemaObject,
    };
    validateExampleAgainstSchema(info1, 'key1');
    validateExampleAgainstSchema(info2, 'key2');
    const errors = collectedErrors.get('get-/test');
    expect(errors).toHaveLength(2);
    expect(errors?.[0].key).toBe('key1');
    expect(errors?.[1].key).toBe('key2');
  });
});
