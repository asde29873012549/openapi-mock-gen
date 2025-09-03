import merge from 'lodash.merge';
import { OpenAPIV3 } from 'openapi-types';

import { executeCode, interpolateString, validateExampleAgainstSchema } from '@/lib/shared/utils';
import type {
  EndpointConfig,
  FakerMap,
  MockGeneratorInfo,
  OrganizedApiData,
  Config,
  GeneratedMocks,
} from '@/lib/shared/types';
import {
  DEFAULT_CONFIG,
  DEFAULT_MIN_NUMBER,
  DEFAULT_MAX_NUMBER,
  DEFAULT_MULTIPLE_OF,
  DEFAULT_SEED,
} from '@/lib/shared/constants';

const FAKER_HELPERS: Record<string, string> = {
  // Date and Time
  date: 'faker.date.past().toISOString().substring(0, 10)',
  dateTime: 'faker.date.past()',
  time: 'new Date().toISOString().substring(11, 16)',

  // Internet
  email: 'faker.internet.email()',
  hostname: 'faker.internet.domainName()',
  ipv4: 'faker.internet.ip()',
  ipv6: 'faker.internet.ipv6()',
  url: 'faker.internet.url()',
  token: 'faker.internet.jwt()',

  // Location
  city: 'faker.location.city()',
  country: 'faker.location.country()',
  latitude: 'faker.location.latitude()',
  longitude: 'faker.location.longitude()',
  state: 'faker.location.state()',
  street: 'faker.location.streetAddress()',
  zip: 'faker.location.zipCode()',

  // Names and IDs
  name: 'faker.person.fullName()',
  uuid: 'faker.string.uuid()',

  // Numbers
  integer: 'faker.number.int()',
  number: 'faker.number.int({ min: {min}, max: {max}, multipleOf: {multipleOf} })',
  float: 'faker.number.float({ fractionDigits: {fractionDigits} })',

  // Strings
  alpha: 'faker.string.alpha({ length: { min: {minLength}, max: {maxLength} } })',
  alphaMax: 'faker.string.alpha({ length: { max: {maxLength} } })',
  alphaMin: 'faker.string.alpha({ length: { min: {minLength} } })',
  string: 'faker.lorem.words()',

  // Text
  paragraph: 'faker.lorem.paragraph()',
  sentence: 'faker.lorem.sentence()',

  // Utilities
  arrayElement: 'faker.helpers.arrayElement({arrayElement})',
  fromRegExp: 'faker.helpers.fromRegExp({pattern})',
  boolean: 'faker.datatype.boolean()',
  image: 'faker.image.urlLoremFlickr()',
  phone: 'faker.phone.number()',
  avatar: 'faker.image.avatar()',
};

// see: https://json-schema.org/understanding-json-schema/reference/type#built-in-formats
const JSON_SCHEMA_STANDARD_FORMATS: Record<string, string> = {
  date: FAKER_HELPERS.date,
  time: FAKER_HELPERS.time,
  'date-time': FAKER_HELPERS.dateTime,

  email: FAKER_HELPERS.email,
  'idn-email': FAKER_HELPERS.email,

  hostname: FAKER_HELPERS.hostname,
  'idn-hostname': FAKER_HELPERS.hostname,

  ipv4: FAKER_HELPERS.ipv4,
  ipv6: FAKER_HELPERS.ipv6,

  uuid: FAKER_HELPERS.uuid,
  uri: FAKER_HELPERS.url,
  iri: FAKER_HELPERS.url,
  'uri-reference': FAKER_HELPERS.url,
  'iri-reference': FAKER_HELPERS.url,
  'uri-template': FAKER_HELPERS.url,

  regex: FAKER_HELPERS.fromRegExp,
};

const HEURISTIC_STRING_KEY_MAP: Record<string, string> = {
  // General identifiers
  '(?:^|_)id$': FAKER_HELPERS.uuid,
  '(?:^|_)uuid(?:_|$)': FAKER_HELPERS.uuid,
  '(?:^|_)token(?:_|$)': FAKER_HELPERS.token,

  // Timestamps
  '.+_at$': FAKER_HELPERS.dateTime,
  '(?:^|_)timestamp(?:_|$)': FAKER_HELPERS.dateTime,

  // locations
  '(?:^|_)street(?:_|$)': FAKER_HELPERS.street,
  '(?:^|_)city(?:_|$)': FAKER_HELPERS.city,
  '(?:^|_)state(?:_|$)': FAKER_HELPERS.state,
  '(?:^|_)zip(?:_|$)': FAKER_HELPERS.zip,
  '(?:^|_)country(?:_|$)': FAKER_HELPERS.country,
  '^postal_code$': FAKER_HELPERS.zip,
  '(?:^|_)latitude(?:_|$)': FAKER_HELPERS.latitude,
  '(?:^|_)longitude(?:_|$)': FAKER_HELPERS.longitude,

  // phone / contact
  '(?:^|_)phone(?:_|$)': FAKER_HELPERS.phone,
  '(?:^|_)mobile(?:_|$)': FAKER_HELPERS.phone,

  // personal info
  '(?:^|_)email(?:_|$)': FAKER_HELPERS.email,
  '.*name$': FAKER_HELPERS.name,

  // urls
  '(?:^|_)ur[li]$': FAKER_HELPERS.url,
  '\\b(profile|user)_(image|img|photo|picture)\\b|(?:^|_)avatar(?:_|$)': FAKER_HELPERS.avatar,
  '(?:^|_)(photo|image|picture|img)(?:_|$)': FAKER_HELPERS.image,

  // content / text
  '(?:^|_)title(?:_|$)': FAKER_HELPERS.sentence,
  '(?:^|_)description(?:_|$)': FAKER_HELPERS.paragraph,
  '(?:^|_)content(?:_|$)': FAKER_HELPERS.paragraph,
  '(?:^|_)text(?:_|$)': FAKER_HELPERS.paragraph,
  '(?:^|_)paragraph(?:_|$)': FAKER_HELPERS.paragraph,
  '(?:^|_)comments?(?:_|$)': FAKER_HELPERS.sentence,
  '(?:^|_)message(?:_|$)': FAKER_HELPERS.sentence,
  '(?:^|_)summary(?:_|$)': FAKER_HELPERS.paragraph,
};

const moderateScore = interpolateString(FAKER_HELPERS.number, { min: 1, max: 100, multipleOf: DEFAULT_MULTIPLE_OF });
const moderateNumber = interpolateString(FAKER_HELPERS.number, { min: 1, max: 1000, multipleOf: DEFAULT_MULTIPLE_OF });
const moderatePrice = interpolateString(FAKER_HELPERS.number, { min: 1, max: 100000, multipleOf: DEFAULT_MULTIPLE_OF });
const moderateRating = interpolateString(FAKER_HELPERS.number, { min: 1, max: 5, multipleOf: DEFAULT_MULTIPLE_OF });
const moderateFloat = interpolateString(FAKER_HELPERS.float, { fractionDigits: 1 });

const lcg = `(() => {
  const seed = (Math.random() * 9301 + 49297) % 233280;
  const random = seed / 233280;
  return {min} + Math.floor(random * {max});
})()`;

const HEURISTIC_NUMBER_KEY_MAP: Record<string, string> = {
  // Linear Congruential Generator (LCG) formulas for stateless random unique(nearly) numbers
  '^id$': interpolateString(lcg, { min: DEFAULT_MIN_NUMBER, max: DEFAULT_MAX_NUMBER, seed: DEFAULT_SEED }),
  '.+_id$': interpolateString(lcg, { min: DEFAULT_MIN_NUMBER, max: DEFAULT_MAX_NUMBER, seed: DEFAULT_SEED }),

  // age / time
  '(?:^|_)age(?:_|$)': interpolateString(FAKER_HELPERS.number, { min: 20, max: 80, multipleOf: DEFAULT_MULTIPLE_OF }),
  '(?:^|_)year(?:_|$)': interpolateString(FAKER_HELPERS.number, {
    min: 1900,
    max: new Date().getFullYear(),
    multipleOf: DEFAULT_MULTIPLE_OF,
  }),
  '(?:^|_)month(?:_|$)': interpolateString(FAKER_HELPERS.number, { min: 1, max: 12, multipleOf: DEFAULT_MULTIPLE_OF }),
  '(?:^|_)day(?:_|$)': interpolateString(FAKER_HELPERS.number, { min: 1, max: 31, multipleOf: DEFAULT_MULTIPLE_OF }),

  // quatities/counts
  '(?:^|_)counts?(?:_|$)': moderateNumber,
  '(?:^|_)quantity(?:_|$)': moderateNumber,
  '(?:^|_)amount(?:_|$)': moderateNumber,
  '(?:^|_)total(?:_|$)': moderateNumber,

  // financial
  '(?:^|_)price(?:_|$)': moderatePrice,
  '(?:^|_)discounts?(?:_|$)': moderateFloat,
  '(?:^|_)tax(?:_|$)': moderatePrice,
  '(?:^|_)fee(?:_|$)': moderatePrice,

  // dimensions
  '(?:^|_)size(?:_|$)': moderateNumber,
  '(?:^|_)length(?:_|$)': moderateNumber,
  '(?:^|_)width(?:_|$)': moderateNumber,
  '(?:^|_)height(?:_|$)': moderateNumber,
  '(?:^|_)weight(?:_|$)': moderateNumber,

  // ratings
  '(?:^|_)ratings?(?:_|$)': moderateRating,
  '(?:^|_)stars(?:_|$)': moderateRating,
  '(?:^|_)scores?(?:_|$)': moderateScore,
};

const transformNumberBasedOnFormat = (schema: OpenAPIV3.NonArraySchemaObject, key?: string) => {
  const { minimum, maximum, multipleOf, exclusiveMinimum, exclusiveMaximum } = schema;

  if (key) {
    const heuristicKey = Object.keys(HEURISTIC_NUMBER_KEY_MAP).find((rx) => new RegExp(rx).test(key));
    if (heuristicKey) {
      return HEURISTIC_NUMBER_KEY_MAP[heuristicKey];
    }
  }

  const getMinimum = () => {
    const min = minimum ?? DEFAULT_MIN_NUMBER;
    if (exclusiveMinimum) return typeof exclusiveMinimum === 'number' ? exclusiveMinimum + 1 : min + 1;
    return min;
  };

  const getMaximum = () => {
    const max = maximum ?? DEFAULT_MAX_NUMBER;
    if (exclusiveMaximum) return typeof exclusiveMaximum === 'number' ? exclusiveMaximum - 1 : max - 1;
    return max;
  };

  const getMultipleOf = () => {
    if (multipleOf) return multipleOf;
    return DEFAULT_MULTIPLE_OF;
  };

  const min = getMinimum();
  const max = getMaximum();

  return interpolateString(FAKER_HELPERS.number, {
    // prevent non-sense min max values
    min: min > max ? max : min,
    max: max < min ? min : max,
    multipleOf: getMultipleOf(),
  });
};

const transformStringBasedOnFormat = (schema: OpenAPIV3.NonArraySchemaObject, key?: string) => {
  const { format, pattern, minLength, maxLength } = schema;

  if (format && JSON_SCHEMA_STANDARD_FORMATS[format]) {
    return JSON_SCHEMA_STANDARD_FORMATS[format];
  }

  if (pattern) {
    try {
      // check for invalid patterns
      new RegExp(pattern);
      return interpolateString(FAKER_HELPERS.fromRegExp, { pattern: `/${pattern}/` });
    } catch {
      console.error(`Invalid pattern regex pattern in your openapi schema found: ${pattern}`);
      return FAKER_HELPERS.string;
    }
  }

  if (key) {
    const heuristicKey = Object.keys(HEURISTIC_STRING_KEY_MAP).find((rx) => new RegExp(rx).test(key));
    if (heuristicKey) {
      return HEURISTIC_STRING_KEY_MAP[heuristicKey];
    }
  }

  if (minLength !== undefined || maxLength !== undefined) {
    if (minLength !== undefined && maxLength !== undefined) {
      return interpolateString(FAKER_HELPERS.alpha, {
        minLength: minLength > maxLength ? maxLength : minLength,
        maxLength: maxLength < minLength ? minLength : maxLength,
      });
    } else if (minLength) {
      return interpolateString(FAKER_HELPERS.alphaMin, { minLength });
    } else if (maxLength) {
      return interpolateString(FAKER_HELPERS.alphaMax, { maxLength });
    }
  }

  return FAKER_HELPERS.string;
};

const handleObject = (
  info: Omit<MockGeneratorInfo, 'schema'> & { schema: OpenAPIV3.NonArraySchemaObject },
  isInsideArray?: boolean
): string => {
  const { schema, ...context } = info;
  const { properties, additionalProperties } = schema;

  if (!properties) {
    if (typeof additionalProperties === 'object') {
      const value = generateMock({ schema: additionalProperties, ...context }, undefined, isInsideArray);
      return `{ [${FAKER_HELPERS.string}]: ${value} }`;
    }

    // provide example in case no properties are defined
    if (schema.example) {
      return JSON.stringify(schema.example);
    }
  }

  const propertiesEntries = Object.entries(properties ?? {}).map(
    ([key, value]) => `'${key}': ${generateMock({ schema: value, ...context }, key, isInsideArray)}`
  );

  const additionalPropertiesEntries = [];
  if (additionalProperties === true) {
    additionalPropertiesEntries.push(`[${FAKER_HELPERS.string}]: ${FAKER_HELPERS.string}`);
  } else if (typeof additionalProperties === 'object') {
    const value = generateMock({ schema: additionalProperties, ...context }, undefined, isInsideArray);
    additionalPropertiesEntries.push(`[${FAKER_HELPERS.string}]: ${value}`);
  }

  const allEntries = [...propertiesEntries, ...additionalPropertiesEntries];
  return `{${allEntries.join(',\n')}}`;
};

const handleArray = (
  info: Omit<MockGeneratorInfo, 'schema'> & { schema: OpenAPIV3.ArraySchemaObject },
  key?: string
): string => {
  const { schema, ...context } = info;
  const endpointConfig: EndpointConfig = context.config.endpoints?.[context.path]?.[context.method] ?? {};
  const arrayLength = endpointConfig.arrayLength ?? context.config.arrayLength ?? DEFAULT_CONFIG.arrayLength;

  // provide example in case no items are defined
  if (!schema.items && schema.example) {
    return JSON.stringify(schema.example);
  }

  return `Array.from({ length: ${arrayLength} }, () => (${generateMock({ schema: schema.items, ...context }, key, true)}))`;
};

const handleFakerMapping = (key: string, fakerMap: FakerMap): string | null => {
  if (!fakerMap) return null;

  const resolveValue = (value: string | (() => unknown)) => {
    if (typeof value === 'function') return `(${value.toString()})()`;

    if (typeof value === 'string' && value.startsWith('faker.')) {
      return value;
    }

    return JSON.stringify(value);
  };

  if (fakerMap[key]) {
    return resolveValue(fakerMap[key]);
  }

  for (const rx in fakerMap) {
    try {
      if (new RegExp(rx).test(key)) {
        return resolveValue(fakerMap[rx]);
      }
    } catch {
      console.warn(`Invalid regex pattern found: ${rx}`);
    }
  }

  return null;
};

const handleUndefinedType = (info: Omit<MockGeneratorInfo, 'schema'> & { schema: OpenAPIV3.SchemaObject }) => {
  const { schema, ...context } = info;
  const { additionalProperties } = schema;

  if ('properties' in schema || (additionalProperties && typeof additionalProperties === 'object')) {
    return generateMock({ schema: { ...schema, type: 'object' }, ...context });
  } else if ('items' in schema) {
    return generateMock({ schema: { ...schema, type: 'array' }, ...context });
  } else if (
    'minimum' in schema ||
    'maximum' in schema ||
    'multipleOf' in schema ||
    'exclusiveMinimum' in schema ||
    'exclusiveMaximum' in schema
  ) {
    return generateMock({ schema: { ...schema, type: 'number' }, ...context });
  }

  return generateMock({ schema: { ...schema, type: 'string' }, ...context });
};

export function generateMock(
  info: MockGeneratorInfo,
  key?: string,
  isInsideArray = false // a flag to prevent example being used inside the array
): string {
  const { schema, ...context } = info;
  const { config, path: endpointPath, method: endpointMethod } = context;
  const { fakerMap, endpoints, useExample: globalUseExample } = config;

  const endpointConfig: EndpointConfig = endpoints?.[endpointPath]?.[endpointMethod] ?? {};
  const useExample = endpointConfig.useExample ?? globalUseExample;
  const mergedFakerMap = merge({}, fakerMap, endpointConfig.fakerMap);

  if (!schema || '$ref' in schema || 'x-circular-ref' in schema) return 'null';

  if (key) {
    const mapped = handleFakerMapping(key, mergedFakerMap);
    if (mapped) return mapped;
  }

  if (useExample) {
    validateExampleAgainstSchema({ schema, ...context }, key);

    // if mediaType Object examples is provided, use it directly
    if ('exampleObject' in schema && schema.exampleObject) {
      return JSON.stringify(schema.exampleObject);
    }

    // case when example is provided in the schemaObject level
    if ('example' in schema && !isInsideArray) {
      return JSON.stringify(schema.example);
    }
  }

  if (schema.enum) {
    return interpolateString(FAKER_HELPERS.arrayElement, { arrayElement: JSON.stringify(schema.enum) });
  }

  if (schema.allOf) {
    const { allOf, ...rest } = schema;
    return generateMock({ schema: merge({}, ...allOf, rest), ...context }, key, isInsideArray);
  }

  if (schema.oneOf || schema.anyOf) {
    const schemaObjects = schema.oneOf || schema.anyOf || [];
    const arrayElement = schemaObjects
      .map((schemaObject) => generateMock({ schema: schemaObject, ...context }, key, isInsideArray))
      .join(',');

    return interpolateString(FAKER_HELPERS.arrayElement, {
      arrayElement: `[${arrayElement}]`,
    });
  }

  switch (schema.type) {
    case 'string':
      return transformStringBasedOnFormat(schema, key);
    case 'number':
    case 'integer':
      return transformNumberBasedOnFormat(schema, key);
    case 'boolean':
      return FAKER_HELPERS.boolean;
    case 'object':
      return handleObject({ schema, ...context }, isInsideArray);
    case 'array':
      return handleArray({ schema, ...context }, key);
    case undefined:
      return handleUndefinedType({ schema, ...context });
    default:
      return 'null';
  }
}

export const generateMocks = (organizedApiData: OrganizedApiData[], config: Config): GeneratedMocks => {
  const { dynamic } = config;

  return organizedApiData.map((endpoint) => {
    const { path, method, responses } = endpoint;

    return responses.map((res) => {
      const schema = res.response?.['application/json'];
      const info: MockGeneratorInfo = { schema, config, path, method };

      const mockCode = generateMock(info);

      return dynamic ? mockCode : executeCode(mockCode);
    });
  });
};
