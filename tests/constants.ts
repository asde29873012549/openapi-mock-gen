export const MOCK_FAKER_DATA = {
  person: {
    fullName: () => 'John Doe',
  },
  internet: {
    email: () => 'test@example.com',
    url: () => 'https://example.com',
    domainName: () => 'example.com',
    ip: () => '192.168.1.1',
    ipv6: () => '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
    jwt: () => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  },
  lorem: {
    sentence: () => 'Lorem ipsum dolor sit amet.',
    paragraph: () => 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    words: () => 'lorem ipsum',
  },
  number: {
    int: () => 2,
    float: () => 0.5,
  },
  string: {
    uuid: () => '123e4567-e89b-12d3-a456-426614174000',
    alpha: () => 'abcdef',
  },
  date: {
    past: () => '2023-01-01T00:00:00.000Z',
  },
  location: {
    city: () => 'Springfield',
    country: () => 'United States',
    latitude: () => 40.7128,
    longitude: () => -74.006,
    state: () => 'IL',
    streetAddress: () => '123 Main St',
    zipCode: () => '12345',
  },
  datatype: {
    boolean: () => true,
  },
  helpers: {
    arrayElement: (arr: unknown[]) => arr[0],
    fromRegExp: () => 'PATTERN_MATCH',
  },
  phone: {
    number: () => '+1-555-123-4567',
  },
  image: {
    url: () => 'https://picsum.photos/200/300',
  },
  seed: () => {},
};
