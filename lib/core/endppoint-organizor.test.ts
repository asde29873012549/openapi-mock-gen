import { ApiInfoByEndpoints } from '@/lib/shared/types';

import { autoGroup } from './endpoint-organizor';

describe('endpoint-organizor', () => {
  describe('autoGroup', () => {
    const endpoints: ApiInfoByEndpoints[] = [
      {
        path: '/api/v1/users',
        method: 'get',
        tags: ['user'],
        operationId: 'getUsers',
        summary: 'Get users',
        responses: {},
      },
      {
        path: '/api/v1/users/{id}',
        method: 'get',
        tags: ['user'],
        operationId: 'getUser',
        summary: 'Get user',
        responses: {},
      },
      {
        path: '/api/v1/products',
        method: 'get',
        tags: ['product'],
        operationId: 'getProducts',
        summary: 'Get products',
        responses: {},
      },
      {
        path: '/api/v2/items',
        method: 'post',
        tags: ['item'],
        operationId: 'createItem',
        summary: 'Create item',
        responses: {},
      },
      {
        path: '/api/v2/items/{id}',
        method: 'delete',
        tags: ['item', 'admin'],
        operationId: 'deleteItem',
        summary: 'Delete item',
        responses: {},
      },
      {
        path: '/public/health',
        method: 'get',
        tags: [],
        operationId: 'healthCheck',
        summary: 'Health check',
        responses: {},
      },
    ];

    it('should group tagged endpoints by tag and untagged endpoints by prefix', () => {
      const grouped = autoGroup(endpoints);
      const keys = Object.keys(grouped).sort();

      expect(keys).toEqual(
        [
          'Group(by prefix): public',
          'Group(by tags): item',
          'Group(by tags): item/admin',
          'Group(by tags): product',
          'Group(by tags): user',
        ].sort()
      );
      expect(grouped['Group(by tags): user']).toHaveLength(2);
      expect(grouped['Group(by tags): product']).toHaveLength(1);
      expect(grouped['Group(by tags): item']).toHaveLength(1);
      expect(grouped['Group(by tags): item/admin']).toHaveLength(1);
      expect(grouped['Group(by prefix): public']).toHaveLength(1);
      expect(grouped['Group(by prefix): public'][0].operationId).toBe('healthCheck');
    });

    it('should correctly group a mix of tagged and many untagged endpoints', () => {
      const endpointsWithMostlyUntagged: ApiInfoByEndpoints[] = [
        { ...endpoints[0], tags: [] },
        { ...endpoints[1], tags: [] },
        { ...endpoints[2], tags: ['product'] },
        { ...endpoints[3], tags: [] },
        { ...endpoints[4], tags: [] },
        { ...endpoints[5], tags: [] },
      ];
      const grouped = autoGroup(endpointsWithMostlyUntagged);
      const keys = Object.keys(grouped).sort();
      expect(keys).toEqual(
        [
          'Group(by prefix): items',
          'Group(by prefix): public',
          'Group(by prefix): users',
          'Group(by tags): product',
        ].sort()
      );
      expect(grouped['Group(by prefix): users']).toHaveLength(2);
      expect(grouped['Group(by prefix): items']).toHaveLength(2);
      expect(grouped['Group(by prefix): public']).toHaveLength(1);
      expect(grouped['Group(by tags): product']).toHaveLength(1);
    });

    it('should group by tags only when no endpoints are untagged', () => {
      const allTaggedEndpoints = endpoints
        .filter((e) => e.path !== '/public/health')
        .map((e) => ({ ...e, tags: e.tags.length ? e.tags : ['misc'] }));
      const grouped = autoGroup(allTaggedEndpoints);
      const keys = Object.keys(grouped).sort();
      expect(keys).toEqual(
        ['Group(by tags): item', 'Group(by tags): item/admin', 'Group(by tags): product', 'Group(by tags): user'].sort()
      );
      expect(grouped.Untagged).toBeUndefined();
    });

    it('should group by prefix only when all endpoints are untagged', () => {
      const allUntaggedEndpoints = endpoints.map((e) => ({ ...e, tags: [] }));
      const grouped = autoGroup(allUntaggedEndpoints);
      const keys = Object.keys(grouped).sort();
      expect(keys).toEqual(
        [
          'Group(by prefix): items',
          'Group(by prefix): public',
          'Group(by prefix): products',
          'Group(by prefix): users',
        ].sort()
      );
      expect(grouped['Group(by prefix): users']).toHaveLength(2);
      expect(grouped['Group(by prefix): products']).toHaveLength(1);
      expect(grouped['Group(by prefix): items']).toHaveLength(2);
      expect(grouped['Group(by prefix): public']).toHaveLength(1);
    });
  });
});
