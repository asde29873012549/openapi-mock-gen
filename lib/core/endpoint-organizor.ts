import { ApiInfoByEndpoints, GroupedEndpoints } from '@/lib/shared/types';
import { promptForEndpoints } from '@/lib/shared/prompts';

const groupByTags = (apiEndpoints: ApiInfoByEndpoints[]): GroupedEndpoints =>
  apiEndpoints.reduce((acc: GroupedEndpoints, endpoint) => {
    const groupKey = endpoint.tags.length ? `Group(by tags): ${endpoint.tags.join('/')}` : 'Untagged';
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }

    acc[groupKey].push(endpoint);
    return acc;
  }, {});

const groupByPrefix = (apiEndpoints: ApiInfoByEndpoints[]): GroupedEndpoints =>
  apiEndpoints.reduce((acc: GroupedEndpoints, endpoint) => {
    const segments = endpoint.path.split('/').filter(Boolean);

    let targetIndex = 0;
    const commonPrefixes = ['api'];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].toLowerCase();
      const isVersionPattern = /^v\d+$/.test(segment);
      const isCommonPrefix = commonPrefixes.includes(segment);

      if (!isVersionPattern && !isCommonPrefix) {
        targetIndex = i;
        break;
      }
    }

    const groupKey = `Group(by prefix): ${segments[targetIndex] || segments[0] || ''}`;
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }

    acc[groupKey].push(endpoint);
    return acc;
  }, {});

export const autoGroup = (apiEndpointInfos: ApiInfoByEndpoints[]): GroupedEndpoints => {
  const allGroups = groupByTags(apiEndpointInfos);

  const untaggedEndpoints = allGroups['Untagged'];

  if (untaggedEndpoints?.length) {
    delete allGroups['Untagged'];
    const prefixGroups = groupByPrefix(untaggedEndpoints);
    return { ...allGroups, ...prefixGroups };
  }

  return allGroups;
};

export const selectEndpointsForMocking = async (
  apiEndpointInfos: ApiInfoByEndpoints[]
): Promise<ApiInfoByEndpoints[]> => {
  const groupedEndpoints = autoGroup(apiEndpointInfos);

  return await promptForEndpoints(groupedEndpoints);
};
