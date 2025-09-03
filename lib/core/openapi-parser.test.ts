import { OpenAPIV3 } from 'openapi-types';

import { ApiInfoByEndpoints, OrganizedApiData } from '../shared/types';

import { extractRelevantFields, processApiSpec } from './openapi-parser';

describe('openapi-parser', () => {
  describe('extractRelevantFields', () => {
    it('should return an empty array for an empty paths object', () => {
      const paths: OpenAPIV3.PathsObject = {};
      expect(extractRelevantFields(paths)).toEqual([]);
    });

    it('should correctly extract information for a simple GET endpoint', () => {
      const paths: OpenAPIV3.PathsObject = {
        '/users': {
          get: {
            tags: ['user'],
            operationId: 'getUsers',
            summary: 'Get all users',
            responses: {},
          },
        },
      };
      const expected: ApiInfoByEndpoints[] = [
        {
          path: '/users',
          method: 'get',
          tags: ['user'],
          operationId: 'getUsers',
          summary: 'Get all users',
          description: undefined,
          parameters: undefined,
          responses: {},
        },
      ];
      expect(extractRelevantFields(paths)).toEqual(expected);
    });

    it('should extract information for multiple methods in a single path', () => {
      const paths: OpenAPIV3.PathsObject = {
        '/users/{id}': {
          get: {
            tags: ['user'],
            operationId: 'getUserById',
            summary: 'Get a user',
            responses: {},
          },
          put: {
            tags: ['user'],
            operationId: 'updateUser',
            summary: 'Update a user',
            responses: {},
          },
        },
      };
      const result = extractRelevantFields(paths);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        path: '/users/{id}',
        method: 'get',
        tags: ['user'],
        operationId: 'getUserById',
        summary: 'Get a user',
        description: undefined,
        parameters: undefined,
        responses: {},
      });
      expect(result).toContainEqual({
        path: '/users/{id}',
        method: 'put',
        tags: ['user'],
        operationId: 'updateUser',
        summary: 'Update a user',
        description: undefined,
        parameters: undefined,
        responses: {},
      });
    });

    it('should handle missing optional fields with default values', () => {
      const paths: OpenAPIV3.PathsObject = {
        '/posts': {
          post: {
            responses: {},
          },
        },
      };
      const expected: ApiInfoByEndpoints[] = [
        {
          path: '/posts',
          method: 'post',
          tags: [],
          operationId: '',
          summary: '',
          description: undefined,
          parameters: undefined,
          responses: {},
        },
      ];
      expect(extractRelevantFields(paths)).toEqual(expected);
    });

    it('should ignore path items that are not valid http methods', () => {
      const paths: OpenAPIV3.PathsObject = {
        '/test': {
          // @ts-expect-error -- Testing invalid http methods
          'x-custom-field': {
            description: 'this should be ignored',
          },
          get: {
            responses: {},
          },
        },
      };
      const result = extractRelevantFields(paths);
      expect(result).toHaveLength(1);
      expect(result[0].method).toBe('get');
    });
  });

  describe('processApiSpec', () => {
    const mockDoc: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
          Error: {
            type: 'object',
            properties: {
              code: { type: 'integer' },
              message: { type: 'string' },
            },
          },
        },
        responses: {
          NotFound: {
            description: 'Not Found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    };

    it('should process a simple endpoint with a direct schema definition', () => {
      const endpoints: ApiInfoByEndpoints[] = [
        {
          path: '/ping',
          method: 'get',
          tags: [],
          operationId: 'ping',
          summary: 'ping',
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { message: { type: 'string' } } },
                },
              },
            },
          },
        },
      ];
      const expected: OrganizedApiData[] = [
        {
          path: '/ping',
          method: 'get',
          operationId: 'ping',
          summary: 'ping',
          responses: [
            {
              code: '200',
              response: {
                'application/json': {
                  type: 'object',
                  properties: { message: { type: 'string' } },
                  'x-nullable-paths': [],
                },
              },
            },
          ],
        },
      ];
      expect(processApiSpec(endpoints, mockDoc)).toEqual(expected);
    });

    it('should resolve schema references in responses', () => {
      const endpoints: ApiInfoByEndpoints[] = [
        {
          path: '/users/{id}',
          method: 'get',
          tags: ['user'],
          operationId: 'getUser',
          summary: 'get a user',
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
      ];
      const result = processApiSpec(endpoints, mockDoc);
      expect(result[0].responses[0].response['application/json']).toEqual({
        ...mockDoc.components?.schemas?.User,
        'x-nullable-paths': [],
      });
    });

    it('should resolve response references', () => {
      const endpoints: ApiInfoByEndpoints[] = [
        {
          path: '/users/{id}',
          method: 'delete',
          tags: ['user'],
          operationId: 'deleteUser',
          summary: 'delete a user',
          responses: {
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      ];
      const result = processApiSpec(endpoints, mockDoc);
      expect(result[0].responses[0].code).toBe('404');
      const errorSchema = mockDoc.components?.schemas?.Error as OpenAPIV3.SchemaObject;
      expect(result[0].responses[0].response['application/json']).toEqual({
        ...errorSchema,
        'x-nullable-paths': [],
      });
    });

    it('should extract nullable paths from schemas', () => {
      const docWithNullable: OpenAPIV3.Document = {
        ...mockDoc,
        components: {
          ...mockDoc.components,
          schemas: {
            ...mockDoc.components?.schemas,
            UserWithNullable: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string', nullable: true },
                profile: {
                  type: 'object',
                  properties: {
                    email: { type: 'string' },
                    address: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        street: { type: 'string' },
                        city: { type: 'string', nullable: true },
                      },
                    },
                  },
                },
                tags: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', nullable: true },
                    },
                  },
                },
                posts: {
                  type: 'array',
                  nullable: true,
                  items: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      };

      const endpoints: ApiInfoByEndpoints[] = [
        {
          path: '/nullable-user',
          method: 'get',
          tags: ['user'],
          operationId: 'getNullableUser',
          summary: 'get a user with nullable fields',
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/UserWithNullable' },
                },
              },
            },
          },
        },
      ];

      const result = processApiSpec(endpoints, docWithNullable);
      const responseSchema = result[0].responses[0].response['application/json'];

      const expectedNullablePaths = ['name', 'profile.address', 'profile.address.city', 'tags.name', 'posts'];
      const nullablePaths = responseSchema['x-nullable-paths'];

      expect(nullablePaths).toEqual(expectedNullablePaths);
    });

    it('should handle nested schemas and arrays of refs', () => {
      const docWithNesting: OpenAPIV3.Document = {
        ...mockDoc,
        components: {
          ...mockDoc.components,
          schemas: {
            ...mockDoc.components?.schemas,
            Users: {
              type: 'array',
              items: { $ref: '#/components/schemas/User' },
            },
            Team: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                members: { $ref: '#/components/schemas/Users' },
              },
            },
          },
        },
      };

      const endpoints: ApiInfoByEndpoints[] = [
        {
          path: '/teams/{id}',
          method: 'get',
          tags: ['team'],
          operationId: 'getTeam',
          summary: 'get a team',
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Team' },
                },
              },
            },
          },
        },
      ];
      const result = processApiSpec(endpoints, docWithNesting);
      const teamSchema = result[0].responses[0].response['application/json'] as OpenAPIV3.SchemaObject;

      // Check root object
      expect((teamSchema.properties?.name as OpenAPIV3.SchemaObject).type).toEqual('string');

      // Check nested ref
      const membersSchema = teamSchema.properties?.members as OpenAPIV3.SchemaObject;
      expect(membersSchema.type).toBe('array');

      // Check array items ref
      if (membersSchema.type === 'array') {
        expect(membersSchema.items).toEqual(docWithNesting.components?.schemas?.User);
      }
    });
  });
});
